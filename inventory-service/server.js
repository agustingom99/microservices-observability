// Archivo: inventory-service/server.js
// Cargar el SDK de OpenTelemetry primero
require('./tracing');

const express = require('express');
const pinoHttp = require('pino-http');
const axios = require('axios');
const metrics = require('./metrics');
const { trace, context, SpanStatusCode } = require('@opentelemetry/api');

const app = express();
const port = process.env.PORT || 3002;
const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';

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

// Datos simulados de inventario
const inventory = [
  { productId: '1', quantity: 50, warehouseLocation: 'Almacén A', status: 'IN_STOCK' },
  { productId: '2', quantity: 35, warehouseLocation: 'Almacén B', status: 'IN_STOCK' },
  { productId: '3', quantity: 10, warehouseLocation: 'Almacén A', status: 'LOW_STOCK' },
  { productId: '4', quantity: 0, warehouseLocation: 'Almacén C', status: 'OUT_OF_STOCK' },
  { productId: '5', quantity: 25, warehouseLocation: 'Almacén B', status: 'IN_STOCK' }
];

// Función para simular latencia
function simulateLatency(min, max) {
  const latency = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, latency));
}

// Función para llamar al servicio de productos y obtener detalles
async function getProductDetails(productId, reqLogger) {
  const tracer = trace.getTracer('inventory-service');
  
  return tracer.startActiveSpan('getProductDetails', async (span) => {
    span.setAttribute('product.id', productId);
    
    const startTime = Date.now();
    const endpoint = `/api/products/${productId}`;
    let status = 'success';
    
    try {
      reqLogger.info({ productId }, 'Consultando detalles del producto en el servicio de productos');
      
      // Simular fallos ocasionales en la llamada al servicio de productos
      if (Math.random() < 0.1) {
        reqLogger.error({ productId }, 'Error simulado al comunicarse con el servicio de productos');
        throw new Error('Error simulado al comunicarse con el servicio de productos');
      }
      
      const response = await axios.get(`${productServiceUrl}${endpoint}`);
      
      reqLogger.info({ productId }, 'Detalles del producto obtenidos correctamente');
      
      return response.data;
    } catch (error) {
      status = 'error';
      
      const errorMessage = error.response 
        ? `Error del servicio de productos: ${error.response.status} ${error.response.statusText}` 
        : `Error de red: ${error.message}`;
      
      reqLogger.error({ productId, error: errorMessage }, 'Error al obtener detalles del producto');
      
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
      
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      
      metrics.externalServiceCallsTotal.inc({
        service: 'product-service',
        endpoint,
        status
      });
      
      metrics.externalServiceCallDurationMs.observe(
        { service: 'product-service', endpoint, status },
        duration
      );
      
      span.end();
    }
  });
}

// Endpoint para obtener todo el inventario
app.get('/api/inventory', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getAllInventory');
  
  req.log.info('Obteniendo todo el inventario');
  
  // Simular latencia
  await simulateLatency(30, 100);
  
  res.json(inventory);
});

// Endpoint para obtener inventario por ID de producto
app.get('/api/inventory/:productId', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getInventoryByProductId');
  span?.setAttribute('product.id', req.params.productId);
  
  req.log.info({ productId: req.params.productId }, 'Obteniendo inventario por ID de producto');
  
  // Simular latencia
  await simulateLatency(20, 80);
  
  const item = inventory.find(i => i.productId === req.params.productId);
  
  if (item) {
    res.json(item);
  } else {
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', `Inventario no encontrado para el producto: ${req.params.productId}`);
    req.log.error({ productId: req.params.productId }, 'Inventario no encontrado');
    res.status(404).json({ error: 'Inventario no encontrado' });
  }
});

// Endpoint para obtener inventario por ubicación de almacén
app.get('/api/inventory/warehouse/:location', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getInventoryByWarehouse');
  span?.setAttribute('warehouse.location', req.params.location);
  
  req.log.info({ location: req.params.location }, 'Obteniendo inventario por ubicación');
  
  // Simular latencia
  await simulateLatency(40, 110);
  
  const filteredInventory = inventory.filter(i => 
    i.warehouseLocation === req.params.location
  );
  
  res.json(filteredInventory);
});

// Endpoint para obtener inventario por estado
app.get('/api/inventory/status/:status', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getInventoryByStatus');
  span?.setAttribute('inventory.status', req.params.status);
  
  req.log.info({ status: req.params.status }, 'Obteniendo inventario por estado');
  
  // Simular latencia
  await simulateLatency(35, 90);
  
  const filteredInventory = inventory.filter(i => 
    i.status === req.params.status
  );
  
  res.json(filteredInventory);
});

// Endpoint para obtener detalles del producto desde el servicio de productos
app.get('/api/inventory/product-details/:productId', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'getProductDetails');
  span?.setAttribute('product.id', req.params.productId);
  
  req.log.info({ productId: req.params.productId }, 'Obteniendo detalles del producto');
  
  try {
    const product = await getProductDetails(req.params.productId, req.log);
    res.json(product);
  } catch (error) {
    req.log.error({ error: error.message }, 'Error al obtener detalles del producto');
    res.status(error.response?.status || 500).json({ 
      error: 'Error al obtener detalles del producto',
      message: error.message
    });
  }
});

// Endpoint para actualizar la cantidad en inventario
app.patch('/api/inventory/:productId/quantity/:quantity', async (req, res) => {
  const span = trace.getActiveSpan();
  span?.setAttribute('operation', 'updateInventoryQuantity');
  span?.setAttribute('product.id', req.params.productId);
  span?.setAttribute('inventory.quantity', parseInt(req.params.quantity));
  
  const productId = req.params.productId;
  const quantity = parseInt(req.params.quantity);
  
  req.log.info({ productId, quantity }, 'Actualizando cantidad en inventario');
  
  // Simular latencia
  await simulateLatency(50, 120);
  
  // Validar cantidad
  if (isNaN(quantity) || quantity < 0) {
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', 'La cantidad debe ser un número no negativo');
    req.log.error({ quantity }, 'Cantidad inválida');
    return res.status(400).json({ error: 'La cantidad debe ser un número no negativo' });
  }
  
  const index = inventory.findIndex(i => i.productId === productId);
  
  if (index >= 0) {
    // Actualizar cantidad
    inventory[index].quantity = quantity;
    
    // Actualizar estado basado en la cantidad
    if (quantity <= 0) {
      inventory[index].status = 'OUT_OF_STOCK';
    } else if (quantity < 15) {
      inventory[index].status = 'LOW_STOCK';
    } else {
      inventory[index].status = 'IN_STOCK';
    }
    
    res.json(inventory[index]);
  } else {
    span?.setAttribute('error', true);
    span?.setAttribute('error.message', `Inventario no encontrado para el producto: ${productId}`);
    req.log.error({ productId }, 'Inventario no encontrado para actualizar');
    res.status(404).json({ error: 'Inventario no encontrado' });
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
  console.log(`Servicio de Inventario ejecutándose en http://localhost:${port}`);
});