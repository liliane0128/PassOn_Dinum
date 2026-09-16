
##########################
# PROJECT NAME : PASS'ON #
##########################

# A single docker-compose.yml, at the root: a single database, regardless
# of how the project is launched.
#
#   make          (= make run)  API only, Django on http://localhost:8000
#   make up                     full application on http://localhost:8090
#
# `make up` compiles the frontend and serves it behind nginx, which forwards /api/
# to Django: this is the only way to log in from the interface (same
# origin, session cookies). See src/server/README.md.

all: run

# --- API only (postgres + Django, without nginx or frontend) ---
run: src/backend/.env
	@docker compose up -d --build postgres web
	@firefox http://localhost:8000 &
build:
	@docker compose build
stop: down

# --- Full application: nginx + compiled frontend + Django + postgres ---
up: src/backend/.env
	docker compose up -d --build
	@echo "$(NAME) run on http://localhost:8090"
down:
	docker compose down
logs:
	docker compose logs -f

# Initialized a default .env file if needed
src/backend/.env:
	cp src/backend/.env.example $@
	@echo "src/backend/.env has been created from the .env.example (mode mock)."

.PHONY: all run build stop up down logs
