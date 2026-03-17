import { useCallback, useEffect, useMemo, useState } from "react";
import {
  obtenerAsistenciasClientes,
  obtenerAsistenciasEmpleados,
  crearAsistenciaCliente,
  crearAsistenciaEmpleado,
  actualizarAsistenciaCliente,
  actualizarAsistenciaEmpleado,
  eliminarAsistenciaCliente,
  eliminarAsistenciaEmpleado,
} from "./Asistencias_API";
import { DEFAULT_DATA_TABLE_PAGE_SIZE } from "../../components/dataTables/dataTable";
import { normalizePaginatedResponse } from "../../../../shared/utils/pagination";

const TIPOS_ASISTENCIA = {
  CLIENTE: "cliente",
  EMPLEADO: "empleado",
};

const ESTADO_TEXTO_A_ID = {
  activo: 1,
  inactivo: 2,
  pendiente: 3,
  "en proceso": 4,
  en_proceso: 4,
  completado: 5,
  cancelado: 6,
  retrasado: 7,
  asistio: 8,
  "asistio cliente": 8,
  "no asistio": 9,
  no_asistio: 9,
  noasistio: 9,
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeEstadoTexto = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const firstValue = (item = {}, keys = []) => {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const extractId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "object") return toNumberOrNull(value);
  return (
    toNumberOrNull(value.id) ??
    toNumberOrNull(value.id_usuario) ??
    toNumberOrNull(value.id_cita) ??
    toNumberOrNull(value.id_estado) ??
    null
  );
};

const extractPrimitive = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "object") return value;
  return firstValue(value, [
    "value",
    "valor",
    "hora_salida",
    "horaSalida",
    "hora_fin",
    "horaFin",
    "hora_ingreso",
    "horaIngreso",
    "hora_entrada",
    "horaEntrada",
    "fecha",
  ]);
};

const normalizeId = (item = {}) =>
  item.id ??
  item.id_asistencia ??
  item.id_asistencia_cliente ??
  item.id_asistencia_empleado ??
  item.id_asistencia_clientes ??
  item.id_asistencia_empleados ??
  item.id_registro ??
  item.idRegistro ??
  null;

const normalizeEstadoId = (item = {}) => {
  const rawEstado = firstValue(item, ["id_estado", "estado", "id_estado_estado"]);
  if (rawEstado === null) return null;

  const idFromObject = extractId(rawEstado);
  if (idFromObject !== null) return idFromObject;

  const idDirecto = toNumberOrNull(rawEstado);
  if (idDirecto !== null) return idDirecto;

  if (typeof rawEstado === "object") {
    const estadoTextoObjeto = firstValue(rawEstado, ["estado", "nombre_estado", "nombre"]);
    const keyObjeto = normalizeEstadoTexto(estadoTextoObjeto);
    return ESTADO_TEXTO_A_ID[keyObjeto] ?? null;
  }

  const key = normalizeEstadoTexto(rawEstado);
  return ESTADO_TEXTO_A_ID[key] ?? null;
};

const normalizeCliente = (item = {}, index = 0) => {
  const id = normalizeId(item) ?? index + 1;
  const citaRaw = firstValue(item, ["id_cita", "id_agenda", "id_cita_agenda", "agenda"]);
  const id_usuario = extractId(
    firstValue(item, [
      "id_usuario",
      "id_cliente",
      "id_cliente_usuario",
      "id_usuario_usuario",
    ])
  );
  const id_cita = extractId(citaRaw);
  const actividad_cita =
    extractPrimitive(
      firstValue(item, [
        "actividad_cita",
        "actividad_agenda",
        "actividad",
        "descripcion_agenda",
        "descripcion",
      ])
    ) ||
    extractPrimitive(
      firstValue(citaRaw || {}, [
        "actividad_cita",
        "actividad_agenda",
        "actividad",
        "descripcion_agenda",
        "descripcion",
        "titulo",
        "nombre",
      ])
    ) ||
    (id_cita != null ? `Cita ${id_cita}` : "");

  return {
    ...item,
    id,
    id_usuario,
    id_cita,
    actividad_cita,
    fecha_asistencia:
      firstValue(item, ["fecha_asistencia", "asistencia_fecha", "agenda_fecha", "fecha"]) || "",
    hora_ingreso:
      extractPrimitive(
        firstValue(item, [
          "hora_ingreso",
          "horaIngreso",
          "hora_entrada",
          "hora_entrada_cliente",
          "hora_inicio",
          "horaInicio",
        ])
      ) ||
      "",
    hora_salida:
      extractPrimitive(
        firstValue(item, [
          "hora_salida",
          "horaSalida",
          "hora_salida_cliente",
          "hora_salida_empleado",
          "hora_fin",
          "horaFin",
          "salida",
        ])
      ) || "",
    id_estado: normalizeEstadoId(item),
    tipo: TIPOS_ASISTENCIA.CLIENTE,
  };
};

