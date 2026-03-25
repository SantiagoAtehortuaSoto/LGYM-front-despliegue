import { useCallback, useEffect, useMemo, useState } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import {
  getSeguimientos,
  createSeguimiento,
  updateSeguimiento,
  deleteSeguimiento,
} from "../../../hooks/Seguimiento_API/API_seguimiento";
import { normalizePaginatedResponse } from "../../../../../shared/utils/pagination";

import {
  ModalFormularioSeguimiento,
  ModalEliminarSeguimiento,
  ModalVerSeguimiento,
} from "./modales-seguimiento";
import useCrudPermissions from "../../../hooks/Acceder_API/useCrudPermissions";

const extraerNumero = (valor) => {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor).replace(",", ".");
  const match = texto.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const numero = Number(match[0]);
  return Number.isFinite(numero) ? numero : null;
};

const normalizarDetalleTexto = (detalle = {}) =>
  `${detalle?.parametro || ""} ${detalle?.nombre_caracteristica || ""} ${
    detalle?.propiedad || ""
  }`.toLowerCase();

const obtenerValorDirectoRegistro = (
  registro = {},
  coincidencias = [],
  preferirMax = false,
) => {
  const keys = coincidencias.map((item) => item.toLowerCase());
  const candidatosRaw = [];
  const requiereImc = keys.some(
    (key) => key.includes("imc") || key.includes("indice de masa"),
  );
  const requierePeso = keys.some((key) => key.includes("peso"));
  const requiereAltura = keys.some(
    (key) =>
      key.includes("altura") || key.includes("talla") || key.includes("estatura"),
  );

  if (requiereImc) {
    candidatosRaw.push(
      registro?.imc,
      registro?.indice_masa,
      registro?.indice_masa_corporal,
      registro?.valor_imc,
    );
  }
  if (requierePeso) {
    candidatosRaw.push(
      registro?.peso,
      registro?.peso_actual,
      registro?.peso_kg,
      registro?.peso_corporal,
    );
  }
  if (requiereAltura) {
    candidatosRaw.push(
      registro?.altura,
      registro?.talla,
      registro?.estatura,
      registro?.altura_cm,
      registro?.altura_m,
    );
  }

  const candidatos = candidatosRaw
    .map((valor) => extraerNumero(valor))
    .filter((valor) => Number.isFinite(valor));

  if (!candidatos.length) return null;
  return preferirMax ? Math.max(...candidatos) : candidatos[0];
};

const obtenerValorDetalle = (registro = {}, coincidencias = [], preferirMax = false) => {
  const detalles = Array.isArray(registro?.detalles) ? registro.detalles : [];
  const keys = coincidencias.map((item) => item.toLowerCase());
  const candidatos = detalles.filter((detalle) => {
    const descriptor = normalizarDetalleTexto(detalle);
    return keys.some((key) => descriptor.includes(key));
  });
  if (!candidatos.length) {
    return obtenerValorDirectoRegistro(registro, coincidencias, preferirMax);
  }

  if (preferirMax) {
    const conNumero = candidatos
      .map((detalle) => {
        const valor = extraerNumero(
          detalle?.valor_numerico ?? detalle?.valor ?? detalle?.valor_medido
        );
        return Number.isFinite(valor) ? valor : null;
      })
      .filter((valor) => valor !== null);

    if (conNumero.length) {
      return conNumero.sort((a, b) => b - a)[0];
    }
  }

  const detalle = candidatos[0];
  const valorDetalle = extraerNumero(
    detalle?.valor_numerico ?? detalle?.valor ?? detalle?.valor_medido
  );
  if (Number.isFinite(valorDetalle)) return valorDetalle;

  return obtenerValorDirectoRegistro(registro, coincidencias, preferirMax);
};

const calcularImc = (peso, altura) => {
  if (!Number.isFinite(peso) || !Number.isFinite(altura)) return null;
  if (peso <= 0 || altura <= 0) return null;
  const alturaMetros = altura > 3 ? altura / 100 : altura;
  if (alturaMetros <= 0) return null;
  const imc = peso / (alturaMetros * alturaMetros);
  return Number.isFinite(imc) ? imc : null;
};

