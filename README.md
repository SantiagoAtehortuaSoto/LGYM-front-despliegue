# LGYM Frontend

Frontend en React + Vite para LGYM, listo para ejecutarse en desarrollo y para publicarse como contenedor con Docker Desktop.

## Desarrollo local

```bash
npm install
npm run dev
```

## Variables de entorno

Usa `.env.example` como referencia. La variable principal es:

- `VITE_API_BASE_URL`: URL publica del backend accesible desde el navegador. Ejemplo local: `http://localhost:3000`

## Docker Desktop

1. Crea tu archivo `.env` a partir de `.env.example` y ajusta `VITE_API_BASE_URL`.
2. Construye y levanta el contenedor:

```bash
docker compose up --build -d
```

3. Abre la app en `http://localhost:8080`

Para detenerlo:

```bash
docker compose down
```

## Build y ejecucion manual

```bash
docker build -t lgym-frontend .
docker run -d --name lgym-frontend -p 8080:80 -e VITE_API_BASE_URL=http://localhost:3000 lgym-frontend
```

## Despliegue

La imagen sirve archivos estaticos con `nginx` y soporta fallback de rutas para `React Router`. La configuracion del frontend se inyecta en runtime mediante `env-config.js`, por lo que puedes reutilizar la misma imagen en distintos entornos cambiando solo las variables del contenedor.

Importante: la URL de la API debe ser alcanzable desde el navegador del usuario final. Si tu backend corre en otro dominio o puerto, configura CORS o publica ambos servicios detras del mismo dominio.

## Deploy en Render

Este repo se puede desplegar como `Web Service` con runtime `Docker`.

Si usas el panel de Render:

1. Conecta el repositorio.
2. Crea un `Web Service`.
3. Selecciona `Docker`.
4. Si Render toma la raiz del repo, apunta el servicio al frontend (`rootDir: LGYM`) o usa `LGYM/Dockerfile` como Dockerfile path.
5. Configura la variable `VITE_API_BASE_URL` con la URL publica de tu backend.

La imagen ya soporta el puerto dinamico de Render y expone `GET /healthz` para health checks.
