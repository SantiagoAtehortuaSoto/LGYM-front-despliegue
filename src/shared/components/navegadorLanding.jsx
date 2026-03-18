// src/shared/components/NavegadorLanding.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
/* Importación de imagenes */
import Logo from "../../assets/LGYM_logo.png";
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
  // notificar a la app (el login que hicimos ya emite esto al iniciar sesión)
  window.dispatchEvent(new Event("auth-change"));
}

/* ===================== Helpers de rol ===================== */
// Extrae el rol “crudo” desde roles_usuarios (string/array) o campos alternativos
function extractRawRole(user) {
  if (!user || typeof user !== "object") return "";
  const candidates = [
    user.roles_usuarios, // <- tu backend
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
            : ""
        )
        .filter(Boolean);
      if (names.length) return names.join("|");
    }
  }
  const first = candidates.find((x) => typeof x === "string" || typeof x === "number");
  return first ?? "";
}

// Normaliza el rol a admin/empleado/usuario
function normalizeRole(raw) {
  if (raw == null) return "usuario";
  const parts = String(raw).split("|").map((s) => s.trim().toLowerCase());

  const classify = (val) => {
    if (/(^|_|-|\s)admin(istrador)?($|_|-|\s)/.test(val) || /role_admin|admin_role/.test(val)) return "admin";
    if (/(emplead|instructor|staff)/.test(val) || /role_empleado|empleado_role/.test(val)) return "empleado";
    if (/(user|usuario|cliente|beneficiario|member|miembro)/.test(val)) return "usuario";
    if (/^\d+$/.test(val)) {
      const num = Number(val);
      if (num === 1 || num === 99) return "admin";
      if (num === 3 || num === 6) return "usuario";
      return "empleado";
    }
    return "";
  };

  let found = "";
  for (const p of parts) {
    const r = classify(p);
    if (r === "admin") return "admin";
    if (r === "empleado") found = "empleado";
    if (!found && r === "usuario") found = "usuario";
  }
  return found || "empleado";
}

const NavegadorLanding = () => {
  const [user, setUser] = useState(readUser());
  const [open, setOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onAuthChange = () => setUser(readUser());
    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return undefined;
    }

    const isMobileViewport = window.innerWidth <= 768;
    if (!mobileMenuOpen || !isMobileViewport) {
      document.body.style.overflow = "";
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeMenus = () => {
    setOpen(false);
    setMobileMenuOpen(false);
  };

  const goDashboard = () => {
    closeMenus();
    const rawRole = extractRawRole(user);
    const rol = normalizeRole(rawRole);
    if (rol === "admin") {
      navigate("/admin/dashboard");
    } else if (rol === "empleado") {
      navigate("/empleados/dashboardEmpleado");
    } else {
      navigate("/cliente/dashboard-usuario"); // o "/cliente/inicio-usuario"
    }
  };

  const handleLogout = () => {
    closeMenus();
    doLogout();
    navigate("/acceder"); // o "/" si prefieres
  };

  // Para mostrar el rol “bonito” en el pill
  const prettyRole = (() => {
    const r = normalizeRole(extractRawRole(user));
    if (r === "admin") return "Administrador";
    if (r === "empleado") return "Empleado";
    return "Usuario";
  })();

  return (
    <nav className="navegacion-landing">
      {/* Logo a la izquierda */}
      <Link to="/" className="logo-container" onClick={closeMenus}>
        <img src={Logo} alt="Logo" className="logo-landing" />
      </Link>

      <button
        type="button"
        className={`landing-menu-toggle${mobileMenuOpen ? " is-open" : ""}`}
        onClick={() => setMobileMenuOpen((value) => !value)}
        aria-label={mobileMenuOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
        aria-expanded={mobileMenuOpen}
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Links de navegación */}
      <ul className={`nav-links${mobileMenuOpen ? " nav-links--open" : ""}`}>
        <li>
          <Link to="/" onClick={closeMenus}>Inicio</Link>
        </li>
        <li>
          <Link to="/productos" onClick={closeMenus}>Productos</Link>
        </li>
        <li>
          <Link to="/servicios" onClick={closeMenus}>Servicios</Link>
        </li>
        <li>
          <Link to="/contactos" onClick={closeMenus}>Contacto</Link>
        </li>

        {/* Bloque derecho: Acceder o Usuario + menú */}
        {!user ? (
          <li>
            <Link to="/acceder" className="btn-acceder" onClick={closeMenus}>
              Acceder
            </Link>
          </li>
        ) : (
          <li className="nav-user">
            <button
              type="button"
              className="user-pill"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span className="avatar-dot">
                {(user.name?.[0] || user.email?.[0] || "U").toUpperCase()}
              </span>
              <span className="user-meta">
                <span className="user-name" title={user.name || user.email}>
                  {user.name || user.email}
                </span>
                <span className="user-role">{prettyRole}</span>
              </span>
              <span className={`caret ${open ? "open" : ""}`}>▾</span>
            </button>

            {open && (
              <div className="user-menu" role="menu">
                <button className="user-item" onClick={goDashboard}>
                  Dashboard
                </button>
                <button className="user-item danger" onClick={handleLogout}>
                  Salir
                </button>
              </div>
            )}
          </li>
        )}{" "}
      </ul>

      {mobileMenuOpen ? (
        <div
          className="landing-nav-backdrop is-visible"
          onClick={closeMenus}
          aria-hidden="true"
        />
      ) : null}
    </nav>
  );
};

export default NavegadorLanding;