const obtenerImcRegistro = (registro = {}) => {
  const imcDirecto = obtenerValorDetalle(registro, ["imc", "indice de masa"], true);
  if (Number.isFinite(imcDirecto)) return imcDirecto;

  const peso = obtenerValorDetalle(registro, ["peso"], true);
  const altura = obtenerValorDetalle(registro, ["altura", "talla"], true);
  return calcularImc(peso, altura);
};

const columnasSeguimiento = [
  { field: "id", label: "ID" },
  {
    field: "imc",
    label: "IMC",
    Cell: ({ row }) => {
      const imc = obtenerImcRegistro(row);
      return Number.isFinite(imc) ? imc.toFixed(1) : "Sin dato";
    },
  },
  {
    field: "nombre_usuario",
    label: "Usuario",
    Cell: ({ row }) => {
      const nombre = row.nombre_usuario || "";
      const apellido = row.apellido_usuario || "";
      const nombreCompleto = `${nombre} ${apellido}`.trim();
      return nombreCompleto || "Sin nombre";
    },
  },
  { field: "deporte", label: "Deporte" },
  { field: "actividad", label: "Actividad" },
  { field: "fecha_registro", label: "Fecha" },
];

const normalizar = (texto = "") =>
  texto
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const obtenerDetalleError = (error, fallback) => {
  const mensaje =
    error?.response?.data?.message ||
    error?.response?.data?.msg ||
    error?.message;

  if (!mensaje || typeof mensaje !== "string") return fallback;
  return mensaje.trim();
};

const SEGUIMIENTO_EDICION_SUSPENDIDA = true;
const SEGUIMIENTO_ELIMINACION_SUSPENDIDA = true;

