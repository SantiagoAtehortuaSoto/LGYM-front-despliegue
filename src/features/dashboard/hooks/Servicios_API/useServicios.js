// src/features/dashboard/hooks/useServicios.js
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  obtenerServicios,
  crearServicio as apiCrearServicio,
  actualizarServicio as apiActualizarServicio,
  eliminarServicio as apiEliminarServicio,
} from "./Servicios_API";
import { DEFAULT_DATA_TABLE_PAGE_SIZE } from "../../components/dataTables/dataTable";
import { normalizePaginatedResponse } from "../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../shared/utils/statusChangeMessages";

/**
 * Hook personalizado para manejar la logica CRUD de servicios.
 */
export const useServicios = (searchValue = "") => {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const search = String(searchValue ?? "").trim();

  const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const getFirstValue = (obj = {}, keys = []) => {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
  };

  const toPrimitive = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "object") return value;
    return getFirstValue(value, [
      "tipo_servicio",
      "tipo",
      "nombre",
      "label",
      "value",
      "duracion",
      "duracion_dias",
      "periodicidad",
    ]);
  };

  const normalizeTipoServicio = (servicio = {}) => {
    const tipoRaw =
      getFirstValue(servicio, [
        "tipo_servicio",
        "tipoServicio",
        "tipo",
        "categoria_servicio",
        "categoria",
      ]) ??
      getFirstValue(servicio.id_tipo_servicio_tipo || {}, [
        "tipo_servicio",
        "tipo",
        "nombre",
      ]);

    const tipoTexto = String(toPrimitive(tipoRaw) || "")
      .trim()
      .toLowerCase();

    if (tipoTexto.includes("acceso")) return "Acceso";
    if (tipoTexto.includes("actividad")) return "Actividad";
    return String(toPrimitive(tipoRaw) || "");
  };

  const normalizeDuracion = (servicio = {}) => {
    const duracionRaw =
      getFirstValue(servicio, [
        "duracion",
        "duracion_dias",
        "duracionDias",
        "tiempo_duracion",
        "tiempoDuracion",
        "periodicidad",
      ]) ??
      getFirstValue(servicio.id_periodicidad_periodicidad || {}, [
        "duracion",
        "duracion_dias",
        "periodicidad",
        "nombre",
        "descripcion",
      ]);

    const primitive = toPrimitive(duracionRaw);
    return toNumberOrNull(primitive) ?? primitive ?? "";
  };

  const normalizeServicio = (servicio = {}) => {
    return {
      ...servicio,
      tipo_servicio: normalizeTipoServicio(servicio),
      duracion: normalizeDuracion(servicio),
      estado:
        Number(servicio.id_estado) === 1
          ? "Activo"
          : Number(servicio.id_estado) === 2
            ? "Inactivo"
            : servicio.estado || "Desconocido",
    };
  };

  // Cargar servicios desde la API
  const cargarServicios = useCallback(async ({
    page = pagination.page,
    limit = pagination.limit,
    search: searchParam = search,
  } = {}) => {
    try {
      setLoading(true);
      setError(null);
      const data = await obtenerServicios({
        query: {
          page,
          limit,
          ...(searchParam ? { search: searchParam } : {}),
        },
      });
      const {
        items: serviciosArray,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(data, {
        preferredKeys: ["servicios", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });

      if (!serviciosArray.length) {
        setServicios([]);
        setError(null);
      } else {
        setServicios(serviciosArray.map((servicio) => normalizeServicio(servicio)));
        setError(null);
      }

      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (error) {
      console.error("Error cargando servicios:", error);
      const mensajeError = error.message.includes("HTML en lugar de JSON")
        ? "Error en la API - Verifica que el servidor este funcionando correctamente"
        : `Error de API: ${error.message}`;
      setError(mensajeError);
      setServicios([]);
      toast.error(mensajeError);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page, search]);

  // Crear servicio
  const crearServicio = async (nuevoServicio) => {
    try {
      await apiCrearServicio(nuevoServicio);
      toast.success("Servicio creado exitosamente");
      await cargarServicios({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });
      return true;
    } catch (error) {
      console.error("Error al crear servicio:", error);
      toast.error(error.message || "Error al crear el servicio");
      return false;
    }
  };

  // Actualizar servicio
  const actualizarServicio = async (servicioActualizado) => {
    try {
      await apiActualizarServicio(
        servicioActualizado.id_servicio,
        servicioActualizado
      );
      toast.success("Servicio actualizado exitosamente");
      await cargarServicios({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });
      return true;
    } catch (error) {
      console.error("Error al actualizar servicio:", error);
      toast.error(error.message || "Error al actualizar el servicio");
      return false;
    }
  };

  // Eliminar servicio
  const eliminarServicio = async (servicio) => {
    try {
      await apiEliminarServicio(servicio.id_servicio);
      toast.success("Servicio eliminado exitosamente");
      setPagination((prev) => ({ ...prev, page: 1 }));
      await cargarServicios({
        page: 1,
        limit: pagination.limit,
        search,
      });
    } catch (error) {
      console.error("Error al eliminar servicio:", error);

      const mensaje =
        error.response?.data?.message ||
        error.message ||
        "Error desconocido al eliminar el servicio";

      if (
        mensaje.includes("associated with a membership") ||
        mensaje.includes(
          "Cannot delete service because it is associated with a membership"
        )
      ) {
        toast.error(
          "No se puede eliminar este servicio porque esta asociado con una o mas membresias."
        );
        return;
      }

      if (mensaje.includes("en uso") || mensaje.includes("dependencia")) {
        toast.error(`No se puede eliminar: ${mensaje}`);
      } else {
        toast.error(`Error al eliminar servicio: ${mensaje}`);
      }
    }
  };

  // Cambiar estado (activar/desactivar)
  const cambiarEstadoServicio = async (id, nuevoEstado) => {
    try {
      setServicios((prev) =>
        prev.map((s) =>
          s.id_servicio === id
            ? {
                ...s,
                id_estado: nuevoEstado,
                estado: nuevoEstado === 1 ? "Activo" : "Inactivo",
              }
            : s
        )
      );
      await apiActualizarServicio(id, { id_estado: nuevoEstado });
      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);
    } catch (error) {
      console.error("Error actualizando estado:", error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      await cargarServicios({
        page: pagination.page,
        limit: pagination.limit,
        search,
      });
    }
  };

  useEffect(() => {
    cargarServicios({ page: pagination.page, limit: pagination.limit, search });
  }, [cargarServicios, pagination.limit, pagination.page]);

  return {
    servicios,
    loading,
    error,
    pagination,
    setPagination,
    cargarServicios,
    crearServicio,
    actualizarServicio,
    eliminarServicio,
    cambiarEstadoServicio,
  };
};
