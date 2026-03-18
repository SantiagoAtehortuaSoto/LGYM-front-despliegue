import { buildUrl } from "../apiConfig";

// src/shared/services/membresías.api.js

const URL_MEMBRESIA = buildUrl("/membresias");
const URL_DETALLES_MEMBRESIA = buildUrl("/detalles_membresias");

/* ======================================================
   Depuración HTTP (logs bonitos y token protegido)
====================================================== */
function sanitizeBearer(token) {
  if (!token) return undefined;
  return token.replace(/^Bearer\s+/i, "");
}

const toRuntimeUrl = (value) =>
  new URL(
    value,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );

async function logAndFetch(label, url, init = {}) {
  const method = (init.method || "GET").toUpperCase();

  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`${method} ${url} -> ${res.status} ${res.statusText} | ${text.slice(0, 300)}`);
  }

  if (!text) return null; // 204 o vacío
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return JSON.parse(text);
  return text;
}

/* ======================================================
   GET: Listado de membresías (con detalles incluidos)
====================================================== */
export async function getMembresias({ token, query = {}, extraHeaders = {} } = {}) {
  const u = toRuntimeUrl(URL_MEMBRESIA);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);

  const headers = {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {}),
    ...extraHeaders,
  };

  try {
    // Obtener membresías y detalles en paralelo
    const [membresiasRes, detallesRes] = await Promise.all([
      logAndFetch("[Membresías][GET listado]", u.toString(), {
        method: "GET",
        headers,
        signal: ac.signal,
      }),
      logAndFetch("[Detalles Membresías][GET listado]", URL_DETALLES_MEMBRESIA, {
        method: "GET",
        headers,
        signal: ac.signal,
      }).catch((err) => {
        console.error("[Membresías] No se pudieron obtener detalles:", err);
        return []; // Retornar array vacío si falla
      }),
    ]);

    // Procesar membresías
    const membresiasArray = Array.isArray(membresiasRes?.data)
      ? membresiasRes.data
      : Array.isArray(membresiasRes)
      ? membresiasRes
      : [];

    // Procesar detalles
    const detallesArray = Array.isArray(detallesRes?.data)
      ? detallesRes.data
      : Array.isArray(detallesRes)
      ? detallesRes
      : [];

    // Crear mapa de detalles por id_membresia
    const detallesPorMembresia = detallesArray.reduce((acc, detalle) => {
      const idMembresia = detalle.id_membresia;
      if (!acc[idMembresia]) {
        acc[idMembresia] = [];
      }
      acc[idMembresia].push(detalle);
      return acc;
    }, {});

    // Agregar detalles a cada membresía
    const membresiasConDetalles = membresiasArray.map((membresia) => ({
      ...membresia,
      detalles_membresias: detallesPorMembresia[membresia.id_membresias] || [],
    }));

    // Retornar en el mismo formato que antes
    if (Array.isArray(membresiasRes)) return membresiasConDetalles;
    if (membresiasRes && typeof membresiasRes === "object") {
      return { ...membresiasRes, data: membresiasConDetalles };
    }
    return membresiasConDetalles;

  } finally {
    clearTimeout(timer);
  }
}

/* ======================================================
   POST: Crear membresía
====================================================== */
export async function crearMembresia(body, { token } = {}) {
  // Mapear campos del frontend al esquema esperado por el backend
  const payload = {
    nombre: body.nombre || body.nombre_membresia,
    descripcion: body.descripcion || body.descripcion_membresia,
    precioVenta: Number(body.precioVenta || body.precio_de_venta || 0),
    estado: body.estado || (body.id_estado === 1 || body.id_estado === "1" ? "Activo" : "Inactivo"),
    duracion_dias: Number(body.duracion_dias || body.duracion || 0),
    beneficios: Array.isArray(body.beneficios) ? body.beneficios : [],
  };

  return logAndFetch("[Membresías][POST crear]", URL_MEMBRESIA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

/* ======================================================
   PUT: Actualizar membresía (cuerpo completo)
====================================================== */
export async function actualizarMembresia(id, body, { token } = {}) {
  // Mapear campos del frontend al esquema esperado por el backend
  const payload = {
    nombre: body.nombre || body.nombre_membresia,
    descripcion: body.descripcion || body.descripcion_membresia,
    precioVenta: Number(body.precioVenta || body.precio_de_venta || 0),
    estado: body.estado || (body.id_estado === 1 || body.id_estado === "1" ? "Activo" : "Inactivo"),
    duracion_dias: Number(body.duracion_dias || body.duracion || 0),
    beneficios: Array.isArray(body.beneficios) ? body.beneficios : [],
  };

  const url = `${URL_MEMBRESIA}/${encodeURIComponent(id)}`;
  return logAndFetch("[Membresías][PUT actualizar]", url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

/* ======================================================
   PUT: Cambiar estado (robusto: GET → PUT con cuerpo completo)
   - Evita problemas si el servidor NO acepta parches parciales.
====================================================== */
export async function actualizarEstadoMembresia(id, nuevoEstado, { token } = {}) {
  const idNum = Number(id);
  const url = `${URL_MEMBRESIA}/${encodeURIComponent(idNum)}`;
  const authHeader = token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {};

  // 1) Obtener objeto actual
  const current = await logAndFetch("[Membresías][GET por id]", url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...authHeader,
    },
  });

  // Soporta backend que responde { data: {...} } o el objeto directo
  const cur = current && typeof current === "object" ? current.data ?? current : {};

  // 2) Construir body COMPLETO con estado actualizado
  const fullBody = {
    nombre: cur.nombre_membresia ?? cur.nombre ?? "",
    descripcion: cur.descripcion_membresia ?? cur.descripcion ?? "",
    precioVenta: Number(
      cur.precio_de_venta ?? cur.precio ?? cur.precioVenta ?? 0
    ),
    id_estado: Number(nuevoEstado),
    duracion_dias: Number(cur.duracion_dias ?? cur.duracion ?? 0),
    beneficios: Array.isArray(cur.beneficios) ? cur.beneficios : [],
  };

  // 3) PUT completo
  return logAndFetch("[Membresías][PUT estado completo]", url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...authHeader,
    },
    body: JSON.stringify(fullBody),
  });
}

/* ======================================================
   GET: Detalles de membresías (servicios asociados)
====================================================== */
export async function getDetallesMembresias({ token, query = {}, extraHeaders = {} } = {}) {
  const u = toRuntimeUrl(URL_DETALLES_MEMBRESIA);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);

  const headers = {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {}),
    ...extraHeaders,
  };

  try {
    return await logAndFetch("[Detalles Membresías][GET listado]", u.toString(), {
      method: "GET",
      headers,
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/* ======================================================
   DELETE: Eliminar membresía
====================================================== */
export async function eliminarMembresia(id, { token } = {}) {
  const url = `${URL_MEMBRESIA}/${encodeURIComponent(id)}`;
  await logAndFetch("[Membresías][DELETE eliminar]", url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {}),
    },
  });
  return true;
}
