// src/features/dashboard/hooks/Roles_API/role_API_AD.jsx
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_DATA_TABLE_PAGE_SIZE } from "../../components/dataTables/dataTable";
import {
  getRoles,
  getDetallesRol,
  crearRol as apiCrearRol,
  actualizarRol as apiActualizarRol,
  actualizarEstadoRol as apiActualizarEstadoRol,
  eliminarRol as apiEliminarRol,
  getPermisosCatalog,
} from "../Roles_API/roles.jsx";
import { normalizePaginatedResponse } from "../../../../shared/utils/pagination";

const PERMISO_ID_MAP = {
  usuarios: 1,
  roles: 2,
  productos: 3,
  proveedores: 4,
  servicios: 5,
  empleados: 6,
  compras: 7,
  ventas: 8,
  clientes: 9,
  membresias: 10,
  "seguimiento deportivo": 15,
  seguimiento: 15,
  asistencia: 16,
  asistencias: 16,
  "ventas membresías": 17,
  "ventas membresía": 17,
  "asignar citas": 18,
  "asignar cita": 18,
  "agendar citas": 18,
};
const PROTECTED_ROLE_IDS = new Set([33]);

const normalizeTextSafe = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const mapPrivilegioToActionKey = (label = "") => {
  const normalized = normalizeTextSafe(label);
  if (/^(ver|visualizar|view|read)\b/.test(normalized)) return "ver";
  if (/^(crea|crear|create|registrar|nuevo|agregar|add)\b/.test(normalized)) {
    return "crear";
  }
  if (/^(edi|editar|edit|actualizar|update|modificar)\b/.test(normalized)) {
    return "editar";
  }
  if (/^(elim|eliminar|delete|borrar|remove)\b/.test(normalized)) return "eliminar";
  return null;
};

const buildPermisoHelpers = (catalogo = []) => {
  const moduloNameToPermisoId = {};
  const permisoIdToModuloName = {};
  const privilegioNameToId = {};
  const privilegioIdToAccion = {};

  catalogo.forEach((item) => {
    const moduloName = item?.modulo ?? "";
    const normalizedModulo = normalizeTextSafe(moduloName);
    const fallbackPermisoId = PERMISO_ID_MAP[normalizedModulo];

    const acciones = Array.isArray(item?.acciones) ? item.acciones : [];
    const firstAccion = acciones[0];
    let permisoId = Number(firstAccion?.id_permiso);
    if (!Number.isInteger(permisoId) && Number.isInteger(fallbackPermisoId)) {
      permisoId = fallbackPermisoId;
    }
    if (Number.isInteger(permisoId)) {
      moduloNameToPermisoId[normalizedModulo] = permisoId;
      permisoIdToModuloName[permisoId] = moduloName || normalizedModulo;
    }

    acciones.forEach((accion) => {
      const actionKey = mapPrivilegioToActionKey(accion?.privilegio);
      const privId = Number(accion?.id_privilegio);
      if (!actionKey || !Number.isInteger(privId)) return;
      privilegioNameToId[actionKey] = privId;
      privilegioIdToAccion[privId] = actionKey;
    });
  });

  // Aseguramos IDs conocidos aunque el catálogo venga incompleto
  Object.entries(PERMISO_ID_MAP).forEach(([normalized, id]) => {
    if (!moduloNameToPermisoId[normalized]) {
      moduloNameToPermisoId[normalized] = id;
    }
    if (!permisoIdToModuloName[id]) {
      permisoIdToModuloName[id] = normalized;
    }
  });

  const fallbackPrivilegios = { ver: 1, crear: 2, editar: 3, eliminar: 4 };
  Object.entries(fallbackPrivilegios).forEach(([action, id]) => {
    if (!Number.isInteger(privilegioNameToId[action])) {
      privilegioNameToId[action] = id;
    }
    if (!privilegioIdToAccion[id]) {
      privilegioIdToAccion[id] = action;
    }
  });

  return {
    rawCatalog: catalogo,
    moduloNameToPermisoId,
    permisoIdToModuloName,
    privilegioNameToId,
    privilegioIdToAccion,
  };
};

