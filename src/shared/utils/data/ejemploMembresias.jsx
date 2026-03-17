// Array de columnas para DataTable
export const columnasMembresias = [
  { field: "id", header: "ID" },
  { field: "nombre", header: "Nombre" },
  { field: "descripcion", header: "Descripción" },
  {
    field: "precioVenta",
    header: "Precio Venta",
    format: (value) => `$${Number(value || 0).toLocaleString()}`,
  },
  {
    field: "id_estado",
    header: "Estado",
    Cell: ({ value, row }) => {
      // Asegurarse de que el valor sea un número (1 o 2)
      const estadoNumerico =
        typeof value === "number"
          ? value
          : value === "Activo" || value === "activo"
          ? 1
          : 2;

      // Convertir a string para el SelectorEstado
      const estadoString = estadoNumerico === 1 ? "ACTIVO" : "INACTIVO";

      return (
        <SelectorEstado
          estadoActual={estadoString}
          opciones={[
            { value: 1, label: "Activo" },
            { value: 2, label: "Inactivo" },
          ]}
          onCambioEstado={(nuevoEstado) => {
            if (row.onStatusChange) {
              row.onStatusChange(row, nuevoEstado);
            }
          }}
        />
      );
    },
  },
];
