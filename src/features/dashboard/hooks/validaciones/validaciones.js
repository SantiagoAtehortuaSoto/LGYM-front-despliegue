const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOLO_NUMEROS = /^\d+$/;
const DECIMAL_DOS = /^\d+(\.\d{1,2})?$/;
const PASSWORD_STRONG_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const normalizar = (v) => (v ?? "").toString().trim();
const normalizarLower = (v) => normalizar(v).toLowerCase();

const esVacio = (v) => !normalizar(v);

export const validarProducto = (data) => {
  const errors = {};
  const nombre = normalizar(data.nombre);
  const precio = normalizar(data.precioVenta);
  const stock = normalizar(data.stock);
  const categoria = normalizar(data.categoria);
  const descripcion = normalizar(data.descripcion);
  const imagen = normalizar(data.imagen_url);

  if (esVacio(nombre)) errors.nombre = "El nombre del producto es obligatorio.";
  else if (nombre.length > 80) errors.nombre = "El nombre no puede superar los 80 caracteres.";

  if (esVacio(precio)) errors.precioVenta = "El precio de venta es obligatorio.";
  else if (!DECIMAL_DOS.test(precio)) errors.precioVenta = "El precio debe tener máximo 2 decimales.";
  else if (parseFloat(precio) < 1000) errors.precioVenta = "El precio debe ser mayor o igual a 1000.";

  if (esVacio(stock)) errors.stock = "El stock es obligatorio.";
  else if (!SOLO_NUMEROS.test(stock)) errors.stock = "El stock debe ser un número entero.";
  else if (parseInt(stock, 10) < 1) errors.stock = "El stock mínimo es 1.";
 
  if (categoria && categoria.length > 80) errors.categoria = "La categoría no puede superar los 80 caracteres.";
  if (descripcion && descripcion.length > 200) errors.descripcion = "La descripción no puede superar los 200 caracteres.";
  if (imagen && imagen.length > 255) errors.imagen_url = "La URL de la imagen no puede superar los 255 caracteres.";

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarProveedor = (data, existentes = [], idActual = null) => {
  const errors = {};
  const nit = normalizar(data.nit);
  const nombre = normalizar(data.nombre);
  const telefono = normalizar(data.telefono);
  const nombreContacto = normalizar(data.nombreContacto);
  const email = normalizar(data.email).toLowerCase();
  const direccion = normalizar(data.direccion);
  const ciudad = normalizar(data.ciudad);

  const esDuplicado = (campo, valor) => {
    const val = normalizarLower(valor);
    if (!val) return false;
    return existentes.some((p) => {
      if (p.id_proveedor === idActual) return false;
      const actual = normalizarLower(p[campo]);
      return actual === val;
    });
  };

  if (esVacio(nit)) errors.nit = "El NIT es obligatorio";
  else if (!SOLO_NUMEROS.test(nit)) errors.nit = "El NIT solo puede contener números";
  else {
    const nitNum = parseInt(nit, 10);
    if (nitNum <= 0) errors.nit = "El NIT debe ser un número entero positivo mayor a 0";
    else if (nitNum > 2147483647) errors.nit = "El NIT es demasiado grande";
    else if (nit.length < 6 || nit.length > 12) errors.nit = "El NIT debe tener entre 6 y 12 dígitos";
    else if (esDuplicado("nit_proveedor", nit)) errors.nit = "Ya existe un proveedor con ese NIT";
  }

  if (esVacio(nombre)) errors.nombre = "El nombre del proveedor es obligatorio";
  else if (nombre.length > 80) errors.nombre = "El nombre no puede superar los 80 caracteres";

  if (esVacio(telefono)) errors.telefono = "El teléfono es obligatorio";
  else if (telefono.length > 10) errors.telefono = "El teléfono no puede superar los 10 caracteres";

  if (esVacio(nombreContacto)) errors.nombreContacto = "El nombre de contacto es obligatorio";
  else if (nombreContacto.length > 80) errors.nombreContacto = "El nombre de contacto no puede superar los 80 caracteres";

  if (esVacio(email)) errors.email = "El email es obligatorio";
  else if (email.length > 80) errors.email = "El email no puede superar los 80 caracteres";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Debe tener un formato válido";
  else if (esDuplicado("email_proveedor", email)) errors.email = "Ya existe un proveedor con ese correo";

  if (direccion && direccion.length > 80) errors.direccion = "La dirección no puede superar los 80 caracteres";
  if (ciudad && ciudad.length > 80) errors.ciudad = "La ciudad no puede superar los 80 caracteres";

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarServicio = (data) => {
  const errors = {};
  const nombre = normalizar(data.nombre_servicio);
  const descripcion = normalizar(data.descripcion_servicio);
  const precio = normalizar(data.precio_servicio);
  const periodicidad = normalizar(data.periodicidad);

  if (esVacio(nombre)) errors.nombre_servicio = "El nombre es requerido";
  if (esVacio(descripcion)) errors.descripcion_servicio = "La descripción es requerida";
  if (esVacio(precio)) errors.precio_servicio = "Ingrese un precio válido";
  else if (isNaN(parseFloat(precio)) || parseFloat(precio) <= 0) errors.precio_servicio = "El precio debe ser mayor a 0";
  if (esVacio(periodicidad)) errors.periodicidad = "La periodicidad es requerida";

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarMembresia = (data, existentes = [], ignoreId = null) => {
  const errors = {};
  const nombre = normalizar(data.nombre);
  const descripcion = normalizar(data.descripcion);
  const precio = normalizar(data.precioVenta);
  const estado = normalizar(data.estado);
  const beneficios = Array.isArray(data.beneficiosIds) ? data.beneficiosIds : [];

  const existeNombre = existentes.some((m) => {
    if ((m?.id ?? null) === ignoreId) return false;
    return normalizarLower(m?.nombre) === normalizarLower(nombre);
  });

  if (esVacio(nombre)) errors.nombre = "El nombre es obligatorio";
  else if (nombre.length < 3) errors.nombre = "Debe tener mínimo 3 caracteres";
  else if (nombre.length > 50) errors.nombre = "No puede superar 50 caracteres";
  else if (existeNombre) errors.nombre = "Ya existe una membresía con ese nombre";

  if (esVacio(descripcion)) errors.descripcion = "La descripción es obligatoria";
  else if (descripcion.length < 10) errors.descripcion = "Debe tener mínimo 10 caracteres";

  if (esVacio(precio)) errors.precioVenta = "El precio es obligatorio";
  else if (Number(precio) <= 0) errors.precioVenta = "Debe ser mayor a 0";

  if (!beneficios.length) errors.beneficiosIds = "Debe seleccionar al menos un servicio";
  if (!["Activo", "Inactivo"].includes(estado || "")) errors.estado = "El estado no es válido";

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarEmpleado = (data) => {
  const errors = {};
  if (!data.id_usuario) errors.id_usuario = "Debe seleccionar un usuario existente.";
  if (esVacio(data.direccion_empleado)) errors.direccion_empleado = "La dirección del empleado es obligatoria.";

  if (esVacio(data.fecha_contratacion)) errors.fecha_contratacion = "La fecha de contratación es obligatoria.";
  else {
    const fecha = new Date(data.fecha_contratacion);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (fecha > hoy) errors.fecha_contratacion = "La fecha de contratación no puede ser futura.";
  }

  if (!data.salario || isNaN(Number(data.salario)) || Number(data.salario) <= 0)
    errors.salario = "El salario debe ser mayor a 0.";

  if (data.horario_empleado && data.horario_empleado.length > 20)
    errors.horario_empleado = "El horario no puede superar los 20 caracteres.";

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarUsuario = (data, isEdit = false) => {
  const errors = {};
  const email = normalizar(data.email);
  const telefono = normalizar(data.telefono).replace(/\D/g, "");
  const doc = normalizar(data.documento).replace(/\D/g, "");
  const fechaNacimiento = normalizar(data.fecha_nacimiento);

  if (esVacio(data.nombre_usuario)) errors.nombre_usuario = "El nombre es obligatorio";
  if (esVacio(data.apellido_usuario)) errors.apellido_usuario = "El apellido es obligatorio";
  if (esVacio(email)) errors.email = "El email es obligatorio";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Debe ser un correo válido";

  if (esVacio(telefono)) errors.telefono = "El teléfono es obligatorio";
  else if (telefono.length !== 10) errors.telefono = "El teléfono debe tener 10 dígitos";

  if (esVacio(doc)) errors.documento = "El documento es obligatorio";
  else if (!SOLO_NUMEROS.test(doc)) errors.documento = "El documento debe contener solo dígitos";
  else if (doc.length < 6 || doc.length > 11)
    errors.documento = "El documento debe tener entre 6 y 11 dígitos";

  if (esVacio(fechaNacimiento)) {
    errors.fecha_nacimiento = "La fecha de nacimiento es obligatoria";
  } else {
    const fecha = new Date(fechaNacimiento);
    const hoy = new Date();
    const minima = new Date(
      hoy.getFullYear() - 14,
      hoy.getMonth(),
      hoy.getDate()
    );
    const maxima = new Date(
      hoy.getFullYear() - 90,
      hoy.getMonth(),
      hoy.getDate()
    );

    if (Number.isNaN(fecha.getTime())) {
      errors.fecha_nacimiento = "La fecha de nacimiento no es válida";
    } else if (fecha > hoy) {
      errors.fecha_nacimiento = "La fecha de nacimiento no puede ser futura";
    } else if (fecha > minima) {
      errors.fecha_nacimiento = "Debe tener al menos 14 años";
    } else if (fecha < maxima) {
      errors.fecha_nacimiento = "La edad no puede superar los 90 años";
    }
  }

  if (!isEdit) {
    if (esVacio(data.password)) errors.password = "La contraseña es obligatoria";
    else if (!PASSWORD_STRONG_REGEX.test(String(data.password)))
      errors.password =
        "La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial";
    if (data.password !== data.confirmPassword) errors.confirmPassword = "Las contraseñas no coinciden";
  }

  if (!data.rol_id) errors.rol_id = "Debe seleccionar un rol";

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarCliente = (data, isEdit = false) => {
  const errors = {};
  const email = normalizar(data.email);
  const telefono = normalizar(data.telefono).replace(/\D/g, "");
  const doc = normalizar(data.documento).replace(/\D/g, "");
  if (esVacio(data.nombre_usuario)) errors.nombre_usuario = "El nombre es obligatorio";
  if (esVacio(data.apellido_usuario)) errors.apellido_usuario = "El apellido es obligatorio";
  if (esVacio(email)) errors.email = "El email es obligatorio";
  else if (!EMAIL_REGEX.test(email)) errors.email = "Debe ser un correo válido";
  if (esVacio(telefono)) errors.telefono = "El teléfono es obligatorio";
  else if (telefono.length !== 10) errors.telefono = "El teléfono debe tener 10 dígitos";
  if (esVacio(doc)) errors.documento = "El documento es obligatorio";
  else if (!SOLO_NUMEROS.test(doc)) errors.documento = "El documento debe contener solo dígitos";
  else if (doc.length < 6 || doc.length > 11)
    errors.documento = "El documento debe tener entre 6 y 11 dígitos";
  if (!isEdit) {
    if (esVacio(data.password)) errors.password = "La contraseña es obligatoria";
    else if (!PASSWORD_STRONG_REGEX.test(String(data.password)))
      errors.password =
        "La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial";
    if (data.password !== data.confirmPassword) errors.confirmPassword = "Las contraseñas no coinciden";
  }
  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarVenta = (data) => {
  const errors = {};
  const detalles = Array.isArray(data.detalles) ? data.detalles : [];
  if (!detalles.length) errors.detalles = "La venta debe incluir al menos un detalle";
  if (data.id_estado === null || data.id_estado === undefined)
    errors.estado = "El estado de la venta es obligatorio";
  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarPedido = (data, productosSeleccionados = []) => {
  const errors = {};
  const idProveedor = normalizar(data.idProveedor);
  const fechaPedido = normalizar(data.fechaPedido);
  const fechaEntrega = normalizar(data.fechaEntrega);
  const estado = normalizar(data.estado);

  // Validar proveedor
  if (esVacio(idProveedor)) {
    errors.idProveedor = "Debe seleccionar un proveedor";
  }

  // Validar fechas
  if (esVacio(fechaPedido)) {
    errors.fechaPedido = "La fecha del pedido es obligatoria";
  }

  if (esVacio(fechaEntrega)) {
    errors.fechaEntrega = "La fecha de entrega es obligatoria";
  } else if (fechaPedido && new Date(fechaEntrega) < new Date(fechaPedido)) {
    errors.fechaEntrega = "La fecha de entrega no puede ser anterior a la fecha del pedido";
  }

  // Validar estado
  const estadosValidos = ["Pendiente", "En Proceso", "Completado", "Cancelado"];
  if (esVacio(estado) || !estadosValidos.includes(estado)) {
    errors.estado = "Estado de pedido no válido";
  }

  // Validar productos
  if (!Array.isArray(productosSeleccionados) || productosSeleccionados.length === 0) {
    errors.productos = "Debe agregar al menos un producto al pedido";
  } else {
    const productosConErrores = [];
    
    productosSeleccionados.forEach((producto, index) => {
      const erroresProducto = {};
      let tieneErrores = false;
      
      // Validar producto seleccionado
      if (esVacio(producto.idProducto)) {
        erroresProducto.idProducto = "Seleccione un producto";
        tieneErrores = true;
      }
      
      // Validar cantidad
      if (esVacio(producto.cantidad)) {
        erroresProducto.cantidad = "La cantidad es obligatoria";
        tieneErrores = true;
      } else if (!SOLO_NUMEROS.test(producto.cantidad)) {
        erroresProducto.cantidad = "La cantidad debe ser un número entero";
        tieneErrores = true;
      } else if (parseInt(producto.cantidad, 10) <= 0) {
        erroresProducto.cantidad = "La cantidad debe ser mayor a 0";
        tieneErrores = true;
      }
      
      if (tieneErrores) {
        productosConErrores[index] = erroresProducto;
      }
    });
    
    if (productosConErrores.length > 0) {
      errors.productosDetalles = productosConErrores;
      // Asegurarse de que el mensaje general se muestre si hay errores en los productos
      errors.productos = "Hay errores en los productos seleccionados";
    }
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
};

export const validarRol = (data, existingRoles = [], isEdit = false) => {
  const errors = {};
  const nombre = normalizar(data.nombre_rol);
  const idEstado = Number(data.id_estado);
  if (esVacio(nombre)) errors.nombre_rol = "El nombre del rol es obligatorio";
  else {
    const nombreNorm = normalizarLower(nombre);
    const duplicado = existingRoles.some((rol) => {
      const rolId = rol.id || rol.id_rol;
      if (isEdit && rolId === data.id) return false;
      return normalizarLower(rol.nombre_rol || rol.nombre) === nombreNorm;
    });
    if (duplicado) errors.nombre_rol = "Ya existe un rol con este nombre";
  }

  if (![1, 2].includes(idEstado)) {
    errors.id_estado = "Debe seleccionar un estado válido";
  }

  const permisosModulos = data?.permisosModulos || {};
  const tienePermisos = Object.values(permisosModulos).some((acciones) =>
    Object.values(acciones || {}).some(Boolean)
  );

  if (!tienePermisos) {
    errors.permisosModulos = "Debe seleccionar al menos un permiso";
  }

  return { errors, isValid: Object.keys(errors).length === 0 };
};

