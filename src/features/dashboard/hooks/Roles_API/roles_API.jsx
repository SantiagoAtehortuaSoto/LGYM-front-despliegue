// Services_Roles.jsx
// Mantén el mismo patrón que usas en otros módulos

import { API_BASE_URL } from "../apiConfig";

const API_URL = API_BASE_URL;
const PROTECTED_ROLE_ID = 33;

// Helper para parsear JSON de forma segura
async function parseJSON(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error("Parse error:", e, "Text:", text);
    return { message: text || "Error parsing response" };
  }
}

// Handler genérico para peticiones
async function apiRequest(
  endpoint = "/rol",
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
        Authorization: token ? `Bearer ${token}` : undefined,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    const response = await fetch(`${API_URL}${endpoint}`, options);

    if (!response.ok) {
      const errorData = await parseJSON(response);
      const errorMessage =
        errorData?.message ||
        errorData?.msg ||
        `Error: ${response.status} ${response.statusText}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    const data = await parseJSON(response);
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// Funciones específicas para Roles
export async function obtenerRoles() {
  return apiRequest("/rol", "GET");
}

export async function obtenerRolPorId(id) {
  return apiRequest(`/rol/${id}`, "GET");
}

// Crear rol. Payload mínimo: { nombre_rol, id_estado }
// Si quieres enviar asociaciones directamente, adapta el backend; aquí seguimos tu flujo crear -> asignar
export async function crearRol({ nombre_rol, id_estado = 1 }) {
  return apiRequest("/rol", "POST", { nombre_rol, id_estado });
}

export async function actualizarRol(id, { nombre_rol, id_estado }) {
  const body = {};
  if (nombre_rol !== undefined) body.nombre_rol = nombre_rol;
  if (id_estado !== undefined) body.id_estado = id_estado;
  return apiRequest(`/rol/${id}`, "PUT", body);
}

export async function eliminarRol(id) {
  if (Number(id) === PROTECTED_ROLE_ID) {
    throw new Error(`El rol ${PROTECTED_ROLE_ID} está protegido y no se puede eliminar`);
  }
  return apiRequest(`/rol/${id}`, "DELETE");
}

// Asignar asociaciones [{ id_permiso, id_privilegio }, ...]
export async function asignarPermisosYPrivilegios(id, asociaciones = []) {
  return apiRequest(`/rol/${id}/asignar`, "POST", { asociaciones });
}

// (Opcional) funciones para obtener permisos y privilegios para los formularios
export async function obtenerPermisos() {
  return apiRequest("/permisos", "GET");
}

export async function obtenerPrivilegios() {
  return apiRequest("/privilegios", "GET");
}
