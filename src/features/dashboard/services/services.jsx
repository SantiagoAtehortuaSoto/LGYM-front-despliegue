import { API_BASE_URL } from "../hooks/apiConfig";

const API_URL = API_BASE_URL;

/**
 * Función genérica para hacer solicitudes a la API de servicios.
 * Detecta cuando el backend devuelve HTML en lugar de JSON.
 * `headers` y `method` se pasan explícitamente en cada función.
 */
async function apiRequest(endpoint = "", method = "GET", body = null, headers = {}) {
  try {
    const token = localStorage.getItem("token");
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(
        `La API devolvió HTML en lugar de JSON para ${API_URL}${endpoint}\n\nRespuesta:\n${text.substring(0, 300)}...`
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Error en la solicitud al servidor");
    }

    return data;
  } catch (error) {
    console.error("Error en la API:", error);
    throw error;
  }
}

/**
 * Obtener todos los servicios
 */
export async function obtenerServicios() {
  return apiRequest("/servicios", "GET");
}

/**
 * Obtener un servicio por ID
 */
export async function obtenerServicioPorId(id) {
  return apiRequest(`/servicios/${id}`, "GET");
}

/**
 * Crear un nuevo servicio
 */
export async function crearServicio(servicio) {
  return apiRequest("/servicios", "POST", servicio);
}

/**
 * Actualizar un servicio existente
 */
export async function actualizarServicio(id, servicio) {
  return apiRequest(`/servicios/${id}`, "PUT", servicio);
}

/**
 * Eliminar un servicio
 */
export async function eliminarServicio(id) {
  return apiRequest(`/servicios/${id}`, "DELETE");
}
