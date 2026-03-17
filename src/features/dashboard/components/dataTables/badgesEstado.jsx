/* eslint-disable react-refresh/only-export-components */
// src/features/dashboard/components/dataTables/badgesEstado.jsx
// Componente reutilizable para mostrar badges de estado en diferentes módulos
//
// ORGANIZACIÓN:
// - ESTADOS GENERALES: ACTIVO/INACTIVO (id_estado: 1-2)
// - ESTADOS DE VENTAS: PAGADA/ANULADA/DEVUELTA/etc.
// - ESTADOS DE COMPRAS: PENDIENTE/EN PROCESO/COMPLETADO/CANCELADO (id_estado: 3-6)
//
// USO EN COMPRAS:
// - Usa BadgeEstadoPorId con idEstado (3=PENDIENTE, 4=EN PROCESO, 5=COMPLETADO, 6=CANCELADO)
// - O usa BadgePendienteCompra, BadgeEnProceso, BadgeCompletadoCompra, BadgeCanceladoCompra
// - Las constantes ESTADOS_COMPRAS y OPCIONES_ESTADO_COMPRAS están disponibles para configuración

import React, { useMemo, useState } from 'react';
import { ConfirmModal } from '../../../../shared/components/ConfirmModal/confirmModal';

// ====================
// CATALOGO OFICIAL DE ESTADOS (tabla estados)
// ====================
export const ESTADOS_APP = {
  ACTIVO: 1,
  INACTIVO: 2,
  PENDIENTE: 3,
  EN_PROCESO: 4,
  COMPLETADO: 5,
  CANCELADO: 6,
  RETRASADO: 7,
  ASISTIO: 8,
  NO_ASISTIO: 9,
};

// Compatibilidad con nombres ya usados en el proyecto
export const ESTADOS_GENERALES = {
  ACTIVO: ESTADOS_APP.ACTIVO,
  INACTIVO: ESTADOS_APP.INACTIVO,
};

export const ESTADOS_COMPRAS = {
  PENDIENTE: ESTADOS_APP.PENDIENTE,
  EN_PROCESO: ESTADOS_APP.EN_PROCESO,
  COMPLETADO: ESTADOS_APP.COMPLETADO,
  CANCELADO: ESTADOS_APP.CANCELADO,
  RETRASADO: ESTADOS_APP.RETRASADO,
};

export const ESTADOS_VENTAS = {
  PENDIENTE: ESTADOS_APP.PENDIENTE,
  EN_PROCESO: ESTADOS_APP.EN_PROCESO,
  COMPLETADO: ESTADOS_APP.COMPLETADO,
  CANCELADO: ESTADOS_APP.CANCELADO,
};

export const ESTADOS_ASISTENCIA = {
  ASISTIO: ESTADOS_APP.ASISTIO,
  NO_ASISTIO: ESTADOS_APP.NO_ASISTIO,
};

const ESTADOS_META_POR_ID = {
  1: { id: 1, key: "ACTIVO", label: "Activo", color: "#10b981" },
  2: { id: 2, key: "INACTIVO", label: "Inactivo", color: "#ef4444" },
  3: { id: 3, key: "PENDIENTE", label: "Pendiente", color: "#f59e0b" },
  4: { id: 4, key: "EN_PROCESO", label: "En proceso", color: "#3b82f6" },
  5: { id: 5, key: "COMPLETADO", label: "Completado", color: "#10b981" },
  6: { id: 6, key: "CANCELADO", label: "Cancelado", color: "#ef4444" },
  7: { id: 7, key: "RETRASADO", label: "Retrasado", color: "#f97316" },
  8: { id: 8, key: "ASISTIO", label: "Asistio", color: "#16a34a" },
  9: { id: 9, key: "NO_ASISTIO", label: "No asistio", color: "#6b7280" },
};

const ESTADOS_ALIAS_A_ID = {
  ACTIVO: 1,
  INACTIVO: 2,
  PENDIENTE: 3,
  "EN PROCESO": 4,
  EN_PROCESO: 4,
  COMPLETADO: 5,
  CANCELADO: 6,
  RETRASADO: 7,
  ASISTIO: 8,
  ASISTIO_CLIENTE: 8,
  "NO ASISTIO": 9,
  NO_ASISTIO: 9,
  NOASISTIO: 9,
  // compatibilidad de claves antiguas
  COMPLETADO_COMPRA: 5,
  CANCELADO_COMPRA: 6,
  SUSPENDIDO: 7,
  PAGADA: 5,
  ANULADA: 6,
  DEVUELTA: 6,
};

const normalizeEstadoKey = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .trim()
    .toUpperCase();

