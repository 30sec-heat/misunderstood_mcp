# Legacy Backend Files

This directory contains backend server implementations that were part of the original multi-service architecture but are not needed for the focused MCP server setup.

## Files

- `backend.ts` - Full HTTP API backend with REST endpoints
- `server-lite.ts` - Lightweight HTTP server
- `server.ts` - Alternative server implementation  
- `automated-backend.ts` - Automated trading backend

## Current Architecture

The MCP server now uses a streamlined approach with:

- `mcp-server-socket.ts` - Main MCP server (stdio/socket transport)
- Direct MCP protocol communication
- No HTTP middleware layer needed

## Migration Notes

If you need HTTP API access, these files can be restored and run alongside the MCP server. The MCP server focuses on protocol-native communication while these backends provided REST API compatibility.