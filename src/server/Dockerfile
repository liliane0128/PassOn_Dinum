# Build context is the repository root (see docker-compose.yml), so this image
# can take the frontend sources and the nginx config from their own folders.

# Stage 1 -- compile the React app to static files.
FROM node:22-alpine AS frontend-build

WORKDIR /build

# Dependencies first: this layer stays cached as long as the lockfile is
# untouched, which is most of the time.
COPY src/frontend/package.json src/frontend/package-lock.json ./
RUN npm ci

COPY src/frontend/ ./
RUN npm run build

# Stage 2 -- serve them.
FROM nginx:1.25-alpine

COPY src/server/conf.d/default.conf /etc/nginx/conf.d/default.conf

# The homepage is a static page with no build step, so it is copied as it is.
COPY src/server/html /usr/share/nginx/homepage

EXPOSE 8090
