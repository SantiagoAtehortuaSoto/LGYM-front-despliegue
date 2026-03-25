import React, { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Trash2, Eye, EyeOff, Search, X } from "lucide-react";
import Modal from "../../../../../shared/components/Modal/Modal";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import {
  eliminarBeneficiario,
  crearBeneficiario,
} from "../../../hooks/Beneficiarios_API/benefeiciarios_API";
import {
  obtenerUsuariosClientes,
  obtenerUsuariosNoClientes,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import { getMembresias } from "../../../hooks/Membresia_API/Membresia.jsx";
import { validarCliente } from "../../../hooks/validaciones/validaciones";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import useSubmitGuard from "../../../../../shared/hooks/useSubmitGuard";
import "../../../../../shared/styles/restructured/components/modal-clientes.css";

const Motion = motion;

const CLIENT_ROLE_ID = 33;
const DOCUMENTO_MIN_LENGTH = 6;
const DOCUMENTO_MAX_LENGTH = 11;

const NORMALIZE_TEXT = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const GET_USER_DOCUMENT = (usuario = {}) =>
  String(
    usuario?.documento ??
      usuario?.numero_documento ??
      usuario?.n_documento ??
      ""
  ).trim();

const GET_USER_DOCUMENT_LABEL = (usuario = {}) => {
  const documento = GET_USER_DOCUMENT(usuario);
  if (!documento) return "";
  const tipoDocumento = String(usuario?.tipo_documento ?? "").trim();
  return tipoDocumento ? `${tipoDocumento}: ${documento}` : `Documento: ${documento}`;
};

const MATCHES_USER_SEARCH = (usuario, query) => {
  if (!query) return false;
  const normalizedQuery = NORMALIZE_TEXT(query);
  return [
    usuario?.nombre,
    usuario?.email,
    GET_USER_DOCUMENT(usuario),
    GET_USER_DOCUMENT_LABEL(usuario),
  ].some((campo) => NORMALIZE_TEXT(campo).includes(normalizedQuery));
};

const TO_NUMBER = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const GET_MEMBERSHIP_ID = (source = {}) => {
  const candidatos = [
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
    candidatos
      .map((value) => TO_NUMBER(value))
      .find((id) => Number.isInteger(id) && id > 0) ?? null
  );
};

const GET_MEMBERSHIP_NAME = (source = {}) =>
  source?.nombre_membresia ||
  source?.nombreMembresia ||
  source?.membresia_nombre ||
  source?.membresia?.nombre_membresia ||
  source?.membresia?.nombre ||
  source?.id_membresia_membresia?.nombre_membresia ||
  source?.id_membresia_membresia?.nombre ||
  null;

const BaseClienteModal = ({
  title,
  initialData = {},
  onClose,
  onSave = async () => true,
  disabled = false,
  isOpen = true,
  beneficiarios = [],
  membresias = [],
  onRefreshBeneficiarios = () => {},
  modoRelacionManual = false,
}) => {
  const { runGuardedSubmit, isSubmitting } = useSubmitGuard();
  const initialRolId = useMemo(() => {
    const posibles = [
      initialData.rol_id,
      initialData.id_rol,
      initialData.rolId,
      Array.isArray(initialData.roles)
        ? initialData.roles[0]?.id_rol || initialData.roles[0]?.id
        : null,
    ]
      .map((v) => Number(v))
      .find((n) => Number.isInteger(n) && n > 0);
    return posibles || CLIENT_ROLE_ID; // fallback cliente
  }, [initialData]);

  const [formData, setFormData] = useState({
    id_usuario: initialData.id_usuario || null,
    nombre_usuario: initialData.nombre_usuario || "",
    apellido_usuario: initialData.apellido_usuario || "",
    tipo_documento: initialData.tipo_documento || "DPI",
    documento: initialData.documento || "",
    email: initialData.email || "",
    telefono: initialData.telefono || "",
    c_emergencia: initialData.c_emergencia || "",
    n_emergencia: initialData.n_emergencia || "",
    fecha_nacimiento: initialData.fecha_nacimiento || "",
    genero: initialData.genero || "M",
    password: initialData.password || "",
    enfermedades: initialData.enfermedades || "N/A",
    id_estado: initialData.id_estado || 1,
    rol_id: initialRolId, // respeta rol existente
    roles: initialData.roles || [],
    confirmPassword: "",
  });

  const [showBeneficiarios, setShowBeneficiarios] = useState(false);
  const [errors, setErrors] = useState({});
  const [relationErrors, setRelationErrors] = useState({});
  const [isDeleteBeneficiarioModalOpen, setIsDeleteBeneficiarioModalOpen] =
    useState(false);
  const [beneficiarioAEliminar, setBeneficiarioAEliminar] = useState(null);

  const [usuariosClientesDisponibles, setUsuariosClientesDisponibles] = useState([]);
  const [usuariosNoClientesDisponibles, setUsuariosNoClientesDisponibles] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  const [busquedaTitular, setBusquedaTitular] = useState("");
  const [mostrarDropdownTitular, setMostrarDropdownTitular] = useState(false);
  const [titularSeleccionado, setTitularSeleccionado] = useState(null);

  const [busquedaBeneficiario, setBusquedaBeneficiario] = useState("");
  const [mostrarDropdownBeneficiario, setMostrarDropdownBeneficiario] =
    useState(false);
  const [beneficiariosSeleccionados, setBeneficiariosSeleccionados] =
    useState([]);

  const [_membresiaSeleccionada, _setMembresiaSeleccionada] = useState("");
  const [_estadoMembresia, _setEstadoMembresia] = useState(1);
  const [creandoBeneficiario, setCreandoBeneficiario] = useState(false);
  const [membresiasDisponibles, setMembresiasDisponibles] = useState([]);
  const [cargandoMembresias, setCargandoMembresias] = useState(false);

  const cargarTodosLosUsuarios = useCallback(async (fetcher) => {
    const defaultLimit = 100;
    const firstResponse = await fetcher({
      query: {
        page: 1,
      },
    });

    const { items: firstBatch, totalPages } = normalizePaginatedResponse(
      firstResponse,
      {
        preferredKeys: ["usuarios", "data"],
        defaultPage: 1,
        defaultLimit,
      }
    );

    if (totalPages <= 1) {
      return firstBatch;
    }

    const remainingResponses = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        fetcher({
          query: {
            page: index + 2,
          },
        })
      )
    );

    const remainingItems = remainingResponses.flatMap((response) =>
      normalizePaginatedResponse(response, {
        preferredKeys: ["usuarios", "data"],
        defaultPage: 1,
        defaultLimit,
      }).items
    );

    return [...firstBatch, ...remainingItems];
  }, []);

  const normalizarUsuario = useCallback((usuario, fallbackRolId = null) => {
    const id = TO_NUMBER(usuario?.id_usuario ?? usuario?.id);
    const rolId =
      TO_NUMBER(
        usuario?.rol_id ??
          usuario?.id_rol ??
          usuario?.roleId ??
          usuario?.rol?.id_rol ??
          usuario?.rol?.id
      ) ?? fallbackRolId;
    const nombreBase =
      usuario?.nombre_usuario ||
      usuario?.nombre ||
      usuario?.email ||
      (id !== null ? `Usuario ${id}` : "Usuario");
    const apellido = usuario?.apellido_usuario || usuario?.apellido || "";

    return {
      id,
      nombre: `${nombreBase}${apellido ? ` ${apellido}` : ""}`.trim(),
      apellido,
      email: usuario?.email || "",
      documento:
        usuario?.documento ??
        usuario?.numero_documento ??
        usuario?.n_documento ??
        "",
      tipo_documento: usuario?.tipo_documento ?? usuario?.tipoDocumento ?? "",
      rol_id: rolId,
    };
  }, []);

  const usuariosDisponibles = useMemo(
    () => [...usuariosClientesDisponibles, ...usuariosNoClientesDisponibles],
    [usuariosClientesDisponibles, usuariosNoClientesDisponibles]
  );

  const usuariosPorId = useMemo(
    () =>
      usuariosDisponibles.reduce((acc, usuario) => {
        const id = TO_NUMBER(usuario?.id);
        if (id !== null) acc[id] = usuario;
        return acc;
      }, {}),
    [usuariosDisponibles]
  );

  const idsYaBeneficiariosDeOtroTitular = useMemo(() => {
    const ids = new Set();
    beneficiarios.forEach((relacion) => {
      const titularId = TO_NUMBER(relacion?.id_usuario);
      const beneficiarioId = TO_NUMBER(relacion?.id_relacion);
      if (titularId === null || beneficiarioId === null) return;
      // Ignora self-beneficiario (id_usuario === id_relacion)
      if (titularId !== beneficiarioId) {
        ids.add(beneficiarioId);
      }
    });
    return ids;
  }, [beneficiarios]);

  const beneficiariosDelCliente = beneficiarios.filter(
    (beneficiario) =>
      TO_NUMBER(beneficiario?.id_usuario) === TO_NUMBER(formData.id_usuario)
  );

  const titularAutoseleccionado = useMemo(() => {
    const idTitular = toPositiveInt(
      formData.id_usuario ?? initialData.id_usuario ?? initialData.id
    );
    if (!idTitular) return null;

    const usuario = usuariosPorId[idTitular];
    return {
      id: idTitular,
      nombre:
        formData.nombre_usuario ||
        usuario?.nombre ||
        initialData.nombre_usuario ||
        initialData.email ||
        `Usuario ${idTitular}`,
      email: formData.email || usuario?.email || initialData.email || "",
    };
  }, [
    formData.id_usuario,
    formData.nombre_usuario,
    formData.email,
    initialData.id_usuario,
    initialData.id,
    initialData.nombre_usuario,
    initialData.email,
    usuariosPorId,
  ]);

  const obtenerDatosRelacion = (beneficiario = {}) => {
    const idRelacion = TO_NUMBER(beneficiario?.id_relacion ?? beneficiario?.id);
    const relacionUsuario =
      beneficiario?.id_relacion_usuario ||
      beneficiario?.relacion_usuario ||
      beneficiario?.usuario_relacion ||
      beneficiario?.id_usuario_usuario ||
      {};
    const usuarioDesdeLista = idRelacion ? usuariosPorId[idRelacion] : null;

    const nombreBase =
      beneficiario?.nombre_relacion ||
      beneficiario?.nombre_beneficiario ||
      relacionUsuario?.nombre_usuario ||
      relacionUsuario?.nombre ||
      usuarioDesdeLista?.nombre ||
      `Usuario ${idRelacion ?? ""}`.trim();

    const apellido =
      beneficiario?.apellido_relacion ||
      beneficiario?.apellido_beneficiario ||
      relacionUsuario?.apellido_usuario ||
      relacionUsuario?.apellido ||
      usuarioDesdeLista?.apellido ||
      "";

    const nombre = `${nombreBase}${apellido ? ` ${apellido}` : ""}`.trim();

    const email =
      beneficiario?.email_relacion ||
      beneficiario?.correo_relacion ||
      relacionUsuario?.email ||
      relacionUsuario?.correo ||
      usuarioDesdeLista?.email ||
      "";

    return { nombre, email };
  };

  const membresiaDesdeRelaciones = useMemo(() => {
    const titularId = toPositiveInt(
      formData.id_usuario ?? initialData.id_usuario ?? initialData.id
    );
    if (!titularId) return null;

    const relacionesTitular = beneficiarios.filter(
      (registro) => TO_NUMBER(registro?.id_usuario) === titularId
    );

    if (!relacionesTitular.length) return null;

    return (
      relacionesTitular.find(
        (registro) =>
          TO_NUMBER(registro?.id_relacion) === titularId &&
          GET_MEMBERSHIP_ID(registro) !== null
      ) ||
      relacionesTitular.find(
        (registro) => GET_MEMBERSHIP_ID(registro) !== null
      ) ||
      null
    );
  }, [beneficiarios, formData.id_usuario, initialData.id_usuario, initialData.id]);

  const obtenerNombreMembresia = (idMembresia, referencia = null) => {
    const fuente = membresiasDisponibles.length
      ? membresiasDisponibles
      : membresias;
    const targetId = TO_NUMBER(idMembresia) ?? GET_MEMBERSHIP_ID(referencia);

    if (targetId !== null) {
      const membresia = fuente.find((m) => GET_MEMBERSHIP_ID(m) === targetId);
      const nombreDesdeLista = GET_MEMBERSHIP_NAME(membresia);
      if (nombreDesdeLista) return nombreDesdeLista;
    }

    const nombreDirecto = GET_MEMBERSHIP_NAME(referencia);
    if (nombreDirecto) return nombreDirecto;

    return targetId !== null ? `Membresía ${targetId}` : "Sin membresía asociada";
  };

  const membresiaPrincipalNombre = useMemo(() => {
    const fuente = membresiasDisponibles.length
      ? membresiasDisponibles
      : membresias;
    const idPosible =
      GET_MEMBERSHIP_ID(initialData) ?? GET_MEMBERSHIP_ID(membresiaDesdeRelaciones);
    const nombreDirecto =
      GET_MEMBERSHIP_NAME(initialData) ??
      GET_MEMBERSHIP_NAME(membresiaDesdeRelaciones);

    if (idPosible !== null) {
      const encontrado = fuente.find((m) => GET_MEMBERSHIP_ID(m) === idPosible);
      if (encontrado) {
        return GET_MEMBERSHIP_NAME(encontrado) || `Membresía ${idPosible}`;
      }
      return nombreDirecto || `Membresía ${idPosible}`;
    }

    return nombreDirecto;
  }, [initialData, membresias, membresiasDisponibles, membresiaDesdeRelaciones]);

  const resolverIdMembresiaTitular = useCallback(
    (idTitularRaw) => {
      const idTitular = toPositiveInt(idTitularRaw);
      if (!idTitular) return null;

      const relacionesTitular = beneficiarios.filter(
        (registro) => TO_NUMBER(registro?.id_usuario) === idTitular
      );

      const registroConMembresia =
        relacionesTitular.find(
          (registro) =>
            TO_NUMBER(registro?.id_relacion) === idTitular &&
            GET_MEMBERSHIP_ID(registro) !== null
        ) ||
        relacionesTitular.find(
          (registro) => GET_MEMBERSHIP_ID(registro) !== null
        ) ||
        null;

      return (
        GET_MEMBERSHIP_ID(registroConMembresia) ??
        GET_MEMBERSHIP_ID(initialData)
      );
    },
    [beneficiarios, initialData]
  );

  const manejarEliminarBeneficiario = async (beneficiario) => {
    try {
      await eliminarBeneficiario(beneficiario.id_beneficiario);
      toast.success("Beneficiario eliminado exitosamente");
      onRefreshBeneficiarios();
    } catch (error) {
      console.error("Error al eliminar beneficiario:", error);
      toast.error(error.message || "Error al eliminar el beneficiario");
      throw error;
    }
  };

  const abrirModalEliminarBeneficiario = (beneficiario) => {
    if (!beneficiario) return;
    setBeneficiarioAEliminar(beneficiario);
    setIsDeleteBeneficiarioModalOpen(true);
  };

  const cerrarModalEliminarBeneficiario = () => {
    setIsDeleteBeneficiarioModalOpen(false);
    setBeneficiarioAEliminar(null);
  };

  const handleNumericOnlyKeyDown = (e) => {
    // Permitir teclas de control (backspace, delete, tab, escape, enter, etc.)
    const controlKeys = [
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "Enter",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
    ];
    if (controlKeys.includes(e.key)) return;

    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Z
    if (e.ctrlKey && ["a", "c", "v", "x", "z"].includes(e.key.toLowerCase()))
      return;

    // Solo permitir dígitos (0-9)
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setRelationErrors({});
  }, [isOpen]);

  const validateClientForm = useCallback((data) => {
    const { errors: nextErrors } = validarCliente(
      data,
      Boolean(data.id_usuario)
    );
    const emergencyPhone = String(data.c_emergencia || "").replace(/\D/g, "");

    if (!String(data.fecha_nacimiento || "").trim()) {
      nextErrors.fecha_nacimiento = "Debe seleccionar una fecha de nacimiento";
    }

    if (!String(data.n_emergencia || "").trim()) {
      nextErrors.n_emergencia = "Debe indicar un contacto de emergencia";
    }

    if (!emergencyPhone) {
      nextErrors.c_emergencia = "El teléfono de emergencia es obligatorio";
    } else if (emergencyPhone.length !== 10) {
      nextErrors.c_emergencia = "Debe tener 10 dígitos";
    }

    return nextErrors;
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;
    const normalizedValue =
      name === "documento"
        ? String(nextValue).replace(/\D/g, "").slice(0, DOCUMENTO_MAX_LENGTH)
        : nextValue;
    const nextData = {
      ...formData,
      [name]: normalizedValue,
    };

    setFormData(nextData);
    setErrors(validateClientForm(nextData));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disabled || modoRelacionManual || isSubmitting) return;
    const nextErrors = validateClientForm(formData);
    const documentoDigits = String(formData.documento || "").replace(/\D/g, "");
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await runGuardedSubmit(async () => {
      try {
        const rolIdFinal =
          formData.id_usuario && initialRolId ? initialRolId : formData.rol_id;

        const clienteParaGuardar = {
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
          password: formData.password,
          enfermedades: formData.enfermedades,
          id_estado: formData.id_estado,
          ...(rolIdFinal ? { rol_id: rolIdFinal } : {}),
          ...(formData.id_usuario && { id_usuario: formData.id_usuario }),
        };

        const resultado = await onSave(clienteParaGuardar);
        if (resultado === false) {
          throw new Error(
            formData.id_usuario
              ? "No se pudo actualizar el cliente"
              : "No se pudo crear el cliente"
          );
        }

        // Agregar automaticamente a beneficiarios (self-beneficiario) si no existe
        const userId =
          resultado?.id_usuario ||
          resultado?.id ||
          formData.id_usuario ||
          initialData.id_usuario;

        const membershipId =
          [
            resultado?.id_membresia,
            resultado?.id_membresias,
            initialData?.id_membresia,
            initialData?.id_membresias,
            initialData?.membresia?.id_membresia,
            initialData?.membresia?.id_membresias,
          ]
            .map((v) => Number(v))
            .find((n) => Number.isInteger(n) && n > 0) || null;

        const yaEsBeneficiario = beneficiarios.some(
          (b) =>
            Number(b.id_usuario) === Number(userId) &&
            Number(b.id_relacion) === Number(userId)
        );

        if (userId && !yaEsBeneficiario) {
          if (!membershipId) {
            console.warn(
              "Salta creación automática de beneficiario: sin membresía activa"
            );
          } else {
            try {
              await crearBeneficiario({
                id_usuario: Number(userId),
                id_relacion: Number(userId),
                id_membresia: membershipId,
              });
              onRefreshBeneficiarios();
            } catch (err) {
              console.error("No se pudo crear beneficiario automático", err);
              const msg =
                err?.response?.data?.message ||
                err?.message ||
                "No se pudo agregar al beneficiario automáticamente";
              toast.error(msg);
            }
          }
        }

        toast.success(
          formData.id_usuario
            ? "Cliente actualizado exitosamente"
            : "Cliente creado exitosamente"
        );
        onClose();
      } catch (error) {
        console.error("Error al procesar el formulario:", error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "No se pudo guardar el cliente"
        );
      }
    });
  };

  const usuariosBeneficiariosElegibles = useMemo(
    () =>
      usuariosClientesDisponibles.filter((usuario) => {
        const userId = TO_NUMBER(usuario?.id);
        const rolId = TO_NUMBER(usuario?.rol_id);
        if (rolId !== CLIENT_ROLE_ID) return false;
        if (userId === null) return false;
        return !idsYaBeneficiariosDeOtroTitular.has(userId);
      }),
    [usuariosClientesDisponibles, idsYaBeneficiariosDeOtroTitular]
  );

  const idsBeneficiariosSeleccionados = useMemo(
    () =>
      new Set(
        beneficiariosSeleccionados
          .map((usuario) => TO_NUMBER(usuario?.id))
          .filter((id) => id !== null)
      ),
    [beneficiariosSeleccionados]
  );

  const usuariosFiltradosTitular = usuariosClientesDisponibles
    .filter((usuario) => {
      if (!busquedaTitular) return false;
      return MATCHES_USER_SEARCH(usuario, busquedaTitular);
    })
    .slice(0, 8);

  const usuariosFiltradosBeneficiario = usuariosBeneficiariosElegibles
    .filter(
      (usuario) => !idsBeneficiariosSeleccionados.has(TO_NUMBER(usuario?.id))
    )
    .filter((usuario) => {
      if (!busquedaBeneficiario) return false;
      return MATCHES_USER_SEARCH(usuario, busquedaBeneficiario);
    })
    .slice(0, 8);

  const hayBeneficiariosElegibles = usuariosBeneficiariosElegibles.length > 0;

  const seleccionarTitular = (usuario) => {
    setTitularSeleccionado(usuario);
    setBusquedaTitular(
      usuario?.email ? `${usuario.nombre} (${usuario.email})` : usuario.nombre
    );
    setMostrarDropdownTitular(false);
    setRelationErrors((prev) => ({ ...prev, titular: "" }));
  };

  const quitarTitularSeleccionado = () => {
    setTitularSeleccionado(null);
    setBusquedaTitular("");
  };

  const seleccionarBeneficiario = (usuario) => {
    const userId = TO_NUMBER(usuario?.id);
    if (userId === null) return;

    setBeneficiariosSeleccionados((prev) => {
      if (prev.some((item) => TO_NUMBER(item?.id) === userId)) {
        return prev;
      }
      return [...prev, usuario];
    });

    setBusquedaBeneficiario("");
    setMostrarDropdownBeneficiario(false);
    setRelationErrors((prev) => ({ ...prev, beneficiario: "" }));
  };

  const quitarBeneficiarioSeleccionado = (userId) => {
    const targetId = TO_NUMBER(userId);
    setBeneficiariosSeleccionados((prev) =>
      prev.filter((usuario) => TO_NUMBER(usuario?.id) !== targetId)
    );
  };

  const handleCrearBeneficiario = async () => {
    setRelationErrors({});
    const titularParaRelacion = modoRelacionManual
      ? titularSeleccionado
      : titularAutoseleccionado;

    if (!titularParaRelacion) {
      setRelationErrors({
        titular: "Debe seleccionar un titular para relacionar beneficiarios",
      });
      return;
    }

    if (beneficiariosSeleccionados.length === 0) {
      setRelationErrors({
        beneficiario: "Debe seleccionar al menos un beneficiario",
      });
      return;
    }

    const titularId = TO_NUMBER(titularParaRelacion?.id);

    if (titularId === null) {
      setRelationErrors({
        titular: "No se pudo identificar el titular seleccionado",
      });
      return;
    }

    const idMembresiaTitular = resolverIdMembresiaTitular(titularId);
    if (!idMembresiaTitular) {
      setRelationErrors({
        beneficiario:
          "El titular debe tener una membresía antes de agregar beneficiarios",
      });
      return;
    }

    const erroresValidacion = [];
    const payloads = [];
    const idsPendientes = new Set();

    beneficiariosSeleccionados.forEach((usuario) => {
      const beneficiarioId = TO_NUMBER(usuario?.id);
      const nombreBeneficiario = usuario?.nombre || `ID ${beneficiarioId ?? "N/A"}`;

      if (beneficiarioId === null) {
        erroresValidacion.push(
          `No se pudo identificar el beneficiario seleccionado: ${nombreBeneficiario}`
        );
        return;
      }

      if (idsPendientes.has(beneficiarioId)) return;
      idsPendientes.add(beneficiarioId);

      if (titularId === beneficiarioId) {
        erroresValidacion.push(
          `${nombreBeneficiario} no puede ser beneficiario de si mismo`
        );
        return;
      }

      if (TO_NUMBER(usuario?.rol_id) !== CLIENT_ROLE_ID) {
        erroresValidacion.push(
          `${nombreBeneficiario} no tiene rol cliente y no puede ser beneficiario`
        );
        return;
      }

      const yaEsBeneficiarioDeOtroTitular = beneficiarios.some((registro) => {
        const idTitularRegistro = TO_NUMBER(registro?.id_usuario);
        const idBeneficiarioRegistro = TO_NUMBER(registro?.id_relacion);
        if (idTitularRegistro === null || idBeneficiarioRegistro === null) return false;
        return (
          idBeneficiarioRegistro === beneficiarioId &&
          idTitularRegistro !== beneficiarioId
        );
      });

      if (yaEsBeneficiarioDeOtroTitular) {
        erroresValidacion.push(
          `${nombreBeneficiario} ya es beneficiario de otro titular`
        );
        return;
      }

      const relacionDuplicada = beneficiarios.some((registro) => {
        const idTitularRegistro = TO_NUMBER(registro?.id_usuario);
        const idBeneficiarioRegistro = TO_NUMBER(registro?.id_relacion);
        return (
          idTitularRegistro === titularId && idBeneficiarioRegistro === beneficiarioId
        );
      });

      if (relacionDuplicada) {
        erroresValidacion.push(
          `${nombreBeneficiario} ya está relacionado con el titular seleccionado`
        );
        return;
      }

      payloads.push({
        id_usuario: titularId,
        id_relacion: beneficiarioId,
      });
    });

    if (payloads.length === 0) {
      setRelationErrors({
        beneficiario:
          erroresValidacion[0] ||
          "No hay beneficiarios válidos para crear la relación con el titular",
      });
      return;
    }

    try {
      setCreandoBeneficiario(true);
      const resultados = await Promise.allSettled(
        payloads.map((payload) => crearBeneficiario(payload))
      );

      const exitos = resultados.filter((resultado) => resultado.status === "fulfilled")
        .length;
      const fallos = resultados.length - exitos;

      if (exitos > 0) {
        toast.success(
          exitos === 1
            ? "Beneficiario agregado correctamente al titular seleccionado."
            : `Se agregaron ${exitos} beneficiarios al titular seleccionado.`
        );
        onRefreshBeneficiarios();
      }

      if (fallos > 0) {
        const primerError = resultados.find(
          (resultado) => resultado.status === "rejected"
        )?.reason;
        const detalle =
          primerError?.response?.data?.message ||
          primerError?.message ||
          "Ocurrió un error al crear algunas relaciones.";

        toast.error(
          fallos === 1
            ? `No se pudo agregar 1 beneficiario. ${detalle}`
            : `No se pudieron agregar ${fallos} beneficiarios. ${detalle}`
        );
      }

      if (erroresValidacion.length > 0) {
        setRelationErrors({
          beneficiario: erroresValidacion[0],
        });
        toast.error(
          erroresValidacion.length === 1
            ? erroresValidacion[0]
            : `Se omitieron ${erroresValidacion.length} beneficiarios por validaciones de datos.`
        );
      }

      setBeneficiariosSeleccionados([]);
      setBusquedaBeneficiario("");
      if (erroresValidacion.length === 0) {
        setRelationErrors({});
      }
    } catch (error) {
      console.error("Error detallado al crear beneficiario:", {
        error,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        config: error.config,
      });
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Error al crear beneficiarios"
      );
    } finally {
      setCreandoBeneficiario(false);
    }
  };

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        setCargandoUsuarios(true);
        const [clientesResponse, noClientesResponse] = await Promise.all([
          cargarTodosLosUsuarios(obtenerUsuariosClientes),
          cargarTodosLosUsuarios(obtenerUsuariosNoClientes),
        ]);
        setUsuariosClientesDisponibles(
          clientesResponse
            .map((usuario) => normalizarUsuario(usuario, CLIENT_ROLE_ID))
            .filter((usuario) => usuario.id !== null)
        );
        setUsuariosNoClientesDisponibles(
          noClientesResponse
            .map((usuario) => normalizarUsuario(usuario))
            .filter((usuario) => usuario.id !== null)
        );
      } catch (error) {
        console.error("Error cargando usuarios para beneficiarios:", error);
        setUsuariosClientesDisponibles([]);
        setUsuariosNoClientesDisponibles([]);
      } finally {
        setCargandoUsuarios(false);
      }
    };

    cargarUsuarios();
  }, [cargarTodosLosUsuarios, normalizarUsuario]);

  useEffect(() => {
    if (!isOpen) return;
    const token = (() => {
      try {
        return localStorage.getItem("token") || undefined;
      } catch {
        return undefined;
      }
    })();

    const cargarMembresias = async () => {
      try {
        setCargandoMembresias(true);
        const resp = await getMembresias({ token });
        const lista = Array.isArray(resp?.data)
          ? resp.data
          : Array.isArray(resp)
          ? resp
          : [];
        const normalizadas = lista
          .map((m) => {
            const id = Number(m?.id_membresia ?? m?.id_membresias ?? m?.id);
            if (!id || Number.isNaN(id)) return null;
            return {
              ...m,
              id_membresia: id,
              nombre_membresia:
                m?.nombre_membresia ?? m?.nombre ?? `Membresía ${id}`,
            };
          })
          .filter(Boolean);
        setMembresiasDisponibles(normalizadas);
      } catch {
        setMembresiasDisponibles([]);
      } finally {
        setCargandoMembresias(false);
      }
    };

    cargarMembresias();
  }, [isOpen]);

  const renderSelectorTitular = () => (
    <div>
      <label className="modal-clientes__label">Usuario Titular</label>
      {titularSeleccionado ? (
        <div className="modal-clientes__selected-user">
          <div className="modal-clientes__selected-user-info">
            <div className="modal-clientes__selected-user-name">
              {titularSeleccionado.nombre}
            </div>
            <div className="modal-clientes__selected-user-email">
              {titularSeleccionado.email}
            </div>
          </div>
          <button
            type="button"
            onClick={quitarTitularSeleccionado}
            className="modal-clientes__clear-selection-btn"
            title="Quitar titular"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="modal-clientes__search-wrapper">
          <div
            className={`modal-clientes__search-box ${
              relationErrors.titular ? "modal-clientes__input--error" : ""
            }`}
          >
            <Search size={18} className="modal-clientes__search-icon" />
            <input
              type="text"
              placeholder="Buscar usuario titular por nombre, email o documento..."
              value={busquedaTitular}
              onChange={(e) => {
                setBusquedaTitular(e.target.value);
                setMostrarDropdownTitular(true);
                setRelationErrors((prev) => ({ ...prev, titular: "" }));
              }}
              className="modal-clientes__search-input"
            />
          </div>
          {relationErrors.titular ? (
            <p className="modal-clientes__error-text">{relationErrors.titular}</p>
          ) : null}
          {mostrarDropdownTitular && busquedaTitular && (
            <div className="modal-clientes__search-dropdown">
              {cargandoUsuarios ? (
                <div className="modal-clientes__search-message">
                  Buscando usuarios...
                </div>
              ) : usuariosFiltradosTitular.length > 0 ? (
                usuariosFiltradosTitular.map((usuario) => (
                  <div
                    key={usuario.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      seleccionarTitular(usuario);
                    }}
                    className="modal-clientes__search-option"
                  >
                    <div className="modal-clientes__search-option-name">
                      {usuario.nombre}
                    </div>
                    <div className="modal-clientes__search-option-email">
                      {usuario.email}
                    </div>
                    {GET_USER_DOCUMENT_LABEL(usuario) ? (
                      <div className="modal-clientes__search-option-email">
                        {GET_USER_DOCUMENT_LABEL(usuario)}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="modal-clientes__search-message">
                  No se encontraron usuarios
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderSelectorBeneficiario = () => (
    <div>
      <label className="modal-clientes__label">Usuario Beneficiario</label>
      {beneficiariosSeleccionados.length > 0 ? (
        <div className="modal-clientes__selected-users-list">
          {beneficiariosSeleccionados.map((usuario) => (
            <div key={usuario.id} className="modal-clientes__selected-user">
              <div className="modal-clientes__selected-user-info">
                <div className="modal-clientes__selected-user-name">
                  {usuario.nombre}
                </div>
                <div className="modal-clientes__selected-user-email">
                  {usuario.email}
                </div>
                {GET_USER_DOCUMENT_LABEL(usuario) ? (
                  <div className="modal-clientes__selected-user-email">
                    {GET_USER_DOCUMENT_LABEL(usuario)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => quitarBeneficiarioSeleccionado(usuario.id)}
                className="modal-clientes__clear-selection-btn"
                title="Quitar beneficiario"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="modal-clientes__search-wrapper">
        <div
          className={`modal-clientes__search-box ${
            relationErrors.beneficiario ? "modal-clientes__input--error" : ""
          }`}
        >
          <Search size={18} className="modal-clientes__search-icon" />
          <input
            type="text"
            placeholder={`Buscar beneficiario (rol ${CLIENT_ROLE_ID}) por nombre, email o documento...`}
            value={busquedaBeneficiario}
            onChange={(e) => {
              setBusquedaBeneficiario(e.target.value);
              setMostrarDropdownBeneficiario(true);
              setRelationErrors((prev) => ({ ...prev, beneficiario: "" }));
            }}
            className="modal-clientes__search-input"
          />
        </div>
        {relationErrors.beneficiario ? (
          <p className="modal-clientes__error-text">
            {relationErrors.beneficiario}
          </p>
        ) : null}
        {mostrarDropdownBeneficiario && busquedaBeneficiario && (
          <div className="modal-clientes__search-dropdown">
            {cargandoUsuarios ? (
              <div className="modal-clientes__search-message">
                Buscando usuarios...
              </div>
            ) : usuariosFiltradosBeneficiario.length > 0 ? (
              usuariosFiltradosBeneficiario.map((usuario) => (
                <div
                  key={usuario.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    seleccionarBeneficiario(usuario);
                  }}
                  className="modal-clientes__search-option"
                >
                  <div className="modal-clientes__search-option-name">
                    {usuario.nombre}
                  </div>
                  <div className="modal-clientes__search-option-email">
                    {usuario.email}
                  </div>
                  {GET_USER_DOCUMENT_LABEL(usuario) ? (
                    <div className="modal-clientes__search-option-email">
                      {GET_USER_DOCUMENT_LABEL(usuario)}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="modal-clientes__search-message">
                {hayBeneficiariosElegibles
                  ? "No se encontraron usuarios"
                  : `No hay usuarios con rol ${CLIENT_ROLE_ID} disponibles para asignar`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  if (modoRelacionManual) {
    const manualFooter = (
      <>
        <button
          type="button"
          className="boton boton-primario"
          onClick={handleCrearBeneficiario}
          disabled={creandoBeneficiario}
        >
          {creandoBeneficiario
            ? "Agregando..."
            : beneficiariosSeleccionados.length > 1
            ? "Agregar Beneficiarios"
            : "Agregar Beneficiario"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="boton boton-secundario"
        >
          Cerrar
        </button>
      </>
    );

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        size="md"
        footer={manualFooter}
      >
        <Motion.div
          className="modal-clientes__stack"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Motion.div
            className="modal-clientes__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <h3 className="modal-clientes__section-title">Crear Beneficiario</h3>
            <div className="modal-clientes__stack">
              {renderSelectorTitular()}
              {renderSelectorBeneficiario()}
            </div>
          </Motion.div>

        </Motion.div>
      </Modal>
    );
  }

  const formId = "modal-clientes-form";
  const footer = !disabled ? (
    <>
      <button
        type="button"
        onClick={onClose}
        className="boton boton-secundario"
      >
        Cancelar
      </button>
      {formData.id_usuario && (
        <button
          type="button"
          className="boton boton-primario"
          onClick={handleCrearBeneficiario}
          disabled={creandoBeneficiario}
        >
          {creandoBeneficiario
            ? "Agregando..."
            : beneficiariosSeleccionados.length > 1
            ? "Agregar Beneficiarios"
            : "Agregar Beneficiario"}
        </button>
      )}
      <button
        type="submit"
        form={formId}
        className="boton boton-primario"
        disabled={disabled || isSubmitting}
      >
        Guardar
      </button>
    </>
  ) : null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        size="md"
        footer={footer}
      >
        <Motion.form
          id={formId}
          onSubmit={handleSubmit}
          className="modal-clientes__form"
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
          className="modal-clientes__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
        >
          <h3 className="modal-clientes__section-title">Información Básica</h3>
          <div className="modal-clientes__grid">
            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Nombre</label>
              <input
                type="text"
                name="nombre_usuario"
                value={formData.nombre_usuario}
                onChange={handleChange}
                disabled={disabled}
                required
                className={`modal-clientes__input ${
                  errors.nombre_usuario ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.nombre_usuario ? (
                <p className="modal-clientes__error-text">
                  {errors.nombre_usuario}
                </p>
              ) : null}
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Apellido</label>
              <input
                type="text"
                name="apellido_usuario"
                value={formData.apellido_usuario}
                onChange={handleChange}
                disabled={disabled}
                required
                className={`modal-clientes__input ${
                  errors.apellido_usuario ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.apellido_usuario ? (
                <p className="modal-clientes__error-text">
                  {errors.apellido_usuario}
                </p>
              ) : null}
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Tipo de Documento</label>
              <select
                name="tipo_documento"
                value={formData.tipo_documento}
                onChange={handleChange}
                disabled={disabled}
                required
                className="modal-clientes__input modal-clientes__select"
              >
                <option value="DPI">DPI</option>
                <option value="TARJETA_IDENTIDAD">Tarjeta de Identidad</option>
                <option value="CEDULA">Cédula</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="LICENCIA">Licencia</option>
              </select>
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Número de Documento</label>
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
                className={`modal-clientes__input ${
                  errors.documento ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.documento ? (
                <p className="modal-clientes__error-text">{errors.documento}</p>
              ) : null}
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Fecha de Nacimiento</label>
              <input
                type="date"
                name="fecha_nacimiento"
                value={formData.fecha_nacimiento}
                onChange={handleChange}
                disabled={disabled}
                required
                className={`modal-clientes__input ${
                  errors.fecha_nacimiento ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.fecha_nacimiento ? (
                <p className="modal-clientes__error-text">
                  {errors.fecha_nacimiento}
                </p>
              ) : null}
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Género</label>
              <select
                name="genero"
                value={formData.genero}
                onChange={handleChange}
                disabled={disabled}
                required
                className="modal-clientes__input modal-clientes__select"
              >
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="O">Otro</option>
              </select>
            </div>
          </div>
        </Motion.div>

        <Motion.div
          className="modal-clientes__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.35 }}
        >
          <h3 className="modal-clientes__section-title">Contacto y Acceso</h3>
          <div className="modal-clientes__grid">
            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={disabled}
                required
                className={`modal-clientes__input ${
                  errors.email ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.email ? (
                <p className="modal-clientes__error-text">{errors.email}</p>
              ) : null}
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Teléfono</label>
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                onKeyDown={handleNumericOnlyKeyDown}
                disabled={disabled}
                required
                className={`modal-clientes__input ${
                  errors.telefono ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.telefono ? (
                <p className="modal-clientes__error-text">{errors.telefono}</p>
              ) : null}
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Contacto de Emergencia (Nombre)</label>
              <input
                type="text"
                name="n_emergencia"
                value={formData.n_emergencia}
                onChange={handleChange}
                disabled={disabled}
                required
                className={`modal-clientes__input ${
                  errors.n_emergencia ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.n_emergencia ? (
                <p className="modal-clientes__error-text">
                  {errors.n_emergencia}
                </p>
              ) : null}
            </div>

            <div className="modal-clientes__field">
              <label className="modal-clientes__label">Teléfono de Emergencia</label>
              <input
                type="tel"
                name="c_emergencia"
                value={formData.c_emergencia}
                onChange={handleChange}
                onKeyDown={handleNumericOnlyKeyDown}
                disabled={disabled}
                required
                className={`modal-clientes__input ${
                  errors.c_emergencia ? "modal-clientes__input--error" : ""
                }`}
              />
              {errors.c_emergencia ? (
                <p className="modal-clientes__error-text">
                  {errors.c_emergencia}
                </p>
              ) : null}
            </div>

            {!formData.id_usuario && (
              <>
                <div className="modal-clientes__field">
                  <label className="modal-clientes__label">Contraseña</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={disabled}
                    required={!formData.id_usuario}
                    minLength="8"
                    pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+"
                    title="Mínimo 8 caracteres, con mayuscula, minuscula, número y caracter especial"
                    placeholder="Mínimo 8 caracteres"
                    className={`modal-clientes__input ${
                      errors.password ? "modal-clientes__input--error" : ""
                    }`}
                  />
                  {errors.password ? (
                    <p className="modal-clientes__error-text">{errors.password}</p>
                  ) : null}
                </div>

                <div className="modal-clientes__field">
                  <label className="modal-clientes__label">Confirmar Contraseña</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={disabled}
                    required={!formData.id_usuario}
                    minLength="8"
                    placeholder="Repita la contraseña"
                    className={`modal-clientes__input ${
                      errors.confirmPassword
                        ? "modal-clientes__input--error"
                        : ""
                    }`}
                  />
                  {errors.confirmPassword ? (
                    <p className="modal-clientes__error-text">
                      {errors.confirmPassword}
                    </p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </Motion.div>

        <Motion.div
          className="modal-clientes__card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <h3 className="modal-clientes__section-title">Información Adicional</h3>
          <div className="modal-clientes__field">
            <label className="modal-clientes__label">Enfermedades o Alergias</label>
            <textarea
              name="enfermedades"
              value={formData.enfermedades}
              onChange={handleChange}
              disabled={disabled}
              rows="3"
              placeholder="Indique si tiene alguna condición médica o alergia"
              className="modal-clientes__input modal-clientes__textarea"
            />
          </div>
        </Motion.div>

        {formData.id_usuario && (
          <Motion.div
            className="modal-clientes__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.35 }}
          >
            <h3 className="modal-clientes__section-title">Membresía</h3>
            <p className="modal-clientes__membership-text">
              {cargandoMembresias
                ? "Cargando membresía..."
                : membresiaPrincipalNombre || "Sin membresía asociada"}
            </p>
          </Motion.div>
        )}

        {formData.id_usuario && (
          <Motion.div
            className="modal-clientes__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
          >
            <div className="modal-clientes__beneficiarios-header">
              <h3 className="modal-clientes__section-title">
                Beneficiarios ({beneficiariosDelCliente.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowBeneficiarios(!showBeneficiarios)}
                className="modal-clientes__toggle-beneficiarios-btn"
              >
                {showBeneficiarios ? <EyeOff size={16} /> : <Eye size={16} />}
                {showBeneficiarios ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {showBeneficiarios && (
              <div>
                {beneficiariosDelCliente.length === 0 ? (
                  <p className="modal-clientes__empty-text">
                    No hay beneficiarios registrados para este cliente
                  </p>
                ) : (
                  <div className="modal-clientes__beneficiarios-list">
                    {beneficiariosDelCliente.map((beneficiario) => {
                      const datosRelacion = obtenerDatosRelacion(beneficiario);
                      return (
                        <div
                          key={beneficiario.id_beneficiario}
                          className="modal-clientes__beneficiario-item"
                        >
                          <div>
                            <p className="modal-clientes__beneficiario-name">
                              Beneficiario: {datosRelacion.nombre}
                            </p>
                            {datosRelacion.email ? (
                              <p className="modal-clientes__beneficiario-detail">
                                Correo: {datosRelacion.email}
                              </p>
                            ) : null}
                            <p className="modal-clientes__beneficiario-detail modal-clientes__beneficiario-detail--last">
                              Membresía:{" "}
                              {obtenerNombreMembresia(
                                beneficiario?.id_membresia,
                                beneficiario
                              )}
                            </p>
                          </div>
                          {!disabled && (
                            <button
                              type="button"
                              onClick={() =>
                                abrirModalEliminarBeneficiario(beneficiario)
                              }
                              className="modal-clientes__delete-beneficiario-btn"
                            >
                              <Trash2 size={14} />
                              Eliminar
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Motion.div>
        )}

        {formData.id_usuario && !disabled && (
          <Motion.div
            className="modal-clientes__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.35 }}
          >
            <h3 className="modal-clientes__section-title">Crear Beneficiario</h3>
            <div
              className="modal-clientes__stack"
            >
              <div>
                <label className="modal-clientes__label">Usuario Titular</label>
                <div className="modal-clientes__selected-user">
                  <div className="modal-clientes__selected-user-info">
                    <div className="modal-clientes__selected-user-name">
                      {titularAutoseleccionado?.nombre}
                    </div>
                    <div className="modal-clientes__selected-user-email">
                      {titularAutoseleccionado?.email
                        ? titularAutoseleccionado.email
                        : `ID: ${titularAutoseleccionado?.id}`}
                    </div>
                  </div>
                </div>
              </div>

              {renderSelectorBeneficiario()}
            </div>
          </Motion.div>
        )}

        </Motion.div>
        </Motion.form>
      </Modal>

      {beneficiarioAEliminar && (
        <DeleteModal
          isOpen={isDeleteBeneficiarioModalOpen}
          onClose={cerrarModalEliminarBeneficiario}
          onConfirm={manejarEliminarBeneficiario}
          item={beneficiarioAEliminar}
          title="Eliminar Beneficiario"
          fields={[
            {
              key: "id_relacion",
              label: "Beneficiario",
              format: (_value, item) => {
                const datos = obtenerDatosRelacion(item);
                return <strong>{datos.nombre}</strong>;
              },
            },
            {
              key: "id_relacion",
              label: "Correo",
              format: (_value, item) => {
                const datos = obtenerDatosRelacion(item);
                return datos.email || "Sin correo electrónico";
              },
            },
            {
              key: "id_membresia",
              label: "Membresía",
              format: (_value, item) =>
                obtenerNombreMembresia(item?.id_membresia, item),
            },
          ]}
          warningMessage="Esta acción no se puede deshacer. Se eliminara la relación del beneficiario con el titular."
        />
      )}
    </>
  );
};

BaseClienteModal.propTypes = {
  title: PropTypes.string.isRequired,
  initialData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  disabled: PropTypes.bool,
  showTabs: PropTypes.bool,
  isOpen: PropTypes.bool,
  roles: PropTypes.array,
  beneficiarios: PropTypes.array,
  membresias: PropTypes.array,
  onRefreshBeneficiarios: PropTypes.func,
  modoRelacionManual: PropTypes.bool,
};

export default BaseClienteModal;
