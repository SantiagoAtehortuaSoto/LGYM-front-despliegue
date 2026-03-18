import { useEffect, useRef } from "react";
import { Trash2, X } from "lucide-react";
import "../../styles/restructured/components/delete-modal.css";

const SIZE_CLASS = {
  sm: "delete-modal--sm",
  md: "delete-modal--md",
  lg: "delete-modal--lg",
  xl: "delete-modal--xl",
};

/**
 * Reusable delete modal with unified style.
 */
export const DeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  item,
  title = "Eliminar",
  size = "md",
  fields = [
    { key: "nombre", label: "Nombre" },
    { key: "descripcion", label: "Descripción" },
  ],
  warningMessage = "Esta acción no se puede deshacer.",
}) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    const handleMouseDown = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.md;

  const rows = fields.filter((field) => {
    const value = item[field.key];
    return value !== undefined && value !== null && value !== "";
  });

  const handleConfirm = async () => {
    try {
      if (onConfirm) {
        await onConfirm(item);
      }
      onClose?.();
    } catch (error) {
      console.error("Error during deletion:", error);
    }
  };

  return (
    <div className="delete-modal__overlay" onClick={onClose}>
      <div
        className={`delete-modal__container ${sizeClass}`}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="delete-modal__header">
          <div className="delete-modal__header-main">
            <div className="delete-modal__icon-wrap">
              <Trash2 size={20} />
            </div>
            <h2 className="delete-modal__header-title">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="delete-modal__close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="delete-modal__body">
          <div className="delete-modal__main">
            <div className="delete-modal__main-icon">
              <Trash2 size={26} />
            </div>
            <p className="delete-modal__title">
              Estas seguro de que deseas eliminar este elemento?
            </p>
          </div>

          <div className="delete-modal__details">
            <span className="delete-modal__details-label">Detalles</span>
            {rows.length > 0 ? (
              <div className="delete-modal__summary">
                {rows.map((field) => {
                  const rawValue = item[field.key];
                  const value = field.format
                    ? field.format(rawValue, item)
                    : rawValue;

                  return (
                    <div
                      key={field.key}
                      className="delete-modal__summary-item"
                    >
                      <span className="delete-modal__field-label">
                        {field.label}
                      </span>
                      <div className="delete-modal__field-value">
                        {value}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="delete-modal__empty-text">
                No hay detalles para mostrar.
              </p>
            )}
          </div>

          <div className="delete-modal__warning">
            <div className="delete-modal__warning-text">
              {typeof warningMessage === "string" ? (
                <p className="delete-modal__warning-message">{warningMessage}</p>
              ) : (
                warningMessage
              )}
            </div>
            <p className="delete-modal__warning-strong">
              El elemento sera eliminado permanentemente.
            </p>
          </div>
        </div>

        <div className="delete-modal__footer">
          <button
            type="button"
            onClick={onClose}
            className="delete-modal__btn delete-modal__btn--cancel"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!onConfirm}
            className={`delete-modal__btn delete-modal__btn--confirm ${
              !onConfirm ? "delete-modal__btn--disabled" : ""
            }`}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
