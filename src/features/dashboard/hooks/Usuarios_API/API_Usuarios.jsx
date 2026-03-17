import { API_BASE_URL } from "../apiConfig";
import { buildEndpointWithQuery } from "../../../../shared/utils/pagination";

// usuariosAPI.jsx
const API_URL = API_BASE_URL;

// Helper to get auth token from localStorage
function getAuthToken() {
  return localStorage.getItem("token");
}

// Helper to safely parse JSON
async function parseJSON(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error("Parse error:", e);
    return { message: text || "Error parsing response" };
  }
}

// Generic API request handler
export async function apiRequest(
  endpoint = "/usuarios",
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

    if (!response.ok) {
      const errorData = await parseJSON(response);
      let errorMessage =
        errorData?.message ||
        errorData?.msg ||
        `Error: ${response.status} ${response.statusText}`;

      if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        errorMessage = "Sesión expirada. Por favor, inicia sesión nuevamente.";
      } else if (response.status === 403) {
        errorMessage = "No tienes permisos para realizar esta acción";
      } else if (response.status === 404) {
        errorMessage = "Recurso no encontrado";
      } else if (response.status >= 500) {
        errorMessage =
          "Error del servidor. Por favor, inténtalo de nuevo más tarde.";
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = errorData;
      error.endpoint = endpoint;
      error.response = {
        status: response.status,
        data: errorData,
      };
      throw error;
    }

    const data = await parseJSON(response);
    return data;
  } catch (error) {
    throw error;
  }
}

// CRUD functions
export async function obtenerUsuarios(options = {}) {
  try {
    const query =
      options.query && typeof options.query === "object" ? options.query : options;
    const endpoint = buildEndpointWithQuery("/usuarios", query);
    const data = await apiRequest(endpoint, "GET");
    return data;
  } catch (error) {
    throw error;
  }
}

async function obtenerUsuariosPorEndpoint(endpointBase, options = {}) {
  try {
    const query =
      options.query && typeof options.query === "object" ? options.query : options;
    const endpoint = buildEndpointWithQuery(endpointBase, query);
    return await apiRequest(endpoint, "GET");
  } catch (error) {
    throw error;
  }
}

export async function obtenerUsuariosClientes(options = {}) {
  return obtenerUsuariosPorEndpoint("/usuarios/clientes", options);
}

export async function obtenerUsuariosNoClientes(options = {}) {
  return obtenerUsuariosPorEndpoint("/usuarios/no-clientes", options);
}

export async function obtenerUsuarioPorId(id) {
  return apiRequest(`/usuarios/${id}`, "GET");
}

export async function crearUsuario(usuario) {
  return apiRequest("/usuarios", "POST", usuario);
}

export async function actualizarUsuario(id, usuario) {
  return apiRequest(`/usuarios/${id}`, "PUT", usuario);
}

export async function eliminarUsuario(id) {
  return apiRequest(`/usuarios/${id}`, "DELETE");
}

// Nueva función específica para actualizar solo el estado
export async function actualizarEstadoUsuario(id, nuevoEstado) {
  return apiRequest(`/usuarios/${id}`, "PUT", { id_estado: nuevoEstado });
}

export async function obtenerRolesUsuarios(options = {}) {
  try {
    const query =
      options.query && typeof options.query === "object" ? options.query : options;
    const endpoint = buildEndpointWithQuery("/roles_usuarios", query);
    const data = await apiRequest(endpoint, "GET");
    return data;
  } catch (error) {
    throw error;
  }
}
