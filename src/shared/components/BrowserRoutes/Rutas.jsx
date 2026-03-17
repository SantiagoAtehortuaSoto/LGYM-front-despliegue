import { Routes, Route } from "react-router-dom";
const Rutas = () => {
  return (
    <Routes>
      <Route path="/" element={<InicioLanding />} />
      <Route path="/servicios" element={<Servicios />} />
      <Route path="/productos" element={<Productos />} />
      <Route path="/contacto" element={<Contacto />} />
      <Route path="/acceder" element={<Acceder />} />
    </Routes>
  );
};
export default Rutas;