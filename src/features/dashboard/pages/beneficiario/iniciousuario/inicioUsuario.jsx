import React from "react";
import gymBanner from "../../../../../assets/Gym-fondo.png";

const InicioUsuario = () => {
  const userName = "Rinzler Kaf";

  // Sample data for the week overview
  const entrenamientosCompletados = 4;
  const entrenamientosCrecimiento = 20; // in percent
  const caloriasQuemadas = 2500;
  const caloriasCrecimiento = 15; // in percent

  // Sample data for charts (simple bar and line data)
  const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const entrenamientosSemana = [3, 3, 4, 4, 4, 4, 4];
  const caloriasSemana = [2000, 2200, 2100, 2300, 2400, 2200, 2500];
  const getBarHeightClass = (value) => {
    const safe = Math.max(0, Math.min(10, Number(value) || 0));
    return `inicio-usuario__chart-bar--${safe}`;
  };

  return (
    <>
      <div className="encabezado-acciones inicio-usuario__header">
        <h1>
          <span role="img" aria-label="home" className="inicio-usuario__home-icon">
            🏠
          </span>
          Hola, <strong>{userName}</strong>
        </h1>
      </div>
      <div className="banner-imagen inicio-usuario__banner">
        <img
          src={gymBanner}
          alt="Gym"
          className="inicio-usuario__banner-img"
        />
        <div className="banner-text inicio-usuario__banner-text">
          El único mal entrenamiento es el que no hiciste.
        </div>
      </div>
      <h2>Tu Semana de un Vistazo</h2>
      <div className="semana-vistazo inicio-usuario__week-grid">
        <div className="inicio-usuario__card">
          <h3>Entrenamientos Completados</h3>
          <p className="inicio-usuario__metric-value">
            {entrenamientosCompletados}
          </p>
          <p>
            Esta Semana{" "}
            <span className="inicio-usuario__growth">
              +{entrenamientosCrecimiento}%
            </span>
          </p>
          <div className="chart-container inicio-usuario__chart-container">
            {diasSemana.map((dia, idx) => (
              <div key={dia} className="inicio-usuario__chart-day">
                <div
                  className={`chart-bar inicio-usuario__chart-bar ${getBarHeightClass(
                    entrenamientosSemana[idx]
                  )}`}
                />
                <div className="chart-label">{dia}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="inicio-usuario__card">
          <h3>Calorías Quemadas</h3>
          <p className="inicio-usuario__metric-value">
            {caloriasQuemadas}
          </p>
          <p>
            Esta Semana{" "}
            <span className="inicio-usuario__growth">+{caloriasCrecimiento}%</span>
          </p>
          <svg
            width="100%"
            height="80"
            viewBox="0 0 140 80"
            className="chart-line inicio-usuario__line-chart"
          >
            <polyline
              fill="none"
              stroke="#4caf50"
              strokeWidth="2"
              points={caloriasSemana
                .map((c, i) => `${i * 20 + 10},${80 - c / 40}`)
                .join(" ")}
            />
          </svg>
          <div className="chart-days inicio-usuario__chart-days">
            {diasSemana.map((dia) => (
              <div key={dia}>{dia}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default InicioUsuario;
