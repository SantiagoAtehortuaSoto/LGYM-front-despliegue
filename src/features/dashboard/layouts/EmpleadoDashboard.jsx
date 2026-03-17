import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import SidebarEmpleados from "../../../shared/components/sidebar/sidebarEmpleados";
import HeaderAdmin from "../../../shared/components/header/header-ad";
const EmpleadoDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 992);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Controlar el scroll del body cuando el sidebar está abierto en mobile
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobile, sidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="main-ad">
      <div 
        className={`sidebar-container ${sidebarOpen ? "open" : "closed"}`}
      >
        <SidebarEmpleados isOpen={sidebarOpen} />
      </div>

      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay active" 
          onClick={closeSidebar}
        />
      )}

      <div className="main-ad-column">
        <HeaderAdmin onMenuClick={toggleSidebar} isSidebarOpen={sidebarOpen} />
        <Outlet />
      </div>
    </div>
  );
};

export default EmpleadoDashboard;
