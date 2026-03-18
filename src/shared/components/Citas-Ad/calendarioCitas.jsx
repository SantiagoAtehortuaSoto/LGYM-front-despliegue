import { memo, useState, useEffect, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useAgenda } from "../../../features/dashboard/hooks/Agenda_API/useAgenda";
import ModalCitasAd from "../../../features/dashboard/pages/admin/Citas/modalCitas-ad";
import Modal from "../Modal/Modal";
import {
  ESTADOS_APP,
  OPCIONES_ESTADO_FLUJO,
} from "../../../features/dashboard/components/dataTables/badgesEstado";
import {
  getDefaultAppointmentTimes,
  normalizeAppointmentTimeValue,
  validateAppointmentScheduling,
} from "../../utils/employeeSchedule";

const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin];

const HEADER_TOOLBAR = {
  left: "prev,next today",
  center: "title",
  right: "dayGridMonth,timeGridWeek,timeGridDay",
};

const BUTTON_TEXT = {
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  list: "Lista",
};

const formatDateKey = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return "";
};

const formatUtcDateKey = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "";
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateKey) => {
  if (!dateKey) return "día seleccionado";

  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;

  return parsed.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTimeLabel = (value) => {
  if (!value) return "Por definir";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const text = String(value).trim();
  if (!text) return "Por definir";

  if (text.includes("T")) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleTimeString("es-CO", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const [, rawTime = ""] = text.split("T");
    return rawTime.slice(0, 5) || "Por definir";
  }

  return text.slice(0, 5);
};

const getPersonLabel = (person, fallback) => {
  if (!person || typeof person !== "object") return fallback;

  return (
    person.nombre_completo ||
    `${person.nombre_usuario || ""} ${person.apellido_usuario || ""}`.trim() ||
    person.nombre ||
    person.email ||
    fallback
  );
};

function CalendarioCitas({
  citas,
  useExternalData = false,
  empleados = [],
  clientes = [],
  onEventClick,
  onSelectSlot,
}) {
  const { agenda, cargarAgenda, crearAgenda, actualizarAgenda } = useAgenda();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedDayEmployee, setSelectedDayEmployee] = useState("all");

  useEffect(() => {
    if (useExternalData) return;
    cargarAgenda();
  }, [cargarAgenda, useExternalData]);

  const calendarEvents = useMemo(() => {
    const normalizeTime = (time, fallback) => {
      if (!time || typeof time !== "string") return fallback;
      const trimmed = time.trim();
      return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    };

    const mapAgendaToEvents = (items) =>
      items.map((item) => ({
        id: item.id_agenda ?? item.id,
        title: item.actividad_agenda ?? item.title ?? "Cita",
        start: `${item.agenda_fecha}T${normalizeTime(item.hora_inicio, "09:00:00")}`,
        end: `${item.agenda_fecha}T${normalizeTime(item.hora_fin, "10:00:00")}`,
        className: item.className ?? "evento-calendario",
        extendedProps: item.extendedProps ?? item,
      }));

    const source = useExternalData ? citas : agenda;
    if (!Array.isArray(source) || source.length === 0) return [];

    const first = source[0];
    const looksLikeEvent =
      first &&
      typeof first === "object" &&
      first.start != null &&
      (first.title != null || first.id != null);

    return looksLikeEvent ? source : mapAgendaToEvents(source);
  }, [agenda, citas, useExternalData]);

  const estadoLabelById = useMemo(
    () =>
      new Map(
        OPCIONES_ESTADO_FLUJO.map((estado) => [
          Number(estado.value),
          estado.label,
        ]),
      ),
    [],
  );

  const buildNewCita = useCallback(
    (agendaFecha) => {
      const defaultEmpleadoData = empleados.length > 0 ? empleados[0] : null;
      const defaultEmpleado = defaultEmpleadoData?.id_usuario || "";
      const defaultCliente = clientes.length > 0 ? clientes[0].id_usuario : "";
      const defaultTimes = getDefaultAppointmentTimes(
        agendaFecha,
        defaultEmpleadoData?.horario_empleado,
      );

      return {
        agenda_fecha: agendaFecha,
        hora_inicio: defaultTimes.hora_inicio || "09:00",
        hora_fin: defaultTimes.hora_fin || "10:00",
        actividad_agenda: "Nueva Cita",
        observacion_agenda: "",
        id_cliente: defaultCliente,
        id_empleado: defaultEmpleado,
        id_estado: ESTADOS_APP.PENDIENTE,
        id_cliente_usuario:
          clientes.find(
            (cliente) => Number(cliente.id_usuario) === Number(defaultCliente),
          ) || null,
        id_empleado_usuario:
          empleados.find(
            (empleado) => Number(empleado.id_usuario) === Number(defaultEmpleado),
          ) || null,
      };
    },
    [clientes, empleados],
  );

  const openDraftForDate = useCallback(
    (agendaFecha) => {
      const newCita = buildNewCita(agendaFecha);

      if (onSelectSlot) {
        onSelectSlot(newCita);
        return;
      }

      setSelectedCita(newCita);
      setReadOnly(false);
      setModalOpen(true);
    },
    [buildNewCita, onSelectSlot],
  );

  const openExistingCita = useCallback(
    (citaFull) => {
      if (onEventClick) {
        onEventClick(citaFull);
        return;
      }

      setSelectedCita({
        ...citaFull,
        id_cliente_usuario: citaFull.id_cliente_usuario || null,
        id_empleado_usuario: citaFull.id_empleado_usuario || null,
      });
      setReadOnly(true);
      setModalOpen(true);
    },
    [onEventClick],
  );

  const handleDateSelect = useCallback(
    (info) => {
      const agendaFecha = formatDateKey(
        info?.startStr || info?.dateStr || info?.start,
      );
      if (!agendaFecha) return;

      openDraftForDate(agendaFecha);
    },
    [openDraftForDate],
  );

  const handleEventClick = useCallback(
    (info) => {
      const citaFull =
        info.event.extendedProps &&
        Object.keys(info.event.extendedProps).length > 0
          ? info.event.extendedProps
          : {
              id: info.event.id,
              title: info.event.title,
              start: info.event.start,
              end: info.event.end,
            };

      openExistingCita(citaFull);
    },
    [openExistingCita],
  );

  const handleSave = useCallback(
    async (data) => {
      try {
        const clienteCompleto =
          clientes.find((cliente) => cliente.id_usuario == data.id_cliente) || null;
        const empleadoCompleto =
          empleados.find((empleado) => empleado.id_usuario == data.id_empleado) ||
          null;

        const datosCompletos = {
          ...data,
          agenda_fecha: String(data?.agenda_fecha || ""),
          hora_inicio: normalizeAppointmentTimeValue(data?.hora_inicio),
          hora_fin: normalizeAppointmentTimeValue(data?.hora_fin),
          id_cliente_usuario: clienteCompleto,
          id_empleado_usuario: empleadoCompleto,
        };

        const schedulingValidation = validateAppointmentScheduling({
          agendaFecha: datosCompletos.agenda_fecha,
          horaInicio: datosCompletos.hora_inicio,
          horaFin: datosCompletos.hora_fin,
          empleado: empleadoCompleto,
          agendaItems: agenda,
          currentAppointmentId: datosCompletos.id_agenda ?? datosCompletos.id,
          employeeId: datosCompletos.id_empleado,
          isEditing: Boolean(datosCompletos.id_agenda ?? datosCompletos.id),
        });

        if (!schedulingValidation.valid) {
          throw new Error(schedulingValidation.message);
        }

        if (data.id_agenda) {
          const { id_agenda, ...datosActualizacion } = datosCompletos;
          await actualizarAgenda(id_agenda, datosActualizacion);
        } else {
          await crearAgenda(datosCompletos);
        }

        setModalOpen(false);
        setSelectedCita(null);

        if (!useExternalData) {
          await cargarAgenda();
        }
      } catch (error) {
        console.error("Error guardando cita:", error);
        throw error;
      }
    },
    [
      agenda,
      actualizarAgenda,
      cargarAgenda,
      clientes,
      crearAgenda,
      empleados,
      useExternalData,
    ],
  );

  const renderEventContent = useCallback(
    (eventInfo) => (
      <div className="evento-contenido">
        <div className="evento-hora">{eventInfo.timeText}</div>
        <div className="evento-titulo">{eventInfo.event.title}</div>
      </div>
    ),
    [],
  );

  const handleEventDidMount = useCallback((info) => {
    const desc = info.event.extendedProps?.descripcion_agenda || "";
    const cliente =
      info.event.extendedProps?.id_cliente_usuario?.nombre_completo || "";
    const empleado =
      info.event.extendedProps?.id_empleado_usuario?.nombre_completo || "";

    info.el.title = [
      info.event.title,
      desc,
      cliente && `Cliente: ${cliente}`,
      empleado && `Entrenador: ${empleado}`,
    ]
      .filter(Boolean)
      .join("\n");
  }, []);

  const eventClassNames = useCallback(() => ["evento-calendario"], []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedCita(null);
  }, []);

  const handleCloseDayModal = useCallback(() => {
    setSelectedDay("");
  }, []);

  useEffect(() => {
    setSelectedDayEmployee("all");
  }, [selectedDay]);

  const dayAppointments = useMemo(() => {
    if (!selectedDay) return [];

    return [...calendarEvents]
      .filter((event) => formatDateKey(event?.start) === selectedDay)
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [calendarEvents, selectedDay]);

  const dayEmployeeOptions = useMemo(() => {
    const options = new Map();

    dayAppointments.forEach((event) => {
      const cita = event?.extendedProps || {};
      const empleado =
        cita?.id_empleado_usuario && typeof cita.id_empleado_usuario === "object"
          ? cita.id_empleado_usuario
          : null;
      const empleadoId =
        cita?.id_empleado ??
        cita?.id_empleado_usuario?.id_usuario ??
        cita?.id_empleado_usuario?.id;

      if (empleadoId == null) return;

      options.set(String(empleadoId), {
        value: String(empleadoId),
        label: getPersonLabel(empleado, `Entrenador ${empleadoId}`),
      });
    });

    return [
      { value: "all", label: "Todos los entrenadores" },
      ...Array.from(options.values()).sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
      ),
    ];
  }, [dayAppointments]);

  const filteredDayAppointments = useMemo(() => {
    if (selectedDayEmployee === "all") {
      return dayAppointments;
    }

    return dayAppointments.filter((event) => {
      const cita = event?.extendedProps || {};
      const empleadoId =
        cita?.id_empleado ??
        cita?.id_empleado_usuario?.id_usuario ??
        cita?.id_empleado_usuario?.id;

      return String(empleadoId ?? "") === String(selectedDayEmployee);
    });
  }, [dayAppointments, selectedDayEmployee]);

  return (
    <div className="calendario-citas contenedor-calendario">
      <FullCalendar
        plugins={CALENDAR_PLUGINS}
        initialView="dayGridMonth"
        locale="es"
        selectable
        editable={false}
        events={calendarEvents}
        select={handleDateSelect}
        dateClick={handleDateSelect}
        eventClick={handleEventClick}
        slotMinTime="06:00:00"
        slotMaxTime="12:00:00"
        headerToolbar={HEADER_TOOLBAR}
        buttonText={BUTTON_TEXT}
        allDaySlot={false}
        firstDay={1}
        dayMaxEvents={2}
        moreLinkContent={(args) => `+${args.num}`}
        moreLinkClick={(info) => {
          setSelectedDay(formatUtcDateKey(info?.date));
          return { keepCustomModal: true };
        }}
        eventContent={renderEventContent}
        eventClassNames={eventClassNames}
        eventDidMount={handleEventDidMount}
      />

      <Modal
        isOpen={Boolean(selectedDay)}
        onClose={handleCloseDayModal}
        title={`Citas del ${formatDateLabel(selectedDay)}`}
        size="lg"
      >
        <div className="calendario-dia-modal">
          <div className="calendario-dia-modal__header">
            <div className="calendario-dia-modal__header-copy">
              <p className="calendario-dia-modal__summary">
                {dayAppointments.length === 0
                  ? "No hay citas registradas para esta fecha."
                  : `${filteredDayAppointments.length} de ${dayAppointments.length} cita(s) visibles para esta fecha.`}
              </p>
            </div>
            <label className="calendario-dia-modal__filter">
              <span className="calendario-dia-modal__filter-label">
                Filtrar por empleado
              </span>
              <select
                value={selectedDayEmployee}
                onChange={(event) => setSelectedDayEmployee(event.target.value)}
                className="calendario-dia-modal__filter-select"
              >
                {dayEmployeeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredDayAppointments.length === 0 ? (
            <div className="calendario-dia-modal__empty">
              <p>
                {dayAppointments.length === 0
                  ? `No hay citas registradas para el ${formatDateLabel(selectedDay)}.`
                  : "No hay citas para el empleado seleccionado en esta fecha."}
              </p>
            </div>
          ) : (
            <div className="calendario-dia-modal__list">
              {filteredDayAppointments.map((event) => {
                const cita = event?.extendedProps || {};
                const startTime = formatTimeLabel(
                  cita?.hora_inicio || event?.start,
                );
                const endTime = formatTimeLabel(cita?.hora_fin || event?.end);
                const cliente = getPersonLabel(
                  cita?.id_cliente_usuario,
                  "Cliente no asignado",
                );
                const entrenador = getPersonLabel(
                  cita?.id_empleado_usuario,
                  "Entrenador no asignado",
                );
                const estado =
                  estadoLabelById.get(
                    Number(cita?.id_estado ?? ESTADOS_APP.PENDIENTE),
                  ) || "Sin estado";

                return (
                  <button
                    type="button"
                    key={`${event.id}-${event.start}`}
                    className="calendario-dia-modal__item"
                    onClick={() => {
                      handleCloseDayModal();
                      openExistingCita({
                        ...cita,
                        id: event.id,
                        title: event.title,
                        start: event.start,
                        end: event.end,
                      });
                    }}
                  >
                    <div className="calendario-dia-modal__item-main">
                      <span className="calendario-dia-modal__time">
                        {startTime} - {endTime}
                      </span>
                      <strong className="calendario-dia-modal__title">
                        {event.title || cita?.actividad_agenda || "Cita"}
                      </strong>
                    </div>
                    <div className="calendario-dia-modal__item-meta">
                      <span>Cliente: {cliente}</span>
                      <span>Entrenador: {entrenador}</span>
                      <span>Estado: {estado}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {modalOpen && (
        <ModalCitasAd
          isOpen={modalOpen}
          onClose={handleCloseModal}
          onSave={handleSave}
          initialData={selectedCita || {}}
          empleados={empleados}
          clientes={clientes}
          disabled={readOnly}
          onEdit={() => setReadOnly(false)}
          isReadOnly={readOnly}
        />
      )}
    </div>
  );
}

export default memo(CalendarioCitas);
