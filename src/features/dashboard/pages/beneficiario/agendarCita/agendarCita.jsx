import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Calendar,
  CalendarCheck,
  User,
} from "lucide-react";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import CalendarioCitas from "../../../../../shared/components/Citas-Ad/calendarioCitas";
import Modal from "../../../../../shared/components/Modal/Modal";
import ModalcitasAd from "../../admin/Citas/modalCitas-ad";
import { useAgenda } from "../../../hooks/Agenda_API/useAgenda";
import { getAgenda as obtenerAgendaGlobal } from "../../../hooks/Agenda_API/Agenda_API";
import { useUsuarios } from "../../../hooks/Usuarios_API/useUsuarios";
import { obtenerServicios } from "../../../hooks/Servicios_API/Servicios_API";
import {
  addAppointmentNotification,
  resolveUserId,
} from "../../../../../shared/utils/appointmentNotifications";
import {
  getDefaultAppointmentTimes,
  normalizeAppointmentTimeValue,
  validateAppointmentScheduling,
} from "../../../../../shared/utils/employeeSchedule";
import { isAttendanceAsistio } from "../../../../../shared/utils/attendanceStatus";
import toast from "react-hot-toast";
import "../../../../../shared/styles/restructured/components/agendarCitas.css";

function readCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function getCurrentUserId() {
  const user = readCurrentUser();
  return resolveUserId(user);
}

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function formatDateForNotification(fecha) {
  if (!fecha) return "fecha por definir";
  const date = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildNotificationMessage(cita) {
  const actividad = cita?.actividad_agenda || "Cita agendada";
  const fecha = formatDateForNotification(cita?.agenda_fecha);
  const hora = cita?.hora_inicio ? ` a las ${cita.hora_inicio}` : "";
  return `${actividad} - ${fecha}${hora}`;
}

function formatPendingDate(fecha) {
  if (!fecha) return "Fecha por definir";
  const date = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fecha;
  return date.toLocaleDateString("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPendingTime(hora) {
  if (!hora) return "Por definir";
  const text = String(hora).trim();
  return text.length >= 5 ? text.slice(0, 5) : text;
}

function getTomorrowISO() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

function extractAgendaId(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const directId = source.id_agenda ?? source.id;
    if (directId != null && directId !== "") return directId;

    const nested = source.agenda || source.data || source.result;
    if (nested && typeof nested === "object") {
      const nestedId = nested.id_agenda ?? nested.id;
      if (nestedId != null && nestedId !== "") return nestedId;
    }
  }
  return null;
}

function parseAgendaList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.agenda)) return raw.agenda;
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
}

function isAppointmentAsistio(cita = {}) {
  const numericStatus = Number(cita?.id_estado);
  if (Number.isFinite(numericStatus)) {
    return numericStatus === 3 || numericStatus === 8;
  }

  return isAttendanceAsistio(cita);
}

