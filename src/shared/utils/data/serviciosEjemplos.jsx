export const columnasServicios = [
  {
    field: "id_servicio",
    header: "ID",
  },
  {
    field: "nombre_servicio",
    header: "Nombre",
  },
  {
    field: "precio_servicio",
    header: "Precio",
    format: (value) => `$${value.toLocaleString()}`,
  },
  {
    field: "tipo_servicio",
    header: "Tipo Servicio",
    Cell: ({ value }) => value || "-",
  },
  {
    field: "id_estado",
    header: "Estado",
    Cell: ({ value, row }) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          // El cambio de estado se manejará a través del onStatusChange del DataTable
          if (row.onStatusChange) {
            row.onStatusChange(row);
          }
        }}
        className={`badge-estado badge-pequeno badge-con-borde badge-estado--interactive ${
          value === 1 ? "badge-tone--activo" : "badge-tone--inactivo"
        }`}
      >
        <span className="badge-content">{value === 1 ? "ACTIVO" : "INACTIVO"}</span>
      </button>
    ),
  },
];
