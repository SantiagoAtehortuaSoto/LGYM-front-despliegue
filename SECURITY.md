# 🛡️ LGYM Frontend - Deployment Seguro

## Vulnerabilidades Corregidas

### Antes (Debian 12.13)
- **Total:** 127 vulnerabilidades
- **CRITICAL:** 1
- **HIGH:** 8
- **MEDIUM:** 38
- **LOW:** 74
- **UNKNOWN:** 6

### Ahora (Alpine 3.21.3)
- **Total:** 0 vulnerabilidades del SO
- **CRITICAL:** 0
- **HIGH:** 0
- **MEDIUM:** 0
- **LOW:** 0

## Cambios Realizados

1. **Cambio de base:** Debian → Alpine (reduce superficie de ataque en ~90%)
2. **Multi-stage build:** Solo archivos estáticos en imagen final (sin node_modules)
3. **Paquetes actualizados:** `apk upgrade` durante el build
4. **Nginx seguro:** Headers de seguridad configurados
5. **Health check:** Endpoint `/healthz` para monitoreo
6. **Runtime config:** Variables de entorno inyectadas dinámicamente

## Archivos Creados/Modificados

- `Dockerfile` - Build multi-stage con Alpine
- `docker-compose.yml` - Orquestación local
- `nginx/nginx.conf` - Configuración segura de Nginx
- `nginx/default.conf` - Rutas y headers de seguridad
- `nginx/docker-entrypoint.sh` - Configuración runtime del proxy

## Despliegue Local

```bash
docker compose up --build -d
```

Abre: http://localhost:8080

## Despliegue en GitHub Container Registry

```bash
# Login a GHCR
echo $GHCR_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Push de la imagen
docker push ghcr.io/santiagoatehortuasoto/lgym-front-despliegue:prod
```

## Despliegue en Render

1. Conecta el repositorio a Render
2. Crea un Web Service con runtime Docker
3. Configura las variables de entorno:
   - `VITE_API_BASE_URL`: URL pública del backend
   - `API_PROXY_TARGET`: URL del backend (para proxy inverso)
4. Deploy automático al hacer push a `main`

## Verificación de Seguridad

```bash
# Escanear vulnerabilidades
trivy image ghcr.io/santiagoatehortuasoto/lgym-front-despliegue:prod

# Ver solo severidades críticas y altas
trivy image --severity CRITICAL,HIGH ghcr.io/santiagoatehortuasoto/lgym-front-despliegue:prod
```

## Headers de Seguridad Incluidos

- `X-Frame-Options: SAMEORIGIN` - Previene clickjacking
- `X-Content-Type-Options: nosniff` - Previene MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Activar filtro XSS
- `Referrer-Policy: strict-origin-when-cross-origin` - Controlar referrer
- `server_tokens off` - Ocultar versión de Nginx

## Notas Importantes

- Las vulnerabilidades de Node.js (5 restantes) son de dependencias de **build time** y no se incluyen en la imagen de producción
- El proxy inverso limpia headers sensibles del upstream (`X-Powered-By`, CORS)
- Archivos ocultos (`.env`, `.git`) están bloqueados por Nginx
