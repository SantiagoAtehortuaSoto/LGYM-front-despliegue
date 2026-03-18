import { useEffect, useMemo, useState } from "react";
import { Plus, ScrollText } from "lucide-react";
import toast from "react-hot-toast";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import { ConfirmModal } from "../../../../../shared/components/ConfirmModal/confirmModal";
import {
  ModalFormularioMembresia,
  ModalEliminarMembresia,
  ModalVerMembresia,
} from "./modalMemresias";

import {
  getMembresias,
  crearMembresia,
  actualizarMembresia,
  actualizarEstadoMembresia,
  eliminarMembresia,
} from "../../../hooks/Membresia_API/Membresia.jsx";
import { obtenerBeneficiarios } from "../../../hooks/Beneficiarios_API/benefeiciarios_API";
import { obtenerUsuarios } from "../../../hooks/Usuarios_API/API_Usuarios.jsx";
import { getApiErrorMessage } from "../../../../../shared/utils/apiErrorMessage";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";
import {
  STATUS_CHANGE_ERROR_MESSAGE,
  STATUS_CHANGE_SUCCESS_MESSAGE,
} from "../../../../../shared/utils/statusChangeMessages";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

// Definición de columnas para la tabla de membresías
const columnasMembresias = [
  { field: "id", header: "ID" },
  { field: "nombre", header: "Nombre" },
  { field: "descripcion", header: "Descripción" },
      {
        field: "precioVenta",
        header: "Precio Venta",
        format: (value) => `$${Number(value || 0).toLocaleString()}`,
      },
      {
        field: "duracion_dias",
        header: "Duración (días)",
        format: (value) => `${value || 0} días`,
      },
  {
    field: "id_estado",
    header: "Estado",
    Cell: ({ value, row }) => {
      // Verificar si el valor es 'Activo' o 1
      const esActivo =
        value === "Activo" ||
        value === 1 ||
        value === "1" ||
        value === "activo";

      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (row.onStatusChange) {
              row.onStatusChange(row);
            }
          }}
          className={`badge-estado badge-pequeno badge-con-borde badge-estado--interactive ${
            esActivo ? "badge-tone--activo" : "badge-tone--inactivo"
          }`}
        >
          <span className="badge-content">{esActivo ? "ACTIVO" : "INACTIVO"}</span>
        </button>
      );
    },
  },
];

/* ---------------- Normalizadores ---------------- */
function normalizarItem(item) {
  const id =
    item.id ??
    item._id ??
    item.idMembresia ??
    item.id_membresia ??
    item.id_membresias ??
    item.uuid ??
    item.codigo ??
    null;

  const codigo =
    item.codigo ??
    item.code ??
    item.codigo_membresia ??
    (id ? `MEM-${String(id).padStart(3, "0")}` : "MEM-000");

  const nombre =
    item.nombre ?? item.name ?? item.titulo ?? item.nombre_membresia ?? "—";

  const descripcion =
    item.descripcion ??
    item.description ??
    item.detalle ??
    item.descripcion_membresia ??
    "—";

  const precioVentaRaw =
    item.precioVenta ??
    item.precio_venta ??
    item.precio ??
    item.price ??
    item.valor ??
    item.precio_de_venta ??
    0;

  const precioVenta = Number(precioVentaRaw) || 0;

  let estado = item.estado ?? item.status;
  let id_estado = item.id_estado;

  if (!estado) {
    if (id_estado !== undefined && id_estado !== null) {
      estado = Number(id_estado) === 1 ? "Activo" : "Inactivo";
    } else if (typeof item.activo === "boolean") {
      estado = item.activo ? "Activo" : "Inactivo";
      id_estado = item.activo ? 1 : 2;
    } else {
      estado = "Inactivo";
      id_estado = 2;
    }
  }

  const fechaCreacion =
    item.fechaCreacion ?? item.fecha_creacion ?? item.createdAt ?? "";
  const duracionDias = item.duracion_dias ?? item.duracion ?? item.periodo ?? 0;

  // Procesar detalles de membresías (servicios asociados)
  const detallesMembresias = item.detalles_membresias ?? [];
  const serviciosIds = detallesMembresias
    .filter(detalle => detalle.id_estado === 1) // Solo servicios activos
    .map(detalle => detalle.id_servicio)
    .filter(id => id != null);

  // Mantener beneficios como array de IDs para compatibilidad con el modal de edición
  const beneficios = serviciosIds;

  return {
    id: id ?? "-",
    codigo,
    nombre,
    descripcion,
    precioVenta,
    estado,
    id_estado,
    fechaCreacion,
    duracion_dias: duracionDias, // Campo correcto según BD
    duracion: duracionDias, // Alias para compatibilidad
    beneficios,
    detalles_membresias: detallesMembresias, // Agregar detalles completos
  };
}

