import React, { memo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ModuleContent } from './modalRoles';

const MODULOS_DEF = [
  {
    categoria: "Compras",
    modulos: [
      { modulo: "Proveedores", label: "Proveedores" },
      { modulo: "Productos", label: "Productos" },
      { modulo: "Compras", label: "Compras" },
    ],
  },
  {
    categoria: "Servicios",
    modulos: [
      { modulo: "Servicios", label: "Servicios" },
      { modulo: "Membresías", label: "Membresías" },
      { modulo: "Asistencia", label: "Asistencia" },
      { modulo: "Asignar Citas", label: "Asignar Citas" },
      { modulo: "Empleados", label: "Empleados" },
    ],
  },
  {
    categoria: "Ventas",
    modulos: [
      { modulo: "Ventas", label: "Ventas" },
      // { modulo: "Ventas Membresías", label: "Ventas Membresías" },
      { modulo: "Seguimiento deportivo", label: "Seguimiento deportivo" },
      { modulo: "Clientes", label: "Clientes" },
    ],
  },
  {
    categoria: "Configuración",
    modulos: [
      { modulo: "Usuarios", label: "Usuarios" },
      { modulo: "Roles", label: "Roles" },
    ],
  },
];

export const PermissionSection = memo(({ 
  collapsedModules, 
  toggleModule, 
  permisos = {}, 
  onPermisoChange,
  disabled = false
}) => (
  <div className="seccion-permisos">
    <h3>Permisos</h3>
    <div className="modulos-lista">
      {MODULOS_DEF.map(({ categoria, modulos }) => (
        <div key={categoria} className="modulo-item">
          <button
            type="button"
            className="encabezado-modulo"
            onClick={() => toggleModule(categoria)}
          >
            <h3>{categoria}</h3>
            {collapsedModules[categoria] ? (
              <ChevronRight className="icono-flecha" />
            ) : (
              <ChevronDown className="icono-flecha" />
            )}
          </button>
          {!collapsedModules[categoria] && (
            <div className="contenido-modulo">
              <ModuleContent
                categoria={categoria}
                modulos={modulos}
                permisos={permisos}
                onPermisoChange={onPermisoChange}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)
);

PermissionSection.displayName = 'PermissionSection';
