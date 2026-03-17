import { useState, useEffect, useMemo, useCallback } from "react";
import Logo from "../../../assets/images/logo.png";
import ExpandableButtons from "../expandleButtons/expandlebuttons";
import { User } from "lucide-react";
import {
  membresiasLinksCliente,
  citasLinksCliente,
  seguimientoLinksCliente,
} from "../../utils/data/links";
import { NavLink } from "react-router-dom";
import { buildUrl } from "../../../features/dashboard/hooks/apiConfig";
import { resolveUserId } from "../../utils/appointmentNotifications";

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

function resolveMembershipName(sale) {
  if (!sale || typeof sale !== "object") return "";

  const fromSale =
    sale.nombre_membresia ||
    (Array.isArray(sale.membresias) &&
      (sale.membresias.find((m) => m?.nombre_membresia)?.nombre_membresia ||
        sale.membresias.find((m) => m?.nombre)?.nombre));
  if (fromSale) return String(fromSale).trim();

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
    const idMembership = Number(
      detail?.id_membresia ?? detail?.idMembresia ?? detail?.id_membresias,
    );
    if (Number.isFinite(idMembership) && idMembership > 0) return true;
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

function resolveCompletedMembershipName(ventas = []) {
  if (!Array.isArray(ventas) || ventas.length === 0) return "";

  const sorted = [...ventas]
    .map((sale) => {
      const status = normalizeStatus(
        sale?.estado_venta ||
          sale?.estado ||
          sale?.id_estado_estado?.estado ||
          sale?.id_estado,
      );
      const membershipName = resolveMembershipName(sale);
      return { sale, status, membershipName };
    })
    .filter((item) => item.status === "COMPLETADO" && Boolean(item.membershipName))
    .sort((a, b) => saleDateNumber(b.sale) - saleDateNumber(a.sale));

  return sorted[0]?.membershipName || "";
}

function isPremiumMembership(name) {
  const value = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return value.includes("premium");
}

function SidebarClientes({ isOpen = true }) {
  const [user, setUser] = useState(readUser());
  const [canSeeCitas, setCanSeeCitas] = useState(false);
  const [openSection, setOpenSection] = useState(null);

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
      const ventas = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

      const completedMembershipName = resolveCompletedMembershipName(ventas);
      setCanSeeCitas(isPremiumMembership(completedMembershipName));
    } catch {
      setCanSeeCitas(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCitasAccess();
  }, [loadCitasAccess]);

  useEffect(() => {
    const onMembershipChanged = () => {
      loadCitasAccess();
    };
    window.addEventListener("membresia-estado-actualizada", onMembershipChanged);
    return () =>
      window.removeEventListener(
        "membresia-estado-actualizada",
        onMembershipChanged,
      );
  }, [loadCitasAccess]);

  const handleSectionToggle = (sectionName, nextExpanded) => {
    setOpenSection((current) => {
      if (nextExpanded) return sectionName;
      return current === sectionName ? null : current;
    });
  };

  return (
    <div className={`sidebar-cliente ${isOpen ? "" : "collapsed"}`}>
      <div className="sidebar-top">
        <a className="logo" href="">
          <img className="logo" src={Logo} alt="LGYM Logo" />
        </a>
        <NavLink
          className={({ isActive }) =>
            `dash-button poppins-regular${isActive ? " is-active" : ""}`
          }
          to="/dashboardCliente"
        >
          <User size={25} />
          {isOpen && <span>MI PERFIL</span>}
        </NavLink>
      </div>
      <div className="sidebar-content">
        <ExpandableButtons
          isSidebarOpen={isOpen}
          nombreBoton={"Membresias"}
          links={membresiasLinksCliente}
          isExpanded={openSection === "Membresias"}
          onToggle={(nextExpanded) =>
            handleSectionToggle("Membresias", nextExpanded)
          }
        />
        {canSeeCitas && (
          <ExpandableButtons
            isSidebarOpen={isOpen}
            nombreBoton={"Citas"}
            links={citasLinksCliente}
            isExpanded={openSection === "Citas"}
            onToggle={(nextExpanded) =>
              handleSectionToggle("Citas", nextExpanded)
            }
          />
        )}
        <ExpandableButtons
          isSidebarOpen={isOpen}
          nombreBoton={"Seguimiento"}
          links={seguimientoLinksCliente}
          isExpanded={openSection === "Seguimiento"}
          onToggle={(nextExpanded) =>
            handleSectionToggle("Seguimiento", nextExpanded)
          }
        />
      </div>
    </div>
  );
}

export default SidebarClientes;
