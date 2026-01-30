# Kimi API Key Rotator for OpenCode

[![npm version](https://img.shields.io/npm/v/opencode-kimi-rotator.svg)](https://www.npmjs.com/package/opencode-kimi-rotator)
[![npm downloads](https://img.shields.io/npm/dm/opencode-kimi-rotator.svg)](https://www.npmjs.com/package/opencode-kimi-rotator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Automatically rotate between multiple Kimi API keys to handle rate limits and distribute load across accounts.

## What You Get

- **Multiple API Key Support** — Store and manage unlimited Kimi API keys
- **Auto-Rotation** — Automatically switch keys when rate limited
- **Health-Based Selection** — Smart rotation using health scores and LRU
- **Three Rotation Strategies**:
  - `round-robin` — Cycle through keys sequentially
  - `health-based` — Use health scores + freshness (default)
  - `sticky` — Stay on one key until rate limited
- **CLI Management** — Easy commands to add, list, and manage keys
- **Plugin compatible** — Works alongside other OpenCode plugins (oh-my-opencode, antigravity-auth, etc.)

---

## Installation

<details open>
<summary><b>For Humans</b></summary>

**Option A: Automatic (Recommended)**

```bash
curl -fsSL https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.sh | bash
```

Or for Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.ps1 | iex
```

**Option B: Manual setup**

1. **Clone and build the plugin**:

   ```bash
   git clone https://github.com/deyndev/opencode-kimi-rotator.git
   cd opencode-kimi-rotator
   npm install
   npm run build
   npm run install:plugin
   ```

2. **Add the model to your `~/.config/opencode/opencode.json`**:

   ```json
   {
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
   ```

3. **Add your API keys**:

   ```bash
   opencode-kimi add-key sk-kimi-your-key-here "My Account 1"
   opencode-kimi add-key sk-kimi-another-key "My Account 2"
   ```

4. **Use it:**

   ```bash
   opencode run "Hello" --model=anthropic/kimi-for-coding
   ```

</details>

<details>
<summary><b>For LLM Agents</b></summary>

### Complete Installation Steps

**1. Clone and build the plugin:**

```bash
git clone https://github.com/deyndev/opencode-kimi-rotator.git
cd opencode-kimi-rotator
npm install
npm run install:plugin
```

**2. Add the plugin and model to `~/.config/opencode/opencode.json`:**

Add the plugin to your existing config. The plugin path must use the full absolute path:

```json
{
  "plugin": [
    "file:///Users/YOUR_USERNAME/.config/opencode/plugins/kimi-rotator.js"
  ],
  "provider": {
    "anthropic": {
      "name": "Anthropic",
      "models": {
        "kimi-for-coding": {
          "name": "Kimi K2.5 (via Kimi API)",
          "limit": { "context": 262144, "output": 32768 }
        }
      }
    }
  }
}
```

> **Important**: Replace `YOUR_USERNAME` with your actual username. Example paths:
> - macOS: `file:///Users/john/.config/opencode/plugins/kimi-rotator.js`
> - Linux: `file:///home/john/.config/opencode/plugins/kimi-rotator.js`

**3. Configure oh-my-opencode agents in `~/.config/opencode/oh-my-opencode.json`:**

You must configure **ALL agents** you want to use with Kimi:

```json
{
  "google_auth": false,
  "ralph_loop": {
    "enabled": true,
    "default_max_iterations": 100
  },
  "agents": {
    "sisyphus": { "model": "anthropic/kimi-for-coding" },
    "prometheus": { "model": "anthropic/kimi-for-coding" },
    "oracle": { "model": "anthropic/kimi-for-coding" },
    "librarian": { "model": "anthropic/kimi-for-coding" },
    "explore": { "model": "anthropic/kimi-for-coding" },
    "frontend-ui-ux-engineer": { "model": "anthropic/kimi-for-coding" },
    "document-writer": { "model": "anthropic/kimi-for-coding" },
    "multimodal-looker": { "model": "anthropic/kimi-for-coding" },
    "atlas": { "model": "anthropic/kimi-for-coding" }
  }
}
```

> **Note**: If you get "model is not valid" errors, make sure the agent is configured in oh-my-opencode.json.

**4. Add your Kimi API keys:**

```bash
opencode-kimi add-key sk-kimi-your-key-here "My Account"
```

**5. Verify installation:**

```bash
opencode-kimi list-keys
```

### What the plugin does automatically:
- Sets `ANTHROPIC_BASE_URL` to Kimi's API endpoint
- Intercepts fetch requests to `api.kimi.com`
- Rotates API keys based on health scores
- Shows toast notifications for key rotation

</details>


---

## Models

### Available Model

The Kimi Coding API provides a single flagship model:

| Model ID | Name | Context | Output |
|----------|------|---------|--------|
| `kimi-for-coding` | Kimi K2.5 | 262,144 | 32,768 |

Use it as: `anthropic/kimi-for-coding`


<details>
<summary><b>Full configuration (copy-paste ready)</b></summary>

Add this to your `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///Users/YOUR_USERNAME/.config/opencode/plugins/kimi-rotator.js"
  ],
  "provider": {
    "anthropic": {
      "name": "Anthropic",
      "models": {
        "kimi-for-coding": {
          "name": "Kimi K2.5 (via Kimi API)",
          "limit": {
            "context": 262144,
            "output": 32768
          },
          "modalities": {
            "input": ["text", "image", "video"],
            "output": ["text"]
          }
        }
      }
    }
  }
}
```

</details>

---

## Usage

### Add API Keys

```bash
# Add a key with optional name
opencode-kimi add-key sk-kimi-your-key-here "My Account 1"
opencode-kimi add-key sk-kimi-another-key "My Account 2"
```

### List All Keys

```bash
opencode-kimi list-keys
```

Output:
```
Kimi API Keys (2 total, strategy: health-based):

● [0] My Account 1
   Key: sk-kim...yDigS
   Health: ██████████ 100%
   Requests: 45/50 successful
   Status: ✓ Active

○ [1] My Account 2
   Key: sk-kim...xxxxx
   Health: ████████░░ 80%
   Requests: 20/25 successful
   Status: ✓ Active
```

### Remove a Key

```bash
opencode-kimi remove-key 1
```

### Manually Rotate

```bash
opencode-kimi rotate
```

### Change Rotation Strategy

```bash
# Round-robin: cycle through keys sequentially
opencode-kimi set-strategy round-robin

# Health-based: smart selection based on health scores (default)
opencode-kimi set-strategy health-based

# Sticky: stay on one key until rate limited
opencode-kimi set-strategy sticky
```

---

## How It Works

### Health Score System

Each API key has a health score (0-100):
- **Initial**: 100
- **Success**: +2 points
- **Rate Limited**: -15 points
- **Failure**: -20 points

Keys with health score < 30 are temporarily skipped.

### Rate Limit Handling

When a key is rate limited:
1. Health score decreases
2. Key is marked as rate limited with reset time
3. Next request automatically uses next available key
4. Once reset time passes, key becomes available again

### Data Storage

Keys are stored in `~/.config/opencode/kimi-accounts.json`:
```json
{
  "version": 1,
  "accounts": [
    {
      "key": "sk-kimi-xxx",
      "name": "My Account",
      "addedAt": 1234567890,
      "lastUsed": 1234567890,
      "rateLimitResetTime": 0,
      "healthScore": 100,
      "consecutiveFailures": 0,
      "totalRequests": 50,
      "successfulRequests": 45
    }
  ],
  "activeIndex": 0,
  "rotationStrategy": "health-based"
}
```

---

## Configuration

### Configuration Path (All Platforms)

OpenCode uses `~/.config/opencode/` on **all platforms** including Windows.

| File | Path |
|------|------|
| Main config | `~/.config/opencode/opencode.json` |
| Accounts | `~/.config/opencode/kimi-accounts.json` |

> **Windows users**: `~` resolves to your user home directory (e.g., `C:\Users\YourName`). Do NOT use `%APPDATA%`.

### In Oh My OpenCode

To use Kimi models with Oh My OpenCode agents, update `~/.config/opencode/oh-my-opencode.json`:

```json
{
  "google_auth": false,
  "ralph_loop": {
    "enabled": true,
    "default_max_iterations": 100
  },
  "agents": {
    "sisyphus": { "model": "anthropic/kimi-for-coding" },
    "prometheus": { "model": "anthropic/kimi-for-coding" },
    "oracle": { "model": "anthropic/kimi-for-coding" },
    "librarian": { "model": "anthropic/kimi-for-coding" },
    "explore": { "model": "anthropic/kimi-for-coding" },
    "frontend-ui-ux-engineer": { "model": "anthropic/kimi-for-coding" },
    "document-writer": { "model": "anthropic/kimi-for-coding" },
    "multimodal-looker": { "model": "anthropic/kimi-for-coding" },
    "atlas": { "model": "anthropic/kimi-for-coding" }
  }
}
```

---

## Troubleshooting

### "No Kimi API keys configured"

Run:
```bash
opencode-kimi add-key your-api-key
```

### All keys rate limited

The plugin will wait for the soonest available key. You can:
1. Wait for rate limits to reset
2. Add more API keys
3. Check status with `opencode-kimi list-keys`

### Plugin not loading

1. Ensure plugin is installed: Check `~/.config/opencode/opencode.json` has `"plugin": ["opencode-kimi-rotator@latest"]`
2. Verify the plugin package is installed: `npm list -g opencode-kimi-rotator`
3. Check OpenCode logs for errors

### Reset Everything

If you need to start fresh:
```bash
rm ~/.config/opencode/kimi-accounts.json
opencode-kimi add-key your-new-api-key
```

---

## Plugin Compatibility

### opencode-antigravity-auth

Both plugins can work together. List them in your preferred order:

```json
{
  "plugin": [
    "opencode-kimi-rotator@latest",
    "opencode-antigravity-auth@latest"
  ]
}
```

### oh-my-opencode

Configure agent models in `oh-my-opencode.json`:

```json
{
  "google_auth": false,
  "agents": {
    "sisyphus": { "model": "anthropic/kimi-for-coding" },
    "oracle": { "model": "anthropic/kimi-for-coding" },
    "librarian": { "model": "anthropic/kimi-for-coding" },
    "atlas": { "model": "anthropic/kimi-for-coding" }
  }
}
```

---

## Automatic Installation Script

For automated setup, you can use this one-liner:

```bash
curl -fsSL https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.sh | bash
```

Or for Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.ps1 | iex
```

---

## Development

### Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/deyndev/opencode-kimi-rotator.git
cd opencode-kimi-rotator
```

2. Install dependencies and build:
```bash
npm install
npm run build
```

3. Link for local testing:
```bash
npm link
```

4. Add to your OpenCode config:
```json
{
  "plugin": ["opencode-kimi-rotator"]
}
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
