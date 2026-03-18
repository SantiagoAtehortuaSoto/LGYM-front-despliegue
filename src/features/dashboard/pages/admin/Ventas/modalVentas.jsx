import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Plus,
  Trash2,
  User,
  UserX,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "../../../../../shared/components/Modal/Modal";
import { obtenerUsuarios } from "../../../hooks/Usuarios_API/API_Usuarios";
import { getProductos } from "../../../hooks/Productos_API/API_productos";
import { obtenerServicios } from "../../../hooks/Servicios_API/Servicios_API";
import { obtenerMembresias } from "../../../hooks/Membresias_API_AD/Membresias_AD";
import "../../../../../shared/styles/restructured/components/modal-ventas.css";

void motion;

const formatCOP = (valor = 0) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(
    valor
  );

const getTodayISO = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatFechaVista = (value) => {
  if (!value) return "Sin fecha";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (dateOnly) {
    const parsedDateOnly = new Date(
      Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0)
    );
    return parsedDateOnly.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "America/Bogota",
    });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Bogota",
  });
};

const normalizeTipoVenta = (tipoRaw) => {
  const text = String(tipoRaw || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (text.includes("MEMB")) return "MEMBRESIA";
  if (text.includes("SERV")) return "SERVICIO";
  if (text.includes("PROD")) return "PRODUCTO";
  return "PRODUCTO";
};

const getTipoVentaMeta = (tipoRaw) => {
  const key = normalizeTipoVenta(tipoRaw);
  if (key === "MEMBRESIA") {
    return { key, label: "Membresía", color: "#16a34a" };
  }
  if (key === "SERVICIO") {
    return { key, label: "Servicio", color: "#0d9488" };
  }
  return { key: "PRODUCTO", label: "Producto", color: "#2563eb" };
};

const getResumenTipoVenta = (detalles = []) => {
  const keys = Array.from(
    new Set((detalles || []).map((d) => getTipoVentaMeta(d?.tipo_venta || d?.tipo).key))
  );

  if (keys.length === 0) return { key: "PRODUCTO", label: "Producto", color: "#2563eb" };
  if (keys.length > 1) return { key: "MIXTA", label: "Mixta", color: "#6b7280" };
  return getTipoVentaMeta(keys[0]);
};

const ESTADO_VENTA_LABELS = {
  1: "Activo",
  2: "Inactivo",
  3: "Pendiente",
  4: "En proceso",
  5: "Completado",
  6: "Cancelado",
};

const getEstadoVentaLabel = (venta = {}) => {
  const rawEstado =
    venta?.estado_venta ??
    venta?.estado ??
    venta?.id_estado ??
    venta?.id_estado_estado?.id ??
    venta?.id_estado_estado?.estado;

  if (rawEstado === null || rawEstado === undefined || rawEstado === "") {
    return "Sin estado";
  }

  const estadoNumero = Number(rawEstado);
  if (Number.isFinite(estadoNumero) && ESTADO_VENTA_LABELS[estadoNumero]) {
    return ESTADO_VENTA_LABELS[estadoNumero];
  }

  const key = String(rawEstado).trim().toUpperCase().replace(/\s+/g, "_");
  if (key === "PENDIENTE") return "Pendiente";
  if (key === "EN_PROCESO") return "En proceso";
  if (key === "COMPLETADO") return "Completado";
  if (key === "CANCELADO" || key === "ANULADO") return "Cancelado";
  if (key === "ACTIVO") return "Activo";
  if (key === "INACTIVO") return "Inactivo";

  return String(rawEstado);
};

const getVentaTabButtonClass = (isActive) =>
  `modal-tab-btn modal-ventas__tab-btn${
    isActive ? " modal-ventas__tab-btn--active" : ""
  }`;

const getVentaUserDropdownRowClass = (index, total) =>
  `modal-ventas__dropdown-item${
    index < total - 1 ? " modal-ventas__dropdown-item--border" : ""
  }`;

const getVentaSummaryRowClass = (index, total) =>
  `modal-ventas__summary-row ${
    index % 2 === 0
      ? "modal-ventas__summary-row--even"
      : "modal-ventas__summary-row--odd"
  }${index < total - 1 ? " modal-ventas__summary-row--border" : ""}`;

const getVentaResultsWrapClass = (hasItems) =>
  `modal-ventas__results-scroll ${
    hasItems
      ? "modal-ventas__results-scroll--compact"
      : "modal-ventas__results-scroll--empty"
  }`;

const getVentaResultItemClass = (isOutOfStock) =>
  `modal-ventas__result-item${
    isOutOfStock ? " modal-ventas__result-item--out" : ""
  }`;

const getVentaStockClass = (stock) => {
  if (stock <= 0) return "modal-ventas__stock modal-ventas__stock--out";
  if (stock <= 5) return "modal-ventas__stock modal-ventas__stock--low";
  return "modal-ventas__stock modal-ventas__stock--ok";
};

const getVentaAddItemButtonClass = (isOutOfStock) =>
  `modal-ventas__add-item-btn${
    isOutOfStock ? " modal-ventas__add-item-btn--disabled" : ""
  }`;

const getVentaQtyButtonClass = (isDisabled) =>
  `modal-ventas__qty-btn${isDisabled ? " modal-ventas__qty-btn--disabled" : ""}`;

const getVentaInfoBadgeClass = (tipoKey) =>
  `boton modal-ventas__info-badge modal-ventas__info-badge--${String(
    tipoKey || "producto"
  ).toLowerCase()}`;

const ESTADO_COLOR_CLASS_MAP = {
  "#f59e0b": "modal-ventas__info-badge--pendiente",
  "#3b82f6": "modal-ventas__info-badge--proceso",
  "#10b981": "modal-ventas__info-badge--completado",
  "#ef4444": "modal-ventas__info-badge--cancelado",
  "#6b7280": "modal-ventas__info-badge--inactivo",
};

const getVentaEstadoBadgeClass = (colorEstado) =>
  `boton modal-ventas__info-badge ${
    ESTADO_COLOR_CLASS_MAP[String(colorEstado || "").toLowerCase()] ||
    "modal-ventas__info-badge--completado"
  }`;

const getVentaDetalleRowClass = (index) =>
  `modal-ventas__detalle-row ${
    index % 2 === 0
      ? "modal-ventas__detalle-row--even"
      : "modal-ventas__detalle-row--odd"
  }`;

const getVentaTipoDetalleBadgeClass = (tipoKey) =>
  `tipo-badge ${String(tipoKey || "producto").toLowerCase()} modal-ventas__detalle-badge modal-ventas__detalle-badge--${String(
    tipoKey || "producto"
  ).toLowerCase()}`;

/* -------------------------------------------------------------------------- */
/*                         MODAL CREAR VENTA (RENOVADO)                       */
/* -------------------------------------------------------------------------- */

export const ModalCrearVenta = ({
  onClose,
  onSave,
  initialData = null,
  disabled = false,
  title = null,
}) => {
  const isViewMode = disabled;
  const modalTitle =
    title || (isViewMode ? "Detalles de la Venta" : "Registrar nueva venta");

  // Estados Base
  const [activeTab, setActiveTab] = useState("GENERAL");
  const [cart, setCart] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form Data General
  const [fechaVenta, setFechaVenta] = useState(() => getTodayISO());
  const [estadoVenta, setEstadoVenta] = useState("PENDIENTE");
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    cliente: "",
    carrito: "",
    detalle: "",
  });

  // Estados para Selector (En tab Detalles)
  const [selectorType, setSelectorType] = useState("PRODUCTO"); // 'PRODUCTO', 'SERVICIO', 'MEMBRESIA'
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsList, setItemsList] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Estados para Usuarios
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const inputRef = useRef(null);
  const finalizeLockRef = useRef(false);

  const toEstadoCode = useCallback((rawEstado) => {
    const estado = String(rawEstado ?? "PENDIENTE")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .trim();

    if (estado === "EN_PROCESO" || estado === "PROCESO") return "EN_PROCESO";
    if (estado === "COMPLETADO") return "COMPLETADO";
    if (estado === "CANCELADO" || estado === "ANULADO") return "CANCELADO";
    return "PENDIENTE";
  }, []);

  // Cargar usuarios al inicio
  useEffect(() => {
    if (!disabled) {
      const fetchUsers = async () => {
        try {
          const res = await obtenerUsuarios({
            query: {
              page: 1,
              limit: 0,
              pagina: 1,
              pageSize: 0,
              perPage: 0,
              offset: 0,
              skip: 0,
            },
          });
          const data = Array.isArray(res)
            ? res
            : res?.data || res?.usuarios || [];
          const normalized = data
            .map((u) => ({
              id: u.id || u.id_usuario,
              nombre: u.nombre_usuario || u.nombre || u.email,
              email: u.email || "",
              documento:
                u.documento ||
                u.numero_documento ||
                u.num_documento ||
                u.document ||
                "",
              telefono: u.telefono || u.phone || '',
              rol: u.rol_nombre || u.rol || u.role || '',
              estado: u.estado || (u.id_estado === 1 ? 'Activo' : u.id_estado === 2 ? 'Inactivo' : 'Desconocido'),
              // Include all searchable fields as strings for filtering
              searchableText: [
                u.nombre_usuario || u.nombre || u.email || '',
                u.email || '',
                u.documento || u.numero_documento || u.num_documento || '',
                u.telefono || u.phone || '',
                u.rol_nombre || u.rol || u.role || '',
                u.estado || (u.id_estado === 1 ? 'Activo' : u.id_estado === 2 ? 'Inactivo' : 'Desconocido') || '',
                u.id || u.id_usuario || ''
              ].join(' ').toLowerCase()
            }))
            .filter((u) => u.id);
          setUsers(normalized);
        } catch (err) {
          console.error("Error cargando usuarios", err);
        }
      };
      fetchUsers();
    }
  }, [disabled]);

  // Cargar items cuando cambia el tipo en el selector
  useEffect(() => {
    if (!disabled) {
      const fetchItems = async () => {
        setLoadingItems(true);
        try {
          let data = [];
          const queryAll = {
            page: 1,
            limit: 0,
            pagina: 1,
            pageSize: 0,
            perPage: 0,
            offset: 0,
            skip: 0,
          };
          if (selectorType === "PRODUCTO") {
            data = await getProductos({ query: queryAll });
          } else if (selectorType === "SERVICIO") {
            data = await obtenerServicios({ query: queryAll });
          }
          else if (selectorType === "MEMBRESIA") {
            const res = await obtenerMembresias({ query: queryAll });
            data = Array.isArray(res)
              ? res
              : res?.data || res?.membresias || [];
          }
          const normalizedItems = Array.isArray(data)
            ? data
            : data?.data || data?.productos || data?.servicios || [];
          setItemsList(normalizedItems);
        } catch (err) {
          console.error(`Error cargando ${selectorType}`, err);
          toast.error(`Error cargando ${selectorType.toLowerCase()}s`);
          setItemsList([]);
        } finally {
          setLoadingItems(false);
        }
      };
      fetchItems();
    }
  }, [selectorType, disabled]);

  // Hidratar formulario en modo edición
  useEffect(() => {
    if (!initialData) return;

    const fechaInicialRaw =
      initialData.fechaVenta ||
      initialData.fecha_venta ||
      initialData.fecha ||
      "";
    const fechaInicial = String(fechaInicialRaw).slice(0, 10) || getTodayISO();

    const usuarioId =
      initialData.idUsuario ??
      initialData.id_usuario ??
      initialData.id_de_usuario ??
      null;
    const usuarioNombre =
      initialData.usuario_nombre ||
      initialData.nombre_usuario ||
      (usuarioId ? `Usuario ${usuarioId}` : "");
    const usuarioDocumento =
      initialData.usuario_documento ||
      initialData.documento_usuario ||
      initialData.documento ||
      initialData.usuario?.documento ||
      initialData.id_usuario_usuario?.documento ||
      "";

    const detallesBase = Array.isArray(initialData.detalles)
      ? initialData.detalles
      : Array.isArray(initialData.detalles_venta)
        ? initialData.detalles_venta
        : [];

    const cartInicial = detallesBase.map((d, idx) => {
      const tipo = normalizeTipoVenta(d.tipo_venta || d.tipo || d.tipoVenta);
      const recursoId =
        d.recursoId ??
        d.id_producto ??
        d.id_membresia ??
        d.id_servicio ??
        d.id ??
        `${tipo}-${idx}`;
      const cantidad = Number(d.cantidad ?? d.cantidad_total ?? 1) || 1;
      const valorUnitario =
        Number(d.valorUnitario ?? d.valor_unitario ?? d.precio ?? 0) || 0;
      const nombre =
        d.nombre ||
        d.nombre_producto ||
        d.nombre_servicio ||
        d.nombre_membresia ||
        `${tipo} ${recursoId}`;

      return {
        id: recursoId,
        nombre,
        tipo,
        valorUnitario,
        cantidad,
        stockMax: tipo === "PRODUCTO" ? 9999 : 9999,
      };
    });

    setFechaVenta(fechaInicial);
    setEstadoVenta(
      toEstadoCode(
        initialData.estadoVenta || initialData.estado_venta || initialData.estado
      )
    );
    setCart(cartInicial);

    if (usuarioId) {
      setSelectedUser({
        id: usuarioId,
        nombre: usuarioNombre || `Usuario ${usuarioId}`,
        documento: usuarioDocumento,
      });
      setUserSearch(usuarioNombre || `Usuario ${usuarioId}`);
    }
  }, [initialData, toEstadoCode]);

  // Filtrado de items
  const filteredItems = useMemo(() => {
    const lower = (searchTerm || "").toLowerCase();
    return itemsList
      .filter((i) => {
        const name =
          i.nombre ||
          i.nombre_producto ||
          i.nombre_membresia ||
          i.nombre_servicio ||
          i.titulo ||
          i.concepto ||
          "";
        const code = i.codigo || i.codigo_membresia || i.codigo_servicio || "";
        return !lower
          ? true
          : name.toLowerCase().includes(lower) ||
              code.toLowerCase().includes(lower);
      })
      .slice(0, 50);
  }, [itemsList, searchTerm]);

  // Filtrado de usuarios (con toggle dropdown)
  const filteredUsers = useMemo(() => {
    if (!userSearch) return [];
    const lower = userSearch.toLowerCase();
    return users
      .filter((u) => u.searchableText && u.searchableText.includes(lower))
      .slice(0, 5);
  }, [users, userSearch]);

  const setValidationError = useCallback((field, message) => {
    setValidationErrors((prev) => ({
      ...prev,
      [field]: message,
    }));
  }, []);

  const clearValidationError = useCallback((field) => {
    setValidationErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: "" };
    });
  }, []);

  // Handlers Carrito
  const addToCart = (item) => {
    if (!selectedUser?.id) {
      setValidationError(
        "detalle",
        "Debes seleccionar un cliente antes de agregar productos.",
      );
      setValidationError(
        "cliente",
        "Debes seleccionar un cliente para continuar con la venta.",
      );
      setActiveTab("GENERAL");
      return;
    }

    clearValidationError("cliente");
    clearValidationError("detalle");

    const id =
      item.id || item.id_productos || item.id_servicio || item.id_membresia;
    const nombre =
      item.nombre ||
      item.nombre_producto ||
      item.nombre_membresia ||
      item.nombre_servicio ||
      item.concepto;
    const precio = Number(
      item.precioVenta ||
        item.precio ||
        item.precio_de_venta ||
        item.precio_servicio ||
        item.precioServicio ||
        0
    );

    const existingIdx = cart.findIndex(
      (c) => c.id === id && c.tipo === selectorType
    );

    if (existingIdx >= 0) {
      if (selectorType === "PRODUCTO") {
        const currentQty = cart[existingIdx].cantidad;
        const maxStock = item.stock || 9999;
        if (currentQty < maxStock) {
          updateCartQty(existingIdx, 1);
          clearValidationError("carrito");
          clearValidationError("detalle");
        } else {
          setValidationError(
            "detalle",
            "No puedes superar el stock disponible de este producto.",
          );
        }
      } else {
        setValidationError(
          "detalle",
          "Este item ya esta agregado en la venta.",
        );
      }
    } else {
      setCart((prev) => [
        ...prev,
        {
          id,
          nombre,
          tipo: selectorType,
          valorUnitario: precio,
          cantidad: 1,
          stockMax: selectorType === "PRODUCTO" ? item.stock || 0 : 9999,
        },
      ]);
      clearValidationError("carrito");
      clearValidationError("detalle");
    }
  };

  const updateCartQty = (index, delta) => {
    setCart((prev) => {
      const newCart = [...prev];
      const item = newCart[index];
      const newQty = item.cantidad + delta;
      if (newQty > 0 && newQty <= item.stockMax) {
        item.cantidad = newQty;
      }
      return newCart;
    });
  };

  const removeFromCart = (index) => {
    const nextCart = cart.filter((_, i) => i !== index);
    setCart(nextCart);
    if (nextCart.length === 0) {
      setValidationError(
        "carrito",
        "Debes agregar al menos un producto a la venta.",
      );
    }
  };

  const totalVenta = cart.reduce(
    (acc, item) => acc + item.cantidad * item.valorUnitario,
    0
  );
  const clienteSeleccionado = Boolean(selectedUser?.id);
  const carritoConItems = cart.length > 0;
  const puedeGuardarVenta =
    !disabled && !isSaving && clienteSeleccionado && carritoConItems;
  const mensajeValidacionCliente =
    validationErrors.cliente ||
    (!clienteSeleccionado && !disabled
      ? "Debes seleccionar un cliente para guardar la venta."
      : "");

  // Submit
  const handleFinalize = async (e) => {
    e?.preventDefault?.();

    if (!clienteSeleccionado) {
      setValidationError(
        "cliente",
        "Debes seleccionar un cliente para guardar la venta.",
      );
      setActiveTab("GENERAL");
      return;
    }

    if (!carritoConItems) {
      setValidationError(
        "carrito",
        "Debes agregar al menos un producto a la venta.",
      );
      setActiveTab("DETALLES");
      return;
    }
    clearValidationError("cliente");
    clearValidationError("carrito");
    if (isSaving || finalizeLockRef.current) return;

    finalizeLockRef.current = true;

    const payload = {
      ...((initialData?.id ??
        initialData?.id_venta ??
        initialData?.id_pedido_cliente ??
        initialData?.id_ventas)
        ? {
            id:
              initialData?.id ??
              initialData?.id_venta ??
              initialData?.id_pedido_cliente ??
              initialData?.id_ventas,
          }
        : {}),
      idUsuario: selectedUser ? selectedUser.id : null,
      detalles: cart.map((item) => ({
        tipoVenta: item.tipo,
        recursoId: item.id,
        cantidad: item.cantidad,
        valorUnitario: item.valorUnitario,
      })),
      estadoVenta: estadoVenta,
      fechaVenta: fechaVenta || new Date().toISOString(),
      valor_total_venta: totalVenta,
    };

    setIsSaving(true);
    try {
      const saved = await onSave(payload);
      if (!saved) {
        toast.error("No se pudo guardar la venta");
        return;
      }
      toast.success(
        initialData ? "Venta actualizada exitosamente" : "Venta creada exitosamente"
      );
      // Evitar duplicar transacciones en stock por llamadas adicionales externas.
      onClose();
    } catch (error) {
      console.error("Error finalizando venta", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo guardar la venta"
      );
    } finally {
      setIsSaving(false);
      finalizeLockRef.current = false;
    }
  };

  return (
    <Modal
      title={modalTitle}
      onClose={onClose}
      size="lg"
      className="venta-redesigned"
      footer={
        disabled ? (
          <button type="button" className="boton boton-primario" onClick={onClose}>
            Cerrar
          </button>
        ) : (
          <>
            <button type="button" className="boton boton-secundario" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="boton boton-primario btn-save-sale"
              onClick={handleFinalize}
              disabled={!puedeGuardarVenta}
              title={
                !clienteSeleccionado
                  ? "Selecciona un cliente para habilitar el guardado"
                  : !carritoConItems
                    ? "Agrega al menos un producto para guardar la venta"
                    : ""
              }
            >
              Guardar venta
            </button>
          </>
        )
      }
    >
      <div className="cuerpo-modal p-0">
        {/* Tabs */}
        <div
          data-ven-style="1"
        >
          <motion.button
            className={getVentaTabButtonClass(activeTab === "GENERAL")}
            onClick={() => setActiveTab("GENERAL")}
            whileHover={{
              backgroundColor: activeTab === "GENERAL" ? "#ffffff" : "#f3f4f6",
            }}
            whileTap={{ scale: 0.98 }}
          >
            General
          </motion.button>
          <motion.button
            className={getVentaTabButtonClass(activeTab === "DETALLES")}
            onClick={() => setActiveTab("DETALLES")}
            whileHover={{
              backgroundColor: activeTab === "DETALLES" ? "#ffffff" : "#f3f4f6",
            }}
            whileTap={{ scale: 0.98 }}
          >
            Detalles
            {cart.length > 0 && (
              <motion.span
                className="tab-badge"
                data-ven-style="2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                {cart.length}
              </motion.span>
            )}
          </motion.button>
        </div>

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
                    <h3 className="modal-section-title">Datos de la venta</h3>

                    <motion.div
                      className="modal-field-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.3 }}
                    >
                      <label className="modal-field-label">Cliente</label>
                      {selectedUser ? (
                        <div
                          data-ven-style="3"
                        >
                          {/* User Avatar */}
                          <div
                            data-ven-style="4"
                          >
                            <User size={18} color="#6366f1" />
                          </div>

                          {/* User Info */}
                          <div data-ven-style="5">
                            <div
                              data-ven-style="6"
                            >
                              {selectedUser.nombre}
                            </div>
                            <div
                              data-ven-style="7"
                            >
                              {selectedUser.documento || "Documento no disponible"}
                            </div>
                          </div>

                          {/* Remove Button */}
                          {!disabled && (
                            <button
                              onClick={() => setSelectedUser(null)}
                              data-ven-style="8"
                              className="modal-ventas__selected-user-clear-btn"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="input-icon-wrapper relative" data-ven-style="9">
                          <input
                            ref={inputRef}
                            placeholder="Buscar cliente por nombre..."
                            value={userSearch}
                            onChange={(e) => {
                              setUserSearch(e.target.value);
                              setShowUserDropdown(true);
                              clearValidationError("cliente");
                            }}
                            onFocus={() => setShowUserDropdown(true)}
                            onBlur={() => {
                              // Delay hiding to allow click on dropdown items
                              setTimeout(() => setShowUserDropdown(false), 200);
                            }}
                            className="input-with-icon modal-field-input"
                          />
                          {showUserDropdown && userSearch && (
                            <motion.div
                              className="search-results-dropdown"
                              data-ven-style="10"
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{ duration: 0.2 }}
                            >
                              {filteredUsers.length > 0 ? (
                                <>
                                  <div
                                    data-ven-style="11"
                                  >
                                    {filteredUsers.map((u, index) => (
                                      <motion.div
                                        key={u.id}
                                        className={getVentaUserDropdownRowClass(
                                          index,
                                          filteredUsers.length
                                        )}
                                        onMouseDown={(e) => {
                                          e.preventDefault(); // Prevenir blur del input
                                          setSelectedUser(u);
                                          setUserSearch("");
                                          setShowUserDropdown(false);
                                          clearValidationError("cliente");
                                          clearValidationError("detalle");
                                        }}
                                        whileHover={{
                                          backgroundColor: "#f8fafc",
                                        }}
                                        whileTap={{ scale: 0.98 }}
                                      >
                                        {/* User Avatar */}
                                        <div
                                          data-ven-style="4"
                                        >
                                          <User size={18} color="#6366f1" />
                                        </div>

                                        {/* User Info */}
                                        <div data-ven-style="5">
                                          <div
                                            data-ven-style="6"
                                          >
                                            {u.nombre}
                                          </div>
                                          <div
                                            data-ven-style="7"
                                          >
                                            {u.documento || "Documento no disponible"}
                                          </div>
                                        </div>

                                        {/* Selection Indicator */}
                                        <div
                                          data-ven-style="12"
                                          className="selection-indicator"
                                        />
                                      </motion.div>
                                    ))}
                                  </div>

                                  {/* Footer with result count */}
                                  <div
                                    data-ven-style="13"
                                  >
                                    <span
                                      data-ven-style="14"
                                    >
                                      {filteredUsers.length} cliente{filteredUsers.length !== 1 ? "s" : ""} encontrado{filteredUsers.length !== 1 ? "s" : ""}
                                    </span>
                                  </div>
                                </>
                              ) : (
                                <div
                                  data-ven-style="15"
                                >
                                  <div
                                    data-ven-style="16"
                                  >
                                    <User size={24} color="#9ca3af" />
                                  </div>
                                  <div
                                    data-ven-style="17"
                                  >
                                    No se encontraron clientes
                                  </div>
                                  <div
                                    data-ven-style="18"
                                  >
                                    Intenta con otro término de búsqueda
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>
                      )}
                      {mensajeValidacionCliente && (
                        <p className="modal-ventas__field-validation modal-ventas__field-validation--error">
                          {mensajeValidacionCliente}
                        </p>
                      )}
                    </motion.div>

                    <motion.div
                      className="modal-field-group"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.3 }}
                    >
                      <label className="modal-field-label">Fecha de venta</label>
                      <input
                        type="date"
                        value={fechaVenta}
                        className="modal-field-input modal-field-input--readonly"
                        disabled={true}
                        readOnly
                      />
                    </motion.div>

                    <motion.div
                      className="modal-field-group modal-field-group--compact"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.3 }}
                    >
                      <label className="modal-field-label">Estado de la venta</label>
                      <input
                        type="text"
                        value="Pendiente"
                        className="modal-field-input modal-field-input--readonly"
                        disabled={true}
                        readOnly
                      />
                    </motion.div>
                  </motion.div>
                </div>

                <div className="general-summary-column">
                  <motion.div
                    className="venta-resumen-card"
                    data-ven-style="19"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <div
                      data-ven-style="20"
                    >
                      <div
                        data-ven-style="21"
                      >
                        <ShoppingCart size={20} color="white" />
                      </div>
                      <h4
                        data-ven-style="22"
                      >
                        Resumen de la venta
                      </h4>
                    </div>

                    {cart.length > 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        {/* Tabla de productos en el resumen */}
                        <div
                          data-ven-style="23"
                        >
                          <div
                            data-ven-style="24"
                          >
                            <h5
                              data-ven-style="25"
                            >
                              Productos en la venta ({cart.length})
                            </h5>
                          </div>

                          <div
                            data-ven-style="26"
                          >
                            <table
                              data-ven-style="27"
                            >
                              <thead data-ven-style="28">
                                <tr>
                                  <th
                                    data-ven-style="29"
                                  >
                                    Producto
                                  </th>
                                  <th
                                    data-ven-style="30"
                                  >
                                    Cant.
                                  </th>
                                  <th
                                    data-ven-style="31"
                                  >
                                    Precio
                                  </th>
                                  <th
                                    data-ven-style="31"
                                  >
                                    Subtotal
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {cart.map((item, idx) => (
                                  <motion.tr
                                    key={idx}
                                    className={getVentaSummaryRowClass(
                                      idx,
                                      cart.length
                                    )}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                      delay: 0.4 + idx * 0.05,
                                      duration: 0.3,
                                    }}
                                  >
                                    <td
                                      data-ven-style="32"
                                    >
                                      <div
                                        data-ven-style="33"
                                      >
                                        {item.nombre}
                                      </div>
                                      <span
                                        className={`tipo-badge ${item.tipo.toLowerCase()}`}
                                        data-ven-style="34"
                                      >
                                        {item.tipo}
                                      </span>
                                    </td>
                                    <td
                                      data-ven-style="35"
                                    >
                                      {item.cantidad}
                                    </td>
                                    <td
                                      data-ven-style="36"
                                    >
                                      {formatCOP(item.valorUnitario)}
                                    </td>
                                    <td
                                      data-ven-style="37"
                                    >
                                      {formatCOP(
                                        item.valorUnitario * item.cantidad
                                      )}
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Estadísticas resumidas */}
                        <div
                          data-ven-style="38"
                        >
                          <div
                            data-ven-style="39"
                          >
                            <div
                              data-ven-style="40"
                            >
                              Productos
                            </div>
                            <div
                              data-ven-style="41"
                            >
                              {cart.length}
                            </div>
                          </div>

                          <div
                            data-ven-style="42"
                          >
                            <div
                              data-ven-style="43"
                            >
                              Cantidad Total
                            </div>
                            <div
                              data-ven-style="44"
                            >
                              {cart.reduce(
                                (acc, item) => acc + item.cantidad,
                                0
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Total */}
                        <motion.div
                          data-ven-style="45"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.4, duration: 0.3 }}
                        >
                          <div
                            data-ven-style="46"
                          >
                            Total de la venta
                          </div>
                          <div
                            data-ven-style="47"
                          >
                            {formatCOP(totalVenta)}
                          </div>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div
                        data-ven-style="48"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        <div
                          data-ven-style="49"
                        >
                          <ShoppingCart size={24} color="white" />
                        </div>
                        <h5
                          data-ven-style="50"
                        >
                          Carrito vacío
                        </h5>
                        <p
                          data-ven-style="51"
                        >
                          No hay productos agregados a la venta.
                        </p>
                        <button
                          data-ven-style="52"
                          className="modal-ventas__empty-action-btn"
                          onClick={() => setActiveTab("DETALLES")}
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
                className="general-tab-layout"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                {/* Left Column: Add Items */}
                <div className="general-form-column">
                  {/* Agregar Productos Section */}
                  <motion.div
                    className="add-section-container"
                    data-ven-style="53"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <div
                      data-ven-style="20"
                    >
                      <div
                        data-ven-style="54"
                      >
                        <Plus size={20} color="white" />
                      </div>
                      <h3
                        data-ven-style="22"
                      >
                        Agregar productos a la venta
                      </h3>
                    </div>

                    {/* Search Controls */}
                    <div
                      data-ven-style="55"
                    >
                      <motion.div
                        data-ven-style="56"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                      >
                        <label
                          data-ven-style="17"
                        >
                          Tipo de producto
                        </label>
                        <div data-ven-style="9">
                          <select
                            value={selectorType}
                            onChange={(e) => setSelectorType(e.target.value)}
                            className="modal-field-input modal-field-input--select modal-field-input--soft"
                          >
                            <option value="PRODUCTO">Producto</option>
                            <option value="MEMBRESIA">Membresía</option>
                          </select>
                          <div
                            data-ven-style="57"
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#6b7280"
                              strokeWidth="2"
                            >
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        data-ven-style="56"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.3 }}
                      >
                        <label
                          data-ven-style="17"
                        >
                          Buscar producto
                        </label>
                        <div
                          data-ven-style="58"
                        >
                          <div
                            data-ven-style="59"
                          >
                            <Search size={18} />
                          </div>
                          <input
                            placeholder="Buscar por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            data-ven-style="60"
                          />
                        </div>
                      </motion.div>
                    </div>

                    {/* Resultados Búsqueda */}
                    <motion.div
                      data-ven-style="61"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.4 }}
                    >
                      <div
                        data-ven-style="62"
                      >
                        <h4
                          data-ven-style="25"
                        >
                          {loadingItems
                            ? "Cargando productos..."
                            : `Resultados de búsqueda ${
                                filteredItems.length > 0
                                  ? `(${filteredItems.length})`
                                  : ""
                              }`}
                        </h4>
                      </div>

                      <div
                                  className={getVentaResultsWrapClass(
                                    filteredItems.length > 0
                                  )}
                                  >
                        {validationErrors.detalle && (
                          <p className="modal-ventas__field-validation modal-ventas__field-validation--error">
                            {validationErrors.detalle}
                          </p>
                        )}
                        {!clienteSeleccionado && (
                          <p className="modal-ventas__field-validation modal-ventas__field-validation--warning">
                            Selecciona primero un cliente en la pestaña General para habilitar agregar productos.
                          </p>
                        )}
                        {loadingItems ? (
                          <div
                            data-ven-style="63"
                          >
                            <div
                              data-ven-style="64"
                            ></div>
                            Cargando productos...
                          </div>
                        ) : filteredItems.length > 0 ? (
                          <div data-ven-style="65">
                            {filteredItems.map((item, i) => {
                              const price =
                                item.precioVenta ||
                                item.precio ||
                                item.precio_de_venta ||
                                item.precio_servicio ||
                                item.precioServicio ||
                                0;
                              const stock = item.stock;
                              const isOutOfStock =
                                selectorType === "PRODUCTO" && stock <= 0;
                              const addDisabled = isOutOfStock || !clienteSeleccionado;

                              return (
                                <motion.div
                                  key={i}
                                  className={getVentaResultItemClass(
                                    isOutOfStock
                                  )}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{
                                    opacity: isOutOfStock ? 0.7 : 1,
                                    y: 0,
                                  }}
                                  transition={{
                                    delay: 0.5 + i * 0.05,
                                    duration: 0.3,
                                  }}
                                  whileHover={
                                    !isOutOfStock
                                      ? {
                                          backgroundColor: "#f8fafc",
                                          borderColor: "#d1d5db",
                                        }
                                      : {}
                                  }
                                >
                                  <div data-ven-style="66">
                                    <div
                                      data-ven-style="67"
                                    >
                                      {item.nombre ||
                                        item.nombre_producto ||
                                        item.nombre_servicio ||
                                        item.nombre_membresia}
                                    </div>
                                    <div
                                      data-ven-style="68"
                                    >
                                      <span
                                        data-ven-style="69"
                                      >
                                        {formatCOP(price)}
                                      </span>
                                      {selectorType === "PRODUCTO" && (
                                      <span
                                          className={getVentaStockClass(stock)}
                                        >
                                          {stock <= 0
                                            ? "Sin stock"
                                            : `${stock} disponible`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                    <motion.button
                                      onClick={() =>
                                        !isOutOfStock && addToCart(item)
                                      }
                                      disabled={addDisabled}
                                      className={getVentaAddItemButtonClass(
                                        addDisabled
                                      )}
                                      title={
                                        !clienteSeleccionado
                                          ? "Selecciona un cliente para poder agregar productos"
                                          : isOutOfStock
                                            ? "Producto sin stock disponible"
                                            : "Agregar producto"
                                      }
                                    whileHover={
                                      !addDisabled
                                        ? {
                                            backgroundColor: "#059669",
                                            scale: 1.02,
                                          }
                                        : {}
                                    }
                                    whileTap={
                                      !addDisabled ? { scale: 0.98 } : {}
                                    }
                                  >
                                    <Plus size={16} />
                                    Agregar
                                  </motion.button>
                                </motion.div>
                              );
                            })}
                          </div>
                        ) : (
                          <div
                            data-ven-style="70"
                          >
                            <div
                              data-ven-style="71"
                            >
                              <Search size={24} color="#9ca3af" />
                            </div>
                            {searchTerm
                              ? "No se encontraron productos que coincidan con tu búsqueda"
                              : "Escribe en el campo de búsqueda para encontrar productos"}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                </div>
                {/* Right Column: Cart List */}
                <div
                  className={
                    disabled ? "general-form-column" : "general-summary-column"
                  }
                >
                  <motion.div
                    data-ven-style="19"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <div
                      data-ven-style="20"
                    >
                      <div
                        data-ven-style="72"
                      >
                        <ShoppingCart size={20} color="white" />
                      </div>
                      <div>
                        <h3
                          data-ven-style="22"
                        >
                          Carrito de venta
                        </h3>
                        <p
                          data-ven-style="73"
                        >
                          {cart.length} producto{cart.length !== 1 ? "s" : ""}{" "}
                          agregado{cart.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>

                    {cart.length > 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                      >
                        {/* Cart Items List */}
                        <div
                          data-ven-style="74"
                        >
                          {cart.map((item, idx) => (
                            <motion.div
                              key={idx}
                              data-ven-style="75"
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: 0.4 + idx * 0.1,
                                duration: 0.3,
                              }}
                            >
                              {/* Product Info */}
                              <div data-ven-style="66">
                                <div
                                  data-ven-style="67"
                                >
                                  {item.nombre}
                                </div>
                                <div
                                  data-ven-style="76"
                                >
                                  <span
                                    data-ven-style="77"
                                  >
                                    {formatCOP(item.valorUnitario)}
                                  </span>
                                  <span
                                    className={`tipo-badge ${item.tipo.toLowerCase()}`}
                                    data-ven-style="34"
                                  >
                                    {item.tipo}
                                  </span>
                                </div>
                              </div>

                              {/* Quantity Control */}
                              <div
                                data-ven-style="76"
                              >
                                {item.tipo === "PRODUCTO" ? (
                                  <div
                                    data-ven-style="78"
                                  >
                                    <button
                                      onClick={() => updateCartQty(idx, -1)}
                                      disabled={item.cantidad <= 1}
                                      className={getVentaQtyButtonClass(
                                        item.cantidad <= 1
                                      )}
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      value={item.cantidad}
                                      min="1"
                                      max={item.stockMax}
                                      onChange={(e) => {
                                        const val =
                                          parseInt(e.target.value) || 1;
                                        const diff = val - item.cantidad;
                                        updateCartQty(idx, diff);
                                      }}
                                      data-ven-style="79"
                                    />
                                    <button
                                      onClick={() => updateCartQty(idx, 1)}
                                      disabled={item.cantidad >= item.stockMax}
                                      className={getVentaQtyButtonClass(
                                        item.cantidad >= item.stockMax
                                      )}
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <div
                                    data-ven-style="80"
                                  >
                                    {item.cantidad}
                                  </div>
                                )}

                                {/* Subtotal */}
                                <div
                                  data-ven-style="81"
                                >
                                  {formatCOP(
                                    item.valorUnitario * item.cantidad
                                  )}
                                </div>

                                {/* Remove Button */}
                                <motion.button
                                  onClick={() => removeFromCart(idx)}
                                  data-ven-style="82"
                                  whileHover={{
                                    backgroundColor: "#fecaca",
                                    scale: 1.05,
                                  }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <Trash2 size={16} />
                                </motion.button>
                              </div>
                            </motion.div>
                          ))}
                        </div>

                        {/* Cart Summary */}
                        <motion.div
                          data-ven-style="83"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: 0.5 + cart.length * 0.1,
                            duration: 0.3,
                          }}
                        >
                          <div
                            data-ven-style="84"
                          >
                            Total de productos:{" "}
                            {cart.reduce((acc, item) => acc + item.cantidad, 0)}
                          </div>
                          <div
                            data-ven-style="85"
                          >
                            {formatCOP(totalVenta)}
                          </div>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div
                        data-ven-style="86"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                      >
                        <div
                          data-ven-style="87"
                        >
                          <ShoppingCart size={32} color="#9ca3af" />
                        </div>
                        <h4
                          data-ven-style="88"
                        >
                          Carrito vacío
                        </h4>
                        <p
                          data-ven-style="89"
                        >
                          No hay productos agregados a la venta. Usa el panel
                          izquierdo para buscar y agregar productos.
                        </p>
                        {validationErrors.carrito && (
                          <p className="modal-ventas__field-validation modal-ventas__field-validation--error">
                            {validationErrors.carrito}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
};

/* -------------------------------------------------------------------------- */
/*                         MODAL VER VENTA (LEGACY/ADAPTADO)                  */
/* -------------------------------------------------------------------------- */

export const ModalVerVenta = ({ venta, onClose, colorEstado = "#10b981" }) => {
  const baseDetalles = useMemo(
    () => venta?.detalles || venta?.detalles_venta || [],
    [venta]
  );
  const [detalles, setDetalles] = useState(baseDetalles);
  const estadoVentaLabel = getEstadoVentaLabel(venta);
  const tipoVentaResumen = useMemo(
    () => getResumenTipoVenta(detalles.length ? detalles : baseDetalles),
    [detalles, baseDetalles]
  );
  const matchId = (obj, id, keys = []) =>
    keys.some(
      (k) =>
        obj?.[k] !== undefined &&
        obj?.[k] !== null &&
        String(obj[k]) === String(id)
    );

  const resolverNombre = useCallback((
    detalle,
    productosData,
    serviciosData,
    membresiasData
  ) => {
    const tipo = (
      detalle.tipo_venta ||
      detalle.tipo ||
      "PRODUCTO"
    ).toUpperCase();
    const id =
      detalle.id_productos ||
      detalle.id_producto ||
      detalle.id_membresia ||
      detalle.id_membresias ||
      detalle.id_servicio ||
      detalle.recursoId ||
      detalle.id;

    if (
      detalle.nombre ||
      detalle.nombre_producto ||
      detalle.nombre_membresia ||
      detalle.nombre_servicio
    )
      return (
        detalle.nombre ||
        detalle.nombre_producto ||
        detalle.nombre_membresia ||
        detalle.nombre_servicio
      );

    if (!id) return null;

    if (tipo === "PRODUCTO") {
      const p = (productosData || []).find((prod) =>
        matchId(prod, id, ["id", "id_productos"])
      );
      return p?.nombre || p?.nombre_producto;
    }
    if (tipo === "SERVICIO") {
      const s = (serviciosData || []).find((serv) =>
        matchId(serv, id, ["id", "id_servicio"])
      );
      return s?.nombre_servicio || s?.nombre || s?.name;
    }
    if (tipo === "MEMBRESIA") {
      const m = (membresiasData || []).find((mem) =>
        matchId(mem, id, [
          "id",
          "id_membresia",
          "id_membresias",
          "uuid",
          "codigo",
        ])
      );
      return m?.nombre_membresia || m?.nombre || m?.titulo;
    }
    return null;
  }, [matchId]);

  useEffect(() => {
    if (!venta) return;

    const cargarCatalogos = async () => {
      try {
        const token = localStorage.getItem("token");
        const [productosData, serviciosData, membresiasRaw] = await Promise.all(
          [
            getProductos({
              query: {
                page: 1,
                limit: 0,
                pagina: 1,
                pageSize: 0,
                perPage: 0,
                offset: 0,
                skip: 0,
              },
            }).catch(() => []),
            obtenerServicios({
              query: {
                page: 1,
                limit: 0,
                pagina: 1,
                pageSize: 0,
                perPage: 0,
                offset: 0,
                skip: 0,
              },
            }).catch(() => []),
            obtenerMembresias({
              token,
              query: {
                page: 1,
                limit: 0,
                pagina: 1,
                pageSize: 0,
                perPage: 0,
                offset: 0,
                skip: 0,
              },
            }).catch(() => []),
          ]
        );
        const productosLista = Array.isArray(productosData)
          ? productosData
          : productosData?.data || productosData?.productos || [];
        const serviciosLista = Array.isArray(serviciosData)
          ? serviciosData
          : serviciosData?.data || serviciosData?.servicios || [];
        const membresiasData = Array.isArray(membresiasRaw)
          ? membresiasRaw
          : membresiasRaw?.data || membresiasRaw?.membresias || [];

        const nuevosDetalles = (
          venta.detalles ||
          venta.detalles_venta ||
          []
        ).map((det) => {
          const nombreResuelto = resolverNombre(
            det,
            productosLista,
            serviciosLista,
            membresiasData
          );
          return nombreResuelto ? { ...det, nombre: nombreResuelto } : det;
        });
        setDetalles(nuevosDetalles);
      } catch (error) {
        console.error("Error cargando catálogos para detalles", error);
        setDetalles(venta.detalles || venta.detalles_venta || []);
      }
    };

    cargarCatalogos();
  }, [venta, resolverNombre]);

  if (!venta) return null;

  const getItemName = (detalle) => {
    if (detalle.nombre) return detalle.nombre;
    if (detalle.nombre_producto) return detalle.nombre_producto;
    if (detalle.nombre_membresia) return detalle.nombre_membresia;
    if (detalle.concepto) return detalle.concepto;

    const id =
      detalle.id_productos ||
      detalle.id_membresia ||
      detalle.id_servicio ||
      detalle.recursoId;
    if (id) {
      return `${detalle.tipo_venta || "Item"} ${id}`;
    }

    return "Item sin nombre";
  };

  return (
    <Modal
      title={`Detalles de la Venta #${venta.id}`}
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
        <div
          className="modal-body-content modal-body-content--spacious"
        >
          <motion.div
            className="general-tab-layout"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Left Column: Sale Details */}
            <div className="general-form-column">
              <motion.div
                className="modal-form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <h3 className="modal-section-title">Información de la venta</h3>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <label className="modal-field-label">Documento del usuario</label>
                  <input
                    type="text"
                    className="modal-field-input"
                    value={
                      venta.usuario_documento ||
                      venta.documento_usuario ||
                      venta.documento ||
                      "Documento no disponible"
                    }
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
                  <label className="modal-field-label">Fecha de venta</label>
                  <input
                    type="text"
                    className="modal-field-input"
                    value={
                      venta.fecha_venta
                        ? formatFechaVista(venta.fecha_venta)
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
                    value={formatFechaVista(venta.plazo_maximo || venta.fecha_entrega)}
                    readOnly
                    disabled
                  />
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.3 }}
                >
                  <label className="modal-field-label">Tipo de venta</label>
                  <button
                    className={getVentaInfoBadgeClass(tipoVentaResumen.key)}
                    disabled
                  >
                    {tipoVentaResumen.label}
                  </button>
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                >
                  <label className="modal-field-label">Estado</label>
                  <button
                    className={getVentaEstadoBadgeClass(colorEstado)}
                    disabled
                  >
                    {estadoVentaLabel}
                  </button>
                </motion.div>
              </motion.div>
            </div>

            {/* Right Column: Items List */}
            <div className="general-summary-column">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                <h3 className="modal-section-title">
                  Items de la venta ({detalles.length})
                </h3>

                {detalles.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    {/* Tabla de items */}
                    <div
                      data-ven-style="90"
                    >
                      <table
                        data-ven-style="91"
                      >
                        <thead>
                          <tr data-ven-style="28">
                            <th
                              data-ven-style="92"
                            >
                              Producto/Servicio
                            </th>
                            <th
                              data-ven-style="93"
                            >
                              Cant.
                            </th>
                            <th
                              data-ven-style="94"
                            >
                              Precio Unit.
                            </th>
                            <th
                              data-ven-style="94"
                            >
                              Subtotal
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalles.map((d, i) => (
                            <motion.tr
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                delay: 0.4 + i * 0.1,
                                duration: 0.3,
                              }}
                              className={getVentaDetalleRowClass(i)}
                            >
                              <td
                                data-ven-style="32"
                              >
                                <div
                                  data-ven-style="95"
                                >
                                  {getItemName(d)}
                                </div>
                                {(() => {
                                  const tipoMeta = getTipoVentaMeta(
                                    d.tipo_venta || d.tipo || "PRODUCTO"
                                  );
                                  return (
                                    <span
                                      className={getVentaTipoDetalleBadgeClass(
                                        tipoMeta.key
                                      )}
                                    >
                                      {tipoMeta.label}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td
                                data-ven-style="96"
                              >
                                {d.cantidad || 1}
                              </td>
                              <td
                                data-ven-style="97"
                              >
                                {formatCOP(
                                  d.valor_unitario ||
                                    d.valor_unitario_detalle ||
                                    d.precio ||
                                    0
                                )}
                              </td>
                              <td
                                data-ven-style="36"
                              >
                                {formatCOP(
                                  (d.valor_unitario ||
                                    d.valor_unitario_detalle ||
                                    d.precio ||
                                    0) * (d.cantidad || 1)
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Total */}
                    <motion.div
                      data-ven-style="98"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.5 + detalles.length * 0.1,
                        duration: 0.3,
                      }}
                    >
                      <span
                        data-ven-style="99"
                      >
                        Total de la venta:
                      </span>
                      <span
                        data-ven-style="100"
                      >
                        {formatCOP(venta.valor_total_venta || venta.monto)}
                      </span>
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    className="venta-empty-state"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    <p>Sin detalles de venta</p>
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
