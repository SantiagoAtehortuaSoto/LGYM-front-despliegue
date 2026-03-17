import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChartPie } from "lucide-react";
import Logo from "../../../assets/LGYM_logo.png";
import ExpandableButtons from "../expandleButtons/expandlebuttons";
import {
  comprasLinksEmp,
  serviciosLinksEmp,
  VentasLinksEmp,
  configLinksEmp,
} from "../../utils/data/links";
import {
  fetchUserPermissionsWithFallback,
  normalizePermisosPayload,
} from "../../../features/dashboard/hooks/Acceder_API/authService";
import { getPermisosCatalog } from "../../../features/dashboard/hooks/Roles_API/roles.jsx";

const normalizeText = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const buildPermisoHelpersFromCatalog = (catalogo = []) => {
  const moduloNameToPermisoId = {};
  const permisoIdToModuloName = {};

  (Array.isArray(catalogo) ? catalogo : []).forEach((item) => {
    const moduloName = item?.modulo ?? item?.nombre ?? "";
    const acciones = Array.isArray(item?.acciones) ? item.acciones : [];
    const firstAccion = acciones[0];
    const permisoId = Number(
      firstAccion?.id_permiso ?? firstAccion?.permiso_id
    );
    if (!firstAccion || !Number.isInteger(permisoId)) return;

    const normalizedModulo = normalizeText(moduloName);
    moduloNameToPermisoId[normalizedModulo] = permisoId;
    permisoIdToModuloName[permisoId] = moduloName || normalizedModulo;
  });

  return { moduloNameToPermisoId, permisoIdToModuloName };
};

const collectPermisoArrays = (obj) => {
  if (!obj) return [];
  const pools = [
    obj,
    obj.permisosAsignados,
    obj.permisos_asignados,
    obj.permisosNormalizados,
    obj.permisos_normalizados,
    obj.permisos,
    obj.detalles_rol,
    obj.detallesrols,
    obj.detalles,
    obj.modules,
  ];

  return pools.filter((arr) => Array.isArray(arr) && arr.length > 0).flat();
};

// Helpers para decodificar token JWT y extraer posibles permisos
const safeBase64ToUtf8 = (base64Url) => {
  try {
    const base64 =
      base64Url.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (base64Url.length % 4)) % 4);
    return atob(base64);
  } catch {
    return "";
  }
};

const decodeJwtPayload = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const json = safeBase64ToUtf8(base64Url);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
};

const getPayload = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    return decodeJwtPayload(token) || null;
  } catch {
    return null;
  }
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

const buildPermisoSet = (user) => {
  const buckets = [
    user?.permisosAsignados,
    user?.permisosNormalizados,
    user?.permisos,
    user?.detallesrols,
    user?.detalles,
    user?.detalles_rol,
    user?.modules,
    user?.modulesNormalized,
    user?.role?.permisosAsignados,
    user?.role?.permisosNormalizados,
    user?.role?.permisos,
    user?.role?.detallesrols,
    user?.role?.detalles,
    user?.role?.detalles_rol,
    user?.role?.modules,
    user?.role?.modulesNormalized,
  ].filter((arr) => Array.isArray(arr) && arr.length > 0);

  const payload = getPayload();
  if (payload && typeof payload === "object") {
    [
      payload.permisosAsignados,
      payload.permisos_asignados,
      payload.permisosNormalizados,
      payload.permisos,
      payload.detallesrols,
      payload.detalles,
      payload.detalles_rol,
      payload.modules,
      payload?.role?.permisosAsignados,
      payload?.role?.permisos,
      payload?.role?.detallesrols,
      payload?.role?.detalles,
      payload?.role?.detalles_rol,
      payload?.role?.modules,
    ]
      .filter((arr) => Array.isArray(arr) && arr.length > 0)
      .forEach((arr) => buckets.push(arr));
    if (Array.isArray(payload.roles_usuarios)) {
      payload.roles_usuarios.forEach((r) => {
        [
          r?.permisosAsignados,
          r?.permisosNormalizados,
          r?.permisos,
          r?.detallesrols,
          r?.detalles,
          r?.detalles_rol,
        ]
          .filter((arr) => Array.isArray(arr) && arr.length > 0)
          .forEach((arr) => buckets.push(arr));
      });
    }
  }

  const permisoIds = [];

  const extractId = (permiso) => {
    if (Number.isInteger(Number(permiso))) return Number(permiso);
    const candidates = [
      permiso?.id_permiso,
      permiso?.permiso_id,
      permiso?.idPermiso,
      permiso?.permiso?.id_permiso,
    ];
    const found = candidates.find((v) => Number.isInteger(Number(v)));
    return Number(found);
  };

  buckets.forEach((arr) => {
    arr.forEach((p) => {
      const id = extractId(p);
      if (Number.isInteger(id)) permisoIds.push(id);
    });
  });

  const unique = new Set(permisoIds);

  return unique;
};

