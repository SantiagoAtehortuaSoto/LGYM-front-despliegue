import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import Modal from "../../../../../shared/components/Modal/Modal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { getProveedores } from "../../../hooks/Proveedores_API/API_proveedores";
import { getCurrentUser } from "../../../hooks/Acceder_API/authService";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import { ModalVerVenta } from "../../admin/Ventas/modalVentas";
import "../../../../../shared/styles/restructured/components/modal-pedidos.css";

/* ======================================================
   Modal base reutilizable
====================================================== */
export const ModalPedidos = ({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
  footer = null,
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: "modal-pequeno",
    md: "modal-mediano",
    lg: "modal-grande",
    xl: "modal-extra",
  };

  return (
    <div className="modal-overlay capa-modal" onClick={onClose}>
      <div
        className={`contenedor-modal ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="encabezado-modal">
          <h2 className="titulo-modal">{title}</h2>
          <button onClick={onClose} className="boton-cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="cuerpo-modal">{children}</div>
        {footer ? <div className="pie-modal">{footer}</div> : null}
      </div>
    </div>
  );
};

/* ======================================================
   Modal Crear / Editar Pedido
====================================================== */
export const ModalFormularioPedido = ({
  isOpen,
  onClose,
  onSubmit,
  pedido,
  title = "Nuevo Pedido",
}) => {
  const ESTADOS_VALIDOS = ["Pendiente", "En Proceso", "Completado", "Cancelado"];
  const formId = "modal-pedidos-form";
  const [formData, setFormData] = useState({
    idProveedor: "",
    producto: "",
    cantidad: "",
    precioTotal: "",
    fechaPedido: "",
    fechaEntrega: "",
    estado: "Pendiente",
  });

  const [errores, setErrores] = useState({});
  const [proveedores, setProveedores] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);

  useEffect(() => {
    const cargarProveedores = async () => {
      try {
        setLoadingProveedores(true);
        const proveedoresData = await getProveedores();
        setProveedores(Array.isArray(proveedoresData) ? proveedoresData : []);
      } catch (error) {
        setProveedores([]);
      } finally {
        setLoadingProveedores(false);
      }
    };

    if (isOpen) cargarProveedores();
  }, [isOpen]);

  useEffect(() => {
    if (pedido) {
      // Mapear los datos del pedido a los campos del formulario
      const estadoTexto = (() => {
        switch (pedido.id_estado) {
          case 3:
            return "Pendiente";
          case 4:
            return "En Proceso";
          case 5:
            return "Completado";
          case 6:
            return "Cancelado";
          default:
            return "Pendiente";
        }
      })();

      setFormData({
        idProveedor: pedido.id_proveedor || "",
        producto: pedido.producto || "",
        cantidad: pedido.cantidad || "",
        precioTotal: pedido.precio_total || "",
        fechaPedido: pedido.fecha_pedido || "",
        fechaEntrega: pedido.plazo_maximo || pedido.fecha_entrega || "",
        estado: pedido.estado || "Pendiente",
      });
    } else {
      setFormData({
        idProveedor: "",
        producto: "",
        cantidad: "",
        precioTotal: "",
        fechaPedido: "",
        fechaEntrega: "",
        estado: "Pendiente",
      });
    }
    setErrores({});
  }, [pedido, isOpen]);

  const validarCampo = (name, value, currentData = formData) => {
    switch (name) {
      case "idProveedor": {
        if (!String(value || "").trim()) return "Debe seleccionar un proveedor";
        const existeProveedor = proveedores.some(
          (proveedor) => String(proveedor.id_proveedor) === String(value)
        );
        return existeProveedor ? "" : "Debe seleccionar un proveedor válido";
      }
      case "producto": {
        const producto = String(value || "").trim();
        if (!producto) return "El producto es obligatorio";
        if (producto.length < 3) return "Debe tener al menos 3 caracteres";
        if (producto.length > 80) return "No puede superar 80 caracteres";
        return "";
      }
      case "cantidad": {
        const cantidad = String(value || "").trim();
        if (!cantidad) return "La cantidad es obligatoria";
        if (!/^\d+$/.test(cantidad)) return "La cantidad debe ser un número entero";
        const cantidadNumero = Number(cantidad);
        if (cantidadNumero <= 0) return "La cantidad debe ser mayor a 0";
        if (cantidadNumero > 10000) return "La cantidad no puede superar 10000";
        return "";
      }
      case "precioTotal": {
        const precio = String(value || "").trim();
        if (!precio) return "El precio total es obligatorio";
        if (!/^\d+(\.\d{1,2})?$/.test(precio)) {
          return "Debe ser un valor válido con hasta 2 decimales";
        }
        if (Number(precio) <= 0) return "El precio total debe ser mayor a 0";
        return "";
      }
      case "fechaPedido": {
        const fechaPedido = String(value || "").trim();
        if (!fechaPedido) return "La fecha del pedido es obligatoria";
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fecha = new Date(fechaPedido);
        fecha.setHours(0, 0, 0, 0);
        if (fecha > hoy) return "La fecha del pedido no puede ser futura";
        return "";
      }
      case "fechaEntrega": {
        const fechaEntrega = String(value || "").trim();
        if (!fechaEntrega) return "La fecha de entrega es obligatoria";
        if (currentData.fechaPedido) {
          const inicio = new Date(currentData.fechaPedido);
          const fin = new Date(fechaEntrega);
          inicio.setHours(0, 0, 0, 0);
          fin.setHours(0, 0, 0, 0);
          if (fin < inicio) {
            return "La fecha de entrega no puede ser anterior al pedido";
          }
        }
        return "";
      }
      case "estado":
        return ESTADOS_VALIDOS.includes(String(value || "").trim())
          ? ""
          : "Debe seleccionar un estado válido";
      default:
        return "";
    }
  };

  const validar = () => {
    const temp = Object.keys(formData).reduce((acc, campo) => {
      const mensaje = validarCampo(campo, formData[campo], formData);
      if (mensaje) acc[campo] = mensaje;
      return acc;
    }, {});
    setErrores(temp);
    return Object.keys(temp).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextData = { ...formData, [name]: value };
    setFormData(nextData);
    setErrores((prev) => ({
      ...prev,
      [name]: validarCampo(name, value, nextData),
      ...(name === "fechaPedido"
        ? { fechaEntrega: validarCampo("fechaEntrega", nextData.fechaEntrega, nextData) }
        : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    try {
      // Pasar todos los datos del formulario para manejarlos en el componente padre
      const resultado = await Promise.resolve(onSubmit(formData));
      if (resultado === false) {
        throw new Error(
          pedido
            ? "No se pudo actualizar el pedido"
            : "No se pudo crear el pedido"
        );
      }
      toast.success(
        pedido ? "Pedido actualizado exitosamente" : "Pedido creado exitosamente"
      );
      onClose();
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo guardar el pedido"
      );
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPedidos
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="contenedor-botones">
          <button
            type="button"
            onClick={onClose}
            className="boton boton-secundario margen-derecha"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className="boton boton-primario"
          >
            {pedido ? "Actualizar" : "Guardar"}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="formulario-modal" noValidate>
        {/* =========== CAMPOS =========== */}

        <div className="grupo-formulario">
          <label>Proveedor</label>
          {loadingProveedores ? (
            <div className="campo-control">Cargando proveedores...</div>
          ) : (
            <select
              name="idProveedor"
              value={formData.idProveedor}
              onChange={handleChange}
              className={`campo-control ${errores.idProveedor ? "input-error" : ""}`}
            >
              <option value="">Seleccionar Proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre_proveedor}
                </option>
              ))}
            </select>
          )}
          {errores.idProveedor && (
            <p className="error-text">{errores.idProveedor}</p>
          )}
        </div>

        <div className="grupo-formulario">
          <label>Producto</label>
          <input
            type="text"
            name="producto"
            className={`campo-control ${errores.producto ? "input-error" : ""}`}
            placeholder="Ej: Proteína Whey"
            value={formData.producto}
            onChange={handleChange}
          />
          {errores.producto && <p className="error-text">{errores.producto}</p>}
        </div>

        <div className="campos-dobles">
          <div className="grupo-formulario">
            <label>Cantidad</label>
            <input
              type="text"
              inputMode="numeric"
              name="cantidad"
              placeholder="Ej: 10"
              value={formData.cantidad}
              onChange={(e) => {
                // Solo permitir números enteros para cantidad
                const value = e.target.value.replace(/[^0-9]/g, "");
                const nextData = { ...formData, cantidad: value };
                setFormData(nextData);
                setErrores((prev) => ({
                  ...prev,
                  cantidad: validarCampo("cantidad", value, nextData),
                }));
              }}
              className={`campo-control ${errores.cantidad ? "input-error" : ""}`}
            />
            {errores.cantidad && (
              <p className="error-text">{errores.cantidad}</p>
            )}
          </div>

          <div className="grupo-formulario">
            <label>Precio Total</label>
            <input
              type="text"
              inputMode="decimal"
              name="precioTotal"
              className={`campo-control ${errores.precioTotal ? "input-error" : ""}`}
              placeholder="Precio en COP"
              value={formData.precioTotal}
              onChange={(e) => {
                // Solo permitir números y un punto decimal para precio
                const value = e.target.value.replace(/[^0-9.]/g, "");
                // Asegurar máximo un punto decimal
                const parts = value.split(".");
                if (parts.length > 2) {
                  const normalizedValue = parts[0] + "." + parts.slice(1).join("");
                  const nextData = {
                    ...formData,
                    precioTotal: normalizedValue,
                  };
                  setFormData(nextData);
                  setErrores((prev) => ({
                    ...prev,
                    precioTotal: validarCampo("precioTotal", normalizedValue, nextData),
                  }));
                } else {
                  const nextData = { ...formData, precioTotal: value };
                  setFormData(nextData);
                  setErrores((prev) => ({
                    ...prev,
                    precioTotal: validarCampo("precioTotal", value, nextData),
                  }));
                }
              }}
            />
            {errores.precioTotal && (
              <p className="error-text">{errores.precioTotal}</p>
            )}
          </div>
        </div>

        <div className="campos-dobles">
          <div className="grupo-formulario">
            <div className="label-con-ayuda">
              <label>Fecha del Pedido</label>
              <span className="texto-ayuda">dd/mm/aaaa</span>
            </div>
            <input
              type="date"
              name="fechaPedido"
              className={`campo-control ${errores.fechaPedido ? "input-error" : ""}`}
              placeholder="dd/mm/aaaa"
              value={formData.fechaPedido}
              onChange={handleChange}
            />
            {errores.fechaPedido && (
              <p className="error-text">{errores.fechaPedido}</p>
            )}
          </div>

          <div className="grupo-formulario">
            <div className="label-con-ayuda">
              <label>Fecha de Entrega</label>
              <span className="texto-ayuda">dd/mm/aaaa</span>
            </div>
            <input
              type="date"
              name="fechaEntrega"
              className={`campo-control ${errores.fechaEntrega ? "input-error" : ""}`}
              placeholder="dd/mm/aaaa"
              value={formData.fechaEntrega}
              onChange={handleChange}
            />
            {errores.fechaEntrega && (
              <p className="error-text">{errores.fechaEntrega}</p>
            )}
          </div>
        </div>

        <div className="grupo-formulario">
          <label>Estado</label>
          <select
            name="estado"
            value={formData.estado}
            onChange={handleChange}
            className={errores.estado ? "input-error" : ""}
          >
            <option value="Pendiente">Pendiente</option>
            <option value="En Proceso">En Proceso</option>
            <option value="Completado">Completado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
          {errores.estado && <p className="error-text">{errores.estado}</p>}
        </div>

      </form>
    </ModalPedidos>
  );
};

/* ======================================================
   Modal Eliminar Pedido
====================================================== */
export const ModalEliminarPedido = ({ isOpen, onClose, onConfirm, pedido }) => {
  if (!isOpen || !pedido) return null;

  const handleConfirmDelete = () => {
    onConfirm(pedido);
  };

  // Función para formatear el precio
  const formatPrice = (price) => {
    if (price === undefined || price === null) return "No especificado";
    return `$${parseFloat(price).toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirmDelete}
      item={pedido}
      title="Eliminar Pedido"
      size="md"
      fields={[
        {
          key: "numero_pedido",
          label: "N° Pedido",
          format: (value) => <strong>{value || "No especificado"}</strong>,
        },
        {
          key: "nombre_proveedor",
          label: "Proveedor",
          format: (value) => value || "No especificado",
        },
        {
          key: "producto",
          label: "Producto",
          format: (value) => value || "No especificado",
        },
        {
          key: "precio_total",
          label: "Precio Total",
          format: formatPrice,
        },
        {
          key: "cantidad",
          label: "Cantidad",
          format: (value) => `${value || 0} unidades`,
        },
      ]}
      warningMessage={
        <>
          <p>
            Al eliminar este pedido, se perderá toda la información asociada
            incluyendo:
          </p>
          <ul className="modal-warning-list">
            <li>Historial de pedidos</li>
            <li>Relaciones con proveedores</li>
            <li>Información de inventario relacionada</li>
          </ul>
          <p className="modal-warning-emphasis">
            ¿Estás completamente seguro de que deseas continuar?
          </p>
        </>
      }
    />
  );
};

/* ======================================================
   Modal Ver Pedido
====================================================== */
const PEDIDO_ESTADO_COLOR_MAP = {
  PENDIENTE: "#f59e0b",
  EN_PROCESO: "#3b82f6",
  COMPLETADO: "#10b981",
  CANCELADO: "#ef4444",
};

const normalizarEstadoPedidoClave = (estado = "") => {
  const normalizado = String(estado || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (normalizado.includes("PROCES")) return "EN_PROCESO";
  if (normalizado.includes("COMPLET")) return "COMPLETADO";
  if (normalizado.includes("CANCEL")) return "CANCELADO";
  return "PENDIENTE";
};

const inferirTipoDetallePedido = (detalle = {}) => {
  const candidatos = [
    detalle?.tipo_venta,
    detalle?.tipoVenta,
    detalle?.tipo,
    detalle?.categoria,
    detalle?.origen,
    detalle?.nombre_membresia ? "MEMBRESIA" : "",
    detalle?.nombre_servicio ? "SERVICIO" : "",
    detalle?.membresia ? "MEMBRESIA" : "",
    detalle?.servicio ? "SERVICIO" : "",
    detalle?.id_membresia ? "MEMBRESIA" : "",
    detalle?.id_servicio ? "SERVICIO" : "",
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (candidatos.includes("MEMB")) return "MEMBRESIA";
  if (candidatos.includes("SERV")) return "SERVICIO";
  return "PRODUCTO";
};

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolverNombreDetallePedido = (detalle = {}, index = 0) =>
  detalle?.nombre ||
  detalle?.nombre_producto ||
  detalle?.nombre_membresia ||
  detalle?.nombre_servicio ||
  detalle?.id_productos_producto?.nombre_producto ||
  detalle?.id_productos_producto?.nombre ||
  detalle?.producto?.nombre_producto ||
  detalle?.producto?.nombre ||
  detalle?.servicio?.nombre_servicio ||
  detalle?.servicio?.nombre ||
  detalle?.membresia?.nombre_membresia ||
  detalle?.membresia?.nombre ||
  `Item ${index + 1}`;

const adaptarPedidoAVentaModal = (pedido = {}) => {
  const usuarioActual = getCurrentUser() || {};
  const detallesBase = Array.isArray(pedido.items)
    ? pedido.items
    : Array.isArray(pedido.detalles_pedidos)
    ? pedido.detalles_pedidos
    : Array.isArray(pedido.detalles)
    ? pedido.detalles
    : [];

  const detallesVenta = detallesBase.map((detalle, index) => {
    const cantidad = Math.max(
      1,
      toSafeNumber(detalle?.cantidad ?? detalle?.cantidad_total ?? detalle?.qty ?? 1)
    );
    const subtotal = toSafeNumber(
      detalle?.subtotal ?? detalle?.total ?? detalle?.total_producto
    );
    const valorUnitarioDirecto = toSafeNumber(
      detalle?.valor_unitario ??
        detalle?.precio_unitario ??
        detalle?.precio ??
        detalle?.valor ??
        detalle?.valorUnitario
    );
    const valor_unitario =
      valorUnitarioDirecto > 0
        ? valorUnitarioDirecto
        : subtotal > 0
        ? subtotal / cantidad
        : 0;

    return {
      ...detalle,
      nombre: resolverNombreDetallePedido(detalle, index),
      cantidad,
      tipo_venta: inferirTipoDetallePedido(detalle),
      valor_unitario,
      valor_unitario_detalle: valor_unitario,
      subtotal: subtotal || valor_unitario * cantidad,
    };
  });

  const totalCalculado =
    toSafeNumber(
      pedido?.totalNumber ??
        pedido?.precio_total ??
        pedido?.precioTotal ??
        pedido?.valor_total_venta ??
        pedido?.monto
    ) ||
    detallesVenta.reduce(
      (acc, detalle) => acc + toSafeNumber(detalle.valor_unitario) * toSafeNumber(detalle.cantidad),
      0
    );

  const documentoUsuario =
    pedido?.usuario_documento ||
    pedido?.documento_usuario ||
    pedido?.documento ||
    usuarioActual?.documento ||
    usuarioActual?.numero_documento ||
    usuarioActual?.num_documento ||
    usuarioActual?.document ||
    "Documento no disponible";

  return {
    ...pedido,
    id: pedido?.numero_pedido || pedido?.id,
    fecha_venta: pedido?.fecha_pedido ?? pedido?.fechaCompra ?? pedido?.fecha_entrega,
    plazo_maximo:
      pedido?.plazo_maximo ??
      pedido?.fecha_entrega ??
      pedido?.fecha_pedido ??
      pedido?.fechaCompra,
    estado_venta: pedido?.estado ?? pedido?.id_estado ?? "Pendiente",
    usuario_documento: documentoUsuario,
    documento_usuario: documentoUsuario,
    valor_total_venta: totalCalculado,
    monto: totalCalculado,
    detalles: detallesVenta,
    detalles_venta: detallesVenta,
  };
};

export const ModalVerPedido = ({
  isOpen,
  onClose,
  pedido,
}) => {
  if (!isOpen || !pedido) return null;
  const ventaAdaptada = adaptarPedidoAVentaModal(pedido);
  const colorEstado =
    PEDIDO_ESTADO_COLOR_MAP[
      normalizarEstadoPedidoClave(ventaAdaptada.estado_venta)
    ] || "#10b981";

  return (
    <ModalVerVenta
      venta={ventaAdaptada}
      onClose={onClose}
      colorEstado={colorEstado}
    />
  );
};

/* ======================================================
   Modal Cambiar Estado Pedido
====================================================== */
export const ModalCambiarEstadoPedido = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
}) => {
  if (!pedido) return null;

  const estadosMap = {
    3: "Pendiente",
    4: "En Proceso",
    5: "Completado",
    6: "Cancelado",
  };

  const estadoActualTexto =
    pedido.estado || estadosMap[Number(pedido.id_estado)] || "Pendiente";

  const estadoActualId = Number(
    Object.keys(estadosMap).find((key) => estadosMap[key] === estadoActualTexto) ||
      pedido.id_estado ||
      3,
  );

  const obtenerProximoEstado = () => {
    switch (Number(estadoActualId)) {
      case 3:
        return "En Proceso";
      case 4:
        return "Completado";
      case 5:
        return "Cancelado";
      case 6:
        return "Pendiente";
      default:
        return "En Proceso";
    }
  };

  const proximoEstado = obtenerProximoEstado();
  const proximoEstadoId = Number(
    Object.keys(estadosMap).find((key) => estadosMap[key] === proximoEstado) || 4,
  );

  const esAvance = ["En Proceso", "Completado"].includes(proximoEstado);
  const esCancelacion = proximoEstado === "Cancelado";

  const detallePedido = (
    <div className="modal-pedidos__status-details">
      <div>
        <strong>Pedido:</strong> {pedido.numero_pedido || "Sin número"}
      </div>
      <div>
        <strong>Producto:</strong> {pedido.producto || "Sin producto"}
      </div>
      <div>
        <strong>Estado actual:</strong> {estadoActualTexto}
      </div>
      <div>
        <strong>Nuevo estado:</strong> {proximoEstado}
      </div>
    </div>
  );

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        onConfirm?.(pedido, Number(proximoEstadoId));
        onClose();
      }}
      targetStatus={proximoEstadoId}
      type={esCancelacion ? "deactivate" : esAvance ? "activate" : "warning"}
      title={
        esAvance
          ? "Avanzar estado del pedido"
          : esCancelacion
            ? "Cancelar pedido"
            : "Cambiar estado del pedido"
      }
      message={
        esAvance
          ? "El pedido avanzara al siguiente paso del flujo."
          : esCancelacion
            ? "El pedido se marcara como cancelado."
            : "Se aplicara un cambio de estado al pedido."
      }
      confirmText={esAvance ? "Si, avanzar" : esCancelacion ? "Si, cancelar" : "Confirmar"}
      details={detallePedido}
    />
  );
};
