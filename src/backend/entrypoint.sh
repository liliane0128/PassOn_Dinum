#!/bin/bash
set -e

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

# Start the django server
exec python manage.py runserver 0.0.0.0:8000
