import { API_BASE_URL } from "../apiConfig";
import { buildEndpointWithQuery } from "../../../../shared/utils/pagination";

const API_URL = API_BASE_URL;

function getAuthToken() {
  return localStorage.getItem("token");
}

async function parseJSON(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error("Parse error:", e);
    return { message: text || "Error parsing response" };
  }
}

function toMessage(value) {
  if (!value && value !== 0) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => toMessage(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return (
      toMessage(value.msg) ||
      toMessage(value.message) ||
      toMessage(value.error) ||
      toMessage(value.detail)
    );
  }
  return "";
}

function extractErrorMessage(responseData) {
  if (!responseData) return "";

  const errors = responseData.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const messages = errors
      .map((item) => toMessage(item))
      .filter(Boolean);
    if (messages.length > 0) return messages.join("\n");
  }

  if (errors && typeof errors === "object") {
    const messages = Object.entries(errors).flatMap(([field, value]) => {
      if (Array.isArray(value)) {
        return value
          .map((entry) => toMessage(entry))
          .filter(Boolean)
          .map((entry) => `${field}: ${entry}`);
      }
      const msg = toMessage(value);
      return msg ? [`${field}: ${msg}`] : [];
    });
    if (messages.length > 0) return messages.join("\n");
  }

  return (
    toMessage(responseData.message) ||
    toMessage(responseData.msg) ||
    toMessage(responseData.error) ||
    toMessage(responseData.detail) ||
    ""
  );
}

export async function apiRequest(
  endpoint = "/empleados",
  method = "GET",
  body = null,
  headers = {},
) {
  try {
    const token = getAuthToken();

    const defaultHeaders = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
    };

    if (token) {
      defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    const options = {
      method,
      headers: {
        ...defaultHeaders,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const responseData = await parseJSON(response);

    if (!response.ok) {
      console.error('[API Error]', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        response: responseData
      });

      let errorMessage = extractErrorMessage(responseData) || 'Error en la solicitud';

      if (response.status === 400 && !errorMessage) {
        errorMessage = 'Datos inválidos. Por favor, verifica la información ingresada.';
      } else if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (response.status === 403 && !errorMessage) {
        errorMessage = "No tienes permisos para realizar esta acción";
      } else if (response.status === 404 && !errorMessage) {
        errorMessage = "Recurso no encontrado";
      } else if (response.status >= 500 && !errorMessage) {
        errorMessage = "Error del servidor. Por favor, inténtalo de nuevo más tarde.";
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.statusText = response.statusText;
      error.url = response.url;
      error.data = responseData;
      error.response = {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        data: responseData,
      };
      error.responseData = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    throw error;
  }
}

export async function obtenerEmpleados(options = {}) {
  try {
    const query =
      options.query && typeof options.query === "object" ? options.query : options;
    const endpoint = buildEndpointWithQuery("/empleados", query);
    const data = await apiRequest(endpoint, "GET");
    return data;
  } catch (error) {
    throw error;
  }
}

export async function obtenerEmpleadoPorId(id) {
  return apiRequest(`/empleados/${id}`, "GET");
}

export async function crearEmpleado(empleado) {
  return apiRequest("/empleados", "POST", empleado);
}

export async function actualizarEmpleado(id, empleado) {
  return apiRequest(`/empleados/${id}`, "PUT", empleado);
}

export async function eliminarEmpleado(id) {
  return apiRequest(`/empleados/${id}`, "DELETE");
}
