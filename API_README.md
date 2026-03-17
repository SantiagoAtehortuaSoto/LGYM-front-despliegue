# API Services Implementation

## Overview
Los componentes de servicios han sido adaptados para consumir una API REST usando fetch en lugar de datos estáticos. Esta implementación incluye fallback automático a datos locales cuando la API no está disponible.

## Files Modified

### 1. API Service (`src/shared/services/services.jsx`)
- **serviciosAPI**: Funciones CRUD para servicios del admin
  - `getAll()`: Obtener todos los servicios
  - `getById(id)`: Obtener servicio por ID
  - `create(servicioData)`: Crear nuevo servicio
  - `update(id, servicioData)`: Actualizar servicio
  - `delete(id)`: Eliminar servicio
  - `updateStatus(id, estado)`: Cambiar estado del servicio

- **planesAPI**: Funciones CRUD para planes del landing
  - `getAll()`: Obtener todos los planes
  - `getById(id)`: Obtener plan por ID
  - `create(planData)`: Crear nuevo plan
  - `update(id, planData)`: Actualizar plan
  - `delete(id)`: Eliminar plan

### 2. Admin Component (`src/features/dashboard/pages/admin/servicios/servicios.jsx`)
- Reemplazado `serviciosData` estático con `serviciosAPI.getAll()`
- Agregados estados de `loading` y `error`
- Funciones CRUD actualizadas para usar API
- Mantenidas todas las clases CSS existentes

### 3. Landing Component (`src/shared/components/servicios-l/paquetes.jsx`)
- Reemplazado import de datos estáticos con `planesAPI.getAll()`
- Agregados estados de `loading` y `error`
- Fallback automático a datos locales si API falla

## Configuration

### API URL (Hardcodeada)
La URL de la API está definida directamente en el código para evitar errores de `process.env`:

```javascript
// src/shared/services/services.jsx
const API_BASE_URL = 'https://totalitarian-punchily-lon.ngrok-free.dev';
```

### Cambiar la URL
Para cambiar la URL de la API, edita directamente el archivo:
```
src/shared/services/services.jsx:2
```

**Archivos de configuración:**
- ✅ URL hardcodeada en `services.jsx`
- ✅ Variables de entorno como referencia
- ✅ Sin dependencias de `process.env`

### Current API Base URL
```
https://totalitarian-punchily-lon.ngrok-free.dev
```

**Nota**: Si cambias la URL de la API, actualiza el archivo `.env` y reinicia el servidor de desarrollo.

## API Endpoints Expected

### Servicios
- `GET https://totalitarian-punchily-lon.ngrok-free.dev/servicios/` - Obtener todos los servicios
- `GET https://totalitarian-punchily-lon.ngrok-free.dev/servicios/:id` - Obtener servicio por ID
- `POST https://totalitarian-punchily-lon.ngrok-free.dev/servicios/` - Crear nuevo servicio
- `PUT https://totalitarian-punchily-lon.ngrok-free.dev/servicios/:id` - Actualizar servicio
- `DELETE https://totalitarian-punchily-lon.ngrok-free.dev/servicios/:id` - Eliminar servicio
- `PATCH https://totalitarian-punchily-lon.ngrok-free.dev/servicios/:id/status` - Cambiar estado del servicio

## Body Request (Crear/Actualizar Servicio)
```json
{
  "nombre_servicio": "Nombre del Servicio",
  "descripcion_servicio": "Descripción detallada del servicio.",
  "precio_servicio": 100.00,
  "periodicidad": 30,
  "id_estado": 1
}
```

### Estados de Servicio
- `id_estado: 1` = Activo
- `id_estado: 2` = Inactivo

### Campo Estado en DataTable
- `1` → "Activo" (color verde)
- `2` → "Inactivo" (color rojo)

## Status Change API
```javascript
// Frontend → API
statusConfig: {
  values: { active: 1, inactive: 2 },
  colors: { active: '#4caf50', inactive: '#f44336' }
}
```

## API Response Mapping

### Frontend → API (Request)
```javascript
const mapFrontendToApi = (frontendData) => ({
  nombre_servicio: frontendData.nombre_servicio,
  descripcion_servicio: frontendData.descripcion_servicio,
  precio_servicio: frontendData.precio_servicio,
  periodicidad: frontendData.periodicidad,
  id_estado: frontendData.id_estado
});
```

### API → Frontend (Response)
```javascript
const mapApiToFrontend = (apiData) => ({
  id: apiData.id,
  nombre_servicio: apiData.nombre_servicio,
  descripcion_servicio: apiData.descripcion_servicio,
  precio_servicio: apiData.precio_servicio,
  periodicidad: apiData.periodicidad,
  id_estado: apiData.id_estado,
  fechaCreacion: apiData.fechaCreacion
});
```

