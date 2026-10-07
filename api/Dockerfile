FROM node:24-slim

WORKDIR /api

# Copy the dependencies file first to leverage Docker cache layers
COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 5001

CMD ["node", "server.js"]
