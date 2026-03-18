import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAttendanceAsistio } from "../../../../../shared/utils/attendanceStatus";
import {
  IconHome,
  IconUser,
  IconChartBar,
  IconCalendarEvent,
  IconStar,
  IconArrowRight,
  IconClipboardList,
} from "@tabler/icons-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { getUserConfig } from "../../../hooks/Configuraciones_API/Config_API.jsx";
import { getSeguimientos } from "../../../hooks/Seguimiento_API/API_seguimiento";
import { obtenerPedidosUsuario } from "../../../hooks/Pedidos_US_API/Pedidos_API_US";
import { getCurrentUser } from "../../../hooks/Acceder_API/authService";
import { obtenerAsistenciasClientes } from "../../../hooks/Asistencias_API/Asistencias_API";
import { getAgenda } from "../../../hooks/Agenda_API/Agenda_API";
import { obtenerBeneficiariosMios } from "../../../hooks/Beneficiario_API.jsx/Beneficiario_API";
import { resolveUserId } from "../../../../../shared/utils/appointmentNotifications";
import "../../../../../shared/styles/restructured/pages/dashboard-us-page.css";

const WEEK_SHORT_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const WEEK_SINGLE_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

const safeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const parseDateValue = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));

  const dmyMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateShort = (value) => {
  const date = parseDateValue(value);
  if (!date) return "Sin fecha";
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const parseCurrencyToNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoneyCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const getStartOfWeek = (reference = new Date()) => {
  const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const diffToMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWeekDayIndexMonday = (date) => (date.getDay() + 6) % 7;

const getEntityUserId = (entity = {}) => {
  const candidates = [
    entity?.id_usuario,
    entity?.id,
    entity?.usuario_id,
    entity?.user_id,
    entity?.id_cliente,
    entity?.id_relacion,
    entity?.id_usuario_usuario?.id_usuario,
    entity?.id_usuario_usuario?.id,
    entity?.id_cliente_usuario?.id_usuario,
    entity?.id_cliente_usuario?.id,
    entity?.id_relacion_usuario?.id_usuario,
    entity?.id_relacion_usuario?.id,
  ];
  const found = candidates.find((v) => v !== null && v !== undefined && v !== "");
  return found == null ? null : String(found);
};

const getEntityEmail = (entity = {}) => {
  const candidates = [
    entity?.email,
    entity?.correo,
    entity?.correo_electronico,
    entity?.email_usuario,
    entity?.id_usuario_usuario?.email,
    entity?.id_usuario_usuario?.correo,
    entity?.id_relacion_usuario?.email,
    entity?.id_relacion_usuario?.correo,
  ];
  const found = candidates.find((v) => String(v ?? "").trim() !== "");
  const email = String(found ?? "").trim().toLowerCase();
  return email.includes("@") ? email : "";
};

const getMetricFromDetalles = (registro = {}, tokens = []) => {
  const detalles = safeArray(registro?.detalles);
  for (const detalle of detalles) {
    const descriptor = normalizeText(`${detalle?.parametro || ""} ${detalle?.nombre_caracteristica || ""}`);
    if (!tokens.some((token) => descriptor.includes(token))) continue;
    const value = Number(detalle?.valor_numerico ?? detalle?.valor ?? detalle?.valor_medido);
    if (Number.isFinite(value)) return value;
  }
  return null;
};

const getDetalleValue = (registro = {}, coincidencias = [], preferirMax = false) => {
  const keys = safeArray(coincidencias).map((item) => normalizeText(item));
  if (!keys.length) return null;

  const detalles = safeArray(registro?.detalles);
  const candidatos = detalles.filter((detalle) => {
    const descriptor = normalizeText(`${detalle?.parametro || ""} ${detalle?.nombre_caracteristica || ""}`);
    return keys.some((key) => descriptor.includes(key));
  });
  if (!candidatos.length) return null;

  if (preferirMax) {
    const maximo = candidatos
      .map((detalle) => {
        const raw = detalle?.valor_numerico ?? detalle?.valor ?? detalle?.valor_medido ?? null;
        const numeric = Number(String(raw ?? "").replace(",", "."));
        if (!Number.isFinite(numeric)) return null;
        return { raw, numeric };
      })
      .filter(Boolean)
      .sort((a, b) => b.numeric - a.numeric)[0];

    if (maximo) return maximo.raw;
  }

  const first = candidatos[0];
  return first?.valor_numerico ?? first?.valor ?? first?.valor_medido ?? null;
};

const extraerNumero = (valor) => {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

  const texto = String(valor).replace(",", ".");
  const match = texto.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

const calcularImc = (pesoValor, alturaValor) => {
  const peso = extraerNumero(pesoValor);
  const altura = extraerNumero(alturaValor);
  if (!Number.isFinite(peso) || !Number.isFinite(altura)) return null;
  if (peso <= 0 || altura <= 0) return null;

  const alturaMetros = altura > 3 ? altura / 100 : altura;
  if (alturaMetros <= 0) return null;

  const imc = peso / (alturaMetros * alturaMetros);
  return Number.isFinite(imc) ? imc : null;
};

const normalizePedidoStatus = (raw) => {
  const status = normalizeText(raw);
  if (status.includes("complet")) return "Completado";
  if (status.includes("cancel")) return "Cancelado";
  if (status.includes("proceso")) return "En Proceso";
  return "Pendiente";
};

const parseAgendaList = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.agenda)) return raw.agenda;
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
};

