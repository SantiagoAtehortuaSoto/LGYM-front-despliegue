import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import BaseUserModal from "./modalUsuarios";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import { columnasUsuarios } from "../../../../../shared/utils/data/ejemploUsuarios";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import {
  obtenerUsuarios,
  crearUsuario as apiCrearUsuario,
  actualizarUsuario as apiActualizarUsuario,
  eliminarUsuario as apiEliminarUsuario,
  actualizarEstadoUsuario,
  obtenerRolesUsuarios,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import { obtenerBeneficiarios } from "../../../hooks/Beneficiarios_API/benefeiciarios_API";
import { obtenerMembresias } from "../../../hooks/Membresias_API_AD/Membresias_AD";
import { obtenerEmpleados } from "../../../hooks/Empleados_API/API_Empleados";
import { obtenerRoles } from "../../../hooks/Roles_API/roles_API";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import { buscarUniversal } from "../../../../../shared/utils/búsquedaUniversal";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const DEFAULT_PAGE_SIZE = DEFAULT_DATA_TABLE_PAGE_SIZE;
const SELF_USER_ACTION_BLOCKED_MESSAGE =
  "No puedes editar ni eliminar tu propio usuario mientras tienes la sesion iniciada.";

const normalizeRole = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isConcreteRoleName = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (normalizeRole(text) === "sin rol asignado") return false;
  return !/^rol\s+\d+$/i.test(text);
};

const extractList = (response, preferredKeys = ["data", "roles_usuarios"]) => {
  if (Array.isArray(response)) return response;

  for (const key of preferredKeys) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }
  }

  return [];
};

const resolveUserId = (record = {}) =>
  record?.id_usuario ??
  record?.usuario_id ??
  record?.id_usuario_usuario?.id_usuario ??
  record?.id_usuario_usuario?.id ??
  record?.usuario?.id_usuario ??
  record?.usuario?.id ??
  record?.id ??
  null;

const resolveRoleId = (record = {}) => {
  const candidates = [
    record?.rol_id,
    record?.id_rol,
    record?.roleId,
    record?.rol?.id_rol,
    record?.rol?.id,
    record?.role?.id_rol,
    record?.role?.id,
    record?.id_rol_rol?.id_rol,
    record?.id_rol_rol?.id,
    record?.roles?.[0],
    record?.roles_usuarios?.[0]?.id_rol,
    record?.roles_usuarios?.[0]?.rol_id,
    record?.roles_usuarios?.[0]?.id_rol_rol?.id_rol,
    record?.roles_usuarios?.[0]?.id_rol_rol?.id,
  ];

  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue;
    if (typeof candidate === "object") {
      const nested =
        candidate?.id_rol ?? candidate?.id ?? candidate?.rol_id ?? candidate?.roleId;
      if (nested != null && nested !== "") return nested;
      continue;
    }
    return candidate;
  }

  return null;
};

const resolveRoleName = (record = {}, catalog = {}, fallbackRoleId = null) => {
  const candidates = [
    record?.rol_nombre,
    record?.roles_usuarios?.[0]?.rol_nombre,
    record?.rol?.nombre_rol,
    record?.rol?.nombre,
    record?.rol?.name,
    record?.role?.nombre_rol,
    record?.role?.nombre,
    record?.role?.name,
    record?.id_rol_rol?.nombre_rol,
    record?.id_rol_rol?.nombre,
    record?.id_rol_rol?.name,
    record?.roles?.[0]?.nombre_rol,
    record?.roles?.[0]?.nombre,
    record?.roles?.[0]?.name,
    record?.roles_usuarios?.[0]?.id_rol_rol?.nombre_rol,
    record?.roles_usuarios?.[0]?.id_rol_rol?.nombre,
    record?.roles_usuarios?.[0]?.id_rol_rol?.name,
    record?.roles_usuarios?.[0]?.rol?.nombre_rol,
    record?.roles_usuarios?.[0]?.rol?.nombre,
    record?.roles_usuarios?.[0]?.rol?.name,
    record?.roles_usuarios?.[0]?.role?.nombre_rol,
    record?.roles_usuarios?.[0]?.role?.nombre,
    record?.roles_usuarios?.[0]?.role?.name,
    record?.roleName,
    typeof record?.rol === "string" ? record.rol : "",
    typeof record?.role === "string" ? record.role : "",
  ];

  for (const candidate of candidates) {
    if (candidate == null) continue;
    const value = String(candidate).trim();
    if (value) return value;
  }

  const roleId = resolveRoleId(record) ?? fallbackRoleId;
  if (roleId != null && catalog[roleId]) {
    return catalog[roleId];
  }

  return roleId != null ? `Rol ${roleId}` : "Sin rol asignado";
};

