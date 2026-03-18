import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Users } from "lucide-react";
import { toast } from "react-hot-toast";
import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable, {
  DEFAULT_DATA_TABLE_PAGE_SIZE,
} from "../../../components/dataTables/dataTable";
import {
  getSeguimientos,
  updateSeguimientoEstado,
} from "../../../hooks/Seguimiento_API/API_seguimiento";
import { obtenerUsuarioPorId } from "../../../hooks/Usuarios_API/API_Usuarios";
import { getUserConfig } from "../../../hooks/Configuraciones_API/Config_API";
import { ModalVerSeguimiento } from "../../admin/seguimiento/modales-seguimiento";
import {
  hasExplicitPaginationInfo,
  normalizePaginatedResponse,
} from "../../../../../shared/utils/pagination";
import "../../../../../shared/styles/restructured/pages/seguimiento-usuario-page.css";

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

const obtenerValorDetalle = (
  registro = {},
  coincidencias = [],
  preferirMax = false,
) => {
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
          detalle?.valor_numerico ?? detalle?.valor ?? detalle?.valor_medido,
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
    detalle?.valor_numerico ?? detalle?.valor ?? detalle?.valor_medido,
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

const formatearFechaInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const extraerFechaRegistroISO = (registro = {}) => {
  const candidatos = [
    registro?.fecha_registro,
    registro?.fecha,
    registro?.createdAt,
    registro?.updatedAt,
  ];

  for (const valor of candidatos) {
    if (!valor) continue;
    const txt = String(valor).trim();

    const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

    const dmy = txt.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const dd = String(dmy[1]).padStart(2, "0");
      const mm = String(dmy[2]).padStart(2, "0");
      return `${dmy[3]}-${mm}-${dd}`;
    }

    const mesMatch = normalizar(txt)
      .replace(/\./g, "")
      .match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
    if (mesMatch) {
      const mapaMeses = {
        ene: "01",
        enero: "01",
        feb: "02",
        febrero: "02",
        mar: "03",
        marzo: "03",
        abr: "04",
        abril: "04",
        may: "05",
        mayo: "05",
        jun: "06",
        junio: "06",
        jul: "07",
        julio: "07",
        ago: "08",
        agosto: "08",
        sep: "09",
        sept: "09",
        septiembre: "09",
        oct: "10",
        octubre: "10",
        nov: "11",
        noviembre: "11",
        dic: "12",
        diciembre: "12",
      };
      const dd = String(mesMatch[1]).padStart(2, "0");
      const mm = mapaMeses[mesMatch[2]];
      const yyyy = mesMatch[3];
      if (mm) return `${yyyy}-${mm}-${dd}`;
    }

    const parsed = new Date(txt);
    if (!Number.isNaN(parsed.getTime())) {
      return formatearFechaInput(parsed);
    }
  }

  return "";
};

const estaFechaEnPeriodoActual = (fechaISO = "", periodo = "") => {
  if (!periodo) return true;
  const match = String(fechaISO).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const fecha = new Date(year, month, day);
  if (Number.isNaN(fecha.getTime())) return false;

  const hoy = new Date();
  const hoySinHora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  if (periodo === "semana") {
    const inicioSemana = new Date(hoySinHora);
    const diaSemana = inicioSemana.getDay();
    const diffToMonday = (diaSemana + 6) % 7;
    inicioSemana.setDate(inicioSemana.getDate() - diffToMonday);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 6);
    return fecha >= inicioSemana && fecha <= finSemana;
  }

  if (periodo === "mes") {
    return (
      fecha.getFullYear() === hoySinHora.getFullYear() &&
      fecha.getMonth() === hoySinHora.getMonth()
    );
  }

  if (periodo === "anio") {
    return fecha.getFullYear() === hoySinHora.getFullYear();
  }

  return true;
};

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const getUserId = (user) =>
  user?.id_usuario ??
  user?.id ??
  user?.user_id ??
  user?.idUser ??
  null;

const getUserEmail = (user) =>
  (user?.email ||
    user?.correo ||
    user?.correo_electronico ||
    user?.email_usuario ||
    null)?.toString().toLowerCase();

const hasValue = (value) =>
  value !== null &&
  value !== undefined &&
  (typeof value !== "string" || value.trim() !== "");

const pickFirstValue = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
};

