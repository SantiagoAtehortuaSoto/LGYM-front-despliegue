// ConfiguraciónUsuario.jsx
import { useEffect, useState } from "react";
import { IconNut } from "@tabler/icons-react";
import {
  getUserConfig,
  updateUserConfig,
} from "../../../features/dashboard/hooks/Configuraciones_API/Config_API.jsx";
import useSubmitGuard from "../../hooks/useSubmitGuard";

const DOCUMENTO_MIN_LENGTH = 6;
const DOCUMENTO_MAX_LENGTH = 11;
const PHONE_LENGTH = 10;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;
const MAX_TEXT_LENGTH = 80;
const MAX_MEDICAL_NOTES_LENGTH = 200;
const MIN_AGE = 14;
const STRONG_PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñ' -]+$/;

const normalizarTexto = (value = "") => String(value ?? "").trim();

const esFechaNacimientoValida = (value) => {
  if (!value) return false;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const calcularEdad = (value) => {
  if (!esFechaNacimientoValida(value)) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
};

export default function ConfiguracionUsuario() {
  const { runGuardedSubmit } = useSubmitGuard();
  const [form, setForm] = useState({
    nombre_usuario: "",
    apellido_usuario: "",
    tipo_documento: "",
    documento: "",
    fecha_nacimiento: "",
    genero: "",
    email: "",
    telefono: "",
    c_emergencia: "",
    n_emergencia: "",
    enfermedades: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const validateConfigForm = (data) => {
    const nextErrors = {};
    const nombre = normalizarTexto(data.nombre_usuario);
    const apellido = normalizarTexto(data.apellido_usuario);
    const tipoDocumento = normalizarTexto(data.tipo_documento);
    const documentoDigits = String(data.documento || "").replace(/\D/g, "");
    const fechaNacimiento = normalizarTexto(data.fecha_nacimiento);
    const genero = normalizarTexto(data.genero);
    const email = normalizarTexto(data.email);
    const telefono = String(data.telefono || "").replace(/\D/g, "");
    const nombreEmergencia = normalizarTexto(data.n_emergencia);
    const telefonoEmergencia = String(data.c_emergencia || "").replace(/\D/g, "");
    const enfermedades = normalizarTexto(data.enfermedades);

    if (!nombre) {
      nextErrors.nombre_usuario = "El nombre es obligatorio";
    } else if (nombre.length < MIN_NAME_LENGTH) {
      nextErrors.nombre_usuario = "Debe tener al menos 2 caracteres";
    } else if (nombre.length > MAX_NAME_LENGTH) {
      nextErrors.nombre_usuario = "No puede superar 60 caracteres";
    } else if (!NAME_REGEX.test(nombre)) {
      nextErrors.nombre_usuario = "Solo se permiten letras y espacios";
    }

    if (!apellido) {
      nextErrors.apellido_usuario = "El apellido es obligatorio";
    } else if (apellido.length < MIN_NAME_LENGTH) {
      nextErrors.apellido_usuario = "Debe tener al menos 2 caracteres";
    } else if (apellido.length > MAX_NAME_LENGTH) {
      nextErrors.apellido_usuario = "No puede superar 60 caracteres";
    } else if (!NAME_REGEX.test(apellido)) {
      nextErrors.apellido_usuario = "Solo se permiten letras y espacios";
    }

    if (!tipoDocumento) {
      nextErrors.tipo_documento = "El tipo de documento es obligatorio";
    } else if (tipoDocumento.length > 20) {
      nextErrors.tipo_documento = "No puede superar 20 caracteres";
    }

    if (!documentoDigits) {
      nextErrors.documento = "El documento es obligatorio";
    } else if (
      documentoDigits.length < DOCUMENTO_MIN_LENGTH ||
      documentoDigits.length > DOCUMENTO_MAX_LENGTH
    ) {
      nextErrors.documento = "Debe tener entre 6 y 11 dígitos";
    }

    if (!fechaNacimiento) {
      nextErrors.fecha_nacimiento = "La fecha de nacimiento es obligatoria";
    } else if (!esFechaNacimientoValida(fechaNacimiento)) {
      nextErrors.fecha_nacimiento = "Debe ingresar una fecha válida";
    } else {
      const [year] = fechaNacimiento.split("-").map(Number);
      const today = new Date();
      const age = calcularEdad(fechaNacimiento);
      if (year < 1900) {
        nextErrors.fecha_nacimiento = "La fecha no puede ser anterior a 1900";
      } else if (new Date(fechaNacimiento) > today) {
        nextErrors.fecha_nacimiento = "La fecha no puede ser futura";
      } else if (age !== null && age < MIN_AGE) {
        nextErrors.fecha_nacimiento = "Debes tener al menos 14 años";
      }
    }

    if (!genero) {
      nextErrors.genero = "El género es obligatorio";
    } else if (genero.length > 30) {
      nextErrors.genero = "No puede superar 30 caracteres";
    }

    if (!email) {
      nextErrors.email = "El correo es obligatorio";
    } else if (!EMAIL_REGEX.test(email)) {
      nextErrors.email = "Debe ingresar un correo válido";
    }

    if (!telefono) {
      nextErrors.telefono = "El teléfono es obligatorio";
    } else if (telefono.length !== PHONE_LENGTH) {
      nextErrors.telefono = "Debe tener 10 dígitos";
    }

    if (!nombreEmergencia) {
      nextErrors.n_emergencia = "El contacto de emergencia es obligatorio";
    } else if (nombreEmergencia.length < MIN_NAME_LENGTH) {
      nextErrors.n_emergencia = "Debe tener al menos 2 caracteres";
    } else if (nombreEmergencia.length > MAX_TEXT_LENGTH) {
      nextErrors.n_emergencia = "No puede superar 80 caracteres";
    }

    if (!telefonoEmergencia) {
      nextErrors.c_emergencia = "El teléfono de emergencia es obligatorio";
    } else if (telefonoEmergencia.length !== PHONE_LENGTH) {
      nextErrors.c_emergencia = "Debe tener 10 dígitos";
    } else if (telefonoEmergencia === telefono && telefono) {
      nextErrors.c_emergencia = "Debe ser diferente al teléfono principal";
    }

    if (enfermedades.length > MAX_MEDICAL_NOTES_LENGTH) {
      nextErrors.enfermedades = "No puede superar 200 caracteres";
    }

    if (data.password && !STRONG_PASSWORD_RE.test(data.password)) {
      nextErrors.password =
        "Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo";
    }

    if (data.confirmPassword && !data.password) {
      nextErrors.confirmPassword = "Ingresa primero la nueva contraseña";
    } else if (data.password && !data.confirmPassword) {
      nextErrors.confirmPassword = "Confirma la nueva contraseña";
    } else if (data.password && data.password !== data.confirmPassword) {
      nextErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    return nextErrors;
  };

  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getUserConfig();
        setForm((prev) => ({
          ...prev,
          nombre_usuario: data.nombre_usuario || data.nombre || "",
          apellido_usuario: data.apellido_usuario || data.apellido || "",
          tipo_documento: data.tipo_documento || "",
          documento: data.documento || "",
          fecha_nacimiento: data.fecha_nacimiento || "",
          genero: data.genero || "",
          email: data.email || "",
          telefono: data.telefono || "",
          c_emergencia: data.c_emergencia || "",
          n_emergencia: data.n_emergencia || "",
          enfermedades: data.enfermedades || "",
          password: "",
          confirmPassword: "",
        }));
      } catch (e) {
        console.error(e);
        setError(e.message || "Error al cargar la configuración.");
      } finally {
        setInitialLoading(false);
      }
    };

    cargar();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const normalizedValue =
      name === "documento"
        ? String(value).replace(/\D/g, "").slice(0, DOCUMENTO_MAX_LENGTH)
        : name === "telefono" || name === "c_emergencia"
          ? String(value).replace(/\D/g, "").slice(0, PHONE_LENGTH)
        : value;
    const nextForm = { ...form, [name]: normalizedValue };
    setForm(nextForm);
    setFieldErrors(validateConfigForm(nextForm));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");
    const nextErrors = validateConfigForm(form);
    const documentoDigits = String(form.documento || "").replace(/\D/g, "");
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await runGuardedSubmit(async () => {
      setLoading(true);
      try {
        await updateUserConfig(null, { ...form, documento: documentoDigits });
        setMensaje("Configuración actualizada correctamente.");
        setForm((prev) => ({ ...prev, password: "", confirmPassword: "" }));
        setFieldErrors({});
      } catch (e) {
        console.error(e);
        setError(e.message || "Error al actualizar la configuración.");
      } finally {
        setLoading(false);
      }
    });
  };

  if (initialLoading) {
    return (
      <div className="config-page">
        <div className="config-card">
          <div className="config-loader" />
          <p className="config-loader-text">Cargando tu configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="config-page">
      <div className="config-card">
        <header className="config-title-row">
          <IconNut size={38} color="#e41000" />
          <div className="config-title-stack">
            <h1 className="config-title">Configuración de cuenta</h1>
            <p className="config-subtitle">
              Actualiza tus datos personales, contacto, emergencias y seguridad.
            </p>
          </div>
        </header>

        {mensaje && <div className="config-alert success">{mensaje}</div>}
        {error && <div className="config-alert error">{error}</div>}

        <form className="config-form" onSubmit={handleSubmit} noValidate>
          <div className="config-section">
            <div className="section-header">
              <h2 className="config-section-title">Información personal</h2>
              <span className="section-chip">Perfil</span>
            </div>
            <div className="config-grid">
              <div className="form-group">
                <label htmlFor="nombre_usuario">Nombre</label>
                <input
                  id="nombre_usuario"
                  name="nombre_usuario"
                  type="text"
                  placeholder="Tu nombre"
                  value={form.nombre_usuario}
                  onChange={handleChange}
                  className={fieldErrors.nombre_usuario ? "input-error" : ""}
                />
                {fieldErrors.nombre_usuario ? (
                  <small className="error-message">{fieldErrors.nombre_usuario}</small>
                ) : null}
              </div>
              <div className="form-group">
                <label htmlFor="apellido_usuario">Apellido</label>
                <input
                  id="apellido_usuario"
                  name="apellido_usuario"
                  type="text"
                  placeholder="Tu apellido"
                  value={form.apellido_usuario}
                  onChange={handleChange}
                  className={fieldErrors.apellido_usuario ? "input-error" : ""}
                />
                {fieldErrors.apellido_usuario ? (
                  <small className="error-message">{fieldErrors.apellido_usuario}</small>
                ) : null}
              </div>
            </div>

            <div className="config-grid">
              <div className="form-group">
                <label htmlFor="tipo_documento">Tipo de documento</label>
                <input
                  id="tipo_documento"
                  name="tipo_documento"
                  type="text"
                  placeholder="CC, CE, Pasaporte..."
                  value={form.tipo_documento}
                  onChange={handleChange}
                  className={fieldErrors.tipo_documento ? "input-error" : ""}
                />
                {fieldErrors.tipo_documento ? (
                  <small className="error-message">{fieldErrors.tipo_documento}</small>
                ) : null}
              </div>
              <div className="form-group">
                <label htmlFor="documento">Número de documento</label>
                <input
                  id="documento"
                  name="documento"
                  type="text"
                  placeholder="1234567890"
                  value={form.documento}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={DOCUMENTO_MAX_LENGTH}
                  className={fieldErrors.documento ? "input-error" : ""}
                />
                {fieldErrors.documento ? (
                  <small className="error-message">{fieldErrors.documento}</small>
                ) : null}
              </div>
            </div>

            <div className="config-grid">
              <div className="form-group">
                <label htmlFor="fecha_nacimiento">Fecha de nacimiento</label>
                <input
                  id="fecha_nacimiento"
                  name="fecha_nacimiento"
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={handleChange}
                  className={fieldErrors.fecha_nacimiento ? "input-error" : ""}
                />
                {fieldErrors.fecha_nacimiento ? (
                  <small className="error-message">{fieldErrors.fecha_nacimiento}</small>
                ) : null}
              </div>
              <div className="form-group">
                <label htmlFor="genero">Género</label>
                <input
                  id="genero"
                  name="genero"
                  type="text"
                  placeholder="Femenino, Masculino, Otro..."
                  value={form.genero}
                  onChange={handleChange}
                  className={fieldErrors.genero ? "input-error" : ""}
                />
                {fieldErrors.genero ? (
                  <small className="error-message">{fieldErrors.genero}</small>
                ) : null}
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="section-header">
              <h2 className="config-section-title">Datos de contacto</h2>
              <span className="section-chip soft">Contacto</span>
            </div>

            <div className="config-grid">
              <div className="form-group">
                <label htmlFor="email">Correo electrónico</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu-correo@ejemplo.com"
                  value={form.email}
                  onChange={handleChange}
                  className={fieldErrors.email ? "input-error" : ""}
                />
                {fieldErrors.email ? (
                  <small className="error-message">{fieldErrors.email}</small>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="telefono">Teléfono</label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  placeholder="+57 300 000 0000"
                  value={form.telefono}
                  onChange={handleChange}
                  inputMode="numeric"
                  maxLength={PHONE_LENGTH}
                  className={fieldErrors.telefono ? "input-error" : ""}
                />
                {fieldErrors.telefono ? (
                  <small className="error-message">{fieldErrors.telefono}</small>
                ) : null}
              </div>
            </div>

            <div className="config-grid">
              <div className="form-group">
                <label htmlFor="n_emergencia">Nombre de contacto</label>
                <input
                  id="n_emergencia"
                  name="n_emergencia"
                  type="text"
                  value={form.n_emergencia}
                  onChange={handleChange}
                  placeholder="Persona a contactar"
                  className={fieldErrors.n_emergencia ? "input-error" : ""}
                />
                {fieldErrors.n_emergencia ? (
                  <small className="error-message">{fieldErrors.n_emergencia}</small>
                ) : null}
              </div>

              <div className="form-group">
                <label htmlFor="c_emergencia">Teléfono de contacto</label>
                <input
                  id="c_emergencia"
                  name="c_emergencia"
                  type="tel"
                  value={form.c_emergencia}
                  onChange={handleChange}
                  placeholder="Teléfono de emergencia"
                  inputMode="numeric"
                  maxLength={PHONE_LENGTH}
                  className={fieldErrors.c_emergencia ? "input-error" : ""}
                />
                {fieldErrors.c_emergencia ? (
                  <small className="error-message">
                    {fieldErrors.c_emergencia}
                  </small>
                ) : null}
              </div>
            </div>
          </div>

          <div className="config-section">
            <div className="section-header">
              <h2 className="config-section-title">Salud</h2>
              <span className="section-chip neutral">Opcional</span>
            </div>
            <div className="form-group">
              <label htmlFor="enfermedades">
                Enfermedades o condiciones médicas relevantes
              </label>
              <textarea
                id="enfermedades"
                name="enfermedades"
                rows="3"
                value={form.enfermedades}
                onChange={handleChange}
                placeholder="Ej: alergias, restricciones o tratamientos"
                className={fieldErrors.enfermedades ? "input-error" : ""}
              />
              {fieldErrors.enfermedades ? (
                <small className="error-message">{fieldErrors.enfermedades}</small>
              ) : null}
            </div>
          </div>

          <div className="config-section">
            <div className="section-header">
              <h2 className="config-section-title">Seguridad</h2>
              <span className="section-chip accent">Clave</span>
            </div>

            <div className="form-group">
              <label htmlFor="password">Nueva contraseña</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Deja en blanco si no quieres cambiarla"
                  value={form.password}
                  onChange={handleChange}
                  className={fieldErrors.password ? "input-error" : ""}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4.5 4.5 19.5 19.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M4 12.5s2.5-5 8-5c1.2 0 2.3.3 3.2.7M20 15.5c-1 1.4-3.5 4-7.5 4-.7 0-1.3 0-2-.2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 9.5a3 3 0 0 1 3 3c0 .5-.1 1-.3 1.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.3 14.7A3 3 0 0 1 9 12c0-.5.1-.9.3-1.3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      />
                      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password ? (
                <small className="error-message">{fieldErrors.password}</small>
              ) : null}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="Repite la contraseña para confirmar"
                value={form.confirmPassword}
                onChange={handleChange}
                className={fieldErrors.confirmPassword ? "input-error" : ""}
              />
              {fieldErrors.confirmPassword ? (
                <small className="error-message">
                  {fieldErrors.confirmPassword}
                </small>
              ) : null}
            </div>
          </div>

          <div className="config-actions">
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
