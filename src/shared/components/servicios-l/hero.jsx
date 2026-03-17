import Paquetes from "./paquetes";

export default function Hero() {
  return (
    <section id="inicio" className="hero">
      <div className="hero__bg" />
      <div className="hero__content">
        <h1>
          Eleva Tu Viaje de <span>Fitness</span>
        </h1>
        <p>
          Nuestros paquetes de acceso básico hasta premium están diseñados para
          alcanzar tus metas.
        </p>
      </div>
      <div className="hero__packages">
        <Paquetes />
      </div>
    </section>
  );
}
