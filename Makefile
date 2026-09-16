NAME	:=	PASS'ON

# Un seul docker-compose.yml, à la racine : une seule base de données, quelle
# que soit la façon de lancer le projet.
#
#   make          (= make run)  API seule, Django sur http://localhost:8000
#   make up                     appli complète sur http://localhost:8090
#
# `make up` compile le frontend et le sert derrière nginx, qui relaie /api/
# vers Django : c'est la seule façon de se connecter depuis l'interface (même
# origine, cookies de session). Voir src/server/README.md.

all: run

# --- API seule (postgres + Django, sans nginx ni frontend) ------------------

run: src/backend/.env
	@docker compose up -d --build postgres web
	@firefox http://localhost:8000 &

build:
	@docker compose build

stop: down

# --- Appli complète : nginx + frontend compilé + Django + postgres ----------

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
