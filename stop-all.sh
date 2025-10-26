#!/bin/bash

# Comprehensive stop script for MCP Crypto Server
echo "🛑 Stopping MCP Crypto Server and Backend..."
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to kill processes by pattern
kill_processes() {
    local pattern="$1"
    local description="$2"
    
    echo -e "${YELLOW} Looking for $description processes...${NC}"
    
    # Find PIDs
    local pids=$(pgrep -f "$pattern" 2>/dev/null)
    
    if [ -n "$pids" ]; then
        echo -e "${YELLOW} Found $description processes: $pids${NC}"
        
        # Kill processes
        for pid in $pids; do
            echo -e "${YELLOW}🛑 Stopping process $pid...${NC}"
            kill -TERM "$pid" 2>/dev/null
        done
        
        # Wait a bit for graceful shutdown
        sleep 2
        
        # Force kill if still running
        for pid in $pids; do
            if kill -0 "$pid" 2>/dev/null; then
                echo -e "${RED}  Process $pid still running, force killing...${NC}"
                kill -KILL "$pid" 2>/dev/null
            fi
        done
        
        echo -e "${GREEN} Stopped $description processes${NC}"
    else
        echo -e "${GREEN} No $description processes found${NC}"
    fi
}

# Stop different types of processes
echo ""
echo "Step 1: Stopping Backend Server"
echo "==============================="
kill_processes "tsx server.ts" "backend server"

echo ""
echo "Step 2: Stopping MCP Servers"
echo "============================"
kill_processes "tsx mcp-server-socket.ts" "MCP socket server"
kill_processes "tsx mcp-server-full.ts" "MCP full server"

echo ""
echo "Step 3: Stopping npm processes"
echo "=============================="
kill_processes "npm run backend" "npm backend"
kill_processes "npm run mcp" "npm MCP"
kill_processes "npm run mcp-socket" "npm MCP socket"

echo ""
echo "Step 4: Stopping any remaining tsx processes"
echo "============================================"
kill_processes "tsx.*mcp-server" "MCP server tsx"

echo ""
echo "Step 5: Checking for remaining processes"
echo "========================================"
echo -e "${YELLOW} Checking for any remaining crypto-related processes...${NC}"

# Check for any remaining processes
remaining=$(pgrep -f "tsx.*server\|npm.*mcp\|npm.*backend" 2>/dev/null)
if [ -n "$remaining" ]; then
    echo -e "${RED}  Found remaining processes: $remaining${NC}"
    echo -e "${YELLOW}🛑 Force killing remaining processes...${NC}"
    echo "$remaining" | xargs kill -KILL 2>/dev/null
    sleep 1
else
    echo -e "${GREEN} No remaining crypto processes found${NC}"
fi

echo ""
echo -e "${GREEN} All MCP Crypto processes stopped!${NC}"
echo ""
echo " Summary:"
echo "   - Backend server: Stopped"
echo "   - MCP servers: Stopped"
echo "   - npm processes: Stopped"
echo ""
echo " To restart services:"
echo "   - Backend only: npm run backend"
echo "   - MCP server only: npm run mcp-socket"
echo "   - Both services: ./start-all.sh"
echo ""
echo " To check running processes: ps aux | grep -E '(tsx|npm)' | grep -v grep"
