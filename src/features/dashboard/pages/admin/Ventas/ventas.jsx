import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, Store } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import "../../../../../shared/styles/restructured/pages/ventas-page.css";
import {
  crearVenta as apiCrearVenta,
  eliminarVenta as apiEliminarVenta,
  obtenerVentas,
  obtenerVentasFinalizadas,
  obtenerVentaPorId,
  obtenerDetallesVenta,
  actualizarVenta as apiActualizarVenta,
  estadoToPayload,
} from "../../../hooks/Ventas_API/Ventas";
import {
  obtenerUsuarioPorId,
  obtenerUsuarios,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import { ModalCrearVenta, ModalVerVenta } from "./modalVentas";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { SelectorEstado } from "../../../components/dataTables/badgesEstado";
import {
  getToken,
} from "../../../hooks/Acceder_API/authService";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import {
  hasExplicitPaginationInfo,
  normalizePaginatedResponse,
} from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";

const ESTADO_OPCIONES_UI = [
  { value: "PENDIENTE", label: "Pendiente", color: "#f59e0b", id_estado: 3 },
  { value: "EN_PROCESO", label: "En proceso", color: "#3b82f6", id_estado: 4 },
  { value: "COMPLETADO", label: "Completado", color: "#10b981", id_estado: 5 },
  { value: "CANCELADO", label: "Cancelado", color: "#ef4444", id_estado: 6 },
];

const TIPO_VENTA_OPCIONES = ["PRODUCTO", "MEMBRESIA", "SERVICIO"];

// Helper para extraer ID de forma segura
const extraerIdVenta = (venta) => {
  if (!venta) return null;
  return (
    venta.id ??
    venta.id_venta ??
    venta.idVentas ??
    venta.id_ventas ??
    venta.id_pedido_cliente ??
    null
  );
};

// Helper para parsear ID de forma segura
const parseIdSeguro = (valor) => {
  if (valor === null || valor === undefined) return null;
  const num = Number(valor);
  return !isNaN(num) && num > 0 ? num : null;
};

const extraerIdUsuario = (usuario = {}) =>
  usuario?.id ??
  usuario?.id_usuario ??
  usuario?.idUsuario ??
  usuario?.idUser ??
  usuario?.idUsuarios ??
  usuario?.id_usuarios ??
  usuario?.usuario?.id ??
  usuario?.usuario?.id_usuario ??
  null;

const obtenerTextoValido = (...candidatos) => {
  for (const candidato of candidatos) {
    if (typeof candidato !== "string") continue;
    const limpio = candidato.trim();
    if (limpio) return limpio;
  }
  return "";
};

const construirDocumentoUsuario = (usuario = {}) => {
  if (!usuario || typeof usuario !== "object") return "";
  return obtenerTextoValido(
    usuario.documento,
    usuario.numero_documento,
    usuario.num_documento,
    usuario.document,
    usuario.usuario?.documento,
    usuario.usuario?.numero_documento,
    usuario.usuario?.num_documento,
    usuario.usuario?.document
  );
};

const esNombreUsuarioFallback = (valor) => {
  const texto = String(valor ?? "").trim();
  if (!texto) return true;
  if (/^usuario\s+n\/d$/i.test(texto)) return true;
  return /^usuario\s+\d+$/i.test(texto);
};

const obtenerNombreUsuarioReal = (...candidatos) => {
  for (const candidato of candidatos) {
    if (typeof candidato !== "string") continue;
    const limpio = candidato.trim();
    if (!limpio || esNombreUsuarioFallback(limpio)) continue;
    return limpio;
  }
  return "";
};

const esDocumentoUsuarioFallback = (valor) => {
  const texto = String(valor ?? "").trim();
  return !texto || /^documento\s+n\/d$/i.test(texto);
};

const construirNombreUsuario = (usuario = {}, fallbackId = null) => {
  if (!usuario || typeof usuario !== "object") {
    return fallbackId ? `Usuario ${fallbackId}` : "Usuario N/D";
  }

  const nombreCompletoDirecto = obtenerTextoValido(
    usuario.nombre_completo,
    usuario.full_name,
    usuario.name,
    usuario.usuario_nombre,
    usuario.username,
    usuario.email,
    usuario.usuario?.nombre_completo,
    usuario.usuario?.full_name,
    usuario.usuario?.name,
    usuario.usuario?.usuario_nombre,
    usuario.usuario?.username,
    usuario.usuario?.email
  );

  const nombre = obtenerTextoValido(
    usuario.nombre_usuario,
    usuario.nombre,
    usuario.nombres,
    usuario.first_name,
    usuario.primer_nombre,
    usuario.usuario?.nombre_usuario,
    usuario.usuario?.nombre,
    usuario.usuario?.nombres,
    usuario.usuario?.first_name,
    usuario.usuario?.primer_nombre
  );
  const apellido = obtenerTextoValido(
    usuario.apellido_usuario,
    usuario.apellido,
    usuario.apellidos,
    usuario.last_name,
    usuario.segundo_nombre,
    usuario.segundo_apellido,
    usuario.usuario?.apellido_usuario,
    usuario.usuario?.apellido,
    usuario.usuario?.apellidos,
    usuario.usuario?.last_name,
    usuario.usuario?.segundo_nombre,
    usuario.usuario?.segundo_apellido
  );

  const combinado = `${nombre} ${apellido}`.trim();

  return (
    (typeof nombreCompletoDirecto === "string" && nombreCompletoDirecto.trim()) ||
    combinado ||
    (fallbackId ? `Usuario ${fallbackId}` : "Usuario N/D")
  );
};

// Normaliza texto para búsqueda
const normalizarTexto = (valor) =>
  valor
    ? String(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
    : "";

// Normaliza el estado de VENTA
const normalizarEstadoVenta = (valor) => {
  if (!valor && valor !== 0) return "PENDIENTE";

  // Si es un número, buscarlo por id_estado
  if (typeof valor === "number" || !isNaN(Number(valor))) {
    const numValor = Number(valor);
    const encontradoPorId = ESTADO_OPCIONES_UI.find(
      (opt) => opt.id_estado === numValor
    );
    if (encontradoPorId) return encontradoPorId.value;
  }

  // Si es texto, buscar por value o label
  const raw = String(valor).trim();
  const rawUpper = raw.toUpperCase();

  const encontrado = ESTADO_OPCIONES_UI.find((opt) => {
    const valueUpper = opt.value.toUpperCase();
    const labelUpper = opt.label.toUpperCase();
    return (
      valueUpper === rawUpper ||
      labelUpper === rawUpper ||
      valueUpper.replace(/_/g, " ") === rawUpper ||
      labelUpper.replace(/_/g, " ") === rawUpper
    );
  });

  return (encontrado && encontrado.value) || "PENDIENTE";
};

const getEstadoVentaConfig = (valor) => {
  const value = normalizarEstadoVenta(valor);
  return (
    ESTADO_OPCIONES_UI.find((opt) => opt.value === value) ||
    ESTADO_OPCIONES_UI[0]
  );
};

const getEstadoToneClass = (idEstado) => {
  const numeric = Number(idEstado);
  if (numeric === 5) return "badge-tone--completado";
  if (numeric === 6) return "badge-tone--cancelado";
  if (numeric === 4) return "badge-tone--en-proceso";
  return "badge-tone--pendiente";
};

const esEstadoVisibleEnCompletados = (estado) => {
  const normalized = normalizarEstadoVenta(estado);
  return normalized === "COMPLETADO" || normalized === "CANCELADO";
};

const esEstadoVisibleEnGestion = (estado) => {
  const normalized = normalizarEstadoVenta(estado);
  return (
    normalized === "PENDIENTE" ||
    normalized === "EN_PROCESO" ||
    normalized === "CANCELADO"
  );
};

const formatearMoneda = (valor) =>
  typeof valor === "number"
    ? `COP $${valor.toLocaleString("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
    : `COP $${valor || 0}`;

const parseFechaVenta = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;

  const text = String(valor).trim();
  if (!text) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    // Evita corrimiento de día por zona horaria cuando API retorna YYYY-MM-DD.
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const compararVentasRecientes = (a = {}, b = {}) => {
  const idA = parseIdSeguro(extraerIdVenta(a)) || 0;
  const idB = parseIdSeguro(extraerIdVenta(b)) || 0;
  return idB - idA;
};

const compararVentasGestion = (a = {}, b = {}) => {
  const aCancelada = normalizarEstadoVenta(a?.estado_venta) === "CANCELADO";
  const bCancelada = normalizarEstadoVenta(b?.estado_venta) === "CANCELADO";

  // Mantener canceladas al final y el resto ordenado por ID.
  if (aCancelada !== bCancelada) return aCancelada ? 1 : -1;

  return compararVentasRecientes(a, b);
};

const formatearFecha = (valor) => {
  const fecha = parseFechaVenta(valor);
  if (!fecha) return "Sin fecha";
  const opciones = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Bogota", // Zona horaria de Colombia
  };

  return fecha.toLocaleDateString("es-ES", opciones);
};

const renderResumenCambioEstado = (items = []) => (
  <div className="confirm-modal-summary">
    {items.map((item) => (
      <div className="confirm-modal-summary-item" key={item.label}>
        <span className="confirm-modal-summary-label">{item.label}</span>
        <span className="confirm-modal-summary-value">{item.value || "-"}</span>
      </div>
    ))}
  </div>
);

const calcularTotal = (detalles = []) =>
  detalles.reduce(
    (acc, det) =>
      acc + (Number(det?.cantidad) || 0) * (Number(det?.valorUnitario) || 0),
    0
  );

// Mapea un detalle del formulario al formato que espera el backend
const mapDetalleToBackend = (detalle = {}) => {
  const tipoBase = (detalle.tipoVenta || "").toUpperCase();
  // Ajuste para coincidir con el ejemplo del backend: "MEMBRESÍA"
  const tipo = tipoBase.startsWith("MEMB")
    ? "MEMBRESÍA"
    : tipoBase || "PRODUCTO";

  const base = {
    tipo_venta: tipo,
    cantidad: Number(detalle.cantidad) || 0,
    perdidas_o_ganancias: 0, // siempre 0 desde el front
    valor_unitario: Number(detalle.valorUnitario) || 0,
  };

  if (detalle.recursoId != null) {
    const idNum = Number(detalle.recursoId);
    if (!Number.isNaN(idNum)) {
      if (tipo === "PRODUCTO") base.id_producto = idNum;
      if (tipo === "MEMBRESÍA") base.id_membresia = idNum;
      if (tipo === "SERVICIO") base.id_servicio = idNum;
    }
  }
  return base;
};

// Construye el payload EXACTO que el backend de ventas espera
const buildVentaPayload = (form) => {
  const detallesBackend = Array.isArray(form?.detalles)
    ? form.detalles.map(mapDetalleToBackend)
    : [];
  const valor_total_venta = calcularTotal(form?.detalles || []);

  const payload = {
    id_de_usuario: Number(form?.idUsuario),
    valor_total_venta,
    estado_venta: normalizarEstadoVenta(form?.estadoVenta),
    detalles: detallesBackend,
  };

  if (form?.fechaVenta) payload.fecha_venta = form.fechaVenta;
  if (form?.plazoMaximo) payload.plazo_maximo = form.plazoMaximo;
  return payload;
};

// Detalle desde la API -> estructura para UI
const mapDetalleFromApi = (detalle = {}) => {
  const tipo = (detalle.tipo_venta || "").toUpperCase();
  const cantidad =
    Number(detalle.cantidad ?? detalle.cantidad_total ?? detalle.qty ?? 1) || 0;
  const valorUnitario =
    Number(
      detalle.valor_unitario ?? detalle.valor_total_venta ?? detalle.precio ?? 0
    ) || 0;
  const subtotal = cantidad * valorUnitario;
  const recursoId =
    detalle.id_producto ?? detalle.id_membresia ?? detalle.id_servicio ?? null;

  return {
    tipo_venta: tipo,
    recursoId,
    cantidad,
    valor_unitario: valorUnitario,
    subtotal,
  };
};

// Normaliza una venta cruda del backend a lo que usa la UI
const normalizarVentaBackend = (raw = {}, idx = 0, mapaUsuarios = {}) => {
  const detallesBackend = Array.isArray(raw.detalles_venta)
    ? raw.detalles_venta
    : Array.isArray(raw.detalle_venta)
      ? raw.detalle_venta
      : Array.isArray(raw.detalle)
        ? raw.detalle
        : Array.isArray(raw.detalles)
          ? raw.detalles
          : [];

  const detallesUI = detallesBackend.map(mapDetalleFromApi);
  const totalItems = detallesUI.reduce((acc, d) => acc + (d.cantidad || 0), 0);
  const tipos = Array.from(
    new Set(
      (detallesBackend.length ? detallesBackend : detallesUI)
        .map((d) => (d.tipo_venta || d.tipo || d.tipoVenta || "").toString())
        .filter(Boolean)
    )
  ).join(", ");

  // CORRECCIÓN: Usar id_usuario del backend
  const userId =
    raw.id_usuario ??
    raw.id_de_usuario ??
    raw.idUsuario ??
    raw.usuario?.id_usuario ??
    raw.usuario?.id ??
    raw.id_usuario_usuario?.id_usuario ??
    raw.id_usuario_usuario?.id;

  const usuarioData =
    raw.usuario ??
    raw.id_usuario_usuario ??
    raw.usuario_detalle ??
    raw.usuarioData ??
    null;

  const usuarioReferencia =
    userId !== undefined && userId !== null ? mapaUsuarios[userId] : null;

  const usuario_nombre =
    obtenerNombreUsuarioReal(
      construirNombreUsuario(usuarioData, null),
      raw.usuario_nombre,
      raw.nombre_usuario,
      raw.nombre_completo,
      raw.nombre,
      raw.cliente,
      raw.usuario?.nombre_completo,
      raw.usuario?.full_name,
      raw.usuario?.name,
      raw.usuario?.usuario_nombre,
      raw.usuario?.nombre_usuario,
      raw.usuario?.nombre,
      raw.usuario?.email,
      raw.id_usuario_usuario?.nombre_completo,
      raw.id_usuario_usuario?.full_name,
      raw.id_usuario_usuario?.name,
      raw.id_usuario_usuario?.usuario_nombre,
      raw.id_usuario_usuario?.nombre_usuario,
      raw.id_usuario_usuario?.nombre,
      raw.id_usuario_usuario?.email,
      usuarioReferencia?.nombre || ""
    ) ||
    (userId !== undefined && userId !== null
      ? `Usuario ${userId}`
      : "Usuario N/D");

  const usuario_documento =
    obtenerTextoValido(
      raw.documento_usuario,
      raw.documento,
      raw.numero_documento,
      raw.num_documento,
      raw.usuario?.documento,
      raw.usuario?.numero_documento,
      raw.usuario?.num_documento,
      raw.id_usuario_usuario?.documento,
      raw.id_usuario_usuario?.numero_documento,
      raw.id_usuario_usuario?.num_documento,
      construirDocumentoUsuario(usuarioData),
      usuarioReferencia?.documento || ""
    ) || "Documento N/D";

  const valor_total_venta =
    Number(
      raw.valor_total_venta ??
      raw.total ??
      raw.monto ??
      calcularTotal(detallesUI)
    ) || 0;

  // CORRECCIÓN: Usar id_pedido_cliente como ID principal
  return {
    id:
      raw.id_pedido_cliente ??
      raw.id ??
      raw.id_venta ??
      raw.idVentas ??
      raw.id_ventas ??
      raw.codigo ??
      idx + 1,
    id_usuario: userId,
    usuario_nombre,
    usuario_documento,
    fecha_venta: raw.fecha_venta ?? raw.fecha ?? raw.createdAt ?? "",
    plazo_maximo:
      raw.plazo_maximo ??
      raw.plazoMaximo ??
      raw.fecha_entrega ??
      raw.fechaEntrega ??
      "",
    estado_venta: normalizarEstadoVenta(
      raw.estado_venta ?? raw.estado ?? raw.id_estado
    ),
    valor_total_venta,
    detalles: detallesUI,
    totalItems,
    tipos,
  };
};

const normalizarTipoVentaTexto = (valor = "") => {
  const limpio = String(valor)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!limpio) return "";
  if (limpio.includes("MEMB")) return "Membresia";
  if (limpio.includes("SERV")) return "Servicio";
  if (limpio.includes("PROD")) return "Producto";
  return limpio.charAt(0) + limpio.slice(1).toLowerCase();
};

const obtenerTipoVentaVisual = (venta = {}) => {
  const fuentes = [];

  if (Array.isArray(venta?.tipos)) {
    fuentes.push(...venta.tipos);
  } else if (typeof venta?.tipos === "string" && venta.tipos.trim()) {
    fuentes.push(...venta.tipos.split(","));
  }

  if (!fuentes.length && Array.isArray(venta?.detalles)) {
    fuentes.push(
      ...venta.detalles
        .map((d) => d?.tipo_venta || d?.tipo || d?.tipoVenta || "")
        .filter(Boolean)
    );
  }

  const normalizados = Array.from(
    new Set(
      fuentes
        .map((tipo) => normalizarTipoVentaTexto(tipo))
        .filter(Boolean)
    )
  );

  return normalizados.length ? normalizados.join(", ") : "Sin tipo";
};

const coincideBusqueda = (venta, termino) => {
  if (!termino) return true;
  const t = normalizarTexto(termino);

  // Estados permitidos para búsqueda exacta
  const estadosPermitidos = [
    "pendiente",
    "en proceso",
    "completado",
    "cancelado",
  ];

  // Si es un estado específico, buscar coincidencia exacta
  if (estadosPermitidos.includes(t)) {
    const estadoNormalizado = normalizarEstadoVenta(venta.estado_venta);
    const estadoDisplay = estadoNormalizado.toLowerCase().replace("_", " ");
    return estadoDisplay === t;
  }

  // Buscar en todos los campos disponibles
  const camposBusqueda = [
    venta.id,
    venta.id_usuario,
    venta.usuario_nombre,
    venta.usuario_documento,
    venta.fecha_venta, // Fecha en formato original
    formatearFecha(venta.fecha_venta), // Fecha formateada para búsqueda
    venta.plazo_maximo,
    formatearFecha(venta.plazo_maximo),
    venta.estado_venta,
    venta.tipos,
    venta.valor_total_venta,
    venta.totalItems,
    String(venta.totalItems), // Cantidad como string para búsqueda numérica
    formatearMoneda(venta.valor_total_venta), // Valor formateado
    String(venta.valor_total_venta), // Valor como string
  ];

  return camposBusqueda
    .map((campo) => normalizarTexto(String(campo || "")))
    .some((campo) => campo.includes(t));
};

function VentasPage({ view = "gestion" }) {
  const isCompletados = view === "completados";

  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filteredVentas, setFilteredVentas] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    id: null,
    nuevoEstado: null,
    nombreVenta: "",
    usuarioNombre: "",
    valorTotal: "",
    fechaVenta: "",
    estadoActual: "",
    nuevoEstadoTexto: "",
  });
  const [actualizandoEstado, setActualizandoEstado] = useState(false);

  const aplicarBusqueda = useCallback(() => {
    setSearchTerm(searchInput.trim());
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  }, [searchInput]);

  const cargarMapaUsuarios = useCallback(async () => {
    const USERS_PAGE_SIZE = 1000;
    const MAX_USER_PAGES = 50;
    const usuariosPorId = {};

    for (let page = 1; page <= MAX_USER_PAGES; page += 1) {
      const respuesta = await obtenerUsuarios({
        query: {
          page: 1,
          limit: 0,
          pagina: 1,
          pageSize: 0,
          perPage: 0,
          offset: 0,
          skip: 0,
        },
      }).catch(() => null);

      const pagina = normalizePaginatedResponse(respuesta, {
        preferredKeys: ["usuarios", "data"],
        defaultPage: 1,
        defaultLimit: USERS_PAGE_SIZE,
      });

      const items = Array.isArray(pagina.items) ? pagina.items : [];
      if (items.length === 0) break;

      items.forEach((usuario) => {
        const id = extraerIdUsuario(usuario);
        if (id === undefined || id === null) return;
        usuariosPorId[id] = {
          nombre: construirNombreUsuario(usuario, id),
          documento: construirDocumentoUsuario(usuario),
        };
      });

      break;
    }

    return usuariosPorId;
  }, []);

  const enriquecerVentasConNombreUsuario = useCallback(async (ventasBase, mapaUsuarios) => {
    const pendientes = ventasBase.filter(
      (venta) =>
        extraerIdVenta(venta) &&
        (
          esNombreUsuarioFallback(venta?.usuario_nombre) ||
          esDocumentoUsuarioFallback(venta?.usuario_documento)
        )
    );

    if (pendientes.length === 0) return ventasBase;

    const token = getToken?.() || localStorage.getItem("token");
    const respuestas = await Promise.allSettled(
      pendientes.map(async (venta) => {
        const ventaDetallada = await obtenerVentaPorId(extraerIdVenta(venta), {
          token,
        });

        let usuarioDetallado = null;
        const userId = parseIdSeguro(
          venta?.id_usuario ??
            ventaDetallada?.id_usuario ??
            ventaDetallada?.id_de_usuario ??
            ventaDetallada?.usuario?.id_usuario ??
            ventaDetallada?.usuario?.id ??
            ventaDetallada?.id_usuario_usuario?.id_usuario ??
            ventaDetallada?.id_usuario_usuario?.id,
        );

        if (userId && esDocumentoUsuarioFallback(venta?.usuario_documento)) {
          try {
            usuarioDetallado = await obtenerUsuarioPorId(userId);
          } catch (error) {
            console.error(
              "[Ventas] No se pudo enriquecer el usuario de la venta:",
              error,
            );
          }
        }

        return { ventaDetallada, usuarioDetallado };
      })
    );

    const nombresPorVenta = new Map();

    respuestas.forEach((resultado, index) => {
      if (resultado.status !== "fulfilled") return;

      const idVenta = extraerIdVenta(pendientes[index]);
      const ventaNormalizada = normalizarVentaBackend(
        {
          ...resultado.value?.ventaDetallada,
          ...(resultado.value?.usuarioDetallado &&
          typeof resultado.value.usuarioDetallado === "object"
            ? {
                usuario:
                  resultado.value.ventaDetallada?.usuario ||
                  resultado.value.usuarioDetallado,
                id_usuario_usuario:
                  resultado.value.ventaDetallada?.id_usuario_usuario ||
                  resultado.value.usuarioDetallado,
                documento_usuario:
                  resultado.value.ventaDetallada?.documento_usuario ||
                  construirDocumentoUsuario(resultado.value.usuarioDetallado),
              }
            : {}),
        },
        index,
        mapaUsuarios
      );

      if (
        !esNombreUsuarioFallback(ventaNormalizada?.usuario_nombre) ||
        !esDocumentoUsuarioFallback(ventaNormalizada?.usuario_documento)
      ) {
        nombresPorVenta.set(idVenta, {
          usuario_nombre: ventaNormalizada.usuario_nombre,
          usuario_documento: ventaNormalizada.usuario_documento,
        });
      }
    });

    if (nombresPorVenta.size === 0) return ventasBase;

    return ventasBase.map((venta) => {
      const idVenta = extraerIdVenta(venta);
      const usuarioData = nombresPorVenta.get(idVenta);
      return usuarioData ? { ...venta, ...usuarioData } : venta;
    });
  }, []);

  // Función auxiliar para recargar ventas
  const recargarVentas = useCallback(async ({
    page = pagination.page,
    limit = pagination.limit,
    search = searchQuery,
  } = {}) => {
    try {
      const token = getToken?.() || localStorage.getItem("token");
      const resVentas = await (isCompletados
        ? obtenerVentasFinalizadas({
            token,
            query: {
              page,
              limit,
              ...(search ? { search } : {}),
            },
          })
        : obtenerVentas({
            token,
            query: {
              page,
              limit,
              ...(search ? { search } : {}),
            },
          }));

      const {
        items: listaVentas,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(resVentas, {
        preferredKeys: ["ventas", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });

      const normalizadas = listaVentas.map((venta, idx) => {
        return normalizarVentaBackend(venta, idx, usuariosMap);
      });
      const normalizadasPorVista = normalizadas.filter((venta) =>
        isCompletados
          ? esEstadoVisibleEnCompletados(venta.estado_venta)
          : esEstadoVisibleEnGestion(venta.estado_venta)
      );
      const ventasFiltradas = searchQuery
        ? normalizadasPorVista.filter((venta) => coincideBusqueda(venta, searchQuery))
        : normalizadasPorVista;
      const isSearchResult = Boolean(searchQuery);
      const hasServerPagination = hasExplicitPaginationInfo(resVentas);
      const totalItemsResolved = isSearchResult
        ? ventasFiltradas.length
        : hasServerPagination
        ? totalItems
        : ventasFiltradas.length;
      const totalPagesResolved = isSearchResult
        ? Math.max(
            1,
            Math.ceil(totalItemsResolved / Math.max(1, pagination.limit))
          )
        : hasServerPagination
        ? totalPages
        : Math.max(
            1,
            Math.ceil(totalItemsResolved / Math.max(1, pagination.limit))
          );
      const currentPageResolved = isSearchResult
        ? 1
        : hasServerPagination
        ? resolvedPage
        : Math.min(Math.max(1, pagination.page), totalPagesResolved);
      const startIndex = hasServerPagination && !isSearchResult
        ? 0
        : (currentPageResolved - 1) * pagination.limit;
      let ventasPaginaActual = hasServerPagination && !isSearchResult
        ? ventasFiltradas
        : ventasFiltradas.slice(startIndex, startIndex + pagination.limit);

      ventasPaginaActual = await enriquecerVentasConNombreUsuario(
        ventasPaginaActual,
        usuariosMap
      );

      setVentas(ventasPaginaActual);
      setFilteredVentas(ventasPaginaActual);
      setPagination((prev) => ({
        ...prev,
        page: currentPageResolved,
        limit: hasServerPagination && !isSearchResult ? resolvedLimit : prev.limit,
        totalPages: totalPagesResolved,
        totalItems: totalItemsResolved,
      }));
      return true;
    } catch (error) {
      console.error("[Ventas] Error recargando ventas:", error);
      toast.error("Error al recargar ventas");
      return false;
    }
  }, [
    enriquecerVentasConNombreUsuario,
    usuariosMap,
    searchQuery,
    isCompletados,
    pagination.limit,
    pagination.page,
  ]);

  useEffect(() => {
    setFilteredVentas([...ventas]);
  }, [ventas]);

  // Cargar listado desde el backend
  useEffect(() => {
    const cargarVentas = async () => {
      setLoading(true);
      try {
        const token = getToken?.() || localStorage.getItem("token");
        const [resVentas, resUsuarios] = await Promise.all([
          isCompletados
            ? obtenerVentasFinalizadas({
                token,
                query: {
                  page: pagination.page,
                  limit: pagination.limit,
                  ...(searchQuery ? { search: searchQuery } : {}),
                },
              })
            : obtenerVentas({
                token,
                query: {
                  page: pagination.page,
                  limit: pagination.limit,
                  ...(searchQuery ? { search: searchQuery } : {}),
                },
              }),
          cargarMapaUsuarios().catch((e) => {
            console.error("[Ventas] No se pudo obtener usuarios:", e);
            return {};
          }),
        ]);

        const {
          items: listaVentas,
          page: resolvedPage,
          limit: resolvedLimit,
          totalPages,
          totalItems,
        } = normalizePaginatedResponse(resVentas, {
          preferredKeys: ["ventas", "data"],
          defaultPage: pagination.page,
          defaultLimit: pagination.limit,
        });

        const mapaUsuarios =
          resUsuarios && typeof resUsuarios === "object" ? resUsuarios : {};

        setUsuariosMap(mapaUsuarios);

        const normalizadas = listaVentas.map((venta, idx) => {
          return normalizarVentaBackend(venta, idx, mapaUsuarios);
        });
        const normalizadasPorVista = normalizadas.filter((venta) =>
          isCompletados
            ? esEstadoVisibleEnCompletados(venta.estado_venta)
            : esEstadoVisibleEnGestion(venta.estado_venta)
        );
        const ventasFiltradas = searchQuery
          ? normalizadasPorVista.filter((venta) =>
              coincideBusqueda(venta, searchQuery)
            )
          : normalizadasPorVista;
        const isSearchResult = Boolean(searchQuery);
        const hasServerPagination = hasExplicitPaginationInfo(resVentas);
        const totalItemsResolved = isSearchResult
          ? ventasFiltradas.length
          : hasServerPagination
          ? totalItems
          : ventasFiltradas.length;
        const totalPagesResolved = isSearchResult
          ? Math.max(
              1,
              Math.ceil(totalItemsResolved / Math.max(1, pagination.limit))
            )
          : hasServerPagination
          ? totalPages
          : Math.max(
              1,
              Math.ceil(totalItemsResolved / Math.max(1, pagination.limit))
            );
        const currentPageResolved = isSearchResult
          ? 1
          : hasServerPagination
          ? resolvedPage
          : Math.min(Math.max(1, pagination.page), totalPagesResolved);
        const startIndex = hasServerPagination && !isSearchResult
          ? 0
          : (currentPageResolved - 1) * pagination.limit;
        let ventasPaginaActual = hasServerPagination && !isSearchResult
          ? ventasFiltradas
          : ventasFiltradas.slice(
              startIndex,
              startIndex + pagination.limit
            );

        ventasPaginaActual = await enriquecerVentasConNombreUsuario(
          ventasPaginaActual,
          mapaUsuarios
        );

        setVentas(ventasPaginaActual);
        setFilteredVentas(ventasPaginaActual);
        setPagination((prev) => ({
          ...prev,
          page: currentPageResolved,
          limit: hasServerPagination && !isSearchResult ? resolvedLimit : prev.limit,
          totalPages: totalPagesResolved,
          totalItems: totalItemsResolved,
        }));
      } catch (error) {
        console.error("[Ventas] No se pudo cargar desde API:", error);
        setVentas([]);
        setFilteredVentas([]);
        toast.error("No se pudo cargar ventas del servidor.");
      } finally {
        setLoading(false);
      }
    };

    cargarVentas();
  }, [
    enriquecerVentasConNombreUsuario,
    cargarMapaUsuarios,
    isCompletados,
    pagination.limit,
    pagination.page,
    searchQuery,
  ]);

  // Función para manejar el cambio de estado desde el SelectorEstado
  const manejarCambioEstado = useCallback(
    (venta, estadoSeleccionado = null) => {
      if (!venta) return;

      const ventaId = venta.id;
      if (!ventaId) {
        toast.error(STATUS_CHANGE_ERROR_MESSAGE);
        return;
      }

      const estadoActual =
        normalizarEstadoVenta(venta.estado_venta) || "PENDIENTE";

      // VALIDACIÓN: Si la venta está CANCELADA, no permitir cambio de estado
      if (estadoActual === "CANCELADO") {
        toast.error(STATUS_CHANGE_ERROR_MESSAGE);
        return;
      }

      const nuevoEstado = normalizarEstadoVenta(estadoSeleccionado ?? estadoActual);
      if (estadoActual === nuevoEstado) return;
      const estadoActualConfig = getEstadoVentaConfig(estadoActual);
      const nuevoEstadoConfig = getEstadoVentaConfig(nuevoEstado);

      setEstadoPendiente({
        mostrar: true,
        id: ventaId,
        nuevoEstado,
        nombreVenta: `Venta ${ventaId}`,
        usuarioNombre: venta.usuario_nombre || `Usuario ${venta.id_de_usuario || "-"}`,
        valorTotal: formatearMoneda(venta.valor_total_venta),
        fechaVenta: formatearFecha(venta.fecha_venta),
        estadoActual: estadoActualConfig.label,
        nuevoEstadoTexto: nuevoEstadoConfig.label,
      });
    },
    []
  );

  const ventasVista = useMemo(() => {
    const base = Array.isArray(filteredVentas) ? [...filteredVentas] : [];
    if (!base.length) return base;

    return base.sort(compararVentasGestion);
  }, [filteredVentas]);

  const ventasConAcciones = useMemo(
    () =>
      ventasVista.map((venta) => ({
        ...venta,
        ...(isCompletados ? {} : { onStatusChange: manejarCambioEstado }),
      })),
    [ventasVista, manejarCambioEstado, isCompletados]
  );

  // Filtro por buscador
  const abrirModal = async (accion, venta = null) => {
    if (accion !== "editar" || !venta) {
      setVentaSeleccionada(venta);
      setAccionModal(accion);
      return;
    }

    const ventaId = extraerIdVenta(venta);
    if (!ventaId) {
      setVentaSeleccionada(venta);
      setAccionModal(accion);
      return;
    }

    try {
      const token = getToken?.() || localStorage.getItem("token");
      const [ventaResponse, detallesResponse] = await Promise.all([
        obtenerVentaPorId(ventaId, { token }).catch(() => null),
        obtenerDetallesVenta(ventaId, { token }).catch(() => null),
      ]);

      const ventaRaw =
        (ventaResponse && (ventaResponse.data || ventaResponse)) || venta;
      const detallesRaw = Array.isArray(detallesResponse?.data)
        ? detallesResponse.data
        : Array.isArray(detallesResponse)
          ? detallesResponse
          : [];

      const ventaCompleta = normalizarVentaBackend(
        {
          ...ventaRaw,
          detalles_venta:
            detallesRaw.length > 0
              ? detallesRaw
              : ventaRaw?.detalles_venta || ventaRaw?.detalles || venta?.detalles || [],
        },
        0,
        usuariosMap
      );

      setVentaSeleccionada(ventaCompleta);
    } catch (error) {
      console.error("[Ventas] No se pudo cargar la venta para editar:", error);
      setVentaSeleccionada(venta);
      toast.error(getApiErrorMessage(error, "No se pudo cargar la venta para editar"));
    }

    setAccionModal(accion);
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setVentaSeleccionada(null);
  };

  // Crear venta - El payload lo construye la API en Ventas.jsx
  const manejarCrearVenta = async (ventaForm) => {
    const token = getToken?.() || localStorage.getItem("token");

    // El objeto ventaForm viene del modal con esta estructura:
    // {
    //   idUsuario: number,
    //   fechaVenta: string,
    //   estadoVenta: string,
    //   detalles: [{ tipoVenta, recursoId, cantidad, valorUnitario }]
    // }

    try {
      const respuesta = await apiCrearVenta(ventaForm, { token });

      const normalizada = normalizarVentaBackend(
        respuesta?.data ?? respuesta ?? ventaForm,
        0,
        usuariosMap
      );

      setVentas((prev) => [normalizada, ...prev]);
      toast.success("Venta registrada exitosamente");
      await recargarVentas(); // Recargar para asegurar datos frescos
      return true;
    } catch (error) {
      console.error("[Ventas] Error al crear venta", error);
      toast.error(getApiErrorMessage(error, "No se pudo crear la venta"));
      return false;
    }
  };

  // Actualizar venta
  const manejarActualizarVenta = async (ventaForm) => {
    if (!ventaForm?.id) {
      console.error("[Ventas] Error: Falta el ID de la venta a actualizar");
      toast.error("Falta el ID de la venta a actualizar");
      return false;
    }

    const token = getToken?.() || localStorage.getItem("token");

    try {
      const respuesta = await apiActualizarVenta(ventaForm.id, ventaForm, {
        token,
      });

      const normalizada = normalizarVentaBackend(
        respuesta?.data ?? respuesta ?? { ...ventaForm },
        0,
        usuariosMap
      );

      setVentas((prev) =>
        prev.map((v) =>
          v.id === normalizada.id ? { ...v, ...normalizada } : v
        )
      );

      toast.success("Venta actualizada exitosamente");
      await recargarVentas(); // Recargar para asegurar datos frescos
      return true;
    } catch (error) {
      console.error("[Ventas] Error al actualizar", error);
      toast.error(getApiErrorMessage(error, "No se pudo actualizar la venta"));
      return false;
    }
  };

  const manejarEliminarVenta = async (ventaOId) => {
    const esObjeto = typeof ventaOId === "object" && ventaOId !== null;
    const idNumero = esObjeto
      ? extraerIdVenta(ventaOId)
      : parseIdSeguro(ventaOId);

    if (!idNumero) {
      const raw = esObjeto ? JSON.stringify(ventaOId) : ventaOId;
      toast.error(`ID de venta inválido${raw ? ` (${raw})` : ""}`);
      return;
    }

    const token = getToken?.() || localStorage.getItem("token");
    const backup = ventas;
    setVentas((prev) => prev.filter((v) => v.id !== idNumero));

    try {
      await apiEliminarVenta(idNumero, { token });
      setPagination((prev) => ({ ...prev, page: 1 }));
      await recargarVentas({
        page: 1,
        limit: pagination.limit,
      });
      toast.success("Venta eliminada exitosamente");
    } catch (error) {
      console.error("[Ventas] Error al eliminar", error);
      setVentas(backup);
      toast.error(getApiErrorMessage(error, "No se pudo eliminar la venta"));
    }
  };

  const confirmarCambioEstado = async () => {
    if (!estadoPendiente.id || actualizandoEstado) return;

    setActualizandoEstado(true);
    try {
      const ventaActual = ventas.find((v) => v.id === estadoPendiente.id);

      if (ventaActual) {
        // Asegurarse de que la fecha de venta no sea futura (restricción de BD)
        const fechaVentaActual = new Date(ventaActual.fecha_venta);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Solo fecha, sin hora

        // Si la fecha de venta es futura, usar la fecha actual
        const fechaVentaFinal =
          fechaVentaActual > hoy
            ? new Date().toISOString().split("T")[0] // Fecha actual en formato YYYY-MM-DD
            : ventaActual.fecha_venta;

        // Obtener el ID del estado correcto usando la función del hook
        const estadoInfo = estadoToPayload(estadoPendiente.nuevoEstado);

        // Obtener el token de autenticación
        const token = getToken?.() || localStorage.getItem("token");

        // Hacer la llamada a la API primero
        await apiActualizarVenta(
          estadoPendiente.id,
          {
            id_de_usuario: ventaActual.id_de_usuario,
            fecha_venta: fechaVentaFinal,
            plazo_maximo: ventaActual.plazo_maximo,
            estado_venta: estadoPendiente.nuevoEstado,
            id_estado: estadoInfo.id_estado, // Agregar el id_estado numérico
            detalles: ventaActual.detalles.map((d) => ({
              tipo_venta: d.tipo_venta,
              cantidad: d.cantidad,
              valor_unitario: d.valor_unitario,
              id_producto: d.recursoId,
            })),
          },
          { token }
        );

        // Actualizar el estado en la UI después de la API exitosa
        setVentas((prev) =>
          prev.map((v) =>
            v.id === estadoPendiente.id
              ? {
                ...v,
                estado_venta: estadoPendiente.nuevoEstado,
              }
              : v
          )
        );

        // Recargar desde el endpoint correspondiente para reflejar el cambio (pendientes/finalizadas)
        await recargarVentas();

        toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);
      }
    } catch (error) {
      console.error("Error al actualizar el estado de la venta:", error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
    } finally {
      setActualizandoEstado(false);
      setEstadoPendiente({
        mostrar: false,
        id: null,
        nuevoEstado: null,
        nombreVenta: "",
        usuarioNombre: "",
        valorTotal: "",
        fechaVenta: "",
        estadoActual: "",
        nuevoEstadoTexto: "",
      });
    }
  };

  const handleExport = () => {
    const dataToExport = ventasVista.map((venta) => {
      const config = getEstadoVentaConfig(venta.estado_venta);
      return {
        ID: venta.id,
        Documento: venta.usuario_documento,
        "Tipo de venta": obtenerTipoVentaVisual(venta),
        Cantidad: venta.totalItems,
        Fecha: formatearFecha(venta.fecha_venta),
        "Plazo maximo": formatearFecha(venta.plazo_maximo),
        "Valor de venta": venta.valor_total_venta,
        Estado: config.label,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas");
    XLSX.writeFile(wb, isCompletados ? "ventas_completadas.xlsx" : "ventas.xlsx");
    toast.success("Exportación lista");
  };

  const columnas = useMemo(
    () => [
      { label: "ID", field: "id" },
      { label: "Documento", field: "usuario_documento" },
      {
        label: "Tipo de venta",
        field: "tipos",
        Cell: ({ row }) => <span>{obtenerTipoVentaVisual(row)}</span>,
        accessor: (row) => obtenerTipoVentaVisual(row),
      },
      {
        label: "Cantidad",
        field: "totalItems",
      },
      {
        label: "Fecha",
        field: "fecha_venta",
        Cell: ({ value }) => <span>{formatearFecha(value)}</span>,
      },
      {
        label: "Valor de venta",
        field: "valor_total_venta",
        Cell: ({ value }) => <strong>{formatearMoneda(value)}</strong>,
      },
      {
        label: "Estado",
        field: "estado_venta",
        Cell: ({ row }) => {
          const estadoConfig = getEstadoVentaConfig(row.estado_venta);

          if (isCompletados) {
            return (
              <span
                className={`badge-estado badge-pequeno badge-con-borde badge-estado--readonly ${getEstadoToneClass(
                  estadoConfig.id_estado
                )}`}
              >
                <span className="badge-content">{estadoConfig.label}</span>
              </span>
            );
          }

          return (
            <SelectorEstado
              estadoActual={estadoConfig.id_estado}
              tamano="pequeño"
              opciones={ESTADO_OPCIONES_UI.map((estado) => ({
                value: estado.id_estado,
                label: estado.label,
              }))}
              deshabilitado={
                estadoConfig.id_estado === 5 || estadoConfig.id_estado === 6
              }
              onCambioEstado={(nuevoEstadoId) => {
                const next = ESTADO_OPCIONES_UI.find(
                  (estado) =>
                    String(estado.id_estado) === String(nuevoEstadoId)
                )?.value;
                if (row.onStatusChange && next) {
                  row.onStatusChange(row, next);
                }
              }}
            />
          );
        },
        accessor: (row) => normalizarEstadoVenta(row.estado_venta),
      },
    ],
    [isCompletados]
  );

  return (
    <div className="contenido-pagina ventas-page">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Store size={40} className="icono-titulo" color="red" />
          <h1 className="titulo-pagina">
            {isCompletados ? "Ventas Completadas" : "Ventas"}
          </h1>
        </div>
        <div className="acciones-derecha">
          {!isCompletados && (
            <button
              className="boton boton-primario"
              onClick={() => abrirModal("crear")}
              disabled={!canCreate}
              title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
            >
              + Nueva Venta
            </button>
          )}
          <button className="boton boton-secundario" onClick={handleExport}>
            <FileDown size={18} className="icono-boton" />
            Exportar
          </button>
          <BuscadorUniversal
            placeholder="Buscar ventas..."
            value={searchInput}
            onChange={setSearchInput}
            onEnterPress={aplicarBusqueda}
            onSearch={aplicarBusqueda}
            className="expandido"
          />
        </div>
      </div>

      <div className="table-container">
        <DataTable
          permisoId={permisoId}
          columns={columnas}
          data={ventasConAcciones}
          loading={loading}
          onRefresh={recargarVentas}
          paginationMode="server"
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={(page, limit) =>
            setPagination((prev) => ({
              ...prev,
              page,
              limit: Number(limit) || prev.limit,
            }))
          }
          onView={async (venta) => {
            let ventaResuelta = venta;

            if (
              esNombreUsuarioFallback(venta?.usuario_nombre) ||
              esDocumentoUsuarioFallback(venta?.usuario_documento)
            ) {
              try {
                const token = getToken?.() || localStorage.getItem("token");
                const respuesta = await obtenerVentaPorId(extraerIdVenta(venta), {
                  token,
                });
                const userId = parseIdSeguro(
                  venta?.id_usuario ??
                    respuesta?.id_usuario ??
                    respuesta?.id_de_usuario ??
                    respuesta?.usuario?.id_usuario ??
                    respuesta?.usuario?.id ??
                    respuesta?.id_usuario_usuario?.id_usuario ??
                    respuesta?.id_usuario_usuario?.id,
                );
                let usuarioDetallado = null;

                if (userId && esDocumentoUsuarioFallback(venta?.usuario_documento)) {
                  try {
                    usuarioDetallado = await obtenerUsuarioPorId(userId);
                  } catch (error) {
                    console.error(
                      "[Ventas] No se pudo enriquecer el documento del usuario:",
                      error,
                    );
                  }
                }

                const normalizada = normalizarVentaBackend(
                  {
                    ...respuesta,
                    ...(usuarioDetallado
                      ? {
                          usuario: respuesta?.usuario || usuarioDetallado,
                          id_usuario_usuario:
                            respuesta?.id_usuario_usuario || usuarioDetallado,
                          documento_usuario:
                            respuesta?.documento_usuario ||
                            construirDocumentoUsuario(usuarioDetallado),
                        }
                      : {}),
                  },
                  0,
                  usuariosMap
                );
                if (
                  !esNombreUsuarioFallback(normalizada?.usuario_nombre) ||
                  !esDocumentoUsuarioFallback(normalizada?.usuario_documento)
                ) {
                  ventaResuelta = { ...venta, ...normalizada };
                }
              } catch (error) {
                console.error("[Ventas] No se pudo enriquecer el detalle:", error);
              }
            }

            setVentaSeleccionada(ventaResuelta);
            setAccionModal("ver");
          }}
          onEdit={
            isCompletados ? null : (venta) => abrirModal("editar", venta)
          }
          onDelete={
            isCompletados ? null : (venta) => abrirModal("eliminar", venta)
          }
          canEdit={(venta) => {
            // No permitir editar si está COMPLETADO (5) o CANCELADO (6)
            const estadoActual = normalizarEstadoVenta(venta.estado_venta);
            const estadoConfig = getEstadoVentaConfig(estadoActual);
            return (
              canEdit &&
              estadoConfig.id_estado !== 5 &&
              estadoConfig.id_estado !== 6
            );
          }}
          canDelete={(venta) => {
            // No permitir eliminar si está COMPLETADO (5) o CANCELADO (6)
            const estadoActual = normalizarEstadoVenta(venta.estado_venta);
            const estadoConfig = getEstadoVentaConfig(estadoActual);
            return (
              canDelete &&
              estadoConfig.id_estado !== 5 &&
              estadoConfig.id_estado !== 6
            );
          }}
          grayEditButtons={true} // Mantener estilo gris
          actions
          emptyTitle="No se encontraron ventas"
          emptyMessage="No hay ventas disponibles para mostrar en la página actual."
        />
      </div>

      {accionModal === "crear" && canCreate && (
        <ModalCrearVenta
          onClose={cerrarModal}
          onSave={manejarCrearVenta}
          estados={ESTADO_OPCIONES_UI}
          tipos={TIPO_VENTA_OPCIONES}
        />
      )}

      {accionModal === "ver" && ventaSeleccionada && (
        <ModalVerVenta
          venta={ventaSeleccionada}
          onClose={cerrarModal}
          colorEstado={
            getEstadoVentaConfig(ventaSeleccionada.estado_venta).color
          }
        />
      )}

      {accionModal === "editar" && ventaSeleccionada && (
        <ModalCrearVenta
          onClose={cerrarModal}
          onSave={manejarActualizarVenta}
          initialData={ventaSeleccionada}
          title="Editar Venta"
          estados={ESTADO_OPCIONES_UI}
          tipos={TIPO_VENTA_OPCIONES}
        />
      )}

      {ventaSeleccionada && (
        <DeleteModal
          isOpen={accionModal === "eliminar"}
          onClose={cerrarModal}
          onConfirm={() => manejarEliminarVenta(ventaSeleccionada.id)}
          item={ventaSeleccionada}
          title="Eliminar Venta"
          fields={[
            {
              key: "id",
              label: "ID Venta",
              format: (value) => <strong>#{value}</strong>,
            },
            {
              key: "usuario_documento",
              label: "Documento usuario",
            },
            {
              key: "valor_total_venta",
              label: "Valor Total",
              format: (value) => formatearMoneda(value),
            },
            {
              key: "fecha_venta",
              label: "Fecha",
              format: (value) => formatearFecha(value),
            },
            {
              key: "estado_venta",
              label: "Estado Actual",
              format: (value) => getEstadoVentaConfig(value).label,
            },
          ]}
          warningMessage="Esta acción no se puede deshacer. Se eliminará permanentemente el registro de venta y sus detalles."
        />
      )}

      {/* Modal de confirmación para cambio de estado */}
      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={() => {
          if (!actualizandoEstado) {
            setEstadoPendiente({
              mostrar: false,
              id: null,
              nuevoEstado: null,
              nombreVenta: "",
              usuarioNombre: "",
              valorTotal: "",
              fechaVenta: "",
              estadoActual: "",
              nuevoEstadoTexto: "",
            });
          }
        }}
        onConfirm={confirmarCambioEstado}
        disabled={actualizandoEstado}
        targetStatus={estadoPendiente.nuevoEstado}
        title={
          actualizandoEstado ? "Actualizando..." : `Cambiar estado de venta`
        }
        message={
          actualizandoEstado
            ? "Por favor espera mientras se actualiza el estado..."
            : `¿Seguro que deseas cambiar el estado de "${estadoPendiente.nombreVenta}" a ${estadoPendiente.nuevoEstadoTexto}?`
        }
        confirmText={
          actualizandoEstado
            ? "Actualizando..."
            : `${estadoPendiente.nuevoEstadoTexto}`
        }
        type={
          estadoPendiente.nuevoEstado === "ANULADA"
            ? "deactivate"
            : estadoPendiente.nuevoEstado === "PENDIENTE"
              ? "reset"
              : estadoPendiente.nuevoEstado === "PAGADA"
                ? "activate"
                : "activate"
        }
        details={estadoPendiente.id ? `#${estadoPendiente.id}` : "-"}
      >
        {renderResumenCambioEstado([
          {
            label: "Cliente/Usuario",
            value: estadoPendiente.usuarioNombre,
          },
          {
            label: "Valor Total",
            value: estadoPendiente.valorTotal,
          },
          {
            label: "Fecha",
            value: estadoPendiente.fechaVenta,
          },
          {
            label: "Estado Actual",
            value: estadoPendiente.estadoActual,
          },
        ])}
      </ConfirmModal>
    </div> 
  );
}

const Ventas = () => <VentasPage key="gestion" view="gestion" />;
export const VentasCompletadas = () => (
  <VentasPage key="completados" view="completados" />
);

export default Ventas;

export { calcularTotal };
