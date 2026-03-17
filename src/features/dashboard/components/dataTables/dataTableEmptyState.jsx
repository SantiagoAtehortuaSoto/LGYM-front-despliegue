import PropTypes from "prop-types";
import { SearchX, RefreshCw } from "lucide-react";

const DataTableEmptyState = ({
  title = "No se encontraron datos",
  message = "No hay registros disponibles para mostrar en este momento.",
  actionLabel = "Volver a cargar",
  onAction = null,
  loading = false,
}) => {
  return (
    <div className="datatable-empty-state" role="status" aria-live="polite">
      <div className="datatable-empty-state__icon-wrap" aria-hidden="true">
        <SearchX size={28} className="datatable-empty-state__icon" />
      </div>
      <h3 className="datatable-empty-state__title">{title}</h3>
      <p className="datatable-empty-state__message">{message}</p>
      {typeof onAction === "function" && (
        <button
          type="button"
          className="datatable-empty-state__button"
          onClick={onAction}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "datatable-empty-state__button-icon is-spinning" : "datatable-empty-state__button-icon"}
          />
          <span>{loading ? "Actualizando..." : actionLabel}</span>
        </button>
      )}
    </div>
  );
};

DataTableEmptyState.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  actionLabel: PropTypes.string,
  onAction: PropTypes.func,
  loading: PropTypes.bool,
};

export default DataTableEmptyState;

