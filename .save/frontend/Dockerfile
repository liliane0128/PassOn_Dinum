FROM node:22-alpine

WORKDIR /frontend

COPY src/frontend .

RUN npm ci
RUN npm run build

EXPOSE 3001
CMD ["npm", "run", "dev", "--", "-p", "3001"]
