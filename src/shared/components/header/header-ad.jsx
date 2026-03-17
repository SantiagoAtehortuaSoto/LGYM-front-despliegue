// src/shared/components/HeaderAdmin/HeaderAdmin.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IconMenu2,
  IconBell,
  IconSettings,
  IconLogout,
  IconChevronDown,
} from "@tabler/icons-react";
import { buildUrl } from "../../../features/dashboard/hooks/apiConfig";
import { getToken } from "../../../features/dashboard/hooks/Acceder_API/authService";

const NOTIFICATIONS_ENDPOINT = buildUrl("/notificaciones/mias");
const SHOW_NOTIFICATIONS_BELL = false;

// ------- helpers de sesión -------
function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

// Normaliza strings tipo "Administrador", "ROLE_ADMIN", "1" -> "admin" | "empleado" | "usuario"
function normalizeRole(raw) {
  if (raw == null) return "usuario";
  const val = String(raw).trim().toLowerCase();

  const adminSet = new Set([
    "admin",
    "administrator",
    "administrador",
    "adm",
    "role_admin",
    "admin_role",
    "superadmin",
    "super_admin",
  ]);
  const empleadoSet = new Set([
    "empleado",
    "employee",
    "instructor",
    "staff",
    "role_empleado",
    "role_employee",
  ]);
  const usuarioSet = new Set([
    "user",
    "usuario",
    "cliente",
    "member",
    "miembro",
    "beneficiario",
    "role_user",
  ]);

  if (adminSet.has(val)) return "admin";
  if (empleadoSet.has(val)) return "empleado";
  if (usuarioSet.has(val)) return "usuario";

  if (["1", "99"].includes(val)) return "admin";
  if (["2"].includes(val)) return "empleado";
  if (["3"].includes(val)) return "usuario";

  if (/(^|[_\-\s])admin(istrador)?($|[_\-\s])/.test(val)) return "admin";
  if (/(emplead|instructor|staff)/.test(val)) return "empleado";
  if (/(user|usuario|cliente|beneficiario|member|miembro)/.test(val))
    return "usuario";

  return val || "usuario";
}

