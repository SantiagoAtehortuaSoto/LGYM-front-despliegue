// src/features/dashboard/pages/admin/Roles/permisosConfig.js

// Define tus categorías y sus módulos visibles en la UI.
// Ajusta los nombres de módulos para que coincidan con los "permisos.nombre" en la BD,
// así el mapeo hacia asociaciones funcionará mejor.
export const modulos = [
  { categoria: "Usuarios", modulos: ["usuarios"] },
  { categoria: "Empleados", modulos: ["empleados"] },
  { categoria: "Roles", modulos: ["roles"] },
  // agrega más categorías/módulos según lo que uses
];

// Acciones soportadas en la UI (debe coincidir con los privilegios.nombre en la BD)
export const PERMISSION_ACTIONS = ["ver", "crear", "editar", "eliminar"];

// Inicializa el estado de permisos por módulo/acción: todo en false.
export function inicializarPermisosModulos() {
  const estado = {};
  modulos.forEach(({ categoria, modulos: mods }) => {
    mods.forEach((mod) => {
      const key = `${categoria}_${mod}`;
      estado[key] = {
        ver: false,
        crear: false,
        editar: false,
        eliminar: false,
      };
    });
  });
  return estado;
}
