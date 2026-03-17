import { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [servicios, setServicios] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Inicialmente cerrado

  // Función para cargar los servicios
  const cargarServicios = () => {
    // Aquí iría la lógica para cargar los servicios
    // Por ahora usamos los datos de ejemplo
    const serviciosIniciales = [
      // ... tus datos de servicios iniciales ...
    ];
    setServicios(serviciosIniciales);
  };

  return (
    <AppContext.Provider 
      value={{
        servicios,
        setServicios,
        cargarServicios,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext debe usarse dentro de un AppProvider');
  }
  return context;
};
