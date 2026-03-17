FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner

ENV PORT=80

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-env-config.sh /docker-entrypoint.d/40-env-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-env-config.sh \
  && chmod +x /docker-entrypoint.d/40-env-config.sh

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD sh -c 'wget -q -O /dev/null "http://127.0.0.1:${PORT:-80}/healthz" || exit 1'