function SidebarEmpleados({ isOpen = true }) {
  const [user, setUser] = useState(getUser());
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [permisoHelpers, setPermisoHelpers] = useState(null);
  const [triedLoadingPerms, setTriedLoadingPerms] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  const permisoIds = useMemo(() => buildPermisoSet(user), [user]);

  const linkModuloNamesById = useMemo(() => {
    const map = new Map();
    const add = (link) => {
      if (!link) return;
      const id = Number(link.permisoId);
      if (!Number.isInteger(id)) return;
      const n = normalizeText(link.moduloKey || link.modulo || link.title || "");
      if (!n) return;
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(n);
    };
    [
      ...comprasLinksEmp,
      ...serviciosLinksEmp,
      ...VentasLinksEmp,
      ...configLinksEmp,
    ].forEach(add);
    return map;
  }, []);

  const allowedModuloNames = useMemo(() => {
    const names = new Set();

    // 1) Nombres desde catálogo (solo si lo tenemos)
    if (permisoHelpers) {
      permisoIds.forEach((id) => {
        const name = permisoHelpers.permisoIdToModuloName?.[id];
        if (name) names.add(normalizeText(name));
      });
    }

    // 2) Nombres de módulos devueltos por la API (/me/permisos)
    const modulesFromUser = Array.isArray(user?.modules) ? user.modules : [];
  modulesFromUser.forEach((mod) => {
    const name = mod?.modulo || mod?.nombre || mod;
    if (name) names.add(normalizeText(String(name)));
  });

  // 3) Nombres de links conocidos cuyo permisoId ya está concedido
  const maybeAddLink = (link) => {
    if (!link) return;
    const id = Number(link.permisoId);
    if (!Number.isInteger(id)) return;
    if (!permisoIds.has(id)) return;
    const n = normalizeText(link.moduloKey || link.modulo || link.title || "");
    if (n) names.add(n);
  };
    comprasLinksEmp.forEach(maybeAddLink);
    serviciosLinksEmp.forEach(maybeAddLink);
    VentasLinksEmp.forEach(maybeAddLink);
    configLinksEmp.forEach(maybeAddLink);

    return names;
  }, [permisoIds, permisoHelpers, user?.modules]);

  const resolveLinkPermisoId = useCallback(
    (link) => {
      if (!link) return null;
      const normalizedModulo = normalizeText(
        link.moduloKey || link.modulo || link.title || ""
      );
      const idFromCatalog =
        normalizedModulo && permisoHelpers
          ? permisoHelpers.moduloNameToPermisoId?.[normalizedModulo]
          : null;
      if (idFromCatalog != null && Number.isInteger(Number(idFromCatalog))) {
        return Number(idFromCatalog);
      }
      const rawId = Number(link?.permisoId);
      return Number.isInteger(rawId) ? rawId : null;
    },
    [permisoHelpers]
  );

  const matchesModuloName = useCallback(
    (normalizedModulo) => {
      if (!normalizedModulo || allowedModuloNames.size === 0) return false;
      for (const name of allowedModuloNames) {
        if (name === normalizedModulo) return true;
        if (name.includes(normalizedModulo) || normalizedModulo.includes(name))
          return true;
      }
      return false;
    },
    [allowedModuloNames]
  );

  const filterLinks = useCallback(
    (links) => {
      if (!Array.isArray(links)) return [];

      return links.filter((link) => {
        const resolvedId = resolveLinkPermisoId(link);
        const normalizedModulo = normalizeText(
          link.moduloKey || link.modulo || link.title || ""
        );
        const matchesId =
          Number.isInteger(resolvedId) && permisoIds.has(resolvedId);
        const matchesModulo = matchesModuloName(normalizedModulo);
        const matchesLinkName =
          Number.isInteger(resolvedId) &&
          linkModuloNamesById.get(resolvedId)?.has(normalizedModulo);

        // Para evitar falsos positivos (mismo id_permiso para otro módulo),
        // si tenemos nombres permitidos, exigimos que coincida el nombre.
        const allowed =
          allowedModuloNames.size > 0
            ? matchesId && (matchesModulo || matchesLinkName)
            : matchesId || matchesModulo || matchesLinkName;

        return allowed;
      });
    },
    [resolveLinkPermisoId, permisoIds, matchesModuloName, allowedModuloNames, linkModuloNamesById]
  );

  useEffect(() => {
    const handleAuthChange = () => setUser(getUser());
    window.addEventListener("auth-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);
    return () => {
      window.removeEventListener("auth-change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  useEffect(() => {
    setTriedLoadingPerms(false);
  }, [user?.id, user?.email]);

  useEffect(() => {
    const roleName = normalizeText(user?.role || "");
    // El catálogo de permisos suele ser endpoint solo para admins; evita 403 en empleados
    if (roleName && roleName !== "admin" && roleName !== "administrador") {
      return;
    }

    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await getPermisosCatalog({ token });
        const catalogo = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res)
          ? res
          : [];

        if (!cancelled) {
          setPermisoHelpers(buildPermisoHelpersFromCatalog(catalogo));
        }
      } catch (err) {
        console.warn(
          "[SidebarEmpleados] No se pudo cargar catalogo de permisos",
          err
        );
      }
    };

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    if (permisoIds.size > 0 || isLoadingPerms || triedLoadingPerms) return;
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoadingPerms(true);
        setTriedLoadingPerms(true);
        const payload = getPayload();
        const roleId =
          user?.role?.id_rol ??
          user?.role?.id ??
          user?.id_rol ??
          payload?.role?.id_rol ??
          payload?.role_id ??
          null;
        const userId = user?.id ?? payload?.id ?? payload?.sub ?? null;
        const data = await fetchUserPermissionsWithFallback(roleId, userId);
        if (cancelled) return;

        let permisosArr = [
          ...collectPermisoArrays(data),
          ...collectPermisoArrays(data?.data),
          ...collectPermisoArrays(data?.data?.data),
        ];

        const normalizedFromModules = [
          ...normalizePermisosPayload(data),
          ...normalizePermisosPayload(data?.data),
        ].filter(Boolean);

        if (normalizedFromModules.length) {
          permisosArr = [...permisosArr, ...normalizedFromModules];
        }

        if (permisosArr.length) {
          setUser((prev) => {
            const next = {
              ...(prev || {}),
              permisosAsignados:
                permisosArr.length > 0 ? permisosArr : prev?.permisosAsignados,
              modulesNormalized:
                normalizedFromModules.length > 0
                  ? normalizedFromModules
                  : prev?.modulesNormalized,
              modules: Array.isArray(data?.modules)
                ? data.modules
                : Array.isArray(data?.data?.modules)
                ? data.data.modules
                : prev?.modules,
            };
            try {
              localStorage.setItem("user", JSON.stringify(next));
            } catch {
              // ignore storage errors
            }
            return next;
          });
        }
      } catch (err) {
        console.warn(
          "[SidebarEmpleados] No se pudieron obtener permisos desde /usuarios/me/permisos",
          err
        );
      } finally {
        if (!cancelled) setIsLoadingPerms(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [permisoIds, isLoadingPerms, triedLoadingPerms, user]);

  const comprasLinks = useMemo(
    () => filterLinks(comprasLinksEmp),
    [filterLinks]
  );
  const configLinks = useMemo(
    () => filterLinks(configLinksEmp),
    [filterLinks]
  );
  const serviciosLinks = useMemo(
    () => filterLinks(serviciosLinksEmp),
    [filterLinks]
  );
  const ventasLinks = useMemo(
    () => filterLinks(VentasLinksEmp),
    [filterLinks]
  );

  const hasModules =
    configLinks.length > 0 ||
    comprasLinks.length > 0 ||
    serviciosLinks.length > 0 ||
    ventasLinks.length > 0;

  const handleSectionToggle = (sectionName, nextExpanded) => {
    setOpenSection((current) => {
      if (nextExpanded) return sectionName;
      return current === sectionName ? null : current;
    });
  };

  return (
    <div className={`sidebar-emp ${isOpen ? "" : "collapsed"}`}>
      <div className="sidebar-top">
        <a className="logo" href="">
          <img className="logo" src={Logo} alt="LGYM Logo" />
        </a>
        <Link
          className="dash-button poppins-regular"
          to="/empleados/dashboardEmpleado"
        >
          <ChartPie size={25} />
          {isOpen && <span>DASHBOARD</span>}
        </Link>
      </div>
      <div className="sidebar-content">
        {hasModules ? (
          <>
            {comprasLinks.length > 0 && (
              <ExpandableButtons
                isSidebarOpen={isOpen}
                nombreBoton={"Compras"}
                links={comprasLinks}
                isExpanded={openSection === "Compras"}
                onToggle={(nextExpanded) =>
                  handleSectionToggle("Compras", nextExpanded)
                }
              />
            )}
            {serviciosLinks.length > 0 && (
              <ExpandableButtons
                isSidebarOpen={isOpen}
                nombreBoton={"Servicios"}
                links={serviciosLinks}
                isExpanded={openSection === "Servicios"}
                onToggle={(nextExpanded) =>
                  handleSectionToggle("Servicios", nextExpanded)
                }
              />
            )}
            {ventasLinks.length > 0 && (
              <ExpandableButtons
                isSidebarOpen={isOpen}
                nombreBoton={"Ventas"}
                links={ventasLinks}
                isExpanded={openSection === "Ventas"}
                onToggle={(nextExpanded) =>
                  handleSectionToggle("Ventas", nextExpanded)
                }
              />
            )}
            {configLinks.length > 0 && (
              <ExpandableButtons
                isSidebarOpen={isOpen}
                nombreBoton={"Configuracion"}
                links={configLinks}
                isExpanded={openSection === "Configuracion"}
                onToggle={(nextExpanded) =>
                  handleSectionToggle("Configuracion", nextExpanded)
                }
              />
            )}
          </>
        ) : (
          <p className="poppins-regular">Sin modulos asignados</p>
        )}
      </div>
    </div>
  );
}

export default SidebarEmpleados;
