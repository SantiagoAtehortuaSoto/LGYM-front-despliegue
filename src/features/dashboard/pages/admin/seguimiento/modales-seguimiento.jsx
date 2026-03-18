import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlusCircle, Search, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  obtenerUsuarioPorId,
  obtenerUsuarios,
  obtenerRolesUsuarios,
} from "../../../hooks/Usuarios_API/API_Usuarios";
import {
  getCaracteristicas,
  getMaestroParametros,
  getRelacionesSeguimiento,
} from "../../../hooks/Seguimiento_API/API_seguimiento";
import { DeleteModal } from "../../../../../shared/components/deleteModal/deleteModal";
import Modal from "../../../../../shared/components/Modal/Modal";
import "../../../../../shared/styles/restructured/components/modal-seguimiento.css";

const hoyLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const generarId = () => {
  const api = typeof crypto !== "undefined" ? crypto : null;
  if (api?.randomUUID) return api.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const crearDetalleVacio = () => ({
  tempId: generarId(),
  id_maestro_p: null,
  id_caracteristica: null,
  parametro: "",
  propiedad: "",
  valor_numerico: "",
  esObligatorio: false,
  obligatorioClave: null,
});

const OBSERVACIONES_MAX_LENGTH = 200;
const CLIENT_ROLE_ID = 33;
const PARAMETROS_SUGERIDOS_BASE = [
  "Cineantropometria",
  "Diametros oseos",
  "Pliegues cutaneos",
  "Perimetros musculares",
  "Composicion corporal",
];
const DETALLES_OBLIGATORIOS = [
  {
    clave: "peso",
    parametro: "Cineantropometria",
    propiedad: "Peso",
  },
  {
    clave: "altura",
    parametro: "Cineantropometria",
    propiedad: "Altura",
  },
];
const PESO_MAXIMO_KG = 250;
const ALTURA_MAXIMA_M = 2.1;
const ALTURA_MAXIMA_CM = 210;
const crearDetalleObligatorio = ({ clave, parametro, propiedad }) => ({
  ...crearDetalleVacio(),
  parametro,
  propiedad,
  esObligatorio: true,
  obligatorioClave: clave,
});
const coincideDetalleObligatorio = (detalle = {}, obligatorio = {}) =>
  normalizarBusqueda(detalle?.parametro) ===
    normalizarBusqueda(obligatorio?.parametro) &&
  normalizarBusqueda(detalle?.propiedad) ===
    normalizarBusqueda(obligatorio?.propiedad);
const asegurarDetallesObligatorios = (detalles = []) => {
  const lista = Array.isArray(detalles) ? [...detalles] : [];
  const usados = new Set();

  const normalizados = lista.map((detalle) => {
    const obligatorio = DETALLES_OBLIGATORIOS.find((item) =>
      coincideDetalleObligatorio(detalle, item)
    );

    if (!obligatorio) {
      return {
        ...detalle,
        esObligatorio: false,
        obligatorioClave: null,
      };
    }

    usados.add(obligatorio.clave);
    return {
      ...detalle,
      parametro: obligatorio.parametro,
      propiedad: obligatorio.propiedad,
      esObligatorio: true,
      obligatorioClave: obligatorio.clave,
    };
  });

  DETALLES_OBLIGATORIOS.forEach((obligatorio) => {
    if (usados.has(obligatorio.clave)) return;
    normalizados.unshift(crearDetalleObligatorio(obligatorio));
  });

  return normalizados;
};
const crearDetallesIniciales = () =>
  asegurarDetallesObligatorios(
    DETALLES_OBLIGATORIOS.map((item) => crearDetalleObligatorio(item))
  );
const obtenerLimiteDetalleObligatorio = (detalle = {}) => {
  if (detalle?.obligatorioClave === "peso") {
    return {
      max: PESO_MAXIMO_KG,
      mensaje: `Peso no puede superar ${PESO_MAXIMO_KG} kg`,
    };
  }

  if (detalle?.obligatorioClave === "altura") {
    return {
      max: ALTURA_MAXIMA_CM,
      mensaje: `Altura no puede superar ${ALTURA_MAXIMA_M.toFixed(2)} m o ${ALTURA_MAXIMA_CM} cm`,
    };
  }

  return null;
};
const normalizarValorNumerico = (valor = "") =>
  String(valor).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
const esValorNumericoPermitido = (detalle = {}, valor = "") => {
  if (valor === "") return true;
  if (!/^\d+(\.\d{0,2})?$/.test(valor)) return false;

  const valorNumerico = Number(valor);
  if (!Number.isFinite(valorNumerico)) return false;

  const limiteDetalle = obtenerLimiteDetalleObligatorio(detalle);
  if (!limiteDetalle) return true;

  if (detalle?.obligatorioClave === "altura") {
    const maxAltura = valor.includes(".") ? ALTURA_MAXIMA_M : ALTURA_MAXIMA_CM;
    return valorNumerico <= maxAltura;
  }

  return valorNumerico <= limiteDetalle.max;
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
  },
};

const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.97,
    y: 14,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: 10,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

const useLockBodyScroll = (isOpen) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prevOverflow || "";
    }
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [isOpen]);
};

const normalizarTexto = (valor) => valor?.trim() || "";

