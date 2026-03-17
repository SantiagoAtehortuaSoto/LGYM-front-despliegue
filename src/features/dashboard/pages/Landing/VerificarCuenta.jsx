import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Logo from "../../../../assets/LGYM_logo.png";
import {
  verifyRegistroEmail,
  resendVerification,
} from "../../hooks/Acceder_API/authService";

import toast from "react-hot-toast";
import { IconMail, IconLock } from "@tabler/icons-react";

const VerificarCuenta = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialEmail = location.state?.email || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) return "Ingresa tu correo";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return "Ingresa un correo válido";
    }
    return "";
  };

  const validateCode = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return "Ingresa el código";
    if (!/^\d{6}$/.test(normalized)) return "El código debe tener 6 dígitos";
    return "";
  };

  const toastSuccess = (msg) => {
    toast.dismiss();
    toast.success(msg);
  };

  const toastError = (msg) => {
    toast.dismiss();
    toast.error(msg);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      code: validateCode(code),
    };
    setErrors(nextErrors);

    if (nextErrors.email || nextErrors.code) {
      return;
    }

    setLoading(true);
    try {
      await verifyRegistroEmail({
        email,
        verificationCode: code,
      });

      toastSuccess(
        "Cuenta verificada correctamente. Ahora puedes iniciar sesión."
      );
      navigate("/acceder", { replace: true });
    } catch (err) {
      toastError(err.message || "No se pudo verificar la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const emailError = validateEmail(email);
    setErrors((prev) => ({ ...prev, email: emailError }));
    if (emailError) {
      return;
    }
    setResending(true);
    try {
      await resendVerification(email);
      toastSuccess("Se ha reenviado el código de verificación a tu correo.");
    } catch (err) {
      toastError(err.message || "No se pudo reenviar el código.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="contenedor-login">
      {/* ❌ Ya NO hay <Toaster /> aquí, solo en App.jsx */}
      <div className="login-formulario verificar-card">
        <div className="form-contenedor verificar-wrapper">
          <div className="logo-acceder">
            <img src={Logo} alt="Logo Nueva Era Fitness" />
          </div>

          <h2 className="titulo">Verifica tu cuenta</h2>
          <p className="subtitulo">
            Te enviamos un código de verificación a tu correo electrónico.
            Escríbelo a continuación para activar tu cuenta.
          </p>

          {/* form más angosto y centrado */}
          <form className="verificar-form" onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div
              className={`campo campo-verificar ${
                errors.email ? "con-error" : ""
              }`}
            >
              <div className="grupo-label">
                <IconMail /> <label>Email</label>
              </div>
              <input
                type="email"
                name="email"
                placeholder="Tu correo"
                value={email}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setEmail(nextValue);
                  setErrors((prev) => ({
                    ...prev,
                    email: validateEmail(nextValue),
                  }));
                }}
                className={errors.email ? "input-error" : ""}
                required
              />
              {errors.email ? (
                <small className="mensaje-error">{errors.email}</small>
              ) : null}
            </div>

            {/* Código */}
            <div
              className={`campo campo-verificar codigo-verificacion-input ${
                errors.code ? "con-error" : ""
              }`}
            >
              <div className="grupo-label">
                <IconLock /> <label>Código de verificación</label>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                name="code"
                placeholder="Ingresa el código"
                value={code}
                onChange={(e) => {
                  const nextValue = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(nextValue);
                  setErrors((prev) => ({
                    ...prev,
                    code: validateCode(nextValue),
                  }));
                }}
                className={errors.code ? "input-error" : ""}
                required
              />
              {errors.code ? (
                <small className="mensaje-error">{errors.code}</small>
              ) : null}
            </div>

            {/* Botón principal */}
            <div className="acciones">
              <button
                type="submit"
                className="boton-login"
                disabled={loading}
              >
                {loading ? "Verificando..." : "Verificar cuenta"}
              </button>
            </div>

            {/* Reenviar código */}
            <button
              type="button"
              className="boton-link verificar-reenviar"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? "Reenviando..." : "Reenviar código"}
            </button>

            <p className="registro verificar-registro">
              ¿Ya verificaste tu cuenta?{" "}
              <span onClick={() => navigate("/acceder")}>Inicia sesión</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VerificarCuenta;
