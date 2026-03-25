import { getApiErrorMessage, rememberApiError } from "./apiErrorMessage";
import { toast } from "./toastAdapter";

const INSTALL_KEY = "__LGYM_FETCH_TRACKER_INSTALLED__";
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const GENERIC_REQUEST_ERROR = "Algo salió mal. Intenta de nuevo o revisa si hubo un error.";
const TOAST_DEDUP_WINDOW_MS = 1800;
const IGNORED_URL_SEGMENTS = new Set([
  "api",
  "v1",
  "v2",
  "v3",
  "admin",
]);

const ENTITY_LABELS = {
  agenda: "cita",
  asistencias: "asistencia",
  "asistencia clientes": "asistencia de clientes",
  beneficiarios: "beneficiario",
  clientes: "cliente",
  citas: "cita",
  compras: "pedido",
  empleados: "empleado",
  login: "inicio de sesión",
  logout: "cierre de sesión",
  membresias: "membresía",
  pedidos: "pedido",
  productos: "producto",
  proveedores: "proveedor",
  relaciones: "relación",
  roles: "rol",
  seguimientos: "seguimiento",
  servicios: "servicio",
  usuarios: "usuario",
  ventas: "venta",
};

let lastGlobalToastMeta = {
  type: "",
  message: "",
  at: 0,
};

const normalizeMethod = (value = "GET") =>
  String(value || "GET").trim().toUpperCase();

const resolveRequestInfo = (args = []) => {
  const [input, init = {}] = args;

  const isRequestObject =
    typeof Request !== "undefined" && input instanceof Request;
  const method = normalizeMethod(
    init?.method || (isRequestObject ? input.method : "GET")
  );

  const url =
    typeof input === "string"
      ? input
      : isRequestObject
      ? input.url
      : input && typeof input === "object" && "url" in input
      ? String(input.url || "")
      : "";

  const headers = new Headers(
    init?.headers || (isRequestObject ? input.headers : undefined)
  );

  return { method, url, headers };
};

