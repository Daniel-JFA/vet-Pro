#!/usr/bin/env bash
# ==============================================================================
# 💎 VETPRO SaaS — Restauración de Base de Datos PostgreSQL
# ==============================================================================
# Restaura un volcado (.sql.gz o .sql) en la base de datos PostgreSQL.
#
# Uso:
#   ./restore-local.sh /ruta/al/vetpro_backup_YYYY-MM-DD_HH-MM-SS.sql.gz
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Uso: $0 <archivo_backup.sql.gz|archivo_backup.sql>" >&2
  exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="${PG_CONTAINER:-vetpro-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-vetpro}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ ERROR: El archivo '${BACKUP_FILE}' no existe." >&2
  exit 1
fi

echo "⚠️  ADVERTENCIA: Esta operación restaurará la base de datos '${POSTGRES_DB}' con el contenido de:"
echo "   ${BACKUP_FILE}"
echo "   Presione Ctrl+C en los próximos 5 segundos para cancelar..."
sleep 5

echo "🏁 Restaurando base de datos..."

if command -v docker &> /dev/null && docker ps --format '{{.Names}}' | grep -Eq "^(${CONTAINER_NAME}|vetpro-postgres-prod)$"; then
  ACTIVE_CONTAINER="$(docker ps --format '{{.Names}}' | grep -E "^(${CONTAINER_NAME}|vetpro-postgres-prod)$" | head -n 1)"
  echo "📦 Restaurando vía contenedor Docker (${ACTIVE_CONTAINER})..."
  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gzip -dc "${BACKUP_FILE}" | docker exec -i "${ACTIVE_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
  else
    cat "${BACKUP_FILE}" | docker exec -i "${ACTIVE_CONTAINER}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
  fi
elif [ -n "${DATABASE_URL:-}" ] && command -v psql &> /dev/null; then
  echo "💾 Restaurando vía DATABASE_URL..."
  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gzip -dc "${BACKUP_FILE}" | psql "${DATABASE_URL}"
  else
    cat "${BACKUP_FILE}" | psql "${DATABASE_URL}"
  fi
else
  echo "❌ ERROR: No se encontró el contenedor Docker '${CONTAINER_NAME}' ni 'psql' en el sistema." >&2
  exit 1
fi

echo "✅ Restauración completada exitosamente."
