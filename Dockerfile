FROM node:18-alpine

WORKDIR /app

# Install backend dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5000

CMD ["node", "backend/server.js"]
