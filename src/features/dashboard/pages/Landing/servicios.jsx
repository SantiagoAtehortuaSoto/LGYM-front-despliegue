import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import NavegadorLanding from "../../../../shared/components/navegadorLanding";
import PieDePagina from "../../../../shared/components/piedepagina";
import { getMembresias } from "../../hooks/Membresia_API/Membresia";
/* Carrito */
import { useCarrito } from "../../../../shared/components/Carrito/carritoContext";
import CarritoCompras from "../../../../shared/components/Carrito/carrito";

/* Auth */
import useAuth from "../../hooks/useAuth";

/* Toasts */
import toast from "react-hot-toast";

/* Iconos */
import { IconShoppingCart } from "@tabler/icons-react";

/* ===== Mapas de estilo por tier ===== */
const TIER_TO_COLOR = {
  premium: { bg: "#FFD54D", fg: "#2B2B2B", letter: "P" }, // Amarillo
  medio: { bg: "#2ECC71", fg: "#FFFFFF", letter: "G" }, // Verde (General/Medio)
  basico: { bg: "#3498DB", fg: "#FFFFFF", letter: "B" }, // Azul (Básico)
};

/* Genera un data URL SVG con la inicial y color para usarlo como imagen del carrito */
function buildAvatarDataUrl({ tier = "basico", name = "" }) {
  const cfg = TIER_TO_COLOR[tier] ?? TIER_TO_COLOR.basico;
  const letter = cfg.letter || String(name).charAt(0).toUpperCase() || "P";

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <circle cx="40" cy="40" r="34" fill="${cfg.bg}" />
    </g>
    <text x="50%" y="54%" text-anchor="middle"
          font-family="Montserrat, Segoe UI, Arial, sans-serif"
          font-weight="800" font-size="34" fill="${cfg.fg}">
      ${letter}
    </text>
  </svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function Servicios() {
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef(null);

  // Panel del carrito
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  // Auth
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Guard reutilizable (muestra alerta y redirige)
  const requireAuth = () => {
    if (isLoggedIn) return true;
    toast.error("Debes iniciar sesión para usar el carrito");
    navigate("/acceder", {
      state: { from: location.pathname },
      replace: false,
    });
    return false;
  };

  // Contexto carrito (soporta varios nombres)
  const carritoCtx = useCarrito?.() ?? {};
  const {
    items,
    cart,
    carrito,
    totalItems,
    getCount,
    agregarProducto,
    addItem,
    addToCart,
    agregarAlCarrito,
  } = carritoCtx;

  const itemCount =
    typeof totalItems === "number"
      ? totalItems
      : typeof getCount === "function"
        ? Number(getCount()) || 0
        : Array.isArray(items)
          ? items.length
          : Array.isArray(cart)
            ? cart.length
            : Array.isArray(carrito)
              ? carrito.length
              : 0;

  // Datos remotos (membresías)
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [justAddedId, setJustAddedId] = useState(null);
  const [cartBumpKey, setCartBumpKey] = useState(0);

  // Helpers
  const formatCOP = (v) =>
    typeof v === "number"
      ? new Intl.NumberFormat("es-CO", {
          style: "currency",
          currency: "COP",
          maximumFractionDigits: 0,
        }).format(v)
      : v;

  const estadoToTag = (id_estado) => {
    if (id_estado === 1) return "Disponible";
    if (id_estado === 2) return "Promo";
    if (id_estado === 3) return "Agotado";
    return "Plan";
  };

  const getTier = (name = "") => {
    const n = String(name).toLowerCase();
    if (/(premium|oro|gold|pro)/.test(n)) return "premium";
    if (/(general|medio|medium|standard|estándar|estandar)/.test(n))
      return "medio";
    if (/(básico|basico|starter|inicial)/.test(n)) return "basico";
    return "basico";
  };

  const pickFeatured = (list) => {
    if (!Array.isArray(list) || list.length === 0) return list;
    let idx = list.findIndex((x) => /premium/i.test(x.name));
    if (idx < 0) {
      let max = -1;
      list.forEach((x, i) => {
        const p = Number(
          String(x.priceRaw ?? x.price ?? "0")
            .toString()
            .replace(/[^\d]/g, ""),
        );
        if (p > max) {
          max = p;
          idx = i;
        }
      });
    }
    return list.map((x, i) => ({ ...x, featured: i === idx }));
  };

  const normalizeFromApi = (raw) => {
    const arr = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];
    // Filtrar solo membresías activas (id_estado === 1)
    const membresiasActivas = arr.filter((it) => Number(it.id_estado) === 1);
    return membresiasActivas.map((it) => {
      const id =
        it.id ??
        it.id_membresia ??
        (crypto?.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`);
      const name = it.nombre_membresia ?? it.nombre ?? "Plan";
      const priceNumber =
        Number(it.precio_venta ?? it.precio_de_venta ?? 0) || 0;
      const desc = String(
        it.descripcion_membresia ?? it.descripcion ?? "",
      ).trim();

      const features =
        desc.length > 0
          ? desc
              .split(/[•\-\n\.]/)
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 6)
          : ["Acceso a instalaciones"];

      const tier = getTier(name);

      return {
        id,
        name,
        price: formatCOP(priceNumber),
        priceRaw: priceNumber,
        suffix: "/mes",
        cta: `Elegir ${name}`,
        tag: estadoToTag(Number(it.id_estado)),
        features,
        tier,
      };
    });
  };

  // Sticky header
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);

    const setHeaderVar = () => {
      const h = headerRef.current?.offsetHeight || 80;
      document.documentElement.style.setProperty("--header-h", `${h}px`);
    };

    setHeaderVar();
    const ro = new ResizeObserver(setHeaderVar);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener("resize", setHeaderVar);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", setHeaderVar);
      ro.disconnect();
    };
  }, []);

  // Cargar membresías
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await getMembresias({ query: {} });
        if (!mounted) return;

        const mapped = pickFeatured(normalizeFromApi(data));
        const ORDER = { basico: 1, medio: 2, premium: 3 };
        const ordered = mapped
          .slice()
          .sort((a, b) => (ORDER[a.tier] ?? 99) - (ORDER[b.tier] ?? 99));

        setPlanes(ordered);
      } catch (e) {
        if (!mounted) return;
        const errorMessage = "No se pudieron cargar las membresías";
        setErr(errorMessage);
        setPlanes([]);
        toast.error(errorMessage);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const headerClass = `inicio-cabeza ${isScrolled ? "scrolled" : ""}`;

  // Control del panel carrito
  const openCart = () => {
    if (!requireAuth()) return;
    setCarritoAbierto(true);
  };
  const closeCart = () => setCarritoAbierto(false);
  const toggleCart = () => {
    if (!requireAuth()) return;
    setCarritoAbierto((v) => !v);
  };

  // Feedback visual al agregar (NO abrir carrito)
  const handleAddedVisuals = (plan) => {
    toast.success(`${plan.name} agregado al carrito`);
    // animación/bump visual del FAB
    setJustAddedId(plan.id);
    setCartBumpKey((k) => k + 1);
    window.clearTimeout(handleAddedVisuals._t);
    handleAddedVisuals._t = window.setTimeout(() => setJustAddedId(null), 1200);
  };

  return (
    <>
      {loading && (
        <div
          className="loader-overlay"
          role="status"
          aria-live="polite"
          aria-label="Cargando"
        >
          <div className="loader" aria-hidden="true"></div>
          <p>Cargando servicios...</p>
        </div>
      )}

      <div ref={headerRef} className={headerClass}>
        <NavegadorLanding />
      </div>

      <section className="hero-fit" aria-label="Planes de membresía">
        <div className="hero-fit__inner">
          <h1 className="hero-fit__title">
            Eleva Tu Viaje de <span className="accent">Fitness</span>
          </h1>
          <p className="hero-fit__subtitle">
            Nuestros paquetes de acceso básico hasta premium están diseñados
            para alcanzar tus metas.
          </p>

          {!loading && err && (
            <p role="alert" className="landing-services-error">
              {err}
            </p>
          )}

          {!loading && !err && planes.length === 0 && (
            <p role="status" className="no-services">
              NO HAY MEMBRESÍAS DISPONIBLES
            </p>
          )}

          <div className="pricing-grid">
            {planes.map((p) => (
              <article
                key={p.id}
                className={`pricing-card variant-${p.tier} ${
                  p.featured ? "is-featured" : ""
                }`}
                aria-label={`Plan ${p.name}`}
              >
                {p.featured && (
                  <span className="pricing-crown" aria-hidden="true">
                    <svg
                      viewBox="0 0 64 32"
                      width="64"
                      height="32"
                      role="img"
                      aria-label="Premium"
                    >
                      <path
                        d="M6 26 L10 10 L22 18 L32 6 L42 18 L54 10 L58 26 Z"
                        fill="#FFD54D"
                        stroke="#B88A00"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </span>
                )}

                <span className="pricing-tag">{p.tag}</span>

                <header className="pricing-card__hdr">
                  {/* OJO: ya NO mostramos avatar aquí; solo en el carrito */}
                  <div className="pricing-card__hdrText">
                    <h3 className="pricing-card__title">{p.name}</h3>
                    <div className="pricing-card__price">
                      <span className="pricing-card__amount">{p.price}</span>
                      <span className="pricing-card__suffix">{p.suffix}</span>
                    </div>
                  </div>
                </header>

                <AddToCartButton
                  plan={p}
                  requireAuth={requireAuth}
                  agregarProducto={agregarProducto}
                  addItem={addItem}
                  addToCart={addToCart}
                  agregarAlCarrito={agregarAlCarrito}
                  isJustAdded={justAddedId === p.id}
                  onAdded={() => {
                    // NO abrir panel; solo feedback visual y toast
                    handleAddedVisuals(p);
                  }}
                />

                <ul className="pricing-card__list">
                  {p.features.map((f, i) => (
                    <li key={i} className="pricing-card__item">
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Panel del carrito (solo si hay sesión) */}
      {carritoAbierto && isLoggedIn && (
        <>
          <div className="carrito-overlay" onClick={closeCart} />
          <div className="carrito-sidebar">
            <CarritoCompras onClose={closeCart} />
          </div>
        </>
      )}

      {/* FAB con bump cuando se agrega */}
      <button
        key={cartBumpKey}
        type="button"
        className="cart-fab cart-fab--bump"
        aria-label={`Abrir carrito. ${itemCount} artículo(s)`}
        onClick={toggleCart}
      >
        <IconShoppingCart size={22} />
        {itemCount > 0 && (
          <span className="cart-fab__badge cart-fab__badge--blink">
            {itemCount}
          </span>
        )}
      </button>

      <PieDePagina />
    </>
  );
}

/** Botón que agrega al carrito e inserta el avatar como imagen del ítem del carrito */
function AddToCartButton({
  plan,
  onAdded,
  agregarProducto,
  addItem,
  addToCart,
  agregarAlCarrito,
  isJustAdded,
  requireAuth,
}) {
  const handleAdd = () => {
    // Bloqueo si no hay sesión
    if (typeof requireAuth === "function" && !requireAuth()) return;

    const precio =
      typeof plan.priceRaw === "number"
        ? plan.priceRaw
        : Number(String(plan.price ?? "").replace(/[^\d]/g, "")) || 0;

    // ← Aquí generamos el avatar para el CARRITO
    const avatar = buildAvatarDataUrl({ tier: plan.tier, name: plan.name });

    const payload = {
      id: plan.id,
      nombre: plan.name,
      precio,
      cantidad: 1,
      tipo: "membresia",
      // Set de campos comunes para imagen: maximiza compatibilidad con distintos carritos
      imagen: avatar,
      image: avatar,
      img: avatar,
      thumb: avatar,
      foto: avatar,
      // meta adicional
      meta: {
        tier: plan.tier,
        tag: plan.tag,
        avatarBg: (TIER_TO_COLOR[plan.tier] || TIER_TO_COLOR.basico).bg,
        avatarFg: (TIER_TO_COLOR[plan.tier] || TIER_TO_COLOR.basico).fg,
        avatarLetter: (TIER_TO_COLOR[plan.tier] || TIER_TO_COLOR.basico).letter,
        avatarDataUrl: avatar,
      },
    };

    if (typeof agregarProducto === "function") agregarProducto(payload);
    else if (typeof addItem === "function") addItem(payload);
    else if (typeof addToCart === "function") addToCart(payload);
    else if (typeof agregarAlCarrito === "function") agregarAlCarrito(payload);
    else console.warn("useCarrito no expone un método de agregado reconocido.");

    if (typeof onAdded === "function") onAdded();
  };

  return (
    <button
      className={`pricing-btn pricing-btn--${plan.tier} ${
        plan.featured ? "is-featured-btn" : ""
      } ${isJustAdded ? "btn--added" : ""}`}
      type="button"
      aria-label={plan.cta}
      onClick={handleAdd}
      disabled={plan.tag === "Agotado"}
    >
      {isJustAdded ? "Agregado ✓" : plan.cta}
    </button>
  );
}

export default Servicios;
