FROM node:24-slim

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 5002 

# 5002 this is for local dev

CMD ["node", "server.js"]