const unwrapUserPayload = (payload) => {
  if (!payload || typeof payload !== "object") return payload;
  if (payload?.data?.usuario && typeof payload.data.usuario === "object") {
    return payload.data.usuario;
  }
  if (payload?.data?.user && typeof payload.data.user === "object") {
    return payload.data.user;
  }
  if (payload?.data && typeof payload.data === "object") {
    return payload.data;
  }
  if (payload?.usuario && typeof payload.usuario === "object") {
    return payload.usuario;
  }
  if (payload?.user && typeof payload.user === "object") {
    return payload.user;
  }
  return payload;
};

const normalizeSessionUser = (user) => {
  if (!user || typeof user !== "object") return null;

  const idUsuario =
    user?.id_usuario ?? user?.id ?? user?.user_id ?? user?.idUser ?? null;
  const nombreUsuario =
    user?.nombre_usuario ?? user?.nombre ?? user?.name ?? user?.nombres ?? null;
  const apellidoUsuario =
    user?.apellido_usuario ??
    user?.apellido ??
    user?.apellidos ??
    user?.last_name ??
    user?.lastname ??
    null;
  const emailUsuario =
    user?.email ??
    user?.correo ??
    user?.correo_electronico ??
    user?.email_usuario ??
    user?.correo_usuario ??
    null;
  const telefonoUsuario =
    user?.telefono ??
    user?.numero_telefono ??
    user?.telefono_movil ??
    user?.telefono_celular ??
    user?.celular ??
    user?.phone ??
    user?.telefono_usuario ??
    user?.celular_usuario ??
    null;
  const generoUsuario =
    user?.genero ??
    user?.sexo ??
    user?.sexo_usuario ??
    user?.gender ??
    null;
  const fechaNacimientoUsuario =
    user?.fecha_nacimiento ??
    user?.fecha_nac ??
    user?.fechaNacimiento ??
    user?.nacimiento ??
    user?.birthdate ??
    null;

  return {
    ...user,
    id_usuario: idUsuario,
    nombre_usuario: nombreUsuario,
    apellido_usuario: apellidoUsuario,
    email: emailUsuario,
    telefono: telefonoUsuario,
    genero: generoUsuario,
    fecha_nacimiento: fechaNacimientoUsuario,
  };
};

const mergeSessionUserIntoRegistro = (registro, sessionUser) => {
  if (!registro) return registro;
  if (!sessionUser) return registro;

  const usuarioRegistro =
    registro?.id_usuario_usuario &&
    typeof registro.id_usuario_usuario === "object"
      ? registro.id_usuario_usuario
      : null;

  const usuarioFusionado = {
    ...sessionUser,
    ...(usuarioRegistro || {}),
    id_usuario:
      pickFirstValue(
        usuarioRegistro?.id_usuario,
        registro?.id_usuario,
        sessionUser?.id_usuario,
      ) ?? null,
    nombre_usuario:
      pickFirstValue(
        usuarioRegistro?.nombre_usuario,
        registro?.nombre_usuario,
        sessionUser?.nombre_usuario,
      ) ?? null,
    apellido_usuario:
      pickFirstValue(
        usuarioRegistro?.apellido_usuario,
        registro?.apellido_usuario,
        sessionUser?.apellido_usuario,
      ) ?? null,
    email:
      pickFirstValue(
        usuarioRegistro?.email,
        usuarioRegistro?.correo,
        usuarioRegistro?.correo_electronico,
        registro?.email,
        registro?.correo,
        registro?.correo_electronico,
        sessionUser?.email,
      ) ?? null,
    telefono:
      pickFirstValue(
        usuarioRegistro?.telefono,
        usuarioRegistro?.numero_telefono,
        usuarioRegistro?.telefono_movil,
        usuarioRegistro?.telefono_celular,
        usuarioRegistro?.celular,
        usuarioRegistro?.phone,
        registro?.telefono,
        registro?.celular,
        registro?.phone,
        sessionUser?.telefono,
      ) ?? null,
    genero:
      pickFirstValue(
        usuarioRegistro?.genero,
        usuarioRegistro?.sexo,
        usuarioRegistro?.sexo_usuario,
        usuarioRegistro?.gender,
        registro?.genero,
        registro?.sexo,
        registro?.gender,
        sessionUser?.genero,
      ) ?? null,
    fecha_nacimiento:
      pickFirstValue(
        usuarioRegistro?.fecha_nacimiento,
        usuarioRegistro?.fecha_nac,
        usuarioRegistro?.fechaNacimiento,
        usuarioRegistro?.nacimiento,
        usuarioRegistro?.birthdate,
        registro?.fecha_nacimiento,
        registro?.fecha_nac,
        registro?.fechaNacimiento,
        registro?.nacimiento,
        sessionUser?.fecha_nacimiento,
      ) ?? null,
  };

  return {
    ...registro,
    id_usuario:
      pickFirstValue(registro?.id_usuario, sessionUser?.id_usuario) ?? null,
    nombre_usuario:
      pickFirstValue(registro?.nombre_usuario, sessionUser?.nombre_usuario) ??
      null,
    apellido_usuario:
      pickFirstValue(registro?.apellido_usuario, sessionUser?.apellido_usuario) ??
      null,
    email:
      pickFirstValue(
        registro?.email,
        registro?.correo,
        registro?.correo_electronico,
        sessionUser?.email,
      ) ?? null,
    telefono:
      pickFirstValue(
        registro?.telefono,
        registro?.celular,
        registro?.phone,
        sessionUser?.telefono,
      ) ?? null,
    genero:
      pickFirstValue(
        registro?.genero,
        registro?.sexo,
        registro?.gender,
        sessionUser?.genero,
      ) ?? null,
    fecha_nacimiento:
      pickFirstValue(
        registro?.fecha_nacimiento,
        registro?.fecha_nac,
        registro?.fechaNacimiento,
        sessionUser?.fecha_nacimiento,
      ) ?? null,
    id_usuario_usuario: usuarioFusionado,
  };
};

