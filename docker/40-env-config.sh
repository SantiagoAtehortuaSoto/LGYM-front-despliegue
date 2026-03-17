#!/bin/sh
set -eu

escape_js() {
  printf '%s' "${1:-}" | sed ':a;N;$!ba;s/\\/\\\\/g; s/"/\\"/g; s/\r/\\r/g; s/\n/\\n/g; s/\t/\\t/g'
}

validate_public_url() {
  value="${1:-}"
  key="${2:-URL}"

  if [ -z "$value" ]; then
    return 0
  fi

  case "$value" in
    http://*|https://*)
      return 0
      ;;
    *)
      echo "Invalid public URL for $key. Only http:// or https:// values are allowed." >&2
      exit 1
      ;;
  esac
}

validate_public_url "${VITE_API_BASE_URL:-}" "VITE_API_BASE_URL"
validate_public_url "${VITE_API_URL:-}" "VITE_API_URL"
validate_public_url "${VITE_API_PRODUCTOS_URL:-}" "VITE_API_PRODUCTOS_URL"

cat > /tmp/env-config.js <<EOF
window.__APP_CONFIG__ = {
  VITE_API_BASE_URL: "$(escape_js "${APP_API_BASE_URL:-}")",
  VITE_API_URL: "$(escape_js "${VITE_API_URL:-}")",
  VITE_API_URL_OVERRIDE: "$(escape_js "${VITE_API_URL_OVERRIDE:-}")",
  VITE_API_PATH_PREFIX: "$(escape_js "${VITE_API_PATH_PREFIX:-}")",
  VITE_DEV_USE_PROXY: "$(escape_js "${VITE_DEV_USE_PROXY:-false}")",
  VITE_API_PRODUCTOS_URL: "$(escape_js "${APP_API_PRODUCTOS_URL:-}")",
  VITE_DIAS_PLAZO_RECLAMO: "$(escape_js "${VITE_DIAS_PLAZO_RECLAMO:-3}")"
};
EOF
