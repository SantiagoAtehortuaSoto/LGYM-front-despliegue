import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, UserCheck } from "lucide-react";
import toast from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import {
  ModalCrearAsistencia,
  ModalVerAsistencia,
  ModalEditarAsistencia,
  ModalEliminarAsistencia,
} from "./modalAsistencia";
import DataTable from "../../../components/dataTables/dataTable";
import useAsistencias, {
  ASISTENCIA_TIPOS,
} from "../../../hooks/Asistencias_API/UseAsistencias";
import { ESTADOS_APP, SelectorEstado } from "../../../components/dataTables/badgesEstado";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import { obtenerUsuarios } from "../../../hooks/Usuarios_API/API_Usuarios";
import { buscarUniversal } from "../../../../../shared/utils/búsquedaUniversal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";
import "../../../../../shared/styles/restructured/pages/asistencias-page.css";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const OPCIONES_ESTADO_CITA = [
  { value: ESTADOS_APP.EN_PROCESO, label: "En proceso" },
  { value: ESTADOS_APP.ASISTIO, label: "Asistio" },
  { value: ESTADOS_APP.RETRASADO, label: "Retrasado" },
  { value: ESTADOS_APP.NO_ASISTIO, label: "No asistio" },
];
const OPCIONES_ESTADO_CITA_CON_PENDIENTE = [
  { value: ESTADOS_APP.PENDIENTE, label: "Pendiente" },
  ...OPCIONES_ESTADO_CITA,
];

