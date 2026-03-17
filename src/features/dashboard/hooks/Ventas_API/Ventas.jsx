import { buildUrl } from "../apiConfig";
import { withPaginationQueryAliases } from "../../../../shared/utils/pagination";

// src/features/dashboard/hooks/Ventas_API/Ventas.jsx
// Cliente HTTP para el modulo de ventas (listado, CRUD y normalizacion para la UI)

const URL_VENTAS = buildUrl("/ventas");
const URL_VENTAS_PENDIENTES = `${URL_VENTAS}/pendientes`;
const URL_VENTAS_FINALIZADAS = `${URL_VENTAS}/finalizadas`;
const URL_VENTAS_DETALLES = buildUrl("/detalles_venta");
const DASHBOARD_REFRESH_EVENT = "dashboard:ventas-actualizadas";

export const ESTADO_OPCIONES = [
  { value: "Activo", label: "Activo", color: "#0ea5e9" },
  { value: "Inactivo", label: "Inactivo", color: "#9ca3af" },
  { value: "Pendiente", label: "Pendiente", color: "#f59e0b" },
  { value: "En proceso", label: "En proceso", color: "#6366f1" },
  { value: "Completado", label: "Completado", color: "#10b981" },
  { value: "Cancelado", label: "Cancelado", color: "#ef4444" },
];

const ESTADO_ID_MAP = {
  1: "Activo",
  2: "Inactivo",
  3: "Pendiente",
  4: "En proceso",
  5: "Completado",
  6: "Cancelado",
};

const sanitizeBearer = (token) =>
  token ? String(token).replace(/^Bearer\s+/i, "").trim() : undefined;

const toRuntimeUrl = (value) =>
  new URL(
    value,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );

const normalizeOptions = (options) => {
  if (typeof options === "string") return { token: options };
  return options || {};
};

const notifySalesChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
};

async function logAndFetch(label, url, init = {}) {
  const method = (init.method || "GET").toUpperCase();

  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(
      `${method} ${url} -> ${res.status} ${res.statusText} | ${text.slice(
        0,
        300
      )}`
    );
  }

  if (!text) return null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return JSON.parse(text);
  return text;
}

export const normalizarEstado = (rawEstado) => {
  if (rawEstado === null || rawEstado === undefined) return "Pendiente";
  if (typeof rawEstado === "number")
    return ESTADO_ID_MAP[rawEstado] || "Pendiente";

  const key = String(rawEstado).toLowerCase().trim();
  const entry =
    ESTADO_OPCIONES.find(
      (opt) =>
        opt.value.toLowerCase() === key || opt.label.toLowerCase() === key
    ) || Object.values(ESTADO_ID_MAP).find((v) => v.toLowerCase() === key);

  if (entry && typeof entry === "object") return entry.value || entry.label;
  if (typeof entry === "string") return entry;

  const aliasMap = {
    activo: "Activo",
    active: "Activo",
    inactivo: "Inactivo",
    inactive: "Inactivo",
    pendiente: "Pendiente",
    pending: "Pendiente",
    proceso: "En proceso",
    procesando: "En proceso",
    "en proceso": "En proceso",
    "en_proceso": "En proceso",
    completado: "Completado",
    completo: "Completado",
    finalizado: "Completado",
    cancelado: "Cancelado",
    anulado: "Cancelado",
  };

  return aliasMap[key] || "Pendiente";
};

export const estadoToPayload = (valor) => {
  const estado = normalizarEstado(valor);
  // Mapeo directo según los requerimientos del usuario
  const estadoMapping = {
    "PENDIENTE": 3,
    "EN PROCESO": 4,
    "COMPLETADO": 5,
    "CANCELADO": 6
  };

  const id_estado = estadoMapping[estado.toUpperCase()] ||
                   Object.entries(ESTADO_ID_MAP).find(([, label]) => label === estado)?.[0];

  return {
    estado,
    ...(id_estado ? { id_estado: Number(id_estado) } : {}),
  };
};

