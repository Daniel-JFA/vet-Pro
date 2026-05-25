# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de definición de dependencias
COPY package*.json ./

# Instalar dependencias npm
RUN npm ci

# Copiar el código fuente del proyecto y construir
COPY . .
RUN npm run build

# --- Production Nginx Stage ---
FROM nginx:alpine

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los estáticos generados por la etapa de construcción al directorio de Nginx
COPY --from=builder /app/dist/vetpro/browser /usr/share/nginx/html

# Exponer el puerto HTTP
EXPOSE 80

# Iniciar servidor Nginx
CMD ["nginx", "-g", "daemon off;"]
