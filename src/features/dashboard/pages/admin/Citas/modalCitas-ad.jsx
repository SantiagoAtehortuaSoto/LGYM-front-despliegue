import React, { memo, useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Search, X } from "lucide-react";
import Modal from "../../../../../shared/components/Modal/Modal";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import {
  ESTADOS_APP,
  OPCIONES_ESTADO_FLUJO,
} from "../../../components/dataTables/badgesEstado";
import "../../../../../shared/styles/restructured/components/modal-seguimiento.css";
import {
  formatEmployeeShiftLabel,
  getEmployeeScheduleWindow,
  validateAppointmentAgainstEmployeeSchedule,
} from "../../../../../shared/utils/employeeSchedule";

const Motion = motion;

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
const CLIENT_ROLE_ID = 33;

const getRoleName = (usuario) =>
  usuario?.rol_nombre ||
  usuario?.rol?.nombre_rol ||
  usuario?.rol?.nombre ||
  usuario?.role?.nombre_rol ||
  usuario?.role?.nombre ||
  usuario?.id_rol_rol?.nombre_rol ||
  usuario?.id_rol_rol?.nombre ||
  usuario?.id_rol_rol?.name ||
  "";

const getRoleId = (usuario) => {
  const raw =
    usuario?.rol_id ??
    usuario?.id_rol ??
    usuario?.roleId ??
    usuario?.rol?.id_rol ??
    usuario?.rol?.id ??
    usuario?.id_rol_rol?.id_rol ??
    usuario?.id_rol_rol?.id;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const isClienteRole = (usuario) => {
  const roleId = getRoleId(usuario);
  return roleId === CLIENT_ROLE_ID;
};

const isAdminRole = (usuario) => {
  const roleName = normalizeText(getRoleName(usuario));
  const roleId = getRoleId(usuario);
  return (
    roleName.includes("admin") ||
    roleName.includes("administrador") ||
    roleId === 1
  );
};

const buildNombreCompleto = (usuario) => {
  if (!usuario) return "";

  if (usuario.nombre_completo) return usuario.nombre_completo;

  return `${usuario.nombre_usuario || ""} ${usuario.apellido_usuario || ""}`.trim();
};

const getTomorrowISO = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

const getDocumentoUsuario = (usuario) =>
  usuario?.documento ||
  usuario?.numero_documento ||
  usuario?.cedula ||
  usuario?.doc ||
  "";

const matchesUsuarioSearch = (usuario, query) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  const searchableValues = [
    usuario?.id_usuario,
    buildNombreCompleto(usuario),
    usuario?.email,
    getDocumentoUsuario(usuario),
  ];

  return searchableValues.some((value) =>
    normalizeText(value).includes(normalizedQuery),
  );
};

