// src/hooks/Acceder_API/authService.js

// URL base del backend
import { buildUrl } from "../apiConfig";

const API_URL = buildUrl("/usuarios");
const API_URL_LOGIN = buildUrl("/usuarios/login");

const API_URL_ENVIAR_EMAIL = buildUrl("/usuarios/forgot-password");
const API_URL_VERIFICAR_CODIGO = buildUrl("/usuarios/verify-code");
const API_URL_VERIFICAR_EMAIL_REPETIDO = buildUrl("/usuarios/check-email");
const API_URL_VERGICAR_DOCUMENTO_REPETIDO = buildUrl("/usuarios/check-documento");

// 
const API_URL_CAMBIAR_CONTRASENA = buildUrl("/usuarios/reset-password");

/* URLs para verificación de cuenta */
const API_URL_VERIFICAR_CUENTA =
  buildUrl("/usuarios/verify-email");

const API_URL_REENVIAR_VERIFICACION =
  buildUrl("/usuarios/resend-verification");



const API_URL_PERMISOS = buildUrl("/usuarios/me/permisos");
const INACTIVE_ACCOUNT_RE =
  /(inactiv[oa]|desactivad[oa]|suspendid[oa]|bloquead[oa]|inhabilitad[oa])/i;
const PERMISSIONS_SYNC_INTERVAL_MS = 15000;
const PERMISSIONS_SYNC_MIN_GAP_MS = 5000;
let permissionsRefreshInFlight = null;
let lastPermissionsSyncedAtMs = 0;

// ---------------- Utils ----------------
function sanitizeStoredToken(value) {
  if (!value) return "";
  return String(value).replace(/^Bearer\s+/i, "").trim();
}

async function parseJSON(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { msg: text || "Error desconocido del servidor" };
  }
}

async function api(url, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await parseJSON(res);
  if (!res.ok) {
    const msg = data?.msg || data?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data ?? {};
}

const toRuntimeUrl = (value) =>
  new URL(
    value,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );

// --- Utils JWT y rol ---
function safeBase64ToUtf8(base64Url) {
  try {
    const base64 =
      base64Url.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (base64Url.length % 4)) % 4);
    return atob(base64);
  } catch {
    return "";
  }
}

function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    const json = safeBase64ToUtf8(base64Url);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

// Normaliza strings tipo "Administrador", "ROLE_ADMIN", "1" -> "admin" | "empleado" | "usuario"
function normalizeRole(raw) {
  if (raw == null) return "usuario";
  const val = String(raw).trim().toLowerCase();
  const numeric = /^\d+$/.test(val) ? Number(val) : NaN;

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

  // ids típicos por si backend usa números (1=admin, 6=usuario; el resto, empleado)
  if (!Number.isNaN(numeric)) {
    if ([1, 99].includes(numeric)) return "admin";
    if ([3, 6, 33].includes(numeric)) return "usuario";
    if ([2].includes(numeric)) return "empleado";
    // cualquier otro id numérico se trata como empleado
    return "empleado";
  }

  // patrones comunes
  if (/(^|[_\-\s])admin(istrador)?($|[_\-\s])/.test(val)) return "admin";
  if (/(emplead|instructor|staff)/.test(val)) return "empleado";
  if (/(user|usuario|cliente|beneficiario|member|miembro)/.test(val))
    return "usuario";

  // por defecto, tratamos lo desconocido como empleado para no dejarlo sin panel
  return "empleado";
}

function extractRoleCandidate(value) {
  if (value == null) return "";

  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractRoleCandidate(item))
      .filter(Boolean)
      .join("|");
  }

  if (typeof value === "object") {
    const fields = [
      value.nombre,
      value.name,
      value.rol,
      value.role,
      value.tipo,
      value.tipo_usuario,
      value.tipoUsuario,
      value.id_rol,
      value.id,
      value.rol_id,
      value.roleId,
      value.id_role,
      value.id_rol_rol,
    ];

    for (const field of fields) {
      const resolved = extractRoleCandidate(field);
      if (resolved) return resolved;
    }
  }

  return "";
}

// Acepta: string, objeto { nombre }, o estructuras conocidas (user o payload)
function extractRoleFrom(obj = {}) {
  if (!obj || typeof obj !== "object") return "";

  const resolved = [
    obj.role,
    obj.rol,
    obj.perfil,
    obj.tipo,
    obj.tipo_usuario,
    obj.tipoUsuario,
    obj.nombre_rol,
    obj.rol_nombre,
    obj.role_name,
    obj.roles_usuarios,
    obj.roles,
    obj.authorities,
    obj.id_rol,
    obj.rol_id,
    obj.roleId,
    obj.id_role,
    obj.id_rol_rol,
  ]
    .map((candidate) => extractRoleCandidate(candidate))
    .filter(Boolean)
    .join("|");

  if (resolved) return normalizeRole(resolved);

  // 0) Si "obj" en sí MISMO es el rol (objeto con nombre)
  if (obj && typeof obj === "object" && ("nombre" in obj || "name" in obj)) {
    return normalizeRole(obj.nombre || obj.name);
  }

  // 1) Campos directos
  const direct =
    obj.role ??
    obj.rol ??
    obj.perfil ??
    obj.tipo ??
    obj.tipo_usuario ??
    obj.tipoUsuario;
  if (direct) {
    if (typeof direct === "object") {
      return normalizeRole(direct.nombre || direct.name || "");
    }
    return normalizeRole(direct);
  }

  // 2) roles_usuarios
  if (Array.isArray(obj.roles_usuarios) && obj.roles_usuarios.length) {
    const first = obj.roles_usuarios[0];
    if (typeof first === "string") return normalizeRole(first);
    if (first && typeof first === "object") {
      return normalizeRole(
        first.nombre ||
        first.name ||
        first.rol ||
        first.role ||
        first.tipo ||
        first.tipo_usuario ||
        ""
      );
    }
  }
  if (obj.roles_usuarios && typeof obj.roles_usuarios === "object") {
    const o = obj.roles_usuarios;
    return normalizeRole(
      o.nombre || o.name || o.rol || o.role || o.tipo || o.tipo_usuario || ""
    );
  }

  // 3) arrays típicos
  const arrayFields = [obj.roles, obj.authorities, obj.permisos].filter(
    Array.isArray
  );
  for (const arr of arrayFields) {
    let hit = arr.find((x) => /admin/i.test(String(x?.nombre || x?.name || x)));
    if (hit) return normalizeRole(hit?.nombre || hit?.name || hit);
    hit = arr.find((x) =>
      /(emplead|instructor|staff)/i.test(String(x?.nombre || x?.name || x))
    );
    if (hit) return normalizeRole(hit?.nombre || hit?.name || hit);
    hit = arr.find((x) =>
      /(user|usuario|client|beneficiario|member|miembro)/i.test(
        String(x?.nombre || x?.name || x)
      )
    );
    if (hit) return normalizeRole(hit?.nombre || hit?.name || hit);
  }

  return "";
}

