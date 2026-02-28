.DEFAULT_GOAL := help

SHELL := /bin/bash

BACKEND_DIR := backend
FRONTEND_DIR := frontend

NODE_IMAGE ?= node:22-alpine

.PHONY: help \
	prebuild prebuild-all prebuild-backend prebuild-frontend \
	backend-check backend-test backend-race backend-vet backend-vuln backend-lint backend-unit backend-coverage backend-advanced \
	backend-integration \
	frontend-check frontend-check-all frontend-format-check frontend-advanced \
	docker-build docker-build-prod docker-build-backend docker-build-backend-prod docker-build-frontend docker-build-frontend-prod

help:
	@echo "Targets:"
	@echo "  make prebuild        Run backend+frontend checks before docker build"
	@echo "  make prebuild-all    Like prebuild + integration checks"
	@echo "  make prebuild-backend  Run advanced backend checks only"
	@echo "  make prebuild-frontend  Run advanced frontend checks only"
	@echo "  make docker-build    Run prebuild then docker compose build"
	@echo "  make docker-build-prod  Run prebuild then docker compose -f docker-compose.prod.yml build"
	@echo "  make docker-build-backend  Run backend checks then build backend image only"
	@echo "  make docker-build-backend-prod  Run backend checks then build backend image only (prod compose)"
	@echo "  make docker-build-frontend  Run frontend checks then build frontend image only"
	@echo "  make docker-build-frontend-prod  Run frontend checks then build nginx image only (contains frontend build)"

prebuild: backend-check frontend-check

prebuild-all: prebuild backend-integration frontend-check-all

prebuild-backend: backend-advanced

prebuild-frontend: frontend-advanced

backend-check: backend-test backend-race backend-vet backend-vuln

backend-advanced: backend-lint backend-unit backend-race backend-integration backend-vuln backend-coverage

backend-lint:
	./scripts/backend-check.sh lint

backend-unit:
	./scripts/backend-check.sh unit

backend-test:
	./scripts/backend-check.sh unit

backend-race:
	./scripts/backend-check.sh race

backend-vet:
	./scripts/backend-check.sh lint

backend-vuln:
	./scripts/backend-check.sh vuln

backend-coverage:
	./scripts/backend-check.sh coverage

backend-integration:
	./scripts/backend-check.sh integration

frontend-check:
	NODE_IMAGE=$(NODE_IMAGE) ./scripts/frontend-check.sh lint test

frontend-check-all:
	NODE_IMAGE=$(NODE_IMAGE) ./scripts/frontend-check.sh lint test build

frontend-advanced:
	NODE_IMAGE=$(NODE_IMAGE) ./scripts/frontend-check.sh advanced

frontend-format-check:
	NODE_IMAGE=$(NODE_IMAGE) ./scripts/frontend-check.sh format:check

docker-build: prebuild
	docker compose -f docker-compose.yml build

docker-build-prod: prebuild
	docker compose -f docker-compose.prod.yml build

docker-build-backend: prebuild-backend
	docker compose -f docker-compose.yml build backend

docker-build-backend-prod: prebuild-backend
	docker compose -f docker-compose.prod.yml build backend

docker-build-frontend: prebuild-frontend
	docker compose -f docker-compose.yml build frontend-dev

docker-build-frontend-prod: prebuild-frontend
	docker compose -f docker-compose.prod.yml build nginx
