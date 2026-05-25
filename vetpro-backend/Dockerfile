# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de definición de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias (incluyendo devDependencies para la compilación de TypeScript)
RUN npm ci

# Copiar esquema de Prisma y generar el cliente de base de datos
COPY prisma ./prisma/
RUN npx prisma generate

# Copiar el código fuente y compilar TypeScript a JavaScript
COPY src ./src/
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# Variable de entorno para producción
ENV NODE_ENV=production

# Copiar package.json e instalar ÚNICAMENTE dependencias de producción para mantener la imagen ligera
COPY package*.json ./
RUN npm ci --only=production

# Copiar los archivos compilados, esquema de prisma y el cliente generado desde la etapa de construcción
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Exponer el puerto del API REST
EXPOSE 3000

# Comando para arrancar el servidor en producción
CMD ["node", "dist/server.js"]
