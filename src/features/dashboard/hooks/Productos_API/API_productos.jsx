import { buildUrl } from "../apiConfig";
import {
  buildEndpointWithQuery,
  mapPaginatedCollectionResponse,
} from "../../../../shared/utils/pagination";

const API_URL = buildUrl("/productos");

const mapProductoFromApi = (producto = {}) => {
  const precioVenta = parseFloat(producto.precio_venta_producto);
  const precioCompra = producto.precio_compra
    ? parseFloat(producto.precio_compra)
    : null;

  return {
    id: producto.id_productos,
    id_productos: producto.id_productos,
    nombre: producto.nombre_producto,
    nombre_producto: producto.nombre_producto,
    descripcion: producto.descripcion_producto,
    precioCompra,
    precioVenta,
    precio: precioVenta,
    costo: precioCompra ?? precioVenta,
    stock: producto.stock,
    categoria: producto.categoria,
    estado: producto.id_estados == 1 ? "Activo" : "Inactivo",
    codigo: producto.codigo || null,
    imagen_url: producto.imagen_url,
  };
};

// Función para manejar la conversión segura del JSON
async function parseJSON(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Error parsing JSON: ${error.message}. Response text: ${text}`
    );
  }
}

function buildApiError(response, errorData = {}) {
  const error = new Error(
    errorData?.message || errorData?.msg || JSON.stringify(errorData)
  );
  error.status = response?.status;
  error.data = errorData;
  return error;
}

// Función para obtener headers con autenticación
function getHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...extraHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

// ----------------------
//  PETICIONES A LA API
// ----------------------

// Obtener todos los productos
export async function getProductos(options = {}) {
  const query =
    options?.query && typeof options.query === "object" ? options.query : {};
  const preserveResponseShape = Object.keys(query).length > 0;

  try {
    const response = await fetch(buildEndpointWithQuery(API_URL, query), {
      headers: getHeaders(options?.headers || {}),
    });
    if (!response.ok) {
      const errorData = await parseJSON(response);
      throw new Error(errorData.message || JSON.stringify(errorData));
    }
    const data = await parseJSON(response);
    return mapPaginatedCollectionResponse(data, mapProductoFromApi, {
      preferredKeys: ["productos", "data"],
      preserveResponseShape,
    });
  } catch (error) {
    console.error(" Error:", error.message);
    return preserveResponseShape ? { data: [] } : [];
  }
}

// Crear un nuevo producto
export async function createProducto(producto) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(producto),
    });
    if (!response.ok) {
      const errorData = await parseJSON(response);
      throw buildApiError(response, errorData);
    }
    const data = await parseJSON(response);
    return mapProductoFromApi(data);
  } catch (error) {
    console.error(" Error:", error.message);
    throw error;
  }
}

// Actualizar un producto por ID
export async function updateProducto(id, producto) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(producto),
    });
    if (!response.ok) {
      const errorData = await parseJSON(response);
      throw buildApiError(response, errorData);
    }
    const data = await parseJSON(response);
    return mapProductoFromApi(data);
  } catch (error) {
    console.error(" Error:", error.message);
    throw error;
  }
}

// Eliminar un producto por ID
export async function deleteProducto(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await parseJSON(response);
      throw buildApiError(response, errorData);
    }
    return await parseJSON(response);
  } catch (error) {
    console.error(" Error:", error.message);
    throw error;
  }
}
