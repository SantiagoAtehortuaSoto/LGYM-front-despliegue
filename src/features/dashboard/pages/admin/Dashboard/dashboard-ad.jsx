import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { obtenerVentas } from "../../../hooks/Ventas_API/Ventas";
import { getProductos } from "../../../hooks/Productos_API/API_productos";
import { getMembresias } from "../../../hooks/Membresia_API/Membresia";
import { obtenerAsistenciasClientes } from "../../../hooks/Asistencias_API/Asistencias_API";
import { obtenerBeneficiarios } from "../../../hooks/Beneficiarios_API/benefeiciarios_API";
import { getToken } from "../../../hooks/Acceder_API/authService";
import { obtenerUsuarios, obtenerRolesUsuarios } from "../../../hooks/Usuarios_API/API_Usuarios";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const PRODUCTS_COLORS = ["#e50914", "#f97316", "#2563eb", "#059669", "#7c3aed"];
const DASHBOARD_REFRESH_EVENT = "dashboard:ventas-actualizadas";
const DASHBOARD_CLIENTS_REFRESH_EVENT = "dashboard:clientes-actualizados";
const CLIENT_ROLE_ID = 33;
const NEW_CLIENT_WINDOW_DAYS = 30;
const KPI_TONE_CLASSES = {
  ventas: "admin-home-tone--rose",
  "clientes-nuevos": "admin-home-tone--orange",
};
const MEMBERSHIP_TONE_CLASSES = [
  "admin-home-tone--rose",
  "admin-home-tone--orange",
  "admin-home-tone--blue",
];

const getMembershipToneClass = (index) =>
  MEMBERSHIP_TONE_CLASSES[index % MEMBERSHIP_TONE_CLASSES.length];

const STATUS_BY_ID = {
  1: "ACTIVO",
  2: "INACTIVO",
  3: "PENDIENTE",
  4: "EN PROCESO",
  5: "COMPLETADO",
  6: "CANCELADO",
};

const numberFormatter = new Intl.NumberFormat("es-CO");
const moneyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});
const compactCurrencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});
const saleDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const asArray = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
};

const loadAllPaginatedItems = async (fetcher, preferredKeys = ["data"]) => {
  const firstResponse = await fetcher({
    query: { page: 1 },
  });

  const firstPage = normalizePaginatedResponse(firstResponse, {
    preferredKeys,
    defaultPage: 1,
    defaultLimit: 100,
  });

  const totalPages = Number(firstPage.totalPages) > 1 ? Number(firstPage.totalPages) : 1;
  if (totalPages <= 1) {
    return firstPage.items;
  }

  const nextResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetcher({
        query: { page: index + 2 },
      })
    )
  );

  const nextItems = nextResponses.flatMap((response) =>
    normalizePaginatedResponse(response, {
      preferredKeys,
      defaultPage: 1,
      defaultLimit: 100,
    }).items
  );

  return [...firstPage.items, ...nextItems];
};

const parseNumericValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === "") return NaN;

  let text = String(value).trim();
  if (!text) return NaN;

  // Conserva signos y separadores decimales, elimina simbolos monetarios y texto.
  text = text.replace(/[^\d,.-]/g, "");
  if (!text) return NaN;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    // Si la ultima coma va despues del ultimo punto, asumimos formato es-CO: 12.345,67
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato en-US: 12,345.67
      text = text.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = text.split(",");
    // 12,5 o 12,50 -> decimal
    if (parts.length === 2 && parts[1].length <= 2) {
      text = `${parts[0]}.${parts[1]}`;
    } else {
      // 12,345 -> miles
      text = text.replace(/,/g, "");
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const normalizeTipoVenta = (value) => {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (raw.includes("PROD")) return "PRODUCTO";
  if (raw.includes("MEMB")) return "MEMBRESIA";
  if (raw.includes("SERV")) return "SERVICIO";
  return raw;
};

const normalizeEstadoVenta = (value) => {
  if (value === null || value === undefined || value === "") return "PENDIENTE";

  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && STATUS_BY_ID[asNumber]) {
    return STATUS_BY_ID[asNumber];
  }

  const raw = normalizeText(value);
  if (!raw) return "PENDIENTE";
  if (raw.includes("CANCEL") || raw.includes("ANUL")) return "CANCELADO";
  if (raw.includes("COMPLET") || raw.includes("FINAL")) return "COMPLETADO";
  if (raw.includes("PROCES")) return "EN PROCESO";
  if (raw.includes("PEND")) return "PENDIENTE";
  if (raw.includes("ACTIV")) return "ACTIVO";
  if (raw.includes("INACT")) return "INACTIVO";
  return raw;
};

const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = String(value).trim();
  if (!text) return null;

  const onlyDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (onlyDateMatch) {
    const year = Number(onlyDateMatch[1]);
    const month = Number(onlyDateMatch[2]);
    const day = Number(onlyDateMatch[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  const localDateMatch =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
      text
    );
  if (localDateMatch) {
    const day = Number(localDateMatch[1]);
    const month = Number(localDateMatch[2]);
    const year = Number(localDateMatch[3]);
    const hour = Number(localDateMatch[4] ?? 12);
    const minute = Number(localDateMatch[5] ?? 0);
    const second = Number(localDateMatch[6] ?? 0);

    if (
      [day, month, year, hour, minute, second].every(Number.isFinite) &&
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12
    ) {
      return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseHourValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(23, Math.floor(value)));
  }

  const text = String(value).trim();
  if (!text) return null;

  const timeMatch = text.match(/(\d{1,2})(?::\d{1,2})?/);
  if (!timeMatch) return null;

  const hour = Number(timeMatch[1]);
  if (!Number.isFinite(hour)) return null;
  return Math.max(0, Math.min(23, hour));
};

const inPeriod = (date, monthIndex, year) => {
  if (!date) return false;
  return date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex;
};

const getPreviousPeriod = (monthIndex, year) => {
  if (monthIndex === 0) return { monthIndex: 11, year: year - 1 };
  return { monthIndex: monthIndex - 1, year };
};

const getSaleDate = (sale) =>
  parseDateValue(
    sale?.fecha_venta ??
    sale?.fecha ??
    sale?.createdAt ??
    sale?.updatedAt ??
    sale?.fecha_creacion ??
    sale?.fechaRegistro
  );

const getAttendanceDate = (attendance) =>
  parseDateValue(
    attendance?.fecha_asistencia ??
    attendance?.asistencia_fecha ??
    attendance?.fecha ??
    attendance?.createdAt
  );

const getBeneficiarioDate = (beneficiario) =>
  parseDateValue(
    beneficiario?.fecha_registro ??
    beneficiario?.createdAt ??
    beneficiario?.created_at ??
    beneficiario?.fecha_creacion ??
    beneficiario?.fecha
  );

const getSaleUserId = (sale) =>
  sale?.id_usuario ??
  sale?.id_de_usuario ??
  sale?.idUsuario ??
  sale?.usuario?.id_usuario ??
  sale?.usuario?.id ??
  null;

const getSaleStatus = (sale) =>
  normalizeEstadoVenta(
    sale?.estado_venta ?? sale?.estado ?? sale?.id_estado ?? sale?.estadoVenta
  );

const getSaleUserKey = (sale) => {
  const userId = getSaleUserId(sale);
  if (userId !== null && userId !== undefined && userId !== "") {
    return `id-${userId}`;
  }

  const fallbackName = normalizeText(
    sale?.usuario_nombre ??
    sale?.cliente ??
    sale?.cliente_nombre ??
    sale?.nombre_cliente ??
    sale?.usuario?.nombre ??
    sale?.usuario?.nombre_completo ??
    sale?.usuario?.username
  );

  return fallbackName ? `name-${fallbackName}` : null;
};

const getTextFromCandidate = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    if (typeof candidate === "string" || typeof candidate === "number") {
      const text = String(candidate).trim();
      if (text) return text;
      continue;
    }

    if (typeof candidate === "object") {
      const nested =
        candidate?.nombre ??
        candidate?.nombre_producto ??
        candidate?.nombre_membresia ??
        candidate?.nombre_servicio ??
        candidate?.descripcion ??
        candidate?.label ??
        candidate?.title;
      if (nested !== undefined && nested !== null) {
        const text = String(nested).trim();
        if (text) return text;
      }
    }
  }
  return "";
};

