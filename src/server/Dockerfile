
FROM nginx:1.25-alpine

COPY src/server/conf.d/default.conf /etc/nginx/conf.d/default.conf
COPY src/server/html /usr/share/nginx/homepage

EXPOSE 8090
