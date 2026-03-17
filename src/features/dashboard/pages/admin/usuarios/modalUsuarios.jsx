import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { useRoles } from "../../../hooks/Roles_API/role_API_AD";
import { validarUsuario } from "../../../hooks/validaciones/validaciones";
import {
  checkDocumentoExists,
  checkEmailExists,
} from "../../../hooks/Acceder_API/authService.jsx";
import Modal from "../../../../../shared/components/Modal/Modal";
import "../../../../../shared/styles/restructured/components/modal-usuarios.css";
import { EyeIcon, EyeOff } from "lucide-react";

const Motion = motion;

const DOCUMENTO_MIN_LENGTH = 6;
const DOCUMENTO_MAX_LENGTH = 11;
const USER_TEXT_MAX_LENGTH = 50;
const USER_MAX_CONSECUTIVE_SPACES = 3;
const USER_NAME_FIELDS = new Set([
  "nombre_usuario",
  "apellido_usuario",
  "n_emergencia",
]);
const USER_LIMITED_SPACE_FIELDS = new Set([
  "enfermedades",
]);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const limitConsecutiveSpaces = (value) => {
  const text = String(value ?? "").replace(/\s/g, " ");
  return text.replace(
    new RegExp(` {${USER_MAX_CONSECUTIVE_SPACES + 1},}`, "g"),
    " ".repeat(USER_MAX_CONSECUTIVE_SPACES)
  );
};

const sanitizeUserText = (value) =>
  limitConsecutiveSpaces(value).slice(0, USER_TEXT_MAX_LENGTH);

const getMembershipId = (source = {}) => {
  const candidates = [
    source?.id_membresia,
    source?.id_membresias,
    source?.membresia_id,
    source?.idMembresia,
    source?.membresia?.id_membresia,
    source?.membresia?.id_membresias,
    source?.membresia?.id,
    source?.id_membresia_membresia?.id_membresia,
    source?.id_membresia_membresia?.id_membresias,
    source?.id_membresia_membresia?.id,
  ];

  return (
    candidates
      .map((candidate) => toNumber(candidate))
      .find((id) => Number.isInteger(id) && id > 0) ?? null
  );
};

const getMembershipName = (source = {}) =>
  source?.nombre_membresia ||
  source?.nombreMembresia ||
  source?.membresia_nombre ||
  source?.membresia?.nombre_membresia ||
  source?.membresia?.nombre ||
  source?.id_membresia_membresia?.nombre_membresia ||
  source?.id_membresia_membresia?.nombre ||
  null;

