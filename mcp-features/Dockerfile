FROM node:20-alpine

WORKDIR /app/mcp-features

COPY mcp-features/package*.json ./
RUN npm install --omit=dev

COPY mcp-features/index.js ./

ENV MCP_TRANSPORT=sse
ENV MCP_SSE_PORT=7777

EXPOSE 7777

CMD ["node", "index.js"]
