import { useState, useEffect, useMemo, useCallback } from "react";
import { Users, UserPlus, Link2 } from "lucide-react";
import toast from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import BaseClienteModal from "./modalClientes";
import DataTable from "../../../components/dataTables/dataTable";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import {
  obtenerUsuariosClientes,
  crearUsuario as apiCrearUsuario,
  actualizarUsuario as apiActualizarUsuario,
  eliminarUsuario as apiEliminarUsuario,
  actualizarEstadoUsuario,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import { buscarUniversal } from "../../../../../shared/utils/búsquedaUniversal";
import {
  crearBeneficiario,
  obtenerBeneficiarios,
} from "../../../hooks/Beneficiarios_API/benefeiciarios_API";
import { obtenerMembresias } from "../../../hooks/Membresias_API_AD/Membresias_AD";
import { crearVenta } from "../../../hooks/Ventas_API/Ventas";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const CLIENT_ROLE_ID = 33;
const DASHBOARD_CLIENTS_REFRESH_EVENT = "dashboard:clientes-actualizados";

const NORMALIZE = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const extraerIdUsuarioRegistro = (registro = {}) =>
  toPositiveInt(
    registro?.id_usuario ??
      registro?.idUsuario ??
      registro?.usuario_id ??
      registro?.id
  );

const extraerIdRelacionRegistro = (registro = {}) =>
  toPositiveInt(
    registro?.id_relacion ??
      registro?.idRelacion ??
      registro?.relacion_id ??
      registro?.id_usuario_relacion
  );

const extraerIdMembresiaRegistro = (registro = {}) =>
  toPositiveInt(
    registro?.id_membresia ??
      registro?.id_membresias ??
      registro?.membresia_id ??
      registro?.membresia?.id_membresia ??
      registro?.membresia?.id_membresias ??
      registro?.membresia?.id
  );

const notifyClientsDashboardRefresh = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DASHBOARD_CLIENTS_REFRESH_EVENT));
};

const columnasClientesTabla = [
  { field: "id_usuario", header: "ID" },
  { field: "nombre_usuario", header: "Nombre" },
  { field: "email", header: "Correo" },
  { field: "telefono", header: "Teléfono" },
  {
    field: "id_estado",
    header: "Estado",
  },
];

