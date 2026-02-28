#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

MAKE_TARGET="prebuild"
COMPOSE_FILE="docker-compose.yml"
BACKEND_ONLY=0
FRONTEND_ONLY=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --all)
      MAKE_TARGET="prebuild-all"
      shift
      ;;
    --prod)
      COMPOSE_FILE="docker-compose.prod.yml"
      shift
      ;;
    --backend-only)
      BACKEND_ONLY=1
      MAKE_TARGET="prebuild-backend"
      shift
      ;;
    --frontend-only)
      FRONTEND_ONLY=1
      MAKE_TARGET="prebuild-frontend"
      shift
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if [ "$BACKEND_ONLY" -eq 1 ] && [ "$FRONTEND_ONLY" -eq 1 ]; then
  echo "--backend-only and --frontend-only cannot be used together" >&2
  exit 2
fi

make "$MAKE_TARGET"

if [ "$BACKEND_ONLY" -eq 1 ] && [ "$#" -eq 0 ]; then
  set -- backend
fi

if [ "$FRONTEND_ONLY" -eq 1 ] && [ "$#" -eq 0 ]; then
  if [ "$COMPOSE_FILE" = "docker-compose.prod.yml" ]; then
    set -- nginx
  else
    set -- frontend-dev
  fi
fi

docker compose -f "$COMPOSE_FILE" build "$@"
