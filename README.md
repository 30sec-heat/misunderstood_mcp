# misunderstood_mcp

Small **[Model Context Protocol](https://modelcontextprotocol.io/)** server for **Deribit**: option chains, IV analysis, probabilities, and related helpers. Uses Deribit’s **public** REST API only (no API keys for read-only tools).

## Run

```bash
npm install
npm start
```

- **stdio** (default): for Cursor, Claude Desktop, and other MCP clients.
- **HTTP/SSE** (optional): `npm run mcp:http` — listens on `PORT` (default `3000`), path `GET /mcp/sse`.

## Cursor

Use **this folder** as the workspace root (or absolute paths if the workspace is a parent directory). Example `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "deribit-mcp": {
      "command": "node",
      "args": [
        "./node_modules/tsx/dist/cli.mjs",
        "./mcp-server-socket.ts"
      ],
      "cwd": ".",
      "env": {}
    }
  }
}
```

## Docker

```bash
docker build -t misunderstood-mcp .
docker run -i --rm misunderstood-mcp
```

(Image runs the stdio server; use `-e` / TTY as your MCP host requires.)

## Tests

```bash
npm run test-mcp
npm run test-mcp-tools
```

## License

MIT
