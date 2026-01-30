# OpenCode Kimi Rotator - Automatic Installation Script (PowerShell)
# Usage: irm https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.ps1 | iex
#

$ErrorActionPreference = "Stop"

$PLUGIN_NAME = "opencode-kimi-rotator"
$CONFIG_DIR = Join-Path $env:USERPROFILE ".config\opencode"
$CONFIG_FILE = Join-Path $CONFIG_DIR "opencode.json"

function Print-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Print-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Print-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Print-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Check-Node {
    try {
        $nodeVersion = node -v
        $versionNumber = $nodeVersion -replace 'v', '' -split '\.' | Select-Object -First 1
        if ([int]$versionNumber -lt 18) {
            Print-Error "Node.js version 18 or higher is required. Found: $nodeVersion"
            exit 1
        }
        Print-Success "Node.js $nodeVersion found"
    } catch {
        Print-Error "Node.js is not installed. Please install Node.js 18 or higher."
        Print-Info "Visit: https://nodejs.org/"
        exit 1
    }
}

function Check-Npm {
    try {
        $npmVersion = npm -v
        Print-Success "npm $npmVersion found"
    } catch {
        Print-Error "npm is not installed. Please install npm."
        exit 1
    }
}

function Install-Plugin {
    Print-Info "Installing ${PLUGIN_NAME} from npm..."
    
    $installed = npm list -g $PLUGIN_NAME 2>$null
    if ($LASTEXITCODE -eq 0) {
        Print-Warning "Plugin already installed. Updating to latest version..."
        npm update -g $PLUGIN_NAME
    } else {
        npm install -g "${PLUGIN_NAME}@latest"
    }
    
    Print-Success "Plugin installed globally"
    
    # Verify CLI is available
    try {
        $null = Get-Command opencode-kimi -ErrorAction Stop
        Print-Success "CLI command 'opencode-kimi' is available"
    } catch {
        Print-Warning "CLI command 'opencode-kimi' not found in PATH"
        Print-Info "You may need to restart your PowerShell session or add npm global bin to your PATH"
    }
}

function Ensure-ConfigDir {
    if (-not (Test-Path $CONFIG_DIR)) {
        Print-Info "Creating config directory: $CONFIG_DIR"
        New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
    }
}

function Backup-Config {
    if (Test-Path $CONFIG_FILE) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupFile = "${CONFIG_FILE}.backup.${timestamp}"
        Print-Info "Backing up existing config to: $backupFile"
        Copy-Item $CONFIG_FILE $backupFile
    }
}

function Update-Config {
    Print-Info "Updating OpenCode configuration..."
    
    $defaultConfig = @'
{
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
}
'@

    if (Test-Path $CONFIG_FILE) {
        Print-Info "Existing config found. Checking configuration..."
        $configContent = Get-Content $CONFIG_FILE -Raw
        
        if ($configContent -match "opencode-kimi-rotator") {
            Print-Success "Plugin already configured in opencode.json"
        } else {
            Print-Warning "Please manually add the plugin to your config:"
            Write-Host '"plugin": ["opencode-kimi-rotator@latest"]'
        }
        
        if ($configContent -match "kimi-for-coding") {
            Print-Success "kimi-for-coding provider already configured"
        } else {
            Print-Warning "Please manually add the Kimi provider configuration."
            Print-Info "See: https://github.com/deyndev/opencode-kimi-rotator#models"
        }
    } else {
        Print-Info "Creating new OpenCode configuration..."
        $defaultConfig | Out-File -FilePath $CONFIG_FILE -Encoding UTF8
        Print-Success "Configuration created at: $CONFIG_FILE"
    }
}

function Print-NextSteps {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host ""
    Write-Host "1. Add your Kimi API key(s):"
    Write-Host "   opencode-kimi add-key sk-kimi-your-key-here \"My Account\"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Verify installation:"
    Write-Host "   opencode-kimi list-keys" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Test with OpenCode:"
    Write-Host "   opencode run \"Hello\" --model=kimi-for-coding/k2p5" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "The plugin will:"
    Write-Host "  • Set ANTHROPIC_BASE_URL to Kimi's API endpoint"
    Write-Host "  • Rotate API keys on each request"
    Write-Host "  • Show toast notifications for key rotation"
    Write-Host ""
    Write-Host "For more information:"
    Write-Host "   https://github.com/deyndev/opencode-kimi-rotator" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if CLI is available
    try {
        $null = Get-Command opencode-kimi -ErrorAction Stop
    } catch {
        Write-Host "NOTE: You may need to restart your PowerShell session for 'opencode-kimi' to be available" -ForegroundColor Yellow
        Write-Host ""
    }
}

function Main {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  OpenCode Kimi Rotator Installer" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Check-Node
    Check-Npm
    Ensure-ConfigDir
    Backup-Config
    Install-Plugin
    Update-Config
    Print-NextSteps
}

Main
