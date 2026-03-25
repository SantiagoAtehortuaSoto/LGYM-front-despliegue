import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  forgotPassword,
  updatePasswordVerified,
} from "../../hooks/Acceder_API/authService.jsx";
import useSubmitGuard from "../../../../shared/hooks/useSubmitGuard";

import { IconEye, IconEyeOff } from "@tabler/icons-react"; // 👈 ojitos

const EMAIL = "email";
const CODE = "code";
const NEWPASS = "newpass";

const OlvidarContrasena = () => {
  const { runGuardedSubmit } = useSubmitGuard();
  const navigate = useNavigate();

  const [step, setStep] = useState(EMAIL);

  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState(""); // se usará como resetCode

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});

  const [enviando, setEnviando] = useState(false);

  // 👇 estados para mostrar/ocultar contraseña
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reenviar código (cooldown)
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const id = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const emailValido = (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).toLowerCase());
  const codeValido = (v) => /^[0-9]{6}$/.test(String(v).trim()); // 6 dígitos
  const passwordValida = (v) => {
    const p = String(v || "");
    if (p.length < 8) return false;
    if (!/[A-Z]/.test(p)) return false;
    if (!/[a-z]/.test(p)) return false;
    if (!/\d/.test(p)) return false;
    if (!/[^A-Za-z0-9]/.test(p)) return false;
    return true;
  };

  // Paso 1: Enviar correo (solicita código)
  const handleSendEmail = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const emailError = !normalizedEmail
      ? "Ingresa tu correo"
      : !emailValido(normalizedEmail)
      ? "Ingresa un correo válido"
      : "";
    setErrors((prev) => ({ ...prev, email: emailError }));
    if (emailError) {
      return;
    }
    await runGuardedSubmit(async () => {
      try {
        setEnviando(true);
        await forgotPassword(normalizedEmail);
        toast.success(
          "Si el correo existe, te enviamos un código para restablecer tu contraseña."
        );
        setEmail(normalizedEmail);
        setVerificationCode("");
        setStep(CODE);
        setCooldown(60);
      } catch (err) {
        toast.error(err?.message || "No se pudo procesar la solicitud.");
      } finally {
        setEnviando(false);
      }
    });
  };

  // Paso 2: Validar código localmente y pasar a nueva contraseña
  const handleSubmitCode = (e) => {
    e.preventDefault();
    const codeError = !verificationCode.trim()
      ? "Ingresa el código"
      : !codeValido(verificationCode)
      ? "El código debe tener 6 dígitos"
      : "";
    setErrors((prev) => ({ ...prev, verificationCode: codeError }));
    if (codeError) {
      return;
    }

    // Ya no llamamos a verifyCode: el backend válida el código en /reset-password
    setStep(NEWPASS);
    toast.success("Código ingresado. Ahora crea tu nueva contraseña.");
  };

  // Paso 3: Cambiar contraseña -> /reset-password { email, resetcode, newPassword }
  const handleSubmitNewPass = async (e) => {
    e.preventDefault();
    const nextErrors = {
      verificationCode: !codeValido(verificationCode)
        ? "El código debe tener 6 dígitos"
        : "",
      newPassword: !passwordValida(newPassword)
        ? "Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo"
        : "",
      confirmPassword:
        newPassword !== confirmPassword ? "Las contraseñas no coinciden" : "",
    };
    setErrors((prev) => ({ ...prev, ...nextErrors }));

    if (nextErrors.newPassword || nextErrors.confirmPassword) {
      return;
    }
    if (nextErrors.verificationCode) {
      setStep(CODE);
      return;
    }

    await runGuardedSubmit(async () => {
      try {
        setEnviando(true);
        await updatePasswordVerified({
          email: email.trim().toLowerCase(),
          resetCode: verificationCode.trim(), // se envía como resetcode en authService
          newPassword,
        });

        toast.success(
          "Contraseña actualizada. Inicia sesión con tu nueva clave."
        );

        // Limpieza y redirección
        setEmail("");
        setVerificationCode("");
        setNewPassword("");
        setConfirmPassword("");
        setStep(EMAIL);
        navigate("/acceder");
      } catch (err) {
        toast.error(err?.message || "No se pudo actualizar la contraseña.");
      } finally {
        setEnviando(false);
      }
    });
  };

  // Reenviar código en paso CODE
  const handleResendCode = async () => {
    if (cooldown > 0) return;
    const emailError = !email.trim()
      ? "Ingresa tu correo"
      : !emailValido(email)
      ? "Ingresa un correo válido"
      : "";
    setErrors((prev) => ({ ...prev, email: emailError }));
    if (emailError) {
      return;
    }
    try {
      setEnviando(true);
      await forgotPassword(email);
      toast.success("Si el correo existe, reenviamos el código.");
      setCooldown(60);
    } catch (err) {
      toast.error(err?.message || "No se pudo reenviar el código.");
    } finally {
      setEnviando(false);
    }
  };

  // Solo números para el código
  const onCodeChange = (e) => {
    const v = e.target.value.replace(/\D+/g, "").slice(0, 6);
    setVerificationCode(v);
    setErrors((prev) => ({
      ...prev,
      verificationCode:
        !v.trim() ? "Ingresa el código" : !codeValido(v) ? "El código debe tener 6 dígitos" : "",
    }));
  };

  return (
    <div className="contenedor-login">
      <div className="login-formulario">
        <div className="form-contenedor">
          {step === EMAIL && (
            <>
              <h2 className="titulo">¿Olvidaste tu contraseña?</h2>
              <p className="subtitulo">
                Ingresa tu correo y te enviaremos un código para restablecerla.
              </p>

              <form onSubmit={handleSendEmail} noValidate>
                <div className="input-icono">
                  <input
                    type="email"
                    placeholder="Tu correo"
                    value={email}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setEmail(nextValue);
                      setErrors((prev) => ({
                        ...prev,
                        email:
                          !nextValue.trim()
                            ? "Ingresa tu correo"
                            : !emailValido(nextValue.trim().toLowerCase())
                            ? "Ingresa un correo válido"
                            : "",
                      }));
                    }}
                    required
                    aria-label="Correo electrónico"
                    autoComplete="email"
                    className={errors.email ? "input-error" : ""}
                  />
                </div>
                {errors.email ? (
                  <small className="mensaje-error">{errors.email}</small>
                ) : null}

                <div className="acciones">
                  <button
                    type="submit"
                    className="boton-login"
                    disabled={enviando}
                    aria-busy={enviando}
                  >
                    {enviando ? "Enviando..." : "Enviar código"}
                  </button>
                </div>

                <div className="volver-wrap">
                  <Link to="/acceder" className="volver">
                    ← Volver a iniciar sesión
                  </Link>
                </div>
              </form>
            </>
          )}

          {step === CODE && (
            <>
              <h2 className="titulo">Ingresa el código</h2>
              <p className="subtitulo">
                Te enviamos un código de 6 dígitos al correo <b>{email}</b>.
              </p>

              <form onSubmit={handleSubmitCode} noValidate>
                <div className="input-icono">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Código de verificación"
                    value={verificationCode}
                    onChange={onCodeChange}
                    required
                    aria-label="Código de verificación"
                    className={errors.verificationCode ? "input-error" : ""}
                  />
                </div>
                {errors.verificationCode ? (
                  <small className="mensaje-error">
                    {errors.verificationCode}
                  </small>
                ) : null}

                <div className="acciones acciones--stacked">
                  <button
                    type="submit"
                    className="boton-login"
                    disabled={enviando || !codeValido(verificationCode)}
                    aria-busy={enviando}
                    title={
                      !codeValido(verificationCode)
                        ? "Ingresa un código válido (6 dígitos)"
                        : undefined
                    }
                  >
                    {enviando ? "Verificando..." : "Continuar"}
                  </button>

                  <button
                    type="button"
                    className={`boton-link ${
                      enviando || cooldown > 0 ? "boton-link--muted" : ""
                    }`}
                    onClick={handleResendCode}
                    disabled={enviando || cooldown > 0}
                    aria-busy={enviando}
                  >
                    {cooldown > 0
                      ? `Reenviar código (${cooldown}s)`
                      : "Reenviar código"}
                  </button>

                  <button
                    type="button"
                    className="boton-link"
                    onClick={() => {
                      setStep(EMAIL);
                      setVerificationCode("");
                    }}
                  >
                    Cambiar correo
                  </button>
                </div>
              </form>
            </>
          )}

          {step === NEWPASS && (
            <>
              <h2 className="titulo">Nueva contraseña</h2>
              <p className="subtitulo">
                Crea tu nueva contraseña para <b>{email}</b>.
              </p>

              <form onSubmit={handleSubmitNewPass} noValidate>
                {/* Nueva contraseña */}
                <div className="input-icono">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Nueva contraseña"
                    value={newPassword}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setNewPassword(nextValue);
                      setErrors((prev) => ({
                        ...prev,
                        newPassword:
                          !passwordValida(nextValue) && nextValue
                            ? "Mínimo 8 caracteres con mayúscula, minúscula, número y símbolo"
                            : "",
                        confirmPassword:
                          confirmPassword && nextValue !== confirmPassword
                            ? "Las contraseñas no coinciden"
                            : "",
                      }));
                    }}
                    required
                    aria-label="Nueva contraseña"
                    autoComplete="new-password"
                    className={errors.newPassword ? "input-error" : ""}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={
                      showNewPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {showNewPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {errors.newPassword ? (
                  <small className="mensaje-error">{errors.newPassword}</small>
                ) : null}

                {/* Confirmar contraseña */}
                <div className="input-icono">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirmar contraseña"
                    value={confirmPassword}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setConfirmPassword(nextValue);
                      setErrors((prev) => ({
                        ...prev,
                        confirmPassword:
                          newPassword !== nextValue
                            ? "Las contraseñas no coinciden"
                            : "",
                      }));
                    }}
                    required
                    aria-label="Confirmar contraseña"
                    autoComplete="new-password"
                    className={errors.confirmPassword ? "input-error" : ""}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={
                      showConfirmPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {showConfirmPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {errors.confirmPassword ? (
                  <small className="mensaje-error">
                    {errors.confirmPassword}
                  </small>
                ) : null}

                <div className="acciones acciones--stacked">
                  <button
                    type="submit"
                    className="boton-login"
                    disabled={enviando}
                    aria-busy={enviando}
                  >
                    {enviando ? "Actualizando..." : "Actualizar contraseña"}
                  </button>

                  <button
                    type="button"
                    className="boton-link"
                    onClick={() => setStep(CODE)}
                  >
                    ← Volver atrás
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div >
  );
};

export default OlvidarContrasena;
