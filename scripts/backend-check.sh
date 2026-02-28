#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

if ! command -v go >/dev/null 2>&1; then
  echo "go is required to run backend checks" >&2
  exit 1
fi

if [ "$#" -eq 0 ]; then
  set -- lint unit race integration vuln coverage
fi

cd "$BACKEND_DIR"

run_lint() {
  local unformatted
  unformatted="$(find . -name '*.go' -not -name '*.gen.go' -not -path './bin/*' -print0 | xargs -0 gofmt -l)"
  if [ -n "$unformatted" ]; then
    echo "gofmt check failed. Please format these files:" >&2
    echo "$unformatted" >&2
    exit 1
  fi

  go vet ./...
}

run_unit() {
  go test ./... -count=1
}

run_race() {
  go test ./... -race -count=1
}

run_integration() {
  go test ./... -tags=integration -count=1
}

run_vuln() {
  if command -v govulncheck >/dev/null 2>&1; then
    if govulncheck ./...; then
      return
    fi
    echo "local govulncheck failed, retrying with dockerized vulncheck..." >&2
  fi

  if command -v docker >/dev/null 2>&1; then
    "$ROOT_DIR/scripts/backend-vulncheck.sh"
    return
  fi

  go run golang.org/x/vuln/cmd/govulncheck@latest ./...
}

run_coverage() {
  local coverage_file
  local test_packages
  coverage_file="coverage.out"

  test_packages="$(go list -f '{{if or .TestGoFiles .XTestGoFiles}}{{.ImportPath}}{{end}}' ./... | sed '/^$/d')"
  if [ -z "$test_packages" ]; then
    echo "no test packages found for coverage" >&2
    exit 1
  fi

  go test $test_packages -count=1 -covermode=atomic -coverprofile="$coverage_file"
  go tool cover -func="$coverage_file" | grep '^total:'
}

for task in "$@"; do
  case "$task" in
    lint)
      run_lint
      ;;
    unit)
      run_unit
      ;;
    race)
      run_race
      ;;
    integration)
      run_integration
      ;;
    vuln)
      run_vuln
      ;;
    coverage)
      run_coverage
      ;;
    *)
      echo "unknown backend task: $task" >&2
      exit 2
      ;;
  esac
done