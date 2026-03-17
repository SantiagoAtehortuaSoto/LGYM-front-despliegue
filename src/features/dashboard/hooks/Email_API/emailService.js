import { toast } from 'react-hot-toast';
import { buildApiUrl, buildUrl } from "../apiConfig";

// ConfiguraciÃ³n del servicio de correo
const EMAIL_CONFIG = {
  // Puedes cambiar estos valores segÃºn tu proveedor de correo
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true para 465, false para otros puertos
};

const parseNumeroSeguro = (valor, fallback = 0) => {
  if (valor === null || valor === undefined || valor === "") return fallback;
  const normalizado = String(valor).replace(",", ".").trim();
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : fallback;
};

// Normalizar detalles para correo
const normalizarDetallesPedido = (productos = []) =>
  (Array.isArray(productos) ? productos : [])
    .map((producto) => {
      const idProducto = parseInt(
        producto.idProducto ??
          producto.id_productos ??
          producto.id_producto ??
          producto.producto_id ??
          producto.idProductos ??
          producto?.id_productos_producto?.id_productos ??
          producto?.id_productos_producto?.id_producto ??
          producto?.producto?.id_productos ??
          producto.id ??
          "",
        10
      );
      const cantidad = parseNumeroSeguro(
        producto.cantidad ??
          producto.cantidad_producto ??
          producto.cantidad_detalle ??
          producto.unidades,
        0
      );
      const costoUnitario = parseNumeroSeguro(
        producto.costo_unitario ??
          producto.costoUnitario ??
          producto.precio ??
          producto.valor_unitario,
        0
      );
      const subtotal = parseNumeroSeguro(
        producto.subtotal ??
          producto.total ??
          (cantidad > 0 && costoUnitario > 0 ? cantidad * costoUnitario : 0),
        0
      );
      const nombreProducto =
        producto.nombre ||
        producto.nombre_producto ||
        producto.descripcion ||
        producto.producto ||
        producto?.id_productos_producto?.nombre ||
        producto.id_productos_producto?.nombre_producto ||
        producto?.producto?.nombre_producto ||
        "";

      return {
        id_productos: Number.isFinite(idProducto) ? idProducto : undefined,
        cantidad: Number.isFinite(cantidad) ? cantidad : 0,
        costo_unitario: Number.isFinite(costoUnitario) ? costoUnitario : 0,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        nombre_producto: nombreProducto || undefined
      };
    })
    .filter((detalle) => detalle.cantidad > 0);

const obtenerCorreoProveedor = (proveedor = {}) => {
  const candidatos = [
    proveedor?.email_proveedor,
    proveedor?.correo_proveedor,
    proveedor?.email,
    proveedor?.correo,
    proveedor?.mail,
  ];

  return candidatos
    .map((valor) => String(valor || "").trim())
    .find((valor) => Boolean(valor));
};

const ESTADOS_PEDIDO_POR_ID = {
  3: "Pendiente",
  4: "En Proceso",
  5: "Completado",
  6: "Cancelado",
};
const ESTADO_PENDIENTE_CANONICO = "Pendiente de aprobación";

const normalizarTextoEstado = (valor = "") =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const construirEstadoCompra = (pedido = {}) => {
  const idEstado = Number.parseInt(
    pedido.id_estado ?? pedido.estado_id ?? pedido.idEstado ?? "",
    10
  );
  const estadoTextoEntrada =
    pedido.estado_texto ??
    pedido.estado ??
    (Number.isFinite(idEstado) ? ESTADOS_PEDIDO_POR_ID[idEstado] : "");

  const estadoNormalizado = normalizarTextoEstado(estadoTextoEntrada);
  const esPendiente =
    idEstado === 3 ||
    estadoNormalizado === "PENDIENTE" ||
    estadoNormalizado === "PENDIENTE DE APROBACION";

  return {
    id_estado: Number.isFinite(idEstado) ? idEstado : undefined,
    estado: esPendiente
      ? ESTADO_PENDIENTE_CANONICO
      : estadoTextoEntrada || undefined,
    estado_texto: esPendiente
      ? ESTADO_PENDIENTE_CANONICO
      : estadoTextoEntrada || undefined,
  };
};

const esErrorEstadoNoPendiente = (error) => {
  const mensaje = String(error?.message || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    mensaje.includes("solo se puede enviar este correo") &&
    mensaje.includes("pendiente de aprobacion")
  );
};

