import React, { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import toast from "react-hot-toast";
import { useCarrito } from "../../components/Carrito/carritoContext";
import { getProductos } from "../../../features/dashboard/hooks/Productos_API_Landing/API_Productos_Landing";
import { getEnv } from "../../../config/appEnv";

import { getCurrentUser } from "../../../features/dashboard/hooks/Acceder_API/authService";
import {
  crearComprobanteVenta,
  mapCarritoToPayload,
} from "../../../features/dashboard/hooks/Comprobante_API/Comprobante_API";
import ComprobanteDocumento from "./comprobanteDocumento";

// const DIAS_PLAZO_RECLAMO = 3;

const resolveUserId = (user) =>
  user?.id_usuario ??
  user?.id ??
  user?.idUser ??
  user?.idUsuarios ??
  user?.userId ??
  user?.usuario_id ??
  null;

const DIAS_PLAZO_RECLAMO = (() => {
  const diasEnv = Number(getEnv("VITE_DIAS_PLAZO_RECLAMO", "3"));
  return Number.isFinite(diasEnv) && diasEnv >= 0 ? diasEnv : 3;
})();
const ORDER_CREATED_EVENT = "landing:orden-creada";

const toPositiveIntOrNull = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
};

const getProductIdFromItem = (item) =>
  toPositiveIntOrNull(
    item?.id_producto ?? item?.idProducto ?? item?.productoId ?? item?.id_productos ?? item?.id
  );

const getStockFromApiProduct = (product) => {
  const stock = Number(product?.stock);
  if (!Number.isFinite(stock)) return null;
  return Math.max(0, Math.floor(stock));
};

