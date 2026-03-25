import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import Modal from "../../../../../shared/components/Modal/Modal";
import { formatCurrencyCOP } from "../../../../../shared/utils/currency";
import useSubmitGuard from "../../../../../shared/hooks/useSubmitGuard";
import "../../../../../shared/styles/restructured/components/modal-servicios.css";

const useLockBodyScroll = (isOpen) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = isOpen ? "hidden" : prevOverflow || "";
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [isOpen]);
};

/* ======================================================
   Modal genérico base (ahora usando el componente Modal compartido)
   Mantiene la misma API para no romper compatibilidad
====================================================== */
export const ModalServicios = ({
  isOpen,
  onClose,
  children,
  title,
  size = "sm",
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      closeOnOverlayClick
      className="modal-mediano"
    >
      {children}
    </Modal>
  );
};

/* ======================================================
   Modal Crear / Editar Servicio (con validaciones)
====================================================== */
export const ModalFormularioServicio = ({
  isOpen,
  onClose,
  onSave,
  servicio,
  title = "Nuevo Servicio",
}) => {
  useLockBodyScroll(isOpen);
  const { runGuardedSubmit } = useSubmitGuard();

  const [formData, setFormData] = useState({
    id_servicio: "",
    nombre_servicio: "",
    descripcion_servicio: "",
    precio_servicio: "",
    tipo_servicio: "Acceso",
    id_estado: 1,
    fecha_creacion: "",
    fecha_actualizacion: "",
  });

  const [errores, setErrores] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const TIPOS_SERVICIO_VALIDOS = ["Acceso", "Actividad"];
  const ESTADOS_VALIDOS = [1, 2];

  useEffect(() => {
    if (servicio) {
      setFormData({
        id_servicio: servicio.id_servicio || null,
        nombre_servicio: servicio.nombre_servicio || "",
        descripcion_servicio: servicio.descripcion_servicio || "",
        precio_servicio: servicio.precio_servicio
          ? String(servicio.precio_servicio)
          : "",
        tipo_servicio: servicio.tipo_servicio || "Acceso",
        id_estado: servicio.id_estado || 1,
      });
    } else {
      const now = new Date().toISOString();
      setFormData({
        id_servicio: null,
        nombre_servicio: "",
        descripcion_servicio: "",
        precio_servicio: "",
        tipo_servicio: "Acceso",
        id_estado: 1,
        fecha_creacion: now,
        fecha_actualizacion: now,
      });
    }
    setErrores({});
    setIsSubmitting(false);
  }, [servicio, isOpen]);

  const buildValidationErrors = (data) => {
    const nuevosErrores = {};
    const nombre = String(data.nombre_servicio || "").trim();
    const descripcion = String(data.descripcion_servicio || "").trim();
    const precioTexto = String(data.precio_servicio || "").trim();
    const precio = Number(precioTexto);
    const tipoServicio = String(data.tipo_servicio || "").trim();
    const estado = Number(data.id_estado);

    if (!nombre) {
      nuevosErrores.nombre_servicio = "El nombre es obligatorio";
    } else if (nombre.length < 3) {
      nuevosErrores.nombre_servicio = "Debe tener al menos 3 caracteres";
    } else if (nombre.length > 80) {
      nuevosErrores.nombre_servicio = "No puede superar 80 caracteres";
    }

    if (!descripcion) {
      nuevosErrores.descripcion_servicio = "La descripción es obligatoria";
    } else if (descripcion.length < 10) {
      nuevosErrores.descripcion_servicio = "Debe tener al menos 10 caracteres";
    } else if (descripcion.length > 200) {
      nuevosErrores.descripcion_servicio = "No puede superar 200 caracteres";
    }

    if (!precioTexto) {
      nuevosErrores.precio_servicio = "El precio es obligatorio";
    } else if (!/^\d+(\.\d{1,2})?$/.test(precioTexto)) {
      nuevosErrores.precio_servicio = "Debe ser un valor válido con hasta 2 decimales";
    } else if (!Number.isFinite(precio) || precio <= 0) {
      nuevosErrores.precio_servicio = "El precio debe ser mayor a 0";
    }

    if (!TIPOS_SERVICIO_VALIDOS.includes(tipoServicio)) {
      nuevosErrores.tipo_servicio = "Debe seleccionar un tipo de servicio válido";
    }

    if (!ESTADOS_VALIDOS.includes(estado)) {
      nuevosErrores.id_estado = "Debe seleccionar un estado válido";
    }

    return nuevosErrores;
  };

  const validar = () => {
    const nuevosErrores = buildValidationErrors(formData);
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const normalizedValue =
      name === "precio_servicio"
        ? value
            .replace(/[^0-9.]/g, "")
            .replace(/(\..*)\./g, "$1")
        : value;
    const nextFormData = { ...formData, [name]: normalizedValue };
    setFormData(nextFormData);
    setErrores(buildValidationErrors(nextFormData));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (validar()) {
      const now = new Date().toISOString();
      const tipoServicioTexto = String(formData.tipo_servicio || "").trim();
      const tipoServicioNormalizado = tipoServicioTexto.toLowerCase();
      const idTipoServicio =
        tipoServicioNormalizado === "actividad"
          ? 2
          : tipoServicioNormalizado === "acceso"
            ? 1
            : null;

      const datosEnviar = {
        id_servicio: formData.id_servicio || null,
        nombre_servicio: formData.nombre_servicio.trim(),
        descripcion_servicio: formData.descripcion_servicio.trim(),
        precio_servicio: parseFloat(formData.precio_servicio),
        tipo_servicio: tipoServicioTexto,
        ...(idTipoServicio ? { id_tipo_servicio: idTipoServicio } : {}),
        id_estado: Number(formData.id_estado) || 1,
        fecha_actualizacion: now,
      };

      if (!formData.id_servicio) {
        datosEnviar.fecha_creacion = now;
      }
      await runGuardedSubmit(async () => {
        try {
          setIsSubmitting(true);
          const resultado = await Promise.resolve(onSave(datosEnviar));
          if (resultado === false) {
            return;
          }
          onClose();
        } catch (error) {
          toast.error(
            error?.response?.data?.message ||
              error?.message ||
              "No se pudo guardar el servicio"
          );
        } finally {
          setIsSubmitting(false);
        }
      });
    }
  };

  if (!isOpen) return null;
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.24,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.18,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.97,
      y: 14,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.985,
      y: 10,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  return (
    <ModalServicios isOpen={isOpen} onClose={onClose} title={servicio ? "Editar Servicio" : "Nuevo Servicio"}>
      <motion.form
        onSubmit={handleSubmit}
        noValidate
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <motion.div
          className="modal-form-card"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <h2 className="modal-section-title">
            Información del Servicio
          </h2>

          <motion.div
            className="modal-field-group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            <label
              className="modal-field-label"
            >
              Nombre del Servicio <span className="modal-required-asterisk">*</span>
            </label>
            <input
              type="text"
              name="nombre_servicio"
              value={formData.nombre_servicio}
              onChange={handleChange}
              placeholder="Ej: Membresía Básica"
              className={`modal-field-input ${errores.nombre_servicio ? "modal-servicios__input--error" : ""}`}
            />
            {errores.nombre_servicio && (
              <p
                className="modal-servicios__error-text"
              >
                {errores.nombre_servicio}
              </p>
            )}
          </motion.div>

          <motion.div
            className="modal-field-group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.3 }}
          >
            <label
              className="modal-field-label"
            >
              Precio ($) <span className="modal-required-asterisk">*</span>
            </label>
            <input
              type="text"
              name="precio_servicio"
              value={formData.precio_servicio}
              onChange={handleChange}
              inputMode="decimal"
              placeholder="0.00"
              className={`modal-field-input ${errores.precio_servicio ? "modal-servicios__input--error" : ""}`}
            />
            {errores.precio_servicio && (
              <p
                className="modal-servicios__error-text"
              >
                {errores.precio_servicio}
              </p>
            )}
          </motion.div>

          <motion.div
            className="modal-field-group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.3 }}
          >
            <label
              className="modal-field-label"
            >
              Tipo de Servicio <span className="modal-required-asterisk">*</span>
            </label>
            <select
              name="tipo_servicio"
              value={formData.tipo_servicio}
              onChange={handleChange}
              className={`modal-field-input modal-field-input--select ${errores.tipo_servicio ? "modal-servicios__input--error" : ""}`}
            >
              <option value="Acceso">Acceso</option>
              <option value="Actividad">Actividad</option>
            </select>
            {errores.tipo_servicio && (
              <p className="modal-servicios__error-text">
                {errores.tipo_servicio}
              </p>
            )}
          </motion.div>

          <motion.div
            className="modal-field-group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.3 }}
          >
            <label
              className="modal-field-label"
            >
              Estado
            </label>
            <select
              name="id_estado"
              value={formData.id_estado}
              onChange={handleChange}
              className={`modal-field-input modal-field-input--select ${errores.id_estado ? "modal-servicios__input--error" : ""}`}
            >
              <option value={1}>Activo</option>
              <option value={2}>Inactivo</option>
            </select>
            {errores.id_estado && (
              <p className="modal-servicios__error-text">
                {errores.id_estado}
              </p>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          className="modal-form-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <h2 className="modal-section-title">
            Descripción
          </h2>

          <motion.div
            className="modal-field-group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.3 }}
          >
            <label
              className="modal-field-label"
            >
              Descripción
            </label>
            <textarea
              name="descripcion_servicio"
              value={formData.descripcion_servicio}
              onChange={handleChange}
              rows="3"
              placeholder="Descripción detallada del servicio"
              className={`modal-field-input modal-field-input--textarea modal-servicios__textarea ${errores.descripcion_servicio ? "modal-servicios__input--error" : ""}`}
            />
            {errores.descripcion_servicio && (
              <p className="modal-servicios__error-text">
                {errores.descripcion_servicio}
              </p>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          className="pie-modal contenedor-botones modal-servicios__footer"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.3 }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="boton boton-secundario"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="boton boton-primario"
            disabled={isSubmitting}
          >
            {formData.id_servicio ? "Guardar Cambios" : "Crear Servicio"}
          </button>
        </motion.div>
      </motion.form>
    </ModalServicios>
  );
};

/* ======================================================
   Modal Ver Servicio - Reorganizado con estilos consistentes
====================================================== */
export const ModalVerServicio = ({ isOpen, onClose, servicio }) => {
  if (!isOpen || !servicio) return null;

  const formatearPeriodicidad = (periodicidad) => {
    const tipos = {
      1: "Mensual",
      2: "Trimestral",
      3: "Semestral",
      4: "Anual",
    };
    return tipos[periodicidad] || "No especificada";
  };

  const formatearEstado = (idEstado) =>
    idEstado === 1 ? "Activo" : "Inactivo";

  const formatearFecha = (fechaString) => {
    if (!fechaString) return "No disponible";
    return new Date(fechaString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatearPrecio = (precio) => {
    if (precio === undefined || precio === null) return "No especificado";
    return formatCurrencyCOP(precio);
  };

  return (
    <ModalServicios
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalles del Servicio #${servicio.id_servicio || "N/A"}`}
      size="md"
    >
      <motion.div
        className="modal-servicios__view-stack"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <motion.div
          className="modal-form-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h3 className="modal-section-title">Información Básica</h3>

          <div
            className="modal-grid-two-cols"
          >
            <div className="modal-field-group">
              <label className="modal-field-label">ID Servicio</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={servicio.id_servicio || "Sin ID"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group">
              <label className="modal-field-label">Nombre</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={servicio.nombre_servicio || "Sin nombre"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group">
              <label className="modal-field-label">Precio</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={formatearPrecio(servicio.precio_servicio)}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group">
              <label className="modal-field-label">Estado</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={formatearEstado(servicio.id_estado)}
                readOnly
                disabled
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="modal-form-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <h3 className="modal-section-title">Información Adicional</h3>

          <div
            className="modal-grid-two-cols"
          >
            <div className="modal-field-group">
              <label className="modal-field-label">Descripción</label>
              <textarea
                className="modal-field-input modal-field-input--readonly modal-servicios__view-textarea"
                value={servicio.descripcion_servicio || "Sin descripción"}
                readOnly
                disabled
                rows={4}
              />
            </div>
          </div>
        </motion.div>

        <motion.div
          className="pie-modal contenedor-botones modal-servicios__view-footer"
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
    </ModalServicios>
  );
};

/* ======================================================
   Modal Eliminar Servicio
====================================================== */
export const ModalEliminarServicio = ({
  servicio,
  onClose,
  onDelete,
  isOpen = true,
}) => {
  if (!servicio) return null;

  const handleConfirm = () => {
    onDelete(servicio);
    onClose();
  };

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      item={servicio}
      title="Eliminar Servicio"
      fields={[
        {
          key: "nombre_servicio",
          label: "Servicio",
          format: (v) => <strong>{v}</strong>,
        },
        { key: "id_servicio", label: "ID" },
      ]}
      warningMessage="Esta acción no se puede deshacer. Se eliminara permanentemente el servicio."
    />
  );
};
