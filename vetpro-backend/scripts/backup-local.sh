#!/usr/bin/env bash
# ==============================================================================
# 💎 VETPRO SaaS — Respaldo Local de PostgreSQL (Servidor Propio)
# ==============================================================================
# Genera un volcado comprimido (.sql.gz) de la base de datos PostgreSQL,
# lo almacena en el directorio local configurado y purga backups > RETENTION_DAYS.
#
# Uso:
#   ./backup-local.sh
#   BACKUP_DIR=/var/backups/vetpro ./backup-local.sh
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vetpro}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
CONTAINER_NAME="${PG_CONTAINER:-vetpro-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-vetpro}"
DATE="$(date +"%Y-%m-%d_%H-%M-%S")"
FILENAME="vetpro_backup_${DATE}.sql.gz"
TARGET_FILE="${BACKUP_DIR}/${FILENAME}"

echo "🏁 [$(date '+%Y-%m-%d %H:%M:%S')] Iniciando respaldo de base de datos VetPro..."

# 1. Asegurar directorio de destino
mkdir -p "${BACKUP_DIR}"

# 2. Ejecutar respaldo (priorizar docker exec si el contenedor está corriendo, o pg_dump local)
if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -Eq "^(${CONTAINER_NAME}|vetpro-postgres-prod)$"; then
  ACTIVE_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E "^(${CONTAINER_NAME}|vetpro-postgres-prod)$" | head -n 1)"
  echo "📦 Ejecutando pg_dump vía contenedor Docker (${ACTIVE_CONTAINER})..."
  docker exec -t "${ACTIVE_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${TARGET_FILE}"
elif [ -n "${DATABASE_URL:-}" ] && command -v pg_dump &> /dev/null; then
  echo "💾 Ejecutando pg_dump directo vía DATABASE_URL..."
  pg_dump "${DATABASE_URL}" | gzip > "${TARGET_FILE}"
elif command -v pg_dump &> /dev/null; then
  echo "💾 Ejecutando pg_dump local en localhost..."
  pg_dump -U "${POSTGRES_USER}" -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -d "${POSTGRES_DB}" | gzip > "${TARGET_FILE}"
else
  echo "❌ ERROR: No se encontró el contenedor Docker '${CONTAINER_NAME}' ni 'pg_dump' en el sistema." >&2
  exit 1
fi

# Validar que el archivo generado no esté vacío
if [ ! -s "${TARGET_FILE}" ]; then
  echo "❌ ERROR: El archivo de respaldo se creó vacío: ${TARGET_FILE}" >&2
  rm -f "${TARGET_FILE}"
  exit 1
fi

FILE_SIZE="$(du -h "${TARGET_FILE}" | cut -f1)"
echo "✅ Respaldo exitoso: ${TARGET_FILE} (${FILE_SIZE})"

# 3. Rotación: eliminar respaldos más antiguos que RETENTION_DAYS
echo "🧹 Limpiando respaldos con más de ${RETENTION_DAYS} días en ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name "vetpro_backup_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
echo "✅ Rotación completada."
echo "🎉 [$(date '+%Y-%m-%d %H:%M:%S')] Proceso finalizado con éxito."
