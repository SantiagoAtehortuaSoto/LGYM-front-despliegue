import { useEffect, useMemo, useState } from "react";
import { IconBuildingWarehouse } from "@tabler/icons-react";
import { toast } from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import { buscarUniversal } from "../../../../../shared/utils/búsquedaUniversal";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";

import {
  ModalFormularioProveedor,
  ModalEliminarProveedor,
  ModalVerProveedor,
} from "./modales-proveedores";
import {
  getProveedores,
  createProveedor,
  updateProveedor,
  deleteProveedor,
} from "../../../hooks/Proveedores_API/API_proveedores";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const columnasProveedores = [
  { field: "id_proveedor", label: "ID" },
  { field: "nit_proveedor", label: "NIT" },
  { field: "nombre_proveedor", label: "Nombre" },
  { field: "telefono_proveedor", label: "Teléfono" },
  { field: "direccion_proveedor", label: "Dirección" },
  { field: "ciudad_proveedor", label: "Ciudad" },
  { field: "id_estado", label: "Estado" },
];

const normalizarProveedor = (p = {}) => {
  const idEstado =
    p.id_estado ??
    p.estado ??
    p.id_estados ??
    (p.estado === "Activo" || p.estado === "activo" ? 1 : 2) ??
    1;
  return {
    ...p,
    id_estado: idEstado === 2 ? 2 : 1,
    estado: idEstado === 2 ? "Inactivo" : "Activo",
  };
};

