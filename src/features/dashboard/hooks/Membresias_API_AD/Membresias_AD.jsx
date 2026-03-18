import { buildUrl } from "../apiConfig";

// src/shared/services/membresías.js

const BASE_URL = buildUrl("/membresias");
const DEFAULT_TIMEOUT_MS = 15000;

const toRuntimeUrl = (value) =>
  new URL(
    value,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );

/* ---------------- Token helpers ---------------- */
function sanitizeToken(token) {
  if (!token) return undefined;
  return token.replace(/^Bearer\s+/i, "");
}

function buildHeaders(token, extra = {}) {
  const jwt = sanitizeToken(token);
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    ...extra,
  };
}

/* ---------------- Fetch base ---------------- */
async function doFetch(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ac.signal });
    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text().catch(() => "");

    if (!res.ok) {
      const err = new Error(
        `HTTP ${res.status} ${res.statusText} | ${bodyText.slice(0, 300)}`
      );
      if (res.status === 401) err.code = "AUTH_401";
      throw err;
    }

    if (contentType.includes("application/json")) {
      return bodyText ? JSON.parse(bodyText) : null;
    }
    throw new Error(
      `Respuesta no-JSON (${contentType || "desconocido"}): ${bodyText.slice(
        0,
        150
      )}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- Helpers de mapeo a la API ---------------- */
/**
 * Acepta payload de la UI (nombre, precioVenta, estado, etc.) o nombres API.
 * Devuelve objeto con los nombres que espera tu backend.
 * IMPORTANTE: Activo = 1, Inactivo = 2.
 */
function mapToApi(payload = {}) {
  // Si ya viene con nombres de la API, respétalos
  if (
    payload &&
    (payload.nombre_membresia || payload.precio_de_venta !== undefined)
  ) {
    const bodyApi = { ...payload };
    if (
      bodyApi.precio_de_venta !== undefined &&
      typeof bodyApi.precio_de_venta !== "number"
    ) {
      bodyApi.precio_de_venta = Number(bodyApi.precio_de_venta);
    }
    if (bodyApi.id_estado !== undefined) {
      bodyApi.id_estado = Number(bodyApi.id_estado) === 1 ? 1 : 2; // 1 activo, 2 inactivo
    }
    return bodyApi;
  }

  return {
    nombre_membresia: payload.nombre,
    descripcion_membresia: payload.descripcion ?? "",
    precio_de_venta: Number(payload.precioVenta),
    id_estado: payload.estado === "Activo" ? 1 : 2, // mapeo UI→API (numérico)
    codigo_membresia: payload.codigo,
    duracion: payload.duracion,
    beneficios: payload.beneficios,
  };
}

/**
 * Construye un body COMPLETO para PUT a partir del objeto actual (del backend)
 * y overrides (solo lo que quieres cambiar). Garantiza tipos numéricos.
 * IMPORTANTE: Activo = 1, Inactivo = 2.
 */
function buildFullPutBodyFromCurrent(current = {}, overrides = {}) {
  // valores actuales (acepta varios alias)
  const curNombre = current.nombre_membresia ?? current.nombre ?? "";
  const curDescripcion =
    current.descripcion_membresia ?? current.descripcion ?? "";
  const curPrecio =
    current.precio_de_venta ?? current.precioVenta ?? current.precio ?? 0;

  // id_estado actual (1 activo / 2 inactivo por defecto)
  const curEstado =
    current.id_estado !== undefined
      ? Number(current.id_estado) === 1
        ? 1
        : 2
      : typeof current.estado === "string"
      ? current.estado.toLowerCase() === "activo"
        ? 1
        : 2
      : 2;

  const curCodigo = current.codigo_membresia ?? current.codigo ?? "";
  const curDuracion = current.duracion ?? "";
  const curBeneficios = current.beneficios ?? [];

  // aplica overrides (acepta nombres UI o API)
  const out = {
    nombre_membresia:
      overrides.nombre_membresia ?? overrides.nombre ?? curNombre,
    descripcion_membresia:
      overrides.descripcion_membresia ??
      overrides.descripcion ??
      curDescripcion,
    precio_de_venta:
      overrides.precio_de_venta !== undefined
        ? Number(overrides.precio_de_venta)
        : overrides.precioVenta !== undefined
        ? Number(overrides.precioVenta)
        : Number(curPrecio),
    id_estado:
      overrides.id_estado !== undefined
        ? Number(overrides.id_estado) === 1
          ? 1
          : 2
        : overrides.estado !== undefined
        ? overrides.estado === "Activo"
          ? 1
          : 2
        : curEstado,
    codigo_membresia:
      overrides.codigo_membresia ?? overrides.codigo ?? curCodigo,
    duracion: overrides.duracion ?? curDuracion,
    beneficios: overrides.beneficios ?? curBeneficios,
  };

  return out;
}

/* ---------------- API pública ---------------- */
export async function obtenerMembresias({ token, query = {} } = {}) {
  const u = toRuntimeUrl(BASE_URL);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "")
      u.searchParams.set(k, String(v));
  });

  const datosObtenidosMembresias = await doFetch(u.toString(), {
    method: "GET",
    headers: buildHeaders(token),
  });
  return datosObtenidosMembresias;
}

export async function obtenerMembresiaPorId(id, { token } = {}) {
  if (!id) throw new Error("ID requerido");
  const url = `${BASE_URL}/${encodeURIComponent(id)}`;
  return doFetch(url, {
    method: "GET",
    headers: buildHeaders(token),
  });
}

export async function crearMembresia(payload, { token } = {}) {
  const bodyApi = mapToApi(payload);
  return doFetch(BASE_URL, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(bodyApi),
  });
}

/**
 * EDITAR membresía: PUT con body completo mapeado desde la UI
 */
export async function actualizarMembresia(id, payload, { token } = {}) {
  if (!id) throw new Error("ID requerido para actualizar");
  const url = `${BASE_URL}/${encodeURIComponent(id)}`;
  const bodyApi = mapToApi(payload);
  return doFetch(url, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify(bodyApi),
  });
}

/**
 * CAMBIAR ESTADO: PUT obligatorio.
 * - Hace GET para obtener el objeto actual.
 * - Construye un body COMPLETO y cambia solo id_estado (numérico 1/2).
 */
export async function actualizarEstadoMembresia(id, isActivo, { token } = {}) {
  if (!id) throw new Error("ID requerido para actualizar estado");
  const url = `${BASE_URL}/${encodeURIComponent(id)}`;

  // 1) GET objeto actual
  const current = await obtenerMembresiaPorId(id, { token });
  const currentObj =
    current && typeof current === "object" ? current.data ?? current : {};

  // 2) Construir body completo cambiando solo el estado
  const bodyApi = buildFullPutBodyFromCurrent(currentObj, {
    id_estado: isActivo ? 1 : 2,
  });

  // 3) PUT con body completo (evita 400 por campos faltantes)
  return doFetch(url, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify(bodyApi),
  });
}

export async function eliminarMembresia(id, { token } = {}) {
  if (!id) throw new Error("ID requerido para eliminar");
  const url = `${BASE_URL}/${encodeURIComponent(id)}`;
  return doFetch(url, {
    method: "DELETE",
    headers: buildHeaders(token),
  });
}
