FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV CI=true \
  NODE_ENV=development

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-bookworm AS runtime

ENV PORT=8080
LABEL org.opencontainers.image.source="https://github.com/SantiagoAtehortuaSoto/LGYM-front-despliegue"

USER root

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/40-env-config.sh /docker-entrypoint.d/40-env-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-env-config.sh \
  && chmod 0555 /docker-entrypoint.d/40-env-config.sh

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html

USER 101:101

EXPOSE 8080
