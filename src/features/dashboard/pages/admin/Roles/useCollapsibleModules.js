// useCollapsibleModules.js
import { useCallback, useState, useEffect, useMemo } from "react";

/**
 * Hook para manejar módulos colapsables.
 *
 * @param {Array} modulos Array de objetos con { categoria, modulos }
 * @param {boolean} initialCollapsed true -> inicialmente colapsado, false -> inicialmente expandido
 */
export const useCollapsibleModules = (
  modulos = [],
  initialCollapsed = true,
) => {
  // Creamos una clave por categoría basada en modulos
  const categorias = useMemo(() => modulos.map((m) => m.categoria), [modulos]);

  // Estado inicial derivado de las categorías actuales
  const buildInitialState = useCallback(() => {
    const state = {};
    categorias.forEach((cat) => {
      state[cat] = initialCollapsed;
    });
    return state;
  }, [categorias, initialCollapsed]);

  const [collapsedModules, setCollapsedModules] = useState(buildInitialState);

  // Si cambia la lista de módulos (categorías), sincronizamos el estado:
  // - conservamos categorías existentes
  // - añadimos nuevas con el valor inicial
  // - eliminamos las que ya no existen
  useEffect(() => {
    setCollapsedModules((prev) => {
      const next = {};
      categorias.forEach((cat) => {
        next[cat] = prev.hasOwnProperty(cat) ? prev[cat] : initialCollapsed;
      });
      return next;
    });
  }, [categorias, initialCollapsed]);

  const toggleModule = useCallback((categoria) => {
    setCollapsedModules((prev) => ({
      ...prev,
      [categoria]: !prev[categoria],
    }));
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedModules((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => (next[k] = false));
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedModules((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => (next[k] = true));
      return next;
    });
  }, []);

  // toggleAll usa el estado actual para decidir acción
  const toggleAll = useCallback(() => {
    setCollapsedModules((prev) => {
      const allCollapsed = Object.values(prev).every(Boolean);
      const next = {};
      Object.keys(prev).forEach(
        (k) => (next[k] = !allCollapsed ? true : false),
      );
      return next;
    });
  }, []);

  const isAllCollapsed = useCallback(() => {
    return Object.values(collapsedModules).length === 0
      ? initialCollapsed
      : Object.values(collapsedModules).every(Boolean);
  }, [collapsedModules, initialCollapsed]);

  const isAllExpanded = useCallback(() => {
    return Object.values(collapsedModules).length === 0
      ? !initialCollapsed
      : Object.values(collapsedModules).every((v) => !v);
  }, [collapsedModules, initialCollapsed]);

  return {
    collapsedModules,
    toggleModule,
    expandAll,
    collapseAll,
    toggleAll,
    isAllCollapsed,
    isAllExpanded,
  };
};