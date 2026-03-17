#!/bin/sh
set -eu

escape_js() {
  printf '%s' "${1:-}" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

normalize_url() {
  printf '%s' "${1:-}" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s:/*$::'
}

mkdir -p /etc/nginx/includes

API_PROXY_TARGET_NORMALIZED="$(normalize_url "${API_PROXY_TARGET:-}")"
APP_API_BASE_URL="${VITE_API_BASE_URL:-}"
APP_API_PRODUCTOS_URL="${VITE_API_PRODUCTOS_URL:-}"

if [ -n "$API_PROXY_TARGET_NORMALIZED" ]; then
  APP_API_BASE_URL="/api"

  cat > /etc/nginx/includes/api-proxy-location.conf <<EOF
location = /api {
  return 301 /api/;
}

location /api/ {
  proxy_http_version 1.1;
  proxy_ssl_server_name on;
  proxy_pass ${API_PROXY_TARGET_NORMALIZED}/;
  proxy_set_header Host \$proxy_host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_set_header Authorization \$http_authorization;
  proxy_set_header ngrok-skip-browser-warning "true";
}
EOF
else
  : > /etc/nginx/includes/api-proxy-location.conf
fi

cat > /usr/share/nginx/html/env-config.js <<EOF
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