// -------- auth --------
export const login = async (email, password) => {
  try {
    const res = await fetch(API_URL_LOGIN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await parseJSON(res);

    if (!res.ok) {
      const msg =
        data.msg || data.message || "Email o contraseña incorrectos";
      const rawErrorText = [
        msg,
        data.error,
        data.reason,
        data.code,
        data.status,
      ]
        .filter(Boolean)
        .join(" ");
      const isDisabledAccount = INACTIVE_ACCOUNT_RE.test(rawErrorText);

      // 👇 Detectar que el backend está indicando "cuenta no verificada"
      const needsVerification =
        !isDisabledAccount &&
        (res.status === 403 || /verificaci[oó]n/i.test(rawErrorText));

      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      if (isDisabledAccount) {
        err.code = "ACCOUNT_DISABLED";
        err.email = email;
      }
      if (needsVerification) {
        err.code = "EMAIL_NOT_VERIFIED";
        err.email = email;
      }

      throw err;
    }

    // Acepta varios nombres de token
    const token = sanitizeStoredToken(
      data.token ||
        data.access_token ||
        data.accessToken ||
        data.jwt ||
        data.tokenSesion ||
        data.authToken ||
        data.data?.token ||
        data.data?.access_token ||
        data.data?.accessToken ||
        res.headers.get("x-refreshed-token") ||
        res.headers.get("authorization")
    );
    if (!token) throw new Error(data.msg || "Email o contraseña incorrectos");

    const payload = (() => {
      try {
        return decodeJwtPayload(token) || {};
      } catch {
        return {};
      }
    })();

    // Guarda token
    localStorage.setItem("token", token);

    // Construye el user
    const rawRole =
      (data.role && (data.role.nombre || data.role.name)) ||
      (data.user &&
        data.user.role &&
        (data.user.role.nombre || data.user.role.name)) ||
      (payload.role && (payload.role.nombre || payload.role.name)) ||
      // fallback por si en algún entorno llega como string:
      data.role ||
      (data.user && data.user.role) ||
      payload.role ||
      "";

    const role = normalizeRole(rawRole);

    const rawUser = data.user || {};
    const resolvedRole =
      extractRoleFrom(rawUser) ||
      extractRoleFrom(payload || {}) ||
      extractRoleFrom(data.role || {}) ||
      role ||
      "usuario";
    const permisosAsignados =
      rawUser.permisosAsignados ||
      rawUser.permisos_asignados ||
      rawUser.role?.permisosAsignados ||
      rawUser.role?.permisos_asignados ||
      data.role?.permisosAsignados ||
      data.role?.permisos_asignados ||
      payload.permisosAsignados ||
      payload.permisos_asignados ||
      [];

    const permisos =
      rawUser.permisos ||
      rawUser.role?.permisos ||
      data.role?.permisos ||
      payload.permisos ||
      [];

    const user = {
      ...rawUser,
      id: rawUser.id ?? payload.id ?? payload.sub ?? null,
      name:
        rawUser.name ??
        rawUser.nombre ??
        payload.name ??
        payload.nombre ??
        email,
      email: rawUser.email ?? payload.email ?? email,
      role: resolvedRole, // "admin" | "empleado" | "usuario"
      permisosAsignados: Array.isArray(permisosAsignados)
        ? permisosAsignados
        : [],
      permisos: Array.isArray(permisos) ? permisos : [],
      _rawRoleUser: extractRoleFrom(rawUser),
      _rawRolePayload: extractRoleFrom(payload),
    };

    // Intenta traer permisos/módulos al iniciar sesión para que el sidebar los tenga disponibles
    try {
      const roleId =
        rawUser?.role?.id_rol ??
        rawUser?.role?.id ??
        rawUser?.id_rol ??
        payload?.role?.id_rol ??
        payload?.role_id ??
        null;
      const userId = user.id;

      const permData = await fetchUserPermissionsWithFallback(roleId, userId);
      const normalizedPerms = normalizePermisosPayload(permData);
      const modulesArr = Array.isArray(permData?.modules)
        ? permData.modules
        : [];

      if (normalizedPerms.length || modulesArr.length) {
        user.permisosAsignados =
          normalizedPerms.length > 0 ? normalizedPerms : user.permisosAsignados;
        user.modulesNormalized =
          normalizedPerms.length > 0 ? normalizedPerms : user.modulesNormalized;
        user.modules = modulesArr.length > 0 ? modulesArr : user.modules;
      }
    } catch (err) {
      console.warn("[AUTH] No se pudieron precargar permisos/módulos", err);
    }

    user.privilegioAccionMap = buildPrivilegioActionMap(user);
    localStorage.setItem("user", JSON.stringify(user));

    // Notifica cambio de auth
    window.dispatchEvent(new Event("auth-change"));

    return { token, user };
  } catch (error) {
    console.error("[AUTH] Error en login:", error);
    throw error;
  }
};

// Registro
export const register = async (
  nombre_usuario,
  apellido_usuario,
  tipo_documento,
  documento,
  email,
  telefono,
  c_emergencia,
  n_emergencia,
  fecha_nacimiento,
  genero,
  enfermedades,
  password
) => {
  try {
    const res = await fetch(`${API_URL}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_usuario,
        apellido_usuario,
        tipo_documento,
        documento,
        email,
        telefono,
        c_emergencia,
        n_emergencia,
        fecha_nacimiento,
        genero,
        enfermedades,
        password,
      }),
    });

    const data = await parseJSON(res);
    if (!res.ok) throw new Error(data.msg || "Error al registrarse");
    return data;
  } catch (error) {
    console.error("[AUTH] Error en register:", error);
    throw error;
  }
};

// Verificar si email ya existe
export async function checkEmailExists(email, { signal } = {}) {
  if (!email) throw new Error("Email es requerido");
  const normalized = String(email).trim().toLowerCase();

  const res = await fetch(API_URL_VERIFICAR_EMAIL_REPETIDO, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: normalized }),
    signal,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { msg: text };
  }

  if (res.status === 409 || res.status === 422)
    return { exists: true, raw: data };

  if (!res.ok) {
    const msg = data?.msg || data?.message || `Error ${res.status}`;
    throw new Error(msg);
  }

  const toBool = (v) =>
    typeof v === "boolean"
      ? v
      : typeof v === "string"
        ? /^(true|1|yes|si|sí)$/i.test(v.trim())
        : typeof v === "number"
          ? v !== 0
          : undefined;

  const existsNormalized =
    toBool(data.exists) ??
    (toBool(data.available) === false ? true : undefined) ??
    (typeof data.message === "string" &&
      /(registrad|existe|ocupad|no\s*disponible|ya\s*usad)/i.test(
        data.message
      )) ??
    (typeof data.msg === "string" &&
      /(registrad|existe|ocupad|no\s*disponible|ya\s*usad)/i.test(data.msg)) ??
    false;

  return { exists: Boolean(existsNormalized), raw: data };
}

// Verificar si documento ya existe
export async function checkDocumentoExists(documento, { signal } = {}) {
  if (!documento) throw new Error("Documento es requerido");

  const normalized = String(documento).trim();

  const res = await fetch(API_URL_VERGICAR_DOCUMENTO_REPETIDO, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ documento: normalized }),
    signal,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { msg: text };
  }

  if (res.status === 409 || res.status === 422)
    return { exists: true, raw: data };

  if (!res.ok) {
    const msg = data?.msg || data?.message || `Error ${res.status}`;
    throw new Error(msg);
  }

  const toBool = (v) =>
    typeof v === "boolean"
      ? v
      : typeof v === "string"
        ? /^(true|1|yes|si|sí)$/i.test(v.trim())
        : typeof v === "number"
          ? v !== 0
          : undefined;

  const existsNormalized =
    toBool(data.exists) ??
    (toBool(data.available) === false ? true : undefined) ??
    (typeof data.message === "string" &&
      /(registrad|existe|ocupad|no\s*disponible|ya\s*usad)/i.test(
        data.message
      )) ??
    (typeof data.msg === "string" &&
      /(registrad|existe|ocupad|no\s*disponible|ya\s*usad)/i.test(data.msg)) ??
    false;

  return { exists: Boolean(existsNormalized), raw: data };
}

// 1) Enviar email con código (recuperar contraseña)
export async function forgotPassword(email) {
  if (!email) throw new Error("Email es requerido");
  return api(API_URL_ENVIAR_EMAIL, {
    method: "POST",
    body: { email },
  });
}

// 2) Verificar código (flujo antiguo, sigue igual mientras /verify-code exista)
export async function verifyCode({ email, verificationCode }) {
  if (!email || !verificationCode) {
    throw new Error("Email y código son requeridos");
  }

  const res = await fetch(API_URL_VERIFICAR_CODIGO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: String(email).trim().toLowerCase(),
      verificationCode: String(verificationCode).trim(),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || "Error de verificación";
    throw new Error(msg);
  }

  // Si tu backend ya no devuelve resetToken, puedes ignorar esto en el front
  return data;
}

/*
 * 3) Cambiar contraseña con código recibido por email
 * Endpoint:  /usuarios/reset-password
 * Body: { email, resetcode, newPassword }
 */
export async function updatePasswordVerified(params) {
  // Aceptamos resetCode o resetcode para que no falle por el nombre de la prop
  const email = params.email;
  const resetCode = params.resetCode ?? params.resetcode;
  const newPassword = params.newPassword;

  if (!email || !resetCode || !newPassword) {
    throw new Error("Email, resetcode y nueva contraseña son requeridos");
  }

  const res = await fetch(API_URL_CAMBIAR_CONTRASENA, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // EXACTAMENTE como lo espera tu API:
      email: String(email).trim().toLowerCase(),
      resetcode: String(resetCode).trim(),
      newPassword: String(newPassword),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      data?.msg ||
      "No se pudo actualizar la contraseña";
    throw new Error(msg);
  }
  return data;
}

/* Verificación de cuenta después de registro */

// Verificar email con código de activación
// Endpoint: /usuarios/verify-email
// Body: { email, verificationcode }
export async function verifyRegistroEmail({ email, verificationCode }) {
  if (!email || !verificationCode) {
    throw new Error("Email y código de verificación son requeridos");
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  return api(API_URL_VERIFICAR_CUENTA, {
    method: "POST",
    body: {
      email: normalizedEmail,
      verificationcode: String(verificationCode).trim(), // 👈 clave EXACTA que espera el backend
    },
  });
}

// Reenviar código de activación al correo
export async function resendVerification(email) {
  if (!email) throw new Error("Email es requerido");

  const normalizedEmail = String(email).trim().toLowerCase();

  return api(API_URL_REENVIAR_VERIFICACION, {
    method: "POST",
    body: { email: normalizedEmail },
  });
}

// Logout
export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.dispatchEvent(new Event("auth-change"));
};

// Trae permisos del usuario autenticado desde /usuarios/me/permisos
export async function fetchUserPermissions() {
  const token = getToken();
  if (!token) throw new Error("No hay token en sesión");

  const res = await fetch(`${API_URL_PERMISOS}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await parseJSON(res);
  if (!res.ok) {
    const msg = data?.msg || data?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// --- Helpers de sesión/rol exportables ---
export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

export function getRole() {
  const u = getCurrentUser();
  const userRole = extractRoleFrom(u || {});
  if (userRole) return userRole;
  const token = localStorage.getItem("token");
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const payloadRole = extractRoleFrom(payload || {});
  if (payloadRole) return payloadRole;
  return null;
}

export function isAdmin() {
  return (getRole() || "").toLowerCase() === "admin";
}

// === Helpers de sesión ===
export function getToken() {
  const token = sanitizeStoredToken(localStorage.getItem("token"));
  if (!token) return null;

  if (localStorage.getItem("token") !== token) {
    localStorage.setItem("token", token);
  }

  return token;
}

/** Devuelve { valid: boolean, payload?: object, reason?: string } */
export function validateToken(token = getToken()) {
  if (!token) return { valid: false, reason: "missing" };
  const normalizedToken = sanitizeStoredToken(token);
  const tokenParts = normalizedToken.split(".");

  if (tokenParts.length !== 3) {
    return { valid: true, payload: null, reason: "opaque" };
  }

  const payload = decodeJwtPayload(normalizedToken);
  if (!payload || typeof payload !== "object" || Object.keys(payload).length === 0)
    return { valid: true, payload: null, reason: "opaque" };
  if (payload.exp) {
    const expMs = Number(payload.exp) * 1000;
    if (Number.isFinite(expMs) && Date.now() >= expMs) {
      return { valid: false, payload, reason: "expired" };
    }
  }
  return { valid: true, payload };
}

export function normalizeStoredToken() {
  const token = sanitizeStoredToken(localStorage.getItem("token"));
  if (!token) return null;
  localStorage.setItem("token", token);
  return token;
}

export function isAuthenticated() {
  return validateToken().valid;
}

/** Opcional: auto-logout si el token ya expiró */
export function ensureAuthFreshness() {
  const res = validateToken();
  if (!res.valid && res.reason === "expired") {
    logout();
    return false;
  }
  return res.valid;
}

// Variante con fallback: si /usuarios/me/permisos no existe, consulta /detallesrol?id_rol=<rol>
export async function fetchUserPermissionsWithFallback(roleId, userId) {
  const token = getToken();
  if (!token) throw new Error("No hay token en sesi?n");

  let lastError = null;

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    Authorization: `Bearer ${token}`,
  };

  const parseOrThrow = async (res) => {
    const data = await parseJSON(res);
    if (!res.ok) {
      const msg = data?.msg || data?.message || `Error ${res.status}`;
      const error = new Error(msg);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  // 1) Intento principal
  try {
    const res = await fetch(`${API_URL}/me/permisos`, { headers });
    return await parseOrThrow(res);
  } catch (err) {
    console.warn("[fetchUserPermissions] /usuarios/me/permisos fallo", err);
    // Permitir fallback si la API responde 404 (no existe), 401/403 (sin permiso)
    if (err?.status && ![401, 403, 404].includes(err.status)) throw err;
    lastError = err;
  }

  // 2) Fallbacks contra /detallesrol con distintas claves de query
  const apiRoot = API_URL.replace(/\/usuarios\/?$/, "");
  const fallbacks = [];
  if (roleId != null) {
    fallbacks.push(`id_rol=${roleId}`);
    fallbacks.push(`rol_id=${roleId}`);
    fallbacks.push(`rol=${roleId}`);
    fallbacks.push(`id_roles=${roleId}`);
  }
  if (userId != null) {
    fallbacks.push(`id_usuario=${userId}`);
    fallbacks.push(`usuario_id=${userId}`);
  }
  // Siempre al menos un intento sin query para ver si devuelve todo
  if (fallbacks.length === 0) fallbacks.push("");

  for (const query of fallbacks) {
    const url = toRuntimeUrl(`${apiRoot}/detallesrol`);
    if (query) {
      query.split("&").forEach((pair) => {
        const [k, v] = pair.split("=");
        url.searchParams.set(k, v);
      });
    }
    try {
      const resFallback = await fetch(url.toString(), { headers });
      return await parseOrThrow(resFallback);
    } catch (err) {
      lastError = err;
      if (err?.status && err.status !== 404) break;
    }
  }
  if (lastError) throw lastError;
  throw new Error("No se encontraron permisos (fallback)");
}

function resolveRoleIdFromUser(user = {}, payload = {}) {
  return (
    user?.role?.id_rol ??
    user?.role?.id ??
    user?.id_rol ??
    user?.rol_id ??
    user?.id_rol_rol?.id_rol ??
    user?.id_rol_rol?.id ??
    payload?.role?.id_rol ??
    payload?.role?.id ??
    payload?.role_id ??
    null
  );
}

export async function refreshCurrentUserPermissions({ force = false } = {}) {
  const token = getToken();
  const user = getCurrentUser();
  if (!token || !user) return null;

  const now = Date.now();
  const lastSyncedAt = Math.max(
    lastPermissionsSyncedAtMs,
    Number(user?.permissionsSyncedAt || 0),
  );
  const recentSync = now - lastSyncedAt < PERMISSIONS_SYNC_MIN_GAP_MS;
  if (!force && recentSync) return user;

  if (permissionsRefreshInFlight) return permissionsRefreshInFlight;

  permissionsRefreshInFlight = (async () => {
    try {
      const { payload } = validateToken(token);
      const roleId = resolveRoleIdFromUser(user, payload || {});
      const userId = user?.id ?? payload?.id ?? payload?.sub ?? null;
      const permData = await fetchUserPermissionsWithFallback(roleId, userId);
      const normalizedPerms = normalizePermisosPayload(permData);
      const modulesArr = Array.isArray(permData?.modules) ? permData.modules : [];
      const updatedUser = { ...user };

      if (normalizedPerms.length > 0) {
        updatedUser.permisosAsignados = normalizedPerms;
        updatedUser.modulesNormalized = normalizedPerms;
      }
      if (modulesArr.length > 0) {
        updatedUser.modules = modulesArr;
      }
      updatedUser.privilegioAccionMap = buildPrivilegioActionMap(updatedUser);

      const prevSnapshot = JSON.stringify({
        permisosAsignados: user?.permisosAsignados || [],
        modulesNormalized: user?.modulesNormalized || [],
        modules: user?.modules || [],
        privilegioAccionMap: user?.privilegioAccionMap || {},
      });
      const nextSnapshot = JSON.stringify({
        permisosAsignados: updatedUser?.permisosAsignados || [],
        modulesNormalized: updatedUser?.modulesNormalized || [],
        modules: updatedUser?.modules || [],
        privilegioAccionMap: updatedUser?.privilegioAccionMap || {},
      });

      lastPermissionsSyncedAtMs = Date.now();
      if (prevSnapshot !== nextSnapshot) {
        localStorage.setItem("user", JSON.stringify(updatedUser));
        window.dispatchEvent(new Event("auth-change"));
      }
      return updatedUser;
    } catch (err) {
      console.warn("[AUTH] No se pudieron refrescar permisos en vivo", err);
      return user;
    } finally {
      permissionsRefreshInFlight = null;
    }
  })();

  return permissionsRefreshInFlight;
}

export function getPermissionsSyncIntervalMs() {
  return PERMISSIONS_SYNC_INTERVAL_MS;
}

const ACTION_TO_PRIV_ID = {
  ver: 1,
  crear: 2,
  editar: 3,
  eliminar: 4,
};

const PRIV_ID_TO_ACTION = Object.entries(ACTION_TO_PRIV_ID).reduce(
  (acc, [action, id]) => {
    acc[id] = action;
    return acc;
  },
  {}
);

const PRIV_NAME_TO_ID = {
  ver: 1,
  visualizar: 1,
  view: 1,
  read: 1,
  crear: 2,
  create: 2,
  registrar: 2,
  nuevo: 2,
  editar: 3,
  edit: 3,
  actualizar: 3,
  update: 3,
  modificar: 3,
  eliminar: 4,
  delete: 4,
  borrar: 4,
};

const normalizeText = (value = "") =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const normalizeFlagKey = (value = "") =>
  normalizeText(value).replace(/[^a-z0-9]+/g, "_");

const ACTION_FLAG_ALIASES = {
  ver: [
    "ver",
    "visualizar",
    "view",
    "read",
    "puede_ver",
    "can_view",
    "can_read",
  ],
  crear: [
    "crear",
    "create",
    "registrar",
    "nuevo",
    "agregar",
    "add",
    "puede_crear",
    "can_create",
    "can_add",
  ],
  editar: [
    "editar",
    "edit",
    "actualizar",
    "update",
    "modificar",
    "puede_editar",
    "can_edit",
    "can_update",
  ],
  eliminar: [
    "eliminar",
    "delete",
    "borrar",
    "remove",
    "puede_eliminar",
    "can_delete",
    "can_remove",
  ],
};

const BOOLEAN_TRUTHY = new Set([
  "1",
  "true",
  "si",
  "yes",
  "on",
  "activo",
  "habilitado",
  "enabled",
  "allow",
  "allowed",
]);

const BOOLEAN_FALSY = new Set([
  "0",
  "false",
  "no",
  "off",
  "inactivo",
  "deshabilitado",
  "disabled",
  "deny",
  "denied",
]);

const parseBooleanLike = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (BOOLEAN_TRUTHY.has(normalized)) return true;
    if (BOOLEAN_FALSY.has(normalized)) return false;
  }
  return null;
};

const resolveActionFlagFromEntry = (entry, accionKey) => {
  if (!entry || typeof entry !== "object") return null;
  const aliases = ACTION_FLAG_ALIASES[accionKey];
  if (!Array.isArray(aliases) || aliases.length === 0) return null;

  const directLookup = {};
  Object.keys(entry).forEach((rawKey) => {
    directLookup[normalizeFlagKey(rawKey)] = entry[rawKey];
  });

  for (const alias of aliases) {
    const normalizedAlias = normalizeFlagKey(alias);
    if (Object.prototype.hasOwnProperty.call(directLookup, normalizedAlias)) {
      const parsed = parseBooleanLike(directLookup[normalizedAlias]);
      if (parsed !== null) return parsed;
    }
  }

  const nestedFlags = [entry?.acciones, entry?.permisos, entry?.privilegios];
  for (const nested of nestedFlags) {
    if (!nested || Array.isArray(nested) || typeof nested !== "object") continue;
    const nestedLookup = {};
    Object.keys(nested).forEach((rawKey) => {
      nestedLookup[normalizeFlagKey(rawKey)] = nested[rawKey];
    });
    for (const alias of aliases) {
      const normalizedAlias = normalizeFlagKey(alias);
      if (!Object.prototype.hasOwnProperty.call(nestedLookup, normalizedAlias)) {
        continue;
      }
      const parsed = parseBooleanLike(nestedLookup[normalizedAlias]);
      if (parsed !== null) return parsed;
    }
  }

  return null;
};

const toPermisoId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const getPrivilegioNumericCandidates = (value) => [
  value,
  value?.id_privilegio,
  value?.privilegio_id,
  value?.idPrivilegio,
  value?.id_accion,
  value?.accion_id,
  value?.id,
  value?.accion?.id_privilegio,
  value?.accion?.privilegio_id,
  value?.privilegio?.id_privilegio,
  value?.privilegio?.privilegio_id,
  value?.id_privilegio_privilegio?.id_privilegio,
  value?.id_accion_accion?.id_accion,
];

const getPrivilegioTextCandidates = (value) => [
  value?.accion,
  value?.accion_nombre,
  value?.nombre_accion,
  value?.privilegio,
  value?.nombre_privilegio,
  value?.name,
  value?.accion?.nombre,
  value?.accion?.name,
  value?.privilegio?.nombre,
  value?.privilegio?.name,
  typeof value === "string" ? value : "",
];

const resolveAccionFromText = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  const exact = PRIV_NAME_TO_ID[normalized];
  if (Number.isInteger(exact)) return PRIV_ID_TO_ACTION[exact] ?? null;

  if (/^(ver|visualizar|view|read)\b/.test(normalized)) return "ver";
  if (/^(crear|create|registrar|nuevo)\b/.test(normalized)) return "crear";
  if (/^(editar|edit|actualizar|update|modificar)\b/.test(normalized))
    return "editar";
  if (/^(eliminar|delete|borrar)\b/.test(normalized)) return "eliminar";

  return null;
};

const parsePrivilegioNumericId = (value) => {
  const numericCandidates = getPrivilegioNumericCandidates(value);
  for (const candidate of numericCandidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
};

const parsePrivilegioAction = (value) => {
  const textCandidates = getPrivilegioTextCandidates(value);
  for (const candidate of textCandidates) {
    const action = resolveAccionFromText(candidate);
    if (action) return action;
  }
  return null;
};

const parsePrivilegioId = (value) => {
  const action = parsePrivilegioAction(value);
  if (action) return ACTION_TO_PRIV_ID[action];
  return parsePrivilegioNumericId(value);
};

const buildPrivilegioActionMap = (user = {}) => {
  const map = {};

  const register = (entry) => {
    const id = parsePrivilegioNumericId(entry);
    const action = parsePrivilegioAction(entry);
    if (Number.isInteger(id) && action) {
      map[id] = action;
    }
  };

  const collect = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      register(item);
      if (Array.isArray(item?.acciones)) {
        item.acciones.forEach(register);
      }
      if (Array.isArray(item?.privilegios)) {
        item.privilegios.forEach(register);
      }
    });
  };

  collect(user?.permisos);
  collect(user?.modules);
  collect(user?.permisosAsignados);
  collect(user?.modulesNormalized);
  collect(user?.role?.permisos);
  collect(user?.role?.permisosAsignados);
  collect(user?.id_rol_rol?.permisos);
  collect(user?.id_rol_rol?.permisosAsignados);
  if (Array.isArray(user?.roles_usuarios)) {
    user.roles_usuarios.forEach((assignment) => {
      collect(assignment?.permisos);
      collect(assignment?.permisosAsignados);
      collect(assignment?.id_rol_rol?.permisos);
      collect(assignment?.id_rol_rol?.permisosAsignados);
    });
  }

  if (user?.privilegioAccionMap && typeof user.privilegioAccionMap === "object") {
    Object.entries(user.privilegioAccionMap).forEach(([id, action]) => {
      const idNum = Number(id);
      const actionKey = resolveAccionFromText(action);
      if (Number.isInteger(idNum) && actionKey) {
        map[idNum] = actionKey;
      }
    });
  }

  return map;
};

const dedupeNormalizedPermissionEntries = (entries = []) => {
  const result = [];
  const seen = new Set();

  entries.forEach((entry) => {
    const id_permiso = toPermisoId(
      entry?.id_permiso ?? entry?.permiso_id ?? entry?.id
    );
    if (!Number.isInteger(id_permiso)) return;

    const id_privilegio =
      parsePrivilegioNumericId(entry) ?? parsePrivilegioId(entry);
    const accion = parsePrivilegioAction(entry);
    const flags = ["ver", "crear", "editar", "eliminar"]
      .map((key) => resolveActionFlagFromEntry(entry, key))
      .map((value) => (value === null ? "" : value ? "1" : "0"))
      .join("");
    const dedupeKey = `${id_permiso}|${id_privilegio ?? ""}|${accion ?? ""}|${flags}`;

    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    result.push({
      ...(entry && typeof entry === "object" ? entry : {}),
      id_permiso,
      ...(Number.isInteger(id_privilegio) ? { id_privilegio } : {}),
      ...(accion ? { accion } : {}),
    });
  });

  return result;
};

const normalizePermissionEntriesCollection = (items = []) => {
  if (!Array.isArray(items)) return [];

  const expandedEntries = [];

  items.forEach((item) => {
    if (item == null) return;

    const inheritedPermisoId = toPermisoId(
      item?.id_permiso ?? item?.permiso_id ?? item?.id
    );

    expandPermissionEntry(item, inheritedPermisoId).forEach((entry) => {
      const normalizedEntry =
        entry && typeof entry === "object" ? { ...entry } : {};

      if (Number.isInteger(inheritedPermisoId)) {
        normalizedEntry.id_permiso = inheritedPermisoId;
      }

      const id_privilegio =
        parsePrivilegioNumericId(normalizedEntry) ??
        parsePrivilegioId(normalizedEntry);
      const accion =
        parsePrivilegioAction(normalizedEntry) ??
        resolveAccionFromText(normalizedEntry);

      if (Number.isInteger(id_privilegio)) {
        normalizedEntry.id_privilegio = id_privilegio;
      }
      if (accion) {
        normalizedEntry.accion = accion;
      }

      expandedEntries.push(normalizedEntry);
    });
  });

  return dedupeNormalizedPermissionEntries(expandedEntries);
};

// Normaliza distintas formas de payload de permisos hacia un array de { id_permiso, id_privilegio }
export function normalizePermisosPayload(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return normalizePermissionEntriesCollection(payload);
  }

  const collections = [
    payload.modules,
    payload.permisos,
    payload.permisosAsignados,
    payload.data,
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;
    const normalized = normalizePermissionEntriesCollection(collection);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

const ROUTE_PERMISO_MAP = {
  // Admin
  "/admin/usuarios": 1,
  "/admin/roles": 2,
  "/admin/productosAdmin": 3,
  "/admin/productos": 3,
  "/admin/proveedores": 4,
  "/admin/serviciosAdmin": 5,
  "/admin/servicios": 5,
  "/admin/empleados": 6,
  "/admin/programarCita": 6,
  "/admin/compras": 7,
  "/admin/pedidos": 7,
  "/admin/ventas": 8,
  "/admin/clientes": 9,
  "/admin/membresias": 10,
  "/admin/membresiasAdmin": 10,
  "/admin/seguimiento": 15,
  "/admin/seguimientoDeportivo": 15,
  "/admin/asistencias": 16,
  "/admin/ventasMembresias": 17,
  "/admin/asignarCita": 18,
  "/admin/asignarCitas": 18,
  // Empleado
  "/empleados/usuarios": 1,
  "/empleados/roles": 2,
  "/empleados/productos": 3,
  "/empleados/productosAdmin": 3,
  "/empleados/proveedores": 4,
  "/empleados/servicios": 5,
  "/empleados/empleados": 6,
  "/empleados/programarCita": 6,
  "/empleados/compras": 7,
  "/empleados/pedidos": 7,
  "/empleados/ventas": 8,
  "/empleados/clientes": 9,
  "/empleados/membresias": 10,
  "/empleados/membresiasAdmin": 10,
  "/empleados/seguimiento": 15,
  "/empleados/seguimientoDeportivo": 15,
  "/empleados/asistencias": 16,
  "/empleados/ventasMembresias": 17,
  "/empleados/asignarCita": 18,
  "/empleados/asignarCitas": 18,
  "/empleados/programarEmpleados": 6,
};

const expandPermissionEntry = (entry, inheritedPermisoId = null) => {
  if (entry == null) return [];

  const normalizedEntry =
    entry && typeof entry === "object" ? entry : { accion: entry };

  const id_permiso = toPermisoId(
    normalizedEntry?.id_permiso ??
      normalizedEntry?.permiso_id ??
      normalizedEntry?.id ??
      inheritedPermisoId
  );

  const baseEntry = {
    ...(normalizedEntry && typeof normalizedEntry === "object"
      ? normalizedEntry
      : {}),
    ...(Number.isInteger(id_permiso) ? { id_permiso } : {}),
  };

  const expanded = [baseEntry];
  const collections = [normalizedEntry?.privilegios, normalizedEntry?.acciones];

  collections.forEach((collection) => {
    if (!Array.isArray(collection)) return;
    collection.forEach((item) => {
      if (item == null) return;
      const itemAction = parsePrivilegioAction(item) || resolveAccionFromText(item);
      const itemPrivId = parsePrivilegioNumericId(item) ?? parsePrivilegioId(item);
      expanded.push({
        ...(item && typeof item === "object" ? item : {}),
        ...(Number.isInteger(id_permiso) ? { id_permiso } : {}),
        ...(itemAction ? { accion: itemAction } : {}),
        ...(Number.isInteger(itemPrivId) ? { id_privilegio: itemPrivId } : {}),
      });
    });
  });

  return expanded;
};

const pushPermissionSource = (target, source) => {
  if (!Array.isArray(source)) return;
  source.forEach((entry) => {
    target.push(...expandPermissionEntry(entry));
  });
};

function getPermisosAsignadosFromStorage() {
  try {
    const u = JSON.parse(localStorage.getItem("user")) || {};
    const collected = [];

    pushPermissionSource(collected, u?.permisosAsignados);
    pushPermissionSource(collected, u?.modulesNormalized);
    pushPermissionSource(collected, u?.modules);
    pushPermissionSource(collected, u?.permisos);
    pushPermissionSource(collected, u?.role?.permisosAsignados);
    pushPermissionSource(collected, u?.role?.permisos);
    pushPermissionSource(collected, u?.id_rol_rol?.permisosAsignados);
    pushPermissionSource(collected, u?.id_rol_rol?.permisos);

    if (Array.isArray(u?.roles_usuarios)) {
      u.roles_usuarios.forEach((assignment) => {
        pushPermissionSource(collected, assignment?.permisosAsignados);
        pushPermissionSource(collected, assignment?.permisos);
        pushPermissionSource(collected, assignment?.id_rol_rol?.permisosAsignados);
        pushPermissionSource(collected, assignment?.id_rol_rol?.permisos);
      });
    }

    const deduped = [];
    const seen = new Set();
    collected.forEach((entry) => {
      const id_permiso = toPermisoId(
        entry?.id_permiso ?? entry?.permiso_id ?? entry?.id
      );
      const id_privilegio = parsePrivilegioNumericId(entry) ?? parsePrivilegioId(entry);
      const action = parsePrivilegioAction(entry);
      const flags = ["ver", "crear", "editar", "eliminar"]
        .map((key) => resolveActionFlagFromEntry(entry, key))
        .map((value) => (value === null ? "" : value ? "1" : "0"))
        .join("");
      const key = `${id_permiso ?? ""}|${id_privilegio ?? ""}|${action ?? ""}|${flags}`;

      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(entry);
    });

    return deduped;
  } catch {
    return [];
  }
}

export function hasPermisoAccion(permisoId, accion = "ver") {
  // Si es admin, no restringir
  if (isAdmin()) return true;
  const accionKey = resolveAccionFromText(accion) || normalizeText(accion);
  if (accionKey === "ver") return true;

  const idPermisoNum = Number(permisoId);
  // Si no hay permisoId identificado: solo permitir ver.
  if (!Number.isInteger(idPermisoNum)) return accionKey === "ver";

  const idPriv = ACTION_TO_PRIV_ID[accionKey];
  if (!Number.isInteger(idPriv)) return accionKey === "ver";

  const permisos = getPermisosAsignadosFromStorage();
  const actionMapByPrivId = buildPrivilegioActionMap(getCurrentUser() || {});
  const permisosModulo = permisos.filter(
    (p) => Number(p?.id_permiso ?? p?.permiso_id ?? p?.id) === idPermisoNum
  );

  // Para "ver", si tiene el módulo aunque no traiga id_privilegio, no bloquear
  if (accionKey === "ver" && permisosModulo.length > 0) return true;

  const flagMatches = permisosModulo
    .map((p) => resolveActionFlagFromEntry(p, accionKey))
    .filter((value) => value !== null);
  if (flagMatches.includes(true)) return true;
  if (flagMatches.length > 0) return false;

  const allowedPrivIds = new Set([idPriv]);
  Object.entries(actionMapByPrivId).forEach(([idStr, action]) => {
    const idNum = Number(idStr);
    if (Number.isInteger(idNum) && action === accionKey) {
      allowedPrivIds.add(idNum);
    }
  });
  permisos.forEach((p) => {
    const action = parsePrivilegioAction(p);
    const numericId = parsePrivilegioNumericId(p);
    if (action === accionKey && Number.isInteger(numericId)) {
      allowedPrivIds.add(numericId);
    }
  });

  const hasExplicitMatch = permisosModulo.some((p) => {
    const action = parsePrivilegioAction(p);
    if (action) return action === accionKey;

    const numericId = parsePrivilegioNumericId(p);
    const mappedAction = Number.isInteger(numericId)
      ? actionMapByPrivId[numericId]
      : null;
    if (mappedAction) return mappedAction === accionKey;

    if (Number.isInteger(numericId) && allowedPrivIds.has(numericId)) {
      return true;
    }

    return parsePrivilegioId(p) === idPriv;
  });

  if (hasExplicitMatch) return true;


  return false;
}

export function buildCrudPermissionGuards(permisoId) {
  // Si es admin, permitir todo
  if (isAdmin()) {
    return {
      canView: () => true,
      canCreate: () => true,
      canEdit: () => true,
      canDelete: () => true,
    };
  }

  const id = Number(permisoId);
  // Si no se identificó permiso, permitir solo ver.
  if (!Number.isInteger(id)) {
    return {
      canView: () => true,
      canCreate: () => false,
      canEdit: () => false,
      canDelete: () => false,
    };
  }

  return {
    canView: () => hasPermisoAccion(id, "ver"),
    canCreate: () => hasPermisoAccion(id, "crear"),
    canEdit: () => hasPermisoAccion(id, "editar"),
    canDelete: () => hasPermisoAccion(id, "eliminar"),
  };
}

export function resolvePermisoIdFromPath(pathname) {
  const rawPath =
    pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  const path = String(rawPath || "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/+$/, "");
  if (!path) return null;
  if (ROUTE_PERMISO_MAP[path]) return ROUTE_PERMISO_MAP[path];
  const hit = Object.entries(ROUTE_PERMISO_MAP).find(([key]) =>
    path.startsWith(key)
  );
  return hit ? hit[1] : null;
}

export function buildCrudGuardsForPath(pathname) {
  const permisoId = resolvePermisoIdFromPath(pathname);
  return buildCrudPermissionGuards(permisoId);
}

export function canPerformActionForPath(action = "ver", pathname) {
  const path =
    pathname || (typeof window !== "undefined" ? window.location.pathname : "");
  const permisoId = resolvePermisoIdFromPath(path);
  return hasPermisoAccion(permisoId, action);
}