// --------------------------------------
// Normalización de productos / detalles
// --------------------------------------
const normalizarProductos = (raw) => {
  const fuente = Array.isArray(raw?.productos)
    ? raw.productos
    : Array.isArray(raw?.detalle)
    ? raw.detalle
    : Array.isArray(raw?.detalle_venta)
    ? raw.detalle_venta
    : Array.isArray(raw?.detalles)
    ? raw.detalles
    : raw && (raw.producto || raw.nombre_producto || raw.descripcion || raw.tipo_venta)
    ? [raw]
    : [];

  return fuente.map((p, idx) => ({
    producto:
      p.tipo_venta ||
      p.producto ||
      p.nombre ||
      p.nombre_producto ||
      p.descripcion ||
      p.concepto ||
      `Item ${idx + 1}`,
    cantidad:
      Number(
        p.cantidad_total ??
          p.cantidad ??
          p.qty ??
          p.cantidad_producto ??
          1
      ) || 1,
    precio:
      Number(
        p.valor_total_venta ??
          p.precio ??
          p.valor ??
          p.precio_unitario ??
          p.valor_unitario ?? 
          p.precioVenta ??
          p.precio_venta ??
          p.total ??
          0
      ) || 0,
    perdidas_o_ganancias: Number(p.perdidas_o_ganancias ?? 0) || 0,
  }));
};

const inferirTipoVenta = (raw, productos = []) => {
  const tipoRaw = (
    raw?.tipoVenta ||
    raw?.tipo_venta ||
    raw?.tipo ||
    raw?.categoria ||
    raw?.origen ||
    ""
  )
    .toString()
    .toLowerCase();

  if (tipoRaw.includes("memb")) return "membresia";
  if (tipoRaw.includes("prod")) return "producto";
  if (raw?.membresia || raw?.id_membresia || raw?.nombre_membresia)
    return "membresia";
  if (productos.length === 0 && tipoRaw) return tipoRaw;
  return productos.length ? "producto" : "general";
};

export const normalizarVenta = (raw = {}) => {
  const productos = normalizarProductos(raw);
  const estado = normalizarEstado(
    raw.estado ?? raw.id_estado ?? raw.estado_venta
  );

  return {
    id:
      raw.id ??
      raw.id_venta ??
      raw.idVentas ??
      raw.id_ventas ??
      raw.codigo_venta ??
      raw.codigo ??
      raw.folio ??
      raw.numero ??
      Date.now(),
    cliente:
      raw.cliente ||
      raw.cliente_nombre ||
      raw.nombre_cliente ||
      raw.usuario?.nombre ||
      raw.usuario_nombre ||
      [raw.nombre, raw.apellido].filter(Boolean).join(" ") ||
      "Cliente sin nombre",
    id_usuario: raw.id_usuario,
    tipoVenta: inferirTipoVenta(raw, productos),
    productos,
    metodoPago:
      raw.metodoPago || raw.metodo_pago || raw.payment_method || "Sin especificar",
    monto:
      Number(
        raw.valor_total_venta ??
          raw.monto ??
          raw.total ??
          raw.valor_total ??
          raw.precio ??
          raw.precio_total ??
          0
      ) ||
      productos.reduce(
        (acc, p) =>
          acc + (Number(p.cantidad) * Number(p.precio) || 0),
        0
      ),
    estado,
    plazo_maximo:
      raw.plazo_maximo ??
      raw.plazoMaximo ??
      raw.fecha_entrega ??
      raw.fechaEntrega ??
      null,
    fecha:
      raw.fecha_venta ||
      raw.fecha ||
      raw.fecha_venta ||
      raw.fecha_creacion ||
      raw.createdAt ||
      raw.updatedAt ||
      new Date().toISOString(),
    notas: raw.notas || raw.comentarios || raw.observaciones || "",
  };
};

const buildHeaders = (token, extraHeaders = {}) => ({
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
  ...(token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {}),
  ...extraHeaders,
});

// --------------------------------------
// Helpers específicos para el backend de ventas
// --------------------------------------

// Mapea un detalle "de front" al detalle que espera el backend de ventas
const mapDetalleToBackend = (detalle) => {
  const tipo =
    (detalle.tipo_venta || detalle.tipoVenta || "").toString().toUpperCase();

  const base = {
    tipo_venta: tipo, // PRODUCTO | MEMBRESIA | SERVICIO
    cantidad: Number(detalle.cantidad) || 0,
    perdidas_o_ganancias:
      Number(
        detalle.perdidas_o_ganancias ??
          detalle.perdidasOGanancias ??
          0
      ) || 0,
    valor_unitario:
      Number(
        detalle.valor_unitario ?? detalle.valorUnitario ?? 0
      ) || 0,
  };

  const recursoId =
    detalle.id_producto ??
    detalle.id_membresia ??
    detalle.id_servicio ??
    detalle.recursoId ??
    detalle.idRecurso ??
    null;

  if (tipo === "PRODUCTO") {
    return {
      ...base,
      id_producto: recursoId,
    };
  }

  if (tipo.startsWith("MEMB")) {
    return {
      ...base,
      tipo_venta: "MEMBRESIA", // Normalizado sin tilde para evitar problemas de backend
      id_membresia: recursoId,
    };
  }

  if (tipo === "SERVICIO") {
    return {
      ...base,
      id_servicio: recursoId,
    };
  }

  // Fallback por si viene algo raro
  return base;
};

