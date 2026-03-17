import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";

/* Importación de componentes */
import NavegadorLanding from "../../../../shared/components/navegadorLanding";
import PieDePagina from "../../../../shared/components/piedepagina";

/* Importación de css */
/* Iconos */
import {
  IconMap2,
  IconMail,
  IconPhoneRinging,
  IconBrandInstagram,
} from "@tabler/icons-react";

/* Componente ContactosLanding */
import enviarContacto from "../../hooks/Contactos_API_Landing/contacto_api";

const ContactosLanding = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  // estados del formulario
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    mensaje: "",
  });
  const [errors, setErrors] = useState({});

  const [sending, setSending] = useState(false);

  // Scroll para navbar
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerClass = `inicio-cabeza ${isScrolled ? "scrolled" : ""}`;

  const validate = (values = form) => {
    const nextErrors = {};
    if (!values.nombre.trim()) {
      nextErrors.nombre = "Ingresa tu nombre";
    }
    if (!values.email.trim()) {
      nextErrors.email = "Ingresa tu correo";
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Ingresa un correo válido";
    }
    if (values.telefono.trim()) {
      const telefono = values.telefono.replace(/\D/g, "");
      if (telefono.length !== 10) {
        nextErrors.telefono = "Debe tener 10 dígitos";
      }
    }
    if (!values.mensaje.trim()) {
      nextErrors.mensaje = "Escribe un mensaje";
    }
    return nextErrors;
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);
    setErrors(validate(nextForm));
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const sendingToastId = toast.info(
      "Estamos enviando tu mensaje de contacto. Te avisaremos cuando quede registrado."
    );
    setSending(true);

    try {
      await enviarContacto({
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
        mensaje: form.mensaje,
      });

      toast.dismiss(sendingToastId);
      toast.success(
        "Tu mensaje se envio correctamente y quedo registrado. Te responderemos al correo que ingresaste."
      );
      setForm({ nombre: "", email: "", telefono: "", mensaje: "" });
      setErrors({});
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "No se pudo enviar tu mensaje de contacto. El envio no se completo y debes intentarlo nuevamente.";
      toast.dismiss(sendingToastId);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Cabecera fija */}
      <div className={headerClass}>
        <NavegadorLanding />
      </div>

      {/* Sección de contacto */}
      <section className="contactos_landing">
        <div className="contactos_flex">
          <div className="contactos_container">
            {/* Información de contacto */}
            <div className="info_contacto">
              <h2>Pongámonos en contacto</h2>
              <p>
                <span className="span-contacto">Nueva Era Fitness</span> estamos listos para ayudarte a
                cumplir tus metas. Escríbenos y comienza tu camino hacia una
                vida más activa y saludable.
              </p>
              <ul>
                <li className="contacto_item">
                  <IconMap2 size={30} className="icon_contacto" /> | Calle 106 # 43 - 12, Medellín, Antioquia
                </li>
                <li className="contacto_item">
                  <IconMail size={30} className="icon_contacto" /> nuevaerafittness@gmail.com
                </li>
                <li className="contacto_item">
                  <IconPhoneRinging size={30} className="icon_contacto" /> 3043983753
                </li>
              </ul>
              <div className="social_icons">
                <a
                  href="https://www.instagram.com/nuevaera_fitness/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <IconBrandInstagram size={25} color="#fff" strokeWidth={1.5} />
                </a>
              </div>
            </div>

            {/* Formulario */}
            <div className="form_contacto">
              <h2>Contacto</h2>
              <form onSubmit={onSubmit} noValidate aria-live="polite">
                <input
                  name="nombre"
                  type="text"
                  placeholder="Nombre"
                  value={form.nombre}
                  onChange={onChange}
                  required
                  autoComplete="name"
                  className={errors.nombre ? "input-error" : ""}
                />
                {errors.nombre ? (
                  <small className="error-message">{errors.nombre}</small>
                ) : null}
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={onChange}
                  required
                  autoComplete="email"
                  inputMode="email"
                  className={errors.email ? "input-error" : ""}
                />
                {errors.email ? (
                  <small className="error-message">{errors.email}</small>
                ) : null}
                <input
                  name="telefono"
                  type="tel"
                  placeholder="Teléfono"
                  value={form.telefono}
                  onChange={onChange}
                  autoComplete="tel"
                  inputMode="tel"
                  className={errors.telefono ? "input-error" : ""}
                />
                {errors.telefono ? (
                  <small className="error-message">{errors.telefono}</small>
                ) : null}
                <textarea
                  name="mensaje"
                  placeholder="Mensaje"
                  value={form.mensaje}
                  onChange={onChange}
                  required
                  rows={5}
                  className={errors.mensaje ? "input-error" : ""}
                />
                {errors.mensaje ? (
                  <small className="error-message">{errors.mensaje}</small>
                ) : null}
                <button type="submit" disabled={sending} aria-busy={sending}>
                  {sending ? "Enviando mensaje…" : "Enviar"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Pie de página */}
      <PieDePagina />
    </>
  );
};

export default ContactosLanding;
