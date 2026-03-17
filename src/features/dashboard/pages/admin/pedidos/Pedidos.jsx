import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ClipboardCheck, Zap } from "lucide-react";
import { toast } from 'react-hot-toast';
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import "../../../../../shared/styles/restructured/pages/pedidos-admin-page.css";
import {
  getPedidos,
  getPedidosFinalizadas,
  createPedido,
  guardarDetallesPedido,
  updatePedido,
  deletePedido,
  getDetallesPedidos,
  getPedidoById,
} from "../../../../../features/dashboard/hooks/Pedidos_Api/Api_pedidos";
import { getProveedores } from "../../../../../features/dashboard/hooks/Proveedores_API/API_proveedores";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import ModalFormularioPedido from "./modales-pedidos";
import { ModalEliminarPedido as DeleteModal, ModalVerPedido } from "./modales-pedidos";
import { SelectorEstado } from "../../../components/dataTables/badgesEstado";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import { enviarCorreoPedido } from "../../../../../features/dashboard/hooks/Email_API/emailService";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

// Definición de columnas para Pedidos
const ESTADOS_PEDIDOS = {
  3: "Pendiente",
  4: "En Proceso",
  5: "Completado",
  6: "Cancelado",
};

const ESTADOS_DISPONIBLES = [
  { id_estado: 3, nombre_estado: "Pendiente" },
  { id_estado: 4, nombre_estado: "En Proceso" },
  { id_estado: 5, nombre_estado: "Completado" },
  { id_estado: 6, nombre_estado: "Cancelado" },
];

// Orden visual solicitado:
// 1) Pendiente, 2) En proceso, 3) Cancelado, 4) Completado
const PRIORIDAD_ORDEN_ESTADO = {
  3: 1,
  4: 2,
  6: 3,
  5: 4,
};

const normalizarEstadoPedido = (valor) => {
  const n = parseInt(valor, 10);
  if ([3, 4, 5, 6].includes(n)) return n;

  const texto = String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (texto === "PENDIENTE") return 3;
  if (texto === "EN PROCESO" || texto === "EN_PROCESO") return 4;
  if (texto === "COMPLETADO") return 5;
  if (texto === "CANCELADO" || texto === "ANULADO") return 6;

  return 3;
};

// Config del badge para que coincida con Ventas (mismo estilo/colores/labels)
const getEstadoPedidoConfig = (idEstado) => {
  const estado = normalizarEstadoPedido(idEstado);
  const config = {
    3: { label: "Pendiente", color: "#f59e0b" },
    4: { label: "En proceso", color: "#3b82f6" },
    5: { label: "Completado", color: "#10b981" },
    6: { label: "Cancelado", color: "#ef4444" },
  }[estado] || { label: "Pendiente", color: "#f59e0b" };

  return { id_estado: estado, ...config };
};

const getEstadoToneClass = (idEstado) => {
  const estado = normalizarEstadoPedido(idEstado);
  if (estado === 5) return "badge-tone--completado";
  if (estado === 6) return "badge-tone--cancelado";
  if (estado === 4) return "badge-tone--en-proceso";
  return "badge-tone--pendiente";
};

const formatearPrecioCOP = (valor) => {
  if (valor === undefined || valor === null) return "-";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Number(valor));
};

const CAMPOS_TABLA_PEDIDOS = [
  {
    field: "id_pedido",
    label: "ID",
    Cell: ({ value }) => value ?? "-",
  },
  {
    field: "numero_pedido",
    label: "N° Pedido",
    Cell: ({ value }) => (
      <span className="pedidos-admin-numero">
        {value}
      </span>
    ),
  },
  { field: "nombre_proveedor", label: "Proveedor" },
  { field: "productoResumen", label: "Producto" },
  {
    field: "cantidad_total",
    label: "Cantidad",
    Cell: ({ value }) => (value ?? "-"),
  },
  // {
  //   field: "precio_total",
  //   label: "Precio Total",
  //   Cell: ({ value }) => formatearPrecioCOP(value),
  // },
];

const DETALLES_CACHE_KEY = "dashboard.detallesPedidosCache";

const normalizarClavePedido = (clave) => {
  if (clave === undefined || clave === null) return null;
  return String(clave);
};

const normalizarMapaClaves = (mapa) => {
  const resultado = new Map();
  if (mapa instanceof Map) {
    mapa.forEach((valor, clave) => {
      const claveNormalizada = normalizarClavePedido(clave);
      if (claveNormalizada) {
        resultado.set(claveNormalizada, valor);
      }
    });
  }
  return resultado;
};

