# Matriz de flujo por modulo

Fecha de estado: 2026-02-22

| Modulo | Estado | Causa raiz principal |
|---|---|---|
| Routing/Auth base | Parcial | Se corrigieron duplicados y errores criticos, falta cerrar deuda de lint no bloqueante |
| Login / Verificacion | Parcial | Se corrigio `resendVerification`, requiere backend operativo para validacion completa |
| Usuarios | Parcial | Implementacion funcional, dependiente de API y con deuda tecnica residual |
| Roles | Parcial | Se corrigio hook condicional en modal; quedan mejoras de limpieza/estandarizacion |
| Clientes / Beneficiarios | Parcial | Flujo amplio implementado, depende de endpoints de usuarios/beneficiarios/membresias |
| Ventas | Parcial | Se corrigieron hooks condicionales en modal; dependencia API de ventas y catalogos |
| Ventas Membresias | Parcial | Dependencia total de API de ventas/membresias |
| Pedidos / Compras | Parcial | Funcionalidad extensa pero con alta deuda de lint en modales |
| Productos | Parcial | CRUD implementado, deuda de limpieza en modales |
| Proveedores | Parcial | CRUD implementado, deuda de limpieza en modales |
| Servicios | Parcial | Se corrigio token por request; dependencia backend activa |
| Membresias | Parcial | Funcionalidad estable en UI, dependencia backend para consistencia real |
| Citas (AsignarCita) | Bloqueado | API agenda no disponible (404) |
| Programar Citas | Funciona (local) | Flujo in-memory sin persistencia por diseno actual |
| Asistencias | Bloqueado | Endpoints de asistencias no disponibles |
| Beneficiario - Servicios | Parcial | Lógica amplia, depende de ventas/membresias/beneficiarios API |
| Beneficiario - Pedidos | Parcial | Depende de endpoint ventas/pedidos de usuario |
| Beneficiario - Agendar Cita | Bloqueado | Dependencia de agenda API |
| Dashboards admin/usuario | Funciona (mock/parcial) | Render y navegacion correctos; metricas mayormente estaticas |
| Navegacion lateral | Parcial | Se alinearon rutas clave y placeholders, faltan limpiezas adicionales |
| Infra transversal | Parcial | Se elimino provider duplicado en `App`; sigue deuda en archivos legacy |

## Estado global

- **Funciona:** flujos visuales y navegacion principal.
- **Parcial:** la mayoria de modulos de negocio (depende de API real).
- **Bloqueado:** flujos con dependencia directa de endpoints que hoy responden `404`.
