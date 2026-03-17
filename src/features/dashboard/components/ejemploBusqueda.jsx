/**
 * EJEMPLO DE USO: BuscadorUniversal con búsqueda que ignora mayúsculas/minúsculas
 *
 * ✅ Características:
 * - Ignora completamente mayúsculas y minúsculas
 * - Busca en TODOS los campos de la tabla
 * - Filtra por estados específicos escribiendo el nombre exacto
 * - Maneja acentos y caracteres especiales
 * - Búsqueda en tiempo real
 */

import React, { useState } from 'react';
import BuscadorUniversal from '../../../components/BuscadorUniversal';
import { buscarUniversal } from '../../../../../shared/utils/búsquedaUniversal';
import DataTable from '../../../components/dataTables/dataTable';

const PaginaEjemplo = () => {
  const [datos, setDatos] = useState([
    {
      id: 1,
      nombre: 'Juan Pérez',
      email: 'juan@email.com',
      estado: 'Activo',
      telefono: '555-0123',
      fechaCreacion: '2024-01-15'
    },
    {
      id: 2,
      nombre: 'María García',
      email: 'maria@email.com',
      estado: 'Inactivo',
      telefono: '555-0456',
      fechaCreacion: '2024-01-16'
    }
  ]);

  const [terminoBusqueda, setTerminoBusqueda] = useState('');

  // Usar la utilidad de búsqueda universal
  const datosFiltrados = buscarUniversal(datos, terminoBusqueda);
  const refrescarTabla = async () => {
    setDatos((prev) => [...prev]);
  };

  return (
    <div>
      {/* Campo de búsqueda universal */}
      <BuscadorUniversal
        value={terminoBusqueda}
        onChange={setTerminoBusqueda}
        placeholder="Buscar en toda la tabla (escribe 'Activo' para filtrar por estado)..."
        className="expandido"
      />

      {/* Tabla con datos filtrados */}
      <DataTable
        data={datosFiltrados}
        onRefresh={refrescarTabla}
        columns={[
          { field: 'nombre', header: 'Nombre' },
          { field: 'email', header: 'Email' },
          { field: 'estado', header: 'Estado' },
          { field: 'telefono', header: 'Teléfono' }
        ]}
      />
    </div>
  );
};

export default PaginaEjemplo;