const leerDetallesCache = () => {
  if (typeof window === "undefined") return new Map();
  try {
    const cache = localStorage.getItem(DETALLES_CACHE_KEY);
    if (!cache) return new Map();
    const parsed = JSON.parse(cache);
    if (!parsed || typeof parsed !== "object") return new Map();
    const entries = Object.entries(parsed).map(([clave, valor]) => [
      clave,
      Array.isArray(valor) ? valor : []
    ]);
    return new Map(entries);
  } catch (error) {
    console.warn("No se pudo leer el cache de detalles:", error);
    return new Map();
  }
};

const obtenerDetallesDesdeMapa = (mapa, id, numero) => {
  if (!(mapa instanceof Map)) return undefined;
  const claveId = normalizarClavePedido(id);
  if (claveId && mapa.has(claveId)) {
    return mapa.get(claveId);
  }
  const claveNumero = normalizarClavePedido(numero);
  if (claveNumero && mapa.has(claveNumero)) {
    return mapa.get(claveNumero);
  }
  return undefined;
};

const transformarDetallesGenericos = (coleccion = []) =>
  (Array.isArray(coleccion) ? coleccion : [])
    .map((detalle) => {
      const idProducto = parseInt(
        detalle.id_productos ??
        detalle.idProducto ??
        detalle.id ??
        detalle.id_products,
        10
      );
      const cantidad = parseFloat(
        detalle.cantidad ??
        detalle.cantidad_producto ??
        detalle.cantidad_detalle ??
        0
      ) || 0;
      const costoUnitario = parseFloat(
        detalle.costo_unitario ??
        detalle.costo_unitario_detalle ??
        detalle.costoUnitario ??
        detalle.costo ??
        detalle.precio ??
        0
      ) || 0;
      const nombre =
        detalle.nombre_producto ||
        detalle.nombre ||
        detalle.id_productos_producto?.nombre_producto ||
        detalle.id_productos_producto?.nombre ||
        detalle.producto?.nombre_producto ||
        detalle.producto?.nombre ||
        detalle.descripcion ||
        (idProducto ? `Producto ${idProducto}` : "");

      return {
        id_productos: idProducto,
        nombre_producto: nombre,
        cantidad,
        costo_unitario: costoUnitario,
        subtotal: cantidad * costoUnitario
      };
    })
    .filter((detalle) => Number.isFinite(detalle.id_productos));

