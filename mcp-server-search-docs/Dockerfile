FROM node:18-alpine

WORKDIR /app

COPY mcp-server-search-docs/package.json mcp-server-search-docs/package-lock.json ./
RUN npm ci

COPY mcp-server-search-docs/src/ ./src/
COPY mcp-server-search-docs/tsconfig.json ./

RUN npm run build

ENTRYPOINT ["node", "dist/index.js"]
