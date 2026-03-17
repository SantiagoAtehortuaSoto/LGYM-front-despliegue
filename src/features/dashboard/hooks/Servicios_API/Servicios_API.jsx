// services.jsx

import { API_BASE_URL } from "../apiConfig";
import { buildEndpointWithQuery } from "../../../../shared/utils/pagination";

const API_URL = API_BASE_URL;

// Helper to safely parse JSON
async function parseJSON(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error("Parse error:", e, "Text:", text);
    return { message: text || "Error parsing response" };
  }
}

// Generic API request handler
async function apiRequest(
  endpoint = "/servicios",
  method = "GET",
  body = null,
  requestOptions = {},
) {
  try {
    const token = localStorage.getItem("token");
    const { headers = {}, ...restOptions } = requestOptions || {};
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true", // ✅ CRÍTICO para ngrok
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined, // ✅ RESTAURADO
      ...restOptions,
    };

    const response = await fetch(`${API_URL}${endpoint}`, options);

    // Primero verificamos si la respuesta es exitosa
    if (!response.ok) {
      const errorData = await parseJSON(response);
      const errorMessage =
        errorData?.message ||
        errorData?.msg ||
        `Error: ${response.status} ${response.statusText}`;
      throw new Error(errorMessage);
    }

    // Si la respuesta es exitosa, parseamos y devolvemos los datos
    const data = await parseJSON(response);
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// CRUD functions
export async function obtenerServicios(options = {}) {
  const query =
    options?.query && typeof options.query === "object" ? options.query : {};
  const endpoint = buildEndpointWithQuery("/servicios", query);
  return apiRequest(endpoint, "GET", null, options);
}

export async function obtenerServicioPorId(id) {
  return apiRequest(`/servicios/${id}`, "GET");
}

export async function crearServicio(servicio) {
  const tipoTexto = String(
    servicio?.tipo_servicio ?? servicio?.tipo ?? ""
  ).trim();
  const tipoNorm = tipoTexto.toLowerCase();
  const idTipoServicio =
    servicio?.id_tipo_servicio ??
    (tipoNorm === "acceso" ? 1 : tipoNorm === "actividad" ? 2 : undefined);

  const payload = {
    ...servicio,
    ...(tipoTexto ? { tipo_servicio: tipoTexto } : {}),
    ...(idTipoServicio ? { id_tipo_servicio: Number(idTipoServicio) } : {}),
  };

  return apiRequest("/servicios", "POST", payload);
}

export async function actualizarServicio(id, servicio) {
  const tipoTexto = String(
    servicio?.tipo_servicio ?? servicio?.tipo ?? ""
  ).trim();
  const tipoNorm = tipoTexto.toLowerCase();
  const idTipoServicio =
    servicio?.id_tipo_servicio ??
    (tipoNorm === "acceso" ? 1 : tipoNorm === "actividad" ? 2 : undefined);

  const payload = {
    ...servicio,
    ...(tipoTexto ? { tipo_servicio: tipoTexto } : {}),
    ...(idTipoServicio ? { id_tipo_servicio: Number(idTipoServicio) } : {}),
  };

  return apiRequest(`/servicios/${id}`, "PUT", payload);
}

export async function eliminarServicio(id) {
  return apiRequest(`/servicios/${id}`, "DELETE");
}
