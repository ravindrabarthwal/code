.PHONY: help install build dev up down logs test clean migrate db-generate db-push db-studio test-auth

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install dependencies
	cd services/proxy && bun install

build: ## Build Docker images from Dockerfiles
	docker-compose build

dev: ## Start services in development mode with migrations
	docker-compose up --build

up: ## Start services in background
	docker-compose up -d --build

down: ## Stop all services
	docker-compose down

logs: ## Show service logs
	docker-compose logs -f

migrate: ## Run database migrations
	docker-compose exec proxy bunx drizzle-kit push

db-generate: ## Generate new migration files
	docker-compose exec proxy bunx drizzle-kit generate

db-push: ## Push schema changes to database (development)
	docker-compose exec proxy bunx drizzle-kit push

db-studio: ## Open Drizzle Studio to view database
	docker-compose exec proxy bunx drizzle-kit studio

test: ## Run proxy tests
	@chmod +x test-proxy.sh
	@./test-proxy.sh

test-auth: ## Test authentication flow
	@echo "Testing health endpoint..."
	@curl -s http://localhost:3000/health | jq .
	@echo "\nTesting auth session (should return 401)..."
	@curl -s http://localhost:3000/p8n/auth/session | jq .
	@echo "\nGoogle OAuth URL:"
	@echo "http://localhost:3000/p8n/auth/sign-in/google"

clean: ## Clean up containers and volumes
	docker-compose down -v
	rm -rf services/proxy/node_modules
	rm -f services/proxy/bun.lockb
