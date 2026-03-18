import { useCallback, useEffect, useMemo, useState } from "react";
import { IconShoppingCart } from "@tabler/icons-react";
import { Download } from "lucide-react";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import { ModalVerPedido } from "./modalPedido";
import toast from "react-hot-toast";
import "../../../../../shared/styles/restructured/pages/pedidos-usuario-page.css";
import { obtenerPedidosUsuario } from "../../../hooks/Pedidos_US_API/Pedidos_API_US";
import { getCurrentUser } from "../../../hooks/Acceder_API/authService";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";

const resolverEstadoPedido = (estado = "") => {
  const normalized = estado.toString().trim().toLowerCase();
  if (normalized.includes("proceso")) return "En Proceso";
  if (normalized.includes("complet")) return "Completado";
  if (normalized.includes("cancel")) return "Cancelado";
  return "Pendiente";
};

const getEstadoToneClass = (estadoTexto) => {
  if (estadoTexto === "Completado") return "badge-tone--completado";
  if (estadoTexto === "Cancelado") return "badge-tone--cancelado";
  if (estadoTexto === "En Proceso") return "badge-tone--en-proceso";
  return "badge-tone--pendiente";
};

const parseCurrencyToNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  if (!text) return null;

  let sanitized = text.replace(/[^\d.,-]/g, "");

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(sanitized)) {
    sanitized = sanitized.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(sanitized)) {
    sanitized = sanitized.replace(/,/g, "");
  } else {
    sanitized = sanitized.replace(",", ".");
  }

  const result = Number(sanitized);
  return Number.isFinite(result) ? result : null;
};

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const toFechaTexto = (pedido) =>
  pedido.fechaCompra ?? pedido.fecha_pedido ?? pedido.fecha_entrega ?? "-";

const toPlazoTexto = (pedido) =>
  pedido.plazo_maximo ?? pedido.fecha_entrega ?? "-";

const columnasPedidos = [
  {
    field: "id",
    label: "ID",
    Cell: ({ value }) => value || "-",
  },
  {
    field: "fechaCompra",
    label: "Fecha de Compra",
    Cell: ({ value }) => value || "-",
  },
  {
    field: "producto",
    label: "Producto",
    Cell: ({ value }) => (
      <span
        className="pedidos-usuario-producto"
        title={value || "-"}
      >
        {value || "-"}
      </span>
    ),
  },
  {
    field: "cantidad",
    label: "Cantidad",
    Cell: ({ value }) => value || "-",
  },
  {
    field: "total",
    label: "Total",
    Cell: ({ value }) => value || "-",
  },
  {
    field: "estado",
    label: "Estado",
    Cell: ({ value }) => {
      const estadoTexto = resolverEstadoPedido(value);
      return (
        <span
          className={`badge-estado badge-pequeno badge-con-borde badge-estado--readonly ${getEstadoToneClass(
            estadoTexto
          )}`}
        >
          <span className="badge-content">{estadoTexto}</span>
        </span>
      );
    },
  },
];