const AgendarCita = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const calendarioContainerRef = useRef(null);

  const { agenda: citas, cargarAgenda, crearAgenda, actualizarAgenda } =
    useAgenda(true);
  const {
    usuariosRol33: clientes,
    usuariosAsignablesCitas: empleados,
    cargarUsuarios,
  } = useUsuarios();

  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCitas, setFilteredCitas] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [modalReadOnly, setModalReadOnly] = useState(false);
  const [pendientesModalOpen, setPendientesModalOpen] = useState(false);
  const [actividades, setActividades] = useState([]);

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
      } catch (error) {
        console.error("Error al cargar datos iniciales de citas:", error);
        toast.error("No se pudieron cargar entrenadores y actividades");
      }
    };

    cargarDatosIniciales();
  }, [cargarAgenda, cargarUsuarios]);

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

  const clienteSesion = useMemo(() => {
    const sessionId = getCurrentUserId();
    if (!sessionId) return null;
    const sessionIdNumber = Number(sessionId);
    const sessionIdValue = Number.isFinite(sessionIdNumber)
      ? sessionIdNumber
      : sessionId;

    const clienteLista = (Array.isArray(clientes) ? clientes : []).find(
      (cliente) =>
        String(cliente.id_usuario ?? cliente.id ?? "") === String(sessionId),
    );
    if (clienteLista) return clienteLista;

    const user = readCurrentUser() || {};
    return {
      id_usuario: sessionIdValue,
      id: sessionIdValue,
      nombre_usuario: user.nombre_usuario || user.name || "Cliente",
      apellido_usuario: user.apellido_usuario || "",
      nombre_completo:
        user.nombre_completo ||
        `${user.nombre_usuario || user.name || "Cliente"} ${
          user.apellido_usuario || ""
        }`.trim(),
      email: user.email || "",
    };
  }, [clientes]);

  const clientesSesion = useMemo(
    () => (clienteSesion ? [clienteSesion] : []),
    [clienteSesion],
  );

  const estadisticas = useMemo(() => {
    if (!citas || citas.length === 0) {
      return {
        asistencias: 0,
        citasProgramadas: 0,
        citasPendientes: 0,
        proximaCita: null,
      };
    }

    const asistencias = citas.filter((c) => isAppointmentAsistio(c)).length;
    const citasProgramadas = citas.filter((c) => c.id_estado === 2);
    const citasPendientes = citas.filter((c) => c.id_estado === 1).length;

    let proximaCita = null;
    const citasActivas = citas.filter((c) => [1, 2].includes(Number(c.id_estado)));

    if (citasActivas.length > 0) {
      const ordenadas = [...citasActivas].sort((a, b) => {
        const fa = new Date(
          `${a.agenda_fecha || "2000-01-01"} ${a.hora_inicio || "00:00"}`,
        );
        const fb = new Date(
          `${b.agenda_fecha || "2000-01-01"} ${b.hora_inicio || "00:00"}`,
        );
        return fa - fb;
      });
      const ahora = new Date();
      proximaCita = ordenadas.find((cita) => {
        const fechaCita = new Date(
          `${cita.agenda_fecha || "2000-01-01"} ${cita.hora_inicio || "00:00"}`,
        );
        return fechaCita >= ahora;
      }) || ordenadas[0];
    }

    return {
      asistencias,
      citasProgramadas: citasProgramadas.length,
      citasPendientes,
      proximaCita,
    };
  }, [citas]);

  const citasPendientesDetalle = useMemo(() => {
    if (!Array.isArray(citas)) return [];
    return citas
      .filter((c) => Number(c.id_estado) === 1)
      .sort((a, b) => {
        const fa = new Date(
          `${a.agenda_fecha || "2000-01-01"} ${a.hora_inicio || "00:00"}`,
        );
        const fb = new Date(
          `${b.agenda_fecha || "2000-01-01"} ${b.hora_inicio || "00:00"}`,
        );
        return fa - fb;
      });
  }, [citas]);

  const getInstructorName = useCallback(
    (cita) => {
      const empleadoRelacionado = cita?.id_empleado_usuario;
      if (empleadoRelacionado && typeof empleadoRelacionado === "object") {
        const fullName = `${empleadoRelacionado.nombre_usuario || ""} ${
          empleadoRelacionado.apellido_usuario || ""
        }`.trim();
        return (
          fullName ||
          empleadoRelacionado.nombre_completo ||
          empleadoRelacionado.email ||
          "Por asignar"
        );
      }

      const empleado = empleados.find(
        (e) => Number(e.id_usuario) === Number(cita?.id_empleado),
      );
      if (!empleado) return "Por asignar";

      const fullName = `${empleado.nombre_usuario || ""} ${
        empleado.apellido_usuario || ""
      }`.trim();
      return (
        fullName ||
        empleado.nombre_completo ||
        empleado.email ||
        `Entrenador ${empleado.id_usuario}`
      );
    },
    [empleados],
  );

  useEffect(() => {
    if (!Array.isArray(citas)) {
      setFilteredCitas([]);
      return;
    }

    const removeAccents = (s) =>
      s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    const term = removeAccents(searchTerm.toLowerCase().trim());

    const results = citas.filter((c) => {
      const fields = [
        c.actividad_agenda || "",
        c.id_empleado?.toString() || "",
        c.agenda_fecha || "",
        c.descripcion_agenda || "",
      ];
      return fields.some((f) => removeAccents(f.toLowerCase()).includes(term));
    });
    setFilteredCitas(results);
  }, [searchTerm, citas]);

  const openCitaModal = useCallback(
    (event, readOnly = false) => {
      const cita = {
        id_agenda: event.id_agenda || event.id,
        id_empleado: event.id_empleado || empleados[0]?.id_usuario || "",
        id_cliente:
          event.id_cliente ||
          event.id_cliente_usuario?.id_usuario ||
          clienteSesion?.id_usuario ||
          getCurrentUserId() ||
          "",
        id_empleado_usuario: event.id_empleado_usuario || null,
        id_cliente_usuario: event.id_cliente_usuario || clienteSesion || null,
        actividad_agenda: event.actividad_agenda || event.servicio || "",
        agenda_fecha:
          event.agenda_fecha ||
          event.fecha ||
          getTomorrowISO(),
        hora_inicio: event.hora_inicio || event.horaInicio || "",
        hora_fin: event.hora_fin || event.horaFin || "",
        descripcion_agenda: event.descripcion_agenda || event.notas || "",
        observacion_agenda:
          event.observacion_agenda || event.observaciones || "",
        id_estado: event.id_estado || 1,
      };

      setSelectedCita(cita);
      setModalReadOnly(readOnly);
      setModalOpen(true);
    },
    [clienteSesion, empleados],
  );

  const handleCalendarSelect = useCallback(
    (event) => openCitaModal(event, false),
    [openCitaModal],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const citaId = params.get("cita");
    if (!citaId || !Array.isArray(citas) || citas.length === 0) return;

    const citaEncontrada = citas.find(
      (item) => String(item.id_agenda || item.id) === String(citaId),
    );

    calendarioContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

    if (citaEncontrada) {
      openCitaModal(citaEncontrada, false);
    }

    params.delete("cita");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: "#calendario-citas",
      },
      { replace: true },
    );
  }, [citas, location.pathname, location.search, navigate, openCitaModal]);

  const handleAgendar = async (citaData) => {
    try {
      const clienteId =
        citaData.id_cliente || clienteSesion?.id_usuario || getCurrentUserId();
      const cliente = clienteSesion || null;
      const empleado = empleados.find(
        (e) => e.id_usuario === Number(citaData.id_empleado),
      );

      if (!clienteId) {
        throw new Error("No se identificó el cliente en sesión");
      }
      if (!citaData.id_empleado) {
        throw new Error("Debes seleccionar un entrenador");
      }

      const agendaGlobalRaw = await obtenerAgendaGlobal({ onlyMine: false });
      const agendaGlobal = parseAgendaList(agendaGlobalRaw);
      const payload = {
        ...citaData,
        agenda_fecha: String(citaData.agenda_fecha || ""),
        hora_inicio: normalizeAppointmentTimeValue(citaData.hora_inicio),
        hora_fin: normalizeAppointmentTimeValue(citaData.hora_fin),
      };

      const schedulingValidation = validateAppointmentScheduling({
        agendaFecha: payload.agenda_fecha,
        horaInicio: payload.hora_inicio,
        horaFin: payload.hora_fin,
        empleado,
        agendaItems: agendaGlobal,
        currentAppointmentId: payload.id_agenda ?? payload.id ?? null,
        employeeId: payload.id_empleado,
        isEditing: Boolean(payload.id_agenda ?? payload.id),
      });

      if (!schedulingValidation.valid) {
        throw new Error(schedulingValidation.message);
      }

      const data = {
        ...payload,
        id_estado: 2,
        id_cliente: clienteId,
        id_cliente_usuario: cliente || null,
        id_empleado_usuario: empleado || null,
      };

      if (citaData.id_agenda) {
        await actualizarAgenda(data);
        toast.success("Cita actualizada exitosamente");
      } else {
        const response = await crearAgenda(data);
        const citaId = extractAgendaId(response, data);
        addAppointmentNotification({
          title: "Cita agendada",
          message: buildNotificationMessage(data),
          route: "/cliente/agendarCita",
          citaId,
          userId: getCurrentUserId(),
          type: "appointment",
        });
        toast.success("Cita agendada exitosamente");
      }

      await cargarAgenda();
      setModalOpen(false);
    } catch (e) {
      toast.error(e.message || "Error al guardar la cita");
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedCita(null);
    setModalReadOnly(false);
  };

  const handleProgramadasClick = () => {
    if (estadisticas.proximaCita) {
      openCitaModal(estadisticas.proximaCita, true);
    } else {
      calendarioContainerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handlePendientesClick = () => {
    setPendientesModalOpen(true);
  };

  const handleNuevaCitaClick = useCallback(() => {
    const empleadoPorDefecto = empleados[0] || null;
    const clientePorDefecto = clienteSesion || null;
    const agendaFecha = getTomorrowISO();
    const defaultTimes = getDefaultAppointmentTimes(
      agendaFecha,
      empleadoPorDefecto?.horario_empleado,
    );

    openCitaModal(
      {
        id_agenda: "",
        id_empleado: empleadoPorDefecto?.id_usuario || "",
        id_cliente: clientePorDefecto?.id_usuario || getCurrentUserId() || "",
        id_empleado_usuario: empleadoPorDefecto,
        id_cliente_usuario: clientePorDefecto,
        actividad_agenda: "",
        agenda_fecha: agendaFecha,
        hora_inicio: defaultTimes.hora_inicio,
        hora_fin: defaultTimes.hora_fin,
        descripcion_agenda: "",
        observacion_agenda: "",
        id_estado: 1,
      },
      false,
    );
  }, [clienteSesion, empleados, openCitaModal]);

  return (
    <div className="main-ad agendar-cita-page">
      <div className="main-ad-column">
        <div className="encabezado-acciones">
          <div className="titulo-con-icono">
            <CalendarDays size={40} className="icono-titulo" color="red" />
            <h1>Agendar Cita</h1>
          </div>

          <div className="acciones-derecha">
            <BuscadorUniversal
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar citas disponibles..."
            />
            <button
              type="button"
              className="boton-primario"
              onClick={handleNuevaCitaClick}
            >
              Agendar una cita
            </button>
          </div>
        </div>

        <div className="agendar-cita-layout">
          <div className="estadisticas-grid">
            <div className="card card-success">
              <div className="card-bg card-bg-success"></div>

              <div className="card-header">
                <div>
                  <p className="card-title text-success">Asistencias</p>
                  <h2 className="card-value text-success">
                    {estadisticas.asistencias}
                  </h2>
                </div>

                <div className="icon-box icon-success">
                  <CheckCircle size={23} strokeWidth={2.5} />
                </div>
              </div>

              <div className="card-footer">Citas completadas</div>
            </div>

            <div
              className="card card-primary proxima-card"
              onClick={handleProgramadasClick}
            >
              <div className="card-bg card-bg-primary"></div>
              <p className="card-title text-primary">Proxima Cita</p>

              {estadisticas.proximaCita ? (
                <div className="proxima-info">
                  <div className="proxima-row">
                    <div className="icon-box icon-primary">
                      <CalendarCheck size={14} />
                    </div>
                    <div>
                      <p className="proxima-label">Fecha</p>
                      <p className="proxima-value">
                        {new Date(
                          estadisticas.proximaCita.agenda_fecha,
                        ).toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="proxima-row">
                    <div className="icon-box icon-primary">
                      <Clock size={14} />
                    </div>
                    <div>
                      <p className="proxima-label">Horario</p>
                      <p className="proxima-value">
                        {estadisticas.proximaCita.hora_inicio || "Por definir"}
                      </p>
                    </div>
                  </div>

                  <div className="proxima-row">
                    <div className="icon-box icon-primary">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="proxima-label">Instructor</p>
                      <p className="proxima-value">
                        {estadisticas.proximaCita.id_empleado_usuario
                          ?.nombre_usuario || "Por asignar"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="proxima-info empty">
                  <Calendar size={28} />
                  <p className="proxima-label">No tienes citas programadas</p>
                </div>
              )}
            </div>

            <div className="card card-warning" onClick={handlePendientesClick}>
              <div className="card-bg card-bg-warning"></div>

              <div className="card-header">
                <div>
                  <p className="card-title text-warning">Pendientes</p>
                  <h2 className="card-value text-warning">
                    {estadisticas.citasPendientes}
                  </h2>
                </div>

                <div className="icon-box icon-warning">
                  <Clock size={23} strokeWidth={2.5} />
                </div>
              </div>

              <div className="card-footer">Esperando confirmacion</div>
            </div>
          </div>

          <div
            id="calendario-citas"
            ref={calendarioContainerRef}
            className="agendar-cita-calendario"
          >
            <CalendarioCitas
              citas={filteredCitas}
              useExternalData
              onEventClick={handleCalendarSelect}
              onSelectSlot={handleCalendarSelect}
              empleados={empleados}
              clientes={clientesSesion}
            />
          </div>
        </div>
      </div>

      {modalOpen && (
        <ModalcitasAd
          isOpen={modalOpen}
          onClose={closeModal}
          onSave={handleAgendar}
          title={modalReadOnly ? "Detalle de la proxima cita" : "Cita"}
          initialData={selectedCita || {}}
          clientes={clientesSesion}
          empleados={empleados}
          actividades={actividadesServicio}
          lockCliente
          disabled={modalReadOnly}
          hideEstado
          isReadOnly={modalReadOnly}
        />
      )}

      {pendientesModalOpen && (
        <Modal
          isOpen={pendientesModalOpen}
          onClose={() => setPendientesModalOpen(false)}
          title="Listado de citas pendientes"
          size="md"
        >
          <div className="pendientes-modal-contenido">
            {citasPendientesDetalle.length === 0 ? (
              <p className="pendientes-vacio">
                No tienes citas pendientes en este momento.
              </p>
            ) : (
              <ul className="pendientes-lista">
                {citasPendientesDetalle.map((cita) => (
                  <li
                    key={cita.id_agenda || cita.id}
                    className="pendientes-item"
                  >
                    <p className="pendientes-item-actividad">
                      {cita.actividad_agenda || "Cita pendiente"}
                    </p>
                    <p className="pendientes-item-meta">
                      {formatPendingDate(cita.agenda_fecha)} -{" "}
                      {formatPendingTime(cita.hora_inicio)} a{" "}
                      {formatPendingTime(cita.hora_fin)}
                    </p>
                    <p className="pendientes-item-meta">
                      Instructor: {getInstructorName(cita)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

    </div>
  );
};

export default AgendarCita;
