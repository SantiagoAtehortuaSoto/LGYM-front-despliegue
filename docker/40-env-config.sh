#!/bin/sh
set -eu

escape_js() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat > /usr/share/nginx/html/env-config.js <<EOF
window.__APP_CONFIG__ = {
  VITE_API_BASE_URL: "$(escape_js "${VITE_API_BASE_URL:-}")",
  VITE_API_URL: "$(escape_js "${VITE_API_URL:-}")",
  VITE_API_URL_OVERRIDE: "$(escape_js "${VITE_API_URL_OVERRIDE:-}")",
  VITE_API_PATH_PREFIX: "$(escape_js "${VITE_API_PATH_PREFIX:-}")",
  VITE_DEV_USE_PROXY: "$(escape_js "${VITE_DEV_USE_PROXY:-false}")",
  VITE_API_PRODUCTOS_URL: "$(escape_js "${VITE_API_PRODUCTOS_URL:-}")",
  VITE_DIAS_PLAZO_RECLAMO: "$(escape_js "${VITE_DIAS_PLAZO_RECLAMO:-3}")"
};
EOF
