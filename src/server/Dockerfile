
# 1. Import the NGINX base image
FROM nginx:1.25-alpine

# 2. Copy the NGINX configuration and and the static served landing page
COPY src/server/conf.d/default.conf /etc/nginx/conf.d/default.conf
COPY src/server/html /usr/share/nginx/homepage

# 3. Expose the port 8090
EXPOSE 8090
