// src/shared/utils/data/ejemploRoles.jsx

// Array de columnas para DataTable de Roles
export const columnasRoles = [
  { field: "id", header: "ID" },
  { field: "nombre", header: "Nombre rol" },

  {
    field: "permisosIds",
    header: "Permisos",
    Cell: ({ row }) => {
      const permisos = Array.isArray(row.permisosIds) ? row.permisosIds : [];
      const total = permisos.length;
      const nombreRol = (row?.nombre_rol ?? row?.nombre ?? "").trim().toLowerCase();
      const esAdmin = nombreRol === "administrador";

      if (!total) {
        return (
          <span className="roles-permisos-empty">
            Sin permisos
          </span>
        );
      }

      const textos = permisos.map((p) => String(p));

      if (esAdmin) {
        return (
          <div className="roles-permisos-admin">
            <span className="roles-permisos-admin-total">
              {total} permisos
            </span>
            <span className="roles-permisos-admin-list">
              {textos.join(", ")}
            </span>
          </div>
        );
      }

      return (
        <span className="roles-permisos-count">
          {total} permiso{total !== 1 ? "s" : ""}
        </span>
      );
    },
  },

  {
    field: "id_estado",
    header: "Estado",
    Cell: ({ value, row }) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
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
