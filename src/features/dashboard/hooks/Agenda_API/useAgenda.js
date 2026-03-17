// src/features/dashboard/hooks/Agenda_API/useAgenda.js
import { useState, useCallback, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { getCurrentUser } from "../Acceder_API/authService";

import {
  getAgenda as apiGetAgenda,
  createAgenda as apiCreateAgenda,
  updateAgenda as apiUpdateAgenda,
  deleteAgenda as apiDeleteAgenda,
} from "./Agenda_API";

/**
 * Hook personalizado para manejar la lógica CRUD de Agenda.
 * Optimizado para evitar llamadas duplicadas.
 * @param {boolean} filterByCurrentUser - Si es true, filtra las citas para mostrar solo las del usuario actual
 */
export const useAgenda = (filterByCurrentUser = false) => {
  const [agenda, setAgenda] = useState([]);
  const [filteredAgenda, setFilteredAgenda] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Ref para controlar si ya hay una llamada en progreso
  const loadingRef = useRef(false);

  const normalizeId = useCallback((value) => {
    if (value === "" || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }, []);

  const getUsuarioId = useCallback(
    (usuario) => normalizeId(usuario?.id_usuario ?? usuario?.id),
    [normalizeId],
  );

  const getClienteIdFromCita = useCallback(
    (cita) =>
      normalizeId(
        cita?.id_cliente_usuario?.id_usuario ??
          cita?.id_cliente_usuario?.id ??
          cita?.id_cliente,
      ),
    [normalizeId],
  );

  // Obtener el usuario actual al cargar el hook (y cuando cambie la sesión)
  useEffect(() => {
    const syncCurrentUser = () => setCurrentUser(getCurrentUser());

    syncCurrentUser();

    if (typeof window === "undefined") return;
    window.addEventListener("auth-change", syncCurrentUser);
    return () => window.removeEventListener("auth-change", syncCurrentUser);
  }, []);

  // Filtrar citas por usuario actual cuando cambie el usuario o la agenda
  useEffect(() => {
    if (!filterByCurrentUser) {
      setFilteredAgenda(agenda);
      return;
    }

    const currentUserId = getUsuarioId(currentUser);
    if (!currentUserId) {
      setFilteredAgenda([]);
      return;
    }

    const userAgenda = agenda.filter(
      (cita) => getClienteIdFromCita(cita) === currentUserId,
    );
    setFilteredAgenda(userAgenda);
  }, [
    agenda,
    currentUser,
    filterByCurrentUser,
    getUsuarioId,
    getClienteIdFromCita,
  ]);

  // Cargar agenda desde la API (con protección contra llamadas duplicadas)
  const cargarAgenda = useCallback(async () => {
    if (loadingRef.current) return;

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      const data = await apiGetAgenda({
        onlyMine: filterByCurrentUser ? true : undefined,
      });

      const agendaData = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.agenda)
            ? data.agenda
            : Array.isArray(data?.results)
              ? data.results
              : [];

      setAgenda(Array.isArray(agendaData) ? agendaData : []);
    } catch (err) {
      const rawMessage = err?.message || "Error desconocido";
      const mensajeError = rawMessage.includes("HTML en lugar de JSON")
        ? "Error en la API - Verifica que el servidor esté funcionando"
        : rawMessage;

      const wrappedError = new Error(mensajeError);
      if (err?.response) wrappedError.response = err.response;

      setError(wrappedError);
      setAgenda([]);
      toast.error(wrappedError, "Error al cargar la agenda");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [filterByCurrentUser]);

  // Crear registro en agenda
  const crearAgenda = useCallback(
    async (nuevoRegistro) => {
      try {
        setLoading(true);
        setError(null);

        const { id_agenda: _id_agenda, id: _id, ...body } = nuevoRegistro || {};
        const resultado = await apiCreateAgenda(body);
        toast.success("Cita creada exitosamente");
        await cargarAgenda();
        return resultado;
      } catch (err) {
        const mensaje = err?.message || "Error al crear cita";
        const wrappedError = err instanceof Error ? err : new Error(mensaje);
        setError(wrappedError);
        toast.error(wrappedError, "Error al crear cita");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cargarAgenda],
  );

  // Actualizar registro en agenda
  const actualizarAgenda = useCallback(
    async (idOrRegistro, maybeRegistroActualizado) => {
      try {
        setLoading(true);
        setError(null);

        const registroActualizado =
          maybeRegistroActualizado ??
          (typeof idOrRegistro === "object" && idOrRegistro !== null
            ? idOrRegistro
            : {});

        const agendaId =
          typeof idOrRegistro === "number" ||
          (typeof idOrRegistro === "string" && idOrRegistro.trim() !== "")
            ? idOrRegistro
            : registroActualizado?.id_agenda ?? registroActualizado?.id;

        if (!agendaId) {
          throw new Error("ID de agenda no proporcionado");
        }

        const { id_agenda: _id_agenda, id: _id, ...body } = registroActualizado || {};
        const resultado = await apiUpdateAgenda(agendaId, body);
        toast.success("Cita actualizada exitosamente");
        await cargarAgenda();
        return resultado;
      } catch (err) {
        const mensaje = err?.message || "Error al actualizar cita";
        const wrappedError = err instanceof Error ? err : new Error(mensaje);
        setError(wrappedError);
        toast.error(wrappedError, "Error al actualizar cita");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cargarAgenda],
  );

  // Eliminar registro de agenda
  const eliminarAgenda = useCallback(
    async (idOrRegistro) => {
      try {
        setLoading(true);
        setError(null);

        const agendaId =
          typeof idOrRegistro === "object" && idOrRegistro !== null
            ? idOrRegistro.id_agenda ?? idOrRegistro.id
            : idOrRegistro;

        if (!agendaId) {
          throw new Error("ID de agenda no proporcionado");
        }

        await apiDeleteAgenda(agendaId);
        toast.success("Cita eliminada exitosamente");
        await cargarAgenda();
      } catch (err) {
        const mensaje =
          err?.response?.data?.message ||
          err?.message ||
          "Error desconocido al eliminar cita";

        setError(err instanceof Error ? err : new Error(mensaje));

        if (mensaje.includes("en uso") || mensaje.includes("dependencia")) {
          toast.error(`No se puede eliminar: ${mensaje}`);
        } else {
          toast.error(err, "Error al eliminar cita");
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [cargarAgenda],
  );

  return {
    agenda: filterByCurrentUser ? filteredAgenda : agenda,
    loading,
    error,
    currentUser,
    cargarAgenda,
    crearAgenda,
    actualizarAgenda,
    eliminarAgenda,
  };
};