const normalizeEntitySegment = (segment = "") =>
  decodeURIComponent(String(segment || ""))
    .replace(/\?.*$/, "")
    .replace(/#.*/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .toLowerCase();

const resolveEntityLabel = (url = "") => {
  const urlText = String(url || "").trim();
  if (!urlText) return "";

  let pathname = "";

  try {
    const parsed = new URL(
      urlText,
      typeof window !== "undefined" ? window.location.origin : "http://localhost"
    );
    pathname = parsed.pathname || "";
  } catch {
    pathname = urlText.split("?")[0] || "";
  }

  const segments = pathname
    .split("/")
    .map(normalizeEntitySegment)
    .filter(Boolean)
    .filter((segment) => !/^\d+$/.test(segment))
    .filter((segment) => !IGNORED_URL_SEGMENTS.has(segment));

  if (!segments.length) return "";

  const statusIndex = segments.findIndex(
    (segment) => segment === "estado" || segment === "status"
  );

  const rawEntity =
    statusIndex > 0 ? segments[statusIndex - 1] : segments[segments.length - 1];

  return ENTITY_LABELS[rawEntity] || rawEntity;
};

const resolveActionMeta = ({ method, url }) => {
  const normalizedUrl = String(url || "").toLowerCase();
  const isStatusUpdate = /estado|status/.test(normalizedUrl);
  const isLoginAction = /(^|\/)login(\/|$|\?)/.test(normalizedUrl);
  const isLogoutAction = /(^|\/)logout(\/|$|\?)/.test(normalizedUrl);

  if (isLoginAction && method === "POST") {
    return {
      kind: "login",
      successLabel: "Iniciar sesión",
      errorVerb: "iniciar sesión",
    };
  }
  if (isLogoutAction && ["POST", "DELETE"].includes(method)) {
    return {
      kind: "logout",
      successLabel: "Cerrar sesión",
      errorVerb: "cerrar sesión",
    };
  }

  if (isStatusUpdate && ["POST", "PUT", "PATCH"].includes(method)) {
    return {
      kind: "status",
      successLabel: "Cambiar estado",
      errorVerb: "cambiar estado",
    };
  }
  if (method === "POST") {
    return {
      kind: "create",
      successLabel: "Crear",
      errorVerb: "crear",
    };
  }
  if (method === "PUT" || method === "PATCH") {
    return {
      kind: "update",
      successLabel: "Editar",
      errorVerb: "editar",
    };
  }
  if (method === "DELETE") {
    return {
      kind: "delete",
      successLabel: "Borrar",
      errorVerb: "borrar",
    };
  }
  return {
    kind: "generic",
    successLabel: "Acción",
    errorVerb: "procesar la acción",
  };
};

const shouldNotifyRequest = ({ method, headers }) => {
  if (!MUTATION_METHODS.has(method)) return false;
  const enableGlobalToast = String(
    headers?.get("x-enable-global-toast") || ""
  ).toLowerCase();
  return ["1", "true", "yes", "on"].includes(enableGlobalToast);
};

const buildSuccessMessage = (requestInfo) => {
  const action = resolveActionMeta(requestInfo);
  const entity = resolveEntityLabel(requestInfo?.url);

  if (action.kind === "login") {
    return "Inicio de sesión exitoso. Tus credenciales fueron validadas y tu sesión ya está activa.";
  }

  if (action.kind === "logout") {
    return "Cierre de sesión exitoso. Tu sesión se cerró correctamente.";
  }

  if (action.kind === "status") {
    return entity
      ? `Cambio de estado exitoso en ${entity}. El nuevo estado ya quedó guardado.`
      : "Cambio de estado exitoso. El nuevo estado ya quedó guardado.";
  }

  if (action.kind === "create") {
    return entity
      ? `Creación de ${entity} completada. El registro se guardó correctamente.`
      : "Creación completada. El registro se guardó correctamente.";
  }

  if (action.kind === "update") {
    return entity
      ? `Actualización de ${entity} completada. Los cambios quedaron guardados.`
      : "Actualización completada. Los cambios quedaron guardados.";
  }

  if (action.kind === "delete") {
    return entity
      ? `Eliminación de ${entity} completada. El registro ya no aparece en el sistema.`
      : "Eliminación completada. El registro ya no aparece en el sistema.";
  }

  return entity
    ? `${action.successLabel} de ${entity} completada.`
    : `${action.successLabel} completada.`;
};

const buildErrorPrefix = (requestInfo) => {
  const action = resolveActionMeta(requestInfo);
  const entity = resolveEntityLabel(requestInfo?.url);

  if (action.kind === "login") {
    return "Inicio de sesión fallido. No se pudo validar tu correo o contraseña y tu sesión no se abrió.";
  }

  if (action.kind === "logout") {
    return "No se pudo cerrar la sesión. Tu sesión continúa activa.";
  }

  if (action.kind === "status") {
    return entity
      ? `No se pudo cambiar el estado de ${entity}. El valor anterior se mantiene.`
      : "No se pudo cambiar el estado. El valor anterior se mantiene.";
  }

  if (action.kind === "create") {
    return entity
      ? `No se pudo crear ${entity}. La acción no se completó y no se guardaron nuevos datos.`
      : "No se pudo completar la creación. No se guardaron nuevos datos.";
  }

  if (action.kind === "update") {
    return entity
      ? `No se pudo actualizar ${entity}. Los cambios no fueron aplicados.`
      : "No se pudo completar la actualización. Los cambios no fueron aplicados.";
  }

  if (action.kind === "delete") {
    return entity
      ? `No se pudo eliminar ${entity}. El registro se mantiene sin cambios.`
      : "No se pudo completar la eliminación. El registro se mantiene sin cambios.";
  }

  if (!entity) return GENERIC_REQUEST_ERROR;
  return `Algo salió mal al ${action.errorVerb} ${entity}. Intenta de nuevo o revisa si hubo un error.`;
};

const buildErrorMessage = (errorLike, response = null, requestInfo = null) => {
  const basePrefix = buildErrorPrefix(requestInfo);
  const detail = getApiErrorMessage(errorLike, "");
  if (detail) return `${basePrefix}: ${detail}`;

  if (response?.status) {
    return `${basePrefix} (Error ${response.status})`;
  }

  return basePrefix;
};

const canShowGlobalToast = (type, message) => {
  const now = Date.now();
  const withinWindow = now - lastGlobalToastMeta.at < TOAST_DEDUP_WINDOW_MS;
  if (!withinWindow) return true;

  if (type === "error" && lastGlobalToastMeta.type === "success") {
    return true;
  }

  const sameType = lastGlobalToastMeta.type === type;
  const sameMessage = lastGlobalToastMeta.message === message;

  return !(sameType && sameMessage);
};

const markGlobalToast = (type, message) => {
  lastGlobalToastMeta = {
    type,
    message,
    at: Date.now(),
  };
};

const emitGlobalToast = (type, message) => {
  if (!canShowGlobalToast(type, message)) return;

  if (type === "success") {
    toast.success(message, { _lgymSource: "fetch-tracker" });
  } else {
    toast.error(message, { _lgymSource: "fetch-tracker" });
  }

  markGlobalToast(type, message);
};

const safeParseErrorBody = async (response) => {
  try {
    const clone = response.clone();
    const contentType = clone.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await clone.json();
    }
    const text = await clone.text();
    return text ? { message: text } : {};
  } catch {
    return {};
  }
};

export const installFetchErrorTracker = () => {
  if (typeof window === "undefined") return;
  if (window[INSTALL_KEY]) return;
  if (typeof window.fetch !== "function") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const requestInfo = resolveRequestInfo(args);
    const shouldNotify = shouldNotifyRequest(requestInfo);

    let response;
    try {
      response = await originalFetch(...args);
    } catch (error) {
      if (shouldNotify) {
        const message = buildErrorMessage(error, null, requestInfo);
        emitGlobalToast("error", message);
      }
      rememberApiError(error);
      throw error;
    }

    if (!response.ok) {
      const body = await safeParseErrorBody(response);
      const errorLike = {
        response: {
          data: body,
          status: response.status,
          statusText: response.statusText,
        },
      };

      const detailed = getApiErrorMessage(errorLike, "");
      if (detailed) {
        rememberApiError(detailed);
      } else {
        rememberApiError(errorLike);
      }

      if (shouldNotify) {
        emitGlobalToast(
          "error",
          buildErrorMessage(errorLike, response, requestInfo)
        );
      }

      return response;
    }

    if (shouldNotify) {
      emitGlobalToast("success", buildSuccessMessage(requestInfo));
    }

    return response;
  };

  window[INSTALL_KEY] = true;
};
