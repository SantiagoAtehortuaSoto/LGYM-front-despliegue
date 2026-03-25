// modalProgramarCita.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Modal from "../../../../../shared/components/Modal/Modal";
import { validateAppointmentScheduling } from "../../../../../shared/utils/employeeSchedule";
import useSubmitGuard from "../../../../../shared/hooks/useSubmitGuard";
import "../../../../../shared/styles/restructured/components/modal-programar-cita.css";

const Motion = motion;
const getTomorrowISO = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
};

const formInicial = {
  fecha: "",
  horaInicio: "",
  horaFin: "",
  notas: "",
  servicio: "",
  entrenador: "",
};

const ModalProgramarCita = ({
  isOpen,
  onClose,
  onSubmit,
  modoEdicion = false,
  citaEditando = null,
  formData,
  setFormData,
  citas = [],
}) => {
  const { runGuardedSubmit } = useSubmitGuard();
  const [errors, setErrors] = useState({});

  // Reset form when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      if (modoEdicion && citaEditando) {
        setFormData(citaEditando);
      } else {
        setFormData(formInicial);
      }
      setErrors({});
    }
  }, [isOpen, modoEdicion, citaEditando, setFormData]);

  const validateFormData = (data) => {
    const nextErrors = {};

    if (!String(data.fecha || "").trim()) {
      nextErrors.fecha = "Debe seleccionar una fecha.";
    } else if (data.fecha < getTomorrowISO()) {
      nextErrors.fecha = "La fecha no puede ser anterior a mañana.";
    }

    if (!String(data.horaInicio || "").trim()) {
      nextErrors.horaInicio = "Debe seleccionar una hora de inicio.";
    }

    if (!String(data.horaFin || "").trim()) {
      nextErrors.horaFin = "Debe seleccionar una hora final.";
    }

    if (!nextErrors.fecha && !nextErrors.horaInicio && !nextErrors.horaFin) {
      const schedulingValidation = validateAppointmentScheduling({
        agendaFecha: data.fecha,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
        agendaItems: citas,
        currentAppointmentId: citaEditando?.id ?? null,
        isEditing: modoEdicion,
        matchByEmployee: false,
      });

      if (!schedulingValidation.valid) {
        if (
          schedulingValidation.message.includes("fecha u hora pasada") ||
          schedulingValidation.message.includes("ya comenzó")
        ) {
          nextErrors.fecha = schedulingValidation.message;
        } else {
          nextErrors.horaFin = schedulingValidation.message;
        }
      }
    }

    return nextErrors;
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    const nextData = { ...formData, [id]: value };
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

    await runGuardedSubmit(async () => {
      try {
        const resultado = await Promise.resolve(
          onSubmit(formData, modoEdicion, citaEditando)
        );
        if (resultado === false) {
          throw new Error(
            modoEdicion
              ? "No se pudo actualizar la cita"
              : "No se pudo crear la cita"
          );
        }
        toast.success(
          modoEdicion
            ? "Cita actualizada exitosamente"
            : "Cita creada exitosamente"
        );
      } catch (error) {
        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            (modoEdicion
              ? "No se pudo actualizar la cita"
              : "No se pudo crear la cita")
        );
      }
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={modoEdicion ? "Editar Cita" : "Programar Cita"}
        size="md"
        closeOnOverlayClick={true}
        className="modal-mediano"
      >
        <Motion.form
          onSubmit={handleSubmit}
          className="modal-programar-cita__form"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
          <Motion.div
            className="modal-programar-cita__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <h3 className="modal-programar-cita__section-title">
              Información Básica
            </h3>


            <div className="modal-programar-cita__field">
                <label className="modal-programar-cita__label">
                  Entrenador
                </label>
                <input
                  id="entrenador"
                  type="text"
                  value={formData.entrenador}
                  onChange={handleChange}
                  placeholder="Ej: Juan Perez"
                  className="modal-programar-cita__input"
                />
            </div>

            <div className="modal-programar-cita__grid">
              <div className="modal-programar-cita__field">
                <label className="modal-programar-cita__label">
                  Fecha <span className="modal-programar-cita__required">*</span>
                </label>
            <input
              id="fecha"
              type="date"
              value={formData.fecha}
              onChange={handleChange}
              min={getTomorrowISO()}
              
              className={`modal-programar-cita__input ${
                errors.fecha ? "modal-programar-cita__input--error" : ""
                  }`}
                />
                {errors.fecha ? (
                  <p className="modal-programar-cita__error-text">{errors.fecha}</p>
                ) : null}
              </div>

              <div className="modal-programar-cita__field">
                <label className="modal-programar-cita__label">
                  Hora Inicio <span className="modal-programar-cita__required">*</span>
                </label>
                <input
                  id="horaInicio"
                  type="time"
                  value={formData.horaInicio}
                  onChange={handleChange}
                  className={`modal-programar-cita__input ${
                    errors.horaInicio
                      ? "modal-programar-cita__input--error"
                      : ""
                  }`}
                />
                {errors.horaInicio ? (
                  <p className="modal-programar-cita__error-text">
                    {errors.horaInicio}
                  </p>
                ) : null}
              </div>

              <div className="modal-programar-cita__field">
                <label className="modal-programar-cita__label">
                  Hora Fin <span className="modal-programar-cita__required">*</span>
                </label>
                <input
                  id="horaFin"
                  type="time"
                  value={formData.horaFin}
                  onChange={handleChange}
                  className={`modal-programar-cita__input ${
                    errors.horaFin ? "modal-programar-cita__input--error" : ""
                  }`}
                />
                {errors.horaFin ? (
                  <p className="modal-programar-cita__error-text">
                    {errors.horaFin}
                  </p>
                ) : null}
              </div>

              <div className="modal-programar-cita__field">
                <label className="modal-programar-cita__label">
                  Servicio
                </label>
                <input
                  id="servicio"
                  type="text"
                  value={formData.servicio}
                  onChange={handleChange}
                  placeholder="Ej: Entrenamiento personal"
                  className="modal-programar-cita__input"
                />
              </div>

              
            </div>
          </Motion.div>

          <Motion.div
            className="modal-programar-cita__card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <h3 className="modal-programar-cita__section-title">
              Información Adicional
            </h3>

            <div className="modal-programar-cita__field">
              <label className="modal-programar-cita__label" htmlFor="notas">
                Notas
              </label>
              <textarea
                id="notas"
                value={formData.notas}
                onChange={handleChange}
                rows="3"
                placeholder="Información adicional sobre la cita..."
                className="modal-programar-cita__input modal-programar-cita__textarea"
              />
            </div>
          </Motion.div>

          <Motion.div
            className="pie-modal modal-programar-cita__footer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="boton boton-secundario"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="boton boton-primario"
            >
              {modoEdicion ? "Guardar Cambios" : "Guardar Cita"}
            </button>
          </Motion.div>
          </Motion.div>
        </Motion.form>
      </Modal>
    </>
  );
};

export default ModalProgramarCita;

