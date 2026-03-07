# MCP Crypto Webapp

React + Vite + TypeScript web application for the MCP Crypto Server. Mobile-first, dark theme inspired by sniping.stream.

## Tech Stack

- **React 19** + **Vite 7** + **TypeScript**
- **Tailwind CSS v4** – dark theme, accent colors, mobile-first
- **React Router** – tab navigation

## Design

- **Backgrounds:** `#0a0a0f`, `#12121a`, `#16161f`
- **Accents:** Cyan/emerald (positive), red (negative)
- **Typography:** Inter (sans), JetBrains Mono (data)
- **Layout:** Card-based, sharp edges, data-dense

## Tabs

| Tab | Route | Description |
|-----|-------|-------------|
| Agent | `/agent` | Chat/agent interface to interact with MCP tools |
| Management | `/management` | View MCP tools, activate/deactivate per user |
| Data Explorer | `/data` | Browse data from modules (polymarket, sentiment, etc.) |
| Settings | `/settings` | API keys (localStorage only, never sent to server) |

## Development

```bash
cd webapp
npm install
npm run dev
```

Runs at `http://localhost:5173`. API requests to `/api` are proxied to `http://localhost:3000` (configure in `vite.config.ts`).

## Build

```bash
npm run build
npm run preview
```

## API Assumptions

Backend at `/api` with:

- `GET /api/tools` → `{ tools: MCPTool[] }`
- `POST /api/tools/:id/toggle` → `{ success: boolean }` (body: `{ enabled: boolean }`)
- `GET /api/data/modules` → `{ modules: DataModule[] }`
- `GET /api/data/:module` → `{ data: DataRecord[] }`

Trading/order API keys are stored in browser localStorage only and never sent to the server.
