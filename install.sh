#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}   Downmark Installation Script${NC}"
echo -e "${BLUE}======================================${NC}\n"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check and install Bun
echo -e "${YELLOW}[1/5]${NC} Checking for Bun..."
if command_exists bun; then
    echo -e "${GREEN}✓${NC} Bun is already installed: $(bun --version)"
else
    echo -e "${YELLOW}→${NC} Bun not found. Installing Bun..."
    if command_exists curl; then
        curl -fsSL https://bun.sh/install | bash
        # Source the shell config to make bun available
        if [ -f "$HOME/.bashrc" ]; then
            export PATH="$HOME/.bun/bin:$PATH"
        elif [ -f "$HOME/.zshrc" ]; then
            export PATH="$HOME/.bun/bin:$PATH"
        fi
        echo -e "${GREEN}✓${NC} Bun installed successfully"
    else
        echo -e "${RED}✗${NC} curl is not installed. Please install curl first or install Bun manually from https://bun.sh"
        exit 1
    fi
fi

# Step 2: Check and install Pandoc (optional but recommended)
echo -e "\n${YELLOW}[2/5]${NC} Checking for Pandoc (optional)..."
if command_exists pandoc; then
    echo -e "${GREEN}✓${NC} Pandoc is already installed: $(pandoc --version | head -n 1)"
else
    echo -e "${YELLOW}→${NC} Pandoc not found."

    if command_exists brew; then
        echo -e "${YELLOW}→${NC} Installing Pandoc via Homebrew..."
        brew install pandoc
        echo -e "${GREEN}✓${NC} Pandoc installed successfully"
    elif command_exists apt-get; then
        echo -e "${YELLOW}→${NC} Installing Pandoc via apt..."
        sudo apt-get update && sudo apt-get install -y pandoc
        echo -e "${GREEN}✓${NC} Pandoc installed successfully"
    elif command_exists yum; then
        echo -e "${YELLOW}→${NC} Installing Pandoc via yum..."
        sudo yum install -y pandoc
        echo -e "${GREEN}✓${NC} Pandoc installed successfully"
    else
        echo -e "${YELLOW}!${NC} Could not install Pandoc automatically. Please install it manually from https://pandoc.org"
        echo -e "${YELLOW}!${NC} Continuing without Pandoc (some features may not work)..."
    fi
fi

# Step 3: Install dependencies
echo -e "\n${YELLOW}[3/5]${NC} Installing project dependencies..."
bun install
echo -e "${GREEN}✓${NC} Dependencies installed successfully"

# Step 4: Setup environment file
echo -e "\n${YELLOW}[4/5]${NC} Setting up environment configuration..."
if [ -f ".env" ]; then
    echo -e "${YELLOW}!${NC} .env file already exists. Skipping..."
else
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env file from .env.example"
        echo -e "${BLUE}→${NC} You can edit .env to customize your configuration"
    else
        echo -e "${YELLOW}!${NC} .env.example not found. Please create .env manually"
    fi
fi

# Step 5: Build binary (optional)
echo -e "\n${YELLOW}[5/5]${NC} Building standalone binary..."
read -p "Do you want to build the standalone binary? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}→${NC} Building binary (this may take a moment)..."
    bun run build
    echo -e "${GREEN}✓${NC} Binary built successfully: ./downmark"
else
    echo -e "${YELLOW}!${NC} Skipping binary build. You can build it later with: bun run build"
fi

# Installation complete
echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}   Installation Complete!${NC}"
echo -e "${GREEN}======================================${NC}\n"

echo -e "${BLUE}Quick Start:${NC}"
echo -e "  ${YELLOW}CLI Usage:${NC}       bun run index.ts https://example.com"
echo -e "  ${YELLOW}Web Server:${NC}     bun run dev    (development)"
echo -e "  ${YELLOW}               bun start  (production)"
echo -e "  ${YELLOW}With Binary:${NC}    ./downmark https://example.com"
echo -e ""
echo -e "${BLUE}Configuration:${NC}   Edit .env to customize settings"
echo -e "${BLUE}Documentation:${NC}   See README.md for more details"
echo -e ""
echo -e "${GREEN}Happy converting!${NC}\n"
