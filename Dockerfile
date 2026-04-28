FROM node:16-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY backend ./backend
COPY uploads ./uploads

EXPOSE 5000

CMD ["npm", "run", "server"]