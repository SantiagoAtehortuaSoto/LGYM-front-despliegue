import { buildUrl } from "../apiConfig";

const URL_API_BENEFICIARIO = buildUrl("/beneficiarios");

const buildHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseResponse = async (res) => {
  const text = await res.text();
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  if (!isJson) return { raw: text };
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.error("Beneficiario_API parse error:", e, text);
    return {};
  }
};

async function apiRequest(endpoint, options = {}) {
  const opts = {
    method: "GET",
    headers: buildHeaders(),
    ...options,
  };
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${URL_API_BENEFICIARIO}${endpoint}`, opts);
  const data = await parseResponse(res);
  if (!res.ok) {
    if (res.status === 404) {
      console.warn("Beneficiario_API 404 en", endpoint);
      return [];
    }
    const msg =
      data?.message ||
      data?.msg ||
      data?.error ||
      `Error ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

export async function obtenerBeneficiariosPorUsuario(idUsuario) {
  if (!idUsuario) return [];
  const data = await apiRequest(`/usuario/${encodeURIComponent(idUsuario)}`, {
    method: "GET",
  });
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

export async function obtenerBeneficiariosMios({ self = false, activo = false } = {}) {
  const params = [];
  if (self) params.push(`self=${encodeURIComponent(self === true ? 1 : self)}`);
  if (activo) params.push(`activo=${encodeURIComponent(activo === true ? 1 : activo)}`);
  const qs = params.length ? `?${params.join("&")}` : "";
  const data = await apiRequest(`/mios${qs}`, { method: "GET" });
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

export async function crearBeneficiario(payload) {
  return apiRequest("", { method: "POST", body: payload });
}

export default {
  obtenerBeneficiariosPorUsuario,
  obtenerBeneficiariosMios,
  crearBeneficiario,
};
