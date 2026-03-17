import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarDays,
  Clock3,
  Plus,
  Search,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

import BuscadorUniversal from "../../../components/BuscadorUniversal";
import CalendarioCitas from "../../../../../shared/components/Citas-Ad/calendarioCitas";
import ModalCitasAd from "../Citas/modalCitas-ad";
import { useAgenda } from "../../../hooks/Agenda_API/useAgenda";
import { useUsuarios } from "../../../hooks/Usuarios_API/useUsuarios";
import { obtenerServicios } from "../../../hooks/Servicios_API/Servicios_API";
import {
  ESTADOS_APP,
  OPCIONES_ESTADO_FLUJO,
} from "../../../components/dataTables/badgesEstado";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import {
  getDefaultAppointmentTimes,
  validateAppointmentScheduling,
} from "../../../../../shared/utils/employeeSchedule";
import { canPerformActionForPath } from "../../../hooks/Acceder_API/authService";
import "./programarCitas.css";

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTime = (value, fallback = "09:00:00") => {
  if (!value || typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text) return fallback;
  return text.length === 5 ? `${text}:00` : text;
};

const getTodayDateValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateTime = (fecha, hora) => {
  if (!fecha) return null;
  const hhmm = String(hora || "00:00").slice(0, 5);
  const parsed = new Date(`${fecha}T${hhmm}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildNombreCompleto = (persona) => {
  if (!persona || typeof persona !== "object") return "";

  return (
    persona.nombre_completo ||
    `${persona.nombre_usuario || ""} ${persona.apellido_usuario || ""}`.trim() ||
    persona.nombre ||
    persona.email ||
    ""
  );
};

const getNombrePersona = (persona, fallback = "No asignado") =>
  buildNombreCompleto(persona) || fallback;

const formatDateTimeLabel = (fecha, hora) => {
  const parsed = parseDateTime(fecha, hora);
  if (!parsed) return "Fecha por definir";
  return parsed.toLocaleString("es-CO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatHoursLabel = (hours) =>
  `${Number.isFinite(hours) ? hours.toFixed(1) : "0.0"} h`;

const SearchableFilterSelect = ({
  value,
  onChange,
  options,
  placeholder,
  emptyMessage,
  disabled = false,
  className = "",
}) => {
  const selectedOption = useMemo(
    () =>
      options.find((option) => String(option.value) === String(value)) ?? null,
    [options, value],
  );

  const [query, setQuery] = useState(selectedOption?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedOption?.label ?? "");
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return options;

    return options.filter((option) =>
      normalizeText(option.label).includes(term),
    );
  }, [options, query]);

  const handleSelect = (option) => {
    onChange(String(option.value));
    setQuery(option.label);
    setIsOpen(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      setIsOpen(false);
      setQuery(selectedOption?.label ?? "");
    }, 120);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setQuery(selectedOption?.label ?? "");
    }
  };

  return (
    <div className={`programar-citas-filter ${className}`}>
      <div className="programar-citas-filter__control">
        <Search size={16} className="programar-citas-filter__icon" />
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={(event) => {
            setIsOpen(true);
            event.target.select();
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="programar-citas-filter__input"
          disabled={disabled}
          autoComplete="off"
        />
      </div>

      {isOpen && !disabled ? (
        <div className="programar-citas-filter__dropdown">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected =
                String(option.value) === String(selectedOption?.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option)}
                  className={`programar-citas-filter__option${
                    isSelected ? " programar-citas-filter__option--active" : ""
                  }`}
                >
                  {option.label}
                </button>
              );
            })
          ) : (
            <div className="programar-citas-filter__empty">{emptyMessage}</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

const ProgramarCita = () => {
  const canCreate = canPerformActionForPath("crear");
  const [modalOpen, setModalOpen] = useState(false);
  const [citaEditando, setCitaEditando] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [actividades, setActividades] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [empleadoFilter, setEmpleadoFilter] = useState("all");
  const [estadoFilter, setEstadoFilter] = useState("all");

  const {
    agenda,
    cargarAgenda,
    crearAgenda,
    actualizarAgenda,
    eliminarAgenda,
    loading: loadingAgenda,
  } = useAgenda();

  const {
    usuariosClientes,
    usuariosAsignablesCitas,
    cargarUsuarios,
    loading: loadingUsuarios,
  } = useUsuarios();

  const empleados = useMemo(
    () =>
      Array.isArray(usuariosAsignablesCitas) ? usuariosAsignablesCitas : [],
    [usuariosAsignablesCitas],
  );
  const clientes = useMemo(
    () => (Array.isArray(usuariosClientes) ? usuariosClientes : []),
    [usuariosClientes],
  );

  const empleadosById = useMemo(
    () =>
      new Map(
        empleados.map((empleado) => [
          Number(empleado.id_usuario ?? empleado.id),
          empleado,
        ]),
      ),
    [empleados],
  );

  const clientesById = useMemo(
    () =>
      new Map(
        clientes.map((cliente) => [
          Number(cliente.id_usuario ?? cliente.id),
          cliente,
        ]),
      ),
    [clientes],
  );

  const estadoLabelById = useMemo(
    () =>
      new Map(
        OPCIONES_ESTADO_FLUJO.map((estado) => [
          Number(estado.value),
          estado.label,
        ]),
      ),
    [],
  );

  const empleadoFilterOptions = useMemo(() => {
    const uniqueOptions = new Map();

    empleados.forEach((empleado) => {
      const empleadoId = empleado.id_usuario ?? empleado.id;
      if (empleadoId == null || uniqueOptions.has(String(empleadoId))) return;

      uniqueOptions.set(String(empleadoId), {
        value: String(empleadoId),
        label: getNombrePersona(empleado, `Entrenador ${empleadoId}`),
      });
    });

    return [
      { value: "all", label: "Todos los entrenadores" },
      ...Array.from(uniqueOptions.values()).sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
      ),
    ];
  }, [empleados]);

  const estadoFilterOptions = useMemo(
    () => [
      { value: "all", label: "Todos los estados" },
      ...OPCIONES_ESTADO_FLUJO.map((estado) => ({
        value: String(estado.value),
        label: estado.label,
      })),
    ],
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const cargarDatos = async () => {
      try {
        const [serviciosRaw] = await Promise.all([
          obtenerServicios(),
          cargarUsuarios(),
          cargarAgenda(),
        ]);

        if (!isMounted) return;

        const listaServicios = Array.isArray(serviciosRaw)
          ? serviciosRaw
          : Array.isArray(serviciosRaw?.data)
            ? serviciosRaw.data
            : [];

        const actividadesFiltradas = listaServicios.filter((servicio) => {
          const tipo =
            servicio.tipo_servicio ??
            servicio.tipo ??
            servicio.id_tipo_servicio_tipo?.tipo_servicio ??
            servicio.id_tipo_servicio_tipo?.tipo ??
            "";
          return normalizeText(tipo) === "actividad";
        });

        setActividades(actividadesFiltradas);
      } catch (error) {
        toast.error(
          getApiErrorMessage(error, "No se pudieron cargar los datos de agenda"),
        );
      }
    };

    cargarDatos();

    return () => {
      isMounted = false;
    };
  }, [cargarAgenda, cargarUsuarios]);

  const actividadesServicio = useMemo(() => {
    return (Array.isArray(actividades) ? actividades : []).map((servicio) => {
      const id =
        servicio.id_servicio ??
        servicio.id ??
        servicio.servicio_id ??
        servicio.id_servicios ??
        "";
      const nombre =
        servicio.nombre_servicio ??
        servicio.nombre ??
        servicio.actividad ??
        servicio.descripcion_servicio ??
        `Servicio ${id}`;

      return {
        id: String(id),
        nombre: String(nombre),
      };
    });
  }, [actividades]);

  const defaultEmpleadoId = useMemo(() => {
    if (empleadoFilter !== "all") {
      return toNumberOrNull(empleadoFilter) ?? "";
    }
    return toNumberOrNull(empleados[0]?.id_usuario ?? empleados[0]?.id) ?? "";
  }, [empleados, empleadoFilter]);

  const defaultClienteId = useMemo(
    () => toNumberOrNull(clientes[0]?.id_usuario ?? clientes[0]?.id) ?? "",
    [clientes],
  );

  const buildDraftCita = useCallback(
    (overrides = {}) => {
      const agendaFecha = overrides.agenda_fecha || getTodayDateValue();
      const empleadoId =
        toNumberOrNull(overrides.id_empleado) ?? defaultEmpleadoId;
      const empleadoSeleccionado = empleadosById.get(Number(empleadoId)) || null;
      const defaultTimes = getDefaultAppointmentTimes(
        agendaFecha,
        empleadoSeleccionado?.horario_empleado,
      );

      return {
        id_agenda: "",
        actividad_agenda: "",
        observacion_agenda: "",
        agenda_fecha: agendaFecha,
        hora_inicio: defaultTimes.hora_inicio || "09:00",
        hora_fin: defaultTimes.hora_fin || "10:00",
        id_empleado: empleadoId || "",
        id_cliente: defaultClienteId,
        id_estado: ESTADOS_APP.PENDIENTE,
        ...overrides,
      };
    },
    [defaultClienteId, defaultEmpleadoId, empleadosById],
  );

  const mapRawToEditableCita = useCallback(
    (raw = {}) => {
      const empleadoId =
        toNumberOrNull(
          raw.id_empleado ??
            raw.id_empleado_usuario?.id_usuario ??
            raw.id_empleado_usuario?.id,
        ) ?? defaultEmpleadoId;

      const clienteId =
        toNumberOrNull(
          raw.id_cliente ??
            raw.id_cliente_usuario?.id_usuario ??
            raw.id_cliente_usuario?.id,
        ) ?? defaultClienteId;

      return buildDraftCita({
        ...raw,
        id_agenda: raw.id_agenda ?? raw.id ?? "",
        agenda_fecha: raw.agenda_fecha || raw.fecha || getTodayDateValue(),
        hora_inicio: String(raw.hora_inicio || raw.horaInicio || "09:00").slice(
          0,
          5,
        ),
        hora_fin: String(raw.hora_fin || raw.horaFin || "10:00").slice(0, 5),
        id_empleado: empleadoId || "",
        id_cliente: clienteId || "",
        id_estado: toNumberOrNull(raw.id_estado) ?? ESTADOS_APP.PENDIENTE,
        observacion_agenda:
          raw.observacion_agenda ??
          raw.descripcion_agenda ??
          raw.observaciones ??
          "",
      });
    },
    [buildDraftCita, defaultClienteId, defaultEmpleadoId],
  );

  const citasFiltradas = useMemo(() => {
    if (!Array.isArray(agenda)) return [];

    const term = normalizeText(searchTerm);
    const empleadoFiltroId =
      empleadoFilter === "all" ? null : Number(empleadoFilter);
    const estadoFiltroId = estadoFilter === "all" ? null : Number(estadoFilter);

    return agenda.filter((cita) => {
      const empleadoId = Number(
        cita.id_empleado ??
          cita.id_empleado_usuario?.id_usuario ??
          cita.id_empleado_usuario?.id,
      );
      const clienteId = Number(
        cita.id_cliente ??
          cita.id_cliente_usuario?.id_usuario ??
          cita.id_cliente_usuario?.id,
      );
      const estadoId = Number(cita.id_estado ?? ESTADOS_APP.PENDIENTE);

      if (empleadoFiltroId && empleadoId !== empleadoFiltroId) return false;
      if (estadoFiltroId && estadoId !== estadoFiltroId) return false;
      if (!term) return true;

      const empleado =
        cita.id_empleado_usuario || empleadosById.get(Number(empleadoId));
      const cliente =
        cita.id_cliente_usuario || clientesById.get(Number(clienteId));
      const estadoLabel = estadoLabelById.get(estadoId) || `Estado ${estadoId}`;

      return [
        cita.actividad_agenda,
        cita.observacion_agenda,
        cita.agenda_fecha,
        cita.hora_inicio,
        cita.hora_fin,
        getNombrePersona(empleado, ""),
        getNombrePersona(cliente, ""),
        estadoLabel,
      ].some((field) => normalizeText(field).includes(term));
    });
  }, [
    agenda,
    clientesById,
    empleadosById,
    empleadoFilter,
    estadoFilter,
    estadoLabelById,
    searchTerm,
  ]);

  const citasCalendario = useMemo(() => {
    return citasFiltradas
      .map((cita) => {
        const empleadoId = Number(
          cita.id_empleado ??
            cita.id_empleado_usuario?.id_usuario ??
            cita.id_empleado_usuario?.id,
        );
        const clienteId = Number(
          cita.id_cliente ??
            cita.id_cliente_usuario?.id_usuario ??
            cita.id_cliente_usuario?.id,
        );

        const empleado =
          cita.id_empleado_usuario || empleadosById.get(Number(empleadoId)) || null;
        const cliente =
          cita.id_cliente_usuario || clientesById.get(Number(clienteId)) || null;

        const fecha = cita.agenda_fecha || getTodayDateValue();

        return {
          id: String(
            cita.id_agenda ??
              cita.id ??
              `${fecha}-${cita.hora_inicio}-${empleadoId}-${clienteId}`,
          ),
          title: cita.actividad_agenda || "Cita",
          start: `${fecha}T${normalizeTime(cita.hora_inicio, "09:00:00")}`,
          end: `${fecha}T${normalizeTime(cita.hora_fin, "10:00:00")}`,
          className: `estado-${cita.id_estado ?? ESTADOS_APP.PENDIENTE}`,
          extendedProps: {
            ...cita,
            id_empleado_usuario: empleado,
            id_cliente_usuario: cliente,
          },
        };
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [citasFiltradas, clientesById, empleadosById]);

  const resumen = useMemo(() => {
    const today = getTodayDateValue();
    const now = new Date();

    let citasHoy = 0;
    let pendientes = 0;
    let horasProgramadas = 0;
    const proximas = [];

    for (const cita of citasFiltradas) {
      const estado = Number(cita.id_estado ?? ESTADOS_APP.PENDIENTE);
      if (estado === ESTADOS_APP.PENDIENTE || estado === ESTADOS_APP.EN_PROCESO) {
        pendientes += 1;
      }

      if (String(cita.agenda_fecha || "") === today) {
        citasHoy += 1;
      }

      const inicio = parseDateTime(cita.agenda_fecha, cita.hora_inicio);
      const fin = parseDateTime(cita.agenda_fecha, cita.hora_fin);

      if (inicio && fin && fin > inicio) {
        horasProgramadas += (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
      }

      if (inicio && inicio >= now) {
        proximas.push({ ...cita, _fechaOrden: inicio });
      }
    }

    proximas.sort((a, b) => a._fechaOrden - b._fechaOrden);

    return {
      total: citasFiltradas.length,
      hoy: citasHoy,
      pendientes,
      proximas: proximas.length,
      horas: Number(horasProgramadas.toFixed(1)),
      listaProximas: proximas.slice(0, 8),
    };
  }, [citasFiltradas]);

  const abrirDetalleCita = useCallback(
    (cita) => {
      const citaData = cita?.extendedProps ?? cita ?? {};
      setCitaEditando(mapRawToEditableCita(citaData));
      setIsEditMode(false);
      setModalOpen(true);
    },
    [mapRawToEditableCita],
  );

  const handleSelectSlot = useCallback(
    (slotData) => {
      if (!canCreate) {
        toast.error("No tienes permisos para crear en esta sección.");
        return;
      }
      const citaBase = mapRawToEditableCita({
        ...slotData,
        id_empleado:
          defaultEmpleadoId ||
          toNumberOrNull(slotData?.id_empleado) ||
          "",
        id_cliente: toNumberOrNull(slotData?.id_cliente) ?? defaultClienteId,
        id_estado: ESTADOS_APP.PENDIENTE,
      });

      setCitaEditando(citaBase);
      setIsEditMode(true);
      setModalOpen(true);
    },
    [canCreate, defaultClienteId, defaultEmpleadoId, mapRawToEditableCita],
  );

  const handleNuevaCita = useCallback(() => {
    if (!canCreate) {
      toast.error("No tienes permisos para crear en esta sección.");
      return;
    }
    setCitaEditando(buildDraftCita());
    setIsEditMode(true);
    setModalOpen(true);
  }, [buildDraftCita, canCreate]);

  const handleSave = useCallback(
    async (datos) => {
      try {
        const payload = {
          id_agenda: toNumberOrNull(datos?.id_agenda ?? datos?.id),
          id_cliente: toNumberOrNull(datos?.id_cliente),
          id_empleado: toNumberOrNull(datos?.id_empleado),
          agenda_fecha: String(datos?.agenda_fecha || ""),
          hora_inicio: normalizeTime(datos?.hora_inicio, ""),
          hora_fin: normalizeTime(datos?.hora_fin, ""),
          id_estado:
            toNumberOrNull(datos?.id_estado) ?? ESTADOS_APP.PENDIENTE,
          actividad_agenda: String(datos?.actividad_agenda || "").trim(),
          observacion_agenda: datos?.observacion_agenda || "",
        };

        if (!payload.id_cliente) throw new Error("Debes seleccionar un cliente");
        if (!payload.id_empleado)
          throw new Error("Debes seleccionar un entrenador");
        if (!payload.agenda_fecha) throw new Error("La fecha es obligatoria");
        if (!payload.hora_inicio || !payload.hora_fin) {
          throw new Error("Debes ingresar una hora de inicio y fin válidas");
        }
        if (!payload.actividad_agenda)
          throw new Error("Debes seleccionar una actividad");

        const selectedEmpleado =
          empleadosById.get(payload.id_empleado) ||
          (datos?.id_empleado_usuario &&
          typeof datos.id_empleado_usuario === "object"
            ? datos.id_empleado_usuario
            : null);

        const schedulingValidation = validateAppointmentScheduling({
          agendaFecha: payload.agenda_fecha,
          horaInicio: payload.hora_inicio,
          horaFin: payload.hora_fin,
          empleado: selectedEmpleado,
          agendaItems: agenda,
          currentAppointmentId: payload.id_agenda,
          employeeId: payload.id_empleado,
          isEditing: Boolean(payload.id_agenda),
        });

        if (!schedulingValidation.valid) {
          throw new Error(schedulingValidation.message);
        }

        const { id_agenda, ...body } = payload;

        if (id_agenda) {
          await actualizarAgenda(id_agenda, body);
        } else {
          await crearAgenda(body);
        }

        setModalOpen(false);
        setCitaEditando(null);
        setIsEditMode(false);

        return true;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, "No se pudo guardar la cita"));
      }
    },
    [actualizarAgenda, agenda, crearAgenda, empleadosById],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setCitaEditando(null);
    setIsEditMode(false);
  }, []);

  const isLoading = loadingAgenda || loadingUsuarios;
  const isExistingCita = Boolean(citaEditando?.id_agenda);

  return (
    <div className="main-ad-column programar-citas-page">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <CalendarDays size={40} className="icono-titulo" color="red" />
          <h1>Programar Citas</h1>
        </div>

        <div className="acciones-derecha programar-citas-actions">
          <SearchableFilterSelect
            value={empleadoFilter}
            onChange={setEmpleadoFilter}
            options={empleadoFilterOptions}
            placeholder="Buscar entrenador..."
            emptyMessage="No se encontraron entrenadores"
            disabled={isLoading}
          />

          <SearchableFilterSelect
            value={estadoFilter}
            onChange={setEstadoFilter}
            options={estadoFilterOptions}
            placeholder="Buscar estado..."
            emptyMessage="No se encontraron estados"
            disabled={isLoading}
          />

          <button
            className="boton boton-primario programar-citas-btn"
            onClick={handleNuevaCita}
            disabled={isLoading || !canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            <Plus size={16} />
            {isLoading ? "Cargando..." : "Nueva Cita"}
          </button>

          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar por actividad, cliente o entrenador..."
            className="expandido"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="programar-citas-loading">Cargando agenda laboral...</div>
      ) : null}

      <div className="programar-citas-layout">
        <aside className="programar-citas-panel">
          <div className="programar-citas-kpis">
            <article className="programar-citas-kpi-card">
              <div>
                <p className="programar-citas-kpi-label">Bloques Programados</p>
                <h3 className="programar-citas-kpi-value">{resumen.total}</h3>
              </div>
              <span className="programar-citas-kpi-icon kpi-blue">
                <CalendarCheck size={20} />
              </span>
            </article>

            <article className="programar-citas-kpi-card">
              <div>
                <p className="programar-citas-kpi-label">Citas Hoy</p>
                <h3 className="programar-citas-kpi-value">{resumen.hoy}</h3>
              </div>
              <span className="programar-citas-kpi-icon kpi-green">
                <Clock3 size={20} />
              </span>
            </article>

            <article className="programar-citas-kpi-card">
              <div>
                <p className="programar-citas-kpi-label">Pendientes</p>
                <h3 className="programar-citas-kpi-value">{resumen.pendientes}</h3>
              </div>
              <span className="programar-citas-kpi-icon kpi-amber">
                <Users size={20} />
              </span>
            </article>

            <article className="programar-citas-kpi-card">
              <div>
                <p className="programar-citas-kpi-label">Horas Programadas</p>
                <h3 className="programar-citas-kpi-value">
                  {formatHoursLabel(resumen.horas)}
                </h3>
              </div>
              <span className="programar-citas-kpi-icon kpi-slate">
                <CalendarDays size={20} />
              </span>
            </article>
          </div>

          <div className="programar-citas-upcoming">
            <div className="programar-citas-upcoming-head">
              <h3>Próximas citas</h3>
              <span>{resumen.proximas}</span>
            </div>

            {resumen.listaProximas.length === 0 ? (
              <p className="programar-citas-empty">
                No hay citas futuras con los filtros actuales.
              </p>
            ) : (
              <ul className="programar-citas-upcoming-list">
                {resumen.listaProximas.map((cita) => {
                  const empleado =
                    cita.id_empleado_usuario ||
                    empleadosById.get(Number(cita.id_empleado));
                  const estadoId = Number(
                    cita.id_estado ?? ESTADOS_APP.PENDIENTE,
                  );
                  return (
                    <li key={`cita-${cita.id_agenda || cita.id}-${cita._fechaOrden}`}>
                      <button
                        type="button"
                        className="programar-citas-upcoming-item"
                        onClick={() => abrirDetalleCita(cita)}
                      >
                        <strong>{cita.actividad_agenda || "Cita"}</strong>
                        <span>{getNombrePersona(empleado)}</span>
                        <span>
                          {formatDateTimeLabel(cita.agenda_fecha, cita.hora_inicio)}
                        </span>
                        <span className="programar-citas-upcoming-status">
                          {estadoLabelById.get(estadoId) || `Estado ${estadoId}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="programar-citas-calendar-wrap">
          <CalendarioCitas
            citas={citasCalendario}
            useExternalData
            empleados={empleados}
            clientes={clientes}
            onEventClick={abrirDetalleCita}
            onSelectSlot={handleSelectSlot}
          />
        </section>
      </div>

      <ModalCitasAd
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        onDelete={eliminarAgenda}
        onEdit={isExistingCita && !isEditMode ? () => setIsEditMode(true) : null}
        title={
          !isExistingCita
            ? "Programar Cita"
            : isEditMode
              ? "Editar Cita"
              : "Detalle de Cita"
        }
        initialData={citaEditando || {}}
        disabled={isExistingCita && !isEditMode}
        empleados={empleados}
        clientes={clientes}
        actividades={actividadesServicio}
      />
    </div>
  );
};

export default ProgramarCita;
