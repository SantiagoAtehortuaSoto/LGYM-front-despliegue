import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../../../shared/components/sidebar/sidebar";
import HeaderAdmin from "../../../shared/components/header/header-ad";
const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 992;
      setIsMobile(mobile);
      // En desktop, el sidebar inicia cerrado para mejor UX
      // En mobile, siempre inicia cerrado
      if (!mobile && !sidebarOpen) {
        // Mantener el estado actual en desktop
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

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
        <Sidebar isOpen={sidebarOpen} />
      </div>

      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay active" 
          onClick={closeSidebar}
        />
      )}

      <div
        className={
          sidebarOpen ? "main-ad-column-open" : "main-ad-column-closed"
        }
      >
        <HeaderAdmin onMenuClick={toggleSidebar} isSidebarOpen={sidebarOpen} />
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard;
