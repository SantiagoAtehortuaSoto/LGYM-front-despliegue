import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import Input from "../../../../../shared/components/Input/Input";
import Select from "../../../../../shared/components/Select/Select";
import Modal from "../../../../../shared/components/Modal/Modal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import { validarProducto } from "../../../hooks/validaciones/validaciones";
import "../../../../../shared/styles/restructured/components/modal-productos.css";

const useLockBodyScroll = (isOpen) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prevOverflow || "";
    }
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [isOpen]);
};

const CATEGORIAS_PRODUCTO = [
  { value: "Bebidas", label: "Bebidas" },
  { value: "Suplementos", label: "Suplementos" },
];

const DESCRIPCION_PRODUCTO_MAX_LENGTH = 200;

const resolveProductoId = (producto = {}) =>
  producto?.id_productos ??
  producto?.id_producto ??
  producto?.id ??
  producto?.producto_id ??
  null;

const resolveEstadoProducto = (producto = {}) => {
  const estadoRaw = String(producto?.estado ?? "").trim().toLowerCase();
  const idEstado = Number(producto?.id_estado ?? producto?.id_estados);
  if (idEstado === 2 || estadoRaw === "inactivo" || estadoRaw === "inactive") {
    return "Inactivo";
  }
  return "Activo";
};

// Variantes de animación alineadas con pedidos
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

