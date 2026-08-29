#!/bin/bash

# ==============================================================================
# 💎 VETPRO SaaS — PostgreSQL Backup & Archival Script (Ley 1581 Habeas Data)
# ==============================================================================
# Este script realiza un volcado de base de datos seguro, comprime el archivo
# y lo sincroniza con AWS S3 / Cloudflare R2 con rotación de 30 días.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/vetpro}"
S3_BUCKET="${AWS_S3_BUCKET:-vetpro-database-backups}"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="vetpro_backup_${DATE}.sql.gz"

echo "🏁 Iniciando proceso de respaldo de base de datos VetPro..."

# 1. Asegurar la existencia de la carpeta de backups
mkdir -p "$BACKUP_DIR"

# 2. Ejecutar pg_dump y comprimir
echo "💾 Exportando esquema y datos relacionales de PostgreSQL..."
if pg_dump "$DB_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"; then
  echo "✅ Respaldo generado con éxito en: ${BACKUP_DIR}/${FILENAME}"
  
  # 3. Carga en la nube S3 si aws-cli está disponible
  if command -v aws &> /dev/null && [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    echo "☁️ Subiendo a AWS S3 (s3://${S3_BUCKET}/${FILENAME})..."
    aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://${S3_BUCKET}/${FILENAME}" --sse AES256
    echo "✅ Transferencia S3 completada con éxito."
  else
    echo "ℹ️ AWS CLI o credenciales no configuradas. Archivo preservado localmente en ${BACKUP_DIR}."
  fi
  
  # 4. Limpiar copias de seguridad viejas locales (más de 30 días)
  echo "🧹 Buscando y depurando copias de seguridad locales de más de 30 días..."
  find "$BACKUP_DIR" -name "vetpro_backup_*.sql.gz" -mtime +30 -exec rm {} \;
  echo "✅ Depuración de archivos antiguos finalizada."
  
  echo "🎉 ¡Copia de seguridad completada con éxito para la fecha: $(date)!"
  exit 0
else
  echo "❌ ERROR: Fallo al ejecutar pg_dump. Verifica la conexión a la base de datos."
  exit 1
fi
