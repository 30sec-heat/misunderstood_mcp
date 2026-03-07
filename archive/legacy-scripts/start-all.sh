#!/bin/bash

# Comprehensive startup script for MCP Crypto Server
echo " Starting MCP Crypto Server and Backend..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED} Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}  Warning: .env file not found. Creating from env.example...${NC}"
    if [ -f "env.example" ]; then
        cp env.example .env
        echo -e "${GREEN} Created .env file. Please configure it with your API keys.${NC}"
    else
        echo -e "${RED} Error: env.example not found. Cannot create .env file.${NC}"
        exit 1
    fi
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW} Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED} Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Function to check if a process is running
check_process() {
    if pgrep -f "$1" > /dev/null; then
        return 0
    else
        return 1
    fi
}

# Function to start backend
start_backend() {
    echo -e "${YELLOW} Starting backend server...${NC}"
    
    # Check if backend is already running
    if check_process "tsx server.ts"; then
        echo -e "${GREEN} Backend server is already running${NC}"
    else
        # Create logs directory if it doesn't exist
        mkdir -p logs
        
        # Start backend in background with logging
        nohup npm run backend > logs/backend.log 2>&1 &
        BACKEND_PID=$!
        echo "Backend PID: $BACKEND_PID"
        
        # Wait for backend to start
        echo "⏳ Waiting for backend to initialize..."
        sleep 5
        
        # Check if backend started successfully
        if check_process "tsx server.ts"; then
            echo -e "${GREEN} Backend server started successfully${NC}"
            echo " Backend logs: tail -f logs/backend.log"
        else
            echo -e "${RED} Failed to start backend server${NC}"
            echo "Check logs/backend.log for errors"
            exit 1
        fi
    fi
}

# Function to test MCP server
test_mcp_server() {
    echo -e "${YELLOW} Testing MCP server...${NC}"
    
    # Create a test script to verify MCP tools
    cat > test-mcp-tools.js << 'EOF'
#!/usr/bin/env node
import { spawn } from 'child_process';

console.log(' Testing MCP Server Tools...\n');

const mcp = spawn('npm', ['run', 'mcp-socket'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true
});

let toolCount = 0;
let toolNames = [];
let timeout;

// Set timeout
timeout = setTimeout(() => {
  console.error(' Timeout waiting for server response');
  mcp.kill();
  process.exit(1);
}, 30000);

// Monitor output
mcp.stdout.on('data', (data) => {
  const output = data.toString();
  
  // Look for tool count
  const toolMatch = output.match(/Total tools available: (\d+)/);
  if (toolMatch) {
    toolCount = parseInt(toolMatch[1]);
  }
  
  // Look for sample tools
  const sampleMatch = output.match(/Sample tools: (.+)\.\.\.$/m);
  if (sampleMatch) {
    toolNames = sampleMatch[1].split(', ');
  }
  
  // Look for ready message
  if (output.includes('Waiting for MCP requests')) {
    clearTimeout(timeout);
    console.log(` MCP Server is ready!`);
    console.log(` Total tools available: ${toolCount}`);
    if (toolNames.length > 0) {
      console.log(` Sample tools: ${toolNames.join(', ')}...`);
    }
    console.log('\n All systems operational!');
    mcp.kill();
    process.exit(0);
  }
});

mcp.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

mcp.on('error', (err) => {
  clearTimeout(timeout);
  console.error(' Failed to start MCP server:', err);
  process.exit(1);
});
EOF

    # Run the test
    node test-mcp-tools.js
    TEST_RESULT=$?
    
    # Clean up
    rm -f test-mcp-tools.js
    
    return $TEST_RESULT
}

# Main execution
echo ""
echo "Step 1: Starting Backend Server"
echo "==============================="
start_backend

echo ""
echo "Step 2: Testing MCP Server"
echo "=========================="
test_mcp_server

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN} SUCCESS! All systems are operational${NC}"
    echo ""
    echo " Available services:"
    echo "   - Backend API: Running (check logs/backend.log for details)"
    echo "   - MCP Server: Ready (use './start-mcp-server.sh' to test)"
    echo ""
    echo " To use with Cursor:"
    echo "   1. The backend is already running in the background"
    echo "   2. Cursor will automatically start the MCP server when needed"
    echo "   3. Check .cursor/mcp.json for configuration"
    echo ""
    echo " To monitor logs:"
    echo "   - Backend logs: tail -f logs/backend.log"
    echo "   - MCP logs: tail -f logs/mcp-server.log"
    echo "   - All logs are in the 'logs/' directory"
    echo ""
    echo "🛑 To stop the backend: pkill -f 'tsx server.ts'"
else
    echo ""
    echo -e "${RED} System check failed${NC}"
    echo "Please check the logs for errors"
    exit 1
fi
