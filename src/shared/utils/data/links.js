export const comprasLinksAd = [
  { title: "Compras pend.", url: "/admin/pedidos" },
  { title: "Compras comp.", url: "/admin/pedidos/completados" },
  { title: "Productos", url: "/admin/productosAdmin" },
  { title: "Proveedores", url: "/admin/proveedores" },
];

export const ServiciosLInksAd = [
  { title: "Servicios", url: "/admin/serviciosAdmin" },
  { title: "Membresias", url: "/admin/membresiasAdmin" },
  { title: "Prog. empleados", url: "/admin/programarCita" },
  { title: "Asistencias", url: "/admin/asistencias" },
  { title: "Empleados", url: "/admin/empleados" },
];

export const ventasLinksAd = [
  { title: "Ventas pend.", url: "/admin/ventas" },
  { title: "Ventas Comp.", url: "/admin/ventas/completadas" },
  // { title: "Ventas Membresias", url: "/admin/ventasMembresias" },  
  { title: "Seguimiento Dep.", url: "/admin/seguimiento" },
  { title: "Gestion Clientes", url: "/admin/clientes" },
  // { title: "Agendar Citas", url: "/admin/asignarCita" },
];

export const configLinksAd = [
  { title: "Roles", url: "/admin/roles" },
  { title: "Usuarios", url: "/admin/usuarios" },
];

// Enlaces de configuración para empleados (si el rol los tiene asignados)
export const configLinksEmp = [
  {
    title: "Usuarios",
    url: "/empleados/usuarios",
    permisoId: 1,
    moduloKey: "usuarios",
  },
  {
    title: "Roles",
    url: "/empleados/roles",
    permisoId: 2,
    moduloKey: "roles",
  },
];

// Enlaces especificos para empleados (sin configuracion ni gestion de empleados)
export const comprasLinksEmp = [
  {
    title: "Productos",
    url: "/empleados/productos",
    permisoId: 3,
    moduloKey: "productos",
  },
  {
    title: "Proveedores",
    url: "/empleados/proveedores",
    permisoId: 4,
    moduloKey: "proveedores",
  },
  {
    title: "Compras",
    url: "/empleados/compras",
    permisoId: 7,
    moduloKey: "compras",
  },
  {
    title: "Compras Completadas",
    url: "/empleados/compras/completados",
    permisoId: 7,
    moduloKey: "compras",
  },
];

export const serviciosLinksEmp = [
  {
    title: "Servicios",
    url: "/empleados/servicios",
    permisoId: 5,
    moduloKey: "servicios",
  },
  {
    title: "Membresias",
    url: "/empleados/membresias",
    permisoId: 10,
    moduloKey: "membresias",
  },
  {
    title: "Asistencias",
    url: "/empleados/asistencias",
    permisoId: 16,
    moduloKey: "asistencia",
  },
  {
    title: "Asignar Citas",
    url: "/empleados/asignarCitas",
    permisoId: 18,
    moduloKey: "asignar citas",
  },
  {
    title: "Empleados",
    url: "/empleados/empleados",
    permisoId: 6,
    moduloKey: "empleados",
  },
];

export const VentasLinksEmp = [
  {
    title: "Ventas",
    url: "/empleados/ventas",
    permisoId: 8,
    moduloKey: "ventas",
  },
  {
    title: "Ventas Completadas",
    url: "/empleados/ventas/completadas",
    permisoId: 8,
    moduloKey: "ventas",
  },
  // {
  //   title: "Ventas Membresias",
  //   url: "/empleados/ventasMembresias",
  //   permisoId: 17,
  //   moduloKey: "ventas membresias",
  // },
  {
    title: "Seguimiento Deportivo",
    url: "/empleados/seguimientoDeportivo",
    permisoId: 15,
    moduloKey: "seguimiento deportivo",
  },
  {
    title: "Clientes",
    url: "/empleados/clientes",
    permisoId: 9,
    moduloKey: "clientes",
  },
];

// Enlaces para clientes (modulos relevantes para clientes)
export const membresiasLinksCliente = [
  { title: "Ver Membresias", url: "/cliente/serviciosUsuario" },
  { title: "Mi Membresia", url: "/cliente/serviciosUsuario" },
];

export const citasLinksCliente = [
  { title: "Agendar Cita", url: "/cliente/agendarCita" },
  { title: "Mis Citas", url: "/cliente/agendarCita" },
  { title: "Historial de Citas", url: "/cliente/agendarCita" },
];

export const seguimientoLinksCliente = [
  { title: "Mi Progreso", url: "/cliente/seguimientoUsuario" },
  { title: "Rutinas", url: "/cliente/seguimientoUsuario" },
  { title: "Seguimiento Deportivo", url: "/cliente/seguimientoUsuario" },
];
