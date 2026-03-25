import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, Store } from "lucide-react";
import toast from "react-hot-toast";

import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import { obtenerVentas, normalizarEstado } from "../../../hooks/Ventas_API/Ventas";
import { obtenerUsuarios } from "../../../hooks/Usuarios_API/API_Usuarios";
import { ModalVerVenta } from "../Ventas/modalVentas";
import { getToken } from "../../../hooks/Acceder_API/authService";
import { SelectorEstado } from "../../../components/dataTables/badgesEstado";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import { exportRowsToWorkbook } from "../../../../../shared/utils/exportWorkbook";
import { formatCurrencyCOP } from "../../../../../shared/utils/currency";

const ESTADO_OPCIONES_UI = [
  { value: "Activo", label: "Activo", color: "#10b981", id_estado: 1 },
  { value: "Inactivo", label: "Inactivo", color: "#6b7280", id_estado: 2 },
  { value: "Pendiente", label: "Pendiente", color: "#f59e0b", id_estado: 3 },
  { value: "En proceso", label: "En proceso", color: "#3b82f6", id_estado: 4 },
  { value: "Completado", label: "Completado", color: "#10b981", id_estado: 5 },
  { value: "Cancelado", label: "Cancelado", color: "#ef4444", id_estado: 6 },
];

const normalizarTexto = (valor) =>
  valor
    ? String(valor)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
    : "";

const getEstadoVentaConfig = (valor) => {
  const normalizedValue = normalizarEstado(valor);
  return (
    ESTADO_OPCIONES_UI.find((opt) => opt.value === normalizedValue) ||
    ESTADO_OPCIONES_UI.find((opt) => opt.value === "Pendiente") ||
    ESTADO_OPCIONES_UI[0]
  );
};

const getEstadoToneClass = (idEstado) => {
  const numeric = Number(idEstado);
  if (numeric === 5) return "badge-tone--completado";
  if (numeric === 6) return "badge-tone--cancelado";
  if (numeric === 4) return "badge-tone--en-proceso";
  return "badge-tone--pendiente";
};

const formatearMoneda = (valor) =>
  formatCurrencyCOP(typeof valor === "number" ? valor : valor || 0);

const formatearFecha = (valor) => {
  const fecha = valor ? new Date(valor) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) return "Sin fecha";
  const opciones = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Bogota",
  };

  return fecha.toLocaleDateString("es-ES", opciones);
};

const calcularTotal = (detalles = []) =>
  detalles.reduce(
    (acc, det) =>
      acc +
      (Number(det?.cantidad) || 0) *
        (Number(det?.valorUnitario || det?.valor_unitario) || 0),
    0
  );

const mapDetalleFromApi = (detalle = {}) => {
  const tipo = (detalle.tipo_venta || "").toUpperCase();
  const cantidad =
    Number(detalle.cantidad ?? detalle.cantidad_total ?? detalle.qty ?? 1) || 0;
  const valorUnitario =
    Number(
      detalle.valor_unitario ?? detalle.valor_total_venta ?? detalle.precio ?? 0
    ) || 0;
  const subtotal = cantidad * valorUnitario;
  const recursoId =
    detalle.id_producto ?? detalle.id_membresia ?? detalle.id_servicio ?? null;

  return {
    tipo_venta: tipo,
    recursoId,
    cantidad,
    valor_unitario: valorUnitario,
    subtotal,
  };
};

const normalizarVentaBackend = (raw = {}, idx = 0, mapaUsuarios = {}) => {
  const detallesBackend = Array.isArray(raw.detalles_venta)
    ? raw.detalles_venta
    : Array.isArray(raw.detalle_venta)
    ? raw.detalle_venta
    : Array.isArray(raw.detalle)
    ? raw.detalle
    : Array.isArray(raw.detalles)
    ? raw.detalles
    : [];

  const detallesUI = detallesBackend.map(mapDetalleFromApi);
  const totalItems = detallesUI.reduce((acc, d) => acc + (d.cantidad || 0), 0);
  const tipos = Array.from(
    new Set(
      (detallesBackend.length ? detallesBackend : detallesUI)
        .map((d) => (d.tipo_venta || d.tipo || d.tipoVenta || "").toString())
        .filter(Boolean)
    )
  ).join(", ");

  const userId = raw.id_usuario ?? raw.id_de_usuario ?? raw.idUsuario;

  const usuario_nombre =
    raw.usuario?.nombre ||
    raw.usuario?.nombre_completo ||
    raw.usuario?.username ||
    raw.usuario?.nombre_usuario ||
    raw.usuario?.full_name ||
    raw.usuario_nombre ||
    raw.nombre_usuario ||
    raw.nombre_completo ||
    raw.nombre ||
    raw.cliente ||
    (userId !== undefined && userId !== null && mapaUsuarios[userId]
      ? mapaUsuarios[userId]
      : userId
      ? `Usuario ${userId}`
      : "Usuario N/D");

  const valor_total_venta =
    Number(
      raw.valor_total_venta ??
        raw.total ??
        raw.monto ??
        calcularTotal(detallesUI)
    ) || 0;

  return {
    id:
      raw.id_pedido_cliente ??
      raw.id ??
      raw.id_venta ??
      raw.idVentas ??
      raw.id_ventas ??
      raw.codigo ??
      idx + 1,
    id_usuario: userId,
    usuario_nombre,
    fecha_venta: raw.fecha_venta ?? raw.fecha ?? raw.createdAt ?? "",
    estado_venta: raw.estado_venta ?? raw.estado ?? raw.id_estado ?? "PENDIENTE",
    valor_total_venta,
    detalles: detallesUI,
    totalItems,
    tipos,
  };
};