const PedidosPage = ({ view = "gestion" }) => {
  const isCompletados = view === "completados";
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();
  const [pedidos, setPedidos] = useState([]);
  const [detallesPedidos, setDetallesPedidos] = useState(new Map());
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    id: null,
    nuevoEstado: null,
    nombrePedido: "",
    estadoActualId: null,
  });
  const [estadosDisponibles, setEstadosDisponibles] = useState([
    { id_estado: 3, nombre_estado: "Pendiente" },
    { id_estado: 4, nombre_estado: "En Proceso" },
    { id_estado: 5, nombre_estado: "Completado" },
    { id_estado: 6, nombre_estado: "Cancelado" },
  ]);
  const [refreshKey, setRefreshKey] = useState(0);
  const detallesLocalesRef = useRef(leerDetallesCache());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,  
    totalPages: 1,
    totalItems: 0,
  });
  useEffect(() => {
    if (detallesLocalesRef.current.size > 0) {
      setDetallesPedidos(new Map(detallesLocalesRef.current));
    }
  }, []);

  // Función para manejar el cambio de estado desde el DataTable
  const handleStatusChange = useCallback(async (pedidoActualizado, nuevoEstadoTexto) => {
    const pedidoId = pedidoActualizado.id_pedido || pedidoActualizado.id;
    if (!pedidoId) {
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      return;
    }

    // Solo manejar estados de compras (3-6), ignorar ACTIVO/INACTIVO
    const textoAId = {
      "PENDIENTE": 3,
      "EN PROCESO": 4,
      "COMPLETADO": 5,
      "CANCELADO": 6
    };

    const nuevoEstadoId = textoAId[nuevoEstadoTexto?.toUpperCase()];
    if (!nuevoEstadoId) {
      // No mostrar error si es un estado no válido para pedidos (como ACTIVO/INACTIVO)
      return;
    }

    const estadoActual = pedidoActualizado.id_estado || 3;

    if (normalizarEstadoPedido(estadoActual) === 6) {
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      return;
    }

    if (estadoActual === nuevoEstadoId) return;

    // Mostrar modal de confirmación
    const nombresEstados = {
      3: "Pendiente",
      4: "En Proceso",
      5: "Completado",
      6: "Cancelado"
    };

    setEstadoPendiente({
      mostrar: true,
      id: pedidoId,
      nuevoEstado: nuevoEstadoId,
      nombrePedido: pedidoActualizado.numero_pedido || `Pedido ${pedidoId}`,
      estadoActualId: normalizarEstadoPedido(estadoActual),
      estadoActual: nombresEstados[estadoActual] || "Pendiente",
      nuevoEstadoTexto: nombresEstados[nuevoEstadoId] || "Pendiente"
    });
  }, []);

  // Definir la función de cambio de estado antes de usarla en useMemo
  const manejarCambioEstado = useCallback((pedido, estadoSeleccionado = null) => {
    if (!pedido) return;

    const pedidoId = pedido.id_pedido || pedido.id;
    if (!pedidoId) {
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      return;
    }

    const estadoActual = normalizarEstadoPedido(pedido.id_estado ?? 3);
    const nuevoEstado = normalizarEstadoPedido(estadoSeleccionado ?? estadoActual);

    if (estadoActual === 6) {
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      return;
    }

    if (estadoActual === nuevoEstado) return;

    const nombresEstados = {
      3: "Pendiente",
      4: "En Proceso",
      5: "Completado",
      6: "Cancelado"
    };

    setEstadoPendiente({
      mostrar: true,
      id: pedidoId,
      nuevoEstado,
      nombrePedido: pedido.numero_pedido || `Pedido ${pedidoId}`,
      estadoActualId: estadoActual,
      estadoActual: nombresEstados[estadoActual] || "Pendiente",
      nuevoEstadoTexto: nombresEstados[nuevoEstado] || "Pendiente"
    });
  }, []);

  const normalizeText = (str) =>
    String(str ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const guardarDetallesCache = useCallback((mapa) => {
    if (typeof window === "undefined") return;
    try {
      const plain = {};
      mapa.forEach((detalles, clave) => {
        plain[clave] = detalles;
      });
      localStorage.setItem(DETALLES_CACHE_KEY, JSON.stringify(plain));
    } catch (error) {
      console.warn("No se pudo guardar el cache de detalles:", error);
    }
  }, []);

  const sincronizarDetallesLocales = useCallback(
    (numeroPedido, idPedido, detallesEntrada = []) => {
      const claves = [numeroPedido, idPedido]
        .map(normalizarClavePedido)
        .filter(Boolean);
      const normalizados = transformarDetallesGenericos(detallesEntrada);

      if (claves.length === 0 || normalizados.length === 0) {
        return;
      }

      const mapaActualizado = new Map(detallesLocalesRef.current);
      claves.forEach((clave) => mapaActualizado.set(clave, normalizados));
      detallesLocalesRef.current = mapaActualizado;

      setDetallesPedidos((prev) => {
        const mapaPrevio = prev instanceof Map ? new Map(prev) : new Map();
        claves.forEach((clave) => mapaPrevio.set(clave, normalizados));
        return mapaPrevio;
      });
      guardarDetallesCache(mapaActualizado);
    },
    [guardarDetallesCache]
  );

  const cargarPedidos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [pedidosDataRaw, detallesMapa] = await Promise.all([
        isCompletados
          ? getPedidosFinalizadas({
              query: { page: pagination.page, limit: pagination.limit },
            })
          : getPedidos({
              query: { page: pagination.page, limit: pagination.limit },
            }),
        getDetallesPedidos()
      ]);
      const {
        items: pedidosData,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(pedidosDataRaw, {
        preferredKeys: ["pedidos", "compras", "data"],
        defaultPage: pagination.page,
        defaultLimit: pagination.limit,
      });
      const pedidosDataFiltrados = isCompletados
        ? pedidosData.filter((pedido) => {
            const estado = normalizarEstadoPedido(pedido?.id_estado ?? 3);
            return estado === 5 || estado === 6;
          })
        : pedidosData.filter((pedido) => {
            const estado = normalizarEstadoPedido(pedido?.id_estado ?? 3);
            // En gestión no deben mostrarse pedidos completados.
            return estado !== 5;
          });
      const pedidosArray = pedidosDataFiltrados.map((pedido) => {
        const idEstado = normalizarEstadoPedido(pedido.id_estado);
        return {
          ...pedido,
          id_estado: idEstado,
          estado_pedido: idEstado,
          estado_texto: ESTADOS_PEDIDOS[idEstado] || "Pendiente",
        };
      });

      const fallbackMapa = new Map();
      pedidosArray.forEach((pedido) => {
        const detallesBase = pedido.detalles_pedidos || [];
        const claveId = normalizarClavePedido(pedido.id_pedido);
        const claveNumero = normalizarClavePedido(pedido.numero_pedido);
        if (claveId) {
          fallbackMapa.set(claveId, detallesBase);
        }
        if (claveNumero) {
          fallbackMapa.set(claveNumero, detallesBase);
        }
      });

      let mapaFinal = fallbackMapa;
      if (detallesMapa instanceof Map && detallesMapa.size > 0) {
        const normalizado = normalizarMapaClaves(detallesMapa);
        mapaFinal = new Map([...fallbackMapa, ...normalizado]);
      }

      if (detallesLocalesRef.current.size > 0) {
        mapaFinal = new Map(mapaFinal);
        detallesLocalesRef.current.forEach((detalles, clave) => {
          mapaFinal.set(clave, detalles);
        });
      }

      const mapaFinalNormalizado = normalizarMapaClaves(mapaFinal);
      setPedidos(pedidosArray);
      setDetallesPedidos(mapaFinalNormalizado);
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (err) {
      console.error("Error al cargar pedidos:", err);
      setError("Error al cargar los pedidos. Intente nuevamente.");
      setPedidos([]);
      setDetallesPedidos(new Map());
    } finally {
      setLoading(false);
    }
  }, [isCompletados, pagination.limit, pagination.page]);

  const limpiarDetallesLocales = useCallback(
    (claves = []) => {
      const clavesValidas = (Array.isArray(claves) ? claves : [])
        .map(normalizarClavePedido)
        .filter(Boolean);
      if (clavesValidas.length === 0) return;

      const mapa = new Map(detallesLocalesRef.current);
      let huboCambios = false;
      clavesValidas.forEach((clave) => {
        if (mapa.delete(clave)) {
          huboCambios = true;
        }
      });
      if (!huboCambios) return;

      detallesLocalesRef.current = mapa;
      setDetallesPedidos((prev) => {
        const nuevo = new Map(prev);
        clavesValidas.forEach((clave) => nuevo.delete(clave));
        return nuevo;
      });
      guardarDetallesCache(mapa);
    },
    [guardarDetallesCache]
  );

  const cargarProveedores = useCallback(async () => {
    try {
      const proveedoresData = await getProveedores();
      // Filtrar solo proveedores activos (id_estado = 1)
      const proveedoresFiltrados = Array.isArray(proveedoresData)
        ? proveedoresData.filter((proveedor) => proveedor.id_estado === 1)
        : [];
      setProveedores(proveedoresFiltrados);
    } catch (err) {
      console.error("Error al cargar proveedores:", err);
      setProveedores([]);
    }
  }, []);

  useEffect(() => {
    cargarPedidos();
    cargarProveedores();
  }, [cargarPedidos, cargarProveedores]);

  const pedidosEnriquecidos = pedidos.map((pedido) => {
    const proveedor = proveedores.find(
      (p) => p.id_proveedor === parseInt(pedido.id_proveedor, 10)
    );
    const detallesDesdeMapa = obtenerDetallesDesdeMapa(
      detallesPedidos,
      pedido.id_pedido,
      pedido.numero_pedido
    );
    const detalles = (Array.isArray(detallesDesdeMapa) && detallesDesdeMapa.length > 0)
      ? detallesDesdeMapa
      : Array.isArray(pedido.detalles_pedidos)
        ? pedido.detalles_pedidos
        : [];
    const productoResumen =
      detalles[0]?.nombre_producto ||
      detalles[0]?.id_productos_producto?.nombre_producto ||
      "-";
    const resultado = detalles.reduce((acumulado, detalle) => {
      if (detalle.subtotal !== undefined) {
        acumulado.precio += parseFloat(detalle.subtotal) || 0;
      } else {
        const cantidad = parseFloat(detalle.cantidad) || 0;
        const costo = parseFloat(detalle.costo_unitario) || 0;
        acumulado.precio += cantidad * costo;
      }
      acumulado.cantidad += parseFloat(detalle.cantidad) || 0;
      return acumulado;
    }, { precio: 0, cantidad: 0 });

    return {
      ...pedido,
      nombre_proveedor: proveedor?.nombre_proveedor || "Proveedor no encontrado",
      productoResumen,
      cantidad_total: resultado.cantidad,
      precio_total: resultado.precio,
      detalles_pedidos: detalles,
      onStatusChange: (_, nuevoEstado) => manejarCambioEstado(pedido, nuevoEstado)
    };
  });

  // Calcular filteredPedidos fuera del useEffect para incluir onStatusChange
  const filteredPedidos = pedidosEnriquecidos
    .filter((pedido) => {
      if (!searchTerm) return true;
      const query = normalizeText(searchTerm);
      return Object.values(pedido).some((valor) =>
        normalizeText(String(valor ?? "")).includes(query)
      );
    });

  const pedidosVista = useMemo(() => {
    const lista = Array.isArray(filteredPedidos) ? [...filteredPedidos] : [];

    return lista.sort((a, b) => {
      const estadoA = normalizarEstadoPedido(a?.id_estado ?? a?.estado_pedido);
      const estadoB = normalizarEstadoPedido(b?.id_estado ?? b?.estado_pedido);

      const prioridadA = PRIORIDAD_ORDEN_ESTADO[estadoA] ?? 99;
      const prioridadB = PRIORIDAD_ORDEN_ESTADO[estadoB] ?? 99;

      if (prioridadA !== prioridadB) {
        return prioridadA - prioridadB;
      }

      const idA = Number.parseInt(a?.id_pedido ?? a?.id, 10);
      const idB = Number.parseInt(b?.id_pedido ?? b?.id, 10);

      if (Number.isFinite(idA) && Number.isFinite(idB)) {
        return idA - idB;
      }

      const textoA = String(a?.id_pedido ?? a?.id ?? "");
      const textoB = String(b?.id_pedido ?? b?.id ?? "");
      return textoA.localeCompare(textoB, "es", { numeric: true, sensitivity: "base" });
    });
  }, [filteredPedidos]);

  // Definir columna de estado con selector directo
  const columnaEstado = useMemo(() => ({
    field: "estado_pedido",
    header: "Estado",
    Cell: ({ row }) => {
      const estadoNumerico = normalizarEstadoPedido(row.id_estado);

      if (isCompletados) {
        const estadoConfig = getEstadoPedidoConfig(estadoNumerico);
        return (
          <span
            className={`badge-estado badge-pequeno badge-con-borde badge-estado--readonly ${getEstadoToneClass(
              estadoNumerico
            )}`}
          >
            <span className="badge-content">{estadoConfig.label}</span>
          </span>
        );
      }

      return (
        <SelectorEstado
          estadoActual={estadoNumerico}
          opciones={ESTADOS_DISPONIBLES.map(estado => ({
            value: estado.id_estado,
            label: estado.nombre_estado
          }))}
          deshabilitado={estadoNumerico === 6}
          tamano="pequeño"
          onCambioEstado={(nuevoEstado) => {
            if (row.onStatusChange) {
              row.onStatusChange(null, nuevoEstado);
            }
          }}
        />
      );
    },
    accessor: (row) => normalizarEstadoPedido(row.id_estado),
  }), [isCompletados]);

  // Definir columnas con la función de cambio de estado
  const columnasPedidos = useMemo(() => [
    ...CAMPOS_TABLA_PEDIDOS,
    columnaEstado
  ], [columnaEstado]);

  const abrirModal = (accion, pedido = null) => {
    setPedidoSeleccionado(pedido);
    setAccionModal(accion);
  };

  const cerrarModal = () => {
    setPedidoSeleccionado(null);
    setAccionModal(null);
  };

  const construirPayloadDetalles = (apiData, productos = []) => {
    const payload = {
      detalles: productos
        .map((producto) => {
          const idProductos = parseInt(producto.idProducto, 10);
          return {
            id_productos: Number.isFinite(idProductos) ? idProductos : null,
            cantidad: parseInt(producto.cantidad, 10)
          };
        })
        .filter(
          (detalle) =>
            Number.isFinite(detalle.id_productos) &&
            Number.isFinite(detalle.cantidad)
        )
    };

    const idPedido = apiData.id_pedido || apiData.id;
    if (idPedido) {
      payload.id_pedidos = parseInt(idPedido, 10);
    }

    return payload;
  };

  const manejarCrearPedido = async ({ apiData, productos }) => {
    try {
      if (!Array.isArray(productos) || productos.length === 0) {
        toast.error("Debe agregar al menos un producto al pedido");
        return false;
      }

      const resultadoCreacion = await createPedido(apiData, { productos });
      const numeroPedidoResultado = resultadoCreacion?.numero_pedido ?? apiData.numero_pedido;
      const idPedidoResultado = resultadoCreacion?.id ?? resultadoCreacion?.id_pedido ?? apiData.id_pedido;
      const detallesLocales = Array.isArray(resultadoCreacion?.detalles) && resultadoCreacion.detalles.length > 0
        ? resultadoCreacion.detalles
        : productos;

      sincronizarDetallesLocales(numeroPedidoResultado, idPedidoResultado, detallesLocales);
      
      await cargarPedidos();
      cerrarModal();
      toast.success("Pedido creado exitosamente");
      return true;
    } catch (error) {
      console.error("Error al crear pedido:", error);
      toast.error(getApiErrorMessage(error, "Error al crear el pedido"));
      return false;
    }
  };

  const manejarActualizarPedido = async ({ apiData, productos }) => {
    try {
      const pedidoId =
        apiData?.id_pedido ||
        pedidoSeleccionado?.id_pedido ||
        pedidoSeleccionado?.id;

      if (!pedidoId) {
        toast.error("No se pudo identificar el pedido a actualizar");
        return false;
      }
      const proveedorPedido = proveedores.find(
        (proveedor) =>
          String(proveedor?.id_proveedor) === String(apiData?.id_proveedor)
      );
      const normalizarDetallesCorreo = (coleccion = []) =>
        (Array.isArray(coleccion) ? coleccion : [])
        .map((detalle) => ({
          idProducto:
            detalle?.idProducto ??
            detalle?.id_productos ??
            detalle?.id_producto ??
            detalle?.id,
          nombre:
            detalle?.nombre ??
            detalle?.nombre_producto ??
            detalle?.id_productos_producto?.nombre_producto ??
            detalle?.id_productos_producto?.nombre ??
            "",
          cantidad:
            detalle?.cantidad ??
            detalle?.cantidad_producto ??
            detalle?.cantidad_detalle ??
            0,
        }))
        .filter((detalle) => Number(detalle?.cantidad ?? 0) > 0);

      const payloadDetalles = construirPayloadDetalles(
        { ...apiData, id_pedido: pedidoId },
        productos
      );
      const detallesCorreoNuevos = normalizarDetallesCorreo(
        Array.isArray(payloadDetalles?.detalles) && payloadDetalles.detalles.length > 0
          ? payloadDetalles.detalles
          : productos
      );

      const estadoPedidoAntesDeActualizar = normalizarEstadoPedido(
        pedidoSeleccionado?.id_estado ?? apiData?.id_estado
      );
      const puedeReenviarAntesDeActualizar = estadoPedidoAntesDeActualizar === 3;
      const idEstadoCrudoAntesDeActualizar = Number.parseInt(
        pedidoSeleccionado?.id_estado ?? apiData?.id_estado,
        10
      );
      const idEstadoParaCorreo = Number.isFinite(idEstadoCrudoAntesDeActualizar)
        ? idEstadoCrudoAntesDeActualizar
        : 3;

      let correoReenvioFallido = false;
      let correoReenvioExitoso = false;
      const proveedorParaCorreo = {
        ...(proveedorPedido || {}),
        id_proveedor: apiData?.id_proveedor ?? proveedorPedido?.id_proveedor,
        nombre_proveedor:
          proveedorPedido?.nombre_proveedor ??
          apiData?.nombre_proveedor ??
          pedidoSeleccionado?.nombre_proveedor,
      };
      const correoProveedorPedido = String(
        proveedorParaCorreo?.email_proveedor ??
          proveedorParaCorreo?.correo_proveedor ??
          proveedorParaCorreo?.email ??
          proveedorParaCorreo?.correo ??
          apiData?.email_proveedor ??
          apiData?.correo_proveedor ??
          pedidoSeleccionado?.email_proveedor ??
          pedidoSeleccionado?.correo_proveedor ??
          ""
      ).trim();

      if (
        puedeReenviarAntesDeActualizar &&
        correoProveedorPedido &&
        detallesCorreoNuevos.length > 0
      ) {
        try {
          await enviarCorreoPedido(
            {
              id_pedido: pedidoId,
              numero_pedido: apiData.numero_pedido,
              fecha_pedido: apiData.fecha_pedido,
              fecha_entrega: apiData.fecha_entrega,
              // Reenvio en modo "creacion", con estado pendiente.
              id_estado: idEstadoParaCorreo,
              estado_texto: "Pendiente de aprobación",
              estado: "Pendiente de aprobación",
            },
            {
              ...proveedorParaCorreo,
              email_proveedor: correoProveedorPedido,
            },
            detallesCorreoNuevos,
            { notify: false, isUpdate: false }
          );
          correoReenvioExitoso = true;
        } catch (errorCorreo) {
          correoReenvioFallido = true;
          console.error(
            "Pedido actualizado, pero fallo el reenvio de correo:",
            errorCorreo
          );
        }
      }

      await updatePedido(pedidoId, apiData);

      const detallesActualizados = await guardarDetallesPedido(payloadDetalles);
      const detallesParaGuardar =
        Array.isArray(detallesActualizados) && detallesActualizados.length > 0
          ? detallesActualizados
          : payloadDetalles.detalles;

      sincronizarDetallesLocales(
        apiData.numero_pedido,
        pedidoId,
        detallesParaGuardar
      );

      await cargarPedidos();
      cerrarModal();
      if (correoReenvioFallido) {
        toast.error("Pedido actualizado, pero no se pudo reenviar el correo al proveedor");
      } else if (correoReenvioExitoso) {
        toast.success("Pedido actualizado y correo reenviado al proveedor");
      } else {
        toast.success("Pedido actualizado exitosamente");
      }
      return true;
    } catch (error) {
      console.error("Error al actualizar pedido:", error);
      toast.error(getApiErrorMessage(error, "Error al actualizar el pedido"));
      return false;
    }
  };

  const manejarEliminarPedido = async (pedidoAEliminar) => {
    try {
      const pedidoId = pedidoAEliminar.id_pedido || pedidoAEliminar.id;
      await deletePedido(pedidoId);
      limpiarDetallesLocales([pedidoAEliminar.numero_pedido, pedidoId]);
      await cargarPedidos();
      cerrarModal();
      toast.success("Pedido eliminado exitosamente");
    } catch (error) {
      console.error("Error al eliminar pedido:", error);
      toast.error(getApiErrorMessage(error, "Error al eliminar el pedido"));
    }
  };

  const confirmarCambioEstado = async () => {
    if (!estadoPendiente.id) return;

    if (normalizarEstadoPedido(estadoPendiente.estadoActualId) === 6) {
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      setEstadoPendiente({
        mostrar: false,
        id: null,
        nuevoEstado: null,
        nombrePedido: "",
        estadoActualId: null,
        estadoActual: "",
        nuevoEstadoTexto: ""
      });
      return;
    }

    try {
      // Obtener los datos completos del pedido desde la API
      const pedidoCompleto = await getPedidoById(estadoPendiente.id);

      if (pedidoCompleto) {
        // Construir el payload completo usando los datos reales del pedido
        const payloadActualizacion = {
          numero_pedido: pedidoCompleto.numero_pedido,
          id_proveedor: pedidoCompleto.id_proveedor,
          fecha_pedido: pedidoCompleto.fecha_pedido,
          fecha_entrega: pedidoCompleto.fecha_entrega,
          id_estado: estadoPendiente.nuevoEstado
        };

        // Hacer la llamada a la API con los datos reales
        await updatePedido(estadoPendiente.id, payloadActualizacion);

        // Actualizar el estado en la UI después de la API exitosa
        const nuevoEstadoFinal = estadoPendiente.nuevoEstado;

        setPedidos((prev) =>
          prev.map((p) =>
            p.id_pedido === estadoPendiente.id || p.id === estadoPendiente.id
              ? {
                ...p,
                id_estado: nuevoEstadoFinal,
                estado_pedido: nuevoEstadoFinal,
                estado_texto: ESTADOS_PEDIDOS[nuevoEstadoFinal] || "Pendiente",
              }
              : p,
          ),
        );

        // Forzar re-renderizado de la tabla para que los colores se actualicen
        setRefreshKey(prev => prev + 1);

        // Recargar desde el endpoint correspondiente para reflejar el cambio (pendientes/finalizadas)
        await cargarPedidos();

        toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);
      }
    } catch (error) {
      console.error('Error al actualizar el estado del pedido:', error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);

      // Revertir el cambio en caso de error
      await cargarPedidos();
    } finally {
      setEstadoPendiente({
        mostrar: false,
        id: null,
        nuevoEstado: null,
        nombrePedido: "",
        estadoActualId: null,
        estadoActual: "",
        nuevoEstadoTexto: ""
      });
    }
  };

  return (
    <div className="main-ad-column">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <ClipboardCheck size={40} className="icono-titulo" />
          <h1>{isCompletados ? "Pedidos Completados" : "Gestión de Pedidos"}</h1>
        </div>
        <div className="acciones-derecha">
          {!isCompletados && (
            <button
              className="boton boton-primario"
              onClick={() => abrirModal("crear")}
              disabled={!canCreate}
              title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
            >
              + Nuevo Pedido
            </button>
          )}

          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar pedido..."
          />
        </div>
      </div>

      {error && (
        <div className="error-container">
          <p className="pedidos-admin-error-text">{error}</p>
          <button
            className="boton boton-secundario"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      )}

      {!error && (
        <DataTable
          key={refreshKey}
          permisoId={permisoId}
          columns={columnasPedidos}
          data={pedidosVista}
          loading={loading}
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
          onRefresh={async () => {
            await Promise.all([cargarPedidos(), cargarProveedores()]);
          }}
          actions={true}
          onView={(row) => abrirModal("ver", row)}
          onEdit={
            isCompletados
              ? null
              : (row) => abrirModal("editar", row)
          }
          onDelete={
            isCompletados
              ? null
              : (row) => abrirModal("eliminar", row)
          }
          canEdit={(pedido) => {
            // No permitir editar si está COMPLETADO (5) o CANCELADO (6)
            const estadoActual = normalizarEstadoPedido(pedido?.id_estado ?? 3);
            return canEdit && estadoActual !== 5 && estadoActual !== 6;
          }}
          canDelete={(pedido) => {
            // No permitir eliminar si está COMPLETADO (5) o CANCELADO (6)
            const estadoActual = normalizarEstadoPedido(pedido?.id_estado ?? 3);
            return canDelete && estadoActual !== 5 && estadoActual !== 6;
          }}
          redDeleteButtons={true} // Activar estilo rojo para eliminar solo en pedidos
          emptyTitle="No se encontraron pedidos"
          emptyMessage="No hay pedidos disponibles para mostrar en la página actual."
        />
      )}

      {accionModal === "crear" && canCreate && (
        <ModalFormularioPedido
          isOpen={true}
          onClose={cerrarModal}
          onSubmit={manejarCrearPedido}
          title="Nuevo Pedido"
        />
      )}

      {accionModal === "editar" && pedidoSeleccionado && (
        <ModalFormularioPedido
          isOpen={true}
          onClose={cerrarModal}
          onSubmit={manejarActualizarPedido}
          pedido={{
            ...pedidoSeleccionado,
            // Forzar que se comporte como pedido nuevo para evitar problemas con edición
            // (Los datos reales se deberían cargar desde la API en el componente del modal)
            editar: true
          }}
          title="Editar Pedido"
        />
      )}

      {accionModal === "eliminar" && pedidoSeleccionado && (
        <DeleteModal
          isOpen={true}
          onClose={cerrarModal}
          onConfirm={() => manejarEliminarPedido(pedidoSeleccionado)}
          pedido={pedidoSeleccionado}
        />
      )}

      {accionModal === "ver" && pedidoSeleccionado && (
          <ModalVerPedido
            isOpen={true}
            pedido={pedidoSeleccionado}
            onClose={cerrarModal}
            onEdit={
              isCompletados ? undefined : (pedido) => abrirModal("editar", pedido)
            }
            estadosDisponibles={estadosDisponibles}
          />
        )}

      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={() => setEstadoPendiente({ ...estadoPendiente, mostrar: false })}
        onConfirm={confirmarCambioEstado}
        targetStatus={estadoPendiente.nuevoEstado}
        title={`Cambiar estado de pedido`}
        message={`¿Seguro que deseas cambiar el estado por ${estadoPendiente.nuevoEstadoTexto}?`}
        confirmText={`${estadoPendiente.nuevoEstadoTexto}`}
        type={estadoPendiente.nuevoEstado === 6 ? 'deactivate' :
          estadoPendiente.nuevoEstado === 3 ? 'reset' :
            estadoPendiente.nuevoEstado === 4 ? 'activate' : 'activate'}
        details={estadoPendiente.nombrePedido}
        icon={<Zap size={24} />}
      />
    </div>
  );
};

const Pedidos = () => <PedidosPage key="gestion" view="gestion" />;
export const PedidosCompletados = () => (
  <PedidosPage key="completados" view="completados" />
);

export default Pedidos;