### Planes (Landing Page)
- `GET https://totalitarian-punchily-lon.ngrok-free.dev/planes/` - Obtener todos los planes
- `GET https://totalitarian-punchily-lon.ngrok-free.dev/planes/:id` - Obtener plan por ID
- `POST https://totalitarian-punchily-lon.ngrok-free.dev/planes/` - Crear nuevo plan
- `PUT https://totalitarian-punchily-lon.ngrok-free.dev/planes/:id` - Actualizar plan
- `DELETE https://totalitarian-punchily-lon.ngrok-free.dev/planes/:id` - Eliminar plan

## Código Limpio

La implementación ha sido **completamente limpiada** de código innecesario:

### ✅ Archivos Eliminados
- `src/shared/utils/data/ejemploServicios.js` - Datos de ejemplo de servicios
- `src/shared/utils/data/ejemploPlanes.js` - Datos de ejemplo de planes
- `src/shared/utils/data/servicios.js` - Datos originales de planes
- `.env` y `.env.example` - Variables de entorno no utilizadas

### ✅ Código Limpio en Componentes
- ❌ **Eliminados** imports innecesarios
- ❌ **Eliminadas** variables no utilizadas (`filtroEstado`)
- ❌ **Eliminadas** referencias a archivos inexistentes
- ✅ **Columnas definidas** directamente en componentes
- ✅ **Sin datos de respaldo** locales

### ✅ Funcionalidad Preservada
- ✅ **API Integration** completa y funcional
- ✅ **Error Handling** con mensajes claros
- ✅ **Loading States** para mejor UX
- ✅ **Responsive Design** mantenido
- ✅ **CSS Styles** preservados

## Features

- ✅ **Fetch API**: Usa fetch nativo del navegador
- ✅ **Error Handling**: Manejo completo de errores con mensajes de usuario
- ✅ **Loading States**: Indicadores de carga durante las peticiones
- ✅ **No Fallback Data**: Depende completamente de la API real
- ✅ **Toast Notifications**: Notificaciones de éxito/error
- ✅ **CSS Preservation**: Mantiene todas las clases CSS existentes
## Debugging de API

### ✅ Funciones de Utilidad Disponibles

**Para verificar la API desde la consola del navegador:**

```javascript
// Importar las funciones de utilidad
import { checkApiStatus, testAllApiUrls } from './src/shared/services/services';

// Verificar estado de la API
checkApiStatus().then(result => console.log(result));

// Probar todas las URLs disponibles
testAllApiUrls().then(url => console.log('API funcionando en:', url));

// Cambiar URL dinámicamente
setApiBaseUrl('http://localhost:3001');

// Agregar nueva URL
addApiUrl('http://localhost:8000');
```

### 🔧 Funciones Disponibles en Consola

**Funciones automáticas (se ejecutan al cargar):**
```javascript
// ✅ Disponibles en window object
window.checkApiStatus()    // Verificar API actual
window.testAllApiUrls()    // Probar todas las URLs
window.autoDetectApi()     // Auto-detect API funcional
window.setApiBaseUrl(url)  // Cambiar URL dinámicamente
window.addApiUrl(url)      // Agregar nueva URL
```

**Funciones para debugging manual:**
```javascript
// ✅ Disponibles globalmente
testApiEndpoint('https://totalitarian-punchily-lon.ngrok-free.dev/api/servicios')
checkApiStatus()
autoDetectApi()
```

### 🔍 Verificar Conectividad de API

1. **Abre las herramientas de desarrollador** (F12)
2. **Ve a la pestaña Console**
3. **Ejecuta en la consola:**
   ```javascript
   // Verificar estado de la API
   window.checkApiStatus && checkApiStatus().then(console.log);

   // O probar manualmente
   fetch('https://totalitarian-punchily-lon.ngrok-free.dev/servicios')
     .then(r => console.log('Status:', r.status, r.statusText))
     .catch(e => console.error('Error:', e));
   ```

### 🚨 Errores Comunes de API

### 🚨 Solución para "HTML instead of JSON" Error

Si recibes el error **"API returned HTML instead of JSON"**, significa que la API está devolviendo una página web en lugar de datos JSON:

#### **1. Verificar la API Manualmente**

Abre las herramientas de desarrollador (F12) y ejecuta en la consola:

```javascript
// Probar la URL actual
fetch('https://totalitarian-punchily-lon.ngrok-free.dev/servicios')
  .then(r => {
    console.log('Status:', r.status);
    console.log('Content-Type:', r.headers.get('content-type'));
    return r.text();
  })
  .then(text => console.log('Response:', text.substring(0, 200)))
  .catch(e => console.error('Error:', e));
```

#### **2. Probar Endpoints Alternativos**

```javascript
// Probar con /api/servicios
fetch('https://totalitarian-punchily-lon.ngrok-free.dev/api/servicios')
  .then(r => r.json())
  .then(data => console.log('API funciona:', data))
  .catch(e => console.error('Error:', e));

// Probar solo la raíz
fetch('https://totalitarian-punchily-lon.ngrok-free.dev/')
  .then(r => r.text())
  .then(text => console.log('Root response:', text.substring(0, 200)));
```

