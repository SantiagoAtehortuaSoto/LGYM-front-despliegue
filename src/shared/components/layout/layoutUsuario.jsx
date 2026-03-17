import React from "react";
/* Importaciones de componentes */
import SidebarUsuario from "../sidebar/sidebarUsuarios";
import HeaderUsuario from "../header/header-us";
/* Importaciones de estilos */
const LayoutUsuario = ({ children }) => {
  return (
    <div className="layout-usuario">
      {/* Sidebar fijo */}
      <aside className="sidebar">
        <SidebarUsuario />
      </aside>

      {/* Sección derecha: header + contenido */}
      <div className="main-section">
        {/* Header pegado al sidebar */}
        <header className="header-usuario-logiado">
          <HeaderUsuario />
        </header>

        {/* Contenido principal */}
        <main className="content">{children}</main>
      </div>
    </div>
  );
};

export default LayoutUsuario;