export default function Clientes() {
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [accionModal, setAccionModal] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [membresias, setMembresias] = useState([]);
  const [beneficiarios, setBeneficiarios] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    id: null,
    nuevoEstado: null,
    nombreUsuario: "",
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clienteAEliminar, setClienteAEliminar] = useState(null);
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const cargarTodosLosClientes = useCallback(async (search = "") => {
    const defaultLimit = 100;
    const firstResponse = await obtenerUsuariosClientes({
      query: {
        page: 1,
        ...(search ? { search } : {}),
      },
    });

    const { items: firstBatch, totalPages } = normalizePaginatedResponse(
      firstResponse,
      {
        preferredKeys: ["usuarios", "data"],
        defaultPage: 1,
        defaultLimit,
      }
    );

    if (totalPages <= 1) {
      return firstBatch;
    }

    const remainingResponses = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) =>
        obtenerUsuariosClientes({
          query: {
            page: index + 2,
            ...(search ? { search } : {}),
          },
        })
      )
    );

    const remainingUsers = remainingResponses.flatMap((response) =>
      normalizePaginatedResponse(response, {
        preferredKeys: ["usuarios", "data"],
        defaultPage: 1,
        defaultLimit,
      }).items
    );

    return [...firstBatch, ...remainingUsers];
  }, []);

  const cargarClientes = useCallback(async ({
    search = searchQuery,
  } = {}) => {
    try {
      setIsLoading(true);

      const usuariosArray = await cargarTodosLosClientes(search);

      if (!usuariosArray.length) {
        setClientes([]);
        return;
      }

      const processedUsers = usuariosArray
        .filter(Boolean)
        .map((user) => {
          const userId = user.id_usuario ?? user.id;
          const roleId =
            user.rol_id ??
            user.id_rol ??
            user.roleId ??
            user.id_rol_rol?.id_rol ??
            user.id_rol_rol?.id ??
            CLIENT_ROLE_ID;

          const idEstado = Number(user.id_estado) === 2 ? 2 : 1;

          return {
            ...user,
            id_usuario: userId,
            rol_id: roleId,
            id_estado: idEstado,
            estado: idEstado === 1 ? "Activo" : "Inactivo",
            nombre_usuario:
              user.nombre_usuario ||
              user.nombre ||
              user.email ||
              "Cliente sin nombre",
            rol_nombre:
              user.rol_nombre ||
              user.id_rol_rol?.nombre_rol ||
              user.id_rol_rol?.nombre ||
              user.id_rol_rol?.name ||
              user.roleName,
          };
        });

      setClientes(processedUsers);
    } catch (error) {
      console.error("Error al cargar clientes:", error);
      toast.error(
        error.response?.data?.message || "Error al cargar la lista de clientes"
      );
      setClientes([]);
    } finally {
      setIsLoading(false);
    }
  }, [cargarTodosLosClientes, searchQuery]);

  const cargarMembresias = async () => {
    try {
      const res = await obtenerMembresias();
      const lista = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setMembresias(lista);
    } catch (error) {
      console.error("Error al cargar membresías:", error);
      toast.error("Error al cargar las membresías");
      setMembresias([]);
    }
  };

  const cargarBeneficiarios = async () => {
    try {
      const res = await obtenerBeneficiarios();
      const lista = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setBeneficiarios(lista);
    } catch (error) {
      console.error("[CLIENTES-GET] Error al cargar beneficiarios:", error);
      setBeneficiarios([]);
    }
  };

  useEffect(() => {
    cargarClientes({ search: searchQuery });
  }, [cargarClientes, searchQuery]);

  useEffect(() => {
    cargarMembresias();
    cargarBeneficiarios();
  }, []);

  const clientesConHandlers = useMemo(
    () => (searchQuery ? buscarUniversal(clientes, searchQuery) : clientes),
    [clientes, searchQuery]
  );

  const enriquecerClienteConMembresia = useCallback(
    (cliente) => {
      if (!cliente) return cliente;

      const idCliente = extraerIdUsuarioRegistro(cliente);
      if (!idCliente) return cliente;

      const registrosTitular = beneficiarios.filter(
        (beneficiario) => extraerIdUsuarioRegistro(beneficiario) === idCliente
      );

      const registroAuto = registrosTitular.find((beneficiario) => {
        const idRelacion = extraerIdRelacionRegistro(beneficiario);
        const idMembresia = extraerIdMembresiaRegistro(beneficiario);
        return idRelacion === idCliente && Boolean(idMembresia);
      });

      const idMembresia = extraerIdMembresiaRegistro(
        registroAuto ||
          registrosTitular.find((beneficiario) =>
            extraerIdMembresiaRegistro(beneficiario)
          ) ||
          cliente
      );

      if (!idMembresia) return cliente;

      const membresia = membresias.find((item) => {
        const id = toPositiveInt(
          item?.id_membresia ?? item?.id_membresias ?? item?.id
        );
        return id === idMembresia;
      });

      const nombreMembresia =
        membresia?.nombre_membresia ??
        membresia?.nombre ??
        cliente?.nombre_membresia ??
        `Membresía ${idMembresia}`;

      return {
        ...cliente,
        id_membresia: idMembresia,
        id_membresias: idMembresia,
        nombre_membresia: nombreMembresia,
      };
    },
    [beneficiarios, membresias]
  );

  const manejarCrearCliente = async (nuevoCliente) => {
    try {
      setIsLoading(true);
      if (
        !nuevoCliente.nombre_usuario ||
        !nuevoCliente.email ||
        !nuevoCliente.password
      ) {
        throw new Error(
          "Nombre, correo electrónico y contraseña son campos requeridos"
        );
      }

      const clienteParaEnviar = {
        ...nuevoCliente,
        id_estado: parseInt(nuevoCliente.id_estado, 10) || 1,
        rol_id: CLIENT_ROLE_ID,
      };

      const respuesta = await apiCrearUsuario(clienteParaEnviar);
      await cargarClientes();
      notifyClientsDashboardRefresh();
      cerrarModal();
      toast.success("Cliente creado exitosamente");
      return respuesta || true;
    } catch (error) {
      console.error("Error al crear el cliente:", error);
      toast.error(getApiErrorMessage(error, "Error al crear el cliente"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const manejarActualizarCliente = async (clienteActualizado) => {
    try {
      setIsLoading(true);
      const idUsuarioActualizar =
        toPositiveInt(clienteActualizado?.id_usuario) ??
        toPositiveInt(clienteActualizado?.id) ??
        toPositiveInt(clienteSeleccionado?.id_usuario) ??
        toPositiveInt(clienteSeleccionado?.id);

      if (!idUsuarioActualizar) {
        throw new Error("No se encontró el ID del cliente a actualizar.");
      }

      const clienteParaActualizar = {
        ...clienteActualizado,
        id_usuario: idUsuarioActualizar,
        id_estado: parseInt(clienteActualizado.id_estado, 10) || 1,
        rol_id: CLIENT_ROLE_ID,
      };

      await apiActualizarUsuario(idUsuarioActualizar, clienteParaActualizar);

      await cargarClientes();
      notifyClientsDashboardRefresh();
      cerrarModal();
      toast.success("Cliente actualizado exitosamente");
      return true;
    } catch (error) {
      console.error("Error al actualizar el cliente:", error);
      toast.error(getApiErrorMessage(error, "Error al actualizar el cliente"));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const manejarEliminarCliente = async (cliente) => {
    try {
      const usuarioActual = JSON.parse(localStorage.getItem("user"));

      const currentUserId = usuarioActual?.id_usuario || usuarioActual?.id;
      if (
        usuarioActual &&
        String(currentUserId) === String(cliente.id_usuario)
      ) {
        toast.error(
          "el usuario a editar o eliminar esta con su sesión iniciada y no puedes hacer esto"
        );
        return;
      }

      setIsLoading(true);
      await apiEliminarUsuario(cliente.id_usuario);
      await cargarClientes();
      notifyClientsDashboardRefresh();
      toast.success("Cliente eliminado exitosamente");
    } catch (error) {
      console.error("Error al eliminar el cliente:", error);
      toast.error(getApiErrorMessage(error, "Error al eliminar el cliente"));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (rowActualizado, nuevoEstadoTexto) => {
    const id = rowActualizado.id_usuario;
    const nuevoEstado =
      nuevoEstadoTexto === "ACTIVO" || nuevoEstadoTexto === "Activo" ? 1 : 2;

    setClientes((prev) =>
      prev.map((c) =>
        c.id_usuario === id
          ? {
              ...c,
              id_estado: nuevoEstado,
              estado: nuevoEstado === 1 ? "Activo" : "Inactivo",
            }
          : c
      )
    );

    try {
      await actualizarEstadoUsuario(id, nuevoEstado);
      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);
      notifyClientsDashboardRefresh();

      setTimeout(() => {
        cargarClientes({ search: searchQuery });
      }, 500);
    } catch (error) {
      console.error("Error al actualizar el estado:", error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      cargarClientes({ search: searchQuery });
    }
  };

  const abrirModalEliminar = (cliente) => {
    if (!cliente) return;

    const usuarioActual = JSON.parse(localStorage.getItem("user"));

    const currentUserId = usuarioActual?.id_usuario || usuarioActual?.id;
    if (usuarioActual && String(currentUserId) === String(cliente.id_usuario)) {
      toast.error(
        "el usuario a editar o eliminar esta con su sesión iniciada y no puedes hacer esto"
      );
      return;
    }

    setClienteAEliminar(cliente);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (cliente) => {
    try {
      await manejarEliminarCliente(cliente);
      setIsDeleteModalOpen(false);
      setClienteAEliminar(null);
    } catch (error) {
      // Error manejado en manejarEliminarCliente
    }
  };

  const abrirModal = (accion, cliente = null) => {
    if (accion === "editar" && cliente) {
      const usuarioActual = JSON.parse(localStorage.getItem("user"));
      const currentUserId = usuarioActual?.id_usuario || usuarioActual?.id;
      if (
        usuarioActual &&
        String(currentUserId) === String(cliente.id_usuario)
      ) {
        toast.error(
          "el usuario a editar o eliminar esta con su sesión iniciada y no puedes hacer esto"
        );
        return;
      }
    }
    const clienteConMembresia =
      cliente && (accion === "ver" || accion === "editar")
        ? enriquecerClienteConMembresia(cliente)
        : cliente;

    setClienteSeleccionado(clienteConMembresia);
    setAccionModal(accion);
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setClienteSeleccionado(null);
  };

  return (
    <div className="main-ad-column">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Users size={40} className="icono-titulo" color="red" />
          <h1>Gestion de Clientes</h1>
        </div>
        <div className="acciones-derecha">
          <button
            className="boton boton-primario"
            onClick={() => abrirModal("crear")}
            disabled={isLoading || !canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            <UserPlus size={18} />
            Nuevo Cliente
          </button>
          <button
            className="boton boton-secundario"
            onClick={() => abrirModal("relacionar")}
            disabled={isLoading}
          >
            <Link2 size={18} />
            Relacionar Beneficiario
          </button>
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar clientes..."
            className="expandido"
          />
        </div>
      </div>

      <div className="table-container">
        <DataTable
          permisoId={permisoId}
          columns={columnasClientesTabla}
          data={clientesConHandlers}
          loading={isLoading}
          paginationMode="client"
          onRefresh={async () => {
            await Promise.all([
              cargarClientes({ search: searchQuery }),
              cargarBeneficiarios(),
              cargarMembresias(),
            ]);
          }}
          onEdit={(cliente) => abrirModal("editar", cliente)}
          onView={(cliente) => abrirModal("ver", cliente)}
          onDelete={abrirModalEliminar}
          canEdit={() => canEdit}
          canDelete={() => canDelete}
          onStatusChange={handleStatusChange}
          statusConfig={{
            values: { active: "Activo", inactive: "Inactivo" },
            colors: { active: "#4caf50", inactive: "#f44336" },
          }}
          emptyTitle="No se encontraron clientes"
          emptyMessage="No hay clientes disponibles para mostrar en la página actual."
        />
      </div>

      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={() =>
          setEstadoPendiente({ ...estadoPendiente, mostrar: false })
        }
        onConfirm={async () => {
          try {
            await handleStatusChange(
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
        message={`Estas seguro de que deseas marcar a ${
          estadoPendiente.nombreUsuario
        } como ${estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"}?`}
        confirmText={
          estadoPendiente.nuevoEstado === 1 ? "Activar" : "Desactivar"
        }
        type={estadoPendiente.nuevoEstado === 1 ? "activate" : "deactivate"}
        details={estadoPendiente.nombreUsuario}
      />

      {accionModal === "crear" && canCreate && (
        <BaseClienteModal
          title="Nuevo Cliente"
          initialData={{}}
          onClose={cerrarModal}
          onSave={manejarCrearCliente}
          beneficiarios={beneficiarios}
          membresias={membresias}
          onRefreshBeneficiarios={cargarBeneficiarios}
          isOpen
        />
      )}

      {accionModal === "ver" && clienteSeleccionado && (
        <BaseClienteModal
          title="Detalles del Cliente"
          initialData={clienteSeleccionado}
          onClose={cerrarModal}
          beneficiarios={beneficiarios}
          membresias={membresias}
          onRefreshBeneficiarios={cargarBeneficiarios}
          isOpen
          disabled
        />
      )}

      {accionModal === "editar" && clienteSeleccionado && (
        <BaseClienteModal
          title="Editar Cliente"
          initialData={clienteSeleccionado}
          onClose={cerrarModal}
          onSave={manejarActualizarCliente}
          beneficiarios={beneficiarios}
          membresias={membresias}
          onRefreshBeneficiarios={cargarBeneficiarios}
          isOpen
        />
      )}

      {accionModal === "relacionar" && (
        <BaseClienteModal
          title="Relacionar Titular y Beneficiario"
          initialData={{}}
          onClose={cerrarModal}
          onSave={async () => true}
          beneficiarios={beneficiarios}
          membresias={membresias}
          onRefreshBeneficiarios={cargarBeneficiarios}
          isOpen
          modoRelacionManual
        />
      )}

      {clienteAEliminar && (
        <DeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setClienteAEliminar(null);
          }}
          onConfirm={handleConfirmDelete}
          item={clienteAEliminar}
          title="Eliminar Cliente"
          fields={[
            {
              key: "nombre_usuario",
              label: "Nombre",
              format: (value) => (
                <strong>{value || "Cliente sin nombre"}</strong>
              ),
            },
            {
              key: "email",
              label: "Correo",
              format: (value) => value || "Sin correo electrónico",
            },
            {
              key: "documento",
              label: "Documento",
              format: (value) => value || "No especificado",
            },
            {
              key: "telefono",
              label: "Teléfono",
              format: (value) => value || "No especificado",
            },
          ]}
          warningMessage="Esta acción no se puede deshacer. El cliente sera eliminado permanentemente del sistema junto con todo su historial."
        />
      )}
    </div>
  );
}
