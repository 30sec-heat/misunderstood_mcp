# MCP Crypto Web Platform: Keys & Trading Architecture

## Overview

This document describes the client-side API key management and trading flow. **The server never receives or stores API keys.** All order execution happens from the browser using keys stored locally.

---

## 1. Keys Vault (Client-Side Only)

### Storage
- **Location:** Browser `localStorage` (key: `mcp_keys_vault`)
- **Contents:** Exchange API keys (Binance, Bybit), optional wallet keys
- **Never sent to server:** Keys remain in the browser at all times

### Flow
```
User adds keys in Settings > Keys Vault
    → Stored in localStorage
    → Displayed masked (e.g., sk-1***xyz)
    → Used only for client-side signing
```

### Supported Exchanges
- **Binance** (spot + futures)
- **Bybit** (spot)

---

## 2. Order Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER (Client)                                                │
│                                                                  │
│  1. User places order in Trading/Orders UI                        │
│  2. Keys loaded from localStorage (Keys Vault)                    │
│  3. Request signed locally (HMAC-SHA256 via Web Crypto API)      │
│  4. Pre-signed request sent to backend relay                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (API Server)                                            │
│                                                                  │
│  POST /api/trading/relay                                         │
│  - Receives: { url, method, headers, body }                      │
│  - Validates: URL must be api.binance.com, fapi.binance.com,     │
│               api.bybit.com, etc.                                │
│  - Forwards request to exchange (no keys stored or logged)       │
│  - Returns exchange response to client                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXCHANGE (Binance, Bybit)                                       │
│  - Validates signature (computed in browser)                     │
│  - Executes order                                                │
│  - Returns result                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points
- **Signing happens in the browser** using Web Crypto API (`crypto.subtle.sign`)
- **Server acts as a dumb relay** – forwards pre-signed requests, never sees secrets
- **CORS:** Exchange APIs block direct browser requests. The relay bypasses this.
- **Server whitelist:** Only `api.binance.com`, `fapi.binance.com`, `api.bybit.com`, etc.

---

## 3. MCP Server Trading Tools

### Read-Only (Server)
These run on the MCP server and require **no API keys**:
- `trading_get_ticker` – price, volume, 24h change
- `trading_get_orderbook` – bids/asks
- `trading_get_recent_trades` – recent trades

### Execution (Client-Only)
These tools return a message directing users to the webapp:
- `trading_fetch_balance`
- `trading_create_market_order`
- `trading_create_limit_order`
- `trading_get_open_orders`
- `trading_cancel_order`
- `trading_get_positions`
- `trading_set_leverage`

**Message:** "Use the Trading/Orders section in the webapp with keys in Keys Vault."

---

## 4. MCP Tool Activation

### Toggle State
- **Anonymous/single-user:** Stored in `localStorage` (`mcp_tools_enabled`)
- **Multi-user:** Backend can persist in DB (user id + tool name)

### API
- `GET /api/tools` – Returns all tools with `enabled: boolean`
- `POST /api/tools/:name/enable` – Enable a tool
- `POST /api/tools/:name/disable` – Disable a tool

### Client Merge
When fetching tools, the client merges:
- Backend default: all enabled
- Local overrides from `localStorage` (user toggles)

---

## 5. Webapp Tabs

| Tab        | Purpose                                              |
|-----------|------------------------------------------------------|
| **Settings** | Keys Vault – add/remove/mask exchange keys           |
| **Management** | MCP tools – toggle on/off per tool                  |
| **Trading**   | Place orders – uses Keys Vault, signs in browser    |

---

## 6. Security Summary

| Component        | Keys? | Notes                                      |
|------------------|-------|--------------------------------------------|
| Keys Vault       | Yes   | Stored in localStorage only                |
| Trading UI       | Yes   | Reads from vault, signs in browser         |
| API Server       | No    | Relay never stores or logs keys           |
| MCP Server       | No    | Read-only market data; no execution       |

---

## 7. Running the Platform

```bash
# Build webapp
cd webapp && npm run build

# Start API server (serves webapp + API)
npm run web
```

Dev mode (Vite proxy to API):
```bash
# Terminal 1: API server on 5174
npm run web

# Terminal 2: Vite dev server proxies /api to 5174
cd webapp && npm run dev
```
