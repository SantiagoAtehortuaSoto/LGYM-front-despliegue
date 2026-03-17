import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { DescargarComprobante } from "./descargarComprobante";
import { useCarrito } from "../../components/Carrito/carritoContext";

const CarritoCompras = ({ onClose }) => {
  const {
    items,
    eliminarProducto,
    agregarProducto,
    borrarProducto,
    actualizarCantidadProducto,
    vaciarCarrito,
    total,
  } =
    useCarrito();
  const [cantidadDrafts, setCantidadDrafts] = useState({});
  const [cantidadErrores, setCantidadErrores] = useState({});
  const [avisoLimiteStock, setAvisoLimiteStock] = useState("");

  const getStockDisponible = (item) => {
    const stock = Number(item?.stock);
    if (!Number.isFinite(stock)) return null;
    return Math.max(0, Math.floor(stock));
  };

  const superaStock = (item) => {
    const stockDisponible = getStockDisponible(item);
    return stockDisponible !== null && item.cantidad > stockDisponible;
  };

  const alcanzoMaximoStock = (item) => {
    const stockDisponible = getStockDisponible(item);
    return stockDisponible !== null && item.cantidad >= stockDisponible;
  };

  const productoConLimite = items.find((item) => superaStock(item));
  const bloquearAccionesPorStock = Boolean(productoConLimite);
  const avisoStock = productoConLimite
    ? (() => {
        const stockDisponible = getStockDisponible(productoConLimite);
        if (stockDisponible === 0) {
          return `No puede agregar ${productoConLimite.nombre}: producto agotado.`;
        }
        return `No puede generar la orden porque ${productoConLimite.nombre} supera el stock disponible (${stockDisponible}).`;
      })()
    : "";

  const formatoCOP = (valor) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(valor);

  const subtotal = items.reduce(
    (acc, item) => acc + item.precio * item.cantidad,
    0
  );

  useEffect(() => {
    setCantidadDrafts(() => {
      const next = {};
      items.forEach((item) => {
        next[item.id] = String(item.cantidad);
      });
      return next;
    });
  }, [items]);

  useEffect(() => {
    setCantidadErrores((prev) => {
      const next = {};
      items.forEach((item) => {
        if (prev[item.id]) {
          next[item.id] = prev[item.id];
        }
      });
      return next;
    });
  }, [items]);

  useEffect(() => {
    if (!avisoLimiteStock) return undefined;

    const timer = window.setTimeout(() => {
      setAvisoLimiteStock("");
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [avisoLimiteStock]);

  const setErrorCantidad = (itemId, mensaje = "") => {
    setCantidadErrores((prev) => {
      if (!mensaje) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: mensaje };
    });
  };

  const mostrarAvisoLimiteStock = (item, stockDisponible) => {
    if (stockDisponible === null) return;

    const totalDisponible = Math.max(1, Number(stockDisponible) || 1);
    setAvisoLimiteStock(
      `La cantidad en el pedido de ${item?.nombre || "este producto"} se ajusto a ${totalDisponible} unidad(es), que es el maximo disponible.`
    );
  };

  const actualizarCantidadDraft = (item, valorNormalizado) => {
    if (valorNormalizado === "") {
      setCantidadDrafts((prev) => ({
        ...prev,
        [item.id]: "",
      }));
      setErrorCantidad(item.id, "");
      return;
    }

    const stockDisponible = getStockDisponible(item);
    const cantidadNumerica = Number.parseInt(valorNormalizado, 10);
    const valorFinal =
      Number.isFinite(cantidadNumerica) &&
      stockDisponible !== null &&
      cantidadNumerica > stockDisponible
        ? String(stockDisponible)
        : valorNormalizado;

    if (
      Number.isFinite(cantidadNumerica) &&
      stockDisponible !== null &&
      cantidadNumerica > stockDisponible
    ) {
      mostrarAvisoLimiteStock(item, stockDisponible);
    }

    setCantidadDrafts((prev) => ({
      ...prev,
      [item.id]: valorFinal,
    }));
    if (valorFinal === "0") {
      setErrorCantidad(item.id, "La cantidad minima es 1.");
      return;
    }

    setErrorCantidad(item.id, "");
  };

  const handleCantidadInputChange = (item, rawValue) => {
    const valorNormalizado = rawValue.replace(/\s+/g, "");
    if (valorNormalizado !== "" && !/^\d+$/.test(valorNormalizado)) {
      return;
    }

    actualizarCantidadDraft(item, valorNormalizado);
  };

  const handleCantidadInputBlur = (item) => {
    const draftValue = cantidadDrafts[item.id];
    const valor = String(draftValue ?? "").trim();
    const stockDisponible = getStockDisponible(item);

    if (!valor || !/^\d+$/.test(valor)) {
      setCantidadDrafts((prev) => ({
        ...prev,
        [item.id]: String(item.cantidad),
      }));
      setErrorCantidad(item.id, "");
      return;
    }

    const cantidad = Number.parseInt(valor, 10);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      const cantidadMinima = 1;
      flushSync(() => {
        actualizarCantidadProducto(item.id, cantidadMinima);
      });
      setCantidadDrafts((prev) => ({
        ...prev,
        [item.id]: String(cantidadMinima),
      }));
      setErrorCantidad(item.id, "");
      return;
    }

    const cantidadFinal =
      stockDisponible !== null ? Math.min(cantidad, stockDisponible) : cantidad;
    flushSync(() => {
      actualizarCantidadProducto(item.id, cantidadFinal);
    });
    setCantidadDrafts((prev) => ({
      ...prev,
      [item.id]: String(cantidadFinal),
    }));
    setErrorCantidad(item.id, "");
  };

  const resolverItemsParaOrden = () => {
    const nextErrors = {};
    const nextDrafts = {};
    const actualizaciones = [];

    const itemsNormalizados = items.map((item) => {
      const draftValue = cantidadDrafts[item.id] ?? String(item.cantidad);
      const valor = String(draftValue ?? "").trim();
      const stockDisponible = getStockDisponible(item);

      if (!valor || !/^\d+$/.test(valor)) {
        nextErrors[item.id] = "Ingresa una cantidad.";
        nextDrafts[item.id] = draftValue;
        return item;
      }

      const cantidad = Number.parseInt(valor, 10);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        nextErrors[item.id] = "La cantidad minima es 1.";
        nextDrafts[item.id] = draftValue;
        return item;
      }

      const cantidadFinal =
        stockDisponible !== null ? Math.min(cantidad, stockDisponible) : cantidad;

      nextDrafts[item.id] = String(cantidadFinal);

      if (cantidadFinal !== item.cantidad) {
        actualizaciones.push({ id: item.id, cantidad: cantidadFinal });
      }

      return {
        ...item,
        cantidad: cantidadFinal,
      };
    });

    setCantidadErrores(nextErrors);
    setCantidadDrafts((prev) => ({ ...prev, ...nextDrafts }));

    if (actualizaciones.length > 0) {
      flushSync(() => {
        actualizaciones.forEach(({ id, cantidad }) => {
          actualizarCantidadProducto(id, cantidad);
        });
      });
    }

    return {
      ok: Object.keys(nextErrors).length === 0,
      items: itemsNormalizados,
    };
  };

  const handleDisminuirCantidad = (item) => {
    if (item.cantidad <= 1) return;
    setErrorCantidad(item.id, "");
    setCantidadDrafts((prev) => ({
      ...prev,
      [item.id]: String(item.cantidad - 1),
    }));
    eliminarProducto(item.id);
  };

  const handleAumentarCantidad = (item) => {
    if (alcanzoMaximoStock(item)) {
      mostrarAvisoLimiteStock(item, getStockDisponible(item));
      return;
    }
    setErrorCantidad(item.id, "");
    setCantidadDrafts((prev) => ({
      ...prev,
      [item.id]: String(item.cantidad + 1),
    }));
    agregarProducto(item);
  };

  return (
    <div className="carrito-contenedor">
      <div className="carrito-header">
        <h2 className="carrito-titulo">Tu carrito</h2>
        <button className="btn-cerrar-carrito" onClick={onClose}>
          X
        </button>
      </div>

      <div className="carrito-contenido">
        <div className="carrito-items">
          {items.length === 0 ? (
            <div className="carrito-empty-state">
              <p className="carrito-empty-state__title">Tu carrito esta vacio</p>
            </div>
          ) : (
            items.map((item) => {
              const bloquearSuma = alcanzoMaximoStock(item);
              const cantidadError = cantidadErrores[item.id] || "";
              const cantidadDraft =
                cantidadDrafts[item.id] ?? String(item.cantidad);

              return (
                <div className="carrito-item" key={item.id}>
                  <img
                    src={item.imagen}
                    alt={item.nombre}
                    className="carrito-img"
                  />
                  <div className="carrito-detalles">
                    <p className="carrito-nombre">{item.nombre}</p>
                    <p className="carrito-precio">
                      {formatoCOP(item.precio * item.cantidad)}
                    </p>
                    <button
                      type="button"
                      className="carrito-eliminar"
                      onClick={() => borrarProducto(item.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="carrito-cantidad-wrap">
                    <div className="carrito-cantidad">
                      <button
                        type="button"
                        onClick={() => handleDisminuirCantidad(item)}
                      >
                        -
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        value={cantidadDraft}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) =>
                          handleCantidadInputChange(item, e.target.value)
                        }
                        onBlur={() => handleCantidadInputBlur(item)}
                        className={`carrito-cantidad__input ${
                          cantidadError ? "carrito-cantidad__input--error" : ""
                        }`}
                        aria-label={`Cantidad de ${item.nombre}`}
                        aria-invalid={Boolean(cantidadError)}
                      />
                      <button
                        type="button"
                        className={`carrito-cantidad__btn-sumar ${
                          bloquearSuma ? "carrito-cantidad__btn-sumar--bloqueado" : ""
                        }`}
                        onClick={() => {
                          if (bloquearSuma) return;
                          handleAumentarCantidad(item);
                        }}
                        aria-disabled={bloquearSuma}
                        title={
                          bloquearSuma
                            ? "No puede agregar mas unidades"
                            : "Agregar una unidad"
                        }
                      >
                        +
                      </button>
                    </div>
                    {cantidadError && (
                      <p className="carrito-cantidad__error" role="alert">
                        {cantidadError}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="carrito-resumen">
          <h3>Resumen del pedido</h3>
          <div className="resumen-linea">
            <span>Subtotal</span>
            <span>{formatoCOP(subtotal)}</span>
          </div>
          <div className="resumen-total">
            <span>Total</span>
            <span>{formatoCOP(total)}</span>
          </div>

          {avisoStock && (
            <div className="carrito-stock-aviso" role="alert" aria-live="polite">
              <span className="carrito-stock-aviso__icon" aria-hidden="true">
                !
              </span>
              <p className="carrito-stock-aviso__text">{avisoStock}</p>
            </div>
          )}

          <div className="carrito-comprobante-aviso" role="note" aria-live="polite">
            <span className="carrito-comprobante-aviso__icon" aria-hidden="true">
              !
            </span>
            <p className="carrito-comprobante-aviso__text">
              Esta orden tiene plazo maximo de 3 dias.
            </p>
          </div>

          {avisoLimiteStock && (
            <div className="carrito-limite-aviso" role="status" aria-live="polite">
              <span className="carrito-limite-aviso__icon" aria-hidden="true">
                !
              </span>
              <div className="carrito-limite-aviso__body">
                <p className="carrito-limite-aviso__title">Cantidad en el pedido ajustada</p>
                <p className="carrito-limite-aviso__text">{avisoLimiteStock}</p>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <button
              type="button"
              className="carrito-vaciar"
              onClick={vaciarCarrito}
            >
              Limpiar  Carrito
            </button>
          )}

          <DescargarComprobante
            items={items}
            subtotal={subtotal}
            total={total}
            bloquearPorStock={bloquearAccionesPorStock}
            resolveItemsParaOrden={resolverItemsParaOrden}
          />
        </div>
      </div>
    </div>
  );
};

export default CarritoCompras;
