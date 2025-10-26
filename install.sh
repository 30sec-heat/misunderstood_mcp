#!/bin/bash

# MCP Crypto Server Enhanced Installation Script
# This script provides a comprehensive setup with security best practices

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration variables
POSTGRES_HOST="localhost"
POSTGRES_PORT="5432"
POSTGRES_DATABASE="crypto_data"
POSTGRES_USER=""
POSTGRES_PASSWORD=""
TELEGRAM_SETUP="false"
SKIP_TELEGRAM="false"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔧 $1${NC}"
}

log_security() {
    echo -e "${CYAN}🔒 $1${NC}"
}

# Security warning
show_security_warning() {
    echo
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                        🔒 SECURITY NOTICE                      ║${NC}"
    echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${CYAN}║ This installation will:                                        ║${NC}"
    echo -e "${CYAN}║ • Create database credentials and store them securely          ║${NC}"
    echo -e "${CYAN}║ • Set up Telegram authentication (optional)                   ║${NC}"
    echo -e "${CYAN}║ • Generate secure environment configuration                    ║${NC}"
    echo -e "${CYAN}║                                                                ║${NC}"
    echo -e "${CYAN}║ IMPORTANT: Never share your .env file or credentials!         ║${NC}"
    echo -e "${CYAN}║ Keep your Telegram session string private and secure.         ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    read -p "Do you understand and want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Installation cancelled by user"
        exit 1
    fi
}

# Check if running on supported OS
check_os() {
    log_step "Checking operating system..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        log_success "Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        log_success "macOS detected"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
        log_success "Windows (WSL/Cygwin) detected"
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
}

# Check if Node.js is installed
check_node() {
    log_step "Checking Node.js installation..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js found: $NODE_VERSION"
        
        # Check if version is >= 18
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 18 ]; then
            log_error "Node.js version 18 or higher is required. Found: $NODE_VERSION"
            log_info "Please update Node.js from https://nodejs.org/"
            exit 1
        fi
    else
        log_error "Node.js is not installed"
        log_info "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    log_step "Checking npm installation..."
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        log_success "npm found: $NPM_VERSION"
    else
        log_error "npm is not installed"
        log_info "Please install npm and run this script again."
        exit 1
    fi
}

# Check if PostgreSQL is installed and running
check_postgresql() {
    log_step "Checking PostgreSQL installation..."
    
    if command -v psql &> /dev/null; then
        POSTGRES_VERSION=$(psql --version | head -n1)
        log_success "PostgreSQL found: $POSTGRES_VERSION"
        
        # Try to connect to PostgreSQL
        if pg_isready -q; then
            log_success "PostgreSQL is running"
        else
            log_warning "PostgreSQL is installed but not running"
            log_info "Please start PostgreSQL service:"
            if [[ "$OS" == "linux" ]]; then
                log_info "  sudo systemctl start postgresql"
                log_info "  sudo systemctl enable postgresql"
            elif [[ "$OS" == "macos" ]]; then
                log_info "  brew services start postgresql"
            fi
            
            read -p "Would you like to continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        log_error "PostgreSQL is not installed"
        log_info "Please install PostgreSQL:"
        if [[ "$OS" == "linux" ]]; then
            log_info "  sudo apt-get update && sudo apt-get install postgresql postgresql-contrib"
        elif [[ "$OS" == "macos" ]]; then
            log_info "  brew install postgresql"
        fi
        exit 1
    fi
}

# Interactive database configuration
setup_database_config() {
    log_step "Setting up database configuration..."
    echo
    log_info "Please provide your PostgreSQL database configuration:"
    echo
    
    # Database host
    read -p "Database host (default: localhost): " input_host
    POSTGRES_HOST=${input_host:-localhost}
    
    # Database port
    read -p "Database port (default: 5432): " input_port
    POSTGRES_PORT=${input_port:-5432}
    
    # Database name
    read -p "Database name (default: crypto_data): " input_db
    POSTGRES_DATABASE=${input_db:-crypto_data}
    
    # Database user
    while [[ -z "$POSTGRES_USER" ]]; do
        read -p "Database username: " POSTGRES_USER
        if [[ -z "$POSTGRES_USER" ]]; then
            log_warning "Database username is required"
        fi
    done
    
    # Database password (hidden input)
    while [[ -z "$POSTGRES_PASSWORD" ]]; do
        read -s -p "Database password: " POSTGRES_PASSWORD
        echo
        if [[ -z "$POSTGRES_PASSWORD" ]]; then
            log_warning "Database password is required"
        fi
    done
    
    # Confirm password
    read -s -p "Confirm password: " password_confirm
    echo
    
    if [[ "$POSTGRES_PASSWORD" != "$password_confirm" ]]; then
        log_error "Passwords do not match"
        exit 1
    fi
    
    log_success "Database configuration completed"
}

# Test database connection
test_database_connection() {
    log_step "Testing database connection..."
    
    # Create temporary connection test
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c "SELECT version();" &> /dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Database connection successful"
    else
        log_error "Database connection failed"
        log_info "Please check your credentials and ensure PostgreSQL is running"
        exit 1
    fi
}

