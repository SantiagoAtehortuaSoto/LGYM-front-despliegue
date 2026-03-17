// configApi.js
import { apiRequest } from "../../../dashboard/hooks/Usuarios_API/API_Usuarios.jsx";
import { getRole } from "../../../dashboard/hooks/Acceder_API/authService.jsx";
import { buildUrl } from "../apiConfig";

const URL_API_CLIENTE_CONFIG = buildUrl("/usuarios/me");

function normalizeUserId(candidate) {
  if (candidate == null) return null;

  // If a full user object is provided, extract a usable identifier
  if (typeof candidate === "object") {
    return (
      candidate.id ??
      candidate.userId ??
      candidate.usuario_id ??
      candidate.usuarioId ??
      candidate.user_id ??
      null
    );
  }

  // If we receive a JSON string (typical when read from localStorage), parse it
  if (typeof candidate === "string" && candidate.trim().startsWith("{")) {
    try {
      return normalizeUserId(JSON.parse(candidate));
    } catch {
      // fall through and return the raw candidate
    }
  }

  return candidate;
}

function getCurrentUserId() {
  const storedUser = localStorage.getItem("user");
  return normalizeUserId(storedUser);
}

function shouldUseSelfEndpoint(userId) {
  const role = typeof getRole === "function" ? getRole() : "";
  const normalizedRole = (role || "").toLowerCase();
  if (!userId) return true;
  if (String(userId).toLowerCase() === "me") return true;
  return normalizedRole === "usuario" || normalizedRole === "cliente";
}

function buildClientHeaders() {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseClientResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function unwrapUserPayload(data) {
  if (data && typeof data === "object") {
    const candidates = [data.data, data.usuario, data.user, data.usuario_data];
    for (const candidate of candidates) {
      if (candidate && typeof candidate === "object") return candidate;
    }
  }
  return data;
}

async function requestSelfUserConfig(method = "GET", body) {
  const options = {
    method,
    headers: buildClientHeaders(),
  };

  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(URL_API_CLIENTE_CONFIG, options);
  const data = await parseClientResponse(res);

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.msg ||
      data?.error ||
      `Error ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  return unwrapUserPayload(data);
}

/**
 * GET /usuarios/:id
 */
export async function getUserConfig(userId) {
  const id = normalizeUserId(userId) ?? getCurrentUserId();

  if (shouldUseSelfEndpoint(id)) {
    return requestSelfUserConfig("GET");
  }

  if (!id) {
    throw new Error("No se encontro el ID del usuario autenticado.");
  }

  const data = await apiRequest(`/usuarios/${id}`, "GET");
  return unwrapUserPayload(data);
}

export async function updateUserConfig(userId, config) {
  const id = normalizeUserId(userId) ?? getCurrentUserId();

  const body = {
    email: config.email,
    telefono: config.telefono,
    c_emergencia: config.c_emergencia,
    n_emergencia: config.n_emergencia,
    password: config.password,
    enfermedades: config.enfermedades,
    nombre_usuario: config.nombre_usuario,
    apellido_usuario: config.apellido_usuario,
    tipo_documento: config.tipo_documento,
    documento: config.documento,
    fecha_nacimiento: config.fecha_nacimiento,
    genero: config.genero,
  };

  // Remove empty values so we don't overwrite data unintentionally
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined || body[key] === null || body[key] === "") {
      delete body[key];
    }
  });

  if (shouldUseSelfEndpoint(id)) {
    return requestSelfUserConfig("PUT", body);
  }

  if (!id) {
    throw new Error("No se encontro el ID del usuario autenticado.");
  }

  const data = await apiRequest(`/usuarios/${id}`, "PUT", body);
  return unwrapUserPayload(data);
}
