#!/bin/sh
set -e

# Generar env-config.js dinámicamente desde variables de entorno
cat > /usr/share/nginx/html/env-config.js << EOF
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  API_PROXY_TARGET: "${API_PROXY_TARGET:-}",
  VITE_API_URL: "${VITE_API_URL:-}",
  VITE_API_URL_OVERRIDE: "${VITE_API_URL_OVERRIDE:-false}",
  VITE_API_PATH_PREFIX: "${VITE_API_PATH_PREFIX:-}",
  VITE_API_PRODUCTOS_URL: "${VITE_API_PRODUCTOS_URL:-}",
  VITE_DEV_USE_PROXY: "${VITE_DEV_USE_PROXY:-false}",
  VITE_DIAS_PLAZO_RECLAMO: "${VITE_DIAS_PLAZO_RECLAMO:-3}"
};
EOF

# Configurar proxy inverso si API_PROXY_TARGET está definido
if [ -n "$API_PROXY_TARGET" ]; then
  # Reemplazar la configuración del proxy en default.conf
  sed -i "s|return 502 \"API proxy not configured\";|proxy_pass $API_PROXY_TARGET/;\n        proxy_set_header Host \$host;\n        proxy_set_header X-Real-IP \$remote_addr;\n        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto \$scheme;\n        proxy_hide_header X-Powered-By;\n        proxy_hide_header Access-Control-Allow-Origin;\n        proxy_hide_header Access-Control-Allow-Methods;\n        proxy_hide_header Access-Control-Allow-Headers;\n        add_header Cache-Control \"no-store\";|" /etc/nginx/conf.d/default.conf
  
  echo "✅ API Proxy configurado: /api -> $API_PROXY_TARGET"
else
  echo "⚠️  API Proxy NO configurado (API_PROXY_TARGET no definido)"
fi

# Ejecutar el comando original (nginx)
exec "$@"
