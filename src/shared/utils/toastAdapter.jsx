import React from "react";
import { ToastContainer, toast as toastify } from "react-toastify";
import {
  consumeRecentApiError,
  getApiErrorMessage,
  rememberApiError,
} from "./apiErrorMessage";

const TOAST_DEDUP_WINDOW_MS = 900;
const REQUEST_FEEDBACK_PATTERN =
  /(exitos|error|fall|no se pudo|algo salio mal|crear|editar|borrar|eliminar|estado)/i;

let lastToastMeta = {
  type: "",
  message: "",
  source: "",
  at: 0,
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const normalizeForMatch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[!?.;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const appendMessageDetail = (baseMessage, detailMessage) => {
  const trimmedBase = String(baseMessage || "").trim();
  if (!trimmedBase) return detailMessage;
  const punctuation = /[.!?]$/.test(trimmedBase) ? "" : ".";
  return `${trimmedBase}${punctuation} ${detailMessage}`;
};

const isAlreadyDetailedMessage = (message) => {
  const content = String(message || "").trim();
  if (!content) return false;
  const sentenceCount = (content.match(/[.!?]/g) || []).length;
  return content.length >= 95 || sentenceCount >= 2;
};

const enrichToastMessage = (type, rawMessage) => {
  const original = String(rawMessage || "").trim();
  if (!original) return original;

  const normalized = normalizeForMatch(original);

  if (normalized === "inicio de sesión exitoso") {
    return "Inicio de sesión exitoso. Tus credenciales fueron validadas y ya ingresaste a tu cuenta.";
  }

  if (normalized === "inicio de sesión fallido") {
    return "Inicio de sesión fallido. No se pudo validar tu correo o contraseña, por eso no ingresaste.";
  }

  const legacySuccessWithEntity = normalized.match(
    /^(crear|editar|borrar|cambiar estado|accion)\s+(.+)\s+exitoso$/
  );
  if (legacySuccessWithEntity) {
    const [, verb, entityRaw] = legacySuccessWithEntity;
    const entity = entityRaw.trim();

    if (verb === "crear") {
      return `Creación de ${entity} completada. El registro se guardó correctamente.`;
    }
    if (verb === "editar") {
      return `Actualización de ${entity} completada. Los cambios quedaron guardados.`;
    }
    if (verb === "borrar") {
      return `Eliminación de ${entity} completada. El registro ya no aparece en el sistema.`;
    }
    if (verb === "cambiar estado") {
      return `Cambio de estado exitoso en ${entity}. El nuevo estado ya quedó guardado.`;
    }
    return `${verb} de ${entity} completado.`;
  }

  const legacySuccessNoEntity = normalized.match(
    /^(crear|editar|borrar|cambiar estado|accion)\s+exitoso$/
  );
  if (legacySuccessNoEntity) {
    const [, verb] = legacySuccessNoEntity;
    if (verb === "crear") {
      return "Creación completada. El registro se guardó correctamente.";
    }
    if (verb === "editar") {
      return "Actualización completada. Los cambios quedaron guardados.";
    }
    if (verb === "borrar") {
      return "Eliminación completada. El registro ya no aparece en el sistema.";
    }
    if (verb === "cambiar estado") {
      return "Cambio de estado exitoso. El nuevo estado ya quedó guardado.";
    }
    return `${verb} completado.`;
  }

  if (isAlreadyDetailedMessage(original)) {
    return original;
  }

  if (type === "success") {
    if (
      /\b(cread[oa]s?|registrad[oa]s?)\b/.test(normalized) &&
      /\b(exitosamente|correctamente)\b/.test(normalized)
    ) {
      return appendMessageDetail(
        original,
        "La acción se completó y la información ya quedó guardada en el sistema."
      );
    }

    if (
      /\b(actualizad[oa]s?|editad[oa]s?)\b/.test(normalized) &&
      /\b(exitosamente|correctamente)\b/.test(normalized)
    ) {
      return appendMessageDetail(
        original,
        "Los cambios se aplicaron correctamente y quedaron guardados."
      );
    }

    if (
      /\b(eliminad[oa]s?|removid[oa]s?)\b/.test(normalized) &&
      /\b(exitosamente|correctamente)\b/.test(normalized)
    ) {
      return appendMessageDetail(
        original,
        "El registro ya no aparece en el listado después de esta acción."
      );
    }

    if (
      /\bagregad[oa]\s+al\s+carrito\b/.test(normalized) ||
      normalized === "agregado al carrito"
    ) {
      return appendMessageDetail(
        original,
        "El ítem ya está en tu carrito y puedes continuar con la compra."
      );
    }

    if (/\bexportacion\s+lista\b/.test(normalized)) {
      return "Exportación completada. El archivo se generó correctamente y está listo para descargar.";
    }

    if (/\bcambio de estado exitoso\b/.test(normalized)) {
      return "Cambio de estado aplicado correctamente. El nuevo estado ya quedó guardado.";
    }

    if (/\bdescargad[oa]\s+correctamente\b/.test(normalized)) {
      return appendMessageDetail(original, "La descarga finalizó sin errores.");
    }
  }

  if (type === "error") {
    const legacyErrorCreate = normalized.match(/^algo salio mal al crear\s+(.+?)(\s+intenta|$)/);
    if (legacyErrorCreate) {
      return `No se pudo crear ${legacyErrorCreate[1].trim()}. La acción no se completó y no se guardaron nuevos datos.`;
    }

    const legacyErrorUpdate = normalized.match(
      /^algo salio mal al editar\s+(.+?)(\s+intenta|$)/
    );
    if (legacyErrorUpdate) {
      return `No se pudo actualizar ${legacyErrorUpdate[1].trim()}. Los cambios no fueron aplicados.`;
    }

    const legacyErrorDelete = normalized.match(
      /^algo salio mal al borrar\s+(.+?)(\s+intenta|$)/
    );
    if (legacyErrorDelete) {
      return `No se pudo eliminar ${legacyErrorDelete[1].trim()}. El registro se mantiene sin cambios.`;
    }

    const legacyErrorStatus = normalized.match(
      /^algo salio mal al cambiar estado\s+(.+?)(\s+intenta|$)/
    );
    if (legacyErrorStatus) {
      return `No se pudo cambiar el estado de ${legacyErrorStatus[1].trim()}. El valor anterior se mantiene.`;
    }

    if (/\b(error al|no se pudo)\s+crear\b/.test(normalized)) {
      return appendMessageDetail(
        original,
        "La acción falló y no se guardó información nueva."
      );
    }

    if (
      /\b(error al|no se pudo)\s+actualizar\b/.test(normalized) ||
      /\b(error al|no se pudo)\s+editar\b/.test(normalized)
    ) {
      return appendMessageDetail(
        original,
        "Los cambios no se aplicaron y se mantiene la información anterior."
      );
    }

    if (/\b(error al|no se pudo)\s+eliminar\b/.test(normalized)) {
      return appendMessageDetail(
        original,
        "El registro sigue existiendo porque la operación no se completo."
      );
    }

    if (/\b(error al|no se pudo)\s+cargar\b/.test(normalized)) {
      return appendMessageDetail(
        original,
        "No se recibieron los datos esperados desde el servidor."
      );
    }

    if (/\b(error al|no se pudo)\s+guardar\b/.test(normalized)) {
      return appendMessageDetail(
        original,
        "La información no se guardó por este error."
      );
    }

    if (/\bfallo al cambiar el estado\b/.test(normalized)) {
      return "No se pudo cambiar el estado. El valor anterior se mantiene sin cambios.";
    }
  }

  return original;
};

const resolveSource = (options) =>
  options && typeof options === "object"
    ? String(options._lgymSource || "").trim().toLowerCase()
    : "";

const mapOptions = (options = {}) => {
  if (!options || typeof options !== "object") return {};
  const { duration, ...rest } = options;
  delete rest._lgymSource;
  return {
    ...rest,
    ...(duration != null ? { autoClose: duration } : {}),
    ...(rest.pauseOnHover == null ? { pauseOnHover: true } : {}),
  };
};

const resolveErrorMessage = (input, fallback) => {
  const fallbackText = fallback || "Ha ocurrido un error.";
  const message =
    typeof input === "string"
      ? input
      : getApiErrorMessage(input, fallbackText);

  const replacement = consumeRecentApiError({
    currentMessage: message,
  });

  return replacement || message || fallbackText;
};

const shouldSuppressDuplicateToast = ({ type, message, source }) => {
  const now = Date.now();
  const withinWindow = now - lastToastMeta.at <= TOAST_DEDUP_WINDOW_MS;
  if (!withinWindow) return false;

  const sameType = lastToastMeta.type === type;
  if (!sameType) return false;

  const sameMessage = normalizeText(lastToastMeta.message) === normalizeText(message);
  if (sameMessage) return true;

  const crossesFetchBoundary =
    (lastToastMeta.source === "fetch-tracker" && source !== "fetch-tracker") ||
    (source === "fetch-tracker" && lastToastMeta.source !== "fetch-tracker");

  if (!crossesFetchBoundary) return false;

  return (
    REQUEST_FEEDBACK_PATTERN.test(lastToastMeta.message) &&
    REQUEST_FEEDBACK_PATTERN.test(message)
  );
};

const rememberToast = ({ type, message, source }) => {
  lastToastMeta = {
    type,
    message,
    source,
    at: Date.now(),
  };
};

const emitToast = (type, message, options, emitter) => {
  const rawMessage =
    typeof message === "string" ? message : String(message ?? "");
  const msg = enrichToastMessage(type, rawMessage);
  const source = resolveSource(options);

  if (shouldSuppressDuplicateToast({ type, message: msg, source })) {
    return null;
  }

  const id = emitter(msg, mapOptions(options));
  rememberToast({ type, message: msg, source });
  return id;
};

const toast = (message, options) =>
  emitToast("default", message, options, (msg, mappedOptions) =>
    toastify(msg, mappedOptions)
  );

toast.success = (message, options) =>
  emitToast("success", message, options, (msg, mappedOptions) =>
    toastify.success(msg, mappedOptions)
  );

toast.error = (messageOrError, fallbackOrOptions, maybeOptions) => {
  const hasFallback = typeof fallbackOrOptions === "string";
  const fallback = hasFallback ? fallbackOrOptions : undefined;
  const options = hasFallback ? maybeOptions : fallbackOrOptions;
  const msg = resolveErrorMessage(messageOrError, fallback);
  rememberApiError(msg);

  return emitToast("error", msg, options, (resolvedMsg, mappedOptions) =>
    toastify.error(resolvedMsg, mappedOptions)
  );
};

toast.info = (message, options) =>
  emitToast("info", message, options, (msg, mappedOptions) =>
    toastify.info(msg, mappedOptions)
  );

toast.warning = (message, options) =>
  emitToast("warning", message, options, (msg, mappedOptions) =>
    toastify.warning(msg, mappedOptions)
  );

toast.warn = toast.warning;

toast.dismiss = (id) => toastify.dismiss(id);
toast.remove = (id) => toastify.dismiss(id);
toast.isActive = (id) => toastify.isActive(id);

export const Toaster = ({
  position = "top-right",
  toastOptions = {},
  limit = 3,
  newestOnTop = false,
  reverseOrder = false,
  containerStyle,
}) => (
  <ToastContainer
    position={position}
    newestOnTop={reverseOrder ? false : newestOnTop}
    autoClose={toastOptions?.duration ?? 3000}
    toastStyle={toastOptions?.style}
    style={containerStyle}
    hideProgressBar={false}
    closeOnClick
    draggable
    pauseOnHover={toastOptions?.pauseOnHover ?? true}
    theme="colored"
    limit={limit}
  />
);

export { toast };
export default toast;
