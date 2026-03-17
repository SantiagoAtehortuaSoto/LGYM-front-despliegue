import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import Modal from "../../../../../shared/components/Modal/Modal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { getProveedores } from "../../../hooks/Proveedores_API/API_proveedores";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
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
export const ModalVerPedido = ({
  isOpen,
  onClose,
  pedido,
  estadosDisponibles,
  onEdit,
}) => {
  if (!isOpen || !pedido) return null;

  const obtenerEstado = () => {
    if (pedido.estado) return pedido.estado;
    const mapaEstados = {
      3: "Pendiente",
      4: "En Proceso",
      5: "Completado",
      6: "Cancelado",
    };
    return mapaEstados[pedido.id_estado] || "Pendiente";
  };

  const obtenerEstadoClase = (estado) => {
    const normalizado = String(estado || "").toLowerCase().trim();
    if (normalizado.includes("pend")) return "modal-pedidos__estado-btn--pendiente";
    if (normalizado.includes("proceso")) return "modal-pedidos__estado-btn--proceso";
    if (normalizado.includes("complet")) return "modal-pedidos__estado-btn--completado";
    if (normalizado.includes("cancel")) return "modal-pedidos__estado-btn--cancelado";
    return "modal-pedidos__estado-btn--default";
  };

  const formatearMoneda = (valor) => {
    if (valor === null || valor === undefined || valor === "") return "";
    const numero = Number(valor);
    if (Number.isNaN(numero)) return String(valor);
    return new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 0,
    }).format(numero);
  };

  const normalizarFecha = (valor) => {
    if (!valor) return "";
    // Check if it's already in YYYY-MM-DD format
    if (valor.length === 10 && valor[4] === "-" && valor[7] === "-")
      return valor;
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toISOString().split("T")[0];
  };

  const estadoActual = obtenerEstado();
  const estadoClase = obtenerEstadoClase(estadoActual);
  const fechaPedido = normalizarFecha(pedido.fecha_pedido);
  const fechaEntrega = normalizarFecha(
    pedido.plazo_maximo ?? pedido.fecha_entrega
  );

  const detallesPedido = Array.isArray(pedido.items)
    ? pedido.items
    : Array.isArray(pedido.detalles_pedidos)
    ? pedido.detalles_pedidos
    : Array.isArray(pedido.detalles)
    ? pedido.detalles
    : [];

  return (
    <Modal
      title={`Detalles del Pedido #${pedido.numero_pedido || pedido.id}`}
      onClose={onClose}
      size="lg"
      className="venta-redesigned"
      footer={
        <button className="boton boton-primario" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="cuerpo-modal p-0">
        <div className="modal-body-content--spacious">
          <motion.div
            className="general-tab-layout"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Left Column: Order Details */}
            <div className="general-form-column">
              <motion.div
                className="modal-form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <h3 className="modal-section-title">Información del pedido</h3>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <label className="modal-field-label">N° de pedido</label>
                  <input
                    type="text"
                    className="modal-field-input"
                    value={pedido.numero_pedido || "Sin número"}
                    readOnly
                    disabled
                  />
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <label className="modal-field-label">Fecha de pedido</label>
                  <input
                    type="text"
                    className="modal-field-input"
                    value={
                      fechaPedido
                        ? new Date(fechaPedido).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Sin fecha"
                    }
                    readOnly
                    disabled
                  />
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <label className="modal-field-label">Plazo máximo</label>
                  <input
                    type="text"
                    className="modal-field-input"
                    value={
                      fechaEntrega
                        ? new Date(fechaEntrega).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "Sin fecha"
                    }
                    readOnly
                    disabled
                  />
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                >
                  <label className="modal-field-label">Estado</label>
                  <button
                    className={`boton modal-pedidos__estado-btn ${estadoClase}`}
                    disabled
                  >
                    {estadoActual}
                  </button>
                </motion.div>
              </motion.div>
            </div>

            {/* Right Column: Products List */}
            <div className="general-summary-column">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <h3 className="modal-section-title">
                  Productos del pedido ({detallesPedido.length})
                </h3>

                {detallesPedido.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    {/* Tabla de productos */}
                    <div className="modal-pedidos__view-table-wrap">
                      <table className="modal-pedidos__view-table">
                        <thead>
                          <tr className="modal-pedidos__view-head-row">
                            <th className="modal-pedidos__view-th-product">
                              Producto
                            </th>
                            <th className="modal-pedidos__view-th-qty">
                              Cant.
                            </th>

                          </tr>
                        </thead>
                        <tbody>
                          {detallesPedido.map((d, i) => {
                            const nombre =
                              d.nombre ||
                              d.nombre_producto ||
                              d.id_productos_producto?.nombre_producto ||
                              d.id_productos_producto?.nombre ||
                              `Producto ${d.id_productos}`;
                            const cantidad = parseFloat(d.cantidad) || 0;

                            return (
                              <motion.tr
                                key={
                                  d.id_detalle_pedidos ||
                                  `${d.id_productos}-${i}`
                                }
                                className={`modal-pedidos__view-row ${
                                  i % 2 === 0
                                    ? "modal-pedidos__view-row--even"
                                    : "modal-pedidos__view-row--odd"
                                }`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  delay: 0.4 + i * 0.1,
                                  duration: 0.3,
                                }}
                              >
                                <td className="modal-pedidos__view-td-product">
                                  <div className="modal-pedidos__view-product-name">
                                    {nombre}
                                  </div>
                                </td>
                                <td className="modal-pedidos__view-td-qty">
                                  {cantidad}
                                </td>

                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                  </motion.div>
                ) : (
                  <motion.div
                    className="venta-empty-state"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    <p>Sin productos en el pedido</p>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </Modal>
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
        <strong>Pedido:</strong> {pedido.numero_pedido || "Sin numero"}
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