const normalizarPedidoParaModal = (pedido) => {
  if (!pedido) return null;
  return {
    ...pedido,
    fecha_pedido: pedido.fecha_pedido ?? pedido.fechaCompra,
    fecha_entrega: pedido.fecha_entrega ?? pedido.fechaCompra,
    plazo_maximo: pedido.plazo_maximo ?? pedido.fecha_entrega ?? pedido.fechaCompra,
    precio_total:
      pedido.totalNumber ??
      pedido.precio_total ??
      pedido.precioTotal ??
      pedido.total,
    precioTotal:
      pedido.totalNumber ??
      pedido.precio_total ??
      pedido.precioTotal ??
      pedido.total,
    nombre_proveedor: pedido.nombre_proveedor || "Proveedor no disponible",
  };
};

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;

  const raw = String(value).trim();
  if (!raw) return 0;

  const clean = raw.replace(/[^\d,.-]/g, "");
  if (!clean) return 0;

  const hasComma = clean.includes(",");
  const hasDot = clean.includes(".");

  let normalized = clean;
  if (hasComma && hasDot) {
    normalized =
      clean.lastIndexOf(",") > clean.lastIndexOf(".")
        ? clean.replace(/\./g, "").replace(/,/g, ".")
        : clean.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    normalized = clean.replace(/,/g, ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const normalizarItemsParaComprobante = (pedido = {}) => {
  const baseDetalles = Array.isArray(pedido.detalles_pedidos)
    ? pedido.detalles_pedidos
    : Array.isArray(pedido.detalles)
    ? pedido.detalles
    : Array.isArray(pedido.items)
    ? pedido.items
    : [];

  const items = baseDetalles
    .map((detalle, idx) => {
      const cantidad = Math.max(
        1,
        toNumber(detalle?.cantidad ?? detalle?.cantidad_total ?? 1)
      );
      const subtotalDetalle = toNumber(
        detalle?.subtotal ?? detalle?.total ?? detalle?.total_producto
      );
      const precioDirecto = toNumber(
        detalle?.precio ??
          detalle?.precio_unitario ??
          detalle?.costo_unitario ??
          detalle?.valor_unitario ??
          detalle?.valor
      );
      const precio =
        precioDirecto > 0
          ? precioDirecto
          : subtotalDetalle > 0
          ? subtotalDetalle / cantidad
          : 0;

      const nombre =
        detalle?.nombre_producto ??
        detalle?.nombre_membresia ??
        detalle?.nombre ??
        detalle?.id_productos_producto?.nombre_producto ??
        detalle?.id_productos_producto?.nombre ??
        detalle?.producto?.nombre_producto ??
        detalle?.producto?.nombre ??
        `Producto ${idx + 1}`;

      return {
        nombre,
        cantidad,
        precio,
      };
    })
    .filter((item) => item.cantidad > 0 && item.nombre);

  if (items.length > 0) return items;

  const cantidad = Math.max(1, toNumber(pedido?.cantidad ?? 1));
  const totalPedido = toNumber(
    pedido?.totalNumber ??
      pedido?.total ??
      pedido?.precio_total ??
      pedido?.precioTotal
  );
  const precioFallback = totalPedido > 0 ? totalPedido / cantidad : 0;

  return [
    {
      nombre: pedido?.producto || "Producto",
      cantidad,
      precio: precioFallback,
    },
  ];
};

const PedidosUsuario = () => {
  const [pedidos, setPedidos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const searchQuery = searchTerm.trim();

  const cargarPedidos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = getCurrentUser();
      const idUsuario =
        user?.id_usuario ??
        user?.id ??
        user?.userId ??
        user?.idUser ??
        user?.usuario_id ??
        null;

      if (!idUsuario) {
        setPedidos([]);
        setError("No pudimos identificar tu usuario.");
        toast.warn(
          "No pudimos identificar tu usuario para cargar los pedidos."
        );
        return;
      }

      const pedidosApi = await obtenerPedidosUsuario(idUsuario, {
        query: {
          page: pagination.page,
          limit: pagination.limit,
          ...(searchQuery ? { search: searchQuery } : {}),
        },
      });
      const {
        items,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(pedidosApi, {
        preferredKeys: ["pedidos", "ventas", "data"],
        defaultPage: pagination.page,
        defaultLimit: pagination.limit,
      });
      setPedidos(Array.isArray(items) ? items : []);
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (err) {
      console.error("Error cargando pedidos de usuario:", err);
      const msg =
        err?.message || "No se pudieron cargar tus pedidos en este momento.";
      setError(msg);
      setPedidos([]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page, searchQuery]);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery]);

  const abrirModal = (accion, pedido = null) => {
    setPedidoSeleccionado(pedido);
    if (accion === "ver") setModalOpen(true);
  };

  const cerrarModal = () => {
    setPedidoSeleccionado(null);
    setModalOpen(false);
  };

  const filteredPedidos = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) return pedidos;

    return pedidos.filter((pedido) => {
      const pedidoNormalizado = normalizarPedidoParaModal(pedido);
      const estado = resolverEstadoPedido(pedidoNormalizado.estado);
      const fields = [
        pedidoNormalizado.id,
        pedidoNormalizado.numero_pedido,
        toFechaTexto(pedidoNormalizado),
        toPlazoTexto(pedidoNormalizado),
        pedidoNormalizado.producto,
        pedidoNormalizado.cantidad,
        pedidoNormalizado.total,
        estado,
      ];

      return fields.some((field) => normalizeText(field).includes(query));
    });
  }, [pedidos, searchQuery]);

  const descargarPedido = useCallback(async (pedido) => {
    if (!pedido) {
      toast.warn("No hay información del pedido para descargar.");
      return;
    }

    const pedidoNormalizado = normalizarPedidoParaModal(pedido);

    try {
      const numero = pedidoNormalizado.numero_pedido || pedidoNormalizado.id || "pedido";
      const items = normalizarItemsParaComprobante(pedidoNormalizado);
      const subtotal = items.reduce(
        (acc, item) => acc + Number(item?.precio || 0) * Number(item?.cantidad || 0),
        0
      );
      const total =
        parseCurrencyToNumber(pedidoNormalizado.totalNumber) ??
        parseCurrencyToNumber(pedidoNormalizado.precio_total) ??
        parseCurrencyToNumber(pedidoNormalizado.precioTotal) ??
        parseCurrencyToNumber(pedidoNormalizado.total) ??
        subtotal;

      const [{ pdf }, { default: ComprobanteDocumento }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("../../../../../shared/components/Carrito/comprobanteDocumento"),
      ]);

      const blob = await pdf(
        <ComprobanteDocumento
          items={items}
          subtotal={subtotal}
          total={Number(total || 0)}
          plazoMaximo={pedidoNormalizado.plazo_maximo || pedidoNormalizado.fecha_entrega}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `orden_${numero}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Orden descargada correctamente.");
    } catch (error) {
      console.error("Error al generar la orden del pedido:", error);
      toast.error("No se pudo descargar la orden del pedido.");
    }
  }, []);

  const columnasTabla = useMemo(
    () => [
      ...columnasPedidos,
      {
        field: "reporte",
        label: "Reporte",
        Cell: ({ row }) => (
          <button
            type="button"
            className="boton-acción boton-ver"
            onClick={(e) => {
              e.stopPropagation();
              descargarPedido(row);
            }}
            title="Descargar orden del pedido"
          >
            <Download size={16} />
          </button>
        ),
      },
    ],
    [descargarPedido],
  );

  return (
    <div className="main-ad-pedido">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <IconShoppingCart size={40} className="icono-titulo" color="red" />
          <h1>Mis Pedidos</h1>
        </div>

        <div className="acciones-derecha">
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar pedido..."
          />
        </div>
      </div>

      {loading && (
        <p className="pedidos-usuario-msg">
          Cargando tus pedidos...
        </p>
      )}
      {!loading && error && (
        <p className="pedidos-usuario-msg pedidos-usuario-msg--error">
          {error}
        </p>
      )}

      <DataTable
        columns={columnasTabla}
        data={filteredPedidos}
        loading={loading}
        onRefresh={cargarPedidos}
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
        minWidth={1120}
        actions={true}
        onView={(row) => abrirModal("ver", row)}
        onEdit={null}
        onDelete={null}
        emptyTitle="No se encontraron pedidos"
        emptyMessage="No hay pedidos disponibles para mostrar en la página actual."
      />

      <ModalVerPedido
        isOpen={modalOpen}
        pedido={normalizarPedidoParaModal(pedidoSeleccionado)}
        onClose={cerrarModal}
        estadosDisponibles={[
          { id_estado: 3, nombre_estado: "Pendiente" },
          { id_estado: 4, nombre_estado: "En Proceso" },
          { id_estado: 5, nombre_estado: "Completado" },
          { id_estado: 6, nombre_estado: "Cancelado" },
        ]}
      />
    </div>
  );
};

export default PedidosUsuario;
