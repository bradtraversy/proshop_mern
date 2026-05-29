FROM node:18-alpine

WORKDIR /app

COPY mcp-server-feature-flags/package.json mcp-server-feature-flags/package-lock.json ./
RUN npm ci

COPY mcp-server-feature-flags/src/ ./src/
COPY mcp-server-feature-flags/tsconfig.json ./

RUN npm run build

ENTRYPOINT ["node", "dist/index.js"]
