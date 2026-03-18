import { useState, useEffect, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { getCiudadesOptions } from "../../../../../shared/utils/data/ciudadesColombia";
import "../../../../../shared/styles/restructured/components/modal-proveedores.css";
import Modal from "../../../../../shared/components/Modal/Modal";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import { validarProveedor } from "../../../hooks/validaciones/validaciones";

const useLockBodyScroll = (isOpen) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = isOpen ? "hidden" : prevOverflow || "";
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [isOpen]);
};

// Variantes de animación alineadas con productos
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

/* ======================================================
   Modal genérico base con fondo completamente transparente
====================================================== */
export const ModalProveedores = ({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
}) => {
  useLockBodyScroll(isOpen);

  const sizeClasses = {
    sm: "modal-pequeno",
    md: "modal-mediano",
    lg: "modal-grande",
    xl: "modal-extra",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay capa-modal modal-proveedores__overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={`contenedor-modal ${sizeClasses[size]} modal-proveedores__container`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="modal-proveedores__header"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <motion.h1
                className="modal-proveedores__header-title"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                {title}
              </motion.h1>
            </motion.div>

            <motion.div
              className="modal-proveedores__close"
              onClick={onClose}
              whileHover={{ scale: 1.1, color: "#e53e3e" }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              ×
            </motion.div>
            <div className="cuerpo-modal">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ======================================================
   Modal Crear / Editar Proveedor (con validaciones)
====================================================== */
export const ModalFormularioProveedor = ({
  isOpen,
  onClose,
  onSubmit,
  proveedor,
  title = "Nuevo Proveedor",
  proveedoresExistentes = [],
}) => {
  useLockBodyScroll(isOpen);
  const [formData, setFormData] = useState({
    nit: "",
    nombre: "",
    telefono: "",
    nombreContacto: "",
    email: "",
    direccion: "",
    ciudad: "",
    estado: "Activo",
  });

  const [errores, setErrores] = useState({});
  const [camposTocados, setCamposTocados] = useState({});
  const [ciudadesOptions, setCiudadesOptions] = useState([]);
  const estaEditando = !!proveedor;

  const erroresValidados = useMemo(() => {
    const base = validarProveedor(
      formData,
      proveedoresExistentes,
      proveedor?.id_proveedor ?? null
    );
    const extras = { ...base.errors };

    if (proveedor?.fecha_registro) {
      const fechaRegistro = new Date(proveedor.fecha_registro);
      const fechaActual = new Date();
      if (fechaRegistro > fechaActual) {
        extras.fechaRegistro = "La fecha de registro no puede ser futura";
      }
    }

    return extras;
  }, [formData, proveedoresExistentes, proveedor]);

  useEffect(() => {
    const erroresVisibles = Object.fromEntries(
      Object.entries(erroresValidados).filter(([campo]) => {
        if (Object.prototype.hasOwnProperty.call(formData, campo)) {
          return camposTocados[campo] || formData[campo];
        }
        return true;
      })
    );
    setErrores(erroresVisibles);
  }, [erroresValidados, camposTocados, formData]);

  useEffect(() => {
    const opciones = getCiudadesOptions();
    setCiudadesOptions(opciones);
  }, []);

  useEffect(() => {
    if (proveedor) {
      setFormData({
        nit: String(proveedor.nit_proveedor || ""),
        nombre: String(proveedor.nombre_proveedor || ""),
        telefono: String(proveedor.telefono_proveedor || ""),
        nombreContacto: String(proveedor.nombre_contacto || ""),
        email: String(proveedor.email_proveedor || ""),
        direccion: String(proveedor.direccion_proveedor || ""),
        ciudad: String(proveedor.ciudad_proveedor || ""),
        estado: proveedor.id_estado === 1 ? "Activo" : "Inactivo",
      });
    } else {
      setFormData({
        nit: "",
        nombre: "",
        telefono: "",
        nombreContacto: "",
        email: "",
        direccion: "",
        ciudad: "",
        estado: "Activo",
      });
    }
    setErrores({});
    setCamposTocados({});
  }, [proveedor, isOpen]);

  // Función para prevenir caracteres no numéricos en NIT
  const handleNitKeyDown = (e) => {
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

    // Para NIT, solo permitir dígitos
    if (!/[\d]/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleNitPaste = (e) => {
    const contenido = e.clipboardData.getData("text");
    if (!/^\d+$/.test(contenido)) {
      e.preventDefault();
    }
  };

  const handleTelefonoKeyDown = (e) => {
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
      "Home",
      "End",
    ];
    if (controlKeys.includes(e.key)) return;
    if (e.ctrlKey && ["a", "c", "v", "x", "z"].includes(e.key.toLowerCase()))
      return;
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleTelefonoPaste = (e) => {
    const contenido = e.clipboardData.getData("text");
    if (!/^\d+$/.test(contenido)) {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "telefono") {
      const soloNumeros = value.replace(/[^\d]/g, "");
      setFormData({ ...formData, telefono: soloNumeros });
      return;
    }
    if (name === "nit") {
      const soloNumeros = value.replace(/[^\d]/g, "");
      setFormData({ ...formData, nit: soloNumeros });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setCamposTocados({ ...camposTocados, [name]: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const todosCamposTocados = {};
    Object.keys(formData).forEach((key) => {
      todosCamposTocados[key] = true;
    });
    setCamposTocados(todosCamposTocados);

    const base = validarProveedor(
      formData,
      proveedoresExistentes,
      proveedor?.id_proveedor ?? null
    );
    const extras = { ...base.errors };

    if (proveedor?.fecha_registro) {
      const fechaRegistro = new Date(proveedor.fecha_registro);
      const fechaActual = new Date();
      if (fechaRegistro > fechaActual) {
        extras.fechaRegistro = "La fecha de registro no puede ser futura";
      }
    }

    const isValid = Object.keys(extras).length === 0;
    setErrores(extras);

    if (isValid) {
      try {
        const resultado = await Promise.resolve(onSubmit(formData));
        if (resultado === false) {
          throw new Error(
            estaEditando
              ? "No se pudo actualizar el proveedor"
              : "No se pudo crear el proveedor"
          );
        }
        toast.success(
          estaEditando
            ? "Proveedor actualizado exitosamente"
            : "Proveedor creado exitosamente"
        );
        onClose();
      } catch (error) {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "No se pudo guardar el proveedor"
        );
      }
    }
  };

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
    <Modal
      title={title}
      onClose={onClose}
      size="lg"
      className="modal-proveedor-redesigned"
      footer={
        <>
          <button className="boton boton-secundario" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="boton boton-primario"
            onClick={handleSubmit}
          >
            {proveedor ? "Actualizar" : "Guardar"}
          </button>
        </>
      }
      >
      <div className="modal-proveedores__content-root">
        <div className="modal-body-content modal-body-content--spacious">
          <motion.div
            className="general-tab-layout"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="general-form-column">
              <motion.div
                className="modal-form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <h3 className="modal-section-title">
                  Información Básica
                </h3>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    NIT <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="nit"
                    value={formData.nit}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleNitKeyDown}
                    onPaste={handleNitPaste}
                    placeholder="Número de identificación tributaria"
                    maxLength="12"
                    className={`modal-field-input ${
                      errores.nit ? "modal-proveedores__input--error" : ""
                    }`}
                  />
                  {errores.nit && (
                    <p className="modal-proveedores__error-text">{errores.nit}</p>
                  )}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Nombre <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Nombre completo del proveedor"
                    maxLength="80"
                    className={`modal-field-input ${
                      errores.nombre ? "modal-proveedores__input--error" : ""
                    }`}
                  />
                  {errores.nombre && (
                    <p className="modal-proveedores__error-text">{errores.nombre}</p>
                  )}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Teléfono <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleTelefonoKeyDown}
                    onPaste={handleTelefonoPaste}
                    placeholder="Número de teléfono de contacto"
                    maxLength="10"
                    className={`modal-field-input ${
                      errores.telefono ? "modal-proveedores__input--error" : ""
                    }`}
                  />
                  {errores.telefono && (
                    <p className="modal-proveedores__error-text">{errores.telefono}</p>
                  )}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Nombre de Contacto <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombreContacto"
                    value={formData.nombreContacto}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Nombre de la persona de contacto"
                    maxLength="80"
                    className={`modal-field-input ${
                      errores.nombreContacto ? "modal-proveedores__input--error" : ""
                    }`}
                  />
                  {errores.nombreContacto && (
                    <p className="modal-proveedores__error-text">{errores.nombreContacto}</p>
                  )}
                </motion.div>
              </motion.div>

              <motion.div
                className="modal-form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <h3 className="modal-section-title">
                  Información de Contacto
                </h3>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Correo Electrónico <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="correo@ejemplo.com"
                    maxLength="80"
                    className={`modal-field-input ${
                      errores.email ? "modal-proveedores__input--error" : ""
                    }`}
                  />
                  {errores.email && (
                    <p className="modal-proveedores__error-text">{errores.email}</p>
                  )}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Dirección
                  </label>
                  <input
                    type="text"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Dirección completa"
                    maxLength="80"
                    className={`modal-field-input ${
                      errores.direccion ? "modal-proveedores__input--error" : ""
                    }`}
                  />
                  {errores.direccion && (
                    <p className="modal-proveedores__error-text">{errores.direccion}</p>
                  )}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Ciudad
                  </label>
                  <select
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleChange}
                    className={`modal-field-input modal-field-input--select ${
                      errores.ciudad ? "modal-proveedores__input--error" : ""
                    }`}
                  >
                    <option value="" disabled>
                      Selecciona una ciudad
                    </option>
                    {ciudadesOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errores.ciudad && (
                    <p className="modal-proveedores__error-text">{errores.ciudad}</p>
                  )}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        estado: e.target.value,
                      }))
                    }
                    className="modal-field-input modal-field-input--select"
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </Modal>
  );
};