const SeguimientoUsuario = () => {
  const [registros, setRegistros] = useState([]);
  const [registroSeleccionado, setRegistroSeleccionado] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [periodoFechaFiltro, setPeriodoFechaFiltro] = useState("");
  const [isOpenVer, setIsOpenVer] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchQuery = searchTerm.trim();

  const cargarTodosLosSeguimientos = useCallback(async (queryBase = {}) => {
    const firstResponse = await getSeguimientos({
      query: {
        ...queryBase,
        page: 1,
      },
    });

    const firstPage = normalizePaginatedResponse(firstResponse, {
      preferredKeys: ["seguimientos", "data"],
      defaultPage: 1,
      defaultLimit: DEFAULT_DATA_TABLE_PAGE_SIZE,
    });

    if (firstPage.totalPages <= 1 || !hasExplicitPaginationInfo(firstResponse)) {
      return firstPage.items;
    }

    const remainingResponses = await Promise.all(
      Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
        getSeguimientos({
          query: {
            ...queryBase,
            page: index + 2,
          },
        }),
      ),
    );

    const remainingItems = remainingResponses.flatMap((response) =>
      normalizePaginatedResponse(response, {
        preferredKeys: ["seguimientos", "data"],
        defaultPage: 1,
        defaultLimit: DEFAULT_DATA_TABLE_PAGE_SIZE,
      }).items,
    );

    return [...firstPage.items, ...remainingItems];
  }, []);

  const cargarSeguimientosUsuario = useCallback(async () => {
    try {
      setLoading(true);
      const usuario = readUser();
      const userId = getUserId(usuario);
      const userEmail = getUserEmail(usuario);
      let usuarioPerfilApiNormalizado = null;

      try {
        const perfilMe = await getUserConfig("me");
        usuarioPerfilApiNormalizado = normalizeSessionUser(
          unwrapUserPayload(perfilMe),
        );
      } catch {
        if (userId) {
          try {
            const perfilApi = await obtenerUsuarioPorId(userId);
            usuarioPerfilApiNormalizado = normalizeSessionUser(
              unwrapUserPayload(perfilApi),
            );
          } catch (errorPerfil) {
            console.warn(
              "No se pudo obtener el perfil completo del usuario para seguimiento:",
              errorPerfil,
            );
          }
        }
      }

      const usuarioSesionNormalizado = normalizeSessionUser({
        ...(usuario || {}),
        ...(usuarioPerfilApiNormalizado || {}),
        id_usuario:
          usuarioPerfilApiNormalizado?.id_usuario ??
          getUserId(usuario) ??
          null,
        email:
          usuarioPerfilApiNormalizado?.email ??
          getUserEmail(usuario) ??
          null,
      });

      const lista = await cargarTodosLosSeguimientos(
        userId ? { id_usuario: userId } : {},
      );
      const filtrada =
        userId || userEmail
          ? lista.filter((reg) => {
              const idReg =
                reg.id_usuario ?? reg.usuario_id ?? reg.idUser ?? reg.user_id ?? null;
              const emailReg = (
                reg.email ||
                reg.correo ||
                reg.correo_electronico ||
                reg.email_usuario ||
                reg.id_usuario_usuario?.email ||
                reg.id_usuario_usuario?.correo ||
                ""
              )
                .toString()
                .toLowerCase();

              const coincideId =
                userId && idReg && Number(idReg) === Number(userId);
              const coincideEmail = userEmail && emailReg === userEmail;
              return coincideId || coincideEmail;
            })
          : lista;
      setRegistros(
        filtrada.map((registro) =>
          mergeSessionUserIntoRegistro(registro, usuarioSesionNormalizado),
        ),
      );
    } catch (error) {
      console.error("Error al cargar seguimientos:", error);
      toast.error("No se pudieron cargar los seguimientos");
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  }, [cargarTodosLosSeguimientos]);

  useEffect(() => {
    cargarSeguimientosUsuario();
  }, [cargarSeguimientosUsuario]);

  const filteredRegistros = useMemo(() => {
    return registros.filter((registro) => {
      const coincideBusqueda =
        !searchQuery ||
        normalizar(
          `${registro.id} ${obtenerImcRegistro(registro) ?? ""} ${registro.deporte || ""} ${registro.actividad || ""} ${registro.fecha_registro || ""}`,
        ).includes(normalizar(searchQuery));

      const fechaRegistro = extraerFechaRegistroISO(registro);
      const coincideFecha = estaFechaEnPeriodoActual(
        fechaRegistro,
        periodoFechaFiltro,
      );

      return coincideBusqueda && coincideFecha;
    });
  }, [periodoFechaFiltro, registros, searchQuery]);

  const filtrosActivos = Boolean(searchTerm.trim() || periodoFechaFiltro);

  const limpiarFiltros = () => {
    setSearchTerm("");
    setPeriodoFechaFiltro("");
  };

  const handleStatusChange = async (registroActualizado) => {
    if (!registroActualizado?.id) return;
    const id = registroActualizado.id;
    const estadoAnterior =
      registros.find((r) => r.id === id)?.id_estado ??
      registros.find((r) => r.id === id)?.estado ??
      1;
    const nuevoEstado = registroActualizado.id_estado ?? registroActualizado.estado ?? 1;

    setRegistros((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              id_estado: nuevoEstado,
              estado: nuevoEstado === 1 ? "ACTIVO" : "INACTIVO",
            }
          : r,
      ),
    );

    try {
      await updateSeguimientoEstado(id, Number(nuevoEstado));
      toast.success(
        `Seguimiento ${id} marcado como ${nuevoEstado === 1 ? "Activo" : "Inactivo"}`,
      );
    } catch (error) {
      console.error("No se pudo actualizar el estado:", error);
      toast.error("No se pudo cambiar el estado");
      setRegistros((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                id_estado: estadoAnterior,
                estado: estadoAnterior === 1 ? "ACTIVO" : "INACTIVO",
              }
            : r,
        ),
      );
    }
  };

  return (
    <div className="contenido-pagina">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Users size={40} className="icono-titulo" color="red" />
          <h1>Seguimiento de Usuario</h1>
        </div>
        <div className="acciones-derecha seguimiento-user-filters">
          <div className="seguimiento-user-filter-control seguimiento-user-filter-period">
            <CalendarDays size={16} className="seguimiento-user-filter-icon" />
            <select
              value={periodoFechaFiltro}
              onChange={(e) => setPeriodoFechaFiltro(e.target.value)}
              className="seguimiento-user-filter-select"
              aria-label="Filtrar por periodo de fecha"
              title="Filtrar por periodo de fecha"
            >
              <option value="">Periodo</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="anio">Año</option>
            </select>
          </div>

          <BuscadorUniversal
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Buscar seguimiento..."
            className="seguimiento-user-filter-control seguimiento-user-filter-search"
            inputClassName="seguimiento-user-search-input"
            buttonClassName="seguimiento-user-filter-icon"
          />

          {filtrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="seguimiento-user-clear-btn"
              title="Limpiar búsqueda y periodo"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <DataTable
        columns={columnasSeguimiento}
        data={filteredRegistros}
        loading={loading}
        onRefresh={cargarSeguimientosUsuario}
        onView={(registro) => {
          setRegistroSeleccionado(registro);
          setIsOpenVer(true);
        }}
        onEdit={null}
        onDelete={null}
        onStatusChange={handleStatusChange}
        emptyTitle="No se encontraron seguimientos"
        emptyMessage="No hay seguimientos disponibles para mostrar en la página actual."
      />

      <ModalVerSeguimiento
        isOpen={isOpenVer}
        onClose={() => setIsOpenVer(false)}
        registro={registroSeleccionado}
      />
    </div>
  );
};

export default SeguimientoUsuario;