function Seguimiento() {
  const [registros, setRegistros] = useState([]);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [vista, setVista] = useState("lista");
  const [isOpenFormulario, setIsOpenFormulario] = useState(false);
  const [isOpenEliminar, setIsOpenEliminar] = useState(false);
  const [isOpenVer, setIsOpenVer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0,
  });
  const searchQuery = searchTerm.trim();
  const { permisoId, canCreate, canEdit, canDelete } = useCrudPermissions();

  const cargarRegistros = useCallback(async ({
    page = pagination.page,
    limit = pagination.limit,
    search = searchQuery,
  } = {}) => {
    try {
      setLoading(true);
      const data = await getSeguimientos({
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
        preferredKeys: ["seguimientos", "data"],
        defaultPage: page,
        defaultLimit: limit,
      });
      setRegistros(Array.isArray(items) ? items : []);
      setPagination((prev) => ({
        ...prev,
        page: resolvedPage,
        limit: resolvedLimit,
        totalPages,
        totalItems,
      }));
    } catch (error) {
      console.error("No se pudieron cargar seguimientos:", error);
      toast.error("No se pudieron cargar seguimientos desde la API.");
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.page, searchQuery]);

  useEffect(() => {
    cargarRegistros();
  }, [cargarRegistros]);

  useEffect(() => {
    setPagination((prev) =>
      prev.page === 1 ? prev : { ...prev, page: 1 }
    );
  }, [searchQuery]);

  const filteredRegistros = useMemo(() => registros, [registros]);
  const registrosVista = useMemo(() => {
    if (!searchQuery) return filteredRegistros;
    const term = normalizar(searchQuery);
    return filteredRegistros.filter((registro) =>
      normalizar(
        `${registro.id} ${obtenerImcRegistro(registro) ?? ""} ${
          registro.nombre_usuario || ""
        } ${registro.deporte || ""} ${registro.actividad || ""} ${
          registro.fecha_registro || ""
        }`
      ).includes(term)
    );
  }, [filteredRegistros, searchQuery]);

  const abrirModalCrear = () => {
    if (!canCreate) {
      toast.error("No tienes permisos para crear en esta sección.");
      return;
    }
    setRegistroSeleccionado(null);
    setIsOpenFormulario(true);
  };

  const volverALista = () => {
    setVista("lista");
    setRegistroSeleccionado(null);
  };

  const handleGuardar = async (payload) => {
    setProcesando(true);
    const isEdicion = Boolean(registroSeleccionado?.id);
    try {
      if (isEdicion) {
        const actualizado = await updateSeguimiento(registroSeleccionado.id, payload);
        setRegistros((prev) =>
          prev.map((item) =>
            Number(item?.id) === Number(registroSeleccionado.id)
              ? { ...item, ...actualizado }
              : item
          )
        );
        if (Number(registroSeleccionado?.id) === Number(actualizado?.id)) {
          setRegistroSeleccionado((prev) => ({ ...(prev || {}), ...actualizado }));
        }
      } else {
        await createSeguimiento(payload);
        await cargarRegistros();
      }
      return true;
    } catch (error) {
      console.error("Error guardando seguimiento:", error);
      throw new Error(
        obtenerDetalleError(
          error,
          isEdicion
            ? "No se pudo editar el seguimiento"
            : "No se pudo crear el seguimiento"
        )
      );
    } finally {
      setProcesando(false);
    }
  };

  const handleEliminar = async (registroAEliminar) => {
    setProcesando(true);
    try {
      await deleteSeguimiento(registroAEliminar.id);
      setPagination((prev) => ({ ...prev, page: 1 }));
      await cargarRegistros({
        page: 1,
        limit: pagination.limit,
        search: searchQuery,
      });
      toast.success("Seguimiento eliminado exitosamente");
      setIsOpenEliminar(false);
      setRegistroSeleccionado(null);
    } catch (error) {
      console.error("Error eliminando seguimiento:", error);
      toast.error(
        obtenerDetalleError(error, "No se pudo eliminar el seguimiento")
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Paperclip size={40} className="icono-titulo" />
          <h1 className="titulo-pagina">Seguimiento Deportivo</h1>
        </div>
        <div className="acciones-derecha">
          <button
            onClick={abrirModalCrear}
            className="boton boton-primario"
            disabled={!canCreate}
            title={canCreate ? undefined : "No tienes permisos para crear en esta sección"}
          >
            + Nuevo Seguimiento
          </button>
          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar seguimiento..."
          />
        </div>
      </div>

      {vista === "lista" && (
        <DataTable
          permisoId={permisoId}
          columns={columnasSeguimiento}
          data={registrosVista}
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
          onRefresh={cargarRegistros}
          onView={(registro) => {
            setRegistroSeleccionado(registro);
            setIsOpenVer(true);
          }}
          onEdit={
            SEGUIMIENTO_EDICION_SUSPENDIDA
              ? null
              : (registro) => {
                  setRegistroSeleccionado(registro);
                  setIsOpenFormulario(true);
                }
          }
          canEdit={() => canEdit}
          onDelete={
            SEGUIMIENTO_ELIMINACION_SUSPENDIDA
              ? null
              : (registro) => {
                  setRegistroSeleccionado(registro);
                  setIsOpenEliminar(true);
                }
          }
          canDelete={() => canDelete}
          emptyTitle="No se encontraron seguimientos"
          emptyMessage="No hay seguimientos disponibles para mostrar en la página actual."
        />
      )}

      {vista === "detalles" && registroSeleccionado && (
        <div className="detalles-vista">
          <div className="detalles-header">
            <button onClick={volverALista} className="boton-secundario">
              Volver a la lista
            </button>
            <h2>Detalles del Seguimiento</h2>
            <div className="acciones-detalles">
              <button
                onClick={() => {
                  if (SEGUIMIENTO_ELIMINACION_SUSPENDIDA) return;
                  setIsOpenEliminar(true);
                }}
                className="boton-peligro"
                disabled={SEGUIMIENTO_ELIMINACION_SUSPENDIDA}
              >
                Eliminar
              </button>
            </div>
          </div>
          <div className="detalles-contenido" />
        </div>
      )}

      <ModalFormularioSeguimiento
        isOpen={isOpenFormulario && canCreate}
        onClose={() => {
          setRegistroSeleccionado(null);
          setIsOpenFormulario(false);
        }}
        onSubmit={handleGuardar}
        registro={registroSeleccionado}
        procesando={procesando}
      />

      <ModalEliminarSeguimiento
        isOpen={isOpenEliminar}
        onClose={() => setIsOpenEliminar(false)}
        onConfirm={handleEliminar}
        registro={registroSeleccionado}
        procesando={procesando}
      />

      <ModalVerSeguimiento
        isOpen={isOpenVer}
        onClose={() => setIsOpenVer(false)}
        registro={registroSeleccionado}
      />
    </div>
  );
}

export default Seguimiento;
