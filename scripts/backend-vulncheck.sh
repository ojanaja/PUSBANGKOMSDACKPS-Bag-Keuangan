#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

GO_IMAGE="${GO_IMAGE:-golang:1.25-alpine}"

if [ "${USE_HOST_GO:-0}" = "1" ]; then
  cd "$BACKEND_DIR"
  if ! command -v govulncheck >/dev/null 2>&1; then
    echo "govulncheck not found; installing..." >&2
    go install golang.org/x/vuln/cmd/govulncheck@latest
  fi
  govulncheck ./...
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required for backend vulncheck (or set USE_HOST_GO=1)" >&2
  exit 1
fi

docker run --rm \
  -v "$BACKEND_DIR":/app \
  -w /app \
  "$GO_IMAGE" \
  sh -c "go mod download && go run golang.org/x/vuln/cmd/govulncheck@latest ./..."
