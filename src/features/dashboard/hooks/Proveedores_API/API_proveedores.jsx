import { buildUrl } from "../apiConfig";
import {
  buildEndpointWithQuery,
  mapPaginatedCollectionResponse,
} from "../../../../shared/utils/pagination";

const API_URL = buildUrl("/proveedores");
const NETWORK_ERROR_HINT =
  "Error de red/CORS. En desarrollo usa proxy de Vite y reinicia el servidor (`npm run dev`).";

const mapProveedorFromApi = (proveedor = {}) => ({
  id_proveedor: proveedor.id_proveedor,
  nit_proveedor: proveedor.nit_proveedor,
  nombre_proveedor: proveedor.nombre_proveedor,
  telefono_proveedor: proveedor.telefono_proveedor,
  nombre_contacto: proveedor.nombre_contacto,
  email_proveedor: proveedor.email_proveedor,
  direccion_proveedor: proveedor.direccion_proveedor,
  ciudad_proveedor: proveedor.ciudad_proveedor,
  fecha_registro: proveedor.fecha_registro,
  id_estado: proveedor.id_estado,
  estado: proveedor.id_estado === 1 ? "Activo" : "Inactivo",
});

// Función para manejar la conversión segura del JSON
async function parseJSON(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Error parsing JSON: ${error.message}. Response text: ${text}`);
  }
}

// Función para obtener headers con autenticación
function getHeaders(extraHeaders = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// ----------------------
//  PETICIONES A LA API
// ----------------------

// Obtener todos los proveedores
export async function getProveedores(options = {}) {
  const query =
    options?.query && typeof options.query === "object" ? options.query : {};
  const preserveResponseShape = Object.keys(query).length > 0;

  try {
    const response = await fetch(buildEndpointWithQuery(API_URL, query), {
      headers: getHeaders(options?.headers || {})
    });
    if (!response.ok) throw new Error(`Error al obtener proveedores: ${response.status} ${response.statusText}`);
    const data = await parseJSON(response);
    return mapPaginatedCollectionResponse(data, mapProveedorFromApi, {
      preferredKeys: ["proveedores", "data"],
      preserveResponseShape,
    });
  } catch (error) {
    const msg = String(error?.message || "");
    console.error(
      "Error fetching proveedores:",
      /failed to fetch|networkerror|network error/i.test(msg)
        ? `${msg}. ${NETWORK_ERROR_HINT}`
        : msg
    );
    return preserveResponseShape ? { data: [] } : [];
  }
}

// Crear un nuevo proveedor
export async function createProveedor(proveedor) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(proveedor)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Create error response:", errorText);
      throw new Error(`Error al crear proveedor: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await parseJSON(response);
    return mapProveedorFromApi(data);
  } catch (error) {
    console.error("Error creating proveedor:", error.message);
    throw error;
  }
}

// Actualizar un proveedor por ID
export async function updateProveedor(id, proveedor) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(proveedor)
    });
    if (!response.ok) throw new Error("Error al actualizar proveedor");
    const data = await parseJSON(response);
    return mapProveedorFromApi(data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Eliminar un proveedor por ID
export async function deleteProveedor(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al eliminar proveedor: ${response.status} ${response.statusText} - ${errorText}`);
    }
    // DELETE requests may not return JSON, so handle accordingly
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await parseJSON(response);
    } else {
      return { success: true };
    }
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}
