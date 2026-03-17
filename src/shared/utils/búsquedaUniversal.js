/**
 * Utilidad de búsqueda universal que ignora mayúsculas/minúsculas
 * y busca en todos los campos de los objetos
 */

// Función para normalizar texto (quitar acentos y convertir a minúsculas)
export const normalizeText = (str) => {
  if (!str) return '';
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

// Función para buscar estados específicos (coincidencia exacta)
export const isEstadoEspecifico = (termino) => {
  const estadosComunes = ['activo', 'inactivo', 'vigente', 'vencido', 'suspendido', 'pendiente', 'completado', 'cancelado'];
  const estadosNumericos = ['1', '2'];
  return estadosComunes.includes(termino.toLowerCase()) || estadosNumericos.includes(termino);
};

// Función principal de búsqueda universal
export const buscarUniversal = (items, terminoBusqueda, camposPersonalizados = []) => {
  if (!terminoBusqueda || !terminoBusqueda.trim()) {
    return items;
  }

  const terminoNormalizado = normalizeText(terminoBusqueda);

  return items.filter(item => {
    // Si es un estado específico, buscar coincidencia exacta en el campo estado
    if (isEstadoEspecifico(terminoBusqueda)) {
      // Buscar tanto en estado string como en id_estado numérico
      const estadoString = item.estado || item.id_estado;
      return normalizeText(String(estadoString)) === terminoNormalizado ||
             (item.id_estado && String(item.id_estado) === terminoBusqueda);
    }

    // Buscar en todos los campos del item
    const camposBusqueda = [
      // Campos estándar
      item.nombre,
      item.nombre_servicio, // Nuevo campo API
      item.codigo,
      item.descripcion,
      item.descripcion_servicio, // Nuevo campo API
      item.email,
      item.telefono,
      item.estado,
      item.id_estado, // Nuevo campo API
      item.fechaCreacion,
      item.fechaVencimiento,
      item.tipo,
      item.categoria,
      item.marca,
      item.rol,
      item.ultimoAcceso,
      item.fechaNacimiento,
      item.direccion,
      item.ciudad,
      item.pais,
      // Campos numéricos convertidos a string
      ...(item.precio ? [String(item.precio)] : []),
      ...(item.precio_servicio ? [String(item.precio_servicio)] : []), // Nuevo campo API
      ...(item.periodicidad ? [String(item.periodicidad)] : []), // Nuevo campo API
      ...(item.id ? [String(item.id)] : []),
      ...(item.cantidad ? [String(item.cantidad)] : []),
      ...(item.stock ? [String(item.stock)] : []),
      ...(item.total ? [String(item.total)] : []),
      ...(item.subtotal ? [String(item.subtotal)] : []),
      // Campos personalizados
      ...camposPersonalizados.map(campo => item[campo])
    ];

    // Buscar en arrays de objetos (como productos)
    const buscarEnArrays = (obj, termino) => {
      if (!obj || typeof obj !== 'object') return false;

      // Buscar en el objeto actual
      if (normalizeText(JSON.stringify(obj)).includes(termino)) {
        return true;
      }

      // Buscar recursivamente en arrays y objetos
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (buscarEnArrays(item, termino)) {
              return true;
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          if (buscarEnArrays(value, termino)) {
            return true;
          }
        }
      }

      return false;
    };

    // Buscar el término en cualquier campo
    const textoMatch = camposBusqueda.some(campo => {
      if (!campo) return false;
      const campoNormalizado = normalizeText(campo);
      return campoNormalizado.includes(terminoNormalizado);
    });

    // Buscar en objetos y arrays complejos
    const objetoMatch = buscarEnArrays(item, terminoNormalizado);

    return textoMatch || objetoMatch;
  });
};

// Función para filtrar datos con búsqueda universal
export const useBusquedaUniversal = (datos, terminoBusqueda, camposExtra = []) => {
  return buscarUniversal(datos, terminoBusqueda, camposExtra);
};
