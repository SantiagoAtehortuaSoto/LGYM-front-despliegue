const GENERIC_ERROR_PATTERNS = [
  /^error\b/i,
  /^no se pudo\b/i,
  /^no se pudieron\b/i,
  /^ocurrio un error\b/i,
  /^ocurrio un problema\b/i,
];

const TRACKER_KEY = "__LGYM_LAST_API_ERROR__";
const FAILED_TO_FETCH_PATTERN = /failed to fetch/i;

const normalizeMessage = (value) => {
  if (typeof value !== "string") return "";
  const message = value.trim();
  if (!message) return "";
  if (FAILED_TO_FETCH_PATTERN.test(message)) {
    return "conexion con el api no disponible";
  }
  return message;
};

const stringifySafe = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const extractMessageFromUnknown = (value) => {
  if (!value) return "";
  if (typeof value === "string") return normalizeMessage(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const messages = value
      .map((item) => extractMessageFromUnknown(item))
      .filter(Boolean);
    return messages.join("; ");
  }
  if (typeof value === "object") {
    const direct =
      value.msg ||
      value.message ||
      value.error ||
      value.detail ||
      value.title ||
      value.reason ||
      value.description;
    const normalizedDirect = normalizeMessage(direct);
    if (normalizedDirect) return normalizedDirect;

    if (value.errors) {
      const nested = extractMessageFromUnknown(value.errors);
      if (nested) return nested;
    }

    const fallback = stringifySafe(value);
    return normalizeMessage(fallback);
  }
  return "";
};

const collectFromErrorsArray = (errors = []) =>
  (Array.isArray(errors) ? errors : [])
    .map((item) => item?.msg || item?.message || item?.error)
    .map(normalizeMessage)
    .filter(Boolean);

const collectFromErrorsObject = (errors = {}) =>
  Object.values(errors || {})
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((item) =>
      typeof item === "string" ? item : item?.msg || item?.message || item?.error
    )
    .map(normalizeMessage)
    .filter(Boolean);

export const getApiErrorMessage = (error, fallback = "Ha ocurrido un error") => {
  if (!error) return fallback;

  if (typeof error === "string") {
    return normalizeMessage(error) || fallback;
  }

  const data = error?.response?.data ?? error?.data;
  const status = error?.response?.status ?? error?.status;
  const statusText = error?.response?.statusText ?? error?.statusText;
  const errors = data?.errors;

  if (Array.isArray(errors)) {
    const messages = collectFromErrorsArray(errors);
    if (messages.length) return messages.join("; ");
  } else if (errors && typeof errors === "object") {
    const messages = collectFromErrorsObject(errors);
    if (messages.length) return messages.join("; ");
  }

  const direct =
    data?.msg ||
    data?.message ||
    data?.error ||
    data?.detail ||
    data?.title ||
    data?.reason ||
    data?.description ||
    error?.msg ||
    error?.message ||
    error?.error;

  let normalized = normalizeMessage(direct);

  if (!normalized) {
    normalized = extractMessageFromUnknown(data);
  }

  if (!normalized) {
    normalized = extractMessageFromUnknown(error?.response?.data);
  }

  if (!normalized) {
    normalized = extractMessageFromUnknown(error?.body);
  }

  if (!normalized) {
    normalized = extractMessageFromUnknown(error?.cause);
  }

  if (!normalized && status) {
    normalized = `Error ${status}${statusText ? `: ${statusText}` : ""}`;
  }

  if (!normalized) {
    normalized = extractMessageFromUnknown(error);
  }

  return normalizeMessage(normalized) || fallback;
};

export const rememberApiError = (errorOrMessage) => {
  if (typeof window === "undefined") return;
  const message = getApiErrorMessage(errorOrMessage, "");
  if (!message) return;

  window[TRACKER_KEY] = {
    message,
    timestamp: Date.now(),
  };
};

export const consumeRecentApiError = ({
  currentMessage = "",
  maxAgeMs = 3000,
} = {}) => {
  if (typeof window === "undefined") return null;
  const last = window[TRACKER_KEY];
  if (!last || !last.message || !last.timestamp) return null;
  if (Date.now() - last.timestamp > maxAgeMs) return null;

  const normalizedCurrent = normalizeMessage(currentMessage);
  const isGeneric = GENERIC_ERROR_PATTERNS.some((rx) => rx.test(normalizedCurrent));
  if (!isGeneric) return null;

  return last.message;
};