/* ======================================================
    Modal base reutilizable con fondo completamente transparente
====================================================== */
export const ModalProductos = ({
  isOpen,
  onClose,
  children,
  title,
  size = "md",
}) => {
  useLockBodyScroll(isOpen);

  const sizeClasses = {
    sm: "modal-pequeno",
    md: "modal-mediano",
    lg: "modal-grande",
    xl: "modal-extra",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="modal-overlay capa-modal modal-productos__overlay"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            className={`contenedor-modal ${sizeClasses[size]} modal-productos__container`}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="modal-productos__close-icon"
              onClick={onClose}
              whileHover={{ scale: 1.1, color: "#e53e3e" }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              ×
            </motion.div>

            <motion.div
              className="modal-productos__header"
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <motion.h1
                className="modal-productos__header-title"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                {title}
              </motion.h1>
            </motion.div>

            <div className="cuerpo-modal">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ======================================================
    Modal Crear / Editar Producto (REDISEÑADO con estilo de pedidos)
====================================================== */
export const ModalFormularioProducto = ({
  isOpen,
  onClose,
  onSubmit,
  producto,
  title = "Nuevo Producto",
}) => {
  useLockBodyScroll(isOpen);

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precioVenta: "",
    stock: "",
    categoria: "",
    estado: "Activo",
    imagen_url: "",
  });

  const [errors, setErrors] = useState({});
  const [procesando, setProcesando] = useState(false);
  const productoId = resolveProductoId(producto);
  const estaEditando = Boolean(productoId || producto?.editar);

  const modalTitle =
    title || (estaEditando ? "Editar Producto" : "Registrar nuevo producto");

  // Función de validación centralizada
  const validateField = (name, value, nextFormData = null) => {
    const dataToValidate = nextFormData ?? { ...formData, [name]: value };
    const { errors: nuevosErrores } = validarProducto(dataToValidate);
    return nuevosErrores?.[name] || "";
  };

  // Función para prevenir caracteres no numéricos en campos numéricos
  const handleNumericKeyDown = (e) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const rawValue = type === "checkbox" ? checked : value;
    const newValue =
      name === "descripcion" && typeof rawValue === "string"
        ? rawValue.slice(0, DESCRIPCION_PRODUCTO_MAX_LENGTH)
        : rawValue;

    const nextFormData = {
      ...formData,
      [name]: newValue,
    };

    setFormData(nextFormData);

    const error = validateField(name, newValue, nextFormData);
    setErrors((prevErrors) => ({
      ...prevErrors,
      [name]: error,
    }));
  };

  // Validar todo el formulario antes de enviar
  const validateForm = () => {
    const { errors: nuevosErrores, isValid } = validarProducto(formData);
    setErrors(nuevosErrores);
    return isValid;
  };

  // FUNCIÓN DE ENVÍO: CREA EL OBJETO JSON CON LOS TIPOS CORRECTOS PARA LA API
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setProcesando(true);
      try {
        // Mapear campos del formulario al formato esperado por la API
        const dataToSubmit = {
          nombre_producto: formData.nombre,
          categoria: formData.categoria,
          descripcion_producto: String(formData.descripcion || "")
            .trim()
            .slice(0, DESCRIPCION_PRODUCTO_MAX_LENGTH),
          imagen_url: formData.imagen_url || null,
          precio_venta_producto: formData.precioVenta
            ? parseFloat(formData.precioVenta)
            : null,
          stock: formData.stock ? parseInt(formData.stock) : null,
          id_estados: formData.estado === "Activo" ? 1 : 2,
        };

        // Si es edición, incluir el ID mapeado
        if (estaEditando && formData.id) {
          dataToSubmit.id_productos = formData.id;
        }

        const resultado = await onSubmit(dataToSubmit);
        if (resultado === false) {
          throw new Error(
            producto && producto.id
              ? "No se pudo actualizar el producto"
              : "No se pudo crear el producto"
          );
        }
        toast.success(
          producto && producto.id
            ? "Producto actualizado exitosamente"
            : "Producto creado exitosamente"
        );
      } catch (error) {
        console.error('Error al guardar producto:', error);
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "No se pudo guardar el producto"
        );
      } finally {
        setProcesando(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (producto && estaEditando) {
      const precioProducto =
        producto.precioVenta ??
        producto.precio_venta_producto ??
        producto.precio_venta ??
        producto.precio ??
        producto.valor ??
        null;

      setFormData({
        id: productoId,
        nombre:
          producto.nombre ??
          producto.nombre_producto ??
          producto.nombreProducto ??
          producto.producto_nombre ??
          "",
        descripcion:
          producto.descripcion ??
          producto.descripcion_producto ??
          producto.descripcionProducto ??
          "",
        precioVenta:
          precioProducto !== undefined && precioProducto !== null
            ? String(precioProducto)
            : "",
        stock:
          producto.stock !== undefined && producto.stock !== null
            ? String(producto.stock)
            : "",
        categoria:
          producto.categoria ??
          producto.categoria_producto ??
          producto.categoriaProducto ??
          "",
        estado: resolveEstadoProducto(producto),
        imagen_url:
          producto.imagen_url ??
          producto.imagenUrl ??
          producto.imagen ??
          "",
      });
    } else {
      setFormData({
        id: "",
        nombre: "",
        descripcion: "",
        precioVenta: "",
        stock: "",
        categoria: "",
        estado: "Activo",
        imagen_url: "",
      });
    }
    setErrors({});
  }, [producto, isOpen, estaEditando, productoId]);

  return (
    <Modal
      title={modalTitle}
      onClose={onClose}
      size="lg"
      className="modal-producto-redesigned"
      footer={
        <>
          <button className="boton boton-secundario" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="boton boton-primario"
            onClick={handleSubmit}
            disabled={procesando}
          >
            {producto ? "Actualizar" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="modal-productos__content-root">
        <div className="modal-body-content modal-body-content--spacious">
          <motion.div
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
                <h3 className="modal-section-title">
                  Información Básica
                </h3>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Nombre <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    placeholder="Ingrese el nombre del producto"
                    maxLength="80"
                    className={`modal-field-input ${errors.nombre ? "modal-productos__input--error" : ""}`}
                  />
                  {errors.nombre && <p className="modal-productos__error-text">{errors.nombre}</p>}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Precio Venta <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="number"
                    name="precioVenta"
                    value={formData.precioVenta}
                    onChange={handleChange}
                    onKeyDown={handleNumericKeyDown}
                    placeholder="Precio de venta (mínimo 1000)"
                    step="0.01"
                    min="1000"
                    title="El precio mínimo permitido es 1000"
                    className={`modal-field-input ${errors.precioVenta ? "modal-productos__input--error" : ""}`}
                  />
                  {errors.precioVenta && <p className="modal-productos__error-text">{errors.precioVenta}</p>}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Stock <span className="modal-required-asterisk">*</span>
                  </label>
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    onKeyDown={handleNumericKeyDown}
                    placeholder="Stock disponible (minimo 1)"
                    min="1"
                    step="1"
                    title="El stock minimo permitido es 1"
                    className={`modal-field-input ${errors.stock ? "modal-productos__input--error" : ""}`}
                  />
                  {errors.stock && <p className="modal-productos__error-text">{errors.stock}</p>}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Categoría
                  </label>
                  <select
                    name="categoria"
                    value={formData.categoria}
                    onChange={handleChange}
                    required
                    className={`modal-field-input modal-field-input--select ${errors.categoria ? "modal-productos__input--error" : ""}`}
                  >
                    <option value="" disabled>
                      Seleccione una categoría
                    </option>
                    {CATEGORIAS_PRODUCTO.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {errors.categoria && <p className="modal-productos__error-text">{errors.categoria}</p>}
                </motion.div>

                {estaEditando && (
                  <motion.div
                    className="modal-field-group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.3 }}
                  >
                    <label className="modal-field-label">
                      Estado
                    </label>
                    <select
                      value={formData.estado}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          estado: e.target.value,
                        }))
                      }
                      className="modal-field-input modal-field-input--select"
                    >
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </motion.div>
                )}
              </motion.div>

              <motion.div
                className="modal-form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <h3 className="modal-section-title">
                  Información Adicional
                </h3>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Imagen URL
                  </label>
                  <input
                    type="text"
                    name="imagen_url"
                    value={formData.imagen_url}
                    onChange={handleChange}
                    placeholder="URL de la imagen del producto"
                    maxLength="255"
                    className={`modal-field-input ${errors.imagen_url ? "modal-productos__input--error" : ""}`}
                  />
                  {errors.imagen_url && <p className="modal-productos__error-text">{errors.imagen_url}</p>}
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Descripción
                  </label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleChange}
                    placeholder="Descripción del producto"
                    maxLength={DESCRIPCION_PRODUCTO_MAX_LENGTH}
                    rows={4}
                    className={`modal-field-input modal-field-input--textarea ${errors.descripcion ? "modal-productos__input--error" : ""}`}
                  />
                  <p className="modal-productos__helper-text">
                    {formData.descripcion.length}/{DESCRIPCION_PRODUCTO_MAX_LENGTH}
                  </p>
                  {errors.descripcion && <p className="modal-productos__error-text">{errors.descripcion}</p>}
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </Modal>
  );
};

