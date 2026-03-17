# Correcciones priorizadas por fase

## Fase 0 - Gate API

### Cambios aplicados

- `src/features/dashboard/hooks/apiConfig.js`
- `.env`
- `src/config/env.js`
- `docs/auditoria/fase0-conectividad.md`

### Resultado

- Regla de precedencia API definida: base URL principal y override explicito.
- Baseline de conectividad documentado con evidencia.

## Fase 1 - Bloqueantes criticos

### Cambios aplicados

- `src/App.jsx`
- `src/features/dashboard/pages/Landing/accederLanding.jsx`
- `src/features/dashboard/pages/admin/Ventas/modalVentas.jsx`
- `src/features/dashboard/pages/admin/Roles/modalRoles.jsx`
- `src/features/dashboard/pages/admin/Roles/PermissionSection.jsx`
- `src/features/dashboard/services/services.jsx`
- `src/features/dashboard/pages/admin/Empleados/modalEmpleados.jsx`
- `src/features/dashboard/pages/admin/productos/modales-productos.jsx`
- `src/features/dashboard/pages/admin/proveedores/modales-proveedores.jsx`
- `src/features/dashboard/pages/admin/seguimiento/modales-seguimiento.jsx`
- `src/features/dashboard/pages/admin/servicios/modales-servicios.jsx`
- `src/shared/components/servicios-l/paquetes.jsx`

### Resultado

- Eliminados bloqueantes de runtime: rutas duplicadas/ruido, import faltante en login, hooks condicionales en modales criticos, parse error en servicio legacy.
- Reduccion de errores globales de lint: **162 -> 139**.
- Errores criticos (`rules-of-hooks`, `no-undef`, `parse-error`, `no-constant-binary-expression`) en archivos criticos: **resueltos**.

## Fase 2 - Estabilizacion core

### Cambios aplicados

- `src/features/dashboard/hooks/Servicios_API/Servicios_API.jsx`

### Resultado

- Token ya no se congela a nivel modulo; se obtiene por request.

## Fase 3 - Navegacion y coherencia

### Cambios aplicados

- `src/shared/utils/data/links.js`
- `src/shared/components/sidebar/sidebar.jsx`

### Resultado

- Rutas admin normalizadas a lowercase.
- Placeholders `#` de cliente reemplazados por rutas funcionales.
- Ajuste menor en sidebar para evitar error lint.

## Fase 4 - Entregables de auditoria

### Cambios aplicados

- `docs/auditoria/matriz-componentes.md`
- `docs/auditoria/matriz-flujos.md`
- `docs/auditoria/checklist-qa.md`
- `docs/auditoria/correcciones-fases.md`

### Resultado

- Matriz completa de componentes con estado/riesgo/accion.
- Matriz de flujo por modulo.
- Checklist QA manual ejecutable.
