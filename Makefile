NAME	:=	PASS'ON

all: run

run:
	@docker compose -f ./src/backend/docker-compose.yml --env-file ./.env up -d
	@firefox http://localhost:8000 &

build:
	@docker compose -f ./src/backend/docker-compose.yml --env-file ./.env build

stop:
	@docker compose -f ./src/backend/docker-compose.yml --env-file ./.env down
