import { useState, useEffect, useMemo, useCallback } from "react";
import { CalendarDays, Plus, Clock3, Users } from "lucide-react";
import toast from "react-hot-toast";

import CalendarioCitas from "../../../../../shared/components/Citas-Ad/calendarioCitas";
import ModalCitasAd from "./modalCitas-ad";
import Modal from "../../../../../shared/components/Modal/Modal";
import "./asignarCita.css";

import { useAgenda } from "../../../hooks/Agenda_API/useAgenda";
import { useUsuarios } from "../../../hooks/Usuarios_API/useUsuarios";
import { obtenerServicios } from "../../../hooks/Servicios_API/Servicios_API";
import { ESTADOS_APP } from "../../../components/dataTables/badgesEstado";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import {
  getDefaultAppointmentTimes,
  normalizeAppointmentTimeValue,
  validateAppointmentScheduling,
} from "../../../../../shared/utils/employeeSchedule";
import { canPerformActionForPath } from "../../../hooks/Acceder_API/authService";

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getNombrePersona = (persona, fallback = "No asignado") => {
  if (!persona || typeof persona !== "object") return fallback;

  return (
    persona.nombre_completo ||
    `${persona.nombre_usuario || ""} ${persona.apellido_usuario || ""}`.trim() ||
    persona.nombre ||
    persona.email ||
    fallback
  );
};

