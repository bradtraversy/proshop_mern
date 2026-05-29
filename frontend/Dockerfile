FROM --platform=linux/amd64 node:18

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps
RUN npm install @tailwindcss/oxide-linux-x64-gnu@4.3.0 --legacy-peer-deps
RUN node -e "require('@tailwindcss/oxide'); console.log('oxide binding OK')"

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

EXPOSE 3000

CMD ["npx", "vite", "--host"]
