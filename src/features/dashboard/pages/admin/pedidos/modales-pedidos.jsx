import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, Plus, Trash2, X, SquarePen, Building2 } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "../../../../../shared/components/Modal/Modal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { getProveedores } from "../../../hooks/Proveedores_API/API_proveedores";
import { getProductos } from "../../../hooks/Productos_API/API_productos";
import { getPedidoById } from "../../../hooks/Pedidos_Api/Api_pedidos";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import "../../../../../shared/styles/restructured/components/modal-pedidos.css";

const PRODUCTO_INICIAL = {
  idProducto: "",
  cantidad: "",
  costoUnitario: "",
  subtotal: "",
};
const normalizarCantidad = (valor) => {
  const cantidad = Number.parseFloat(valor);
  return Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 0;
};
const obtenerClaveProducto = (producto = {}) => {
  const id =
    producto.idProducto ??
    producto.id_productos ??
    producto.id_producto ??
    producto.id;

  if (id !== undefined && id !== null && String(id).trim() !== "") {
    return `id:${String(id)}`;
  }

  const nombre = String(
    producto.nombre ?? producto.nombre_producto ?? ""
  ).trim().toLowerCase();

  return nombre ? `nombre:${nombre}` : "";
};
const normalizarProductoPedido = (producto = {}) => {
  const cantidad = normalizarCantidad(producto.cantidad) || 1;
  const nombre = String(
    producto.nombre ?? producto.nombre_producto ?? ""
  ).trim();

  return {
    ...producto,
    idProducto:
      producto.idProducto !== undefined && producto.idProducto !== null
        ? String(producto.idProducto)
        : "",
    nombre,
    cantidad: String(cantidad),
    costoUnitario: producto.costoUnitario ?? "0",
    subtotal: producto.subtotal ?? "0",
  };
};
const fusionarProductoEnLista = (listaActual = [], productoNuevo = {}) => {
  const productoNormalizado = normalizarProductoPedido(productoNuevo);
  const claveNuevo = obtenerClaveProducto(productoNormalizado);

  if (!claveNuevo) {
    return [...listaActual, productoNormalizado];
  }

  const indiceExistente = listaActual.findIndex(
    (item) => obtenerClaveProducto(item) === claveNuevo
  );

  if (indiceExistente === -1) {
    return [...listaActual, productoNormalizado];
  }

  const existente = listaActual[indiceExistente];
  const cantidadAcumulada =
    normalizarCantidad(existente.cantidad) +
    normalizarCantidad(productoNormalizado.cantidad);

  const productoActualizado = {
    ...existente,
    ...productoNormalizado,
    cantidad: String(cantidadAcumulada || 1),
  };

  const listaActualizada = [...listaActual];
  listaActualizada[indiceExistente] = productoActualizado;
  return listaActualizada;
};
const fusionarProductosEnLista = (listaActual = [], productosNuevos = []) =>
  (Array.isArray(productosNuevos) ? productosNuevos : [productosNuevos]).reduce(
    (acumulado, producto) => fusionarProductoEnLista(acumulado, producto),
    listaActual
  );
const ESTADOS_PEDIDO = {
  3: "Pendiente",
  4: "En Proceso",
  5: "Completado",
  6: "Cancelado",
};
const ESTADO_TEXTO_A_ID = Object.entries(ESTADOS_PEDIDO).reduce(
  (acc, [id, texto]) => {
    acc[texto] = parseInt(id, 10);
    return acc;
  },
  {}
);
const obtenerTextoEstado = (valor) => {
  if (
    typeof valor === "string" &&
    Object.values(ESTADOS_PEDIDO).includes(valor)
  )
    return valor;
  const n = parseInt(valor, 10);
  return ESTADOS_PEDIDO[n] || "Pendiente";
};
const obtenerIdEstado = (valor) => {
  if (typeof valor === "number") return valor;
  if (typeof valor === "string" && ESTADO_TEXTO_A_ID[valor])
    return ESTADO_TEXTO_A_ID[valor];
  const n = parseInt(valor, 10);
  return Number.isNaN(n) ? 3 : n;
};
const generarNumeroPedido = () =>
  `PED-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")}`;
const construirProductosDesdeDetalles = (detalles = []) => {
  if (!Array.isArray(detalles) || detalles.length === 0)
    return [{ ...PRODUCTO_INICIAL }];
  return detalles.reduce((acumulado, detalle) => {
    const cantidad =
      parseFloat(
        detalle.cantidad ??
          detalle.cantidad_producto ??
          detalle.cantidad_detalle ??
          0
      ) || 0;
    const costo =
      parseFloat(
        detalle.costo_unitario ??
          detalle.precio_unitario ??
          detalle.costo ??
          detalle.costo_unitario_detalle ??
          detalle.id_productos_producto?.precio_venta_producto ??
          0
      ) || 0;
    const subtotalOriginal = parseFloat(detalle.subtotal ?? cantidad * costo);
    const idProductoDetalle =
      detalle.id_productos ??
      detalle.id_producto ??
      detalle.id ??
      detalle.id_products;
    const nombreProducto =
      detalle.nombre_producto ??
      detalle.nombre ??
      detalle.id_productos_producto?.nombre_producto ??
      detalle.id_productos_producto?.nombre ??
      "";

    return fusionarProductoEnLista(acumulado, {
      idProducto: idProductoDetalle ? String(idProductoDetalle) : "",
      nombre: nombreProducto,
      cantidad: cantidad ? String(cantidad) : "",
      costoUnitario: Number.isFinite(costo) ? String(costo) : "0",
      subtotal: Number.isFinite(subtotalOriginal)
        ? subtotalOriginal.toFixed(2)
        : "",
    });
  }, []);
};
const validarRangoFechas = (fechaPedido, fechaEntrega) => {
  if (!fechaPedido || !fechaEntrega) return "";
  const inicio = new Date(fechaPedido);
  const fin = new Date(fechaEntrega);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return "";
  return fin < inicio
    ? "La fecha de entrega debe ser igual o posterior a la fecha del pedido"
    : "";
};