function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const recargar = async ({
    page = pagination.page,
    limit = pagination.limit,
    search = searchQuery,
  } = {}) => {
    try {
      setLoading(true);
      const data = await getProveedores({
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
      } = normalizePaginatedResponse(data, {
        preferredKeys: ["proveedores", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });
      setProveedores(items.map(normalizarProveedor));
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (error) {
      console.error("Error al recargar proveedores:", error);
      toast.error(getApiErrorMessage(error, "Error al cargar proveedores"));
      setProveedores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    recargar({
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

  const proveedoresVista = useMemo(
    () => (searchQuery ? buscarUniversal(proveedores, searchQuery) : proveedores),
    [proveedores, searchQuery],
  );

  const abrirModal = (accion, proveedor = null) => {
    setProveedorSeleccionado(proveedor);
    setAccionModal(accion);
  };

  const cerrarModal = () => {
    setProveedorSeleccionado(null);
    setAccionModal(null);
  };

  const manejarCrearProveedor = async (formData) => {
    try {
      const dataToSubmit = {
        nit_proveedor: formData.nit,
        nombre_proveedor: formData.nombre,
        telefono_proveedor: formData.telefono,
        nombre_contacto: formData.nombreContacto || null,
        email_proveedor: formData.email,
        direccion_proveedor: formData.direccion || null,
        ciudad_proveedor: formData.ciudad || null,
        fecha_registro: new Date().toISOString(),
        id_estado: formData.estado === "Activo" ? 1 : 2,
      };

      await createProveedor(dataToSubmit);
      await recargar();
      toast.success("Proveedor creado exitosamente");
      cerrarModal();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al crear el proveedor"));
      return false;
    }
  };

  const manejarActualizarProveedor = async (formData) => {
    try {
      const dataToSubmit = {
        nit_proveedor: formData.nit,
        nombre_proveedor: formData.nombre,
        telefono_proveedor: formData.telefono,
        nombre_contacto: formData.nombreContacto || null,
        email_proveedor: formData.email,
        direccion_proveedor: formData.direccion || null,
        ciudad_proveedor: formData.ciudad || null,
        id_estado: formData.estado === "Activo" ? 1 : 2,
      };

      await updateProveedor(proveedorSeleccionado.id_proveedor, dataToSubmit);
      await recargar();
      toast.success("Proveedor actualizado exitosamente");
      cerrarModal();
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al actualizar el proveedor"));
      return false;
    }
  };

  const manejarEliminarProveedor = async (proveedorAEliminar) => {
    try {
      await deleteProveedor(proveedorAEliminar.id_proveedor);
      setPagination((prev) => ({ ...prev, page: 1 }));
      await recargar({
        page: 1,
        limit: pagination.limit,
        search: searchQuery,
      });
      toast.success("Proveedor eliminado exitosamente");
      cerrarModal();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al eliminar el proveedor"));
    }
  };

  const handleStatusChange = async (proveedorActualizado) => {
    if (!proveedorActualizado?.id_proveedor) return;
    const id = proveedorActualizado.id_proveedor;
    const nuevoEstado =
      proveedorActualizado.id_estado ??
      proveedorActualizado.estado ??
      (proveedorActualizado.estado === "Activo" ? 1 : 2);

    const previo = proveedores.find((p) => p.id_proveedor === id);

    setProveedores((prev) =>
      prev.map((p) =>
        p.id_proveedor === id
          ? { ...p, id_estado: nuevoEstado, estado: nuevoEstado === 1 ? "Activo" : "Inactivo" }
          : p,
      ),
    );

    try {
      const payload = {
        nit_proveedor: previo?.nit_proveedor,
        nombre_proveedor: previo?.nombre_proveedor,
        telefono_proveedor: previo?.telefono_proveedor,
        nombre_contacto: previo?.nombre_contacto,
        email_proveedor: previo?.email_proveedor,
        direccion_proveedor: previo?.direccion_proveedor,
        ciudad_proveedor: previo?.ciudad_proveedor,
        fecha_registro: previo?.fecha_registro,
        id_estado: nuevoEstado,
      };
      await updateProveedor(id, payload);
      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);
    } catch (error) {
      console.error("Error al actualizar el estado del proveedor:", error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      setProveedores((prev) =>
        prev.map((p) =>
          p.id_proveedor === id ? normalizarProveedor(previo || p) : p,
        ),
      );
    }
  };

  return (
    <div className="main-ad-column">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <IconBuildingWarehouse size={40} className="icono-titulo" color="red" />
          <h1>Administración de Proveedores</h1>
        </div>
        <div className="acciones-derecha">
          <button
            onClick={() => abrirModal("crear")}
            className="boton boton-primario"
            disabled={!canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            + Nuevo Proveedor
          </button>
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar en toda la tabla (escribe 'Activo' para filtrar por estado)..."
          />
        </div>
      </div>

      <DataTable
        permisoId={permisoId}
        columns={columnasProveedores}
        data={proveedoresVista}
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
        onRefresh={() =>
          recargar({
            page: pagination.page,
            limit: pagination.limit,
            search: searchQuery,
          })
        }
        onView={(row) => abrirModal("ver", row)}
        onEdit={(row) => abrirModal("editar", row)}
        onDelete={(row) => abrirModal("eliminar", row)}
        canEdit={() => canEdit}
        canDelete={() => canDelete}
        onStatusChange={handleStatusChange}
        statusConfig={{
          values: { Activo: "Activo", Inactivo: "Inactivo" },
          colors: { Activo: "#4caf50", Inactivo: "#f44336" },
        }}
        emptyTitle="No se encontraron proveedores"
        emptyMessage="No hay proveedores disponibles para mostrar en la página actual."
      />

      {accionModal === "crear" && canCreate && (
        <ModalFormularioProveedor
          isOpen={true}
          onClose={cerrarModal}
          onSubmit={manejarCrearProveedor}
          title="Nuevo Proveedor"
          proveedoresExistentes={proveedores}
        />
      )}
      {accionModal === "editar" && proveedorSeleccionado && (
        <ModalFormularioProveedor
          isOpen={true}
          onClose={cerrarModal}
          onSubmit={manejarActualizarProveedor}
          proveedor={proveedorSeleccionado}
          title="Editar Proveedor"
          proveedoresExistentes={proveedores}
        />
      )}
      {accionModal === "eliminar" && proveedorSeleccionado && (
        <ModalEliminarProveedor
          isOpen={true}
          onClose={cerrarModal}
          onConfirm={() => manejarEliminarProveedor(proveedorSeleccionado)}
          proveedor={proveedorSeleccionado}
        />
      )}
      {accionModal === "ver" && proveedorSeleccionado && (
        <ModalVerProveedor
          isOpen={true}
          proveedor={proveedorSeleccionado}
          onClose={cerrarModal}
        />
      )}
    </div>
  );
}

export default Proveedores;