/* ======================================================
   Modal Eliminar Proveedor
====================================================== */
export const ModalEliminarProveedor = ({
  isOpen,
  onClose,
  onConfirm,
  proveedor,
}) => {
  if (!isOpen || !proveedor) return null;

  const handleConfirmDelete = () => {
    onConfirm(proveedor);
  };

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirmDelete}
      item={proveedor}
      title="Eliminar Proveedor"
      fields={[
        {
          key: "nombre_proveedor",
          label: "Nombre",
          format: (value) => <strong>{value || "Proveedor sin nombre"}</strong>,
        },
        {
          key: "nit_proveedor",
          label: "NIT",
          format: (value) => value || "No especificado",
        },
        {
          key: "telefono_proveedor",
          label: "Teléfono",
          format: (value) => value || "No especificado",
        },
      ]}
      warningMessage="Esta acción no se puede deshacer. Se eliminará permanentemente el proveedor y todos sus datos asociados."
    />
  );
};

/* ======================================================
   Modal Ver Proveedor - Reorganizado con estilos consistentes
====================================================== */
export const ModalVerProveedor = ({ isOpen, onClose, proveedor }) => {
  if (!proveedor) return null;

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalles del Proveedor #${proveedor.id_proveedor || "N/A"}`}
      size="md"
      className="modal-mediano"
    >
      <div className="modal-form-stack">
        <div className="modal-form-card">
          <h3 className="modal-section-title">Información Básica</h3>

          <div className="modal-grid-two-cols">
            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">ID Proveedor</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.id_proveedor || "Sin ID"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">NIT</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.nit_proveedor || "Sin NIT"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Nombre</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.nombre_proveedor || "Sin nombre"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Estado</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.id_estado === 1 ? "Activo" : "Inactivo"}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        <div className="modal-form-card">
          <h3 className="modal-section-title">Información de Contacto</h3>

          <div className="modal-grid-two-cols">
            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Teléfono</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.telefono_proveedor || "Sin teléfono"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Nombre de Contacto</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.nombre_contacto || "No especificado"}
                readOnly
                disabled
              />
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Correo Electrónico</label>
              <input
                type="email"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.email_proveedor || "Sin correo"}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        <div className="modal-form-card">
          <h3 className="modal-section-title">Información de Ubicación</h3>

          <div className="modal-grid-two-cols">
            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Dirección</label>
              <textarea
                className="modal-field-input modal-field-input--readonly modal-proveedores__view-textarea"
                value={proveedor.direccion_proveedor || "No especificada"}
                readOnly
                disabled
                rows={3}
              />
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Ciudad</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={proveedor.ciudad_proveedor || "No especificada"}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        {proveedor.fecha_registro && (
          <div className="modal-form-card">
            <h3 className="modal-section-title">Información del Registro</h3>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">Fecha de Registro</label>
              <input
                type="text"
                className="modal-field-input modal-field-input--readonly"
                value={formatearFecha(proveedor.fecha_registro)}
                readOnly
                disabled
              />
            </div>
          </div>
        )}

        <div className="pie-modal modal-proveedores__view-footer">
          <button
            className="boton boton-secundario"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
};
