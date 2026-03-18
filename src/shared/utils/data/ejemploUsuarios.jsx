export const columnasUsuarios = [
  { field: "id_usuario", header: "ID" },
  { field: "nombre_usuario", header: "nombre" },
  { field: "email", header: "Correo electrónico" },
  { field: "telefono", header: "Teléfono" },
  { 
    field: "rol_nombre", 
    header: "Rol",
    Cell: ({ value, row }) => {
      // Try to get the role name from different possible locations in the data structure
      const roleName = value || 
                      row.rol_nombre || 
                      (row.id_rol_rol && row.id_rol_rol.nombre) || 
                      `Rol ${row.rol_id || row.id_rol || 'N/A'}`;
      
      return roleName;
    }
  },
  {
    field: "id_estado",
    header: "Estado",
  },
];

// export const usuariosData = [
//     {
//       id: 1,
//       nombre: 'Juan Pérez',
//       email: 'juan.perez@email.com',
//       teléfono: '555-123-4567',
//       rol: 'Administrador',
//       estado: 'Activo',
//       fecha_creacion: '2023-01-15',
//       ultimo_acceso: '2023-09-14'
//     },
//     {
//       id: 2,
//       nombre: 'María García',
//       email: 'maria.garcia@email.com',
//       teléfono: '555-987-6543',
//       rol: 'Entrenador',
//       estado: 'Activo',
//       fecha_creacion: '2023-02-20',
//       ultimo_acceso: '2023-09-13'
//     },
//     {
//       id: 3,
//       nombre: 'Carlos López',
//       email: 'carlos.lopez@email.com',
//       teléfono: '555-456-7890',
//       rol: 'Recepcionista',
//       estado: 'Activo',
//       fecha_creacion: '2023-03-10',
//       ultimo_acceso: '2023-09-12'
//     },
//     {
//       id: 4,
//       nombre: 'Ana Martínez',
//       email: 'ana.martinez@email.com',
//       teléfono: '555-321-6547',
//       rol: 'Entrenador',
//       estado: 'Inactivo',
//       fecha_creacion: '2023-04-05',
//       ultimo_acceso: '2023-08-15'
//     },
//     {
//       id: 5,
//       nombre: 'Roberto Sánchez',
//       email: 'roberto.sanchez@email.com',
//       teléfono: '555-789-1234',
//       rol: 'Mantenimiento',
//       estado: 'Activo',
//       fecha_creacion: '2023-05-22',
//       ultimo_acceso: '2023-09-14'
//     },
//     {
//       id: 6,
//       nombre: 'Laura Fernández',
//       email: 'laura.fernandez@email.com',
//       teléfono: '555-654-3210',
//       rol: 'Administrador',
//       estado: 'Activo',
//       fecha_creacion: '2023-06-18',
//       ultimo_acceso: '2023-09-14'
//     },
//     {
//       id: 7,
//       nombre: 'Diego Ramírez',
//       email: 'diego.ramirez@email.com',
//       teléfono: '555-234-5678',
//       rol: 'Entrenador',
//       estado: 'En espera',
//       fecha_creacion: '2023-07-30',
//       ultimo_acceso: '2023-09-10'
//     }
//   ];
