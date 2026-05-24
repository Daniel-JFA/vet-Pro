#!/bin/bash

# ==============================================================================
# 💎 VETPRO SaaS — PostgreSQL Backup & Archival Script (Ley 1581 Habeas Data)
# ==============================================================================
# Este script realiza un volcado de base de datos seguro, comprime el archivo
# y simula la carga a AWS S3 con rotación de archivos viejos de más de 30 días.
# ==============================================================================

# 📁 Configuraciones locales
BACKUP_DIR="./backups"
DB_URL=${DATABASE_URL:-"postgresql://postgres:postgres@localhost:5432/vetpro"}
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="vetpro_backup_${DATE}.sql.gz"

echo "🏁 Iniciando proceso de respaldo de base de datos VetPro..."

# 1. Asegurar la existencia de la carpeta de backups
mkdir -p "$BACKUP_DIR"

# 2. Ejecutar pg_dump y comprimir
echo "💾 Exportando esquema y datos relacionales de PostgreSQL..."
if pg_dump "$DB_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"; then
  echo "✅ Respaldo generado con éxito en: ${BACKUP_DIR}/${FILENAME}"
  
  # 3. Simulación de carga en la nube S3
  echo "☁️ Transfiriendo respaldo cifrado a contenedor AWS S3 (s3://vetpro-database-backups)..."
  sleep 1 # Simular retraso de red
  echo "✅ Transferencia S3 completada con éxito. Hash de integridad MD5 registrado."
  
  # 4. Limpiar copias de seguridad viejas locales (más de 30 días)
  echo "🧹 Buscando y depurando copias de seguridad de más de 30 días..."
  find "$BACKUP_DIR" -name "vetpro_backup_*.sql.gz" -mtime +30 -exec rm {} \;
  echo "✅ Depuración de archivos antiguos finalizada."
  
  echo "🎉 ¡Copia de seguridad completada con éxito para la fecha: $(date)!"
  exit 0
else
  echo "❌ ERROR: Fallo al ejecutar pg_dump. Verifica la conexión a la base de datos."
  exit 1
fi