const calcularPlazoMaximo = (dias = DIAS_PLAZO_RECLAMO) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + Number(dias || 0));
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const DescargarComprobante = ({
  items,
  subtotal,
  total,
  bloquearPorStock = false,
  resolveItemsParaOrden = null,
}) => {
  const [cargando, setCargando] = useState(false);
  const { vaciarCarrito } = useCarrito?.() ?? {};
  const botonBloqueado = cargando || bloquearPorStock;

  const calcularTotales = (itemsEvaluar = []) => {
    const subtotalCalculado = (itemsEvaluar || []).reduce(
      (acc, item) => acc + Number(item?.precio || 0) * Number(item?.cantidad || 0),
      0
    );

    return {
      subtotal: subtotalCalculado,
      total: subtotalCalculado,
    };
  };

  const validarStockActual = async (itemsEvaluar = items) => {
    const productosEnCarrito = (itemsEvaluar || []).filter((item) => {
      const tipo = String(item?.tipo || item?.type || "").toLowerCase();
      return !tipo || tipo.includes("prod");
    });
    if (!productosEnCarrito.length) return null;

    const productosApi = await getProductos({ timeoutMs: 10000, headers: {} });
    const stockById = new Map(
      (Array.isArray(productosApi) ? productosApi : []).map((p) => [
        toPositiveIntOrNull(p?.id_productos ?? p?.id),
        getStockFromApiProduct(p),
      ])
    );

    const excedido = productosEnCarrito.find((item) => {
      const idProducto = getProductIdFromItem(item);
      if (!idProducto) return false;
      const stockActual = stockById.get(idProducto);
      if (stockActual === undefined) return true;
      if (stockActual === null) return false;
      return Number(item?.cantidad || 0) > stockActual;
    });

    return excedido || null;
  };

  const generarPDFLocal = async ({ items: itemsEvaluar, subtotal: subtotalEvaluar, total: totalEvaluar, plazoMaximo }) => {
    const blob = await pdf(
      <ComprobanteDocumento
        items={itemsEvaluar}
        subtotal={subtotalEvaluar}
        total={totalEvaluar}
        plazoMaximo={plazoMaximo}
      />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `orden_${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const prepararItemsParaOrden = () => {
    const preflight = typeof resolveItemsParaOrden === "function" ? resolveItemsParaOrden() : null;
    if (preflight && !preflight.ok) {
      toast.error("Corrige las cantidades marcadas antes de generar la orden.");
      return null;
    }

    const itemsConfirmados = Array.isArray(preflight?.items) ? preflight.items : items;
    if (!itemsConfirmados?.length) {
      toast.error("Agrega productos al carrito antes de generar la orden.");
      return null;
    }

    const totales = calcularTotales(itemsConfirmados);
    return {
      items: itemsConfirmados,
      subtotal: totales.subtotal || Number(subtotal) || 0,
      total: totales.total || Number(total) || 0,
    };
  };

  const handleGenerarComprobante = async () => {
    if (bloquearPorStock) {
      toast.error("No puedes generar la orden mientras haya productos que superen el stock.");
      return;
    }

    const datosOrden = prepararItemsParaOrden();
    if (!datosOrden) return;

    const {
      items: itemsConfirmados,
      subtotal: subtotalConfirmado,
      total: totalConfirmado,
    } = datosOrden;

    const user = getCurrentUser();
    const idUsuario = resolveUserId(user);

    if (!idUsuario) {
      toast.error("No se pudo identificar tu usuario. Vuelve a iniciar sesion.");
      return;
    }

    try {
      setCargando(true);
      // Da un ciclo de render para que el loader aparezca antes de generar la orden.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const productoSinStock = await validarStockActual(itemsConfirmados);
      if (productoSinStock) {
        toast.error(
          `${productoSinStock.nombre || "Un producto"} supera el stock actual. Actualiza tu carrito.`
        );
        return;
      }

      const token = localStorage.getItem("token");
      const detallesPayload = await mapCarritoToPayload(itemsConfirmados, { token });
      if (!detallesPayload || detallesPayload.length === 0) {
        toast.error("No se pudo preparar el carrito. Intenta nuevamente.");
        return;
      }

      const plazoMaximo = calcularPlazoMaximo();
      console.debug("[Orden] Items confirmados del carrito:", itemsConfirmados);

      await crearComprobanteVenta({
        id_usuario: idUsuario,
        id_estado: 3,
        plazo_maximo: plazoMaximo,
        detalles: detallesPayload,
      });

      toast.success("Orden guardada. La veras en la tabla de pedidos.");

      try {
        await generarPDFLocal({
          items: itemsConfirmados,
          subtotal: subtotalConfirmado,
          total: totalConfirmado,
          plazoMaximo,
        });
      } catch (pdfError) {
        console.error("La orden se guardo, pero fallo la generacion del PDF:", pdfError);
        toast.error("La orden se guardo, pero no se pudo descargar el PDF.");
      }

      if (typeof vaciarCarrito === "function") {
        vaciarCarrito();
      }
      window.dispatchEvent(new Event(ORDER_CREATED_EVENT));
    } catch (error) {
      console.error("Error guardando la orden:", error, {
        backend: error?.data,
        status: error?.status,
      });

      const backendMsg =
        Array.isArray(error?.errors) && error.errors.length
          ? error.errors.map((e) => e?.msg || e?.message || JSON.stringify(e)).join(" | ")
          : error?.data?.msg || error?.data?.message || "";

      toast.error(
        backendMsg || error?.message || "No se pudo guardar la orden. Intentalo de nuevo."
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <button
      className={`carrito-generar ${cargando ? "cargando" : "listo"}`}
      type="button"
      onClick={handleGenerarComprobante}
      disabled={botonBloqueado}
      title={
        bloquearPorStock
          ? "Baja la cantidad de productos que superan el stock para generar la orden"
          : undefined
      }
      aria-busy={cargando}
      aria-disabled={botonBloqueado}
    >
      {cargando ? (
        <>
          <span className="carrito-generar__spinner" aria-hidden="true" />
          Generando orden...
        </>
      ) : (
        "Generar orden"
      )}
    </button>
  );
};
