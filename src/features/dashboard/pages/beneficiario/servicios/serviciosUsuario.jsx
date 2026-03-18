import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  IconHome,
  IconUser,
  IconChartBar,
  IconCalendarEvent,
  IconClipboardList,
  IconStar,
  IconArrowRight,
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconShoppingCart,
} from "@tabler/icons-react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { obtenerServicios } from "../../../hooks/Servicios_API/Servicios_API";
import {
  obtenerBeneficiariosMios,
} from "../../../hooks/Beneficiario_API.jsx/Beneficiario_API";
import {
  obtenerBeneficiarios as obtenerBeneficiariosGlobal,
  eliminarBeneficiario,
} from "../../../hooks/Beneficiarios_API/benefeiciarios_API";
import { getMembresias } from "../../../hooks/Membresia_API/Membresia";
import { useCarrito } from "../../../../../shared/components/Carrito/carritoContext";
import CarritoCompras from "../../../../../shared/components/Carrito/carrito";
import toast from "react-hot-toast";
import { getCurrentUser } from "../../../hooks/Acceder_API/authService";
import Modal from "../../../../../shared/components/Modal/Modal";
import { buildUrl } from "../../../hooks/apiConfig";
import "../../../../../shared/styles/restructured/pages/servicios-usuario-page.css";

const URL_VENTAS_USUARIO = buildUrl("/ventas/usuario");