const buildFallbackSaleDetail = (sale = {}) => {
  const tipo = normalizeTipoVenta(
    sale?.tipo_venta ?? sale?.tipoVenta ?? sale?.tipo ?? sale?.categoria
  );
  if (!tipo) return null;

  const cantidad = parseNumericValue(
    sale?.cantidad_total ?? sale?.cantidad ?? sale?.qty ?? 1
  );

  return {
    tipo_venta: tipo,
    cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
    id_producto:
      sale?.id_producto ??
      sale?.idProducto ??
      sale?.id_productos ??
      sale?.id_producto_fk ??
      sale?.recursoId,
    id_membresia:
      sale?.id_membresia ??
      sale?.idMembresia ??
      sale?.id_membresias ??
      sale?.id_membresia_fk ??
      sale?.recursoId,
    id_servicio:
      sale?.id_servicio ??
      sale?.idServicio ??
      sale?.id_servicios ??
      sale?.id_servicio_fk ??
      sale?.recursoId,
    valor_total_venta:
      sale?.valor_total_venta ?? sale?.total ?? sale?.monto ?? sale?.valor_total,
    valor_unitario:
      sale?.valor_unitario ??
      sale?.precio_unitario ??
      sale?.precio ??
      sale?.valor,
    nombre_producto: getTextFromCandidate(
      sale?.nombre_producto,
      sale?.producto,
      sale?.nombre
    ),
    nombre_membresia: getTextFromCandidate(
      sale?.nombre_membresia,
      sale?.membresia,
      sale?.nombre
    ),
    nombre_servicio: getTextFromCandidate(
      sale?.nombre_servicio,
      sale?.servicio,
      sale?.nombre
    ),
  };
};

const getSaleDetails = (sale) => {
  const rawDetails = Array.isArray(sale?.detalles_venta)
    ? sale.detalles_venta
    : Array.isArray(sale?.detalle_venta)
      ? sale.detalle_venta
      : Array.isArray(sale?.detalles)
        ? sale.detalles
        : Array.isArray(sale?.detalle)
          ? sale.detalle
          : [];

  if (rawDetails.length) return rawDetails;

  const fallback = buildFallbackSaleDetail(sale);
  return fallback ? [fallback] : [];
};

const getSaleAmount = (sale) => {
  const direct = parseNumericValue(
    sale?.valor_total_venta ?? sale?.total ?? sale?.monto ?? sale?.valor_total
  );
  if (Number.isFinite(direct) && direct > 0) return direct;

  return getSaleDetails(sale).reduce((acc, detail) => {
    const qty =
      parseNumericValue(detail?.cantidad ?? detail?.cantidad_total ?? detail?.qty ?? 0) ||
      0;
    const directLineTotal = parseNumericValue(
      detail?.valor_total_venta ?? detail?.total ?? detail?.subtotal
    );
    const unit = parseNumericValue(
      detail?.valor_unitario ?? detail?.precio_unitario ?? detail?.precio ?? detail?.valor ?? 0
    );

    if (Number.isFinite(directLineTotal) && directLineTotal > 0) return acc + directLineTotal;
    if (qty > 0 && Number.isFinite(unit) && unit > 0) return acc + qty * unit;
    return acc;
  }, 0);
};

const resolveDetailType = (detail = {}, sale = {}) =>
  normalizeTipoVenta(
    detail?.tipo_venta ??
    detail?.tipo ??
    detail?.tipoVenta ??
    sale?.tipo_venta ??
    sale?.tipoVenta ??
    sale?.tipo ??
    sale?.categoria
  );

const resolveDetailQuantity = (detail = {}, fallback = 0) => {
  const qty = parseNumericValue(
    detail?.cantidad ?? detail?.cantidad_total ?? detail?.qty ?? fallback
  );
  return Number.isFinite(qty) ? qty : 0;
};

const resolveNumericId = (...candidates) => {
  for (const candidate of candidates) {
    const asNumber = Number(candidate);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;
  }
  return null;
};

const getDeltaPercent = (current, previous) => {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const formatPercentDelta = (value) => {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe >= 0 ? "+" : "";
  return `${sign}${safe.toFixed(1)}%`;
};

const formatCountDelta = (value) => {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe >= 0 ? "+" : "";
  return `${sign}${numberFormatter.format(safe)}`;
};

const formatMoneyCompact = (value) => {
  const safe = Number.isFinite(value) ? value : 0;
  return compactCurrencyFormatter.format(safe);
};

const formatMoney = (value) => {
  const safe = Number.isFinite(value) ? value : 0;
  return moneyFormatter.format(safe);
};

const formatSaleDate = (value) => {
  const parsedDate = parseDateValue(value);
  if (!parsedDate) return "Sin fecha";
  return saleDateFormatter.format(parsedDate);
};

const formatHourLabel = (hour24) => {
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}${isPm ? "PM" : "AM"}`;
};

const getSaleDisplayId = (sale, fallbackIndex = null) => {
  const directId = getTextFromCandidate(
    sale?.numero_venta,
    sale?.numero_factura,
    sale?.codigo_venta,
    sale?.codigo,
    sale?.id_venta,
    sale?.id_ventas,
    sale?.idVenta,
    sale?.id
  );
  if (directId) return directId;

  const userId = getSaleUserId(sale);
  if (userId !== null && userId !== undefined && userId !== "") {
    return `Usuario ${userId}`;
  }

  if (Number.isFinite(fallbackIndex) && fallbackIndex >= 0) {
    return `Venta ${fallbackIndex + 1}`;
  }

  return "Venta sin identificador";
};

const getSaleCustomerName = (sale, userNameById) => {
  const directName = getTextFromCandidate(
    sale?.cliente_nombre,
    sale?.nombre_cliente,
    sale?.cliente,
    sale?.usuario_nombre,
    sale?.usuario?.nombre_completo,
    sale?.usuario?.nombre,
    sale?.usuario?.username,
    sale?.usuario?.email
  );
  if (directName) return directName;

  const userId = getSaleUserId(sale);
  if (userNameById && userId !== null && userId !== undefined && userId !== "") {
    const resolvedName = userNameById.get(String(userId));
    if (resolvedName) return resolvedName;
  }

  return "Cliente no registrado";
};

const getSalePreview = (sale) => {
  const names = getSaleDetails(sale)
    .map((detail) =>
      getTextFromCandidate(
        detail?.nombre_producto,
        detail?.nombre_membresia,
        detail?.nombre_servicio,
        detail?.producto,
        detail?.membresia,
        detail?.servicio,
        detail?.nombre
      )
    )
    .filter(Boolean);

  if (!names.length) return "Sin detalle";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} mas`;
};