function pickArray(obj) {
  if (Array.isArray(obj)) return obj;
  if (!obj || typeof obj !== "object") return [];
  const preferred = ["data", "results", "membresias", "items", "memberships"];
  for (const k of preferred) {
    if (Array.isArray(obj?.[k])) return obj[k];
  }
  for (const k of Object.keys(obj)) {
    if (Array.isArray(obj[k])) return obj[k];
  }
  return [];
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function extractMembershipId(record = {}) {
  return toPositiveInt(
    record?.id_membresia ??
      record?.id_membresias ??
      record?.membresia_id ??
      record?.id_membresia_fk ??
      record?.membresia?.id_membresia ??
      record?.membresia?.id_membresias ??
      record?.membresia?.id,
  );
}

function extractRelatedUserIds(record = {}) {
  const ids = [
    toPositiveInt(
      record?.id_usuario ??
        record?.idUsuario ??
        record?.usuario_id ??
        record?.usuario?.id_usuario ??
        record?.usuario?.id,
    ),
    toPositiveInt(
      record?.id_relacion ??
        record?.idRelacion ??
        record?.relacion_id ??
        record?.id_usuario_relacion ??
        record?.relacion?.id_usuario ??
        record?.relacion?.id,
    ),
  ].filter(Boolean);

  return [...new Set(ids)];
}

function isUserActive(user = {}) {
  const estado = user?.id_estado ?? user?.estado ?? user?.status;
  if (estado !== undefined && estado !== null) {
    if (Number(estado) === 1) return true;
    if (Number(estado) === 2) return false;
    const normalized = String(estado).trim().toLowerCase();
    if (normalized === "activo" || normalized === "active") return true;
    if (
      normalized === "inactivo" ||
      normalized === "inactive" ||
      normalized === "desactivado" ||
      normalized === "disabled"
    ) {
      return false;
    }
  }

  if (typeof user?.activo === "boolean") return user.activo;
  return false;
}

/* ---------------- Componente principal ---------------- */
const MembresiasAdmin = () => {
  const [membresias, setMembresias] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(null);
  const [membresiaSeleccionada, setMembresiaSeleccionada] = useState(null);
  const [estadoPendiente, setEstadoPendiente] = useState({
    mostrar: false,
    membresia: null,
    nuevoEstado: null,
    nombreMembresia: "",
    asociacionesActivas: 0,
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem("token") || undefined;
    } catch {
      return undefined;
    }
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const searchQuery = filtro.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  /* 🔸 Actualiza token si cambia en localStorage */
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token") {
        try {
          setToken(localStorage.getItem("token") || undefined);
        } catch {
          setToken(undefined);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* 🔸 Cargar membresías desde API */
  async function cargarMembresias({
    page = pagination.page,
    limit = pagination.limit,
    search = searchQuery,
  } = {}) {
    try {
      setIsLoading(true);
      const data = await getMembresias({
        token,
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
        preferredKeys: ["membresias", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });
      setMembresias(items.map(normalizarItem));
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (error) {
      console.error("Error al cargar membresías:", error);
      toast.error("Error al cargar las membresías");
      setMembresias([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    cargarMembresias({
      page: pagination.page,
      limit: pagination.limit,
      search: searchQuery,
    });
  }, [token, pagination.page, pagination.limit, searchQuery]);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery]);

  /* 🔸 Cambiar estado - abre modal de confirmación */
  const contarAsociacionesActivas = async (idMembresia) => {
    try {
      const [beneficiariosRes, usuariosRes] = await Promise.all([
        obtenerBeneficiarios(),
        obtenerUsuarios(),
      ]);

      const beneficiarios = pickArray(beneficiariosRes);
      const usuarios = pickArray(usuariosRes);
      const usuariosActivos = new Set(
        usuarios
          .filter((usuario) => isUserActive(usuario))
          .map((usuario) =>
            toPositiveInt(usuario?.id_usuario ?? usuario?.id ?? usuario?.usuario_id),
          )
          .filter(Boolean),
      );

      const asociados = new Set();
      beneficiarios.forEach((registro) => {
        if (extractMembershipId(registro) !== idMembresia) return;
        extractRelatedUserIds(registro).forEach((id) => asociados.add(id));
      });

      let activos = 0;
      asociados.forEach((id) => {
        if (usuariosActivos.has(id)) activos += 1;
      });

      return activos;
    } catch (error) {
      console.error(
        "No se pudo calcular asociaciones activas de la membresía:",
        error,
      );
      return 0;
    }
  };

  const handleStatusChange = async (membresia) => {
    const nuevoEstado = Number(membresia.id_estado) === 1 ? 2 : 1;
    let asociacionesActivas = 0;
    if (nuevoEstado === 2) {
      const idMembresia = toPositiveInt(membresia?.id);
      if (idMembresia) {
        asociacionesActivas = await contarAsociacionesActivas(idMembresia);
      }
    }

    setEstadoPendiente({
      mostrar: true,
      membresia,
      nuevoEstado,
      asociacionesActivas,
      nombreMembresia: membresia.nombre || "esta membresía",
    });
  };

  const membresiasFiltradas = useMemo(
    () => {
      const base = searchQuery
        ? membresias.filter((m) =>
            ["codigo", "nombre", "descripcion", "duracion_dias", "duracion", "estado"].some((campo) =>
              String(m[campo] || "")
                .toLowerCase()
                .includes(searchQuery.toLowerCase()),
            ),
          )
        : membresias;

      return base.map((m) => ({ ...m, onStatusChange: handleStatusChange }));
    },
    [membresias, handleStatusChange, searchQuery],
  );

  /* 🔸 Confirmar cambio de estado */
  const confirmarCambioEstado = async () => {
    if (!estadoPendiente.membresia?.id) return;

    const { membresia, nuevoEstado } = estadoPendiente;

    // Actualizar estado local de forma optimista
    setMembresias((prevMembresias) =>
      prevMembresias.map((m) =>
        m.id === membresia.id
          ? {
              ...m,
              id_estado: nuevoEstado,
              estado: nuevoEstado === 1 ? "Activo" : "Inactivo",
            }
          : m,
      ),
    );

    try {
      await actualizarEstadoMembresia(membresia.id, nuevoEstado, { token });

      toast.success(STATUS_CHANGE_SUCCESS_MESSAGE);

      // Recargar desde el backend tras un breve delay para asegurar sincronización
      setTimeout(() => {
        cargarMembresias();
      }, 500);
    } catch (error) {
      console.error("Error al actualizar el estado:", error);
      toast.error(STATUS_CHANGE_ERROR_MESSAGE);
      cargarMembresias();
    } finally {
      setEstadoPendiente({
        mostrar: false,
        membresia: null,
        nuevoEstado: null,
        nombreMembresia: "",
        asociacionesActivas: 0,
      });
    }
  };

  /* 🔸 Crear membresía */
  const handleCrearMembresia = async (payload) => {
    try {
      setIsLoading(true);
      await crearMembresia(payload, { token });
      toast.success("Membresía creada exitosamente");
      await cargarMembresias();
      setModalAbierto(null);
      return true;
    } catch (error) {
      console.error("Error al crear membresía:", error);
      toast.error(getApiErrorMessage(error, "Error al crear membresía"));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /* 🔸 Editar membresía */
  const handleEditarMembresia = async (payload) => {
    try {
      if (!membresiaSeleccionada?.id)
        throw new Error("ID de membresía no válido");
      setIsLoading(true);
      await actualizarMembresia(membresiaSeleccionada.id, payload, { token });
      toast.success("Membresía actualizada correctamente");
      await cargarMembresias();
      setModalAbierto(null);
      return true;
    } catch (error) {
      console.error("Error al editar membresía:", error);
      toast.error(getApiErrorMessage(error, "Error al actualizar membresía"));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /* 🔸 Eliminar membresía */
  const handleEliminarMembresia = async () => {
    try {
      if (!membresiaSeleccionada?.id)
        throw new Error("ID de membresía no válido");
      setIsLoading(true);
      await eliminarMembresia(membresiaSeleccionada.id, { token });
      toast.success("Membresía eliminada correctamente");
      setPagination((prev) => ({ ...prev, page: 1 }));
      await cargarMembresias({
        page: 1,
        limit: pagination.limit,
        search: filtro,
      });
      setModalAbierto(null);
    } catch (error) {
      console.error("Error al eliminar membresía:", error);
      toast.error(getApiErrorMessage(error, "Error al eliminar membresía"));
    } finally {
      setIsLoading(false);
    }
  };

  /* 🔸 Modales */
  const abrirModal = (tipo, item = null) => {
    setMembresiaSeleccionada(item);
    setModalAbierto(tipo);
  };

  const cerrarModal = () => {
    setModalAbierto(null);
    setMembresiaSeleccionada(null);
  };

  /* 🔸 Render */
  return (
    <div className="contenido-dashboard">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <ScrollText size={40} className="icono-titulo" color="red" />
          <h1>Gestión de Membresías</h1>
        </div>

        <div className="acciones-derecha">
          <button
            onClick={() => abrirModal("crear")}
            className="boton boton-primario"
            disabled={!canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            <Plus size={18} />
            Nueva Membresía
          </button>

          <BuscadorUniversal
            value={filtro}
            onChange={setFiltro}
            placeholder="Buscar membresías..."
            className="expandido"
          />
        </div>
      </div>

      <DataTable
        permisoId={permisoId}
        columns={columnasMembresias}
        data={membresiasFiltradas}
        loading={isLoading}
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
          cargarMembresias({
            page: pagination.page,
            limit: pagination.limit,
            search: searchQuery,
          })
        }
        onView={(m) => abrirModal("ver", m)}
        onEdit={(m) => abrirModal("editar", m)}
        onDelete={(m) => abrirModal("eliminar", m)}
        canEdit={() => canEdit}
        canDelete={() => canDelete}
        onStatusChange={handleStatusChange}
        statusConfig={{
          values: { active: "Activo", inactive: "Inactivo" },
          colors: { active: "#4caf50", inactive: "#f44336" },
        }}
        emptyTitle="No se encontraron membresías"
        emptyMessage="No hay membresías disponibles para mostrar en la página actual."
      />

      {/* Crear */}
      <ModalFormularioMembresia
        isOpen={modalAbierto === "crear" && canCreate}
        onClose={cerrarModal}
        onSubmit={handleCrearMembresia}
        title="Nueva Membresía"
      />

      {/* Editar */}
      <ModalFormularioMembresia
        isOpen={modalAbierto === "editar"}
        onClose={cerrarModal}
        onSubmit={handleEditarMembresia}
        membresia={membresiaSeleccionada}
        title="Editar Membresía"
      />

      {/* Eliminar */}
      <ModalEliminarMembresia
        isOpen={modalAbierto === "eliminar"}
        onClose={cerrarModal}
        onConfirm={handleEliminarMembresia}
        membresia={membresiaSeleccionada}
      />

      {/* Ver */}
      <ModalVerMembresia
        isOpen={modalAbierto === "ver"}
        onClose={cerrarModal}
        membresia={membresiaSeleccionada}
        onStatusChange={handleStatusChange}
      />

      {/* Modal de confirmación para cambio de estado */}
      <ConfirmModal
        isOpen={estadoPendiente.mostrar}
        onClose={() =>
          setEstadoPendiente({
            mostrar: false,
            membresia: null,
            nuevoEstado: null,
            nombreMembresia: "",
            asociacionesActivas: 0,
          })
        }
        onConfirm={confirmarCambioEstado}
        targetStatus={estadoPendiente.nuevoEstado}
        title={`Cambiar estado a ${
          estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"
        }`}
        message={`¿Estás seguro de que deseas marcar la membresía "${estadoPendiente.nombreMembresia}" como ${estadoPendiente.nuevoEstado === 1 ? "Activo" : "Inactivo"}?`}
        confirmText={
          estadoPendiente.nuevoEstado === 1 ? "Activar" : "Desactivar"
        }
        type={estadoPendiente.nuevoEstado === 1 ? "activate" : "deactivate"}
        details={
          estadoPendiente.nuevoEstado === 2 &&
          estadoPendiente.asociacionesActivas > 0
            ? `${estadoPendiente.nombreMembresia} | Asociaciones activas: ${estadoPendiente.asociacionesActivas}`
            : estadoPendiente.nombreMembresia
        }
      />
    </div>
  );
};

export default MembresiasAdmin;