export const getEstadoMeta = (estado) => {
  if (estado === null || estado === undefined || estado === "") return null;

  const numero = Number(estado);
  if (Number.isFinite(numero) && ESTADOS_META_POR_ID[numero]) {
    return ESTADOS_META_POR_ID[numero];
  }

  const normalizado = normalizeEstadoKey(estado);
  const aliasId = ESTADOS_ALIAS_A_ID[normalizado] ?? ESTADOS_ALIAS_A_ID[normalizado.replace(/_/g, " ")];
  if (aliasId && ESTADOS_META_POR_ID[aliasId]) {
    return ESTADOS_META_POR_ID[aliasId];
  }

  return null;
};

export const getEstadoTextoPorId = (idEstado) =>
  getEstadoMeta(idEstado)?.label || "Desconocido";

export const getEstadoColorPorId = (idEstado) =>
  getEstadoMeta(idEstado)?.color || "#6b7280";

// Compatibilidad con nombre existente
export const getEstadoCompraTexto = (idEstado) => {
  const meta = getEstadoMeta(idEstado);
  return meta ? meta.label : "Desconocido";
};

export const OPCIONES_ESTADO_GENERAL = [
  { value: ESTADOS_APP.ACTIVO, label: "Activo" },
  { value: ESTADOS_APP.INACTIVO, label: "Inactivo" },
];

export const OPCIONES_ESTADO_COMPRAS = [
  { value: ESTADOS_APP.PENDIENTE, label: "Pendiente" },
  { value: ESTADOS_APP.EN_PROCESO, label: "En proceso" },
  { value: ESTADOS_APP.COMPLETADO, label: "Completado" },
  { value: ESTADOS_APP.CANCELADO, label: "Cancelado" },
  { value: ESTADOS_APP.RETRASADO, label: "Retrasado" },
];

export const OPCIONES_ESTADO_FLUJO = [...OPCIONES_ESTADO_COMPRAS];

export const OPCIONES_ESTADO_ASISTENCIA = [
  { value: ESTADOS_APP.ASISTIO, label: "Asistio" },
  { value: ESTADOS_APP.NO_ASISTIO, label: "No asistio" },
];

export const OPCIONES_ESTADO_APP = [
  ...OPCIONES_ESTADO_GENERAL,
  ...OPCIONES_ESTADO_COMPRAS,
  ...OPCIONES_ESTADO_ASISTENCIA,
];

const SIZE_CLASSES = {
  pequeño: "badge-pequeno",
  normal: "badge-normal",
  grande: "badge-grande",
};

const TONE_CLASS_BY_KEY = {
  ACTIVO: "badge-tone--activo",
  INACTIVO: "badge-tone--inactivo",
  PENDIENTE: "badge-tone--pendiente",
  EN_PROCESO: "badge-tone--en-proceso",
  COMPLETADO: "badge-tone--completado",
  CANCELADO: "badge-tone--cancelado",
  RETRASADO: "badge-tone--retrasado",
  ASISTIO: "badge-tone--asistio",
  NO_ASISTIO: "badge-tone--no-asistio",
};

const getToneClass = (estado) => {
  const key = getEstadoMeta(estado)?.key;
  return TONE_CLASS_BY_KEY[key] || "badge-tone--default";
};

/**
 * Badge de estado reutilizable
 */
