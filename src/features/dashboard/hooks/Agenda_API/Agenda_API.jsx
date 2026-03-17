import { API_BASE_URL } from "../apiConfig";

// agenda_API.js
const API_URL = API_BASE_URL;

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function normalizeRole(raw) {
  if (raw == null) return "";

  if (typeof raw === "object") {
    const nested = raw.nombre || raw.name || raw.rol || raw.role || "";
    return normalizeRole(nested);
  }

  const value = String(raw).trim().toLowerCase();
  if (!value) return "";

  if (
    /(^|_|-|\s)admin(istrador)?($|_|-|\s)/.test(value) ||
    /role_admin|admin_role/.test(value) ||
    value === "1" ||
    value === "99"
  ) {
    return "admin";
  }

  if (
    /(emplead|instructor|staff)/.test(value) ||
    /role_empleado|empleado_role/.test(value) ||
    value === "2"
  ) {
    return "empleado";
  }

  if (
    /(user|usuario|cliente|beneficiario|member|miembro)/.test(value) ||
    value === "3" ||
    value === "6"
  ) {
    return "usuario";
  }

  return "";
}

function extractRole(user) {
  if (!user || typeof user !== "object") return "";

  const candidates = [
    user.role,
    user.rol,
    user.perfil,
    user.tipo,
    user.tipo_usuario,
    user.tipoUsuario,
    user.roles_usuarios,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const normalized = normalizeRole(item);
        if (normalized) return normalized;
      }
      continue;
    }

    const normalized = normalizeRole(candidate);
    if (normalized) return normalized;
  }

  return "";
}

function shouldUseMyAgendaEndpoint(onlyMine) {
  if (typeof onlyMine === "boolean") return onlyMine;
  const role = extractRole(readUser());
  return role === "usuario";
}

// Helper para parsear JSON de forma segura
async function parseJSON(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || "Error parsing response" };
  }
}

// Handler genérico de peticiones API
async function apiRequest(
  endpoint = "/agenda",
  method = "GET",
  body = null,
  headers = {}
) {
  try {
    const token = localStorage.getItem("token");
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const responseData = await parseJSON(response);

    if (!response.ok) {
      console.error('Error response from server:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        errorData: responseData
      });
      
      let errorMessage = `Error ${response.status}: `;
      
      if (response.status === 400) {
        errorMessage += 'Solicitud incorrecta. ';
        if (responseData.errors) {
          if (Array.isArray(responseData.errors)) {
            errorMessage += responseData.errors
              .map((item) => item?.msg || item?.message || JSON.stringify(item))
              .join("; ");
          } else {
            errorMessage += Object.entries(responseData.errors)
              .map(([field, messages]) => {
                const detail = Array.isArray(messages)
                  ? messages.map((msg) => (typeof msg === "string" ? msg : msg?.msg || msg?.message)).join(", ")
                  : messages;
                return `${field}: ${detail}`;
              })
              .join("; ");
          }
        } else {
          errorMessage += responseData.message || responseData.msg || "Datos inválidos";
        }
      } else {
        errorMessage += responseData?.message || responseData?.msg || response.statusText;
      }
      
      const error = new Error(errorMessage);
      error.response = { status: response.status, data: responseData };
      throw error;
    }

    return responseData;
  } catch (error) {
    console.error('Error in apiRequest:', error.message);
    if (error.response) {
      console.error('Response error details:', error.response);
    }
    throw error;
  }
}

// CRUD de Agenda
export async function getAgenda(options = {}) {
  const onlyMine =
    typeof options === "boolean" ? options : options?.onlyMine;
  const endpoint = shouldUseMyAgendaEndpoint(onlyMine)
    ? "/agenda/mias"
    : "/agenda";
  return apiRequest(endpoint, "GET");
}

export async function getAgendaById(id) {
  return apiRequest(`/agenda/${id}`, "GET");
}

export async function createAgenda(agenda) {
  return apiRequest("/agenda", "POST", agenda);
}

export async function updateAgenda(id, agenda) {
  return apiRequest(`/agenda/${id}`, "PATCH", agenda);
}

export async function deleteAgenda(id) {
  return apiRequest(`/agenda/${id}`, "DELETE");
}
