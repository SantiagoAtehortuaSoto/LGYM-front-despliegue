import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IconMenu2,
  IconChevronDown,
  IconSettings,
  IconLogout,
} from "@tabler/icons-react";
import { resolveUserId } from "../../utils/appointmentNotifications";
import { buildUrl } from "../../../features/dashboard/hooks/apiConfig";
import { obtenerBeneficiariosMios } from "../../../features/dashboard/hooks/Beneficiario_API.jsx/Beneficiario_API";

const URL_VENTAS_USUARIO = buildUrl("/ventas/usuario");

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function doLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth-change"));
}

function isValidMembershipLabel(value) {
  if (value == null) return false;
  const text = String(value).trim();
  if (!text) return false;
  if (/^\d+$/.test(text)) return false;
  const normalized = text.toLowerCase();
  if (["null", "undefined", "false", "true", "n/a", "na"].includes(normalized)) {
    return false;
  }
  if (
    /(admin|administrador|emplead|instructor|staff|usuario|cliente|beneficiario|role_)/.test(
      normalized,
    )
  ) {
    return false;
  }
  return true;
}

function resolveMembershipLabel(candidate) {
  if (candidate == null) return "";

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const found = resolveMembershipLabel(item);
      if (found) return found;
    }
    return "";
  }

  if (typeof candidate === "object") {
    const values = [
      candidate.nombre_membresia,
      candidate.membresia_nombre,
      candidate.nombre,
      candidate.name,
      candidate.titulo,
      candidate.title,
      candidate.tipoMembresia,
      candidate.tipo_membresia,
      candidate.plan_nombre,
      candidate.membresia,
      candidate.membership,
      candidate.plan,
      candidate.id_membresia_membresia,
    ];
    for (const value of values) {
      const found = resolveMembershipLabel(value);
      if (found) return found;
    }
    return "";
  }

  return isValidMembershipLabel(candidate) ? String(candidate).trim() : "";
}

function normalizeMembershipStatus(raw) {
  const value = String(raw ?? "").trim().toUpperCase();
  if (!value) return "";
  if (value === "5" || value.includes("COMPLET")) return "COMPLETADO";
  if (value === "1" || value.includes("ACTIV")) return "ACTIVO";
  if (value === "3" || value.includes("PEND")) return "PENDIENTE";
  if (value === "4" || value.includes("PROCES")) return "EN PROCESO";
  if (value === "6" || value.includes("CANCEL")) return "CANCELADO";
  if (value === "2" || value.includes("INACT")) return "INACTIVO";
  return value;
}

function isMembershipDetail(detail) {
  if (!detail || typeof detail !== "object") return false;
  const idMembership = Number(
    detail.id_membresia ?? detail.idMembresia ?? detail.id_membresias,
  );
  if (Number.isFinite(idMembership) && idMembership > 0) return true;
  if (detail.membresia) return true;
  const tipoVenta = String(detail.tipo_venta ?? detail.tipoVenta ?? "").toLowerCase();
  return tipoVenta.includes("memb");
}

function getMembershipNameFromSale(sale) {
  if (!sale || typeof sale !== "object") return "";
  const directName =
    sale.nombre_membresia ||
    (Array.isArray(sale.membresias) &&
      (sale.membresias.find((m) => m?.nombre_membresia)?.nombre_membresia ||
        sale.membresias.find((m) => m?.nombre)?.nombre));
  if (resolveMembershipLabel(directName)) return resolveMembershipLabel(directName);

  const baseDetails =
    sale.detalles || sale.detalles_venta || sale.detalle_venta || sale.productos || [];
  const extraDetails = Array.isArray(sale.membresias)
    ? sale.membresias.map((membership) => ({
        tipo_venta: "MEMBRESIA",
        id_membresia:
          membership?.id_membresia ??
          membership?.id_membresias ??
          membership?.id ??
          membership?.id_membresia_fk ??
          membership?.id_membresia_pk,
        membresia: membership,
      }))
    : [];
  const details = [
    ...(Array.isArray(baseDetails) ? baseDetails : []),
    ...extraDetails,
  ];
  const membershipDetail = details.find((detail) => isMembershipDetail(detail));
  return (
    resolveMembershipLabel(membershipDetail?.membresia?.nombre_membresia) ||
    resolveMembershipLabel(membershipDetail?.membresia?.nombre) ||
    resolveMembershipLabel(membershipDetail?.nombre_membresia) ||
    resolveMembershipLabel(membershipDetail?.nombre) ||
    ""
  );
}

