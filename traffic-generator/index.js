const axios = require('axios');
const { program } = require('commander');
const crypto = require('crypto');

// Configurar opciones de línea de comandos
program
  .option('-u, --url <url>', 'URL base del servicio (por defecto: http://localhost:8080)', 'http://localhost:8080')
  .option('-i, --interval <ms>', 'Intervalo entre solicitudes en ms (por defecto: 500)', parseInt, 500)
  .option('-e, --errors', 'Incluir solicitudes que generarán errores', false)
  .parse();

const options = program.opts();

// Colores para la salida en consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Función para generar un ID aleatorio
function generateRandomId() {
  return Math.floor(1 + Math.random() * 5).toString();
}

// Función para hacer una solicitud HTTP con registro de tiempo y resultado
async function makeRequest(method, path, data = null) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  const url = `${options.url}${path}`;
  
  console.log(`${colors.blue}[${requestId}] ${colors.cyan}${method} ${colors.reset}${url}`);
  
  try {
    const config = {
      method,
      url,
      data,
      headers: {
        'X-Request-ID': requestId
      }
    };
    
    const response = await axios(config);
    const duration = Date.now() - startTime;
    
    console.log(`${colors.blue}[${requestId}] ${colors.green}${response.status} ${colors.reset}Completado en ${duration}ms`);
    return response.data;
  } catch (error) {
    const duration = Date.now() - startTime;
    const status = error.response ? error.response.status : 'ERROR';
    const message = error.response ? error.response.data.error : error.message;
    
    console.log(`${colors.blue}[${requestId}] ${colors.red}${status} ${colors.reset}${message} - Completado en ${duration}ms`);
    throw error;
  }
}

// Función para generar solicitudes de forma aleatoria
async function generateRandomRequest() {
  const requestType = Math.floor(Math.random() * 15);
  
  try {
    switch (requestType) {
      case 0:
        // Listar todos los productos
        await makeRequest('GET', '/api/products');
        break;
      case 1:
      case 2:
        // Obtener un producto específico
        const productId = generateRandomId();
        await makeRequest('GET', `/api/products/${productId}`);
        break;
      case 3:
        // Buscar productos por categoría
        const categories = ['Electrónica', 'Periféricos'];
        const category = categories[Math.floor(Math.random() * categories.length)];
        await makeRequest('GET', `/api/products/category/${category}`);
        break;
      case 4:
        // Crear un producto
        const newProduct = {
          name: `Producto Test ${Date.now()}`,
          description: 'Descripción generada automáticamente',
          price: 10 + Math.random() * 990,
          category: 'Test'
        };
        await makeRequest('POST', '/api/products', newProduct);
        break;
      case 5:
        // Actualizar un producto
        const updateProductId = generateRandomId();
        const updatedProduct = {
          name: `Producto Actualizado ${Date.now()}`,
          description: 'Descripción actualizada',
          price: 10 + Math.random() * 990,
          category: 'Test'
        };
        await makeRequest('PUT', `/api/products/${updateProductId}`, updatedProduct);
        break;
      case 6:
        // Obtener inventario para un producto
        const inventoryProductId = generateRandomId();
        await makeRequest('GET', `/api/inventory/${inventoryProductId}`);
        break;
      case 7:
      case 8:
        // Listar todo el inventario
        await makeRequest('GET', '/api/inventory');
        break;
      case 9:
        // Actualizar cantidad en inventario
        const quantityProductId = generateRandomId();
        const quantity = Math.floor(Math.random() * 100);
        await makeRequest('PATCH', `/api/inventory/${quantityProductId}/quantity/${quantity}`);
        break;
      case 10:
        // Obtener inventario por ubicación
        const warehouses = ['Almacén A', 'Almacén B', 'Almacén C'];
        const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)];
        await makeRequest('GET', `/api/inventory/warehouse/${encodeURIComponent(warehouse)}`);
        break;
      case 11:
        // Obtener inventario por estado
        const statuses = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        await makeRequest('GET', `/api/inventory/status/${status}`);
        break;
      case 12:
        // Obtener detalles del producto desde el servicio de inventario
        const detailsProductId = generateRandomId();
        await makeRequest('GET', `/api/inventory/product-details/${detailsProductId}`);
        break;
      case 13:
        // Generar error intencional con cantidad negativa (solo si la opción está habilitada)
        if (options.errors) {
          const errorProductId = generateRandomId();
          console.log(`${colors.yellow}Generando solicitud con error...${colors.reset}`);
          await makeRequest('PATCH', `/api/inventory/${errorProductId}/quantity/-10`);
        } else {
          await makeRequest('GET', '/api/products');
        }
        break;
      case 14:
        // Generar error intencional con ID de producto inexistente (solo si la opción está habilitada)
        if (options.errors) {
          console.log(`${colors.yellow}Generando solicitud con error...${colors.reset}`);
          await makeRequest('GET', '/api/products/999');
        } else {
          await makeRequest('GET', '/api/inventory');
        }
        break;
      default:
        // Para las demás opciones, hacer alguna solicitud común
        await makeRequest('GET', '/api/products');
        break;
    }
  } catch (error) {
    // Capturamos errores para que el generador siga funcionando
    console.log(`${colors.red}Error capturado: ${error.message}${colors.reset}`);
  }
}

// Función principal
function startTrafficGenerator() {
  console.log(`${colors.magenta}===== Generador de Tráfico para Microservicios =====`);
  console.log(`${colors.cyan}URL base: ${colors.reset}${options.url}`);
  console.log(`${colors.cyan}Intervalo: ${colors.reset}${options.interval}ms`);
  console.log(`${colors.cyan}Generar errores: ${colors.reset}${options.errors ? 'Sí' : 'No'}`);
  console.log(`${colors.magenta}==============================================${colors.reset}`);
  console.log(`${colors.yellow}Presiona Ctrl+C para detener${colors.reset}\n`);
  
  // Generar tráfico a intervalos regulares
  setInterval(generateRandomRequest, options.interval);
  
  // Ejecutar una primera solicitud inmediatamente
  generateRandomRequest();
}

// Iniciar el generador de tráfico
startTrafficGenerator();