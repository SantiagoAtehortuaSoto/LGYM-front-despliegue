export const columnasVentas = [
  { label: 'ID', field: 'id' },
  { label: 'Cliente', field: 'cliente' },
  { label: 'Productos', field: 'productos', Cell: ({ value }) => {
    if (!value || !Array.isArray(value)) return '0 productos';
    return `${value.length} productos`;
  }},
  { label: 'Método de Pago', field: 'metodoPago' },
  { label: 'Monto', field: 'monto', Cell: ({ value }) => `$${parseFloat(value || 0).toFixed(2)}` },
  { label: 'Estado', field: 'estado' },
  { label: 'Fecha', field: 'fecha', Cell: ({ value }) => {
    if (!value) return 'Fecha no disponible';
    return new Date(value).toLocaleDateString('es-ES');
  }},
  { label: 'Notas', field: 'notas' },
];

export const columnasMembresias = [
  { label: 'ID', field: 'id' },
  { label: 'Cliente', field: 'cliente' },
  { label: 'Membresía', field: 'membresia' },
  { label: 'Duración', field: 'duracion' },
  { label: 'Método de Pago', field: 'metodoPago' },
  { label: 'Monto', field: 'monto', Cell: ({ value }) => `$${parseFloat(value || 0).toFixed(2)}` },
  { label: 'Estado', field: 'estado' },
  { label: 'Fecha Inicio', field: 'fechaInicio', Cell: ({ value }) => {
    if (!value) return 'Fecha no disponible';
    return new Date(value).toLocaleDateString('es-ES');
  }},
  { label: 'Fecha Fin', field: 'fechaFin', Cell: ({ value }) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('es-ES');
  }},
];
