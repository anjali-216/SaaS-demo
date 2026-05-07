FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./server.js
COPY public ./public

ENV MARKET_SERVICE_URL=http://market-service:3000

EXPOSE 3001

CMD ["node", "server.js"]

