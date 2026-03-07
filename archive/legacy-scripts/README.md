# Legacy Scripts

This directory contains startup scripts that were part of the original multi-service architecture but are not needed for the focused MCP server setup.

## Files

- `start-all.sh` - Started multiple services including backend APIs and chat agents
- `stop-all.sh` - Stopped all running services

## Current Setup

The MCP server now uses a simpler startup approach:

```bash
# Start MCP server
npm start

# Or for development
npm run dev
```

The `install.sh` script in the root directory handles all setup requirements.