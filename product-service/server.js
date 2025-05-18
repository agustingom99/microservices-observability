// Archivo: product-service/server.js
// Cargar el SDK de OpenTelemetry primero
require('./tracing');

const express = require('express');
const pinoHttp = require('pino-http');
const metrics = require('./metrics');
const { trace } = require('@opentelemetry/api');

const app = express();
const port = process.env.PORT || 3001;

// Configurar logger
const logger = pinoHttp({
  genReqId: (req) => req.headers['x-request-id'] || require('crypto').randomUUID(),
  customProps: (req, res) => {
    const span = trace.getActiveSpan();
    const spanContext = span?.spanContext();
    return {
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
    };
  }
});

app.use(logger);
app.use(express.json());

// Middleware para medir la duración de las solicitudes
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Capturar el final de la respuesta para registrar métricas
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const route = req.route ? req.route.path : req.path;
    
    // Registrar contador y duración en las métricas
    metrics.httpRequestsTotal.inc({ 
      method: req.method, 
      route, 
      status_code: res.statusCode 
    });
    
    metrics.httpRequestDurationMs.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
  });
  
  next();
});

// Datos simulados
const products = [
  { id: '1', name: 'Laptop', description: 'Potente laptop para desarrollo', price: 1299.99, category: 'Electrónica' },
  { id: '2', name: 'Smartphone', description: 'Teléfono inteligente de última generación', price: 899.99, category: 'Electrónica' },
  { id: '3', name: 'Tablet', description: 'Tablet para productividad', price: 499.99, category: 'Electrónica' },
  { id: '4', name: 'Monitor', description: 'Monitor 4K para gaming', price: 349.99, category: 'Periféricos' },
  { id: '5', name: 'Teclado', description: 'Teclado mecánico para programadores', price: 129.99, category: 'Periféricos' }
];

// Función para simular latencia
function simulateLatency(min, max) {
  const latency = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, latency));
}

// Endpoint para obtener todos los productos
app.get('/api/products', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getAllProducts');
  
  req.log.info('Obteniendo todos los productos');
  
  // Simular latencia
  await simulateLatency(30, 100);
  
  res.json(products);
});

// Endpoint para obtener un producto por ID
app.get('/api/products/:id', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getProductById');
  span?.setAttribute('product.id', req.params.id);
  
  req.log.info({ productId: req.params.id }, 'Obteniendo producto por ID');
  
  // Simular latencia
  await simulateLatency(20, 80);
  
  const product = products.find(p => p.id === req.params.id);
  
  if (product) {
    res.json(product);
  } else {
    // Simulamos un error
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', `Producto no encontrado: ${req.params.id}`);
    req.log.error({ productId: req.params.id }, 'Producto no encontrado');
    res.status(404).json({ error: 'Producto no encontrado' });
  }
});

// Endpoint para obtener productos por categoría
app.get('/api/products/category/:category', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getProductsByCategory');
  span?.setAttribute('product.category', req.params.category);
  
  req.log.info({ category: req.params.category }, 'Obteniendo productos por categoría');
  
  // Simular latencia
  await simulateLatency(40, 120);
  
  // Ocasionalmente introducimos un retraso mayor para simular una operación lenta
  if (Math.random() < 0.2) {
    req.log.warn({ category: req.params.category }, 'Retraso detectado en la búsqueda por categoría');
    await simulateLatency(300, 600);
  }
  
  const filteredProducts = products.filter(p => 
    p.category.toLowerCase() === req.params.category.toLowerCase()
  );
  
  res.json(filteredProducts);
});

// Endpoint para crear un nuevo producto
app.post('/api/products', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'createProduct');
  
  req.log.info({ product: req.body }, 'Creando nuevo producto');
  
  // Simular latencia
  await simulateLatency(100, 200);
  
  // Validar datos
  if (!req.body.name || !req.body.price) {
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', 'Datos de producto incompletos');
    req.log.error({ product: req.body }, 'Datos de producto incompletos');
    return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  }
  
  if (req.body.price <= 0) {
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', 'El precio debe ser mayor que 0');
    req.log.error({ price: req.body.price }, 'Precio inválido');
    return res.status(400).json({ error: 'El precio debe ser mayor que 0' });
  }
  
  // Crear nuevo producto
  const newProduct = {
    id: (products.length + 1).toString(),
    ...req.body
  };
  
  products.push(newProduct);
  
  res.status(201).json(newProduct);
});

// Endpoint para actualizar un producto
app.put('/api/products/:id', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'updateProduct');
  span?.setAttribute('product.id', req.params.id);
  
  req.log.info({ productId: req.params.id, updates: req.body }, 'Actualizando producto');
  
  // Simular latencia
  await simulateLatency(80, 150);
  
  const index = products.findIndex(p => p.id === req.params.id);
  
  if (index >= 0) {
    const updatedProduct = { ...products[index], ...req.body, id: req.params.id };
    products[index] = updatedProduct;
    res.json(updatedProduct);
  } else {
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', `Producto no encontrado: ${req.params.id}`);
    req.log.error({ productId: req.params.id }, 'Producto no encontrado para actualizar');
    res.status(404).json({ error: 'Producto no encontrado' });
  }
});

// Endpoint para eliminar un producto
app.delete('/api/products/:id', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'deleteProduct');
  span?.setAttribute('product.id', req.params.id);
  
  req.log.info({ productId: req.params.id }, 'Eliminando producto');
  
  // Simular latencia
  await simulateLatency(60, 120);
  
  const index = products.findIndex(p => p.id === req.params.id);
  
  if (index >= 0) {
    products.splice(index, 1);
    res.status(204).end();
  } else {
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', `Producto no encontrado: ${req.params.id}`);
    req.log.error({ productId: req.params.id }, 'Producto no encontrado para eliminar');
    res.status(404).json({ error: 'Producto no encontrado' });
  }
});

// Endpoint para métricas de Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});

// Endpoint de salud para Kubernetes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servicio de Productos ejecutándose en http://localhost:${port}`);
});