function getSaleDateNumber(sale) {
  const value =
    sale?.fecha_venta ||
    sale?.fecha ||
    sale?.fechaVenta ||
    sale?.createdAt ||
    sale?.updatedAt ||
    "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSaleOrderNumber(sale) {
  const value = Number(
    sale?.id_venta ??
    sale?.idVenta ??
    sale?.id_ventas ??
    sale?.id ??
    0
  );
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeEmail(value) {
  const normalized = normalizeText(value);
  return normalized.includes("@") ? normalized : "";
}

function resolveMembershipId(value = {}, { allowGenericId = false } = {}) {
  if (!value || typeof value !== "object") return null;

  const directId = toPositiveNumber(
    value?.id_membresia ??
      value?.id_membresias ??
      value?.idMembresia ??
      value?.membresia_id ??
      value?.id_membresia_fk ??
      value?.id_membresia_pk,
  );
  if (directId) return directId;

  const nestedId = toPositiveNumber(
    value?.id_membresia_membresia?.id_membresia ??
      value?.id_membresia_membresia?.id_membresias ??
      value?.membresia?.id_membresia ??
      value?.membresia?.id_membresias,
  );
  if (nestedId) return nestedId;

  const nestedGenericId = toPositiveNumber(
    value?.id_membresia_membresia?.id ?? value?.membresia?.id,
  );
  if (nestedGenericId) return nestedGenericId;

  if (!allowGenericId) return null;
  return toPositiveNumber(value?.id);
}

function isCurrentUserBenefRecord(benef = {}, { userId = null, userEmail = "" } = {}) {
  const relationUser =
    benef.id_relacion_usuario || benef.relacion_usuario || benef.usuario_relacion || {};
  const relationId = toPositiveNumber(
    benef.id_relacion ??
      benef.id_beneficiario ??
      benef.id_usuario_relacion ??
      benef.id_usuario_beneficiario ??
      relationUser.id_usuario ??
      relationUser.usuario_id ??
      relationUser.id,
  );
  const relationEmail = normalizeEmail(
    benef.email_relacion ??
      benef.correo_relacion ??
      benef.email_beneficiario ??
      benef.correo_beneficiario ??
      relationUser.email ??
      relationUser.correo,
  );
  if (userId && relationId && relationId === userId) return true;
  if (userEmail && relationEmail && relationEmail === userEmail) return true;
  return false;
}

function getBenefMembershipStatus(benef = {}) {
  return normalizeMembershipStatus(
    benef?.id_estado_membresia_estado?.estado ??
      benef?.estado_membresia?.estado ??
      benef?.estado_membresia ??
      benef?.estado ??
      benef?.id_estado_membresia,
  );
}

function getBenefMembershipPriority(status = "") {
  if (status === "PENDIENTE" || status === "EN PROCESO") return 5;
  if (status === "ACTIVO" || status === "COMPLETADO") return 4;
  if (status === "INACTIVO" || status === "CANCELADO") return 1;
  return 0;
}

function getActiveMembershipFromBeneficiarios(beneficiarios = [], user = null) {
  if (!Array.isArray(beneficiarios) || beneficiarios.length === 0) return "";

  const userId = resolveUserId(user);
  const userEmail = normalizeEmail(user?.email ?? user?.correo ?? user?.email_usuario);
  const candidates = beneficiarios
    .map((benef) => {
      const hasObj = Boolean(benef?.id_membresia_membresia || benef?.membresia);
      const membershipId = resolveMembershipId(benef);
      const status = getBenefMembershipStatus(benef);
      const priority = getBenefMembershipPriority(status);
      const order = toPositiveNumber(benef?.id_beneficiario ?? benef?.id) || 0;
      const isSelf = isCurrentUserBenefRecord(benef, { userId, userEmail });
      return {
        benef,
        hasMembership: hasObj || Boolean(membershipId),
        status,
        priority,
        order,
        isSelf,
      };
    })
    .filter((item) => item.hasMembership)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.order !== a.order) return b.order - a.order;
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return 0;
    });
  if (!candidates.length) return "";

  const preferred = candidates[0]?.benef;
  if (!preferred) return "";
  const membershipObj = preferred?.id_membresia_membresia || preferred?.membresia || {};

  return (
    resolveMembershipLabel(membershipObj?.nombre_membresia) ||
    resolveMembershipLabel(membershipObj?.nombre) ||
    resolveMembershipLabel(preferred?.nombre_membresia) ||
    resolveMembershipLabel(preferred?.nombre) ||
    ""
  );
}

