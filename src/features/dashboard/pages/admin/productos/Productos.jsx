import { useEffect, useState, useMemo } from "react";
import { BoxIcon } from "lucide-react";
import { toast } from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import { buscarUniversal } from "../../../../../shared/utils/búsquedaUniversal";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";

import {
  ModalFormularioProducto,
  ModalEliminarProducto,
  ModalVerProducto,
} from "./modales-productos";

import {
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
} from "../../../hooks/Productos_API/API_productos";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const columnasProductos = [
  { field: "id", label: "ID" },
  { field: "nombre", label: "Nombre" },
  { field: "categoria", label: "Categoría" },
  { field: "precioVenta", label: "Precio Venta" },
  { field: "stock", label: "Stock" },
  { field: "id_estado", label: "Estado" },
];

const PRODUCTO_PERMISSION_MESSAGES = {
  crear: "No tienes permisos para crear productos.",
  editar: "No tienes permisos para editar productos.",
  eliminar: "No tienes permisos para eliminar productos.",
};

const isPermissionDeniedError = (error) => {
  const status = Number(error?.status ?? error?.response?.status);
  const message = String(
    error?.data?.message ??
      error?.data?.msg ??
      error?.message ??
      error?.response?.data?.message ??
      ""
  ).toLowerCase();

  return (
    status === 403 ||
    message.includes("forbidden") ||
    message.includes("sin permisos") ||
    message.includes("no tienes permisos") ||
    message.includes("no cuenta con los permisos")
  );
};

const normalizarProducto = (producto = {}) => {
  const id =
    producto.id_productos ??
    producto.id_producto ??
    producto.id ??
    producto.producto_id ??
    producto.id_productos_s ??
    null;
  const estadoNumero =
    producto.id_estado ??
    producto.id_estados ??
    (producto.estado === "Activo" || producto.estado === "activo" ? 1 : 2);

  return {
    ...producto,
    id,
    nombre:
      producto.nombre ??
      producto.nombre_producto ??
      producto.nombreProducto ??
      producto.producto_nombre ??
      "",
    categoria: producto.categoria ?? producto.categoria_producto ?? producto.categoría,
    precioVenta:
      producto.precioVenta ??
      producto.precio_venta ??
      producto.precio_venta_producto ??
      producto.precio ??
      producto.valor ??
      0,
    id_estado: estadoNumero === 2 ? 2 : 1,
    estado: estadoNumero === 2 ? "Inactivo" : "Activo",
  };
};

