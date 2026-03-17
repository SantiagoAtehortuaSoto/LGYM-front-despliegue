import { API_BASE_URL } from "../apiConfig";
import {
  buildEndpointWithQuery,
  mapPaginatedCollectionResponse,
} from "../../../../shared/utils/pagination";

const API_BASE = API_BASE_URL;

const ENDPOINTS = {
  seguimiento: `${API_BASE}/seguimiento_deportivo`,
  maestro: `${API_BASE}/maestro_parametros`,
  relacion: `${API_BASE}/relacion_seguimiento_caracteristica`,
  detalle: `${API_BASE}/detalle_seguimiento`,
  caracteristicas: `${API_BASE}/caracteristicas`,
};
const SEGUIMIENTO_LOG_PREFIX = "[Seguimiento API]";

const parseJSON = async (response) => {
  const text = await response.text();
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Error parsing JSON: ${error.message}. Response text: ${text}`);
  }
};

const extractArrayPayload = (payload, preferredKeys = []) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const keys = [
    ...preferredKeys,
    "data",
    "items",
    "results",
    "rows",
    "list",
    "records",
  ];

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }

  for (const key of keys) {
    const candidate = payload?.[key];
    if (!candidate || typeof candidate !== "object") continue;
    if (Array.isArray(candidate.data)) return candidate.data;
    if (Array.isArray(candidate.items)) return candidate.items;
    if (Array.isArray(candidate.results)) return candidate.results;
    if (Array.isArray(candidate.rows)) return candidate.rows;
    if (Array.isArray(candidate.list)) return candidate.list;
    if (Array.isArray(candidate.records)) return candidate.records;
  }

  return [];
};

const getHeaders = (extra = {}) => {
  const token = localStorage.getItem("token");
  const headers = {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...extra,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const hasMeaningfulValue = (value) =>
  value !== null &&
  value !== undefined &&
  (typeof value !== "string" || value.trim() !== "");

const pickFirstMeaningful = (...values) => {
  for (const value of values) {
    if (hasMeaningfulValue(value)) return value;
  }
  return null;
};

const resolveObservaciones = (payload = {}) => {
  if (Object.prototype.hasOwnProperty.call(payload, "observaciones")) {
    return payload.observaciones;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "observacion")) {
    return payload.observacion;
  }
  return undefined;
};

const mapDetalleApiToFront = (detalle = {}) => {
  const relacion =
    (detalle?.relacion_seguimiento &&
    typeof detalle.relacion_seguimiento === "object"
      ? detalle.relacion_seguimiento
      : null) ||
    (detalle?.id_relacion_seguimiento_relacion_seguimiento_caracteristica &&
    typeof detalle.id_relacion_seguimiento_relacion_seguimiento_caracteristica ===
      "object"
      ? detalle.id_relacion_seguimiento_relacion_seguimiento_caracteristica
      : null) ||
    null;

  const observaciones = pickFirstMeaningful(
    detalle.observaciones,
    detalle.observacion,
    detalle.comentario,
    detalle.comentarios,
    detalle.nota,
    detalle.notas,
    detalle.observaciones_detalle,
    detalle.observacion_detalle,
    relacion?.observaciones,
    relacion?.observacion,
    relacion?.comentario,
    relacion?.comentarios,
    relacion?.nota,
    relacion?.notas,
  );

  return {
    id_detalle: detalle.id_detalle ?? detalle.id_detalle_s ?? detalle.id ?? null,
    id_maestro_p:
      detalle.id_maestro_p ??
      detalle.id_parametros_s ??
      detalle.id_maestro ??
      detalle.id_parametro ??
      detalle.id_maestro_parametro ??
      detalle.id_maestro_parametros ??
      relacion?.id_maestro_p ??
      relacion?.id_parametros_s ??
      relacion?.maestro_parametros?.id_maestro_p ??
      null,
    id_relacion_seguimiento:
      detalle.id_relacion_seguimiento ??
      detalle.id_relacion ??
      detalle.relacion_id ??
      relacion?.id_relacion_seguimiento ??
      relacion?.id_relacion_seguimien ??
      null,
    parametro:
      pickFirstMeaningful(
        detalle.parametro,
        detalle.nombre_parametro,
        detalle.parametro_s,
        detalle.parametro_nombre,
        relacion?.id_maestro_p_maestro_,
        relacion?.maestro_parametro,
        relacion?.maestro,
        relacion?.maestro_parametros?.parametro,
      ) || "",
    id_caracteristica:
      detalle.id_caracteristica ??
      detalle.caracteristica_id ??
      detalle.id_caracteristicas ??
      relacion?.id_caracteristica ??
      relacion?.id_caracteristicas ??
      relacion?.caracteristica?.id_caracteristica ??
      relacion?.caracteristica?.id_caracteristicas ??
      null,
    propiedad:
      pickFirstMeaningful(
        detalle.propiedad,
        detalle.nombre_caracteristica,
        detalle.caracteristica,
        detalle.nombre_caracteristica_s,
        relacion?.id_caracteristica_car,
        relacion?.caracteristica,
        relacion?.caracteristica?.nombre_caracteristica,
      ) || "",
    nombre_caracteristica:
      pickFirstMeaningful(
        detalle.propiedad,
        detalle.nombre_caracteristica,
        detalle.caracteristica,
        detalle.propiedad,
        detalle.nombre_caracteristica_s,
        relacion?.id_caracteristica_car,
        relacion?.caracteristica,
        relacion?.caracteristica?.nombre_caracteristica,
      ) || "",
    valor_numerico:
      detalle.valor_numerico ??
      detalle.valor ??
      detalle.valor_medido ??
      relacion?.valor ??
      relacion?.valor_numerico ??
      relacion?.valor_medido ??
      null,
    observaciones: observaciones || "",
  };
};

const mapSeguimientoApiToFront = (item = {}) => {
  const usuarioRelacionado =
    (item?.id_usuario_usuario && typeof item.id_usuario_usuario === "object"
      ? item.id_usuario_usuario
      : null) ||
    (item?.usuario && typeof item.usuario === "object"
      ? item.usuario
      : null) ||
    (item?.usuario_data && typeof item.usuario_data === "object"
      ? item.usuario_data
      : null) ||
    null;

  const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    return [];
  };

  const detalles = [
    ...toArray(item.detalles),
    ...toArray(item.detalle_seguimientos),
    ...toArray(item.detalle_seguimiento),
    ...toArray(item.detalle),
  ]
    .filter((det, idx, arr) => {
      const key = det.id_detalle ?? det.id_detalle_s ?? det.id;
      if (key === undefined || key === null) return true;
      return (
        arr.findIndex(
          (d) => (d.id_detalle ?? d.id_detalle_s ?? d.id) === key,
        ) === idx
      );
    })
    .map(mapDetalleApiToFront);

  const observacionesDetalle =
    detalles.find((detalle) => (detalle.observaciones || "").trim())?.observaciones ??
    "";

  const idUsuarioResolved = (() => {
    const raw =
      item?.id_usuario ??
      item?.usuario_id ??
      item?.idUsuario ??
      usuarioRelacionado?.id_usuario ??
      usuarioRelacionado?.id ??
      null;

    if (raw && typeof raw === "object") {
      return (
        raw?.id_usuario ??
        raw?.id ??
        raw?.usuario_id ??
        null
      );
    }

    return raw;
  })();

  return {
    id: item.id_seguimiento ?? item.id ?? null,
    id_usuario: idUsuarioResolved,
    deporte: item.deporte ?? null,
    actividad: item.actividad ?? null,
    observaciones:
      pickFirstMeaningful(
        item.observaciones,
        item.observacion,
        item.comentario,
        item.comentarios,
        item.nota,
        item.notas,
        item.observaciones_seguimiento,
        item.observacion_seguimiento,
        observacionesDetalle,
      ) || "",
    fecha_registro: item.fecha_registro,
    nombre_usuario:
      usuarioRelacionado?.nombre_usuario ??
      usuarioRelacionado?.nombre ??
      item.nombre_usuario ??
      item.nombre ??
      null,
    apellido_usuario:
      usuarioRelacionado?.apellido_usuario ??
      usuarioRelacionado?.apellido ??
      item.apellido_usuario ??
      item.apellido ??
      null,
    email:
      usuarioRelacionado?.email ??
      usuarioRelacionado?.correo ??
      usuarioRelacionado?.correo_electronico ??
      item.email ??
      item.correo ??
      item.correo_electronico ??
      null,
    telefono:
      usuarioRelacionado?.telefono ??
      usuarioRelacionado?.celular ??
      usuarioRelacionado?.phone ??
      item.telefono ??
      item.celular ??
      item.phone ??
      null,
    genero:
      usuarioRelacionado?.genero ??
      usuarioRelacionado?.sexo ??
      usuarioRelacionado?.gender ??
      item.genero ??
      item.sexo ??
      item.gender ??
      null,
    fecha_nacimiento:
      usuarioRelacionado?.fecha_nacimiento ??
      usuarioRelacionado?.fechaNacimiento ??
      usuarioRelacionado?.nacimiento ??
      item.fecha_nacimiento ??
      item.fechaNacimiento ??
      item.nacimiento ??
      null,
    id_usuario_usuario: usuarioRelacionado ?? null,
    id_estado: (() => {
      const raw =
        item.id_estado ??
        item.estado ??
        item.id_estados ??
        item.estado_seguimiento ??
        null;
      if (raw === 2 || raw === "2" || raw === "INACTIVO" || raw === "Inactivo") return 2;
      return 1;
    })(),
    estado: (() => {
      const raw =
        item.id_estado ??
        item.estado ??
        item.id_estados ??
        item.estado_seguimiento ??
        null;
      if (raw === 2 || raw === "2" || raw === "INACTIVO" || raw === "Inactivo") return "INACTIVO";
      return "ACTIVO";
    })(),
    detalles,
  };
};

const replaceSeguimientosCollectionItems = (payload, nextItems) => {
  if (Array.isArray(payload)) return nextItems;
  if (!payload || typeof payload !== "object") return nextItems;

  if (Array.isArray(payload?.seguimientos)) {
    return { ...payload, seguimientos: nextItems };
  }

  if (Array.isArray(payload?.data)) {
    return { ...payload, data: nextItems };
  }

  if (payload?.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data?.seguimientos)) {
      return {
        ...payload,
        data: { ...payload.data, seguimientos: nextItems },
      };
    }
    if (Array.isArray(payload.data?.data)) {
      return {
        ...payload,
        data: { ...payload.data, data: nextItems },
      };
    }
    if (Array.isArray(payload.data?.items)) {
      return {
        ...payload,
        data: { ...payload.data, items: nextItems },
      };
    }
  }

  return { ...payload, data: nextItems };
};

const hydrateObservacionesFromSeguimientoById = async (items = []) => {
  const lista = Array.isArray(items) ? items : [];
  const pendientes = lista.filter(
    (item) =>
      item &&
      item.id !== null &&
      item.id !== undefined &&
      item.id !== "" &&
      !hasMeaningfulValue(item.observaciones)
  );

  if (!pendientes.length) return lista;

  const byId = new Map();

  await Promise.all(
    pendientes.map(async (item) => {
      const idSeguimiento = item.id;
      try {
        const response = await fetch(`${ENDPOINTS.seguimiento}/${idSeguimiento}`, {
          headers: getHeaders(),
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = await parseJSON(response);
        const record = Array.isArray(data) ? data[0] : data;
        const mapped = mapSeguimientoApiToFront(record);
        if (hasMeaningfulValue(mapped?.observaciones)) {
          byId.set(String(idSeguimiento), mapped.observaciones);
        }
      } catch (error) {
        console.warn(
          `${SEGUIMIENTO_LOG_PREFIX} No se pudieron hidratar observaciones por id`,
          { idSeguimiento, error: error?.message || error }
        );
      }
    })
  );

  if (!byId.size) return lista;

  return lista.map((item) => {
    const observacionesHidratadas = byId.get(String(item.id));
    if (!hasMeaningfulValue(observacionesHidratadas)) return item;
    return {
      ...item,
      observaciones: observacionesHidratadas,
    };
  });
};

export async function getSeguimientos(options = {}) {
  const query =
    options?.query && typeof options.query === "object" ? options.query : {};
  const preserveResponseShape = Object.keys(query).length > 0;

  try {
    const response = await fetch(buildEndpointWithQuery(ENDPOINTS.seguimiento, query), {
      headers: getHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`${SEGUIMIENTO_LOG_PREFIX} GET error`, {
        status: response.status,
        statusText: response.statusText,
        endpoint: ENDPOINTS.seguimiento,
        query,
      });
      throw new Error("Error al obtener seguimientos");
    }
    const data = await parseJSON(response);
    if (!preserveResponseShape) {
      if (!Array.isArray(data)) return [];
      const mappedItems = data.map(mapSeguimientoApiToFront);
      return await hydrateObservacionesFromSeguimientoById(mappedItems);
    }
    const mappedResponse = mapPaginatedCollectionResponse(data, mapSeguimientoApiToFront, {
      preferredKeys: ["seguimientos", "data"],
      preserveResponseShape: true,
    });
    const mappedItems = extractArrayPayload(mappedResponse, ["seguimientos", "data"]);
    const hydratedItems = await hydrateObservacionesFromSeguimientoById(mappedItems);
    return replaceSeguimientosCollectionItems(mappedResponse, hydratedItems);
  } catch (error) {
    console.error(`${SEGUIMIENTO_LOG_PREFIX} getSeguimientos error:`, error);
    return preserveResponseShape ? { data: [] } : [];
  }
}

export async function getCaracteristicas() {
  try {
    const response = await fetch(ENDPOINTS.caracteristicas, {
      headers: getHeaders(),
    });
    if (response.ok) {
      const data = await parseJSON(response);
      const listaCaracteristicas = extractArrayPayload(data, ["caracteristicas"]);
      if (listaCaracteristicas.length) {
        return listaCaracteristicas
          .map((c) => ({
            id: c.id_caracteristicas ?? c.id ?? c.id_caracteristica ?? null,
            nombre:
              c.nombre_caracteristica ??
              c.nombre ??
              c.caracteristica ??
              c.propiedad ??
              "",
          }))
          .filter((c) => c.id && c.nombre);
      }
    }
    const respRelacion = await fetch(ENDPOINTS.relacion, {
      headers: getHeaders(),
    });
    if (!respRelacion.ok) return [];
    const dataRelacion = await parseJSON(respRelacion);
    const listaRelaciones = extractArrayPayload(dataRelacion, ["relaciones"]);
    if (!listaRelaciones.length) return [];
    const setIds = new Set();
    const lista = [];
    listaRelaciones.forEach((r) => {
      const id =
        r.id_caracteristica ??
        r.id_caracteristicas ??
        (r.caracteristica &&
          (r.caracteristica.id_caracteristicas ||
            r.caracteristica.id_caracteristica ||
            r.caracteristica.id)) ??
        null;
      if (id && !setIds.has(id)) {
        setIds.add(id);
        const nombre =
          (r.caracteristica &&
            (r.caracteristica.nombre_caracteristica ||
              r.caracteristica.nombre ||
              r.caracteristica.propiedad)) ||
          `Característica ${id}`;
        lista.push({ id, nombre });
      }
    });
    return lista;
  } catch (error) {
    console.error("getCaracteristicas error:", error);
    return [];
  }
}

export async function getMaestroParametros() {
  try {
    const response = await fetch(ENDPOINTS.maestro, {
      headers: getHeaders(),
    });
    if (!response.ok) return [];
    const data = await parseJSON(response);
    if (!Array.isArray(data)) return [];
    return data
      .map((m) => ({
        id:
          m.id_maestro_p ??
          m.id_maestro ??
          m.id_parametro ??
          m.id ??
          null,
        nombre:
          m.parametro ??
          m.nombre_parametro ??
          m.nombre ??
          m.maestro_parametro ??
          m.descripcion ??
          "",
      }))
      .filter((m) => m.id && m.nombre);
  } catch (error) {
    console.error("getMaestroParametros error:", error);
    return [];
  }
}

export async function getRelacionesSeguimiento() {
  try {
    const response = await fetch(ENDPOINTS.relacion, {
      headers: getHeaders(),
    });
    if (!response.ok) return [];
    const data = await parseJSON(response);
    const listaRelaciones = extractArrayPayload(data, ["relaciones"]);
    return listaRelaciones
      .map((r) => ({
        id_relacion:
          r.id_relacion_seguimiento ??
          r.id_relacion ??
          r.id ??
          null,
        id_maestro_p:
          r.id_maestro_p ??
          r.id_maestro ??
          r.id_parametro ??
          r.id_maestro_parametro ??
          r.id_maestro_parametros ??
          null,
        id_caracteristica:
          r.id_caracteristica ??
          r.id_caracteristicas ??
          r.caracteristica_id ??
          null,
        parametro:
          r.parametro ??
          r.nombre_parametro ??
          r.maestro_parametro ??
          r.maestro ??
          r?.maestro_parametros?.parametro ??
          "",
        nombre_caracteristica:
          r.nombre_caracteristica ??
          r.caracteristica ??
          r?.caracteristica?.nombre_caracteristica ??
          r?.caracteristica?.nombre ??
          "",
        valor:
          r.valor ??
          r.valor_numerico ??
          r.valor_medido ??
          null,
      }))
      .filter((r) => r.id_relacion);
  } catch (error) {
    console.error("getRelacionesSeguimiento error:", error);
    return [];
  }
}

const normalizarDetallePayload = (detalle = {}, observacionesFallback) => {
  const valorRaw =
    detalle.valor ??
    detalle.valor_numerico ??
    detalle.valor_medido ??
    undefined;
  const valor = valorRaw === "" ? null : valorRaw;
  const observacionesRaw =
    detalle.observaciones ??
    detalle.observacion ??
    observacionesFallback ??
    undefined;
  const hasObservacionesInput =
    observacionesRaw !== undefined && observacionesRaw !== null;
  const observaciones =
    typeof observacionesRaw === "string"
      ? observacionesRaw.trim()
      : observacionesRaw;

  const payload = {};
  const toNumberIfPossible = (value) => {
    if (value === null || value === undefined || value === "") return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  };
  const parametro =
    detalle.parametro ??
    detalle.nombre_parametro ??
    detalle.parametro_nombre ??
    undefined;
  const nombreCaracteristica =
    detalle.nombre_caracteristica ??
    detalle.propiedad ??
    detalle.caracteristica ??
    undefined;

  if (detalle.id_maestro_p !== undefined && detalle.id_maestro_p !== null) {
    payload.id_maestro_p = toNumberIfPossible(detalle.id_maestro_p);
  }
  if (
    detalle.id_caracteristica !== undefined &&
    detalle.id_caracteristica !== null
  ) {
    payload.id_caracteristica = toNumberIfPossible(detalle.id_caracteristica);
  }
  if (detalle.id_detalle !== undefined && detalle.id_detalle !== null) {
    payload.id_detalle = toNumberIfPossible(detalle.id_detalle);
  }
  if (
    detalle.id_relacion_seguimiento !== undefined &&
    detalle.id_relacion_seguimiento !== null
  ) {
    payload.id_relacion_seguimiento = toNumberIfPossible(
      detalle.id_relacion_seguimiento
    );
  }
  if (detalle.id_relacion !== undefined && detalle.id_relacion !== null) {
    payload.id_relacion = toNumberIfPossible(detalle.id_relacion);
  }
  if (detalle.relacion_id !== undefined && detalle.relacion_id !== null) {
    payload.relacion_id = toNumberIfPossible(detalle.relacion_id);
  }
  if (parametro) {
    payload.parametro = parametro;
  }
  if (nombreCaracteristica) {
    payload.nombre_caracteristica = nombreCaracteristica;
    payload.propiedad = nombreCaracteristica;
  }
  if (valor !== undefined) {
    payload.valor = valor;
    payload.valor_numerico = valor;
  }
  if (hasObservacionesInput) {
    payload.observaciones = observaciones ?? "";
    payload.observacion = observaciones ?? "";
    payload.observaciones_detalle = observaciones ?? "";
    payload.observacion_detalle = observaciones ?? "";
  }

  return payload;
};

export async function createSeguimiento(payload) {
  const observacionesFallback = resolveObservaciones(payload);
  const detalles = (payload.detalles || [])
    .map((detalle) =>
      normalizarDetallePayload(detalle, observacionesFallback)
    )
    .filter(
      (d) => {
        const hasValor = d.valor !== undefined && d.valor !== null;
        const hasIds =
          d.id_maestro_p !== undefined &&
          d.id_maestro_p !== null &&
          d.id_caracteristica !== undefined &&
          d.id_caracteristica !== null;
        const hasText = d.parametro && d.nombre_caracteristica;
        return hasValor && (hasIds || hasText);
      }
    );

  const mainBody = {
    id_usuario: payload.id_usuario,
    deporte: payload.deporte || undefined,
    actividad: payload.actividad || undefined,
    observaciones: observacionesFallback || undefined,
    fecha_registro: payload.fecha_registro,
    ...(detalles.length ? { detalles } : {}),
  };

  const response = await fetch(ENDPOINTS.seguimiento, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(mainBody),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`${SEGUIMIENTO_LOG_PREFIX} POST error`, {
      status: response.status,
      statusText: response.statusText,
      endpoint: ENDPOINTS.seguimiento,
      payload: mainBody,
      responseText: text,
    });
    throw new Error(`Error al crear seguimiento: ${text}`);
  }

  const data = await parseJSON(response);
  const normalizado = mapSeguimientoApiToFront(
    Array.isArray(data) ? data[0] : data
  );

  if (normalizado?.id) {
    const observacionesLocal =
      normalizado.observaciones ||
      observacionesFallback ||
      "";
    const detallesConObservaciones = (
      Array.isArray(normalizado.detalles) && normalizado.detalles.length
        ? normalizado.detalles
        : detalles
    ).map((detalle) => ({
      ...detalle,
      observaciones:
        detalle.observaciones ||
        observacionesFallback ||
        "",
    }));

    if (
      Array.isArray(payload.detalles) &&
      payload.detalles.length &&
      (!Array.isArray(normalizado.detalles) || !normalizado.detalles.length)
    ) {
      return {
        ...normalizado,
        observaciones: observacionesLocal,
        detalles: detallesConObservaciones,
      };
    }
    return {
      ...normalizado,
      observaciones: observacionesLocal,
      detalles: detallesConObservaciones,
    };
  }

  const idSeguimiento = data.id_seguimiento ?? data.id ?? payload.id ?? null;
  if (!idSeguimiento) {
    throw new Error("No se recibio id_seguimiento al crear el registro");
  }

  return {
    ...payload,
    id: idSeguimiento,
    observaciones: observacionesFallback ?? null,
    detalles,
  };
}

export async function updateSeguimiento(id, payload) {
  const observacionesFallback = resolveObservaciones(payload);
  const observacionesFueEnviada = observacionesFallback !== undefined;
  const detalles = (payload.detalles || [])
    .map((detalle) => normalizarDetallePayload(detalle, observacionesFallback))
    .filter((d) => {
      const hasValor = d.valor !== undefined && d.valor !== null;
      const hasIds =
        d.id_maestro_p !== undefined &&
        d.id_maestro_p !== null &&
        d.id_caracteristica !== undefined &&
        d.id_caracteristica !== null;
      const hasText = d.parametro && d.nombre_caracteristica;
      return hasValor && (hasIds || hasText);
    });

  const idUsuarioNum = Number(payload.id_usuario);
  const idSeguimientoNum = Number(id);
  const mainBody = {
    id_seguimiento: Number.isFinite(idSeguimientoNum) ? idSeguimientoNum : id,
    id: Number.isFinite(idSeguimientoNum) ? idSeguimientoNum : id,
    id_usuario: Number.isFinite(idUsuarioNum) ? idUsuarioNum : payload.id_usuario,
    deporte: payload.deporte || undefined,
    actividad: payload.actividad || undefined,
    ...(observacionesFueEnviada
      ? {
          observaciones: observacionesFallback,
          observacion: observacionesFallback,
          observaciones_seguimiento: observacionesFallback,
          observacion_seguimiento: observacionesFallback,
          comentario: observacionesFallback,
          comentarios: observacionesFallback,
        }
      : {}),
    fecha_registro: payload.fecha_registro,
    ...(detalles.length
      ? {
          detalles,
          detalle_seguimiento: detalles,
          detalle_seguimientos: detalles,
        }
      : {}),
  };

  const body = JSON.stringify(mainBody);

  const tryUpdate = async (method, url, rawBody = body) => {
    const response = await fetch(url, {
      method,
      headers: getHeaders({ "Content-Type": "application/json" }),
      body: rawBody,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`${SEGUIMIENTO_LOG_PREFIX} ${method} error`, {
        status: response.status,
        statusText: response.statusText,
        url,
        payload: mainBody,
        responseText: text,
      });
      return { ok: false, error: `${method} ${url} -> ${response.status} ${text}` };
    }
    const data = await parseJSON(response).catch(() => ({}));
    return { ok: true, data };
  };
  const patchRes = await tryUpdate("PATCH", `${ENDPOINTS.seguimiento}/${id}`);
  const putRes = !patchRes.ok
    ? await tryUpdate("PUT", `${ENDPOINTS.seguimiento}/${id}`)
    : null;

  if (!patchRes.ok && !(putRes && putRes.ok)) {
    throw new Error(
      `No se pudo persistir la actualizacion del seguimiento. Errores API: ${patchRes.error}${
        putRes?.error ? ` | ${putRes.error}` : ""
      }`,
    );
  }

  const data = patchRes.ok ? patchRes.data : putRes?.data;
  const normalizado = mapSeguimientoApiToFront(Array.isArray(data) ? data[0] : data);
  const idNormalizado = Number(id);
  const observacionesNormalizadas =
    typeof observacionesFallback === "string"
      ? observacionesFallback.trim()
      : observacionesFallback;

  return {
    ...normalizado,
    id:
      normalizado?.id ??
      (Number.isFinite(idNormalizado) ? idNormalizado : id),
    id_usuario: payload.id_usuario,
    deporte: payload.deporte ?? normalizado?.deporte ?? null,
    actividad: payload.actividad ?? normalizado?.actividad ?? null,
    observaciones:
      observacionesFallback !== undefined
        ? (observacionesNormalizadas ?? "")
        : (normalizado?.observaciones ?? ""),
    fecha_registro: payload.fecha_registro ?? normalizado?.fecha_registro ?? null,
    detalles: Array.isArray(detalles) && detalles.length
      ? detalles.map((detalle) => ({
          ...detalle,
          observaciones: observacionesFueEnviada
            ? (observacionesFallback ?? "")
            : (detalle.observaciones || ""),
        }))
      : (normalizado?.detalles ?? []),
  };
}

export async function deleteSeguimiento(id) {
  const response = await fetch(`${ENDPOINTS.seguimiento}/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`${SEGUIMIENTO_LOG_PREFIX} DELETE error`, {
      status: response.status,
      statusText: response.statusText,
      endpoint: `${ENDPOINTS.seguimiento}/${id}`,
      responseText: text,
    });
    throw new Error(`Error al eliminar seguimiento: ${text}`);
  }

  return true;
}

export async function updateSeguimientoEstado(id, nuevoEstado = 1) {
  const body = {
    id_estado: nuevoEstado,
    estado: nuevoEstado === 1 ? "ACTIVO" : "INACTIVO",
  };

  const response = await fetch(`${ENDPOINTS.seguimiento}/${id}`, {
    method: "PATCH",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error al actualizar estado de seguimiento: ${text}`);
  }

  const data = await parseJSON(response);
  return {
    id_estado: data.id_estado ?? body.id_estado,
    estado: data.estado ?? body.estado,
  };
}

