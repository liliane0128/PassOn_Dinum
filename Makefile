NAME	:=	PASS'ON

# Deux façons de lancer le projet :
#
#   make          (= make run)  backend seul, Django sur http://localhost:8000
#   make up                     pile complète, appli + API sur http://localhost:8090
#
# La pile complète compile le frontend et le sert derrière nginx, qui relaie
# /api/ vers Django : c'est la seule qui permet de se connecter depuis
# l'interface (même origine, cookies de session). Voir src/server/README.md.

all: run

# --- Backend seul (docker compose de src/backend) ---------------------------

run:
	@docker compose -f ./src/backend/docker-compose.yml --env-file ./.env up -d
	@firefox http://localhost:8000 &

build:
	@docker compose -f ./src/backend/docker-compose.yml --env-file ./.env build

stop:
	@docker compose -f ./src/backend/docker-compose.yml --env-file ./.env down

# --- Pile complète : nginx + frontend compilé + Django ----------------------

up: src/backend/.env
	docker compose up -d --build
	@echo "$(NAME) tourne sur http://localhost:8090"

down:
	docker compose down

logs:
	docker compose logs -f

# Le backend lit ce fichier au démarrage : on le crée depuis l'exemple au
# premier lancement (mode mock, aucun service externe requis).
src/backend/.env:
	cp src/backend/.env.example $@
	@echo "src/backend/.env créé depuis l'exemple (mode mock)."

.PHONY: all run build stop up down logs
