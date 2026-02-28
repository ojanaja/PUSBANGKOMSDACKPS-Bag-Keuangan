#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"

NODE_IMAGE="${NODE_IMAGE:-node:22-alpine}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run frontend checks in a pinned Node runtime" >&2
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "frontend directory not found: $FRONTEND_DIR" >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- lint test
fi

run_cmd="npm ci --silent"
for task in "$@"; do
  case "$task" in
    lint)
      run_cmd+=" && npm run lint"
      ;;
    test)
      run_cmd+=" && npm run test"
      ;;
    coverage)
      run_cmd+=" && npm run test:coverage"
      ;;
    build)
      run_cmd+=" && npm run build"
      ;;
    advanced)
      run_cmd+=" && npm run lint && npm run test && npm run test:coverage && npm run build"
      ;;
    format:check)
      run_cmd+=" && npm run format:check"
      ;;
    *)
      echo "unknown frontend task: $task" >&2
      exit 2
      ;;
  esac
done

docker run --rm \
  -v "$FRONTEND_DIR":/app \
  -w /app \
  "$NODE_IMAGE" \
  sh -lc "$run_cmd"
