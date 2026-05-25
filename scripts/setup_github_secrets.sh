#!/usr/bin/env bash
set -euo pipefail

# setup_github_secrets.sh
# Uso: Ejecutar en la máquina local donde estás autenticado con `gh`.
# El script sube los secrets necesarios para los workflows al repo remoto.

REPO_ENV=${REPO:-}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# detect repo from git remote if not provided
if [ -z "${REPO_ENV}" ]; then
  ORIGIN_URL=$(git remote get-url origin 2>/dev/null || true)
  if [ -z "$ORIGIN_URL" ]; then
    echo "No se pudo detectar el repo remoto. Define REPO=owner/repo o ejecuta desde el clon del repo." >&2
    exit 1
  fi
  # transform git@github.com:owner/repo.git or https://github.com/owner/repo.git
  REPO_ENV=$(echo "$ORIGIN_URL" | sed -E 's#(git@|https://)github.com[:/](.+)\.git#\2#')
fi

# check gh
if ! command -v gh >/dev/null 2>&1; then
  echo "La CLI 'gh' no está instalada. Instálala y autentícate con 'gh auth login'" >&2
  exit 1
fi

echo "Usando repo: $REPO_ENV"

# helper to set secret (reads from env var if present, otherwise prompt)
set_secret() {
  name="$1"
  env_var="$2"
  file_path="$3"

  if [ -n "${!env_var:-}" ]; then
    value="${!env_var}"
  elif [ -n "${file_path}" ] && [ -f "${file_path}" ]; then
    value="$(cat "$file_path")"
  else
    # prompt securely
    echo -n "Valor para $name: "
    if [ "$name" = "SSH_PRIVATE_KEY" ]; then
      echo "\n(Se pegará desde stdin; termina con Ctrl-D)"
      value="$(</dev/stdin)"
    else
      read -r value
    fi
  fi

  if [ -z "${value}" ]; then
    echo "Valor vacío para $name; saltando." >&2
    return
  fi

  echo "Setting secret $name..."
  printf '%s' "$value" | gh secret set "$name" --repo "$REPO_ENV" --body -
}

# Defaults
SSH_PRIV_FILE="$HOME/.ssh/vetpro_deploy"

# Set secrets (order)
# SSH_PRIVATE_KEY
if [ -f "$SSH_PRIV_FILE" ]; then
  echo "Usando clave SSH en $SSH_PRIV_FILE for SSH_PRIVATE_KEY"
  printf '%s' "$(cat "$SSH_PRIV_FILE")" | gh secret set SSH_PRIVATE_KEY --repo "$REPO_ENV" --body -
else
  echo "No se encontró $SSH_PRIV_FILE. Se pedirá la clave por stdin." >&2
  echo "Pega la clave privada y termina con Ctrl-D:" >&2
  value="$(</dev/stdin)"
  printf '%s' "$value" | gh secret set SSH_PRIVATE_KEY --repo "$REPO_ENV" --body -
fi

# SSH_HOST
if [ -n "${SSH_HOST:-}" ]; then
  gh secret set SSH_HOST --repo "$REPO_ENV" --body "$SSH_HOST"
else
  read -p "SSH_HOST (ej: 1.2.3.4 o host.example.com): " val && gh secret set SSH_HOST --repo "$REPO_ENV" --body "$val"
fi

# SSH_USER
if [ -n "${SSH_USER:-}" ]; then
  gh secret set SSH_USER --repo "$REPO_ENV" --body "$SSH_USER"
else
  read -p "SSH_USER (default: djfa): " val
  val=${val:-djfa}
  gh secret set SSH_USER --repo "$REPO_ENV" --body "$val"
fi

# SSH_PORT
if [ -n "${SSH_PORT:-}" ]; then
  gh secret set SSH_PORT --repo "$REPO_ENV" --body "$SSH_PORT"
else
  read -p "SSH_PORT (default: 22): " val
  val=${val:-22}
  gh secret set SSH_PORT --repo "$REPO_ENV" --body "$val"
fi

# REGISTRY, REGISTRY_USER, REGISTRY_TOKEN
if [ -n "${REGISTRY:-}" ]; then
  gh secret set REGISTRY --repo "$REPO_ENV" --body "$REGISTRY"
else
  read -p "REGISTRY (ej: ghcr.io/usuario): " val && gh secret set REGISTRY --repo "$REPO_ENV" --body "$val"
fi

if [ -n "${REGISTRY_USER:-}" ]; then
  gh secret set REGISTRY_USER --repo "$REPO_ENV" --body "$REGISTRY_USER"
else
  read -p "REGISTRY_USER: " val && gh secret set REGISTRY_USER --repo "$REPO_ENV" --body "$val"
fi

if [ -n "${REGISTRY_TOKEN:-}" ]; then
  gh secret set REGISTRY_TOKEN --repo "$REPO_ENV" --body "$REGISTRY_TOKEN"
else
  read -p "REGISTRY_TOKEN (will be hidden if pasted): " val && gh secret set REGISTRY_TOKEN --repo "$REPO_ENV" --body "$val"
fi

echo "Secrets configurados en $REPO_ENV"