# Install Node.js dependencies
install_dependencies() {
    log_step "Installing Node.js dependencies..."
    
    if [ -f "package.json" ]; then
        npm install
        log_success "Dependencies installed successfully"
    else
        log_error "package.json not found. Are you in the correct directory?"
        exit 1
    fi
}

# Create secure environment configuration
create_environment_config() {
    log_step "Creating secure environment configuration..."
    
    # Generate secure API key for MCP server
    MCP_API_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)
    
    # Create .env file with secure configuration
    cat > .env << EOF
# MCP Crypto Server Environment Configuration
# Generated on $(date)
# SECURITY WARNING: Keep this file private and secure!

# Server Configuration
NODE_ENV=production
MCP_PORT=3001
ALLOWED_ORIGINS=http://localhost:3000,https://cursor.sh

# Database Configuration
POSTGRES_HOST=$POSTGRES_HOST
POSTGRES_PORT=$POSTGRES_PORT
POSTGRES_DATABASE=$POSTGRES_DATABASE
POSTGRES_USER=$POSTGRES_USER
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# MCP Server Security
MCP_API_KEY=$MCP_API_KEY

# Telegram Configuration (Optional)
# Note: Session is stored in .session file, not environment variables
# API credentials are only needed during initial authentication
TELEGRAM_API_ID=
TELEGRAM_API_HASH=

# API Configuration (Optional - add your own keys)
POLYMARKET_API_BASE_URL=https://gamma-api.polymarket.com
COINDESK_API_KEY=
BINANCE_API_KEY=
BINANCE_SECRET_KEY=
BYBIT_API_KEY=
BYBIT_SECRET_KEY=
COINALYZE_API_KEY=

# Pyth Network Configuration
PYTH_NETWORK_RPC_URL=https://api.mainnet-beta.solana.com
PYTH_NETWORK_CLUSTER=mainnet-beta

# Logging Configuration
LOG_LEVEL=info

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000

# Data Sync Configuration
POLYMARKET_SYNC_INTERVAL=86400000
TELEGRAM_SYNC_INTERVAL=3600000

# Performance Configuration
MAX_CONCURRENT_REQUESTS=10
REQUEST_TIMEOUT=30000

# Security Configuration
API_RATE_LIMIT=100

# Knowledge Base Configuration
KNOWLEDGE_DIR=./knowledge
EOF

    # Set secure permissions on .env file
    chmod 600 .env
    
    log_success "Environment configuration created with secure permissions"
    log_security "Generated secure MCP API key"
}

# Setup database schema
setup_database_schema() {
    log_step "Setting up database and schema..."
    
    # Load environment variables
    export POSTGRES_HOST POSTGRES_PORT POSTGRES_DATABASE POSTGRES_USER POSTGRES_PASSWORD
    
    # Run database setup scripts
    npm run setup-db
    
    log_success "Database setup completed successfully"
}

# Test database functionality
test_database_functionality() {
    log_step "Testing database functionality..."
    
    npm run test-connection
    log_success "Database functionality test passed"
}

# Setup Telegram authentication
setup_telegram_authentication() {
    log_step "Setting up Telegram authentication..."
    
    if [[ "$SKIP_TELEGRAM" == "true" ]]; then
        log_info "Skipping Telegram authentication as requested"
        return
    fi
    
    echo
    log_info "Telegram authentication enables social intelligence features:"
    log_info "• Monitor crypto-related Telegram channels"
    log_info "• Analyze sentiment from social media"
    log_info "• Track trending topics and discussions"
    echo
    log_warning "This is optional but recommended for full functionality"
    echo
    
    read -p "Do you want to set up Telegram authentication? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Starting Telegram authentication process..."
        echo
        log_security "You will need:"
        log_security "• Your phone number"
        log_security "• Access to your Telegram account for verification"
        log_security "• Your 2FA password (if enabled)"
        echo
        log_warning "The authentication will generate API credentials and a session string"
        log_warning "Keep these credentials secure and never share them!"
        echo
        
        read -p "Press Enter to continue or Ctrl+C to skip..."
        
        # Run the Telegram authentication script
        if npx tsx utils/telegram-auth.ts; then
            log_success "Telegram authentication completed successfully"
            log_success "Session saved to .session file in project root"
            log_info "The Telegram module will automatically use this session file"
            TELEGRAM_SETUP="true"
        else
            log_warning "Telegram authentication failed or was cancelled"
            log_info "You can set it up later with: npx tsx utils/telegram-auth.ts"
        fi
    else
        log_info "Skipping Telegram authentication"
        log_info "You can set it up later with: npx tsx utils/telegram-auth.ts"
    fi
}

