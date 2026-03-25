/* ============================================================
 * MODALES DE MEMBRESÍAS – ARCHIVO CORREGIDO COMPLETO
 * ============================================================ */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import Modal from "../../../../../shared/components/Modal/Modal";
import { obtenerServicios } from "../../../hooks/Servicios_API/Servicios_API.jsx";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import { formatCurrencyCOP } from "../../../../../shared/utils/currency";
import useSubmitGuard from "../../../../../shared/hooks/useSubmitGuard";
import "../../../../../shared/styles/restructured/components/modal-membresias.css";

/* ============================================================
 *                    Validaciones & Utilidades
 * ============================================================ */

const REGEX_NOMBRE_PERMITIDO = /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9' -]+$/;
const TIENE_ALGUNA_LETRA = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/;

function normalizarTexto(s = "") {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function existeNombre(existentes = [], nombre = "", ignoreId = null) {
  const target = normalizarTexto(nombre);
  if (!target) return false;

  return existentes.some((m) => {
    if ((m?.id ?? null) === ignoreId) return false;
    return normalizarTexto(m?.nombre ?? "") === target;
  });
}

const validarBeneficios = (arr) =>
  Array.isArray(arr) && arr.length > 0
    ? ""
    : "Debe seleccionar al menos un servicio";

const validarEstado = (value) =>
  ["Activo", "Inactivo"].includes(value) ? "" : "El estado no es válido";

/* ============================================================
 *      Modal Crear / Editar Membresía (con servicios)
 * ============================================================ */

const MAX_SERVICIOS_VISIBLES = 5;

export const ModalFormularioMembresia = ({
  isOpen,
  onClose,
  onSubmit,
  membresia,
  title = "Nueva Membresía",
  existentes = [],
  checkNombreUnico,
}) => {
  const { runGuardedSubmit } = useSubmitGuard();
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precioVenta: "",
    duracion_dias: "",
    estado: "Activo",
    beneficios: [],
  });

  const [errores, setErrores] = useState({});
  const [checkingNombre, setCheckingNombre] = useState(false);

  const [serviciosOpts, setServiciosOpts] = useState([]);
  const [cargandoSrv, setCargandoSrv] = useState(false);
  const [errorSrv, setErrorSrv] = useState("");
  const [busquedaServicio, setBusquedaServicio] = useState("");

  /* ----------------------------------------------------------- */
  /*        Al abrir modal cargar datos
  /* ----------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) return;

    if (membresia) {
      setFormData({
        nombre: membresia.nombre || "",
        descripcion: membresia.descripcion || "",
        precioVenta: membresia.precioVenta || "",
        duracion_dias: membresia.duracion_dias || membresia.duracion || "",
        estado: membresia.estado || "Activo",
        beneficios: [], // Se procesarán después cuando serviciosOpts esté listo
      });
    } else {
      setFormData({
        nombre: "",
        descripcion: "",
        precioVenta: "",
        duracion_dias: "",
        estado: "Activo",
        beneficios: [],
      });
    }

    setErrores({});
    setBusquedaServicio("");
  }, [membresia, isOpen]);

  /* ----------------------------------------------------------- */
  /* ----------------------------------------------------------- */
  // Procesar beneficios cuando servicios estén listos
  // ----------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen || !membresia || serviciosOpts.length === 0) return;

    const beneficiosGuardados = membresia.beneficios || [];
    const beneficios = [];

    // Procesar cada beneficio guardado con lógica más robusta
    beneficiosGuardados.forEach((beneficio) => {
      // Si es string numérico (ID como string)
      if (typeof beneficio === "string" && !isNaN(Number(beneficio))) {
        const idStr = beneficio.trim();
        const servicioEncontrado = serviciosOpts.find(
          (srv) => srv.value === idStr
        );
        if (servicioEncontrado) {
          beneficios.push(servicioEncontrado.value);
        }
      }
      // Si es número
      else if (typeof beneficio === "number") {
        const idStr = String(beneficio);
        const servicioEncontrado = serviciosOpts.find(
          (srv) => srv.value === idStr
        );
        if (servicioEncontrado) {
          beneficios.push(servicioEncontrado.value);
        }
      }
      // Si es objeto con ID
      else if (typeof beneficio === "object" && beneficio !== null) {
        const id =
          beneficio.id_servicio ||
          beneficio.id ||
          beneficio.servicio_id ||
          beneficio.id_servicios;
        if (id) {
          const idStr = String(id);
          const servicioEncontrado = serviciosOpts.find(
            (srv) => srv.value === idStr
          );
          if (servicioEncontrado) {
            beneficios.push(servicioEncontrado.value);
          }
        }
      }
      // Si es string (nombre del servicio) - buscar por nombre
      else if (typeof beneficio === "string") {
        const nombreNormalizado = beneficio.toLowerCase().trim();
        const servicioEncontrado = serviciosOpts.find(
          (srv) => srv.label.toLowerCase().trim() === nombreNormalizado
        );
        if (servicioEncontrado) {
          beneficios.push(servicioEncontrado.value);
        }
      }
    });

    // Si no se encontraron beneficios por las reglas anteriores,
    // intentar una búsqueda más flexible por nombre parcial
    if (beneficios.length === 0 && beneficiosGuardados.length > 0) {
      beneficiosGuardados.forEach((beneficio) => {
        if (typeof beneficio === "string") {
          const nombreBuscado = beneficio.toLowerCase().trim();
          // Buscar si el nombre contiene alguna parte del servicio
          const servicioEncontrado = serviciosOpts.find(
            (srv) =>
              srv.label.toLowerCase().includes(nombreBuscado) ||
              nombreBuscado.includes(srv.label.toLowerCase())
          );
          if (servicioEncontrado) {
          beneficios.push(servicioEncontrado.value);
          }
        }
      });
    }

    setFormData((prev) => ({
      ...prev,
      beneficios: [...new Set(beneficios)], // Eliminar duplicados
    }));
  }, [membresia, isOpen, serviciosOpts]);

  /* ----------------------------------------------------------- */
  /*        Cargar servicios
  /* ----------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) return;

    const ac = new AbortController();
    setCargandoSrv(true);
    setErrorSrv("");

    (async () => {
      try {
        const resp = await obtenerServicios();
        const listaServicios = Array.isArray(resp)
          ? resp
          : Array.isArray(resp?.data)
          ? resp.data
          : Array.isArray(resp?.servicios)
          ? resp.servicios
          : Array.isArray(resp?.results)
          ? resp.results
          : [];

        const activos = listaServicios.filter((s) => {
          const estadoNum = Number(
            s?.id_estado ??
              s?.estado_id ??
              s?.estado?.id_estado ??
              s?.id_estado_estado?.id_estado
          );

          if (Number.isFinite(estadoNum)) return estadoNum === 1;

          const estadoTexto = normalizarTexto(
            s?.estado ??
              s?.estado_servicio ??
              s?.id_estado_estado?.nombre_estado ??
              s?.id_estado_estado?.estado ??
              ""
          );
          return !estadoTexto || estadoTexto === "activo";
        });

        setServiciosOpts(
          activos
            .map((s) => {
              const id = s?.id_servicio ?? s?.id_servicios ?? s?.id ?? null;
              const nombre =
                s?.nombre_servicio ?? s?.nombre ?? s?.titulo ?? null;
              if (!id || !nombre) return null;
              return {
                value: String(id),
                label: String(nombre),
              };
            })
            .filter(Boolean)
        );
      } catch {
        setServiciosOpts([]);
        setErrorSrv("No se pudieron cargar los servicios");
      } finally {
        setCargandoSrv(false);
      }
    })();

    return () => ac.abort();
  }, [isOpen]);

  /* ----------------------------------------------------------- */
  /*                  Validaciones
  /* ----------------------------------------------------------- */
  const validarNombre = (value) => {
    const v = (value ?? "").trim();

    if (!v) return "El nombre es obligatorio";
    if (v.length < 3) return "Debe tener mínimo 3 caracteres";
    if (v.length > 50) return "No puede superar 50 caracteres";
    if (!REGEX_NOMBRE_PERMITIDO.test(v))
      return "Solo permite letras, números, espacios y guiones";
    if (!TIENE_ALGUNA_LETRA.test(v)) return "Debe tener al menos una letra";

    if (existeNombre(existentes, v, membresia?.id ?? null))
      return "Ya existe una membresia con ese nombre";

    return "";
  };

  const validarDescripcion = (v) =>
    !v.trim()
      ? "La descripcion es obligatoria"
      : v.length < 10
      ? "Debe tener mínimo 10 caracteres"
      : "";

  const validarPrecio = (v) =>
    !v
      ? "El precio es obligatorio"
      : !/^\d+([.,]\d{1,2})?$/.test(String(v).trim())
      ? "Debe ser un valor válido con hasta 2 decimales"
      : Number(v) <= 0
      ? "Debe ser mayor a 0"
      : "";

  const validarDuracionDias = (v) => {
    const num = Number(v);
    if (!v || v === "") return "La duración es obligatoria";
    if (isNaN(num) || num <= 0) return "Debe ser un número mayor a 0";
    if (num > 365) return "No puede superar 365 días";
    return "";
  };

  const buildSyncErrors = (data) => ({
    nombre: validarNombre(data.nombre),
    descripcion: validarDescripcion(data.descripcion),
    precioVenta: validarPrecio(String(data.precioVenta || "").replace(",", ".")),
    duracion_dias: validarDuracionDias(data.duracion_dias),
    estado: validarEstado(data.estado),
    beneficios: validarBeneficios(data.beneficios),
  });

  /* ----------------------------------------------------------- */
  /*                  Validar todo
  /* ----------------------------------------------------------- */
  const validarTodo = async () => {
    const errs = buildSyncErrors({
      ...formData,
      precioVenta: String(formData.precioVenta || "").replace(",", "."),
    });

    if (!errs.nombre && typeof checkNombreUnico === "function") {
      setCheckingNombre(true);
      const libre = await checkNombreUnico(
        formData.nombre,
        membresia?.id ?? null
      );
      setCheckingNombre(false);
      if (!libre) errs.nombre = "Nombre ya existe (servidor)";
    }

    setErrores(errs);
    return Object.values(errs).every((e) => !e);
  };

  /* ----------------------------------------------------------- */
  /*              Handlers
  /* ----------------------------------------------------------- */
  const handleNumericKeyDown = (e) => {
    // Permitir teclas de control (backspace, delete, tab, escape, enter, etc.)
    const controlKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ];
    if (controlKeys.includes(e.key)) return;

    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
    if (e.ctrlKey && ["a", "c", "v", "x", "z"].includes(e.key.toLowerCase()))
      return;

    // Para campos numéricos, solo permitir dígitos, punto decimal y coma
    if (!/[\d.,]/.test(e.key)) {
      e.preventDefault();
    }

    // Prevenir la letra 'e' y 'E' (notación científica)
    if (e.key.toLowerCase() === "e") {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const normalizedValue =
      name === "precioVenta"
        ? value
            .replace(/[^0-9.,]/g, "")
            .replace(/,/g, ".")
            .replace(/(\..*)\./g, "$1")
        : name === "duracion_dias"
          ? value.replace(/\D/g, "")
          : value;

    const nextFormData = { ...formData, [name]: normalizedValue };
    setFormData(nextFormData);
    setErrores(buildSyncErrors(nextFormData));
  };

  const toggleBeneficio = (id, checked) => {
    setFormData((prev) => {
      const set = new Set(prev.beneficios);
      if (checked) set.add(id);
      else set.delete(id);

      const nextFormData = { ...prev, beneficios: [...set] };
      setErrores(buildSyncErrors(nextFormData));
      return nextFormData;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!(await validarTodo())) return;

    if (checkingNombre) return;
    await runGuardedSubmit(async () => {
      try {
        const resultado = await Promise.resolve(
          onSubmit({
            ...formData,
            id: membresia?.id || null,
            fechaCreacion:
              membresia?.fechaCreacion || new Date().toISOString().split("T")[0],
            beneficios: formData.beneficios,
          })
        );
        if (resultado === false) {
          throw new Error(
            membresia?.id
              ? "No se pudo actualizar la membresia"
              : "No se pudo crear la membresia"
          );
        }
        toast.success(
          membresia?.id
            ? "Membresía actualizada exitosamente"
            : "Membresía creada exitosamente"
        );
        onClose();
      } catch (error) {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "No se pudo guardar la membresia"
        );
      }
    });
  };

  if (!isOpen) return null;

  /* ----------------------------------------------------------- */
  /*                VISTA DEL FORMULARIO
  /* ----------------------------------------------------------- */
  const requiredMark = <span className="modal-membresias__required">*</span>;
  const terminoServicio = normalizarTexto(busquedaServicio);
  const serviciosFiltrados = serviciosOpts.filter((srv) =>
    normalizarTexto(srv.label).includes(terminoServicio)
  );
  const serviciosVisibles = serviciosFiltrados.slice(0, MAX_SERVICIOS_VISIBLES);
  const formId = "modal-membresias-form";

  return (
    <Modal
      title={title}
      onClose={onClose}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="boton boton-secundario"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form={formId}
            className="boton boton-primario"
            disabled={checkingNombre}
          >
            Guardar
          </button>
        </>
      }
    >
      <motion.form
        id={formId}
        onSubmit={handleSubmit}
        className="modal-membresias__form"
        noValidate
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
        <motion.div
          className="modal-membresias__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h2 className="modal-membresias__section-title">Información Básica</h2>

          <div className="modal-membresias__field">
            <label className="modal-membresias__label">Nombre {requiredMark}</label>
            <input
              type="text"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ingrese el nombre de la membresia"
              maxLength={80}
              className={`modal-membresias__input${errores.nombre ? " modal-membresias__input--error" : ""}`}
            />
            {errores.nombre && <p className="modal-membresias__error-text">{errores.nombre}</p>}
          </div>

          <div className="modal-membresias__field">
            <label className="modal-membresias__label">Precio {requiredMark}</label>
            <input
              type="text"
              name="precioVenta"
              value={formData.precioVenta}
              onChange={handleChange}
              onKeyDown={handleNumericKeyDown}
              placeholder="Precio de venta"
              inputMode="decimal"
              className={`modal-membresias__input${errores.precioVenta ? " modal-membresias__input--error" : ""}`}
            />
            {errores.precioVenta && (
              <p className="modal-membresias__error-text">{errores.precioVenta}</p>
            )}
          </div>

          <div className="modal-membresias__field">
            <label className="modal-membresias__label">Duración (días) {requiredMark}</label>
            <input
              type="text"
              name="duracion_dias"
              value={formData.duracion_dias}
              onChange={handleChange}
              onKeyDown={handleNumericKeyDown}
              placeholder="Duración en días"
              inputMode="numeric"
              className={`modal-membresias__input${errores.duracion_dias ? " modal-membresias__input--error" : ""}`}
            />
            {errores.duracion_dias && (
              <p className="modal-membresias__error-text">{errores.duracion_dias}</p>
            )}
          </div>

          <div className="modal-membresias__field">
            <label className="modal-membresias__label">Estado</label>
            <select
              name="estado"
              value={formData.estado}
              onChange={handleChange}
              className={`modal-membresias__input modal-membresias__select${errores.estado ? " modal-membresias__input--error" : ""}`}
            >
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
            {errores.estado && (
              <p className="modal-membresias__error-text">{errores.estado}</p>
            )}
          </div>
        </motion.div>

        <motion.div
          className="modal-membresias__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <h2 className="modal-membresias__section-title">Información Adicional</h2>

          <div className="modal-membresias__field">
            <label className="modal-membresias__label">Descripción {requiredMark}</label>
            <textarea
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              placeholder="Describe la membresia"
              rows={4}
              className={`modal-membresias__input modal-membresias__textarea${errores.descripcion ? " modal-membresias__input--error" : ""}`}
            />
            {errores.descripcion && (
              <p className="modal-membresias__error-text">{errores.descripcion}</p>
            )}
          </div>

          <div className="modal-membresias__field">
            <label className="modal-membresias__label">Servicios incluidos {requiredMark}</label>
            <div className="modal-membresias__services-box">
              <input
                type="text"
                value={busquedaServicio}
                onChange={(e) => setBusquedaServicio(e.target.value)}
                placeholder="Buscar servicio..."
                className="modal-membresias__input modal-membresias__services-search-input"
                disabled={cargandoSrv || !!errorSrv}
              />

              <div className="modal-membresias__services-options">
                {serviciosVisibles.map((srv) => (
                  <label key={srv.value} className="modal-membresias__service-item">
                    <input
                      type="checkbox"
                      checked={formData.beneficios.includes(srv.value)}
                      onChange={(e) =>
                        toggleBeneficio(srv.value, e.target.checked)
                      }
                    />
                    <span className="modal-membresias__service-name">{srv.label}</span>
                  </label>
                ))}

                {cargandoSrv && <p className="modal-membresias__muted-text">Cargando servicios...</p>}
                {errorSrv && <p className="modal-membresias__error-text">{errorSrv}</p>}
                {!cargandoSrv && !errorSrv && !serviciosVisibles.length && (
                  <p className="modal-membresias__muted-text">
                    No se encontraron servicios con esa búsqueda
                  </p>
                )}
              </div>
            </div>

            {errores.beneficios && (
              <p className="modal-membresias__error-text">{errores.beneficios}</p>
            )}
          </div>
        </motion.div>

        </motion.div>
      </motion.form>
    </Modal>
  );
};

