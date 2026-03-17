import React from "react";
/**
 * Componente: Señor levantando pesas (SVG animado)
 * Props opcionales:
 * - size: tamaño en px (ancho) del SVG (default 220)
 * - speed: duración del ciclo de animación en segundos (default 1.8)
 * - className: clase extra para el contenedor
 * - colors: { skin, shirt, pants, bar, plate, shoes }
 */
const SenorLevantandoPesas = ({
  size = 220,
  speed = 1.8,
  className = "",
  colors = {},
  title = "Señor levantando pesas",
}) => {
  const palette = {
    skin: colors.skin || "#F4C7A1",
    shirt: colors.shirt || "#EF4444", // rojo
    pants: colors.pants || "#1F2937", // gris oscuro
    bar: colors.bar || "#111827",
    plate: colors.plate || "#9CA3AF",
    shoes: colors.shoes || "#111827",
  };

  const resolvedSize = Number(size);
  const safeSize = Number.isFinite(resolvedSize) ? Math.max(80, resolvedSize) : 220;
  const speedClass = (() => {
    const numeric = Number(speed);
    if (!Number.isFinite(numeric)) return "slp-speed-normal";
    if (numeric <= 1.2) return "slp-speed-fast";
    if (numeric <= 1.8) return "slp-speed-normal";
    if (numeric <= 2.4) return "slp-speed-slow";
    return "slp-speed-xslow";
  })();

  return (
    <div
      className={`slp-wrapper ${speedClass} ${className}`}
      role="img"
      aria-label={title}
    >
      <svg
        viewBox="0 0 200 200"
        width={safeSize}
        className="slp-svg"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="false"
      >
        <title>{title}</title>
        {/* Suelo sombra */}
        <ellipse cx="100" cy="186" rx="46" ry="8" fill="#E5E7EB" />

        {/* Piernas */}
        <g className="slp-legs" fill={palette.pants}>
          <rect x="78" y="120" width="14" height="48" rx="6" />
          <rect x="108" y="120" width="14" height="48" rx="6" />
        </g>
        {/* Zapatos */}
        <g fill={palette.shoes}>
          <rect x="72" y="166" width="26" height="8" rx="3" />
          <rect x="102" y="166" width="26" height="8" rx="3" />
        </g>

        {/* Torso con respiración sutil */}
        <g className="slp-torso slp-breath">
          <rect x="80" y="86" width="40" height="36" rx="8" fill={palette.shirt} />
        </g>

        {/* Cabeza */}
        <g className="slp-head">
          <circle cx="100" cy="72" r="16" fill={palette.skin} />
          {/* Ojos */}
          <circle cx="94" cy="70" r="2" fill="#111827" />
          <circle cx="106" cy="70" r="2" fill="#111827" />
          {/* Boca */}
          <path d="M92 77 Q100 82 108 77" stroke="#111827" strokeWidth="2" fill="none" />
        </g>

        {/* Brazos + barra animados (del pecho a sobre la cabeza) */}
        <g className="slp-press">
          {/* Brazos */}
          <g fill={palette.skin}>
            {/* Brazos superiores */}
            <rect x="64" y="90" width="16" height="12" rx="6" />
            <rect x="120" y="90" width="16" height="12" rx="6" />
            {/* Antebrazos */}
            <rect x="60" y="96" width="20" height="12" rx="6" />
            <rect x="120" y="96" width="20" height="12" rx="6" />
          </g>

          {/* Barra y discos */}
          <g className="slp-barbell">
            {/* Barra */}
            <rect x="30" y="98" width="140" height="6" rx="3" fill={palette.bar} />
            {/* Discos izquierdos */}
            <rect x="36" y="92" width="8" height="18" rx="2" fill={palette.plate} />
            <rect x="46" y="94" width="6" height="14" rx="2" fill={palette.plate} />
            {/* Discos derechos */}
            <rect x="156" y="92" width="8" height="18" rx="2" fill={palette.plate} />
            <rect x="148" y="94" width="6" height="14" rx="2" fill={palette.plate} />
            {/* Manos */}
            <rect x="80" y="96" width="10" height="10" rx="3" fill={palette.skin} />
            <rect x="110" y="96" width="10" height="10" rx="3" fill={palette.skin} />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default SenorLevantandoPesas;
