import { normalizarVenta } from "../Ventas_API/Ventas_API";
import { buildUrl } from "../apiConfig";
import {
  buildEndpointWithQuery,
  mapPaginatedCollectionResponse,
} from "../../../../shared/utils/pagination";

const URL_API_PEDIDOS_USER = buildUrl("/ventas/usuario");

const DEFAULT_HEADERS = {
  Accept: "application/json",
  "ngrok-skip-browser-warning": "true",
};

const parseJSON = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || "Error al leer la respuesta del servidor" };
  }
};

const buildHeaders = (token) => ({
  ...DEFAULT_HEADERS,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const formatCurrency = (value) => {
  const number = Number(value);
  if (Number.isNaN(number)) return String(value ?? "");
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
};

const toDateParts = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const day = value.getUTCDate();
    return {
      year,
      month,
      day,
      iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`,
    };
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return {
      year,
      month,
      day,
      iso: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
    };
  }

  const dmyMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    return {
      year,
      month,
      day,
      iso: `${dmyMatch[3]}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`,
    };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();

  return {
    year,
    month,
    day,
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`,
  };
};

const formatDate = (value) => {
  const parts = toDateParts(value);
  if (!parts) return "Fecha no disponible";
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(
    2,
    "0"
  )}/${parts.year}`;
};

const mapEstadoClass = (estado = "") => {
  const normalized = estado.toString().toLowerCase();
  if (normalized.includes("pend")) return "estado-pendiente";
  if (normalized.includes("compl")) return "estado-completado";
  if (normalized.includes("cancel")) return "estado-cancelado";
  return "";
};

const sanitizeAlphaNumeric = (value) =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const hashString = (value = "") => {
  let hash = 0;
  const txt = String(value);
  for (let i = 0; i < txt.length; i += 1) {
    hash = (hash * 31 + txt.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const lettersFromHash = (hash, size = 2) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let current = Math.abs(Number(hash) || 0);
  let out = "";

  for (let i = 0; i < size; i += 1) {
    out += alphabet[current % alphabet.length];
    current = Math.floor(current / alphabet.length);
  }

  return out.padEnd(size, "A");
};

const generarNumeroPedidoUnico = ({
  venta,
  idPedido,
  fechaISO,
  totalCalculado,
  itemCount,
  index,
}) => {
  const baseNumero = sanitizeAlphaNumeric(venta?.numero_pedido);
  const seed = [
    venta?.id_pedido,
    venta?.id_pedido_cliente,
    venta?.id_venta,
    venta?.id,
    venta?.numero_pedido,
    idPedido,
    fechaISO,
    totalCalculado,
    itemCount,
    index,
  ].join("|");

  const hash = hashString(seed) || hashString(`${Date.now()}|${index}`);
  const sufijo = lettersFromHash(hash, 2);

  if (baseNumero) {
    if (/[A-Z]/.test(baseNumero)) return baseNumero;
    return `${baseNumero}${sufijo}`;
  }

  const baseId = sanitizeAlphaNumeric(idPedido);
  const numerico = (baseId.match(/\d+/g) || []).join("");

  if (numerico) return `${numerico}${sufijo}`;
  if (baseId) return `${baseId.slice(0, 2)}${sufijo}`;

  const fallbackNumerico = String((hash % 90) + 10);
  return `${fallbackNumerico}${sufijo}`;
};

const elegirFechaPedido = (venta = {}, ventaNormalizada = {}) => {
  const candidates = [
    venta.fecha_pedido,
    venta.fecha_compra,
    venta.fechaCompra,
    venta.fecha_venta,
    venta.createdAt,
    venta.fecha,
    ventaNormalizada.fecha,
  ];

  for (const candidate of candidates) {
    const parts = toDateParts(candidate);
    if (parts) {
      return {
        source: candidate,
        iso: parts.iso,
      };
    }
  }

  return { source: null, iso: "" };
};

const asegurarClavesUnicas = (pedidos = []) => {
  const numerosUsados = new Map();
  const idsUsados = new Map();

  return pedidos.map((pedido, index) => {
    let numero = sanitizeAlphaNumeric(pedido.numero_pedido);
    if (!numero) {
      const hash = hashString(
        `${pedido.id || ""}|${pedido.fecha_pedido || ""}|${index}`
      );
      numero = `${String((hash % 90) + 10)}${lettersFromHash(hash, 2)}`;
    }

    const countNumero = numerosUsados.get(numero) || 0;
    numerosUsados.set(numero, countNumero + 1);
    if (countNumero > 0) {
      numero = `${numero}${String(countNumero + 1).padStart(2, "0")}`;
    }

    let id = pedido.id ?? numero;
    const idKey = String(id);
    const countId = idsUsados.get(idKey) || 0;
    idsUsados.set(idKey, countId + 1);
    if (countId > 0) {
      id = `${idKey}-${countId + 1}`;
    }

    return {
      ...pedido,
      id,
      numero_pedido: numero,
    };
  });
};

export const mapVentaToPedidoUsuario = (venta = {}, index = 0) => {
  const ventaNormalizada = normalizarVenta(venta);
  const idPedidoBase =
    venta.id_pedido ??
    venta.id_pedido_cliente ??
    venta.id_venta ??
    venta.id ??
    venta.idVentas ??
    venta.id_ventas ??
    venta.numero_pedido ??
    ventaNormalizada.id ??
    `PED-${index + 1}`;
  const detallesCrudos =
    venta.detalles_venta ||
    venta.detalle_venta ||
    venta.detalles ||
    ventaNormalizada.productos ||
    [];

  const items = Array.isArray(detallesCrudos)
    ? detallesCrudos.map((det, idx) => {
        const recurso = det.producto || det.membresia || det.servicio || {};
        const nombreRecurso =
          recurso.nombre_membresia ||
          recurso.nombre_producto ||
          recurso.nombre ||
          recurso.descripcion ||
          recurso.titulo ||
          det.nombre_membresia ||
          det.nombre_producto ||
          det.producto ||
          det.descripcion ||
          det.tipo_venta ||
          `Item ${idx + 1}`;

        const cantidad =
          Number(det.cantidad ?? det.cantidad_total ?? det.qty ?? 0) || 0;
        const precioUnit =
          Number(
            det.valor_unitario ??
              det.precio_unitario ??
              det.valor ??
              det.precio ??
              det.valor_total_venta ??
              det.valorUnitario ??
              0
          ) || 0;
        const subtotal =
          Number(det.subtotal ?? det.total ?? det.total_producto) ||
          cantidad * precioUnit ||
          0;

        return {
          nombre: nombreRecurso,
          cantidad,
          precio: precioUnit,
          subtotal,
        };
      })
    : [];

  const subtotal = items.reduce(
    (acc, item) =>
      acc + (Number(item.subtotal) || item.cantidad * item.precio || 0),
    0
  );

  const impuesto =
    Number(venta.impuesto ?? venta.impuestos ?? venta.tax ?? 0) || 0;

  const totalCalculado =
    Number(
      ventaNormalizada.monto ??
        venta.valor_total_venta ??
        venta.total ??
        venta.total_venta ??
        venta.totalVenta
    ) || subtotal + impuesto;

  const { source: fechaBase, iso: fechaISO } = elegirFechaPedido(
    venta,
    ventaNormalizada
  );

  const numeroPedido = generarNumeroPedidoUnico({
    venta,
    idPedido: idPedidoBase,
    fechaISO,
    totalCalculado,
    itemCount: items.length,
    index,
  });

  const estado =
    venta.id_estado_estado?.estado ||
    venta.id_estado_estado?.nombre_estado ||
    venta.estado_venta ||
    venta.estado ||
    ventaNormalizada.estado ||
    "Pendiente";

  const plazoMaximo =
    venta.plazo_maximo ??
    venta.plazoMaximo ??
    ventaNormalizada.plazo_maximo ??
    venta.fecha_entrega ??
    venta.fechaEntrega ??
    venta.fecha ??
    fechaISO ??
    fechaBase;

  const nombresItems = items.map((i) => i.nombre).filter(Boolean);
  const nombreDisplay =
    nombresItems.length > 0 ? nombresItems.join(" + ") : "Sin items";

  return {
    id: idPedidoBase,
    numero_pedido: numeroPedido,
    fechaCompra: formatDate(fechaISO || fechaBase),
    producto: nombreDisplay,
    cantidad: items.reduce((acc, item) => acc + item.cantidad, 0) || 0,
    total: formatCurrency(totalCalculado),
    totalNumber: totalCalculado,
    estado,
    estadoClass: mapEstadoClass(estado),
    items,
    subtotal,
    impuesto,
    fecha_pedido: fechaISO || fechaBase,
    fecha_entrega: plazoMaximo,
    plazo_maximo: plazoMaximo,
    nombre_proveedor:
      venta.nombre_proveedor ??
      venta.proveedor ??
      venta.proveedor_nombre ??
      "Proveedor no disponible",
  };
};

export const obtenerPedidosUsuario = async (
  id_usuario,
  { token = localStorage.getItem("token"), query = {} } = {}
) => {
  if (!id_usuario) {
    throw new Error("id_usuario es requerido para consultar pedidos");
  }

  const preserveResponseShape =
    query && typeof query === "object" && Object.keys(query).length > 0;
  const url = buildEndpointWithQuery(
    `${URL_API_PEDIDOS_USER}/${encodeURIComponent(id_usuario)}`,
    query
  );
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(token),
  });

  const data = await parseJSON(response);

  if (!response.ok) {
    const msg =
      data?.msg ||
      data?.message ||
      (response.status === 403
        ? "No tienes permiso para ver estos pedidos"
        : "No se pudieron obtener tus pedidos");
    const err = new Error(msg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  const ventas = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : data
    ? [data]
    : [];

  const pedidosNormalizados = asegurarClavesUnicas(
    ventas.map((venta, index) => mapVentaToPedidoUsuario(venta, index))
  );
  if (!preserveResponseShape) return pedidosNormalizados;
  return mapPaginatedCollectionResponse(
    data,
    (venta, index) => mapVentaToPedidoUsuario(venta, index),
    {
      preferredKeys: ["pedidos", "ventas", "data"],
      preserveResponseShape: true,
    }
  );
};

export default URL_API_PEDIDOS_USER;
