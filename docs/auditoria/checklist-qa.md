# Checklist QA manual

Fecha de ejecucion: 2026-02-22

## 1) Calidad estatica minima

- Comando: `npm run lint`
- Resultado actual: **FAIL**
- Evidencia: 156 hallazgos totales (139 errores, 17 warnings).
- Estado de objetivo: **Parcial** (se redujeron errores desde baseline y se eliminaron errores criticos de runtime en archivos clave).

## 2) Build de integridad

- Comando: `npm run build`
- Resultado actual: **PASS**
- Evidencia: compilacion Vite completada exitosamente.

## 3) Smoke autenticacion

Checklist manual (requiere backend disponible):

- [ ] Login admin redirige a `/admin/dashboard`
- [ ] Login empleado redirige a `/empleados/dashboardEmpleado`
- [ ] Login usuario redirige a `/cliente/dashboard-usuario`
- [ ] Caso cuenta no verificada reenvia correo y redirige a `/verificar-cuenta`
- [ ] Logout limpia sesion y bloquea rutas privadas

## 4) Smoke modulos admin core

- [ ] Usuarios: listar / crear / editar / eliminar / cambiar estado
- [ ] Roles: listar / crear / editar / eliminar / cambiar estado
- [ ] Clientes: listar / crear / editar / relacionar beneficiarios
- [ ] Ventas: crear / ver detalle / actualizar estado
- [ ] Pedidos: crear / ver / actualizar estado / eliminar

## 5) Smoke citas y asistencias

- [ ] AsignarCita: crear / editar / eliminar
- [ ] Asistencias cliente: crear / editar / eliminar
- [ ] Asistencias empleado: crear / editar / eliminar

## 6) Smoke beneficiario

- [ ] Servicios usuario: visualizacion de membresia y servicios
- [ ] Pedidos usuario: consulta y detalle
- [ ] Agendar cita: disponibilidad y creacion segun permisos

## 7) Regresion visual

- [ ] Validar que no haya cambios CSS no intencionales en admin
- [ ] Validar que no haya cambios CSS no intencionales en landing
- [ ] Validar experiencia responsive basica en dashboard y landing

## Bloqueadores activos para QA funcional completo

- API backend en estado `404` en endpoints criticos (`/usuarios`, `/ventas`, `/servicios`, `/compras`, `/agenda`, `/asistencias`).
- Hasta corregir conectividad/contrato de rutas backend, el smoke funcional queda en estado parcial.
