import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "./shared/context/AppContext";
import { Toaster } from "./shared/utils/toastAdapter";
import { useModalWheelBridge } from "./shared/hooks/useModalWheelBridge";
/**Importaciones de las páginas*/
import InicioLanding from "./features/dashboard/pages/Landing/inicioLanding";
import ProductosLanding from "./features/dashboard/pages/Landing/productosLanding";
import AccederLanding from "./features/dashboard/pages/Landing/accederLanding";
import VerificarCuenta from "./features/dashboard/pages/Landing/VerificarCuenta.jsx";
import Servicios from "./features/dashboard/pages/Landing/servicios";
import ContactosLanding from "./features/dashboard/pages/Landing/contactosLanding";
import VentasMembresias from "./features/dashboard/pages/admin/VentasMembresías/ventasMembresias";
import NotFound from "./features/dashboard/pages/404/NotFound.jsx";
import ScrollToTop from "./shared/components/ScrollToTop/ScrollToTop.jsx";

/*Importacion de configuración*/
import ConfiguracionUsuario from "./shared/components/Configuraciones/Configuraciones.jsx";

/* Layouts */
import {
  AdminDashboard,
  BeneficiarioDashboard,
  EmpleadoDashboard,
} from "./features/dashboard/layouts";

/* Importaciones temporales */
import Seguimiento from "./features/dashboard/pages/admin/seguimiento/Seguimiento";
import Proveedores from "./features/dashboard/pages/admin/proveedores/Proveedores";
import AsignarCita from "./features/dashboard/pages/admin/Citas/asignarCita.jsx";
import Roles from "./features/dashboard/pages/admin/Roles/Roles.jsx";
import Usuarios from "./features/dashboard/pages/admin/usuarios/usuarios";
import useAuth from "./features/dashboard/hooks/useAuth.jsx";

// NOTE: administrador
import Productos from "./features/dashboard/pages/admin/productos/Productos";
import Pedidos, { PedidosCompletados } from "./features/dashboard/pages/admin/pedidos/Pedidos";
import OlvidarContrasena from "./features/dashboard/pages/Landing/olvidarContraseña";
import DashboardAdmin from "./features/dashboard/pages/admin/Dashboard/dashboard-ad";
import ServiciosAdmin from "./features/dashboard/pages/admin/servicios/servicios";
import ProgramarCita from "./features/dashboard/pages/admin/Programar - Citas/programarCitas";
import MembresiasAdmin from "./features/dashboard/pages/admin/Membresias/Membresias.jsx";
import Empleados from "./features/dashboard/pages/admin/Empleados/empleados.jsx";
import Clientes from "./features/dashboard/pages/admin/Clientes/clientes.jsx";
import Ventas, { VentasCompletadas } from "./features/dashboard/pages/admin/Ventas/ventas.jsx";
import Asistencias from "./features/dashboard/pages/admin/Asistencias/Asistencias.jsx";

// NOTE: Cliente
import SeguimientoUsuario from "./features/dashboard/pages/beneficiario/seguimientoUsuario/seguimientoUsuario";
import AgendarCita from "./features/dashboard/pages/beneficiario/agendarCita/agendarCita";
import InicioUsuario from "./features/dashboard/pages/beneficiario/iniciousuario/inicioUsuario";
import PedidosUsuario from "./features/dashboard/pages/beneficiario/pedidos/pedidosUsuario";
import ServiciosUsuario from "./features/dashboard/pages/beneficiario/servicios/serviciosUsuario";
import DashboardUs from "./features/dashboard/pages/beneficiario/Dashboard/dashboard-us";

import { RequireAuth, RequireRole } from "./auth/guards";

