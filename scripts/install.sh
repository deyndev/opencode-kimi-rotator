#!/bin/bash
#
# OpenCode Kimi Rotator - Automatic Installation Script
# Usage: curl -fsSL https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/install.sh | bash
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

# Install the plugin globally
install_plugin() {
    print_info "Installing ${PLUGIN_NAME}..."
    
    if npm list -g "${PLUGIN_NAME}" > /dev/null 2>&1; then
        print_warning "Plugin already installed. Updating..."
        npm update -g "${PLUGIN_NAME}"
    else
        npm install -g "${PLUGIN_NAME}@latest"
    fi
    
    print_success "Plugin installed successfully"
}

# Create config directory if it doesn't exist
ensure_config_dir() {
    if [ ! -d "$CONFIG_DIR" ]; then
        print_info "Creating config directory: ${CONFIG_DIR}"
        mkdir -p "$CONFIG_DIR"
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
    
    # Default configuration
    local default_config='{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-kimi-rotator@latest"],
  "provider": {
    "kimi-for-coding": {
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

    if [ -f "$CONFIG_FILE" ]; then
        # Config exists, try to merge
        print_info "Existing config found. Merging..."
        
        # Check if plugin is already in config
        if grep -q "opencode-kimi-rotator" "$CONFIG_FILE"; then
            print_warning "Plugin already in config. Skipping plugin addition."
        else
            # Add plugin to existing config
            # This is a simple approach - for complex configs, manual editing may be needed
            print_info "Please manually add the plugin to your config:"
            echo '"plugin": ["opencode-kimi-rotator@latest"]'
        fi
        
        # Check if provider config exists
        if ! grep -q "kimi-for-coding" "$CONFIG_FILE"; then
            print_info "Please manually add the Kimi provider configuration."
            echo "See: https://github.com/deyndev/opencode-kimi-rotator#models"
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
    echo -e "   ${BLUE}opencode kimi add-key sk-kimi-your-key-here \"My Account\"${NC}"
    echo ""
    echo "2. Verify installation:"
    echo -e "   ${BLUE}opencode kimi list-keys${NC}"
    echo ""
    echo "3. Test with OpenCode:"
    echo -e "   ${BLUE}opencode run \"Hello\" --model=kimi-for-coding/k2p5${NC}"
    echo ""
    echo "For more information:"
    echo -e "   ${BLUE}https://github.com/deyndev/opencode-kimi-rotator${NC}"
    echo ""
}

# Main installation flow
main() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  OpenCode Kimi Rotator Installer${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    
    check_node
    check_npm
    ensure_config_dir
    backup_config
    install_plugin
    update_config
    print_next_steps
}

# Run main function
main "$@"
