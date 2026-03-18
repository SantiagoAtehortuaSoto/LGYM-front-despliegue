const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const MAX_APPOINTMENT_DURATION_MINUTES = 120;
const MAX_APPOINTMENT_DURATION_MESSAGE =
  "La hora de fin no puede superar en más de 2 horas la hora de inicio.";

export const EMPLOYEE_SHIFT_VALUES = {
  MORNING: "manana",
  AFTERNOON: "tarde",
};

export const EMPLOYEE_SHIFT_OPTIONS = [
  { value: EMPLOYEE_SHIFT_VALUES.MORNING, label: "Mañana" },
  { value: EMPLOYEE_SHIFT_VALUES.AFTERNOON, label: "Tarde" },
];

const EMPLOYEE_SHIFT_LABELS = {
  [EMPLOYEE_SHIFT_VALUES.MORNING]: "Mañana",
  [EMPLOYEE_SHIFT_VALUES.AFTERNOON]: "Tarde",
};

const EMPLOYEE_SCHEDULE_WINDOWS = {
  weekday: {
    [EMPLOYEE_SHIFT_VALUES.MORNING]: {
      startMinutes: 7 * 60,
      endMinutes: 12 * 60,
      dayLabel: "lunes a viernes",
      validationLabel: "de lunes a viernes",
    },
    [EMPLOYEE_SHIFT_VALUES.AFTERNOON]: {
      startMinutes: 15 * 60,
      endMinutes: 21 * 60,
      dayLabel: "lunes a viernes",
      validationLabel: "de lunes a viernes",
    },
  },
  saturday: {
    [EMPLOYEE_SHIFT_VALUES.MORNING]: {
      startMinutes: 8 * 60,
      endMinutes: 12 * 60,
      dayLabel: "sábado",
      validationLabel: "los sábados",
    },
    [EMPLOYEE_SHIFT_VALUES.AFTERNOON]: {
      startMinutes: 15 * 60,
      endMinutes: 19 * 60,
      dayLabel: "sábado",
      validationLabel: "los sábados",
    },
  },
};

const resolveEmployeeShiftValue = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.includes(EMPLOYEE_SHIFT_VALUES.AFTERNOON)) {
    return EMPLOYEE_SHIFT_VALUES.AFTERNOON;
  }
  if (normalized.includes(EMPLOYEE_SHIFT_VALUES.MORNING)) {
    return EMPLOYEE_SHIFT_VALUES.MORNING;
  }
  return null;
};

export const isEmployeeShiftValue = (value) => {
  return resolveEmployeeShiftValue(value) != null;
};

export const normalizeEmployeeShift = (value) => {
  return resolveEmployeeShiftValue(value) || EMPLOYEE_SHIFT_VALUES.MORNING;
};

export const formatEmployeeShiftLabel = (value) =>
  EMPLOYEE_SHIFT_LABELS[normalizeEmployeeShift(value)] ||
  EMPLOYEE_SHIFT_LABELS[EMPLOYEE_SHIFT_VALUES.MORNING];