function App() {
  // Bandera de sesión global desde tu hook
  const { isLoggedIn } = useAuth();
  useModalWheelBridge();

  return (
    <AppProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScrollToTop />
        <Toaster
          toastOptions={{ duration: 3500 }}
          containerStyle={{ zIndex: 12050 }}
          limit={3}
        />
        <Routes>
            {/* públicas */}
            <Route path="/" element={<InicioLanding />} />
            {/* Pasamos isLoggedIn para bloquear carrito en landing */}
            <Route
              path="/productos"
              element={<ProductosLanding isLoggedIn={isLoggedIn} />}
            />
            <Route
              path="/servicios"
              element={<Servicios isLoggedIn={isLoggedIn} />}
            />
            <Route path="/acceder" element={<AccederLanding />} />
            <Route path="/verificar-cuenta" element={<VerificarCuenta />} />
            <Route
              path="/olvidar-contrasena"
              element={<OlvidarContrasena />}
            />
            <Route path="/contactos" element={<ContactosLanding />} />

            {/* privadas (requiere sesión) */}
            <Route element={<RequireAuth />}>
              {/* ADMIN */}
              <Route element={<RequireRole allowed={["admin"]} />}>
                <Route path="/admin" element={<AdminDashboard />}>
                  <Route path="dashboard" element={<DashboardAdmin />} />
                  {/* Configuración */}
                  <Route
                    path="configuracion"
                    element={<ConfiguracionUsuario />}
                  />
                  <Route path="usuarios" element={<Usuarios />} />
                  <Route path="roles" element={<Roles />} />
                  {/* Compras */}
                  <Route path="productosAdmin" element={<Productos />} />
                  <Route path="proveedores" element={<Proveedores />} />
                  <Route path="pedidos" element={<Pedidos />} />
                  <Route
                    path="pedidos/completados"
                    element={<PedidosCompletados />}
                  />
                  {/* Servicios */}
                  <Route
                    path="membresiasAdmin"
                    element={<MembresiasAdmin />}
                  />
                  <Route path="serviciosAdmin" element={<ServiciosAdmin />} />
                  <Route path="seguimiento" element={<Seguimiento />} />
                  <Route path="programarCita" element={<ProgramarCita />} />
                  <Route path="empleados" element={<Empleados />} />
                  {/* Ventas */}
                  <Route path="ventas" element={<Ventas />} />
                  <Route
                    path="ventas/completadas"
                    element={<VentasCompletadas />}
                  />
                  <Route path="asistencias" element={<Asistencias />} />
                  <Route
                    path="ventasMembresias"
                    element={<VentasMembresias />}
                  />
                  <Route path="asignarCita" element={<AsignarCita />} />
                  <Route path="clientes" element={<Clientes />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
              {/* EMPLEADOS */}
              <Route element={<RequireRole allowed={["empleado"]} />}>
                <Route path="/empleados" element={<EmpleadoDashboard />}>
                  <Route
                    path="dashboardEmpleado"
                    element={<DashboardAdmin />}
                  />
                  {/* Configuración (alias legado) */}
                  <Route path="usuarios" element={<Usuarios />} />
                  <Route path="roles" element={<Roles />} />
                  {/* Compras */}
                  <Route path="productos" element={<Productos />} />
                  <Route path="productosAdmin" element={<Productos />} />
                  <Route path="proveedores" element={<Proveedores />} />
                  <Route path="compras" element={<Pedidos />} />
                  <Route
                    path="compras/completados"
                    element={<PedidosCompletados />}
                  />
                  <Route path="pedidos" element={<Pedidos />} />
                  <Route
                    path="pedidos/completados"
                    element={<PedidosCompletados />}
                  />
                  {/* Servicios */}
                  <Route path="servicios" element={<ServiciosAdmin />} />
                  <Route path="membresias" element={<MembresiasAdmin />} />
                  <Route
                    path="membresiasAdmin"
                    element={<MembresiasAdmin />}
                  />
                  <Route path="empleados" element={<Empleados />} />
                  <Route path="seguimiento" element={<Seguimiento />} />
                  <Route
                    path="seguimientoDeportivo"
                    element={<Seguimiento />}
                  />
                  <Route
                    path="programarEmpleados"
                    element={<ProgramarCita />}
                  />
                  <Route path="programarCita" element={<ProgramarCita />} />
                  {/* Ventas */}
                  <Route path="ventas" element={<Ventas />} />
                  <Route
                    path="ventas/completadas"
                    element={<VentasCompletadas />}
                  />
                  <Route path="asistencias" element={<Asistencias />} />
                  <Route
                    path="ventasMembresias"
                    element={<VentasMembresias />}
                  />
                  <Route path="asignarCita" element={<AsignarCita />} />
                  <Route path="asignarCitas" element={<AsignarCita />} />
                  <Route path="clientes" element={<Clientes />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>

              {/* CLIENTE / USUARIO */}
              <Route element={<RequireRole allowed={["usuario", "admin"]} />}>
                <Route path="/cliente" element={<BeneficiarioDashboard />}>
                  <Route
                    path="seguimientoUsuario"
                    element={<SeguimientoUsuario />}
                  />
                  <Route path="agendarCita" element={<AgendarCita />} />
                  <Route
                    path="configuracion"
                    element={<ConfiguracionUsuario />}
                  />
                  <Route path="inicio-usuario" element={<InicioUsuario />} />
                  <Route path="pedidosUsuario" element={<PedidosUsuario />} />
                  <Route
                    path="serviciosUsuario"
                    element={<ServiciosUsuario />}
                  />
                  <Route path="dashboard-usuario" element={<DashboardUs />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
