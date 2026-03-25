#!/bin/sh
set -eu

escape_js() {
  printf '%s' "${1:-}" | sed ':a;N;$!ba;s/\\/\\\\/g; s/"/\\"/g; s/\r/\\r/g; s/\n/\\n/g; s/\t/\\t/g'
}

normalize_url() {
  printf '%s' "${1:-}" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s:/*$::'
}

validate_public_value() {
  value="${1:-}"
  key="${2:-URL}"

  if [ -z "$value" ]; then
    return 0
  fi

  case "$value" in
    http://*|https://*|/*)
      return 0
      ;;
    *)
      echo "Invalid public value for $key. Use http://, https:// or a relative path like /api." >&2
      exit 1
      ;;
  esac
}

validate_public_value "${VITE_API_BASE_URL:-}" "VITE_API_BASE_URL"
validate_public_value "${VITE_API_URL:-}" "VITE_API_URL"
validate_public_value "${VITE_API_PRODUCTOS_URL:-}" "VITE_API_PRODUCTOS_URL"

API_PROXY_TARGET_NORMALIZED="$(normalize_url "${API_PROXY_TARGET:-}")"
APP_API_BASE_URL="${VITE_API_BASE_URL:-}"
APP_API_PRODUCTOS_URL="${VITE_API_PRODUCTOS_URL:-}"

if [ -n "$API_PROXY_TARGET_NORMALIZED" ]; then
  APP_API_BASE_URL="/api"

  cat > /tmp/api-proxy-location.conf <<EOF
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
  proxy_hide_header Access-Control-Allow-Origin;
  proxy_hide_header Access-Control-Allow-Headers;
  proxy_hide_header Access-Control-Allow-Methods;
  proxy_hide_header Access-Control-Allow-Credentials;
  proxy_hide_header Access-Control-Expose-Headers;
  proxy_hide_header Access-Control-Max-Age;
  proxy_hide_header ETag;
  proxy_hide_header Server;
  proxy_hide_header X-Powered-By;
  proxy_hide_header X-Render-Origin-Server;
  add_header Cache-Control "no-store, max-age=0, must-revalidate" always;
  add_header Pragma "no-cache" always;
  expires off;
}
EOF
else
  : > /tmp/api-proxy-location.conf
fi

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
