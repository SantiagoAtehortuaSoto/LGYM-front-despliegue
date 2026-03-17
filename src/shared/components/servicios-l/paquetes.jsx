import { useState, useEffect } from "react";

const planesAPI = {
  getAll: async () => null,
};

export default function Paquetes() {
  const [planes, setPlanes] = useState([
    {
      name: "Basico",
      price: 10,
      perks: ["Perk 1", "Perk 2", "Perk 3"],
    },
    {
      name: "General",
      price: 20,
      perks: ["Perk 4", "Perk 5", "Perk 6"],
    },
    {
      name: "Premium",
      price: 30,
      perks: ["Perk 7", "Perk 8", "Perk 9"],
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarPlanes();
  }, []);

  const cargarPlanes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await planesAPI.getAll();
      if (data) {
        setPlanes(data);
      } else {
        setPlanes([
          {
            name: "Basico",
            price: 10,
            perks: ["Perk 1", "Perk 2", "Perk 3"],
          },
          {
            name: "General",
            price: 20,
            perks: ["Perk 4", "Perk 5", "Perk 6"],
          },
          {
            name: "Premium",
            price: 30,
            perks: ["Perk 7", "Perk 8", "Perk 9"],
          },
        ]);
      }
    } catch (error) {
      setError("Error al cargar los planes");
      console.error("Error cargando planes:", error);
      setPlanes([]); // Vaciar la lista si hay error
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section id="servicios" className="packages">
        <h2>Nuestros Paquetes</h2>
        <div className="cards">
          <div className="loading-container">
            <p>Cargando planes...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="servicios" className="packages">
        <h2>Nuestros Paquetes</h2>
        <div className="cards">
          <div className="error-container">
            <p>{error}</p>
            <button onClick={cargarPlanes} className="btn-retry">
              Reintentar
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="servicios" className="packages">
      <h2>Nuestros Paquetes</h2>
      <div className="cards">
        {planes.map((p) => (
          <div
            key={p.name}
            className={`card-products btn-reflect ${
              p.name == "Basico"
                ? "Basico"
                : p.name == "General"
                ? "General"
                : p.name == "Premium"
                ? "Premium"
                : ""
            }`}
          >
            <div>
              <h3>{p.name}</h3>
              <p className="price">
                ${p.price}
                <small>/mes</small>
              </p>
              <button className="paquetes-btn">Elegir {p.name}</button>
            </div>
            <div>
            <ul>
              {p.perks.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