function isCurrentMembershipStatus(status = "") {
  return status === "COMPLETADO" || status === "ACTIVO";
}

function resolveCompletedMembership(ventas = []) {
  if (!Array.isArray(ventas) || ventas.length === 0) return "";
  const candidates = ventas
    .map((sale) => {
      const statusRaw =
        sale?.estado_venta || sale?.estado || sale?.id_estado_estado?.estado || sale?.id_estado;
      const statusNormalized = normalizeMembershipStatus(statusRaw);
      const membershipName = getMembershipNameFromSale(sale);
      return { sale, statusNormalized, membershipName };
    })
    .filter(
      ({ statusNormalized, membershipName }) =>
        isCurrentMembershipStatus(statusNormalized) && Boolean(membershipName),
    )
    .sort((a, b) => {
      const dateDiff = getSaleDateNumber(b.sale) - getSaleDateNumber(a.sale);
      if (dateDiff !== 0) return dateDiff;
      const orderDiff = getSaleOrderNumber(b.sale) - getSaleOrderNumber(a.sale);
      if (orderDiff !== 0) return orderDiff;
      const rank = (status) => (status === "COMPLETADO" ? 2 : status === "ACTIVO" ? 1 : 0);
      return rank(b.statusNormalized) - rank(a.statusNormalized);
    });

  return candidates[0]?.membershipName || "";
}

function extractRawRole(user) {
  if (!user || typeof user !== "object") return "";
  const candidates = [
    user.roles_usuarios,
    user.role,
    user.rol,
    user.perfil,
    user.tipo,
    user.tipo_usuario,
    user.tipoUsuario,
  ].filter((v) => v != null);

  for (const c of candidates) {
    if (Array.isArray(c)) {
      const names = c
        .map((it) =>
          typeof it === "string"
            ? it
            : typeof it === "object"
              ? it.nombre || it.name || it.rol || it.role || ""
              : "",
        )
        .filter(Boolean);
      if (names.length) return names.join("|");
    }
  }

  const first = candidates.find(
    (x) => typeof x === "string" || typeof x === "number",
  );
  return first ?? "";
}

function normalizeRole(raw) {
  if (raw == null) return "usuario";
  const parts = String(raw)
    .split("|")
    .map((s) => s.trim().toLowerCase());

  const classify = (val) => {
    if (
      /(^|_|-|\s)admin(istrador)?($|_|-|\s)/.test(val) ||
      /role_admin|admin_role/.test(val)
    ) {
      return "admin";
    }
    if (
      /(emplead|instructor|staff)/.test(val) ||
      /role_empleado|empleado_role/.test(val)
    ) {
      return "empleado";
    }
    if (/(user|usuario|cliente|beneficiario|member|miembro)/.test(val)) {
      return "usuario";
    }
    if (val === "1" || val === "99") return "admin";
    if (val === "2") return "empleado";
    if (val === "3") return "usuario";
    return "";
  };

  let found = "";
  for (const p of parts) {
    const r = classify(p);
    if (r === "admin") return "admin";
    if (r === "empleado") found = "empleado";
    if (!found && r === "usuario") found = "usuario";
  }
  return found || "usuario";
}

function getInitialFrom(displayName = "U") {
  return (displayName.trim()[0] || "U").toUpperCase();
}

function colorFromString(str = "user") {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const tone = (Math.abs(hash) % 12) + 1;
  return `avatar-inicial--tone-${tone}`;
}

