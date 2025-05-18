const { Counter, Histogram } = require('prom-client');
const client = require('prom-client');

// Habilitar la recopilación de métricas predeterminadas
client.collectDefaultMetrics();

// Crear un contador para las solicitudes HTTP
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Crear un histograma para la duración de las solicitudes HTTP
const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

module.exports = {
  httpRequestsTotal,
  httpRequestDurationMs,
  register: client.register,
};