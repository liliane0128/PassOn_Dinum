#!/bin/bash
set -e

# Waiting for Postgres is Compose's job, not ours: both compose files declare
# `depends_on: postgres: condition: service_healthy`, and the postgres image
# runs pg_isready in its own healthcheck. Doing it here needed a postgres
# client this image does not ship (python:*-slim has no pg_isready), which made
# the loop spin forever on "command not found" with its stderr silenced, and it
# read $POSTGRES_HOST, which nothing ever set.

# DEV ONLY: auto-generate migrations if missing.
# Non-fatal on purpose: relais_dinum/models.py is not part of an installed app
# yet ("No installed app with label 'passon'"), so this is a no-op until that
# app exists -- and until then it must not stop the server from booting.
if [ "${DJANGO_AUTO_MIGRATE:-0}" = "1" ]; then
    echo "Auto-generating migrations (dev mode)..."
    python manage.py makemigrations passon || echo "  skipped: no 'passon' app yet"
fi

# Always apply
python manage.py migrate --noinput

exec python manage.py runserver 0.0.0.0:8000