const ServiciosUsuario = () => {
  const carritoCtx = useCarrito?.() ?? {};
  const {
    cantidadTotal,
    agregarProducto,
    addItem,
    addToCart,
    agregarAlCarrito,
  } = carritoCtx;
  const MEMBERSHIP_DETAILS = {
    Basica: {
      descripcion: "Acceso esencial al gimnasio.",
      longDescription:
        "Incluye acceso a mquinas de cardio y pesas en horario regular.",
      duracion: "30 das",
      precio: "COP $0",
    },
    General: {
      descripcion: "Incluye clases grupales.",
      longDescription:
        "Acceso completo al gimnasio, clases grupales y soporte bsico.",
      duracion: "30 das",
      precio: "COP $0",
    },
    Premium: {
      descripcion: "Experiencia completa con extras.",
      longDescription:
        "Incluye todo lo de General ms entrenamientos personalizados y beneficios exclusivos.",
      duracion: "30 das",
      precio: "COP $0",
    },
  };

  const buildEmptyMembresiaEstado = (source = "") => ({
    loading: false,
    status: "none",
    source,
    nombre: "",
    fecha: "",
    fecha_asignacion: "",
    fecha_vencimiento: "",
    fechaAsignacion: "",
    fechaVencimiento: "",
    estadoTexto: "",
    descripcion: "",
    precio: null,
    duracionDias: null,
    serviciosIds: [],
    idMembresia: null,
    idBeneficiarioRegistro: null,
    idTitularBeneficiario: null,
    idRelacionBeneficiario: null,
  });

  const [modalOpen, setModalOpen] = React.useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState("Basica");
  const [membershipData, setMembershipData] = React.useState(() => {
    const saved = localStorage.getItem("membershipData");
    return saved
      ? JSON.parse(saved)
      : {
          serviciosDisponibles: 3,
          serviciosActivos: 1,
          tipoMembresia: "Basica",
          descripcion: MEMBERSHIP_DETAILS["Basica"]?.longDescription || "",
          duracion: MEMBERSHIP_DETAILS["Basica"]?.duracion || "",
          precio: MEMBERSHIP_DETAILS["Basica"]?.precio || "",
        };
  });
  const [usuarioId, setUsuarioId] = useState(null);
  const [serviciosData, setServiciosData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [membresiaEstado, setMembresiaEstado] = useState({
    ...buildEmptyMembresiaEstado(""),
    loading: true,
  });
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [benefLoading, setBenefLoading] = useState(false);
  const [benefError, setBenefError] = useState(null);
  const modalRef = useRef(null);
  const upgradeModalRef = useRef(null);
  const fabRef = useRef(null);
  const planesRef = useRef(null);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [fabBumpKey, setFabBumpKey] = useState(0);
  const [showPlanes, setShowPlanes] = useState(false);
  const [planes, setPlanes] = useState([]);
  const [planesLoading, setPlanesLoading] = useState(false);
  const [planesError, setPlanesError] = useState("");
  const [cancelandoMembresia, setCancelandoMembresia] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  useEffect(() => {
    // efecto bump del FAB cuando aumenta cantidad
    setFabBumpKey((k) => k + 1);
  }, [cantidadTotal]);

  useEffect(() => {
    if (showPlanes && planesRef.current) {
      setTimeout(() => {
        planesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
  }, [showPlanes]);

  const handleVerClick = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);
  const openCancelModal = () => setCancelModalOpen(true);
  const closeCancelModal = () => {
    if (cancelandoMembresia) return;
    setCancelModalOpen(false);
  };

  const formatCOP = (v) =>
    typeof v === "number"
      ? new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        }).format(v)
      : v;

  const getTier = (name = "") => {
    const n = String(name).toLowerCase();
    if (/(premium|oro|gold|pro)/.test(n)) return "premium";
    if (/(general|medio|medium|standard|estándar|estandar)/.test(n)) return "medio";
    if (/(básico|basico|starter|inicial)/.test(n)) return "basico";
    return "basico";
  };

  const loadPlanes = async () => {
    try {
      setPlanesLoading(true);
      setPlanesError("");
      const data = await getMembresias({ query: {} });
      const arr = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      const mapped = arr.map((it, idx) => {
        const idBackend =
          it.id_membresia ||
          it.id_membresias ||
          it.id ||
          it.id_membresia_fk ||
          it.id_membresia_pk ||
          idx;
        const name = it.nombre_membresia || it.nombre || "Plan";
        const priceNumber = Number(it.precio_venta || it.precio_de_venta || 0) || 0;
        const desc = String(it.descripcion_membresia || it.descripcion || "").trim();
        const features = desc
          ? desc
              .split(/[\n•\-\.]/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 4)
          : ["Acceso a instalaciones", "Clases grupales"];
        return {
          id: idBackend,
          name,
          price: formatCOP(priceNumber),
          priceRaw: priceNumber,
          tier: getTier(name),
          features,
        };
      });
      const tierOrder = { basico: 1, medio: 2, premium: 3 };
      const ordered = [...mapped].sort((a, b) => {
        const wa = tierOrder[a.tier] || 99;
        const wb = tierOrder[b.tier] || 99;
        if (wa !== wb) return wa - wb;
        return String(a.name || "").localeCompare(String(b.name || ""), "es", {
          sensitivity: "base",
        });
      });
      setPlanes(ordered);
    } catch (e) {
      setPlanes([]);
      setPlanesError("No se pudieron cargar las membresías");
      toast.error("No se pudieron cargar las membresías");
    } finally {
      setPlanesLoading(false);
    }
  };

  const normalizarTipoMembresia = (nombre = "") => {
    const n = nombre.toString().toLowerCase();
    if (n.includes("premium")) return "Premium";
    if (n.includes("general")) return "General";
    if (n.includes("elite")) return "Elite";
    if (n.includes("basica") || n.includes("básica")) return "Basica";
    return nombre || "Basica";
  };

  const getMembershipColor = (type) => {
    const t = normalizarTipoMembresia(type);
    if (t === "Premium") return "#C9A227";
    if (t === "General") return "#0F5132";
    if (t === "Basica") return "#1E3A8A";
    if (t === "Elite") return "#C9A227";
    return "#1E3A8A";
  };

  const softenColor = (hex = "#0ea5e9", alpha = 0.12) => {
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return `rgba(14,165,233,${alpha})`;
    const full = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    const r = parseInt(full.slice(1, 3), 16);
    const g = parseInt(full.slice(3, 5), 16);
    const b = parseInt(full.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const toPositiveNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const toPriceNumber = (value) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value === null || value === undefined || value === "") return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const normalized = raw.replace(/[^\d,.-]/g, "");
    if (!normalized) return null;
    const hasComma = normalized.includes(",");
    const hasDot = normalized.includes(".");
    let numericText = normalized;
    if (hasComma && hasDot) {
      if (numericText.lastIndexOf(",") > numericText.lastIndexOf(".")) {
        numericText = numericText.replace(/\./g, "").replace(",", ".");
      } else {
        numericText = numericText.replace(/,/g, "");
      }
    } else if (hasComma && !hasDot) {
      numericText = numericText.replace(",", ".");
    }
    const parsed = Number(numericText);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const resolveMembresiaId = (value = {}, { allowGenericId = false } = {}) => {
    if (!value || typeof value !== "object") return null;

    const directId = toPositiveNumber(
      value?.id_membresia ??
        value?.id_membresias ??
        value?.idMembresia ??
        value?.membresia_id ??
        value?.id_membresia_fk ??
        value?.id_membresia_pk
    );
    if (directId) return directId;

    const nestedId = toPositiveNumber(
      value?.id_membresia_membresia?.id_membresia ??
        value?.id_membresia_membresia?.id_membresias ??
        value?.membresia?.id_membresia ??
        value?.membresia?.id_membresias
    );
    if (nestedId) return nestedId;

    const nestedGenericId = toPositiveNumber(
      value?.id_membresia_membresia?.id ??
      value?.membresia?.id
    );
    if (nestedGenericId) return nestedGenericId;

    if (!allowGenericId) return null;
    return toPositiveNumber(value?.id);
  };

  const normalizeText = (value) => String(value ?? "").trim().toLowerCase();

  const normalizeEmail = (value) => {
    const mail = normalizeText(value);
    return mail.includes("@") ? mail : "";
  };

  const mergeServiciosIds = (first = [], second = []) => {
    const merged = [...(Array.isArray(first) ? first : []), ...(Array.isArray(second) ? second : [])]
      .map((id) => toPositiveNumber(id))
      .filter(Boolean);
    return Array.from(new Set(merged));
  };

  const resolveServiciosIds = (prevIds = [], nextIds = [], { overwrite = false } = {}) => {
    const prevNorm = mergeServiciosIds(prevIds, []);
    const nextNorm = mergeServiciosIds(nextIds, []);
    if (overwrite) return nextNorm.length ? nextNorm : prevNorm;
    if (!prevNorm.length) return nextNorm;
    if (!nextNorm.length) return prevNorm;
    return nextNorm.length > prevNorm.length ? nextNorm : prevNorm;
  };

  const addServicioIdToSet = (setRef, rawId) => {
    const id = toPositiveNumber(rawId);
    if (id) setRef.add(id);
  };

  const addServicioIdsFromDetalle = (setRef, detalle = {}) => {
    addServicioIdToSet(setRef, detalle?.id_servicio);
    addServicioIdToSet(setRef, detalle?.id_servicios);
    addServicioIdToSet(setRef, detalle?.id_servicio_servici);
    addServicioIdToSet(setRef, detalle?.id_servici);
    addServicioIdToSet(setRef, detalle?.servicio_id);
    addServicioIdToSet(setRef, detalle?.id_servicios_servicio);
    addServicioIdToSet(setRef, detalle?.id_servicio_obj?.id_servicio);
    addServicioIdToSet(setRef, detalle?.id_servicio_servici?.id_servicio);
    addServicioIdToSet(setRef, detalle?.id_servicio_servici?.id);
    addServicioIdToSet(setRef, detalle?.id_servicios_servicio?.id_servicio);
    addServicioIdToSet(setRef, detalle?.id_servicios_servicio?.id);
  };

  const addServicioIdsFromMembresia = (setRef, membresia = {}) => {
    const bloques = [
      membresia?.detalles_membresia,
      membresia?.detalles_membresias,
      membresia?.servicios_membresia,
      membresia?.servicios,
    ];
    bloques.forEach((bloque) => {
      if (!Array.isArray(bloque)) return;
      bloque.forEach((detalle) => addServicioIdsFromDetalle(setRef, detalle));
    });
  };

  const getServicioIdCandidates = (servicio = {}) =>
    mergeServiciosIds(
      [
        servicio?.id_servicio,
        servicio?.id_servicios,
        servicio?.servicio_id,
        servicio?.id_servicio_servici,
        servicio?.id_servici,
        servicio?.id_servicio_obj?.id_servicio,
        servicio?.id_servicio_servici?.id_servicio,
        servicio?.id_servicio_servici?.id,
        servicio?.id_servicios_servicio?.id_servicio,
        servicio?.id_servicios_servicio?.id,
        servicio?.id,
      ],
      []
    );

  const getServicioPrimaryId = (servicio = {}) =>
    mergeServiciosIds(
      [
        servicio?.id_servicio,
        servicio?.id_servicios,
        servicio?.servicio_id,
        servicio?.id_servicio_servici,
        servicio?.id_servici,
        servicio?.id_servicio_obj?.id_servicio,
        servicio?.id_servicio_servici?.id_servicio,
        servicio?.id_servicio_servici?.id,
        servicio?.id_servicios_servicio?.id_servicio,
        servicio?.id_servicios_servicio?.id,
      ],
      []
    )[0] || toPositiveNumber(servicio?.id);

  const buildBeneficiarioIdentityKey = (benef = {}) => {
    const relacionUsuario =
      benef.id_relacion_usuario ||
      benef.relacion_usuario ||
      benef.usuario_relacion ||
      {};
    const idRelacion = toPositiveNumber(
      benef.id_relacion ?? benef.id_beneficiario ?? benef.id
    );
    const idUsuarioRelacionado = toPositiveNumber(
      benef.id_usuario ??
      benef.id_usuario_usuario ??
      benef.usuario_id ??
      benef.id_usuario_beneficiario ??
      relacionUsuario.id_usuario ??
      relacionUsuario.usuario_id ??
      relacionUsuario.id
    );
    const email = normalizeEmail(
      benef.email ??
      benef.correo ??
      benef.email_usuario ??
      benef.correo_usuario ??
      relacionUsuario.email ??
      relacionUsuario.correo
    );
    const nombre = normalizeText(
      benef.nombre ??
      benef.nombre_usuario ??
      benef.nombre_beneficiario ??
      relacionUsuario.nombre_usuario ??
      relacionUsuario.nombre ??
      relacionUsuario.nombre_completo
    );
    const relacion = normalizeText(benef.relacion ?? benef.parentesco);

    if (idRelacion) return `rel:${idRelacion}`;
    if (idUsuarioRelacionado) return `usr:${idUsuarioRelacionado}`;
    if (email) return `mail:${email}`;
    if (nombre && relacion) return `nomrel:${nombre}:${relacion}`;
    if (nombre) return `nom:${nombre}`;
    const fallback = [
      benef.id,
      benef.id_relacion,
      benef.id_beneficiario,
      benef.nombre,
      benef.nombre_usuario,
      benef.nombre_beneficiario,
    ]
      .map((value) => normalizeText(value))
      .join("|");
    return `tmp:${fallback || "sin-datos"}`;
  };

  const handleUpgradeClick = () => setUpgradeModalOpen(true);
  const closeUpgradeModal = () => {
    setUpgradeModalOpen(false);
    setSelectedType(membershipData.tipoMembresia);
  };

  // Mapea el estado crudo a un status UI y un label consistente
  const mapEstadoUI = (raw) => {
    const norm = String(raw || "").toUpperCase();
    if (norm.includes("PEND")) return { status: "pending", label: "PENDIENTE" };
    if (norm.includes("PROCES")) return { status: "pending", label: "EN PROCESO" };
    if (norm.includes("CANCEL")) return { status: "none", label: "CANCELADO" };
    if (norm.includes("INACT")) return { status: "none", label: "INACTIVO" };
    // Tratamos COMPLETADO como Activo para la UI
    if (norm.includes("COMPLET")) return { status: "active", label: "ACTIVO" };
    if (norm.includes("ACTIV")) return { status: "active", label: "ACTIVO" };
    return { status: "active", label: norm || "ACTIVO" };
  };

  const normalizeEstadoMembresia = (raw) => {
    const numeric = toPositiveNumber(raw);
    if (numeric === 1) return "ACTIVO";
    if (numeric === 2) return "INACTIVO";
    if (numeric === 3) return "PENDIENTE";
    if (numeric === 4) return "EN PROCESO";
    if (numeric === 5) return "COMPLETADO";
    if (numeric === 6) return "CANCELADO";
    const norm = String(raw || "").toUpperCase();
    if (norm.includes("PEND")) return "PENDIENTE";
    if (norm.includes("PROCES")) return "EN PROCESO";
    if (norm.includes("ACTIV")) return "ACTIVO";
    if (norm.includes("COMPLET")) return "COMPLETADO";
    if (norm.includes("INACT")) return "INACTIVO";
    if (norm.includes("CANCEL")) return "CANCELADO";
    return norm;
  };

  const getEstadoMembresiaBeneficiario = (benef = {}) =>
    normalizeEstadoMembresia(
      benef?.id_estado_membresia_estado?.estado ??
      benef?.estado_membresia?.estado ??
      benef?.estado_membresia ??
      benef?.estado ??
      benef?.id_estado_membresia
    );

  const prioridadEstadoBeneficiario = (estadoNorm = "") => {
    if (estadoNorm === "PENDIENTE" || estadoNorm === "EN PROCESO") return 5;
    if (estadoNorm === "ACTIVO" || estadoNorm === "COMPLETADO") return 4;
    if (estadoNorm === "INACTIVO" || estadoNorm === "CANCELADO") return 1;
    return 0;
  };

  const handleSelectMembership = (type) => {
    if (type !== membershipData.tipoMembresia) setSelectedType(type);
  };

  const handleUpdateMembership = async () => {
    if (showPlanes) return;

    // Solo carga si no existe catálogo en memoria, para evitar flash/recarga visual.
    if (!planes.length && !planesLoading) {
      await loadPlanes();
    }

    setShowPlanes(true);
  };

  // Solo GET de beneficiarios propios; se elimina alta desde aquí.

  // Fetch estado de membresia
  const cargarEstadoMembresia = useCallback(async () => {
    try {
      const user = getCurrentUser();
      const idUsuario =
        user?.id_usuario ??
        user?.id ??
        user?.userId ??
        user?.idUser ??
        user?.usuario_id ??
        null;

      if (idUsuario) setUsuarioId(idUsuario);

      if (!idUsuario) {
        setMembresiaEstado(buildEmptyMembresiaEstado("ventas"));
        return;
      }

      const token = localStorage.getItem("token");
      const res = await fetch(`${URL_VENTAS_USUARIO}/${encodeURIComponent(idUsuario)}`, {
        headers: {
          Accept: "application/json",
          "ngrok-skip-browser-warning": "true",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => ({}));
      const ventas = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      const esDetalleMembresia = (d) => {
        const idM = resolveMembresiaId(d);
        if (idM) return true;
        if (d?.membresia || d?.id_membresia_membresia) return true;
        const tv = String(d?.tipo_venta || d?.tipoVenta || "").toLowerCase();
        if (tv.includes("memb")) return true;
        const nombre = String(d?.nombre_membresia || d?.nombre || "").toLowerCase();
        return nombre.includes("memb");
      };

      const ventasConMembresia = ventas
        .map((v) => {
          const detallesBase =
            v.detalles ||
            v.detalles_venta ||
            v.detalle_venta ||
            v.productos ||
            [];

          const extraMembresias = Array.isArray(v.membresias)
            ? v.membresias.map((m) => ({
                tipo_venta: "MEMBRESIA",
                id_membresia:
                  m.id_membresia ??
                  m.id_membresias ??
                  m.id ??
                  m.id_membresia_fk ??
                  m.id_membresia_pk,
                membresia: m,
              }))
            : [];

          const detalles = [...(Array.isArray(detallesBase) ? detallesBase : []), ...extraMembresias];
          let detallesMemb = detalles.filter((d) => esDetalleMembresia(d));

          if (!detallesMemb.length) {
            const idVentaMembresia = resolveMembresiaId(v);
            const nombreVentaMembresia = String(v?.nombre_membresia || "").trim();
            const tipoVenta = String(v?.tipo_venta || v?.tipoVenta || "").toLowerCase();
            const tieneMembresiaEnVenta =
              idVentaMembresia ||
              Boolean(v?.id_membresia_membresia || v?.membresia) ||
              Boolean(nombreVentaMembresia) ||
              tipoVenta.includes("memb") ||
              (Array.isArray(v?.membresias) && v.membresias.length > 0);

            if (tieneMembresiaEnVenta) {
              detallesMemb = [
                {
                  tipo_venta: "MEMBRESIA",
                  id_membresia: idVentaMembresia,
                  nombre_membresia: nombreVentaMembresia || undefined,
                  descripcion: v?.descripcion_membresia,
                  membresia: v?.id_membresia_membresia || v?.membresia || v?.membresias?.[0],
                  id_membresia_membresia: v?.id_membresia_membresia,
                  valor_unitario: v?.valor_total_venta ?? v?.total ?? undefined,
                },
              ];
            }
          }

          if (!detallesMemb.length) return null;
          return { venta: v, detallesMemb };
        })
        .filter(Boolean);

      if (!ventasConMembresia.length) {
        setMembresiaEstado(buildEmptyMembresiaEstado("ventas"));
        return;
      }

      const ESTADO_ID_MAP = {
        1: "ACTIVO",
        2: "INACTIVO",
        3: "PENDIENTE",
        4: "EN PROCESO",
        5: "COMPLETADO",
        6: "CANCELADO",
      };

      const normalizarEstado = (raw) => {
        if (typeof raw === "number") return ESTADO_ID_MAP[raw] || "PENDIENTE";
        const val = String(raw || "PENDIENTE").toUpperCase();
        return ESTADO_ID_MAP[val] || val;
      };

      const fechaNumero = (venta) => {
        const f =
          venta.fecha_venta ||
          venta.fecha ||
          venta.fechaVenta ||
          venta.createdAt ||
          venta.updatedAt ||
          "";
        const n = Date.parse(f);
        return Number.isFinite(n) ? n : 0;
      };

      const ordenVentaNumero = (venta = {}) =>
        toPositiveNumber(
          venta?.id_venta ??
          venta?.idVenta ??
          venta?.id_ventas ??
          venta?.id
        ) || 0;

      // Priorizar estado de membresía antes de fecha para reflejar compras recientes pendientes.
      const obtenerEstadoVenta = (venta = {}) =>
        venta.estado_venta ||
        venta.estado ||
        venta.id_estado_estado?.estado ||
        venta.id_estado;

      const ventasVigentes = ventasConMembresia
        .map((item) => {
          const estadoRaw = obtenerEstadoVenta(item.venta);
          const estadoNorm = normalizarEstado(estadoRaw);
          return { ...item, estadoRaw, estadoNorm };
        })
        .filter((item) => item.estadoNorm === "COMPLETADO" || item.estadoNorm === "ACTIVO")
        .sort((a, b) => {
          const fechaDiff = fechaNumero(b.venta) - fechaNumero(a.venta);
          if (fechaDiff !== 0) return fechaDiff;
          const ordenDiff = ordenVentaNumero(b.venta) - ordenVentaNumero(a.venta);
          if (ordenDiff !== 0) return ordenDiff;
          const prioridadEstado = (estado) => (estado === "COMPLETADO" ? 2 : estado === "ACTIVO" ? 1 : 0);
          return prioridadEstado(b.estadoNorm) - prioridadEstado(a.estadoNorm);
        });

      if (!ventasVigentes.length) {
        setMembresiaEstado(buildEmptyMembresiaEstado("ventas"));
        return;
      }

      const seleccion = ventasVigentes[0];
      const ventaSel = seleccion.venta;
      const estadoNorm = seleccion.estadoNorm;

      const fecha = ventaSel.fecha_venta || ventaSel.fecha || "";

      const detalleMemb = (seleccion.detallesMemb || seleccion.detalles || []).find((d) =>
        esDetalleMembresia(d)
      );

      const detalleMembObj =
        detalleMemb?.id_membresia_membresia ||
        detalleMemb?.membresia ||
        {};
      const idMembresia =
        resolveMembresiaId(detalleMemb) ||
        resolveMembresiaId(detalleMembObj, { allowGenericId: true }) ||
        resolveMembresiaId(ventaSel) ||
        (Array.isArray(ventaSel.membresias)
          ? ventaSel.membresias
              .map((m) => resolveMembresiaId(m, { allowGenericId: true }))
              .find(Boolean)
          : null);

      // El id de membresía manda; nombre y detalle se alinean contra ese id.
      let nombreResuelto =
        detalleMembObj?.nombre_membresia ||
        detalleMembObj?.nombre ||
        detalleMemb?.nombre_membresia ||
        detalleMemb?.nombre ||
        ventaSel.nombre_membresia ||
        (Array.isArray(ventaSel.membresias) &&
          ventaSel.membresias.find((m) => m.nombre_membresia)?.nombre_membresia) ||
        (Array.isArray(ventaSel.membresias) &&
          ventaSel.membresias.find((m) => m.nombre)?.nombre) ||
        "";

      let descripcionResuelta =
        detalleMembObj?.descripcion_membresia ||
        detalleMembObj?.descripcion ||
        detalleMemb?.descripcion ||
        ventaSel.descripcion_membresia ||
        (Array.isArray(ventaSel.membresias) &&
          ventaSel.membresias.find((m) => m.descripcion_membresia)?.descripcion_membresia) ||
        "";

      let duracionDiasResuelta =
        detalleMembObj?.duracion_dias ??
        (Array.isArray(ventaSel.membresias) &&
          ventaSel.membresias.find((m) => m.duracion_dias)?.duracion_dias) ??
        null;

      const precioRaw =
        detalleMemb?.valor_unitario ??
        detalleMemb?.precio ??
        detalleMembObj?.precio_venta ??
        detalleMembObj?.precio_de_venta ??
        detalleMembObj?.precio ??
        ventaSel.valor_total_venta ??
        ventaSel.total ??
        null;
      let precioResuelto = precioRaw !== null ? Number(precioRaw) : null;

      const serviciosIds = new Set();
      (seleccion.detallesMemb || []).forEach((detalle) => {
        addServicioIdsFromDetalle(serviciosIds, detalle);
        addServicioIdsFromMembresia(serviciosIds, detalle?.membresia || {});
        addServicioIdsFromMembresia(serviciosIds, detalle?.id_membresia_membresia || {});
      });
      if (Array.isArray(ventaSel.membresias)) {
        ventaSel.membresias.forEach((m) => addServicioIdsFromMembresia(serviciosIds, m));
      }
      if (idMembresia) {
        try {
          const catalogoRaw = await getMembresias({ query: {} });
          const catalogo = Array.isArray(catalogoRaw?.data)
            ? catalogoRaw.data
            : Array.isArray(catalogoRaw)
            ? catalogoRaw
            : [];
          const membresiaCatalogo = catalogo.find(
            (m) => resolveMembresiaId(m, { allowGenericId: true }) === idMembresia
          );
          if (membresiaCatalogo) {
            nombreResuelto =
              membresiaCatalogo.nombre_membresia ||
              membresiaCatalogo.nombre ||
              nombreResuelto;
            descripcionResuelta =
              membresiaCatalogo.descripcion_membresia ||
              membresiaCatalogo.descripcion ||
              descripcionResuelta;
            duracionDiasResuelta =
              membresiaCatalogo.duracion_dias ??
              duracionDiasResuelta;
            const precioCatalogo = Number(
              membresiaCatalogo.precio_venta ??
                membresiaCatalogo.precio_de_venta ??
                membresiaCatalogo.precio
            );
            if (Number.isFinite(precioCatalogo)) precioResuelto = precioCatalogo;
            addServicioIdsFromMembresia(serviciosIds, membresiaCatalogo);
          }
        } catch (lookupErr) {
          console.warn("[ServiciosUsuario] No se pudieron completar servicios desde catalogo:", lookupErr);
        }
      }
      const nombre =
        nombreResuelto ||
        (idMembresia ? `Membresia ${idMembresia}` : "Membresía");

      const estadoUI = mapEstadoUI(estadoNorm);

      setMembresiaEstado((prev) => ({
        ...prev,
        loading: false,
        status: estadoUI.status,
        source: "ventas",
        nombre,
        fecha,
        estadoTexto: estadoUI.label,
        descripcion: descripcionResuelta,
        precio: precioResuelto,
        duracionDias: duracionDiasResuelta,
        // Evita pisar una lista más completa cuando las cargas llegan en distinto orden.
        serviciosIds: mergeServiciosIds(Array.from(serviciosIds), []),
        idMembresia,
        idBeneficiarioRegistro: null,
        idTitularBeneficiario: null,
        idRelacionBeneficiario: null,
      }));
    } catch (err) {
      console.error("[ServiciosUsuario] No se pudo obtener membresía:", err);
      setMembresiaEstado(buildEmptyMembresiaEstado("ventas"));
    }
  }, []);

  const cargarBeneficiarios = useCallback(async ({ resolveMembership = true } = {}) => {
    try {
      setBenefLoading(true);
      setBenefError(null);
      const user = getCurrentUser();
      const idUsuarioActual = toPositiveNumber(
        user?.id_usuario ??
        user?.id ??
        user?.userId ??
        user?.idUser ??
        user?.usuario_id
      );
      const emailUsuarioActual = normalizeEmail(
        user?.email ?? user?.correo ?? user?.email_usuario
      );
      // Usar /beneficiarios/mios sin query params
      const lista = await obtenerBeneficiariosMios();
      let listaArray = Array.isArray(lista)
        ? lista
        : Array.isArray(lista?.data)
        ? lista.data
        : [];
      if (!listaArray.length) {
        try {
          const listaGlobalRaw = await obtenerBeneficiariosGlobal();
          const listaGlobal = Array.isArray(listaGlobalRaw)
            ? listaGlobalRaw
            : Array.isArray(listaGlobalRaw?.data)
            ? listaGlobalRaw.data
            : [];
          listaArray = listaGlobal.filter((benef = {}) => {
            const relacionUsuario =
              benef.id_relacion_usuario ||
              benef.relacion_usuario ||
              benef.usuario_relacion ||
              {};
            const idTitular = toPositiveNumber(
              benef.id_usuario ??
                benef.id_usuario_usuario ??
                benef.usuario_id
            );
            const idRelacion = toPositiveNumber(
              benef.id_relacion ??
                benef.id_beneficiario ??
                benef.id_usuario_relacion ??
                benef.id_usuario_beneficiario ??
                relacionUsuario.id_usuario ??
                relacionUsuario.usuario_id ??
                relacionUsuario.id
            );
            const emailTitular = normalizeEmail(
              benef.email_usuario ??
                benef.correo_usuario ??
                benef.email ??
                benef.correo
            );
            const emailRelacion = normalizeEmail(
              benef.email_relacion ??
                benef.correo_relacion ??
                benef.email_beneficiario ??
                benef.correo_beneficiario ??
                relacionUsuario.email ??
                relacionUsuario.correo
            );
            const coincidePorId =
              idUsuarioActual &&
              (idTitular === idUsuarioActual || idRelacion === idUsuarioActual);
            const coincidePorMail =
              emailUsuarioActual &&
              (emailTitular === emailUsuarioActual || emailRelacion === emailUsuarioActual);
            return Boolean(coincidePorId || coincidePorMail);
          });
        } catch (fallbackErr) {
          console.warn("[ServiciosUsuario] No se pudo consultar /beneficiarios como fallback:", fallbackErr);
        }
      }
      const esDelUsuarioActual = (benef = {}) => {
        const relacionUsuario =
          benef.id_relacion_usuario ||
          benef.relacion_usuario ||
          benef.usuario_relacion ||
          {};
        // En /beneficiarios/mios, id_usuario suele ser el titular (usuario actual) en todos los registros.
        // Para excluir solo el autorregistro, se compara contra id_relacion (persona relacionada).
        const idRelacion = toPositiveNumber(
          benef.id_relacion ??
            benef.id_beneficiario ??
            benef.id_usuario_relacion ??
            benef.id_usuario_beneficiario ??
            relacionUsuario.id_usuario ??
            relacionUsuario.usuario_id ??
            relacionUsuario.id
        );
        const emailRelacion = normalizeEmail(
          benef.email_relacion ??
            benef.correo_relacion ??
            benef.email_beneficiario ??
            benef.correo_beneficiario ??
            relacionUsuario.email ??
            relacionUsuario.correo
        );
        if (idUsuarioActual && idRelacion && idRelacion === idUsuarioActual) return true;
        if (emailUsuarioActual && emailRelacion && emailRelacion === emailUsuarioActual) return true;
        return false;
      };

      const dedupMap = new Map();
      listaArray
        .filter((benef) => !esDelUsuarioActual(benef))
        .forEach((benef) => {
          const key = buildBeneficiarioIdentityKey(benef);
          if (!dedupMap.has(key)) dedupMap.set(key, benef);
        });
      setBeneficiarios(Array.from(dedupMap.values()));
      if (!resolveMembership) return false;
      // Si hay membresía en beneficiarios, refleja en la tarjeta principal
      const candidatosMembresia = listaArray
        .map((benef) => {
          const idMembresiaDirecta = resolveMembresiaId(benef);
          const tieneObjeto = Boolean(benef?.id_membresia_membresia || benef?.membresia);
          const estadoNorm = getEstadoMembresiaBeneficiario(benef);
          const prioridad = prioridadEstadoBeneficiario(estadoNorm);
          const orden = toPositiveNumber(benef?.id_beneficiario ?? benef?.id) || 0;
          return {
            benef,
            idMembresiaDirecta,
            tieneMembresia: tieneObjeto || Boolean(idMembresiaDirecta),
            estadoNorm,
            prioridad,
            orden,
            esTitular: esDelUsuarioActual(benef),
          };
        })
        .filter((item) => item.tieneMembresia)
        .sort((a, b) => {
          if (b.prioridad !== a.prioridad) return b.prioridad - a.prioridad;
          if (b.orden !== a.orden) return b.orden - a.orden;
          if (a.esTitular !== b.esTitular) return a.esTitular ? -1 : 1;
          return 0;
        });
      const candidatoSeleccionado = candidatosMembresia[0] || null;
      const beneficiarioConMembresia = candidatoSeleccionado?.benef || null;
      const estadoBeneficiarioNorm = candidatoSeleccionado?.estadoNorm || "";

      if (beneficiarioConMembresia) {
        const idMembresiaDirecta =
          candidatoSeleccionado?.idMembresiaDirecta ||
          resolveMembresiaId(beneficiarioConMembresia);
        let memObj =
          beneficiarioConMembresia?.id_membresia_membresia ||
          beneficiarioConMembresia?.membresia ||
          {};
        if (
          idMembresiaDirecta &&
          (
            !memObj ||
            !Object.keys(memObj).length ||
            resolveMembresiaId(memObj, { allowGenericId: true }) !== idMembresiaDirecta
          )
        ) {
          try {
            const catalogoRaw = await getMembresias({ query: {} });
            const catalogo = Array.isArray(catalogoRaw?.data)
              ? catalogoRaw.data
              : Array.isArray(catalogoRaw)
              ? catalogoRaw
              : [];
            const encontrado = catalogo.find(
              (m) => resolveMembresiaId(m, { allowGenericId: true }) === idMembresiaDirecta
            );
            if (encontrado) memObj = encontrado;
          } catch (lookupErr) {
            console.warn("[ServiciosUsuario] No se pudo resolver detalle de membresia por id:", lookupErr);
          }
        }
        const estadoObj =
          beneficiarioConMembresia.id_estado_membresia_estado ||
          beneficiarioConMembresia.estado_membresia ||
          {};
        const idMembresiaResuelta =
          resolveMembresiaId(memObj, { allowGenericId: true }) || idMembresiaDirecta;
        const serviciosIdsSet = new Set();
        addServicioIdsFromMembresia(serviciosIdsSet, memObj);
        addServicioIdsFromMembresia(serviciosIdsSet, beneficiarioConMembresia);
        if (idMembresiaResuelta && serviciosIdsSet.size <= 1) {
          try {
            const catalogoRaw = await getMembresias({ query: {} });
            const catalogo = Array.isArray(catalogoRaw?.data)
              ? catalogoRaw.data
              : Array.isArray(catalogoRaw)
              ? catalogoRaw
              : [];
            const encontrado = catalogo.find(
              (m) => resolveMembresiaId(m, { allowGenericId: true }) === idMembresiaResuelta
            );
            if (encontrado) addServicioIdsFromMembresia(serviciosIdsSet, encontrado);
          } catch (lookupErr) {
            console.warn(
              "[ServiciosUsuario] No se pudieron completar servicios por beneficiario desde catalogo:",
              lookupErr
            );
          }
        }

        if (!idMembresiaResuelta) return false;

        const estadoRaw = estadoBeneficiarioNorm || (estadoObj?.estado ?? estadoObj);
        const estadoUI = estadoRaw ? mapEstadoUI(estadoRaw) : { status: "pending", label: "PENDIENTE" };
        let precioMembresia = toPriceNumber(
          memObj.precio_venta ?? memObj.precio_de_venta ?? memObj.precio
        );
        const idMembresia = idMembresiaResuelta;
        const fechaAsignacionBeneficiario =
          beneficiarioConMembresia?.fecha_asignacion ??
          beneficiarioConMembresia?.fechaAsignacion ??
          beneficiarioConMembresia?.fecha_asignacion_membresia ??
          beneficiarioConMembresia?.id_membresia_membresia?.fecha_asignacion ??
          beneficiarioConMembresia?.membresia?.fecha_asignacion ??
          "";
        const fechaVencimientoBeneficiario =
          beneficiarioConMembresia?.fecha_vencimiento ??
          beneficiarioConMembresia?.fechaVencimiento ??
          beneficiarioConMembresia?.id_membresia_membresia?.fecha_vencimiento ??
          beneficiarioConMembresia?.membresia?.fecha_vencimiento ??
          "";
        const idBeneficiarioRegistro = toPositiveNumber(
          beneficiarioConMembresia?.id_beneficiario ??
          beneficiarioConMembresia?.id
        );
        const idTitularBeneficiario = toPositiveNumber(
          beneficiarioConMembresia?.id_usuario ??
          beneficiarioConMembresia?.id_usuario_usuario?.id_usuario ??
          beneficiarioConMembresia?.id_usuario_usuario?.id ??
          beneficiarioConMembresia?.usuario_id
        );
        const idRelacionBeneficiario = toPositiveNumber(
          beneficiarioConMembresia?.id_relacion ??
          beneficiarioConMembresia?.id_usuario_relacion ??
          beneficiarioConMembresia?.id_usuario_beneficiario ??
          beneficiarioConMembresia?.id_relacion_usuario?.id_usuario ??
          beneficiarioConMembresia?.id_relacion_usuario?.id ??
          beneficiarioConMembresia?.relacion_usuario?.id_usuario ??
          beneficiarioConMembresia?.relacion_usuario?.id
        );

        // Si cliente_beneficiario no trae precio, forzamos resolución por catálogo de membresías.
        if (!Number.isFinite(precioMembresia) && idMembresiaResuelta) {
          try {
            const catalogoRaw = await getMembresias({ query: {} });
            const catalogo = Array.isArray(catalogoRaw?.data)
              ? catalogoRaw.data
              : Array.isArray(catalogoRaw)
              ? catalogoRaw
              : [];
            const memCatalogo = catalogo.find(
              (m) => resolveMembresiaId(m, { allowGenericId: true }) === idMembresiaResuelta
            );
            const precioCatalogo = toPriceNumber(
              memCatalogo?.precio_venta ?? memCatalogo?.precio_de_venta ?? memCatalogo?.precio
            );
            if (Number.isFinite(precioCatalogo)) {
              precioMembresia = precioCatalogo;
            }
          } catch (lookupErr) {
            console.warn("[ServiciosUsuario] No se pudo resolver precio de membresía desde catálogo:", lookupErr);
          }
        }

        setMembresiaEstado((prev) => {
          return {
            ...prev,
            loading: false,
            source: "beneficiarios",
            status: estadoUI?.status || "pending",
            estadoTexto: estadoUI?.label || estadoBeneficiarioNorm || "PENDIENTE",
            nombre:
              memObj.nombre_membresia ||
              memObj.nombre ||
              (idMembresia ? `Membresia ${idMembresia}` : prev.nombre),
            fecha:
              fechaAsignacionBeneficiario ||
              prev.fecha ||
              "",
            fecha_asignacion:
              fechaAsignacionBeneficiario ||
              prev.fecha_asignacion ||
              prev.fechaAsignacion ||
              prev.fecha ||
              "",
            fecha_vencimiento:
              fechaVencimientoBeneficiario ||
              prev.fecha_vencimiento ||
              prev.fechaVencimiento ||
              "",
            fechaAsignacion:
              fechaAsignacionBeneficiario ||
              prev.fechaAsignacion ||
              prev.fecha_asignacion ||
              prev.fecha ||
              "",
            fechaVencimiento:
              fechaVencimientoBeneficiario ||
              prev.fechaVencimiento ||
              prev.fecha_vencimiento ||
              "",
            descripcion: memObj.descripcion_membresia || memObj.descripcion || prev.descripcion,
            precio: Number.isFinite(precioMembresia) ? precioMembresia : prev.precio,
            duracionDias: memObj.duracion_dias || prev.duracionDias,
            idMembresia: idMembresia || prev.idMembresia,
            serviciosIds: mergeServiciosIds(Array.from(serviciosIdsSet), []),
            idBeneficiarioRegistro: idBeneficiarioRegistro || prev.idBeneficiarioRegistro,
            idTitularBeneficiario: idTitularBeneficiario || prev.idTitularBeneficiario,
            idRelacionBeneficiario: idRelacionBeneficiario || prev.idRelacionBeneficiario,
          };
        });
        return true;
      }

      // Si existe un registro propio sin membresia pero marcado como cancelado/inactivo,
      // se considera estado final y evita fallback a ventas antiguas.
      const registroPropioCerrado = listaArray
        .map((benef) => ({
          benef,
          estadoNorm: getEstadoMembresiaBeneficiario(benef),
          esTitular: esDelUsuarioActual(benef),
          orden: toPositiveNumber(benef?.id_beneficiario ?? benef?.id) || 0,
        }))
        .filter((item) => item.esTitular)
        .filter(
          (item) =>
            item.estadoNorm === "CANCELADO" || item.estadoNorm === "INACTIVO"
        )
        .sort((a, b) => b.orden - a.orden)[0];

      if (registroPropioCerrado) {
        setMembresiaEstado({
          ...buildEmptyMembresiaEstado("beneficiarios"),
          estadoTexto: registroPropioCerrado.estadoNorm,
        });
        return true;
      }

      setMembresiaEstado(buildEmptyMembresiaEstado("beneficiarios"));
      return true;
    } catch (err) {
      console.error("Error al cargar beneficiarios:", err);
      setBenefError(err?.message || "No se pudieron cargar los beneficiarios");
      toast.error("No se pudieron cargar los beneficiarios");
      return false;
    } finally {
      setBenefLoading(false);
    }
  }, []);

  const resolverMembresiaActual = useCallback(async () => {
    setMembresiaEstado((prev) => ({ ...prev, loading: true }));
    const resueltaDesdeBeneficiario = await cargarBeneficiarios({ resolveMembership: true });
    if (!resueltaDesdeBeneficiario) {
      await cargarEstadoMembresia();
    }
  }, [cargarBeneficiarios, cargarEstadoMembresia]);

  const handleCancelarMembresia = async () => {
    if (cancelandoMembresia || membresiaEstado.loading) return;
    if (membresiaEstado.status !== "active") return;

    let idBeneficiarioRegistro = toPositiveNumber(membresiaEstado.idBeneficiarioRegistro);

    if (!idBeneficiarioRegistro) {
      try {
        const raw = await obtenerBeneficiariosMios();
        const lista = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        const idMembresiaActual = toPositiveNumber(membresiaEstado.idMembresia);
        const candidatos = lista
          .map((benef = {}) => {
            const estadoNorm = getEstadoMembresiaBeneficiario(benef);
            const prioridad = prioridadEstadoBeneficiario(estadoNorm);
            const idMembresiaBenef = resolveMembresiaId(benef);
            const orden = toPositiveNumber(benef?.id_beneficiario ?? benef?.id) || 0;
            return { benef, estadoNorm, prioridad, idMembresiaBenef, orden };
          })
          .filter((item) => item.prioridad >= 4)
          .sort((a, b) => {
            const matchA = idMembresiaActual && a.idMembresiaBenef === idMembresiaActual ? 1 : 0;
            const matchB = idMembresiaActual && b.idMembresiaBenef === idMembresiaActual ? 1 : 0;
            if (matchB !== matchA) return matchB - matchA;
            if (b.prioridad !== a.prioridad) return b.prioridad - a.prioridad;
            return b.orden - a.orden;
          });
        const encontrado = candidatos[0]?.benef || null;
        if (encontrado) {
          idBeneficiarioRegistro = toPositiveNumber(encontrado?.id_beneficiario ?? encontrado?.id);
        }
      } catch (lookupErr) {
        console.warn("[ServiciosUsuario] No se pudo resolver registro de beneficiario para cancelar:", lookupErr);
      }
    }

    if (!idBeneficiarioRegistro) {
      toast.error("No se encontro el registro de beneficiario para cancelar la membresia.");
      return;
    }

    try {
      setCancelandoMembresia(true);

      await eliminarBeneficiario(idBeneficiarioRegistro);

      setMembresiaEstado({
        ...buildEmptyMembresiaEstado("beneficiarios"),
        estadoTexto: "CANCELADO",
      });

      window.dispatchEvent(
        new CustomEvent("membresia-estado-actualizada", {
          detail: {
            estado: "CANCELADO",
            id_membresia: membresiaEstado.idMembresia,
            fecha: new Date().toISOString(),
          },
        })
      );

      toast.success("Membresia cancelada correctamente");
      setCancelModalOpen(false);
      await resolverMembresiaActual();
    } catch (err) {
      console.error("[ServiciosUsuario] Error al cancelar membresia:", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudo cancelar la membresia";
      toast.error(msg);
    } finally {
      setCancelandoMembresia(false);
    }
  };

  useEffect(() => {
    resolverMembresiaActual();
  }, [resolverMembresiaActual]);

  useEffect(() => {
    const handler = (ev) => {
      const detalle = ev?.detail || {};
      const estadoRaw = detalle.estado;
      if (estadoRaw == null) {
        resolverMembresiaActual();
        return;
      }

      const estadoUI = mapEstadoUI(estadoRaw);
      if (estadoUI.status !== "active") {
        resolverMembresiaActual();
        return;
      }

      const idMembresiaEvento = resolveMembresiaId(detalle);
      setMembresiaEstado((prev) => ({
        ...prev,
        loading: false,
        status: estadoUI.status,
        estadoTexto: estadoUI.label,
        nombre: detalle.nombreMembresia || detalle.nombre || prev.nombre || "Membresia",
        fecha: detalle.fecha || prev.fecha || "",
        fecha_asignacion:
          detalle.fecha_asignacion ||
          detalle.fechaAsignacion ||
          detalle.fecha ||
          prev.fecha_asignacion ||
          prev.fechaAsignacion ||
          prev.fecha ||
          "",
        fecha_vencimiento:
          detalle.fecha_vencimiento ||
          detalle.fechaVencimiento ||
          prev.fecha_vencimiento ||
          prev.fechaVencimiento ||
          "",
        fechaAsignacion:
          detalle.fechaAsignacion ||
          detalle.fecha_asignacion ||
          detalle.fecha ||
          prev.fechaAsignacion ||
          prev.fecha_asignacion ||
          prev.fecha ||
          "",
        fechaVencimiento:
          detalle.fechaVencimiento ||
          detalle.fecha_vencimiento ||
          prev.fechaVencimiento ||
          prev.fecha_vencimiento ||
          "",
        idMembresia: idMembresiaEvento || prev.idMembresia,
        serviciosIds:
          idMembresiaEvento && prev.idMembresia && idMembresiaEvento !== prev.idMembresia
            ? []
            : prev.serviciosIds,
      }));
    };
    window.addEventListener("membresia-estado-actualizada", handler);
    return () => window.removeEventListener("membresia-estado-actualizada", handler);
  }, [resolverMembresiaActual]);

  // Fetch services data from API
  useEffect(() => {
    let isMounted = true;
    const fetchServicios = async () => {
      try {
        if (isMounted) setLoading(true);
        const data = await obtenerServicios();
        const serviciosArray = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const mappedData = serviciosArray.map((servicio) => {
          const id = getServicioPrimaryId(servicio) || null;
          const estadoRaw = servicio.estado ?? servicio.id_estado;
          const estado =
            typeof estadoRaw === "string"
              ? estadoRaw
              : estadoRaw === 1
              ? "Activo"
              : estadoRaw === 0
              ? "Inactivo"
              : null;
          return {
            ...servicio,
            id,
            nombre:
              servicio.nombre_servicio ||
              servicio.nombre ||
              servicio.nombreServicio ||
              servicio.descripcion ||
              "Servicio",
            descripcion:
              servicio.descripcion_servicio || servicio.descripcion || servicio.detalle || "",
            precio:
              Number(servicio.precio_servicio ?? servicio.precio ?? servicio.costo ?? 0) || 0,
            duracion: servicio.periodicidad || servicio.duracion || 60,
            estado,
          };
        });
        const uniqueServicios = [];
        const seen = new Set();
        mappedData.forEach((servicio, idx) => {
          const key =
            getServicioPrimaryId(servicio) ||
            normalizeText(servicio.nombre || servicio.descripcion || "") ||
            `srv-${idx}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueServicios.push(servicio);
          }
        });
        if (isMounted) {
          setServiciosData(uniqueServicios);
          setError(null);
        }
      } catch (err) {
        console.error("Error fetching servicios:", err);
        if (isMounted) setError("Error al cargar los servicios");
        toast.error("Error al cargar los servicios");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchServicios();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        closeModal();
      }
    };
    if (modalOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modalOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (upgradeModalRef.current && !upgradeModalRef.current.contains(event.target)) {
        closeUpgradeModal();
      }
    };
    if (upgradeModalOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [upgradeModalOpen]);

  const serviciosIdsMembresia = mergeServiciosIds(membresiaEstado.serviciosIds, []);
  const serviciosDisponibles = (() => {
    if (!serviciosIdsMembresia.length) return [];
    const idsMembresiaSet = new Set(serviciosIdsMembresia);
    return serviciosData.filter((servicio) => {
      const estadoLower = normalizeText(servicio.estado);
      const estadoOk =
        !estadoLower ||
        estadoLower === "activo" ||
        estadoLower === "activa" ||
        estadoLower === "1";
      if (!estadoOk) return false;

      const candidatos = getServicioIdCandidates(servicio);
      return candidatos.some((id) => idsMembresiaSet.has(id));
    });
  })();

  const badgeConfig = (() => {
    if (membresiaEstado.loading) {
      return { label: "Cargando...", color: "#2563eb", bg: "#e0ecff" };
    }
    const labelEstado = membresiaEstado.estadoTexto || "";
    const tipoActivo = membresiaEstado.status !== "none"
      ? normalizarTipoMembresia(membresiaEstado.nombre || "Membresia")
      : normalizarTipoMembresia(membershipData.tipoMembresia);
    const accent = getMembershipColor(tipoActivo);
    const accentBg = softenColor(accent, 0.18);
    if (membresiaEstado.status === "active") {
      return {
        label: labelEstado || "Activa",
        color: accent,
        bg: accentBg,
      };
    }
    if (membresiaEstado.status === "completed") {
      return {
        label: labelEstado || "Completada",
        color: "#10b981",
        bg: "#d1fae5",
      };
    }
    if (membresiaEstado.status === "pending") {
      return {
        label: labelEstado || "Pendiente",
        color: "#f59e0b",
        bg: "#fef3c7",
      };
    }
    return {
      label: labelEstado || "Sin membresía",
      color: "#6b7280",
      bg: "#f3f4f6",
    };
  })();

  const iconoEstado =
    membresiaEstado.status === "active"
      ? IconCircleCheck
      : membresiaEstado.status === "completed"
      ? IconCircleCheck
      : membresiaEstado.status === "pending"
      ? IconClock
      : IconAlertTriangle;

  const tipoMostrado =
    membresiaEstado.status !== "none"
      ? normalizarTipoMembresia(membresiaEstado.nombre || "Membresia")
      : normalizarTipoMembresia(membershipData.tipoMembresia);
  const getAccentTierClass = (tipo) => {
    const t = normalizarTipoMembresia(tipo).toLowerCase();
    if (t.includes("premium")) return "servicios-usuario__accent-premium";
    if (t.includes("general")) return "servicios-usuario__accent-general";
    if (t.includes("elite")) return "servicios-usuario__accent-elite";
    if (t.includes("basica")) return "servicios-usuario__accent-basica";
    return "servicios-usuario__accent-default";
  };
  const accentClass =
    membresiaEstado.status === "none"
      ? "servicios-usuario__accent-default"
      : getAccentTierClass(tipoMostrado);
  const badgeStatusClass = `servicios-usuario__badge--${membresiaEstado.status || "none"}`;

  const descripcionMembresia = (() => {
    if (membresiaEstado.status === "active") {
      return `Tu membresia actual es ${membresiaEstado.nombre || "Membresia"}, disfruta de todos sus beneficios.`;
    }
    if (membresiaEstado.status === "completed") {
      return "Tu membresia se encuentra completada. Gracias por tu preferencia.";
    }
    if (membresiaEstado.status === "pending") {
      return "Tu membresia se activara en cuanto se confirme el pago.";
    }
    return "Aun no tienes una membresia activa. Elige la que mejor se adapte a ti.";
  })();

  const formatFechaMembresia = (value) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString();
  };

  const fechaAsignacionMembresia =
    membresiaEstado.fecha_asignacion ||
    membresiaEstado.fechaAsignacion ||
    membresiaEstado.fecha ||
    "";

  const fechaVencimientoMembresia = (() => {
    const directa =
      membresiaEstado.fecha_vencimiento ||
      membresiaEstado.fechaVencimiento ||
      "";
    if (directa) return directa;

    const fechaBase = new Date(fechaAsignacionMembresia);
    if (Number.isNaN(fechaBase.getTime())) return "";
    const duracion = Number(membresiaEstado.duracionDias);
    if (!Number.isFinite(duracion) || duracion <= 0) return "";

    const venc = new Date(fechaBase);
    venc.setDate(venc.getDate() + duracion);
    return venc.toISOString();
  })();

  const planesSectionMotion = {
    hidden: { opacity: 0, y: 18, scale: 0.99 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.78,
        ease: [0.22, 1, 0.36, 1],
        when: "beforeChildren",
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.99,
      transition: {
        duration: 0.55,
        ease: [0.4, 0, 1, 1],
        when: "afterChildren",
      },
    },
  };

  const planesGridMotion = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: 0.32,
        staggerChildren: 0.34,
      },
    },
    exit: {
      transition: {
        staggerChildren: 0.2,
        staggerDirection: -1,
      },
    },
  };

  const planCardMotion = {
    hidden: { opacity: 0, y: 24, scale: 0.985, filter: "blur(5px)" },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.74,
        ease: [0.16, 1, 0.3, 1],
      },
    },
    exit: {
      opacity: 0,
      y: -12,
      scale: 0.99,
      filter: "blur(3px)",
      transition: {
        duration: 0.45,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  return (
    <>
      <div className={`servicios-usuario__root ${showPlanes ? "is-expanded" : ""}`}>
        <div className="servicios-usuario__header">
          <h1 className="servicios-usuario__header-title">
            <IconClipboardList size={26} color="#e50914" />
            Mis Servicios
          </h1>
        </div>

        <section className={`servicios-usuario__card servicios-usuario__membership-summary ${accentClass}`}>
          <div className="servicios-usuario__membership-card">
            <div className="servicios-usuario__membership-header">
              {React.createElement(iconoEstado, { size: 18, color: badgeConfig.color })}
              <span>Membresía</span>
              <span className={`servicios-usuario__membership-badge ${badgeStatusClass} ${accentClass}`}>
                {badgeConfig.label}
              </span>
            </div>
            {membresiaEstado.loading ? (
              <p className="servicios-usuario__membership-text">Consultando estado...</p>
            ) : membresiaEstado.status === "none" ? (
              <p className="servicios-usuario__membership-text">No tienes una membresía asociada.</p>
            ) : (
              <>
                <p className="servicios-usuario__membership-name">{membresiaEstado.nombre}</p>
                <p className="servicios-usuario__membership-date">
                  Estado: {badgeConfig.label}
                  {membresiaEstado.fecha
                    ? ` · ${new Date(membresiaEstado.fecha).toLocaleDateString()}`
                    : ""}
                </p>
                <p className="servicios-usuario__membership-text">{descripcionMembresia}</p>
                {membresiaEstado.status === "active" && (
                  <div className="servicios-usuario__membership-subdetails">
                    <p className="servicios-usuario__membership-subdetail">
                      Fecha asignación: {formatFechaMembresia(fechaAsignacionMembresia)}
                    </p>
                    <p className="servicios-usuario__membership-subdetail">
                      Fecha vencimiento: {formatFechaMembresia(fechaVencimientoMembresia)}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <div className="servicios-usuario__grid">
          <section className="servicios-usuario__card servicios-usuario__panel">
            <h2 className={`servicios-usuario__title ${accentClass}`}>
              <IconClipboardList size={16} className="servicios-usuario__title-icon" />
              Servicios Disponibles
            </h2>
            <div className="servicios-usuario__mb-sm">
              <p className="servicios-usuario__small-text">Servicios Disponibles:</p>
              {loading ? (
                <p className="servicios-usuario__small-text">Cargando servicios...</p>
              ) : error ? (
                <p className="servicios-usuario__small-text servicios-usuario__small-text--error">{error}</p>
              ) : (
                <ul className="servicios-usuario__list">
                  {serviciosDisponibles.map((servicio) => (
                      <li
                        key={
                          getServicioPrimaryId(servicio) ||
                          normalizeText(servicio.nombre || servicio.descripcion || "")
                        }
                        className="servicios-usuario__list-item"
                      >
                        <strong>{servicio.nombre}</strong>
                      </li>
                    ))}
                  {serviciosDisponibles.length === 0 && (
                    <li className="servicios-usuario__list-item">
                      <strong>No hay servicios asociados a tu membresia.</strong>
                    </li>
                  )}
                </ul>
              )}
            </div>
            <div>
              <p className="servicios-usuario__small-text">Beneficiarios:</p>
              {benefLoading ? (
                <p className="servicios-usuario__small-text">Cargando beneficiarios...</p>
              ) : benefError ? (
                <p className="servicios-usuario__small-text servicios-usuario__small-text--error">{benefError}</p>
              ) : (
                <>
                  <ul className="servicios-usuario__list">
                    {beneficiarios.length === 0 ? (
                      <li className="servicios-usuario__list-item">
                        <strong>No hay beneficiarios asociados.</strong>
                      </li>
                    ) : (
                      beneficiarios.map((benef) => {
                        const relacionUsuario =
                          benef.id_relacion_usuario ||
                          benef.relacion_usuario ||
                          // benef.usuario_relacion ||
                          {};
                        const baseNombre =
                          benef.nombre ||
                          benef.nombre_usuario ||
                          benef.nombre_beneficiario ||
                          relacionUsuario.nombre_usuario ||
                          relacionUsuario.nombre ||
                          relacionUsuario.nombre_completo ||
                          `Beneficiario #${benef.id_relacion || benef.id}`;
                        const apellido =
                          relacionUsuario.apellido_usuario ||
                          relacionUsuario.apellido ||
                          "";
                        const nombre = `${baseNombre}${apellido ? ` ${apellido}` : ""}`.trim();
                        const relacion = benef.relacion || benef.parentesco || "";
                        const idRelacion = benef.id_relacion || benef.id_beneficiario || benef.id;
                        const benefKey = buildBeneficiarioIdentityKey(benef);
                        return (
                          <li
                            key={benefKey}
                            className="servicios-usuario__list-item servicios-usuario__list-item--between"
                          >
                          <span>
                            <strong>{nombre}</strong>
                            {relacion ? ` - ${relacion}` : ""}
                          </span>
                          {idRelacion ? (
                            <span className="servicios-usuario__list-id"></span>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
    </div>
  </section>

          <section className={`servicios-usuario__card servicios-usuario__panel ${accentClass}`}>
            <h2 className={`servicios-usuario__title ${accentClass}`}>
              <IconStar size={16} className="servicios-usuario__title-icon" />
              Tipo de Membresía
            </h2>

            {membresiaEstado.loading ? (
              <div className="servicios-usuario__center-block">
                <p className="servicios-usuario__small-text">Cargando información de membresía...</p>
              </div>
            ) : membresiaEstado.status === "none" ? (
              <div className="servicios-usuario__center-block">
                <p className="servicios-usuario__small-text servicios-usuario__small-text--muted">
                  No tienes membresías asociadas
                </p>
              </div>
            ) : (
              <>
                <span className={`servicios-usuario__badge ${accentClass}`}>
                  {membresiaEstado.nombre?.toString().toUpperCase() || "MEMBRESÍA"}
                </span>
                <div className="servicios-usuario__membership-grid">
                  <div>
                    <strong className="servicios-usuario__strong">Duración:</strong>{" "}
                    <span className="servicios-usuario__strong-value">
                      {membresiaEstado.duracionDias
                        ? `${membresiaEstado.duracionDias} días`
                        : "No especificada"}
                    </span>
                  </div>
                  <div>
                    <strong className="servicios-usuario__strong">Precio:</strong>{" "}
                    {Number.isFinite(membresiaEstado.precio)
                      ? `$ ${Number(membresiaEstado.precio).toLocaleString()}`
                      : "No especificado"}
                  </div>
                  <div className="servicios-usuario__full-width">
                    <strong className="servicios-usuario__strong">Descripción:</strong>{" "}
                    {membresiaEstado.descripcion || "Sin descripción"}
                  </div>
                </div>
                <div className="servicios-usuario__button-row">
                  <button
                    className="servicios-usuario__button servicios-usuario__button--back"
                    onClick={handleVerClick}
                  >
                    <IconArrowRight size={12} />
                    Ver Detalles
                  </button>

                  {membresiaEstado.status === "active" && (
                    <button
                      type="button"
                      className={`servicios-usuario__button servicios-usuario__button--back ${
                        cancelandoMembresia ? "is-disabled" : ""
                      }`}
                      disabled={cancelandoMembresia}
                      onClick={openCancelModal}
                    >
                      <X size={14} color="#ffffff" />
                      {cancelandoMembresia ? "Cancelando..." : "Cancelar Membresia"}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="servicios-usuario__card servicios-usuario__panel">
            <h2 className={`servicios-usuario__title ${accentClass}`}>
              <IconChartBar size={16} className="servicios-usuario__title-icon" />
              Mejorar Membresía
            </h2>
            <p className="servicios-usuario__small-text">
              ¡Potencia tu entrenamiento! Accede a  Nuevas Membresías  y descurbre  lo mejor para ti.
            </p>
            <button
              className="servicios-usuario__button servicios-usuario__button--back"
              onClick={handleUpdateMembership}
            >
              <IconArrowRight size={12} />
              Actualizar Plan
            </button>
          </section>
        </div>
      </div>

      <AnimatePresence initial={false}>
      {showPlanes && (
        <motion.section
          key="planes-section"
          ref={planesRef}
          variants={planesSectionMotion}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="servicios-usuario__planes-section"
        >
          <div className="servicios-usuario__planes-header">
            <h2 className="servicios-usuario__planes-title">
              Membresías disponibles
            </h2>
            <button
              className="servicios-usuario__button servicios-usuario__button--close-planes"
              onClick={() => setShowPlanes(false)}
            >
              Cerrar
            </button>
          </div>
          {planesLoading ? (
            <p className="servicios-usuario__small-text">Cargando membresías...</p>
          ) : planesError ? (
            <p className="servicios-usuario__small-text servicios-usuario__small-text--error">{planesError}</p>
          ) : planes.length === 0 ? (
            <p className="servicios-usuario__small-text">No hay membresías disponibles.</p>
          ) : (
            <motion.div
              variants={planesGridMotion}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="servicios-usuario__planes-grid"
            >
              {planes.map((p) => {
                const tierClass =
                  p.tier === "premium"
                    ? "servicios-usuario__plan--premium"
                    : p.tier === "medio" || p.tier === "general"
                    ? "servicios-usuario__plan--general"
                    : "servicios-usuario__plan--basico";

                return (
                  <motion.article
                    key={p.id}
                    layout
                    variants={planCardMotion}
                    className={`servicios-usuario__plan-card ${tierClass}`}
                  >
                    {/* Badge de precio */}
                    <div className="servicios-usuario__plan-price">
                      {p.price}
                    </div>

                    {/* Header con título e icono */}
                    <div className="servicios-usuario__plan-header">
                      <div className="servicios-usuario__plan-icon">
                        <IconStar size={24} color="white" />
                      </div>
                      <div>
                        <h3 className="servicios-usuario__plan-title">
                          {p.name}
                        </h3>
                        <span className="servicios-usuario__plan-tier">
                          {p.tier === "premium" ? "Premium" :
                           p.tier === "medio" ? "General" : "Básica"}
                        </span>
                      </div>
                    </div>

                    {/* Lista de características */}
                    <div className="servicios-usuario__plan-features-wrap">
                      <h4 className="servicios-usuario__plan-features-title">
                        Características incluidas:
                      </h4>
                      <ul className="servicios-usuario__plan-features-list">
                        {p.features.map((f, i) => (
                          <li
                            key={i}
                            className="servicios-usuario__plan-feature-item"
                          >
                            <div className="servicios-usuario__plan-feature-bullet">
                              <span className="servicios-usuario__plan-feature-check">
                                ✓
                              </span>
                            </div>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Botón de agregar al carrito */}
                    <AddToCartPlanButton
                      plan={p}
                      tierClass={tierClass}
                      agregarProducto={agregarProducto}
                      addItem={addItem}
                      addToCart={addToCart}
                      agregarAlCarrito={agregarAlCarrito}
                    />
                  </motion.article>
                );
              })}
            </motion.div>
          )}
        </motion.section>
      )}
      </AnimatePresence>

      {cancelModalOpen && (
        <Modal
          title="Cancelar Membresia"
          onClose={closeCancelModal}
          size="md"
          className="servicios-usuario__cancel- modal"
          closeOnOverlayClick={!cancelandoMembresia}
          icon={<IconAlertTriangle size={22} color="#fff" />}
          footer={
            <div className="servicios-usuario__cancel-footer">
              <button
                type="button"
                className="servicios-usuario__button servicios-usuario__button--back"
                onClick={closeCancelModal}
                disabled={cancelandoMembresia}
              >
                Volver
              </button>
              <button
                type="button"
                className={`servicios-usuario__button servicios-usuario__button-ghost ${
                  cancelandoMembresia ? "is-disabled" : ""
                }`}
                onClick={handleCancelarMembresia}
                disabled={cancelandoMembresia}
              >
                <X size={14} color="#ffffff" />
                {cancelandoMembresia ? "Cancelando..." : "Confirmar cancelacion"}
              </button>
            </div>
          }
        >
          <div className="servicios-usuario__cancel-body">
            <div className="servicios-usuario__cancel-highlight">
              <span className="servicios-usuario__cancel-highlight-label">
                Accion permanente
              </span>
              <p className="servicios-usuario__cancel-text">
                Vas a cancelar y eliminar tu membresia activa de tu registro.
              </p>
            </div>
            <div className="servicios-usuario__cancel-note">
              <span className="servicios-usuario__cancel-note-dot" />
              <span>
                Si confirmas, perderas el acceso, tu y tus beneficiarios asociados a esta membresia inmediatamente.
              </span>
            </div>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <Modal
          title="Detalles de Membresía"
          onClose={closeModal}
          size="md"
          footer={
            <button className="boton boton-primario" onClick={closeModal}>
              Entendido
            </button>
          }
        >
          <div className="cuerpo-modal">
            <div className="servicios-usuario__modal-stack">
              {/* Información básica de la membresía */}
              <div className="servicios-usuario__detail-card">
                <h3 className="servicios-usuario__detail-title">Información de la Membresía</h3>

                <div className="servicios-usuario__detail-grid">
                  <div>
                    <label className="servicios-usuario__detail-label">Tipo de Membresía</label>
                    <input
                      type="text"
                      className="servicios-usuario__detail-input"
                      value={
                        membresiaEstado.nombre ||
                        (membresiaEstado.status === "none" ? membershipData.tipoMembresia : "Membresia")
                      }
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="servicios-usuario__detail-label">Estado</label>
                    <input
                      type="text"
                      className="servicios-usuario__detail-input"
                      value={membresiaEstado.estadoTexto || "Pendiente"}
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="servicios-usuario__detail-label">Duración</label>
                    <input
                      type="text"
                      className="servicios-usuario__detail-input"
                      value={
                        membresiaEstado.duracionDias
                          ? `${membresiaEstado.duracionDias} días`
                          : membershipData.duracion
                      }
                      readOnly
                      disabled
                    />
                  </div>

                  <div>
                    <label className="servicios-usuario__detail-label">Costo Mensual</label>
                    <input
                      type="text"
                      className="servicios-usuario__detail-input"
                      value={
                        Number.isFinite(membresiaEstado.precio)
                          ? `$ ${Number(membresiaEstado.precio || 0).toLocaleString()}`
                          : membershipData.precio
                      }
                      readOnly
                      disabled
                    />
                  </div>
                </div>

                <div className="servicios-usuario__detail-description">
                  <label className="servicios-usuario__detail-label">Descripción</label>
                  <textarea
                    className="servicios-usuario__detail-input servicios-usuario__detail-input--textarea"
                    value={
                      membresiaEstado.descripcion ||
                      membershipData.descripcion ||
                      "Sin descripción"
                    }
                    readOnly
                    disabled
                    rows={3}
                  />
                </div>
              </div>

              {/* Características incluidas */}
              <div className="servicios-usuario__detail-card">
                <h3 className="servicios-usuario__detail-title">Características Incluidas</h3>

                <div className="servicios-usuario__features-stack">
                  {["Acceso a máquinas de cardio", "Acceso a equipos de pesas", "Acceso a vestuarios"].map(
                    (feature, idx) => (
                      <div
                        key={idx}
                        className="servicios-usuario__feature-row"
                      >
                        <div className="servicios-usuario__feature-check-wrap">
                          <span className="servicios-usuario__feature-check">
                            ✓
                          </span>
                        </div>
                        <span className="servicios-usuario__feature-text">
                          {feature}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {upgradeModalOpen && (
        <div className="modal-overlay capa-modal">
          <div className="contenedor-modal modal-mediano" ref={upgradeModalRef}>
            <div className="encabezado-modal">
              <h2>Cambiar Membresía</h2>
              <button className="boton-cerrar" onClick={closeUpgradeModal} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="cuerpo-modal">
              <div className="servicios-usuario__upgrade-options">
                {Object.entries(MEMBERSHIP_DETAILS).map(([type, details]) => (
                  <label
                    key={type}
                    className={`servicios-usuario__upgrade-option ${
                      type === membershipData.tipoMembresia ? "is-current" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="membership"
                      value={type}
                      checked={selectedType === type}
                      onChange={() => handleSelectMembership(type)}
                      disabled={type === membershipData.tipoMembresia}
                      className={`servicios-usuario__upgrade-radio ${
                        type === membershipData.tipoMembresia ? "is-disabled" : ""
                      }`}
                    />
                    <div
                      className={`servicios-usuario__upgrade-card ${
                        type === membershipData.tipoMembresia ? "is-current" : ""
                      }`}
                    >
                      <h3 className="servicios-usuario__upgrade-title">
                        {type}
                      </h3>
                      <p className="servicios-usuario__upgrade-text">
                        {details.descripcion}
                      </p>
                      <p className="servicios-usuario__upgrade-text">{details.precio}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="servicios-usuario__upgrade-description">
                <h3 className="servicios-usuario__upgrade-title">
                  Descripción
                </h3>
                <p className="servicios-usuario__upgrade-text">
                  {MEMBERSHIP_DETAILS[selectedType]?.longDescription || "Sin informacin disponible"}
                </p>
              </div>
            </div>
            <div className="pie-modal">
              <div className="grupo-botones">
                <button
                  onClick={closeUpgradeModal}
                  className="boton boton-secundario margen-derecha"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateMembership}
                  className="boton boton-primario"
                  disabled={selectedType === membershipData.tipoMembresia}
                >
                  Actualizar Membresía
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Panel lateral del carrito (reutiliza el de landing) */}
      {carritoAbierto && (
        <>
          <div
            className="carrito-overlay"
            onClick={() => setCarritoAbierto(false)}
          />
          <aside
            className="carrito-sidebar"
          >
            <CarritoCompras onClose={() => setCarritoAbierto(false)} />
          </aside>
        </>
      )}

      {/* FAB carrito */}
      <button
        key={fabBumpKey}
        ref={fabRef}
        type="button"
        className="cart-fab cart-fab--bump"
        aria-label={`Abrir carrito. ${cantidadTotal || 0} articulo(s)`}
        onClick={() => setCarritoAbierto((v) => !v)}
      >
        <IconShoppingCart size={24} />
        {(cantidadTotal || 0) > 0 && (
          <span className="servicios-usuario__cart-badge">
            {cantidadTotal}
          </span>
        )}
      </button>
    </>
  );
};

const AddToCartPlanButton = ({
  plan,
  tierClass,
  agregarProducto,
  addItem,
  addToCart,
  agregarAlCarrito,
}) => {
  const getPrimaryByTier = (tier = "") => {
    if (tier === "premium") return "#f59e0b";
    if (tier === "medio" || tier === "general") return "#10b981";
    return "#3b82f6";
  };
  const buildAvatarDataUrl = ({ tier = "basico", name = "" }) => {
    const primaryColor = getPrimaryByTier(tier);
    const letter = String(name).charAt(0).toUpperCase() || "M";
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <circle cx="40" cy="40" r="34" fill="${primaryColor}" />
      </g>
      <text x="50%" y="54%" text-anchor="middle"
            font-family="Montserrat, Segoe UI, Arial, sans-serif"
            font-weight="800" font-size="34" fill="white">
        ${letter}
      </text>
    </svg>`.trim();
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const handleAdd = () => {
    const precio =
      typeof plan.priceRaw === "number"
        ? plan.priceRaw
        : Number(String(plan.price ?? "").replace(/[^\d]/g, "")) || 0;
    const avatar = buildAvatarDataUrl({ tier: plan.tier, name: plan.name });
    const payload = {
      id: plan.id,
      nombre: plan.name,
      precio,
      cantidad: 1,
      tipo: "membresia",
      imagen: avatar,
      image: avatar,
      img: avatar,
      thumb: avatar,
      foto: avatar,
      meta: {
        tier: plan.tier,
        avatar,
      },
    };
    if (typeof agregarProducto === "function") agregarProducto(payload);
    else if (typeof addItem === "function") addItem(payload);
    else if (typeof addToCart === "function") addToCart(payload);
    else if (typeof agregarAlCarrito === "function") agregarAlCarrito(payload);
    toast.success(`${plan.name} agregado al carrito`);
  };

  return (
    <button
      className={`servicios-usuario__plan-add-btn ${tierClass}`}
      onClick={handleAdd}
    >
      <span className="servicios-usuario__plan-add-content">
        <IconShoppingCart size={18} />
        Agregar al carrito
      </span>
    </button>
  );
};

export default ServiciosUsuario;



