import { buildUrl } from "../apiConfig";

const URL_API_COMPROBANTE = buildUrl("/ventas");
const URL_API_MEMBRESIAS = buildUrl("/membresias");

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

const parseJSON = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || "Error al parsear la respuesta del servidor" };
  }
};

const toPositiveNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const toISODate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const sumarDiasISO = (baseDate, dias = 30) => {
  const d = new Date(baseDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Number(dias || 0));
  return toISODate(d);
};

// Cache simple de membresías para evitar pedirlas varias veces
let MEM_CACHE = { fetchedAt: 0, data: null };
const MEM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const buildHeaders = (token) => ({
  ...DEFAULT_HEADERS,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function fetchMembresias(token) {
  const res = await fetch(URL_API_MEMBRESIAS, {
    method: "GET",
    headers: buildHeaders(token),
  });
  const data = await parseJSON(res);
  if (!res.ok) {
    const msg = data?.msg || data?.message || "No se pudieron obtener membresías";
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return arr.map((m) => ({
    id:
      m.id_membresia ??
      m.id_membresias ??
      m.id ??
      m.id_membresia_fk ??
      m.id_membresia_pk ??
      null,
    nombre: m.nombre_membresia ?? m.nombre ?? m.titulo ?? "",
    precio:
      Number(m.precio_venta ?? m.precio_de_venta ?? m.precio ?? m.valor ?? 0) || 0,
    raw: m,
  }));
}

async function ensureMembresias(token) {
  const now = Date.now();
  if (MEM_CACHE.data && now - MEM_CACHE.fetchedAt < MEM_CACHE_TTL_MS) {
    return MEM_CACHE.data;
  }
  const data = await fetchMembresias(token);
  MEM_CACHE = { data, fetchedAt: now };
  return data;
}

const normalizeStr = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

async function resolveMembresiaId(item, { token } = {}) {
  const directId = item.id_membresia ?? item.id_membresias ?? item.backendId ?? item.id;
  const num = toPositiveNumber(directId);
  if (num) return num;

  const nombreItem = normalizeStr(item.nombre || item.name);
  if (!nombreItem) return null;

  const lista = await ensureMembresias(token);
  const hit = lista.find((m) => normalizeStr(m.nombre) === nombreItem);
  return hit?.id ? toPositiveNumber(hit.id) : null;
}

/**
 * Normaliza los items del carrito al formato de /ventas.
 * [{ tipo_venta, cantidad, valor_unitario, perdidas_o_ganancias, id_producto|id_membresia|id_servicio }]
 */
export const mapCarritoToPayload = async (items = [], { token } = {}) => {
  const detalles = [];

  for (const item of items) {
    const tipoRaw = (item.tipo || item.type || "").toString().toLowerCase();
    const esMembresia =
      tipoRaw.includes("memb") ||
      item.id_membresia !== undefined ||
      item.idMembresia !== undefined ||
      item.id_membresias !== undefined ||
      item.idMembresias !== undefined;
    const esServicio =
      tipoRaw.includes("serv") ||
      item.id_servicio !== undefined ||
      item.idServicio !== undefined ||
      item.id_servicios !== undefined ||
      item.idServicios !== undefined;

    const rawId =
      (esMembresia
        ? item.id_membresia ?? item.idMembresia ?? item.id_membresias ?? item.idMembresias ?? item.id
        : esServicio
        ? item.id_servicio ??
          item.idServicio ??
          item.id_servicios ??
          item.idServicios ??
          item.servicioId ??
          item.id
        : item.id_producto ??
          item.idProducto ??
          item.productoId ??
          item.id_productos ??
          item.idProductos ??
          item.id) ?? item.id;

    let idRecurso = toPositiveNumber(rawId);
    if (esMembresia && idRecurso === null) {
      idRecurso = await resolveMembresiaId(item, { token });
    }

    if (idRecurso === null) {
      const detalle = JSON.stringify(item);
      throw new Error(
        esMembresia
          ? `La membresía no tiene un id_membresia válido. Item: ${detalle}`
          : esServicio
          ? `El servicio no tiene un id_servicio válido. Item: ${detalle}`
          : `El producto no tiene un id_producto válido. Item: ${detalle}`
      );
    }

    const detalleBase = {
      tipo_venta: esMembresia ? "MEMBRESIA" : esServicio ? "SERVICIO" : "PRODUCTO",
      cantidad: Number(item.cantidad) || 1,
      valor_unitario: Number(item.precio ?? item.valor_unitario ?? 0) || 0,
      perdidas_o_ganancias: Number(item.perdidas_o_ganancias ?? 0) || 0,
    };

    if (esMembresia) {
      detalles.push({ ...detalleBase, id_membresia: idRecurso });
      continue;
    }

    if (esServicio) {
      detalles.push({ ...detalleBase, id_servicio: idRecurso });
      continue;
    }

    detalles.push({ ...detalleBase, id_producto: idRecurso });
  }

  return detalles;
};

/**
 * Envia una venta desde carrito hacia /ventas.
 */
export const crearComprobanteVenta = async ({
  id_usuario,
  carrito,
  detalles,
  id_estado = 3,
  plazo_maximo,
  dias_plazo = 30,
  token = localStorage.getItem("token"),
} = {}) => {
  const idUsuarioNum = toPositiveNumber(id_usuario);
  if (!idUsuarioNum) {
    throw new Error("No se pudo determinar el usuario para la venta.");
  }

  const detallesVenta =
    Array.isArray(detalles) && detalles.length > 0
      ? detalles
      : Array.isArray(carrito)
      ? carrito
      : [];

  if (detallesVenta.length === 0) {
    throw new Error("El carrito no puede estar vacio.");
  }

  const headers = buildHeaders(token);
  const idEstadoNum = Number(id_estado) || 3;
  const plazo =
    toISODate(plazo_maximo) ||
    sumarDiasISO(new Date(), dias_plazo) ||
    toISODate(new Date());

  const payload = {
    id_usuario: idUsuarioNum,
    id_estado: idEstadoNum,
    plazo_maximo: plazo,
    detalles: detallesVenta,
  };

  console.debug("[Comprobante] Payload enviado:", payload);

  const response = await fetch(URL_API_COMPROBANTE, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const data = await parseJSON(response);

  if (!response.ok) {
    const erroresArray = Array.isArray(data?.errors) ? data.errors : [];
    const primerError = erroresArray[0];
    const msg =
      primerError?.msg ||
      primerError?.message ||
      data?.msg ||
      data?.message ||
      data?.error ||
      `Error ${response.status}: no se pudo generar el comprobante`;

    const error = new Error(msg);
    error.status = response.status;
    error.data = data;
    error.errors = erroresArray;

    console.error("[Comprobante] Error respuesta backend:", {
      status: response.status,
      statusText: response.statusText,
      data,
    });
    throw error;
  }

  return data;
};

export default URL_API_COMPROBANTE;

