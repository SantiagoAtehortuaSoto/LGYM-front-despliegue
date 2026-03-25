// src/pages/Acceder/Acceder.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  login,
  register,
  checkEmailExists,
  checkDocumentoExists,
  resendVerification,
  logout,
} from "../../hooks/Acceder_API/authService.jsx";
import useSubmitGuard from "../../../../shared/hooks/useSubmitGuard";
import Logo from "../../../../assets/LGYM_logo.png";
import Loading from "../../../../shared/components/Loading/loading";

import toast from "react-hot-toast";

import {
  IconEye,
  IconEyeOff,
  IconMail,
  IconLock,
  IconUser,
  IconPhone,
  IconId,
  IconCalendar,
  IconHeart,
} from "@tabler/icons-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const ONLY_DIGITS_RE = /^\d+$/;
const PASSWORD_SPECIAL_RE = /[^A-Za-z0-9]/;
const DOCUMENTO_MIN_LENGTH = 6;
const DOCUMENTO_MAX_LENGTH = 11;
const INACTIVE_ACCOUNT_RE =
  /(inactiv[oa]|desactivad[oa]|suspendid[oa]|bloquead[oa]|inhabilitad[oa])/i;
const REGISTRO_REQUIRED_FIELDS = [
  "nombre_usuario",
  "apellido_usuario",
  "tipo_documento",
  "documento",
  "email",
  "telefono",
  "c_emergencia",
  "n_emergencia",
  "fecha_nacimiento",
  "genero",
  "password",
  "confirmar_contraseña",
];
const MIN_BIRTHDATE_YEAR = 1900;

const formatInputDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseInputDate = (isoDate) => {
  const [y, m, d] = String(isoDate || "")
    .split("-")
    .map((part) => Number(part));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return null;
  }
  return parsed;
};

const normalizeDigits = (value, maxLen) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, maxLen);

const isInactiveStateValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value === 2;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "2") return true;

  return INACTIVE_ACCOUNT_RE.test(normalized);
};

const isUserInactive = (user) => {
  if (!user || typeof user !== "object") return false;

  const stateCandidates = [
    user.id_estado,
    user.id_estados,
    user.estado,
    user.estado_usuario,
    user.id_estado_estado,
    user.id_estado_estado?.id,
    user.id_estado_estado?.id_estado,
    user.id_estado_estado?.estado,
    user.estatus,
  ];

  return stateCandidates.some((state) => isInactiveStateValue(state));
};

const isDisabledLoginError = (error) => {
  if (!error) return false;
  if (error.code === "ACCOUNT_DISABLED") return true;

  const combined = [
    error.message,
    error.data?.msg,
    error.data?.message,
    error.data?.error,
    error.response?.data?.msg,
    error.response?.data?.message,
    error.response?.data?.error,
  ]
    .filter(Boolean)
    .join(" ");

  return INACTIVE_ACCOUNT_RE.test(combined);
};

/* ===================== Helpers de rol ===================== */
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
          typeof it === "string" || typeof it === "number"
            ? String(it)
            : typeof it === "object"
            ? it.nombre ||
              it.name ||
              it.rol ||
              it.role ||
              it.id_rol ||
              it.id ||
              it.rol_id ||
              it.roleId ||
              ""
            : ""
        )
        .filter(Boolean);
      if (names.length) return names.join("|");
    }
  }
  const objectCandidate = candidates.find(
    (x) => x && typeof x === "object" && !Array.isArray(x)
  );
  if (objectCandidate) {
    return (
      objectCandidate.nombre ||
      objectCandidate.name ||
      objectCandidate.rol ||
      objectCandidate.role ||
      objectCandidate.id_rol ||
      objectCandidate.id ||
      objectCandidate.rol_id ||
      objectCandidate.roleId ||
      ""
    );
  }
  const first = candidates.find(
    (x) => typeof x === "string" || typeof x === "number"
  );
  return first ?? "";
}

