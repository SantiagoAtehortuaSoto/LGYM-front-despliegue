import { buildUrl } from "../apiConfig";
import {
  buildEndpointWithQuery,
  mapPaginatedCollectionResponse,
  withPaginationQueryAliases,
} from "../../../../shared/utils/pagination";

const API_URL = buildUrl("/compras");
const API_URL_PENDIENTES = `${API_URL}/pendientes`;
const API_URL_FINALIZADAS = `${API_URL}/finalizadas`;
const DETALLES_API_URL = buildUrl("/detalles_pedidos");

const NETWORK_ERROR_HINT =
  "Error de red/CORS. En desarrollo usa proxy de Vite y reinicia el servidor (`npm run dev`).";

const withNetworkHint = (error) => {
  const message = String(error?.message || "");
  if (/failed to fetch|networkerror|network error/i.test(message)) {
    return `${message}. ${NETWORK_ERROR_HINT}`;
  }
  return message || "Error de red";
};

const normalizarDetalles = (productos = []) =>
  productos
    .map((producto) => {
      const idProducto = parseInt(producto.idProducto ?? producto.id ?? producto.id_productos, 10);
      const cantidad = parseInt(producto.cantidad, 10);
      return {
        id_productos: Number.isFinite(idProducto) ? idProducto : null,
        cantidad: Number.isFinite(cantidad) ? cantidad : undefined
      };
    })
    .filter(
      (detalle) =>
        Number.isFinite(detalle.id_productos) &&
        Number.isFinite(detalle.cantidad)
    );

const construirMapaDetalles = (detalles = []) => {
  const mapa = new Map();

  detalles.forEach((registro) => {
    const clavePedido = registro.numero_pedido || registro.id_pedido || registro.id_compra || registro.id_pedidos;
    if (!clavePedido) return;

    const listaDetalles = Array.isArray(registro.detalles) && registro.detalles.length > 0
      ? registro.detalles
      : [registro];

    const detallesNormalizados = listaDetalles
      .map((detalle) => {
        const cantidad = parseFloat(detalle.cantidad ?? detalle.cantidad_detalle ?? detalle.cantidad_producto ?? 0);
        const costo = parseFloat(
          detalle.costo_unitario ??
          detalle.precio_unitario ??
          detalle.costo ??
          detalle.costo_unitario_detalle ??
          0
        );
        const subtotal = detalle.subtotal
          ? parseFloat(detalle.subtotal)
          : (Number.isFinite(cantidad) && Number.isFinite(costo) ? cantidad * costo : 0);

        // Mejorar extracción del nombre del producto
        // Intentar múltiples fuentes posibles
        const nombreProducto =
          detalle.nombre_producto ||
          detalle.nombre ||
          detalle.id_productos_producto?.nombre_producto ||
          detalle.id_productos_producto?.nombre ||
          detalle.producto?.nombre_producto ||
          detalle.producto?.nombre ||
          `Producto ${detalle.id_productos || detalle.id_producto || ''}`;

        return {
          numero_pedido: registro.numero_pedido || detalle.numero_pedido,
          id_pedido: registro.id_pedido || detalle.id_pedido || registro.id_compra || registro.id_pedidos,
          id_productos: detalle.id_productos ?? detalle.id_producto ?? detalle.id_products,
          nombre_producto: nombreProducto,
          cantidad,
          costo_unitario: costo,
          subtotal
        };
      })
      .filter((detalle) => Number.isFinite(detalle.cantidad));

    if (!mapa.has(clavePedido)) {
      mapa.set(clavePedido, detallesNormalizados);
    } else {
      mapa.set(clavePedido, [...mapa.get(clavePedido), ...detallesNormalizados]);
    }
  });

  return mapa;
};