export default function Asistencias() {
  const [asistenciaSeleccionada, setAsistenciaSeleccionada] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoAsistencia, setTipoAsistencia] = useState(ASISTENCIA_TIPOS.CLIENTE);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    asistencia: null,
    nuevoEstado: null,
    nuevoEstadoTexto: "",
  });
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const {
    asistencias,
    loading,
    error,
    pagination,
    setPagination,
    crearAsistencia,
    actualizarAsistencia,
    eliminarAsistencia,
    recargar,
  } = useAsistencias(tipoAsistencia, searchQuery);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery, setPagination]);

  const cargarUsuarios = useCallback(async () => {
    try {
      const res = await obtenerUsuarios();
      const lista = Array.isArray(res) ? res : res?.data || [];
      const mapa = lista.reduce((acc, u) => {
        const id = u?.id_usuario ?? u?.id;
        if (id === null || id === undefined) return acc;
        acc[id] = u?.nombre_usuario || u?.nombre || u?.email || `Usuario ${id}`;
        return acc;
      }, {});
      setUsuariosMap(mapa);
    } catch (err) {
      console.error("Error cargando usuarios para asistencias:", err);
      setUsuariosMap({});
    }
  }, []);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const getNombreUsuario = useCallback((row = {}) => {
    const idUsuario = row?.id_usuario;
    return (
      row?.nombre_usuario ||
      row?.usuario_nombre ||
      row?.id_usuario_usuario?.nombre_usuario ||
      row?.id_usuario_usuario?.nombre ||
      usuariosMap[idUsuario] ||
      (idUsuario ? `Usuario ${idUsuario}` : "-")
    );
  }, [usuariosMap]);

  const manejarCambioEstadoRapido = useCallback(
    async (asistencia, nuevoEstado) => {
      if (!asistencia?.id) return;
      try {
        await actualizarAsistencia(asistencia.id, { id_estado: Number(nuevoEstado) });
        toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);
      } catch (err) {
        toast.error(STATUS_CHANGE_ERROR_MESSAGE);
        console.error("Error al actualizar el estado de la asistencia:", err);
      }
    },
    [actualizarAsistencia]
  );

  const abrirConfirmacionCambioEstado = useCallback((asistencia, nuevoEstado) => {
    const nuevoEstadoNum = Number(nuevoEstado);
    const nuevoEstadoTexto =
      OPCIONES_ESTADO_CITA_CON_PENDIENTE.find(
        (opcion) => Number(opcion.value) === nuevoEstadoNum
      )?.label || `Estado ${nuevoEstadoNum}`;

    setEstadoPendiente({
      mostrar: true,
      asistencia,
      nuevoEstado: nuevoEstadoNum,
      nuevoEstadoTexto,
    });
  }, []);

  const cerrarConfirmacionCambioEstado = useCallback(() => {
    setEstadoPendiente({
      mostrar: false,
      asistencia: null,
      nuevoEstado: null,
      nuevoEstadoTexto: "",
    });
  }, []);

  const confirmarCambioEstado = useCallback(async () => {
    if (!estadoPendiente.asistencia || estadoPendiente.nuevoEstado === null) return;
    await manejarCambioEstadoRapido(
      estadoPendiente.asistencia,
      estadoPendiente.nuevoEstado
    );
    cerrarConfirmacionCambioEstado();
  }, [estadoPendiente, manejarCambioEstadoRapido, cerrarConfirmacionCambioEstado]);

  const renderEstadoEditable = useCallback(
    ({ value, row }) => {
      const estadoActual = Number(value);
      const opciones =
        estadoActual === ESTADOS_APP.PENDIENTE
          ? OPCIONES_ESTADO_CITA_CON_PENDIENTE
          : OPCIONES_ESTADO_CITA;

      return (
        <SelectorEstado
          estadoActual={estadoActual}
          tamano="pequeño"
          opciones={opciones}
          onCambioEstado={(nuevoEstado) => abrirConfirmacionCambioEstado(row, nuevoEstado)}
        />
      );
    },
    [abrirConfirmacionCambioEstado]
  );

  const columnasClientes = useMemo(
    () => [
      { field: "id", header: "ID" },
      {
        field: "actividad_cita",
        header: "Actividad",
        Cell: ({ value, row }) =>
          value ||
          row?.actividad_agenda ||
          row?.actividad ||
          row?.descripcion_agenda ||
          (row?.id_cita ? `Cita ${row.id_cita}` : "-"),
      },
      {
        field: "id_usuario",
        header: "Cliente",
        Cell: ({ row }) => getNombreUsuario(row),
      },
      { field: "fecha_asistencia", header: "Fecha" },
      { field: "hora_ingreso", header: "Ingreso" },
      {
        field: "hora_salida",
        header: "Salida",
        Cell: ({ value, row }) =>
          value ||
          row?.hora_salida_cliente ||
          row?.horaSalida ||
          row?.hora_fin ||
          row?.horaFin ||
          row?.salida ||
          "-",
      },
      {
        field: "id_estado",
        header: "Estado",
        Cell: renderEstadoEditable,
      },
    ],
    [getNombreUsuario, renderEstadoEditable]
  );

  const columnasEmpleados = useMemo(
    () => [
      { field: "id", header: "ID" },
      {
        field: "id_usuario",
        header: "Empleado",
        Cell: ({ row }) => getNombreUsuario(row),
      },
      { field: "asistencia_fecha", header: "Fecha" },
      { field: "hora_entrada_empleado", header: "Entrada" },
      {
        field: "hora_salida_empleado",
        header: "Salida",
        Cell: ({ value, row }) =>
          value ||
          row?.hora_salida ||
          row?.horaSalidaEmpleado ||
          row?.horaSalida ||
          row?.hora_fin ||
          row?.horaFin ||
          row?.salida ||
          "-",
      },
      {
        field: "id_estado",
        header: "Estado",
        Cell: renderEstadoEditable,
      },
      { field: "observaciones", header: "Observaciones" },
    ],
    [getNombreUsuario, renderEstadoEditable]
  );

  const columnasAsistencias = useMemo(
    () =>
      tipoAsistencia === ASISTENCIA_TIPOS.CLIENTE
        ? columnasClientes
        : columnasEmpleados,
    [tipoAsistencia, columnasClientes, columnasEmpleados]
  );

  const manejarCrearAsistencia = async (payload) => {
    try {
      await crearAsistencia(payload);
      cerrarModal();
      toast.success("Asistencia registrada exitosamente");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al registrar la asistencia"));
      console.error("Error al crear la asistencia:", error);
      return false;
    }
  };

  const manejarActualizarAsistencia = async (payload) => {
    if (!asistenciaSeleccionada?.id) return false;
    try {
      await actualizarAsistencia(asistenciaSeleccionada.id, payload);
      cerrarModal();
      toast.success("Asistencia actualizada exitosamente");
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al actualizar la asistencia"));
      console.error("Error al actualizar la asistencia:", error);
      return false;
    }
  };

  const manejarEliminarAsistencia = async (asistenciaAEliminar) => {
    if (!asistenciaAEliminar?.id) return;
    try {
      await eliminarAsistencia(asistenciaAEliminar.id);
      toast.success("Asistencia eliminada exitosamente");
      cerrarModal();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Error al eliminar la asistencia"));
      console.error("Error al eliminar la asistencia:", error);
    }
  };

  const abrirModal = (accion, asistencia = null) => {
    setAsistenciaSeleccionada(asistencia);
    setAccionModal(accion);
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setAsistenciaSeleccionada(null);
  };

  return (
    <div className="contenido-principal">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Calendar size={40} className="icono-titulo" color="red" />
          <h1>Gestión de Asistencias</h1>
        </div>
        <div className="acciones-derecha">
          <div className="asistencias-toggle-group">
            <button
              type="button"
              className={`boton boton-secundario asistencias-toggle-btn ${
                tipoAsistencia === ASISTENCIA_TIPOS.CLIENTE ? "is-active-clientes" : ""
              }`}
              onClick={() => setTipoAsistencia(ASISTENCIA_TIPOS.CLIENTE)}
            >
              Clientes
            </button>
            <button
              type="button"
              className={`boton boton-secundario asistencias-toggle-btn ${
                tipoAsistencia === ASISTENCIA_TIPOS.EMPLEADO ? "is-active-empleados" : ""
              }`}
              onClick={() => setTipoAsistencia(ASISTENCIA_TIPOS.EMPLEADO)}
            >
              Empleados
            </button>
          </div>
          <button
            className="boton boton-primario"
            onClick={() => abrirModal("crear")}
            disabled={!canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            <UserCheck size={20} className="mr-1" />
            Nueva Asistencia {tipoAsistencia === ASISTENCIA_TIPOS.CLIENTE ? "Cliente" : "Empleado"}
          </button>
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar asistencias..."
            className="expandido"
          />
        </div>
      </div>

      <div className="table-container">
        <DataTable
          permisoId={permisoId}
          columns={columnasAsistencias}
          data={searchQuery ? buscarUniversal(asistencias, searchQuery) : asistencias}
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
            await Promise.all([
              recargar({
                page: pagination.page,
                limit: pagination.limit,
                search: searchQuery,
              }),
              cargarUsuarios(),
            ]);
          }}
          onView={(asistencia) => abrirModal("ver", asistencia)}
          onEdit={(asistencia) => abrirModal("editar", asistencia)}
          onDelete={(asistencia) => abrirModal("eliminar", asistencia)}
          canEdit={() => canEdit}
          canDelete={() => canDelete}
          emptyTitle="No se encontraron asistencias"
          emptyMessage="No hay asistencias disponibles para mostrar en la página actual."
        />
        {error && (
          <p className="asistencias-error">
            {error.message || "Error al cargar asistencias"}
          </p>
        )}
      </div>

      {accionModal === "crear" && canCreate && (
        <ModalCrearAsistencia
          isOpen={true}
          onClose={cerrarModal}
          onSave={manejarCrearAsistencia}
          tipo={tipoAsistencia}
        />
      )}

      {accionModal === "ver" && asistenciaSeleccionada && (
        <ModalVerAsistencia
          isOpen={true}
          onClose={cerrarModal}
          asistencia={asistenciaSeleccionada}
          tipo={tipoAsistencia}
        />
      )}

      {accionModal === "editar" && asistenciaSeleccionada && (
        <ModalEditarAsistencia
          isOpen={true}
          onClose={cerrarModal}
          asistencia={asistenciaSeleccionada}
          onSave={manejarActualizarAsistencia}
          tipo={tipoAsistencia}
        />
      )}

      {accionModal === "eliminar" && asistenciaSeleccionada && (
        <ModalEliminarAsistencia
          isOpen={true}
          onClose={cerrarModal}
          asistencia={asistenciaSeleccionada}
          onConfirm={manejarEliminarAsistencia}
          tipo={tipoAsistencia}
        />
      )}

      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={cerrarConfirmacionCambioEstado}
        onConfirm={confirmarCambioEstado}
        targetStatus={estadoPendiente.nuevoEstado}
        title="Cambiar estado de asistencia"
        message={`¿Seguro que deseas cambiar el estado a ${estadoPendiente.nuevoEstadoTexto}?`}
        confirmText={estadoPendiente.nuevoEstadoTexto || "Confirmar"}
        type={estadoPendiente.nuevoEstado === ESTADOS_APP.NO_ASISTIO ? "deactivate" : "activate"}
        details={
          estadoPendiente.asistencia
            ? getNombreUsuario(estadoPendiente.asistencia)
            : "Asistencia"
        }
      />
    </div>
  );
}
