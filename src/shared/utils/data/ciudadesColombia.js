// Lista de ciudades principales de Colombia
// Solo capitales departamentales y ciudades principales

export const ciudadesColombia = [
  "Bogota",
  "Medellin",
  "Cali",
  "Barranquilla",
  "Cartagena",
  "Cucuta",
  "Bucaramanga",
  "Pereira",
  "Manizales",
  "Armenia",
  "Ibague",
  "Neiva",
  "Villavicencio",
  "Pasto",
  "Popayan",
  "Santa Marta",
  "Valledupar",
  "Monteria",
  "Sincelejo",
  "Riohacha",
  "Tunja",
  "Yopal",
  "Florencia",
  "Mocoa",
  "Quibdo",
  "San Andres",
  "Leticia",
  "Mitu",
  "Inirida",
  "Puerto Carreno",
  "San Jose del Guaviare",
  "Arauca"
];

// Función para obtener opciones formateadas para el Select
export const getCiudadesOptions = () => {
  return ciudadesColombia.map(ciudad => ({
    value: ciudad,
    label: ciudad
  }));
};

// Función para buscar ciudades que contengan el término de búsqueda
export const buscarCiudades = (termino) => {
  if (!termino || !termino.trim()) {
    return [];
  }

  const terminoNormalizado = termino.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return ciudadesColombia.filter(ciudad => {
    const ciudadNormalizada = ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ciudadNormalizada.includes(terminoNormalizado);
  });
};
