import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Search, User, X } from "lucide-react";
import { toast } from "react-hot-toast";
import "../../../../../shared/styles/restructured/components/modal-asistencia.css";
import Modal from "../../../../../shared/components/Modal/Modal";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import {
  obtenerUsuarios,
  obtenerRolesUsuarios,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import { obtenerRoles } from "../../../hooks/Roles_API/roles_API";
import { getAgenda } from "../../../hooks/Agenda_API/Agenda_API";
import {
  ESTADOS_APP,
  OPCIONES_ESTADO_ASISTENCIA,
} from "../../../components/dataTables/badgesEstado";

const CLIENT_ROLE_ID = 33;
const EMPLOYEE_ATTENDANCE_EXCLUDED_ROLE_IDS = new Set([32, CLIENT_ROLE_ID]);

const MotionForm = motion.form;

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

const ESTADOS_CLIENTE = [
  { value: ESTADOS_APP.PENDIENTE, label: "Pendiente" },
  { value: ESTADOS_APP.RETRASADO, label: "Retrasado" },
  ...OPCIONES_ESTADO_ASISTENCIA,
];

const ESTADOS_EMPLEADO = [
  { value: ESTADOS_APP.PENDIENTE, label: "Pendiente" },
  ...OPCIONES_ESTADO_ASISTENCIA,
];

const getEstadoLabel = (idEstado, tipo) => {
  const list = tipo === "empleado" ? ESTADOS_EMPLEADO : ESTADOS_CLIENTE;
  const found = list.find((estado) => Number(estado.value) === Number(idEstado));
  return found ? found.label : "Sin estado";
};

const getDefaultFormData = (tipo) => {
  const hoy = new Date().toISOString().split("T")[0];
  if (tipo === "empleado") {
    return {
      id_usuario: "",
      asistencia_fecha: hoy,
      hora_entrada_empleado: "",
      hora_salida_empleado: "",
      id_estado: ESTADOS_APP.ASISTIO,
      observaciones: "",
    };
  }
  return {
    id_cita: "",
    id_usuario: "",
    fecha_asistencia: hoy,
    hora_ingreso: "",
    hora_salida: "",
    id_estado: ESTADOS_APP.ASISTIO,
  };
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const toTimeInputValue = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : raw;
};

const toTimeApiValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw;
};

const firstFilledValue = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "") ?? "";

const toTimeCalcValue = (value) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, hh, mm, ss] = match;
  return `${hh}:${mm}:${ss || "00"}`;
};

