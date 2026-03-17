import React, { useEffect, useMemo, useRef } from "react";
import { Ban, CheckCircle2, Shield, TriangleAlert, X } from "lucide-react";
import "../../styles/restructured/components/confirm-modal.css";

const TYPE_TO_TONE = {
  activate: "success",
  active: "success",
  complete: "success",
  completed: "success",
  deactivate: "danger",
  inactive: "danger",
  cancel: "danger",
  cancelled: "danger",
  delete: "danger",
  warning: "warning",
  reset: "warning",
  pending: "warning",
  info: "info",
  process: "info",
  processing: "info",
  in_process: "info",
  default: "info",
};

const STATUS_TO_TONE = {
  "1": "success",
  ACTIVO: "success",
  ACTIVE: "success",
  COMPLETADO: "success",
  COMPLETE: "success",
  PAGADA: "success",
  PAGADO: "success",
  "5": "success",
  "2": "danger",
  INACTIVO: "danger",
  INACTIVE: "danger",
  CANCELADO: "danger",
  CANCELADA: "danger",
  CANCELLED: "danger",
  ANULADA: "danger",
  ANULADO: "danger",
  "6": "danger",
  "3": "warning",
  PENDIENTE: "warning",
  PENDING: "warning",
  "4": "info",
  EN_PROCESO: "info",
  ENPROCESO: "info",
  PROCESSING: "info",
};

const INFO_BY_TONE = {
  danger: "Este cambio puede afectar procesos activos.\nRevisa antes de confirmar.",
  success: "El estado quedara actualizado.\nEstara disponible para los demas modulos.",
  info: "Verifica la informacion.\nConfirma el cambio solo si es correcto.",
  warning: "Este estado requiere seguimiento.\nValida el flujo antes de continuar.",
};

const normalizeKey = (value) => {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    return String(value);
  }

  return String(value)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
};

const resolveTone = (type, targetStatus) => {
  const normalizedStatus = normalizeKey(targetStatus);
  if (normalizedStatus && STATUS_TO_TONE[normalizedStatus]) {
    return STATUS_TO_TONE[normalizedStatus];
  }

  const normalizedType = normalizeKey(type).toLowerCase();
  if (normalizedType && TYPE_TO_TONE[normalizedType]) {
    return TYPE_TO_TONE[normalizedType];
  }

  return "info";
};

const renderDefaultIcon = (tone, size) => {
  if (tone === "danger") return <Ban size={size} strokeWidth={2} />;
  if (tone === "success") return <CheckCircle2 size={size} strokeWidth={2} />;
  if (tone === "warning") return <TriangleAlert size={size} strokeWidth={2} />;
  return <Shield size={size} strokeWidth={2} />;
};

const ConfirmModal = ({
  isOpen,
  onClose = () => {},
  onConfirm,
  title = "Confirmar accion",
  message = "Esta accion aplicara un cambio en el sistema.",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "default",
  targetStatus = null,
  details = null,
  icon = null,
  compact = false,
  children = null,
  disabled = false,
}) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleMouseDown = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow || "";
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const tone = useMemo(() => resolveTone(type, targetStatus), [type, targetStatus]);
  const canConfirm = Boolean(onConfirm) && !disabled;
  const shouldUseInternalScroll = Boolean(children) || compact;

  if (!isOpen) return null;

  const getIcon = (size) => {
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon, { size });
    }

    return renderDefaultIcon(tone, size);
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm?.();
  };

  const overlayClassName = [
    "confirm-modal-overlay",
    `tone-${tone}`,
    compact ? "is-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={overlayClassName} onClick={onClose}>
      <div
        className="confirm-modal-shell"
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="confirm-modal-header">
          <div className="confirm-modal-header-main">
            <div className="confirm-modal-header-icon">{getIcon(compact ? 18 : 20)}</div>
            <h2 className="confirm-modal-title">{title}</h2>
          </div>

          <button type="button" onClick={onClose} aria-label="Cerrar" className="confirm-modal-close">
            <X size={18} />
          </button>
        </div>

        <div className={`confirm-modal-body ${shouldUseInternalScroll ? "has-scroll" : "no-scroll"}`}>
          <div className="confirm-modal-main">
            <div className="confirm-modal-main-icon">{getIcon(compact ? 22 : 26)}</div>
            <p className="confirm-modal-message">{message}</p>
          </div>

          {details && (
            <div className="confirm-modal-details">
              <span className="confirm-modal-details-label">Detalles</span>
              <div className="confirm-modal-details-value">{details}</div>
            </div>
          )}

          {children && <div className="confirm-modal-children">{children}</div>}

          <div className="confirm-modal-info">
            <p className="confirm-modal-info-text">{INFO_BY_TONE[tone]}</p>
          </div>
        </div>

        <div className="confirm-modal-footer">
          <button type="button" onClick={onClose} className="confirm-modal-btn confirm-modal-btn-cancel">
            {cancelText}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`confirm-modal-btn confirm-modal-btn-confirm ${!canConfirm ? "is-disabled" : ""}`.trim()}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export { ConfirmModal };
export default ConfirmModal;