/* ============================================================
 *                Modal Eliminar
 * ============================================================ */

export const ModalEliminarMembresia = ({
  isOpen,
  onClose,
  onConfirm,
  membresia,
}) => {
  if (!isOpen || !membresia) return null;

  const formatPrice = (p) =>
    p == null
      ? "No especificado"
      : formatCurrencyCOP(p);

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => onConfirm(membresia)}
      item={membresia}
      title="Eliminar Membresía"
      size="sm"
      fields={[
        { key: "nombre", label: "Nombre" },
        { key: "precioVenta", label: "Precio", format: formatPrice },
        {
          key: "duracion_dias",
          label: "Duración",
          format: (value) => `${value || 0} días`,
        },
      ]}
    />
  );
};

/* ============================================================
 *                Modal Ver (solo lectura) - Reorganizado
 * ============================================================ */

export const ModalVerMembresia = ({ isOpen, onClose, membresia }) => {
  const [servicios, setServicios] = useState([]);
  const [cargandoServicios, setCargandoServicios] = useState(false);

  // Cargar servicios cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    const cargarServicios = async () => {
      setCargandoServicios(true);
      try {
        const respuesta = await obtenerServicios();
        const listaServicios = Array.isArray(respuesta)
          ? respuesta
          : Array.isArray(respuesta?.data)
          ? respuesta.data
          : Array.isArray(respuesta?.servicios)
          ? respuesta.servicios
          : Array.isArray(respuesta?.results)
          ? respuesta.results
          : [];

        // Filtrar solo servicios activos y mapear correctamente
        const serviciosActivos = listaServicios
          .filter((servicio) => Number(servicio?.id_estado) === 1)
          .map((servicio) => ({
            id:
              servicio.id_servicio ??
              servicio.id_servicios ??
              servicio.id ??
              null,
            nombre:
              servicio.nombre_servicio ?? servicio.nombre ?? servicio.titulo,
          }));

        setServicios(serviciosActivos.filter((servicio) => servicio.id));
      } catch (error) {
        console.error("Error al cargar servicios:", error);
        setServicios([]);
      } finally {
        setCargandoServicios(false);
      }
    };

    cargarServicios();
  }, [isOpen]);

  // Función para obtener los nombres de servicios asociados desde detalles_membresias
  const getServiciosAsociados = () => {
    if (!membresia?.detalles_membresias) return [];

    // Filtrar solo detalles activos y mapear a nombres de servicios
    const serviciosAsociados = membresia.detalles_membresias
      .filter((detalle) => detalle.id_estado === 1) // Solo detalles activos
      .map((detalle) => {
        // Buscar el servicio correspondiente por id_servicio
        const servicio = servicios.find((s) => s.id === detalle.id_servicio);
        return servicio ? servicio.nombre : `Servicio ${detalle.id_servicio}`;
      })
      .filter((nombre) => nombre && !nombre.startsWith("Servicio ")); // Filtrar servicios no encontrados

    return serviciosAsociados;
  };

  if (!isOpen || !membresia) return null;

  const formatPrice = (price) => {
    if (price === undefined || price === null) return "No especificado";
    return formatCurrencyCOP(price);
  };

  const serviciosAsociados = getServiciosAsociados();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalles de la Membresía #${membresia.id || "N/A"}`}
      size="md"
      closeOnOverlayClick
      className="modal-mediano"
    >
      <motion.div
        className="modal-membresias__detail-stack"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <motion.div
          className="modal-membresias__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h3 className="modal-membresias__section-title">Información Básica</h3>

          <div className="modal-membresias__detail-grid">
            <div className="modal-membresias__field">
              <label className="modal-membresias__label">ID Membresía</label>
              <input
                type="text"
                className="modal-membresias__input modal-membresias__input--readonly"
                value={membresia.id || "Sin ID"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-membresias__field">
              <label className="modal-membresias__label">Nombre</label>
              <input
                type="text"
                className="modal-membresias__input modal-membresias__input--readonly"
                value={membresia.nombre || "Sin nombre"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-membresias__field">
              <label className="modal-membresias__label">Precio</label>
              <input
                type="text"
                className="modal-membresias__input modal-membresias__input--readonly"
                value={formatPrice(membresia.precioVenta)}
                readOnly
                disabled
              />
            </div>

            <div className="modal-membresias__field">
              <label className="modal-membresias__label">Duración (días)</label>
              <input
                type="text"
                className="modal-membresias__input modal-membresias__input--readonly"
                value={`${
                  membresia.duracion_dias || membresia.duracion || 0
                } días`}
                readOnly
                disabled
              />
            </div>

            <div className="modal-membresias__field">
              <label className="modal-membresias__label">Estado</label>
              <input
                type="text"
                className="modal-membresias__input modal-membresias__input--readonly"
                value={membresia.estado || "Sin estado"}
                readOnly
                disabled
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="modal-membresias__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <h3 className="modal-membresias__section-title">Información Adicional</h3>

          <div className="modal-membresias__detail-grid">
            <div className="modal-membresias__field">
              <label className="modal-membresias__label">Descripción</label>
              <textarea
                className="modal-membresias__input modal-membresias__textarea modal-membresias__textarea--readonly"
                value={membresia.descripcion || "Sin descripcion"}
                readOnly
                disabled
                rows={4}
              />
            </div>

            <div className="modal-membresias__field">
              <label className="modal-membresias__label">Servicios Incluidos</label>
              <div className="modal-membresias__included-services">
                {cargandoServicios ? (
                  <p className="modal-membresias__muted-text">
                    Cargando servicios...
                  </p>
                ) : serviciosAsociados.length > 0 ? (
                  <ul className="modal-membresias__services-list">
                    {serviciosAsociados.map((servicio, i) => (
                      <li
                        key={i}
                        className="modal-membresias__services-list-item"
                      >
                        {servicio}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="modal-membresias__muted-text">
                    No hay servicios asociados
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="pie-modal contenedor-botones modal-membresias__detail-footer"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <button
            className="boton boton-secundario"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
        </motion.div>
      </motion.div>
    </Modal>
  );
};
