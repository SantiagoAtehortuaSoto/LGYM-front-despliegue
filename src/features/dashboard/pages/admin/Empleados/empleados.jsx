import { useState, useEffect, useMemo } from "react";
import { Users, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import BaseEmpleadoModal from "./modalEmpleados";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import { columnasUsuarios } from "../../../../../shared/utils/data/ejemploUsuarios";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import "../../../../../shared/styles/restructured/components/modal-empleados.css";

import {
  obtenerUsuariosNoClientes,
  obtenerUsuarioPorId,
  eliminarUsuario as apiEliminarUsuario,
  actualizarEstadoUsuario,
  obtenerRolesUsuarios,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import {
  crearEmpleado as apiCrearEmpleado,
  actualizarEmpleado as apiActualizarEmpleado,
  obtenerEmpleados,
} from "../../../hooks/Empleados_API/API_Empleados";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import { buscarUniversal } from "../../../../../shared/utils/búsquedaUniversal";
import { normalizeEmployeeShift } from "../../../../../shared/utils/employeeSchedule";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const DEFAULT_PAGE_SIZE = DEFAULT_DATA_TABLE_PAGE_SIZE;
const CLIENT_ROLE_ID = 33;

export default function Empleados() {
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [roles, setRoles] = useState([]);
  const [rolesMap, setRolesMap] = useState({});
  const [empleados, setEmpleados] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [empleadoAEliminar, setEmpleadoAEliminar] = useState(null);
  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    empleado: null,
    nuevoEstado: null,
    nombreEmpleado: "",
  });
  const [saveErrorModal, setSaveErrorModal] = useState({
    isOpen: false,
    title: "No se pudo guardar el empleado",
    message: "",
  });
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const normalizeText = (value) => {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  };

  const isConcreteRoleName = (value) => {
    const text = String(value ?? "").trim();
    if (!text) return false;
    if (normalizeText(text) === "sin rol asignado") return false;
    return !/^rol\s+\d+$/i.test(text);
  };

  const resolvePhoneValue = (...sources) => {
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;

      const phone =
        source.telefono ??
        source.numero_telefono ??
        source.telefono_movil ??
        source.telefono_celular ??
        source.celular ??
        source.phone ??
        source.telefono_usuario ??
        source.celular_usuario;

      if (phone != null && String(phone).trim()) {
        return String(phone).trim();
      }
    }

    return "";
  };

  const isExcludedRole = (roleName, roleId) => {
    const id = Number(roleId);
    if (id === CLIENT_ROLE_ID) return true;

    const name = normalizeText(roleName);
    const isAdmin = name.includes("admin") || name.includes("administrador");
    return isAdmin;
  };

  const extractList = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  };

  const extractRecord = (response) => {
    if (!response || Array.isArray(response)) return null;
    if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
      return response.data;
    }
    return typeof response === "object" ? response : null;
  };

  const resolveUserId = (record = {}) =>
    record?.id_usuario ??
    record?.usuario_id ??
    record?.id_usuario_usuario?.id_usuario ??
    record?.id_usuario_usuario?.id ??
    record?.usuario?.id_usuario ??
    record?.usuario?.id ??
    null;

  const resolveRoleId = (record = {}) => {
    const candidates = [
      record?.id_rol,
      record?.rol_id,
      record?.roleId,
      record?.id_rol_rol?.id_rol,
      record?.id_rol_rol?.id,
      record?.rol?.id_rol,
      record?.rol?.id,
      record?.role?.id_rol,
      record?.role?.id,
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

  const findEmpleadoByUserId = async (userId, userEmail = "") => {
    const empleadosResponse = await obtenerEmpleados();
    const empleadosData = extractList(empleadosResponse);

    return (
      empleadosData.find(
        (item) =>
          Number(item?.id_usuario ?? item?.id_usuario_usuario?.id_usuario) ===
          Number(userId)
      ) ||
      empleadosData.find(
        (item) =>
          userEmail &&
          String(item?.id_usuario_usuario?.email || item?.email || "").trim().toLowerCase() ===
            String(userEmail).trim().toLowerCase()
      ) ||
      null
    );
  };

  const cargarTodosLosRegistrosEmpleado = async () => {
    const defaultLimit = null;
    const firstResponse = await obtenerEmpleados({
      query: {
        page: 1,
      },
    });

    const { items: firstBatch, totalPages } = normalizePaginatedResponse(
      firstResponse,
      {
        preferredKeys: ["empleados", "data"],
        defaultPage: 1,
        defaultLimit,
      }
    );

    if (totalPages <= 1) {
      return firstBatch;
    }

    const remainingResponses = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        obtenerEmpleados({
          query: {
            page: index + 2,
          },
        })
      )
    );

    const remainingItems = remainingResponses.flatMap((response) =>
      normalizePaginatedResponse(response, {
        preferredKeys: ["empleados", "data"],
        defaultPage: 1,
        defaultLimit,
      }).items
    );

    return [...firstBatch, ...remainingItems];
  };

  const cargarTodasLasAsignacionesDeRol = async () => {
    const defaultLimit = 100;
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

  const cargarEmpleados = async ({
    page = pagination.page,
    limit = pagination.limit,
    search = searchQuery,
  } = {}) => {
    try {
      setIsLoading(true);

      const [rolesResponse, usuariosResponse, empleadosData] = await Promise.all([
        cargarTodasLasAsignacionesDeRol(),
        obtenerUsuariosNoClientes({
          query: {
            page,
            limit,
            ...(search ? { search } : {}),
          },
        }),
        cargarTodosLosRegistrosEmpleado(),
      ]);

      const rolesData = extractList(rolesResponse);
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

      const rolesCatalogMap = rolesData.reduce((acc, roleAssignment) => {
        const roleId = resolveRoleId(roleAssignment);
        if (roleId == null || acc[roleId]) return acc;

        const roleData =
          roleAssignment.id_rol_rol ||
          roleAssignment.rol ||
          roleAssignment.role ||
          roleAssignment;

        acc[roleId] = resolveRoleName(roleData, {}, roleId);
        return acc;
      }, {});

      const userRolesMap = rolesData.reduce((acc, roleAssignment) => {
        if (!roleAssignment) return acc;

        const userId = resolveUserId(roleAssignment);
        if (userId == null) return acc;

        const roleId = resolveRoleId(roleAssignment);
        const roleData =
          roleAssignment.id_rol_rol ||
          roleAssignment.rol ||
          roleAssignment.role ||
          {};

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
        return acc;
      }, {});

      const empleadosByUserId = empleadosData.reduce((acc, empleado) => {
        const userId = resolveUserId(empleado);
        if (userId != null) {
          acc[userId] = empleado;
        }
        return acc;
      }, {});

      const processedUsers = usuariosData.map((usuario) => {
          const userId = resolveUserId(usuario);
          const empleado = empleadosByUserId[userId] || {};
          const usuarioData =
            usuario?.id_usuario_usuario ||
            usuario?.usuario ||
            (usuario && typeof usuario === "object" ? usuario : {});
          const roleInfo = userRolesMap[userId] || {};
          const mergedRoleRecord = {
            ...roleInfo,
            ...empleado,
            ...usuario,
            ...usuarioData,
            id_rol_rol:
              usuarioData?.id_rol_rol ??
              usuario?.id_rol_rol ??
              usuario?.rol ??
              usuario?.role ??
              empleado?.id_rol_rol ??
              empleado?.rol ??
              empleado?.role ??
              roleInfo?.id_rol_rol ??
              usuario?.roles_usuarios?.[0]?.id_rol_rol ??
              null,
          };
          const roleId = resolveRoleId(mergedRoleRecord);
          const roleName = resolveRoleName(
            mergedRoleRecord,
            rolesCatalogMap,
            roleId,
          );
          const statusSource =
            usuarioData?.id_estado ?? empleado?.id_estado ?? usuario?.estado;
          const estadoUsuario =
            statusSource === 1 || statusSource === "1"
              ? "Activo"
              : statusSource === 2 || statusSource === "2"
              ? "Inactivo"
              : usuarioData?.estado || empleado?.estado || usuario?.estado || "Desconocido";

          return {
            ...empleado,
            ...usuario,
            ...usuarioData,
            id_empleado: empleado?.id_empleado ?? empleado?.id ?? null,
            id_usuario: userId,
            email:
              usuarioData?.email ??
              usuario?.email ??
              empleado?.email ??
              roleInfo?.email ??
              "",
            telefono: resolvePhoneValue(usuarioData, usuario, empleado, roleInfo),
            n_emergencia:
              usuarioData?.n_emergencia ??
              usuario?.n_emergencia ??
              empleado?.n_emergencia ??
              roleInfo?.n_emergencia ??
              "",
            c_emergencia:
              usuarioData?.c_emergencia ??
              usuario?.c_emergencia ??
              empleado?.c_emergencia ??
              roleInfo?.c_emergencia ??
              "",
            rol_id: roleId ?? null,
            rol_nombre: roleName || "Sin rol asignado",
            id_rol_rol:
              usuarioData?.id_rol_rol ??
              usuario?.id_rol_rol ??
              usuario?.rol ??
              usuario?.role ??
              empleado?.id_rol_rol ??
              roleInfo?.id_rol_rol ??
              usuario?.roles_usuarios?.[0]?.id_rol_rol ??
              null,
            estado: estadoUsuario,
          };
        });

      setEmpleados(processedUsers);
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (error) {
      console.error("Error al cargar empleados:", error);
      toast.error("Error al cargar los empleados");
      setEmpleados([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const rolesData = await cargarTodasLasAsignacionesDeRol();

      // Create a map of role IDs to role names for easy lookup (unique roles only)
      const newRolesMap = rolesData.reduce((acc, role) => {
        const roleId = resolveRoleId(role);
        const roleData = role.id_rol_rol || role.rol || role.role || {};
        const roleName = resolveRoleName(roleData, roleId);
        if (roleId && !acc[roleId]) {
          acc[roleId] = roleName;
        }
        return acc;
      }, {});

      // Transform roles to the format expected by the UI (filter for employees only)
      const formattedRoles = Object.entries(newRolesMap)
        .filter(([id, nombre]) => !isExcludedRole(nombre, Number(id)))
        .map(([id, nombre]) => ({
          id: Number(id),
          id_rol: Number(id),
          nombre: nombre,
        }));

      setRoles(formattedRoles);
      setRolesMap(newRolesMap);
      return formattedRoles;
    } catch (error) {
      console.error("Error al obtener roles:", error);
      toast.error("Error al cargar los roles");
      throw error;
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    cargarEmpleados({
      page: pagination.page,
      limit: pagination.limit,
      search: searchQuery,
    });
  }, [pagination.page, pagination.limit, searchQuery]);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery]);

  const handleStatusChange = (empleado) => {
    setEstadoPendiente({
      mostrar: true,
      empleado: empleado,
      nuevoEstado: empleado.id_estado === 1 ? 2 : 1,
      nombreEmpleado: empleado.nombre_usuario || "este empleado",
    });
  };

  const empleadosConHandlers = useMemo(() => {
    const base = searchQuery
      ? buscarUniversal(empleados, searchQuery)
      : empleados;

    return base.map((empleado) => ({
      ...empleado,
      onStatusChange: handleStatusChange,
    }));
  }, [empleados, handleStatusChange, searchQuery]);

  const confirmarCambioEstado = async () => {
    if (!estadoPendiente.empleado?.id_usuario) return;

    const { empleado, nuevoEstado } = estadoPendiente;

    // Actualizar la UI de forma optimista
    setEmpleados((prev) =>
      prev.map((u) =>
        u.id_usuario === empleado.id_usuario
          ? {
              ...u,
              id_estado: nuevoEstado,
              estado: nuevoEstado === 1 ? "Activo" : "Inactivo",
            }
          : u
      )
    );

    try {
      await actualizarEstadoUsuario(empleado.id_usuario, nuevoEstado);
      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);

      // Recargar datos desde el backend tras un breve delay
      setTimeout(() => {
        cargarEmpleados({
          page: pagination.page,
          limit: pagination.limit,
          search: searchQuery,
        });
      }, 500);
    } catch (error) {
      console.error("Error al actualizar el estado:", error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      cargarEmpleados({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
      });
    } finally {
      setEstadoPendiente({
        mostrar: false,
        empleado: null,
        nuevoEstado: null,
        nombreEmpleado: "",
      });
    }
  };

  const buildEmpleadoPayload = (data = {}) => {
    const userId = Number(data.id_usuario);

    return {
      id_usuario: Number.isFinite(userId) ? userId : data.id_usuario,
      direccion_empleado: String(data.direccion_empleado || "").trim(),
      cargo: String(data.cargo || "").trim(),
      fecha_contratacion: data.fecha_contratacion || "",
      salario: Number(data.salario),
      horario_empleado: normalizeEmployeeShift(data.horario_empleado),
    };
  };

  const handleSave = async (empleadoData) => {
    try {
      setIsLoading(true);

      // Validate role
      const rolNombre =
        rolesMap[empleadoData.rol_id] || empleadoData.rol_nombre || "";
      if (empleadoData.rol_id && isExcludedRole(rolNombre, empleadoData.rol_id)) {
        throw new Error("No se puede asignar este rol a un empleado");
      }

      const isEditMode =
        accionModal === "editar" && Boolean(empleadoSeleccionado?.id_usuario);
      const shouldUpdate = isEditMode || Boolean(empleadoData.__forceUpdateExisting);

      if (shouldUpdate) {
        const empleadoId = isEditMode
          ? empleadoSeleccionado.id_empleado ??
            empleadoSeleccionado.id ??
            empleadoSeleccionado.id_usuario
          : empleadoData.id_empleado ?? empleadoData.id ?? empleadoData.id_usuario;
        if (!empleadoId) {
          throw new Error("No se pudo determinar el empleado a actualizar");
        }

        const payloadPut = buildEmpleadoPayload({
          ...empleadoData,
          id_usuario: empleadoData.id_usuario ?? empleadoSeleccionado?.id_usuario,
        });

        const response = await apiActualizarEmpleado(empleadoId, payloadPut);
        toast.success("Empleado actualizado exitosamente");
      } else {
        if (!empleadoData.id_usuario) {
          throw new Error("Debe seleccionar un usuario para crear el empleado");
        }

        const payloadPost = buildEmpleadoPayload(empleadoData);

        const response = await apiCrearEmpleado(payloadPost);
        toast.success("Empleado creado exitosamente");
      }

      await cargarEmpleados({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
      });
      setAccionModal(null);
      return true;
    } catch (error) {
      console.error("Error detallado al guardar empleado:", {
        error,
        message: error.message,
        response: error.response,
        stack: error.stack
      });
      const errorMessage = getApiErrorMessage(
        error,
        "Error al guardar el empleado. Verifica los datos e inténtalo de nuevo."
      );
      setSaveErrorModal({
        isOpen: true,
        title: "No se pudo guardar el empleado",
        message: errorMessage,
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const manejarEliminarEmpleado = async (empleado) => {
    try {
      const usuarioActual = JSON.parse(localStorage.getItem("user"));

      const currentUserId = usuarioActual?.id_usuario || usuarioActual?.id;
      if (
        usuarioActual &&
        String(currentUserId) === String(empleado.id_usuario)
      ) {
        toast.error(
          "el usuario a editar o eliminar esta con su sesion iniciada y no puedes hacer esto"
        );
        return;
      }

      setIsLoading(true);
      await apiEliminarUsuario(empleado.id_usuario);
      setPagination((prev) => ({ ...prev, page: 1 }));
      await cargarEmpleados({
        page: 1,
        limit: pagination.limit,
        search: searchQuery,
      });
      toast.success("Empleado eliminado exitosamente");
    } catch (error) {
      console.error("Error al eliminar el empleado:", error);
      toast.error(getApiErrorMessage(error, "Error al eliminar el empleado"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const abrirModalEliminar = (empleado) => {
    if (!empleado) return;

    const usuarioActual = JSON.parse(localStorage.getItem("user"));

    const currentUserId = usuarioActual?.id_usuario || usuarioActual?.id;
    if (
      usuarioActual &&
      String(currentUserId) === String(empleado.id_usuario)
    ) {
      toast.error(
        "el usuario a editar o eliminar esta con su sesion iniciada y no puedes hacer esto"
      );
      return;
    }

    setEmpleadoAEliminar(empleado);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (empleado) => {
    try {
      await manejarEliminarEmpleado(empleado);
      setIsDeleteModalOpen(false);
      setEmpleadoAEliminar(null);
    } catch (error) {
      // Error already handled in manejarEliminarEmpleado
    }
  };

  const abrirModal = async (accion, empleado = null) => {
    if (accion === "editar" && empleado) {
      const usuarioActual = JSON.parse(localStorage.getItem("user"));
      const currentUserId = usuarioActual?.id_usuario || usuarioActual?.id;
      if (
        usuarioActual &&
        String(currentUserId) === String(empleado.id_usuario)
      ) {
        toast.error(
          "el usuario a editar o eliminar esta con su sesion iniciada y no puedes hacer esto"
        );
        return;
      }
    }

    if ((accion === "editar" || accion === "ver") && empleado?.id_usuario) {
      try {
        const [datosEmpleadoResult, datosUsuarioResult] = await Promise.allSettled([
          findEmpleadoByUserId(empleado.id_usuario, empleado.email),
          obtenerUsuarioPorId(empleado.id_usuario),
        ]);
        const datosEmpleado =
          datosEmpleadoResult.status === "fulfilled"
            ? datosEmpleadoResult.value
            : null;
        const datosUsuario =
          datosUsuarioResult.status === "fulfilled"
            ? extractRecord(datosUsuarioResult.value)
            : null;
        const usuarioAnidado = datosEmpleado?.id_usuario_usuario || {};
        const empleadoCompleto = {
          ...empleado,
          ...(datosEmpleado && typeof datosEmpleado === "object" ? datosEmpleado : {}),
          ...usuarioAnidado,
          ...(datosUsuario && typeof datosUsuario === "object" ? datosUsuario : {}),
          id_empleado: datosEmpleado?.id_empleado ?? datosEmpleado?.id ?? null,
          id_usuario:
            datosEmpleado?.id_usuario ??
            datosUsuario?.id_usuario ??
            datosUsuario?.id ??
            usuarioAnidado?.id_usuario ??
            empleado.id_usuario,
          direccion_empleado:
            datosEmpleado?.direccion_empleado ?? empleado.direccion_empleado ?? "",
          cargo: datosEmpleado?.cargo ?? empleado.cargo ?? "",
          fecha_contratacion:
            datosEmpleado?.fecha_contratacion ?? empleado.fecha_contratacion ?? "",
          salario: datosEmpleado?.salario ?? empleado.salario ?? "",
          horario_empleado:
            normalizeEmployeeShift(
              datosEmpleado?.horario_empleado ?? empleado.horario_empleado
            ),
          nombre_usuario:
            datosUsuario?.nombre_usuario ??
            usuarioAnidado?.nombre_usuario ??
            empleado.nombre_usuario ??
            "",
          apellido_usuario:
            datosUsuario?.apellido_usuario ??
            usuarioAnidado?.apellido_usuario ??
            empleado.apellido_usuario ??
            "",
          tipo_documento:
            datosUsuario?.tipo_documento ??
            usuarioAnidado?.tipo_documento ??
            empleado.tipo_documento ??
            "CC",
          documento:
            datosUsuario?.documento ??
            usuarioAnidado?.documento ??
            empleado.documento ??
            "",
          fecha_nacimiento:
            datosUsuario?.fecha_nacimiento ??
            usuarioAnidado?.fecha_nacimiento ??
            empleado.fecha_nacimiento ??
            "",
          genero:
            datosUsuario?.genero ??
            usuarioAnidado?.genero ??
            empleado.genero ??
            "",
          email:
            datosUsuario?.email ??
            usuarioAnidado?.email ??
            empleado.email ??
            "",
          telefono: resolvePhoneValue(datosUsuario, usuarioAnidado, empleado),
          n_emergencia:
            datosUsuario?.n_emergencia ??
            usuarioAnidado?.n_emergencia ??
            empleado.n_emergencia ??
            "",
          c_emergencia:
            datosUsuario?.c_emergencia ??
            usuarioAnidado?.c_emergencia ??
            empleado.c_emergencia ??
            "",
          enfermedades:
            datosUsuario?.enfermedades ??
            usuarioAnidado?.enfermedades ??
            empleado.enfermedades ??
            "N/A",
          id_estado:
            datosUsuario?.id_estado ??
            usuarioAnidado?.id_estado ??
            empleado.id_estado ??
            null,
        };
        setEmpleadoSeleccionado(empleadoCompleto);
        setAccionModal(accion);
      } catch (error) {
        console.error("Error al cargar datos del empleado:", error);
        setEmpleadoSeleccionado(empleado);
        setAccionModal(accion);
      }
    } else {
      setEmpleadoSeleccionado(empleado);
      setAccionModal(accion);
    }
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setEmpleadoSeleccionado(null);
  };

  return (
    <div className="contenido-dashboard">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Users size={40} className="icono-titulo" color="red" />
          <h1>Gestión de Empleados</h1>
        </div>
        <div className="acciones-derecha">
          <button
            className="boton boton-primario"
            onClick={() => abrirModal("crear")}
            disabled={isLoading || !canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            <UserPlus size={20} className="mr-1" />
            Nuevo Empleado
          </button>
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar empleados..."
            className="expandido"
          />
        </div>
      </div>

      <div className="table-container">
        <DataTable
          permisoId={permisoId}
          columns={columnasUsuarios}
          data={empleadosConHandlers}
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
              cargarEmpleados({
                page: pagination.page,
                limit: pagination.limit,
                search: searchQuery,
              }),
              fetchRoles(),
            ]);
          }}
          onView={(empleado) => abrirModal("ver", empleado)}
          onEdit={(empleado) => abrirModal("editar", empleado)}
          onDelete={abrirModalEliminar}
          canEdit={() => canEdit}
          canDelete={() => canDelete}
          onStatusChange={handleStatusChange}
          emptyTitle="No se encontraron empleados"
          emptyMessage="No hay empleados disponibles para mostrar en la página actual."
          statusConfig={{
            values: { active: "Activo", inactive: "Inactivo" },
            colors: { active: "#4caf50", inactive: "#f44336" },
          }}
        />
      </div>

      {/* Create Employee Modal */}
      {accionModal === "crear" && canCreate && (
        <BaseEmpleadoModal
          title="Nuevo Empleado"
          initialData={null}
          onClose={cerrarModal}
          onSave={handleSave}
          isOpen={true}
          roles={roles.filter((role) => !isExcludedRole(role.nombre, role.id_rol))}
        />
      )}

      {/* View Employee Modal */}
      {accionModal === "ver" && empleadoSeleccionado && (
        <BaseEmpleadoModal
          title={`Detalles del Empleado #${empleadoSeleccionado.id_usuario}`}
          initialData={empleadoSeleccionado}
          onClose={cerrarModal}
          isOpen={true}
          disabled={true}
          roles={roles.filter((role) => !isExcludedRole(role.nombre, role.id_rol))}
        />
      )}

      {/* Edit Employee Modal */}
      {accionModal === "editar" && empleadoSeleccionado && (
        <BaseEmpleadoModal
          title="Editar Empleado"
          initialData={empleadoSeleccionado}
          onClose={cerrarModal}
          onSave={handleSave}
          isOpen={true}
          roles={roles.filter((role) => !isExcludedRole(role.nombre, role.id_rol))}
        />
      )}

      {/* Delete Confirmation Modal */}
      {empleadoAEliminar && (
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setEmpleadoAEliminar(null);
          }}
          onConfirm={handleConfirmDelete}
          item={empleadoAEliminar}
          title="Eliminar Empleado"
          fields={[
            {
              key: "nombre_usuario",
              label: "Nombre",
              format: (value) => (
                <strong>{value || "Empleado sin nombre"}</strong>
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
            {
              key: "rol_nombre",
              label: "Rol",
              format: (value) => value || "Sin rol",
            },
          ]}
          warningMessage="Esta acción no se puede deshacer. El empleado será eliminado permanentemente del sistema."
        />
      )}

      {/* Modal de confirmación para cambio de estado */}
      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={() =>
          setEstadoPendiente({
            mostrar: false,
            empleado: null,
            nuevoEstado: null,
            nombreEmpleado: "",
          })
        }
        onConfirm={confirmarCambioEstado}
        targetStatus={estadoPendiente.nuevoEstado}
        title={`Cambiar estado a ${
          estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"
        }`}
        message={`¿Estás seguro de que deseas marcar el empleado "${estadoPendiente.nombreEmpleado}" como ${estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"}?`}
        confirmText={
          estadoPendiente.nuevoEstado === 1 ? "Activar" : "Desactivar"
        }
        type={estadoPendiente.nuevoEstado === 1 ? "activate" : "deactivate"}
        details={estadoPendiente.nombreEmpleado}
      />

      <ConfirmModal
        isOpen={saveErrorModal.isOpen}
        onClose={() =>
          setSaveErrorModal({
            isOpen: false,
            title: "No se pudo guardar el empleado",
            message: "",
          })
        }
        onConfirm={() =>
          setSaveErrorModal({
            isOpen: false,
            title: "No se pudo guardar el empleado",
            message: "",
          })
        }
        title={saveErrorModal.title}
        message={saveErrorModal.message}
        confirmText="Aceptar"
        cancelText="Cerrar"
        type="warning"
      />
    </div>
  );
}
