import React, { useState, useEffect, useRef } from 'react';
import PropTypes from "prop-types";
import { toast } from "react-hot-toast";
import Modal from '../../../../../shared/components/Modal/Modal';
import { DeleteModal } from '../../../../../shared/components/deleteModal/deleteModal';
import { obtenerUsuarios } from '../../../hooks/Usuarios_API/API_Usuarios';
import "../../../../../shared/styles/restructured/components/modal-ventas-membresias.css";

const membershipOptions = [
  'Basica Mensual',
  'Premium Mensual',
  'Basica Anual',
  'Premium Anual',
  'Estudiante Trimestral'
];

const paymentOptions = [
  'Efectivo',
  'Tarjeta de Credito',
  'Tarjeta de Debito',
  'Transferencia',
  'Otro'
];

const estadoOptions = ['Activo', 'Vencido'];
const MAX_NOTAS_LENGTH = 200;
const MONTO_DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;

const buildInitialFormData = (initialData = {}) => ({
  id: initialData.id || null,
  cliente: initialData.cliente || '',
  membresia: initialData.membresia || '',
  fechaInicio: initialData.fechaInicio || '',
  fechaFin: initialData.fechaFin || '',
  metodoPago: initialData.metodoPago || 'Efectivo',
  monto: initialData.monto || '',
  estado: initialData.estado || 'Activo',
  notas: initialData.notas || '',
});