const parseCitaDateTime = (cita = {}) => {
  const ext = cita.extendedProps || {};

  const startRaw =
    cita.start || (ext.agenda_fecha ? `${ext.agenda_fecha}T${ext.hora_inicio || "00:00:00"}` : "");

  const parsed = startRaw ? new Date(startRaw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;

  if (!ext.agenda_fecha) return null;
  const hora = String(ext.hora_inicio || "00:00").trim().slice(0, 5);
  const fallback = new Date(`${ext.agenda_fecha}T${hora || "00:00"}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const formatFechaHoraCita = (fecha) => {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return "Fecha por definir";
  return fecha.toLocaleString("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AsignarCita = () => {
  const canCreate = canPerformActionForPath("crear");
  const [modalOpen, setModalOpen] = useState(false);
  const [citaEditando, setCitaEditando] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [actividades, setActividades] = useState([]);
  const [isProximasModalOpen, setIsProximasModalOpen] = useState(false);

  const {
    agenda,
    cargarAgenda,
    crearAgenda,
    actualizarAgenda,
    eliminarAgenda,
    loading,
  } = useAgenda();

  const {
    usuariosClientes,
    usuariosAsignablesCitas,
    cargarUsuarios,
    loading: loadingUsuarios,
  } = useUsuarios();

  const empleados = useMemo(
    () => usuariosAsignablesCitas,
    [usuariosAsignablesCitas],
  );
  const clientes = useMemo(() => usuariosClientes, [usuariosClientes]);
  const actividadesServicio = useMemo(() => {
    return (Array.isArray(actividades) ? actividades : []).map((servicio) => {
      const id =
        servicio.id_servicio ??
        servicio.id ??
        servicio.servicio_id ??
        servicio.id_servicios ??
        "";
      const nombre =
        servicio.nombre_servicio ??
        servicio.nombre ??
        servicio.actividad ??
        servicio.descripcion_servicio ??
        `Servicio ${id}`;
      return {
        id: String(id),
        nombre: String(nombre),
      };
    });
  }, [actividades]);

  const citas = useMemo(() => {
    if (!Array.isArray(agenda)) return [];

    const normalizeTime = (t, fallback) => {
      if (!t || typeof t !== "string") return fallback;
      const trimmed = t.trim();
      return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    };

    return agenda.map((item) => {
      const horaInicio = normalizeTime(item.hora_inicio, "09:00:00");
      const horaFin = normalizeTime(item.hora_fin, "10:00:00");

      const empleado =
        item.id_empleado_usuario ||
        empleados.find(
          (e) => Number(e.id_usuario) === Number(item.id_empleado),
        ) ||
        {};
      const cliente =
        item.id_cliente_usuario ||
        clientes.find((c) => Number(c.id_usuario) === Number(item.id_cliente)) ||
        {};

      return {
        id: String(item.id_agenda),
        title: item.actividad_agenda || "Cita sin título",
        start: `${item.agenda_fecha}T${horaInicio}`,
        end: `${item.agenda_fecha}T${horaFin}`,
        className: `estado-${item.id_estado || ESTADOS_APP.PENDIENTE}`,
        extendedProps: {
          ...item,
          id_empleado_usuario: empleado,
          id_cliente_usuario: cliente,
        },
      };
    });
  }, [agenda, empleados, clientes]);

  const resumenCitasAdmin = useMemo(() => {
    const ahora = new Date();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const pendientes = [];
    const proximas = [];
    const clientesHoy = new Set();

    for (const cita of citas) {
      const ext = cita.extendedProps || {};
      const fechaCita = parseCitaDateTime(cita);
      const idEstado = Number(ext.id_estado ?? ESTADOS_APP.PENDIENTE);

      if (idEstado === Number(ESTADOS_APP.PENDIENTE)) {
        pendientes.push(cita);
      }

      const fechaBase = ext.agenda_fecha
        ? new Date(`${ext.agenda_fecha}T00:00:00`)
        : fechaCita
          ? new Date(fechaCita)
          : null;

      if (fechaBase && !Number.isNaN(fechaBase.getTime())) {
        fechaBase.setHours(0, 0, 0, 0);
        if (fechaBase.getTime() === hoy.getTime()) {
          const clienteId =
            ext.id_cliente ??
            ext.id_cliente_usuario?.id_usuario ??
            ext.id_cliente_usuario?.id ??
            getNombrePersona(ext.id_cliente_usuario, "cliente-sin-id");
          clientesHoy.add(String(clienteId));
        }
      }

      if (fechaCita && fechaCita >= ahora) {
        proximas.push({ ...cita, _fechaOrden: fechaCita });
      }
    }

    proximas.sort((a, b) => a._fechaOrden - b._fechaOrden);

    return {
      proximas,
      pendientesCount: pendientes.length,
      clientesHoyCount: clientesHoy.size,
    };
  }, [citas]);

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        const [serviciosRaw] = await Promise.all([
          obtenerServicios(),
          cargarUsuarios(),
          cargarAgenda(),
        ]);
        const listaServicios = Array.isArray(serviciosRaw)
          ? serviciosRaw
          : Array.isArray(serviciosRaw?.data)
            ? serviciosRaw.data
            : [];

        const soloActividades = listaServicios.filter((servicio) => {
          const tipo =
            servicio.tipo_servicio ??
            servicio.tipo ??
            servicio.id_tipo_servicio_tipo?.tipo_servicio ??
            servicio.id_tipo_servicio_tipo?.tipo ??
            "";
          return normalizeText(tipo) === "actividad";
        });
        setActividades(soloActividades);
      } catch (err) {
        console.error("Error al cargar datos iniciales:", err);
        toast.error(getApiErrorMessage(err, "Error al cargar los datos"));
      }
    };

    cargarDatosIniciales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNuevaCita = useCallback(() => {
    if (!canCreate) {
      toast.error("No tienes permisos para crear en esta sección.");
      return;
    }
    const defaultEmpleado = empleados.length > 0 ? empleados[0] : null;
    const defaultCliente = clientes.length > 0 ? clientes[0].id_usuario : "";
    const agendaFecha = new Date().toISOString().split("T")[0];
    const defaultTimes = getDefaultAppointmentTimes(
      agendaFecha,
      defaultEmpleado?.horario_empleado,
    );

    setCitaEditando({
      agenda_fecha: agendaFecha,
      hora_inicio: defaultTimes.hora_inicio,
      hora_fin: defaultTimes.hora_fin,
      actividad_agenda: "",
      observacion_agenda: "",
      id_empleado: defaultEmpleado?.id_usuario || "",
      id_cliente: defaultCliente,
      id_estado: ESTADOS_APP.PENDIENTE,
    });
    setIsEditMode(true);
    setModalOpen(true);
  }, [canCreate, empleados, clientes]);

  const handleEditCita = useCallback((cita) => {
    const citaData = cita?.extendedProps ?? cita ?? {};

    setCitaEditando({
      ...citaData,
      id_agenda: citaData.id_agenda ?? citaData.id ?? "",
      id_cliente:
        citaData.id_cliente ??
        citaData.id_cliente_usuario?.id_usuario ??
        citaData.id_cliente_usuario?.id ??
        "",
      id_empleado:
        citaData.id_empleado ??
        citaData.id_empleado_usuario?.id_usuario ??
        citaData.id_empleado_usuario?.id ??
        "",
      id_estado: citaData.id_estado ?? ESTADOS_APP.PENDIENTE,
      actividad_agenda: citaData.actividad_agenda ?? "",
      observacion_agenda:
        citaData.observacion_agenda ?? citaData.observaciones ?? "",
    });
    setIsEditMode(false);
    setModalOpen(true);
  }, []);

  const handleEnableEditMode = useCallback(() => {
    setIsEditMode(true);
  }, []);

  const handleSave = useCallback(
    async (datos) => {
      const assert = (condition, message) => {
        if (condition) return;
        toast.error(message);
        throw new Error(message);
      };

      const toNumberOrNull = (value) => {
        if (value === "" || value == null) return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      };

      try {
        const agendaId = toNumberOrNull(datos?.id_agenda ?? datos?.id);

        const payload = {
          id_agenda: agendaId,
          id_cliente: toNumberOrNull(datos?.id_cliente),
          id_empleado: toNumberOrNull(datos?.id_empleado),
          agenda_fecha: String(datos?.agenda_fecha || ""),
          hora_inicio: normalizeAppointmentTimeValue(datos?.hora_inicio),
          hora_fin: normalizeAppointmentTimeValue(datos?.hora_fin),
          id_estado:
            toNumberOrNull(datos?.id_estado) ?? ESTADOS_APP.PENDIENTE,
          actividad_agenda: (datos?.actividad_agenda || "").trim(),
          observacion_agenda: datos?.observacion_agenda || "",
        };

        assert(payload.id_cliente, "El cliente es requerido");
        assert(payload.id_empleado, "El empleado es requerido");
        assert(payload.agenda_fecha, "La fecha de la agenda es requerida");
        assert(payload.hora_inicio, "La hora de inicio es requerida");
        assert(payload.hora_fin, "La hora de fin es requerida");
        assert(payload.actividad_agenda, "La actividad de la agenda es requerida");

        const selectedEmpleado =
          empleados.find(
            (empleado) =>
              Number(empleado.id_usuario ?? empleado.id) === payload.id_empleado,
          ) ||
          (datos?.id_empleado_usuario &&
          typeof datos.id_empleado_usuario === "object"
            ? datos.id_empleado_usuario
            : null) ||
          (citaEditando?.id_empleado_usuario &&
          typeof citaEditando.id_empleado_usuario === "object"
            ? citaEditando.id_empleado_usuario
            : null);

        const schedulingValidation = validateAppointmentScheduling({
          agendaFecha: payload.agenda_fecha,
          horaInicio: payload.hora_inicio,
          horaFin: payload.hora_fin,
          empleado: selectedEmpleado,
          agendaItems: agenda,
          currentAppointmentId: payload.id_agenda,
          employeeId: payload.id_empleado,
          isEditing: Boolean(payload.id_agenda),
        });

        if (!schedulingValidation.valid) {
          throw new Error(schedulingValidation.message);
        }

        const { id_agenda, ...body } = payload;

        if (id_agenda) {
          await actualizarAgenda(id_agenda, body);
        } else {
          await crearAgenda(body);
        }

        setModalOpen(false);
        setCitaEditando(null);
        setIsEditMode(false);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Error al guardar la cita"));
        console.error("Error al guardar la cita:", err);
        throw err;
      }
    },
    [agenda, citaEditando, crearAgenda, actualizarAgenda, empleados],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setCitaEditando(null);
    setIsEditMode(false);
  }, []);

  const isExistingCita = Boolean(citaEditando?.id_agenda);

  return (
    <div className="contenedor-principal citas-admin-page">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <CalendarDays size={40} className="icono-titulo" />
          <h1 className="titulo-pagina">Gestión de Citas</h1>
        </div>

        <button
          className="boton boton-primario flex items-center gap-2"
          onClick={handleNuevaCita}
          disabled={loading || loadingUsuarios || !canCreate}
          title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
        >
          <Plus size={18} />
          {loading ? "Cargando..." : "Nueva Cita"}
        </button>
      </div>

      {(loading || loadingUsuarios) && (
        <div className="text-center py-4">
          <p>Cargando datos...</p>
        </div>
      )}

      <div className="citas-admin-layout">
        <div className="citas-admin-stats">
          <button
            type="button"
            className="card card-primary citas-admin-stat-card"
            onClick={() => setIsProximasModalOpen(true)}
          >
            <div className="card-bg card-bg-primary"></div>
            <div className="card-header">
              <div>
                <p className="card-title text-primary">Proximas Citas</p>
                <h2 className="card-value text-primary">
                  {resumenCitasAdmin.proximas.length}
                </h2>
              </div>
              <div className="icon-box icon-primary">
                <CalendarDays size={22} strokeWidth={2.5} />
              </div>
            </div>
            <div className="card-footer">Ver sesiones proximas por cliente</div>
          </button>

          <div className="card card-warning citas-admin-stat-card">
            <div className="card-bg card-bg-warning"></div>
            <div className="card-header">
              <div>
                <p className="card-title text-warning">Pendientes</p>
                <h2 className="card-value text-warning">
                  {resumenCitasAdmin.pendientesCount}
                </h2>
              </div>
              <div className="icon-box icon-warning">
                <Clock3 size={22} strokeWidth={2.5} />
              </div>
            </div>
            <div className="card-footer">Citas por confirmar o gestionar</div>
          </div>

          <div className="card card-success citas-admin-stat-card">
            <div className="card-bg card-bg-success"></div>
            <div className="card-header">
              <div>
                <p className="card-title text-success">Clientes Hoy</p>
                <h2 className="card-value text-success">
                  {resumenCitasAdmin.clientesHoyCount}
                </h2>
              </div>
              <div className="icon-box icon-success">
                <Users size={22} strokeWidth={2.5} />
              </div>
            </div>
            <div className="card-footer">Clientes con cita en la jornada</div>
          </div>
        </div>

        <div className="citas-admin-calendar-wrap">
          <CalendarioCitas
            citas={citas}
            useExternalData
            empleados={empleados}
            clientes={clientes}
            onEventClick={handleEditCita}
            onSelectSlot={(newCita) => {
              if (!canCreate) {
                toast.error("No tienes permisos para crear en esta sección.");
                return;
              }
              setCitaEditando(newCita);
              setIsEditMode(true);
              setModalOpen(true);
            }}
          />
        </div>
      </div>

      <Modal
        isOpen={isProximasModalOpen}
        onClose={() => setIsProximasModalOpen(false)}
        title="Proximas citas de clientes"
        size="lg"
      >
        <div className="citas-admin-proximas-modal">
          {resumenCitasAdmin.proximas.length === 0 ? (
            <p className="citas-admin-proximas-empty">
              No hay citas futuras registradas.
            </p>
          ) : (
            resumenCitasAdmin.proximas.slice(0, 24).map((cita) => {
              const ext = cita.extendedProps || {};
              const cliente = getNombrePersona(ext.id_cliente_usuario, "Cliente no asignado");
              const entrenador = getNombrePersona(
                ext.id_empleado_usuario,
                "Entrenador no asignado",
              );

              return (
                <button
                  type="button"
                  key={`proxima-${cita.id}-${cita._fechaOrden?.toISOString?.() || ""}`}
                  className="citas-admin-proxima-card"
                  onClick={() => {
                    setIsProximasModalOpen(false);
                    handleEditCita(cita);
                  }}
                >
                  <div className="citas-admin-proxima-title">
                    {ext.actividad_agenda || cita.title || "Cita"}
                  </div>
                  <div className="citas-admin-proxima-meta">
                    <span>Cliente: {cliente}</span>
                    <span>Entrenador: {entrenador}</span>
                    <span>Fecha: {formatFechaHoraCita(cita._fechaOrden)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Modal>

      <ModalCitasAd
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        onEdit={isExistingCita && !isEditMode ? handleEnableEditMode : null}
        onDelete={eliminarAgenda}
        title={
          !isExistingCita
            ? "Nueva Cita"
            : isEditMode
              ? "Editar Cita"
              : "Detalles de la Cita"
        }
        initialData={citaEditando || {}}
        disabled={isExistingCita && !isEditMode}
        empleados={empleados}
        clientes={clientes}
        actividades={actividadesServicio}
      />
    </div>
  );
};

export default AsignarCita;