const getUserId = (user) =>
  user?.id ??
  user?.id_usuario ??
  user?.idUsuario ??
  user?.id_user ??
  user?.id_usuarios ??
  null;

const hasRoleId = (user, expectedRoleId) => {
  const target = Number(expectedRoleId);
  if (!Number.isFinite(target)) return false;

  const directRoleId = Number(user?.id_rol ?? user?.rol_id ?? user?.rolId ?? user?.roleId);
  if (Number.isFinite(directRoleId) && directRoleId === target) return true;

  const nestedRoleId = Number(
    user?.rol?.id_rol ??
    user?.rol?.id ??
    user?.role?.id_rol ??
    user?.role?.id ??
    user?.id_rol_rol?.id_rol ??
    user?.id_rol_rol?.id
  );
  if (Number.isFinite(nestedRoleId) && nestedRoleId === target) return true;

  if (Array.isArray(user?.roles)) {
    const match = user.roles.some((role) => {
      const roleId = Number(role?.id_rol ?? role?.id ?? role?.rol_id ?? role?.roleId ?? role);
      return Number.isFinite(roleId) && roleId === target;
    });
    if (match) return true;
  }

  if (Array.isArray(user?.rolesIds)) {
    const match = user.rolesIds.some((roleId) => Number(roleId) === target);
    if (match) return true;
  }

  return false;
};

const getUserRegistrationDate = (user) =>
  parseDateValue(
    user?.fecha_registro ??
      user?.fechaRegistro ??
      user?.fecha_creacion ??
      user?.createdAt ??
      user?.created_at ??
      user?.fecha_alta ??
      user?.registrationDate
  );

const getUserDisplayName = (user) =>
  getTextFromCandidate(
    user?.nombre_completo,
    user?.nombre,
    user?.username,
    user?.nombre_usuario,
    user?.full_name,
    user?.email
  );

const getUtcDayStart = (date) =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const isWithinLastDays = (date, days, referenceDate = new Date()) => {
  if (!date || !Number.isFinite(days) || days <= 0) return false;
  const diffMs = getUtcDayStart(referenceDate) - getUtcDayStart(date);
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= days;
};

