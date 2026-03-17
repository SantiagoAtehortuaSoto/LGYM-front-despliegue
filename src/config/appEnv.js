const buildConfig = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_API_URL_OVERRIDE: import.meta.env.VITE_API_URL_OVERRIDE,
  VITE_API_PATH_PREFIX: import.meta.env.VITE_API_PATH_PREFIX,
  VITE_DEV_USE_PROXY: import.meta.env.VITE_DEV_USE_PROXY,
  VITE_API_PRODUCTOS_URL: import.meta.env.VITE_API_PRODUCTOS_URL,
  VITE_DIAS_PLAZO_RECLAMO: import.meta.env.VITE_DIAS_PLAZO_RECLAMO,
};

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

export const getRuntimeConfig = () => {
  if (typeof window === "undefined") return {};

  const config = window.__APP_CONFIG__;
  return config && typeof config === "object" ? config : {};
};

export const getEnv = (key, fallback = "") => {
  const runtimeValue = getRuntimeConfig()[key];
  if (hasValue(runtimeValue)) return String(runtimeValue).trim();

  const buildValue = buildConfig[key];
  if (hasValue(buildValue)) return String(buildValue).trim();

  return fallback;
};

export const isDev = Boolean(import.meta.env.DEV);