export const timeToMinutes = (value) => {
  if (!value) return null;

  const text = String(value).trim();
  if (!text) return null;

  const [hours, minutes] = text.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

export const minutesToTime = (value) => {
  const totalMinutes = Number(value);
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return "";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const getEmployeeScheduleWindow = (agendaFecha, shiftValue) => {
  if (!agendaFecha) return null;

  const date = new Date(`${agendaFecha}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.getDay();
  if (day === 0) {
    return {
      available: false,
      message: "No se pueden agendar citas los domingos.",
    };
  }

  const shift = resolveEmployeeShiftValue(shiftValue);
  if (!shift) return null;
  const dayType = day === 6 ? "saturday" : "weekday";
  const baseWindow = EMPLOYEE_SCHEDULE_WINDOWS[dayType][shift];

  return {
    available: true,
    shift,
    shiftLabel: formatEmployeeShiftLabel(shift),
    startMinutes: baseWindow.startMinutes,
    endMinutes: baseWindow.endMinutes,
    startTime: minutesToTime(baseWindow.startMinutes),
    endTime: minutesToTime(baseWindow.endMinutes),
    dayLabel: baseWindow.dayLabel,
    validationLabel: baseWindow.validationLabel,
  };
};

export const getDefaultAppointmentTimes = (agendaFecha, shiftValue) => {
  const schedule = getEmployeeScheduleWindow(agendaFecha, shiftValue);
  if (!schedule?.available) {
    return { hora_inicio: "", hora_fin: "" };
  }

  const defaultStart = schedule.startMinutes;
  const defaultEnd = Math.min(defaultStart + 60, schedule.endMinutes);

  return {
    hora_inicio: schedule.startTime,
    hora_fin: minutesToTime(defaultEnd),
  };
};

export const normalizeAppointmentTimeValue = (value, fallback = "") => {
  if (!value || typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text) return fallback;
  return text.length === 5 ? `${text}:00` : text;
};

export const parseAppointmentDateTime = (agendaFecha, hora) => {
  if (!agendaFecha) return null;
  const hhmm = String(hora || "00:00").slice(0, 5);
  const parsed = new Date(`${agendaFecha}T${hhmm}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const validateAppointmentTimeRange = ({ horaInicio, horaFin }) => {
  const startMinutes = timeToMinutes(horaInicio);
  const endMinutes = timeToMinutes(horaFin);

  if (startMinutes == null || endMinutes == null) {
    return {
      valid: false,
      message: "Debes ingresar una hora de inicio y fin válidas.",
      startMinutes,
      endMinutes,
    };
  }

  if (startMinutes >= endMinutes) {
    return {
      valid: false,
      message: "La hora de inicio debe ser menor a la hora de fin.",
      startMinutes,
      endMinutes,
    };
  }

  if (endMinutes - startMinutes > MAX_APPOINTMENT_DURATION_MINUTES) {
    return {
      valid: false,
      message: MAX_APPOINTMENT_DURATION_MESSAGE,
      startMinutes,
      endMinutes,
    };
  }

  return {
    valid: true,
    startMinutes,
    endMinutes,
  };
};

const toComparableId = (value) => {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : String(value);
};

const formatDateToIso = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const formatTimeFromDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
};

const toValidDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const extractAgendaItemId = (item = {}) =>
  item?.id_agenda ??
  item?.id ??
  item?.extendedProps?.id_agenda ??
  item?.extendedProps?.id ??
  null;

const extractAgendaItemEmployeeId = (item = {}) =>
  item?.id_empleado ??
  item?.id_empleado_usuario?.id_usuario ??
  item?.id_empleado_usuario?.id ??
  item?.extendedProps?.id_empleado ??
  item?.extendedProps?.id_empleado_usuario?.id_usuario ??
  item?.extendedProps?.id_empleado_usuario?.id ??
  null;

const extractAgendaItemDate = (item = {}) => {
  const directDate =
    item?.agenda_fecha ??
    item?.fecha ??
    item?.extendedProps?.agenda_fecha ??
    item?.extendedProps?.fecha ??
    "";

  if (directDate) return String(directDate).slice(0, 10);

  const startDate = toValidDate(item?.start ?? item?.extendedProps?.start);
  return startDate ? formatDateToIso(startDate) : "";
};

const extractAgendaItemTime = (item = {}, type = "start") => {
  const candidates =
    type === "start"
      ? [
          item?.hora_inicio,
          item?.horaInicio,
          item?.extendedProps?.hora_inicio,
          item?.extendedProps?.horaInicio,
        ]
      : [
          item?.hora_fin,
          item?.horaFin,
          item?.extendedProps?.hora_fin,
          item?.extendedProps?.horaFin,
        ];

  for (const candidate of candidates) {
    const normalized = normalizeAppointmentTimeValue(candidate);
    if (normalized) return normalized;
  }

  const date = toValidDate(
    type === "start"
      ? item?.start ?? item?.extendedProps?.start
      : item?.end ?? item?.extendedProps?.end,
  );
  return date ? formatTimeFromDate(date) : "";
};

export const findAppointmentConflict = ({
  agendaItems = [],
  currentAppointmentId = null,
  employeeId = null,
  agendaFecha,
  horaInicio,
  horaFin,
  matchByEmployee = true,
}) => {
  const targetId = toComparableId(currentAppointmentId);
  const targetEmployeeId = toComparableId(employeeId);
  const rangeValidation = validateAppointmentTimeRange({ horaInicio, horaFin });
  if (!rangeValidation.valid) return null;

  return (Array.isArray(agendaItems) ? agendaItems : []).find((item) => {
    const itemId = toComparableId(extractAgendaItemId(item));
    if (targetId != null && itemId === targetId) return false;

    if (matchByEmployee) {
      const itemEmployeeId = toComparableId(extractAgendaItemEmployeeId(item));
      if (targetEmployeeId == null || itemEmployeeId !== targetEmployeeId) {
        return false;
      }
    }

    const itemFecha = extractAgendaItemDate(item);
    if (String(itemFecha || "") !== String(agendaFecha || "")) return false;

    const itemStartValidation = validateAppointmentTimeRange({
      horaInicio: extractAgendaItemTime(item, "start"),
      horaFin: extractAgendaItemTime(item, "end"),
    });

    if (!itemStartValidation.valid) return false;

    return (
      rangeValidation.startMinutes < itemStartValidation.endMinutes &&
      itemStartValidation.startMinutes < rangeValidation.endMinutes
    );
  }) || null;
};

export const validateAppointmentScheduling = ({
  agendaFecha,
  horaInicio,
  horaFin,
  empleado = null,
  agendaItems = [],
  currentAppointmentId = null,
  employeeId = null,
  isEditing = false,
  matchByEmployee = true,
  now = new Date(),
}) => {
  const timeRangeValidation = validateAppointmentTimeRange({
    horaInicio,
    horaFin,
  });
  if (!timeRangeValidation.valid) {
    return timeRangeValidation;
  }

  const scheduleValidation = validateAppointmentAgainstEmployeeSchedule({
    agendaFecha,
    horaInicio,
    horaFin,
    empleado,
  });
  if (!scheduleValidation.valid) {
    return scheduleValidation;
  }

  const startDateTime = parseAppointmentDateTime(agendaFecha, horaInicio);
  if (!isEditing && startDateTime && startDateTime <= now) {
    return {
      valid: false,
      message: "No puedes programar una cita en una fecha u hora pasada.",
      schedule: scheduleValidation.schedule ?? null,
    };
  }

  if (isEditing && startDateTime && startDateTime <= now) {
    return {
      valid: false,
      message: "No puedes editar una cita que ya comenzó o terminó.",
      schedule: scheduleValidation.schedule ?? null,
    };
  }

  const conflictingAppointment = findAppointmentConflict({
    agendaItems,
    currentAppointmentId,
    employeeId:
      employeeId ??
      empleado?.id_usuario ??
      empleado?.id ??
      null,
    agendaFecha,
    horaInicio,
    horaFin,
    matchByEmployee,
  });

  if (conflictingAppointment) {
    return {
      valid: false,
      message: matchByEmployee
        ? "El entrenador ya tiene una cita en ese horario. Selecciona otra franja."
        : "Ya existe una cita programada en ese horario.",
      conflictingAppointment,
      schedule: scheduleValidation.schedule ?? null,
    };
  }

  return {
    valid: true,
    schedule: scheduleValidation.schedule ?? null,
    startMinutes: timeRangeValidation.startMinutes,
    endMinutes: timeRangeValidation.endMinutes,
  };
};

export const validateAppointmentAgainstEmployeeSchedule = ({
  agendaFecha,
  horaInicio,
  horaFin,
  empleado,
}) => {
  const sundayCheck = getEmployeeScheduleWindow(agendaFecha, empleado?.horario_empleado);
  if (agendaFecha && sundayCheck && !sundayCheck.available) {
    return {
      valid: false,
      message: sundayCheck.message,
      schedule: sundayCheck,
    };
  }

  if (!empleado) {
    return { valid: true, schedule: null };
  }

  const schedule = getEmployeeScheduleWindow(agendaFecha, empleado?.horario_empleado);
  if (empleado && !schedule) {
    return {
      valid: false,
      message: "El entrenador no tiene una jornada configurada.",
      schedule: null,
    };
  }

  if (!agendaFecha || !horaInicio || !horaFin || !schedule?.available) {
    return { valid: true, schedule };
  }

  const startMinutes = timeToMinutes(horaInicio);
  const endMinutes = timeToMinutes(horaFin);

  if (startMinutes == null || endMinutes == null) {
    return {
      valid: false,
      message: "Debes ingresar una hora de inicio y fin válidas.",
      schedule,
    };
  }

  if (startMinutes >= endMinutes) {
    return {
      valid: false,
      message: "La hora de inicio debe ser menor a la hora de fin.",
      schedule,
    };
  }

  if (endMinutes - startMinutes > MAX_APPOINTMENT_DURATION_MINUTES) {
    return {
      valid: false,
      message: MAX_APPOINTMENT_DURATION_MESSAGE,
      schedule,
    };
  }

  if (
    startMinutes < schedule.startMinutes ||
    endMinutes > schedule.endMinutes
  ) {
    return {
      valid: false,
      message: `El entrenador trabaja en la ${schedule.shiftLabel.toLowerCase()} y solo admite citas de ${schedule.startTime} a ${schedule.endTime} ${schedule.validationLabel}.`,
      schedule,
    };
  }

  return { valid: true, schedule };
};