const HeaderAdmin = ({ onMenuClick, isSidebarOpen }) => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [notificacionesAbiertas, setNotificacionesAbiertas] = useState(false);
  const [cargandoNotificaciones, setCargandoNotificaciones] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 576);
  const [user, setUser] = useState(readUser());
  const navigate = useNavigate();

  // Listener de resize (solo UI)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 576);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Escucha cambios de sesión (login/logout desde otros componentes)
  useEffect(() => {
    const onAuthChange = () => setUser(readUser());
    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  const construirFallbackNotificaciones = useCallback((emailUsuario) => {
    if (!emailUsuario) return [];
    return [
      {
        id: `fallback-${emailUsuario}`,
        titulo: "Proveedor dio respuesta",
        descripcion: `Recibiste una respuesta del proveedor para ${emailUsuario}.`,
        fecha: new Date().toISOString(),
        leida: false,
      },
    ];
  }, []);

  const cargarNotificaciones = useCallback(async () => {
    const emailUsuario = (user?.email || "").trim().toLowerCase();
    if (!emailUsuario) {
      setNotificaciones([]);
      return;
    }

    const token = getToken();
    setCargandoNotificaciones(true);
    try {
      const response = await fetch(NOTIFICATIONS_ENDPOINT, {
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) throw new Error("No se pudo cargar notificaciones");

      const payload = await response.json();
      const lista = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      const normalizadas = lista
        .map((item, idx) => ({
          id:
            item.id_notificacion ??
            item.id ??
            item.notification_id ??
            `${emailUsuario}-${idx}`,
          titulo: item.titulo ?? item.title ?? "Notificación",
          descripcion:
            item.descripcion ?? item.mensaje ?? item.message ?? "Sin detalle.",
          fecha: item.fecha ?? item.created_at ?? item.fecha_creacion ?? null,
          leida:
            item.leida ??
            item.read ??
            item.visto ??
            false,
          emailDestino:
            item.email_destino ?? item.emailDestino ?? item.email ?? null,
        }))
        .filter((item) => {
          if (!item.emailDestino) return true;
          return String(item.emailDestino).trim().toLowerCase() === emailUsuario;
        });

      setNotificaciones(
        normalizadas.length > 0
          ? normalizadas
          : construirFallbackNotificaciones(emailUsuario)
      );
    } catch {
      setNotificaciones(construirFallbackNotificaciones(emailUsuario));
    } finally {
      setCargandoNotificaciones(false);
    }
  }, [construirFallbackNotificaciones, user?.email]);

  useEffect(() => {
    if (!SHOW_NOTIFICATIONS_BELL) return;
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuAbierto && !event.target.closest(".usuario-contenedor")) {
        setMenuAbierto(false);
      }
      if (
        notificacionesAbiertas &&
        !event.target.closest(".notificaciones-contenedor")
      ) {
        setNotificacionesAbiertas(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuAbierto, notificacionesAbiertas]);

  // Nombre bonito y rol bonito
  const nombre = useMemo(
    () => user?.name || user?.nombre || user?.email || "Usuario",
    [user]
  );
  const prettyRole = useMemo(() => {
    const r = normalizeRole(user?.role);
    if (r === "admin") return "Administrador";
    if (r === "empleado") return "Empleado";
    return "Usuario";
  }, [user]);

  // Inicial para el avatar (si no quieres usar imagen)
  const inicial = (nombre?.[0] || user?.email?.[0] || "U").toUpperCase();

  // ¿Usar foto o inicial?
  // Si tienes foto en user.avatar o similar, úsala; si no, usa la inicial.
  const foto = user?.avatar || user?.foto || null; // ajusta al campo real de tu backend

  const notificacionesNoLeidas = useMemo(
    () => notificaciones.filter((n) => !n.leida).length,
    [notificaciones]
  );

  const formatearFechaNotificacion = (fecha) => {
    if (!fecha) return "";
    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleToggleNotificaciones = async () => {
    setMenuAbierto(false);
    const next = !notificacionesAbiertas;
    setNotificacionesAbiertas(next);
    if (next) {
      await cargarNotificaciones();
    }
  };

  const marcarComoLeida = (id) => {
    setNotificaciones((prev) =>
      prev.map((item) => (item.id === id ? { ...item, leida: true } : item))
    );
  };

  const handleCerrarSesion = () => {
    // Si tienes servicio:
    // try { doLogoutService(); } catch {}
    // Fallback sin servicio:
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-change"));
    navigate("/acceder"); // o "/" si prefieres
  };

  return (
    <header
      className={`header-admin ${isMobile ? "mobile" : ""} ${
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
        <div className="acciones-header">
          {SHOW_NOTIFICATIONS_BELL && (
            <div className="notificaciones-contenedor">
              <button
                className={`icono-circulo ${notificacionesAbiertas ? "activo" : ""}`}
                aria-label="Notificaciones"
                title="Notificaciones"
                onClick={handleToggleNotificaciones}
                aria-expanded={notificacionesAbiertas}
                aria-haspopup="dialog"
              >
                <IconBell size={26} />
                {notificacionesNoLeidas > 0 && (
                  <span className="notification-badge">{notificacionesNoLeidas}</span>
                )}
              </button>

              {notificacionesAbiertas && (
                <div
                  className="panel-notificaciones"
                  role="dialog"
                  aria-label="Panel de notificaciones"
                >
                  <div className="panel-notificaciones-header">
                    <h4>Notificaciones</h4>
                    <span className="panel-notificaciones-email">
                      {user?.email || "sin correo"}
                    </span>
                  </div>

                  <div className="panel-notificaciones-body">
                    {cargandoNotificaciones ? (
                      <p className="panel-notificaciones-empty">Cargando...</p>
                    ) : notificaciones.length === 0 ? (
                      <p className="panel-notificaciones-empty">
                        No tienes notificaciones.
                      </p>
                    ) : (
                      notificaciones.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`item-notificacion ${item.leida ? "leida" : "nueva"}`}
                          onClick={() => marcarComoLeida(item.id)}
                        >
                          <span className="item-notificacion-titulo">{item.titulo}</span>
                          <span className="item-notificacion-descripcion">
                            {item.descripcion}
                          </span>
                          <span className="item-notificacion-fecha">
                            {formatearFechaNotificacion(item.fecha)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="usuario-contenedor">
          <div
            className="usuario"
            onClick={() => setMenuAbierto((v) => !v)}
            aria-expanded={menuAbierto}
            aria-haspopup="true"
          >
            {/* Avatar: foto si hay, si no inicial dentro de un circulito */}
            {foto ? (
              <img src={foto} alt="Foto de perfil" className="foto-usuario" />
            ) : (
              <div className="avatar-inicial">
                {/* Si prefieres un ícono cuando no hay inicial, usa IconUserCircle */}
                {/* <IconUserCircle size={22} /> */}
                <span>{inicial}</span>
              </div>
            )}

            {!isMobile && (
              <div className="info-usuario">
                <span className="nombre" title={nombre}>
                  {nombre}
                </span>
                <span className="rol">{prettyRole}</span>
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

export default HeaderAdmin;