const formatDateLabel = (value) => {
  if (!value) return "Por definir";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatTimeLabel = (value) => {
  const text = String(value || "").trim();
  return text ? text.slice(0, 5) : "Por definir";
};

const EMPTY_FORM_DATA = {
  id_agenda: "",
  actividad_agenda: "",
  observacion_agenda: "",
  agenda_fecha: "",
  hora_inicio: "",
  hora_fin: "",
  id_empleado: "",
  id_empleado_usuario: null,
  id_cliente: "",
  id_cliente_usuario: null,
  id_estado: "",
};

const ModalCitasAd = ({
  isOpen = false,
  onClose,
  onSave,
  title = "Cita",
  initialData = {},
  disabled = false,
  hideEstado = false,
  lockCliente = false,
  onEdit = null,
  onDelete = null,
  empleados: empleadosIniciales = [],
  clientes: clientesIniciales = [],
  actividades: actividadesIniciales = [],
}) => {
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [busquedaEmpleado, setBusquedaEmpleado] = useState("");
  const [mostrarDropdownEmpleado, setMostrarDropdownEmpleado] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [mostrarDropdownCliente, setMostrarDropdownCliente] = useState(false);

  const empleados = useMemo(() => {
    if (!Array.isArray(empleadosIniciales)) return [];
    return empleadosIniciales.filter(
      (usuario) =>
        !isClienteRole(usuario) &&
        !isAdminRole(usuario) &&
        usuario?.hasAppointmentAccess !== false,
    );
  }, [empleadosIniciales]);

  const clientes = useMemo(
    () => (Array.isArray(clientesIniciales) ? clientesIniciales : []),
    [clientesIniciales],
  );
  const actividades = useMemo(
    () => (Array.isArray(actividadesIniciales) ? actividadesIniciales : []),
    [actividadesIniciales],
  );

  const [formData, setFormData] = useState(EMPTY_FORM_DATA);
  const isEditingAppointment = Boolean(
    initialData?.id_agenda || initialData?.id || formData?.id_agenda,
  );
  const shouldHideEstado = hideEstado || !isEditingAppointment;

  const estados = OPCIONES_ESTADO_FLUJO.map((estado) => ({
    id_estado: estado.value,
    nombre_estado: estado.label,
  }));

  useEffect(() => {
    if (!isOpen) return;

    const esEdicion = Boolean(initialData?.id_agenda);
    if (!esEdicion) {
      setFormData(EMPTY_FORM_DATA);
      setErrors({});
      setBusquedaEmpleado("");
      setBusquedaCliente("");
      setMostrarDropdownEmpleado(false);
      setMostrarDropdownCliente(false);
      return;
    }

    setFormData({
      id_agenda: initialData.id_agenda || "",
      actividad_agenda: initialData.actividad_agenda || "",
      observacion_agenda: initialData.observacion_agenda || "",
      agenda_fecha: initialData.agenda_fecha || "",
      hora_inicio: initialData.hora_inicio
        ? String(initialData.hora_inicio).substring(0, 5)
        : "",
      hora_fin: initialData.hora_fin
        ? String(initialData.hora_fin).substring(0, 5)
        : "",
      id_empleado: initialData.id_empleado || "",
      id_empleado_usuario: initialData.id_empleado_usuario || null,
      id_cliente: initialData.id_cliente || "",
      id_cliente_usuario: initialData.id_cliente_usuario || null,
      id_estado: String(initialData.id_estado || ESTADOS_APP.PENDIENTE),
    });
    setErrors({});
    setBusquedaEmpleado("");
    setBusquedaCliente("");
    setMostrarDropdownEmpleado(false);
    setMostrarDropdownCliente(false);
  }, [initialData, isOpen]);

  const selectedEmpleado = useMemo(() => {
    const empleadoId = Number(formData.id_empleado);
    if (Number.isFinite(empleadoId) && empleadoId > 0) {
      return (
        empleados.find((item) => Number(item.id_usuario) === empleadoId) ||
        (formData.id_empleado_usuario &&
        typeof formData.id_empleado_usuario === "object"
          ? formData.id_empleado_usuario
          : null)
      );
    }

    return formData.id_empleado_usuario &&
      typeof formData.id_empleado_usuario === "object"
      ? formData.id_empleado_usuario
      : null;
  }, [empleados, formData.id_empleado, formData.id_empleado_usuario]);

  const selectedSchedule = useMemo(
    () =>
      getEmployeeScheduleWindow(
        formData.agenda_fecha,
        selectedEmpleado?.horario_empleado,
      ),
    [formData.agenda_fecha, selectedEmpleado],
  );

  const scheduleMessage = useMemo(() => {
    if (!formData.agenda_fecha) {
      return "Selecciona una fecha para validar el horario del entrenador.";
    }

    if (!selectedEmpleado) {
      return "Selecciona un entrenador para validar su jornada.";
    }

    if (!selectedSchedule) {
      return "El entrenador no tiene una jornada configurada.";
    }

    if (!selectedSchedule.available) {
      return selectedSchedule.message;
    }

    if (!selectedSchedule?.available) {
      return null;
    }

    return `Horario permitido para ${formatEmployeeShiftLabel(
      selectedEmpleado.horario_empleado,
    ).toLowerCase()}: ${selectedSchedule.startTime} a ${selectedSchedule.endTime} (${selectedSchedule.dayLabel}).`;
  }, [formData.agenda_fecha, selectedEmpleado, selectedSchedule]);

  const validateFormData = useCallback(
    (data) => {
      const nextErrors = {};
      const empleadoId = Number(data.id_empleado);
      const empleadoSeleccionado =
        Number.isFinite(empleadoId) && empleadoId > 0
          ? empleados.find((item) => Number(item.id_usuario) === empleadoId) ||
            (data.id_empleado_usuario &&
            typeof data.id_empleado_usuario === "object"
              ? data.id_empleado_usuario
              : null)
          : data.id_empleado_usuario &&
            typeof data.id_empleado_usuario === "object"
            ? data.id_empleado_usuario
            : null;

    if (!String(data.agenda_fecha || "").trim()) {
      nextErrors.agenda_fecha = "Debe seleccionar una fecha.";
    } else if (data.agenda_fecha < getTomorrowISO()) {
      nextErrors.agenda_fecha = "La fecha no puede ser anterior a mañana.";
    }

      if (!String(data.hora_inicio || "").trim()) {
        nextErrors.hora_inicio = "Debe seleccionar una hora de inicio.";
      }

      if (!String(data.hora_fin || "").trim()) {
        nextErrors.hora_fin = "Debe seleccionar una hora final.";
      }

      if (!String(data.id_empleado || "").trim()) {
        nextErrors.id_empleado = "Debe seleccionar un entrenador.";
      } else if (empleadoSeleccionado?.hasAppointmentAccess === false) {
        nextErrors.id_empleado =
          "El entrenador seleccionado no tiene permisos para Asignar Citas.";
      }

      if (!lockCliente && !String(data.id_cliente || "").trim()) {
        nextErrors.id_cliente = "Debe seleccionar un cliente.";
      }

      if (!String(data.actividad_agenda || "").trim()) {
        nextErrors.actividad_agenda = "Debe seleccionar una actividad.";
      }

      if (!shouldHideEstado && !String(data.id_estado || "").trim()) {
        nextErrors.id_estado = "Debe seleccionar un estado.";
      }

      const scheduleValidation = validateAppointmentAgainstEmployeeSchedule({
        agendaFecha: data.agenda_fecha,
        horaInicio: data.hora_inicio,
        horaFin: data.hora_fin,
        empleado: empleadoSeleccionado,
      });

      if (!scheduleValidation.valid) {
        if (scheduleValidation.message.includes("domingos")) {
          nextErrors.agenda_fecha = scheduleValidation.message;
        } else {
          nextErrors.hora_fin = scheduleValidation.message;
        }
      }

      return nextErrors;
    },
    [empleados, lockCliente, shouldHideEstado],
  );

  const handleChange = useCallback(
    (event) => {
      if (disabled || loading) return;

      const { name, value } = event.target;
      const nextData = {
        ...formData,
        [name]: value,
        ...(name === "id_empleado" ? { id_empleado_usuario: null } : {}),
        ...(name === "id_cliente" ? { id_cliente_usuario: null } : {}),
      };

      setFormData(nextData);
      setErrors(validateFormData(nextData));
    },
    [disabled, formData, loading, validateFormData],
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (disabled) return;

      const nextErrors = validateFormData(formData);
      setErrors(nextErrors);

      if (Object.keys(nextErrors).length > 0) {
        return;
      }

      try {
        setLoading(true);
        const resultado = await onSave({
          ...formData,
          id_estado: formData.id_estado || String(ESTADOS_APP.PENDIENTE),
          hora_inicio:
            formData.hora_inicio.length === 5
              ? `${formData.hora_inicio}:00`
              : formData.hora_inicio,
          hora_fin:
            formData.hora_fin.length === 5
              ? `${formData.hora_fin}:00`
              : formData.hora_fin,
        });
        if (resultado === false) {
          throw new Error(
            formData.id_agenda
              ? "No se pudo actualizar la cita"
              : "No se pudo crear la cita"
          );
        }
        toast.success(
          formData.id_agenda
            ? "Cita actualizada exitosamente"
            : "Cita creada exitosamente"
        );
        onClose();
      } catch (error) {
        console.error("Error al guardar cita:", error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "No se pudo guardar la cita"
        );
      } finally {
        setLoading(false);
      }
    },
    [disabled, formData, onClose, onSave, validateFormData],
  );

  const empleadoLabel = useMemo(() => {
    if (formData.id_empleado_usuario) {
      return buildNombreCompleto(formData.id_empleado_usuario) || "No asignado";
    }

    const empleado = empleados.find(
      (item) => Number(item.id_usuario) === Number(formData.id_empleado),
    );
    return buildNombreCompleto(empleado) || "No asignado";
  }, [empleados, formData.id_empleado, formData.id_empleado_usuario]);

  const selectedCliente = useMemo(() => {
    const clienteId = Number(formData.id_cliente);
    if (Number.isFinite(clienteId) && clienteId > 0) {
      return (
        clientes.find((item) => Number(item.id_usuario) === clienteId) ||
        (formData.id_cliente_usuario && typeof formData.id_cliente_usuario === "object"
          ? formData.id_cliente_usuario
          : null)
      );
    }

    return formData.id_cliente_usuario &&
      typeof formData.id_cliente_usuario === "object"
      ? formData.id_cliente_usuario
      : null;
  }, [clientes, formData.id_cliente, formData.id_cliente_usuario]);

  const clienteLabel = useMemo(() => {
    if (formData.id_cliente_usuario) {
      return buildNombreCompleto(formData.id_cliente_usuario) || "No asignado";
    }

    const cliente = clientes.find(
      (item) => Number(item.id_usuario) === Number(formData.id_cliente),
    );
    return buildNombreCompleto(cliente) || "No asignado";
  }, [clientes, formData.id_cliente, formData.id_cliente_usuario]);

  const empleadosFiltrados = useMemo(
    () => empleados.filter((empleado) => matchesUsuarioSearch(empleado, busquedaEmpleado)),
    [busquedaEmpleado, empleados],
  );

  const clientesFiltrados = useMemo(
    () => clientes.filter((cliente) => matchesUsuarioSearch(cliente, busquedaCliente)),
    [busquedaCliente, clientes],
  );

  const handleSeleccionarEmpleado = useCallback(
    (empleado) => {
      const nextData = {
        ...formData,
        id_empleado: String(empleado?.id_usuario ?? ""),
        id_empleado_usuario: empleado ?? null,
      };
      setFormData(nextData);
      setErrors(validateFormData(nextData));
      setBusquedaEmpleado("");
      setMostrarDropdownEmpleado(false);
    },
    [formData, validateFormData],
  );

  const handleLimpiarEmpleadoSeleccionado = useCallback(() => {
    const nextData = {
      ...formData,
      id_empleado: "",
      id_empleado_usuario: null,
    };
    setFormData(nextData);
    setErrors(validateFormData(nextData));
    setBusquedaEmpleado("");
    setMostrarDropdownEmpleado(false);
  }, [formData, validateFormData]);

  const handleSeleccionarCliente = useCallback(
    (cliente) => {
      const nextData = {
        ...formData,
        id_cliente: String(cliente?.id_usuario ?? ""),
        id_cliente_usuario: cliente ?? null,
      };
      setFormData(nextData);
      setErrors(validateFormData(nextData));
      setBusquedaCliente("");
      setMostrarDropdownCliente(false);
    },
    [formData, validateFormData],
  );

  const handleLimpiarClienteSeleccionado = useCallback(() => {
    const nextData = {
      ...formData,
      id_cliente: "",
      id_cliente_usuario: null,
    };
    setFormData(nextData);
    setErrors(validateFormData(nextData));
    setBusquedaCliente("");
    setMostrarDropdownCliente(false);
  }, [formData, validateFormData]);

  const citaDeleteItem = useMemo(() => {
    if (!formData.id_agenda) return null;

    return {
      id_agenda: formData.id_agenda,
      actividad_agenda: formData.actividad_agenda || "Cita sin actividad",
      agenda_fecha: formatDateLabel(formData.agenda_fecha),
      horario: `${formatTimeLabel(formData.hora_inicio)} - ${formatTimeLabel(formData.hora_fin)}`,
      entrenador: empleadoLabel,
      cliente: clienteLabel,
    };
  }, [
    clienteLabel,
    empleadoLabel,
    formData.actividad_agenda,
    formData.agenda_fecha,
    formData.hora_fin,
    formData.hora_inicio,
    formData.id_agenda,
  ]);

  if (!isOpen) return null;

  const handleOpenDeleteModal = (event) => {
    event.preventDefault();
    if (!onDelete || !formData.id_agenda) return;
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete || !formData.id_agenda || loading) return;

    try {
      setLoading(true);
      const resultado = await onDelete(formData.id_agenda);
      if (resultado === false) {
        throw new Error("No se pudo eliminar la cita");
      }
      toast.success("Cita eliminada exitosamente");
      setIsDeleteModalOpen(false);
      onClose();
    } catch (error) {
      console.error("Error al eliminar cita:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo eliminar la cita"
      );
    } finally {
      setLoading(false);
    }
  };

  const formId = "modal-citas-ad-form";
  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="boton boton-secundario"
      >
        {disabled ? "Cerrar" : "Cancelar"}
      </button>

      {onDelete && formData.id_agenda ? (
        <button
          type="button"
          onClick={handleOpenDeleteModal}
          disabled={loading}
          className="boton btn-peligro"
        >
          Eliminar
        </button>
      ) : null}

      {disabled ? (
        onEdit ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onEdit();
            }}
            disabled={loading}
            className="boton boton-primario"
          >
            Editar Cita
          </button>
        ) : null
      ) : (
        <button
          type="submit"
          form={formId}
          disabled={loading}
          className="boton boton-primario"
        >
          Guardar Cambios
        </button>
      )}
    </>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        size="md"
        className="modal-mediano"
        footer={footer}
      >
        <Motion.form
          id={formId}
          onSubmit={handleSubmit}
          className="modal-form-stack"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
          <Motion.div
            className="modal-form-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <h3 className="modal-section-title">Informacion Basica</h3>

          <div className="modal-grid-two-cols">
            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">
                Fecha <span className="modal-required-asterisk">*</span>
              </label>
                        <input
                          type="date"
                          name="agenda_fecha"
                          value={formData.agenda_fecha}
                          onChange={handleChange}
                          min={getTomorrowISO()}
                          disabled={disabled || loading}
                          required
                          className={`modal-field-input ${
                  errors.agenda_fecha ? "modal-field-input--error" : ""
                }`}
              />
              {errors.agenda_fecha ? (
                <p className="modal-field-error-text">{errors.agenda_fecha}</p>
              ) : null}
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">
                Hora Inicio <span className="modal-required-asterisk">*</span>
              </label>
              <input
                type="time"
                name="hora_inicio"
                value={formData.hora_inicio || ""}
                onChange={handleChange}
                disabled={disabled || loading}
                required
                className={`modal-field-input ${
                  errors.hora_inicio ? "modal-field-input--error" : ""
                }`}
                step="60"
                min={
                  selectedEmpleado && selectedSchedule?.available
                    ? selectedSchedule.startTime
                    : undefined
                }
                max={
                  selectedEmpleado && selectedSchedule?.available
                    ? selectedSchedule.endTime
                    : undefined
                }
                title={scheduleMessage || undefined}
              />
              {errors.hora_inicio ? (
                <p className="modal-field-error-text">{errors.hora_inicio}</p>
              ) : null}
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">
                Hora Fin <span className="modal-required-asterisk">*</span>
              </label>
              <input
                type="time"
                name="hora_fin"
                value={formData.hora_fin || ""}
                onChange={handleChange}
                disabled={disabled || loading}
                required
                className={`modal-field-input ${
                  errors.hora_fin ? "modal-field-input--error" : ""
                }`}
                step="60"
                min={
                  selectedEmpleado && selectedSchedule?.available
                    ? selectedSchedule.startTime
                    : undefined
                }
                max={
                  selectedEmpleado && selectedSchedule?.available
                    ? selectedSchedule.endTime
                    : undefined
                }
                title={scheduleMessage || undefined}
              />
              {errors.hora_fin ? (
                <p className="modal-field-error-text">{errors.hora_fin}</p>
              ) : null}
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">
                Entrenador <span className="modal-required-asterisk">*</span>
              </label>
              {disabled ? (
                <input
                  type="text"
                  className="modal-field-input"
                  value={empleadoLabel}
                  disabled
                />
              ) : (
                <div className="modal-seguimiento__user-selector">
                  {selectedEmpleado ? (
                    <div className="modal-seguimiento__selected-user">
                      <div className="modal-seguimiento__selected-user-info">
                        <div className="modal-seguimiento__selected-user-name">
                          {selectedEmpleado.id_usuario} -{" "}
                          {buildNombreCompleto(selectedEmpleado) ||
                            `Entrenador ${selectedEmpleado.id_usuario}`}
                        </div>
                        <div className="modal-seguimiento__selected-user-email">
                          {getDocumentoUsuario(selectedEmpleado)
                            ? `Documento: ${getDocumentoUsuario(selectedEmpleado)}`
                            : selectedEmpleado.email || "Sin correo"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleLimpiarEmpleadoSeleccionado}
                        className="modal-seguimiento__clear-user-btn"
                        title="Quitar entrenador seleccionado"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`modal-seguimiento__search-box${
                          errors.id_empleado
                            ? " modal-seguimiento__search-box--error"
                            : ""
                        }`}
                      >
                        <Search
                          size={16}
                          className="modal-seguimiento__search-icon"
                        />
                        <input
                          type="text"
                          value={busquedaEmpleado}
                          onFocus={() => setMostrarDropdownEmpleado(true)}
                          onChange={(e) => {
                            setBusquedaEmpleado(e.target.value);
                            setMostrarDropdownEmpleado(true);
                          }}
                          onBlur={() =>
                            setTimeout(() => setMostrarDropdownEmpleado(false), 120)
                          }
                          placeholder="Buscar entrenador por nombre o documento..."
                          className="modal-seguimiento__search-input"
                        />
                      </div>
                      {mostrarDropdownEmpleado && (
                        <div className="modal-seguimiento__search-dropdown">
                          {empleadosFiltrados.length > 0 ? (
                            empleadosFiltrados.map((empleado) => (
                              <div
                                key={empleado.id_usuario}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSeleccionarEmpleado(empleado);
                                }}
                                className="modal-seguimiento__search-option"
                              >
                                <div className="modal-seguimiento__search-option-name">
                                  {empleado.id_usuario} -{" "}
                                  {buildNombreCompleto(empleado) ||
                                    `Entrenador ${empleado.id_usuario}`}
                                </div>
                                <div className="modal-seguimiento__search-option-email">
                                  {getDocumentoUsuario(empleado)
                                    ? `Documento: ${getDocumentoUsuario(empleado)}`
                                    : empleado.email || "Sin correo"}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="modal-seguimiento__search-message">
                              {busquedaEmpleado.trim()
                                ? "No se encontraron entrenadores"
                                : "No hay entrenadores para mostrar"}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {errors.id_empleado ? (
                <p className="modal-field-error-text">{errors.id_empleado}</p>
              ) : null}
            </div>

            <div
              className="modal-field-group modal-field-group--compact"
              style={{ gridColumn: "1 / -1" }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  color:
                    selectedSchedule && !selectedSchedule.available
                      ? "#dc2626"
                      : "#475569",
                }}
              >
                {scheduleMessage}
              </p>
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">
                Cliente <span className="modal-required-asterisk">*</span>
              </label>
              {disabled || lockCliente ? (
                <input
                  type="text"
                  className="modal-field-input"
                  value={clienteLabel}
                  disabled
                />
              ) : (
                <div className="modal-seguimiento__user-selector">
                  {selectedCliente ? (
                    <div className="modal-seguimiento__selected-user">
                      <div className="modal-seguimiento__selected-user-info">
                        <div className="modal-seguimiento__selected-user-name">
                          {selectedCliente.id_usuario} -{" "}
                          {buildNombreCompleto(selectedCliente) ||
                            `Cliente ${selectedCliente.id_usuario}`}
                        </div>
                        <div className="modal-seguimiento__selected-user-email">
                          {getDocumentoUsuario(selectedCliente)
                            ? `Documento: ${getDocumentoUsuario(selectedCliente)}`
                            : selectedCliente.email || "Sin correo"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleLimpiarClienteSeleccionado}
                        className="modal-seguimiento__clear-user-btn"
                        title="Quitar cliente seleccionado"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`modal-seguimiento__search-box${
                          errors.id_cliente
                            ? " modal-seguimiento__search-box--error"
                            : ""
                        }`}
                      >
                        <Search
                          size={16}
                          className="modal-seguimiento__search-icon"
                        />
                        <input
                          type="text"
                          value={busquedaCliente}
                          onFocus={() => setMostrarDropdownCliente(true)}
                          onChange={(e) => {
                            setBusquedaCliente(e.target.value);
                            setMostrarDropdownCliente(true);
                          }}
                          onBlur={() =>
                            setTimeout(() => setMostrarDropdownCliente(false), 120)
                          }
                          placeholder="Buscar cliente por nombre o documento..."
                          className="modal-seguimiento__search-input"
                        />
                      </div>
                      {mostrarDropdownCliente && (
                        <div className="modal-seguimiento__search-dropdown">
                          {clientesFiltrados.length > 0 ? (
                            clientesFiltrados.map((cliente) => (
                              <div
                                key={cliente.id_usuario}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSeleccionarCliente(cliente);
                                }}
                                className="modal-seguimiento__search-option"
                              >
                                <div className="modal-seguimiento__search-option-name">
                                  {cliente.id_usuario} -{" "}
                                  {buildNombreCompleto(cliente) ||
                                    `Cliente ${cliente.id_usuario}`}
                                </div>
                                <div className="modal-seguimiento__search-option-email">
                                  {getDocumentoUsuario(cliente)
                                    ? `Documento: ${getDocumentoUsuario(cliente)}`
                                    : cliente.email || "Sin correo"}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="modal-seguimiento__search-message">
                              {busquedaCliente.trim()
                                ? "No se encontraron clientes"
                                : "No hay clientes para mostrar"}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {errors.id_cliente ? (
                <p className="modal-field-error-text">{errors.id_cliente}</p>
              ) : null}
            </div>

            <div className="modal-field-group modal-field-group--compact">
              <label className="modal-field-label">
                Actividad <span className="modal-required-asterisk">*</span>
              </label>
              <div className="modal-select-wrapper">
                <select
                  name="actividad_agenda"
                  value={formData.actividad_agenda || ""}
                  onChange={handleChange}
                  disabled={disabled || loading}
                  required
                  className={`modal-field-input modal-field-input--select ${
                    errors.actividad_agenda ? "modal-field-input--error" : ""
                  }`}
                >
                  <option value="">Seleccionar actividad</option>
                  {actividades.map((actividad) => (
                    <option key={actividad.id} value={actividad.nombre}>
                      {actividad.nombre}
                    </option>
                  ))}
                </select>
              </div>
              {errors.actividad_agenda ? (
                <p className="modal-field-error-text">
                  {errors.actividad_agenda}
                </p>
              ) : null}
            </div>

            {!shouldHideEstado ? (
              <div className="modal-field-group modal-field-group--compact">
                <label className="modal-field-label">Estado</label>
                <div className="modal-select-wrapper">
                  <select
                    id="id_estado"
                    name="id_estado"
                    value={formData.id_estado}
                    onChange={handleChange}
                    disabled={disabled || loading}
                    className={`modal-field-input modal-field-input--select ${
                      errors.id_estado ? "modal-field-input--error" : ""
                    }`}
                  >
                    <option value="">Seleccionar estado</option>
                    {estados.map((estado) => (
                      <option key={estado.id_estado} value={estado.id_estado}>
                        {estado.nombre_estado}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.id_estado ? (
                  <p className="modal-field-error-text">{errors.id_estado}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Motion.div>

        <Motion.div
          className="modal-form-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <h3 className="modal-section-title">Informacion Adicional</h3>
          <div className="modal-field-group modal-field-group--compact">
            <label className="modal-field-label">Observaciones</label>
            <textarea
              name="observacion_agenda"
              rows={3}
              value={formData.observacion_agenda}
              onChange={handleChange}
              disabled={disabled || loading}
              className="modal-field-input modal-field-input--textarea"
            />
          </div>
        </Motion.div>

          </Motion.div>
        </Motion.form>
      </Modal>

      {citaDeleteItem ? (
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteConfirm}
          item={citaDeleteItem}
          title="Eliminar Cita"
          fields={[
            { key: "actividad_agenda", label: "Actividad" },
            { key: "agenda_fecha", label: "Fecha" },
            { key: "horario", label: "Horario" },
            { key: "entrenador", label: "Entrenador" },
            { key: "cliente", label: "Cliente" },
          ]}
          warningMessage="Esta accion eliminara la agenda seleccionada y no se puede deshacer."
        />
      ) : null}
    </>
  );
};

ModalCitasAd.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  title: PropTypes.string,
  initialData: PropTypes.object,
  disabled: PropTypes.bool,
  hideEstado: PropTypes.bool,
  lockCliente: PropTypes.bool,
  empleados: PropTypes.arrayOf(
    PropTypes.shape({
      id_usuario: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      nombre_usuario: PropTypes.string,
      apellido_usuario: PropTypes.string,
      nombre_completo: PropTypes.string,
      email: PropTypes.string,
      horario_empleado: PropTypes.string,
    }),
  ),
  clientes: PropTypes.arrayOf(
    PropTypes.shape({
      id_usuario: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
        .isRequired,
      nombre_usuario: PropTypes.string,
      apellido_usuario: PropTypes.string,
      nombre_completo: PropTypes.string,
      email: PropTypes.string,
    }),
  ),
  actividades: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      nombre: PropTypes.string.isRequired,
    }),
  ),
};

export default memo(ModalCitasAd);
