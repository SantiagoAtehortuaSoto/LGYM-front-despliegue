// Test file para verificar el servicio API de servicios
import { serviciosAPI } from './src/shared/services/services.jsx';

console.log('🧪 Probando servicio API de servicios...');

// Test 1: Verificar estado de la API
console.log('\n1️⃣ Verificando estado de la API...');
try {
  const status = await serviciosAPI.checkApiStatus();
  console.log('Estado de la API:', status);
} catch (error) {
  console.error('Error verificando API:', error.message);
}

// Test 2: Obtener todos los servicios
console.log('\n2️⃣ Obteniendo todos los servicios...');
try {
  const servicios = await serviciosAPI.getAll();
  console.log(`✅ Se obtuvieron ${servicios.length} servicios:`);
  servicios.forEach((servicio, index) => {
    console.log(`  ${index + 1}. ${servicio.nombre_servicio} - $${servicio.precio_servicio} (${servicio.periodicidad})`);
  });
} catch (error) {
  console.error('Error obteniendo servicios:', error.message);
}

// Test 3: Validar estructura de datos
console.log('\n3️⃣ Validando estructura de datos...');
const servicioPrueba = {
  nombre_servicio: 'Servicio de Prueba',
  descripcion_servicio: 'Descripción de prueba',
  precio_servicio: 50000,
  periodicidad: 'Mensual',
  id_estado: 1
};

try {
  const validacion = serviciosAPI.validarEstructuraServicio(servicioPrueba);
  console.log('Validación:', validacion.esValido ? '✅ Correcta' : '❌ Incorrecta');
  if (!validacion.esValido) {
    console.log('Errores:', validacion.errores);
  }
} catch (error) {
  console.error('Error en validación:', error.message);
}

console.log('\n✨ Pruebas completadas!');
