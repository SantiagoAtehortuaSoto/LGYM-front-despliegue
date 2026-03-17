import { getEnv, isDev } from "../../../config/appEnv";

const DEFAULT_API_BASE_URL = "http://localhost:3000";

const normalizeUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const ABSOLUTE_HTTP_URL_RE = /^https?:\/\//i;

const sanitizePublicUrl = (value, label) => {
  const normalized = normalizeUrl(value);
  if (!normalized) return "";
  if (ABSOLUTE_HTTP_URL_RE.test(normalized)) return normalized;

  if (typeof console !== "undefined") {
    console.warn(
      `[SECURITY] Ignorando ${label} porque no usa un esquema http(s) valido.`
    );
  }

  return "";
};

const stripApiSuffix = (value) => {
  const normalized = normalizeUrl(value);
  return normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized;
};

const joinUrl = (base, path) => {
  const baseNormalized = normalizeUrl(base);
  const pathStr = String(path || "").trim();
  if (!pathStr) return baseNormalized;
  if (ABSOLUTE_HTTP_URL_RE.test(pathStr)) return pathStr;
  if (pathStr.startsWith("/")) return `${baseNormalized}${pathStr}`;
  return `${baseNormalized}/${pathStr}`;
};

const normalizePathPrefix = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const noSlashes = raw.replace(/^\/+|\/+$/g, "");
  return noSlashes ? `/${noSlashes}` : "";
};

const envBase = sanitizePublicUrl(getEnv("VITE_API_BASE_URL"), "VITE_API_BASE_URL");
const envApi = sanitizePublicUrl(getEnv("VITE_API_URL"), "VITE_API_URL");
const apiUrlOverrideFlag = String(getEnv("VITE_API_URL_OVERRIDE", ""))
  .toLowerCase();
const useApiUrlOverride = ["1", "true", "yes", "on"].includes(
  apiUrlOverrideFlag
);
const hasExplicitBase = Boolean(envBase);
const devProxyFlag = String(getEnv("VITE_DEV_USE_PROXY", "true"))
  .toLowerCase()
  .trim();
const useDevProxy =
  isDev && !["0", "false", "no", "off"].includes(devProxyFlag);
const DEV_PROXY_BASE = "/api";
const apiPathPrefix = normalizePathPrefix(getEnv("VITE_API_PATH_PREFIX"));

export const API_BASE_URL = useDevProxy
  ? DEV_PROXY_BASE
  : envBase || stripApiSuffix(envApi) || DEFAULT_API_BASE_URL;
export const API_URL =
  useDevProxy
    ? API_BASE_URL
    : envApi && (useApiUrlOverride || !hasExplicitBase)
    ? envApi
    : apiPathPrefix
    ? joinUrl(API_BASE_URL, apiPathPrefix)
    : API_BASE_URL;

export const buildUrl = (path = "") => joinUrl(API_BASE_URL, path);
export const buildApiUrl = (path = "") => joinUrl(API_URL, path);