// Calcula el total de la venta a partir de los detalles que ya están en formato backend
const calcularTotalVenta = (detallesBackend) => {
  return (detallesBackend || []).reduce((acc, d) => {
    const cantidad = Number(d.cantidad) || 0;
    const valorUnitario = Number(d.valor_unitario) || 0;
    return acc + cantidad * valorUnitario;
  }, 0);
};

// Construye el payload EXACTO que tu backend de ventas espera
// Actualización de la función buildVentaPayload en Ventas.jsx (API)
// Esta es la corrección que debes aplicar en tu archivo de API

const buildVentaPayload = (venta) => {
  // Only include detalles if it's a non-empty array
  const detalles = Array.isArray(venta.detalles) && venta.detalles.length > 0
    ? venta.detalles.map(mapDetalleToBackend)
    : undefined;

  const valor_total_venta = venta.valor_total_venta ??
    (detalles ? calcularTotalVenta(detalles) : undefined);

  const id_usuario = 
    venta.idUsuario ??
    venta.id_usuario ??
    venta.id_de_usuario ??
    venta.usuarioId;

  const fecha_venta = venta.fecha_venta ?? venta.fechaVenta ?? undefined;
  const plazo_maximo =
    venta.plazo_maximo ?? venta.plazoMaximo ?? venta.fecha_entrega ?? venta.fechaEntrega ?? undefined;
  const id_estado_directo = venta.id_estado;
  
  const estadoSource =
    venta.estado_venta ?? venta.estadoVenta ?? venta.estado ?? undefined;

  const { estado: estadoNormalizado, id_estado: id_estado_calculado } = estadoToPayload(
    estadoSource
  );

  const id_estado_final = id_estado_directo ?? id_estado_calculado;

  // Build the payload with conditional properties
  const payload = {
    id_usuario,
    ...(fecha_venta && { fecha_venta }),
    ...(plazo_maximo && { plazo_maximo }),
    ...(estadoNormalizado && { estado_venta: estadoNormalizado }),
    ...(id_estado_final !== undefined && { id_estado: id_estado_final }),
    ...(valor_total_venta !== undefined && { valor_total_venta }),
    ...(detalles && { detalles })
  };

  return payload;
};

// --------------------------------------
// CRUD Ventas
// --------------------------------------

export const obtenerDetallesVentas = async (options) => {
  const { token, query = {} } = normalizeOptions(options);
  const url = toRuntimeUrl(URL_VENTAS_DETALLES);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });

  return logAndFetch("[Ventas][GET detalles]", url.toString(), {
    method: "GET",
    headers: buildHeaders(token),
  });
};

