FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
CMD ["node", "server.js"]
