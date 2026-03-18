const normalizeAttendanceStatusText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

const getStatusCandidates = (value) => {
  if (value == null) return [];

  if (typeof value !== "object") {
    return [value];
  }

  return [
    value.id_estado,
    value.estado,
    value.status,
    value.id_estado_estado,
    value.estado_asistencia,
    value.id_estado_asistencia,
  ].filter((candidate) => candidate != null && candidate !== "");
};

const resolveAttendanceStatusId = (value) => {
  const candidates = getStatusCandidates(value);

  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;

    if (typeof candidate === "object") {
      const nestedId =
        candidate.id_estado ??
        candidate.id ??
        candidate.value ??
        candidate.valor;
      const parsedNestedId = Number(nestedId);
      if (Number.isFinite(parsedNestedId)) {
        return parsedNestedId;
      }
      continue;
    }

    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const resolveAttendanceStatusText = (value) => {
  const candidates = getStatusCandidates(value);

  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;

    if (typeof candidate === "object") {
      const nestedText =
        candidate.estado ??
        candidate.nombre_estado ??
        candidate.nombre ??
        candidate.label ??
        candidate.status;
      const normalizedNestedText = normalizeAttendanceStatusText(nestedText);
      if (normalizedNestedText) {
        return normalizedNestedText;
      }
      continue;
    }

    const normalizedText = normalizeAttendanceStatusText(candidate);
    if (normalizedText) {
      return normalizedText;
    }
  }

  return "";
};

export const isAttendanceAsistio = (value) => {
  const statusId = resolveAttendanceStatusId(value);
  if (statusId !== null) {
    return statusId === 8;
  }

  const statusText = resolveAttendanceStatusText(value);
  if (!statusText) {
    return false;
  }

  if (statusText.includes("NO ASIST")) {
    return false;
  }

  return statusText === "ASISTIO" || statusText === "ASISTIO CLIENTE";
};

