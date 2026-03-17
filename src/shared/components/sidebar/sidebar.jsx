import { useState } from "react";
import Logo from "../../../assets/Logo_linea_negra.png";
import ExpandableButtons from "../expandleButtons/expandlebuttons";
import { ChartPie } from "lucide-react";
import {
  comprasLinksAd,
  ServiciosLInksAd,
  ventasLinksAd,
  configLinksAd,
} from "../../utils/data/links";
import { NavLink } from "react-router-dom";

function Sidebar({ isOpen = true }) {
  const [openSection, setOpenSection] = useState(null);

  const handleSectionToggle = (sectionName, nextExpanded) => {
    setOpenSection((current) => {
      if (nextExpanded) return sectionName;
      return current === sectionName ? null : current;
    });
  };

  return (
    <div className={`sidebar-ad ${isOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-top">
        <a className="logo" href="/">
          <img className="logo" src={Logo} alt="LGYM Logo" />
        </a>
        <NavLink
          className={({ isActive }) =>
            `dash-button poppins-regular${isActive ? " is-active" : ""}`
          }
          to="/admin/dashboard"
        >
          <ChartPie size={25} />
          {isOpen && <span>DASHBOARD</span>}
        </NavLink>
      </div>
      <div className="sidebar-content">
        <ExpandableButtons
          isSidebarOpen={isOpen}
          nombreBoton={"Compras"}
          links={comprasLinksAd}
          isExpanded={openSection === "Compras"}
          onToggle={(nextExpanded) => handleSectionToggle("Compras", nextExpanded)}
        />
        <ExpandableButtons
          isSidebarOpen={isOpen}
          nombreBoton={"Servicios"}
          links={ServiciosLInksAd}
          isExpanded={openSection === "Servicios"}
          onToggle={(nextExpanded) => handleSectionToggle("Servicios", nextExpanded)}
        />
        <ExpandableButtons
          isSidebarOpen={isOpen}
          nombreBoton={"Ventas"}
          links={ventasLinksAd}
          isExpanded={openSection === "Ventas"}
          onToggle={(nextExpanded) => handleSectionToggle("Ventas", nextExpanded)}
        />
        <ExpandableButtons
          isSidebarOpen={isOpen}
          nombreBoton={"Configuracion"}
          links={configLinksAd}
          isExpanded={openSection === "Configuracion"}
          onToggle={(nextExpanded) => handleSectionToggle("Configuracion", nextExpanded)}
        />
      </div>
    </div>
  );
}

export default Sidebar;