const obtenerVentasDesdeEndpoint = async (urlListado, options) => {
  const { token, query = {} } = normalizeOptions(options);
  const paginationQuery = withPaginationQueryAliases(query);
  const urlVentas = toRuntimeUrl(urlListado);
  Object.entries(paginationQuery).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      urlVentas.searchParams.set(k, String(v));
    }
  });

  const urlDetalles = toRuntimeUrl(URL_VENTAS_DETALLES);
  Object.entries(paginationQuery).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      urlDetalles.searchParams.set(k, String(v));
    }
  });

  const [resVentas, resDetalles] = await Promise.all([
    logAndFetch("[Ventas][GET listado]", urlVentas.toString(), {
      method: "GET",
      headers: buildHeaders(token),
    }),
    logAndFetch("[Ventas][GET detalles]", urlDetalles.toString(), {
      method: "GET",
      headers: buildHeaders(token),
    }).catch((err) => {
      console.error("[Ventas] No se pudo obtener detalles:", err);
      return null;
    }),
  ]);

  const ventasArray = Array.isArray(resVentas?.data)
    ? resVentas.data
    : Array.isArray(resVentas)
      ? resVentas
      : resVentas
        ? [resVentas]
        : [];

  const detallesArray = Array.isArray(resDetalles?.data)
    ? resDetalles.data
    : Array.isArray(resDetalles)
    ? resDetalles
    : [];

  const detallesPorVenta = detallesArray.reduce((acc, det) => {
    const key =
      det.id_pedido_cliente ??
      det.id_venta ??
      det.idVenta ??
      det.id_pedido ??
      det.id_venta_fk ??
      det.id;
    if (key === undefined || key === null) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(det);
    return acc;
  }, {});

  const ventasConDetalles = ventasArray.map((venta) => {
    const key =
      venta.id_pedido_cliente ??
      venta.id_venta ??
      venta.idVentas ??
      venta.id_ventas ??
      venta.id_pedido ??
      venta.id ??
      venta.idVenta;

    const existentes =
      venta.detalles_venta ?? venta.detalle_venta ?? venta.detalles ?? [];
    const combinados = [
      ...existentes,
      ...(detallesPorVenta[key] || []),
    ].filter(Boolean);

    const vistos = new Set();
    const deduplicados = combinados.filter((det, idx) => {
      const dedupKey =
        det.id_detalle_venta ??
        det.id ??
        `${det.id_producto || det.id_membresia || det.id_servicio || "n/a"}-${
          det.tipo_venta || det.tipo || "n/a"
        }-${det.valor_unitario || det.valor_total_venta || "0"}-${
          det.cantidad ?? det.cantidad_total ?? idx
        }`;
      if (vistos.has(dedupKey)) return false;
      vistos.add(dedupKey);
      return true;
    });

    return {
      ...venta,
      detalles_venta: deduplicados,
      detalle_venta: deduplicados,
    };
  });

  if (Array.isArray(resVentas?.data)) return { ...resVentas, data: ventasConDetalles };
  if (Array.isArray(resVentas)) return ventasConDetalles;
  if (resVentas && typeof resVentas === "object") return { ...resVentas, data: ventasConDetalles };
  return ventasConDetalles;
};

export const obtenerVentas = async (options) => {
  return obtenerVentasDesdeEndpoint(URL_VENTAS, options);
};

export const obtenerVentasPendientes = async (options) => {
  return obtenerVentasDesdeEndpoint(URL_VENTAS_PENDIENTES, options);
};

export const obtenerVentasFinalizadas = async (options) => {
  return obtenerVentasDesdeEndpoint(URL_VENTAS_FINALIZADAS, options);
};

export const obtenerVentaPorId = async (id, options) => {
  const { token } = normalizeOptions(options);
  const url = `${URL_VENTAS}/${encodeURIComponent(id)}`;
  return logAndFetch(`[Ventas][GET ${id}]`, url, {
    method: "GET",
    headers: buildHeaders(token),
  });
};

export const obtenerDetallesVenta = async (ventaId, options) => {
  const { token } = normalizeOptions(options);
  const url = `${URL_VENTAS}/${encodeURIComponent(ventaId)}/detalles_venta`;
  
  try {
    const response = await logAndFetch("[Ventas][GET detalles_venta]", url, {
      method: "GET",
      headers: buildHeaders(token),
    });
    return response;
  } catch (error) {
    console.error('[Ventas][GET detalles_venta] Error:', error);
    throw error;
  }
};

export const crearVenta = async (venta, options) => {
  const { token } = normalizeOptions(options);

  // Adaptamos el objeto "venta" del front al body que espera el backend
  const payload = buildVentaPayload(venta);

  const response = await logAndFetch("[Ventas][POST crear]", URL_VENTAS, {
    method: "POST",
    headers: buildHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  notifySalesChange();
  return response;
};

export const actualizarVenta = async (id, venta, options) => {
  const { token } = normalizeOptions(options);
  const url = `${URL_VENTAS}/${encodeURIComponent(id)}`;

  // Igual que en crear, adaptamos la venta al formato del backend
  const payload = buildVentaPayload(venta);

  const response = await logAndFetch("[Ventas][PUT actualizar]", url, {
    method: "PUT",
    headers: buildHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  notifySalesChange();
  return response;
};

export const eliminarVenta = async (id, options) => {
  const { token } = normalizeOptions(options);
  const url = `${URL_VENTAS}/${encodeURIComponent(id)}`;
  await logAndFetch("[Ventas][DELETE eliminar]", url, {
    method: "DELETE",
    headers: buildHeaders(token),
  });
  notifySalesChange();
  return true;
};
