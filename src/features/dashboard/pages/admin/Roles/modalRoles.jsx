import { useState, useCallback, useMemo, useRef, useEffect, memo } from "react";
import PropTypes from "prop-types";
import { ChevronDown, ChevronRight, Circle } from "lucide-react";
import Button from "../../../../../shared/components/Button/Button";
import { useCollapsibleModules } from "./useCollapsibleModules";
import toast from "react-hot-toast";
import Modal from "../../../../../shared/components/Modal/Modal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import { validarRol } from "../../../hooks/validaciones/validaciones";
import "../../../../../shared/styles/restructured/components/modal-roles.css";

// Acciones permitidas a nivel de UI
const PERMISSION_ACTIONS = ["ver", "crear", "editar", "eliminar"];
const PROTECTED_ROLE_ID = 33;

/* ======================================================
   Definición de módulos y helpers de permisos
====================================================== */

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
      { modulo: "Membresias", label: "Membresias" },
      { modulo: "Asistencia", label: "Asistencia" },
      { modulo: "Asignar Citas", label: "Asignar Citas" },
      { modulo: "Empleados", label: "Empleados" },
    ],
  },
  {
    categoria: "Ventas",
    modulos: [
      { modulo: "Ventas", label: "Ventas" },
      // { modulo: "Ventas Membresias", label: "Ventas Membresias" },
      { modulo: "Seguimiento deportivo", label: "Seguimiento deportivo" },
      { modulo: "Clientes", label: "Clientes" },
    ],
  },
  {
    categoria: "Configuracion",
    modulos: [
      { modulo: "Usuarios", label: "Usuarios" },
      { modulo: "Roles", label: "Roles" },
    ],
  },
];

const normalizeText = (value = "") =>
  value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const normalizeModuloEntry = (entry) => {
  if (typeof entry === "string") {
    const modulo = entry;
    return { modulo, label: modulo, normalized: normalizeText(modulo) };
  }
  if (entry && typeof entry === "object") {
    const modulo = entry.modulo || entry.nombre || entry.label || "";
    const label = entry.label || modulo;
    return { modulo, label, normalized: normalizeText(modulo) };
  }
  return { modulo: "", label: "", normalized: "" };
};

const MODULO_META = (() => {
  const byKey = {};
  const nameToKey = {};

  MODULOS_DEF.forEach(({ categoria, modulos }) => {
    modulos.forEach((entry) => {
      const meta = normalizeModuloEntry(entry);
      const key = `${categoria}_${meta.modulo}`;
      byKey[key] = { categoria, modulo: meta.modulo, label: meta.label, normalized: meta.normalized };
      nameToKey[meta.normalized] = key;
    });
  });

  return { byKey, nameToKey };
})();

const createActionState = () =>
  PERMISSION_ACTIONS.reduce((acc, action) => {
    acc[action] = false;
    return acc;
  }, {});

function createEmptyPermisosState() {
  const permisos = {};
  MODULOS_DEF.forEach(({ categoria, modulos }) => {
    modulos.forEach((entry) => {
      const meta = normalizeModuloEntry(entry);
      const key = `${categoria}_${meta.modulo}`;
      permisos[key] = createActionState();
    });
  });
  return permisos;
}

function createDefaultCreatePermisosState() {
  const permisos = createEmptyPermisosState();
  const rolesModuleKey = MODULO_META.nameToKey[normalizeText("Roles")];

  if (
    rolesModuleKey &&
    permisos[rolesModuleKey] &&
    Object.prototype.hasOwnProperty.call(permisos[rolesModuleKey], "ver")
  ) {
    permisos[rolesModuleKey].ver = true;
  }

  return permisos;
}

function buildPermisosModulosFromAsignados(asignaciones = [], helpers) {
  const base = createEmptyPermisosState();
  if (!helpers) return base;

  asignaciones.forEach((item) => {
    const id_permiso = Number(item.id_permiso);
    const id_privilegio = Number(item.id_privilegio);

    if (!Number.isInteger(id_permiso) || !Number.isInteger(id_privilegio)) {
      return;
    }

    const moduloName = helpers?.permisoIdToModuloName?.[id_permiso];
    const accion = helpers?.privilegioIdToAccion?.[id_privilegio];
    if (!moduloName || !accion) return;

    const moduloKey = MODULO_META.nameToKey[normalizeText(moduloName)];
    if (!moduloKey) return;

    if (!base[moduloKey]) {
      base[moduloKey] = createActionState();
    }

    if (Object.prototype.hasOwnProperty.call(base[moduloKey], accion)) {
      base[moduloKey][accion] = true;
    }
  });

  return base;
}