function Productos() {
  const [productos, setProductos] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const [loading, setLoading] = useState(true);
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const recargarProductos = async ({
    page = pagination.page,
    limit = pagination.limit,
    search = searchQuery,
  } = {}) => {
    try {
      setLoading(true);
      const respuesta = await getProductos({
        query: {
          page,
          limit,
          ...(search ? { search } : {}),
        },
      });
      const {
        items,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      } = normalizePaginatedResponse(respuesta, {
        preferredKeys: ["productos", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });
      setProductos(items.map(normalizarProducto));
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (error) {
      console.error("Error al recargar productos:", error);
      setProductos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    recargarProductos({
      page: pagination.page,
      limit: pagination.limit,
      search: searchQuery,
    });
  }, [pagination.page, pagination.limit, searchQuery]);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery]);

  const productosVista = useMemo(
    () => (searchQuery ? buscarUniversal(productos, searchQuery) : productos),
    [productos, searchQuery],
  );

  const notifyPermissionDenied = (action) => {
    toast.error(
      PRODUCTO_PERMISSION_MESSAGES[action] ||
        "No tienes permisos para realizar esta accion."
    );
  };

  const abrirModal = (accion, producto = null) => {
    if (accion === "crear" && !canCreate) {
      notifyPermissionDenied("crear");
      return;
    }
    if (accion === "editar" && !canEdit) {
      notifyPermissionDenied("editar");
      return;
    }
    if (accion === "eliminar" && !canDelete) {
      notifyPermissionDenied("eliminar");
      return;
    }
    setProductoSeleccionado(producto);
    setAccionModal(accion);
  };

  const cerrarModal = () => {
    setProductoSeleccionado(null);
    setAccionModal(null);
  };

  const manejarCrearProducto = async (nuevoProducto) => {
    try {
      if (!canCreate) {
        notifyPermissionDenied("crear");
        return false;
      }
      await createProducto(nuevoProducto);
      await recargarProductos();
      toast.success("Producto creado exitosamente");
      cerrarModal();
      return true;
    } catch (error) {
      console.error("Error al crear producto:", error);
      toast.error(
        isPermissionDeniedError(error)
          ? PRODUCTO_PERMISSION_MESSAGES.crear
          : "Error al crear el producto"
      );
      return false;
    }
  };

  const manejarActualizarProducto = async (productoActualizado) => {
    try {
      if (!canEdit) {
        notifyPermissionDenied("editar");
        return false;
      }
      const idProducto = productoActualizado.id_productos || productoActualizado.id;
      if (!idProducto) throw new Error("ID de producto no encontrado");
      const datosLimpios = { ...productoActualizado };
      delete datosLimpios.id_productos;
      await updateProducto(idProducto, datosLimpios);
      await recargarProductos();
      toast.success("Producto actualizado exitosamente");
      cerrarModal();
      return true;
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      toast.error(
        isPermissionDeniedError(error)
          ? PRODUCTO_PERMISSION_MESSAGES.editar
          : "Error al actualizar el producto"
      );
      return false;
    }
  };

  const manejarEliminarProducto = async (productoAEliminar) => {
    try {
      if (!canDelete) {
        notifyPermissionDenied("eliminar");
        cerrarModal();
        return;
      }
      const productoId = productoAEliminar.id_productos || productoAEliminar.id;
      if (!productoId) {
        toast.error("No se pudo identificar el ID del producto");
        return;
      }
      await deleteProducto(productoId);
      setPagination((prev) => ({ ...prev, page: 1 }));
      await recargarProductos({
        page: 1,
        limit: pagination.limit,
        search: searchQuery,
      });
      toast.success("Producto eliminado exitosamente");
      cerrarModal();
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      toast.error(
        isPermissionDeniedError(error)
          ? PRODUCTO_PERMISSION_MESSAGES.eliminar
          : "Error al eliminar el producto"
      );
    }
  };

  const handleStatusChange = async (productoActualizado) => {
    if (!productoActualizado?.id_productos && !productoActualizado?.id) return;
    const idProducto = productoActualizado.id_productos || productoActualizado.id;
    const nuevoEstado =
      productoActualizado.id_estado ??
      productoActualizado.estado ??
      (productoActualizado.estado === "Activo" ? 1 : 2);

    const anterior = productos.find(
      (p) => p.id === idProducto || p.id_productos === idProducto,
    );

    setProductos((prev) =>
      prev.map((p) =>
        p.id === idProducto || p.id_productos === idProducto
          ? { ...p, id_estado: nuevoEstado, estado: nuevoEstado === 1 ? "Activo" : "Inactivo" }
          : p,
      ),
    );

    try {
      if (!canEdit) {
        notifyPermissionDenied("editar");
        return;
      }
      const productoParaActualizar = {
        ...anterior,
        id_estados: nuevoEstado,
        id_estado: nuevoEstado,
        estado: nuevoEstado === 1 ? "Activo" : "Inactivo",
      };

      const payload = {
        id_productos: productoParaActualizar.id_productos || productoParaActualizar.id,
        nombre_producto: productoParaActualizar.nombre_producto || productoParaActualizar.nombre,
        descripcion_producto:
          productoParaActualizar.descripcion_producto || productoParaActualizar.descripcion,
        precio_venta_producto:
          productoParaActualizar.precio_venta_producto || productoParaActualizar.precioVenta,
        stock: productoParaActualizar.stock,
        categoria: productoParaActualizar.categoria,
        imagen_url: productoParaActualizar.imagen_url,
        id_estados: productoParaActualizar.id_estados ?? productoParaActualizar.id_estado,
        estado: productoParaActualizar.estado,
      };

      await updateProducto(idProducto, payload);
      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);
    } catch (error) {
      console.error("Error al actualizar el estado del producto:", error);
      toast.error(
        isPermissionDeniedError(error)
          ? PRODUCTO_PERMISSION_MESSAGES.editar
          : STATUS_CHANGE_ERROR_MESSAGE
      );
      setProductos((prev) =>
        prev.map((p) =>
          p.id === idProducto || p.id_productos === idProducto ? anterior || p : p,
        ),
      );
    }
  };

  return (
    <div className="main-ad-column">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <BoxIcon size={40} className="icono-titulo" />
          <h1>Administración de Productos</h1>
        </div>
        <div className="acciones-derecha">
          <button
            className="boton boton-primario"
            onClick={() => abrirModal("crear")}
            disabled={!canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            + Nuevo Producto
          </button>
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar en toda la tabla (escribe 'Activo' para filtrar por estado)..."
            className="expandido"
          />
        </div>
      </div>

      <DataTable
        permisoId={permisoId}
        columns={columnasProductos}
        data={productosVista}
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
        onRefresh={() =>
          recargarProductos({
            page: pagination.page,
            limit: pagination.limit,
            search: searchQuery,
          })
        }
        onView={(row) => abrirModal("ver", row)}
        onEdit={(row) => abrirModal("editar", { ...row, editar: true })}
        onDelete={(row) => abrirModal("eliminar", row)}
        canEdit={() => canEdit}
        canDelete={() => canDelete}
        onStatusChange={handleStatusChange}
        statusConfig={{
          values: { Activo: "Activo", Inactivo: "Inactivo" },
          colors: { Activo: "#4caf50", Inactivo: "#f44336" },
        }}
        loading={loading}
        emptyTitle="No se encontraron productos"
        emptyMessage="No hay productos disponibles para mostrar en la página actual."
      />

      {accionModal === "crear" && canCreate && (
        <ModalFormularioProducto
          isOpen={true}
          onClose={cerrarModal}
          onSubmit={manejarCrearProducto}
          title="Nuevo Producto"
          productos={productos}
        />
      )}

      {accionModal === "editar" && productoSeleccionado && canEdit && (
        <ModalFormularioProducto
          isOpen={true}
          onClose={cerrarModal}
          onSubmit={manejarActualizarProducto}
          producto={productoSeleccionado}
          title="Editar Producto"
          productos={productos}
        />
      )}

      {accionModal === "eliminar" && productoSeleccionado && canDelete && (
        <ModalEliminarProducto
          isOpen={true}
          onClose={cerrarModal}
          onConfirm={() => manejarEliminarProducto(productoSeleccionado)}
          producto={productoSeleccionado}
        />
      )}

      {accionModal === "ver" && productoSeleccionado && (
        <ModalVerProducto
          isOpen={true}
          producto={productoSeleccionado}
          onClose={cerrarModal}
        />
      )}
    </div>
  );
}

export default Productos;
