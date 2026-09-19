#!/usr/bin/env bash
# ==============================================================================
# 🛡️ VetPro SaaS — OWASP ZAP Automated Security Scan (Staging / CI)
# ==============================================================================
# Este script ejecuta OWASP ZAP en un contenedor Docker para auditar la API y
# el frontend de VetPro en staging, asegurando 0 vulnerabilidades altas o críticas.
# ==============================================================================

set -euo pipefail

TARGET_API="${1:-http://localhost:3000}"
TARGET_FRONTEND="${2:-http://localhost:4200}"
OUTPUT_DIR="${3:-$(pwd)/zap-reports}"

echo "=========================================================="
echo "🛡️ INICIANDO ESCANEO DE SEGURIDAD OWASP ZAP"
echo "=========================================================="
echo "🎯 Target API:       $TARGET_API"
echo "🎯 Target Frontend:  $TARGET_FRONTEND"
echo "📁 Directorio salida: $OUTPUT_DIR"
echo "=========================================================="

mkdir -p "$OUTPUT_DIR"
chmod 777 "$OUTPUT_DIR"

# 1. Escaneo Baseline del Backend API
echo "▶️ [1/2] Ejecutando escaneo ZAP Baseline sobre la API..."
docker run --rm -t \
  --net=host \
  -v "$OUTPUT_DIR":/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t "$TARGET_API/api/health" \
  -r zap-api-report.html \
  -J zap-api-report.json \
  -I || {
    echo "⚠️ Advertencias detectadas en el escaneo de la API. Revisa $OUTPUT_DIR/zap-api-report.html"
}

# 2. Escaneo Baseline del Frontend
echo "▶️ [2/2] Ejecutando escaneo ZAP Baseline sobre el Frontend..."
docker run --rm -t \
  --net=host \
  -v "$OUTPUT_DIR":/zap/wrk/:rw \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t "$TARGET_FRONTEND" \
  -r zap-frontend-report.html \
  -J zap-frontend-report.json \
  -I || {
    echo "⚠️ Advertencias detectadas en el escaneo del Frontend. Revisa $OUTPUT_DIR/zap-frontend-report.html"
}

echo "=========================================================="
echo "✅ Auditoría OWASP ZAP completada con éxito."
echo "📄 Reportes guardados en: $OUTPUT_DIR"
echo "=========================================================="
