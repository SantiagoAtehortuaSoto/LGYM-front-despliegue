import { useEffect, useMemo, useState } from "react";
import {
  getCurrentUser,
  getToken,
  validateToken,
  logout as authLogout,
  refreshCurrentUserPermissions,
  getPermissionsSyncIntervalMs,
} from "../hooks/Acceder_API/authService";

export default function useAuth() {
  const [token, setToken] = useState(() => getToken());
  const [user, setUser]   = useState(() => getCurrentUser());

  const isLoggedIn = useMemo(() => validateToken(token).valid, [token]);

  useEffect(() => {
    const onAuthChange = () => {
      setToken(getToken());
      setUser(getCurrentUser());
    };
    window.addEventListener("auth-change", onAuthChange);
    return () => window.removeEventListener("auth-change", onAuthChange);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    let cancelled = false;

    const syncPermissions = async (force = false) => {
      if (cancelled) return;
      await refreshCurrentUserPermissions({ force });
    };

    void syncPermissions(true);

    const onFocus = () => {
      void syncPermissions(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncPermissions(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const intervalId = window.setInterval(() => {
      void syncPermissions(false);
    }, getPermissionsSyncIntervalMs());

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [isLoggedIn, token]);

  const logout = () => {
    authLogout();
    // El event ya lo dispara logout(), pero por si acaso:
    setToken(null);
    setUser(null);
  };

  return { isLoggedIn, user, token, logout };
}
