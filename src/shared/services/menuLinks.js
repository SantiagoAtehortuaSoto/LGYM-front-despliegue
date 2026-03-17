// Enlaces de menú para la sección de Compras
export const comprasLinksAd = [
  { title: 'Proveedores', path: '/admin/proveedores' },
  { title: 'Productos', path: '/admin/productos' },
  { title: 'Órdenes de Compra', path: '/admin/ordenes-compra' },
  { title: 'Inventario', path: '/admin/inventario' },
];

// Enlaces de menú para la sección de Servicios
export const ServiciosLInksAd = [
  { title: 'Servicios', path: '/admin/servicios' },
  { title: 'Categorías', path: '/admin/categorias-servicios' },
  { title: 'Agenda', path: '/admin/agenda' },
  { title: 'Técnicos', path: '/admin/tecnicos' },
];

// Enlaces de menú para la sección de Ventas
export const ventasLinksAd = [
  { title: 'Clientes', path: '/admin/clientes' },
  { title: 'Ventas', path: '/admin/ventas' },
  { title: 'Cotizaciones', path: '/admin/cotizaciones' },
  { title: 'Facturación', path: '/admin/facturacion' },
];

// Enlaces de menú para la sección de Configuración
export const configLinksAd = [
  { title: 'Usuarios', path: '/admin/usuarios' },
  { title: 'Roles', path: '/admin/roles' },
  { title: 'Permisos', path: '/admin/permisos' },
  { title: 'Configuración General', path: '/admin/configuracion' },
];

// Exportar todos los enlaces como un objeto
export default {
  comprasLinksAd,
  ServiciosLInksAd,
  ventasLinksAd,
  configLinksAd,
};