export const BadgeEstado = ({
  estado,
  tamano = "normal",
  conBorde = true,
  clasePersonalizada = "",
  onStatusChange,
  rowData,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const meta = useMemo(() => getEstadoMeta(estado), [estado]);

  const estadoLabel = meta?.label || String(estado ?? "Desconocido");
  const tamanoClase = SIZE_CLASSES[tamano] || "badge-normal";
  const bordeClase = conBorde ? "badge-con-borde" : "badge-sin-borde";
  const canToggleActive = Boolean(onStatusChange) && (meta?.id === 1 || meta?.id === 2);
  const toneClass = getToneClass(estado);

  const handlePlainClick = () => {
    if (!onStatusChange) return;
    if (canToggleActive) {
      setShowConfirm(true);
      return;
    }
    onStatusChange(rowData || { ...meta, estado: estadoLabel });
  };

  const handleConfirm = () => {
    if (onStatusChange) {
      onStatusChange(rowData || { ...meta, estado: estadoLabel });
    }
    setShowConfirm(false);
  };

  const targetStateLabel = meta?.id === 1 ? "Inactivo" : "Activo";

  return (
    <>
      <button
        type="button"
        className={[
          "badge-estado",
          tamanoClase,
          bordeClase,
          toneClass,
          onStatusChange ? "badge-estado--interactive" : "badge-estado--readonly",
          clasePersonalizada,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onStatusChange ? handlePlainClick : undefined}
      >
        <span className="badge-content">{estadoLabel}</span>
      </button>

      {canToggleActive && (
        <ConfirmModal
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
          title={`Cambiar estado a ${targetStateLabel}`}
          message={`¿Estas seguro de que deseas marcar ${
            rowData?.nombre_usuario ||
            rowData?.nombre_rol ||
            rowData?.nombre ||
            "este elemento"
          } como ${targetStateLabel}?`}
          confirmText={meta?.id === 1 ? "Desactivar" : "Activar"}
          type={meta?.id === 1 ? "deactivate" : "activate"}
          details={
            rowData?.nombre_usuario ||
            rowData?.nombre_rol ||
            rowData?.nombre ||
            "Elemento"
          }
        />
      )}
    </>
  );
};

// ====================
// BADGES ESPECIFICOS
// ====================
export const BadgeActivo = (props) => (
  <BadgeEstado estado={ESTADOS_APP.ACTIVO} {...props} />
);

export const BadgeInactivo = (props) => (
  <BadgeEstado estado={ESTADOS_APP.INACTIVO} {...props} />
);

// Compatibilidad (antes se usaba "suspendido")
export const BadgeSuspendido = (props) => (
  <BadgeEstado estado={ESTADOS_APP.RETRASADO} {...props} />
);

export const BadgePendienteCompra = (props) => (
  <BadgeEstado estado={ESTADOS_APP.PENDIENTE} {...props} />
);

export const BadgeEnProceso = (props) => (
  <BadgeEstado estado={ESTADOS_APP.EN_PROCESO} {...props} />
);

export const BadgeCompletadoCompra = (props) => (
  <BadgeEstado estado={ESTADOS_APP.COMPLETADO} {...props} />
);

export const BadgeCanceladoCompra = (props) => (
  <BadgeEstado estado={ESTADOS_APP.CANCELADO} {...props} />
);

export const BadgeRetrasado = (props) => (
  <BadgeEstado estado={ESTADOS_APP.RETRASADO} {...props} />
);

export const BadgeAsistio = (props) => (
  <BadgeEstado estado={ESTADOS_APP.ASISTIO} {...props} />
);

export const BadgeNoAsistio = (props) => (
  <BadgeEstado estado={ESTADOS_APP.NO_ASISTIO} {...props} />
);

// Compatibilidad con nombres historicos de ventas
export const BadgePagada = (props) => (
  <BadgeEstado estado={ESTADOS_APP.COMPLETADO} {...props} />
);

export const BadgeAnulada = (props) => (
  <BadgeEstado estado={ESTADOS_APP.CANCELADO} {...props} />
);

export const BadgeDevuelta = (props) => (
  <BadgeEstado estado={ESTADOS_APP.CANCELADO} {...props} />
);

export const BadgeCompletado = (props) => (
  <BadgeEstado estado={ESTADOS_APP.COMPLETADO} {...props} />
);

export const BadgeCancelado = (props) => (
  <BadgeEstado estado={ESTADOS_APP.CANCELADO} {...props} />
);

export const BadgeEstadoPorId = ({ idEstado, ...props }) => (
  <BadgeEstado estado={idEstado} {...props} />
);

/**
 * Selector de estado personalizado
 */
export const SelectorEstado = ({
  estadoActual,
  onCambioEstado,
  opciones = [],
  tamano = "normal",
  campoControl = false,
  deshabilitado = false,
}) => {
  const tamanoClase = SIZE_CLASSES[tamano] || "badge-normal";
  const toneClass = getToneClass(estadoActual);

  return (
    <div className="selector-estado-container">
      <select
        className={[
          "selector-estado",
          campoControl ? "campo-control" : "",
          tamanoClase,
          toneClass,
          deshabilitado ? "selector-estado--disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        value={estadoActual}
        disabled={deshabilitado}
        onChange={(e) => {
          const nuevoEstado = e.target.value;
          if (nuevoEstado !== String(estadoActual) && onCambioEstado && !deshabilitado) {
            onCambioEstado(nuevoEstado);
          }
        }}
        title={deshabilitado ? "Este estado no puede modificarse" : "Cambiar estado"}
      >
        {opciones.map((opcion) => (
          <option
            key={opcion.value}
            value={opcion.value}
          >
            {opcion.label}
          </option>
        ))}
      </select>
      <span className={`selector-flecha ${deshabilitado ? "is-disabled" : ""}`}>
        ▼
      </span>
    </div>
  );
};

export default BadgeEstado;
