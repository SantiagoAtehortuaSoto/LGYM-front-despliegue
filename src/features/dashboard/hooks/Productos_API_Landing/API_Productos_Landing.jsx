import { getEnv } from "../../../../config/appEnv";
import { buildUrl } from "../apiConfig";

// src/features/dashboard/hooks/Productos_API_Landing/API_Productos_Landing.js

const URL_API_LANDING_PRODUCTOS =
  getEnv("VITE_API_PRODUCTOS_URL") || buildUrl("/productos");

const extractArrayPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const directCandidates = [
    payload.data,
    payload.productos,
    payload.items,
    payload.results,
    payload.rows,
    payload.list,
    payload.records,
  ];

  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      if (Array.isArray(candidate.data)) return candidate.data;
      if (Array.isArray(candidate.productos)) return candidate.productos;
      if (Array.isArray(candidate.items)) return candidate.items;
      if (Array.isArray(candidate.results)) return candidate.results;
      if (Array.isArray(candidate.rows)) return candidate.rows;
      if (Array.isArray(candidate.list)) return candidate.list;
      if (Array.isArray(candidate.records)) return candidate.records;
    }
  }

  return [];
};

/**
 * GET /productos
 * @param {Object} opts
 * @param {Object} [opts.headers]   Headers extra (ej. Authorization)
 * @param {Object} [opts.params]    Query params (ej. { limit: 50 })
 * @param {number} [opts.timeoutMs] Timeout en ms (default 10000)
 */
export async function getProductos({ headers = {}, params = {}, timeoutMs = 10000 } = {}) {
  // Construir querystring (soporta arrays)
  const qs = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map(x => [k, String(x)]) : [[k, String(v)]]
    )
  ).toString();

  const url = qs ? `${URL_API_LANDING_PRODUCTOS}?${qs}` : URL_API_LANDING_PRODUCTOS;

  // Timeout con AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "true",
        ...headers, // ej: { Authorization: `Bearer ...` }
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`GET ${res.status} ${res.statusText} – ${text}`);
    }

    // Protección por si la respuesta no es JSON válido
    let payload;
    try {
      payload = await res.json();
    } catch {
      throw new Error("Respuesta del servidor no es JSON válido");
    }

    // Si tu backend responde { data: [...] }, desanida aquí:
    // const data = Array.isArray(payload?.data) ? payload.data : payload;

    return extractArrayPayload(payload);
  } finally {
    clearTimeout(timer);
  }
}