function mapPermisosModulosToPayload(permisosModulos, helpers) {
  if (!helpers) return [];

  const resultado = [];

  Object.entries(permisosModulos || {}).forEach(([key, acciones]) => {
    const meta = MODULO_META.byKey[key];
    if (!meta) return;

    const id_permiso = helpers?.moduloNameToPermisoId?.[meta.normalized];
    if (!Number.isInteger(id_permiso)) return;

    const privilegios = Object.entries(acciones)
      .filter(([, checked]) => checked)
      .map(([accion]) => helpers?.privilegioNameToId?.[accion])
      .filter((id) => Number.isInteger(id));

    const unique = [...new Set(privilegios)];
    if (unique.length > 0) {
      resultado.push({ id_permiso, privilegios: unique });
    }
  });

  return resultado;
}

const clonePermisos = (permisos) => JSON.parse(JSON.stringify(permisos || {}));
const arePermisosEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Componente de item de permiso simple
export const PermissionItem = memo(
  ({ label, checked, onChange, disabled = false }) => {
    const id = `permiso-${label}`;
    return (
      <div className="item-permiso">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="checkbox-permiso"
        />
        <label htmlFor={id} className="etiqueta-permiso">
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </label>
      </div>
    );
  },
);

// Contenido de cada módulo
export const ModuleContent = memo(
  ({ categoria, modulos, permisos, onPermisoChange, disabled = false }) => (
    <div className="modulos-permisos">
      {modulos.map((entry) => {
        const meta = normalizeModuloEntry(entry);
        const key = `${categoria}_${meta.modulo}`;
        const moduloPermisos = permisos[key] || {};
        return (
          <div key={key} className="modulo-permisos">
            <h4 className="titulo-modulo">{meta.label}</h4>
            <div className="lista-permisos">
              {PERMISSION_ACTIONS.map((accion) => {
                const permisoId = `permiso-${key}-${accion}`;
                const estaHabilitado = !disabled && onPermisoChange;
                return (
                  <div key={permisoId} className="item-permiso">
                    <input
                      type="checkbox"
                      id={permisoId}
                      checked={!!moduloPermisos[accion]}
                      onChange={() =>
                        onPermisoChange?.(categoria, meta.modulo, accion)
                      }
                      disabled={!estaHabilitado}
                      className="checkbox-permiso"
                    />
                    <label
                      htmlFor={permisoId}
                      className={`etiqueta-permiso ${
                        estaHabilitado
                          ? "modal-roles__perm-label--enabled"
                          : "modal-roles__perm-label--disabled"
                      }`}
                    >
                      {accion.charAt(0).toUpperCase() + accion.slice(1)}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  ),
);

ModuleContent.displayName = "ModuleContent";

/* ======================================================
   Modal base
====================================================== */

const EMPTY_INITIAL_DATA = Object.freeze({});

const BaseRoleModal = ({
  title,
  initialData = EMPTY_INITIAL_DATA,
  onClose,
  onSave,
  showPermissions = true,
  disabled = false,
  closeOnOverlayClick,
  permisoHelpers,
  existingRoles = [],
  isEdit = false,
}) => {
  const modalRef = useRef(null);

  const permisosIniciales = useMemo(() => {
    if (initialData.permisosModulos) {
      return clonePermisos(initialData.permisosModulos);
    }
    if (initialData.permisosAsignados) {
      return buildPermisosModulosFromAsignados(
        initialData.permisosAsignados,
        permisoHelpers,
      );
    }
    if (!isEdit && !disabled) {
      return createDefaultCreatePermisosState();
    }
    return createEmptyPermisosState();
  }, [initialData, permisoHelpers, isEdit, disabled]);

  const {
    collapsedModules,
    toggleModule,
    toggleAll,
    isAllCollapsed,
    isAllExpanded,
  } = useCollapsibleModules(MODULOS_DEF);

  const [formData, setFormData] = useState(() => ({
    id: initialData.id || initialData.id_rol || null,
    nombre_rol: initialData.nombre_rol || initialData.nombre || "",
    id_estado: Number(initialData.id_estado) || 1,
    fecha_creacion:
      initialData.fecha_creacion || new Date().toISOString().split("T")[0],
    permisosModulos: permisosIniciales,
  }));

  // Estado para validación de nombre duplicado
  const [nombreError, setNombreError] = useState("");
  const [estadoError, setEstadoError] = useState("");
  const [permisosError, setPermisosError] = useState("");
  const isProtectedPrimaryRole = Number(formData.id) === PROTECTED_ROLE_ID;
  const permisosListos = Boolean(permisoHelpers);
  const resolvedCloseOnOverlayClick =
    typeof closeOnOverlayClick === "boolean"
      ? closeOnOverlayClick
      : !disabled;

  useEffect(() => {
    setFormData((prev) => {
      if (arePermisosEqual(prev.permisosModulos, permisosIniciales)) {
        return prev;
      }
      return { ...prev, permisosModulos: permisosIniciales };
    });
  }, [permisosIniciales]);

  // Validación en tiempo real del nombre del rol
  useEffect(() => {
    if (disabled) {
      setNombreError("");
      setEstadoError("");
      setPermisosError("");
    } else {
      const { errors } = validarRol(
        formData,
        existingRoles,
        isEdit,
      );
      setNombreError(errors.nombre_rol || "");
      setEstadoError(
        isProtectedPrimaryRole && Number(formData.id_estado) === 2
          ? "El rol principal del gimnasio no se puede desactivar."
          : errors.id_estado || "",
      );
      setPermisosError(
        !permisosListos
          ? "El catalogo de permisos aun no esta disponible."
          : errors.permisosModulos || "",
      );
    }
  }, [formData, existingRoles, isEdit, disabled, isProtectedPrimaryRole, permisosListos]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;

    if (
      name === "id_estado" &&
      isProtectedPrimaryRole &&
      Number(value) === 2
    ) {
      setEstadoError("El rol principal del gimnasio no se puede desactivar.");
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  }, [isProtectedPrimaryRole]);

  const handlePermisoChange = useCallback((categoria, modulo, accion) => {
    setFormData((prev) => {
      const key = `${categoria}_${modulo}`;
      const prevModulo = prev.permisosModulos[key] || createActionState();
      return {
        ...prev,
        permisosModulos: {
          ...prev.permisosModulos,
          [key]: {
            ...prevModulo,
            [accion]: !prevModulo[accion],
          },
        },
      };
    });
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      const { errors } = validarRol(formData, existingRoles, isEdit);
      setNombreError(errors.nombre_rol || "");
      setEstadoError(
        isProtectedPrimaryRole && Number(formData.id_estado) === 2
          ? "El rol principal del gimnasio no se puede desactivar."
          : errors.id_estado || "",
      );
      setPermisosError(
        !permisosListos
          ? "El catalogo de permisos aun no esta disponible."
          : errors.permisosModulos || "",
      );
      if (errors.nombre_rol || errors.id_estado || errors.permisosModulos) {
        return;
      }

      if (!permisosListos) {
        return;
      }

      if (isProtectedPrimaryRole && Number(formData.id_estado) === 2) {
        return;
      }

      const permisosPayload = mapPermisosModulosToPayload(
        formData.permisosModulos,
        permisoHelpers,
      );

      const payload = {
        id: formData.id,
        nombre_rol: formData.nombre_rol.trim(),
        nombre: formData.nombre_rol.trim(),
        id_estado: Number(formData.id_estado) || 1,
        permisos: permisosPayload,
        permisosModulos: formData.permisosModulos,
        permisosAsignados: permisosPayload.flatMap((combo) =>
          combo.privilegios.map((id_privilegio) => ({
            id_permiso: combo.id_permiso,
            id_privilegio,
          })),
        ),
      };

      try {
        const ok = await onSave(payload);
        if (!ok) {
          toast.error("No se pudo guardar el rol");
          return;
        }
        toast.success(
          formData.id ? "Rol actualizado exitosamente" : "Rol creado exitosamente"
        );
        onClose();
      } catch (err) {
        console.error(err);
        toast.error(
          err?.response?.data?.message ||
            err?.message ||
            "Error al guardar el rol"
        );
      }
    },
    [formData, onSave, onClose, permisoHelpers, permisosListos, existingRoles, isEdit, isProtectedPrimaryRole],
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={title}
      size="md"
      closeOnOverlayClick={resolvedCloseOnOverlayClick}
      className="modal-mediano modal-roles__container"
      modalRef={modalRef}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            className="boton boton-secundario"
            onClick={onClose}
          >
            Cancelar
          </Button>
          {!disabled && (
            <Button
              type="submit"
              form="modal-roles-form"
              variant="primary"
              className="boton boton-primario"
              disabled={!permisosListos || !!nombreError || !!estadoError || !!permisosError}
            >
              Guardar Cambios
            </Button>
          )}
        </>
      }
    >
      <form
        id="modal-roles-form"
        onSubmit={handleSubmit}
        className="modal-roles__form"
        noValidate
      >
        <div className="modal-roles__card">
          <h3 className="modal-roles__section-title">Información Básica</h3>

          <div className="modal-roles__field modal-roles__field--spaced">
            <label className="modal-roles__label">Nombre del Rol</label>
            <input
              type="text"
              name="nombre_rol"
              value={formData.nombre_rol}
              onChange={handleInputChange}
              disabled={disabled}
              required
              placeholder="Ej: Administrador"
              className={`modal-roles__input${nombreError ? " modal-roles__input--error" : ""}`}
            />
            {nombreError && (
              <p className="modal-roles__error-text">
                {nombreError}
              </p>
            )}
          </div>

          <div className="modal-roles__field">
            <label className="modal-roles__label">Estado</label>
            <select
              name="id_estado"
              value={formData.id_estado}
              onChange={handleInputChange}
              disabled={disabled}
              className={`modal-roles__input modal-roles__select${estadoError ? " modal-roles__input--error" : ""}`}
            >
              <option value={1}>Activo</option>
              <option value={2} disabled={isProtectedPrimaryRole}>
                Inactivo
              </option>
            </select>
            {estadoError && (
              <p className="modal-roles__error-text">
                {estadoError}
              </p>
            )}
          </div>
        </div>

        {showPermissions && (
          <div className="modal-roles__card">
            <h3 className="modal-roles__section-title">Permisos</h3>

            <div className="modal-roles__permissions-toolbar">
              <div className="modal-roles__permissions-status">
                {(() => {
                  const allCollapsed = isAllCollapsed();
                  const allExpanded = isAllExpanded();
                  const partial = !allCollapsed && !allExpanded;
                  if (partial) {
                    return (
                      <div className="modal-roles__status-item">
                        <Circle size={14} className="modal-roles__status-icon" />
                        <span className="modal-roles__status-text">
                          Parcial
                        </span>
                      </div>
                    );
                  }
                  if (allCollapsed) {
                    return (
                      <div className="modal-roles__status-item">
                        <ChevronRight size={14} />
                        <span className="modal-roles__status-text">
                          Expandir Todos
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="modal-roles__status-item">
                      <ChevronDown size={14} />
                      <span className="modal-roles__status-text">
                        Colapsar Todos
                      </span>
                    </div>
                  );
                })()}
              </div>

              <button
                type="button"
                className="btn-control-permisos modal-roles__toggle-all"
                onClick={toggleAll}
                aria-label="Alternar todos los módulos"
              >
                {isAllCollapsed() ? "Abrir" : "Cerrar"}
              </button>
            </div>

            {!permisosListos && (
              <p className="mensaje-info">Cargando catálogo de permisos...</p>
            )}

            {permisosError && (
              <p className="modal-roles__error-text modal-roles__error-text--permissions">
                {permisosError}
              </p>
            )}

            {MODULOS_DEF.map(({ categoria, modulos }) => (
              <div
                key={categoria}
                className="modulo modal-roles__module"
              >
                <button
                  type="button"
                  className="modulo-encabezado modal-roles__module-header"
                  onClick={() => toggleModule(categoria)}
                >
                  {!collapsedModules[categoria] ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  <span className="modal-roles__module-title">{categoria}</span>
                </button>

                {!collapsedModules[categoria] && (
                  <div className="contenido-modulo modal-roles__module-content">
                    <ModuleContent
                      categoria={categoria}
                      modulos={modulos}
                      permisos={formData.permisosModulos}
                      onPermisoChange={
                        !disabled && permisosListos ? handlePermisoChange : undefined
                      }
                      disabled={disabled || !permisosListos}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </form>
    </Modal>
  );
};

/* ======================================================
   Modales específicos
====================================================== */

export const ModalCrearRol = memo(
  ({ onClose, onSave, permisoHelpers, existingRoles = [] }) => (
    <BaseRoleModal
      title="Crear Nuevo Rol"
      onClose={onClose}
      onSave={onSave}
      permisoHelpers={permisoHelpers}
      existingRoles={existingRoles}
      isEdit={false}
    />
  ),
);

export const ModalEditarRol = memo(
  ({ rol, onClose, onSave, permisoHelpers, existingRoles = [], isEdit = false }) => {
    const initialData = useMemo(
      () => ({
        id: rol?.id || rol?.id_rol || null,
        nombre_rol: rol?.nombre_rol || rol?.nombre || "",
        tipoPanel: rol?.tipoPanel || "empleado",
        estado: rol?.estado || "Activo",
        fecha_creacion:
          rol?.fecha_creacion || new Date().toISOString().split("T")[0],
        permisosAsignados: rol?.permisosAsignados || [],
      }),
      [rol],
    );
    return (
      <BaseRoleModal
        title={`Editar Rol: ${rol?.nombre || "Nuevo Rol"}`}
        initialData={initialData}
        onClose={onClose}
        onSave={onSave}
        permisoHelpers={permisoHelpers}
        existingRoles={existingRoles}
        isEdit={isEdit}
      />
    );
  },
);

export const ModalVerRol = memo(({ rol, onClose, permisoHelpers }) =>
  rol ? (
    <BaseRoleModal
      title={`Detalles del Rol: ${rol.nombre}`}
      initialData={{
        ...rol,
        permisosAsignados: rol.permisosAsignados || [],
      }}
      onClose={onClose}
      onSave={async () => true}
      disabled
      closeOnOverlayClick={true}
      permisoHelpers={permisoHelpers}
    />
  ) : null,
);

export const ModalEliminarRol = memo(({ rol, onClose, onDelete }) => {
  const handleConfirmDelete = useCallback(() => {
    if (!rol) return;
    onDelete(rol);
  }, [rol, onDelete]);

  if (!rol) return null;

  return (
    <DeleteModal
      isOpen={!!rol}
      onClose={onClose}
      onConfirm={handleConfirmDelete}
      item={rol}
      title="Eliminar Rol"
      size="sm"
      fields={[
        {
          key: "nombre",
          label: "Nombre del Rol",
          format: (value) => <strong>{value || "Rol sin nombre"}</strong>,
        },
      ]}
      warningMessage="Esta acción no se puede deshacer. Se eliminará permanentemente el rol y todos sus permisos asociados."
    />
  );
});

/* ======================================================
   Modal Cambiar Estado Rol
====================================================== */
export const ModalCambiarEstadoRol = memo(
  ({ isOpen, onClose, onConfirm, rol }) => {
    if (!isOpen || !rol) return null;

    const nuevoEstado = Number(rol.id_estado) === 1 ? 2 : 1;
    const esActivacion = nuevoEstado === 1;
    const estadoActualTexto = Number(rol.id_estado) === 1 ? "Activo" : "Inactivo";

    const detalleRol = (
      <div className="modal-roles__status-details">
        <div>
          <strong>Rol:</strong> {rol.nombre_rol || rol.nombre || "Sin nombre"}
        </div>
        <div>
          <strong>Permisos:</strong> {rol.permisosIds?.length || 0}
        </div>
        <div>
          <strong>Estado actual:</strong> {estadoActualTexto}
        </div>
      </div>
    );

    return (
      <ConfirmModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={() => {
          onConfirm?.(rol, nuevoEstado);
          onClose();
        }}
        targetStatus={nuevoEstado}
        type={esActivacion ? "activate" : "deactivate"}
        title={esActivacion ? "Activar rol" : "Desactivar rol"}
        message={
          esActivacion
            ? "El rol quedara disponible para asignarlo a usuarios."
            : "El rol dejara de estar disponible para nuevas asignaciones."
        }
        confirmText={esActivacion ? "Si, activar" : "Si, desactivar"}
        details={detalleRol}
      />
    );
  },
);
/* ======================================================
   PropTypes
====================================================== */

BaseRoleModal.propTypes = {
  title: PropTypes.string.isRequired,
  initialData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  showPermissions: PropTypes.bool,
  disabled: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  permisoHelpers: PropTypes.object,
  existingRoles: PropTypes.array,
  isEdit: PropTypes.bool,
};
ModalCrearRol.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  permisoHelpers: PropTypes.object,
  existingRoles: PropTypes.array,
};
ModalEditarRol.propTypes = {
  rol: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  permisoHelpers: PropTypes.object,
  existingRoles: PropTypes.array,
  isEdit: PropTypes.bool,
};
ModalVerRol.propTypes = {
  rol: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  permisoHelpers: PropTypes.object,
};
ModalEliminarRol.propTypes = {
  rol: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
ModalCambiarEstadoRol.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  onConfirm: PropTypes.func,
  rol: PropTypes.object,
};