#### **3. Verificar URLs Alternativas**

La aplicación probará automáticamente estas URLs:

```javascript
const API_URLS = [
  'https://totalitarian-punchily-lon.ngrok-free.dev',     // ✅ Principal
  'https://totalitarian-punchily-lon.ngrok-free.dev/api', // ✅ Con /api
  'https://totalitarian-punchily-lon.ngrok-free.dev/servicios', // ✅ Con /servicios
  'http://localhost:3001',                                 // ✅ Desarrollo
  'http://localhost:3000',                                 // ✅ Alternativo
  // ... más URLs
];
```

#### **4. Si la API no funciona:**

**Opción A: Cambiar la URL manualmente**
```javascript
// Editar en src/shared/services/services.jsx
const API_BASE_URL = 'http://localhost:3001'; // Si usas localhost
```

**Opción B: Verificar ngrok**
```bash
# En la terminal donde ejecutas ngrok:
ngrok http 3001

# Deberías ver algo como:
# Forwarding    https://totalitarian-punchily-lon.ngrok-free.dev -> http://localhost:3001
```

**Opción C: Verificar el servidor backend**
```bash
# Asegúrate que tu servidor backend esté ejecutándose:
npm start        # o el comando que uses
# Debería mostrar: Server running on port 3001
```

#### **5. Comandos de Debug en Consola**

```javascript
// Verificar todas las URLs automáticamente
autoDetectApi().then(result => console.log(result));

// Probar una URL específica
testApiEndpoint('https://totalitarian-punchily-lon.ngrok-free.dev/api/servicios');

// Ver estado actual
checkApiStatus().then(console.log);
```

## ✅ Error de Sintaxis Solucionado

El error **"import and export cannot be used outside of module code"** ha sido completamente corregido:

### 🔧 **Problema Original:**
```javascript
// ❌ Error: funciones referenciadas antes de ser definidas
export const testApiEndpoint = async (url) => { ... }
window.testApiEndpoint = testApiEndpoint; // ← Error aquí
```

### ✅ **Solución Implementada:**

#### **1. Reorganización del Código**
```javascript
// ✅ Funciones definidas primero
const testApiEndpoint = async (url) => { ... }
const checkApiStatus = async () => { ... }

// ✅ Luego asignadas a window
if (typeof window !== 'undefined') {
  window.testApiEndpoint = testApiEndpoint;
  window.checkApiStatus = checkApiStatus;
}

// ✅ Y finalmente exportadas
export { testApiEndpoint, checkApiStatus };
```

#### **2. Estructura Correcta del Módulo**
```javascript
// ✅ services.jsx - Estructura correcta
const API_BASE_URL = 'https://totalitarian-punchily-lon.ngrok-free.dev';
const API_URLS = [...];
const testApiEndpoint = async (url) => { ... };
const checkApiStatus = async () => { ... };
export const serviciosAPI = { ... };
export const planesAPI = { ... };
export { testApiEndpoint, checkApiStatus };
```

#### **3. Exports Correctos**
```javascript
// ✅ Todas las funciones están correctamente exportadas
export const serviciosAPI = { ... };
export const planesAPI = { ... };
export { testApiEndpoint, testAllApiUrls, checkApiStatus, autoDetectApi };
```

### 🎯 **Funciones Disponibles Ahora:**

**En el código:**
```javascript
import { serviciosAPI, checkApiStatus } from './shared/services/services';
```

**En la consola del navegador:**
```javascript
// ✅ Funciones globales disponibles
window.checkApiStatus()
window.testAllApiUrls()
window.autoDetectApi()
window.setApiBaseUrl('http://localhost:3001')
```

**En la interfaz:**
- ✅ **Botón "🔍 Verificar API"** en el panel admin
- ✅ **Logs automáticos** en consola
- ✅ **Mensajes informativos** de error/success

#### **URLs Alternativas Configuradas**
```javascript
const API_URLS = [
  'https://totalitarian-punchily-lon.ngrok-free.dev',  // Principal
  'http://localhost:3001',                            // Desarrollo
  'http://localhost:3000',                            // Alternativo
  'http://127.0.0.1:3001'                           // IP local
];
```

### 📊 Logs de Debug

La aplicación ahora incluye **logs detallados** en la consola:

```javascript
🔄 API Request: /servicios {headers: {...}, method: "GET"}
📊 API Response Status: 200 OK
📄 Content-Type: application/json; charset=utf-8
✅ API Success: [...]
```

```javascript
🔄 API Request: /servicios {headers: {...}, method: "GET"}
📊 API Response Status: 404 Not Found
❌ API Error Response: <!DOCTYPE html><html>...</html>
❌ API returned HTML instead of JSON
```
