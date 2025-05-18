
# Archivo: traffic-generator/Dockerfile
FROM node:18-slim

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Variables de entorno por defecto para configuración (sobreescribibles)
ENV URL=http://product-service:3001
ENV INTERVAL=1000
ENV ERRORS=false

# Comando de inicio
CMD ["node", "index.js", "--url", "$URL", "--interval", "$INTERVAL", "--errors", "$ERRORS"]