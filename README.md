# Kimi API Key Rotator for OpenCode

[![npm version](https://img.shields.io/npm/v/opencode-kimi-rotator.svg)](https://www.npmjs.com/package/opencode-kimi-rotator)
[![npm downloads](https://img.shields.io/npm/dm/opencode-kimi-rotator.svg)](https://www.npmjs.com/package/opencode-kimi-rotator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Automatically rotate between multiple Kimi API keys to handle rate limits and distribute load across accounts.

## What You Get

- **Multiple API Key Support** — Store and manage unlimited Kimi API keys
- **Auto-Rotation** — Automatically switch keys when rate limited
- **Billing Limit Cooldown** — 24-hour automatic cooldown when billing cycle limits are reached
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

**Option A: NPM (One-line installation)**

```bash
npm install -g opencode-kimi-rotator
```

That's it! The plugin is automatically built and installed. Now add your API keys:

```bash
opencode-kimi add-key sk-kimi-your-key-here "My Account"
```

**Option B: Automatic Install Script**

```bash
curl -fsSL https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.sh | bash
```

Or for Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/deyndev/opencode-kimi-rotator/main/scripts/install.ps1 | iex
```

**Option C: Manual setup**

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
             "attachment": true,
             "limit": {
               "context": 262144,
               "output": 32768
             },
             "modalities": {
               "input": ["text", "image", "video", "pdf"],
               "output": ["text"]
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
  "plugin": ["file:///Users/YOUR_USERNAME/.config/opencode/plugins/kimi-rotator.js"],
  "provider": {
    "anthropic": {
      "name": "Anthropic",
      "models": {
        "kimi-for-coding": {
          "name": "Kimi K2.5 (via Kimi API)",
          "attachment": true,
          "limit": {
            "context": 262144,
            "output": 32768
          },
          "modalities": {
            "input": ["text", "image", "video", "pdf"],
            "output": ["text"]
          }
        }
      }
    }
  }
}
```

> **Important**: Replace `YOUR_USERNAME` with your actual username. Example paths:
>
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

| Model ID          | Name      | Context | Output |
| ----------------- | --------- | ------- | ------ |
| `kimi-for-coding` | Kimi K2.5 | 262,144 | 32,768 |

Use it as: `anthropic/kimi-for-coding`

<details>
<summary><b>Full configuration (copy-paste ready)</b></summary>

Add this to your `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///Users/YOUR_USERNAME/.config/opencode/plugins/kimi-rotator.js"],
  "provider": {
    "anthropic": {
      "name": "Anthropic",
      "models": {
        "kimi-for-coding": {
          "name": "Kimi K2.5 (via Kimi API)",
          "attachment": true,
          "limit": {
            "context": 262144,
            "output": 32768
          },
          "modalities": {
            "input": ["text", "image", "video", "pdf"],
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

### View Usage Statistics

```bash
opencode-kimi stats
```

Output:

```
📊 Usage Statistics

[0] My Account 1
   Total Requests: 1425
   Successful: 1227
   Failed: 198
   Success Rate: 86.1%
   Avg Response Time: 245ms
   Requests Today: 12
   Requests Last 7 Days: 89

[1] My Account 2
   Total Requests: 811
   Successful: 793
   Failed: 18
   Success Rate: 97.8%
   Avg Response Time: 198ms
   Requests Today: 5
   Requests Last 7 Days: 42

──────────────────────────────────────────────────
📈 Aggregate Statistics
   Total Requests (All Keys): 2236
   Total Successful: 2020
   Overall Success Rate: 90.3%
   Overall Avg Response Time: 221ms
```

### Health Auto-Refresh

Automatically restore health scores for rate-limited keys after a cooldown period.

```bash
# Check current auto-refresh settings
opencode-kimi list-keys

# Enable/disable auto-refresh (default: enabled)
opencode-kimi set-auto-refresh true
opencode-kimi set-auto-refresh false

# Set cooldown period in minutes (default: 30, range: 1-1440)
opencode-kimi set-cooldown 30
opencode-kimi set-cooldown 60   # 1 hour
opencode-kimi set-cooldown 180  # 3 hours

# Manually trigger health refresh
opencode-kimi refresh-health
```

---

## How It Works

### Health Score System

Each API key has a health score (0-100):

- **Initial**: 100
- **Success**: +2 points
- **Rate Limited (HTTP 429)**: -15 points
- **Billing Limit Reached**: -30 points + 24-hour cooldown
- **Failure**: -20 points

Keys with health score < 30 are temporarily skipped.

### Rate Limit Handling

When a key is rate limited (HTTP 429):

1. Health score decreases by 15 points
2. Key is marked as rate limited with reset time from `retry-after` header
3. Next request automatically uses next available key
4. Once reset time passes, key becomes available again

### Billing Cycle Limit Handling

When a key hits the billing cycle usage limit ("You've reached your usage limit for this billing cycle"):

1. Health score decreases by 30 points
2. Key is put on a 24-hour cooldown (until midnight of the next day)
3. Next request automatically uses next available key
4. A toast notification shows how many hours until the key is available
5. The key won't be retried until the cooldown expires

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
      "billingLimitResetTime": 0,
      "healthScore": 100,
      "consecutiveFailures": 0,
      "totalRequests": 50,
      "successfulRequests": 45,
      "responseTimes": [245, 198, 210],
      "dailyRequests": {
        "2026-01-31": 12,
        "2026-02-01": 5
      }
    }
  ],
  "activeIndex": 0,
  "rotationStrategy": "health-based",
  "autoRefreshHealth": true,
  "healthRefreshCooldownMinutes": 30
}
```

### Account Tracking

Each account tracks additional metrics for health-based rotation:

- **responseTimes** — Array of the last 100 response times (in milliseconds)
- **dailyRequests** — Record of request counts by date (YYYY-MM-DD format)

### Health Auto-Refresh Settings

- **autoRefreshHealth** — Whether to automatically refresh health scores after cooldown (default: `true`)
- **healthRefreshCooldownMinutes** — Minutes to wait before health can be refreshed (default: `30`, range: 1-1440)

When enabled, keys that were rate-limited will have their health score gradually restored (+10 points) after the cooldown period passes, making them available for rotation again.

### Export/Import Keys

Backup and migrate your API keys between machines using encrypted files.

```bash
# Export all keys to an encrypted file
opencode-kimi export-keys
opencode-kimi export-keys my-backup.json.enc

# Import keys from an encrypted file
opencode-kimi import-keys my-backup.json.enc
```

**Features:**

- AES-256-GCM encryption with password protection
- Exports all keys, settings, and statistics
- Duplicate keys are skipped during import
- Rotation strategy and auto-refresh settings are preserved

---

## Configuration

### Configuration Path (All Platforms)

OpenCode uses `~/.config/opencode/` on **all platforms** including Windows.

| File        | Path                                    |
| ----------- | --------------------------------------- |
| Main config | `~/.config/opencode/opencode.json`      |
| Accounts    | `~/.config/opencode/kimi-accounts.json` |

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
  "plugin": ["opencode-kimi-rotator@latest", "opencode-antigravity-auth@latest"]
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

## Public API

### `KimiAccountManager`

Main class for managing Kimi API key rotation.

#### Methods

##### `markAccountSuccess(index, responseTime?, date?)`

Marks an account as successfully used and updates health metrics.

```typescript
async markAccountSuccess(
  index: number,
  responseTime?: number,
  date?: string
): Promise<void>
```

- **index** — Account index in the accounts array
- **responseTime** — Optional response time in milliseconds (tracked in rolling window of 100)
- **date** — Optional date string (YYYY-MM-DD) for daily request tracking

##### `setAutoRefreshHealth(enabled)`

Enables or disables automatic health score refresh.

```typescript
async setAutoRefreshHealth(enabled: boolean): Promise<void>
```

##### `setHealthRefreshCooldown(minutes)`

Sets the cooldown period for health refresh.

```typescript
async setHealthRefreshCooldown(minutes: number): Promise<void>
```

- **minutes** — Cooldown duration (1-1440, default: 30)
- **Throws** — Error if minutes is outside valid range

##### `refreshHealthScores()`

Manually triggers health score refresh for eligible accounts.

```typescript
async refreshHealthScores(): Promise<{
  refreshed: number;
  details: string[];
}>
```

Returns the number of accounts refreshed and detailed change log.

### `KimiStorage`

Handles persistent storage of account configuration with file locking.

#### Constructor

```typescript
constructor();
```

Creates a new storage instance. The config directory is automatically set to `~/.config/opencode/`.

#### Methods

##### `init()`

Initializes the storage directory and files.

```typescript
async init(): Promise<void>
```

Creates the config directory if it doesn't exist and initializes an empty accounts file.

##### `loadConfig()`

Loads and validates the accounts configuration.

```typescript
async loadConfig(): Promise<KimiAccountsConfig>
```

- **Returns** — Parsed and validated configuration
- **Throws** — Error if file cannot be read or parsed

##### `saveConfig(config)`

Saves the configuration to disk with file locking.

```typescript
async saveConfig(config: KimiAccountsConfig): Promise<void>
```

- **config** — Configuration object to save
- **Throws** — Error if validation fails or file cannot be written

##### `addAccount(key, name?)`

Adds a new API key account.

```typescript
async addAccount(key: string, name?: string): Promise<KimiAccount>
```

- **key** — The API key to store
- **name** — Optional display name for the account
- **Returns** — The created account object
- **Throws** — Error if the key already exists

##### `removeAccount(index)`

Removes an account by index.

```typescript
async removeAccount(index: number): Promise<void>
```

- **index** — Account index to remove
- **Throws** — Error if index is invalid

##### `listAccounts()`

Returns all stored accounts.

```typescript
async listAccounts(): Promise<KimiAccount[]>
```

##### `getActiveAccount()`

Returns the currently active account.

```typescript
async getActiveAccount(): Promise<KimiAccount | null>
```

- **Returns** — The active account or `null` if no accounts exist

##### `setActiveIndex(index)`

Sets the active account index.

```typescript
async setActiveIndex(index: number): Promise<void>
```

- **index** — Account index to set as active
- **Throws** — Error if index is invalid

##### `getActiveIndex()`

Returns the current active account index.

```typescript
async getActiveIndex(): Promise<number>
```

- **Returns** — The current active index from the configuration

##### `getAndIncrementActiveIndex(availableIndices)`

Atomically gets the current active index and sets the next one for round-robin rotation. This ensures proper serialization of rotation operations.

```typescript
async getAndIncrementActiveIndex(availableIndices: number[]): Promise<number>
```

- **availableIndices** — Array of available account indices to rotate through
- **Returns** — The selected next index (guaranteed to be unique per call)
- **Throws** — Error if no available indices are provided

##### `atomicSetActiveIndex(preferredIndex)`

Atomically sets the active index to a specific value. Use this for sticky and health-based rotation to claim an account.

```typescript
async atomicSetActiveIndex(preferredIndex: number): Promise<number>
```

- **preferredIndex** — The desired index to set
- **Returns** — The actual index that was set (may differ if validation fails)

##### `updateAccount(index, updates)`

Updates specific fields of an account.

```typescript
async updateAccount(index: number, updates: Partial<KimiAccount>): Promise<void>
```

- **index** — Account index to update
- **updates** — Partial account object with fields to update
- **Throws** — Error if index is invalid

### Schemas

#### `KimiAccountSchema`

Zod schema for validating Kimi account objects:

```javascript
{
  key: string,              // API key (required)
  name: string,             // Optional account name
  addedAt: number,          // Timestamp when added
  lastUsed: number,         // Timestamp of last use
  rateLimitResetTime: number,    // Default: 0
  healthScore: number,      // 0-100, default: 100
  consecutiveFailures: number,   // Default: 0
  totalRequests: number,    // Default: 0
  successfulRequests: number,    // Default: 0
  responseTimes: number[],  // Array of response times (ms)
  dailyRequests: Record<string, number>  // Requests per day
}
```

#### `KimiAccountsConfigSchema`

Zod schema for the accounts configuration:

```javascript
{
  version: number,                   // Default: 1
  accounts: KimiAccount[],           // Array of accounts
  activeIndex: number,               // Default: 0
  rotationStrategy: 'round-robin' | 'health-based' | 'sticky',
  autoRefreshHealth: boolean,        // Default: true
  healthRefreshCooldownMinutes: number  // Default: 30, range: 1-1440
}
```

### Types

- `KimiAccount` — Inferred type from `KimiAccountSchema`
- `KimiAccountsConfig` — Inferred type from `KimiAccountsConfigSchema`

### Constants

#### `DEFAULT_ACCOUNT`

Default values for new accounts (excludes `key`, `addedAt`, `lastUsed`):

```javascript
{
  rateLimitResetTime: 0,
  healthScore: 100,
  consecutiveFailures: 0,
  totalRequests: 0,
  successfulRequests: 0,
  responseTimes: [],
  dailyRequests: {}
}
```

#### `DEFAULT_CONFIG`

Default configuration values (excludes `accounts`):

```javascript
{
  version: 1,
  activeIndex: 0,
  rotationStrategy: 'health-based',
  autoRefreshHealth: true,
  healthRefreshCooldownMinutes: 30
}
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

<details>
<summary><b>Legal</b></summary>

### Intended Use

- Personal / internal development only
- Respect internal quotas and data handling policies
- Not for production services or bypassing intended limits

### Warning

By using this plugin, you acknowledge:

- **Terms of Service risk** — This approach may violate ToS of AI model providers
- **Account risk** — Providers may suspend or ban accounts
- **No guarantees** — APIs may change without notice
- **Assumption of risk** — You assume all legal, financial, and technical risks

### Disclaimer

- Not affiliated with Moonshot AI. This is an independent open-source project.
- "Kimi", "Moonshot", and "Moonshot AI" are trademarks of Moonshot AI.

</details>

---

## Contributors

Thanks to all the people who already contributed!

<a href="https://github.com/deyndev/opencode-kimi-rotator/graphs/contributors">
  <img src="https://contributors-img.web.app/image?repo=deyndev/opencode-kimi-rotator&max=750&columns=20" />
</a>
