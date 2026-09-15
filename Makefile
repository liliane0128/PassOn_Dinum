# Runs the whole app (nginx + frontend build + Django) on http://localhost:8090.
# For backend-only work, `cd src/backend && make up` still runs Django alone.

up: src/backend/.env
	docker compose up -d --build
	@echo "Pass'on is running on http://localhost:8090"

down:
	docker compose down

logs:
	docker compose logs -f

# The backend reads this file at startup; seed it from the example on first run.
src/backend/.env:
	cp src/backend/.env.example $@
	@echo "Created src/backend/.env from the example (mock mode, no upstream services needed)."

.PHONY: up down logs
