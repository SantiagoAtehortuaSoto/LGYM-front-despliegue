import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Eye,
  SquarePen,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useRef } from "react";
import { ConfirmModal } from "../../../../shared/components/ConfirmModal/confirmModal";
import { BadgeActivo, BadgeInactivo } from "./badgesEstado";
import DataTableEmptyState from "./dataTableEmptyState";
import {
  BadgePendienteCompra,
  BadgeEnProceso,
  BadgeCompletadoCompra,
  BadgeCanceladoCompra,
  BadgeRetrasado,
  BadgeAsistio,
  BadgeNoAsistio,
} from "./badgesEstado";
import {
  hasPermisoAccion,
  resolvePermisoIdFromPath,
  isAdmin,
} from "../../hooks/Acceder_API/authService.jsx";

export const DEFAULT_DATA_TABLE_PAGE_SIZE = 5;

const STATUS_FIELDS = new Set([
  "estado",
  "id_estado",
  "estado_pedido",
  "estado_venta",
]);

const getNormalizedField = (column = {}) =>
  String(column.field ?? column.accessor ?? "").toLowerCase();

const getNormalizedLabel = (column = {}) =>
  String(column.label ?? column.header ?? "").toLowerCase();

const isStatusColumn = (column = {}) => {
  const field = getNormalizedField(column);
  const label = getNormalizedLabel(column);
  return STATUS_FIELDS.has(field) || label.includes("estado");
};

const isDescriptionColumn = (column = {}) => {
  const field = getNormalizedField(column);
  const label = getNormalizedLabel(column);
  return field.includes("descripcion") || label.includes("descripcion");
};

const isIdColumn = (column = {}) => {
  const field = getNormalizedField(column);
  const label = getNormalizedLabel(column);
  if (isStatusColumn(column)) return false;
  return (
    field === "id" ||
    field.startsWith("id_") ||
    label === "id" ||
    label.startsWith("id ")
  );
};

