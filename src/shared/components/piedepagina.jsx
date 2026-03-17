import React from "react";
import {
  IconMapPin,
  IconPhone,
  IconMail,
  IconBrandInstagram,
} from "@tabler/icons-react";

const PieDePagina = () => {
  return (
    <footer className="footer-animado">
      <div className="ola-mascara" aria-hidden="true"></div>

      <div className="burbujas">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>

      <div className="contenido-pie-pagina">
        <div>
          <h3>Ponte En Contacto</h3>
          <p>
            <IconMapPin size={20} color="#fff" strokeWidth={1.5} /> Cra. 50B,
            Santa Cruz, Medellin.
          </p>
          <p>
            <IconPhone size={20} color="#fff" strokeWidth={1.5} /> +57 301 234
            5678
          </p>
          <p>
            <IconMail size={20} color="#fff" strokeWidth={1.5} />{" "}
            nuevaerafittness@gmail.com
          </p>
          <p>
            <IconBrandInstagram size={20} color="#fff" strokeWidth={1.5} />{" "}
            @nuevaera_fitness
          </p>
        </div>

        <div>
          <h3>Enlaces Rapidos</h3>
          <a href="/">Inicio</a>
          <a href="/servicios">Servicios</a>
          <a href="/productos">Productos</a>
          <a href="/contactos">Contacto</a>
          <a href="/acceder">Acceder</a>
        </div>

        <div>
          <h3>Horarios de Apertura</h3>
          <p>Lunes - Viernes: 6:00 AM - 10:00 PM</p>
          <p>Sabado: 8:00 AM - 8:00 PM</p>
          <p>Domingo: 10:00 AM - 6:00 PM</p>
        </div>
      </div>

      <div className="linea"></div>
      <p className="copyright">
        (c) 2025 Nueva Era Fitness. Todos los derechos reservados.
      </p>
    </footer>
  );
};

export default PieDePagina;

