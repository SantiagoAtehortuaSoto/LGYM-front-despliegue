import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  obtenerUsuarios,
  obtenerRolesUsuarios,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import { obtenerEmpleados } from "../../../hooks/Empleados_API/API_Empleados";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import {
  EMPLOYEE_SHIFT_OPTIONS,
  formatEmployeeShiftLabel,
  isEmployeeShiftValue,
  normalizeEmployeeShift,
} from "../../../../../shared/utils/employeeSchedule";
import toast from "react-hot-toast";
import "../../../../../shared/styles/restructured/components/modal-empleados.css";

const EXCLUDED_ROLE_IDS_FOR_CREATE = new Set([32, 33]);
const SALARIO_REGEX = /^\d+(\.\d{1,2})?$/;

const useLockBodyScroll = (isOpen) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prevOverflow || "";
    }
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [isOpen]);
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
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
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: 10,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().split("T")[0];
};

const extractList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const getReadonlyValue = (value, fallback = "No disponible") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  return String(value);
};

const getEstadoUsuarioLabel = (value) => {
  const normalized = Number(value);
  if (normalized === 1) return "Activo";
  if (normalized === 2) return "Inactivo";
  return getReadonlyValue(value);
};

const getDocumentoUsuario = (usuario = {}) =>
  usuario?.documento ||
  usuario?.numero_documento ||
  usuario?.cedula ||
  usuario?.doc ||
  usuario?.n_documento ||
  "";

const resolveUserId = (record = {}) =>
  record?.id_usuario ??
  record?.usuario_id ??
  record?.id_usuario_usuario?.id_usuario ??
  record?.id_usuario_usuario?.id ??
  record?.usuario?.id_usuario ??
  record?.usuario?.id ??
  null;

const resolveRoleId = (record = {}) => {
  const rawRoleId =
    record?.id_rol ??
    record?.rol_id ??
    record?.roleId ??
    record?.id_rol_rol?.id_rol ??
    record?.id_rol_rol?.id ??
    record?.rol?.id_rol ??
    record?.rol?.id ??
    null;

  if (rawRoleId && typeof rawRoleId === "object") {
    return rawRoleId.id_rol ?? rawRoleId.id ?? null;
  }

  return rawRoleId;
};

