export const APPOINTMENT_NOTIFICATIONS_KEY = "lgym:appointment-notifications";
export const APPOINTMENT_NOTIFICATIONS_EVENT = "appointment-notifications-change";

const MAX_APPOINTMENT_NOTIFICATIONS = 20;

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readAllNotifications() {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(APPOINTMENT_NOTIFICATIONS_KEY);
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAllNotifications(notifications) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    APPOINTMENT_NOTIFICATIONS_KEY,
    JSON.stringify(notifications),
  );
  window.dispatchEvent(new Event(APPOINTMENT_NOTIFICATIONS_EVENT));
}

export function resolveUserId(user) {
  if (!user || typeof user !== "object") return null;
  const rawId =
    user.id_usuario ??
    user.idUsuario ??
    user.id ??
    user.usuario_id ??
    user.userId ??
    null;
  if (rawId == null || rawId === "") return null;
  return String(rawId);
}

export function getAppointmentNotifications(userId = null) {
  const normalizedUserId = userId == null ? null : String(userId);
  const list = readAllNotifications();

  const filtered =
    normalizedUserId == null
      ? list
      : list.filter(
          (item) =>
            item?.userId == null || String(item.userId) === normalizedUserId,
        );

  return filtered
    .filter((item) => item && typeof item === "object")
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    );
}

export function addAppointmentNotification(notification = {}) {
  const normalized = {
    id:
      notification.id ||
      `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: notification.title || "Nueva notificacion",
    message: notification.message || "",
    route: notification.route || "/cliente/agendarCita",
    citaId: notification.citaId ?? null,
    userId: notification.userId ?? null,
    createdAt: notification.createdAt || new Date().toISOString(),
    type: notification.type || "appointment",
  };

  const current = readAllNotifications();
  const updated = [normalized, ...current].slice(0, MAX_APPOINTMENT_NOTIFICATIONS);
  writeAllNotifications(updated);
  return normalized;
}
