#!/bin/bash

# MCP Crypto Server - Complete Machine Initialization Script
# This script sets up everything needed to run the MCP crypto server on a fresh machine

set -e  # Exit on any error

echo " MCP Crypto Server - Machine Initialization"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root for security reasons"
   exit 1
fi

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    print_error "Unsupported operating system: $OSTYPE"
    exit 1
fi

print_status "Detected OS: $OS"

# Update system packages
print_status "Updating system packages..."
if [[ "$OS" == "linux" ]]; then
    sudo apt update && sudo apt upgrade -y
elif [[ "$OS" == "macos" ]]; then
    if command -v brew &> /dev/null; then
        brew update && brew upgrade
    else
        print_warning "Homebrew not found. Please install it first: https://brew.sh"
    fi
fi

# Install Node.js (version 18 or higher)
print_status "Installing Node.js..."
if ! command -v node &> /dev/null; then
    if [[ "$OS" == "linux" ]]; then
        # Install Node.js via NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install node
        else
            print_error "Please install Homebrew first, then run this script again"
            exit 1
        fi
    fi
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ "$NODE_VERSION" -lt 18 ]]; then
        print_warning "Node.js version is $NODE_VERSION. Upgrading to version 18+..."
        if [[ "$OS" == "linux" ]]; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif [[ "$OS" == "macos" ]]; then
            brew upgrade node
        fi
    else
        print_success "Node.js $(node --version) is already installed"
    fi
fi

# Install npm dependencies
print_status "Installing npm dependencies..."
npm install

# Install PostgreSQL
print_status "Installing PostgreSQL..."
if [[ "$OS" == "linux" ]]; then
    if ! command -v psql &> /dev/null; then
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    else
        print_success "PostgreSQL is already installed"
    fi
elif [[ "$OS" == "macos" ]]; then
    if ! command -v psql &> /dev/null; then
        if command -v brew &> /dev/null; then
            brew install postgresql
            brew services start postgresql
        else
            print_error "Please install Homebrew first"
            exit 1
        fi
    else
        print_success "PostgreSQL is already installed"
    fi
fi

# Install Docker (optional but recommended)
print_status "Installing Docker..."
if ! command -v docker &> /dev/null; then
    if [[ "$OS" == "linux" ]]; then
        # Install Docker
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        print_warning "Please log out and log back in for Docker group changes to take effect"
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install --cask docker
            print_warning "Please start Docker Desktop from Applications"
        else
            print_warning "Docker installation skipped (Homebrew required)"
        fi
    fi
else
    print_success "Docker is already installed"
fi

# Install Docker Compose
print_status "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    if [[ "$OS" == "linux" ]]; then
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install docker-compose
        else
            print_warning "Docker Compose installation skipped (Homebrew required)"
        fi
    fi
else
    print_success "Docker Compose is already installed"
fi

# Install PM2 for process management (optional)
print_status "Installing PM2 for process management..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    print_success "PM2 installed globally"
else
    print_success "PM2 is already installed"
fi

# Setup environment
print_status "Setting up environment configuration..."
npm run setup-env

# Setup database
print_status "Setting up database..."
npm run setup-db

# Create database schema
print_status "Creating database schema..."
npm run create-schema

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p data
mkdir -p cache

# Set proper permissions
print_status "Setting up permissions..."
chmod +x scripts/*.sh
chmod +x *.sh

# Build the project
print_status "Building the project..."
npm run build

# Test the installation
print_status "Testing the installation..."
if npm run test-connection; then
    print_success "Connection test passed"
else
    print_warning "Connection test failed - this might be expected if services aren't running yet"
fi

echo ""
echo " Machine initialization complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Edit .env file with your specific configuration"
echo "2. Start the MCP server: npm run mcp-remote"
echo "3. Or use Docker: docker-compose up -d"
echo ""
echo "Available commands:"
echo "  npm run mcp-remote     - Start remote MCP server"
echo "  npm run mcp-socket     - Start local MCP server"
echo "  npm run reset-db       - Reset database ([WARNING] deletes all data)"
echo "  npm run create-schema  - Recreate database schema"
echo "  docker-compose up -d   - Start with Docker"
echo ""
echo "For more information, see REMOTE_DEPLOYMENT_GUIDE.md"
