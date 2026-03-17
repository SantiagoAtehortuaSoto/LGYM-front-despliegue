// src/auth/guards.jsx
import { Navigate, Outlet } from "react-router-dom";
import {
  getRole,
  getToken,
} from "../features/dashboard/hooks/Acceder_API/authService.jsx";

export function RequireAuth() {
  const token = getToken();
  return token ? <Outlet /> : <Navigate to="/acceder" replace />;
}

export function RequireRole({ allowed }) {
  const role = (getRole() || "").toLowerCase();
  const ok = allowed.map((r) => String(r).toLowerCase()).includes(role);
  return ok ? <Outlet /> : <Navigate to="/acceder" replace />;
}
