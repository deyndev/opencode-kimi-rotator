#!/bin/bash
#
# OpenCode Kimi Rotator - Automatic Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.sh | bash
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PLUGIN_NAME="opencode-kimi-rotator"
CONFIG_DIR="${HOME}/.config/opencode"
CONFIG_FILE="${CONFIG_DIR}/opencode.json"

# Helper functions
print_info() {
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

# Check if Node.js is installed
check_node() {
    if ! command -v node > /dev/null 2>&1; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        print_info "Visit: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Found: $(node -v)"
        exit 1
    fi
    
    print_success "Node.js $(node -v) found"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm > /dev/null 2>&1; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    print_success "npm $(npm -v) found"
}

# Create config directories
ensure_dirs() {
    mkdir -p "$CONFIG_DIR"
    print_success "Config directories ready"
}

# Install plugin from npm
install_plugin() {
    print_info "Installing ${PLUGIN_NAME} from npm..."
    
    # Check if already installed
    if npm list -g "$PLUGIN_NAME" > /dev/null 2>&1; then
        print_warning "Plugin already installed. Updating to latest version..."
        npm update -g "$PLUGIN_NAME"
    else
        npm install -g "${PLUGIN_NAME}@latest"
    fi
    
    print_success "Plugin installed globally"
    
    # Verify CLI is available
    if command -v opencode-kimi > /dev/null 2>&1; then
        print_success "CLI command 'opencode-kimi' is available"
    else
        print_warning "CLI command 'opencode-kimi' not found in PATH"
        print_info "You may need to restart your terminal or add npm global bin to your PATH"
        print_info "Run: export PATH=\"\$PATH:\$(npm bin -g)\""
    fi
}

# Backup existing config
backup_config() {
    if [ -f "$CONFIG_FILE" ]; then
        local backup_file="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        print_info "Backing up existing config to: ${backup_file}"
        cp "$CONFIG_FILE" "$backup_file"
    fi
}

# Update or create OpenCode config
update_config() {
    print_info "Updating OpenCode configuration..."
    
    # Default config with plugin and provider
    local default_config='{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-kimi-rotator@latest"],
  "provider": {
    "kimi-for-coding": {
      "name": "Kimi",
      "api": "openai",
      "models": {
        "k2p5": {
          "name": "Kimi K2.5",
          "limit": {
            "context": 128000,
            "output": 4096
          },
          "modalities": {
            "input": ["text"],
            "output": ["text"]
          }
        },
        "k2p5-long": {
          "name": "Kimi K2.5 Long Context",
          "limit": {
            "context": 256000,
            "output": 8192
          },
          "modalities": {
            "input": ["text"],
            "output": ["text"]
          }
        }
      }
    }
  }
}'

    if [ -f "$CONFIG_FILE" ] && [ -s "$CONFIG_FILE" ]; then
        # Config exists - check if plugin is already configured
        if grep -q "opencode-kimi-rotator" "$CONFIG_FILE"; then
            print_success "Plugin already configured in opencode.json"
        else
            print_warning "Existing config found. Please manually add the plugin:"
            echo ''
            echo '"plugin": ["opencode-kimi-rotator@latest"]'
            echo ''
        fi
        
        # Check if kimi-for-coding provider exists
        if grep -q "kimi-for-coding" "$CONFIG_FILE"; then
            print_success "kimi-for-coding provider already configured"
        else
            print_warning "Please manually add the Kimi provider configuration."
            print_info "See: https://github.com/deyndev/opencode-kimi-rotator#models"
        fi
    else
        # Create new config
        print_info "Creating new OpenCode configuration..."
        echo "$default_config" > "$CONFIG_FILE"
        print_success "Configuration created at: ${CONFIG_FILE}"
    fi
}

# Print next steps
print_next_steps() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Add your Kimi API key(s):"
    echo -e "   ${BLUE}opencode-kimi add-key sk-kimi-your-key-here \"My Account\"${NC}"
    echo ""
    echo "2. Verify installation:"
    echo -e "   ${BLUE}opencode-kimi list-keys${NC}"
    echo ""
    echo "3. Test with OpenCode:"
    echo -e "   ${BLUE}opencode run \"Hello\" --model=kimi-for-coding/k2p5${NC}"
    echo ""
    echo "The plugin will:"
    echo "  • Set ANTHROPIC_BASE_URL to Kimi's API endpoint"
    echo "  • Rotate API keys on each request"
    echo "  • Show toast notifications for key rotation"
    echo ""
    echo "For more information:"
    echo -e "   ${BLUE}https://github.com/deyndev/opencode-kimi-rotator${NC}"
    echo ""
    
    # Warn about PATH if needed
    if ! command -v opencode-kimi > /dev/null 2>&1; then
        echo -e "${YELLOW}NOTE: You may need to restart your terminal for 'opencode-kimi' to be available${NC}"
        echo ""
    fi
}

# Main installation flow
main() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  OpenCode Kimi Rotator Installer${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    check_node
    check_npm
    ensure_dirs
    backup_config
    install_plugin
    update_config
    print_next_steps
}

# Run main function
main "$@"