const parseNumericId = (value) => {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "object") {
    const nestedCandidates = [
      value.id,
      value.id_usuario,
      value.id_cliente,
      value.id_empleado,
      value.value,
    ];
    for (const candidate of nestedCandidates) {
      const parsed = parseNumericId(candidate);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getSortableIdFromRow = (row = {}, preferredField = null) => {
  if (!row || typeof row !== "object") return null;

  if (preferredField) {
    const preferred = parseNumericId(row[preferredField]);
    if (preferred !== null) return preferred;
  }

  const directCandidates = [
    row.id,
    row.id_pedido,
    row.id_venta,
    row.id_asistencia,
    row.id_cliente,
    row.id_empleado,
    row.id_usuario,
    row.id_cita,
  ];

  for (const candidate of directCandidates) {
    const parsed = parseNumericId(candidate);
    if (parsed !== null) return parsed;
  }

  const dynamicIdKey = Object.keys(row).find((key) => {
    const normalized = String(key).toLowerCase();
    return normalized === "id" || normalized.startsWith("id_");
  });

  if (dynamicIdKey) {
    const parsed = parseNumericId(row[dynamicIdKey]);
    if (parsed !== null) return parsed;
  }

  return null;
};

const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  pageSize: _pageSize = DEFAULT_DATA_TABLE_PAGE_SIZE,
  showPagination = true,
  minWidth = null,
  onView = null,
  onEdit = null,
  onDelete = null,
  onStatusChange = null,
  actions = true,
  canView = () => true,
  canEdit = () => true,
  canDelete = () => true,
  grayEditButtons = false, // Nueva prop para estilos grisáceos en editar
  redDeleteButtons: _redDeleteButtons = false, // Nueva prop para estilos rojos en eliminar
  permisoId = null,
  statusConfig: _statusConfig = {
    values: { active: "Activo", inactive: "Inactivo" },
    colors: { active: "#4caf50", inactive: "#f44336" },
  },
  // Nuevas props para filtrado
  filterConfig = null, // { field: string, options: Array<{value: any, label: string}> }
  filterValue = null,
  onFilterChange = null,
  onRefresh = null,
  showRefreshButton = true,
  refreshButtonLabel = "Actualizar tabla",
  paginationMode = "client",
  currentPage: currentPageProp = 1,
  totalPages: totalPagesProp = 1,
  totalItems: totalItemsProp = 0,
  onPageChange = null,
  emptyTitle = "No se encontraron datos",
  emptyMessage = "No hay registros disponibles para mostrar en este momento.",
  emptyActionLabel = "Volver a cargar",
}) => {
  void _pageSize;
  void _redDeleteButtons;
  void _statusConfig;
  const resolvedPageSize = DEFAULT_DATA_TABLE_PAGE_SIZE;
  const resolvedPermisoId = useMemo(() => {
    if (Number.isInteger(Number(permisoId))) return Number(permisoId);
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    return resolvePermisoIdFromPath(path);
  }, [permisoId]);
  const [authRevision, setAuthRevision] = useState(0);

  const guardView = useMemo(() => {
    void authRevision;
    const admin = isAdmin();
    return (row) => {
      const allowed = admin
        ? true
        : hasPermisoAccion(resolvedPermisoId, "ver");
      return allowed && canView(row);
    };
  }, [resolvedPermisoId, canView, authRevision]);

  const guardEdit = useMemo(() => {
    void authRevision;
    const admin = isAdmin();
    return (row) => {
      const allowed = admin
        ? true
        : hasPermisoAccion(resolvedPermisoId, "editar");
      return allowed && canEdit(row);
    };
  }, [resolvedPermisoId, canEdit, authRevision]);

  const guardDelete = useMemo(() => {
    void authRevision;
    const admin = isAdmin();
    return (row) => {
      const allowed = admin
        ? true
        : hasPermisoAccion(resolvedPermisoId, "eliminar");
      return allowed && canDelete(row);
    };
  }, [resolvedPermisoId, canDelete, authRevision]);

  const canRenderDeleteButton = Boolean(onDelete);
  const showActionsColumn = actions && (onView || onEdit || canRenderDeleteButton);
  const compactFirstColumn = useMemo(
    () => isIdColumn(columns?.[0]),
    [columns]
  );
  const preferredSortIdField = useMemo(() => {
    const idColumn = columns.find((column) => isIdColumn(column));
    if (!idColumn) return null;
    if (typeof idColumn.field === "string" && idColumn.field) return idColumn.field;
    if (typeof idColumn.accessor === "string" && idColumn.accessor) return idColumn.accessor;
    return null;
  }, [columns]);
  const [paginaActual, setPaginaActual] = useState(1);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [paginaInput, setPaginaInput] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasRefreshHandler = typeof onRefresh === "function";
  const isServerPagination = paginationMode === "server";
  const previousDataLengthRef = useRef(Array.isArray(data) ? data.length : 0);

  // Calculate derived state with filtering
  const {
    totalPagesValue,
    currentPageValue,
    visibleData,
    totalItemsValue,
  } = useMemo(() => {
    const baseData = Array.isArray(data) ? [...data] : [];

    // Apply filter if configured
    let dataToDisplay = baseData;
    if (filterConfig && filterValue !== null && filterValue !== undefined && filterValue !== "all") {
      dataToDisplay = baseData.filter(row => {
        const fieldValue = row[filterConfig.field];
        return fieldValue === filterValue || String(fieldValue) === String(filterValue);
      });
    }

    dataToDisplay.sort((a, b) => {
      const idA = getSortableIdFromRow(a, preferredSortIdField);
      const idB = getSortableIdFromRow(b, preferredSortIdField);

      if (idA === null && idB === null) return 0;
      if (idA === null) return 1;
      if (idB === null) return -1;
      return idB - idA; // mayor ID primero
    });

    const totalItemsValue = isServerPagination
      ? Math.max(0, Number(totalItemsProp) || dataToDisplay.length)
      : dataToDisplay.length;
    const totalPagesValue = isServerPagination
      ? Math.max(
          1,
          Number(totalPagesProp) ||
            Math.ceil(totalItemsValue / Math.max(1, Number(resolvedPageSize) || 1))
        )
      : Math.max(1, Math.ceil(dataToDisplay.length / resolvedPageSize));
    const requestedPage = isServerPagination
      ? Math.max(1, Number(currentPageProp) || 1)
      : paginaActual;
    const currentPageValue = Math.min(requestedPage, totalPagesValue || 1);
    const startIndex = (currentPageValue - 1) * resolvedPageSize;
    const endIndex = startIndex + resolvedPageSize;

    return {
      totalPagesValue,
      currentPageValue,
      visibleData: isServerPagination
        ? dataToDisplay.slice(0, resolvedPageSize)
        : dataToDisplay.slice(startIndex, endIndex),
      totalItemsValue,
    };
  }, [
    currentPageProp,
    data,
    filterConfig,
    filterValue,
    isServerPagination,
    paginaActual,
    preferredSortIdField,
    resolvedPageSize,
    totalItemsProp,
    totalPagesProp,
  ]);

  // Handle page validation
  useEffect(() => {
    if (!isServerPagination && paginaActual !== currentPageValue) {
      setPaginaActual(currentPageValue);
    }
  }, [currentPageValue, isServerPagination, paginaActual]);

  useEffect(() => {
    if (isServerPagination) {
      previousDataLengthRef.current = Array.isArray(data) ? data.length : 0;
      return;
    }

    const currentLength = Array.isArray(data) ? data.length : 0;
    if (currentLength < previousDataLengthRef.current && paginaActual !== 1) {
      setPaginaActual(1);
    }

    previousDataLengthRef.current = currentLength;
  }, [data, isServerPagination, paginaActual]);

  useEffect(() => {
    const onAuthChange = () => setAuthRevision((prev) => prev + 1);
    const onStorage = (event) => {
      if (!event || event.key === "user" || event.key === "token") {
        onAuthChange();
      }
    };
    window.addEventListener("auth-change", onAuthChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth-change", onAuthChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Handle status change when badge is clicked
  const handleStatusClick = (updatedRow) => {
    const currentStatus = updatedRow.id_estado || updatedRow.estado;
    let newStatus;

    // Determinar si estamos manejando productos/servicios (1-2) o compras/pedidos (3-6)
    const isProductosServicios =
      currentStatus === 1 ||
      currentStatus === 2 ||
      currentStatus === "1" ||
      currentStatus === "2" ||
      currentStatus === "ACTIVO" ||
      currentStatus === "INACTIVO";

    if (isProductosServicios) {
      // Estados de productos/servicios (1=ACTIVO, 2=INACTIVO)
      if (
        currentStatus === 1 ||
        currentStatus === "1" ||
        currentStatus === "ACTIVO"
      ) {
        newStatus = 2; // ACTIVO -> INACTIVO
      } else if (
        currentStatus === 2 ||
        currentStatus === "2" ||
        currentStatus === "INACTIVO"
      ) {
        newStatus = 1; // INACTIVO -> ACTIVO
      } else {
        return; // Estado no válido
      }
    } else {
      // Estados de compras/pedidos (3=PENDIENTE, 4=EN PROCESO, 5=COMPLETADO, 6=CANCELADO)
      if (currentStatus === 3 || currentStatus === "3") {
        newStatus = 4; // PENDIENTE -> EN PROCESO
      } else if (currentStatus === 4 || currentStatus === "4") {
        newStatus = 5; // EN PROCESO -> COMPLETADO
      } else if (currentStatus === 5 || currentStatus === "5") {
        newStatus = 6; // COMPLETADO -> CANCELADO
      } else if (currentStatus === 6 || currentStatus === "6") {
        newStatus = 3; // CANCELADO -> PENDIENTE
      } else {
        return; // Estado no válido
      }
    }

    // Cambiar estado directamente sin modal de confirmación
    if (onStatusChange) {
      onStatusChange(
        { ...updatedRow, id_estado: newStatus },
        getStatusText(newStatus)
      );
    }
  };

  // These functions are kept for backward compatibility
  const confirmStatusChange = () => {
    if (pendingStatusChange && onStatusChange) {
      const { row, newStatus, statusField } = pendingStatusChange;
      onStatusChange(
        { ...row, [statusField]: newStatus },
        getStatusText(newStatus)
      );
    }
    setShowConfirmModal(false);
    setPendingStatusChange(null);
  };

  const cancelStatusChange = () => {
    setShowConfirmModal(false);
    setPendingStatusChange(null);
  };

  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage >= 1 && newPage <= totalPagesValue) {
        if (isServerPagination) {
          if (typeof onPageChange === "function" && newPage !== currentPageValue) {
            onPageChange(newPage, resolvedPageSize);
          }
          return;
        }
        setPaginaActual(newPage);
      }
    },
    [currentPageValue, isServerPagination, onPageChange, resolvedPageSize, totalPagesValue]
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !hasRefreshHandler) return;
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, hasRefreshHandler, onRefresh]);

  const getStatusText = (status) => {
    if (
      status === 1 ||
      status === "1" ||
      status === "ACTIVO" ||
      status === "Activo"
    )
      return "Activo";
    if (
      status === 2 ||
      status === "2" ||
      status === "INACTIVO" ||
      status === "Inactivo"
    )
      return "Inactivo";
    if (status === 3 || status === "3") return "PENDIENTE";
    if (status === 4 || status === "4") return "EN PROCESO";
    if (status === 5 || status === "5") return "COMPLETADO";
    if (status === 6 || status === "6") return "CANCELADO";
    if (status === 7 || status === "7") return "RETRASADO";
    if (status === 8 || status === "8") return "ASISTIO";
    if (status === 9 || status === "9") return "NO ASISTIO";
    return String(status).toUpperCase();
  };

  const getStatusCell = (row) => {
    const status = row.id_estado !== undefined ? row.id_estado : row.estado;
    if (
      status === 1 ||
      status === "1" ||
      status === "ACTIVO" ||
      status === "Activo"
    ) {
      return (
        <BadgeActivo
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (
      status === 2 ||
      status === "2" ||
      status === "INACTIVO" ||
      status === "Inactivo"
    ) {
      return (
        <BadgeInactivo
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (status === 3 || status === "3") {
      return (
        <BadgePendienteCompra
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (status === 4 || status === "4") {
      return (
        <BadgeEnProceso
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (status === 5 || status === "5") {
      return (
        <BadgeCompletadoCompra
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (status === 6 || status === "6") {
      return (
        <BadgeCanceladoCompra
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (status === 7 || status === "7" || status === "RETRASADO") {
      return (
        <BadgeRetrasado
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (status === 8 || status === "8" || status === "ASISTIO") {
      return (
        <BadgeAsistio
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }
    if (
      status === 9 ||
      status === "9" ||
      status === "NO ASISTIO" ||
      status === "NO_ASISTIO"
    ) {
      return (
        <BadgeNoAsistio
          tamano="pequeño"
          rowData={row}
          onStatusChange={onStatusChange ? handleStatusClick : undefined}
        />
      );
    }

    // Estado por defecto
    return (
      <BadgeActivo
        tamano="pequeño"
        rowData={row}
        onStatusChange={onStatusChange ? handleStatusClick : undefined}
      />
    );
  };

  const renderCellContent = (row, column) => {
    // Prioriza render/Cell personalizado si existe
    const value =
      typeof column.accessor === "function"
        ? column.accessor(row)
        : row[column.accessor || column.field];
    if (typeof column.render === "function") return column.render(value, row);
    if (typeof column.Cell === "function") return column.Cell({ value, row });

    if (column.field === "id_estado") {
      return getStatusCell(row);
    }
    return value;
  };

  const handlePageInputChange = (e) => {
    const value = e.target.value;
    if (
      value === "" ||
      (/^[1-9]\d*$/.test(value) && parseInt(value, 10) <= totalPagesValue)
    ) {
      setPaginaInput(value);
    }
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === "Enter" && paginaInput) {
      const newPage = parseInt(paginaInput, 10);
      if (newPage >= 1 && newPage <= totalPagesValue) {
        handlePageChange(newPage);
        setPaginaInput("");
      }
    }
  };

  const columnLayout = useMemo(() => {
    const idIndex = columns.findIndex((column) => isIdColumn(column));
    const descriptionIndex = columns.findIndex((column) =>
      isDescriptionColumn(column)
    );
    const fixedPercent =
      (idIndex !== -1 ? 10 : 0) + (descriptionIndex !== -1 ? 33 : 0);

    const variableIndexes = columns
      .map((_, index) => index)
      .filter(
        (index) =>
          index !== idIndex &&
          index !== descriptionIndex &&
          !isStatusColumn(columns[index])
      );

    const basePercent = Math.max(0, 100 - fixedPercent);
    const equalPercent =
      variableIndexes.length > 0
        ? `${basePercent / variableIndexes.length}%`
        : "auto";

    return columns.map((column, index) => {
      const status = isStatusColumn(column);
      const id = index === idIndex;
      const description = index === descriptionIndex;

      let width = equalPercent;
      if (id) width = "10%";
      else if (description) width = "33%";
      else if (status) width = "140px";

      return { status, width };
    });
  }, [columns]);

  const renderTableCell = (row, column, colIndex) => {
    const content = renderCellContent(row, column);
    const statusColumn = columnLayout[colIndex]?.status;

    if (statusColumn) {
      return (
        <div className="celda-contenido celda-contenido--status">{content}</div>
      );
    }

    if (
      content === null ||
      content === undefined ||
      typeof content === "string" ||
      typeof content === "number"
    ) {
      const text = content ?? "";
      return (
        <span className="celda-texto-truncado" title={String(text)}>
          {text}
        </span>
      );
    }

    return <div className="celda-contenido">{content}</div>;
  };

  if (loading) {
    const skeletonRows = Math.max(3, Math.min(resolvedPageSize, 6));

    return (
      <div className="contenedor-tabla" role="status" aria-live="polite" aria-label="Cargando datos de la tabla">
        <table
          className={`tabla-datos ${minWidth ? "tabla-con-min-width" : ""}`}
          width={minWidth || undefined}
        >
          <colgroup>
            {columns.map((_, i) => (
              <col key={i} width={columnLayout[i]?.width} />
            ))}
            {showActionsColumn && <col width="120" />}
          </colgroup>

          <thead>
            <tr>
              {columns.map((column, i) => (
                <th key={i} className="encabezado-tabla">
                  <div className="encabezado-con-filtro">
                    <span className="texto-estado-clicable">
                      {column.label || column.header}
                    </span>
                  </div>
                </th>
              ))}
              {showActionsColumn && (
                <th className="encabezado-tabla">
                  <div className="encabezado-con-filtro">Acciones</div>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <tr
                key={`skeleton-${rowIndex}`}
                className={rowIndex % 2 === 0 ? "fila-par" : "fila-impar"}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={`skeleton-cell-${rowIndex}-${colIndex}`}
                    className={`celda-tabla ${isStatusColumn(column) ? "celda-estado" : ""}`}
                  >
                    <div className="tabla-skeleton-line" aria-hidden="true" />
                  </td>
                ))}
                {showActionsColumn && (
                  <td className="celda-acciones">
                    <div className="tabla-skeleton-actions" aria-hidden="true">
                      <span className="tabla-skeleton-icon" />
                      <span className="tabla-skeleton-icon" />
                      <span className="tabla-skeleton-icon" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="datatable-loading-caption">Cargando datos...</div>
      </div>
    );
  }

  const shouldShowEmptyState = visibleData.length === 0;

  return (
    <div className="contenedor-tabla">
      {showRefreshButton && hasRefreshHandler && (
        <div className="datatable-toolbar">
          <button
            type="button"
            className="datatable-refresh-btn"
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            title="Actualizar los datos de la tabla actual"
          >
            <RefreshCw
              size={16}
              className={`datatable-refresh-icon ${isRefreshing ? "is-spinning" : ""}`}
            />
            <span>{isRefreshing ? "Actualizando tabla..." : refreshButtonLabel}</span>
          </button>
        </div>
      )}
      {shouldShowEmptyState ? (
        <DataTableEmptyState
          title={emptyTitle}
          message={emptyMessage}
          actionLabel={emptyActionLabel}
          onAction={hasRefreshHandler ? handleRefresh : null}
          loading={isRefreshing}
        />
      ) : (
        <>
          <table
            className={`tabla-datos ${compactFirstColumn ? "tabla-con-columna-id" : ""}`}
            width={minWidth || undefined}
          >
            <colgroup>
              {columns.map((_, i) => (
                <col key={i} width={columnLayout[i]?.width} />
              ))}
              {showActionsColumn && <col width="120" />}
            </colgroup>

            <thead>
              <tr>
                {columns.map((column, i) => (
                  <th key={i} className="encabezado-tabla">
                    <div className="encabezado-con-filtro">
                      <span className="texto-estado-clicable">
                        {column.label || column.header}
                      </span>
                      {filterConfig && filterConfig.field === column.field && (
                        <select
                          value={filterValue || "all"}
                          onChange={(e) =>
                            onFilterChange &&
                            onFilterChange(
                              e.target.value === "all" ? null : e.target.value
                            )
                          }
                          className="filtro-tabla datatable-filter-select"
                        >
                          <option value="all">Todos</option>
                          {filterConfig.options.map((option, idx) => (
                            <option key={idx} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </th>
                ))}
                {showActionsColumn && (
                  <th className="encabezado-tabla">
                    <div className="encabezado-con-filtro">Acciones</div>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {visibleData.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={rowIndex % 2 === 0 ? "fila-par" : "fila-impar"}
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={colIndex}
                      className={`celda-tabla ${isStatusColumn(column) ? "celda-estado" : ""}`}
                      data-label={column.label || column.header || ""}
                    >
                      {renderTableCell(row, column, colIndex)}
                    </td>
                  ))}
                  {showActionsColumn && (
                    <td className="celda-acciones">
                      {(() => {
                        const canViewRow = guardView(row);
                        const canEditRow = guardEdit(row);
                        const canDeleteRow = guardDelete(row);

                        return (
                          <>
                            {onView && (
                              <button
                                className={`boton-acción boton-ver ${canViewRow ? "" : "boton-accion--disabled"}`.trim()}
                                onClick={() =>
                                  canViewRow ? onView(row) : undefined
                                }
                                title="Ver detalles"
                                disabled={!canViewRow}
                              >
                                <Eye size={16} />
                              </button>
                            )}
                            {onEdit && (
                              <button
                                className={[
                                  "boton-accion",
                                  "badge-editar",
                                  !canEditRow ? "boton-accion--denied" : "",
                                  canEditRow && grayEditButtons
                                    ? "boton-accion--edit-muted"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={canEditRow ? () => onEdit(row) : undefined}
                                disabled={!canEditRow}
                                aria-disabled={!canEditRow}
                                title={
                                  canEditRow
                                    ? "Editar"
                                    : "Editar (sin permisos)"
                                }
                              >
                                <SquarePen
                                  size={16}
                                  className={[
                                    "boton-accion-icon",
                                    !canEditRow
                                      ? "boton-accion-icon--disabled"
                                      : "",
                                    canEditRow && grayEditButtons
                                      ? "boton-accion-icon--muted"
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                />
                              </button>
                            )}
                            {onDelete && canRenderDeleteButton && (
                              <button
                                className={[
                                  "boton-accion",
                                  "boton-eliminar",
                                  !canDeleteRow ? "boton-accion--denied" : "",
                                  canDeleteRow
                                    ? "boton-accion--delete-active"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={canDeleteRow ? () => onDelete(row) : undefined}
                                disabled={!canDeleteRow}
                                aria-disabled={!canDeleteRow}
                                title={
                                  canDeleteRow
                                    ? "Eliminar"
                                    : "Eliminar (sin permisos)"
                                }
                              >
                                <Trash2
                                  size={16}
                                  className={[
                                    "boton-accion-icon",
                                    !canDeleteRow
                                      ? "boton-accion-icon--disabled"
                                      : "boton-accion-icon--danger",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                />
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {showPagination && totalItemsValue > 0 && (
            <div className="paginacion">
              <button
                className="boton-paginacion"
                onClick={() => handlePageChange(currentPageValue - 1)}
                disabled={currentPageValue === 1}
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="info-paginacion">
                Página {currentPageValue} de {totalPagesValue}
              </span>
              <div className="ir-a-pagina">
                <span>Ir a: </span>
                <input
                  type="text"
                  value={paginaInput}
                  onChange={handlePageInputChange}
                  onKeyDown={handlePageInputKeyDown}
                  className="input-pagina"
                  placeholder="#"
                  aria-label="Número de página"
                />
              </div>
              <button
                className="boton-paginacion"
                onClick={() => handlePageChange(currentPageValue + 1)}
                disabled={currentPageValue === totalPagesValue}
                title="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {pendingStatusChange && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={cancelStatusChange}
          onConfirm={confirmStatusChange}
          targetStatus={pendingStatusChange.newStatus}
          title={`Cambiar estado a ${getStatusText(
            pendingStatusChange.newStatus
          )}`}
          message={`¿Estás seguro de que deseas cambiar el estado a ${getStatusText(
            pendingStatusChange.newStatus
          ).toLowerCase()}?`}
          confirmText={`Cambiar a ${getStatusText(
            pendingStatusChange.newStatus
          )}`}
          details={
            pendingStatusChange.row.nombre ||
            pendingStatusChange.row.numero_pedido ||
            `ID: ${pendingStatusChange.row.id || pendingStatusChange.row.id_pedido
            }`
          }
        />
      )}
    </div>
  );
};

export default DataTable;