function normalizeRole(raw) {
  if (!raw) return "";
  const parts = String(raw)
    .split("|")
    .map((s) => s.trim().toLowerCase());

  const classify = (val) => {
    if (
      /(^|_|-|\s)admin(istrador)?($|_|-|\s)/.test(val) ||
      /role_admin|admin_role/.test(val)
    )
      return "admin";
    if (
      /(emplead|instructor|staff)/.test(val) ||
      /role_empleado|empleado_role/.test(val)
    )
      return "empleado";
    if (/(user|usuario|cliente|beneficiario|member|miembro)/.test(val))
      return "usuario";
    // ids típicos: 1/99 admin, 33 usuario, el resto como empleado
    if (/^\d+$/.test(val)) {
      const num = Number(val);
      if (num === 1 || num === 99) return "admin";
      if (num === 3 || num === 6 || num === 33) return "usuario";
      if (num === 2) return "empleado";
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

/* ===================== Helpers de validación ===================== */
const validateEmailSyntax = (email) => {
  const e = String(email || "").trim();
  if (!e) return "El correo electrónico es obligatorio.";
  if (!EMAIL_RE.test(e)) return "El formato del correo electrónico es inválido.";
  if (e.length > 254) return "El correo electrónico es demasiado largo.";
  return "";
};

const validatePassword = (pwd) => {
  const p = String(pwd || "");
  if (!p) return "La contraseña es obligatoria";
  if (p.length < 8) return "Mínimo 8 caracteres";
  if (!/[A-Z]/.test(p)) return "Debe incluir al menos una mayúscula";
  if (!/[a-z]/.test(p)) return "Debe incluir al menos una minúscula";
  if (!/\d/.test(p)) return "Debe incluir al menos un número";
  if (!PASSWORD_SPECIAL_RE.test(p))
    return "Debe incluir al menos un carácter especial";
  return "";
};

const validateLoginPassword = (pwd) => {
  const p = String(pwd || "");
  if (!p) return "La contraseña es obligatoria";
  return "";
};

const validateConfirmPassword = (pwd, confirm) => {
  if (!confirm) return "Confirma tu contraseña";
  if (pwd !== confirm) return "Las contraseñas no coinciden";
  return "";
};

const validateRequiredMin = (val, label, min = 2) => {
  const v = String(val || "").trim();
  if (!v) return `${label} es obligatorio`;
  if (v.length < min) return `${label} demasiado corto`;
  return "";
};

const validateSelect = (val, label) =>
  !val ? `Selecciona ${label.toLowerCase()}` : "";

const validateDigits = (val, label, minLen = 6, maxLen = 20) => {
  const v = String(val || "").trim();
  if (!v) return `${label} es obligatorio`;
  if (!ONLY_DIGITS_RE.test(v)) return `${label} debe contener solo dígitos`;
  if (v.length < minLen) return `${label} demasiado corto`;
  if (v.length > maxLen) return `${label} demasiado largo`;
  return "";
};

const validatePhone = (val, label = "Teléfono") => {
  const v = String(val || "").trim();
  if (!v) return `${label} es obligatorio`;
  if (!ONLY_DIGITS_RE.test(v)) return `${label} debe contener solo dígitos`;
  if (v.length !== 10) return `${label} debe tener 10 dígitos`;
  return "";
};

const validateBirthdate = (isoDate) => {
  if (!isoDate) return "Fecha de nacimiento es obligatoria";
  const d = parseInputDate(isoDate);
  if (!d) return "Fecha inválida";
  const today = new Date();
  const oldestAllowed = new Date(MIN_BIRTHDATE_YEAR, 0, 1);
  if (d < oldestAllowed)
    return `La fecha no puede ser anterior a ${MIN_BIRTHDATE_YEAR}`;
  if (d > today) return "La fecha no puede ser futura";
  const min = new Date(
    today.getFullYear() - 14,
    today.getMonth(),
    today.getDate()
  );
  if (d > min) return "Debes tener al menos 14 años";
  return "";
};

const Acceder = () => {
  const { runGuardedSubmit } = useSubmitGuard();
  const [mostrarClave, setMostrarClave] = useState(false);
  const [modo, setModo] = useState("login");
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre_usuario: "",
    apellido_usuario: "",
    tipo_documento: "",
    documento: "",
    email: "",
    telefono: "",
    c_emergencia: "",
    n_emergencia: "",
    fecha_nacimiento: "",
    genero: "",
    enfermedades: "",
    password: "",
    confirmar_contraseña: "",
  });

  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const formRef = useRef(null);

  // Email live check
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(undefined);
  const emailAbortRef = useRef(null);
  const emailDebounceRef = useRef(null);

  // Documento live check
  const [documentoChecking, setDocumentoChecking] = useState(false);
  const [documentoExists, setDocumentoExists] = useState(undefined);
  const documentoAbortRef = useRef(null);
  const documentoDebounceRef = useRef(null);

  // Redirección si ya hay sesión
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return;
      const u = JSON.parse(raw);
      const role = normalizeRole(extractRawRole(u));
      const isAdmin = role === "admin";
      const isCliente = role === "usuario";

      if (isAdmin) navigate("/admin/dashboard", { replace: true });
      else if (isCliente)
        navigate("/cliente/dashboard-usuario", { replace: true });
      else navigate("/empleados/dashboardEmpleado", { replace: true });
    } catch {
      /* noop */
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let nextValue = value;
    const isPhoneField = name === "telefono" || name === "c_emergencia";
    const isDocumentoField = name === "documento";

    if (isPhoneField) {
      nextValue = normalizeDigits(value, 10);
    } else if (isDocumentoField) {
      nextValue = normalizeDigits(value, DOCUMENTO_MAX_LENGTH);
    }

    setFormData((prev) => ({ ...prev, [name]: nextValue }));

    if (modo === "registro") {
      setErrors((prev) => {
        const next = { ...prev, [name]: fieldError(name, nextValue) };

        // confirmación para feedback inmediato
        if (
          name === "password" &&
          (formData.confirmar_contraseña ?? "") !== ""
        ) {
          next.confirmar_contraseña = validateConfirmPassword(
            value,
            formData.confirmar_contraseña
          );
        }
        return next;
      });

      // Email: verificación
      if (name === "email") {
        setEmailExists(undefined);
        const synErr = validateEmailSyntax(nextValue);
        if (synErr) {
          setEmailChecking(false);
          clearTimeout(emailDebounceRef.current);
          if (emailAbortRef.current) {
            emailAbortRef.current.abort();
            emailAbortRef.current = null;
          }
        } else {
          setEmailChecking(true);
          clearTimeout(emailDebounceRef.current);
          emailDebounceRef.current = setTimeout(() => {
            void checkEmailLive(nextValue);
          }, 400);
        }
      }

      // Documento: verificación
      if (name === "documento") {
        setDocumentoExists(undefined);
        const docErr = validateDigits(
          nextValue,
          "Número de documento",
          DOCUMENTO_MIN_LENGTH,
          DOCUMENTO_MAX_LENGTH
        );
        if (docErr) {
          setDocumentoChecking(false);
          clearTimeout(documentoDebounceRef.current);
          if (documentoAbortRef.current) {
            documentoAbortRef.current.abort();
            documentoAbortRef.current = null;
          }
        } else {
          setDocumentoChecking(true);
          clearTimeout(documentoDebounceRef.current);
          documentoDebounceRef.current = setTimeout(() => {
            void checkDocumentoLive(nextValue);
          }, 400);
        }
      }
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
  };

  const fieldError = useCallback(
    (name, value) => {
      switch (name) {
        case "nombre_usuario":
          return validateRequiredMin(value, "Nombre");
        case "apellido_usuario":
          return validateRequiredMin(value, "Apellido");
        case "tipo_documento":
          return validateSelect(value, "Tipo de Documento");
        case "documento":
          return validateDigits(
            value,
            "Número de documento",
            DOCUMENTO_MIN_LENGTH,
            DOCUMENTO_MAX_LENGTH
          );
        case "telefono":
          return validatePhone(value, "Teléfono");
        case "n_emergencia":
          return validateRequiredMin(
            value,
            "Nombre de contacto de emergencia",
            3
          );
        case "c_emergencia":
          return validatePhone(value, "Teléfono de emergencia");
        case "fecha_nacimiento":
          return validateBirthdate(value);
        case "genero":
          return validateSelect(value, "Género");
        case "email":
          return validateEmailSyntax(value);
        case "password":
          return validatePassword(value);
        case "confirmar_contraseña":
          return validateConfirmPassword(formData.password, value);
        default:
          return "";
      }
    },
    [formData.password]
  );

  const validateAll = useMemo(() => {
    if (modo !== "registro") return () => ({});
    return () => {
      const newErrors = {};
      Object.entries(formData).forEach(([k, v]) => {
        if (k === "enfermedades") return;
        const err = fieldError(k, v);
        if (err) newErrors[k] = err;
      });
      if (!newErrors.email && emailExists === true) {
        newErrors.email = "Este email ya está registrado";
      }
      if (!newErrors.documento && documentoExists === true) {
        newErrors.documento = "Este documento ya está registrado";
      }
      return newErrors;
    };
  }, [formData, modo, emailExists, documentoExists, fieldError]);

  const checkEmailLive = async (email) => {
    if (emailAbortRef.current) emailAbortRef.current.abort();
    const ctrl = new AbortController();
    emailAbortRef.current = ctrl;

    try {
      const res = await checkEmailExists(String(email).trim().toLowerCase(), {
        signal: ctrl.signal,
      });
      const exists =
        res.exists ??
        res.isTaken ??
        ((res.available === false) ||
          (typeof res.msg === "string" &&
            /registrad|existe/i.test(res.msg)));
      setEmailExists(Boolean(exists));
    } catch (err) {
      if (err?.name === "AbortError") return;
      setEmailExists(undefined);
    } finally {
      setEmailChecking(false);
      emailAbortRef.current = null;
    }
  };

  const checkDocumentoLive = async (documento) => {
    if (documentoAbortRef.current) documentoAbortRef.current.abort();
    const ctrl = new AbortController();
    documentoAbortRef.current = ctrl;

    try {
      const res = await checkDocumentoExists(String(documento).trim(), {
        signal: ctrl.signal,
      });
      const exists =
        res.exists ??
        res.isTaken ??
        ((res.available === false) ||
          (typeof res.msg === "string" &&
            /registrad|existe|ocupad|no\s*disponible|ya\s*usad/i.test(
              res.msg
            )));
      setDocumentoExists(Boolean(exists));
    } catch (err) {
      if (err?.name === "AbortError") return;
      setDocumentoExists(undefined);
    } finally {
      setDocumentoChecking(false);
      documentoAbortRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimeout(emailDebounceRef.current);
      if (emailAbortRef.current) emailAbortRef.current.abort();

      clearTimeout(documentoDebounceRef.current);
      if (documentoAbortRef.current) documentoAbortRef.current.abort();
    };
  }, []);

  const toastSuccess = (msg) => toast.success(msg);
  const toastError = (msg) => toast.error(msg);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await runGuardedSubmit(async () => {
      setLoading(true);

      try {
      if (modo === "registro") {
        const all = validateAll();
        setErrors(all);
        setTouched(
          Object.keys(formData).reduce((acc, k) => ({ ...acc, [k]: true }), {})
        );

        const hasErrors = Object.keys(all).length > 0;
        if (
          hasErrors ||
          emailChecking ||
          emailExists === true ||
          documentoChecking ||
          documentoExists === true
        ) {
          focusFirstErrorField(all);
          return;
        }

        const emailNormalizado = formData.email.trim().toLowerCase();

        await register(
          formData.nombre_usuario.trim(),
          formData.apellido_usuario.trim(),
          formData.tipo_documento,
          formData.documento.trim(),
          emailNormalizado,
          formData.telefono.trim(),
          formData.c_emergencia.trim(),
          formData.n_emergencia.trim(),
          formData.fecha_nacimiento,
          formData.genero,
          formData.enfermedades?.trim() || "",
          formData.password
        );

        toastSuccess(
          "Registro exitoso. Te enviamos un código de verificación a tu correo electrónico. Revisa tu bandeja de entrada."
        );

        setModo("login");
        setFormData({
          nombre_usuario: "",
          apellido_usuario: "",
          tipo_documento: "",
          documento: "",
          email: "",
          telefono: "",
          c_emergencia: "",
          n_emergencia: "",
          fecha_nacimiento: "",
          genero: "",
          enfermedades: "",
          password: "",
          confirmar_contraseña: "",
        });
        setErrors({});
        setTouched({});
        setEmailExists(undefined);
        setDocumentoExists(undefined);

        navigate("/verificar-cuenta", {
          replace: true,
          state: { email: emailNormalizado },
        });
      } else {
        // LOGIN
        const emailErr = validateEmailSyntax(formData.email);
        const passErr = validateLoginPassword(formData.password);
        setErrors((prev) => ({ ...prev, email: emailErr, password: passErr }));
        setTouched((t) => ({ ...t, email: true, password: true }));

        if (emailErr || passErr) {
          focusFirstErrorField({ email: emailErr, password: passErr });
          return;
        }

        const emailNormalizado = formData.email.trim().toLowerCase();

        const { user } = await login(emailNormalizado, formData.password);
        if (isUserInactive(user)) {
          logout();
          toastError("Tu cuenta está desactivada. Comunícate con el administrador.");
          return;
        }

        toastSuccess(
          "Inicio de sesión exitoso. Tus credenciales fueron validadas y ya ingresaste a tu cuenta."
        );

        const role = normalizeRole(extractRawRole(user));
        const isAdmin = role === "admin";
        const isCliente = role === "usuario";

        if (isAdmin) {
          navigate("/admin/dashboard");
        } else if (isCliente) {
          navigate("/cliente/dashboard-usuario");
        } else {
          navigate("/empleados/dashboardEmpleado");
        }
      }
      } catch (error) {
        // 👇 Manejo especial: cuenta no verificada
        if (
          modo === "login" &&
          (error.code === "EMAIL_NOT_VERIFIED" ||
            /verificaci[oó]n/i.test(error.message || ""))
        ) {
          const emailNormalizado = formData.email.trim().toLowerCase();

          // (Opcional) Reenviar el código de verificación automáticamente
          try {
            await resendVerification(emailNormalizado);
          } catch {
            // Si falla, igual continuamos con la redirección
          }

          toastError(
            "Tu cuenta aún no está verificada. Te enviamos un nuevo código a tu correo."
          );

          navigate("/verificar-cuenta", {
            replace: true,
            state: { email: emailNormalizado },
          });
        } else if (modo === "login" && isDisabledLoginError(error)) {
          toastError("Tu cuenta está desactivada. Comunícate con el administrador.");
        } else if (modo === "login") {
          const detalle =
            error?.message && String(error.message).trim()
              ? ` Detalle: ${String(error.message).trim()}`
              : "";
          toastError(
            `Inicio de sesión fallido. No fue posible ingresar con los datos enviados y tu sesión no se abrió.${detalle}`
          );
        } else {
          toastError(error.message || "Ocurrió un error inesperado.");
        }
      } finally {
        setLoading(false);
      }
    });
  };

  const emailHelp = useMemo(() => {
    if (modo !== "registro") return null;
    const synErr = fieldError("email", formData.email);
    if (synErr) return { type: "error", text: synErr };
    if (emailChecking)
      return { type: "info", text: "Verificando disponibilidad…" };
    if (emailExists === true)
      return { type: "error", text: "Este email ya está registrado" };
    if (emailExists === false) return { type: "ok", text: "Email disponible" };
    return null;
  }, [modo, formData.email, emailChecking, emailExists, fieldError]);

  const documentoHelp = useMemo(() => {
    if (modo !== "registro") return null;
    const docErr = fieldError("documento", formData.documento);
    if (docErr) return { type: "error", text: docErr };
    if (documentoChecking)
      return { type: "info", text: "Verificando disponibilidad…" };
    if (documentoExists === true)
      return { type: "error", text: "Este documento ya está registrado" };
    if (documentoExists === false)
      return { type: "ok", text: "Documento disponible" };
    return null;
  }, [modo, formData.documento, documentoChecking, documentoExists, fieldError]);

  const birthdateLimits = useMemo(() => {
    const today = new Date();
    const maxBirthdate = new Date(
      today.getFullYear() - 14,
      today.getMonth(),
      today.getDate()
    );
    const minBirthdate = new Date(MIN_BIRTHDATE_YEAR, 0, 1);
    return {
      min: formatInputDate(minBirthdate),
      max: formatInputDate(maxBirthdate),
    };
  }, []);

  const isRegisterSubmitDisabled = useMemo(() => {
    if (modo !== "registro") return false;
    return loading;
  }, [loading, modo]);

  const showError = (name) => {
    const err = errors[name];
    return (touched[name] || modo === "registro") && err;
  };

  const focusFirstErrorField = useCallback((nextErrors = {}) => {
    if (!nextErrors || typeof window === "undefined") return;

    const orderedFields = [
      ...REGISTRO_REQUIRED_FIELDS,
      "email",
      "password",
      "tipo_documento",
      "genero",
    ];

    const firstFieldName = orderedFields.find((fieldName) => nextErrors[fieldName]);
    if (!firstFieldName) return;

    window.requestAnimationFrame(() => {
      const formElement = formRef.current;
      if (!formElement) return;

      const field = formElement.querySelector(`[name="${firstFieldName}"]`);
      if (!field) return;

      field.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (typeof field.focus === "function") {
        field.focus({ preventScroll: true });
      }
    });
  }, []);

  useEffect(() => {
    clearTimeout(emailDebounceRef.current);
    if (emailAbortRef.current) emailAbortRef.current.abort();
    setEmailChecking(false);
    setEmailExists(undefined);

    clearTimeout(documentoDebounceRef.current);
    if (documentoAbortRef.current) documentoAbortRef.current.abort();
    setDocumentoChecking(false);
    setDocumentoExists(undefined);
  }, [modo]);

  return (
    <>
      {loading && <Loading mensaje="Procesando tu solicitud..." />}

      <div
        className={`contenedor-login ${
          modo === "registro" ? "registro-activo" : ""
        }`}
      >
        <div className="login-formulario">
          <div className="form-contenedor">
            <div className="logo-acceder">
              <img src={Logo} alt="Logo Nueva Era Fitness" />
            </div>

            <h2 className="titulo">
              {modo === "login" ? "¡Bienvenido!" : "¡Crea tu cuenta!"}
            </h2>
            <p className="subtitulo">
              {modo === "login"
                ? "Accede con tus credenciales para continuar"
                : "Completa tus datos para unirte a Nueva Era Fitness"}
            </p>

            <form
              className="register"
              onSubmit={handleSubmit}
              noValidate
              ref={formRef}
            >
              {modo === "registro" ? (
                <div className="grid-registro">
                  {/* FILA 1: Email | Documento | Tipo doc */}
                  <div
                    className={`campo campo-email ${
                      showError("email") || emailExists === true
                        ? "con-error"
                        : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconMail /> <label>Email</label>
                    </div>
                    <input
                      type="email"
                      name="email"
                      placeholder="Tu correo"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      aria-invalid={Boolean(
                        showError("email") || emailExists === true
                      )}
                      aria-describedby="email-help"
                    />
                    {emailHelp && (
                      <small
                        id="email-help"
                        className={`mensaje-${
                          emailHelp.type === "ok"
                            ? "ok"
                            : emailHelp.type === "info"
                            ? "info"
                            : "error"
                        }`}
                      >
                        {emailHelp.text}
                      </small>
                    )}
                  </div>

                  <div
                    className={`campo ${
                      showError("documento") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconId /> <label>Número de documento</label>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      minLength={DOCUMENTO_MIN_LENGTH}
                      maxLength={DOCUMENTO_MAX_LENGTH}
                      name="documento"
                      placeholder="Número de documento"
                      value={formData.documento}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                      aria-invalid={Boolean(
                        showError("documento") || documentoExists === true
                      )}
                      aria-describedby="documento-help"
                    />
                    {documentoHelp && (
                      <small
                        id="documento-help"
                        className={`mensaje-${
                          documentoHelp.type === "ok"
                            ? "ok"
                            : documentoHelp.type === "info"
                            ? "info"
                            : "error"
                        }`}
                      >
                        {documentoHelp.text}
                      </small>
                    )}
                  </div>

                  <div
                    className={`campo ${
                      showError("tipo_documento") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconId /> <label>Tipo de Documento</label>
                    </div>
                    <select
                      name="tipo_documento"
                      value={formData.tipo_documento}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    >
                      <option value="">Selecciona</option>
                      <option value="CC">Cédula de ciudadanía</option>
                      <option value="TI">Tarjeta de identidad</option>
                      <option value="CE">Cédula de extranjería</option>
                      <option value="PA">Pasaporte</option>
                    </select>
                    {showError("tipo_documento") && (
                      <small className="mensaje-error">
                        {errors.tipo_documento}
                      </small>
                    )}
                  </div>

                  {/* FILA 2: Nombre | Apellido | Teléfono */}
                  <div
                    className={`campo ${
                      showError("nombre_usuario") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconUser /> <label>Nombre</label>
                    </div>
                    <input
                      type="text"
                      name="nombre_usuario"
                      placeholder="Tu nombre"
                      value={formData.nombre_usuario}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("nombre_usuario") && (
                      <small className="mensaje-error">
                        {errors.nombre_usuario}
                      </small>
                    )}
                  </div>

                  <div
                    className={`campo ${
                      showError("apellido_usuario") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconUser /> <label>Apellido</label>
                    </div>
                    <input
                      type="text"
                      name="apellido_usuario"
                      placeholder="Tu apellido"
                      value={formData.apellido_usuario}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("apellido_usuario") && (
                      <small className="mensaje-error">
                        {errors.apellido_usuario}
                      </small>
                    )}
                  </div>

                  <div
                    className={`campo ${
                      showError("telefono") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconPhone /> <label>Teléfono</label>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      name="telefono"
                      placeholder="Tu número de celular"
                      value={formData.telefono}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("telefono") && (
                      <small className="mensaje-error">{errors.telefono}</small>
                    )}
                  </div>

                  {/* FILA 3: Nombre emergencia | Tel emergencia | Fecha */}
                  <div
                    className={`campo ${
                      showError("n_emergencia") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconPhone /> <label>Nombre contacto de emergencia</label>
                    </div>
                    <input
                      type="text"
                      name="n_emergencia"
                      placeholder="Ej. Maria Rodriguez"
                      value={formData.n_emergencia}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("n_emergencia") && (
                      <small className="mensaje-error">
                        {errors.n_emergencia}
                      </small>
                    )}
                  </div>

                  <div
                    className={`campo ${
                      showError("c_emergencia") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconPhone /> <label>Teléfono de emergencia</label>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={10}
                      name="c_emergencia"
                      placeholder="Ej. 3007654321"
                      value={formData.c_emergencia}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("c_emergencia") && (
                      <small className="mensaje-error">
                        {errors.c_emergencia}
                      </small>
                    )}
                  </div>

                  <div
                    className={`campo ${
                      showError("fecha_nacimiento") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconCalendar /> <label>Fecha de nacimiento</label>
                    </div>
                    <input
                      type="date"
                      name="fecha_nacimiento"
                      value={formData.fecha_nacimiento}
                      min={birthdateLimits.min}
                      max={birthdateLimits.max}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("fecha_nacimiento") && (
                      <small className="mensaje-error">
                        {errors.fecha_nacimiento}
                      </small>
                    )}
                  </div>

                  {/* FILA 4: Género | Password | Confirmar */}
                  <div
                    className={`campo ${
                      showError("genero") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconUser /> <label>Género</label>
                    </div>
                    <select
                      name="genero"
                      value={formData.genero}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    >
                      <option value="">Selecciona</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Femenino">Femenino</option>
                    </select>
                    {showError("genero") && (
                      <small className="mensaje-error">{errors.genero}</small>
                    )}
                  </div>

                  <div
                    className={`campo campo-password ${
                      showError("password") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconLock /> <label>Contraseña</label>
                    </div>
                    <div className="input-icono">
                      <input
                        type={mostrarClave ? "text" : "password"}
                        name="password"
                        placeholder="********"
                        minLength={8}
                        pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+"
                        title="Mínimo 8 caracteres, con mayuscula, minuscula, número y caracter especial"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                      />
                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setMostrarClave(!mostrarClave)}
                        aria-label={
                          mostrarClave
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                      >
                        {mostrarClave ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>
                    {showError("password") && (
                      <small className="mensaje-error">{errors.password}</small>
                    )}
                  </div>

                  <div
                    className={`campo campo-confirmar ${
                      showError("confirmar_contraseña") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconLock /> <label>Confirmar password</label>
                    </div>
                    <input
                      type={mostrarClave ? "text" : "password"}
                      name="confirmar_contraseña"
                      placeholder="********"
                      minLength={8}
                      value={formData.confirmar_contraseña}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("confirmar_contraseña") && (
                      <small className="mensaje-error">
                        {errors.confirmar_contraseña}
                      </small>
                    )}
                  </div>

                  {/* FILA 5: Enfermedades */}
                  <div className="campo campo-enfermedad">
                    <div className="grupo-label">
                      <IconHeart />{" "}
                      <label>Enfermedades o condiciones médicas</label>
                    </div>
                    <textarea
                      className="campo-control-acceder"
                      name="enfermedades"
                      placeholder="Ej. Ninguna"
                      value={formData.enfermedades}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* LOGIN */}
                  <div
                    className={`campo campo-email ${
                      showError("email") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconMail /> <label>Email</label>
                    </div>
                    <input
                      type="email"
                      name="email"
                      placeholder="Tu correo"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      required
                    />
                    {showError("email") && (
                      <small className="mensaje-error">{errors.email}</small>
                    )}
                  </div>

                  <div
                    className={`campo campo-password ${
                      showError("password") ? "con-error" : ""
                    }`}
                  >
                    <div className="grupo-label">
                      <IconLock /> <label>Contraseña</label>
                    </div>
                    <div className="input-icono">
                      <input
                        type={mostrarClave ? "text" : "password"}
                        name="password"
                        placeholder="********"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                      />
                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setMostrarClave(!mostrarClave)}
                      >
                        {mostrarClave ? <IconEyeOff /> : <IconEye />}
                      </button>
                    </div>

                    <Link to="/olvidar-contrasena" className="olvido">
                      ¿Olvidaste tu contraseña?
                    </Link>
                    {showError("password") && (
                      <small className="mensaje-error">{errors.password}</small>
                    )}
                  </div>
                </>
              )}

              <div className="acciones">
                <button
                  type="submit"
                  className="boton-login"
                  disabled={
                    loading || (modo === "registro" && isRegisterSubmitDisabled)
                  }
                >
                  {loading
                    ? "Procesando..."
                    : modo === "login"
                    ? "Iniciar Sesión"
                    : "Registrarse"}
                </button>
              </div>

              <p className="registro">
                {modo === "login" ? (
                  <>
                    ¿No tienes cuenta?{" "}
                    <span
                      onClick={() => {
                        setModo("registro");
                        setErrors({});
                        setTouched({});
                      }}
                    >
                      Regístrate aquí
                    </span>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta?{" "}
                    <span
                      onClick={() => {
                        setModo("login");
                        setErrors({});
                        setTouched({});
                        setEmailExists(undefined);
                        setEmailChecking(false);
                        setDocumentoExists(undefined);
                        setDocumentoChecking(false);
                      }}
                    >
                      Inicia sesión
                    </span>
                  </>
                )}
              </p>

              <Link to="/" className="volver">
                ← Volver al inicio
              </Link>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Acceder;
