import { createContext, useContext, useState } from "react";

const CarritoContext = createContext();

export const CarritoProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const obtenerStockDisponible = (producto = {}) => {
    const stockRaw = [
      producto?.stock,
      producto?.cantidadDisponible,
      producto?.cantidad_disponible,
      producto?.existencias,
      producto?.inventario,
    ].find((valor) => valor !== null && valor !== undefined && valor !== "");

    if (stockRaw === undefined) return null;

    const stockNumero = Number(stockRaw);
    if (!Number.isFinite(stockNumero)) return null;

    return Math.max(0, Math.floor(stockNumero));
  };

  // Agregar producto
  const agregarProducto = (producto) => {
    setItems((prev) => {
      const stockDelProducto = obtenerStockDisponible(producto);
      const itemExistente = prev.find((item) => item.id === producto.id);
      const stockDelItemExistente = itemExistente
        ? obtenerStockDisponible(itemExistente)
        : null;
      const stockDisponible = stockDelItemExistente ?? stockDelProducto;

      if (stockDisponible !== null && stockDisponible <= 0) {
        return prev;
      }

      if (itemExistente) {
        if (
          stockDisponible !== null &&
          itemExistente.cantidad >= stockDisponible
        ) {
          return prev;
        }

        return prev.map((item) =>
          item.id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          ...producto,
          cantidad: 1,
          ...(stockDelProducto !== null ? { stock: stockDelProducto } : {}),
        },
      ];
    });
  };

  // Eliminar uno en cantidad
  const eliminarProducto = (id) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, cantidad: item.cantidad - 1 } : item
        )
        .filter((item) => item.cantidad > 0)
    );
  };

  // Eliminar completamente un producto
  const borrarProducto = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const actualizarCantidadProducto = (id, cantidad) => {
    setItems((prev) => {
      const cantidadNormalizada = Number.parseInt(cantidad, 10);
      if (!Number.isFinite(cantidadNormalizada) || cantidadNormalizada <= 0) {
        return prev;
      }

      return prev.map((item) => {
        if (item.id !== id) return item;

        const stockDisponible = obtenerStockDisponible(item);
        const cantidadAjustada =
          stockDisponible !== null
            ? Math.min(cantidadNormalizada, stockDisponible)
            : cantidadNormalizada;

        return {
          ...item,
          cantidad: cantidadAjustada,
        };
      });
    });
  };

  // Vaciar carrito
  const vaciarCarrito = () => setItems([]);

  // Cantidad total de productos
  const cantidadTotal = items.reduce((acc, item) => acc + item.cantidad, 0);

  //  Total de la compra
  const total = items.reduce(
    (acc, item) => acc + item.precio * item.cantidad,
    0
  );

  return (
    <CarritoContext.Provider
      value={{
        items,
        agregarProducto,
        eliminarProducto,
        borrarProducto, 
        actualizarCantidadProducto,
        vaciarCarrito,
        cantidadTotal,
        total,
      }}
    >
      {children}
    </CarritoContext.Provider>
  );
};

export const useCarrito = () => useContext(CarritoContext);
