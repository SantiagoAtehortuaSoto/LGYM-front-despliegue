# ============================================
# Stage 1: Build
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar solo package files primero para mejor cache de Docker
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm ci --ignore-scripts

# Copiar el resto del código fuente
COPY . .

# Build de producción
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM nginx:1.27-alpine AS production

# Metadata
LABEL maintainer="lgym-team"
LABEL description="LGYM Frontend - Production"

# Instalar solo lo esencial y limpiar cache en una sola capa
RUN apk update && \
    apk upgrade --available && \
    rm -rf /var/cache/apk/*

# Copiar configuración de nginx personalizada
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copiar el build estático
COPY --from=builder /app/dist /usr/share/nginx/html

# Crear archivo env-config.js para inyección de variables en runtime
RUN echo "window.__ENV__ = {};" > /usr/share/nginx/html/env-config.js

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

# Exponer puerto
EXPOSE 8080

# Entry point para configuración en runtime
ENTRYPOINT ["/docker-entrypoint.sh"]

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]
