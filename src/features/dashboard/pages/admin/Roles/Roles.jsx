// src/pages/lo-que-sea/Roles.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Plus } from "lucide-react";
import toast from "react-hot-toast";

import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable from "../../../components/dataTables/dataTable";

import { useRoles } from "../../../hooks/Roles_API/role_API_AD.jsx";
import {
  ModalCrearRol,
  ModalVerRol,
  ModalEditarRol,
  ModalEliminarRol,
} from "./modalRoles";

import { columnasRoles } from "../../../../../shared/utils/data/ejemploRoles.jsx";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const PROTECTED_ROLE_ID = 33;

const NORMALIZE = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function Roles() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtro, setFiltro] = useState("");
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();
  const {
    roles,
    loading,
    error,
    pagination,
    setPagination,
    recargar,
    crearRol,
    actualizarRol,
    actualizarEstado,
    eliminarRol,
    permisosListos,
    permisoHelpers,
  } = useRoles({ paginated: true, search: searchQuery });
  const [accionModal, setAccionModal] = useState(null); // "crear" | "ver" | "editar" | "eliminar" | null
  const [rolSeleccionado, setRolSeleccionado] = useState(null);
  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    rol: null,
    nuevoEstado: null,
    nombreRol: "",
  });

  const handleSearchChange = (value) => {
    setFiltro(value);
    setSearchTerm(value);
  };

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery, setPagination]);

  if (error) {
    // evita spamear, pero al menos muestra algo
    toast.error(getApiErrorMessage(error, "Error al cargar roles"));
  }

  const rolesVisibles = useMemo(() => {
    // Filtrar roles que no deben aparecer en la tabla
    const rolesExcluidos = ["administrador", "super admin", "beneficiario", "empleado", "clientelgym"];
    return roles.filter(rol => {
      const roleId = Number(rol.id_rol ?? rol.id);
      if (roleId === PROTECTED_ROLE_ID) return true;
      const nombreRol = NORMALIZE(rol.nombre_rol || rol.nombre || "");
      return !rolesExcluidos.includes(nombreRol);
    });
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const raw = (searchQuery || "").trim();
    const base = rolesVisibles;
    if (!raw) return base;

    const removeAccents = (str) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const lowerSearch = raw.toLowerCase();
    const estados = [
      "activo",
      "inactivo",
      "vigente",
      "vencido",
      "suspendido",
      "pendiente",
    ];

    return base.filter((rol) => {
      const estadoActual =
        rol.estado ||
        (rol.id_estado === 1 ? "Activo" : rol.id_estado === 2 ? "Inactivo" : "");

      if (
        estadoActual &&
        estados.includes(lowerSearch) &&
        removeAccents(estadoActual.toLowerCase()) === lowerSearch
      ) {
        return true;
      }

      const campos = [
        rol.nombre,
        rol.nombre_rol,
        rol.descripcion,
        estadoActual,
        rol.fecha_creacion,
        rol.id ? String(rol.id) : "",
        rol.id_rol ? String(rol.id_rol) : "",
      ];

      return campos.some(
        (campo) =>
          campo &&
          removeAccents(String(campo).toLowerCase()).includes(lowerSearch)
      );
    });
  }, [rolesVisibles, searchQuery]);

  /* ---------- Handlers CRUD ---------- */

  // Crear rol (desde modal). nuevoRol debe seguir la estructura esperada por tu backend:
  // { nombre_rol, id_estado } y opcionalmente un arreglo de asociaciones [{id_permiso, id_privilegio}, ...]
  const manejarCrearRol = async (nuevoRol, asociaciones = []) => {
    try {
      // Validar que el nombre del rol no esté duplicado
      const nombreNormalizado = NORMALIZE(nuevoRol.nombre_rol);
      const existeRol = roles.some((rol) => {
        const nombreRolExistente = NORMALIZE(
          rol.nombre_rol || rol.nombre || ""
        );
        return nombreRolExistente === nombreNormalizado;
      });

      if (existeRol) {
        toast.error(
          "Ya existe un rol con este nombre. Por favor elige un nombre diferente."
        );
        return false;
      }

      await crearRol(nuevoRol, asociaciones);
      toast.success("Rol creado exitosamente");
      return true; // el modal se cierra si onSave devuelve true
    } catch (err) {
      console.error(err);

      // Manejar errores específicos de la base de datos
      if (err.message && err.message.includes("uq_nombre")) {
        toast.error(
          "Ya existe un rol con este nombre. Por favor elige un nombre diferente."
        );
      } else {
        toast.error(getApiErrorMessage(err, "Error al crear el rol"));
      }
      return false;
    }
  };

  // Actualizar rol. rolActualizado puede venir desde modal con campos y asociaciones opcionales.
  // Nota: el hook espera actualizarRol(id, rolData, asociaciones?)
  const manejarActualizarRol = async (rolActualizado, asociaciones = []) => {
    try {
      if (!rolActualizado?.id && !rolSeleccionado?.id) {
        throw new Error("ID de rol no válido");
      }
      const id = rolActualizado.id ?? rolSeleccionado.id;

      // Validar que el nombre del rol no esté duplicado (excluyendo el rol actual)
      const nombreNormalizado = NORMALIZE(rolActualizado.nombre_rol);
      const existeRol = roles.some((rol) => {
        const nombreRolExistente = NORMALIZE(
          rol.nombre_rol || rol.nombre || ""
        );
        return nombreRolExistente === nombreNormalizado && rol.id !== id;
      });

      if (existeRol) {
        toast.error(
          "Ya existe otro rol con este nombre. Por favor elige un nombre diferente."
        );
        return false;
      }

      await actualizarRol(id, rolActualizado);
      toast.success("Rol actualizado exitosamente");
      return true;
    } catch (err) {
      console.error(err);

      // Manejar errores específicos de la base de datos
      if (err.message && err.message.includes("uq_nombre")) {
        toast.error(
          "Ya existe otro rol con este nombre. Por favor elige un nombre diferente."
        );
      } else {
        toast.error(getApiErrorMessage(err, "Error al actualizar el rol"));
      }
      return false;
    }
  };

  // Eliminar rol. El hook acepta un objeto (para compatibilidad), aquí pasamos el objeto original
  const manejarEliminarRol = async (rolAEliminar) => {
    try {
      const id = rolAEliminar?.id ?? rolSeleccionado?.id;
      if (!id) throw new Error("ID de rol no válido");
      if (Number(id) === PROTECTED_ROLE_ID) {
        throw new Error(`El rol ${PROTECTED_ROLE_ID} está protegido y no se puede eliminar`);
      }
      await eliminarRol(id);
      toast.success("Rol eliminado exitosamente");
      return true;
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Error al eliminar el rol"));
      return false;
    }
  };

  const manejarCambioEstado = useCallback((rol) => {
    const roleId = Number(rol?.id ?? rol?.id_rol);
    const nuevoEstado = Number(rol.id_estado) === 1 ? 2 : 1;

    if (roleId === PROTECTED_ROLE_ID && nuevoEstado === 2) {
      toast.error("rol principal del gimnasio no se puede desactivar");
      return;
    }

    setEstadoPendiente({
      mostrar: true,
      rol: rol,
      nuevoEstado,
      nombreRol: rol.nombre_rol || rol.nombre || "este rol",
    });
  }, []);

  const confirmarCambioEstado = async () => {
    if (!estadoPendiente.rol?.id) return;

    const { rol, nuevoEstado } = estadoPendiente;

    try {
      await actualizarEstado(rol, nuevoEstado);
      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);

      setEstadoPendiente({
        mostrar: false,
        rol: null,
        nuevoEstado: null,
        nombreRol: "",
      });
    } catch (err) {
      console.error(err);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);

      setEstadoPendiente({
        mostrar: false,
        rol: null,
        nuevoEstado: null,
        nombreRol: "",
      });
    }
  };

  /* ---------- Modales ---------- */

  const abrirModal = (accion, rol = null) => {
    setAccionModal(accion);
    setRolSeleccionado(rol);
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setRolSeleccionado(null);
  };

  const rolesConPermisos = useMemo(() => {
    return filteredRoles.map((rol) => {
      const permisosLegibles = Array.isArray(rol.permisosAsignados)
        ? rol.permisosAsignados
            .map(({ id_permiso, id_privilegio }) => {
              const modulo =
                permisoHelpers?.permisoIdToModuloName?.[id_permiso] ??
                (Number.isInteger(id_permiso) ? `Permiso ${id_permiso}` : null);

              const accionKey =
                permisoHelpers?.privilegioIdToAccion?.[id_privilegio];
              const accionLabel = accionKey
                ? accionKey.charAt(0).toUpperCase() + accionKey.slice(1)
                : Number.isInteger(id_privilegio)
                ? `Privilegio ${id_privilegio}`
                : "";

              if (!modulo) return null;
              return accionLabel ? `${modulo} - ${accionLabel}` : modulo;
            })
            .filter(Boolean)
        : [];

      return {
        ...rol,
        permisosIds: permisosLegibles,
        onStatusChange: manejarCambioEstado,
      };
    });
  }, [filteredRoles, permisoHelpers, manejarCambioEstado]);

  return (
    <div className="main-ad-column">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Users size={40} className="icono-titulo" />
          <h1>Gestión de Roles</h1>
        </div>
        <div className="acciones-derecha">
          <button
            onClick={() => abrirModal("crear")}
            className="boton boton-primario"
            disabled={!permisosListos || !canCreate}
            title={
              !permisosListos
                ? "Cargando catálogo de permisos, intenta en un momento"
                : !canCreate
                  ? "No tienes permisos para crear en esta sección"
                  : undefined
            }
          >
            <Plus size={18} /> Nuevo Rol
          </button>
          <BuscadorUniversal
            value={filtro}
            onChange={handleSearchChange}
            placeholder="Buscar rol..."
            className="expandido"
          />
        </div>
      </div>

      <DataTable
        permisoId={permisoId}
        columns={columnasRoles}
        data={rolesConPermisos}
        paginationMode="server"
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        onPageChange={(page, limit) =>
          setPagination((prev) => ({
            ...prev,
            page,
            limit: Number(limit) || prev.limit,
          }))
        }
        onRefresh={recargar}
        onEdit={(rol) => abrirModal("editar", rol)}
        onView={(rol) => abrirModal("ver", rol)}
        onDelete={(rol) => abrirModal("eliminar", rol)}
        canEdit={() => canEdit}
        canDelete={(rol) =>
          canDelete && Number(rol?.id ?? rol?.id_rol) !== PROTECTED_ROLE_ID
        }
        onStatusChange={manejarCambioEstado}
        statusConfig={{
          values: { active: "Activo", inactive: "Inactivo" },
          colors: { active: "#4caf50", inactive: "#f44336" },
        }}
        loading={loading}
        emptyTitle="No se encontraron roles"
        emptyMessage="No hay roles disponibles para mostrar en la página actual."
      />

      {/* Crear */}
      {accionModal === "crear" && canCreate && (
        <ModalCrearRol
          onClose={cerrarModal}
          onSave={manejarCrearRol}
          permisoHelpers={permisoHelpers}
          existingRoles={roles}
        />
      )}

      {/* Ver */}
      {accionModal === "ver" && rolSeleccionado && (
        <ModalVerRol
          rol={rolSeleccionado}
          onClose={cerrarModal}
          permisoHelpers={permisoHelpers}
        />
      )}

      {/* Editar */}
      {accionModal === "editar" && rolSeleccionado && (
        <ModalEditarRol
          rol={rolSeleccionado}
          onClose={cerrarModal}
          onSave={manejarActualizarRol}
          permisoHelpers={permisoHelpers}
          existingRoles={roles}
          isEdit={true}
        />
      )}

      {/* Eliminar */}
      {accionModal === "eliminar" && rolSeleccionado && (
        <ModalEliminarRol
          rol={rolSeleccionado}
          onClose={cerrarModal}
          onDelete={manejarEliminarRol}
        />
      )}

      {/* Cambiar Estado */}
      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={() =>
          setEstadoPendiente({
            mostrar: false,
            rol: null,
            nuevoEstado: null,
            nombreRol: "",
          })
        }
        onConfirm={confirmarCambioEstado}
        targetStatus={estadoPendiente.nuevoEstado}
        title={`Cambiar estado a ${
          estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"
        }`}
        message={`¿Estás seguro de que deseas marcar el rol "${
          estadoPendiente.nombreRol
        }" como ${estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"}?`}
        confirmText={
          estadoPendiente.nuevoEstado === 1 ? "Activar" : "Desactivar"
        }
        type={estadoPendiente.nuevoEstado === 1 ? "activate" : "deactivate"}
        details={estadoPendiente.nombreRol}
      />
    </div>
  );
}

export default Roles;