export const ModalPedidos = ({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={null}
      size={size}
      closeOnOverlayClick
      className="modal-mediano"
    >
      {children}
    </Modal>
  );
};

const ModalProductosPedido = ({
  isOpen,
  onClose,
  productosSeleccionados,
  onSave,
}) => {
  const [producto, setProducto] = useState({
    nombre: "",
    cantidad: "",
    editando: false,
    indiceEditando: null,
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [isOpen]);

  const bloquearNotacionCientifica = (event) => {
    if (["e", "E", "+", "-"].includes(event.key)) {
      event.preventDefault();
    }
  };

  const actualizarCampo = (campo, valor) => {
    setProducto((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardarProducto = () => {
    if (!producto.nombre.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }
    if (!producto.cantidad || parseFloat(producto.cantidad) <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    const nuevoProducto = {
      nombre: producto.nombre.trim(),
      cantidad: producto.cantidad,
      costoUnitario: "0",
      subtotal: "0",
    };

    onSave([nuevoProducto]);
    toast.success("Producto agregado al pedido");

    // Resetear el formulario
    setProducto({
      nombre: "",
      cantidad: "",
      editando: false,
      indiceEditando: null,
    });

    onClose();
  };

  if (!isOpen) return null;

  const inputBaseStyle = {
    width: "100%",
    borderRadius: "12px",
    border: "1px solid #d6d9e3",
    padding: "0.65rem 0.9rem",
    fontSize: "0.95rem",
    backgroundColor: "#fff",
    outline: "none",
    transition: "border-color 0.2s ease",
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.24,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.18,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.97,
      y: 14,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.985,
      y: 10,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className="capa-modal"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className="modal-pedidos__product-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.span
              className="modal-pedidos__product-close"
              onClick={onClose}
              whileHover={{ scale: 1.1, color: "#e53e3e" }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              ×
            </motion.span>

            <motion.div
              className="modal-pedidos__product-header"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <motion.h1
                className="modal-pedidos__product-header-title"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                Agregar productos al pedido
              </motion.h1>
            </motion.div>

            <div className="modal-pedidos__product-content">
              <div className="modal-pedidos__product-grid">
                {/* Nombre del producto */}
                <div>
                  <label className="modal-pedidos__compact-label">
                    Producto *
                  </label>
                  <input
                    type="text"
                    value={producto.nombre}
                    onChange={(e) => actualizarCampo("nombre", e.target.value)}
                    className="modal-pedidos__product-input"
                    placeholder="Ingrese el nombre del producto"
                  />
                </div>

                {/* Cantidad */}
                <div>
                  <label className="modal-pedidos__compact-label">
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={producto.cantidad}
                    onChange={(e) =>
                      actualizarCampo("cantidad", e.target.value)
                    }
                    onKeyDown={bloquearNotacionCientifica}
                    className="modal-pedidos__product-input"
                    placeholder="0"
                  />
                </div>

              </div>

              {/* Botones */}
              <div className="modal-pedidos__product-actions">
                <motion.button
                  type="button"
                  onClick={onClose}
                  className="modal-pedidos__btn-cancel"
                  whileHover={{
                    backgroundColor: "#e5e7eb",
                    scale: 1.02,
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="button"
                  onClick={guardarProducto}
                  className="modal-pedidos__btn-add"
                  whileHover={{
                    backgroundColor: "#059669",
                    scale: 1.02,
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  Agregar producto
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ======================================================
   Modal Crear / Editar Pedido (REDISENADO)
====================================================== */
export const ModalFormularioPedido = ({
  isOpen,
  onClose,
  onSubmit,
  pedido,
  title = "Nuevo Pedido",
}) => {
  // Estados Base
  const [activeTab, setActiveTab] = useState("GENERAL");

  const [formData, setFormData] = useState({
    numeroPedido: generarNumeroPedido(),
    idProveedor: "",
    fechaPedido: "",
    estado: "Pendiente",
  });
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [modalProductosAbierto, setModalProductosAbierto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectorType, setSelectorType] = useState("PRODUCTO");
  const [producto, setProducto] = useState({
    nombre: "",
    cantidad: "",
    costoUnitario: "",
    subtotal: "",
  });
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [productoConfigurando, setProductoConfigurando] = useState(null);
  const disabled = false;

  const [errores, setErrores] = useState({});
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);

  const proveedorSeleccionado = useMemo(() => {
    if (!formData.idProveedor) return null;
    return (
      proveedores.find(
        (p) => String(p.id_proveedor) === String(formData.idProveedor)
      ) || null
    );
  }, [proveedores, formData.idProveedor]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [cargandoPedido, setCargandoPedido] = useState(false);
  const estaEditando = Boolean(pedido?.editar);
  const proveedorSeleccionadoRequerido = Boolean(
    String(formData.idProveedor || "").trim()
  );
  const modalTitle =
    title || (estaEditando ? "Editar Pedido" : "Registrar nuevo pedido");
  const formularioDeshabilitado =
    cargandoPedido || loadingProveedores || loadingProductos;

  const cambiarTab = (tab) => {
    if (tab === "DETALLES" && !proveedorSeleccionadoRequerido) {
      setErrores((prev) => ({
        ...prev,
        idProveedor: "Debes seleccionar primero un proveedor",
      }));
      return;
    }
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!productosSeleccionados.length) return;

    setErrores((prev) => {
      if (!prev.productos) return prev;
      const nextErrors = { ...prev };
      delete nextErrors.productos;
      return nextErrors;
    });
  }, [productosSeleccionados]);

  useEffect(() => {
    const cargarProveedores = async () => {
      try {
        setLoadingProveedores(true);
        const proveedoresData = await getProveedores();
        // Filtrar solo proveedores activos (id_estado = 1)
        const proveedoresFiltrados = Array.isArray(proveedoresData)
          ? proveedoresData.filter((proveedor) => proveedor.id_estado === 1)
          : [];
        setProveedores(proveedoresFiltrados);
      } catch (error) {
        setProveedores([]);
      } finally {
        setLoadingProveedores(false);
      }
    };

    const cargarProductos = async () => {
      try {
        setLoadingProductos(true);
        const productosData = await getProductos();
        setProductos(Array.isArray(productosData) ? productosData : []);
      } catch (error) {
        setProductos([]);
      } finally {
        setLoadingProductos(false);
      }
    };

    if (isOpen) {
      cargarProveedores();
      cargarProductos();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === "DETALLES" && !proveedorSeleccionadoRequerido) {
      setActiveTab("GENERAL");
      setProductoConfigurando(null);
      setSearchTerm("");
    }
  }, [activeTab, proveedorSeleccionadoRequerido]);

  useEffect(() => {
    if (!isOpen) return;

    const resetFormulario = () => {
      // Get today's date in local timezone (YYYY-MM-DD format)
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const localDate = `${year}-${month}-${day}`;

      setFormData({
        numeroPedido: generarNumeroPedido(),
        idProveedor: "",
        fechaPedido: localDate,
        estado: "Pendiente",
      });
      setProductosSeleccionados([]);
      setModalProductosAbierto(false);
      setErrores({});
    };

    if (pedido && pedido.editar) {
      setFormData({
        numeroPedido: pedido.numero_pedido || generarNumeroPedido(),
        idProveedor: pedido.id_proveedor ? String(pedido.id_proveedor) : "",
        fechaPedido: pedido.fecha_pedido || "",
        estado: obtenerTextoEstado(pedido.id_estado || 3),
      });
      if (
        Array.isArray(pedido.detalles_pedidos) &&
        pedido.detalles_pedidos.length > 0
      ) {
        setProductosSeleccionados(
          construirProductosDesdeDetalles(pedido.detalles_pedidos)
        );
      }

      const cargarPedido = async () => {
        try {
          setCargandoPedido(true);
          const pedidoId = pedido.id_pedido || pedido.id;
          if (!pedidoId) {
            toast.error("No se pudo determinar el pedido a editar");
            return;
          }

          const pedidoDesdeApi = await getPedidoById(pedidoId);
          const productosFormulario = construirProductosDesdeDetalles(
            pedidoDesdeApi?.detalles_pedidos || pedido.detalles_pedidos
          );

          const proveedorId =
            pedidoDesdeApi?.id_proveedor ?? pedido.id_proveedor ?? "";
          const fechaPedido =
            pedidoDesdeApi?.fecha_pedido || pedido.fecha_pedido || "";
          const fechaEntrega =
            pedidoDesdeApi?.fecha_entrega || pedido.fecha_entrega || "";
          setFormData((prev) => ({
            ...prev,
            numeroPedido: pedidoDesdeApi?.numero_pedido || prev.numeroPedido,
            idProveedor:
              proveedorId === "" || proveedorId === null
                ? ""
                : String(proveedorId),
            fechaPedido,
            fechaEntrega,
            estado: obtenerTextoEstado(
              pedidoDesdeApi?.id_estado ?? pedido.id_estado ?? 3
            ),
          }));
          if (productosFormulario.length > 0) {
            setProductosSeleccionados(productosFormulario);
          }
          setErrores({});
        } catch (error) {
          console.error("Error al cargar el pedido:", error);
          toast.error("No se pudo cargar la información del pedido");
        } finally {
          setCargandoPedido(false);
        }
      };

      if (!pedido.detalles_pedidos || pedido.detalles_pedidos.length === 0) {
        cargarPedido();
      }
    } else {
      resetFormulario();
    }
  }, [pedido, isOpen, onClose]);

  // Funciones para manejar el formulario de productos
  const bloquearNotacionCientifica = (event) => {
    if (["e", "E", "+", "-"].includes(event.key)) {
      event.preventDefault();
    }
  };

  const actualizarCampo = (campo, valor) => {
    const actualizado = { ...producto, [campo]: valor };

    // Calcular subtotal automaticamente cuando cambian cantidad o costo unitario
    if (campo === "cantidad" || campo === "costoUnitario") {
      const cantidad = parseFloat(actualizado.cantidad) || 0;
      const costo = parseFloat(actualizado.costoUnitario) || 0;
      actualizado.subtotal = (cantidad * costo).toFixed(2);
    }

    setProducto(actualizado);
  };

  const guardarProducto = () => {
    if (!producto.nombre.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }
    if (!producto.cantidad || parseFloat(producto.cantidad) <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    const cantidadNumerica = parseFloat(producto.cantidad) || 0;
    const costoNumerico = parseFloat(producto.costoUnitario);
    const costoUnitarioNormalizado = Number.isFinite(costoNumerico)
      ? costoNumerico
      : 0;
    const subtotalNormalizado = (cantidadNumerica * costoUnitarioNormalizado)
      .toFixed(2);

    const nuevoProducto = {
      nombre: producto.nombre.trim(),
      cantidad: producto.cantidad,
      costoUnitario: String(costoUnitarioNormalizado),
      subtotal: subtotalNormalizado,
    };

    if (producto.editando && producto.indiceEditando !== null) {
      // Actualizar producto existente
      setProductosSeleccionados((prev) => {
        const updated = [...prev];
        updated[producto.indiceEditando] = nuevoProducto;
        return updated;
      });
      toast.success("Producto actualizado en el pedido");
    } else {
      // Agregar nuevo producto
      setProductosSeleccionados((prev) =>
        fusionarProductoEnLista(prev, nuevoProducto)
      );
      toast.success("Producto agregado al pedido");
    }

    // Resetear el formulario
    setProducto({
      nombre: "",
      cantidad: "",
      costoUnitario: "",
      subtotal: "",
      editando: false,
      indiceEditando: null,
    });
  };

  const agregarLinea = () => {
    // Esta funcion ahora solo resetea el formulario para agregar otro producto
    setProducto({
      nombre: "",
      cantidad: "",
      costoUnitario: "",
      subtotal: "",
    });
  };

  // Funciones para manejar productos
  const addToCart = (item) => {
    // Validar que los campos requeridos esten llenos antes de agregar productos
    if (!formData.idProveedor) {
      setErrores((prev) => ({
        ...prev,
        idProveedor: "Debes seleccionar primero un proveedor",
      }));
      return;
    }

    if (!formData.fechaPedido) {
      toast.error(
        "Debe seleccionar la fecha de pedido antes de agregar productos"
      );
      return;
    }

    if (!formData.fechaEntrega) {
      toast.error(
        "Debe seleccionar la fecha de entrega antes de agregar productos"
      );
      return;
    }

    const id = item.id_productos ?? item.id;
    const nombre = item.nombre_producto || item.nombre || "";
    const costoSugerido = parseFloat(
      item.precio_venta_producto || item.precio_venta || item.precio || 0
    );

    const existingIdx = productosSeleccionados.findIndex(
      (p) => p.idProducto === String(id)
    );

    if (existingIdx >= 0) {
      toast.error("Este producto ya esta en el pedido");
      return;
    }

    // Abrir configuración inline para cantidad y precio
    setProductoConfigurando({
      id,
      idProducto: String(id),
      nombre,
      costoSugerido,
      cantidad: "1",
      costoUnitario: "0",
      subtotal: "0",
    });
  };



  const removeFromCart = (index) => {
    setProductosSeleccionados((prev) => prev.filter((_, i) => i !== index));
    toast.success("Producto removido del pedido");
  };

  // Filtrar productos
  const filteredItems = useMemo(() => {
    if (!productos || !Array.isArray(productos)) return [];
    const lower = (searchTerm || "").toLowerCase();
    return productos
      .filter((p) => {
        const name = p.nombre_producto || p.nombre || "";
        const code = p.codigo || "";
        return (
          !lower ||
          name.toLowerCase().includes(lower) ||
          code.toLowerCase().includes(lower)
        );
      })
      .slice(0, 50);
  }, [productos, searchTerm]);

  const loadingItems = loadingProductos;

  const validarCampo = (name, value) => {
    let mensaje = "";
    if (name === "numeroPedido" && !value.trim())
      mensaje = "El número de pedido es obligatorio";
    else if (name === "idProveedor" && !value)
      mensaje = "Debe seleccionar un proveedor";
    else if (name !== "subtotal" && !value.trim())
      mensaje = `El campo ${name} es obligatorio`;
    setErrores((prev) => ({ ...prev, [name]: mensaje }));
    return mensaje === "";
  };

  const validar = () => {
    let temp = {};

    if (!formData.numeroPedido.trim()) {
      temp.numeroPedido = "El número de pedido es obligatorio";
    }

    if (!formData.idProveedor) {
      temp.idProveedor = "Debe seleccionar un proveedor";
    }

    // Validar fechas
    if (!formData.fechaPedido) {
      temp.fechaPedido = "La fecha del pedido es obligatoria";
    }

    setErrores(temp);
    return Object.keys(temp).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const actualizado = { ...formData, [name]: value };
    setFormData(actualizado);
    validarCampo(name, value);
    if (name === "fechaPedido" || name === "fechaEntrega") {
      const mensajeRango = validarRangoFechas(
        actualizado.fechaPedido,
        actualizado.fechaEntrega
      );
      if (actualizado.fechaPedido && actualizado.fechaEntrega) {
        setErrores((prev) => ({ ...prev, fechaEntrega: mensajeRango }));
      } else if (!mensajeRango) {
        setErrores((prev) => {
          const nuevos = { ...prev };
          if (
            nuevos.fechaEntrega &&
            nuevos.fechaEntrega.includes("fecha de entrega debe ser")
          ) {
            delete nuevos.fechaEntrega;
          }
          return nuevos;
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!validar()) return;
    if (productosSeleccionados.length === 0) {
      setErrores((prev) => ({
        ...prev,
        productos: "Debe agregar al menos un producto",
      }));
      return;
    }

    // Preparar solo los datos necesarios para la API
    const apiData = {
      numero_pedido: (formData.numeroPedido || generarNumeroPedido()).trim(),
      id_proveedor: parseInt(formData.idProveedor, 10),
      fecha_pedido: formData.fechaPedido,
      fecha_entrega: formData.fechaEntrega,
      id_estado: obtenerIdEstado(formData.estado),
    };

    // Anadir el ID si es edicion, pero solo si existe
    if (pedido?.id_pedido) {
      apiData.id_pedido = pedido.id_pedido;
    } else if (pedido?.id) {
      apiData.id_pedido = pedido.id;
    }

    try {
      setIsSaving(true);
      const resultado = await Promise.resolve(
        onSubmit({
          apiData,
          productos: productosSeleccionados,
        })
      );
      if (resultado === false) {
        throw new Error(
          pedido?.id_pedido || pedido?.id
            ? "No se pudo actualizar el pedido"
            : "No se pudo crear el pedido"
        );
      }
      toast.success(
        pedido?.id_pedido || pedido?.id
          ? "Pedido actualizado exitosamente"
          : "Pedido creado exitosamente"
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo guardar el pedido"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.24,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.18,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.97,
      y: 14,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.28,
        ease: [0.22, 1, 0.36, 1],
      },
    },
    exit: {
      opacity: 0,
      scale: 0.985,
      y: 10,
      transition: {
        duration: 0.2,
        ease: [0.4, 0, 1, 1],
      },
    },
  };

  return (
    <Modal
        title={modalTitle}
        onClose={onClose}
        size="lg"
        className="venta-redesigned"
        footer={
          disabled ? (
            <button className="boton boton-primario" onClick={onClose}>
              Cerrar
            </button>
          ) : (
            <>
              <button className="boton boton-secundario" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="boton boton-primario btn-save-sale"
                onClick={handleSubmit}
                disabled={disabled || isSaving}
              >
                Guardar pedido
              </button>
            </>
          )
        }
      >
      <div className="modal-pedidos__content-root">
        {/* Tabs */}
        <div className="modal-pedidos__tabs">
          <motion.button
            className={`modal-tab-btn modal-pedidos__tab-btn ${
              activeTab === "GENERAL" ? "modal-pedidos__tab-btn--active" : ""
            }`}
            onClick={() => cambiarTab("GENERAL")}
            whileTap={{ scale: 0.98 }}
          >
            General
          </motion.button>
          <motion.button
            className={`modal-tab-btn modal-pedidos__tab-btn modal-pedidos__tab-btn--icon ${
              activeTab === "DETALLES" ? "modal-pedidos__tab-btn--active" : ""
            } ${
              !proveedorSeleccionadoRequerido
                ? "modal-pedidos__tab-btn--disabled"
                : ""
            }`}
            onClick={() => cambiarTab("DETALLES")}
            whileTap={
              proveedorSeleccionadoRequerido ? { scale: 0.98 } : undefined
            }
            aria-disabled={!proveedorSeleccionadoRequerido}
            title={
              !proveedorSeleccionadoRequerido
                ? "Seleccione un proveedor en General para continuar"
                : undefined
            }
          >
            Detalles
            {productosSeleccionados.length > 0 && (
              <motion.span
                className="tab-badge modal-pedidos__tab-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                {productosSeleccionados.length}
              </motion.span>
            )}
          </motion.button>
        </div>

        {!proveedorSeleccionadoRequerido && (
          <div className="modal-pedidos__provider-hint">
            Debes seleccionar primero un proveedor para habilitar la seccion
            de detalles.
          </div>
        )}

        <div
          className="modal-body-content modal-body-content--spacious"
        >
          {/* ---------------- TAB: GENERAL ---------------- */}
          <AnimatePresence mode="wait">
            {activeTab === "GENERAL" && (
              <motion.div
                key="general-tab"
                className="general-tab-layout"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="general-form-column">
                  <motion.div
                    className="modal-form-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <h3 className="modal-section-title">Datos del pedido</h3>

                    {estaEditando && (
                      <motion.div
                        className="modal-field-group"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                      >
                        <label className="modal-field-label">Estado</label>
                        <select
                          value={formData.estado}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              estado: e.target.value,
                            }))
                          }
                          className={`modal-field-input modal-field-input--select ${
                            errores.estado ? "modal-field-input--error" : ""
                          }`}
                          disabled={disabled}
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="En Proceso">En Proceso</option>
                          <option value="Completado">Completado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                        {errores.estado ? (
                          <p className="modal-field-error-text">{errores.estado}</p>
                        ) : null}
                      </motion.div>
                    )}

                    <motion.div
                      className="modal-field-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <label className="modal-field-label">Proveedor</label>
                      {proveedorSeleccionado ? (
                        <div className="modal-pedidos__provider-selected">
                          <div className="modal-pedidos__provider-avatar">
                            <Building2 size={18} color="#6366f1" />
                          </div>

                          <div className="modal-pedidos__provider-info">
                            <div className="modal-pedidos__provider-name">
                              {proveedorSeleccionado.nombre_proveedor}
                            </div>
                            <div className="modal-pedidos__provider-meta">
                              {proveedorSeleccionado.email_proveedor ||
                                proveedorSeleccionado.telefono_proveedor ||
                                `ID: ${proveedorSeleccionado.id_proveedor}`}
                            </div>
                          </div>

                          {!disabled && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, idProveedor: "" }));
                                setErrores((prev) => ({ ...prev, idProveedor: "" }));
                              }}
                              className="modal-pedidos__provider-clear-btn"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ) : loadingProveedores ? (
                        <div
                          className="modal-field-input modal-field-input--muted"
                        >
                          Cargando proveedores...
                        </div>
                      ) : (
                        <select
                          name="idProveedor"
                          value={formData.idProveedor}
                          onChange={handleChange}
                          className={`modal-field-input modal-field-input--select ${
                            errores.idProveedor ? "modal-field-input--error" : ""
                          }`}
                          disabled={disabled}
                        >
                          <option value="">Seleccionar Proveedor</option>
                          {proveedores.map((p) => (
                            <option key={p.id_proveedor} value={p.id_proveedor}>
                              {p.nombre_proveedor}
                            </option>
                          ))}
                        </select>
                      )}
                      {errores.idProveedor ? (
                        <p className="modal-field-error-text">
                          {errores.idProveedor}
                        </p>
                      ) : null}
                    </motion.div>

                    <motion.div
                      className="modal-field-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      <label className="modal-field-label">Fecha de pedido</label>
                      <input
                        type="date"
                        value={formData.fechaPedido}
                        className="modal-field-input modal-field-input--readonly"
                        disabled={true}
                        readOnly
                      />
                    </motion.div>


                  </motion.div>
                </div>

                <div className="general-summary-column">
                  <motion.div
                    className="venta-resumen-card modal-pedidos__summary-card"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <div className="modal-pedidos__summary-header">
                      <div className="modal-pedidos__summary-icon">
                        <ShoppingCart size={20} color="white" />
                      </div>
                      <h4 className="modal-pedidos__summary-title">
                        Resumen del pedido
                      </h4>
                    </div>

                    {productosSeleccionados.length > 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        {/* Tabla de productos en el resumen */}
                        <div className="modal-pedidos__summary-table-wrap">
                          <div className="modal-pedidos__summary-table-head">
                            <h5 className="modal-pedidos__summary-table-title">
                              Productos en el pedido (
                              {productosSeleccionados.length})
                            </h5>
                          </div>

                          <div className="modal-pedidos__summary-table-scroll">
                            <table className="modal-pedidos__summary-table">
                              <thead className="modal-pedidos__summary-thead">
                                <tr>
                                  <th className="modal-pedidos__summary-th-product">
                                    Producto
                                  </th>
                                  <th className="modal-pedidos__summary-th-qty">
                                    Cant.
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {productosSeleccionados.map((item, idx) => (
                                  <motion.tr
                                    key={idx}
                                    className={`modal-pedidos__summary-row ${
                                      idx % 2 === 0
                                        ? "modal-pedidos__summary-row--even"
                                        : "modal-pedidos__summary-row--odd"
                                    } ${
                                      idx < productosSeleccionados.length - 1
                                        ? "modal-pedidos__summary-row--border"
                                        : ""
                                    }`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                      delay: 0.4 + idx * 0.05,
                                      duration: 0.3,
                                    }}
                                  >
                                    <td className="modal-pedidos__summary-td-product">
                                      <div className="modal-pedidos__summary-product-name">
                                        {item.nombre ||
                                          `Producto ${item.idProducto}`}
                                      </div>
                                      <span
                                        className="tipo-badge producto modal-pedidos__summary-product-badge"
                                      >
                                        Producto
                                      </span>
                                    </td>
                                    <td className="modal-pedidos__summary-td-qty">
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.cantidad}
                                        onChange={(e) => {
                                          const newCantidad = parseFloat(e.target.value) || 1;
                                          const updatedProductos = productosSeleccionados.map((p, i) =>
                                            i === idx ? { ...p, cantidad: String(newCantidad) } : p
                                          );
                                          setProductosSeleccionados(updatedProductos);
                                        }}
                                        className="modal-pedidos__summary-qty-input"
                                      />
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Estadisticas resumidas */}
                        <div className="modal-pedidos__stats-grid">
                          <div className="modal-pedidos__stat-card modal-pedidos__stat-card--blue">
                            <div className="modal-pedidos__stat-label modal-pedidos__stat-label--blue">
                              Productos
                            </div>
                            <div className="modal-pedidos__stat-value modal-pedidos__stat-value--blue">
                              {productosSeleccionados.length}
                            </div>
                          </div>

                          <div className="modal-pedidos__stat-card modal-pedidos__stat-card--green">
                            <div className="modal-pedidos__stat-label modal-pedidos__stat-label--green">
                              Cantidad Total
                            </div>
                            <div className="modal-pedidos__stat-value modal-pedidos__stat-value--green">
                              {productosSeleccionados.reduce(
                                (acc, item) =>
                                  acc + parseFloat(item.cantidad || 0),
                                0
                              )}
                            </div>
                          </div>
                        </div>

                        <motion.div
                          className="modal-pedidos__provider-note"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, duration: 0.3 }}
                        >
                          <div className="modal-pedidos__provider-note-text">
                            El proveedor define los precios del pedido.
                          </div>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div
                        className="modal-pedidos__empty-state"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        <div className="modal-pedidos__empty-icon">
                          <ShoppingCart size={24} color="white" />
                        </div>
                        <h5 className="modal-pedidos__empty-title">
                          Carrito vacio
                        </h5>
                        <p className="modal-pedidos__empty-text">
                          No hay productos agregados al pedido.
                        </p>
                        <button
                          className="modal-pedidos__empty-action-btn"
                          onClick={() => cambiarTab("DETALLES")}
                        >
                          Ir a Detalles
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ---------------- TAB: DETALLES ---------------- */}
            {activeTab === "DETALLES" && (
              <motion.div
                key="detalles-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <div className="general-tab-layout">
                  {/* Left Column: Add Items */}
                  <div className="general-form-column">
                    {/* Buscar y seleccionar productos */}
                    <motion.div
                      className="search-section-container modal-pedidos__search-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.4 }}
                    >
                      {/* Header */}
                      <div className="modal-pedidos__search-header">
                        <h3 className="modal-pedidos__search-title">
                          Buscar y agregar productos
                        </h3>
                        <p className="modal-pedidos__search-subtitle">
                          Busque productos existentes para agregarlos al pedido
                        </p>
                      </div>

                      {/* Buscador */}
                      <div className="modal-pedidos__search-wrap">
                        <div className="modal-pedidos__search-input-wrap">
                          <Search className="modal-pedidos__search-icon" />
                          <input
                            type="text"
                            placeholder={
                              proveedorSeleccionadoRequerido
                                ? "Buscar productos..."
                                : "Seleccione un proveedor para habilitar la búsqueda"
                            }
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="modal-pedidos__search-input"
                            disabled={!proveedorSeleccionadoRequerido}
                          />
                        </div>
                      </div>
                      {errores.productos ? (
                        <p className="modal-field-error-text">{errores.productos}</p>
                      ) : null}

                      {/* Lista de productos */}
                      <div className="modal-pedidos__item-list">
                        {!proveedorSeleccionadoRequerido ? (
                          <div className="modal-pedidos__item-list-state modal-pedidos__item-list-state--locked">
                            Seleccione un proveedor en General para agregar
                            productos.
                          </div>
                        ) : loadingItems ? (
                          <div className="modal-pedidos__item-list-state">
                            Cargando productos...
                          </div>
                        ) : filteredItems.length === 0 ? (
                          <div className="modal-pedidos__item-list-state">
                            {searchTerm
                              ? "No se encontraron productos"
                              : "No hay productos disponibles"}
                          </div>
                        ) : (
                          <div>
                            {filteredItems.map((item) => {
                              const isConfiguring = productoConfigurando?.id === item.id_productos;

                              return (
                                <motion.div
                                  key={item.id_productos}
                                  className={`modal-pedidos__item-row ${
                                    isConfiguring
                                      ? "modal-pedidos__item-row--config"
                                      : ""
                                  }`}
                                  whileHover={{
                                    backgroundColor: isConfiguring ? "#f0f9ff" : "#f9fafb",
                                  }}
                                >
                                  {isConfiguring ? (
                                    // Inline configuration form
                                    <div className="modal-pedidos__config-form">
                                      <div className="modal-pedidos__config-title-wrap">
                                        <strong>{item.nombre_producto || item.nombre}</strong>
                                      </div>

                                      <div className="modal-pedidos__config-grid">
                                        <div>
                                          <label className="modal-pedidos__config-label">
                                            Cantidad:
                                          </label>
                                          <input
                                            type="number"
                                            min="1"
                                            value={productoConfigurando.cantidad}
                                            onChange={(e) => setProductoConfigurando(prev => ({
                                              ...prev,
                                              cantidad: e.target.value
                                            }))}
                                            className="modal-pedidos__config-input"
                                          />
                                        </div>

                                      </div>

                                      <div className="modal-pedidos__config-actions">
                                        <button
                                          type="button"
                                          onClick={() => setProductoConfigurando(null)}
                                          className="modal-pedidos__config-btn-cancel"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!proveedorSeleccionadoRequerido) {
                                              return;
                                            }
                                            const cantidadNumerica = parseFloat(productoConfigurando.cantidad);
                                            if (isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
                                              toast.error("Cantidad inválida");
                                              return;
                                            }

                                            setProductosSeleccionados((prev) =>
                                              fusionarProductoEnLista(prev, {
                                                idProducto: productoConfigurando.idProducto,
                                                nombre: productoConfigurando.nombre,
                                                cantidad: cantidadNumerica.toString(),
                                                costoUnitario: "0",
                                                subtotal: "0",
                                              })
                                            );

                                            toast.success("Producto agregado al pedido");
                                            setProductoConfigurando(null);
                                          }}
                                          className="modal-pedidos__config-btn-add"
                                        >
                                          Agregar al pedido
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    // Product display
                                    <div
                                      className="modal-pedidos__item-display"
                                      onClick={() => {
                                        if (!proveedorSeleccionadoRequerido) {
                                          return;
                                        }
                                        setProductoConfigurando({
                                          id: item.id_productos,
                                          idProducto: String(item.id_productos),
                                          nombre: item.nombre_producto || item.nombre,
                                          cantidad: "1",
                                          costoUnitario: "0",
                                          subtotal: "0",
                                        });
                                      }}
                                      >
                                      <div>
                                        <div className="modal-pedidos__item-name">
                                          {item.nombre_producto || item.nombre}
                                        </div>
                                      </div>
                                      <motion.button
                                        type="button"
                                        className="modal-pedidos__item-add-btn"
                                        whileHover={{
                                          backgroundColor: "#059669",
                                          scale: 1.05,
                                        }}
                                        whileTap={{ scale: 0.95 }}
                                      >
                                        Agregar
                                      </motion.button>
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Tabla de productos agregados - Estilo resumen */}
                    {productosSeleccionados.length > 0 && (
                      <motion.div
                        className="modal-pedidos__selected-section"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                      >
                        <h5 className="modal-pedidos__selected-title">
                          Productos en el pedido (
                          {productosSeleccionados.length})
                        </h5>

                        <div className="contenedor-tabla">
                          <table className="tabla-datos">
                            <thead className="modal-pedidos__selected-thead">
                              <tr>
                                <th className="modal-pedidos__selected-th-product">
                                  Producto
                                </th>
                                <th className="modal-pedidos__selected-th-qty">
                                  Cant.
                                </th>
                                <th className="modal-pedidos__selected-th-actions">
                                  Acciones
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {productosSeleccionados.map((item, idx) => (
                                <motion.tr
                                  key={idx}
                                  className={`modal-pedidos__selected-row ${
                                    idx % 2 === 0
                                      ? "modal-pedidos__selected-row--even"
                                      : "modal-pedidos__selected-row--odd"
                                  } ${
                                    idx < productosSeleccionados.length - 1
                                      ? "modal-pedidos__selected-row--border"
                                      : ""
                                  }`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    delay: 0.4 + idx * 0.05,
                                    duration: 0.3,
                                  }}
                                >
                                  <td className="modal-pedidos__selected-td-product">
                                    <div className="modal-pedidos__selected-product-name">
                                      {item.nombre ||
                                        `Producto ${item.idProducto}`}
                                    </div>
                                    <span
                                      className="tipo-badge producto modal-pedidos__selected-product-badge"
                                    >
                                      Producto
                                    </span>
                                  </td>
                                  <td className="modal-pedidos__selected-td-qty">
                                    {item.cantidad}
                                  </td>
                                  <td className="modal-pedidos__selected-td-actions">
                                    <button
                                      onClick={() => removeFromCart(idx)}
                                      title="Eliminar producto"
                                      className="boton-acción badge-eliminar modal-pedidos__selected-delete-btn"
                                    >
                                      <Trash2 size={14} />
                                      Eliminar
                                    </button>
                                  </td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal para agregar productos */}
      <ModalProductosPedido
        isOpen={modalProductosAbierto}
        onClose={() => setModalProductosAbierto(false)}
        productosSeleccionados={productosSeleccionados}
        onSave={(productos) => {
          setProductosSeleccionados((prev) =>
            fusionarProductosEnLista(prev, productos)
          );
          setModalProductosAbierto(false);
        }}
      />


    </Modal>
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

  // Funcion para formatear el precio
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
      fields={[
        {
          key: "numero_pedido",
          label: "Nro Pedido",
          format: (value) => <strong>{value || "No especificado"}</strong>,
        },
        {
          key: "nombre_proveedor",
          label: "Proveedor",
          format: (value) => value || "No especificado",
        },
        {
          key: "fecha_pedido",
          label: "Fecha Pedido",
          format: (value) => value || "No especificado",
        },
        {
          key: "fecha_entrega",
          label: "Fecha Entrega",
          format: (value) => value || "No especificado",
        },
        {
          key: "id_estado",
          label: "Estado",
          format: (value) => ESTADOS_PEDIDO[value] || "Pendiente",
        },
      ]}
      warningMessage={
        <>
          <p>
            Al eliminar este pedido, se perdera toda la información asociada
            incluyendo:
          </p>
          <ul className="modal-warning-list">
            <li>Historial de pedidos</li>
            <li>Relaciones con proveedores</li>
            <li>Información de inventario relacionada</li>
          </ul>
          <p className="modal-warning-emphasis">
            ¿Estas completamente seguro de que deseas continuar?
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
    const clases = {
      Pendiente: "modal-pedidos__estado-btn--pendiente",
      "En Proceso": "modal-pedidos__estado-btn--proceso",
      Completado: "modal-pedidos__estado-btn--completado",
      Cancelado: "modal-pedidos__estado-btn--cancelado",
    };
    return clases[estado] || "modal-pedidos__estado-btn--default";
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
  const fechaEntrega = normalizarFecha(pedido.fecha_entrega);

  const detallesPedido = Array.isArray(pedido.detalles_pedidos)
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
      <div className="modal-pedidos__content-root">
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
                  <label className="modal-field-label">Nro de pedido</label>
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
                  <label className="modal-field-label">Proveedor</label>
                  <input
                    type="text"
                    className="modal-field-input"
                    value={pedido.nombre_proveedor || "Sin proveedor"}
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
                  transition={{ delay: 0.6, duration: 0.3 }}
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
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  delay: 0.4 + i * 0.1,
                                  duration: 0.3,
                                }}
                                className={`modal-pedidos__view-row ${
                                  i % 2 === 0
                                    ? "modal-pedidos__view-row--even"
                                    : "modal-pedidos__view-row--odd"
                                }`}
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
export const ModalCambiarEstadoPedido = ({
  isOpen,
  onClose,
  onConfirm,
  pedido,
}) => {
  const [estadoSeleccionado, setEstadoSeleccionado] = useState(3);

  const estadosMap = {
    3: "Pendiente",
    4: "En Proceso",
    5: "Completado",
    6: "Cancelado",
  };

  const estadosDisponibles = [
    { id_estado: 3, nombre_estado: "Pendiente" },
    { id_estado: 4, nombre_estado: "En Proceso" },
    { id_estado: 5, nombre_estado: "Completado" },
    { id_estado: 6, nombre_estado: "Cancelado" },
  ];

  const estadoActualTexto =
    pedido?.estado || estadosMap[Number(pedido?.id_estado)] || "Pendiente";

  const estadoActualId = Number(
    Object.keys(estadosMap).find((key) => estadosMap[key] === estadoActualTexto) ||
      pedido?.id_estado ||
      3,
  );

  useEffect(() => {
    if (isOpen && pedido) {
      setEstadoSeleccionado(Number(pedido.id_estado || estadoActualId || 3));
    }
  }, [isOpen, pedido, estadoActualId]);

  if (!pedido) return null;

  const nuevoEstadoTexto = estadosMap[Number(estadoSeleccionado)] || "Pendiente";
  const esMismoEstado = Number(estadoSeleccionado) === Number(estadoActualId);

  const tipoModal =
    nuevoEstadoTexto === "Cancelado"
      ? "deactivate"
      : nuevoEstadoTexto === "En Proceso" || nuevoEstadoTexto === "Completado"
        ? "activate"
        : "warning";

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
        <strong>Nuevo estado:</strong> {nuevoEstadoTexto}
      </div>
    </div>
  );

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        if (esMismoEstado) {
          onClose();
          return;
        }
        onConfirm?.(pedido, Number(estadoSeleccionado));
        onClose();
      }}
      targetStatus={estadoSeleccionado}
      type={tipoModal}
      title="Cambiar estado del pedido"
      message={
        esMismoEstado
          ? "Selecciona un estado diferente para guardar el cambio."
          : `El pedido cambiara de "${estadoActualTexto}" a "${nuevoEstadoTexto}".`
      }
      confirmText={esMismoEstado ? "Cerrar" : "Confirmar cambio"}
      details={detallePedido}
    >
      <div className="modal-pedidos__status-card">
        <label
          htmlFor="estado-pedido-select"
          className="modal-pedidos__status-label"
        >
          Estado del pedido
        </label>
        <select
          id="estado-pedido-select"
          value={estadoSeleccionado}
          onChange={(e) => setEstadoSeleccionado(Number(e.target.value))}
          className="modal-pedidos__status-select"
        >
          {estadosDisponibles.map((estado) => (
            <option key={estado.id_estado} value={estado.id_estado}>
              {estado.nombre_estado}
            </option>
          ))}
        </select>
      </div>
    </ConfirmModal>
  );
};

export default ModalFormularioPedido;