const obtenerPrimeroConTexto = (...valores) => {
  for (const valor of valores) {
    const texto = normalizarTexto(valor);
    if (texto) return texto;
  }
  return "";
};
const normalizarBusqueda = (valor = "") =>
  valor
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const deduplicarCatalogoPorNombre = (
  lista = [],
  { requireId = true } = {}
) => {
  const vistos = new Set();
  return lista.filter((item) => {
    const id = item?.id ?? null;
    const nombre = normalizarTexto(item?.nombre ?? "");
    if (!nombre) return false;
    if (requireId && !id) return false;
    const clave = normalizarBusqueda(nombre);
    if (!clave || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
};
const normalizarCatalogoCaracteristicas = (lista = []) =>
  deduplicarCatalogoPorNombre(
    (Array.isArray(lista) ? lista : [])
      .map((c) => ({
        id:
          c.id_caracteristicas ??
          c.id_caracteristica ??
          c.caracteristica_id ??
          c.id ??
          null,
        nombre:
          c.nombre_caracteristica ??
          c.nombre ??
          c.caracteristica ??
          c.propiedad ??
          (c.id ? `Caracteristica ${c.id}` : ""),
      }))
      .filter((c) => c.nombre),
    { requireId: false }
  );
const crearCatalogoBase = (nombres = []) =>
  nombres.map((nombre) => ({ id: null, nombre }));
const tieneValor = (valor) =>
  valor !== null &&
  valor !== undefined &&
  (typeof valor !== "string" || valor.trim() !== "");
const buildSeguimientoInputClass = (hasError = false, extraClasses = "") =>
  `modal-field-input${hasError ? " modal-seguimiento__input--error" : ""}${
    extraClasses ? ` ${extraClasses}` : ""
  }`;
const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const esRolCliente = (rolInfo = {}) => {
  const rolId = toNumberOrNull(
    rolInfo?.id ??
      rolInfo?.id_rol ??
      rolInfo?.rol_id ??
      rolInfo?.roleId ??
      rolInfo
  );
  if (rolId === CLIENT_ROLE_ID) return true;

  const rolNombre = normalizarBusqueda(
    rolInfo?.nombre_rol ??
      rolInfo?.nombre ??
      rolInfo?.rol ??
      rolInfo?.role ??
      rolInfo?.tipo ??
      rolInfo?.tipo_usuario ??
      ""
  );

  if (!rolNombre) return false;
  if (/(admin|administrador|emplead|instructor|staff)/.test(rolNombre))
    return false;
  return /(cliente|usuario|beneficiario|user|member|miembro)/.test(rolNombre);
};

const mezclarUsuarios = (...fuentes) => {
  const resultado = {};
  fuentes.forEach((fuente) => {
    if (!fuente || typeof fuente !== "object") return;
    Object.entries(fuente).forEach(([clave, valor]) => {
      if (tieneValor(valor)) {
        resultado[clave] = valor;
      }
    });
  });
  return resultado;
};

const normalizarUsuarios = (usuariosData) => {
  if (!usuariosData) return [];

  const lista = (() => {
    if (Array.isArray(usuariosData)) return usuariosData;
    if (Array.isArray(usuariosData?.data)) return usuariosData.data;
    if (usuariosData?.data?.usuario && typeof usuariosData.data.usuario === "object") {
      return [usuariosData.data.usuario];
    }
    if (usuariosData?.data?.user && typeof usuariosData.data.user === "object") {
      return [usuariosData.data.user];
    }
    if (usuariosData?.data && typeof usuariosData.data === "object") {
      return [usuariosData.data];
    }
    if (Array.isArray(usuariosData?.usuarios)) return usuariosData.usuarios;
    if (usuariosData?.usuarios && typeof usuariosData.usuarios === "object") {
      return [usuariosData.usuarios];
    }
    if (usuariosData?.usuario && typeof usuariosData.usuario === "object") {
      return [usuariosData.usuario];
    }
    if (usuariosData?.user && typeof usuariosData.user === "object") {
      return [usuariosData.user];
    }
    if (typeof usuariosData === "object") {
      const idDirecto =
        usuariosData?.id_usuario ??
        usuariosData?.id ??
        usuariosData?.idUser ??
        usuariosData?.user_id ??
        usuariosData?.usuario_id ??
        usuariosData?.id_usuario_usuario?.id_usuario ??
        null;
      if (idDirecto !== null && idDirecto !== undefined) {
        return [usuariosData];
      }
      const values = Object.values(usuariosData);
      return values.flatMap((value) =>
        Array.isArray(value)
          ? value
          : value && typeof value === "object"
          ? [value]
          : []
      );
    }
    return [];
  })();

  return lista
    .map((u) => {
      const base =
        (u?.id_usuario_usuario && typeof u.id_usuario_usuario === "object"
          ? u.id_usuario_usuario
          : null) ||
        (u?.usuario && typeof u.usuario === "object"
          ? u.usuario
          : null) ||
        (u?.user && typeof u.user === "object"
          ? u.user
          : null) ||
        u;
      const id =
        base?.id_usuario ??
        base?.id ??
        base?.idUser ??
        base?.user_id ??
        base?.usuario_id ??
        null;
      if (!id) return null;
      const idNormalizado = Number(id);
      return Number.isNaN(idNormalizado)
        ? null
        : { ...(u || {}), ...(base || {}), id_usuario: idNormalizado };
    })
    .filter(Boolean);
};

const normalizarRolesUsuarios = (rolesData) => {
  if (!rolesData) return [];
  if (Array.isArray(rolesData)) return rolesData;
  if (Array.isArray(rolesData?.data)) return rolesData.data;
  if (Array.isArray(rolesData?.roles_usuarios)) return rolesData.roles_usuarios;
  if (typeof rolesData === "object") {
    return Object.values(rolesData).flatMap((value) =>
      Array.isArray(value)
        ? value
        : value && typeof value === "object"
        ? [value]
        : []
    );
  }
  return [];
};

const construirRolesPorUsuario = (rolesData) => {
  const map = new Map();
  normalizarRolesUsuarios(rolesData).forEach((asignacion) => {
    const userId = toNumberOrNull(
      asignacion?.id_usuario ??
        asignacion?.usuario_id ??
        asignacion?.id_usuario_usuario?.id_usuario ??
        asignacion?.id_usuario_usuario?.id ??
        asignacion?.usuario?.id_usuario ??
        asignacion?.usuario?.id
    );
    const rolId = toNumberOrNull(
      asignacion?.id_rol ??
        asignacion?.rol_id ??
        asignacion?.roleId ??
        asignacion?.id_rol_rol?.id_rol ??
        asignacion?.id_rol_rol?.id ??
        asignacion?.rol?.id_rol ??
        asignacion?.rol?.id
    );
    const rolNombre =
      asignacion?.id_rol_rol?.nombre_rol ??
      asignacion?.id_rol_rol?.nombre ??
      asignacion?.rol?.nombre_rol ??
      asignacion?.rol?.nombre ??
      asignacion?.nombre_rol ??
      asignacion?.nombre ??
      "";

    if (userId === null) return;
    if (!map.has(userId)) map.set(userId, []);

    if (rolId !== null || rolNombre) {
      map.get(userId).push({ id_rol: rolId, nombre_rol: rolNombre });
    }
  });
  return map;
};

const normalizarClientes = (usuariosData, rolesPorUsuario = new Map()) => {
  const usuariosNormalizados = normalizarUsuarios(usuariosData);
  const mapa = new Map();

  usuariosNormalizados.forEach((usuario) => {
    const userId = toNumberOrNull(usuario?.id_usuario ?? usuario?.id);
    if (userId === null) return;

    const rolesDirectos = [
      {
        id_rol:
          usuario?.rol_id ??
          usuario?.id_rol ??
          usuario?.roleId ??
          usuario?.rol?.id_rol ??
          usuario?.rol?.id,
        nombre_rol:
          usuario?.rol?.nombre_rol ??
          usuario?.rol?.nombre ??
          usuario?.rol_nombre ??
          usuario?.tipo_usuario ??
          usuario?.tipo ??
          usuario?.role_name,
      },
      ...(Array.isArray(usuario?.roles)
        ? usuario.roles.map((rol) => ({
            id_rol: rol?.id_rol ?? rol?.id ?? rol?.rol_id ?? rol?.roleId,
            nombre_rol:
              rol?.nombre_rol ??
              rol?.nombre ??
              rol?.rol ??
              rol?.role ??
              rol?.tipo_usuario,
          }))
        : []),
    ];
    const rolesAsignados = Array.isArray(rolesPorUsuario.get(userId))
      ? rolesPorUsuario.get(userId)
      : [];
    const rolesCandidato = [...rolesDirectos, ...rolesAsignados];
    const esCliente = rolesCandidato.some((rol) => esRolCliente(rol));
    if (!esCliente) return;

    const rolCliente = rolesCandidato.find((rol) => esRolCliente(rol)) || {};
    const rolIdCliente = toNumberOrNull(
      rolCliente?.id_rol ?? rolCliente?.id ?? null
    );

    if (!mapa.has(userId)) {
      mapa.set(userId, {
        ...usuario,
        id_usuario: userId,
        rol_id: rolIdCliente ?? CLIENT_ROLE_ID,
      });
    }
  });

  return Array.from(mapa.values());
};

export const ModalFormularioSeguimiento = ({
  isOpen,
  onClose,
  onSubmit,
  registro,
  procesando = false,
}) => {
  useLockBodyScroll(isOpen);
  const hoy = useMemo(() => hoyLocal(), []);
  const esEdicion = Boolean(registro?.id);

  const [formData, setFormData] = useState({
    id_usuario: "",
    deporte: "",
    actividad: "",
    observaciones: "",
    fecha_registro: hoy,
    detalles: crearDetallesIniciales(),
  });

  const [errores, setErrores] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [caracteristicas, setCaracteristicas] = useState([]);
  const [maestroParametros, setMaestroParametros] = useState([]);
  const [relaciones, setRelaciones] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [errorUsuarios, setErrorUsuarios] = useState("");
  const [, setErrorCaracteristicas] = useState("");
  const [errorMaestro, setErrorMaestro] = useState("");
  const [busquedaUsuario, setBusquedaUsuario] = useState("");
  const [mostrarDropdownUsuario, setMostrarDropdownUsuario] = useState(false);

  const asegurarUsuariosCargados = async () => {
    if (cargandoUsuarios) return;
    if (usuarios.length) return;
    try {
      setCargandoUsuarios(true);
      setErrorUsuarios("");
      const [usuariosData, rolesData] = await Promise.all([
        obtenerUsuarios(),
        obtenerRolesUsuarios(),
      ]);
      const rolesPorUsuario = construirRolesPorUsuario(rolesData);
      const listaClientes = normalizarClientes(usuariosData, rolesPorUsuario);
      setUsuarios(listaClientes);
      if (!listaClientes.length) {
        setErrorUsuarios("No se encontraron clientes para seleccionar");
      }
    } catch (error) {
      console.error("Error forzando carga de usuarios:", error);
      setErrorUsuarios("No se pudieron cargar los clientes");
    } finally {
      setCargandoUsuarios(false);
    }
  };

  const maestroMap = useMemo(() => {
    const map = new Map();
    maestroParametros.forEach((item) => {
      if (item?.id !== null && item?.id !== undefined) {
        map.set(String(item.id), item.nombre ?? "");
      }
    });
    return map;
  }, [maestroParametros]);

  const caracteristicaMap = useMemo(() => {
    const map = new Map();
    caracteristicas.forEach((item) => {
      if (item?.id !== null && item?.id !== undefined) {
        map.set(String(item.id), item.nombre ?? "");
      }
    });
    return map;
  }, [caracteristicas]);

  const relacionMap = useMemo(() => {
    const map = new Map();
    relaciones.forEach((item) => {
      if (item?.id_relacion !== null && item?.id_relacion !== undefined) {
        map.set(String(item.id_relacion), item);
      }
    });
    return map;
  }, [relaciones]);

  const findMaestroIdByNombre = (nombre) => {
    if (!nombre) return null;
    const normalizado = normalizarBusqueda(nombre);
    const encontrado = maestroParametros.find(
      (m) => normalizarBusqueda(m.nombre ?? "") === normalizado
    );
    return encontrado?.id ?? null;
  };

  const findCaracteristicaIdByNombre = (nombre) => {
    if (!nombre) return null;
    const normalizado = normalizarBusqueda(nombre);
    const encontrado = caracteristicas.find(
      (c) => normalizarBusqueda(c.nombre ?? "") === normalizado
    );
    return encontrado?.id ?? null;
  };

  const resolveMaestroId = (texto) => {
    if (texto === null || texto === undefined) return null;
    const raw = texto.toString().trim();
    if (!raw) return null;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
    return findMaestroIdByNombre(raw);
  };

  const resolveCaracteristicaId = (texto) => {
    if (texto === null || texto === undefined) return null;
    const raw = texto.toString().trim();
    if (!raw) return null;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
    return findCaracteristicaIdByNombre(raw);
  };

  const parametrosSugeridos = useMemo(() => {
    const mapa = new Map();

    deduplicarCatalogoPorNombre(maestroParametros).forEach((item) => {
      const clave = normalizarBusqueda(item?.nombre ?? "");
      if (!clave) return;
      mapa.set(clave, {
        id: item?.id ?? null,
        nombre: item.nombre,
      });
    });

    crearCatalogoBase(PARAMETROS_SUGERIDOS_BASE).forEach((item) => {
      const clave = normalizarBusqueda(item?.nombre ?? "");
      if (!clave || mapa.has(clave)) return;
      mapa.set(clave, item);
    });

    return Array.from(mapa.values());
  }, [maestroParametros]);

  useEffect(() => {
    if (!isOpen) return;

    const fechaRegistro =
      typeof registro?.fecha_registro === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(registro.fecha_registro)
        ? registro.fecha_registro.slice(0, 10)
        : hoy;
    const observacionesDesdeDetalles = Array.isArray(registro?.detalles)
      ? registro.detalles.find((det) =>
          Boolean(
            normalizarTexto(
              det?.observaciones ??
                det?.observacion ??
                det?.comentario ??
                det?.comentarios ??
                det?.nota ??
                det?.notas ??
                det?.observaciones_detalle ??
                det?.observacion_detalle ??
                det?.relacion_seguimiento?.observaciones ??
                det?.relacion_seguimiento?.observacion ??
                ""
            )
          )
        )
      : null;
    const observacionesIniciales = obtenerPrimeroConTexto(
      registro?.observaciones,
      registro?.observacion,
      observacionesDesdeDetalles?.observaciones,
      observacionesDesdeDetalles?.observacion,
      observacionesDesdeDetalles?.comentario,
      observacionesDesdeDetalles?.comentarios,
      observacionesDesdeDetalles?.nota,
      observacionesDesdeDetalles?.notas,
      observacionesDesdeDetalles?.observaciones_detalle,
      observacionesDesdeDetalles?.observacion_detalle,
      observacionesDesdeDetalles?.relacion_seguimiento?.observaciones,
      observacionesDesdeDetalles?.relacion_seguimiento?.observacion
    );

    setErrores({});
    setBusquedaUsuario("");
    setMostrarDropdownUsuario(false);
    setFormData({
      id_usuario: registro?.id_usuario ?? "",
      deporte: registro?.deporte ?? "",
      actividad: registro?.actividad ?? "",
      observaciones: observacionesIniciales,
      fecha_registro: fechaRegistro,
      detalles: (() => {
        const detallesNormalizados =
          registro?.detalles?.map((det) => {
            const idRelacion =
              det.id_relacion_seguimiento ??
              det.id_relacion ??
              det.relacion_id ??
              det?.relacion_seguimiento?.id_relacion_seguimien ??
              null;
            const relacion = idRelacion
              ? relacionMap.get(String(idRelacion))
              : null;
            const idMaestro =
              det.id_maestro_p ??
              det.id_maestro ??
              det.id_parametro ??
              det.id_maestro_parametro ??
              det.id_maestro_parametros ??
              det?.relacion_seguimiento?.id_maestro_p ??
              det?.relacion_seguimiento?.maestro_parametros?.id_maestro_p ??
              null;
            const idCaracteristica =
              det.id_caracteristica ??
              det.id_caracteristicas ??
              det.caracteristica_id ??
              det.id_caracteristica_car ??
              det?.relacion_seguimiento?.id_caracteristica ??
              det?.relacion_seguimiento?.caracteristica?.id_caracteristica ??
              null;
            const parametroNombre =
              det.parametro ||
              det.nombre_parametro ||
              det.parametro_nombre ||
              (idMaestro !== null && idMaestro !== undefined
                ? maestroMap.get(String(idMaestro))
                : null) ||
              relacion?.parametro ||
              det?.relacion_seguimiento?.maestro_parametros?.parametro ||
              det?.relacion_seguimiento?.maestro ||
              "";
            const caracteristicaNombre =
              (det.propiedad ??
                det.nombre_caracteristica ??
                det.caracteristica ??
                det.nombre_caracteristica_s ??
                (idCaracteristica !== null && idCaracteristica !== undefined
                  ? caracteristicaMap.get(String(idCaracteristica))
                  : null)) ||
              relacion?.nombre_caracteristica ||
              det?.relacion_seguimiento?.caracteristica?.nombre_caracteristica ||
              det?.relacion_seguimiento?.caracteristica ||
              "";
            return {
              ...det,
              tempId: det.id_detalle || generarId(),
              id_maestro_p: idMaestro,
              id_caracteristica: idCaracteristica,
              parametro: parametroNombre || "",
              propiedad: caracteristicaNombre || "",
              valor_numerico:
                det.valor_numerico ??
                det.valor ??
                det.valor_medido ??
                relacion?.valor ??
                det?.relacion_seguimiento?.valor ??
                det?.relacion_seguimiento?.valor_numerico ??
                det?.relacion_seguimiento?.valor_medido ??
                "",
            };
          }) ?? [];

        const detallesBase = asegurarDetallesObligatorios(
          detallesNormalizados.length ? detallesNormalizados : []
        );

        return detallesBase.length ? detallesBase : crearDetallesIniciales();
      })(),
    });
  }, [registro, isOpen, hoy, maestroMap, caracteristicaMap, relacionMap, esEdicion]);

  useEffect(() => {
    if (!isOpen) return;

    const cargarUsuariosYCaracteristicas = async () => {
      setCargandoUsuarios(true);
      setErrorUsuarios("");
      setErrorCaracteristicas("");
      try {
        const [
          usuariosData,
          rolesUsuariosData,
          caracteristicasData,
          maestroData,
          relacionesData,
        ] =
          await Promise.all([
            obtenerUsuarios(),
            obtenerRolesUsuarios(),
            getCaracteristicas(),
            getMaestroParametros(),
            getRelacionesSeguimiento(),
          ]);
        const rolesPorUsuario = construirRolesPorUsuario(rolesUsuariosData);
        const listaClientes = normalizarClientes(usuariosData, rolesPorUsuario);
        setUsuarios(listaClientes);
        if (!listaClientes.length) {
          setErrorUsuarios("No se encontraron clientes para seleccionar");
        }

        const relacionesNormalizadas = Array.isArray(relacionesData)
          ? relacionesData
          : [];
        const caracteristicasDesdeApi =
          normalizarCatalogoCaracteristicas(caracteristicasData);
        const caracteristicasDesdeRelaciones =
          normalizarCatalogoCaracteristicas(relacionesNormalizadas);
        setCaracteristicas(
          deduplicarCatalogoPorNombre([
            ...caracteristicasDesdeApi,
            ...caracteristicasDesdeRelaciones,
          ], { requireId: false })
        );
        setErrorCaracteristicas("");

        if (Array.isArray(maestroData) && maestroData.length) {
          const normalizadas = deduplicarCatalogoPorNombre(
            maestroData.map((m) => ({
              id:
                m.id_maestro_p ??
                m.id_maestro ??
                m.id_parametro ??
                m.id ??
                null,
              nombre:
                m.parametro ??
                m.nombre_parametro ??
                m.nombre ??
                m.maestro_parametro ??
                m.descripcion ??
                "",
            }))
            .filter((m) => m.id && m.nombre)
          );
          if (normalizadas.length) {
            setMaestroParametros(normalizadas);
            setErrorMaestro("");
          } else {
            setMaestroParametros([]);
            setErrorMaestro("");
          }
        } else {
          setMaestroParametros([]);
          setErrorMaestro("");
        }

        setRelaciones(relacionesNormalizadas);
      } catch (error) {
        console.error("Error cargando usuarios/caracteristicas:", error);
        setUsuarios([]);
        setCaracteristicas([]);
        setMaestroParametros([]);
        setRelaciones([]);
        setErrorUsuarios("No se pudieron cargar los clientes");
        setErrorMaestro(
          "No se pudieron cargar los parametros desde la API. Puedes escribir uno."
        );
        setErrorCaracteristicas("");
      } finally {
        setCargandoUsuarios(false);
      }
    };

    cargarUsuariosYCaracteristicas();
  }, [isOpen]);

  const buildValidationErrors = (data) => {
    const nuevosErrores = {};
    const detalleErrores = [];
    const combinacionesDetalle = new Set();

    const idUsuario = Number(data.id_usuario);
    if (!data.id_usuario || Number.isNaN(idUsuario) || idUsuario <= 0) {
      nuevosErrores.id_usuario =
        "Id de usuario es requerido y debe ser mayor a cero";
    }

    if (data.deporte && data.deporte.length > 80) {
      nuevosErrores.deporte = "Deporte no puede superar 80 caracteres";
    }

    if (data.actividad && data.actividad.length > 80) {
      nuevosErrores.actividad = "Actividad no puede superar 80 caracteres";
    }

    if (
      data.observaciones &&
      data.observaciones.length > OBSERVACIONES_MAX_LENGTH
    ) {
      nuevosErrores.observaciones =
        `Observaciones no puede superar ${OBSERVACIONES_MAX_LENGTH} caracteres`;
    }

    if (!data.fecha_registro) {
      nuevosErrores.fecha_registro = "Fecha de registro es requerida";
    } else {
      const fecha = new Date(data.fecha_registro);
      const hoyFecha = new Date();
      hoyFecha.setHours(0, 0, 0, 0);
      if (fecha > hoyFecha) {
        nuevosErrores.fecha_registro = "La fecha no puede ser futura";
      }
    }

    if (!data.detalles.length) {
      nuevosErrores.detalles = "Agrega al menos un parametro medido";
    }

    data.detalles.forEach((detalle, idx) => {
      const erroresDetalle = {};
      const parametro = normalizarTexto(detalle.parametro);
      if (!parametro) {
        erroresDetalle.parametro = "Parametro requerido";
      } else if (parametro.length > 200) {
        erroresDetalle.parametro = "Máximo 200 caracteres";
      }

      const propiedad = normalizarTexto(detalle.propiedad);
      if (!propiedad) {
        erroresDetalle.propiedad = "Caracteristica requerida";
      } else if (propiedad.length > 200) {
        erroresDetalle.propiedad = "Máximo 200 caracteres";
      }

      const claveCombinacion =
        parametro && propiedad
          ? `${normalizarBusqueda(parametro)}::${normalizarBusqueda(propiedad)}`
          : "";
      if (claveCombinacion) {
        if (combinacionesDetalle.has(claveCombinacion)) {
          erroresDetalle.propiedad =
            "Esta caracteristica ya fue agregada para este parametro";
        } else {
          combinacionesDetalle.add(claveCombinacion);
        }
      }

      if (
        detalle.valor_numerico !== "" &&
        !/^\d+(\.\d{1,2})?$/.test(String(detalle.valor_numerico))
      ) {
        erroresDetalle.valor_numerico = "Debe ser numérico válido";
      }

      const limiteDetalle = obtenerLimiteDetalleObligatorio(detalle);
      if (
        limiteDetalle &&
        detalle.valor_numerico !== "" &&
        !esValorNumericoPermitido(detalle, String(detalle.valor_numerico))
      ) {
        erroresDetalle.valor_numerico = limiteDetalle.mensaje;
      }

      if (detalle.esObligatorio && detalle.valor_numerico === "") {
        erroresDetalle.valor_numerico =
          "Este valor es obligatorio para calcular el seguimiento";
      }

      detalleErrores[idx] = erroresDetalle;
    });

    if (detalleErrores.some((e) => Object.keys(e).length)) {
      nuevosErrores.detalleCampos = detalleErrores;
    }

    return nuevosErrores;
  };

  const validar = () => {
    const nuevosErrores = buildValidationErrors(formData);
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextFormData = { ...formData, [name]: value };
    setFormData(nextFormData);
    setErrores(buildValidationErrors(nextFormData));
  };

  const handleDetalleChange = (id, campo, valor) => {
    const detalleActual = formData.detalles.find((d) => d.tempId === id);
    const valorNormalizado =
      campo === "valor_numerico" ? normalizarValorNumerico(valor) : valor;

    if (
      campo === "valor_numerico" &&
      detalleActual &&
      !esValorNumericoPermitido(detalleActual, valorNormalizado)
    ) {
      const valorActual = normalizarValorNumerico(
        String(detalleActual.valor_numerico ?? "")
      );
      const numeroActual = Number(valorActual);
      const numeroPropuesto = Number(valorNormalizado);
      const esReduccionParcial =
        valorNormalizado === "" ||
        valorNormalizado.length < valorActual.length ||
        (!Number.isNaN(numeroActual) &&
          !Number.isNaN(numeroPropuesto) &&
          numeroPropuesto < numeroActual);

      if (!esReduccionParcial) {
        return;
      }
    }

    const nextFormData = {
      ...formData,
      detalles: formData.detalles.map((d) => {
        if (d.tempId !== id) return d;
        if (
          d.esObligatorio &&
          ["parametro", "propiedad", "id_maestro_p", "id_caracteristica"].includes(
            campo
          )
        ) {
          return d;
        }
        if (campo === "id_maestro_p") {
          const idMaestro = valorNormalizado === "" ? null : toNumberOrNull(valorNormalizado);
          return {
            ...d,
            id_maestro_p: idMaestro,
            parametro:
              idMaestro !== null ? maestroMap.get(String(idMaestro)) || "" : "",
          };
        }
        if (campo === "id_caracteristica") {
          const idCaracteristica =
            valorNormalizado === "" ? null : toNumberOrNull(valorNormalizado);
          return {
            ...d,
            id_caracteristica: idCaracteristica,
            propiedad:
              idCaracteristica !== null
                ? caracteristicaMap.get(String(idCaracteristica)) || ""
                : "",
          };
        }
        if (campo === "parametro") {
          const texto = valorNormalizado;
          const idMaestro = resolveMaestroId(texto);
          return {
            ...d,
            parametro: texto,
            id_maestro_p: idMaestro,
          };
        }
        if (campo === "propiedad") {
          const texto = valorNormalizado;
          const idCaracteristica = resolveCaracteristicaId(texto);
          return {
            ...d,
            propiedad: texto,
            id_caracteristica: idCaracteristica,
          };
        }
        return { ...d, [campo]: valorNormalizado };
      }),
    };

    setFormData(nextFormData);
    setErrores(buildValidationErrors(nextFormData));
  };

  const handleDetalleValorKeyDown = (event, detalle) => {
    const teclasPermitidas = [
      "Backspace",
      "Delete",
      "Tab",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Enter",
    ];

    if (event.ctrlKey || event.metaKey) return;
    if (teclasPermitidas.includes(event.key)) return;

    if (event.key.length !== 1) return;
    if (!/[0-9.]/.test(event.key)) {
      event.preventDefault();
      return;
    }

    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const valorPropuesto =
      input.value.slice(0, start) + event.key + input.value.slice(end);
    const valorNormalizado = normalizarValorNumerico(valorPropuesto);

    if (!esValorNumericoPermitido(detalle, valorNormalizado)) {
      event.preventDefault();
    }
  };

  const handleDetalleValorPaste = (event, detalle) => {
    const textoPegado = event.clipboardData?.getData("text") ?? "";
    const input = event.currentTarget;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const valorPropuesto =
      input.value.slice(0, start) + textoPegado + input.value.slice(end);
    const valorNormalizado = normalizarValorNumerico(valorPropuesto);

    if (
      textoPegado !== valorNormalizado ||
      !esValorNumericoPermitido(detalle, valorNormalizado)
    ) {
      event.preventDefault();
    }
  };

  const agregarDetalle = () => {
    const nextFormData = {
      ...formData,
      detalles: [...formData.detalles, crearDetalleVacio()],
    };
    setFormData(nextFormData);
    setErrores(buildValidationErrors(nextFormData));
  };

  const eliminarDetalle = (id) => {
    const detalleObjetivo = formData.detalles.find((d) => d.tempId === id);
    if (detalleObjetivo?.esObligatorio) return;

    const restantes = formData.detalles.filter((d) => d.tempId !== id);
    const nextFormData = {
      ...formData,
      detalles: asegurarDetallesObligatorios(
        restantes.length ? restantes : [crearDetalleVacio()]
      ),
    };
    setFormData(nextFormData);
    setErrores(buildValidationErrors(nextFormData));
  };

  const getNombreUsuario = (usuario) => {
    if (!usuario) return "Sin nombre";
    const nombre =
      usuario.nombre_usuario || usuario.nombres || usuario.nombre || "";
    const apellido =
      usuario.apellido_usuario || usuario.apellidos || usuario.apellido || "";
    const nombreCompleto = `${nombre} ${apellido}`.trim();
    if (nombreCompleto) return nombreCompleto;
    return usuario.email || `Usuario ${usuario.id_usuario ?? ""}`;
  };

  const usuarioSeleccionado = useMemo(() => {
    const idUsuario = Number(formData.id_usuario);
    if (!idUsuario || Number.isNaN(idUsuario)) return null;
    const usuario = usuarios.find((u) => Number(u.id_usuario) === idUsuario);
    if (!usuario) {
      return {
        id_usuario: idUsuario,
        nombre_usuario: `Usuario ${idUsuario}`,
        email: "",
      };
    }
    return usuario;
  }, [formData.id_usuario, usuarios]);

  const usuariosFiltrados = useMemo(() => {
    const query = normalizarBusqueda(busquedaUsuario);
    if (!query) return usuarios.slice(0, 20);
    return usuarios
      .filter((u) => {
        const nombre = getNombreUsuario(u);
        const email = u.email || u.correo || u.correo_electronico || "";
        const documento =
          u.documento ||
          u.numero_documento ||
          u.num_documento ||
          u.identificacion ||
          u.id_documento ||
          u.cedula ||
          "";
        const searchable = normalizarBusqueda(
          `${u.id_usuario ?? ""} ${nombre} ${email} ${documento}`
        );
        return searchable.includes(query);
      })
      .slice(0, 20);
  }, [busquedaUsuario, usuarios]);

  const seleccionarUsuario = (usuario) => {
    if (!tieneValor(usuario?.id_usuario)) return;
    const nextFormData = {
      ...formData,
      id_usuario: String(usuario.id_usuario),
    };
    setFormData(nextFormData);
    setBusquedaUsuario("");
    setMostrarDropdownUsuario(false);
    setErrores(buildValidationErrors(nextFormData));
  };

  const limpiarUsuarioSeleccionado = () => {
    const nextFormData = {
      ...formData,
      id_usuario: "",
    };
    setFormData(nextFormData);
    setBusquedaUsuario("");
    setMostrarDropdownUsuario(false);
    setErrores(buildValidationErrors(nextFormData));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validar()) return;

    const fechaStr = (formData.fecha_registro || "").trim();
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    // Normaliza la fecha: si es inválida o futura, fuerza hoy para evitar 500 del backend
    let fechaNormalizada = fechaRegex.test(fechaStr) ? fechaStr : hoy;

    // Comparar fechas correctamente (convertir a objetos Date para comparacion)
    const fechaSeleccionada = new Date(fechaNormalizada);
    const fechaHoy = new Date(hoy);
    fechaSeleccionada.setHours(0, 0, 0, 0);
    fechaHoy.setHours(0, 0, 0, 0);

    if (fechaSeleccionada > fechaHoy) {
      fechaNormalizada = hoy;
    }

    const observacionesNormalizadas =
      normalizarTexto(formData.observaciones).slice(
        0,
        OBSERVACIONES_MAX_LENGTH
      ) || null;

    const detallesNormalizados = formData.detalles.map((detalle) => {
      const parametro = normalizarTexto(detalle.parametro);
      const propiedad = normalizarTexto(detalle.propiedad);
      const idMaestro =
        detalle.id_maestro_p ?? resolveMaestroId(detalle.parametro);
      const idCaracteristica =
        detalle.id_caracteristica ?? resolveCaracteristicaId(detalle.propiedad);
      const valor =
        detalle.valor_numerico === "" ? null : Number(detalle.valor_numerico);

      return {
        ...(detalle.id_detalle ? { id_detalle: detalle.id_detalle } : {}),
        ...(detalle.id_relacion_seguimiento
          ? { id_relacion_seguimiento: detalle.id_relacion_seguimiento }
          : {}),
        ...(idMaestro ? { id_maestro_p: idMaestro } : {}),
        ...(idCaracteristica ? { id_caracteristica: idCaracteristica } : {}),
        ...(parametro ? { parametro } : {}),
        ...(propiedad ? { nombre_caracteristica: propiedad } : {}),
        ...(observacionesNormalizadas
          ? { observaciones: observacionesNormalizadas }
          : {}),
        valor,
        valor_numerico: valor,
      };
    });

    const payload = {
      id: registro?.id,
      id_usuario: Number(formData.id_usuario),
      deporte: normalizarTexto(formData.deporte) || null,
      actividad: normalizarTexto(formData.actividad) || null,
      observaciones: observacionesNormalizadas,
      fecha_registro: fechaNormalizada,
      detalles: detallesNormalizados,
    };

    try {
      const resultado = await onSubmit(payload);
      if (resultado === false) {
        toast.error(
          esEdicion
            ? "No se pudo editar el seguimiento"
            : "No se pudo crear el seguimiento"
        );
        return;
      }

      toast.success(
        esEdicion
          ? "Seguimiento editado exitosamente"
          : "Seguimiento creado exitosamente"
      );
      onClose();
    } catch (error) {
      const mensaje =
        error?.response?.data?.message ||
        error?.response?.data?.msg ||
        error?.message ||
        (esEdicion
          ? "No se pudo editar el seguimiento"
          : "No se pudo crear el seguimiento");
      toast.error(mensaje);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={registro ? "Editar Seguimiento" : "Nuevo Seguimiento"}
      size="md"
      className="modal-mediano modal-seguimiento-form-modal"
    >
      <motion.form
        id="seguimientoForm"
        onSubmit={handleSubmit}
        className="modal-seguimiento-form"
        noValidate
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <motion.div
          data-seg-style="1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="modal-form-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
          >
            <h3 className="modal-section-title">Datos Generales</h3>
            <div
              data-seg-style="2"
            >
              <div data-seg-style="3">
                <label className="modal-field-label">
                  Id de usuario <span data-seg-style="4">*</span>
                </label>
                {usuarioSeleccionado ? (
                  <div className="modal-seguimiento__selected-user">
                    <div className="modal-seguimiento__selected-user-info">
                      <div className="modal-seguimiento__selected-user-name">
                        {usuarioSeleccionado.id_usuario} -{" "}
                        {getNombreUsuario(usuarioSeleccionado)}
                      </div>
                      <div className="modal-seguimiento__selected-user-email">
                        {usuarioSeleccionado.email || "Sin correo"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={limpiarUsuarioSeleccionado}
                      className="modal-seguimiento__clear-user-btn"
                      title="Quitar usuario seleccionado"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="modal-seguimiento__user-selector">
                    <div
                      className={`modal-seguimiento__search-box${
                        errores.id_usuario
                          ? " modal-seguimiento__search-box--error"
                          : ""
                      }`}
                    >
                      <Search
                        size={16}
                        className="modal-seguimiento__search-icon"
                      />
                      <input
                        type="text"
                        value={busquedaUsuario}
                        onFocus={() => {
                          asegurarUsuariosCargados();
                          setMostrarDropdownUsuario(true);
                        }}
                        onClick={asegurarUsuariosCargados}
                        onChange={(e) => {
                          setBusquedaUsuario(e.target.value);
                          setMostrarDropdownUsuario(true);
                        }}
                        onBlur={() =>
                          setTimeout(() => setMostrarDropdownUsuario(false), 120)
                        }
                        placeholder={
                          cargandoUsuarios
                            ? "Cargando clientes..."
                            : "Buscar cliente por ID, nombre, correo o documento (o elegir de la lista)..."
                        }
                        className="modal-seguimiento__search-input"
                      />
                    </div>

                    {mostrarDropdownUsuario && (
                        <div className="modal-seguimiento__search-dropdown">
                          {cargandoUsuarios ? (
                            <div className="modal-seguimiento__search-message">
                              Buscando clientes...
                            </div>
                          ) : usuariosFiltrados.length > 0 ? (
                            usuariosFiltrados.map((usuario) => (
                              <div
                                key={usuario.id_usuario}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  seleccionarUsuario(usuario);
                                }}
                                className="modal-seguimiento__search-option"
                              >
                                <div className="modal-seguimiento__search-option-name">
                                  {usuario.id_usuario} - {getNombreUsuario(usuario)}
                                </div>
                                <div className="modal-seguimiento__search-option-email">
                                  {usuario.email || "Sin correo"}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="modal-seguimiento__search-message">
                              {busquedaUsuario.trim()
                                ? "No se encontraron clientes"
                                : "No hay clientes para mostrar"}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                )}
                <small data-seg-style="5">
                  Selecciona un cliente para asociar el seguimiento.
                </small>
                {errores.id_usuario && (
                  <p
                    data-seg-style="6"
                  >
                    {errores.id_usuario}
                  </p>
                )}
                {errorUsuarios && (
                  <p
                    data-seg-style="6"
                  >
                    {errorUsuarios}
                  </p>
                )}
              </div>

              <div data-seg-style="3">
                <label className="modal-field-label">Deporte (opcional)</label>
                <input
                  type="text"
                  name="deporte"
                  value={formData.deporte}
                  onChange={handleChange}
                  placeholder="Ej: Futbol, Crossfit..."
                  maxLength="80"
                  className={buildSeguimientoInputClass(!!errores.deporte)}
                />
              </div>

              <div data-seg-style="3">
                <label className="modal-field-label">Actividad (opcional)</label>
                <input
                  type="text"
                  name="actividad"
                  value={formData.actividad}
                  onChange={handleChange}
                  placeholder="Ej: Cardio, Fuerza..."
                  maxLength="80"
                  className={buildSeguimientoInputClass(!!errores.actividad)}
                />
              </div>

              <div data-seg-style="3">
                <label className="modal-field-label">
                  Fecha de registro <span data-seg-style="4">*</span>
                </label>
                <input
                  type="text"
                  name="fecha_registro"
                  value={formData.fecha_registro || hoy}
                  readOnly
                  onFocus={(e) => e.target.blur()}
                  required
                  className={buildSeguimientoInputClass(
                    !!errores.fecha_registro,
                    "modal-seguimiento__input-readonly"
                  )}
                />
                {errores.fecha_registro && (
                  <p
                    data-seg-style="6"
                  >
                    {errores.fecha_registro}
                  </p>
                )}
              </div>

              <div data-seg-style="7">
                <label className="modal-field-label">Observaciones (opcional)</label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  placeholder="Observaciones adicionales..."
                  maxLength={OBSERVACIONES_MAX_LENGTH}
                  rows={3}
                  className={buildSeguimientoInputClass(
                    !!errores.observaciones,
                    "modal-seguimiento__textarea"
                  )}
                />
                <p className="modal-seguimiento__helper-text">
                  {formData.observaciones.length}/{OBSERVACIONES_MAX_LENGTH}
                </p>
                {errores.observaciones && (
                  <p
                    data-seg-style="6"
                  >
                    {errores.observaciones}
                  </p>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="modal-form-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <h3 className="modal-section-title">Parametros Medidos</h3>

            <div
              data-seg-style="8"
            >
              <button
                type="button"
                onClick={agregarDetalle}
                className="boton boton-primario modal-seguimiento__add-btn"
              >
                <PlusCircle size={16} data-seg-style="9" />
                Agregar Parametro
              </button>
            </div>

            {errores.detalles && (
              <p data-seg-style="10">
                {errores.detalles}
              </p>
            )}
            {errores.caracteristicas && (
              <p data-seg-style="10">
                {errores.caracteristicas}
              </p>
            )}
            {errorMaestro && (
              <p data-seg-style="10">
                {errorMaestro}
              </p>
            )}
            <div
              id="paramList"
              className="modal-seguimiento__param-list"
              data-seg-style="11"
            >
              {formData.detalles.map((detalle, idx) => {
                const err = errores.detalleCampos?.[idx] || {};
                const detalleEsObligatorio = Boolean(detalle.esObligatorio);
                const parametroNormalizado = normalizarBusqueda(detalle.parametro);
                const propiedadActualNormalizada = normalizarBusqueda(
                  detalle.propiedad
                );
                const caracteristicasBloqueadas = parametroNormalizado
                  ? new Set(
                      formData.detalles
                        .filter(
                          (d) =>
                            d.tempId !== detalle.tempId &&
                            normalizarBusqueda(d.parametro) ===
                              parametroNormalizado
                        )
                        .map((d) => normalizarBusqueda(d.propiedad))
                        .filter(Boolean)
                    )
                  : new Set();
                const caracteristicasDisponibles = caracteristicas.filter(
                  (item) => {
                    const nombreNormalizado = normalizarBusqueda(
                      item?.nombre ?? ""
                    );
                    if (!nombreNormalizado) return false;
                    if (nombreNormalizado === propiedadActualNormalizada)
                      return true;
                    return !caracteristicasBloqueadas.has(nombreNormalizado);
                  }
                );
                const listaCaracteristicasId = `seguimiento-caracteristicas-list-${detalle.tempId}`;
                return (
                  <motion.div
                    key={detalle.tempId}
                    className="modal-form-card modal-seguimiento__detail-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05, duration: 0.2 }}
                  >
                    <div>
                      <label className="modal-field-label modal-seguimiento__detail-label">
                        Parametro <span data-seg-style="4">*</span>
                      </label>
                      <input
                        type="text"
                        list="seguimiento-parametros-list"
                        placeholder="Ej: Cineantropometria"
                        maxLength={200}
                        value={detalle.parametro}
                        readOnly={detalleEsObligatorio}
                        onChange={(e) =>
                          handleDetalleChange(
                            detalle.tempId,
                            "parametro",
                            e.target.value
                          )
                        }
                        required
                        className={buildSeguimientoInputClass(
                          !!err.parametro,
                          `modal-seguimiento__select-input${
                            detalleEsObligatorio
                              ? " modal-seguimiento__input-readonly"
                              : ""
                          }`
                        )}
                      />
                      {err.parametro && (
                        <p
                          data-seg-style="12"
                        >
                          {err.parametro}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="modal-field-label modal-seguimiento__detail-label">
                        Caracteristica <span data-seg-style="4">*</span>
                      </label>
                      <input
                        type="text"
                        list={listaCaracteristicasId}
                        placeholder="Ej: Peso"
                        maxLength={200}
                        value={detalle.propiedad}
                        readOnly={detalleEsObligatorio}
                        onChange={(e) =>
                          handleDetalleChange(
                            detalle.tempId,
                            "propiedad",
                            e.target.value
                          )
                        }
                        required
                        className={buildSeguimientoInputClass(
                          !!err.propiedad,
                          `modal-seguimiento__select-input${
                            detalleEsObligatorio
                              ? " modal-seguimiento__input-readonly"
                              : ""
                          }`
                        )}
                      />
                      {err.propiedad && (
                        <p
                          data-seg-style="12"
                        >
                          {err.propiedad}
                        </p>
                      )}
                      {caracteristicasDisponibles.length > 0 && (
                        <datalist id={listaCaracteristicasId}>
                          {caracteristicasDisponibles.map((item, index) => (
                            <option
                              key={`caracteristica-sugerida-${detalle.tempId}-${item.id ?? "custom"}-${index}`}
                              value={item.nombre}
                            />
                          ))}
                        </datalist>
                      )}
                    </div>

                    <div>
                      <label className="modal-field-label modal-seguimiento__detail-label">
                        Valor numerico
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 70.5"
                        inputMode="decimal"
                        value={detalle.valor_numerico}
                        onKeyDown={(e) => handleDetalleValorKeyDown(e, detalle)}
                        onPaste={(e) => handleDetalleValorPaste(e, detalle)}
                        onChange={(e) =>
                          handleDetalleChange(
                            detalle.tempId,
                            "valor_numerico",
                            e.target.value
                          )
                        }
                        className={buildSeguimientoInputClass(
                          !!err.valor_numerico
                        )}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => eliminarDetalle(detalle.tempId)}
                      className="boton boton-secundario modal-seguimiento__remove-btn"
                      data-seg-style="13"
                      title={
                        detalleEsObligatorio
                          ? "Peso y Altura son obligatorios"
                          : "Eliminar parametro"
                      }
                      disabled={detalleEsObligatorio}
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                );
              })}
              {parametrosSugeridos.length > 0 && (
                <datalist id="seguimiento-parametros-list">
                  {parametrosSugeridos.map((item, index) => (
                    <option
                      key={`parametro-sugerido-${item.id ?? "custom"}-${index}`}
                      value={item.nombre}
                    />
                  ))}
                </datalist>
              )}
            </div>
          </motion.div>

          <motion.div
            className="pie-modal contenedor-botones modal-seguimiento__footer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <button
              type="button"
              className="boton boton-secundario modal-seguimiento__btn-cancel"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="boton boton-primario modal-seguimiento__btn-save"
              disabled={procesando}
            >
              {esEdicion ? "Actualizar Seguimiento" : "Registrar Seguimiento"}
            </button>
          </motion.div>
        </motion.div>
      </motion.form>
    </Modal>
  );
};

export const ModalEliminarSeguimiento = ({
  isOpen,
  onClose,
  onConfirm,
  registro,
  procesando = false,
}) => {
  if (!isOpen || !registro) return null;

  const handleConfirmDelete = () => {
    onConfirm(registro);
  };

  return (
    <DeleteModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirmDelete}
      item={registro}
      title="Eliminar Seguimiento"
      fields={[
        {
          key: "id_usuario",
          label: "ID Usuario",
          format: (value) => <strong>{value || "No especificado"}</strong>,
        },
        {
          key: "fecha_registro",
          label: "Fecha Registro",
          format: (value) => value || "No especificada",
        },
        {
          key: "deporte",
          label: "Deporte",
          format: (value) => value || "No especificado",
        },
        {
          key: "actividad",
          label: "Actividad",
          format: (value) => value || "No especificada",
        },
        {
          key: "detalles",
          label: "Parametros",
          format: (value) =>
            `${Array.isArray(value) ? value.length : 0} registrados`,
        },
      ]}
      warningMessage={
        <div>
          <p>
            Al eliminar este seguimiento, se perdera toda la información
            asociada incluyendo:
          </p>
          <ul data-seg-style="14">
            <li>Historial de parametros medidos</li>
            <li>Información de evaluacion fisica</li>
            <li>Relaciones con caracteristicas registradas</li>
          </ul>
          <p data-seg-style="15">
            Estas completamente seguro de que deseas continuar?
          </p>
        </div>
      }
    />
  );
};

export const ModalVerSeguimiento = ({ isOpen, onClose, registro }) => {
  const [usuarioDetalle, setUsuarioDetalle] = useState(null);
  const [cargandoUsuario, setCargandoUsuario] = useState(false);
  const [errorUsuario, setErrorUsuario] = useState("");
  const [maestroParametros, setMaestroParametros] = useState([]);
  const [caracteristicasCatalogo, setCaracteristicasCatalogo] = useState([]);
  const [relacionesCatalogo, setRelacionesCatalogo] = useState([]);

  useEffect(() => {
    let cancelado = false;
    const cargarCatalogos = async () => {
      if (!isOpen) return;
      try {
        const [maestrosData, caracteristicasData, relacionesData] =
          await Promise.all([
            getMaestroParametros(),
            getCaracteristicas(),
            getRelacionesSeguimiento(),
          ]);
        if (!cancelado) {
          setMaestroParametros(
            Array.isArray(maestrosData) ? maestrosData : []
          );
          setCaracteristicasCatalogo(
            Array.isArray(caracteristicasData) ? caracteristicasData : []
          );
          setRelacionesCatalogo(
            Array.isArray(relacionesData) ? relacionesData : []
          );
        }
      } catch (error) {
        if (!cancelado) {
          setMaestroParametros([]);
          setCaracteristicasCatalogo([]);
          setRelacionesCatalogo([]);
        }
      }
    };
    cargarCatalogos();
    return () => {
      cancelado = true;
    };
  }, [isOpen]);

  useEffect(() => {
    let cancelado = false;
    const cargarUsuario = async () => {
      const usuarioEnRegistro =
        normalizarUsuarios(
          registro?.id_usuario_usuario ??
            registro?.usuario ??
            registro?.usuario_data ??
            null
        )[0] || null;

      if (!isOpen || !registro?.id_usuario) {
        setUsuarioDetalle(usuarioEnRegistro);
        return;
      }
      try {
        setCargandoUsuario(true);
        setErrorUsuario("");
        const [detalleResp, listaResp, rolesResp] = await Promise.allSettled([
          obtenerUsuarioPorId(registro.id_usuario),
          obtenerUsuarios(),
          obtenerRolesUsuarios(),
        ]);

        const desdeDetalle = normalizarUsuarios(
          detalleResp.status === "fulfilled" ? detalleResp.value : null
        )[0] || null;

        const desdeLista =
          normalizarUsuarios(
            listaResp.status === "fulfilled" ? listaResp.value : null
          ).find(
            (u) => Number(u.id_usuario) === Number(registro.id_usuario)
          ) || null;

        const payloadRoles =
          rolesResp.status === "fulfilled"
            ? rolesResp.value?.data ?? rolesResp.value
            : null;
        const desdeRoles =
          normalizarUsuarios(payloadRoles).find(
            (u) => Number(u.id_usuario) === Number(registro.id_usuario)
          ) || null;

        if (!cancelado) {
          const normalizado = mezclarUsuarios(
            usuarioEnRegistro,
            desdeLista,
            desdeRoles,
            desdeDetalle
          );

          setUsuarioDetalle(normalizado);
          if (!normalizado || !tieneValor(normalizado.id_usuario)) {
            setErrorUsuario("No se encontro detalle del usuario en la API.");
          }
        }
      } catch (error) {
        console.error("No se pudo cargar detalle de usuario:", error);
        if (!cancelado) {
          setUsuarioDetalle(usuarioEnRegistro);
          if (!usuarioEnRegistro) {
            setErrorUsuario("No se pudo cargar información del usuario.");
          }
        }
      } finally {
        if (!cancelado) setCargandoUsuario(false);
      }
    };
    cargarUsuario();
    return () => {
      cancelado = true;
    };
  }, [isOpen, registro]);

  const maestroMap = useMemo(() => {
    const map = new Map();
    maestroParametros.forEach((item) => {
      if (item?.id !== null && item?.id !== undefined) {
        map.set(String(item.id), item.nombre ?? "");
      }
    });
    return map;
  }, [maestroParametros]);

  const caracteristicaMap = useMemo(() => {
    const map = new Map();
    caracteristicasCatalogo.forEach((item) => {
      if (item?.id !== null && item?.id !== undefined) {
        map.set(String(item.id), item.nombre ?? "");
      }
    });
    return map;
  }, [caracteristicasCatalogo]);

  const relacionMap = useMemo(() => {
    const map = new Map();
    relacionesCatalogo.forEach((item) => {
      if (item?.id_relacion !== null && item?.id_relacion !== undefined) {
        map.set(String(item.id_relacion), item);
      }
    });
    return map;
  }, [relacionesCatalogo]);

  const detallesNormalizados = useMemo(() => {
    const lista = Array.isArray(registro?.detalles) ? registro.detalles : [];
    return lista.map((det) => {
      const idRelacion =
        det.id_relacion_seguimiento ??
        det.id_relacion ??
        det.relacion_id ??
        det?.relacion_seguimiento?.id_relacion_seguimien ??
        null;
      const relacion = idRelacion
        ? relacionMap.get(String(idRelacion))
        : null;
      const idMaestro =
        det.id_maestro_p ??
        det.id_maestro ??
        det.id_parametro ??
        det.id_maestro_parametro ??
        det.id_maestro_parametros ??
        det?.relacion_seguimiento?.id_maestro_p ??
        det?.relacion_seguimiento?.maestro_parametros?.id_maestro_p ??
        null;

      const idCaracteristica =
        det.id_caracteristica ??
        det.id_caracteristicas ??
        det.caracteristica_id ??
        det.id_caracteristica_car ??
        det?.relacion_seguimiento?.id_caracteristica ??
        det?.relacion_seguimiento?.caracteristica?.id_caracteristica ??
        null;

      const parametro =
        det.parametro ||
        det.nombre_parametro ||
        det.parametro_nombre ||
        (idMaestro !== null && idMaestro !== undefined
          ? maestroMap.get(String(idMaestro))
          : null) ||
        relacion?.parametro ||
        det?.relacion_seguimiento?.maestro_parametros?.parametro ||
        det?.relacion_seguimiento?.maestro ||
        (idMaestro !== null && idMaestro !== undefined
          ? `Parametro ${idMaestro}`
          : "");

      const nombre_caracteristica =
        det.nombre_caracteristica ||
        det.caracteristica ||
        det.propiedad ||
        det.nombre_caracteristica_s ||
        (idCaracteristica !== null && idCaracteristica !== undefined
          ? caracteristicaMap.get(String(idCaracteristica))
          : null) ||
        relacion?.nombre_caracteristica ||
        det?.relacion_seguimiento?.caracteristica?.nombre_caracteristica ||
        det?.relacion_seguimiento?.caracteristica ||
        (idCaracteristica !== null && idCaracteristica !== undefined
          ? `Caracteristica ${idCaracteristica}`
          : "");

          const valor =
        det.valor_numerico ??
        det.valor ??
        det.valor_medido ??
        relacion?.valor ??
        det?.relacion_seguimiento?.valor ??
        det?.relacion_seguimiento?.valor_numerico ??
        det?.relacion_seguimiento?.valor_medido ??
        null;

      return {
        ...det,
        id_maestro_p: det.id_maestro_p ?? idMaestro ?? null,
        id_caracteristica: det.id_caracteristica ?? idCaracteristica ?? null,
        parametro,
        nombre_caracteristica,
        valor_numerico: valor,
      };
    });
  }, [registro, maestroMap, caracteristicaMap, relacionMap]);

  if (!isOpen || !registro) return null;

  // Funciones auxiliares
  const obtenerValorDetalle = (coincidencias = [], preferirMax = false) => {
    const lista = detallesNormalizados;
    const keys = coincidencias.map((c) => c.toLowerCase());
    const candidatos = lista.filter((det) => {
      const candidato = `${det.parametro || ""} ${
        det.nombre_caracteristica || ""
      }`.toLowerCase();
      return keys.some((k) => candidato.includes(k));
    });
    if (!candidatos.length) return null;
    if (preferirMax) {
      const conValor = candidatos
        .map((d) => {
          const raw =
            d.valor_numerico ?? d.valor ?? d.valor_medido ?? null;
          if (raw === null || raw === undefined || raw === "") return null;
          const num = Number(raw);
          if (Number.isNaN(num)) return null;
          return { ...d, _valor: num };
        })
        .filter(Boolean);
      if (conValor.length) {
        const max = conValor.reduce(
          (acc, cur) => (cur._valor > acc._valor ? cur : acc),
          conValor[0]
        );
        return max.valor_numerico ?? max.valor ?? max.valor_medido ?? null;
      }
    }
    const det = candidatos[0];
    return det.valor_numerico ?? det.valor ?? det.valor_medido ?? null;
  };

  const formatearFecha = (valor) => {
    if (!valor) return null;
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return valor;
    return fecha.toISOString().slice(0, 10);
  };

  const formatearGenero = (valor) => {
    const raw = (valor ?? "").toString().trim().toLowerCase();
    if (!raw) return null;
    if (raw === "m" || raw === "masculino" || raw === "male") return "Masculino";
    if (raw === "f" || raw === "femenino" || raw === "female") return "Femenino";
    return valor;
  };

  const calcularEdadDecimal = (fechaNac) => {
    if (!fechaNac) return null;
    const nacimiento = new Date(fechaNac);
    if (Number.isNaN(nacimiento.getTime())) return null;
    const ahora = new Date();
    const diffMs = ahora - nacimiento;
    const anos = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    return anos.toFixed(1);
  };

  const extraerNumero = (valor) => {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
    const texto = String(valor).replace(",", ".");
    const match = texto.match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
  };

  const calcularImc = (pesoValor, alturaValor) => {
    const pesoNum = extraerNumero(pesoValor);
    const alturaNum = extraerNumero(alturaValor);
    if (!Number.isFinite(pesoNum) || !Number.isFinite(alturaNum)) return null;
    if (pesoNum <= 0 || alturaNum <= 0) return null;
    const alturaMetros = alturaNum > 3 ? alturaNum / 100 : alturaNum;
    if (alturaMetros <= 0) return null;
    const imcCalc = pesoNum / (alturaMetros * alturaMetros);
    return Number.isFinite(imcCalc) ? imcCalc : null;
  };

  const obtenerEstadoImc = (imcValor) => {
    if (!Number.isFinite(imcValor)) return null;
    if (imcValor < 16) return "Delgadez severa";
    if (imcValor < 17) return "Delgadez moderada";
    if (imcValor < 18.5) return "Delgadez leve";
    if (imcValor < 25) return "Peso saludable";
    if (imcValor < 30) return "Sobrepeso (Pre-obesidad)";
    if (imcValor < 35) return "Obesidad grado I";
    if (imcValor < 40) return "Obesidad grado II";
    return "Obesidad grado III";
  };

  // Información del usuario
  const nombreCompleto = (() => {
    const base =
      usuarioDetalle?.nombre_usuario ||
      usuarioDetalle?.nombres ||
      usuarioDetalle?.nombre ||
      registro?.nombre_usuario ||
      null;
    const apellidos =
      usuarioDetalle?.apellido_usuario ||
      usuarioDetalle?.apellidos ||
      usuarioDetalle?.apellido ||
      "";
    return `${base || ""} ${apellidos}`.trim() || null;
  })();

  const email =
    usuarioDetalle?.email ||
    usuarioDetalle?.correo ||
    usuarioDetalle?.correo_electronico ||
    usuarioDetalle?.email_usuario ||
    usuarioDetalle?.correo_usuario ||
    registro?.email ||
    registro?.correo ||
    registro?.correo_electronico ||
    registro?.email_usuario ||
    registro?.id_usuario_usuario?.email ||
    registro?.id_usuario_usuario?.correo ||
    registro?.id_usuario_usuario?.correo_electronico ||
    null;
  const telefono =
    usuarioDetalle?.telefono ||
    usuarioDetalle?.numero_telefono ||
    usuarioDetalle?.telefono_movil ||
    usuarioDetalle?.telefono_celular ||
    usuarioDetalle?.celular ||
    usuarioDetalle?.phone ||
    usuarioDetalle?.telefono_usuario ||
    usuarioDetalle?.celular_usuario ||
    registro?.telefono ||
    registro?.celular ||
    registro?.phone ||
    registro?.telefono_usuario ||
    registro?.celular_usuario ||
    registro?.id_usuario_usuario?.telefono ||
    registro?.id_usuario_usuario?.celular ||
    null;
  const sexo =
    formatearGenero(
      usuarioDetalle?.genero ||
        usuarioDetalle?.sexo ||
        usuarioDetalle?.gender ||
        registro?.genero ||
        registro?.sexo ||
        registro?.gender ||
        registro?.id_usuario_usuario?.genero ||
        registro?.id_usuario_usuario?.sexo ||
        registro?.id_usuario_usuario?.gender
    ) || null;
  const fechaNacimiento = formatearFecha(
    usuarioDetalle?.fecha_nacimiento ||
      usuarioDetalle?.fecha_nac ||
      usuarioDetalle?.birthdate ||
      usuarioDetalle?.fechaNacimiento ||
      usuarioDetalle?.nacimiento ||
      registro?.fecha_nacimiento ||
      registro?.fecha_nac ||
      registro?.birthdate ||
      registro?.fechaNacimiento ||
      registro?.nacimiento ||
      registro?.id_usuario_usuario?.fecha_nacimiento ||
      registro?.id_usuario_usuario?.fecha_nac ||
      registro?.id_usuario_usuario?.birthdate ||
      registro?.id_usuario_usuario?.fechaNacimiento ||
      registro?.id_usuario_usuario?.nacimiento
  );
  const edadDecimal = calcularEdadDecimal(fechaNacimiento);

  // Información de evaluacion
  const altura = obtenerValorDetalle(["altura", "talla"], true);
  const peso =
    obtenerValorDetalle(["peso"], true) ||
    (usuarioDetalle?.peso ? `${usuarioDetalle.peso}` : null);
  const imcRegistrado = obtenerValorDetalle([
    "imc",
    "indice de masa",
    "indice de masa",
  ]);
  const estadoImcRegistrado = obtenerValorDetalle([
    "estado imc",
    "estado del imc",
  ]);
  const imcCalculado = calcularImc(peso, altura);
  const imc = imcRegistrado ?? (imcCalculado ? imcCalculado.toFixed(1) : null);
  const imcParaEstado =
    extraerNumero(imcRegistrado) ?? (imcCalculado ?? null);
  const estadoImc =
    estadoImcRegistrado ?? (imcParaEstado ? obtenerEstadoImc(imcParaEstado) : null);
  const periodo = "Mensual";
  const actividadFisica =
    registro?.actividad || obtenerValorDetalle(["actividad"]);
  const primerDetalleConObservaciones = detallesNormalizados.find((det) =>
    normalizarTexto(
      det.observaciones ??
        det.observacion ??
        det.comentario ??
        det.notas ??
        ""
    )
  );
  const observacionesDetalle =
    primerDetalleConObservaciones?.observaciones ??
    primerDetalleConObservaciones?.observacion ??
    primerDetalleConObservaciones?.comentario ??
    primerDetalleConObservaciones?.notas ??
    null;
  const observaciones = obtenerPrimeroConTexto(
    registro?.observaciones,
    registro?.observacion,
    observacionesDetalle,
    obtenerValorDetalle(["observacion", "observaciones"])
  );

  const fechaRegistroFormateada = formatearFecha(registro.fecha_registro);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className="modal-overlay capa-modal"
          data-seg-style="16"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        >
          <motion.div
            data-seg-style="17"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              data-seg-style="18"
              onClick={onClose}
            >
              &times;
            </span>
            <div
              data-seg-style="19"
            >
              <h1 data-seg-style="20">
                {nombreCompleto || "Usuario sin nombre"}
              </h1>
              <p data-seg-style="21">
                Visualiza rapido los datos clave y el estado de los parametros registrados.
              </p>
            </div>

            <div
              data-seg-style="23"
            >
              <h2
                data-seg-style="24"
              >
                Información Personal
              </h2>
              <div
                data-seg-style="25"
              >
                <div
                  data-seg-style="26"
                >
                  <span>Nombre:</span>
                  <span
                    data-seg-style="27"
                  >
                    {nombreCompleto || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="26"
                >
                  <span>Correo:</span>
                  <span
                    data-seg-style="28"
                  >
                    {email || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="26"
                >
                  <span>Teléfono:</span>
                  <span
                    data-seg-style="28"
                  >
                    {telefono || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="26"
                >
                  <span>Sexo:</span>
                  <span
                    data-seg-style="28"
                  >
                    {sexo || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="26"
                >
                  <span>Nacimiento:</span>
                  <span
                    data-seg-style="28"
                  >
                    {fechaNacimiento || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="29"
                >
                  <span>Edad:</span>
                  <span
                    data-seg-style="27"
                  >
                    {edadDecimal ? `${edadDecimal} anos` : "No registrada"}
                  </span>
                </div>
              </div>
            </div>

            <div
              data-seg-style="23"
            >
              <h2
                data-seg-style="24"
              >
                Evaluacion Fisica
              </h2>
              <div
                data-seg-style="25"
              >
                <div
                  data-seg-style="26"
                >
                  <span>Deporte:</span>
                  <span
                    data-seg-style="27"
                  >
                    {registro.deporte || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="29"
                >
                  <span>Actividad:</span>
                  <span
                    data-seg-style="27"
                  >
                    {actividadFisica || "No registrado"}
                  </span>
                </div>
              </div>
            </div>

            <div
              data-seg-style="23"
            >
              <h2
                data-seg-style="24"
              >
                Información de Control
              </h2>
              <div
                data-seg-style="25"
              >
                <div
                  data-seg-style="30"
                >
                  <span>Altura:</span>
                  <span
                    data-seg-style="31"
                  >
                    {altura ? `${altura} cm` : "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="30"
                >
                  <span>Peso:</span>
                  <span
                    data-seg-style="31"
                  >
                    {peso ? `${peso} kg` : "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="30"
                >
                  <span>IMC:</span>
                  <span
                    data-seg-style="31"
                  >
                    {imc || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="30"
                >
                  <span>Estado IMC:</span>
                  <span
                    data-seg-style="31"
                  >
                    {estadoImc || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="30"
                >
                  <span>Periodo:</span>
                  <span
                    data-seg-style="31"
                  >
                    {periodo || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="30"
                >
                  <span>Actividad:</span>
                  <span
                    data-seg-style="31"
                  >
                    {actividadFisica || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="30"
                >
                  <span>Fecha:</span>
                  <span
                    data-seg-style="31"
                  >
                    {fechaRegistroFormateada || "No registrado"}
                  </span>
                </div>
                <div
                  data-seg-style="32"
                >
                  <span>Observaciones:</span>
                  <span
                    data-seg-style="31"
                  >
                    {observaciones || "Sin observaciones"}
                  </span>
                </div>
              </div>
            </div>

            <div
              data-seg-style="33"
            >
              <h2
                data-seg-style="34"
              >
                Detalle de Parametros
              </h2>
              <div data-seg-style="35">
                <table
                  data-seg-style="36"
                >
                  <thead
                    data-seg-style="37"
                  >
                    <tr>
                      <th
                        data-seg-style="38"
                      >
                        Parametro
                      </th>
                      <th
                        data-seg-style="38"
                      >
                        Caracteristica
                      </th>
                      <th
                        data-seg-style="38"
                      >
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallesNormalizados.length > 0 ? (
                      detallesNormalizados.map((detalle, index) => (
                        <tr key={index}>
                          <td
                            data-seg-style="39"
                          >
                            {detalle.parametro || "No registrado"}
                          </td>
                          <td
                            data-seg-style="39"
                          >
                            {detalle.nombre_caracteristica || "No registrado"}
                          </td>
                          <td
                            data-seg-style="39"
                          >
                            {detalle.valor_numerico === null ||
                            detalle.valor_numerico === undefined ||
                            detalle.valor_numerico === ""
                              ? "No registrado"
                              : detalle.valor_numerico}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="3"
                          data-seg-style="40"
                        >
                          No hay parametros registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
