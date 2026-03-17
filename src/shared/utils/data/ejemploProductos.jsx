export const columnasProductos = [
  { field: "id", label: "ID" },
  { field: "nombre", label: "Nombre" },
  { field: "categoria", label: "Categoría" },
  { field: "precioVenta", label: "Precio Venta" },
  { field: "stock", label: "Stock" },
  {
    field: "estado",
    header: "Estado",
    Cell: ({ value, row }) => {
      // Verificar si el valor es 'Activo' o 1
      const esActivo =
        value === "Activo" ||
        value === 1 ||
        value === "1" ||
        value === "activo";

      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (row.onStatusChange) {
              row.onStatusChange(row);
            }
          }}
          className={`badge-estado badge-pequeno badge-con-borde badge-estado--interactive data-producto-estado ${
            esActivo ? "badge-tone--activo" : "badge-tone--inactivo"
          }`}
        >
          <span className="badge-content">{esActivo ? "ACTIVO" : "INACTIVO"}</span>
        </button>
      );
    },
    accessor: (row) => {
      // Asegurarse de que el valor sea 'Activo' o 'Inactivo'
      if (row.estado) return row.estado;
      if (row.id_estados)
        return row.id_estados === 1 || row.id_estados === "1"
          ? "Activo"
          : "Inactivo";
      return "Activo"; // Valor por defecto
    },
  },
];
