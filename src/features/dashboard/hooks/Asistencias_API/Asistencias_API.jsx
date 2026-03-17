import { API_BASE_URL } from "../apiConfig";
import {
  buildEndpointWithQuery,
  mapPaginatedCollectionResponse,
} from "../../../../shared/utils/pagination";
const CLIENTES_ENDPOINT = "/asistencia_clientes";
const EMPLEADOS_ENDPOINT = "/asistencia_empleado";

const buildHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const parseResponse = async (res) => {
  const text = await res.text();
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  if (!isJson) return { raw: text };
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("Asistencias_API parse error:", error, text);
    return {};
  }
};

const normalizeList = (data) => {
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const normalizeStoredRole = (raw) => {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();

  if (!value) return "";
  if (/(^|[_\-\s])admin(istrador)?($|[_\-\s])/.test(value)) return "admin";
  if (/(emplead|instructor|staff|entrenador)/.test(value)) return "empleado";
  if (/(usuario|user|cliente|beneficiario|member|miembro)/.test(value)) {
    return "usuario";
  }
  if (value === "1" || value === "99") return "admin";
  if (value === "2") return "empleado";
  if (value === "3" || value === "6" || value === "33") return "usuario";
  return "";
};

const readStoredRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    const candidates = [
      user?.role,
      user?.rol,
      user?.perfil,
      user?.tipo,
      user?.tipo_usuario,
      user?.tipoUsuario,
      ...(Array.isArray(user?.roles_usuarios) ? user.roles_usuarios : []),
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;

      if (typeof candidate === "object") {
        const nestedRole = normalizeStoredRole(
          candidate?.nombre ??
            candidate?.name ??
            candidate?.rol ??
            candidate?.role ??
            candidate?.tipo ??
            candidate?.tipo_usuario ??
            candidate?.id_rol ??
            candidate?.id
        );
        if (nestedRole) return nestedRole;
        continue;
      }

      const normalizedRole = normalizeStoredRole(candidate);
      if (normalizedRole) return normalizedRole;
    }
  } catch {
    return "";
  }

  return "";
};

const isClientLikeRole = () => {
  const normalizedRole = readStoredRole();
  return normalizedRole === "usuario" || normalizedRole === "cliente";
};

const apiRequest = async (endpoint, options = {}) => {
  const opts = {
    method: "GET",
    headers: buildHeaders(),
    ...options,
  };
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, opts);
  const data = await parseResponse(res);

  if (!res.ok) {
    const errors = data?.errors;
    const errorsMsg = Array.isArray(errors)
      ? errors
          .map((item) => item?.msg || item?.message || item?.error)
          .filter(Boolean)
          .join("; ")
      : null;

    const msg =
      errorsMsg ||
      data?.message ||
      data?.msg ||
      data?.error ||
      `Error ${res.status} ${res.statusText}`;

    const error = new Error(msg);
    error.response = { status: res.status, data };
    throw error;
  }
  return data;
};

// Asistencia clientes
export async function obtenerAsistenciasClientes(options = {}) {
  const query =
    options?.query && typeof options.query === "object" ? options.query : {};
  const preserveResponseShape = Object.keys(query).length > 0;
  let data;
  try {
    data = await apiRequest(buildEndpointWithQuery(CLIENTES_ENDPOINT, query), {
      method: "GET",
    });
  } catch (error) {
    const status = Number(error?.response?.status);
    if (status === 403 && isClientLikeRole()) {
      return preserveResponseShape ? { data: [] } : [];
    }
    throw error;
  }
  if (!preserveResponseShape) return normalizeList(data);
  return mapPaginatedCollectionResponse(data, (item) => item, {
    preferredKeys: ["asistencias", "data"],
    preserveResponseShape: true,
  });
}

export async function obtenerAsistenciaCliente(id) {
  if (!id) return null;
  return apiRequest(`${CLIENTES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function crearAsistenciaCliente(payload) {
  return apiRequest(CLIENTES_ENDPOINT, {
    method: "POST",
    body: payload,
  });
}

export async function actualizarAsistenciaCliente(id, payload) {
  if (!id) throw new Error("ID de asistencia de cliente requerido");
  return apiRequest(`${CLIENTES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function eliminarAsistenciaCliente(id) {
  if (!id) throw new Error("ID de asistencia de cliente requerido");
  return apiRequest(`${CLIENTES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// Asistencia empleados
export async function obtenerAsistenciasEmpleados(options = {}) {
  const query =
    options?.query && typeof options.query === "object" ? options.query : {};
  const preserveResponseShape = Object.keys(query).length > 0;
  const data = await apiRequest(buildEndpointWithQuery(EMPLEADOS_ENDPOINT, query), {
    method: "GET",
  });
  if (!preserveResponseShape) return normalizeList(data);
  return mapPaginatedCollectionResponse(data, (item) => item, {
    preferredKeys: ["asistencias", "data"],
    preserveResponseShape: true,
  });
}

export async function obtenerAsistenciaEmpleado(id) {
  if (!id) return null;
  return apiRequest(`${EMPLEADOS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export async function crearAsistenciaEmpleado(payload) {
  return apiRequest(EMPLEADOS_ENDPOINT, {
    method: "POST",
    body: payload,
  });
}

export async function actualizarAsistenciaEmpleado(id, payload) {
  if (!id) throw new Error("ID de asistencia de empleado requerido");
  return apiRequest(`${EMPLEADOS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function eliminarAsistenciaEmpleado(id) {
  if (!id) throw new Error("ID de asistencia de empleado requerido");
  return apiRequest(`${EMPLEADOS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