const DashboardUs = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [moduleErrors, setModuleErrors] = useState([]);
  const [profile, setProfile] = useState({});
  const [seguimientos, setSeguimientos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [citas, setCitas] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const cargarDashboard = async () => {
      setLoading(true);
      const errors = [];

      const sessionUser = getCurrentUser() || {};
      let profileApi = null;
      try {
        profileApi = await getUserConfig("me");
      } catch (error) {
        console.warn("No se pudo cargar perfil en dashboard usuario:", error);
        errors.push("perfil");
      }

      const mergedProfile = { ...sessionUser, ...(profileApi || {}) };
      const userId = resolveUserId(profileApi) || resolveUserId(sessionUser) || getEntityUserId(mergedProfile);
      const userEmail = getEntityEmail(profileApi) || getEntityEmail(sessionUser) || getEntityEmail(mergedProfile);

      const requests = [
        { key: "seguimiento", run: () => getSeguimientos() },
        { key: "pedidos", run: () => (userId ? obtenerPedidosUsuario(userId) : Promise.resolve([])) },
        { key: "asistencias", run: () => obtenerAsistenciasClientes() },
        { key: "citas", run: () => getAgenda({ onlyMine: true }) },
        { key: "membresia", run: () => obtenerBeneficiariosMios() },
      ];

      const results = await Promise.allSettled(requests.map((item) => item.run()));
      if (cancelled) return;

      const payload = {
        seguimiento: [],
        pedidos: [],
        asistencias: [],
        citas: [],
        membresia: [],
      };

      results.forEach((result, index) => {
        const key = requests[index].key;
        if (result.status === "rejected") {
          errors.push(key);
          return;
        }

        if (key === "seguimiento") {
          payload.seguimiento = safeArray(result.value).filter((registro) => {
            if (!userId && !userEmail) return true;
            const registroUserId = getEntityUserId(registro);
            const registroEmail = getEntityEmail(registro);
            return (
              (userId && registroUserId && String(registroUserId) === String(userId)) ||
              (userEmail && registroEmail && registroEmail === userEmail)
            );
          });
          return;
        }

        if (key === "pedidos") {
          payload.pedidos = safeArray(result.value);
          return;
        }

        if (key === "asistencias") {
          payload.asistencias = safeArray(result.value).filter((item) => {
            if (!userId && !userEmail) return true;
            const itemUserId = getEntityUserId(item);
            const itemEmail = getEntityEmail(item);
            return (
              (userId && itemUserId && String(itemUserId) === String(userId)) ||
              (userEmail && itemEmail && itemEmail === userEmail)
            );
          });
          return;
        }

        if (key === "citas") {
          payload.citas = safeArray(parseAgendaList(result.value));
          return;
        }

        if (key === "membresia") {
          payload.membresia = safeArray(result.value);
        }
      });

      setProfile(mergedProfile);
      setSeguimientos(payload.seguimiento);
      setPedidos(payload.pedidos);
      setAsistencias(payload.asistencias);
      setCitas(payload.citas);
      setBeneficiarios(payload.membresia);
      setModuleErrors(errors);
      setLoading(false);
    };

    cargarDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const userName = useMemo(
    () =>
      profile?.nombre_usuario ||
      profile?.nombre ||
      profile?.name ||
      "Usuario",
    [profile],
  );

  const seguimientoOrdenado = useMemo(
    () =>
      safeArray(seguimientos)
        .map((registro) => ({ registro, fecha: parseDateValue(registro?.fecha_registro || registro?.fecha) }))
        .filter((item) => item.fecha)
        .sort((a, b) => a.fecha - b.fecha),
    [seguimientos],
  );

  const weightData = useMemo(() => {
    const points = seguimientoOrdenado
      .map(({ registro, fecha }) => ({
        name: `${String(fecha.getDate()).padStart(2, "0")}/${String(fecha.getMonth() + 1).padStart(2, "0")}`,
        peso: getMetricFromDetalles(registro, ["peso", "kg", "weight"]),
      }))
      .filter((item) => Number.isFinite(item.peso))
      .slice(-6);
    return points.length > 0 ? points : [{ name: "Sin datos", peso: 0 }];
  }, [seguimientoOrdenado]);

  const caloriesData = useMemo(() => {
    const summary = WEEK_SHORT_LABELS.map((name) => ({ name, calorias: 0 }));
    const start = getStartOfWeek(new Date());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    seguimientoOrdenado.forEach(({ fecha }) => {
      if (fecha >= start && fecha <= end) {
        const index = getWeekDayIndexMonday(fecha);
        if (summary[index]) summary[index].calorias += 1;
      }
    });
    return summary;
  }, [seguimientoOrdenado]);

  const attendanceData = useMemo(() => {
    const start = getStartOfWeek(new Date());
    return WEEK_SINGLE_LABELS.map((day, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const records = safeArray(asistencias).filter((item) => {
        const itemDate = parseDateValue(
          item?.fecha_asistencia || item?.asistencia_fecha || item?.fecha || item?.agenda_fecha,
        );
        return (
          isAttendanceAsistio(item) &&
          itemDate &&
          itemDate.getFullYear() === date.getFullYear() &&
          itemDate.getMonth() === date.getMonth() &&
          itemDate.getDate() === date.getDate()
        );
      });
      return {
        day,
        attended: records.length > 0,
      };
    });
  }, [asistencias]);

  const membershipData = useMemo(() => {
    const withMembership = safeArray(beneficiarios).find(
      (item) => item?.id_membresia_membresia || item?.membresia || item?.nombre_membresia,
    );

    if (!withMembership) {
      return [
        { name: "Usado", value: 0, color: "#e50914" },
        { name: "Restante", value: 100, color: "#e0e0e0" },
      ];
    }

    const rawStatus =
      withMembership?.id_estado_membresia_estado?.estado ||
      withMembership?.estado_membresia?.estado ||
      withMembership?.estado_membresia ||
      withMembership?.estado ||
      "";
    const status = normalizeText(rawStatus);

    let used = 65;
    if (status.includes("pend")) used = 20;
    if (status.includes("complet") || status.includes("cancel") || status.includes("inactiv")) used = 100;

    return [
      { name: "Usado", value: used, color: "#e50914" },
      { name: "Restante", value: Math.max(0, 100 - used), color: "#e0e0e0" },
    ];
  }, [beneficiarios]);

  const latestWeight = weightData[weightData.length - 1]?.peso ?? null;
  const firstWeight = weightData[0]?.peso ?? null;
  const weightVariation =
    Number.isFinite(firstWeight) && firstWeight > 0 && Number.isFinite(latestWeight)
      ? ((latestWeight - firstWeight) / firstWeight) * 100
      : null;

  const currentImc = useMemo(() => {
    const referencia = safeArray(seguimientos)
      .slice()
      .sort((a, b) => {
        const idA = Number(a?.id ?? a?.id_seguimiento ?? 0);
        const idB = Number(b?.id ?? b?.id_seguimiento ?? 0);
        if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
          return idB - idA;
        }

        const fechaA = parseDateValue(a?.fecha_registro || a?.fecha || a?.createdAt)?.getTime?.() ?? 0;
        const fechaB = parseDateValue(b?.fecha_registro || b?.fecha || b?.createdAt)?.getTime?.() ?? 0;
        return fechaB - fechaA;
      })[0];

    if (!referencia) return null;

    const peso = getDetalleValue(referencia, ["peso"], true) || profile?.peso || null;
    const altura = getDetalleValue(referencia, ["altura", "talla"], true);
    const imcRegistrado = getDetalleValue(referencia, ["imc", "indice de masa", "indice de masa corporal"]);
    const imcCalculado = calcularImc(peso, altura);

    return extraerNumero(imcRegistrado) ?? imcCalculado ?? null;
  }, [seguimientos, profile]);

  const pedidosSummary = useMemo(() => {
    const base = {
      total: 0,
      pendientes: 0,
      completados: 0,
      cancelados: 0,
      totalComprado: 0,
    };

    safeArray(pedidos).forEach((pedido) => {
      const status = normalizePedidoStatus(pedido?.estado);
      base.total += 1;
      if (status === "Pendiente" || status === "En Proceso") base.pendientes += 1;
      if (status === "Completado") base.completados += 1;
      if (status === "Cancelado") base.cancelados += 1;
      base.totalComprado += Number(pedido?.totalNumber) || parseCurrencyToNumber(pedido?.total);
    });

    return base;
  }, [pedidos]);

  const attendanceCount = attendanceData.filter((item) => item.attended).length;

  const membershipName = useMemo(() => {
    const item = safeArray(beneficiarios).find(
      (b) => b?.id_membresia_membresia || b?.membresia || b?.nombre_membresia,
    );
    const memObj = item?.id_membresia_membresia || item?.membresia || {};
    return memObj?.nombre_membresia || memObj?.nombre || item?.nombre_membresia || "Sin membresia";
  }, [beneficiarios]);

  const membershipStatus = useMemo(() => {
    const item = safeArray(beneficiarios).find(
      (b) => b?.id_membresia_membresia || b?.membresia || b?.nombre_membresia,
    );
    const raw =
      item?.id_estado_membresia_estado?.estado ||
      item?.estado_membresia?.estado ||
      item?.estado_membresia ||
      item?.estado ||
      "Sin estado";
    return String(raw);
  }, [beneficiarios]);

  const hasPremiumMembership = useMemo(() => {
    return safeArray(beneficiarios).some((item) => {
      const membership = item?.id_membresia_membresia || item?.membresia || {};
      const candidates = [
        membership?.nombre_membresia,
        membership?.nombre,
        item?.nombre_membresia,
        item?.nombre,
      ];
      return candidates.some((value) => normalizeText(value).includes("premium"));
    });
  }, [beneficiarios]);

  const nextCitaText = useMemo(() => {
    const now = new Date();
    const parsed = safeArray(citas)
      .map((cita) => {
        const date = parseDateValue(cita?.agenda_fecha || cita?.fecha || cita?.fecha_agenda);
        const label = cita?.actividad_agenda || cita?.actividad || "Cita";
        return { date, label };
      })
      .filter((item) => item.date)
      .sort((a, b) => a.date - b.date)
      .find((item) => item.date >= now);

    return parsed ? `${parsed.label} - ${formatDateShort(parsed.date)}` : "Sin cita programada";
  }, [citas]);

  if (loading) {
    return (
      <div className="dashboard-us__root">
        <div className="dashboard-us__loading">Cargando dashboard de usuario...</div>
      </div>
    );
  }

  return (
      <div className="dashboard-us__root">
        {/* Header */}
        <div className="dashboard-us__header">
          <h1 className="dashboard-us__title">
            <IconHome size={26} color="#e50914" />
            Bienvenido de nuevo, {userName}
          </h1>
          {moduleErrors.length > 0 && (
            <p className="dashboard-us__warning">
              Algunos modulos no cargaron: {moduleErrors.join(", ")}
            </p>
          )}
        </div>

        {/* Fila superior */}
        <div className="dashboard-us__board">
          {/* Mi Perfil */}
          <section className="dashboard-us__card dashboard-us__card--large">
            <div>
              <h2 className="dashboard-us__section-title">
                <IconUser size={18} color="#e50914" /> Mi Perfil
              </h2>

              <div className="dashboard-us__profile-row">
                <div className="dashboard-us__avatar">
                  {String(userName).charAt(0).toUpperCase() || "U"}
                </div>

                <div>
                  <p className="dashboard-us__metric-label">
                    Evolucion del peso
                  </p>
                  <p className="dashboard-us__metric-value">
                    {Number.isFinite(latestWeight) ? `${latestWeight} kg` : "Sin dato"}
                    {Number.isFinite(weightVariation) && (
                      <span
                        className={`dashboard-us__metric-variation ${
                          weightVariation >= 0 ? "is-positive" : "is-negative"
                        }`}
                      >
                        {weightVariation >= 0 ? "+" : ""}
                        {weightVariation.toFixed(1)}%
                      </span>
                    )}
                  </p>
                  <p className="dashboard-us__small-text">
                    IMC: {Number.isFinite(currentImc) ? currentImc.toFixed(1) : "Sin dato"}
                  </p>
                </div>
              </div>
            </div>

            <div className="dashboard-us__chart dashboard-us__chart--weight">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                  <CartesianGrid stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#555", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #ddd",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="#e50914"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Resumen General */}
          <section className="dashboard-us__card dashboard-us__card--summary">
            <div>
              <h3 className="dashboard-us__section-title">
                <IconClipboardList size={18} color="#e50914" /> Resumen General
              </h3>
              <p className="dashboard-us__summary-line">
                Pedidos totales: <strong>{pedidosSummary.total}</strong>
              </p>
              <p className="dashboard-us__summary-line dashboard-us__summary-line--spaced">
                Pedidos pendientes: <strong>{pedidosSummary.pendientes}</strong>
              </p>
              <p className="dashboard-us__summary-line dashboard-us__summary-line--spaced">
                Pedidos completados: <strong>{pedidosSummary.completados}</strong>
              </p>
              <p className="dashboard-us__summary-line dashboard-us__summary-line--spaced">
                Total comprado: <strong>{formatMoneyCOP(pedidosSummary.totalComprado)}</strong>
              </p>
              {hasPremiumMembership && (
                <p className="dashboard-us__summary-line dashboard-us__summary-line--spaced">
                  Proxima cita: <strong>{nextCitaText}</strong>
                </p>
              )}
            </div>
            <button
              className="dashboard-us__button"
              onClick={() => navigate("/cliente/pedidosUsuario")}
            >
              Ver Pedidos{" "}
              <IconArrowRight size={12} className="dashboard-us__arrow" />
            </button>
          </section>
        </div>

        {/* Fila inferior */}
        <div className="dashboard-us__bottom-grid">
          {/* Rendimiento */}
          <section className="dashboard-us__card">
            <h3 className="dashboard-us__section-title">
              <IconChartBar size={16} color="#e50914" /> Mi Rendimiento
            </h3>
            <p className="dashboard-us__count-lg">
              {seguimientoOrdenado.length} registros
            </p>
            <p className="dashboard-us__small-text">Esta Semana</p>
            <div className="dashboard-us__chart dashboard-us__chart--mini">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={caloriesData}>
                  <CartesianGrid stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#555", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#fff",
                      border: "1px solid #ddd",
                    }}
                  />
                  <Bar
                    dataKey="calorias"
                    fill="#e50914"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Asistencia */}
          <section className="dashboard-us__card">
            <h3 className="dashboard-us__section-title">
              <IconCalendarEvent size={16} color="#e50914" /> Mi Asistencia
            </h3>
            <p className="dashboard-us__count-sm">{attendanceCount}/7 Dias</p>
            <div className="dashboard-us__attendance-row">
              {attendanceData.map((item, index) => (
                <div key={index} className="dashboard-us__attendance-day">
                  <div
                    className={`dashboard-us__attendance-dot ${
                      item.attended ? "is-attended" : "is-missed"
                    }`}
                  />
                  <p className="dashboard-us__attendance-label">{item.day}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Membresia */}
          <section className="dashboard-us__card">
            <h3 className="dashboard-us__section-title">
              <IconStar size={16} color="#e50914" /> Mi Membresia
            </h3>
            <p className="dashboard-us__membership-name">{membershipName}</p>
            <p className="dashboard-us__small-text">Estado: {membershipStatus}</p>
            <div className="dashboard-us__chart dashboard-us__chart--membership">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={membershipData}
                    dataKey="value"
                    innerRadius={32}
                    outerRadius={44}
                  >
                    {membershipData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="dashboard-us__membership-cycle">
              Ciclo actual: usado / restante
            </p>
          </section>
        </div>
      </div>
  );
};

export default DashboardUs;

