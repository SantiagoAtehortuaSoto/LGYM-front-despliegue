import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/* Contexto del carrito */
import { useCarrito } from "../../../../shared/components/Carrito/carritoContext";
import CarritoCompras from "../../../../shared/components/Carrito/carrito";

/* API */
import { getProductos } from "../../../dashboard/hooks/Productos_API_Landing/API_Productos_Landing";

/* Toast (acciones de carrito / errores) */
import toast from "react-hot-toast";

/* Layout */
import NavegadorLanding from "../../../../shared/components/navegadorLanding";
import PieDePagina from "../../../../shared/components/piedepagina";

/* Estilos */
/* Iconos */
import {
  IconSearch,
  IconShoppingCart,
  IconAlertCircle,
  IconShare,
  IconX,
} from "@tabler/icons-react";

/* Utils */
const normCat = (x) =>
  String(x ?? "")
    .trim()
    .toLowerCase();
const normalizeImgUrl = (raw) => {
  if (!raw) return null;
  const url = String(raw).trim();
  const i = url.indexOf("?");
  if (i === -1) return url;
  const base = url.slice(0, i);
  const q = url.slice(i + 1).replace(/\?/g, "&"); // deja solo un "?" y el resto "&"
  return `${base}?${q}`;
};

const getStockNumber = (stock) => {
  const parsed = Number(stock);
  return Number.isFinite(parsed) ? parsed : null;
};
const getStockInfo = (stock) => {
  const stockNumber = getStockNumber(stock);
  if (stockNumber === null) {
    return { label: "Cantidad no informada", state: "unknown" };
  }
  if (stockNumber <= 0) {
    return { label: "Sin cantidad disponible", state: "out" };
  }
  const unidades = Number.isInteger(stockNumber) ? stockNumber : stockNumber;
  return {
    label: `Cantidad disponible: ${unidades}`,
    state: "available",
  };
};
const ORDER_CREATED_EVENT = "landing:orden-creada";

/** Imagen segura */
const SafeImg = ({ src, alt, className }) => {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setOk(false)}
    />
  );
};

