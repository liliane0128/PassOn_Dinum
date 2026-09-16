#!/bin/bash
set -e

# Waiting for Postgres is Compose's job, not ours: the compose file declares
# `depends_on: postgres: condition: service_healthy`, and the postgres image
# runs pg_isready in its own healthcheck. Doing it here needed a postgres
# client this image does not ship (python:*-slim has no pg_isready), which made
# the loop spin forever on "command not found" with its stderr silenced, and it
# read $POSTGRES_HOST, which nothing ever set.

# DEV ONLY: auto-generate migrations if missing.
# Non-fatal on purpose: a failure here must not stop the server from booting,
# since the migration that matters is the one applied just below. This was a
# no-op while `passon` was not yet an installed app; now that it is, a model
# changed without `makemigrations` is caught on the next boot.
if [ "${DJANGO_AUTO_MIGRATE:-0}" = "1" ]; then
    echo "Auto-generating migrations (dev mode)..."
    python manage.py makemigrations passon || echo "  skipped: makemigrations failed"
fi

# Always apply
python manage.py migrate --noinput

exec python manage.py runserver 0.0.0.0:8000
