// src/auth/guards.jsx
import { Navigate, Outlet } from "react-router-dom";
import { getRole } from "../features/dashboard/hooks/Acceder_API/authService.jsx";

export function RequireAuth() {
  const token = localStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/acceder" replace />;
}

export function RequireRole({ allowed }) {
  const role = (getRole() || "").toLowerCase();
  const ok = allowed.map((r) => String(r).toLowerCase()).includes(role);
  return ok ? <Outlet /> : <Navigate to="/acceder" replace />;
}