/* ======================================================
    Modal Eliminar Producto
====================================================== */
export const ModalEliminarProducto = ({
  isOpen,
  onClose,
  onConfirm,
  producto,
}) => {
  if (!isOpen || !producto) return null;

  const handleConfirmDelete = () => {
    onConfirm(producto);
  };

  // Función para formatear el precio
  const formatPrice = (price) => {
    if (price === undefined || price === null) return 'No especificado';
    return `$${parseFloat(price).toLocaleString('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirmDelete}
      item={producto}
      title="Eliminar Producto"
      fields={[
        {
          key: 'nombre',
          label: 'Producto',
          format: (value) => <strong>{value || 'Producto sin nombre'}</strong>
        },
        {
          key: 'codigo',
          label: 'Código',
          format: (value) => value || 'No especificado'
        },
        {
          key: 'precioVenta',
          label: 'Precio',
          format: formatPrice
        },
        {
          key: 'stock',
          label: 'Stock',
          format: (value) => `${value || 0} unidades`
        },
        {
          key: 'categoria',
          label: 'Categoría',
          format: (value) => value || 'No especificada'
        }
      ]}
      warningMessage={
        <div>
          <p>Al eliminar este producto, se perderá toda la información asociada incluyendo:</p>
          <ul className="modal-warning-list">
            <li>Historial de ventas</li>
            <li>Información de inventario</li>
            <li>Relaciones con proveedores</li>
          </ul>
          <p className="modal-warning-emphasis">
            ¿Estás completamente seguro de que deseas continuar?
          </p>
        </div>
      }
    />
  );
};

/* ======================================================
    Modal Ver Producto (REDISEÑADO con estilo de pedidos)
====================================================== */
export const ModalVerProducto = ({ isOpen, onClose, producto }) => {
  if (!isOpen || !producto) return null;

  const formatearPrecio = (precio) => {
    if (precio === undefined || precio === null) return "No especificado";
    return `$${parseFloat(precio).toLocaleString("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <Modal
      title={`Detalles del Producto #${producto.id || "N/A"}`}
      onClose={onClose}
      size="lg"
      className="producto-redesigned"
      footer={
        <button className="boton boton-primario" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <div className="modal-productos__content-root">
        <div className="modal-body-content--spacious">
          <motion.div
            className="general-tab-layout"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Left Column: Product Details */}
            <div className="general-form-column">
              <motion.div
                className="modal-form-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <h3 className="modal-section-title">
                  Información Básica
                </h3>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    ID Producto
                  </label>
                  <input
                    type="text"
                    className="modal-field-input modal-field-input--readonly"
                    value={producto.id || "Sin ID"}
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
                  <label className="modal-field-label">
                    Nombre
                  </label>
                  <input
                    type="text"
                    className="modal-field-input modal-field-input--readonly"
                    value={producto.nombre || "Sin nombre"}
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
                  <label className="modal-field-label">
                    Precio de Venta
                  </label>
                  <input
                    type="text"
                    className="modal-field-input modal-field-input--readonly"
                    value={formatearPrecio(producto.precioVenta)}
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
                  <label className="modal-field-label">
                    Stock
                  </label>
                  <input
                    type="text"
                    className="modal-field-input modal-field-input--readonly"
                    value={producto.stock || "0"}
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
                  <label className="modal-field-label">
                    Categoría
                  </label>
                  <input
                    type="text"
                    className="modal-field-input modal-field-input--readonly"
                    value={producto.categoria || "No especificada"}
                    readOnly
                    disabled
                  />
                </motion.div>

                <motion.div
                  className="modal-field-group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.3 }}
                >
                  <label className="modal-field-label">
                    Estado
                  </label>
                  <input
                    type="text"
                    className="modal-field-input modal-field-input--readonly"
                    value={producto.estado === "activo" ? "Activo" : "Inactivo"}
                    readOnly
                    disabled
                  />
                </motion.div>
              </motion.div>

              {producto.descripcion && (
                <motion.div
                  className="modal-form-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.4 }}
                >
                  <h3 className="modal-section-title">
                    Descripción
                  </h3>
                  <textarea
                    className="modal-field-input modal-field-input--readonly modal-productos__textarea-readonly"
                    value={producto.descripcion}
                    readOnly
                    disabled
                    rows={4}
                  />
                </motion.div>
              )}
            </div>


          </motion.div>
        </div>
      </div>
    </Modal>
  );
};
/* ======================================================
    Modal Cambiar Estado Producto (REDISEÑADO con estilo de pedidos)
====================================================== */
export const ModalCambiarEstadoProducto = ({
  isOpen,
  onClose,
  onConfirm,
  producto,
}) => {
  useLockBodyScroll(isOpen);

  if (!producto) return null;

  const estadoTexto = String(producto.estado || "").toLowerCase();
  const estaActivo =
    Number(producto.id_estado) === 1 ||
    estadoTexto === "activo" ||
    estadoTexto === "active";

  const nuevoEstado = estaActivo ? "inactivo" : "activo";
  const esActivacion = nuevoEstado === "activo";

  const formatearPrecio = (precio) => {
    if (precio === undefined || precio === null || precio === "") {
      return "No especificado";
    }
    const numero = Number(precio);
    if (Number.isNaN(numero)) return "No especificado";
    return `$${numero.toLocaleString("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const detalleProducto = (
    <div className="modal-productos__detail-grid">
      <div>
        <strong>Producto:</strong> {producto.nombre || "Sin nombre"}
      </div>
      <div>
        <strong>Categoria:</strong> {producto.categoria || "No especificada"}
      </div>
      <div>
        <strong>Precio:</strong> {formatearPrecio(producto.precioVenta)}
      </div>
      <div>
        <strong>Stock:</strong> {producto.stock || 0}
      </div>
      <div>
        <strong>Estado actual:</strong> {estaActivo ? "Activo" : "Inactivo"}
      </div>
    </div>
  );

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        onConfirm?.(producto, nuevoEstado);
        onClose();
      }}
      targetStatus={nuevoEstado}
      type={esActivacion ? "activate" : "deactivate"}
      title={esActivacion ? "Activar producto" : "Desactivar producto"}
      message={
        esActivacion
          ? "El producto quedara disponible para la venta."
          : "El producto dejara de estar disponible para la venta."
      }
      confirmText={esActivacion ? "Si, activar" : "Si, desactivar"}
      details={detalleProducto}
    />
  );

};

