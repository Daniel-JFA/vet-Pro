#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# VetPro — Script de Despliegue Automatizado
# ─────────────────────────────────────────────────────────────────────────────

# Salir inmediatamente si algún comando falla
set -e

echo "🚀 Iniciando despliegue de VetPro en producción..."

# 1. Descargar los últimos cambios
echo "📥 Descargando últimos cambios desde GitHub..."
git pull origin main

# 2. Reconstruir e iniciar los contenedores
echo "📦 Reconstruyendo imágenes y reiniciando contenedores de Docker..."
docker compose up -d --build

# 3. Esperar a que la base de datos esté lista
echo "⏳ Esperando 5 segundos para que la base de datos se inicialice..."
sleep 5

# 4. Aplicar el esquema de base de datos de Prisma
echo "🗄️ Sincronizando el esquema de base de datos con Prisma..."
docker compose exec -T backend npx prisma db push

# 5. Sembrar base de datos si se requiere
if [ "$1" == "--seed" ]; then
    echo "🌱 Sembrando base de datos con el dataset interactivo realista..."
    docker compose exec -T backend npm run db:seed
fi

# 6. Limpieza de espacio en Docker
echo "🧹 Liberando espacio en disco de imágenes antiguas..."
docker image prune -f

echo "🎉 ¡Despliegue completado con éxito!"
echo "🖥️  Frontend accesible en el puerto configurado (ej: http://localhost:8080)"
echo "⚙️  Backend API accesible en el puerto configurado (ej: http://localhost:3000)"
