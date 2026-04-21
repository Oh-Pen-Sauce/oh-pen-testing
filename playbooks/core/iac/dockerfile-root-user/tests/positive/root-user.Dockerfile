FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
USER root
CMD ["node", "server.js"]