const formatDate = (value) => {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "No disponible";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Base Modal Component for Users
const BaseUserModal = ({
  title,
  initialData = {},
  onClose,
  onSave = async () => true,
  disabled = false,
  isOpen = true,
  beneficiarios = [],
  membresias = [],
  usuariosReferencia = [],
  empleadoInfo = null,
  showClientSummary = false,
  showEmployeeSummary = false,
  closeOnOverlayClick,
}) => {
  const modalRef = useRef(null);
  /* ---------- Hooks ---------- */
  const { roles: rolesData, loading: loadingRoles } = useRoles();

  /* ---------- Memos ---------- */
  const roles = useMemo(() => {
    if (!Array.isArray(rolesData)) return [];
    // Filtrar solo activos si se desea, o mostrar todos
    return rolesData
      .filter((role) => role.id_estado === 1)
      .map((role) => ({
        id: role.id_rol || role.id,
        id_rol: role.id_rol || role.id,
        nombre:
          role.nombre_rol || role.nombre || `Rol ${role.id_rol || role.id}`,
      }));
  }, [rolesData]);

  /* ---------- Estado del Formulario ---------- */
  const [formData, setFormData] = useState({
    id_usuario: initialData.id_usuario || null,
    nombre_usuario: initialData.nombre_usuario || "",
    apellido_usuario: initialData.apellido_usuario || "",
    tipo_documento: initialData.tipo_documento || "CC",
    documento: initialData.documento || "",
    email: initialData.email || "",
    telefono: initialData.telefono || "",
    c_emergencia: initialData.c_emergencia || "",
    n_emergencia: initialData.n_emergencia || "",
    fecha_nacimiento: initialData.fecha_nacimiento || "",
    genero: initialData.genero || "Masculino",
    password: initialData.password || "",
    enfermedades: initialData.enfermedades || "N/A",
    id_estado: initialData.id_estado || 1,
    // Prioridad: rol_id explícito > primer rol en array > valor por defecto (3=Cliente habitualmente)
    rol_id:
      initialData.rol_id ||
      initialData.roles?.[0]?.id_rol ||
      initialData.id_rol ||
      "",
    confirmPassword: "",
  });

  const [showBeneficiarios, setShowBeneficiarios] = useState(false);
  const [errors, setErrors] = useState({});
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailExists, setEmailExists] = useState(undefined);
  const [documentoChecking, setDocumentoChecking] = useState(false);
  const [documentoExists, setDocumentoExists] = useState(undefined);
  const emailAbortRef = useRef(null);
  const emailDebounceRef = useRef(null);
  const documentoAbortRef = useRef(null);
  const documentoDebounceRef = useRef(null);

  const idUsuarioActual = useMemo(
    () =>
      toPositiveInt(
        formData.id_usuario ?? initialData.id_usuario ?? initialData.id
      ),
    [formData.id_usuario, initialData.id_usuario, initialData.id]
  );

  const usuariosPorId = useMemo(
    () =>
      (Array.isArray(usuariosReferencia) ? usuariosReferencia : []).reduce(
        (acc, usuario) => {
          const id = toPositiveInt(usuario?.id_usuario ?? usuario?.id);
          if (id) acc[id] = usuario;
          return acc;
        },
        {}
      ),
    [usuariosReferencia]
  );

  const beneficiariosDelUsuario = useMemo(() => {
    if (!idUsuarioActual || !Array.isArray(beneficiarios)) return [];
    return beneficiarios.filter(
      (registro) => toPositiveInt(registro?.id_usuario) === idUsuarioActual
    );
  }, [beneficiarios, idUsuarioActual]);

  const membresiaDesdeRelaciones = useMemo(() => {
    if (!beneficiariosDelUsuario.length) return null;
    return (
      beneficiariosDelUsuario.find(
        (registro) =>
          toPositiveInt(registro?.id_relacion) === idUsuarioActual &&
          getMembershipId(registro) !== null
      ) ||
      beneficiariosDelUsuario.find(
        (registro) => getMembershipId(registro) !== null
      ) ||
      null
    );
  }, [beneficiariosDelUsuario, idUsuarioActual]);

  const membershipName = useMemo(() => {
    const sourceList = Array.isArray(membresias) ? membresias : [];
    const membershipId =
      getMembershipId(initialData) ?? getMembershipId(membresiaDesdeRelaciones);
    const directName =
      getMembershipName(initialData) ?? getMembershipName(membresiaDesdeRelaciones);

    if (membershipId !== null) {
      const membership = sourceList.find((item) => getMembershipId(item) === membershipId);
      return (
        getMembershipName(membership) || directName || `Membresía ${membershipId}`
      );
    }

    return directName || "Sin membresía asociada";
  }, [initialData, membresiaDesdeRelaciones, membresias]);

  const getBeneficiarioDatos = (registro = {}) => {
    const idRelacion = toPositiveInt(registro?.id_relacion ?? registro?.id);
    const relacionado =
      registro?.id_relacion_usuario ||
      registro?.relacion_usuario ||
      registro?.usuario_relacion ||
      {};
    const usuarioRelacionado = idRelacion ? usuariosPorId[idRelacion] : null;

    const nombreBase =
      registro?.nombre_relacion ||
      registro?.nombre_beneficiario ||
      relacionado?.nombre_usuario ||
      relacionado?.nombre ||
      usuarioRelacionado?.nombre_usuario ||
      usuarioRelacionado?.nombre ||
      (idRelacion ? `Usuario ${idRelacion}` : "Usuario sin nombre");

    const apellido =
      registro?.apellido_relacion ||
      registro?.apellido_beneficiario ||
      relacionado?.apellido_usuario ||
      relacionado?.apellido ||
      usuarioRelacionado?.apellido_usuario ||
      usuarioRelacionado?.apellido ||
      "";

    const nombre = `${nombreBase}${apellido ? ` ${apellido}` : ""}`.trim();

    const email =
      registro?.email_relacion ||
      relacionado?.email ||
      usuarioRelacionado?.email ||
      "";

    return { nombre, email };
  };

  const getMembershipNameByRecord = (registro = {}) => {
    const id = getMembershipId(registro);
    const sourceList = Array.isArray(membresias) ? membresias : [];
    if (id !== null) {
      const membership = sourceList.find((item) => getMembershipId(item) === id);
      return getMembershipName(membership) || getMembershipName(registro) || `Membresía ${id}`;
    }
    return getMembershipName(registro) || "Sin membresía asociada";
  };

  const shouldShowClientSummary =
    disabled && showClientSummary && Boolean(idUsuarioActual);
  const shouldShowEmployeeSummary = disabled && showEmployeeSummary;
  const employeeDetails =
    empleadoInfo && typeof empleadoInfo === "object" ? empleadoInfo : null;
  const resolvedCloseOnOverlayClick =
    typeof closeOnOverlayClick === "boolean"
      ? closeOnOverlayClick
      : !disabled;

  /* ---------- Efectos ---------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (!disabled && isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose, disabled, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setEmailChecking(false);
    setEmailExists(undefined);
    setDocumentoChecking(false);
    setDocumentoExists(undefined);
  }, [isOpen]);

  const validateUserFormBase = useCallback((data) => {
    const { errors: nextErrors } = validarUsuario(
      data,
      Boolean(data.id_usuario)
    );
    const emergencyPhone = String(data.c_emergencia || "").replace(/\D/g, "");
    const enfermedades = String(data.enfermedades || "").trim();

    if (!emergencyPhone) {
      nextErrors.c_emergencia = "El teléfono de emergencia es obligatorio";
    } else if (emergencyPhone.length !== 10) {
      nextErrors.c_emergencia = "Debe tener 10 dígitos";
    }

    if (!enfermedades) {
      nextErrors.enfermedades = "Debe indicar N/A o una condición";
    }

    return nextErrors;
  }, []);

  const validateUserForm = useCallback((data) => {
    const nextErrors = validateUserFormBase(data);

    if (!nextErrors.email && emailExists === true) {
      nextErrors.email = "Este email ya está registrado";
    }

    if (!nextErrors.documento && documentoExists === true) {
      nextErrors.documento = "Este documento ya está registrado";
    }

    return nextErrors;
  }, [documentoExists, emailExists, validateUserFormBase]);

  /* ---------- Handlers ---------- */
  const handleNumericOnlyKeyDown = (e) => {
    // Permitir teclas de control (backspace, delete, tab, escape, enter, etc.)
    const controlKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (controlKeys.includes(e.key)) return;

    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
    if (e.ctrlKey && ['a', 'c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) return;

    // Solo permitir dígitos (0-9)
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleNoWhitespaceKeyDown = (e) => {
    if (e.key === " ") {
      e.preventDefault();
    }
  };

  const handleBlockPaste = (e) => {
    e.preventDefault();
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    let normalizedValue = nextValue;
    if (name === "documento") {
      normalizedValue = String(nextValue)
        .replace(/\D/g, "")
        .slice(0, DOCUMENTO_MAX_LENGTH);
    } else if (name === "email") {
      normalizedValue = String(nextValue).replace(/\s/g, "");
    } else if (USER_NAME_FIELDS.has(name)) {
      normalizedValue = sanitizeUserText(nextValue);
    } else if (USER_LIMITED_SPACE_FIELDS.has(name)) {
      normalizedValue = limitConsecutiveSpaces(nextValue);
    }
    const nextData = {
      ...formData,
      [name]: normalizedValue,
    };

    setFormData(nextData);
    setErrors(validateUserForm(nextData));

    if (name === "email") {
      const normalizedEmail = String(normalizedValue || "").trim().toLowerCase();
      const initialEmail = String(initialData.email || "").trim().toLowerCase();

      setEmailExists(undefined);
      clearTimeout(emailDebounceRef.current);
      if (emailAbortRef.current) {
        emailAbortRef.current.abort();
        emailAbortRef.current = null;
      }

      const nextBaseErrors = validateUserFormBase({
        ...nextData,
        email: normalizedValue,
      });

      if (
        disabled ||
        !normalizedEmail ||
        normalizedEmail === initialEmail ||
        nextBaseErrors.email
      ) {
        setEmailChecking(false);
      } else {
        setEmailChecking(true);
        emailDebounceRef.current = setTimeout(async () => {
          const ctrl = new AbortController();
          emailAbortRef.current = ctrl;
          try {
            const res = await checkEmailExists(normalizedEmail, {
              signal: ctrl.signal,
            });
            const exists =
              res.exists ??
              res.isTaken ??
              ((res.available === false) ||
                (typeof res.msg === "string" &&
                  /registrad|existe/i.test(res.msg)));
            setEmailExists(Boolean(exists));
          } catch (error) {
            if (error?.name !== "AbortError") {
              setEmailExists(undefined);
            }
          } finally {
            setEmailChecking(false);
            emailAbortRef.current = null;
          }
        }, 400);
      }
    }

    if (name === "documento") {
      const normalizedDocumento = String(normalizedValue || "").trim();
      const initialDocumento = String(initialData.documento || "").trim();

      setDocumentoExists(undefined);
      clearTimeout(documentoDebounceRef.current);
      if (documentoAbortRef.current) {
        documentoAbortRef.current.abort();
        documentoAbortRef.current = null;
      }

      const nextBaseErrors = validateUserFormBase({
        ...nextData,
        documento: normalizedValue,
      });

      if (
        disabled ||
        !normalizedDocumento ||
        normalizedDocumento === initialDocumento ||
        nextBaseErrors.documento
      ) {
        setDocumentoChecking(false);
      } else {
        setDocumentoChecking(true);
        documentoDebounceRef.current = setTimeout(async () => {
          const ctrl = new AbortController();
          documentoAbortRef.current = ctrl;
          try {
            const res = await checkDocumentoExists(normalizedDocumento, {
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
          } catch (error) {
            if (error?.name !== "AbortError") {
              setDocumentoExists(undefined);
            }
          } finally {
            setDocumentoChecking(false);
            documentoAbortRef.current = null;
          }
        }, 400);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validateUserForm(formData);
    const documentoDigits = String(formData.documento || "").replace(/\D/g, "");
    setErrors(nextErrors);

    if (
      Object.keys(nextErrors).length > 0 ||
      emailChecking ||
      emailExists === true ||
      documentoChecking ||
      documentoExists === true
    ) {
      return;
    }

    // Verificación de usuario logueado para edición
    if (formData.id_usuario) {
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          const currentUserId = user.id_usuario || user.id;
          // Comparar como strings o números para seguridad
          if (String(currentUserId) === String(formData.id_usuario)) {
            toast.error("no puedo alterar al usuario que ha iniciado sesion");
            return;
          }
        }
      } catch (err) {
        console.error("Error al verificar usuario logueado", err);
      }
    }

    try {
      const usuarioParaGuardar = {
        nombre_usuario: formData.nombre_usuario,
        apellido_usuario: formData.apellido_usuario,
        tipo_documento: formData.tipo_documento,
        documento: documentoDigits,
        email: formData.email,
        telefono: formData.telefono,
        c_emergencia: formData.c_emergencia,
        n_emergencia: formData.n_emergencia,
        fecha_nacimiento: formData.fecha_nacimiento,
        genero: formData.genero,
        enfermedades: formData.enfermedades,
        id_estado: formData.id_estado,
        rol_id: formData.rol_id,
        ...(formData.id_usuario && { id_usuario: formData.id_usuario }),
        ...((!formData.id_usuario || String(formData.password || "").trim()) && {
          password: formData.password,
        }),
      };

      const resultado = await onSave(usuarioParaGuardar);
      if (resultado === false) {
        throw new Error(
          formData.id_usuario
            ? "No se pudo actualizar el usuario"
            : "No se pudo crear el usuario"
        );
      }
      toast.success(
        formData.id_usuario
          ? "Usuario actualizado exitosamente"
          : "Usuario creado exitosamente"
      );
      onClose();
    } catch (error) {
      console.error("Error al procesar el formulario:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo guardar el usuario"
      );
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setShowBeneficiarios(false);
  }, [isOpen, idUsuarioActual]);

  useEffect(() => {
    return () => {
      clearTimeout(emailDebounceRef.current);
      if (emailAbortRef.current) emailAbortRef.current.abort();
      clearTimeout(documentoDebounceRef.current);
      if (documentoAbortRef.current) documentoAbortRef.current.abort();
    };
  }, []);

  const emailHelp = useMemo(() => {
    if (disabled) return null;
    if (errors.email) return { type: "error", text: errors.email };
    if (emailChecking) {
      return { type: "info", text: "Verificando disponibilidad..." };
    }
    if (emailExists === true) {
      return { type: "error", text: "Este email ya está registrado" };
    }
    if (emailExists === false) {
      return { type: "ok", text: "Email disponible" };
    }
    return null;
  }, [disabled, emailChecking, emailExists, errors.email]);

  const documentoHelp = useMemo(() => {
    if (disabled) return null;
    if (errors.documento) return { type: "error", text: errors.documento };
    if (documentoChecking) {
      return { type: "info", text: "Verificando disponibilidad..." };
    }
    if (documentoExists === true) {
      return { type: "error", text: "Este documento ya está registrado" };
    }
    if (documentoExists === false) {
      return { type: "ok", text: "Documento disponible" };
    }
    return null;
  }, [disabled, documentoChecking, documentoExists, errors.documento]);

  if (!isOpen) return null;

  const formId = "modal-usuarios-form";
  const footer = !disabled ? (
    <>
      <button
        type="button"
        onClick={onClose}
        className="boton boton-secundario"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form={formId}
        className="boton boton-primario"
      >
        Guardar
      </button>
    </>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      closeOnOverlayClick={resolvedCloseOnOverlayClick}
      className="modal-mediano modal-usuarios__container"
      modalRef={modalRef}
      footer={footer}
    >
      <Motion.form
        id={formId}
        onSubmit={handleSubmit}
        noValidate
        className="modal-usuarios__form"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <Motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
        <Motion.div
          className="modal-usuarios__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h3 className="modal-usuarios__section-title">
            Informacion Basica
          </h3>

          <div className="modal-usuarios__grid">
            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Nombre</label>
              <input
                type="text"
                name="nombre_usuario"
                value={formData.nombre_usuario}
                onChange={handleChange}
                maxLength={USER_TEXT_MAX_LENGTH}
                disabled={disabled}
                required
                className={`modal-usuarios__input ${
                  errors.nombre_usuario ? "modal-usuarios__input--error" : ""
                }`}
              />
              {errors.nombre_usuario ? (
                <p className="modal-usuarios__error-text">
                  {errors.nombre_usuario}
                </p>
              ) : null}
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Apellido</label>
              <input
                type="text"
                name="apellido_usuario"
                value={formData.apellido_usuario}
                onChange={handleChange}
                maxLength={USER_TEXT_MAX_LENGTH}
                disabled={disabled}
                required
                className={`modal-usuarios__input ${
                  errors.apellido_usuario ? "modal-usuarios__input--error" : ""
                }`}
              />
              {errors.apellido_usuario ? (
                <p className="modal-usuarios__error-text">
                  {errors.apellido_usuario}
                </p>
              ) : null}
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Tipo de Documento</label>
              <select
                name="tipo_documento"
                value={formData.tipo_documento}
                onChange={handleChange}
                disabled={disabled}
                required
                className="modal-usuarios__input modal-usuarios__select"
              >
                <option value="CC">Cedula de Ciudadania</option>
                <option value="TI">Tarjeta de Identidad</option>
                <option value="CE">Cedula de Extranjeria</option>
                <option value="PAS">Pasaporte</option>
              </select>
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Numero de Documento</label>
              <input
                type="text"
                name="documento"
                value={formData.documento}
                onChange={handleChange}
                onKeyDown={handleNumericOnlyKeyDown}
                inputMode="numeric"
                minLength={DOCUMENTO_MIN_LENGTH}
                maxLength={DOCUMENTO_MAX_LENGTH}
                pattern="[0-9]{6,11}"
                title="Ingrese entre 6 y 11 digitos"
                disabled={disabled}
                required
                className={`modal-usuarios__input ${
                  errors.documento || documentoExists === true
                    ? "modal-usuarios__input--error"
                    : ""
                }`}
              />
              {documentoHelp ? (
                <p
                  className={`modal-usuarios__helper-text modal-usuarios__helper-text--${documentoHelp.type}`}
                >
                  {documentoHelp.text}
                </p>
              ) : null}
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Fecha de Nacimiento</label>
              <input
                type="date"
                name="fecha_nacimiento"
                value={formData.fecha_nacimiento}
                onChange={handleChange}
                disabled={disabled}
                className={`modal-usuarios__input ${
                  errors.fecha_nacimiento ? "modal-usuarios__input--error" : ""
                }`}
              />
              {errors.fecha_nacimiento ? (
                <p className="modal-usuarios__error-text">
                  {errors.fecha_nacimiento}
                </p>
              ) : null}
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Genero</label>
              <select
                name="genero"
                value={formData.genero}
                onChange={handleChange}
                disabled={disabled}
                className="modal-usuarios__input modal-usuarios__select"
              >
                <option value="Masculino">Masculino</option>
                <option value="Femenino">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </Motion.div>

        <Motion.div
          className="modal-usuarios__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <h3 className="modal-usuarios__section-title">
            Contacto y Acceso
          </h3>

          <div className="modal-usuarios__grid">
            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onKeyDown={handleNoWhitespaceKeyDown}
                onPaste={handleBlockPaste}
                disabled={disabled}
                required
                placeholder="correo@ejemplo.com"
                className={`modal-usuarios__input ${
                  errors.email || emailExists === true
                    ? "modal-usuarios__input--error"
                    : ""
                }`}
              />
              {emailHelp ? (
                <p
                  className={`modal-usuarios__helper-text modal-usuarios__helper-text--${emailHelp.type}`}
                >
                  {emailHelp.text}
                </p>
              ) : null}
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Telefono</label>
              <input
                type="text"
                name="telefono"
                value={formData.telefono}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  handleChange({ target: { name: "telefono", value } });
                }}
                disabled={disabled}
                placeholder="Numero de telefono (10 digitos)"
                required
                pattern="\d{10}"
                title="Por favor ingrese exactamente 10 digitos"
                className={`modal-usuarios__input ${
                  errors.telefono ? "modal-usuarios__input--error" : ""
                }`}
              />
              {errors.telefono ? (
                <p className="modal-usuarios__error-text">{errors.telefono}</p>
              ) : null}
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Nombre C. de Emergencia</label>
              <input
                type="text"
                name="n_emergencia"
                value={formData.n_emergencia}
                onChange={handleChange}
                maxLength={USER_TEXT_MAX_LENGTH}
                disabled={disabled}
                placeholder="Nombre del contacto de emergencia"
                className="modal-usuarios__input"
              />
            </div>

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Telefono C. de Emergencia</label>
              <input
                type="text"
                name="c_emergencia"
                value={formData.c_emergencia}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                  handleChange({ target: { name: "c_emergencia", value } });
                }}
                disabled={disabled}
                placeholder="Telefono de emergencia (10 digitos)"
                required
                pattern="\d{10}"
                title="Por favor ingrese exactamente 10 digitos"
                className={`modal-usuarios__input ${
                  errors.c_emergencia ? "modal-usuarios__input--error" : ""
                }`}
              />
              {errors.c_emergencia ? (
                <p className="modal-usuarios__error-text">
                  {errors.c_emergencia}
                </p>
              ) : null}
            </div>

            {!formData.id_usuario && (
              <>
                <div className="modal-usuarios__field">
                  <label className="modal-usuarios__label">Contrasena</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={disabled}
                    required
                    minLength="8"
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+"
                    title="Minimo 8 caracteres, con mayuscula, minuscula, numero y caracter especial"
                    placeholder="Minimo 8 caracteres"
                    className={`modal-usuarios__input ${
                      errors.password ? "modal-usuarios__input--error" : ""
                    }`}
                  />
                  {errors.password ? (
                    <p className="modal-usuarios__error-text">
                      {errors.password}
                    </p>
                  ) : null}
                </div>
                <div className="modal-usuarios__field">
                  <label className="modal-usuarios__label">Confirmar Contrasena</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={disabled}
                    required
                    minLength="8"
                    placeholder="Repita la contrasena"
                    className={`modal-usuarios__input ${
                      errors.confirmPassword
                        ? "modal-usuarios__input--error"
                        : ""
                    }`}
                  />
                  {errors.confirmPassword ? (
                    <p className="modal-usuarios__error-text">
                      {errors.confirmPassword}
                    </p>
                  ) : null}
                </div>
              </>
            )}

            <div className="modal-usuarios__field">
              <label className="modal-usuarios__label">Rol</label>
              {loadingRoles ? (
                <div className="py-2 text-gray-500">Cargando roles...</div>
              ) : (
                <select
                  name="rol_id"
                  value={formData.rol_id || ""}
                  onChange={handleChange}
                  disabled={disabled || loadingRoles}
                  required
                  className={`modal-usuarios__input modal-usuarios__select ${
                    errors.rol_id ? "modal-usuarios__input--error" : ""
                  }`}
                >
                  <option value="">Seleccionar rol</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.nombre}
                    </option>
                  ))}
                </select>
              )}
              {errors.rol_id ? (
                <p className="modal-usuarios__error-text">{errors.rol_id}</p>
              ) : null}
            </div>
          </div>
        </Motion.div>

        <Motion.div
          className="modal-usuarios__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <h3 className="modal-usuarios__section-title">
            Informacion Adicional
          </h3>
          <div className="modal-usuarios__field">
            <label className="modal-usuarios__label">Enfermedades o Condiciones Especiales</label>
            <textarea
              name="enfermedades"
              value={formData.enfermedades}
              onChange={handleChange}
              disabled={disabled}
              rows="3"
              required
              maxLength="500"
              placeholder="Indique si tiene alguna condicion medica o alergia"
              className={`modal-usuarios__input modal-usuarios__textarea ${
                errors.enfermedades ? "modal-usuarios__input--error" : ""
              }`}
            />
            {errors.enfermedades ? (
              <p className="modal-usuarios__error-text">{errors.enfermedades}</p>
            ) : null}
          </div>
        </Motion.div>

        {shouldShowClientSummary && (
          <div className="modal-usuarios__card">
            <h3 className="modal-usuarios__section-title">Membresia del cliente</h3>
            <p className="modal-usuarios__summary-text">{membershipName}</p>
          </div>
        )}

        {shouldShowClientSummary && (
          <div className="modal-usuarios__card">
            <div className="modal-usuarios__summary-header">
              <h3 className="modal-usuarios__section-title">
                Beneficiarios ({beneficiariosDelUsuario.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowBeneficiarios((prev) => !prev)}
                className="modal-usuarios__toggle-btn"
              >
                {showBeneficiarios ? <EyeOff size={16} /> : <EyeIcon size={16} />}
                {showBeneficiarios ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {showBeneficiarios && (
              <div>
                {beneficiariosDelUsuario.length === 0 ? (
                  <p className="modal-usuarios__summary-empty">
                    No hay beneficiarios registrados para este usuario.
                  </p>
                ) : (
                  <div className="modal-usuarios__beneficiarios-list">
                    {beneficiariosDelUsuario.map((registro, index) => {
                      const data = getBeneficiarioDatos(registro);
                      const key =
                        registro?.id_beneficiario ||
                        `${registro?.id_usuario || "u"}-${registro?.id_relacion || "r"}-${index}`;
                      return (
                        <div key={key} className="modal-usuarios__beneficiario-item">
                          <p className="modal-usuarios__beneficiario-name">
                            Beneficiario: {data.nombre}
                          </p>
                          {data.email ? (
                            <p className="modal-usuarios__beneficiario-detail">
                              Correo: {data.email}
                            </p>
                          ) : null}
                          <p className="modal-usuarios__beneficiario-detail">
                            Membresía: {getMembershipNameByRecord(registro)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {shouldShowEmployeeSummary && (
          <div className="modal-usuarios__card">
            <h3 className="modal-usuarios__section-title">Informacion de empleado</h3>
            {employeeDetails ? (
              <div className="modal-usuarios__grid">
                <div className="modal-usuarios__field">
                  <label className="modal-usuarios__label">Direccion</label>
                  <input
                    type="text"
                    value={employeeDetails.direccion_empleado || "No disponible"}
                    className="modal-usuarios__input"
                    disabled
                    readOnly
                  />
                </div>
                <div className="modal-usuarios__field">
                  <label className="modal-usuarios__label">Fecha de contratacion</label>
                  <input
                    type="text"
                    value={formatDate(employeeDetails.fecha_contratacion)}
                    className="modal-usuarios__input"
                    disabled
                    readOnly
                  />
                </div>
                <div className="modal-usuarios__field">
                  <label className="modal-usuarios__label">Salario</label>
                  <input
                    type="text"
                    value={formatCurrency(employeeDetails.salario)}
                    className="modal-usuarios__input"
                    disabled
                    readOnly
                  />
                </div>
                <div className="modal-usuarios__field">
                  <label className="modal-usuarios__label">Horario</label>
                  <input
                    type="text"
                    value={employeeDetails.horario_empleado || "N/A"}
                    className="modal-usuarios__input"
                    disabled
                    readOnly
                  />
                </div>
              </div>
            ) : (
              <p className="modal-usuarios__summary-empty">
                Este usuario no tiene un registro de empleado asociado.
              </p>
            )}
          </div>
        )}

        </Motion.div>
      </Motion.form>

    </Modal>
  );
};

BaseUserModal.propTypes = {
  title: PropTypes.string.isRequired,
  initialData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  disabled: PropTypes.bool,
  isOpen: PropTypes.bool,
  beneficiarios: PropTypes.array,
  membresias: PropTypes.array,
  usuariosReferencia: PropTypes.array,
  empleadoInfo: PropTypes.object,
  showClientSummary: PropTypes.bool,
  showEmployeeSummary: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
};

export default BaseUserModal;