// Base Modal Component for Membresías
const BaseMembresiaModal = ({
  title,
  initialData = {},
  onClose,
  onSave,
  disabled = false,
  isOpen = true,
}) => {
  const modalRef = useRef(null);

  /* ---------- Estado del Formulario ---------- */
  const [formData, setFormData] = useState(() => buildInitialFormData(initialData));
  const [errors, setErrors] = useState({});

  const [clientes, setClientes] = useState([]);
  const [cargandoClientes, setCargandoClientes] = useState(false);

  /* ---------- Efectos ---------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (!disabled && isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose, disabled, isOpen]);

  // Cargar clientes cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    setFormData(buildInitialFormData(initialData));
    setErrors({});

    const cargarClientes = async () => {
      setCargandoClientes(true);
      try {
        const respuesta = await obtenerUsuarios();
        const listaClientes = Array.isArray(respuesta?.data)
          ? respuesta.data
          : Array.isArray(respuesta)
          ? respuesta
          : [];

        // Filtrar solo usuarios activos y mapear para el select
        const clientesActivos = listaClientes
          .filter(cliente => cliente.id_estado === 1) // Solo activos
          .map(cliente => ({
            value: cliente.id_usuario || cliente.id,
            label: cliente.nombre_completo || cliente.nombre || `${cliente.nombre} ${cliente.apellido || ''}`.trim() || `Usuario ${cliente.id_usuario || cliente.id}`
          }));

        setClientes(clientesActivos);
      } catch (error) {
        console.error('Error al cargar clientes:', error);
        setClientes([]);
      } finally {
        setCargandoClientes(false);
      }
    };

    cargarClientes();
  }, [initialData, isOpen]);

  const validateFormData = (data) => {
    const nextErrors = {};
    const cliente = String(data.cliente || '').trim();
    const membresia = String(data.membresia || '').trim();
    const fechaInicio = String(data.fechaInicio || '').trim();
    const fechaFin = String(data.fechaFin || '').trim();
    const metodoPago = String(data.metodoPago || '').trim();
    const monto = String(data.monto || '').trim();
    const estado = String(data.estado || '').trim();
    const notas = String(data.notas || '').trim();

    if (!cliente) {
      nextErrors.cliente = 'Debe seleccionar un cliente.';
    } else if (!clientes.some((option) => String(option.value) === cliente)) {
      nextErrors.cliente = 'Debe seleccionar un cliente válido.';
    }

    if (!membresia) {
      nextErrors.membresia = 'Debe seleccionar una membresía.';
    } else if (!membershipOptions.includes(membresia)) {
      nextErrors.membresia = 'Debe seleccionar una membresía válida.';
    }

    if (!fechaInicio) {
      nextErrors.fechaInicio = 'Debe seleccionar una fecha de inicio.';
    }

    if (!fechaFin) {
      nextErrors.fechaFin = 'Debe seleccionar una fecha de fin.';
    } else if (
      fechaInicio &&
      new Date(fechaFin) < new Date(fechaInicio)
    ) {
      nextErrors.fechaFin =
        'La fecha de fin debe ser igual o posterior al inicio.';
    }

    if (!metodoPago) {
      nextErrors.metodoPago = 'Debe seleccionar un método de pago.';
    } else if (!paymentOptions.includes(metodoPago)) {
      nextErrors.metodoPago = 'Debe seleccionar un método de pago válido.';
    }

    if (monto === '') {
      nextErrors.monto = 'Debe ingresar un monto.';
    } else if (!MONTO_DECIMAL_REGEX.test(monto)) {
      nextErrors.monto = 'Debe ingresar un monto válido con hasta 2 decimales.';
    } else if (Number(monto) <= 0) {
      nextErrors.monto = 'El monto debe ser mayor a 0.';
    }

    if (!estadoOptions.includes(estado)) {
      nextErrors.estado = 'Debe seleccionar un estado válido.';
    }

    if (notas.length > MAX_NOTAS_LENGTH) {
      nextErrors.notas = 'Las notas no pueden superar los 200 caracteres.';
    }

    return nextErrors;
  };

  /* ---------- Handlers ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    const normalizedValue =
      name === "monto"
        ? value
            .replace(/[^0-9.]/g, "")
            .replace(/(\..*)\./g, "$1")
        : value;
    const nextData = {
      ...formData,
      [name]: normalizedValue,
    };
    setFormData(nextData);
    setErrors(validateFormData(nextData));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = validateFormData(formData);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // Encontrar el nombre del cliente seleccionado para guardarlo
    const clienteSeleccionado = clientes.find(c => c.value.toString() === formData.cliente.toString());

    const membresiaParaGuardar = {
      ...formData,
      cliente: clienteSeleccionado ? clienteSeleccionado.label : formData.cliente,
      monto: parseFloat(formData.monto) || 0,
    };

    try {
      const resultado = await onSave(membresiaParaGuardar);
      if (resultado === false) {
        throw new Error(
          formData.id
            ? "No se pudo actualizar la membresía"
            : "No se pudo crear la membresía"
        );
      }
      toast.success(
        formData.id
          ? "Membresía actualizada exitosamente"
          : "Membresía creada exitosamente"
      );
      onClose();
    } catch (error) {
      console.error("Error guardando membresía:", error);
      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo guardar la membresía"
      );
    }
  };

  if (!isOpen) return null;

  const formId = "modal-ventas-membresias-form";
  const footer = !disabled ? (
    <>
      <button
        type="button"
        onClick={onClose}
        className="boton boton-secundario"
      >
        Cancelar
      </button>
      <button
        type="submit"
        form={formId}
        className="boton boton-primario"
      >
        Guardar
      </button>
    </>
  ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      closeOnOverlayClick={!disabled}
      className="modal-mediano"
      modalRef={modalRef}
      footer={footer}
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="modal-ventas-membresias__form"
        noValidate
      >
        <div className="modal-ventas-membresias__card">
          <h3 className="modal-ventas-membresias__section-title">
            Información Básica
          </h3>

          <div className="modal-ventas-membresias__grid">
            <div className="modal-ventas-membresias__field">
              <label className="modal-ventas-membresias__label">Cliente</label>
              {disabled ? (
                <input
                  type="text"
                  className="modal-ventas-membresias__input"
                  value={formData.cliente || "Sin cliente"}
                  disabled
                />
              ) : (
                <select
                  name="cliente"
                  value={formData.cliente}
                  onChange={handleChange}
                  className={`modal-ventas-membresias__input modal-ventas-membresias__select ${
                    errors.cliente ? 'modal-ventas-membresias__input--error' : ''
                  }`}
                  disabled={cargandoClientes}
                >
                  <option value="" disabled>
                    {cargandoClientes ? 'Cargando clientes...' : 'Seleccione un cliente'}
                  </option>
                  {clientes.map((cliente) => (
                    <option key={cliente.value} value={cliente.value}>
                      {cliente.label}
                    </option>
                  ))}
                </select>
              )}
              {errors.cliente ? (
                <p className="modal-ventas-membresias__error-text">{errors.cliente}</p>
              ) : null}
            </div>

            <div className="modal-ventas-membresias__field">
              <label className="modal-ventas-membresias__label">Tipo de Membresía</label>
              {disabled ? (
                <input
                  type="text"
                  className="modal-ventas-membresias__input"
                  value={formData.membresia || "Sin tipo"}
                  disabled
                />
              ) : (
                <select
                  name="membresia"
                  value={formData.membresia}
                  onChange={handleChange}
                  className={`modal-ventas-membresias__input modal-ventas-membresias__select ${
                    errors.membresia ? 'modal-ventas-membresias__input--error' : ''
                  }`}
                >
                  <option value="" disabled>
                    Seleccione una membresía
                  </option>
                  {membershipOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
              {errors.membresia ? (
                <p className="modal-ventas-membresias__error-text">
                  {errors.membresia}
                </p>
              ) : null}
            </div>

            <div className="modal-ventas-membresias__field">
              <label className="modal-ventas-membresias__label">Fecha de Inicio</label>
              <input
                type="date"
                name="fechaInicio"
                value={formData.fechaInicio}
                onChange={handleChange}
                disabled={disabled}
                className={`modal-ventas-membresias__input ${
                  errors.fechaInicio ? 'modal-ventas-membresias__input--error' : ''
                }`}
              />
              {errors.fechaInicio ? (
                <p className="modal-ventas-membresias__error-text">
                  {errors.fechaInicio}
                </p>
              ) : null}
            </div>

            <div className="modal-ventas-membresias__field">
              <label className="modal-ventas-membresias__label">Fecha de Fin</label>
              <input
                type="date"
                name="fechaFin"
                value={formData.fechaFin}
                onChange={handleChange}
                disabled={disabled}
                className={`modal-ventas-membresias__input ${
                  errors.fechaFin ? 'modal-ventas-membresias__input--error' : ''
                }`}
              />
              {errors.fechaFin ? (
                <p className="modal-ventas-membresias__error-text">{errors.fechaFin}</p>
              ) : null}
            </div>

            <div className="modal-ventas-membresias__field">
              <label className="modal-ventas-membresias__label">Método de Pago</label>
              {disabled ? (
                <input
                  type="text"
                  className="modal-ventas-membresias__input"
                  value={formData.metodoPago || "Sin método"}
                  disabled
                />
              ) : (
                <select
                  name="metodoPago"
                  value={formData.metodoPago}
                  onChange={handleChange}
                  className={`modal-ventas-membresias__input modal-ventas-membresias__select ${
                    errors.metodoPago ? 'modal-ventas-membresias__input--error' : ''
                  }`}
                >
                  {paymentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
              {errors.metodoPago ? (
                <p className="modal-ventas-membresias__error-text">
                  {errors.metodoPago}
                </p>
              ) : null}
            </div>

            <div className="modal-ventas-membresias__field">
              <label className="modal-ventas-membresias__label">Monto ($)</label>
              <input
                type="text"
                name="monto"
                inputMode="decimal"
                value={formData.monto}
                onChange={handleChange}
                disabled={disabled}
                className={`modal-ventas-membresias__input ${
                  errors.monto ? 'modal-ventas-membresias__input--error' : ''
                }`}
              />
              {errors.monto ? (
                <p className="modal-ventas-membresias__error-text">{errors.monto}</p>
              ) : null}
            </div>

            <div className="modal-ventas-membresias__field">
              <label className="modal-ventas-membresias__label">Estado</label>
              {disabled ? (
                <input
                  type="text"
                  className="modal-ventas-membresias__input"
                  value={formData.estado || "Sin estado"}
                  disabled
                />
              ) : (
                <select
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  className={`modal-ventas-membresias__input modal-ventas-membresias__select ${
                    errors.estado ? 'modal-ventas-membresias__input--error' : ''
                  }`}
                >
                  {estadoOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
              {errors.estado ? (
                <p className="modal-ventas-membresias__error-text">{errors.estado}</p>
              ) : null}
            </div>

            {formData.id && (
              <div className="modal-ventas-membresias__field">
                <label className="modal-ventas-membresias__label">ID Membresía</label>
                <input
                  type="text"
                  className="modal-ventas-membresias__input"
                  value={formData.id || "Sin ID"}
                  disabled
                />
              </div>
            )}
          </div>
        </div>

        <div className="modal-ventas-membresias__card">
          <h3 className="modal-ventas-membresias__section-title">
            Notas Adicionales
          </h3>
          {disabled ? (
            <div className="modal-ventas-membresias__input modal-ventas-membresias__notes-readonly">
              {formData.notas || "Sin notas adicionales"}
            </div>
          ) : (
            <>
              <textarea
                name="notas"
                value={formData.notas}
                onChange={handleChange}
                rows="3"
                placeholder="Notas adicionales"
                className={`modal-ventas-membresias__input modal-ventas-membresias__textarea ${
                  errors.notas ? 'modal-ventas-membresias__input--error' : ''
                }`}
              />
              {errors.notas ? (
                <p className="modal-ventas-membresias__error-text">{errors.notas}</p>
              ) : null}
            </>
          )}
        </div>

      </form>
    </Modal>
  );
};

BaseMembresiaModal.propTypes = {
  title: PropTypes.string.isRequired,
  initialData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isOpen: PropTypes.bool,
};

export const ModalCrearVenta = ({ onClose, onSave, isOpen = true }) => {
  return (
    <BaseMembresiaModal
      title="Crear Nueva Membresía"
      initialData={{}}
      onClose={onClose}
      onSave={onSave}
      disabled={false}
      isOpen={isOpen}
    />
  );
};
export const ModalEditarVenta = ({ venta, onClose, onSave, isOpen = true }) => {
  if (!venta) return null;

  return (
    <BaseMembresiaModal
      title={`Editar Membresía #${venta.id || "N/A"}`}
      initialData={venta}
      onClose={onClose}
      onSave={onSave}
      disabled={false}
      isOpen={isOpen}
    />
  );
};

export const ModalVerVenta = ({ venta, onClose, isOpen = true }) => {
  if (!venta) return null;

  return (
    <BaseMembresiaModal
      title={`Detalles de la Membresía #${venta.id || "N/A"}`}
      initialData={venta}
      onClose={onClose}
      onSave={() => {}} // No se usa en modo ver
      disabled={true}
      isOpen={isOpen}
    />
  );
};

export const ModalEliminarVenta = ({ venta, onClose, onDelete, isOpen = true }) => {
  if (!venta) return null;

  const handleConfirm = (ventaSeleccionada) => {
    onDelete(ventaSeleccionada.id);
    onClose();
  };

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      item={venta}
      title="Eliminar Membresia"
      fields={[
        {
          key: 'cliente',
          label: 'Cliente',
          format: (value) => <strong>{value}</strong>
        },
        {
          key: 'membresia',
          label: 'Membresia',
          format: (value) => <strong>{value}</strong>
        }
      ]}
      warningMessage="Esta accion no se puede deshacer. Se eliminara permanentemente la membresia del sistema."
    />
  );
};