const isWithinPreviousDaysWindow = (date, days, referenceDate = new Date()) => {
  if (!date || !Number.isFinite(days) || days <= 0) return false;
  const diffMs = getUtcDayStart(referenceDate) - getUtcDayStart(date);
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return diffDays > days && diffDays <= days * 2;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const value = Number(payload[0]?.value || 0);
  const unit = payload[0]?.payload?.unit || "registros";

  return (
    <div className="admin-home-tooltip">
      <div className="admin-home-tooltip-label">{label}</div>
      <div className="admin-home-tooltip-value">
        {numberFormatter.format(value)} {unit}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getUTCFullYear());
  const [isPendingSalesModalOpen, setIsPendingSalesModalOpen] = useState(false);
  const [isProductsDetailsModalOpen, setIsProductsDetailsModalOpen] = useState(false);
  const [isClientsDetailsModalOpen, setIsClientsDetailsModalOpen] = useState(false);
  const [isIncomeDetailsModalOpen, setIsIncomeDetailsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rawData, setRawData] = useState({
    ventas: [],
    productos: [],
    membresias: [],
    usuarios: [],
    asistenciasClientes: [],
    beneficiarios: [],
  });

  const handleMonthSelectChange = useCallback((event) => {
    const monthIndex = Number(event.target.value);
    if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex >= MONTHS.length) return;
    setSelectedMonthIndex(monthIndex);
  }, []);

  const handlePreviousMonth = useCallback(() => {
    setSelectedMonthIndex((prev) => (prev === 0 ? MONTHS.length - 1 : prev - 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedMonthIndex((prev) => (prev === MONTHS.length - 1 ? 0 : prev + 1));
  }, []);

  const handleYearSelectChange = useCallback((event) => {
    const year = Number(event.target.value);
    if (!Number.isFinite(year)) return;
    setSelectedYear(year);
  }, []);

  const cargarDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const token = getToken?.() || localStorage.getItem("token");
    const resultados = await Promise.allSettled([
      obtenerVentas({ token }),
      getProductos(),
      getMembresias({ token }),
      loadAllPaginatedItems(obtenerUsuarios, ["usuarios", "data"]),
      loadAllPaginatedItems(obtenerRolesUsuarios, ["roles_usuarios", "data"]),
      obtenerAsistenciasClientes(),
      obtenerBeneficiarios(),
    ]);

    const [ventasRes, productosRes, membresiasRes, usuariosRes, rolesUsuariosRes, asistenciasRes, beneficiariosRes] = resultados;

    const fallos = [];
    if (ventasRes.status === "rejected") fallos.push("ventas");
    if (productosRes.status === "rejected") fallos.push("productos");
    if (membresiasRes.status === "rejected") fallos.push("membresias");
    if (usuariosRes.status === "rejected") fallos.push("usuarios");
    if (rolesUsuariosRes.status === "rejected") fallos.push("roles_usuarios");
    if (asistenciasRes.status === "rejected") fallos.push("asistencias");
    if (beneficiariosRes.status === "rejected") fallos.push("beneficiarios");

    if (fallos.length) {
      setError(`No se pudo cargar completamente: ${fallos.join(", ")}`);
    }

    const usuariosBase = usuariosRes.status === "fulfilled" ? asArray(usuariosRes.value) : [];
    const rolesUsuariosData =
      rolesUsuariosRes.status === "fulfilled" ? asArray(rolesUsuariosRes.value) : [];

    const usuariosMap = new Map();

    usuariosBase.forEach((user, index) => {
      const userId = getUserId(user);
      const key =
        userId !== null && userId !== undefined && userId !== ""
          ? String(userId)
          : `base-${index}`;

      usuariosMap.set(key, {
        ...user,
        id_usuario: userId ?? user?.id_usuario ?? user?.id ?? null,
      });
    });

    rolesUsuariosData.forEach((assignment) => {
      if (!assignment || typeof assignment !== "object") return;

      const userId =
        assignment?.id_usuario ??
        assignment?.usuario_id ??
        assignment?.id_usuario_usuario?.id_usuario ??
        assignment?.id_usuario_usuario?.id ??
        assignment?.usuario?.id_usuario ??
        assignment?.usuario?.id;

      if (userId === null || userId === undefined || userId === "") return;

      const roleId =
        assignment?.id_rol ??
        assignment?.rol_id ??
        assignment?.roleId ??
        assignment?.id_rol_rol?.id_rol ??
        assignment?.id_rol_rol?.id ??
        assignment?.rol?.id_rol ??
        assignment?.rol?.id ??
        null;

      const roleData =
        assignment?.id_rol_rol ||
        assignment?.rol ||
        assignment?.role ||
        null;

      const userData =
        assignment?.id_usuario_usuario ||
        assignment?.usuario ||
        {};

      const key = String(userId);
      const existing = usuariosMap.get(key) || {};
      const userDataWithoutEmptyValues = Object.fromEntries(
        Object.entries(userData).filter(
          ([, value]) => value !== undefined && value !== null && value !== ""
        )
      );

      usuariosMap.set(key, {
        ...existing,
        ...userDataWithoutEmptyValues,
        id_usuario: userId,
        rol_id: roleId ?? existing?.rol_id ?? existing?.id_rol ?? existing?.roleId ?? null,
        rol_nombre:
          roleData?.nombre_rol ??
          roleData?.nombre ??
          roleData?.name ??
          existing?.rol_nombre ??
          null,
        id_rol_rol: roleData ?? existing?.id_rol_rol ?? null,
      });
    });

    const usuariosEnriquecidos = Array.from(usuariosMap.values());

    setRawData({
      ventas: ventasRes.status === "fulfilled" ? asArray(ventasRes.value) : [],
      productos: productosRes.status === "fulfilled" ? asArray(productosRes.value) : [],
      membresias: membresiasRes.status === "fulfilled" ? asArray(membresiasRes.value) : [],
      usuarios: usuariosEnriquecidos,
      asistenciasClientes:
        asistenciasRes.status === "fulfilled" ? asArray(asistenciasRes.value) : [],
      beneficiarios:
        beneficiariosRes.status === "fulfilled" ? asArray(beneficiariosRes.value) : [],
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void cargarDashboard();
  }, [cargarDashboard]);

  useEffect(() => {
    const handleRefresh = () => {
      void cargarDashboard();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void cargarDashboard();
      }
    };

    const intervalId = window.setInterval(() => {
      void cargarDashboard();
    }, 120000);

    window.addEventListener(DASHBOARD_REFRESH_EVENT, handleRefresh);
    window.addEventListener(DASHBOARD_CLIENTS_REFRESH_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, handleRefresh);
      window.removeEventListener(DASHBOARD_CLIENTS_REFRESH_EVENT, handleRefresh);
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cargarDashboard]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getUTCFullYear();
    const years = [];

    rawData.ventas.forEach((sale) => {
      const date = getSaleDate(sale);
      if (date) years.push(date.getUTCFullYear());
    });

    rawData.asistenciasClientes.forEach((attendance) => {
      const date = getAttendanceDate(attendance);
      if (date) years.push(date.getUTCFullYear());
    });

    const validYears = years.filter(
      (year) => Number.isFinite(year) && year >= 2000 && year <= currentYear
    );

    const oldestDataYear = validYears.length ? Math.min(...validYears) : currentYear - 5;
    const minYear = Math.max(2000, oldestDataYear);
    const range = [];

    for (let year = currentYear; year >= minYear; year -= 1) {
      range.push(year);
    }

    return range;
  }, [rawData.ventas, rawData.asistenciasClientes]);

  useEffect(() => {
    if (!availableYears.length) return;
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const selectedPeriod = useMemo(
    () => ({ monthIndex: selectedMonthIndex, year: selectedYear }),
    [selectedMonthIndex, selectedYear]
  );

  const previousPeriod = useMemo(
    () => getPreviousPeriod(selectedPeriod.monthIndex, selectedPeriod.year),
    [selectedPeriod]
  );

  const salesCurrentPeriod = useMemo(
    () =>
      rawData.ventas.filter((sale) =>
        inPeriod(getSaleDate(sale), selectedPeriod.monthIndex, selectedPeriod.year)
      ),
    [rawData.ventas, selectedPeriod]
  );

  const salesPreviousPeriod = useMemo(
    () =>
      rawData.ventas.filter((sale) =>
        inPeriod(getSaleDate(sale), previousPeriod.monthIndex, previousPeriod.year)
      ),
    [rawData.ventas, previousPeriod]
  );

  const validSalesCurrent = useMemo(
    () => salesCurrentPeriod.filter((sale) => getSaleStatus(sale) === "COMPLETADO"),
    [salesCurrentPeriod]
  );

  const pendingSalesCurrent = useMemo(
    () =>
      salesCurrentPeriod
        .filter((sale) => {
          const saleStatus = getSaleStatus(sale);
          return saleStatus === "PENDIENTE" || saleStatus === "EN PROCESO";
        })
        .sort((a, b) => {
          const dateA = getSaleDate(a)?.getTime() ?? 0;
          const dateB = getSaleDate(b)?.getTime() ?? 0;
          return dateB - dateA;
        }),
    [salesCurrentPeriod]
  );

  const validSalesPrevious = useMemo(
    () => salesPreviousPeriod.filter((sale) => getSaleStatus(sale) === "COMPLETADO"),
    [salesPreviousPeriod]
  );

  const completedSalesCurrent = useMemo(
    () => validSalesCurrent.filter((sale) => getSaleStatus(sale) === "COMPLETADO"),
    [validSalesCurrent]
  );

  const completedSalesPrevious = useMemo(
    () => validSalesPrevious.filter((sale) => getSaleStatus(sale) === "COMPLETADO"),
    [validSalesPrevious]
  );

  const totalVentasCurrent = useMemo(
    () => validSalesCurrent.reduce((acc, sale) => acc + getSaleAmount(sale), 0),
    [validSalesCurrent]
  );

  const totalVentasPrevious = useMemo(
    () => validSalesPrevious.reduce((acc, sale) => acc + getSaleAmount(sale), 0),
    [validSalesPrevious]
  );

  const totalIngresosCurrent = useMemo(
    () => completedSalesCurrent.reduce((acc, sale) => acc + getSaleAmount(sale), 0),
    [completedSalesCurrent]
  );

  const totalIngresosPrevious = useMemo(
    () => completedSalesPrevious.reduce((acc, sale) => acc + getSaleAmount(sale), 0),
    [completedSalesPrevious]
  );

  const ticketCurrent = useMemo(
    () => (validSalesCurrent.length ? totalVentasCurrent / validSalesCurrent.length : 0),
    [validSalesCurrent.length, totalVentasCurrent]
  );

  const ticketPrevious = useMemo(
    () => (validSalesPrevious.length ? totalVentasPrevious / validSalesPrevious.length : 0),
    [validSalesPrevious.length, totalVentasPrevious]
  );

  // Mapa userId => fecha de registro usando self-beneficiarios como fuente primaria
  const clientRegistrationDateMap = useMemo(() => {
    const map = new Map();

    // Fuente primaria: self-beneficiarios (id_usuario === id_relacion)
    rawData.beneficiarios.forEach((b) => {
      const userId = Number(b?.id_usuario ?? b?.id_relacion);
      const relacionId = Number(b?.id_relacion ?? b?.id_usuario);
      if (!Number.isFinite(userId) || userId !== relacionId) return;

      const fecha = getBeneficiarioDate(b);
      if (!fecha) return;

      // Conserva la fecha más antigua si hay duplicados
      if (!map.has(userId) || fecha < map.get(userId)) {
        map.set(userId, fecha);
      }
    });

    // Fuente de respaldo: campo fecha_registro del propio usuario
    rawData.usuarios
      .filter((user) => hasRoleId(user, CLIENT_ROLE_ID))
      .forEach((user) => {
        const userId = Number(getUserId(user));
        if (!Number.isFinite(userId) || map.has(userId)) return;
        const fecha = getUserRegistrationDate(user);
        if (fecha) map.set(userId, fecha);
      });

    return map;
  }, [rawData.beneficiarios, rawData.usuarios]);

  const newClientsSummary = useMemo(() => {
    let currentCount = 0;
    let previousCount = 0;
    const prevPeriod = getPreviousPeriod(selectedPeriod.monthIndex, selectedPeriod.year);
    const processedUserIds = new Set();

    // 1. Procesar todos los IDs en el mapa de beneficiarios (son clientes garantizados)
    for (const [userId, registrationDate] of clientRegistrationDateMap.entries()) {
      if (!registrationDate) continue;
      processedUserIds.add(userId);

      if (inPeriod(registrationDate, selectedPeriod.monthIndex, selectedPeriod.year)) {
        currentCount += 1;
      }
      if (inPeriod(registrationDate, prevPeriod.monthIndex, prevPeriod.year)) {
        previousCount += 1;
      }
    }

    // 2. Procesar usuarios que tienen el rol de cliente, pero no estaban en el mapa
    rawData.usuarios
      .filter((user) => hasRoleId(user, CLIENT_ROLE_ID))
      .forEach((user) => {
        const userId = Number(getUserId(user));
        if (Number.isFinite(userId) && processedUserIds.has(userId)) return;

        const registrationDate = getUserRegistrationDate(user);
        if (!registrationDate) return;

        if (inPeriod(registrationDate, selectedPeriod.monthIndex, selectedPeriod.year)) {
          currentCount += 1;
        }
        if (inPeriod(registrationDate, prevPeriod.monthIndex, prevPeriod.year)) {
          previousCount += 1;
        }
      });

    return { currentCount, previousCount };
  }, [rawData.usuarios, clientRegistrationDateMap, selectedPeriod]);

  const newClientsCurrentList = useMemo(() => {
    const validClients = new Map();

    // 1. Agregar usuarios que tienen rol cliente explícito
    rawData.usuarios.forEach((user) => {
      if (hasRoleId(user, CLIENT_ROLE_ID)) {
        const userId = Number(getUserId(user));
        if (Number.isFinite(userId)) validClients.set(userId, user);
      }
    });

    // 2. Agregar usuarios implicados por el mapa de beneficiarios
    for (const userId of clientRegistrationDateMap.keys()) {
      if (!validClients.has(userId)) {
        const userFound = rawData.usuarios.find((u) => Number(getUserId(u)) === userId);
        validClients.set(userId, userFound || { id_usuario: userId, id: userId });
      }
    }

    return Array.from(validClients.values())
      .map((user, index) => {
        const userId = getUserId(user);
        const numericUserId = Number(userId);
        const registrationDate = Number.isFinite(numericUserId)
          ? (clientRegistrationDateMap.get(numericUserId) ?? getUserRegistrationDate(user))
          : getUserRegistrationDate(user);
          
        if (!registrationDate) return null;
        if (!inPeriod(registrationDate, selectedPeriod.monthIndex, selectedPeriod.year)) {
          return null;
        }

        return {
          key:
            userId !== null && userId !== undefined && userId !== ""
              ? `id-${userId}`
              : `index-${index}`,
          name: getUserDisplayName(user) || `Usuario ${userId ?? index + 1}`,
          email: getTextFromCandidate(user?.email, user?.correo, user?.mail),
          firstDate: registrationDate,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.firstDate.getTime() - a.firstDate.getTime());
  }, [rawData.usuarios, clientRegistrationDateMap, selectedPeriod]);

  const productNameById = useMemo(() => {
    const map = new Map();
    rawData.productos.forEach((product) => {
      const id = Number(product?.id ?? product?.id_productos);
      if (!Number.isFinite(id)) return;
      const name =
        product?.nombre ??
        product?.nombre_producto ??
        `Producto ${id}`;
      map.set(id, name);
    });
    return map;
  }, [rawData.productos]);

  const membershipNameById = useMemo(() => {
    const map = new Map();
    rawData.membresias.forEach((membership) => {
      const id = Number(
        membership?.id ?? membership?.id_membresias ?? membership?.id_membresia
      );
      if (!Number.isFinite(id)) return;

      const name =
        membership?.nombre ?? membership?.nombre_membresia ?? `Membresia ${id}`;
      map.set(id, name);
    });
    return map;
  }, [rawData.membresias]);

  const userNameById = useMemo(() => {
    const map = new Map();
    rawData.usuarios.forEach((user) => {
      const userId =
        user?.id ??
        user?.id_usuario ??
        user?.idUsuario ??
        user?.id_user ??
        user?.id_usuarios;
      if (userId === null || userId === undefined || userId === "") return;

      const displayName =
        getTextFromCandidate(
          user?.nombre_completo,
          user?.nombre,
          user?.username,
          user?.nombre_usuario,
          user?.full_name,
          user?.email
        ) || `Usuario ${userId}`;

      map.set(String(userId), displayName);
    });
    return map;
  }, [rawData.usuarios]);

  const productsSalesSummary = useMemo(() => {
    const aggregated = new Map();

    validSalesCurrent.forEach((sale) => {
      getSaleDetails(sale).forEach((detail) => {
        const tipo = resolveDetailType(detail, sale);
        if (tipo !== "PRODUCTO") return;

        const qty = resolveDetailQuantity(detail, 0);
        if (qty <= 0) return;

        const numericId = resolveNumericId(
          detail?.id_producto,
          detail?.id_producto_fk,
          detail?.idProducto,
          detail?.id_productos,
          detail?.idProductoFk,
          detail?.recursoId,
          sale?.id_producto,
          sale?.idProducto,
          sale?.id_productos
        );
        const hasValidId = Number.isFinite(numericId);

        const fallbackName = getTextFromCandidate(
          detail?.nombre_producto,
          detail?.producto,
          detail?.nombre,
          sale?.nombre_producto,
          sale?.producto,
          sale?.nombre,
          hasValidId ? `Producto ${numericId}` : "Producto"
        );

        const name = hasValidId
          ? productNameById.get(numericId) || fallbackName
          : fallbackName;
        const key = hasValidId ? `id-${numericId}` : `name-${normalizeText(name)}`;

        const directLineTotal = parseNumericValue(
          detail?.valor_total_venta ?? detail?.total ?? detail?.subtotal
        );
        const unitAmount = parseNumericValue(
          detail?.valor_unitario ?? detail?.precio_unitario ?? detail?.precio ?? detail?.valor
        );
        const lineTotal =
          Number.isFinite(directLineTotal) && directLineTotal > 0
            ? directLineTotal
            : Number.isFinite(unitAmount) && unitAmount > 0
              ? qty * unitAmount
              : 0;

        const prev = aggregated.get(key) || { key, name, value: 0, total: 0, unit: "unidades" };
        prev.value += qty;
        prev.total += lineTotal;
        aggregated.set(key, prev);
      });
    });

    return Array.from(aggregated.values()).sort((a, b) => b.value - a.value);
  }, [productNameById, validSalesCurrent]);

  const productsChartData = useMemo(() => {
    if (productsSalesSummary.length) {
      return productsSalesSummary.slice(0, 5);
    }

    return rawData.productos.slice(0, 5).map((product, index) => ({
      key: `fallback-${index}`,
      name:
        product?.nombre ??
        product?.nombre_producto ??
        `Producto ${index + 1}`,
      value: 0,
      total: 0,
      unit: "unidades",
    }));
  }, [productsSalesSummary, rawData.productos]);

  const totalProductsUnitsCurrent = useMemo(
    () => productsSalesSummary.reduce((acc, item) => acc + item.value, 0),
    [productsSalesSummary]
  );

  const membershipsChartData = useMemo(() => {
    const aggregated = new Map();

    validSalesCurrent.forEach((sale) => {
      getSaleDetails(sale).forEach((detail) => {
        const tipo = resolveDetailType(detail, sale);
        if (tipo !== "MEMBRESIA") return;

        const qty = resolveDetailQuantity(detail, 1);
        if (qty <= 0) return;

        const numericId = resolveNumericId(
          detail?.id_membresia,
          detail?.id_membresia_fk,
          detail?.id_membresias,
          detail?.idMembresia,
          detail?.recursoId,
          sale?.id_membresia,
          sale?.idMembresia,
          sale?.id_membresias
        );
        const hasValidId = Number.isFinite(numericId);

        const fallbackName = getTextFromCandidate(
          detail?.nombre_membresia,
          detail?.membresia,
          detail?.nombre,
          detail?.producto,
          sale?.nombre_membresia,
          sale?.membresia,
          sale?.nombre,
          hasValidId ? `Membresia ${numericId}` : "Membresia"
        );

        const name = hasValidId
          ? membershipNameById.get(numericId) || fallbackName
          : fallbackName;
        const key = hasValidId ? `id-${numericId}` : `name-${normalizeText(name)}`;

        const prev = aggregated.get(key) || { name, count: 0 };
        prev.count += qty;
        aggregated.set(key, prev);
      });
    });

    const ordered = Array.from(aggregated.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const totalCount = ordered.reduce((acc, item) => acc + item.count, 0);

    if (ordered.length) {
      return ordered.map((item, index) => ({
        name: item.name,
        count: item.count,
        value: totalCount ? (item.count / totalCount) * 100 : 0,
        toneClass: getMembershipToneClass(index),
      }));
    }

    const fallbackNames = Array.from(membershipNameById.values()).slice(0, 3);
    const defaults = fallbackNames.length ? fallbackNames : ["Basica", "General", "Premium"];

    return defaults.map((name, index) => ({
      name,
      count: 0,
      value: 0,
      toneClass: getMembershipToneClass(index),
    }));
  }, [membershipNameById, validSalesCurrent]);

  const attendanceByMonth = useMemo(() => {
    const monthCount = new Array(12).fill(0);

    rawData.asistenciasClientes.forEach((attendance) => {
      const date = getAttendanceDate(attendance);
      if (!date || date.getUTCFullYear() !== selectedYear) return;
      const monthIdx = date.getUTCMonth();
      monthCount[monthIdx] += 1;
    });

    return MONTHS.map((mes, index) => ({
      mes,
      clientes: monthCount[index],
      unit: "asistencias",
    }));
  }, [rawData.asistenciasClientes, selectedYear]);

  const completedSalesListForIncome = useMemo(
    () =>
      completedSalesCurrent
        .map((sale, index) => {
          const saleDisplayId = getSaleDisplayId(sale, index);
          const saleDate = getSaleDate(sale);
          const saleAmount = getSaleAmount(sale);
          const saleDetails = getSaleDetails(sale);
          const totalItems = saleDetails.length
            ? saleDetails.reduce(
              (acc, detail) => acc + Math.max(0, resolveDetailQuantity(detail, 1)),
              0
            )
            : 0;

          const detailTypes = Array.from(
            new Set(
              saleDetails
                .map((detail) => resolveDetailType(detail, sale))
                .filter(Boolean)
            )
          );

          return {
            key: `${saleDisplayId}-${saleDate?.getTime() ?? index}-${index}`,
            saleId: saleDisplayId,
            customerName: getSaleCustomerName(sale, userNameById),
            preview: getSalePreview(sale),
            saleDate,
            saleAmount,
            totalItems,
            detailTypes: detailTypes.length ? detailTypes.join(", ") : "GENERAL",
          };
        })
        .sort((a, b) => (b.saleDate?.getTime() ?? 0) - (a.saleDate?.getTime() ?? 0)),
    [completedSalesCurrent, userNameById]
  );

  const incomeByTypeSummary = useMemo(() => {
    const grouped = new Map();

    completedSalesCurrent.forEach((sale) => {
      const saleDetails = getSaleDetails(sale);
      let type = "GENERAL";

      if (saleDetails.length) {
        type = resolveDetailType(saleDetails[0], sale) || "GENERAL";
      } else {
        type =
          normalizeTipoVenta(
            sale?.tipo_venta ?? sale?.tipoVenta ?? sale?.tipo ?? sale?.categoria
          ) || "GENERAL";
      }

      const normalizedType = normalizeText(type) || "GENERAL";
      const detailItems = saleDetails.length
        ? saleDetails.reduce(
          (acc, detail) => acc + Math.max(0, resolveDetailQuantity(detail, 1)),
          0
        )
        : 0;

      const previous = grouped.get(normalizedType) || {
        type: normalizedType,
        salesCount: 0,
        totalAmount: 0,
        totalItems: 0,
      };

      previous.salesCount += 1;
      previous.totalAmount += getSaleAmount(sale);
      previous.totalItems += detailItems;
      grouped.set(normalizedType, previous);
    });

    return Array.from(grouped.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [completedSalesCurrent]);

  const topIncomeClient = useMemo(() => {
    const byClient = new Map();

    completedSalesCurrent.forEach((sale) => {
      const customerName = getSaleCustomerName(sale, userNameById);
      const previous = byClient.get(customerName) || { name: customerName, totalAmount: 0 };
      previous.totalAmount += getSaleAmount(sale);
      byClient.set(customerName, previous);
    });

    return Array.from(byClient.values()).sort((a, b) => b.totalAmount - a.totalAmount)[0] || null;
  }, [completedSalesCurrent, userNameById]);

  const kpis = useMemo(() => {
    const ventasGrowth = getDeltaPercent(totalVentasCurrent, totalVentasPrevious);

    return [
      {
        id: "ventas",
        label: "Ventas",
        value: formatMoneyCompact(totalVentasCurrent),
        sub: `${formatPercentDelta(ventasGrowth)} vs mes anterior`,
        toneClass: KPI_TONE_CLASSES.ventas,
      },
      {
        id: "clientes-nuevos",
        label: "Clientes Nuevos",
        value: numberFormatter.format(newClientsSummary.currentCount),
        sub: `${formatCountDelta(
          newClientsSummary.currentCount - newClientsSummary.previousCount
        )} vs mes anterior`,
        toneClass: KPI_TONE_CLASSES["clientes-nuevos"],
      },
    ];
  }, [
    totalVentasCurrent,
    totalVentasPrevious,
    newClientsSummary.currentCount,
    newClientsSummary.previousCount,
  ]);

  const statusText = loading
    ? "Cargando datos de metricas..."
    : `Datos de ${MONTHS[selectedPeriod.monthIndex]} ${selectedPeriod.year}`;

  const openPendingSalesModal = useCallback(() => {
    setIsProductsDetailsModalOpen(false);
    setIsClientsDetailsModalOpen(false);
    setIsIncomeDetailsModalOpen(false);
    setIsPendingSalesModalOpen(true);
  }, []);

  const closePendingSalesModal = useCallback(() => {
    setIsPendingSalesModalOpen(false);
  }, []);

  const openProductsDetailsModal = useCallback(() => {
    setIsPendingSalesModalOpen(false);
    setIsClientsDetailsModalOpen(false);
    setIsIncomeDetailsModalOpen(false);
    setIsProductsDetailsModalOpen(true);
  }, []);

  const closeProductsDetailsModal = useCallback(() => {
    setIsProductsDetailsModalOpen(false);
  }, []);

  const openClientsDetailsModal = useCallback(() => {
    setIsPendingSalesModalOpen(false);
    setIsProductsDetailsModalOpen(false);
    setIsIncomeDetailsModalOpen(false);
    setIsClientsDetailsModalOpen(true);
  }, []);

  const closeClientsDetailsModal = useCallback(() => {
    setIsClientsDetailsModalOpen(false);
  }, []);

  const openIncomeDetailsModal = useCallback(() => {
    setIsPendingSalesModalOpen(false);
    setIsProductsDetailsModalOpen(false);
    setIsClientsDetailsModalOpen(false);
    setIsIncomeDetailsModalOpen(true);
  }, []);

  const closeIncomeDetailsModal = useCallback(() => {
    setIsIncomeDetailsModalOpen(false);
  }, []);

  useEffect(() => {
    if (
      !isPendingSalesModalOpen &&
      !isProductsDetailsModalOpen &&
      !isClientsDetailsModalOpen &&
      !isIncomeDetailsModalOpen
    ) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (isIncomeDetailsModalOpen) {
        closeIncomeDetailsModal();
        return;
      }
      if (isClientsDetailsModalOpen) {
        closeClientsDetailsModal();
        return;
      }
      if (isProductsDetailsModalOpen) {
        closeProductsDetailsModal();
        return;
      }
      if (isPendingSalesModalOpen) closePendingSalesModal();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [
    closePendingSalesModal,
    closeClientsDetailsModal,
    closeIncomeDetailsModal,
    closeProductsDetailsModal,
    isClientsDetailsModalOpen,
    isIncomeDetailsModalOpen,
    isPendingSalesModalOpen,
    isProductsDetailsModalOpen,
  ]);

  return (
    <div className="admin-home-dashboard">
      <header className="admin-home-header">
        <div className="admin-home-brand">
          <span className="admin-home-brand-dot" />
          <div className="admin-home-brand-text">
            <h1>Dashboard Admin</h1>
            <p>Resumen real de metricas y rendimiento</p>
          </div>
        </div>

        <div className="admin-home-period">
          <span className="admin-home-period-label">Periodo</span>
          <div className="admin-home-period-controls">
            <button
              type="button"
              className="admin-home-period-nav"
              onClick={handlePreviousMonth}
              aria-label="Mes anterior"
            >
              &lt;
            </button>

            <div className="admin-home-period-select-wrap">
              <select
                className="admin-home-period-select"
                value={selectedMonthIndex}
                onChange={handleMonthSelectChange}
                aria-label="Seleccionar mes"
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="admin-home-period-nav"
              onClick={handleNextMonth}
              aria-label="Mes siguiente"
            >
              &gt;
            </button>

            <div className="admin-home-period-year-wrap">
              <select
                className="admin-home-period-year-select"
                value={selectedYear}
                onChange={handleYearSelectChange}
                aria-label="Seleccionar año"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <p className={`admin-home-status${error ? " admin-home-status--error" : ""}`}>
        {error || statusText}
      </p>

      <section className="admin-home-kpis">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="admin-home-kpi-card">
            <span className={`admin-home-kpi-line ${kpi.toneClass}`} />
            <p className="admin-home-kpi-label">{kpi.label}</p>
            <h2 className={`admin-home-kpi-value ${kpi.toneClass}`}>
              {kpi.value}
            </h2>
            <p className="admin-home-kpi-sub">{kpi.sub}</p>
            {kpi.id === "ventas" ? (
              <button
                className="admin-home-kpi-action"
                onClick={openPendingSalesModal}
                type="button"
              >
                Ver ventas pendientes ({pendingSalesCurrent.length})
              </button>
            ) : null}
            {kpi.id === "clientes-nuevos" ? (
              <button
                className="admin-home-kpi-action admin-home-kpi-action--clients"
                onClick={openClientsDetailsModal}
                type="button"
              >
                Ver clientes nuevos ({newClientsCurrentList.length})
              </button>
            ) : null}
          </article>
        ))}
      </section>

      <section className="admin-home-grid">
        <article className="admin-home-card admin-home-card--large">
          <div className="admin-home-card-head">
            <h3>Productos mas vendidos (Top 5)</h3>
            <button
              className="admin-home-card-action"
              onClick={openProductsDetailsModal}
              type="button"
            >
              Ver todos ({productsSalesSummary.length})
            </button>
          </div>
          <div className="admin-home-chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productsChartData} barCategoryGap="24%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#555", fontSize: 11, fontFamily: "Montserrat, Segoe UI, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#777", fontSize: 10, fontFamily: "Montserrat, Segoe UI, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(229, 9, 20, 0.08)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {productsChartData.map((item, index) => (
                    <Cell key={`${item.name}-${index}`} fill={PRODUCTS_COLORS[index % PRODUCTS_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="admin-home-card">
          <h3>Membresias del mes</h3>
          <div className="admin-home-memberships">
            {membershipsChartData.map((membership) => (
              <div key={membership.name} className="admin-home-membership-row">
                <span className="admin-home-membership-name">{membership.name}</span>
                <progress
                  className={`admin-home-membership-progress ${membership.toneClass}`}
                  max="100"
                  value={Math.max(0, Math.min(100, membership.value))}
                />
                <span className={`admin-home-membership-value ${membership.toneClass}`}>
                  {membership.value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          <div className="admin-home-legend">
            {membershipsChartData.map((membership) => (
              <div key={`${membership.name}-legend`} className="admin-home-legend-item">
                <span className={`admin-home-legend-dot ${membership.toneClass}`} />
                {membership.name}
              </div>
            ))}
          </div>
        </article>

        <article className="admin-home-card admin-home-card--full">
          <h3>Afluencia de clientes por mes ({selectedYear})</h3>
          <div className="admin-home-chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fill: "#555", fontSize: 11, fontFamily: "Montserrat, Segoe UI, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#777", fontSize: 10, fontFamily: "Montserrat, Segoe UI, sans-serif" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="clientes"
                  stroke="#e50914"
                  strokeWidth={2.2}
                  fill="transparent"
                  dot={{ fill: "#e50914", r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#fff", stroke: "#e50914", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {isPendingSalesModalOpen ? (
        <div className="admin-home-modal-backdrop" onClick={closePendingSalesModal} role="presentation">
          <div
            aria-labelledby="admin-home-modal-title"
            aria-modal="true"
            className="admin-home-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="admin-home-modal-header">
              <div>
                <h3 id="admin-home-modal-title">Ventas pendientes</h3>
                <p>
                  {MONTHS[selectedPeriod.monthIndex]} {selectedPeriod.year}
                </p>
              </div>
              <button
                aria-label="Cerrar modal de ventas pendientes"
                className="admin-home-modal-close"
                onClick={closePendingSalesModal}
                type="button"
              >
                Cerrar
              </button>
            </header>

            <div className="admin-home-modal-body">
              {pendingSalesCurrent.length ? (
                <div className="admin-home-pending-list">
                  {pendingSalesCurrent.map((sale, index) => {
                    const saleStatus = getSaleStatus(sale);
                    const saleDisplayId = getSaleDisplayId(sale, index);
                    return (
                      <article
                        className="admin-home-pending-item"
                        key={`${saleDisplayId}-${index}`}
                      >
                        <div className="admin-home-pending-main">
                          <p className="admin-home-pending-id">{saleDisplayId}</p>
                          <p className="admin-home-pending-client">{getSaleCustomerName(sale, userNameById)}</p>
                          <p className="admin-home-pending-preview">{getSalePreview(sale)}</p>
                        </div>

                        <div className="admin-home-pending-meta">
                          <span
                            className={`admin-home-pending-status admin-home-pending-status--${saleStatus
                              .toLowerCase()
                              .replace(/\s+/g, "-")}`}
                          >
                            {saleStatus}
                          </span>
                          <p className="admin-home-pending-date">
                            {formatSaleDate(getSaleDate(sale))}
                          </p>
                          <p className="admin-home-pending-total">
                            {formatMoney(getSaleAmount(sale))}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-home-modal-empty">
                  <p>No hay ventas pendientes para este mes.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isProductsDetailsModalOpen ? (
        <div className="admin-home-modal-backdrop" onClick={closeProductsDetailsModal} role="presentation">
          <div
            aria-labelledby="admin-home-modal-products-title"
            aria-modal="true"
            className="admin-home-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="admin-home-modal-header">
              <div>
                <h3 id="admin-home-modal-products-title">Detalle de productos vendidos</h3>
                <p>
                  {MONTHS[selectedPeriod.monthIndex]} {selectedPeriod.year} -{" "}
                  {numberFormatter.format(productsSalesSummary.length)} productos
                </p>
              </div>
              <button
                aria-label="Cerrar modal de productos vendidos"
                className="admin-home-modal-close"
                onClick={closeProductsDetailsModal}
                type="button"
              >
                Cerrar
              </button>
            </header>

            <div className="admin-home-modal-body">
              {productsSalesSummary.length ? (
                <div className="admin-home-products-list">
                  {productsSalesSummary.map((product, index) => {
                    const participation = totalProductsUnitsCurrent
                      ? (product.value / totalProductsUnitsCurrent) * 100
                      : 0;

                    return (
                      <article className="admin-home-product-item" key={product.key || `${product.name}-${index}`}>
                        <div className="admin-home-product-main">
                          <p className="admin-home-product-rank">#{index + 1}</p>
                          <p className="admin-home-product-name">{product.name}</p>
                          <p className="admin-home-product-meta">
                            {numberFormatter.format(product.value)} unidades vendidas
                          </p>
                        </div>

                        <div className="admin-home-product-stats">
                          <p className="admin-home-product-share">
                            {participation.toFixed(1)}% del total
                          </p>
                          <p className="admin-home-product-total">{formatMoney(product.total)}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="admin-home-modal-empty">
                  <p>No hay productos vendidos para este mes.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isClientsDetailsModalOpen ? (
        <div className="admin-home-modal-backdrop" onClick={closeClientsDetailsModal} role="presentation">
          <div
            aria-labelledby="admin-home-modal-clients-title"
            aria-modal="true"
            className="admin-home-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="admin-home-modal-header">
              <div>
                <h3 id="admin-home-modal-clients-title">Clientes nuevos</h3>
                <p>
                  Ultimos {NEW_CLIENT_WINDOW_DAYS} dias -{" "}
                  {numberFormatter.format(newClientsCurrentList.length)} clientes
                </p>
              </div>
              <button
                aria-label="Cerrar modal de clientes nuevos"
                className="admin-home-modal-close"
                onClick={closeClientsDetailsModal}
                type="button"
              >
                Cerrar
              </button>
            </header>

            <div className="admin-home-modal-body">
              {newClientsCurrentList.length ? (
                <div className="admin-home-clients-list">
                  {newClientsCurrentList.map((client, index) => (
                    <article className="admin-home-client-item" key={client.key}>
                      <div className="admin-home-client-main">
                        <p className="admin-home-client-rank">#{index + 1}</p>
                        <p className="admin-home-client-name">{client.name}</p>
                        <p className="admin-home-client-meta">
                          Registro: {formatSaleDate(client.firstDate)}
                        </p>
                      </div>

                      <div className="admin-home-client-stats">
                        <span className="admin-home-client-badge">NUEVO</span>
                        <p className="admin-home-client-sales">
                          {client.email || "Sin correo"}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="admin-home-modal-empty">
                  <p>No hay clientes nuevos en los ultimos {NEW_CLIENT_WINDOW_DAYS} dias.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isIncomeDetailsModalOpen ? (
        <div className="admin-home-modal-backdrop" onClick={closeIncomeDetailsModal} role="presentation">
          <div
            aria-labelledby="admin-home-modal-income-title"
            aria-modal="true"
            className="admin-home-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="admin-home-modal-header">
              <div>
                <h3 id="admin-home-modal-income-title">Detalle de ingresos</h3>
                <p>
                  {MONTHS[selectedPeriod.monthIndex]} {selectedPeriod.year} -{" "}
                  {numberFormatter.format(completedSalesCurrent.length)} ventas completadas
                </p>
              </div>
              <button
                aria-label="Cerrar modal de ingresos"
                className="admin-home-modal-close"
                onClick={closeIncomeDetailsModal}
                type="button"
              >
                Cerrar
              </button>
            </header>

            <div className="admin-home-modal-body">
              {completedSalesListForIncome.length ? (
                <>
                  <section className="admin-home-income-summary">
                    <article className="admin-home-income-summary-card">
                      <p>Ingreso total completado</p>
                      <h4>{formatMoney(totalIngresosCurrent)}</h4>
                    </article>

                    <article className="admin-home-income-summary-card">
                      <p>Ticket promedio completado</p>
                      <h4>
                        {formatMoney(
                          completedSalesCurrent.length
                            ? totalIngresosCurrent / completedSalesCurrent.length
                            : 0
                        )}
                      </h4>
                    </article>

                    <article className="admin-home-income-summary-card">
                      <p>Cliente con mayor ingreso</p>
                      <h4>{topIncomeClient?.name || "Sin datos"}</h4>
                      <span>{formatMoney(topIncomeClient?.totalAmount || 0)}</span>
                    </article>
                  </section>

                  <section className="admin-home-income-types">
                    {incomeByTypeSummary.map((typeSummary) => (
                      <article className="admin-home-income-type-item" key={typeSummary.type}>
                        <p className="admin-home-income-type-name">{typeSummary.type}</p>
                        <p className="admin-home-income-type-meta">
                          {numberFormatter.format(typeSummary.salesCount)} ventas
                        </p>
                        <p className="admin-home-income-type-total">
                          {formatMoney(typeSummary.totalAmount)}
                        </p>
                      </article>
                    ))}
                  </section>

                  <div className="admin-home-income-list">
                    {completedSalesListForIncome.map((sale) => (
                      <article className="admin-home-income-item" key={sale.key}>
                        <div className="admin-home-income-main">
                          <p className="admin-home-income-id">{sale.saleId}</p>
                          <p className="admin-home-income-client">{sale.customerName}</p>
                          <p className="admin-home-income-preview">{sale.preview}</p>
                        </div>

                        <div className="admin-home-income-stats">
                          <span className="admin-home-income-status">COMPLETADO</span>
                          <p className="admin-home-income-type">{sale.detailTypes}</p>
                          <p className="admin-home-income-date">{formatSaleDate(sale.saleDate)}</p>
                          <p className="admin-home-income-total">{formatMoney(sale.saleAmount)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="admin-home-modal-empty">
                  <p>No hay ingresos completados para este mes.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard;

