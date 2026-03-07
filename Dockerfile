# MCP Crypto Server - Node/TypeScript
# Supports TRANSPORT=stdio (default) or TRANSPORT=http
FROM node:20-alpine

WORKDIR /app

# Install dependencies (include dev for tsx to run TypeScript)
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

# Copy source
COPY tsconfig.json ./
COPY mcp-server-socket.ts ./
COPY src/ ./src/
COPY utils/ ./utils/ 2>/dev/null || true
COPY scripts/ ./scripts/ 2>/dev/null || true

# Create knowledge dir for optional indexing
RUN mkdir -p knowledge

# Default: stdio mode (for MCP clients like Cursor, Claude Desktop)
# Set TRANSPORT=http and MCP_HTTP_PORT=3001 for HTTP/SSE mode
ENV TRANSPORT=stdio
ENV MCP_HTTP_PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["npx", "tsx", "mcp-server-socket.ts"]
