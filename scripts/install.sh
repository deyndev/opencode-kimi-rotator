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
REPO_URL="https://github.com/deyndev/opencode-kimi-rotator.git"
CONFIG_DIR="${HOME}/.config/opencode"
PLUGINS_DIR="${CONFIG_DIR}/plugins"
CONFIG_FILE="${CONFIG_DIR}/opencode.json"
TEMP_DIR=$(mktemp -d)

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

# Cleanup on exit
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

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
    mkdir -p "$PLUGINS_DIR"
    print_success "Config directories ready"
}

# Clone, build, and install plugin
install_plugin() {
    print_info "Downloading and building kimi-rotator plugin..."
    
    cd "$TEMP_DIR"
    git clone --depth 1 "$REPO_URL" kimi-rotator > /dev/null 2>&1
    cd kimi-rotator
    
    npm install > /dev/null 2>&1
    npm run build > /dev/null 2>&1
    
    # Copy compiled plugin to plugins directory
    cp dist/plugin.js "$PLUGINS_DIR/kimi-rotator.js"
    
    print_success "Plugin installed to ${PLUGINS_DIR}/kimi-rotator.js"
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
    
    # Check if config file exists and has content
    if [ -f "$CONFIG_FILE" ] && [ -s "$CONFIG_FILE" ]; then
        # Config exists - check if anthropic provider with kimi-for-coding exists
        if grep -q '"kimi-for-coding"' "$CONFIG_FILE"; then
            print_success "kimi-for-coding model already configured"
        else
            print_warning "Please manually add the kimi-for-coding model to your anthropic provider:"
            echo ""
            cat << 'EOF'
Add this to your opencode.json under "provider" -> "anthropic" -> "models":

    "kimi-for-coding": {
      "name": "Kimi K2.5 (via Kimi API)",
      "limit": {
        "context": 262144,
        "output": 32768
      }
    }
EOF
            echo ""
        fi
    else
        # Create new config with minimal setup
        print_info "Creating new OpenCode configuration..."
        cat > "$CONFIG_FILE" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "anthropic": {
      "name": "Anthropic",
      "models": {
        "kimi-for-coding": {
          "name": "Kimi K2.5 (via Kimi API)",
          "limit": {
            "context": 262144,
            "output": 32768
          }
        }
      }
    }
  }
}
EOF
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
    echo -e "   ${BLUE}opencode run \"Hello\" --model=anthropic/kimi-for-coding${NC}"
    echo ""
    echo "The plugin will:"
    echo "  • Set ANTHROPIC_BASE_URL to Kimi's API endpoint"
    echo "  • Rotate API keys on each request"
    echo "  • Show toast notifications for key rotation"
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
    ensure_dirs
    backup_config
    install_plugin
    update_config
    print_next_steps
}

# Run main function
main "$@"
