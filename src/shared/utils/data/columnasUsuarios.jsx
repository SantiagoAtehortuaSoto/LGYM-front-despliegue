export const columnasUsuarios = [
  { field: "id_usuario", header: "ID" },
  { field: "nombre_usuario", header: "nombre" },
  { field: "email", header: "Correo electrónico" },
  { field: "telefono", header: "Teléfono" },
  {
    field: "rol_nombre",
    header: "Rol",
    Cell: ({ value, row }) => {
      const roleName =
        value ||
        row.rol_nombre ||
        (row.id_rol_rol && row.id_rol_rol.nombre) ||
        `Rol ${row.rol_id || row.id_rol || "N/A"}`;

      return roleName;
    },
  },
  {
    field: "id_estado",
    header: "Estado",
  },
];
