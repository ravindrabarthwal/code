.PHONY: help install dev up down logs test clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install dependencies
	cd services/proxy && bun install

dev: ## Start services in development mode
	docker-compose up --build

up: ## Start services in background
	docker-compose up -d --build

down: ## Stop all services
	docker-compose down

logs: ## Show service logs
	docker-compose logs -f

test: ## Run proxy tests
	@chmod +x test-proxy.sh
	@./test-proxy.sh

clean: ## Clean up containers and volumes
	docker-compose down -v
	rm -rf services/proxy/node_modules
	rm -f services/proxy/bun.lockb
