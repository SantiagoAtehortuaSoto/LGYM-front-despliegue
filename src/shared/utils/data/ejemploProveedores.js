

// Datos de ejemplo para proveedores
export const proveedoresData = [
    {
        id: 1,
        nit: "900123456",
        nombre: "Proveedor Uno",
        email: "proveedor1@ejemplo.com",
        direccion: "Cra 10 #20-30",
        estado: "Activo",
    },
    {
        id: 2,
        nit: "901234567",
        nombre: "Suministros XYZ",
        email: "contacto@xyz.com",
        direccion: "Av. 68 #45-60",
        estado: "Activo",
    },
    {
        id: 3,
        nit: "902345678",
        nombre: "Importaciones ACME",
        email: "ventas@acme.com",
        direccion: "Calle 50 #12-45",
        estado: "Inactivo",
    },
    {
        id: 4,
        nit: "903456789",
        nombre: "Global Tech Supplies",
        email: "laura@globaltech.com",
        direccion: "Carrera 7 #80-20",
        estado: "Activo",
    },
    {
        id: 5,
        nit: "904567890",
        nombre: "Distribuciones del Norte",
        email: "pedro@distrinorte.com",
        direccion: "Calle 100 #25-30",
        estado: "Activo",
    },
];

// Columnas para la tabla de proveedores
export const columnasProveedores = [
    { field: "id_proveedor", label: "ID" },
    { field: "nit_proveedor", label: "NIT" },
    { field: "nombre_proveedor", label: "Nombre" },
    { field: "telefono_proveedor", label: "Teléfono" },
    { field: "direccion_proveedor", label: "Dirección" },
    { field: "ciudad_proveedor", label: "Ciudad" },
    { field: "estado", label: "Estado", render: (row) => row.id_estado === 1 ? "Activo" : "Inactivo" },
];

// Función para obtener datos de ejemplo con paginación
export const obtenerDatosPaginados = (datos, pagina = 1, porPagina = 5) => {
    const inicio = (pagina - 1) * porPagina;
    const fin = inicio + porPagina;
    return {
        datos: datos.slice(inicio, fin),
        total: datos.length,
        paginas: Math.ceil(datos.length / porPagina),
        paginaActual: pagina,
    };
};