const construirRutasCorreo = (endpoint = "") => {
  const endpointNormalizado = String(endpoint || "").replace(/^\/+/, "");
  const rutas = [
    buildApiUrl(`/${endpointNormalizado}`),
    buildUrl(`/${endpointNormalizado}`),
  ];

  return [...new Set(rutas)];
};

const postCorreoConFallback = async (endpoint, body) => {
  const rutas = construirRutasCorreo(endpoint);
  let ultimoError = null;
  const token = localStorage.getItem("token");

  for (const ruta of rutas) {
    try {
      const headers = {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(ruta, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        let data = {};
        try {
          data = await response.json();
        } catch {
          const text = await response.text();
          data = text ? { message: text } : {};
        }
        return { data, ruta };
      }

      const errorText = await response.text();
      const error = new Error(
        `Error ${response.status}: ${errorText || "Error al enviar el correo"}`
      );

      if (response.status === 404 || response.status === 405) {
        ultimoError = error;
        continue;
      }

      throw error;
    } catch (error) {
      ultimoError = error;
      const msg = String(error?.message || "");
      if (/Error 404:/i.test(msg)) {
        continue;
      }
      throw error;
    }
  }

  throw (
    ultimoError ||
    new Error("No se encontro un endpoint valido para envio de correo")
  );
};

// FunciÃ³n para crear el contenido HTML del correo
const crearContenidoCorreo = (pedido, proveedor, productos, opciones = {}) => {
  const { isUpdate = false } = opciones;
  const tituloPrincipal = isUpdate
    ? "ACTUALIZACION DE ORDEN DE COMPRA"
    : "ORDEN DE COMPRA";
  const mensajeIntro = isUpdate
    ? "Se ha actualizado el pedido con la siguiente informacion:"
    : "Se ha generado un pedido con la siguiente informacion:";

  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Orden de Compra - LGYM</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f4f4f4;
            }
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #e53e3e;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #e53e3e;
                margin-bottom: 10px;
            }
            .order-info {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                border-left: 4px solid #e53e3e;
            }
            .provider-info {
                background-color: #e8f4fd;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                border-left: 4px solid #3182ce;
            }
            .table-container {
                overflow-x: auto;
                margin-bottom: 20px;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            th, td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }
            th {
                background-color: #f8f9fa;
                font-weight: 600;
                color: #495057;
            }
            .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 14px;
                color: #6c757d;
            }
            .highlight {
                color: #e53e3e;
                font-weight: bold;
            }
            .btn-contact {
                background-color: #e53e3e;
                color: white;
                padding: 10px 20px;
                text-decoration: none;
                border-radius: 5px;
                display: inline-block;
                margin-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">LGYM</div>
                <h1 style="margin: 0; color: #e53e3e;">${tituloPrincipal}</h1>
                <p style="margin: 5px 0 0 0; color: #666;">NÃºmero de Pedido: <span class="highlight">${pedido.numero_pedido}</span></p>
            </div>

            <p style="margin: 0 0 18px 0; color: #374151;">${mensajeIntro}</p>

            <div class="order-info">
                <h3 style="margin: 0 0 10px 0; color: #e53e3e;">InformaciÃ³n del Pedido</h3>
                <p><strong>Fecha de Pedido:</strong> ${new Date(pedido.fecha_pedido).toLocaleDateString('es-CO')}</p>
                <p><strong>Fecha de Entrega:</strong> ${new Date(pedido.fecha_entrega).toLocaleDateString('es-CO')}</p>
                <p><strong>Estado:</strong> <span class="highlight">${isUpdate ? "Actualizado" : "Pendiente"}</span></p>
            </div>

            <div class="provider-info">
                <h3 style="margin: 0 0 10px 0; color: #3182ce;">InformaciÃ³n del Proveedor</h3>
                <p><strong>Nombre:</strong> ${proveedor.nombre_proveedor}</p>
                <p><strong>NIT:</strong> ${proveedor.nit_proveedor}</p>
                <p><strong>Contacto:</strong> ${proveedor.nombre_contacto}</p>
                <p><strong>TelÃ©fono:</strong> ${proveedor.telefono_proveedor}</p>
                <p><strong>Email:</strong> ${proveedor.email_proveedor}</p>
                ${proveedor.direccion_proveedor ? `<p><strong>DirecciÃ³n:</strong> ${proveedor.direccion_proveedor}</p>` : ''}
                ${proveedor.ciudad_proveedor ? `<p><strong>Ciudad:</strong> ${proveedor.ciudad_proveedor}</p>` : ''}
            </div>

            <h3 style="color: #333; margin-bottom: 15px;">Productos Solicitados</h3>
            
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productos.map(p => `
                            <tr>
                                <td>${p.nombre || p.nombre_producto || 'Producto'}</td>
                                <td>${p.cantidad}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="footer">
                <h4 style="margin: 0 0 10px 0; color: #e53e3e;">Instrucciones</h4>
                <ul style="margin: 0; padding-left: 20px;">
                    <li>Por favor confirme la recepciÃ³n de este correo</li>
                    <li>Verifique la disponibilidad de los productos solicitados</li>
                    <li>ComunÃ­quese con nosotros para cualquier aclaraciÃ³n</li>
                    <li>La fecha de entrega es obligatoria segÃºn lo especificado</li>
                </ul>
                
                <p style="margin-top: 20px;">
                    <strong>Para contactarnos:</strong><br>
                    Email: contacto@lgymsas.com<br>
                    TelÃ©fono: (57) 311 123 4567
                </p>

                <p style="margin-top: 20px; font-style: italic; color: #6c757d;">
                    Este es un correo automÃ¡tico generado por el sistema de gestiÃ³n de LGYM.
                    Por favor no responda a esta direcciÃ³n de correo electrÃ³nico.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// FunciÃ³n para enviar correo al proveedor
export const enviarCorreoPedido = async (
  pedido,
  proveedor,
  productos,
  opciones = {}
) => {
  const { notify = true, isUpdate = false } = opciones;

  try {
    // Validar datos requeridos
    if (!pedido || !proveedor || !productos || productos.length === 0) {
      throw new Error('Faltan datos requeridos para enviar el correo');
    }

    const correoProveedor = obtenerCorreoProveedor(proveedor);

    // Validar email del proveedor
    if (!correoProveedor) {
      throw new Error('El proveedor no tiene un email registrado');
    }

    const proveedorNormalizado = {
      ...proveedor,
      email_proveedor: correoProveedor,
    };

    const detalles = normalizarDetallesPedido(productos);
    if (!detalles.length) {
      throw new Error("No se encontraron detalles validos del pedido para enviar el correo");
    }

    // Crear contenido del correo
    const asunto = `${
      isUpdate ? "Actualizacion de Pedido LGYM" : "Orden de Compra LGYM"
    } - ${pedido.numero_pedido}`;
    const contenidoHtml = crearContenidoCorreo(pedido, proveedorNormalizado, detalles, {
      isUpdate,
    });

    const compra = {
      numero_pedido: pedido.numero_pedido,
      id_pedido: pedido.id_pedido ?? pedido.id ?? undefined,
      fecha_pedido: pedido.fecha_pedido,
      fecha_entrega: pedido.fecha_entrega,
      ...construirEstadoCompra(pedido),
    };

    // Datos para enviar al backend
    const emailData = {
      to: correoProveedor,
      subject: asunto,
      html: contenidoHtml,
      // Datos adicionales para el backend
      from: 'noreply@lgymsas.com',
      nombreProveedor: proveedorNormalizado.nombre_proveedor,
      numeroPedido: pedido.numero_pedido,
      email: correoProveedor,
      correo: correoProveedor,
      correo_proveedor: correoProveedor,
      proveedor_email: correoProveedor,
      proveedor: proveedorNormalizado,
      compra,
      pedido: compra,
      detalles,
      productos: detalles,
      id_estado: compra.id_estado,
      estado: compra.estado,
      estado_texto: compra.estado_texto,
      estado_pedido: compra.id_estado,
      id_estado_pedido: compra.id_estado,
      estado_pedido_texto: compra.estado_texto ?? compra.estado,
    };
    let result;
    try {
      ({ data: result } = await postCorreoConFallback(
        "enviar-correo-proveedor",
        emailData
      ));
    } catch (primerError) {
      const idEstadoCompra = Number.parseInt(compra?.id_estado, 10);
      const textoEstadoCompra = String(
        compra?.estado_texto ?? compra?.estado ?? ""
      ).normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const esPendiente =
        idEstadoCompra === 3 ||
        idEstadoCompra === 1 ||
        textoEstadoCompra.includes("pendiente");
      const requierePendiente = esErrorEstadoNoPendiente(primerError);

      if (isUpdate && esPendiente && requierePendiente) {
        const idEstadoForzado = Number.isFinite(idEstadoCompra) ? idEstadoCompra : 3;
        const compraForzadaPendiente = {
          ...compra,
          id_estado: idEstadoForzado,
          estado: ESTADO_PENDIENTE_CANONICO,
          estado_texto: ESTADO_PENDIENTE_CANONICO,
        };
        const payloadForzadoPendiente = {
          ...emailData,
          compra: compraForzadaPendiente,
          pedido: compraForzadaPendiente,
          id_estado: idEstadoForzado,
          estado: ESTADO_PENDIENTE_CANONICO,
          estado_texto: ESTADO_PENDIENTE_CANONICO,
          estado_pedido: idEstadoForzado,
          id_estado_pedido: idEstadoForzado,
          estado_pedido_texto: ESTADO_PENDIENTE_CANONICO,
        };
        ({ data: result } = await postCorreoConFallback(
          "enviar-correo-proveedor",
          payloadForzadoPendiente
        ));
      } else {
        throw primerError;
      }
    }
    
    if (notify) {
      toast.success(`Correo enviado exitosamente a ${proveedorNormalizado.nombre_proveedor}`);
    }
    
    return {
      success: true,
      message: 'Correo enviado exitosamente',
      data: result
    };

  } catch (error) {
    if (isUpdate && esErrorEstadoNoPendiente(error)) {
      return {
        success: false,
        skipped: true,
        reason: "estado_no_pendiente",
        message:
          "El backend solo permite reenviar correo cuando el pedido esta pendiente de aprobacion.",
      };
    }

    console.error('Error al enviar correo:', error);
    if (notify) {
      toast.error(`Error al enviar correo al proveedor: ${error.message}`);
    }
    throw error;
  }
};

// FunciÃ³n para enviar correo de confirmaciÃ³n (cuando el pedido cambia de estado)
export const enviarCorreoConfirmacion = async (pedido, proveedor, nuevoEstado) => {
  try {
    if (!pedido || !proveedor) {
      throw new Error('Faltan datos para enviar correo de confirmaciÃ³n');
    }

    const asunto = `ConfirmaciÃ³n de Estado - Pedido ${pedido.numero_pedido}`;
    const contenidoHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>ConfirmaciÃ³n de Estado - LGYM</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #e53e3e; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9f9f9; }
              .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>LGYM</h1>
                  <h2>Cambio de Estado</h2>
              </div>
              <div class="content">
                  <p><strong>Estimado ${proveedor.nombre_contacto || proveedor.nombre_proveedor},</strong></p>
                  <p>Le informamos que el estado de su pedido <strong>${pedido.numero_pedido}</strong> ha sido actualizado.</p>
                  <p><strong>Nuevo Estado:</strong> <span style="color: #e53e3e; font-weight: bold;">${nuevoEstado}</span></p>
                  <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CO')}</p>
                  <p>Por favor, mantÃ©ngase atento a futuras actualizaciones.</p>
              </div>
              <div class="footer">
                  <p>Este es un correo automÃ¡tico. Por favor no responda a esta direcciÃ³n.</p>
              </div>
          </div>
      </body>
      </html>
    `;

    const emailData = {
      to: proveedor.email_proveedor,
      subject: asunto,
      html: contenidoHtml,
      from: 'noreply@lgymsas.com'
    };

    await postCorreoConFallback("enviar-correo-confirmacion", emailData);

    toast.success(`Correo de confirmaciÃ³n enviado a ${proveedor.nombre_proveedor}`);
    return { success: true };

  } catch (error) {
    console.error('Error al enviar correo de confirmaciÃ³n:', error);
    toast.error(`Error al enviar correo de confirmaciÃ³n: ${error.message}`);
    throw error;
  }
};

// FunciÃ³n para validar si el proveedor tiene email
export const validarProveedorConEmail = (proveedor) => {
  if (!proveedor) {
    return { valido: false, mensaje: 'No se ha seleccionado un proveedor' };
  }
  
  if (!proveedor.email_proveedor) {
    return { valido: false, mensaje: 'El proveedor no tiene un email registrado' };
  }

  // Validar formato bÃ¡sico de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(proveedor.email_proveedor)) {
    return { valido: false, mensaje: 'El email del proveedor no tiene un formato vÃ¡lido' };
  }

  return { valido: true, mensaje: 'Proveedor vÃ¡lido para envÃ­o de correo' };
};

