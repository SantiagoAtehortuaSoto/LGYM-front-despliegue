// src/shared/components/NavegadorLanding.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  const goDashboard = () => {
    setOpen(false);
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
    setOpen(false);
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
      <Link to="/" className="logo-container">
        <img src={Logo} alt="Logo" className="logo-landing" />
      </Link>

      {/* Links de navegación */}
      <ul className="nav-links">
        <li>
          <Link to="/">Inicio</Link>
        </li>
        <li>
          <Link to="/productos">Productos</Link>
        </li>
        <li>
          <Link to="/servicios">Servicios</Link>
        </li>
        <li>
          <Link to="/contactos">Contacto</Link>
        </li>

        {/* Bloque derecho: Acceder o Usuario + menú */}
        {!user ? (
          <li>
            <Link to="/acceder" className="btn-acceder">
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
    </nav>
  );
};

export default NavegadorLanding;