/* ======================================================
   Modal base reutilizable (compatible con BaseEmpleadoModal)
====================================================== */
export const ModalEmpleados = ({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
  // Props adicionales para compatibilidad con BaseEmpleadoModal
  initialData,
  onSave,
  disabled,
  showTabs,
  roles,
}) => {
  useLockBodyScroll(isOpen);
  const overlayPressStartedRef = useRef(false);

  // Si se pasan props de BaseEmpleadoModal, renderizar directamente el formulario
  // Para crear: initialData es null, para editar: initialData es un objeto con datos
  if (initialData !== undefined) {
    return (
      <ModalFormularioEmpleado
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={onSave}
        empleado={initialData}
        title={title}
        disabled={disabled}
        roles={roles}
      />
    );
  }

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
          className="modal-overlay capa-modal modal-empleados__overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onMouseDown={(event) => {
            overlayPressStartedRef.current =
              event.target === event.currentTarget;
          }}
          onClick={(event) => {
            const shouldClose =
              overlayPressStartedRef.current &&
              event.target === event.currentTarget;

            overlayPressStartedRef.current = false;

            if (shouldClose) {
              onClose();
            }
          }}
        >
          <motion.div
            className={`contenedor-modal ${sizeClasses[size]} modal-empleados__container`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="encabezado-modal modal-empleados__header">
              <h2 className="modal-empleados__header-title">{title}</h2>
              <button onClick={onClose} className="boton-cerrar modal-empleados__close-btn">
                ×
              </button>
            </div>
            <div className="cuerpo-modal">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ======================================================
   Modal Crear / Editar Empleado - NUEVA VERSIÓN SIMPLIFICADA
====================================================== */
export const ModalFormularioEmpleado = ({
  isOpen,
  onClose,
  onSubmit,
  empleado,
  title = "Nuevo Empleado",
  disabled = false,
}) => {
  const formId = "modal-empleados-form";
  const isEditMode = Boolean(empleado?.id_usuario);
  useLockBodyScroll(isOpen);
  const overlayPressStartedRef = useRef(false);

  // Estados para usuarios disponibles (sin empleado asignado)
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [mostrarDropdownUsuarios, setMostrarDropdownUsuarios] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [estadoRegistroUsuario, setEstadoRegistroUsuario] = useState({
    type: null,
    message: "",
  });
  const [verificandoRegistro, setVerificandoRegistro] = useState(false);

  const [formData, setFormData] = useState({
    id_empleado: empleado?.id_empleado || null,
    id_usuario: empleado?.id_usuario || null,
    direccion_empleado: empleado?.direccion_empleado || "",
    cargo: empleado?.cargo || "",
    fecha_contratacion: toDateInputValue(empleado?.fecha_contratacion),
    salario: empleado?.salario || "",
    horario_empleado: normalizeEmployeeShift(empleado?.horario_empleado),
  });

  const [errors, setErrors] = useState({});
  const [procesando, setProcesando] = useState(false);

  // Cargar usuarios disponibles (sin empleado asignado)
  useEffect(() => {
    if (!isOpen || isEditMode || disabled) return;

    const cargarUsuariosDisponibles = async () => {
      setCargandoUsuarios(true);
      try {
        const [respuestaUsuarios, respuestaRolesUsuarios] = await Promise.all([
          obtenerUsuarios(),
          obtenerRolesUsuarios(),
        ]);
        const usuarios = extractList(respuestaUsuarios);
        const rolesUsuarios = extractList(respuestaRolesUsuarios);

        const rolesByUserId = rolesUsuarios.reduce((acc, roleAssignment) => {
          const userId = resolveUserId(roleAssignment);
          const roleId = Number(resolveRoleId(roleAssignment));

          if (userId != null && Number.isInteger(roleId)) {
            acc[userId] = roleId;
          }

          return acc;
        }, {});

        const usuariosNormalizados = usuarios
          .filter((u) => {
            const userId = u.id_usuario || u.id;
            const roleId = Number(rolesByUserId[userId]);
            return !EXCLUDED_ROLE_IDS_FOR_CREATE.has(roleId);
          })
          .map((u) => ({
            id: u.id_usuario || u.id,
            nombre: u.nombre_usuario || u.nombre || u.email || `Usuario ${u.id_usuario || u.id}`,
            email: u.email || u.correo || "",
            documento: getDocumentoUsuario(u),
          }))
          .filter((u) => u.id);

        setUsuariosDisponibles(usuariosNormalizados);
      } catch (error) {
        console.error("Error cargando usuarios:", error);
        setUsuariosDisponibles([]);
      } finally {
        setCargandoUsuarios(false);
      }
    };

    cargarUsuariosDisponibles();
  }, [disabled, isEditMode, isOpen]);

  // Resetear formulario cuando se abre/cierra
  useEffect(() => {
    if (isOpen) {
      if (empleado) {
        setFormData({
          id_empleado: empleado.id_empleado || null,
          id_usuario: empleado.id_usuario || null,
          direccion_empleado: empleado.direccion_empleado || "",
          cargo: empleado.cargo || "",
          fecha_contratacion: toDateInputValue(empleado.fecha_contratacion),
          salario: empleado.salario || "",
          horario_empleado: normalizeEmployeeShift(empleado.horario_empleado),
        });
        setUsuarioSeleccionado(null);
        setBusquedaUsuario("");
        setEstadoRegistroUsuario({ type: null, message: "" });
      } else {
        setFormData({
          id_empleado: null,
          id_usuario: null,
          direccion_empleado: "",
          cargo: "",
          fecha_contratacion: "",
          salario: "",
          horario_empleado: normalizeEmployeeShift(),
        });
        setUsuarioSeleccionado(null);
        setBusquedaUsuario("");
        setEstadoRegistroUsuario({ type: null, message: "" });
      }
      setErrors({});
    }
  }, [isOpen, empleado]);

  // Función de validación centralizada para los nuevos campos
  const validateField = (name, value) => {
    let error = "";
    switch (name) {
      case "id_usuario":
        if (!isEditMode && !value) {
          error = "Debe seleccionar un usuario existente.";
        }
        break;
      case "direccion_empleado":
        if (!value.trim()) {
          error = "La dirección del empleado es obligatoria.";
        } else if (value.trim().length < 5) {
          error = "La dirección debe tener al menos 5 caracteres.";
        } else if (value.trim().length > 150) {
          error = "La dirección no puede superar 150 caracteres.";
        }
        break;
      case "cargo":
        if (!value.trim()) {
          error = "El cargo es obligatorio.";
        } else if (value.trim().length < 2) {
          error = "El cargo debe tener al menos 2 caracteres.";
        } else if (value.trim().length > 80) {
          error = "El cargo no puede superar 80 caracteres.";
        }
        break;
      case "fecha_contratacion":
        if (!value) {
          error = "La fecha de contratación es obligatoria.";
        } else {
          const fecha = new Date(value);
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          if (fecha > hoy) {
            error = "La fecha de contratación no puede ser futura.";
          }
        }
        break;
      case "salario":
        if (!String(value || "").trim()) {
          error = "El salario es obligatorio.";
        } else if (!SALARIO_REGEX.test(String(value).trim())) {
          error = "El salario debe tener hasta 2 decimales.";
        } else if (Number(value) <= 0) {
          error = "El salario debe ser mayor a 0.";
        }
        break;
      case "horario_empleado":
        if (!isEmployeeShiftValue(value)) {
          error = "Debe seleccionar si el empleado trabaja en la mañana o en la tarde.";
        }
        break;
      default:
        break;
    }
    return error;
  };

  // Handlers para el buscador de usuarios
  const handleBusquedaUsuarioChange = (e) => {
    if (disabled) return;
    const value = e.target.value;
    setBusquedaUsuario(value);
    setMostrarDropdownUsuarios(!!value);
  };

  const cargarRegistroEmpleadoUsuario = async (usuario) => {
    const userId = usuario?.id;
    if (!userId) return;

    setVerificandoRegistro(true);
    setEstadoRegistroUsuario({
      type: "loading",
      message: "Consultando si el usuario ya tiene registro como empleado...",
    });

    try {
      const response = await obtenerEmpleados();
      const empleados = extractList(response);
      const empleadoExistente =
        empleados.find(
          (item) =>
            Number(item?.id_usuario ?? item?.id_usuario_usuario?.id_usuario) ===
            Number(userId)
        ) ||
        empleados.find(
          (item) =>
            usuario?.email &&
            String(item?.id_usuario_usuario?.email || item?.email || "").trim().toLowerCase() ===
            String(usuario.email).trim().toLowerCase()
        ) ||
        null;

      if (empleadoExistente && typeof empleadoExistente === "object") {
        setFormData((prev) => ({
          ...prev,
          id_empleado: empleadoExistente.id_empleado || empleadoExistente.id || null,
          id_usuario: userId,
          direccion_empleado: empleadoExistente.direccion_empleado || "",
          cargo: empleadoExistente.cargo || "",
          fecha_contratacion: toDateInputValue(empleadoExistente.fecha_contratacion),
          salario: empleadoExistente.salario ?? "",
          horario_empleado: normalizeEmployeeShift(empleadoExistente.horario_empleado),
        }));
        setEstadoRegistroUsuario({
          type: "exists",
          message:
            "Este usuario ya tiene registro como empleado. Se cargaron sus datos y al guardar se actualizará el registro existente.",
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          id_empleado: null,
          id_usuario: userId,
          direccion_empleado: "",
          cargo: "",
          fecha_contratacion: "",
          salario: "",
          horario_empleado: normalizeEmployeeShift(),
        }));
        setEstadoRegistroUsuario({
          type: "new",
          message:
            "Este usuario aún no tiene registro como empleado. Puedes completar el formulario para crearlo.",
        });
      }
    } catch (error) {
      const status = error?.status ?? error?.response?.status;
      if (status === 404) {
        setFormData((prev) => ({
          ...prev,
          id_usuario: userId,
          direccion_empleado: "",
          cargo: "",
          fecha_contratacion: "",
          salario: "",
          horario_empleado: normalizeEmployeeShift(),
        }));
        setEstadoRegistroUsuario({
          type: "new",
          message:
            "Este usuario aún no tiene registro como empleado. Puedes completar el formulario para crearlo.",
        });
        return;
      }

      const errorMessage = getApiErrorMessage(
        error,
        "No se pudo validar si el usuario ya tiene registro de empleado."
      );
      setEstadoRegistroUsuario({ type: "error", message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setVerificandoRegistro(false);
    }
  };

  const seleccionarUsuario = async (usuario) => {
    if (disabled) return;
    setUsuarioSeleccionado(usuario);
    setBusquedaUsuario(`${usuario.nombre} (${usuario.email || "Sin correo"})`);
    setMostrarDropdownUsuarios(false);
    setFormData((prev) => ({
      ...prev,
      id_usuario: usuario.id,
    }));

    // Limpiar error si existe
    if (errors.id_usuario) {
      setErrors((prev) => ({ ...prev, id_usuario: "" }));
    }

    await cargarRegistroEmpleadoUsuario(usuario);
  };

  const quitarUsuarioSeleccionado = () => {
    if (disabled) return;
    setUsuarioSeleccionado(null);
    setBusquedaUsuario("");
    setFormData((prev) => ({
      ...prev,
      id_empleado: null,
      id_usuario: null,
      direccion_empleado: "",
      cargo: "",
      fecha_contratacion: "",
      salario: "",
      horario_empleado: normalizeEmployeeShift(),
    }));
    setEstadoRegistroUsuario({ type: null, message: "" });
  };

  const handleChange = (e) => {
    if (disabled) return;
    const { name, value } = e.target;
    const nextValue =
      name === "horario_empleado"
        ? normalizeEmployeeShift(value)
        : name === "salario"
          ? value
            .replace(/[^0-9.]/g, "")
            .replace(/(\..*)\./g, "$1")
          : value;

    setFormData((prevData) => ({
      ...prevData,
      [name]: nextValue,
    }));

    // Validar el campo y actualizar el estado de errores
    const error = validateField(name, nextValue);
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error,
    }));
  };

  // Validar todo el formulario antes de enviar
  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    if (validateForm()) {
      setProcesando(true);
      try {
        const bodyBase = {
          id_usuario: formData.id_usuario,
          direccion_empleado: formData.direccion_empleado.trim(),
          cargo: formData.cargo.trim(),
          fecha_contratacion: formData.fecha_contratacion,
          salario: Number(formData.salario),
          horario_empleado: normalizeEmployeeShift(formData.horario_empleado),
        };
        const empleadoParaGuardar = isEditMode
          ? {
            id_empleado: formData.id_empleado,
            ...bodyBase,
          }
          : {
            id_empleado: formData.id_empleado,
            id_usuario: formData.id_usuario,
            __forceUpdateExisting: estadoRegistroUsuario.type === "exists",
            ...bodyBase,
          };

        const resultado = await onSubmit(empleadoParaGuardar);
        if (resultado === false) {
          return;
        }
      } catch (error) {
        console.error("Error al guardar empleado:", error);
        toast.error(getApiErrorMessage(error, "Error al guardar empleado"));
      } finally {
        setProcesando(false);
      }
    }
  };

  // Filtrar usuarios para dropdown
  const usuariosFiltrados = usuariosDisponibles.filter((usuario) => {
    if (!busquedaUsuario) return false;
    const busqueda = String(busquedaUsuario).toLowerCase().trim();
    return (
      String(usuario.nombre || "").toLowerCase().includes(busqueda) ||
      String(usuario.email || "").toLowerCase().includes(busqueda) ||
      String(usuario.documento || "").toLowerCase().includes(busqueda)
    );
  }).slice(0, 5);

  const usuarioNombre = getReadonlyValue(empleado?.nombre_usuario);
  const usuarioApellido = getReadonlyValue(empleado?.apellido_usuario);
  const usuarioTipoDocumento = getReadonlyValue(empleado?.tipo_documento);
  const usuarioDocumento = getReadonlyValue(empleado?.documento);
  const usuarioFechaNacimiento = getReadonlyValue(
    toDateInputValue(empleado?.fecha_nacimiento)
  );
  const usuarioGenero = getReadonlyValue(empleado?.genero);
  const usuarioEmail = getReadonlyValue(empleado?.email);
  const usuarioTelefono = getReadonlyValue(empleado?.telefono);
  const usuarioNombreEmergencia = getReadonlyValue(empleado?.n_emergencia);
  const usuarioTelefonoEmergencia = getReadonlyValue(empleado?.c_emergencia);
  const usuarioRol = getReadonlyValue(
    empleado?.rol_nombre ??
    empleado?.id_rol_rol?.nombre_rol ??
    empleado?.id_rol_rol?.nombre ??
    empleado?.rol?.nombre_rol ??
    empleado?.rol?.nombre
  );
  const usuarioEstado = getEstadoUsuarioLabel(empleado?.id_estado ?? empleado?.estado);
  const usuarioEnfermedades = getReadonlyValue(empleado?.enfermedades, "N/A");

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay capa-modal modal-empleados__overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onMouseDown={(event) => {
            overlayPressStartedRef.current =
              event.target === event.currentTarget;
          }}
          onClick={(event) => {
            const shouldClose =
              overlayPressStartedRef.current &&
              event.target === event.currentTarget;

            overlayPressStartedRef.current = false;

            if (shouldClose) {
              onClose();
            }
          }}
        >
          <motion.div
            className="contenedor-modal modal-mediano modal-empleados__container"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="encabezado-modal modal-empleados__header">
              <h2 className="modal-empleados__header-title">{title}</h2>
              <button onClick={onClose} className="boton-cerrar modal-empleados__close-btn">
                ×
              </button>
            </div>
            <div className="cuerpo-modal">
              <motion.form
                id={formId}
                onSubmit={handleSubmit}
                noValidate
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                <motion.div
                  className="modal-empleados__stack"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  {isEditMode && (
                    <>
                      <motion.div
                        className="modal-empleados__card"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.52, duration: 0.4 }}
                      >
                        <h3 className="modal-empleados__section-title">
                          Información básica del usuario
                        </h3>
                        <div className="modal-empleados__grid">
                          <div>
                            <label className="modal-empleados__label">Nombre</label>
                            <input
                              type="text"
                              value={usuarioNombre}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Apellido</label>
                            <input
                              type="text"
                              value={usuarioApellido}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Tipo de documento</label>
                            <input
                              type="text"
                              value={usuarioTipoDocumento}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Número de documento</label>
                            <input
                              type="text"
                              value={usuarioDocumento}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Fecha de nacimiento</label>
                            <input
                              type="text"
                              value={usuarioFechaNacimiento}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Género</label>
                            <input
                              type="text"
                              value={usuarioGenero}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        className="modal-empleados__card"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.56, duration: 0.4 }}
                      >
                        <h3 className="modal-empleados__section-title">
                          Contacto del usuario
                        </h3>
                        <div className="modal-empleados__grid">
                          <div>
                            <label className="modal-empleados__label">Email</label>
                            <input
                              type="text"
                              value={usuarioEmail}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Teléfono</label>
                            <input
                              type="text"
                              value={usuarioTelefono}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">
                              Nombre C. de Emergencia
                            </label>
                            <input
                              type="text"
                              value={usuarioNombreEmergencia}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">
                              Teléfono C. de Emergencia
                            </label>
                            <input
                              type="text"
                              value={usuarioTelefonoEmergencia}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Rol</label>
                            <input
                              type="text"
                              value={usuarioRol}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                          <div>
                            <label className="modal-empleados__label">Estado</label>
                            <input
                              type="text"
                              value={usuarioEstado}
                              className="modal-empleados__input modal-empleados__input--readonly"
                              readOnly
                            />
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        className="modal-empleados__card"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6, duration: 0.4 }}
                      >
                        <h3 className="modal-empleados__section-title">
                          Información adicional del usuario
                        </h3>
                        <div className="modal-empleados__field-group">
                          <label className="modal-empleados__label">
                            Enfermedades o condiciones especiales
                          </label>
                          <textarea
                            value={usuarioEnfermedades}
                            className="modal-empleados__input modal-empleados__textarea modal-empleados__input--readonly"
                            rows="3"
                            readOnly
                          />
                        </div>
                      </motion.div>
                    </>
                  )}

                  <div className="modal-empleados__card">
                    <h3 className="modal-empleados__section-title">Información del Empleado</h3>
                    {!isEditMode && (
                      <motion.div
                        className="modal-empleados__field-group"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6, duration: 0.3 }}
                      >
                        <label className="modal-empleados__label">
                          Usuario <span className="modal-empleados__required">*</span>
                        </label>

                      {usuarioSeleccionado ? (
                        <div className="modal-empleados__selected-user">
                          <div className="modal-empleados__selected-user-info">
                            <div className="modal-empleados__selected-user-name">
                              {usuarioSeleccionado.nombre}
                            </div>
                            <div className="modal-empleados__selected-user-email">
                              {usuarioSeleccionado.email}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={quitarUsuarioSeleccionado}
                            className="modal-empleados__clear-selection-btn"
                            title="Quitar usuario"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div className="modal-empleados__search-wrapper">
                          <div
                            className={`modal-empleados__search-box ${errors.id_usuario ? "modal-empleados__search-box--error" : ""}`}
                          >
                            <Search size={18} className="modal-empleados__search-icon" />
                            <input
                              type="text"
                              placeholder="Buscar usuario por nombre o email..."
                              value={busquedaUsuario}
                              onChange={handleBusquedaUsuarioChange}
                              className="modal-empleados__search-input"
                              disabled={disabled}
                            />
                          </div>

                          {mostrarDropdownUsuarios && busquedaUsuario && (
                            <motion.div
                              className="modal-empleados__search-dropdown"
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                            >
                              {cargandoUsuarios ? (
                                <div className="modal-empleados__search-message">
                                  Buscando usuarios...
                                </div>
                              ) : usuariosFiltrados.length > 0 ? (
                                usuariosFiltrados.map((usuario) => (
                                  <div
                                    key={usuario.id}
                                    onClick={() => seleccionarUsuario(usuario)}
                                    className="modal-empleados__search-option"
                                  >
                                    <div className="modal-empleados__search-option-name">
                                      {usuario.nombre}
                                    </div>
                                    <div className="modal-empleados__search-option-email">
                                      {usuario.email}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="modal-empleados__search-message">
                                  No se encontraron usuarios
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      )}

                        {errors.id_usuario && (
                          <p className="modal-empleados__error-text">
                            {errors.id_usuario}
                          </p>
                        )}

                        {!errors.id_usuario && estadoRegistroUsuario.message && (
                          <p
                            className="modal-empleados__error-text"
                            style={{
                              color:
                                estadoRegistroUsuario.type === "error"
                                  ? "#d9534f"
                                  : estadoRegistroUsuario.type === "exists"
                                    ? "#b7791f"
                                    : estadoRegistroUsuario.type === "new"
                                      ? "#2f855a"
                                      : "#4a5568",
                            }}
                          >
                            {estadoRegistroUsuario.message}
                          </p>
                        )}
                      </motion.div>
                    )}

                    {/* Dirección */}
                    <motion.div
                      className="modal-empleados__field-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: isEditMode ? 0.64 : 0.7, duration: 0.3 }}
                    >
                      <label className="modal-empleados__label">
                        Dirección del Empleado <span className="modal-empleados__required">*</span>
                      </label>
                      <input
                        type="text"
                        name="direccion_empleado"
                        value={formData.direccion_empleado}
                        onChange={handleChange}
                        placeholder="Ingrese la dirección completa"
                        readOnly={disabled}
                        className={`modal-empleados__input ${errors.direccion_empleado ? "modal-empleados__input--error" : ""}`}
                      />
                      {errors.direccion_empleado && (
                        <p className="modal-empleados__error-text">
                          {errors.direccion_empleado}
                        </p>
                      )}
                    </motion.div>

                    <motion.div
                      className="modal-empleados__field-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: isEditMode ? 0.68 : 0.74, duration: 0.3 }}
                    >
                      <label className="modal-empleados__label">
                        Cargo <span className="modal-empleados__required">*</span>
                      </label>
                      <input
                        type="text"
                        name="cargo"
                        value={formData.cargo}
                        onChange={handleChange}
                        placeholder="Ingrese el cargo del empleado"
                        readOnly={disabled}
                        className={`modal-empleados__input ${errors.cargo ? "modal-empleados__input--error" : ""}`}
                      />
                      {errors.cargo && (
                        <p className="modal-empleados__error-text">{errors.cargo}</p>
                      )}
                    </motion.div>

                    <div className="modal-empleados__grid">
                      {/* Fecha de Contratación */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: isEditMode ? 0.72 : 0.8, duration: 0.3 }}
                      >
                        <label className="modal-empleados__label">
                          Fecha de Contratación <span className="modal-empleados__required">*</span>
                        </label>
                        <input
                          type="date"
                          name="fecha_contratacion"
                          value={formData.fecha_contratacion}
                          onChange={handleChange}
                          max={new Date().toISOString().split('T')[0]}
                          readOnly={disabled}
                          disabled={disabled}
                          className={`modal-empleados__input modal-empleados__input--date ${errors.fecha_contratacion ? "modal-empleados__input--error" : ""}`}
                        />
                        {errors.fecha_contratacion && (
                          <p className="modal-empleados__error-text">
                            {errors.fecha_contratacion}
                          </p>
                        )}
                      </motion.div>

                      {/* Salario */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: isEditMode ? 0.76 : 0.9, duration: 0.3 }}
                      >
                        <label className="modal-empleados__label">
                          Salario/Cop <span className="modal-empleados__required">*</span>
                        </label>
                        <input
                          type="text"
                          name="salario"
                          value={formData.salario}
                          onChange={handleChange}
                          placeholder="0"
                          inputMode="decimal"
                          readOnly={disabled}
                          disabled={disabled}
                          className={`modal-empleados__input ${errors.salario ? "modal-empleados__input--error" : ""}`}
                        />
                        {errors.salario && (
                          <p className="modal-empleados__error-text">
                            {errors.salario}
                          </p>
                        )}
                      </motion.div>
                    </div>

                    {/* Horario */}
                    <motion.div
                      className="modal-empleados__field-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: isEditMode ? 0.8 : 1.0, duration: 0.3 }}
                    >
                      <label className="modal-empleados__label">
                        Horario de Trabajo{" "}
                        <span className="modal-empleados__required">*</span>
                      </label>
                      <select
                        name="horario_empleado"
                        value={formData.horario_empleado}
                        onChange={handleChange}
                        disabled={disabled}
                        className={`modal-empleados__input ${errors.horario_empleado ? "modal-empleados__input--error" : ""}`}
                      >
                        {EMPLOYEE_SHIFT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="modal-empleados__readonly-note">
                        {`Turno seleccionado: ${formatEmployeeShiftLabel(formData.horario_empleado)}`}
                      </p>
                      {errors.horario_empleado && (
                        <p className="modal-empleados__error-text">
                          {errors.horario_empleado}
                        </p>
                      )}
                    </motion.div>
                  </div>
                </motion.div>

              </motion.form>
            </div>
            <motion.div
              className="pie-modal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.4 }}
            >
              <motion.button
                type="button"
                onClick={onClose}
                className="boton boton-secundario"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {disabled ? "Cerrar" : "Cancelar"}
              </motion.button>
              {!disabled && (
                <motion.button
                  type="submit"
                  form={formId}
                  className="boton boton-primario"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  disabled={procesando || verificandoRegistro}
                >
                  {empleado && empleado.id_usuario ? "Actualizar" : "Guardar"}
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

ModalEmpleados.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  size: PropTypes.string,
};

// Exportaciones nombradas para usar en empleados.jsx
export const ModalCrearEmpleado = ({ isOpen, onClose, onSave }) => (
  <ModalFormularioEmpleado
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSave}
    title="Nuevo Empleado"
  />
);

export const ModalEditarEmpleado = ({ isOpen, onClose, empleado, onSave }) => (
  <ModalFormularioEmpleado
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSave}
    empleado={empleado}
    title="Editar Empleado"
  />
);

// Componente compatible con la importación existente
const BaseEmpleadoModal = ModalEmpleados;

export default BaseEmpleadoModal;