const toMinutesFromTimeValue = (value) => {
  const normalized = toTimeCalcValue(value);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

/* ======================================================
   Modal base reutilizable
====================================================== */
export const ModalAsistencias = ({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
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
   Modal Crear / Editar Asistencia
====================================================== */
export const ModalFormularioAsistencia = ({
  isOpen,
  onClose,
  onSubmit,
  asistencia,
  tipo = "cliente",
}) => {
  useLockBodyScroll(isOpen);

  const isCliente = tipo !== "empleado";
  const estadosDisponibles = isCliente ? ESTADOS_CLIENTE : ESTADOS_EMPLEADO;
  const [formData, setFormData] = useState(getDefaultFormData(tipo));
  const [errors, setErrors] = useState({});
  const [procesando, setProcesando] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const inputRef = useRef(null);
  const [citas, setCitas] = useState([]);
  const [selectedCita, setSelectedCita] = useState(null);
  const [citaSearch, setCitaSearch] = useState("");
  const [showCitaDropdown, setShowCitaDropdown] = useState(false);
  const citaInputRef = useRef(null);

  useEffect(() => {
    if (asistencia) {
      const usuarioFallbackId = asistencia.id_usuario ?? "";
      const usuarioFallbackNombre =
        asistencia.nombre_usuario ||
        asistencia.usuario_nombre ||
        asistencia.id_usuario_usuario?.nombre_usuario ||
        asistencia.id_usuario_usuario?.nombre ||
        (usuarioFallbackId ? `Usuario ${usuarioFallbackId}` : "");

      setSelectedUser(
        usuarioFallbackId
          ? {
              id: usuarioFallbackId,
              nombre: usuarioFallbackNombre,
              email:
                asistencia.email_usuario ||
                asistencia.id_usuario_usuario?.email ||
                "",
            }
          : null
      );

      if (isCliente) {
        const citaFallbackId = asistencia.id_cita ? String(asistencia.id_cita) : "";
        const citaFallbackTitulo =
          asistencia.actividad_cita ||
          asistencia.actividad_agenda ||
          asistencia.actividad ||
          asistencia.descripcion_agenda ||
          (citaFallbackId ? `Cita ${citaFallbackId}` : "Cita");

        const citaSubtitleParts = [];
        const citaFecha = asistencia.fecha_asistencia ?? "";
        const citaHoraInicio = toTimeInputValue(asistencia.hora_ingreso);
        const citaHoraFin = toTimeInputValue(asistencia.hora_salida);
        if (citaFecha) citaSubtitleParts.push(citaFecha);
        if (citaHoraInicio || citaHoraFin) {
          citaSubtitleParts.push(`${citaHoraInicio || "--:--"} - ${citaHoraFin || "--:--"}`);
        }
        if (citaFallbackId) citaSubtitleParts.push(`ID: ${citaFallbackId}`);

        setSelectedCita(
          citaFallbackId
            ? {
                id: Number(citaFallbackId),
                titulo: citaFallbackTitulo,
                subtitle: citaSubtitleParts.join(" · "),
                fecha: citaFecha,
                horaInicio: citaHoraInicio,
                horaFin: citaHoraFin,
                clienteId: usuarioFallbackId ? Number(usuarioFallbackId) : null,
              }
            : null
        );

        setFormData({
          id_cita: citaFallbackId,
          id_usuario: asistencia.id_usuario ?? "",
          fecha_asistencia: asistencia.fecha_asistencia ?? "",
          hora_ingreso: toTimeInputValue(asistencia.hora_ingreso),
          hora_salida: toTimeInputValue(asistencia.hora_salida),
          id_estado: asistencia.id_estado ?? ESTADOS_APP.ASISTIO,
        });
      } else {
        const asistenciaFecha = firstFilledValue(
          asistencia.asistencia_fecha,
          asistencia.fecha_asistencia
        );
        const horaEntradaEmpleado = toTimeInputValue(
          firstFilledValue(
            asistencia.hora_entrada_empleado,
            asistencia.hora_entrada,
            asistencia.hora_ingreso
          )
        );
        const horaSalidaEmpleado = toTimeInputValue(
          firstFilledValue(
            asistencia.hora_salida_empleado,
            asistencia.hora_salida,
            asistencia.horaSalidaEmpleado,
            asistencia.horaSalida,
            asistencia.hora_fin,
            asistencia.horaFin,
            asistencia.salida
          )
        );
        setSelectedCita(null);
        setFormData({
          id_usuario: asistencia.id_usuario ?? "",
          asistencia_fecha: asistenciaFecha,
          hora_entrada_empleado: horaEntradaEmpleado,
          hora_salida_empleado: horaSalidaEmpleado,
          id_estado: asistencia.id_estado ?? ESTADOS_APP.ASISTIO,
          observaciones: asistencia.observaciones ?? "",
        });
      }
    } else {
      setFormData(getDefaultFormData(tipo));
      setSelectedUser(null);
      setSelectedCita(null);
    }
    setErrors({});
    setUserSearch("");
    setShowUserDropdown(false);
    setCitaSearch("");
    setShowCitaDropdown(false);
  }, [asistencia, isCliente, tipo]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      try {
        const [rolesListResponse, rolesUsuariosResponse, usuariosResponse] =
          await Promise.all([obtenerRoles(), obtenerRolesUsuarios(), obtenerUsuarios()]);

        const rolesList = Array.isArray(rolesListResponse)
          ? rolesListResponse
          : Array.isArray(rolesListResponse?.data)
          ? rolesListResponse.data
          : [];

        const rolesMap = rolesList.reduce((acc, role) => {
          if (role.id_rol) {
            acc[role.id_rol] = role.nombre_rol || role.nombre || `Rol ${role.id_rol}`;
          }
          return acc;
        }, {});

        const roleNamesMap = {
          [CLIENT_ROLE_ID]: "Cliente",
        };

        Object.keys(roleNamesMap).forEach((roleId) => {
          if (!rolesMap[roleId] || rolesMap[roleId].startsWith("Rol ")) {
            rolesMap[roleId] = roleNamesMap[roleId];
          }
        });

        const rolesUsuariosData = Array.isArray(rolesUsuariosResponse?.data)
          ? rolesUsuariosResponse.data
          : Array.isArray(rolesUsuariosResponse)
          ? rolesUsuariosResponse
          : [];

        const usuariosData = Array.isArray(usuariosResponse)
          ? usuariosResponse
          : usuariosResponse?.data || [];

        const userRolesMap = rolesUsuariosData.reduce((acc, roleAssignment) => {
          if (!roleAssignment) return acc;
          const userId = roleAssignment.id_usuario;
          const userData = roleAssignment.id_usuario_usuario || {};
          if (userId) {
            const roleId = roleAssignment.id_rol;
            acc[userId] = {
              ...userData,
              id_usuario: userId,
              rol_id: roleId,
              rol_nombre: rolesMap[roleId] || `Rol ${roleId}`,
            };
          }
          return acc;
        }, {});

        const processedUsers = usuariosData
          .filter(Boolean)
          .map((user) => {
            const userId = user.id_usuario ?? user.id;
            const roleInfo = userRolesMap[userId] || {};
            const roleId = roleInfo.rol_id ?? user.rol_id ?? user.id_rol ?? user.roleId;
            const idEstado = Number(user.id_estado) === 2 ? 2 : 1;
            const nombreUsuario =
              user.nombre_usuario || user.nombre || user.email || "Cliente sin nombre";
            const rolNombre =
              roleInfo.rol_nombre ||
              user.rol_nombre ||
              rolesMap[roleId] ||
              user.roleName ||
              "";
            return {
              ...user,
              ...roleInfo,
              id_usuario: userId,
              rol_id: roleId,
              id_estado: idEstado,
              estado: idEstado === 1 ? "Activo" : "Inactivo",
              nombre_usuario: nombreUsuario,
              rol_nombre: rolNombre,
            };
          });

        const filteredByTipo = isCliente
          ? processedUsers.filter(
              (user) => Number(user.rol_id || user.id_rol) === CLIENT_ROLE_ID
            )
          : processedUsers.filter((user) => {
              const rolId = Number(user.rol_id || user.id_rol);
              const userId = user.id_usuario ?? user.id;
              const currentAttendanceUserId = asistencia?.id_usuario;

              if (
                currentAttendanceUserId !== undefined &&
                currentAttendanceUserId !== null &&
                String(userId) === String(currentAttendanceUserId)
              ) {
                return true;
              }

              return !EMPLOYEE_ATTENDANCE_EXCLUDED_ROLE_IDS.has(rolId);
            });

        const normalized = filteredByTipo
          .map((u) => ({
            id: u.id_usuario ?? u.id,
            nombre: u.nombre_usuario ?? u.nombre ?? u.email ?? `Usuario ${u.id_usuario ?? u.id}`,
            email: u.email ?? "",
            telefono: u.telefono ?? u.phone ?? "",
            rol: u.rol_nombre ?? u.rol ?? u.role ?? "",
            estado:
              u.estado ??
              (u.id_estado === 1
                ? "Activo"
                : u.id_estado === 2
                  ? "Inactivo"
                  : "Desconocido"),
            searchableText: [
              u.nombre_usuario ?? u.nombre ?? u.email ?? "",
              u.email ?? "",
              u.telefono ?? u.phone ?? "",
              u.rol_nombre ?? u.rol ?? u.role ?? "",
              u.estado ??
                (u.id_estado === 1
                  ? "Activo"
                  : u.id_estado === 2
                    ? "Inactivo"
                    : "Desconocido"),
              u.id_usuario ?? u.id ?? "",
            ]
              .join(" ")
              .toLowerCase(),
          }))
          .filter((u) => u.id !== undefined && u.id !== null);

        setUsers(normalized);
      } catch (error) {
        console.error("Error cargando usuarios para asistencia:", error);
        setUsers([]);
      }
    };

    fetchUsers();
  }, [asistencia, isOpen, isCliente]);

  useEffect(() => {
    if (!isOpen || !isCliente) {
      setCitas([]);
      return;
    }

    const fetchCitas = async () => {
      try {
        const data = await getAgenda();
        const agendaData = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.agenda)
          ? data.agenda
          : Array.isArray(data?.results)
          ? data.results
          : [];

        const normalized = agendaData
          .filter(Boolean)
          .map((cita) => {
            const rawId =
              cita.id_cita ??
              cita.id_agenda ??
              cita.id ??
              cita.idAgenda ??
              null;
            const idNum = Number(rawId);
            const id = Number.isFinite(idNum) ? idNum : null;

            const titulo =
              cita.actividad_agenda ||
              cita.actividad ||
              cita.titulo ||
              cita.nombre ||
              cita.descripcion_agenda ||
              (id != null ? `Cita ${id}` : "Cita");

            const fecha =
              cita.agenda_fecha || cita.fecha || cita.fecha_cita || "";
            const horaInicio = toTimeInputValue(cita.hora_inicio || cita.horaInicio);
            const horaFin = toTimeInputValue(cita.hora_fin || cita.horaFin);

            const rawClienteId =
              cita.id_cliente_usuario?.id_usuario ??
              cita.id_cliente_usuario?.id ??
              cita.id_cliente ??
              cita.idCliente ??
              null;
            const clienteIdNum = Number(rawClienteId);
            const clienteId = Number.isFinite(clienteIdNum) ? clienteIdNum : null;

            const subtitleParts = [];
            if (fecha) subtitleParts.push(fecha);
            if (horaInicio || horaFin) {
              subtitleParts.push(
                `${horaInicio || "--:--"} - ${horaFin || "--:--"}`
              );
            }
            if (id != null) subtitleParts.push(`ID: ${id}`);

            const subtitle = subtitleParts.join(" · ");

            return {
              id,
              titulo,
              subtitle,
              fecha,
              horaInicio,
              horaFin,
              clienteId,
              searchableText: normalizeText(
                `${titulo} ${subtitle} ${clienteId ?? ""}`
              ),
              raw: cita,
            };
          })
          .filter((cita) => cita.id != null);

        setCitas(normalized);
      } catch (error) {
        console.error("Error cargando citas para asistencia:", error);
        setCitas([]);
      }
    };

    fetchCitas();
  }, [isOpen, isCliente]);

  useEffect(() => {
    if (!formData.id_usuario || users.length === 0) {
      setSelectedUser(null);
      return;
    }
    const found = users.find((u) => String(u.id) === String(formData.id_usuario));
    setSelectedUser(found || null);
  }, [formData.id_usuario, users]);

  useEffect(() => {
    if (!isCliente) {
      setSelectedCita(null);
      return;
    }

    if (!formData.id_cita || citas.length === 0) {
      setSelectedCita(null);
      return;
    }

    const found = citas.find((cita) => String(cita.id) === String(formData.id_cita));
    setSelectedCita(found || null);
  }, [citas, formData.id_cita, isCliente]);

  const filteredUsers = useMemo(() => {
    const query = (userSearch || "").trim().toLowerCase();
    if (!query) return users.slice(0, 8);
    return users
      .filter((u) => u.searchableText && u.searchableText.includes(query))
      .slice(0, 8);
  }, [users, userSearch]);

  const filteredCitas = useMemo(() => {
    if (!isCliente) return [];

    const baseList = selectedUser?.id
      ? citas.filter((cita) => String(cita.clienteId) === String(selectedUser.id))
      : citas.filter((cita) => cita.clienteId != null);

    const query = normalizeText(citaSearch);
    if (!query) return baseList.slice(0, 8);

    return baseList
      .filter((cita) => cita.searchableText && cita.searchableText.includes(query))
      .slice(0, 8);
  }, [citaSearch, citas, isCliente, selectedUser?.id]);

  const requiredFields = useMemo(() => {
    if (isCliente) {
      return [
        "id_cita",
        "id_usuario",
        "fecha_asistencia",
        "hora_ingreso",
        "hora_salida",
        "id_estado",
      ];
    }
    return [
      "id_usuario",
      "asistencia_fecha",
      "hora_entrada_empleado",
      "hora_salida_empleado",
      "id_estado",
    ];
  }, [isCliente]);

  const validateForm = () => {
    const newErrors = {};
    requiredFields.forEach((field) => {
      const value = formData[field];
      if (value === "" || value === null || value === undefined) {
        newErrors[field] = "Este campo es obligatorio";
      }
    });

    if (isCliente) {
      if (
        formData.hora_ingreso &&
        formData.hora_salida &&
        formData.hora_ingreso >= formData.hora_salida
      ) {
        newErrors.hora_ingreso = "La hora de ingreso debe ser anterior";
        newErrors.hora_salida = "La hora de salida debe ser posterior";
      }
    } else {
      if (
        formData.hora_entrada_empleado &&
        formData.hora_salida_empleado &&
        formData.hora_entrada_empleado >= formData.hora_salida_empleado
      ) {
        newErrors.hora_entrada_empleado = "La hora de entrada debe ser anterior";
        newErrors.hora_salida_empleado = "La hora de salida debe ser posterior";
      } else if (
        formData.hora_entrada_empleado &&
        formData.hora_salida_empleado
      ) {
        const minutosEntrada = toMinutesFromTimeValue(formData.hora_entrada_empleado);
        const minutosSalida = toMinutesFromTimeValue(formData.hora_salida_empleado);
        const duracionMinutos =
          minutosEntrada !== null && minutosSalida !== null
            ? minutosSalida - minutosEntrada
            : null;

        if (duracionMinutos !== null && duracionMinutos > 120) {
          newErrors.hora_entrada_empleado =
            "La asistencia del empleado no puede durar más de 2 horas";
          newErrors.hora_salida_empleado =
            "La hora de salida no puede superar 2 horas desde la entrada";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (
      name === "hora_ingreso" ||
      name === "hora_salida" ||
      name === "hora_entrada_empleado" ||
      name === "hora_salida_empleado"
    ) {
      setErrors((prev) => ({
        ...prev,
        hora_ingreso: "",
        hora_salida: "",
        hora_entrada_empleado: "",
        hora_salida_empleado: "",
      }));
      return;
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setProcesando(true);
    const esEdicion = Boolean(asistencia);
    try {
      const horaEntradaEmpleado = toTimeApiValue(formData.hora_entrada_empleado);
      const horaSalidaEmpleado = toTimeApiValue(formData.hora_salida_empleado);
      const payload = isCliente
          ? {
              id_cita: Number(formData.id_cita),
              id_usuario: Number(formData.id_usuario),
              fecha_asistencia: formData.fecha_asistencia,
              hora_ingreso: toTimeApiValue(formData.hora_ingreso),
              hora_salida: toTimeApiValue(formData.hora_salida),
              id_estado: Number(formData.id_estado),
            }
          : {
              id_usuario: Number(formData.id_usuario),
              asistencia_fecha: formData.asistencia_fecha,
              fecha_asistencia: formData.asistencia_fecha,
              hora_entrada_empleado: horaEntradaEmpleado,
              hora_entrada: horaEntradaEmpleado,
              hora_salida_empleado: horaSalidaEmpleado,
              hora_salida: horaSalidaEmpleado,
              id_estado: Number(formData.id_estado),
              observaciones: formData.observaciones || "",
           };

      const resultado = await onSubmit(payload);
      if (resultado === false) {
        throw new Error(
          esEdicion
            ? "No se pudo actualizar la asistencia"
            : "No se pudo registrar la asistencia"
        );
      }
      toast.success(
        esEdicion
          ? "Asistencia actualizada exitosamente"
          : "Asistencia registrada exitosamente"
      );
    } catch (error) {
      console.error("Error al guardar asistencia:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          (esEdicion
            ? "No se pudo actualizar la asistencia"
            : "No se pudo registrar la asistencia")
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <ModalAsistencias
      isOpen={isOpen}
      onClose={onClose}
      title={
        asistencia
          ? `Editar asistencia ${isCliente ? "cliente" : "empleado"}`
          : `Nueva asistencia ${isCliente ? "cliente" : "empleado"}`
      }
      size="md"
    >
      <MotionForm
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="modal-asistencia__form"
      >
        <motion.div
          className="modal-asistencia__stack"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="modal-asistencia__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <h3 className="modal-asistencia__section-title">
              {isCliente ? "Datos del Cliente" : "Datos del Empleado"}
            </h3>
            <div className="modal-asistencia__grid">
              <div>
                <label className="modal-asistencia__label">
                  {isCliente ? "Cliente" : "Empleado"}{" "}
                  <span className="modal-asistencia__required">*</span>
                </label>
                <input type="hidden" name="id_usuario" value={formData.id_usuario} readOnly />
                {selectedUser ? (
                  <div className="modal-asistencia__selected-item">
                    <div className="modal-asistencia__selected-avatar">
                      <User size={18} color="#6366f1" />
                    </div>

                    <div className="modal-asistencia__selected-content">
                      <div className="modal-asistencia__selected-title">
                        {selectedUser.nombre}
                      </div>
                      <div className="modal-asistencia__selected-subtitle">
                        {selectedUser.email || `ID: ${selectedUser.id}`}
                      </div>
                    </div>

                    {!procesando && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(null);
                          setUserSearch("");
                          setShowUserDropdown(false);
                          setFormData((prev) => ({
                            ...prev,
                            id_usuario: "",
                            ...(isCliente ? { id_cita: "" } : {}),
                          }));
                          if (isCliente) {
                            setSelectedCita(null);
                            setCitaSearch("");
                            setShowCitaDropdown(false);
                            if (errors.id_cita) {
                              setErrors((prev) => ({ ...prev, id_cita: "" }));
                            }
                          }
                          if (errors.id_usuario) {
                            setErrors((prev) => ({ ...prev, id_usuario: "" }));
                          }
                        }}
                        className="modal-asistencia__clear-btn"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="modal-asistencia__search-wrapper">
                    <div className="modal-asistencia__search-icon">
                      <Search size={16} />
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={`Buscar ${isCliente ? "cliente" : "empleado"} por nombre o ID`}
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setShowUserDropdown(true);
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      onBlur={() => {
                        setTimeout(() => setShowUserDropdown(false), 200);
                      }}
                      className={`modal-asistencia__input modal-asistencia__input--with-icon${
                        errors.id_usuario ? " modal-asistencia__input--error" : ""
                      }`}
                    />
                    {showUserDropdown && (
                      <div className="modal-asistencia__dropdown">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((u) => (
                            <div
                              key={u.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setFormData((prev) => ({
                                  ...prev,
                                  id_usuario: String(u.id),
                                  ...(isCliente ? { id_cita: "" } : {}),
                                }));
                                setSelectedUser(u);
                                setUserSearch("");
                                setShowUserDropdown(false);
                                if (isCliente) {
                                  setSelectedCita(null);
                                  setCitaSearch("");
                                  setShowCitaDropdown(false);
                                }
                                if (errors.id_usuario) {
                                  setErrors((prev) => ({ ...prev, id_usuario: "" }));
                                }
                                if (isCliente && errors.id_cita) {
                                  setErrors((prev) => ({ ...prev, id_cita: "" }));
                                }
                              }}
                              className="modal-asistencia__dropdown-item"
                            >
                              <User size={16} color="#6b7280" className="modal-asistencia__dropdown-icon" />
                              <div className="modal-asistencia__dropdown-item-content">
                                <span className="modal-asistencia__dropdown-item-title">{u.nombre}</span>
                                <span className="modal-asistencia__dropdown-item-subtitle">
                                  {u.email || `ID: ${u.id}`}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="modal-asistencia__dropdown-empty">
                            No se encontraron usuarios
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {errors.id_usuario && (
                  <p className="modal-asistencia__error-text">
                    {errors.id_usuario}
                  </p>
                )}
              </div>

              {isCliente && (
                <div>
                  <label className="modal-asistencia__label">
                    Cita <span className="modal-asistencia__required">*</span>
                  </label>
                  <input type="hidden" name="id_cita" value={formData.id_cita} readOnly />
                  {selectedCita ? (
                    <div className="modal-asistencia__selected-item">
                      <div className="modal-asistencia__selected-avatar">
                        <Calendar size={18} color="#6366f1" />
                      </div>

                      <div className="modal-asistencia__selected-content">
                        <div className="modal-asistencia__selected-title">
                          {selectedCita.titulo}
                        </div>
                        <div className="modal-asistencia__selected-subtitle">
                          {selectedCita.subtitle}
                        </div>
                      </div>

                      {!procesando && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCita(null);
                            setCitaSearch("");
                            setShowCitaDropdown(false);
                            setFormData((prev) => ({ ...prev, id_cita: "" }));
                            if (errors.id_cita) {
                              setErrors((prev) => ({ ...prev, id_cita: "" }));
                            }
                          }}
                          className="modal-asistencia__clear-btn"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="modal-asistencia__search-wrapper">
                      <div className="modal-asistencia__search-icon">
                        <Search size={16} />
                      </div>
                      <input
                        ref={citaInputRef}
                        type="text"
                        placeholder="Buscar cita por actividad, fecha o ID"
                        value={citaSearch}
                        onChange={(e) => {
                          setCitaSearch(e.target.value);
                          setShowCitaDropdown(true);
                        }}
                        onFocus={() => setShowCitaDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowCitaDropdown(false), 200);
                        }}
                        className={`modal-asistencia__input modal-asistencia__input--with-icon${
                          errors.id_cita ? " modal-asistencia__input--error" : ""
                        }`}
                      />
                      {showCitaDropdown && (
                        <div className="modal-asistencia__dropdown">
                          {filteredCitas.length > 0 ? (
                            filteredCitas.map((cita) => (
                              <div
                                key={cita.id}
                                onMouseDown={(e) => {
                                  e.preventDefault();

                                  setFormData((prev) => ({
                                    ...prev,
                                    id_cita: String(cita.id),
                                    fecha_asistencia: cita.fecha || prev.fecha_asistencia,
                                    hora_ingreso: cita.horaInicio || prev.hora_ingreso,
                                    hora_salida: cita.horaFin || prev.hora_salida,
                                    id_usuario:
                                      cita.clienteId != null
                                        ? String(cita.clienteId)
                                        : prev.id_usuario,
                                  }));

                                  if (cita.clienteId != null) {
                                    const foundUser = users.find(
                                      (u) => String(u.id) === String(cita.clienteId)
                                    );
                                    if (foundUser) {
                                      setSelectedUser(foundUser);
                                      setUserSearch("");
                                      setShowUserDropdown(false);
                                    }
                                  }

                                  setSelectedCita(cita);
                                  setCitaSearch("");
                                  setShowCitaDropdown(false);

                                  if (errors.id_cita) {
                                    setErrors((prev) => ({ ...prev, id_cita: "" }));
                                  }
                                  if (errors.id_usuario) {
                                    setErrors((prev) => ({ ...prev, id_usuario: "" }));
                                  }
                                }}
                                className="modal-asistencia__dropdown-item"
                              >
                                <Calendar size={16} color="#6b7280" className="modal-asistencia__dropdown-icon" />
                                <div className="modal-asistencia__dropdown-item-content">
                                  <span className="modal-asistencia__dropdown-item-title">
                                    {cita.titulo}
                                  </span>
                                  <span className="modal-asistencia__dropdown-item-subtitle">
                                    {cita.subtitle}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="modal-asistencia__dropdown-empty">
                              No se encontraron citas
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {errors.id_cita && (
                    <p className="modal-asistencia__error-text">
                      {errors.id_cita}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="modal-asistencia__label">
                  Fecha <span className="modal-asistencia__required">*</span>
                </label>
                <input
                  type="date"
                  name={isCliente ? "fecha_asistencia" : "asistencia_fecha"}
                  value={
                    isCliente ? formData.fecha_asistencia : formData.asistencia_fecha
                  }
                  onChange={handleChange}
                  className={`modal-asistencia__input${
                    errors[isCliente ? "fecha_asistencia" : "asistencia_fecha"]
                      ? " modal-asistencia__input--error"
                      : ""
                  }`}
                />
                {errors[isCliente ? "fecha_asistencia" : "asistencia_fecha"] && (
                  <p className="modal-asistencia__error-text">
                    {errors[isCliente ? "fecha_asistencia" : "asistencia_fecha"]}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="modal-asistencia__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <h3 className="modal-asistencia__section-title">Horarios</h3>
            <div className="modal-asistencia__grid">
              <div>
                <label className="modal-asistencia__label">
                  {isCliente ? "Hora de Ingreso" : "Hora de Entrada"}{" "}
                  <span className="modal-asistencia__required">*</span>
                </label>
                <input
                  type="time"
                  name={isCliente ? "hora_ingreso" : "hora_entrada_empleado"}
                  value={isCliente ? formData.hora_ingreso : formData.hora_entrada_empleado}
                  onChange={handleChange}
                  className={`modal-asistencia__input${
                    errors[isCliente ? "hora_ingreso" : "hora_entrada_empleado"]
                      ? " modal-asistencia__input--error"
                      : ""
                  }`}
                />
                {errors[isCliente ? "hora_ingreso" : "hora_entrada_empleado"] && (
                  <p className="modal-asistencia__error-text">
                    {errors[isCliente ? "hora_ingreso" : "hora_entrada_empleado"]}
                  </p>
                )}
              </div>

              <div>
                <label className="modal-asistencia__label">
                  {isCliente ? "Hora de Salida" : "Hora de Salida"}{" "}
                  <span className="modal-asistencia__required">*</span>
                </label>
                <input
                  type="time"
                  name={isCliente ? "hora_salida" : "hora_salida_empleado"}
                  value={isCliente ? formData.hora_salida : formData.hora_salida_empleado}
                  onChange={handleChange}
                  className={`modal-asistencia__input${
                    errors[isCliente ? "hora_salida" : "hora_salida_empleado"]
                      ? " modal-asistencia__input--error"
                      : ""
                  }`}
                />
                {errors[isCliente ? "hora_salida" : "hora_salida_empleado"] && (
                  <p className="modal-asistencia__error-text">
                    {errors[isCliente ? "hora_salida" : "hora_salida_empleado"]}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="modal-asistencia__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <h3 className="modal-asistencia__section-title">Estado</h3>
            <div className="modal-asistencia__grid">
              <div>
                <label className="modal-asistencia__label">
                  Estado <span className="modal-asistencia__required">*</span>
                </label>
                <select
                  name="id_estado"
                  value={formData.id_estado}
                  onChange={handleChange}
                  className={`modal-asistencia__input modal-asistencia__select${
                    errors.id_estado ? " modal-asistencia__input--error" : ""
                  }`}
                >
                  {estadosDisponibles.map((estado) => (
                    <option key={estado.value} value={estado.value}>
                      {estado.label}
                    </option>
                  ))}
                </select>
                {errors.id_estado && (
                  <p className="modal-asistencia__error-text">
                    {errors.id_estado}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          {!isCliente && (
            <motion.div
              className="modal-asistencia__card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.35 }}
            >
              <h3 className="modal-asistencia__section-title">Observaciones</h3>
              <textarea
                name="observaciones"
                value={formData.observaciones}
                onChange={handleChange}
                placeholder="Observaciones del turno..."
                rows={4}
                className="modal-asistencia__input modal-asistencia__textarea"
              />
            </motion.div>
          )}

          <motion.div
            className="pie-modal contenedor-botones modal-asistencia__button-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="modal-asistencia__btn modal-asistencia__btn--cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="modal-asistencia__btn modal-asistencia__btn--save"
              disabled={procesando}
            >
              {asistencia ? "Actualizar" : "Guardar"}
            </button>
          </motion.div>
        </motion.div>
      </MotionForm>
    </ModalAsistencias>
  );
};

/* ======================================================
   Modal Eliminar Asistencia
====================================================== */
export const ModalEliminarAsistencia = ({
  isOpen,
  onClose,
  onConfirm,
  asistencia,
  tipo = "cliente",
}) => {
  if (!isOpen || !asistencia) return null;
  const isCliente = tipo !== "empleado";

  const handleConfirmDelete = () => {
    onConfirm(asistencia);
  };

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirmDelete}
      item={asistencia}
      title={`Eliminar asistencia ${isCliente ? "cliente" : "empleado"}`}
      size="md"
      fields={[
        {
          key: "tipo_asistencia",
          label: "Tipo",
          format: () => <strong>{isCliente ? "Cliente" : "Empleado"}</strong>,
        },
        {
          key: "id_usuario",
          label: "ID Usuario",
          format: (value) => value || "-",
        },
        {
          key: "fecha_asistencia",
          label: "Fecha",
          format: (_, itemActual) =>
            itemActual.fecha_asistencia || itemActual.asistencia_fecha || "-",
        },
        {
          key: "id_estado",
          label: "Estado",
          format: (value) => getEstadoLabel(value, tipo),
        },
      ]}
      warningMessage="Esta accion no se puede deshacer. La asistencia sera eliminada permanentemente."
    />
  );
};


/* ======================================================
   Modal Ver Asistencia
====================================================== */
export const ModalVerAsistencia = ({
  isOpen,
  onClose,
  asistencia,
  tipo = "cliente",
}) => {
  if (!asistencia) return null;
  const isCliente = tipo !== "empleado";
  const nombreUsuario =
    asistencia.nombre_usuario ||
    asistencia.usuario_nombre ||
    asistencia.id_usuario_usuario?.nombre_usuario ||
    asistencia.id_usuario_usuario?.nombre ||
    (asistencia.id_usuario ? `Usuario ${asistencia.id_usuario}` : "-");
  const fechaAsistencia = firstFilledValue(
    asistencia.fecha_asistencia,
    asistencia.asistencia_fecha,
    asistencia.fecha
  );
  const horaEntrada = firstFilledValue(
    isCliente ? asistencia.hora_ingreso : asistencia.hora_entrada_empleado,
    asistencia.hora_entrada,
    asistencia.horaIngreso,
    asistencia.horaEntrada,
    asistencia.hora_inicio,
    asistencia.horaInicio
  );
  const horaSalida = firstFilledValue(
    isCliente ? asistencia.hora_salida : asistencia.hora_salida_empleado,
    asistencia.hora_salida,
    asistencia.hora_salida_cliente,
    asistencia.hora_salida_empleado,
    asistencia.horaSalidaEmpleado,
    asistencia.horaSalida,
    asistencia.hora_fin,
    asistencia.horaFin,
    asistencia.salida
  );
  const citaTexto = isCliente
    ? asistencia.actividad_cita ||
      asistencia.actividad_agenda ||
      asistencia.actividad ||
      asistencia.descripcion_agenda ||
      (asistencia.id_cita ? `Cita ${asistencia.id_cita}` : "-")
    : "-";

  const calcularDuracion = () => {
    const entradaCalc = toTimeCalcValue(horaEntrada);
    const salidaCalc = toTimeCalcValue(horaSalida);

    if (entradaCalc && salidaCalc) {
      const inicio = new Date(`2000-01-01T${entradaCalc}`);
      const fin = new Date(`2000-01-01T${salidaCalc}`);
      const diff = fin.getTime() - inicio.getTime();
      if (diff > 0) {
        const horas = Math.floor(diff / (1000 * 60 * 60));
        const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${horas}h ${minutos}m`;
      }
    }
    return "Sin calcular";
  };

  return (
    <ModalAsistencias
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalles asistencia ${isCliente ? "cliente" : "empleado"}`}
      size="md"
    >
      <div className="modal-asistencia__detail-stack">
        <div className="modal-asistencia__card">
          <h3 className="modal-asistencia__section-title">
            {isCliente ? "Datos del Cliente" : "Datos del Empleado"}
          </h3>
          <div className="modal-asistencia__grid">
            <div>
              <label className="modal-asistencia__label">ID Asistencia</label>
              <input
                type="text"
                className="modal-asistencia__input modal-asistencia__input--readonly"
                value={asistencia.id || "Sin ID"}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className="modal-asistencia__label">
                {isCliente ? "Cliente" : "Empleado"}
              </label>
              <input
                type="text"
                className="modal-asistencia__input modal-asistencia__input--readonly"
                value={nombreUsuario}
                readOnly
                disabled
              />
            </div>
            {isCliente && (
              <div>
                <label className="modal-asistencia__label">Cita</label>
                <input
                  type="text"
                  className="modal-asistencia__input modal-asistencia__input--readonly"
                  value={citaTexto}
                  readOnly
                  disabled
                />
              </div>
            )}
            <div>
              <label className="modal-asistencia__label">Fecha</label>
                <input
                  type="text"
                  className="modal-asistencia__input modal-asistencia__input--readonly"
                  value={fechaAsistencia || "-"}
                  readOnly
                  disabled
                />
            </div>
          </div>
        </div>

        <div className="modal-asistencia__card">
          <h3 className="modal-asistencia__section-title">Horarios</h3>
          <div className="modal-asistencia__grid">
            <div>
              <label className="modal-asistencia__label">
                {isCliente ? "Hora de Ingreso" : "Hora de Entrada"}
              </label>
                <input
                  type="text"
                  className="modal-asistencia__input modal-asistencia__input--readonly"
                  value={horaEntrada || "-"}
                  readOnly
                  disabled
                />
            </div>
            <div>
              <label className="modal-asistencia__label">Hora de Salida</label>
                <input
                  type="text"
                  className="modal-asistencia__input modal-asistencia__input--readonly"
                  value={horaSalida || "-"}
                  readOnly
                  disabled
                />
            </div>
            <div>
              <label className="modal-asistencia__label">Duración</label>
              <input
                type="text"
                className="modal-asistencia__input modal-asistencia__input--readonly"
                value={calcularDuracion()}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        <div className="modal-asistencia__card">
          <h3 className="modal-asistencia__section-title">Estado</h3>
          <div className="modal-asistencia__grid">
            <div>
              <label className="modal-asistencia__label">Estado</label>
              <input
                type="text"
                className="modal-asistencia__input modal-asistencia__input--readonly"
                value={getEstadoLabel(asistencia.id_estado, tipo)}
                readOnly
                disabled
              />
            </div>
          </div>
        </div>

        {!isCliente && (
          <div className="modal-asistencia__card">
            <h3 className="modal-asistencia__section-title">Observaciones</h3>
            <textarea
              className="modal-asistencia__input modal-asistencia__textarea modal-asistencia__textarea--readonly"
              value={asistencia.observaciones || "Sin observaciones"}
              readOnly
              disabled
              rows={4}
            />
          </div>
        )}

        <div className="pie-modal contenedor-botones modal-asistencia__button-row">
          <button
            className="boton boton-secundario modal-asistencia__btn modal-asistencia__btn--cancel"
            type="button"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </ModalAsistencias>
  );
};

// Exportaciones nombradas para usar en Asistencias.jsx
export const ModalCrearAsistencia = ({ isOpen, onClose, onSave, tipo }) => (
  <ModalFormularioAsistencia
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSave}
    tipo={tipo}
  />
);

export const ModalEditarAsistencia = ({
  isOpen,
  onClose,
  asistencia,
  onSave,
  tipo,
}) => (
  <ModalFormularioAsistencia
    isOpen={isOpen}
    onClose={onClose}
    onSubmit={onSave}
    asistencia={asistencia}
    tipo={tipo}
  />
);



