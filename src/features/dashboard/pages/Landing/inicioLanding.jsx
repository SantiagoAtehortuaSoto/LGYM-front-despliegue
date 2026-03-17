import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Modal from "../../../../shared/components/Modal/Modal";
/*Importacion de componentes*/
import NavegadorLanding from "../../../../shared/components/navegadorLanding";
import PieDePagina from "../../../../shared/components/piedepagina";
/* Importacion de las imagenes */
import experienciaImg from "../../../../assets/experienciaimg.png";
import gimnasio_1 from "../../../../assets/beneficios_img_1.png";
import gimnasio_2 from "../../../../assets/beneficios_img_2.png";
import gimnasio_3 from "../../../../assets/beneficios_img_3.png";
import gimnasio_4 from "../../../../assets/beneficios_img_4.png";
import entrenador_1 from "../../../../assets/Entrenador_1.png";
import mision from "../../../../assets/mision.png";
import vision from "../../../../assets/Vision.png";
/* Importacion del css */

/* Importacion de los iconos */
import {
  Dumbbell,
  Award,
  Activity,
  HeartPulse,
  Home,
  Calendar,
  HeartHandshake,
  Eye,
  Dumbbell as DumbbellIcon,
} from "lucide-react";
// Alias for backward compatibility
const IconGymnastics = DumbbellIcon;
const IconCalendar = Calendar;
const IconHome = Home;
const IconHeartHandshake = HeartHandshake;
const IconEyeSearch = Eye;
const IconTreadmill = DumbbellIcon; // Using Dumbbell as fallback for Treadmill
/* Importacion de pagina */
const InicioLanding = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  useEffect(() => {
    // Desactivar restauración automática del navegador
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // Forzar a que inicie arriba
    window.scrollTo(0, 0);

    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const headerClass = `inicio-cabeza ${isScrolled ? "scrolled" : ""}`;

  return (
    <>
      {/* Navegador */}
      <div className={headerClass}>
        <NavegadorLanding />
      </div>
      {/* Sección Hero */}
      <section className="hero">
        {/* Contenido principal */}
        <div className="inicio-contenido">
          <h1>
            TRANSFORMA TU CUERPO CON <br />
            <span>NUEVA ERA FITNESS</span>
          </h1>
          <p>
            En <strong>Nueva Era Fitness</strong> te ayudamos a alcanzar tu
            mejor versión con entrenamientos personalizados, equipamiento
            profesional y un ambiente que te inspira a superarte cada día.
          </p>
          <p>¿Estás listo para empezar tu transformación?</p>

          <div className="botones">
            <Link to="/contactos">
              <button className="btn-rojo">Contáctanos</button>
            </Link>

            <Link to="/acceder">
              <button className="btn-transparente">Acceder</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Sección de experiencia */}
      <section className="contenido">
        <div className="contenido-experiencia">
          {/* Imagen izquierda */}
          <div className="imagen-texto">
            <img
              src={experienciaImg}
              alt="Personas entrenando en gimnasio"
              className="imagen-experiencia"
            />
          </div>

          {/* Texto derecha */}
          <div className="texto-experiencia">
            <h2 className="texto-experiencia-h2">10 AÑOS DE EXPERIENCIA</h2>
            <p>
              Con más de 10 años de experiencia, hemos acompañado a cientos de
              personas en su camino hacia una vida más activa y saludable.
              Nuestro compromiso es ofrecer un ambiente moderno, entrenadores
              calificados y programas diseñados para lograr resultados reales.
            </p>

            {/* Iconos con texto */}
            <div className="iconos-experiencia">
              <div className="icono-item">
                <Dumbbell size={55} color="#E41000" strokeWidth={1.5} />
                <div className="icono-texto">
                  <h3>CENTRO DE GIMNASIO CERTIFICADO</h3>
                  <p>
                    Centro certificado que garantiza calidad, seguridad y
                    programas para tu salud y rendimiento.
                  </p>
                </div>
              </div>

              <div className="icono-item">
                <Award size={55} color="#E41000" strokeWidth={1.5} />
                <div className="icono-texto">
                  <h3>ALTA CALIDAD</h3>
                  <p>
                    Entrenamiento con equipos modernos y servicio de excelencia
                    para tus mejores resultados.
                  </p>
                </div>
              </div>
            </div>
            <button className="btn-rojo" onClick={() => setOpenModal(true)}>
              Leer más
            </button>
          </div>
        </div>
      </section>
      {/* Modal */}

      <Modal
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        title="Nuestra Experiencia"
        size="xl"
        className="landing-experience-modal"
        icon={<Award size={22} strokeWidth={2.2} />}
      >
        <div className="landing-experience-modal__body">
          <div className="landing-experience-modal__intro">
            <span className="landing-experience-modal__badge">
              10+ años impulsando resultados reales
            </span>
            <p className="landing-experience-modal__lead">
              En <strong>Nueva Era Fitness</strong> combinamos experiencia,
              acompañamiento profesional y una energía de entrenamiento que se
              siente desde que entras.
            </p>
            <p className="landing-experience-modal__text">
              Nuestro enfoque está en ofrecer entrenadores expertos, planes
              personalizados y un entorno que motive disciplina, progreso y
              confianza en cada etapa del proceso.
            </p>
          </div>

          <div className="landing-experience-modal__grid">
            <article className="landing-experience-modal__card">
              <div className="landing-experience-modal__card-icon">
                <Award size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h3>Trayectoria comprobada</h3>
                <p>
                  Más de una década ayudando a personas a mejorar su
                  rendimiento, salud y constancia.
                </p>
              </div>
            </article>

            <article className="landing-experience-modal__card">
              <div className="landing-experience-modal__card-icon">
                <Dumbbell size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h3>Entrenamiento a tu medida</h3>
                <p>
                  Programas adaptados a tus objetivos, nivel actual y ritmo de
                  progreso.
                </p>
              </div>
            </article>

            <article className="landing-experience-modal__card">
              <div className="landing-experience-modal__card-icon">
                <HeartHandshake size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h3>Acompañamiento cercano</h3>
                <p>
                  Seguimiento constante para que entrenes con enfoque,
                  seguridad y motivación.
                </p>
              </div>
            </article>
          </div>
        </div>
                  <div
          style={{ height: '10px' }}></div>
      </Modal>

      {/* Cartas de colores */}
      <section className="servicios">
        <h2>¿POR QUÉ ELEGIRNOS?</h2>
        <div className="servicios-contenedor">
          {/* Progresión */}
          <div className="servicio-card">
            <Dumbbell size={50} color="#E41000" strokeWidth={1.5} />
            <h3>PROGRESIÓN</h3>
            <p>
              Avanza cada día con rutinas personalizadas y seguimiento constante
              de tus logros.
            </p>
          </div>

          {/* Ejercicio */}
          <div className="servicio-card servicio-activo">
            <Activity size={50} color="#000000" strokeWidth={1.5} />
            <h3>EJERCICIO</h3>
            <p>
              Ejercicio con planes a tu medida, entrenadores expertos y un
              ambiente motivador.
            </p>
          </div>

          {/* Nutrición */}
          <div className="servicio-card">
            <HeartPulse size={50} color="#E41000" strokeWidth={1.5} />
            <h3>NUTRICIÓN</h3>
            <p>
              Asesoría nutricional para complementar tu entrenamiento y
              potenciar resultados.
            </p>
          </div>
        </div>
      </section>

      {/* Beneficios del GYM*/}
      <section className="Beneficios">
        <h2>Beneficios de unirse a nuestro Gimnasio</h2>
        <div className="Beneficios-contenedor">
          {/*instructores */}
          <div className="Beneficios-img">
            <IconGymnastics
              size={90}
              color="#ffffff"
              strokeWidth={1.5}
              className="icon-beneficios"
            />
            <img
              src={gimnasio_1}
              alt="Hombre Mirado en el espejo"
              className="imagen-beneficios"
            />
            <div className="texto-beneficios">
              <h3>Instructores</h3>
              <p>
                Instructores altamente capacitados para guiarte en tu viaje
                fitness.
              </p>
            </div>
          </div>
          {/*Calendario */}
          <div className="Beneficios-img">
            <IconCalendar
              size={90}
              color="#ffffff"
              strokeWidth={1.5}
              className="icon-beneficios"
            />
            <img
              src={gimnasio_2}
              alt="Mujer  levantado pesas"
              className="imagen-beneficios"
            />
            <div className="texto-beneficios">
              <h3>Calendario</h3>
              <p>
                Acceso a un calendario de clases y eventos para que no te
                pierdas nada.
              </p>
            </div>
          </div>

          {/*Acompañamineto*/}
          <div className="Beneficios-img">
            <IconHome
              size={90}
              color="#ffffff"
              strokeWidth={1.5}
              className="icon-beneficios"
            />
            <img
              src={gimnasio_3}
              alt="Grupo de personas entrenando"
              className="imagen-beneficios"
            />
            <div className="texto-beneficios">
              <h3>Acompañamiento</h3>
              <p>
                Acompañamiento constante para resolver tus dudas y mantenerte
                motivado.
              </p>
            </div>
          </div>

          {/*Apoyo */}
          <div className="Beneficios-img">
            <IconHeartHandshake
              size={90}
              color="#ffffff"
              strokeWidth={1.5}
              className="icon-beneficios"
            />
            <img
              src={gimnasio_4}
              alt="Hombre haciendo ejercicio"
              className="imagen-beneficios"
            />
            <div className="texto-beneficios">
              <h3>Apoyo</h3>
              <p>
                Apoyo constante para resolver tus dudas y mantenerte motivado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de entrenadores */}
      <section className="entrenadores">
        <h2>Conoce a Nuestros Entrenadores Expertos</h2>

        <div className="entrenadores-contenedor">
          {/* Entrenador 1 */}
          <div className="entrenador-card">
            <img src={entrenador_1} alt="Entrenador 1" />
            <div className="texto-entrenador">
              <h3>Daniel Caro</h3>
              <p>
                Entrenador personal con 5 años de experiencia en fitness y
                nutrición.
              </p>
            </div>
          </div>

          {/* Entrenador 2 */}
          <div className="entrenador-card">
            <img src={entrenador_1} alt="Entrenador 2" />

            <div className="texto-entrenador">
              <h3>Andrés Garcés</h3>
              <p>
                Especialista en entrenamiento funcional y rehabilitación
                deportiva.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Mision y vision */}
      <section className="mision-vision">
        <h2>
          Conoce <span className="titulo-span">La Nueva Era Fitness</span>
        </h2>
        <div className="mision-vision-contenedor">
          {/* visión */}
          <div className="mision-vision-card">
            <img src={vision} alt="Mujer entrenando" />
            <div className="texto-mision-vision">
              <div className="circulo">
                <IconEyeSearch size={40} color="#ffffff" strokeWidth={1.5} />
              </div>
              <h3>Visión</h3>
              <p>
                Ser el gimnasio líder en innovación y resultados, transformando
                vidas a través del fitness y el bienestar integral.
              </p>
            </div>
          </div>

          {/* Misión */}
          <div className="mision-vision-card">
            <img src={mision} alt="Hombre entrenando" />
            <div className="texto-mision-vision">
              <div className="circulo">
                <IconTreadmill size={40} color="#ffffff" strokeWidth={1.5} />
              </div>
              <h3>Misión</h3>
              <p>
                Brindar un espacio inclusivo y motivador donde cada persona
                pueda alcanzar su máximo potencial físico y mental.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Espacio inferior */}
      <PieDePagina />
    </>
  );
};

export default InicioLanding;