const mapRolFromApi = (apiRol = {}) => {
  const id = apiRol.id_rol ?? apiRol.id_roles ?? apiRol.id ?? 0;
  const nombre = apiRol.nombre_rol ?? apiRol.nombre ?? "";
  const descripcion = apiRol.descripcion_rol ?? apiRol.descripcion ?? "";

  const id_estado_raw = Number(apiRol.id_estado ?? 1);
  const id_estado = id_estado_raw === 1 ? 1 : 2;
  const estado = id_estado === 1 ? "Activo" : "Inactivo";

  const detalles = Array.isArray(apiRol.detallesrols)
    ? apiRol.detallesrols
    : [];

  const permisosAsignados = detalles
    .map((detalle) => ({
      id_permiso: Number(detalle.id_permiso ?? detalle.permiso_id),
      id_privilegio: Number(detalle.id_privilegio ?? detalle.privilegio_id),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.id_permiso) && Number.isInteger(item.id_privilegio)
    );

  return {
    id,
    nombre,
    descripcion,
    id_estado,
    estado,
    permisosAsignados,
    fecha_creacion: apiRol.fecha_creacion ?? apiRol.created_at ?? "",
  };
};

const normalizePermisosArray = (permisos) => {
  if (!Array.isArray(permisos)) return [];
  return permisos
    .map((item) => {
      const id_permiso = Number(item.id_permiso);
      if (!Number.isInteger(id_permiso)) return null;
      let privilegios = [];
      if (Array.isArray(item.privilegios)) privilegios = item.privilegios;
      else if (item.id_privilegio != null) privilegios = [item.id_privilegio];

      const uniquePrivs = [
        ...new Set(
          privilegios
            .map((p) => Number(p))
            .filter((p) => Number.isInteger(p) && p > 0)
        ),
      ];

      if (uniquePrivs.length === 0) return null;
      return { id_permiso, privilegios: uniquePrivs };
    })
    .filter(Boolean);
};

const mapRolToApi = (uiRol = {}) => {
  const nombre_rol = (uiRol.nombre_rol ?? uiRol.nombre ?? "").trim();

  let id_estado = uiRol.id_estado;
  if (id_estado === undefined || id_estado === null) {
    if (typeof uiRol.estado === "string") {
      const est = uiRol.estado.toLowerCase();
      id_estado = est.includes("inac") ? 2 : 1;
    } else {
      id_estado = 1;
    }
  }
  id_estado = Number(id_estado) === 1 ? 1 : 2;

  const permisos = normalizePermisosArray(uiRol.permisos);

  return {
    nombre_rol,
    id_estado,
    permisos,
  };
};

/* ======================================================
   Hook: Gestión de Roles
====================================================== */
export function useRoles(options = {}) {
  const paginated = Boolean(options?.paginated);
  const initialLimit =
    Number(options?.initialLimit) || DEFAULT_DATA_TABLE_PAGE_SIZE;
  const search = String(options?.search ?? "").trim();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [permisosCatalogo, setPermisosCatalogo] = useState([]);
  const [permisoHelpers, setPermisoHelpers] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: initialLimit,
    totalPages: 1,
    totalItems: 0,
  });

  const token = localStorage.getItem("token");

  const cargarCatalogoPermisos = useCallback(async () => {
    try {
      const res = await getPermisosCatalog({ token });
      const catalogo = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setPermisosCatalogo(catalogo);
      setPermisoHelpers(buildPermisoHelpers(catalogo));
    } catch (err) {
      console.error(err);
      setError((prev) => prev || "Error al cargar el catálogo de permisos");
    }
  }, [token]);

  useEffect(() => {
    cargarCatalogoPermisos();
  }, [cargarCatalogoPermisos]);

  const cargarRoles = useCallback(async ({
    page = pagination.page,
    limit = pagination.limit,
    search: searchParam = search,
  } = {}) => {
    try {
      setLoading(true);
      setError("");

      const [resRoles, resDetalles] = await Promise.all([
        getRoles({
          token,
          query: paginated
            ? {
                page,
                limit,
                ...(searchParam ? { search: searchParam } : {}),
              }
            : {},
        }),
        getDetallesRol({ token }),
      ]);

      const {
        items: listaRoles,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(resRoles, {
        preferredKeys: ["roles", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });

      const listaDetalles = Array.isArray(resDetalles?.data)
        ? resDetalles.data
        : Array.isArray(resDetalles)
        ? resDetalles
        : [];

      const detallesPorRol = listaDetalles.reduce((acc, det) => {
        const idRol = det.id_rol ?? det.rol_id ?? det.idRol ?? det.id_roles;
        if (!idRol) return acc;
        if (!acc[idRol]) acc[idRol] = [];
        acc[idRol].push(det);
        return acc;
      }, {});

      const normalizados = listaRoles.map((rol) => {
        const idRol = rol.id_rol ?? rol.id ?? rol.id_roles;
        const detalles = detallesPorRol[idRol] || [];
        return mapRolFromApi({ ...rol, detallesrols: detalles });
      });

      setRoles(normalizados);
      setPagination((prev) => ({
        ...prev,
        page: paginated ? resolvedPage : 1,
        limit: paginated ? resolvedLimit : initialLimit,
        totalPages: paginated ? totalPages : Math.max(1, totalPages),
        totalItems: paginated ? totalItems : normalizados.length,
      }));
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al cargar roles");
    } finally {
      setLoading(false);
    }
  }, [initialLimit, paginated, pagination.limit, pagination.page, search, token]);

  useEffect(() => {
    cargarRoles();
  }, [cargarRoles]);

  const crearRol = useCallback(
    async (nuevoRolUI) => {
      const body = mapRolToApi(nuevoRolUI);
      const creado = await apiCrearRol(body, { token });
      await cargarRoles();
      return mapRolFromApi({ ...creado, detallesrols: [] });
    },
    [token, cargarRoles]
  );

  const actualizarRol = useCallback(
    async (id, rolActualizadoUI) => {
      const body = mapRolToApi(rolActualizadoUI);
      const actualizado = await apiActualizarRol(id, body, { token });
      await cargarRoles();
      return actualizado;
    },
    [token, cargarRoles]
  );

  const actualizarEstado = useCallback(
    async (rolActual, nuevoEstado) => {
      const actualizado = await apiActualizarEstadoRol(rolActual, nuevoEstado, {
        token,
      });
      await cargarRoles();
      return actualizado;
    },
    [token, cargarRoles]
  );

  const eliminarRol = useCallback(
    async (id) => {
      if (PROTECTED_ROLE_IDS.has(Number(id))) {
        throw new Error(`El rol ${id} está protegido y no se puede eliminar`);
      }
      await apiEliminarRol(id, { token });
      setPagination((prev) => ({ ...prev, page: 1 }));
      await cargarRoles({
        page: 1,
        limit: pagination.limit,
      });
      return true;
    },
    [cargarRoles, pagination.limit, token]
  );

  return {
    roles,
    loading,
    error,
    permisosCatalogo,
    permisoHelpers,
    permisosListos: Boolean(permisoHelpers),
    pagination,
    setPagination,
    recargar: cargarRoles,
    crearRol,
    actualizarRol,
    actualizarEstado,
    eliminarRol,
  };
}

