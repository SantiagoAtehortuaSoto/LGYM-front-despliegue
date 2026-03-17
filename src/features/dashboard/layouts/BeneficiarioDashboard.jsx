import { useState, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { IconShoppingCart } from "@tabler/icons-react";
import SidebarUsuario from "../../../shared/components/sidebar/sidebarUsuarios";
import HeaderUsuario from "../../../shared/components/header/header-us";
import CarritoCompras from "../../../shared/components/Carrito/carrito";
import { useCarrito } from "../../../shared/components/Carrito/carritoContext";
const MOBILE_BREAKPOINT = 992;

const BeneficiarioDashboard = () => {
  // Mobile initially closed, Desktop initially open
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [fabBumpKey, setFabBumpKey] = useState(0);
  const fabRef = useRef(null);
  const location = useLocation();
  const carritoCtx = useCarrito?.() ?? {};
  const cantidadTotal = Number(carritoCtx?.cantidadTotal || 0);
  const ocultarCarritoGlobal = location.pathname.toLowerCase().includes("/servicios");

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
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobile, sidebarOpen]);

  useEffect(() => {
    setFabBumpKey((k) => k + 1);
  }, [cantidadTotal]);

  useEffect(() => {
    setCarritoAbierto(false);
  }, [location.pathname]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className={`main-ad ${isMobile ? "main-ad--mobile" : "main-ad--desktop"}`}>
      <div
        className={`sidebar-container ${sidebarOpen ? "open" : "closed"}`}
        aria-hidden={isMobile && !sidebarOpen}
      >
        <SidebarUsuario isOpen={sidebarOpen} />
      </div>

      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay active" 
          onClick={closeSidebar}
        />
      )}

      <div className={`main-ad-column ${!sidebarOpen ? 'expanded' : ''}`}>
        <header className="header-usuario-logiado">
          <HeaderUsuario onMenuClick={toggleSidebar} isSidebarOpen={sidebarOpen} />
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {!ocultarCarritoGlobal && (
        <>
          {carritoAbierto && (
            <>
              <div
                className="carrito-overlay carrito-overlay--beneficiario"
                onClick={() => setCarritoAbierto(false)}
                role="presentation"
              />
              <aside
                className="carrito-sidebar carrito-sidebar--beneficiario"
              >
                <CarritoCompras onClose={() => setCarritoAbierto(false)} />
              </aside>
            </>
          )}

          <button
            key={fabBumpKey}
            ref={fabRef}
            type="button"
            className="cart-fab cart-fab--bump cart-fab--beneficiario"
            aria-label={`Abrir carrito. ${cantidadTotal} articulo(s)`}
            onClick={() => setCarritoAbierto((v) => !v)}
          >
            <IconShoppingCart size={24} />
            {cantidadTotal > 0 && (
              <span className="cart-fab__badge cart-fab__badge--beneficiario">
                {cantidadTotal}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default BeneficiarioDashboard;
