#!/bin/bash
# VetPro — despliegue del stack vivo (stacks/vetpro) con backup previo obligatorio.
# Uso: ./deploy.sh   (también lo invoca deploy_watchdog.sh)
# Todo va dentro de main() para que un git pull que reescriba este archivo no afecte la ejecución.
main() {
  set -euo pipefail
  local ROOT COMPOSE BK U DB before after
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  COMPOSE="$ROOT/stacks/vetpro/docker-compose.yml"
  BK="$HOME/Dev/backups/vetpro/auto_$(date +%Y%m%d_%H%M%S)"
  cd "$ROOT"

  [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "❌ Solo se despliega desde la rama main."; exit 1; }
  docker inspect -f '{{.State.Running}}' vetpro-postgres | grep -q true || { echo "❌ vetpro-postgres no está corriendo."; exit 1; }

  echo "💾 Backup previo en $BK"
  mkdir -p "$BK"; chmod 700 "$BK"
  U=$(docker exec vetpro-postgres printenv POSTGRES_USER)
  DB=$(docker exec vetpro-postgres printenv POSTGRES_DB)
  docker exec vetpro-postgres pg_dump -U "$U" -Fc "$DB" > "$BK/vetpro.dump"
  [ -s "$BK/vetpro.dump" ] || { echo "❌ El backup quedó vacío; no se despliega."; exit 1; }
  git rev-parse HEAD > "$BK/head_before.txt"
  cp "$COMPOSE" "$BK/"; for f in stacks/vetpro/.env .env vetpro-backend/.env; do [ -f "$f" ] && cp "$f" "$BK/$(echo "$f" | tr / _)"; done
  chmod 600 "$BK"/* "$BK"/.[!.]* 2>/dev/null || true

  count() { docker exec vetpro-postgres psql -U "$U" -d "$DB" -Atc "select (select count(*) from clinics)||'/'||(select count(*) from users)||'/'||(select count(*) from patients)"; }
  before=$(count)

  echo "📥 Trayendo cambios de main..."
  git pull --ff-only origin main

  echo "📦 Reconstruyendo stack (las migraciones se aplican al arrancar el backend)..."
  docker compose -f "$COMPOSE" up -d --build

  echo "⏳ Esperando a que el backend esté sano..."
  local i=0
  until [ "$(docker inspect -f '{{.State.Health.Status}}' vetpro-backend 2>/dev/null)" = "healthy" ]; do
    i=$((i+1)); [ $i -gt 60 ] && { echo "❌ El backend no quedó sano. Revisa: docker logs vetpro-backend. Backup: $BK"; exit 1; }
    sleep 3
  done

  after=$(count)
  echo "📊 clínicas/usuarios/pacientes antes=$before después=$after"
  IFS=/ read -r b1 b2 b3 <<< "$before"; IFS=/ read -r a1 a2 a3 <<< "$after"
  if [ "$a1" -lt "$b1" ] || [ "$a2" -lt "$b2" ] || [ "$a3" -lt "$b3" ]; then
    echo "❌ ALERTA: bajó el número de registros. Restaurar desde $BK/vetpro.dump"; exit 1
  fi

  docker image prune -f >/dev/null
  echo "🎉 Despliegue completado. Backup: $BK"
}
main "$@"
exit $?
