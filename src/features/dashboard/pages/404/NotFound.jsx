import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <section className="nf-wrapper">
      <div className="nf-glow" aria-hidden="true" />
      <div className="nf-card">
        <div className="nf-hero">
          {/* SVG del “sujeto con pesas” */}
          <svg
            className="nf-lifter"
            viewBox="0 0 240 220"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Persona confundida levantando pesas"
          >
            {/* barra y discos */}
            <g className="barbell">
              <rect x="30" y="76" width="180" height="8" rx="4" />
              <rect x="20" y="68" width="10" height="24" rx="3" />
              <rect x="210" y="68" width="10" height="24" rx="3" />
            </g>

            {/* brazos */}
            <g className="arms">
              <path d="M90 80 Q120 100 120 120" fill="none" strokeWidth="8" strokeLinecap="round"/>
              <path d="M150 80 Q120 100 120 120" fill="none" strokeWidth="8" strokeLinecap="round"/>
            </g>

            {/* cuerpo */}
            <circle className="head" cx="120" cy="40" r="16" />
            <rect className="body" x="110" y="56" width="20" height="42" rx="8" />
            <path className="leg" d="M120 98 L100 130" strokeWidth="8" strokeLinecap="round" fill="none"/>
            <path className="leg" d="M120 98 L140 130" strokeWidth="8" strokeLinecap="round" fill="none"/>

            {/* carita confundida */}
            <circle className="eye" cx="115" cy="38" r="2.5" />
            <circle className="eye" cx="125" cy="38" r="2.5" />
            <path className="mouth" d="M114 45 q6 -6 12 0" fill="none" strokeWidth="3" strokeLinecap="round"/>

            {/* signos de pregunta */}
            <g className="qmarks">
              <path d="M165 25 q10 -14 -4 -20 q-10 -4 -16 4" fill="none" strokeWidth="4" strokeLinecap="round"/>
              <circle cx="166" cy="34" r="3" />
              <path d="M70 20 q-10 -14 4 -20 q10 -4 16 4" fill="none" strokeWidth="4" strokeLinecap="round"/>
              <circle cx="74" cy="30" r="3" />
            </g>
          </svg>

          <div className="nf-title">
            <h1>404</h1>
            <p>¡Uy! Esa ruta no tiene músculos todavía.</p>
          </div>
        </div>

        <div className="nf-actions">
          <Link to="/" className="nf-btn">Volver al inicio</Link>
          <Link to="/productos" className="nf-link">Ver planes y productos</Link>
        </div>
      </div>
    </section>
  );
}