const coincideBusqueda = (venta, termino) => {
  if (!termino) return true;
  const t = normalizarTexto(termino);
  return [
    venta.id,
    venta.id_usuario,
    venta.usuario_nombre,
    venta.estado_venta,
    venta.tipos,
    venta.valor_total_venta,
  ]
    .map(normalizarTexto)
    .some((campo) => campo.includes(t));
};

const esVentaMembresia = (venta) => {
  if (!venta) return false;
  const tipos = normalizarTexto(venta.tipos || "");
  const detalles = Array.isArray(venta.detalles) ? venta.detalles : [];
  const porTipo = tipos.includes("memb");
  const porDetalle = detalles.some((d) =>
    normalizarTexto(d.tipo_venta || d.tipo || d.tipoVenta || "").includes("memb")
  );
  return porTipo || porDetalle;
};

function VentasMembresias() {
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filteredVentas, setFilteredVentas] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const searchQuery = searchTerm.trim();

  const recargarVentas = useCallback(async () => {
    try {
      const token = getToken?.() || localStorage.getItem("token");
      const resVentas = await obtenerVentas({
        token,
        query: {
          page: pagination.page,
          limit: pagination.limit,
          tipo_venta: "MEMBRESIA",
          ...(searchQuery ? { search: searchQuery } : {}),
        },
      });
      const {
        items: listaVentas,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(resVentas, {
        preferredKeys: ["ventas", "data"],
        defaultPage: pagination.page,
        defaultLimit: pagination.limit,
      });

      const normalizadas = listaVentas.map((venta, idx) =>
        normalizarVentaBackend(venta, idx, usuariosMap)
      );

      const soloMembresias = normalizadas.filter(esVentaMembresia);

      setVentas(soloMembresias);
      setFilteredVentas(soloMembresias);
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
      return true;
    } catch (error) {
      toast.error("Error al recargar ventas");
      return false;
    }
  }, [pagination.limit, pagination.page, searchQuery, usuariosMap]);

  useEffect(() => {
    const cargarVentas = async () => {
      setLoading(true);
      try {
        const token = getToken?.() || localStorage.getItem("token");
        const [resVentas, resUsuarios] = await Promise.all([
          obtenerVentas({
            token,
            query: {
              page: pagination.page,
              limit: pagination.limit,
              tipo_venta: "MEMBRESIA",
              ...(searchQuery ? { search: searchQuery } : {}),
            },
          }),
          obtenerUsuarios().catch(() => null),
        ]);

        const {
          items: listaVentas,
          page: resolvedPage,
          limit: resolvedLimit,
          totalPages,
          totalItems,
        } = normalizePaginatedResponse(resVentas, {
          preferredKeys: ["ventas", "data"],
          defaultPage: pagination.page,
          defaultLimit: pagination.limit,
        });

        const listaUsuarios = Array.isArray(resUsuarios?.data)
          ? resUsuarios.data
          : Array.isArray(resUsuarios)
          ? resUsuarios
          : [];

        const mapaUsuarios = listaUsuarios.reduce((acc, u) => {
          const id =
            u.id ??
            u.id_usuario ??
            u.idUsuario ??
            u.idUser ??
            u.idUsuarios ??
            u.id_usuarios;
          if (id !== undefined && id !== null) {
            acc[id] =
              u.nombre ??
              u.nombre_completo ??
              u.username ??
              u.nombre_usuario ??
              u.full_name ??
              `Usuario ${id}`;
          }
          return acc;
        }, {});

        setUsuariosMap(mapaUsuarios);

        const normalizadas = listaVentas.map((venta, idx) =>
          normalizarVentaBackend(venta, idx, mapaUsuarios)
        );

        const soloMembresias = normalizadas.filter(esVentaMembresia);

        setVentas(soloMembresias);
        setFilteredVentas(soloMembresias);
        setPagination((prev) => ({
          ...prev,
          page: resolvedPage,
          limit: resolvedLimit,
          totalPages,
          totalItems,
        }));
      } catch (error) {
        setVentas([]);
        setFilteredVentas([]);
        toast.error("No se pudo cargar ventas del servidor.");
      } finally {
        setLoading(false);
      }
    };

    cargarVentas();
  }, [pagination.limit, pagination.page, searchQuery]);

  useEffect(() => {
    if (searchQuery) {
      setFilteredVentas(
        ventas.filter((venta) => coincideBusqueda(venta, searchQuery))
      );
      return;
    }
    setFilteredVentas([...ventas]);
  }, [searchQuery, ventas]);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery]);

  const ventasConAcciones = useMemo(() => [...filteredVentas], [filteredVentas]);

  const abrirModal = (accion, venta = null) => {
    setVentaSeleccionada(venta);
    setAccionModal(accion);
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setVentaSeleccionada(null);
  };

  const handleExport = async () => {
    const dataToExport = filteredVentas.map((venta) => {
      const config = getEstadoVentaConfig(venta.estado_venta);
      return {
        ID: venta.id,
        Usuario: venta.usuario_nombre,
        Cantidad: venta.totalItems,
        Fecha: formatearFecha(venta.fecha_venta),
        "Valor de venta": venta.valor_total_venta,
        Estado: config.label,
      };
    });

    if (!dataToExport.length) {
      toast.error("No hay ventas para exportar");
      return;
    }

    try {
      await exportRowsToWorkbook({
        rows: dataToExport,
        fileName: "ventas_membresias.xlsx",
        sheetName: "Ventas",
      });
      toast.success("Exportación lista");
    } catch (error) {
      console.error("Error exportando ventas de membresías:", error);
      toast.error("No se pudo exportar el archivo");
    }
  };

  const columnas = useMemo(
    () => [
      { label: "ID", field: "id" },
      { label: "Usuario", field: "usuario_nombre" },
      {
        label: "Cantidad",
        field: "totalItems",
      },
      {
        label: "Fecha",
        field: "fecha_venta",
        Cell: ({ value }) => <span>{formatearFecha(value)}</span>,
      },
      {
        label: "Valor de venta",
        field: "valor_total_venta",
        Cell: ({ value }) => <strong>{formatearMoneda(value)}</strong>,
      },
        {
          label: "Estado",
          field: "estado_venta",
          Cell: ({ value }) => {
            const config = getEstadoVentaConfig(value);
            return (
              <button
                className={`badge-estado badge-pequeno badge-con-borde badge-estado--readonly ${getEstadoToneClass(
                  config.id_estado
                )}`}
                disabled
              >
                <span className="badge-content">{value || "Sin estado"}</span>
              </button>
            );
          },
          accessor: (row) => normalizarEstado(row.estado_venta),
        },
    ],
    []
  );

  return (
    <div className="">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Store size={40} className="icono-titulo" color="red" />
          <h1 className="titulo-pagina">Ventas de Membresías</h1>
        </div>
        <div className="acciones-derecha">
          <button className="boton boton-secundario" onClick={handleExport}>
            <FileDown size={18} className="icono-boton" />
            Exportar
          </button>
          <BuscadorUniversal
            placeholder="Buscar ventas..."
            value={searchTerm}
            onChange={setSearchTerm}
            className="expandido"
          />
        </div>
      </div>

      <div className="table-container">
        <DataTable
          columns={columnas}
          data={ventasConAcciones}
          loading={loading}
          onRefresh={recargarVentas}
          paginationMode="server"
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          onPageChange={(page, limit) =>
            setPagination((prev) => ({
              ...prev,
              page,
              limit: Number(limit) || prev.limit,
            }))
          }
          onView={(venta) => {
            setVentaSeleccionada(venta);
            setAccionModal("ver");
          }}
          emptyTitle="No se encontraron ventas de membresías"
          emptyMessage="No hay ventas de membresías para mostrar en la página actual."
        />
      </div>

      {accionModal === "ver" && ventaSeleccionada && (
        <ModalVerVenta
          venta={ventaSeleccionada}
          onClose={cerrarModal}
          colorEstado={getEstadoVentaConfig(ventaSeleccionada.estado_venta).color}
        />
      )}
    </div>
  );
}

export default VentasMembresias;