const ProductosLanding = ({ isLoggedIn }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { agregarProducto, cantidadTotal, items } = useCarrito();

  // FAB (destino de la animación)
  const fabRef = useRef(null);
  const [fabBumpKey, setFabBumpKey] = useState(0);

  const [activo, setActivo] = useState(0);
  const [categoria, setCategoria] = useState("suplementos");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaInput, setBusquedaInput] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [productoModal, setProductoModal] = useState(null);

  // API state
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiSuplementos, setApiSuplementos] = useState([]);
  const [intentosCarga, setIntentosCarga] = useState(0);

  /*
    Helper: exigir sesión
   */
  const requireAuth = () => {
    if (isLoggedIn) return true;
    toast.error("Debes iniciar sesión para usar el carrito");
    // guarda a dónde estaba para volver después del login
    navigate("/acceder", {
      state: { from: location.pathname },
      replace: false,
    });
    return false;
  };

  /*
    Cargar productos
   */
  useEffect(() => {
    let cancelado = false;

    const cargarProductos = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        const data = await getProductos({ timeoutMs: 10000, headers: {} });
        if (cancelado) return;
        if (!Array.isArray(data))
          throw new Error("La respuesta del servidor no es un array válido");

        const mapped = data
          .filter((item) => item?.id_estados !== 2) // Filtrar productos inactivos
          .map((item, idx) => {
            const rawUrl =
              item?.imagen_url ?? item?.imagenUrl ?? item?.imagen ?? null;
            return {
              id: String(item?.id_productos ?? item?.id ?? `sup-${idx}`),
              nombre: item?.nombre_producto ?? item?.nombre ?? "Sin nombre",
              descripcion:
                item?.descripcion_producto ??
                item?.descripcion ??
                "Sin descripción",
              precio: Number(item?.precio_venta_producto ?? item?.precio ?? 0),
              imagen: normalizeImgUrl(rawUrl),
              categoria: item?.categoria ?? "Suplementos",
              stock: item?.stock ?? null,
              estadoId: item?.id_estados ?? null,
            };
          });

        setApiSuplementos(mapped);
      } catch (error) {
        if (cancelado) return;
        const msg = error?.message || "Error al cargar productos del servidor";
        setErrorMsg(msg);
        toast.error("No se pudo cargar la tienda. Intenta nuevamente.");
        setApiSuplementos([]);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargarProductos();
    return () => {
      cancelado = true;
    };
  }, [intentosCarga]);

  useEffect(() => {
    const onOrderCreated = () => setIntentosCarga((prev) => prev + 1);
    window.addEventListener(ORDER_CREATED_EVENT, onOrderCreated);
    return () => window.removeEventListener(ORDER_CREATED_EVENT, onOrderCreated);
  }, []);

  const reintentarCarga = () => setIntentosCarga((p) => p + 1);

  /*
    Header sticky
   */
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const headerClass = `inicio-cabeza ${isScrolled ? "scrolled" : ""}`;

  /*
    Catálogo y destacados
   */
  const catalogo = {
    suplementos: apiSuplementos.filter(
      (p) => normCat(p.categoria) === "suplementos" || !normCat(p.categoria)
    ),
    bebidas: apiSuplementos.filter((p) => normCat(p.categoria) === "bebidas"),
  };

  const destacadosCategoria = (catalogo[categoria] || []).slice(0, 4);
  const productoDestacado = destacadosCategoria[activo];
  const heroThemeClass =
    categoria === "bebidas"
      ? "productos-landing--theme-bebidas"
      : "productos-landing--theme-default";
  const stockDestacado = getStockNumber(productoDestacado?.stock);
  const stockInfoDestacado = getStockInfo(productoDestacado?.stock);

  const getCantidadEnCarrito = (productoId) => {
    const itemEnCarrito = items.find(
      (item) => String(item.id) === String(productoId)
    );
    return Number(itemEnCarrito?.cantidad ?? 0);
  };

  const estaEnLimiteStock = (producto) => {
    const stockDisponible = getStockNumber(producto?.stock);
    if (stockDisponible === null) return false;
    return getCantidadEnCarrito(producto.id) >= stockDisponible;
  };

  const productoDestacadoAgotado =
    stockDestacado !== null && stockDestacado <= 0;
  const productoDestacadoConLimite = productoDestacado
    ? estaEnLimiteStock(productoDestacado)
    : false;

  useEffect(() => {
    setActivo(0);
  }, [categoria]);

  const aplicarBusqueda = useCallback(() => {
    setBusqueda(busquedaInput);
  }, [busquedaInput]);

  const terminoBusqueda = busqueda.trim().toLowerCase();
  const esBusquedaGlobal = terminoBusqueda.length > 0;
  const baseFiltrado = esBusquedaGlobal
    ? apiSuplementos
    : (catalogo[categoria] || []);

  const productosFiltrados = baseFiltrado.filter((prod) => {
    const textoBusqueda = [
      prod?.nombre ?? "",
      prod?.descripcion ?? "",
      prod?.categoria ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return textoBusqueda.includes(terminoBusqueda);
  });

  /*
    Feedback FAB (bump)
   */
  const prevCantRef = useRef(cantidadTotal);
  useEffect(() => {
    if ((prevCantRef.current ?? 0) < (cantidadTotal ?? 0)) {
      setFabBumpKey((k) => k + 1);
    }
    prevCantRef.current = cantidadTotal;
  }, [cantidadTotal]);

  /*
    Agregar al carrito + animación
   */
  const actualizarProductoEnUrl = (productoId) => {
    const params = new URLSearchParams(location.search);
    if (productoId) {
      params.set("producto", productoId);
    } else {
      params.delete("producto");
    }

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true }
    );
  };

  const buildProductoShareUrl = (productoId) => {
    if (typeof window === "undefined") return "";

    const shareUrl = new URL(`${window.location.origin}${location.pathname}`);
    const currentParams = new URLSearchParams(location.search);
    currentParams.forEach((value, key) => {
      if (key !== "producto") {
        shareUrl.searchParams.set(key, value);
      }
    });
    shareUrl.searchParams.set("producto", productoId);
    return shareUrl.toString();
  };

  const abrirDetalleProducto = (producto) => {
    if (!producto) return;
    setProductoModal(producto);
    actualizarProductoEnUrl(producto.id);
  };

  const cerrarDetalleProducto = () => {
    setProductoModal(null);
    actualizarProductoEnUrl(null);
  };

  const compartirProducto = async (producto) => {
    if (!producto?.id) return;

    const url = buildProductoShareUrl(producto.id);
    if (!url) {
      toast.error("No se pudo generar el enlace del producto.");
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const helperInput = document.createElement("input");
        helperInput.value = url;
        document.body.appendChild(helperInput);
        helperInput.select();
        document.execCommand("copy");
        document.body.removeChild(helperInput);
      }
      toast.success("Enlace del producto copiado.");
    } catch {
      toast.error("No se pudo copiar el enlace del producto.");
    }
  };

  useEffect(() => {
    const productoId = new URLSearchParams(location.search).get("producto");
    if (!productoId) {
      setProductoModal(null);
      return;
    }

    const productoDesdeUrl = apiSuplementos.find(
      (item) => String(item.id) === String(productoId)
    );
    if (productoDesdeUrl) {
      setProductoModal(productoDesdeUrl);
    }
  }, [apiSuplementos, location.search]);

  useEffect(() => {
    if (!productoModal) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        cerrarDetalleProducto();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [productoModal, location.pathname, location.search]);

  const handleCompra = (producto, e) => {
    // Si no hay sesión, mandamos a login y terminamos
    if (!requireAuth()) return;
    const stockDisponible = getStockNumber(producto?.stock);
    const cantidadEnCarrito = getCantidadEnCarrito(producto.id);

    if (stockDisponible !== null && stockDisponible <= 0) {
      toast.error("El producto esta agotado.");
      return;
    }

    if (stockDisponible !== null && cantidadEnCarrito >= stockDisponible) {
      toast.error(
        `No puedes agregar mas unidades de ${producto.nombre}. Limite: ${stockDisponible}.`
      );
      return;
    }

    const card = e?.target?.closest?.(".card");
    const modal = e?.target?.closest?.(".producto-modal");
    const imgEl = card
      ? card.querySelector("img")
      : modal?.querySelector("img") || document.querySelector(".pl-image");
    if (imgEl) animarAlCarrito(imgEl);

    const item = {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: Number(producto.precio || 0),
      imagen: producto.imagen ?? null,
      cantidad: 1,
      stock: stockDisponible,
      tipo: "producto",
    };

    agregarProducto(item); // no abre panel; solo suma
    toast.success(`${producto.nombre} agregado al carrito`);
  };

  const animarAlCarrito = (imgEl) => {
    const target = fabRef.current;
    if (!imgEl || !target) return;

    const imgRect = imgEl.getBoundingClientRect();
    const cartRect = target.getBoundingClientRect();

    const clone = imgEl.cloneNode(true);
    Object.assign(clone.style, {
      position: "fixed",
      left: `${imgRect.left + window.scrollX}px`,
      top: `${imgRect.top + window.scrollY}px`,
      width: `${imgRect.width}px`,
      height: `${imgRect.height}px`,
      transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
      zIndex: 9999,
      pointerEvents: "none",
      borderRadius: "8px",
      boxShadow: "0 10px 20px rgba(0,0,0,0.2) ",
      transform: "translateZ(0)",
      willChange: "transform, opacity",
    });

    document.body.appendChild(clone);
    void clone.offsetWidth;

    requestAnimationFrame(() => {
      Object.assign(clone.style, {
        left: `${cartRect.left + cartRect.width / 2 - 10}px`,
        top: `${cartRect.top + cartRect.height / 2 - 10}px`,
        width: "20px",
        height: "20px",
        opacity: "0.6",
        transform: "scale(0.8)",
      });
    });

    clone.addEventListener(
      "transitionend",
      () => {
        if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
      },
      { once: true }
    );
  };

  return (
    <>
      {loading && (
        <div className="loader-overlay">
          <div className="loader"></div>
          <p>Cargando tienda...</p>
        </div>
      )}

      <div className={headerClass}>
        <NavegadorLanding />
      </div>

      {/* HERO */}
      {destacadosCategoria.length > 0 && productoDestacado ? (
        <section className={`productos-landing ${heroThemeClass}`}>
          <div className="pl-inner">
            <div className="pl-text">
              <h1 className="pl-title">{productoDestacado.nombre}</h1>
              <p className="pl-desc">{productoDestacado.descripcion}</p>
              <p
                className={`pl-stock pl-stock--${stockInfoDestacado.state}`}
                aria-live="polite"
              >
                {stockInfoDestacado.label}
              </p>
              <div className="pl-actions-row">
                <button
                  type="button"
                  className="pl-detail-btn"
                  onClick={() => abrirDetalleProducto(productoDestacado)}
                >
                  Ver detalles
                </button>
                <button
                  className="pl-cta"
                  onClick={(e) => handleCompra(productoDestacado, e)}
                  disabled={productoDestacadoAgotado || productoDestacadoConLimite}
                  title={
                    productoDestacadoAgotado
                      ? "Producto agotado"
                      : productoDestacadoConLimite
                        ? "Limite de stock alcanzado en el carrito"
                        : undefined
                  }
                >
                  Comprar ahora
                </button>
              </div>
            </div>
            <div className="pl-visual">
              <SafeImg
                key={productoDestacado.id}
                src={productoDestacado.imagen}
                alt={productoDestacado.nombre}
                className="pl-image"
              />
            </div>
          </div>

          <div className="pl-thumbs">
            {destacadosCategoria.map((item, idx) => (
              <button
                key={item.id}
                className={`pl-thumb ${idx === activo ? "is-active" : ""}`}
                onClick={() => setActivo(idx)}
              >
                <SafeImg src={item.imagen} alt={item.nombre} />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className={`productos-landing vacío ${heroThemeClass}`}>
          <div className="pl-inner">
            <div className="pl-text">
              <h1 className="pl-title">Productos</h1>
              <p className="pl-desc">Explora nuestra tienda.</p>
            </div>
          </div>
        </section>
      )}

      {/* TIENDA */}
      <section className="Tienda-Productos">
        <div className="tienda-header">
          <div className="tienda-title">
            <h4>
              NUESTROS PRODUCTOS{" "}
              <small className="tienda-title-count">
                (
                {esBusquedaGlobal
                  ? productosFiltrados.length
                  : (catalogo[categoria] || []).length}
                )
              </small>
            </h4>
          </div>

          <div className="tienda-actions">
            <div className="categorias">
              <button
                className={`pill ${
                  categoria === "suplementos" ? "activo" : ""
                }`}
                onClick={() => setCategoria("suplementos")}
              >
                Suplementos
              </button>
              <button
                className={`pill ${categoria === "bebidas" ? "activo" : ""}`}
                onClick={() => setCategoria("bebidas")}
              >
                Bebidas
              </button>
            </div>

            <div className="buscador-carrito">
              <div className="buscador">
                <input
                  type="text"
                  placeholder="Busca aquí..."
                  value={busquedaInput}
                  onChange={(e) => setBusquedaInput(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      aplicarBusqueda();
                    }
                  }}
                />
                <button
                  type="button"
                  className="icono-buscar"
                  aria-label="Buscar productos"
                  onClick={aplicarBusqueda}
                >
                  <IconSearch size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {!loading && errorMsg && (catalogo[categoria] || []).length === 0 && (
          <div className="error-panel">
            <IconAlertCircle size={32} />
            <div>
              <p className="error-panel-message">{errorMsg}</p>
              <button
                className="productos-btn productos-btn--retry"
                onClick={reintentarCarga}
              >
                Reintentar conexión
              </button>
            </div>
          </div>
        )}

        {!loading && (
          <div className="productos-grid pretty">
            {productosFiltrados.length > 0 ? (
              productosFiltrados.map((prod) => {
                const stockProducto = getStockNumber(prod.stock);
                const stockInfoProducto = getStockInfo(prod.stock);
                const hayStock =
                  stockProducto === null ? true : stockProducto > 0;
                const limiteStockAlcanzado = estaEnLimiteStock(prod);
                const bloquearAgregar = !hayStock || limiteStockAlcanzado;
                return (
                  <div
                    key={prod.id}
                    className="card product"
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirDetalleProducto(prod)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        abrirDetalleProducto(prod);
                      }
                    }}
                    aria-label={`Ver detalles de ${prod.nombre}`}
                  >
                    <div className="product-img">
                      <SafeImg src={prod.imagen} alt={prod.nombre} />
                    </div>

                    <div className="product-body">
                      <h5 className="product-title">{prod.nombre}</h5>
                      {prod.descripcion && (
                        <p className="product-desc">{prod.descripcion}</p>
                      )}
                      <p
                        className={`product-stock product-stock--${stockInfoProducto.state}`}
                      >
                        {stockInfoProducto.label}
                      </p>

                      <div className="product-meta">
                        {hayStock ? (
                          <span className="badge-available">Disponible</span>
                        ) : (
                          <span className="badge-out">Agotado</span>
                        )}

                        <span className="precio">
                          <span className="currency">$</span>
                          <span className="amount">
                            {Number(prod.precio || 0).toLocaleString("es-CO")}
                          </span>
                          <span className="suffix"> COP</span>
                        </span>
                      </div>

                      <div className="product-footer">
                        <button
                          className="boton-agregar btn-cta"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompra(prod, e);
                          }}
                          disabled={bloquearAgregar}
                          title={
                            !isLoggedIn
                              ? "Inicia sesión para agregar"
                              : !hayStock
                                ? "Producto agotado"
                                : limiteStockAlcanzado
                                  ? "Limite de stock alcanzado en el carrito"
                                  : undefined
                          }
                          aria-disabled={bloquearAgregar}
                        >
                          <IconShoppingCart size={20} /> Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="muted">
                {esBusquedaGlobal
                  ? "No se encontraron productos que coincidan con tu búsqueda."
                  : categoria === "bebidas"
                  ? "Aún no tenemos bebidas disponibles."
                  : "No se encontraron productos que coincidan con tu búsqueda."}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Panel lateral del carrito (guardado por sesión) */}
      {productoModal && (
        <>
          <div
            className="producto-modal-backdrop"
            onClick={cerrarDetalleProducto}
            aria-hidden="true"
          />
          <div
            className="producto-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="producto-modal-title"
          >
            <button
              type="button"
              className="producto-modal__close"
              onClick={cerrarDetalleProducto}
              aria-label="Cerrar detalle del producto"
            >
              <IconX size={20} />
            </button>

            <div className="producto-modal__media">
              <SafeImg
                src={productoModal.imagen}
                alt={productoModal.nombre}
                className="producto-modal__image"
              />
            </div>

            <div className="producto-modal__content">
              <span className="producto-modal__eyebrow">
                {productoModal.categoria || "Producto"}
              </span>
              <h2 id="producto-modal-title" className="producto-modal__title">
                {productoModal.nombre}
              </h2>
              <p className="producto-modal__description">
                {productoModal.descripcion || "Sin descripción disponible."}
              </p>

              <div className="producto-modal__stats">
                <div className="producto-modal__price">
                  <span className="producto-modal__price-label">Precio</span>
                  <strong>
                    ${Number(productoModal.precio || 0).toLocaleString("es-CO")} COP
                  </strong>
                </div>
                <div
                  className={`producto-modal__stock producto-modal__stock--${
                    getStockInfo(productoModal.stock).state
                  }`}
                >
                  {getStockInfo(productoModal.stock).label}
                </div>
              </div>

              <div className="producto-modal__actions">
                <button
                  type="button"
                  className="producto-modal__share"
                  onClick={() => compartirProducto(productoModal)}
                >
                  <IconShare size={18} />
                  Compartir
                </button>
                <button
                  type="button"
                  className="producto-modal__cart"
                  onClick={(e) => handleCompra(productoModal, e)}
                  disabled={
                    getStockNumber(productoModal.stock) !== null &&
                    getStockNumber(productoModal.stock) <= 0
                      ? true
                      : estaEnLimiteStock(productoModal)
                  }
                >
                  <IconShoppingCart size={18} />
                  Agregar al carrito
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {carritoAbierto && isLoggedIn && (
        <>
          <div
            className="carrito-overlay"
            onClick={() => setCarritoAbierto(false)}
          />
          <aside className="carrito-sidebar">
            <CarritoCompras onClose={() => setCarritoAbierto(false)} />
          </aside>
        </>
      )}

      {/* FAB abajo a la derecha: si no hay sesión, manda al login */}
      <button
        key={fabBumpKey}
        ref={fabRef}
        type="button"
        className="cart-fab cart-fab--bump"
        aria-label={`Abrir carrito. ${cantidadTotal || 0} artículo(s)`}
        onClick={() => {
          if (!requireAuth()) return;
          setCarritoAbierto((v) => !v);
        }}
      >
        <IconShoppingCart size={22} />
        {(cantidadTotal || 0) > 0 && (
          <span className="cart-fab__badge">{cantidadTotal}</span>
        )}
      </button>

      <PieDePagina />
    </>
  );
};

export default ProductosLanding;
