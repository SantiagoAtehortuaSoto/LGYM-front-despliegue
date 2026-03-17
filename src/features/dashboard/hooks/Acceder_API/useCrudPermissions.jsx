import { useSyncExternalStore } from "react";
import {
  canPerformActionForPath,
  resolvePermisoIdFromPath,
} from "./authService";

const EMPTY_PERMISSIONS = {
  permisoId: null,
  canView: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
};

const permissionsSnapshotCache = new Map();

const readPermissionsSnapshot = (pathname) => {
  const path =
    pathname || (typeof window !== "undefined" ? window.location.pathname : "");

  if (!path) return EMPTY_PERMISSIONS;

  const nextSnapshot = {
    permisoId: resolvePermisoIdFromPath(path),
    canView: canPerformActionForPath("ver", path),
    canCreate: canPerformActionForPath("crear", path),
    canEdit: canPerformActionForPath("editar", path),
    canDelete: canPerformActionForPath("eliminar", path),
  };

  const cachedSnapshot = permissionsSnapshotCache.get(path);
  if (
    cachedSnapshot &&
    cachedSnapshot.permisoId === nextSnapshot.permisoId &&
    cachedSnapshot.canView === nextSnapshot.canView &&
    cachedSnapshot.canCreate === nextSnapshot.canCreate &&
    cachedSnapshot.canEdit === nextSnapshot.canEdit &&
    cachedSnapshot.canDelete === nextSnapshot.canDelete
  ) {
    return cachedSnapshot;
  }

  permissionsSnapshotCache.set(path, nextSnapshot);
  return nextSnapshot;
};

const subscribeToPermissions = (callback) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const notify = () => callback();
  const onStorage = (event) => {
    if (!event || event.key === "user" || event.key === "token") {
      callback();
    }
  };

  window.addEventListener("auth-change", notify);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener("auth-change", notify);
    window.removeEventListener("storage", onStorage);
  };
};

export default function useCrudPermissions(pathname) {
  return useSyncExternalStore(
    subscribeToPermissions,
    () => readPermissionsSnapshot(pathname),
    () => EMPTY_PERMISSIONS
  );
}
