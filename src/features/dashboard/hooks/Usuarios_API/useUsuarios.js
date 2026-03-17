// src/features/dashboard/hooks/Usuarios_API/useUsuarios.js

import { useState, useCallback, useMemo, useRef } from "react";
import {
  obtenerUsuarios,
  obtenerUsuariosClientes,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  actualizarEstadoUsuario,
  obtenerRolesUsuarios,
} from "./API_Usuarios";
import { obtenerRoles } from "../Roles_API/roles_API";
import { getDetallesRol } from "../Roles_API/roles";
import { obtenerEmpleados } from "../Empleados_API/API_Empleados";
import { normalizePaginatedResponse } from "../../../../shared/utils/pagination";

const CLIENT_ROLE_ID = 33;
const APPOINTMENT_PERMISSION_ID = 18;

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ref para controlar si ya hay una llamada en progreso
  const loadingRef = useRef(false);

  const extractList = useCallback((response, preferredKeys = []) => {
    return normalizePaginatedResponse(response, {
      preferredKeys,
      defaultPage: 1,
      defaultLimit: null,
    }).items;
  }, []);

  const cargarTodasLasPaginas = useCallback(
    async (fetcher, { preferredKeys = ["data"], query = {} } = {}) => {
      const firstResponse = await fetcher({ query: { ...query, page: 1 } });
      const firstPage = normalizePaginatedResponse(firstResponse, {
        preferredKeys,
        defaultPage: 1,
        defaultLimit: null,
      });

      if (firstPage.totalPages <= 1) {
        return firstPage.items;
      }

      const remainingResponses = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
          fetcher({
            query: {
              ...query,
              page: index + 2,
            },
          }),
        ),
      );

      const remainingItems = remainingResponses.flatMap((response) =>
        normalizePaginatedResponse(response, {
          preferredKeys,
          defaultPage: 1,
          defaultLimit: null,
        }).items,
      );

      return [...firstPage.items, ...remainingItems];
    },
    [],
  );

  const buildFallbackRoleAssignment = useCallback((roleId, roleName, extra = {}) => {
    const parsedRoleId = Number(roleId);
    return {
      rol_id: Number.isFinite(parsedRoleId) ? parsedRoleId : roleId ?? null,
      rol_nombre: roleName,
      id_rol_rol: {
        id_rol: Number.isFinite(parsedRoleId) ? parsedRoleId : roleId ?? null,
        nombre_rol: roleName,
      },
      ...extra,
    };
  }, []);

  const normalizePermisosAsignados = useCallback((items = []) => {
    if (!Array.isArray(items)) return [];

    const normalized = items
      .map((item) => {
        const id_permiso = Number(
          item?.id_permiso ??
            item?.permiso_id ??
            item?.permiso?.id_permiso ??
            item?.permiso?.id ??
            item?.id
        );
        const rawPrivilegio =
          item?.id_privilegio ??
          item?.privilegio_id ??
          item?.privilegio?.id_privilegio ??
          item?.privilegio?.id;
        const id_privilegio = Number(rawPrivilegio);
        const modulo = String(
          item?.modulo ??
            item?.permiso?.modulo ??
            item?.permiso?.nombre ??
            item?.nombre ??
            ""
        ).trim();

        if (!Number.isInteger(id_permiso) && !modulo) return null;

        return {
          ...(Number.isInteger(id_permiso) ? { id_permiso } : {}),
          ...(Number.isInteger(id_privilegio) ? { id_privilegio } : {}),
          ...(modulo ? { modulo } : {}),
        };
      })
      .filter(Boolean);

    const seen = new Set();
    return normalized.filter((item) => {
      const key = `${item.id_permiso ?? item.modulo}|${item.id_privilegio ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const mergePermisosAsignados = useCallback(
    (...sources) => normalizePermisosAsignados(sources.flat()),
    [normalizePermisosAsignados],
  );

  const resolveUserId = useCallback((record) => {
    if (!record || typeof record !== "object") return null;

    const rawId =
      record.id_usuario ??
      record.usuario_id ??
      record.id_usuario_usuario?.id_usuario ??
      record.id_usuario_usuario?.id ??
      record.usuario?.id_usuario ??
      record.usuario?.id ??
      record.id;

    const numericId = Number(rawId);
    return Number.isFinite(numericId) ? numericId : rawId ?? null;
  }, []);

  const resolveEmail = useCallback((record) => {
    if (!record || typeof record !== "object") return "";
    return String(
      record.email ??
        record.correo ??
        record.id_usuario_usuario?.email ??
        record.usuario?.email ??
        "",
    )
      .trim()
      .toLowerCase();
  }, []);

  const buildFallbackUsers = useCallback(
    async () => {
      const [clientesResult, empleadosResult] = await Promise.allSettled([
        cargarTodasLasPaginas(obtenerUsuariosClientes, {
          preferredKeys: ["usuarios", "clientes", "data"],
        }),
        cargarTodasLasPaginas(obtenerEmpleados, {
          preferredKeys: ["empleados", "data"],
        }),
      ]);

      const clientesBase =
        clientesResult.status === "fulfilled" && Array.isArray(clientesResult.value)
          ? clientesResult.value
          : [];
      const empleadosBase =
        empleadosResult.status === "fulfilled" && Array.isArray(empleadosResult.value)
          ? empleadosResult.value
          : [];

      const clientesNormalizados = clientesBase
        .filter(Boolean)
        .map((cliente) => {
          const roleInfo = buildFallbackRoleAssignment(33, "Cliente");
          const userId = resolveUserId(cliente);
          return {
            ...cliente,
            id_usuario: userId,
            rol_id: 33,
            rol_nombre: "Cliente",
            permisosAsignados: [],
            rolesIds: [33],
            rolesNombres: ["Cliente"],
            roles_usuarios: [
              {
                id_usuario: userId,
                ...roleInfo,
                permisosAsignados: [],
              },
            ],
            id_rol_rol: {
              ...roleInfo.id_rol_rol,
              permisosAsignados: [],
            },
          };
        });

      const empleadosNormalizados = empleadosBase
        .filter(Boolean)
        .map((empleado) => {
          const userId = resolveUserId(empleado);
          const fallbackRoleId = Number(empleado?.id_rol ?? empleado?.rol_id ?? 2);
          const roleId =
            getRoleIdFromRecord(empleado) ??
            (Number.isFinite(fallbackRoleId) ? fallbackRoleId : 2);
          const roleName =
            getRoleNameFromRecord(empleado) ||
            empleado?.cargo ||
            empleado?.tipo_empleado ||
            "Empleado";
          const permisosAsignados = mergePermisosAsignados(
            empleado?.permisosAsignados || [],
            empleado?.permisos || [],
            empleado?.modules || [],
            empleado?.id_rol_rol?.permisosAsignados || [],
            empleado?.id_rol_rol?.permisos || [],
          );
          const hasAppointmentAccess =
            permisosAsignados.length > 0
              ? hasAppointmentAssignmentAccess(permisosAsignados)
              : true;
          const roleInfo = buildFallbackRoleAssignment(roleId, roleName, {
            permisosAsignados,
          });

          return {
            ...empleado,
            ...(empleado?.id_usuario_usuario &&
            typeof empleado.id_usuario_usuario === "object"
              ? empleado.id_usuario_usuario
              : {}),
            id_usuario: userId,
            id_empleado:
              empleado?.id_empleado ?? empleado?.id ?? empleado?.id_usuario ?? null,
            rol_id: roleInfo.rol_id,
            rol_nombre: roleInfo.rol_nombre,
            permisosAsignados,
            hasAppointmentAccess,
            rolesIds: Number.isFinite(Number(roleInfo.rol_id))
              ? [Number(roleInfo.rol_id)]
              : [],
            rolesNombres: roleInfo.rol_nombre ? [roleInfo.rol_nombre] : [],
            roles_usuarios: [
              {
                id_usuario: userId,
                ...roleInfo,
              },
            ],
            id_rol_rol: {
              ...roleInfo.id_rol_rol,
              permisosAsignados,
            },
          };
        });

      const combined = new Map();
      [...clientesNormalizados, ...empleadosNormalizados].forEach((usuario) => {
        const identityKey =
          String(resolveUserId(usuario) ?? "").trim() ||
          resolveEmail(usuario) ||
          `${usuario?.rol_nombre || "usuario"}:${combined.size}`;
        if (!identityKey) return;
        combined.set(identityKey, {
          ...(combined.get(identityKey) || {}),
          ...usuario,
        });
      });

      return {
        usuarios: Array.from(combined.values()),
        rolesFallback: [
          { id_rol: 33, nombre_rol: "Cliente" },
          { id_rol: 2, nombre_rol: "Empleado" },
        ],
      };
    },
    [
      buildFallbackRoleAssignment,
      cargarTodasLasPaginas,
      getRoleIdFromRecord,
      getRoleNameFromRecord,
      hasAppointmentAssignmentAccess,
      mergePermisosAsignados,
      resolveEmail,
      resolveUserId,
    ],
  );

  const normalizeText = useCallback((value) => {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }, []);

  const getRoleNameFromRecord = useCallback((record) => {
    if (!record || typeof record !== "object") return "";

    return String(
      record?.rol_nombre ??
        record?.nombre_rol ??
        record?.nombre ??
        record?.name ??
        record?.rol?.nombre_rol ??
        record?.rol?.nombre ??
        record?.rol?.name ??
        record?.role?.nombre_rol ??
        record?.role?.nombre ??
        record?.role?.name ??
        record?.id_rol_rol?.nombre_rol ??
        record?.id_rol_rol?.nombre ??
        record?.id_rol_rol?.name ??
        "",
    ).trim();
  }, []);

  const getRoleIdFromRecord = useCallback((record) => {
    if (!record || typeof record !== "object") return null;

    const rawId =
      record?.rol_id ??
      record?.id_rol ??
      record?.roleId ??
      record?.rol?.id_rol ??
      record?.rol?.id ??
      record?.role?.id_rol ??
      record?.role?.id ??
      record?.id_rol_rol?.id_rol ??
      record?.id_rol_rol?.id;

    const parsed = Number(rawId);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const getRoleNames = useCallback(
    (usuario) => {
      if (!usuario || typeof usuario !== "object") return [];

      const names = [
        getRoleNameFromRecord(usuario),
        ...(Array.isArray(usuario?.rolesNombres) ? usuario.rolesNombres : []),
        ...(Array.isArray(usuario?.roles_usuarios)
          ? usuario.roles_usuarios.map((roleAssignment) =>
              getRoleNameFromRecord(roleAssignment),
            )
          : []),
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

      return Array.from(new Set(names));
    },
    [getRoleNameFromRecord],
  );

  const hasAppointmentAssignmentAccess = useCallback(
    (permisos = []) => {
      const permisosModulo = normalizePermisosAsignados(permisos).filter(
        (permiso) => {
          const modulo = normalizeText(permiso?.modulo);
          return (
            Number(permiso?.id_permiso) === APPOINTMENT_PERMISSION_ID ||
            modulo.includes("asignar cita") ||
            modulo.includes("agendar cita")
          );
        },
      );

      return permisosModulo.length > 0;
    },
    [normalizePermisosAsignados, normalizeText],
  );

  /** Helper mejorado para detectar si un usuario tiene un rol por id */
  const tieneRolId = useCallback((usuario, id) => {
    if (!usuario) return false;

    const idBuscado = Number(id);

    // Forma 1: usuario.id_rol (la más común)
    if (usuario.id_rol != null) {
      const idRol = Number(usuario.id_rol);
      if (idRol === idBuscado) {
        return true;
      }
    }

    // Forma 2: usuario.rol?.id
    if (
      usuario.rol &&
      typeof usuario.rol === "object" &&
      usuario.rol.id != null
    ) {
      const idRol = Number(usuario.rol.id);
      if (idRol === idBuscado) {
        return true;
      }
    }

    // Forma 3: usuario.rol_id o usuario.roleId
    if (usuario.rol_id != null) {
      const idRol = Number(usuario.rol_id);
      if (idRol === idBuscado) return true;
    }

    if (usuario.roleId != null) {
      const idRol = Number(usuario.roleId);
      if (idRol === idBuscado) return true;
    }

    // Forma 4: usuario.roles_usuarios = [{ id_rol, id_rol_rol }, ...]
    if (Array.isArray(usuario.roles_usuarios)) {
      const found = usuario.roles_usuarios.some((roleAssignment) => {
        const assignedRoleId = getRoleIdFromRecord(roleAssignment);
        return assignedRoleId === idBuscado;
      });
      if (found) return true;
    }

    // Forma 5: usuario.roles = [{ id: ... }, ...]
    if (Array.isArray(usuario.roles)) {
      return usuario.roles.some((r) => r && Number(r.id) === idBuscado);
    }

    // Forma 6: usuario.rolesIds = [1,2,3]
    if (Array.isArray(usuario.rolesIds)) {
      return usuario.rolesIds.some((rid) => Number(rid) === idBuscado);
    }

    return false;
  }, [getRoleIdFromRecord]);

  const getRolNombre = useCallback(
    (usuario) => {
      if (!usuario || typeof usuario !== "object") return "";

      // Preferimos lo que ya arma cargarUsuarios()
      if (usuario.rol_nombre) return String(usuario.rol_nombre);

      const roleNames = getRoleNames(usuario);
      if (roleNames.length > 0) return roleNames[0];

      // Variantes comunes de backend
      const rolObj = usuario.rol || usuario.role || usuario.id_rol_rol || null;
      if (rolObj && typeof rolObj === "object") {
        return (
          rolObj.nombre_rol ||
          rolObj.nombre ||
          rolObj.name ||
          rolObj.rol_nombre ||
          ""
        );
      }

      // A veces viene como string plano
      if (typeof usuario.rol === "string") return usuario.rol;
      if (typeof usuario.role === "string") return usuario.role;

      return "";
    },
    [getRoleNames],
  );

  const tieneRolNombre = useCallback(
    (usuario, nombreBuscado) => {
      const buscado = normalizeText(nombreBuscado);
      if (!buscado) return false;

      const roleNames = getRoleNames(usuario).map((roleName) =>
        normalizeText(roleName),
      );
      if (roleNames.length > 0) {
        return roleNames.some((roleName) => roleName === buscado);
      }

      const nombre = normalizeText(getRolNombre(usuario));
      if (nombre) return nombre === buscado;

      // Si no hay nombre, intentamos inferir usando roles cargados
      const rolId =
        usuario?.rol_id ?? usuario?.rolId ?? usuario?.id_rol ?? usuario?.rol?.id;
      const roleFromList = roles.find(
        (r) => Number(r?.id_rol ?? r?.id) === Number(rolId),
      );
      const nombreFromList = normalizeText(
        roleFromList?.nombre_rol ?? roleFromList?.nombre ?? roleFromList?.name,
      );

      return nombreFromList ? nombreFromList === buscado : false;
    },
    [getRoleNames, getRolNombre, normalizeText, roles],
  );

  const rolNombreIncluye = useCallback(
    (usuario, texto) => {
      const needle = normalizeText(texto);
      if (!needle) return false;
      const roleNames = getRoleNames(usuario).map((roleName) =>
        normalizeText(roleName),
      );
      if (roleNames.length > 0) {
        return roleNames.some((roleName) => roleName.includes(needle));
      }

      const nombre = normalizeText(getRolNombre(usuario));
      if (nombre) return nombre.includes(needle);

      const rolId =
        usuario?.rol_id ?? usuario?.rolId ?? usuario?.id_rol ?? usuario?.rol?.id;
      const roleFromList = roles.find(
        (r) => Number(r?.id_rol ?? r?.id) === Number(rolId),
      );
      const nombreFromList = normalizeText(
        roleFromList?.nombre_rol ?? roleFromList?.nombre ?? roleFromList?.name,
      );
      return nombreFromList ? nombreFromList.includes(needle) : false;
    },
    [getRoleNames, getRolNombre, normalizeText, roles],
  );

  /** Cargar todos los usuarios (combinando con sus roles) */
  const cargarUsuarios = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");

      const [rolesListResponse, rolesUsuariosData, usuariosArray, detallesRolResponse, empleadosArray] = await Promise.all([
        obtenerRoles(),
        cargarTodasLasPaginas(obtenerRolesUsuarios, {
          preferredKeys: ["roles_usuarios", "data"],
        }),
        cargarTodasLasPaginas(obtenerUsuarios, {
          preferredKeys: ["usuarios", "data"],
        }),
        cargarTodasLasPaginas(
          ({ query }) => getDetallesRol({ token, query }),
          {
            preferredKeys: ["detallesrols", "data"],
          },
        ),
        cargarTodasLasPaginas(obtenerEmpleados, {
          preferredKeys: ["empleados", "data"],
        }),
      ]);

      const rolesList = extractList(rolesListResponse, ["roles", "data"]);

      // Guardar roles para filtros por nombre
      setRoles(rolesList);

      const rolesMap = rolesList.reduce((acc, role) => {
        const roleId = role?.id_rol ?? role?.id ?? role?.roleId ?? role?.rol_id;
        if (roleId != null) {
          acc[roleId] =
            role.nombre_rol ||
            role.nombre ||
            role.name ||
            role.rol_nombre ||
            `Rol ${roleId}`;
        }
        return acc;
      }, {});

      const detallesRolData = extractList(detallesRolResponse, [
        "detallesrols",
        "data",
      ]);

      const rolePermissionsMap = detallesRolData.reduce((acc, detalle) => {
        if (!detalle) return acc;

        const roleId = Number(
          detalle?.id_rol ??
            detalle?.rol_id ??
            detalle?.id_rol_rol?.id_rol ??
            detalle?.id_rol_rol?.id
        );
        const permiso = normalizePermisosAsignados([detalle])[0];

        if (!Number.isInteger(roleId) || !permiso) return acc;

        if (!acc[roleId]) {
          acc[roleId] = [];
        }

        acc[roleId].push(permiso);
        return acc;
      }, {});

      const userRolesMap = rolesUsuariosData.reduce((acc, roleAssignment) => {
        if (!roleAssignment) return acc;

        const userId =
          roleAssignment.id_usuario ??
          roleAssignment.usuario_id ??
          roleAssignment.id_usuario_usuario?.id_usuario ??
          roleAssignment.id_usuario_usuario?.id ??
          roleAssignment.usuario?.id_usuario ??
          roleAssignment.usuario?.id;
        const userData = roleAssignment.id_usuario_usuario || {};

        if (userId != null) {
          const roleIdRaw =
            roleAssignment.id_rol ??
            roleAssignment.rol_id ??
            roleAssignment.roleId ??
            roleAssignment.id_rol_rol?.id_rol ??
            roleAssignment.id_rol_rol?.id ??
            roleAssignment.rol?.id_rol ??
            roleAssignment.rol?.id;
          const roleId =
            roleIdRaw && typeof roleIdRaw === "object"
              ? roleIdRaw.id_rol ?? roleIdRaw.id
              : roleIdRaw;

          const roleData =
            roleAssignment.id_rol_rol ||
            roleAssignment.rol ||
            roleAssignment.role ||
            {};

          const rolePermissions = mergePermisosAsignados(
            rolePermissionsMap[Number(roleId)] || [],
            roleData?.permisosAsignados || [],
            roleData?.permisos || [],
            roleData?.detallesrols || [],
            roleData?.detalles || [],
            roleData?.detalles_rol || [],
            roleData?.modules || [],
          );

          const roleName =
            rolesMap[roleId] ||
            roleData.nombre_rol ||
            roleData.nombre ||
            roleData.name ||
            roleData.rol_nombre ||
            `Rol ${roleId}`;

          const existing = acc[userId] || {
            id_usuario: userId,
            permisosAsignados: [],
            roles_usuarios: [],
            rolesIds: [],
            rolesNombres: [],
          };

          const normalizedRoleAssignment = {
            ...roleAssignment,
            id_usuario: userId,
            rol_id: roleId,
            rol_nombre: roleName,
            permisosAsignados: rolePermissions,
            id_rol_rol: {
              ...roleData,
              permisosAsignados: rolePermissions,
            },
          };

          const dedupedAssignments = [
            ...(Array.isArray(existing.roles_usuarios)
              ? existing.roles_usuarios.filter(
                  (assignment) =>
                    getRoleIdFromRecord(assignment) !== Number(roleId),
                )
              : []),
            normalizedRoleAssignment,
          ];

          const mergedRoleNames = Array.from(
            new Set(
              [existing.rol_nombre, ...existing.rolesNombres, roleName].filter(
                Boolean,
              ),
            ),
          );
          const mergedRoleIds = Array.from(
            new Set(
              [
                existing.rol_id,
                ...(Array.isArray(existing.rolesIds) ? existing.rolesIds : []),
                Number(roleId),
              ].filter((value) => Number.isFinite(Number(value))),
            ),
          ).map((value) => Number(value));
          const mergedPermisos = mergePermisosAsignados(
            existing.permisosAsignados || [],
            rolePermissions,
          );

          acc[userId] = {
            ...existing,
            ...userData,
            id_usuario: userId,
            rol_id: existing.rol_id ?? roleId,
            rol_nombre: mergedRoleNames[0] || roleName,
            permisosAsignados: mergedPermisos,
            rolesIds: mergedRoleIds,
            rolesNombres: mergedRoleNames,
            roles_usuarios: dedupedAssignments,
            id_rol_rol: {
              ...(existing.id_rol_rol || {}),
              ...((existing.rol_id ?? existing.id_rol_rol?.id_rol ?? existing.id_rol_rol?.id) == null
                ? roleData
                : {}),
              permisosAsignados: mergedPermisos,
            },
          };
        }
        return acc;
      }, {});

      const processedUsers = usuariosArray
        .filter(Boolean)
        .map((user) => {
          const userId = user.id_usuario ?? user.id;
          const roleInfo = userRolesMap[userId] || {};
          const roleId =
            roleInfo.rol_id ?? user.rol_id ?? user.id_rol ?? user.roleId;
          const roleFromList =
            rolesList.find(
              (role) =>
                Number(role?.id_rol ?? role?.id ?? role?.rol_id ?? role?.roleId) ===
                Number(roleId),
            ) || {};
          const permisosAsignados = mergePermisosAsignados(
            roleInfo?.permisosAsignados || [],
            user?.permisosAsignados || [],
            user?.permisos || [],
            user?.detallesrols || [],
            user?.detalles || [],
            user?.detalles_rol || [],
            user?.modules || [],
            ...(Array.isArray(user?.roles_usuarios)
              ? user.roles_usuarios.flatMap((roleAssignment) => [
                  roleAssignment?.permisosAsignados || [],
                  roleAssignment?.permisos || [],
                  roleAssignment?.detallesrols || [],
                  roleAssignment?.detalles || [],
                  roleAssignment?.detalles_rol || [],
                  roleAssignment?.modules || [],
                  roleAssignment?.id_rol_rol?.permisosAsignados || [],
                  roleAssignment?.id_rol_rol?.permisos || [],
                  roleAssignment?.id_rol_rol?.detallesrols || [],
                  roleAssignment?.id_rol_rol?.detalles || [],
                  roleAssignment?.id_rol_rol?.detalles_rol || [],
                ])
              : []),
            roleFromList?.permisosAsignados || [],
            roleFromList?.permisos || [],
            roleFromList?.detallesrols || [],
            roleFromList?.detalles || [],
            roleFromList?.detalles_rol || [],
            rolePermissionsMap[Number(roleId)] || [],
          );
          const empleadoRelacionado =
            empleadosArray.find(
              (empleado) => String(resolveUserId(empleado)) === String(userId),
            ) ||
            empleadosArray.find(
              (empleado) =>
                resolveEmail(empleado) &&
                resolveEmail(empleado) === resolveEmail(user),
            ) ||
            null;
          const hasAppointmentAccess =
            hasAppointmentAssignmentAccess(permisosAsignados);

          return {
            ...user,
            ...roleInfo,
            ...(empleadoRelacionado && typeof empleadoRelacionado === "object"
              ? empleadoRelacionado
              : {}),
            ...(empleadoRelacionado?.id_usuario_usuario &&
            typeof empleadoRelacionado.id_usuario_usuario === "object"
              ? empleadoRelacionado.id_usuario_usuario
              : {}),
            id_usuario: userId,
            id_empleado:
              empleadoRelacionado?.id_empleado ??
              empleadoRelacionado?.id ??
              user?.id_empleado ??
              null,
            rol_id: roleId,
            permisosAsignados,
            hasAppointmentAccess,
            rolesIds: Array.from(
              new Set(
                [
                  roleInfo?.rol_id,
                  ...(Array.isArray(roleInfo?.rolesIds) ? roleInfo.rolesIds : []),
                  ...(Array.isArray(user?.rolesIds) ? user.rolesIds : []),
                ].filter((value) => Number.isFinite(Number(value))),
              ),
            ).map((value) => Number(value)),
            rolesNombres: Array.from(
              new Set([
                ...(Array.isArray(roleInfo?.rolesNombres)
                  ? roleInfo.rolesNombres
                  : []),
                ...getRoleNames(user),
              ]),
            ),
            roles_usuarios: Array.from(
              new Map(
                [
                  ...(Array.isArray(user?.roles_usuarios) ? user.roles_usuarios : []),
                  ...(Array.isArray(roleInfo?.roles_usuarios)
                    ? roleInfo.roles_usuarios
                    : []),
                ]
                  .filter(Boolean)
                  .map((roleAssignment) => [
                    String(
                      getRoleIdFromRecord(roleAssignment) ??
                        roleAssignment?.rol_nombre ??
                        JSON.stringify(roleAssignment),
                    ),
                    roleAssignment,
                  ]),
              ).values(),
            ),
            id_rol_rol: {
              ...(roleInfo?.id_rol_rol || {}),
              ...roleFromList,
              permisosAsignados,
            },
          };
        });

      setUsuarios(processedUsers);
    } catch (err) {
      const shouldTryFallback =
        [401, 403].includes(Number(err?.status)) ||
        /permiso|forbidden|unauthorized|autorizad|sesi[oó]n/i.test(
          String(err?.message || ""),
        );

      if (shouldTryFallback) {
        try {
          const fallback = await buildFallbackUsers();
          setRoles((prev) =>
            Array.isArray(prev) && prev.length > 0 ? prev : fallback.rolesFallback,
          );
          setUsuarios(fallback.usuarios);
          setError(null);
          return;
        } catch (fallbackError) {
          console.error(
            "Error cargando usuarios con fallback ligero:",
            fallbackError,
          );
        }
      }

      console.error("Error cargando usuarios:", err);
      setError(err);
      setUsuarios([]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [
    buildFallbackUsers,
    extractList,
    cargarTodasLasPaginas,
    getRoleIdFromRecord,
    getRoleNames,
    hasAppointmentAssignmentAccess,
    mergePermisosAsignados,
    normalizePermisosAsignados,
    resolveEmail,
    resolveUserId,
  ]);

  /** Cargar roles (opcional para otras pantallas) */
  const cargarRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerRoles();
      const rolesArray = extractList(data, ["roles", "data"]);
      setRoles(rolesArray);
    } catch (err) {
      console.error("Error cargando roles:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [extractList]);

  /** Crear usuario */
  const crear = useCallback(
    async (usuario) => {
      try {
        setLoading(true);

        const res = await crearUsuario(usuario);
        await cargarUsuarios();

        return res;
      } catch (err) {
        console.error("Error creando usuario:", err);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cargarUsuarios],
  );

  /** Actualizar usuario */
  const actualizar = useCallback(
    async (id, usuario) => {
      try {
        setLoading(true);

        const res = await actualizarUsuario(id, usuario);
        await cargarUsuarios();

        return res;
      } catch (err) {
        console.error("Error actualizando usuario:", err);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cargarUsuarios],
  );

  /** Eliminar usuario */
  const eliminar = useCallback(
    async (id) => {
      try {
        setLoading(true);

        const res = await eliminarUsuario(id);
        await cargarUsuarios();

        return res;
      } catch (err) {
        console.error("Error eliminando usuario:", err);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cargarUsuarios],
  );

  /** Cambiar solo el estado */
  const actualizarEstado = useCallback(
    async (id, estado) => {
      try {
        setLoading(true);
        const res = await actualizarEstadoUsuario(id, estado);
        await cargarUsuarios();

        return res;
      } catch (err) {
        console.error("❌ Error actualizando estado:", err);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cargarUsuarios],
  );

  const roleIdsByName = useMemo(() => {
    const idsIncludes = (text) => {
      const needle = normalizeText(text);
      if (!needle) return [];

      return roles
        .filter((r) =>
          normalizeText(r?.nombre_rol ?? r?.nombre ?? r?.name).includes(needle),
        )
        .map((r) => Number(r?.id_rol ?? r?.id ?? r?.rol_id ?? r?.roleId))
        .filter((n) => Number.isFinite(n));
    };

    return {
      cliente: [CLIENT_ROLE_ID],
      admin: Array.from(
        new Set([...idsIncludes("admin"), ...idsIncludes("administrador")]),
      ),
      entrenador: Array.from(
        new Set([
          ...idsIncludes("entren"),
          ...idsIncludes("entrenador"),
          ...idsIncludes("entrenador personal"),
        ]),
      ),
    };
  }, [roles, normalizeText]);

  /** Filtro de clientes por ID de rol */
  const usuariosRol33 = useMemo(
    () => usuarios.filter((u) => tieneRolId(u, CLIENT_ROLE_ID)),
    [tieneRolId, usuarios]
  );

  /** Filtro: Usuarios SIN admin ni cliente(rol 33) */
  const usuariosSin1y33 = useMemo(() => {
    const adminIds = roleIdsByName.admin;

    return usuarios.filter((u) => {
      const esAdmin =
        (adminIds.length > 0 && adminIds.some((rid) => tieneRolId(u, rid))) ||
        tieneRolNombre(u, "administrador") ||
        rolNombreIncluye(u, "admin");

      const esCliente = tieneRolId(u, CLIENT_ROLE_ID);

      return !esAdmin && !esCliente;
    });
  }, [
    roleIdsByName.admin,
    usuarios,
    tieneRolId,
    tieneRolNombre,
    rolNombreIncluye,
  ]);

  /** Filtro: Entrenadores (por nombre de rol) */
  const usuariosEntrenadores = useMemo(() => {
    // Match flexible: "Entrenador", "Entrenador personal", etc.
    if (roleIdsByName.entrenador.length > 0) {
      return usuarios.filter((u) =>
        roleIdsByName.entrenador.some((rid) => tieneRolId(u, rid)),
      );
    }

    return usuarios.filter((u) => rolNombreIncluye(u, "entren"));
  }, [roleIdsByName.entrenador, tieneRolId, usuarios, rolNombreIncluye]);

  /** Filtro: Clientes por ID de rol */
  const usuariosClientes = useMemo(() => {
    return usuarios.filter((u) => tieneRolId(u, CLIENT_ROLE_ID));
  }, [tieneRolId, usuarios]);

  /** Filtro: Empleados (todos excepto Cliente(rol 33) y Admin) */
  const usuariosEmpleados = useMemo(() => {
    const adminIds = roleIdsByName.admin;

    return usuarios.filter((u) => {
      const esCliente = tieneRolId(u, CLIENT_ROLE_ID);
      if (esCliente) return false;

      const esAdmin =
        (adminIds.length > 0 && adminIds.some((rid) => tieneRolId(u, rid))) ||
        tieneRolNombre(u, "administrador") ||
        rolNombreIncluye(u, "admin");

      return !esAdmin;
    });
  }, [
    roleIdsByName.admin,
    tieneRolId,
    tieneRolNombre,
    usuarios,
    rolNombreIncluye,
  ]);

  /** Filtro: Empleados habilitados para el módulo Asignar Citas */
  const usuariosAsignablesCitas = useMemo(() => {
    return usuariosEmpleados.filter(
      (u) => u?.hasAppointmentAccess === true,
    );
  }, [usuariosEmpleados]);

  // Alias de compatibilidad para pantallas que aun consumen nombres legacy
  const usuariosRol6 = usuariosRol33;
  const usuariosSin1y6 = usuariosSin1y33;

  return {
    usuarios,
    roles,

    loading,
    error,

    cargarUsuarios,
    cargarRoles,

    crearUsuario: crear,
    actualizarUsuario: actualizar,
    eliminarUsuario: eliminar,
    actualizarEstadoUsuario: actualizarEstado,

    // Listas filtradas
    usuariosSin1y33, // Empleados/Entrenadores (sin admin ni rol 33)
    usuariosRol6, // Alias legacy -> rol 33
    usuariosSin1y6, // Alias legacy -> sin admin ni rol 33
    usuariosEntrenadores, // Entrenadores (por nombre de rol)
    usuariosClientes, // Clientes (rol 33)
    usuariosEmpleados, // Empleados (sin rol 33/Admin)
    usuariosAsignablesCitas, // Empleados con acceso al modulo Asignar Citas
  };
}

export default useUsuarios;
