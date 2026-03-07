# Project Structure

This document outlines the organization of the MCP Crypto Server codebase.

## Core Files

```
mcp-crypto-server/
├── mcp-server-socket.ts      # Main MCP server entry point
├── package.json              # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── install.sh               # One-command setup script
├── README.md                # Main documentation
├── SETUP.md                 # Detailed setup instructions
└── .env                     # Environment variables (created by installer)
```

## Source Code

```
src/
├── modules/                 # MCP tool modules
│   ├── aave/               # Aave DeFi integration
│   ├── base/               # Base classes and utilities
│   ├── coinalyze/          # Open interest and liquidation data
│   ├── deribit/            # Options and derivatives
│   ├── dexscreener/        # DEX analytics
│   ├── earningsfeed/       # TradFi earnings data
│   ├── knowledge/          # Document search and RAG
│   ├── massive/            # Market data (Polygon.io)
│   ├── news/               # Crypto news aggregation
│   ├── polymarket/         # Prediction markets
│   ├── research/           # Web search and research
│   ├── sentiment/          # Social sentiment analysis
│   ├── solana/             # Solana ecosystem tools
│   ├── telegram/           # Telegram integration
│   ├── trading/            # Exchange connectivity
│   └── ...
├── streaming/              # Real-time data streams
└── strategy/               # Trading strategy framework
```

## Configuration and Data

```
├── knowledge/              # Document storage (auto-indexed for search)
├── data/                   # Runtime data storage
├── logs/                   # Application logs
├── scripts/                # Database and setup scripts
├── test/                   # Test utilities and modules
├── examples/               # Example configurations
│   └── strategies.example.json
└── mcp_config_examples/    # MCP client configuration examples
```

## Archive (Legacy Files)

```
archive/
├── chat-agent/             # Original chat agent implementation
│   ├── agent.ts           # CLI chat interface
│   ├── claude-client.ts   # Claude API integration
│   ├── system-prompt.md   # Chat agent prompts
│   └── start-big-john.sh  # Chat agent startup
├── legacy-backends/        # HTTP API servers
│   ├── backend.ts         # Full REST API
│   ├── server-lite.ts     # Lightweight server
│   ├── server.ts          # Alternative server
│   └── automated-backend.ts # Trading automation
└── legacy-scripts/         # Multi-service startup scripts
    ├── start-all.sh       # Start all services
    └── stop-all.sh        # Stop all services
```

## Key Directories Explained

### `/src/modules/`
Each module is a self-contained MCP tool provider:
- Extends `BaseCryptoModule`
- Implements specific MCP tools
- Manages its own database schema
- Handles API integrations

### `/knowledge/`
Drop files here for automatic indexing:
- Supports: `.txt`, `.md`, `.csv`, `.json`, `.pdf`
- Automatically indexed for semantic search
- Accessible via `knowledge_search_*` tools

### `/test/`
Testing utilities:
- Module-specific tests
- Connection tests
- Integration tests

### `/archive/`
Contains functionality moved out of the core MCP server:
- Chat agent interface (moved to focus on MCP protocol)
- Legacy HTTP backends (replaced by direct MCP communication)
- Multi-service scripts (simplified to single MCP server)

## Development Workflow

1. **Core MCP Server**: `mcp-server-socket.ts`
2. **Module Development**: Add new modules in `src/modules/`
3. **Testing**: Use scripts in `test/` directory
4. **Configuration**: Environment variables in `.env`
5. **Documentation**: Update README.md and SETUP.md

## Migration from Legacy

The repository was cleaned up to focus on MCP server functionality:

- **Removed**: Chat agent CLI, HTTP APIs, multi-service architecture
- **Kept**: Core MCP modules, database layer, tool implementations
- **Archived**: Legacy functionality for reference/restoration if needed

This creates a clean, professional MCP server that's easy to understand, deploy, and maintain.