const shouldIgnoreRolesUsuariosError = (error) => {
  const status = Number(error?.status ?? error?.response?.status);
  return status === 403 || status === 404;
};

export default function Usuarios() {
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [detalleEmpleado, setDetalleEmpleado] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null);
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const getSessionUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  };

  const isAdminOrEmpleado = (user) => {
    const role = normalizeRole(user?.role ?? user?.rol ?? user?.rol_nombre ?? "");
    return role === "admin" || role === "empleado";
  };

  const isOwnUser = (targetUserId) => {
    const sessionUser = getSessionUser();
    const currentUserId = sessionUser?.id_usuario ?? sessionUser?.id;
    if (!sessionUser || currentUserId == null || targetUserId == null) return false;
    return String(currentUserId) === String(targetUserId);
  };

  const extractEmpleadoPayload = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  };

  const findEmpleadoByUser = async (user) => {
    if (!user?.id_usuario && !user?.email) return null;

    const empleadosResponse = await obtenerEmpleados();
    const empleados = extractEmpleadoPayload(empleadosResponse);

    return (
      empleados.find(
        (item) =>
          Number(item?.id_usuario ?? item?.id_usuario_usuario?.id_usuario) ===
          Number(user.id_usuario)
      ) ||
      empleados.find(
        (item) =>
          user.email &&
          String(item?.id_usuario_usuario?.email || item?.email || "").trim().toLowerCase() ===
            String(user.email).trim().toLowerCase()
      ) ||
      null
    );
  };

  const cargarTodasLasAsignacionesDeRol = async () => {
    const defaultLimit = null;
    const firstResponse = await obtenerRolesUsuarios({
      query: {
        page: 1,
      },
    });

    const { items: firstBatch, totalPages } = normalizePaginatedResponse(
      firstResponse,
      {
        preferredKeys: ["roles_usuarios", "data"],
        defaultPage: 1,
        defaultLimit,
      }
    );

    if (totalPages <= 1) {
      return firstBatch;
    }

    const remainingResponses = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        obtenerRolesUsuarios({
          query: {
            page: index + 2,
          },
        })
      )
    );

    const remainingItems = remainingResponses.flatMap((response) =>
      normalizePaginatedResponse(response, {
        preferredKeys: ["roles_usuarios", "data"],
        defaultPage: 1,
        defaultLimit,
      }).items
    );

    return [...firstBatch, ...remainingItems];
  };

  const cargarUsuarios = async ({
    page = pagination.page,
    limit = pagination.limit,
    search = searchQuery,
  } = {}) => {
    try {
      setIsLoading(true);

      const [usuariosResult, rolesResult, rolesUsuariosResult] =
        await Promise.allSettled([
          obtenerUsuarios({
            query: {
              page,
              limit,
              ...(search ? { search } : {}),
            },
          }),
          obtenerRoles(),
          cargarTodasLasAsignacionesDeRol(),
        ]);

      if (usuariosResult.status === "rejected") {
        throw usuariosResult.reason;
      }

      const usuariosResponse = usuariosResult.value;
      const rolesCatalogData =
        rolesResult.status === "fulfilled" ? extractList(rolesResult.value, ["data"]) : [];
      const rolesCatalogMap = rolesCatalogData.reduce((acc, role) => {
        const roleId = resolveRoleId(role);
        if (roleId == null) return acc;

        acc[roleId] =
          role?.nombre_rol ||
          role?.nombre ||
          role?.name ||
          role?.rol_nombre ||
          `Rol ${roleId}`;
        return acc;
      }, {});

      if (!rolesCatalogMap[33]) {
        rolesCatalogMap[33] = "Cliente";
      }

      let rolesData = [];
      if (rolesUsuariosResult.status === "fulfilled") {
        rolesData = extractList(rolesUsuariosResult.value);
      } else if (!shouldIgnoreRolesUsuariosError(rolesUsuariosResult.reason)) {
        throw rolesUsuariosResult.reason;
      } else {
        console.warn(
          "[usuarios] /roles_usuarios no disponible para la sesion actual; se usa informacion de /usuarios como fallback.",
          rolesUsuariosResult.reason,
        );
      }

      const {
        items: usuariosData,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(usuariosResponse, {
        preferredKeys: ["usuarios", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });

      const userRolesMap = rolesData.reduce((acc, roleAssignment) => {
        const userId = resolveUserId(roleAssignment);
        if (userId == null) return acc;

        const roleId = resolveRoleId(roleAssignment);
        const roleData =
          roleAssignment?.id_rol_rol ||
          roleAssignment?.rol ||
          roleAssignment?.role ||
          null;

        if (userId != null) {
          const nextRole = {
            id_usuario: userId,
            rol_id: roleId,
            rol_nombre: resolveRoleName(
              { ...roleAssignment, ...(roleData ? { id_rol_rol: roleData } : {}) },
              rolesCatalogMap,
              roleId,
            ),
            id_rol_rol: roleData,
          };
          const currentRole = acc[userId];

          if (
            !currentRole ||
            (!isConcreteRoleName(currentRole?.rol_nombre) &&
              isConcreteRoleName(nextRole?.rol_nombre)) ||
            (currentRole?.rol_id == null && nextRole?.rol_id != null)
          ) {
            acc[userId] = nextRole;
          }
        }
        return acc;
      }, {});

      const processedUsers = usuariosData.map((user) => {
        const userId = resolveUserId(user);
        const roleInfo = userRolesMap[userId] || {};
        const mergedRoleRecord = {
          ...roleInfo,
          ...user,
          id_rol_rol:
            user?.id_rol_rol ??
            user?.rol ??
            user?.role ??
            roleInfo?.id_rol_rol ??
            user?.roles_usuarios?.[0]?.id_rol_rol ??
            null,
        };
        const roleId = resolveRoleId(mergedRoleRecord);
        const roleName = resolveRoleName(mergedRoleRecord, rolesCatalogMap, roleId);

        const estadoUsuario =
          user.id_estado === 1 || user.id_estado === "1"
            ? "Activo"
            : user.id_estado === 2 || user.id_estado === "2"
              ? "Inactivo"
              : user.estado || "Desconocido";

        return {
          ...user,
          id_usuario: userId,
          rol_id: roleId ?? null,
          rol_nombre: roleName || "Sin rol asignado",
          id_rol_rol:
            user.id_rol_rol ??
            user.rol ??
            user.role ??
            roleInfo.id_rol_rol ??
            user?.roles_usuarios?.[0]?.id_rol_rol ??
            null,
          estado: estadoUsuario,
        };
      });

      setUsuarios(processedUsers);
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      toast.error("Error al cargar los usuarios");
      setUsuarios([]);
    } finally {
      setIsLoading(false);
    }
  };

  const cargarBeneficiarios = async () => {
    try {
      const response = await obtenerBeneficiarios();
      const lista = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setBeneficiarios(lista);
    } catch (error) {
      console.error("Error al cargar beneficiarios:", error);
      setBeneficiarios([]);
    }
  };

  const cargarMembresias = async () => {
    try {
      const response = await obtenerMembresias();
      const lista = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
        ? response.data
        : [];
      setMembresias(lista);
    } catch (error) {
      console.error("Error al cargar membresias:", error);
      setMembresias([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([cargarBeneficiarios(), cargarMembresias()]);
    };
    init();
  }, []);

  useEffect(() => {
    cargarUsuarios({ page: pagination.page, limit: pagination.limit, search: searchQuery });
  }, [pagination.page, pagination.limit, searchQuery]);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery]);

  const filteredUsuarios = searchQuery
    ? buscarUniversal(usuarios, searchQuery)
    : usuarios;

  const manejarCrearUsuario = async (nuevoUsuario) => {
    try {
      setIsLoading(true);
      if (
        !nuevoUsuario.nombre_usuario ||
        !nuevoUsuario.email ||
        !nuevoUsuario.password
      ) {
        throw new Error(
          "Nombre, correo electrónico y contraseña son campos requeridos"
        );
      }

      // Asegurar que los campos numéricos sean números
      const usuarioParaEnviar = {
        ...nuevoUsuario,
        id_estado: parseInt(nuevoUsuario.id_estado) || 1,
        rol_id: parseInt(nuevoUsuario.rol_id) || 3,
      };

      const respuesta = await apiCrearUsuario(usuarioParaEnviar);
      // Si la respuesta es exitosa pero no tiene datos, asumimos que el usuario se creó correctamente
      const usuarioCreado = respuesta || {
        ...usuarioParaEnviar,
        id_usuario: Date.now(),
      };

      // Actualizamos la lista de usuarios
      await cargarUsuarios(); // Recargar la lista completa de usuarios
      cerrarModal();
      toast.success("Usuario creado exitosamente");
      return usuarioCreado;
    } catch (error) {
      console.error("Error al crear el usuario:", error);
      toast.error(getApiErrorMessage(error, "Error al crear el usuario"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const manejarActualizarUsuario = async (usuarioActualizado) => {
    try {
      if (
        isAdminOrEmpleado(getSessionUser()) &&
        isOwnUser(usuarioActualizado?.id_usuario)
      ) {
        toast.error(SELF_USER_ACTION_BLOCKED_MESSAGE);
        return false;
      }

      setIsLoading(true);

      // Asegurar que los campos numéricos sean números
      const usuarioParaActualizar = {
        ...usuarioActualizado,
        id_estado: parseInt(usuarioActualizado.id_estado) || 1,
        rol_id: parseInt(usuarioActualizado.rol_id) || 3,
      };

      await apiActualizarUsuario(
        usuarioParaActualizar.id_usuario,
        usuarioParaActualizar
      );
      
      // Recargar la lista completa de usuarios para asegurar que tenemos los datos más recientes
      await cargarUsuarios();
      
      cerrarModal();
      toast.success("Usuario actualizado exitosamente");
      return true;
    } catch (error) {
      console.error("Error al actualizar el usuario:", error);
      toast.error(getApiErrorMessage(error, "Error al actualizar el usuario"));
      // Recargar usuarios en caso de error para mantener la consistencia
      await cargarUsuarios();
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const manejarEliminarUsuario = async (usuario) => {
    try {
      if (
        isAdminOrEmpleado(getSessionUser()) &&
        isOwnUser(usuario?.id_usuario)
      ) {
        toast.error(SELF_USER_ACTION_BLOCKED_MESSAGE);
        return;
      }

      setIsLoading(true);
      await apiEliminarUsuario(usuario.id_usuario);
      setPagination((prev) => ({ ...prev, page: 1 }));
      await cargarUsuarios({
        page: 1,
        limit: pagination.limit,
        search: searchQuery,
      });
      toast.success("Usuario eliminado exitosamente");
    } catch (error) {
      console.error("Error al eliminar el usuario:", error);

      // Check for specific validation error about associated records
      const errorMessage = error?.message || error?.response?.data?.message || "";
      if (errorMessage.includes("tiene registros asociados") ||
          errorMessage.includes("registros asociados") ||
          errorMessage.includes("ventas, beneficiarios")) {
        toast.error("No se puede eliminar este usuario porque tiene registros asociados (ventas, beneficiarios u otros). Para eliminarlo, primero debe eliminar o reasignar todos los registros relacionados.", {
          duration: 8000, // Show for 8 seconds since this is important information
        });
      } else {
        toast.error(getApiErrorMessage(error, "Error al eliminar el usuario"));
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (usuarioActualizado) => {
    // The Badge component already shows a confirmation modal, so we can directly update
    const nuevoEstado = usuarioActualizado.id_estado;
    const usuario = usuarios.find(u => u.id_usuario === usuarioActualizado.id_usuario);

    if (!usuario) return;

    // Update UI optimistically
    setUsuarios((prev) =>
      prev.map((u) =>
        u.id_usuario === usuario.id_usuario
          ? {
              ...u,
              id_estado: nuevoEstado,
              estado: nuevoEstado === 1 ? "Activo" : "Inactivo",
            }
          : u
      )
    );

    // Call the API
    try {
      await actualizarEstadoUsuario(usuario.id_usuario, nuevoEstado);
      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);

      // Recargar datos después de un breve delay para sincronizar con el backend
      setTimeout(() => {
        cargarUsuarios({
          page: pagination.page,
          limit: pagination.limit,
          search: searchQuery,
        });
      }, 500);
    } catch (error) {
      console.error("Error al actualizar el estado:", error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      cargarUsuarios({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
      });
    }
  };

  const abrirModal = async (accion, usuario = null) => {
    if (accion === "editar" && usuario) {
      if (
        isAdminOrEmpleado(getSessionUser()) &&
        isOwnUser(usuario?.id_usuario)
      ) {
        toast.error(SELF_USER_ACTION_BLOCKED_MESSAGE);
        return;
      }
    }

    if (accion === "ver" && usuario?.id_usuario) {
      let infoEmpleado = null;
      try {
        infoEmpleado = await findEmpleadoByUser(usuario);
      } catch (error) {
        const status = error?.status ?? error?.response?.status;
        if (status !== 404) {
          console.error("Error al cargar detalle de empleado para usuario:", error);
        }
      }
      setDetalleEmpleado(infoEmpleado);
    } else {
      setDetalleEmpleado(null);
    }

    setUsuarioSeleccionado(usuario);
    setAccionModal(accion);
  };

  const abrirModalEliminar = (usuario) => {
    if (!usuario) return;

    if (
      isAdminOrEmpleado(getSessionUser()) &&
      isOwnUser(usuario?.id_usuario)
    ) {
      toast.error(SELF_USER_ACTION_BLOCKED_MESSAGE);
      return;
    }

    setUsuarioAEliminar(usuario);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (usuario) => {
    try {
      await manejarEliminarUsuario(usuario);
      // No es necesario actualizar el estado local aquí ya que manejarEliminarUsuario ya lo hace
      setIsDeleteModalOpen(false);
      setUsuarioAEliminar(null);
      // Recargar la lista para asegurar sincronización
      await cargarUsuarios();
    } catch (error) {
      console.error("Error al confirmar eliminación:", error);
      setIsDeleteModalOpen(false);
      setUsuarioAEliminar(null);
    }
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setUsuarioSeleccionado(null);
    setDetalleEmpleado(null);
  };

  return (
    <div className="contenido-dashboard">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Users size={40} className="icono-titulo" color="red" />
          <h1>Gestión de Usuarios</h1>
        </div>
        <div className="acciones-derecha">
          <button
            className="boton boton-primario"
            onClick={() => abrirModal("crear")}
            disabled={!canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            <UserPlus size={20} className="mr-1" />
            Nuevo Usuario
          </button>
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar usuarios..."
            className="expandido"
          />
        </div>
      </div>

      <div className="table-container">
        <DataTable
          permisoId={permisoId}
          columns={columnasUsuarios}
          data={filteredUsuarios}
          loading={isLoading}
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
          onRefresh={async () => {
            await Promise.all([
              cargarUsuarios({
                page: pagination.page,
                limit: pagination.limit,
                search: searchQuery,
              }),
              cargarBeneficiarios(),
              cargarMembresias(),
            ]);
          }}
          onView={(usuario) => abrirModal("ver", usuario)}
          onEdit={(usuario) => abrirModal("editar", usuario)}
          onDelete={abrirModalEliminar}
          canEdit={() => canEdit}
          canDelete={() => canDelete}
          onStatusChange={handleStatusChange}
          emptyTitle="No se encontraron usuarios"
          emptyMessage="No hay usuarios disponibles para mostrar en la página actual."
          statusConfig={{
            values: { active: "Activo", inactive: "Inactivo" },
            colors: { active: "#4caf50", inactive: "#f44336" },
          }}
        />
      </div>

      {/* Modal para crear usuario */}
      {accionModal === "crear" && canCreate && (
        <BaseUserModal
          title="Nuevo Usuario"
          initialData={{}}
          onClose={cerrarModal}
          onSave={manejarCrearUsuario}
          isOpen={true}
        />
      )}

      {/* Modal para ver usuario */}
      {accionModal === "ver" && usuarioSeleccionado && (
        <BaseUserModal
          title="Detalles del Usuario"
          initialData={usuarioSeleccionado}
          onClose={cerrarModal}
          isOpen={true}
          disabled={true}
          beneficiarios={beneficiarios}
          membresias={membresias}
          usuariosReferencia={usuarios}
          empleadoInfo={detalleEmpleado}
          showClientSummary={true}
          showEmployeeSummary={true}
        />
      )}

      {/* Modal para editar usuario */}
      {accionModal === "editar" && usuarioSeleccionado && (
        <BaseUserModal
          title="Editar Usuario"
          initialData={usuarioSeleccionado}
          onClose={cerrarModal}
          onSave={manejarActualizarUsuario}
          isOpen={true}
        />
      )}

      {/* Modal de confirmación para eliminar */}
      {usuarioAEliminar && (
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setUsuarioAEliminar(null);
          }}
          onConfirm={handleConfirmDelete}
          item={usuarioAEliminar}
          title="Eliminar Usuario"
          fields={[
            {
              key: "nombre_usuario",
              label: "Nombre",
              format: (value) => (
                <strong>{value || "Usuario sin nombre"}</strong>
              ),
            },
            {
              key: "email",
              label: "Correo",
              format: (value) => value || "Sin correo electrónico",
            },
            {
              key: "documento",
              label: "Documento",
              format: (value) => value || "No especificado",
            },
          ]}
          warningMessage="Esta acción no se puede deshacer. El usuario será eliminado permanentemente del sistema."
        />
      )}

    </div>
  );
}
