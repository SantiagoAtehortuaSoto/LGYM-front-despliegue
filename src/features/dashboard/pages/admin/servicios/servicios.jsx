import { useEffect, useState } from "react";
import { Plus, WeightIcon, Zap } from "lucide-react";
import DataTable from "../../../components/dataTables/dataTable";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { columnasServicios } from "../../../../../shared/utils/data/serviciosEjemplos";
import { buscarUniversal } from "../../../../../shared/utils/búsquedaUniversal";
import {
  ModalFormularioServicio,
  ModalEliminarServicio,
  ModalVerServicio,
} from "./modales-servicios";
import { useServicios } from "../../../hooks/Servicios_API/useServicios";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const ServiciosAdmin = () => {
  const [filtro, setFiltro] = useState("");
  const searchQuery = filtro.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();
  const {
    servicios,
    loading,
    error,
    pagination,
    setPagination,
    cargarServicios,
    crearServicio,
    actualizarServicio,
    eliminarServicio,
    cambiarEstadoServicio,
  } = useServicios(searchQuery);
  void error;

  const [modalAbierto, setModalAbierto] = useState(null);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    id: null,
    nuevoEstado: null,
    nombreServicio: "",
  });

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery, setPagination]);

  const abrirModal = (tipo, servicio = null) => {
    setServicioSeleccionado(servicio);
    setModalAbierto(tipo);
  };

  const limpiarPayloadServicio = (payload = {}) => {
    const {
      duracion,
      duracion_dias,
      periodicidad,
      tiempo_duracion,
      ...resto
    } = payload;
    void duracion;
    void duracion_dias;
    void periodicidad;
    void tiempo_duracion;
    return resto;
  };

  const handleGuardarServicio = async (payload) => {
    const limpio = limpiarPayloadServicio(payload);
    if (modalAbierto === "crear") {
      return crearServicio(limpio);
    }
    return actualizarServicio(limpio);
  };

  const cerrarModal = () => {
    setModalAbierto(null);
    setServicioSeleccionado(null);
  };

  return (
    <>
      <div className="encabezado-acciones">
        <h1 className="titulo-con-icono">
          <WeightIcon size={28} className="icono-titulo" />
          Gestión de Servicios
        </h1>

        <div className="acciones-derecha">
          <button
            onClick={() => abrirModal("crear")}
            className="boton boton-primario"
            disabled={!canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            <Plus size={18} />
            <span>Nuevo Servicio</span>
          </button>
          <BuscadorUniversal
            value={filtro}
            onChange={setFiltro}
            placeholder="Buscar servicio..."
            className="w-64"
          />
        </div>
      </div>


        <DataTable
          permisoId={permisoId}
          columns={columnasServicios}
          data={(searchQuery ? buscarUniversal(servicios, searchQuery) : servicios).map((servicio) => ({
            ...servicio,
            onStatusChange: (row) => {
              setEstadoPendiente({
                mostrar: true,
                id: row.id_servicio,
                nuevoEstado: row.id_estado === 1 ? 2 : 1,
                nombreServicio: row.nombre_servicio,
              });
            },
          }))}
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
            cargarServicios({
              page: pagination.page,
              limit: pagination.limit,
              search: searchQuery,
            })
          }
          onView={(serv) => abrirModal("ver", serv)}
          onEdit={(serv) => abrirModal("editar", serv)}
          onDelete={(serv) => abrirModal("eliminar", serv)}
          canEdit={() => canEdit}
          canDelete={() => canDelete}
          emptyTitle="No se encontraron servicios"
          emptyMessage="No hay servicios disponibles para mostrar en la página actual."
        />

      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={() =>
          setEstadoPendiente({ ...estadoPendiente, mostrar: false })
        }
        onConfirm={async () => {
          try {
            await cambiarEstadoServicio(
              estadoPendiente.id,
              estadoPendiente.nuevoEstado
            );
            setEstadoPendiente({ ...estadoPendiente, mostrar: false });
          } catch (error) {
            console.error("Error al cambiar el estado:", error);
          }
        }}
        targetStatus={estadoPendiente.nuevoEstado}
        title={`Cambiar estado a ${
          estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"
        }`}
        message={`¿Estás seguro de que deseas marcar el servicio como ${
          estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"
        }?`}
        confirmText={
          estadoPendiente.nuevoEstado === 1 ? "Activar" : "Desactivar"
        }
        type={estadoPendiente.nuevoEstado === 1 ? "activate" : "deactivate"}
        details={estadoPendiente.nombreServicio}
        icon={<Zap size={24} />}
      />

      <ModalFormularioServicio
        isOpen={modalAbierto === "crear" || modalAbierto === "editar"}
        onClose={cerrarModal}
        onSave={handleGuardarServicio}
        servicio={servicioSeleccionado}
      />

      <ModalEliminarServicio
        isOpen={modalAbierto === "eliminar"}
        onClose={cerrarModal}
        onDelete={eliminarServicio}
        servicio={servicioSeleccionado}
      />

      <ModalVerServicio
        isOpen={modalAbierto === "ver"}
        onClose={cerrarModal}
        servicio={servicioSeleccionado}
      />
    </>
  );
};

export default ServiciosAdmin;
