
##################################################################################
#                             PROJECT NAME : PASS'ON                             #
##################################################################################
# The single docker-compose.yml, at the repository root: one database,           #
# whichever way the project is started.                                          #
#                                                                                #
#   make          API only -- Postgres + Django on http://localhost:8000         #
#   make up       full app -- nginx + frontend + Django on http://localhost:8090 #
#                                                                                #
# `make run` boots only postgres and web. `make up` adds nginx, which serves     #
# the built frontend and forwards /api/ to Django: the interface and the API     #
# share an origin, so the session cookie survives and login works. Hitting       #
# Django directly on :8000 does not give you that. See src/server/README.md.     #
##################################################################################

NAME := Pass'On

all: run

# Initialized a default .env file if needed
src/backend/.env:
	@printf "\e[0;33m[?] $@ doesnt exist, using the $@.example file\e[0m\n"
	@cp src/backend/.env.example $@

# --- Full application: NGINX + compiled frontend + Django + Postgres ---
up: src/backend/.env
	@printf "\e[0;32m[+] Launching every containers\e[0m\n"
	@docker compose --env-file src/backend/.env up -d --build
	@printf "\e[0;32m[+] $(NAME) is now running on http://localhost:8090\e[0m\n"
down:
	@printf "\e[0;32m[+] Shutting down every containers\e[0m\n"
	@docker compose down

# --- API only (postgres + Django, without nginx and frontend) ---
run: src/backend/.env
	@printf "\e[0;32m[+] Launching Postgres and Django containers\e[0m\n"
	@docker compose --env-file src/backend/.env up -d --build postgres web
build:
	@printf "\e[0;32m[+] Building containers\e[0m\n"
	@docker compose src/backend/.env build
stop: down

.PHONY: all run stop build up down
