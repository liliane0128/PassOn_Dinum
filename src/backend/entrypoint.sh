#!/bin/bash
set -e

# Optional: wait for Postgres
until pg_isready -h "$POSTGRES_HOST" -U "$POSTGRES_USER" > /dev/null 2>&1; do
    echo "Waiting for Postgres..."
    sleep 1
done

# DEV ONLY: auto-generate migrations if missing
if [ "${DJANGO_AUTO_MIGRATE:-0}" = "1" ]; then
    echo "Auto-generating migrations (dev mode)..."
    python manage.py makemigrations passon
fi

# Always apply
python manage.py migrate --noinput

exec python manage.py runserver 0.0.0.0:8000
