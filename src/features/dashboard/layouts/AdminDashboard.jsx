import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../../../shared/components/sidebar/sidebar";
import HeaderAdmin from "../../../shared/components/header/header-ad";
const MOBILE_BREAKPOINT = 992;

const AdminDashboard = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.innerWidth >= MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      setSidebarOpen((current) => (mobile ? false : current));
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
    <div className={`main-ad ${isMobile ? "main-ad--mobile" : "main-ad--desktop"}`}>
      <div
        className={`sidebar-container ${sidebarOpen ? "open" : "closed"}`}
        aria-hidden={isMobile && !sidebarOpen}
      >
        <Sidebar isOpen={sidebarOpen} />
      </div>

      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay active" 
          onClick={closeSidebar}
        />
      )}

      <div className={`main-ad-column ${!sidebarOpen ? "expanded" : ""}`}>
        <HeaderAdmin onMenuClick={toggleSidebar} isSidebarOpen={sidebarOpen} />
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard;
