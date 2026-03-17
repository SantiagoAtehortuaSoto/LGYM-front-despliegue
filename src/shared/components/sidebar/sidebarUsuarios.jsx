import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  IconHome,
  IconShoppingCart,
  IconBriefcase,
  IconClipboardList,
  IconCalendarEvent,
  IconUser,
} from "@tabler/icons-react";

import Logo from "../../../assets/LGYM_logo.png";
import { buildUrl } from "../../../features/dashboard/hooks/apiConfig";
import { resolveUserId } from "../../utils/appointmentNotifications";
import { obtenerBeneficiariosMios } from "../../../features/dashboard/hooks/Beneficiario_API.jsx/Beneficiario_API";

const URL_VENTAS_USUARIO = buildUrl("/ventas/usuario");

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function normalizeStatus(raw) {
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
  return normalizeStatus(
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

function getMembershipNameFromBeneficiarios(beneficiarios = [], user = null) {
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

  return String(
    preferred?.id_membresia_membresia?.nombre_membresia ||
      preferred?.id_membresia_membresia?.nombre ||
      preferred?.membresia?.nombre_membresia ||
      preferred?.membresia?.nombre ||
      preferred?.nombre_membresia ||
      preferred?.nombre ||
      "",
  ).trim();
}

function getMembershipName(sale) {
  if (!sale || typeof sale !== "object") return "";

  const directName =
    sale.nombre_membresia ||
    (Array.isArray(sale.membresias) &&
      (sale.membresias.find((m) => m?.nombre_membresia)?.nombre_membresia ||
        sale.membresias.find((m) => m?.nombre)?.nombre));

  if (directName) return String(directName).trim();

  const detailsBase =
    sale.detalles || sale.detalles_venta || sale.detalle_venta || sale.productos || [];
  const detailsExtra = Array.isArray(sale.membresias)
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

  const details = [...(Array.isArray(detailsBase) ? detailsBase : []), ...detailsExtra];
  const membershipDetail = details.find((detail) => {
    const membershipId = Number(
      detail?.id_membresia ?? detail?.idMembresia ?? detail?.id_membresias,
    );
    if (Number.isFinite(membershipId) && membershipId > 0) return true;
    if (detail?.membresia) return true;
    return String(detail?.tipo_venta ?? detail?.tipoVenta ?? "")
      .toLowerCase()
      .includes("memb");
  });

  return (
    membershipDetail?.membresia?.nombre_membresia ||
    membershipDetail?.membresia?.nombre ||
    membershipDetail?.nombre_membresia ||
    membershipDetail?.nombre ||
    ""
  )
    .toString()
    .trim();
}

function saleDateNumber(sale) {
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

function getLatestCompletedMembershipName(sales = []) {
  if (!Array.isArray(sales) || sales.length === 0) return "";

  const completed = [...sales]
    .map((sale) => {
      const status = normalizeStatus(
        sale?.estado_venta ||
          sale?.estado ||
          sale?.id_estado_estado?.estado ||
          sale?.id_estado,
      );
      return {
        sale,
        status,
        membershipName: getMembershipName(sale),
      };
    })
    .filter((entry) => entry.status === "COMPLETADO" && Boolean(entry.membershipName))
    .sort((a, b) => saleDateNumber(b.sale) - saleDateNumber(a.sale));

  return completed[0]?.membershipName || "";
}

function isCurrentMembershipStatus(status = "") {
  return status === "COMPLETADO" || status === "ACTIVO";
}

function isPremiumMembership(name) {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.includes("premium");
}

const SidebarUsuario = () => {
  const [activo, setActivo] = useState("Inicio");
  const [user, setUser] = useState(readUser());
  const [canSeeCitas, setCanSeeCitas] = useState(false);
  const navigate = useNavigate();

  const userId = useMemo(() => resolveUserId(user), [user]);

  useEffect(() => {
    const onAuthChange = () => setUser(readUser());
    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  const loadCitasAccess = useCallback(async () => {
    if (!userId) {
      setCanSeeCitas(false);
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
        const membershipFromBenef = getMembershipNameFromBeneficiarios(beneficiarios, user);
        setCanSeeCitas(isPremiumMembership(membershipFromBenef));
        return;
      } catch {
        // Fallback a ventas si beneficiarios no responde.
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
        setCanSeeCitas(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      const sales = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
      const membershipName = getLatestCompletedMembershipName(sales);
      setCanSeeCitas(isPremiumMembership(membershipName));
    } catch {
      setCanSeeCitas(false);
    }
  }, [user, userId]);

  useEffect(() => {
    loadCitasAccess();
  }, [loadCitasAccess]);

  useEffect(() => {
    const onMembershipChanged = (event) => {
      const status = normalizeStatus(event?.detail?.estado);
      if (status && !isCurrentMembershipStatus(status)) {
        setCanSeeCitas(false);
        return;
      }
      loadCitasAccess();
    };
    window.addEventListener("membresia-estado-actualizada", onMembershipChanged);
    return () =>
      window.removeEventListener(
        "membresia-estado-actualizada",
        onMembershipChanged,
      );
  }, [loadCitasAccess]);

  const elementosMenu = [
    { nombre: "Métricas de Usuario", icono: <IconHome size={22} />, ruta: "/cliente/dashboard-usuario" },
    { nombre: "Seguimiento", icono: <IconUser size={22} />, ruta: "/cliente/seguimientoUsuario" },
    { nombre: "Servicios", icono: <IconBriefcase size={22} />, ruta: "/cliente/serviciosUsuario" },
    { nombre: "Pedidos", icono: <IconClipboardList size={22} />, ruta: "/cliente/pedidosUsuario" },
    ...(canSeeCitas
      ? [{ nombre: "Citas", icono: <IconCalendarEvent size={22} />, ruta: "/cliente/agendarCita" }]
      : []),
    { nombre: "Productos", icono: <IconShoppingCart size={30} />, ruta: "/productos", cta: true },
  ];

  return (
    <div className="sidebar">
      {/* Logo con animacion */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.8, ease: "easeOut", type: "spring" }}
        className="logo-contenedor"
      >
        <a href="/">
          <img src={Logo} alt="logo" className="logo" />
        </a>
      </motion.div>

      {/* Menu */}
      <ul className="menu">
        {elementosMenu.map((item, index) => {
          const esDestacado = item.cta;
          return (
            <motion.li
              key={index}
              whileHover={esDestacado ? { scale: 1.02, x: 2 } : { scale: 1.05, x: 4 }}
              whileTap={esDestacado ? { scale: 0.98 } : { scale: 0.95 }}
              onClick={() => {
                setActivo(item.nombre);
                navigate(item.ruta);
              }}
              className={`menu-item ${esDestacado ? "menu-item-compra" : ""} ${
                activo === item.nombre ? "activo" : ""
              }`}
            >
              {item.icono}
              <span className={`texto ${esDestacado ? "texto-cta" : ""}`}>{item.nombre}</span>
              {esDestacado && <span className="cta-flecha">⮌</span>}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
};

export default SidebarUsuario;