const HeaderUsuario = ({ onMenuClick, isSidebarOpen }) => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 576);
  const [user, setUser] = useState(readUser());
  const [completedMembership, setCompletedMembership] = useState("");

  const navigate = useNavigate();
  const userId = useMemo(() => resolveUserId(user), [user]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 576);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const onAuthChange = () => {
      setUser(readUser());
      setCompletedMembership("");
    };
    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  const cargarMembresiaCompletada = useCallback(async () => {
    if (!userId) {
      setCompletedMembership("");
      return;
    }

    try {
      try {
        const benefRaw = await obtenerBeneficiariosMios();
        const beneficiarios = Array.isArray(benefRaw?.data)
          ? benefRaw.data
          : Array.isArray(benefRaw)
            ? benefRaw
            : [];
        const membershipFromBenef = getActiveMembershipFromBeneficiarios(beneficiarios, user);
        setCompletedMembership(membershipFromBenef || "");
        return;
      } catch {
        // Fallback a ventas/usuario si beneficiarios no responde.
      }

      const token = localStorage.getItem("token");
      const res = await fetch(
        `${URL_VENTAS_USUARIO}/${encodeURIComponent(userId)}`,
        {
          headers: {
            Accept: "application/json",
            "ngrok-skip-browser-warning": "true",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!res.ok) {
        setCompletedMembership("");
        return;
      }

      const data = await res.json().catch(() => ({}));
      const ventas = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      setCompletedMembership(resolveCompletedMembership(ventas));
    } catch {
      setCompletedMembership("");
    }
  }, [user, userId]);

  useEffect(() => {
    cargarMembresiaCompletada();
  }, [cargarMembresiaCompletada]);

  useEffect(() => {
    const onMembershipChanged = (event) => {
      const status = normalizeMembershipStatus(event?.detail?.estado);
      if (status && !isCurrentMembershipStatus(status)) {
        setCompletedMembership("");
        return;
      }
      cargarMembresiaCompletada();
    };
    window.addEventListener("membresia-estado-actualizada", onMembershipChanged);
    return () =>
      window.removeEventListener(
        "membresia-estado-actualizada",
        onMembershipChanged,
      );
  }, [cargarMembresiaCompletada]);

  const handleCerrarSesion = () => {
    setMenuAbierto(false);
    doLogout();
    navigate("/acceder");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuAbierto && !event.target.closest(".usuario-contenedor")) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuAbierto]);

  const { displayName, subtitle, initial, avatarToneClass } = useMemo(() => {
    const name = user?.name || user?.nombre || user?.fullName || "";
    const email = user?.email || "";
    const computedName = name || email || "Invitado";
    const rawRole = extractRawRole(user);
    const norm = normalizeRole(rawRole);
    const roleLabel =
      norm === "admin"
        ? "Administrador"
        : norm === "empleado"
          ? "Empleado"
          : "Cliente";
    const membershipLabel = String(completedMembership || "").trim().toLowerCase();
    const computedInitial = getInitialFrom(computedName);
    const computedAvatarToneClass = colorFromString(computedName || email || "user");
    return {
      displayName: computedName,
      subtitle: membershipLabel ? `${membershipLabel} - ${roleLabel}` : `sin membresía - ${roleLabel}`,
      initial: computedInitial,
      avatarToneClass: computedAvatarToneClass,
    };
  }, [completedMembership, user]);

  return (
    <header
      className={`header-usuario ${isMobile ? "mobile" : ""} ${
        isSidebarOpen ? "sidebar-open" : ""
      }`}
    >
      <button
        className="btn-menu"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <IconMenu2 size={26} />
      </button>

      <div className="header-content">
        <div className="usuario-contenedor">
          <div
            className="usuario"
            onClick={() => {
              setMenuAbierto((prev) => !prev);
            }}
            aria-expanded={menuAbierto}
            aria-haspopup="true"
            title={displayName}
          >
            <div
              className={`avatar-inicial ${avatarToneClass}`}
              aria-hidden="true"
            >
              {initial}
            </div>

            {!isMobile && (
              <div className="info-usuario">
                <span className="nombre">{displayName}</span>
                <span className="rol">{subtitle}</span>
              </div>
            )}
            <IconChevronDown
              size={20}
              className={`flecha ${menuAbierto ? "abierta" : ""}`}
            />
          </div>

          {menuAbierto && (
            <div className="menu-usuario" role="menu">
              <Link
                to="configuracion"
                className="menu-item-usuario"
                onClick={() => setMenuAbierto(false)}
                role="menuitem"
              >
                <IconSettings size={20} />
                <span>Configuración</span>
              </Link>

              <div
                className="menu-item-usuario salir"
                onClick={handleCerrarSesion}
                role="menuitem"
              >
                <IconLogout size={20} />
                <span>Salir</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default HeaderUsuario;