# Create knowledge directory
setup_knowledge_base() {
    log_step "Setting up knowledge base directory..."
    
    if [ ! -d "knowledge" ]; then
        mkdir -p knowledge
        log_success "Knowledge directory created"
    else
        log_success "Knowledge directory already exists"
    fi
    
    # Create README for knowledge directory
    cat > knowledge/README.md << 'EOF'
# Knowledge Base Directory

This directory is for your personal research files and documents that will be indexed and made searchable by the MCP Crypto Server.

## Supported File Types

- **Text files**: `.txt`, `.md`
- **Data files**: `.csv`, `.json`
- **Documents**: `.pdf`
- **Web content**: URLs (add as `.txt` files)

## Features

- 🔍 Semantic search across all documents
- 🏷️ Automatic categorization and tagging
- 🔗 Cross-reference detection
- 📈 Content-based recommendations

## Usage

1. Add your research files to this directory
2. The server will automatically index them
3. Use semantic search to find relevant information
4. Query your knowledge base through the MCP interface

## Security

- Keep sensitive documents secure
- Don't add files with personal credentials
- The knowledge base is local to your installation

## Examples

```
knowledge/
├── trading-strategies/
│   ├── defi-yield-farming.md
│   └── options-strategies.pdf
├── market-analysis/
│   ├── btc-analysis-2024.txt
│   └── eth-staking-research.csv
└── news-sources/
    └── trusted-sources.json
```
EOF

    log_info "You can add your research files to the 'knowledge' directory"
    log_info "Supported formats: .txt, .md, .csv, .json, .pdf"
}

# Final setup and testing
final_setup() {
    log_step "Running final setup and validation..."
    
    # Test knowledge base functionality
    if command -v npx &> /dev/null; then
        log_info "Testing knowledge base functionality..."
        npm run test-knowledge 2>/dev/null || log_warning "Knowledge base test skipped (optional)"
    fi
    
    # Create startup scripts if they don't exist
    if [ ! -f "start-all.sh" ]; then
        cat > start-all.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting MCP Crypto Server..."
npm run backend &
npm start &
wait
EOF
        chmod +x start-all.sh
        log_success "Created start-all.sh script"
    fi
    
    if [ ! -f "stop-all.sh" ]; then
        cat > stop-all.sh << 'EOF'
#!/bin/bash
echo "🛑 Stopping MCP Crypto Server..."
pkill -f "tsx.*mcp-server"
pkill -f "tsx.*backend"
echo "✅ All services stopped"
EOF
        chmod +x stop-all.sh
        log_success "Created stop-all.sh script"
    fi
    
    log_success "Installation completed successfully!"
    
    echo
    echo -e "${GREEN}🎉 MCP Crypto Server is now installed and ready to use!${NC}"
    echo
    echo -e "${CYAN}📋 NEXT STEPS:${NC}"
    echo "  1. Review your .env file for any additional API keys you want to add"
    if [[ "$TELEGRAM_SETUP" != "true" ]]; then
        echo "  2. Set up Telegram authentication: npx tsx utils/telegram-auth.ts"
        echo "  3. Add your research files to the 'knowledge' directory"
        echo "  4. Start the server: ./start-all.sh or npm start"
    else
        echo "  2. Add your research files to the 'knowledge' directory"
        echo "  3. Start the server: ./start-all.sh or npm start"
    fi
    echo
    echo -e "${CYAN}🚀 AVAILABLE COMMANDS:${NC}"
    echo "  npm start          - Start MCP server only"
    echo "  npm run backend    - Start backend server only"
    echo "  ./start-all.sh     - Start all services"
    echo "  ./stop-all.sh      - Stop all services"
    echo "  npm run test-connection - Test database connection"
    echo
    echo -e "${CYAN}🔒 SECURITY REMINDERS:${NC}"
    echo "  • Keep your .env file secure and never commit it to version control"
    echo "  • Your database credentials are stored locally"
    if [[ "$TELEGRAM_SETUP" == "true" ]]; then
        echo "  • Your Telegram session is stored in .session file - keep it secure"
    fi
    echo "  • Generated MCP API key: ${MCP_API_KEY:0:8}..."
    echo
    echo -e "${CYAN}📚 For more information, see the README.md file${NC}"
    echo
}

# Handle script interruption
trap 'log_error "Installation interrupted by user"; exit 1' INT TERM

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-telegram)
            SKIP_TELEGRAM="true"
            shift
            ;;
        --help|-h)
            echo "MCP Crypto Server Installation Script"
            echo
            echo "Usage: $0 [options]"
            echo
            echo "Options:"
            echo "  --skip-telegram    Skip Telegram authentication setup"
            echo "  --help, -h         Show this help message"
            echo
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main installation process
main() {
    echo -e "${PURPLE}🚀 MCP Crypto Server Enhanced Installation${NC}"
    echo -e "${PURPLE}===========================================${NC}"
    echo
    
    # Show security warning
    show_security_warning
    
    # Check system requirements
    check_os
    check_node
    check_npm
    check_postgresql
    
    echo
    log_info "All system requirements met. Starting installation..."
    echo
    
    # Interactive setup
    setup_database_config
    test_database_connection
    
    # Install and setup
    install_dependencies
    create_environment_config
    setup_database_schema
    test_database_functionality
    setup_knowledge_base
    setup_telegram_authentication
    final_setup
}

# Run main installation
main