const normalizeEmpleado = (item = {}, index = 0) => {
  const id = normalizeId(item) ?? index + 1;
  const id_usuario = extractId(
    firstValue(item, [
      "id_usuario",
      "id_empleado",
      "id_empleado_usuario",
      "id_usuario_usuario",
    ])
  );

  return {
    ...item,
    id,
    id_usuario,
    asistencia_fecha:
      firstValue(item, ["asistencia_fecha", "fecha_asistencia", "fecha"]) || "",
    hora_entrada_empleado:
      extractPrimitive(
        firstValue(item, [
          "hora_entrada_empleado",
          "horaEntradaEmpleado",
          "hora_entrada",
          "hora_ingreso",
          "horaIngreso",
          "hora_inicio",
          "horaInicio",
        ])
      ) || "",
    hora_salida_empleado:
      extractPrimitive(
        firstValue(item, [
          "hora_salida_empleado",
          "horaSalidaEmpleado",
          "hora_salida",
          "horaSalida",
          "hora_fin",
          "horaFin",
          "salida",
        ])
      ) || "",
    id_estado: normalizeEstadoId(item),
    observaciones: firstValue(item, ["observaciones", "nota", "comentario"]) || "",
    tipo: TIPOS_ASISTENCIA.EMPLEADO,
  };
};

const normalizeAsistencias = (items, tipo) =>
  (Array.isArray(items) ? items : []).map((item, index) =>
    tipo === TIPOS_ASISTENCIA.CLIENTE
      ? normalizeCliente(item, index)
      : normalizeEmpleado(item, index)
  );

export const ASISTENCIA_TIPOS = TIPOS_ASISTENCIA;

const useAsistencias = (
  tipo = TIPOS_ASISTENCIA.CLIENTE,
  searchValue = "",
) => {
  const [asistencias, setAsistencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const search = String(searchValue ?? "").trim();

  const fetchAsistencias = useCallback(async ({
    page = pagination.page,
    limit = pagination.limit,
    search: searchParam = search,
  } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data =
        tipo === TIPOS_ASISTENCIA.CLIENTE
          ? await obtenerAsistenciasClientes({
              query: {
                page,
                limit,
                ...(searchParam ? { search: searchParam } : {}),
              },
            })
          : await obtenerAsistenciasEmpleados({
              query: {
                page,
                limit,
                ...(searchParam ? { search: searchParam } : {}),
              },
            });
      const {
        items,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(data, {
        preferredKeys: ["asistencias", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });
      setAsistencias(normalizeAsistencias(items, tipo));
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (err) {
      console.error("Error al cargar asistencias:", err);
      setAsistencias([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page, search, tipo]);

  useEffect(() => {
    fetchAsistencias({ page: pagination.page, limit: pagination.limit, search });
  }, [fetchAsistencias, pagination.limit, pagination.page, search]);

  useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      page: 1,
      totalPages: 1,
      totalItems: 0,
    }));
  }, [tipo]);

  const crearAsistencia = useCallback(
    async (payload) => {
      const response =
        tipo === TIPOS_ASISTENCIA.CLIENTE
          ? await crearAsistenciaCliente(payload)
          : await crearAsistenciaEmpleado(payload);
      await fetchAsistencias({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });
      return response;
    },
    [fetchAsistencias, pagination.limit, pagination.page, search, tipo]
  );

  const actualizarAsistencia = useCallback(
    async (id, payload) => {
      const response =
        tipo === TIPOS_ASISTENCIA.CLIENTE
          ? await actualizarAsistenciaCliente(id, payload)
          : await actualizarAsistenciaEmpleado(id, payload);
      await fetchAsistencias({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });
      return response;
    },
    [fetchAsistencias, pagination.limit, pagination.page, search, tipo]
  );

  const eliminarAsistencia = useCallback(
    async (id) => {
      const response =
        tipo === TIPOS_ASISTENCIA.CLIENTE
          ? await eliminarAsistenciaCliente(id)
          : await eliminarAsistenciaEmpleado(id);
      setPagination((prev) => ({ ...prev, page: 1 }));
      await fetchAsistencias({
        page: 1,
        limit: pagination.limit,
        search,
      });
      return response;
    },
    [fetchAsistencias, pagination.limit, pagination.page, search, tipo]
  );

  return useMemo(
    () => ({
      asistencias,
      loading,
      error,
      pagination,
      setPagination,
      recargar: fetchAsistencias,
      crearAsistencia,
      actualizarAsistencia,
      eliminarAsistencia,
      tipo,
    }),
    [
      asistencias,
      loading,
      error,
      pagination,
      fetchAsistencias,
      crearAsistencia,
      actualizarAsistencia,
      eliminarAsistencia,
      tipo,
    ]
  );
};

export default useAsistencias;