// Función para manejar la conversión segura del JSON
async function parseJSON(response) {
  const text = await response.text();
  const trimmed = typeof text === "string" ? text.trim() : "";

  if (!trimmed) {
    return {};
  }

  try {
    return JSON.parse(trimmed);
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

const mapPedidoFromApi = (pedido) => ({
  id_pedido: pedido.id_pedido,
  numero_pedido: pedido.numero_pedido,
  id_proveedor: pedido.id_proveedor,
  fecha_pedido: pedido.fecha_pedido,
  fecha_entrega: pedido.fecha_entrega,
  id_estado: pedido.id_estado,
  detalles_pedidos: pedido.detalles_pedidos || []
});

async function getPedidosDesdeEndpoint(endpointUrl, options = {}) {
  const query =
    options?.query && typeof options.query === "object" ? options.query : {};
  const paginationQuery = withPaginationQueryAliases(query);
  const preserveResponseShape = Object.keys(query).length > 0;

  try {
    const response = await fetch(buildEndpointWithQuery(endpointUrl, paginationQuery), {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error("Error al obtener pedidos");
    const data = await parseJSON(response);

    const lista = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const pedidosMapeados = lista.map(mapPedidoFromApi);

    if (!preserveResponseShape) return pedidosMapeados;
    return mapPaginatedCollectionResponse(data, mapPedidoFromApi, {
      preferredKeys: ["pedidos", "compras", "data"],
      preserveResponseShape: true,
    });
  } catch (error) {
    console.error("Error:", withNetworkHint(error));
    return preserveResponseShape ? { data: [] } : [];
  }
}

// Obtener todos los pedidos
export async function getPedidos(options = {}) {
  return getPedidosDesdeEndpoint(API_URL, options);
}

// Obtener pedidos pendientes/en proceso
export async function getPedidosPendientes(options = {}) {
  return getPedidosDesdeEndpoint(API_URL_PENDIENTES, options);
}

// Obtener pedidos finalizados
export async function getPedidosFinalizadas(options = {}) {
  return getPedidosDesdeEndpoint(API_URL_FINALIZADAS, options);
}

// Crear un nuevo pedido
export async function createPedido(apiData, uiData) {
  try {
    const detallesNormalizados = normalizarDetalles(uiData.productos);
    if (detallesNormalizados.length === 0) {
      throw new Error("Debe incluir al menos un producto en el pedido");
    }

    const payloadCabecera = {
      numero_pedido: apiData.numero_pedido,
      id_proveedor: apiData.id_proveedor,
      fecha_pedido: apiData.fecha_pedido,
      fecha_entrega: apiData.fecha_entrega,
      id_estado: apiData.id_estado ?? 3,
      detalles: detallesNormalizados
    };

    const responseCabecera = await fetch(API_URL, {
      method: "POST",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payloadCabecera)
    });

    if (!responseCabecera.ok) {
      const errorText = await responseCabecera.text();
      throw new Error(`Error al crear pedido: ${responseCabecera.status} - ${errorText}`);
    }

    let cabeceraCreada = {};
    try {
      cabeceraCreada = await parseJSON(responseCabecera);
    } catch (parseError) {
      console.warn("No se pudo parsear la respuesta de la cabecera:", parseError?.message || parseError);
      cabeceraCreada = {};
    }

    const numeroPedidoCreado = cabeceraCreada.numero_pedido || payloadCabecera.numero_pedido;
    let idPedidoCreado = cabeceraCreada.id_pedido || cabeceraCreada.id || cabeceraCreada.insertId;

    if (!idPedidoCreado) {
      try {
        const pedidosActuales = await getPedidos();
        const coincidencia = pedidosActuales.find(
          (pedido) => pedido.numero_pedido === numeroPedidoCreado
        );
        if (coincidencia) {
          idPedidoCreado = coincidencia.id_pedido;
        }
      } catch (lookupError) {
        console.warn("No se pudo determinar el ID del pedido reciente:", lookupError?.message || lookupError);
      }
    }

    if (!idPedidoCreado) {
      throw new Error("No se pudo obtener el ID del pedido recién creado");
    }

    const detallesRetornados = Array.isArray(cabeceraCreada?.detalles) && cabeceraCreada.detalles.length > 0
      ? cabeceraCreada.detalles
      : Array.isArray(cabeceraCreada?.detalles_pedidos) && cabeceraCreada.detalles_pedidos.length > 0
        ? cabeceraCreada.detalles_pedidos
        : [];

    const detallesGuardados = detallesRetornados.length > 0
      ? detallesRetornados
      : detallesNormalizados;

    return {
      idPedido: numeroPedidoCreado,
      fecha: payloadCabecera.fecha_pedido,
      proveedor: payloadCabecera.id_proveedor,
      precioTotal: detallesGuardados.reduce(
        (total, detalle) => total + (
          detalle.subtotal !== undefined
            ? parseFloat(detalle.subtotal) || 0
            : (parseFloat(detalle.cantidad) || 0) * (parseFloat(detalle.costo_unitario) || 0)
        ),
        0
      ).toFixed(2),
      estado: 'Pendiente',
      id: idPedidoCreado,
      producto: uiData.productos.length > 0
        ? uiData.productos[0].nombre || uiData.productos[0].idProducto
        : 'Producto no encontrado',
      cantidad: detallesGuardados.reduce((total, detalle) => total + (parseFloat(detalle.cantidad) || 0), 0),
      precio_total: detallesGuardados.reduce(
        (total, detalle) => total + (
          detalle.subtotal !== undefined
            ? parseFloat(detalle.subtotal) || 0
            : (parseFloat(detalle.cantidad) || 0) * (parseFloat(detalle.costo_unitario) || 0)
        ),
        0
      ).toFixed(2),
      numero_pedido: numeroPedidoCreado,
      id_pedido: idPedidoCreado,
      detalles: detallesGuardados
    };
  } catch (error) {
    console.error("Error:", error.message);
    throw error; // Re-lanzar para que sea manejado por el componente
  }
}

async function enviarDetalleIndividual(basePayload, detalle) {
  const cuerpo = {
    id_pedidos: basePayload.id_pedidos,
    id_productos: detalle.id_productos,
    cantidad: detalle.cantidad
  };

  const response = await fetch(DETALLES_API_URL, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(cuerpo)
  });

  if (response.status === 401) {
    throw new Error("No autorizado: tu sesión expiró. Ingresa nuevamente.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear detalles: ${response.status} - ${errorText}`);
  }

  try {
    const data = await parseJSON(response);
    return data.detalle || data;
  } catch {
    return cuerpo;
  }
}

export async function guardarDetallesPedido(payload) {
  const detallesArray = Array.isArray(payload.detalles) ? payload.detalles : [];

  if (detallesArray.length === 0) {
    throw new Error("Debe incluir al menos un producto en el pedido");
  }

  const basePayload = {
    id_pedidos: payload.id_pedidos
  };

  const resultados = [];
  for (const detalle of detallesArray) {
    resultados.push(await enviarDetalleIndividual(basePayload, detalle));
  }
  return resultados;
}

// Obtener un pedido específico junto a sus detalles
export async function getPedidoById(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      headers: getHeaders()
    });
    if (!response.ok) throw new Error("Error al obtener el pedido");
    const pedido = await parseJSON(response);

    let detalles = [];
    try {
      const detallesResponse = await fetch(DETALLES_API_URL, {
        headers: getHeaders()
      });
      if (detallesResponse.ok) {
        const detallesData = await parseJSON(detallesResponse);
        const mapaDetalles = construirMapaDetalles(Array.isArray(detallesData) ? detallesData : []);
        const clavePedido = pedido.numero_pedido || pedido.id_pedido;
        detalles = mapaDetalles.get(clavePedido) || [];
      }
    } catch (errorDetalles) {
      console.warn("No se pudieron obtener los detalles del pedido:", errorDetalles?.message || errorDetalles);
    }

    return {
      ...pedido,
      detalles_pedidos: detalles
    };
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}

// Actualizar un pedido por ID
export async function updatePedido(id, pedido) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(pedido)
    });
    const data = await parseJSON(response).catch(() => ({}));

    if (!response.ok) {
      const errores = Array.isArray(data?.errors)
        ? data.errors
            .map((e) => e?.msg || e?.message || e?.error)
            .filter(Boolean)
            .join("; ")
        : "";
      const backendMessage =
        errores ||
        data?.message ||
        data?.msg ||
        data?.error ||
        `${response.status} ${response.statusText}`;

      throw new Error(`No se pudo actualizar el pedido: ${backendMessage}`);
    }

    // Mapear la respuesta al formato del frontend
    return {
      idPedido: data.numero_pedido,
      fecha: data.fecha_pedido,
      proveedor: data.id_proveedor_proveedore?.nombre_proveedor || 'Proveedor no encontrado',
      precioTotal: null,
      estado: data.id_estado_estado?.nombre_estado || 'Estado desconocido',
      id: data.id_pedido
    };
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}

// Crear detalle de pedido
export async function createDetallePedido(payload) {
  return guardarDetallesPedido(payload);
}

export async function getDetallesPedidos() {
  try {
    const response = await fetch(DETALLES_API_URL, {
      headers: getHeaders()
    });
    if (response.status === 401) {
      console.warn("No autorizado al obtener detalles de pedidos, devolviendo datos vacíos.");
      return new Map();
    }
    if (!response.ok) {
      throw new Error(`Error al obtener detalles de pedidos: ${response.status}`);
    }
    const data = await parseJSON(response);
    return construirMapaDetalles(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Error:", withNetworkHint(error));
    return new Map();
  }
}

// Eliminar un pedido por ID
export async function deletePedido(id) {
  try {
    let response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!response.ok && response.status === 404) {
      response = await fetch(`${API_URL}?id_pedido=${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });
    }
    if (!response.ok) throw new Error("Error al eliminar pedido");
    const text = await response.text();
    if (!text) {
      return { success: true };
    }
    return JSON.parse(text);
  } catch (error) {
    console.error("Error:", error.message);
    throw error;
  }
}
