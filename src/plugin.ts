import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import lockfile from 'proper-lockfile';
import type { Plugin } from "@opencode-ai/plugin";

// Types
interface KimiAccount {
  key: string;
  name?: string;
  addedAt: number;
  lastUsed: number;
  rateLimitResetTime: number;
  healthScore: number;
  consecutiveFailures: number;
  totalRequests: number;
  successfulRequests: number;
}

interface KimiAccountsConfig {
  version: number;
  accounts: KimiAccount[];
  activeIndex: number;
  rotationStrategy: 'round-robin' | 'health-based' | 'sticky';
}

// Storage
class KimiStorage {
  private configDir: string;
  private accountsFilePath: string;
  private lockOptions = {
    stale: 5000,
    retries: 3,
  };

  constructor() {
    this.configDir = path.join(os.homedir(), '.config', 'opencode');
    this.accountsFilePath = path.join(this.configDir, 'kimi-accounts.json');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    try {
      await fs.access(this.accountsFilePath);
    } catch {
      await this.saveConfig({
        version: 1,
        accounts: [],
        activeIndex: 0,
        rotationStrategy: 'health-based',
      });
    }
  }

  async loadConfig(): Promise<KimiAccountsConfig> {
    const release = await this.acquireLock();
    try {
      const data = await fs.readFile(this.accountsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed as KimiAccountsConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const config: KimiAccountsConfig = { version: 1, accounts: [], activeIndex: 0, rotationStrategy: 'health-based' };
        await this.saveConfig(config);
        return config;
      }
      throw error;
    } finally {
      await release();
    }
  }

  async saveConfig(config: KimiAccountsConfig): Promise<void> {
    const release = await this.acquireLock();
    try {
      await fs.writeFile(
        this.accountsFilePath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    } finally {
      await release();
    }
  }

  async updateAccount(index: number, updates: Partial<KimiAccount>): Promise<void> {
    const config = await this.loadConfig();
    if (index < 0 || index >= config.accounts.length) {
      throw new Error(`Invalid account index: ${index}`);
    }
    config.accounts[index] = { ...config.accounts[index], ...updates };
    await this.saveConfig(config);
  }

  async setActiveIndex(index: number): Promise<void> {
    const config = await this.loadConfig();
    if (index < 0 || index >= config.accounts.length) {
      throw new Error(`Invalid account index: ${index}`);
    }
    config.activeIndex = index;
    await this.saveConfig(config);
  }

  private async acquireLock(): Promise<() => Promise<void>> {
    try {
      const release = await lockfile.lock(this.accountsFilePath, this.lockOptions);
      return release;
    } catch {
      await fs.mkdir(path.dirname(this.accountsFilePath), { recursive: true });
      await fs.writeFile(
        this.accountsFilePath,
        JSON.stringify({ version: 1, accounts: [], activeIndex: 0, rotationStrategy: 'health-based' })
      );
      const release = await lockfile.lock(this.accountsFilePath, this.lockOptions);
      return release;
    }
  }
}

// Account Manager
class KimiAccountManager {
  private storage: KimiStorage;
  private healthScoreDecay = 0.95;
  private minHealthScore = 30;
  private stickyBonus = 50;

  constructor() {
    this.storage = new KimiStorage();
  }

  async init(): Promise<void> {
    await this.storage.init();
  }

  async getNextAccount(forceRotation = false): Promise<{ account: KimiAccount; index: number; reason: string } | null> {
    const config = await this.storage.loadConfig();

    if (config.accounts.length === 0) {
      return null;
    }

    if (config.accounts.length === 1) {
      const account = config.accounts[0];
      await this.markAccountUsed(0);
      return { account, index: 0, reason: 'single-account' };
    }

    switch (config.rotationStrategy) {
      case 'round-robin':
        return this.roundRobinRotation(config);
      case 'sticky':
        return this.stickyRotation(config, forceRotation);
      case 'health-based':
      default:
        return this.healthBasedRotation(config, forceRotation);
    }
  }

  async markAccountUsed(index: number): Promise<void> {
    const account = await this.getAccount(index);
    await this.storage.updateAccount(index, {
      lastUsed: Date.now(),
      totalRequests: account.totalRequests + 1,
    });
  }

  async markAccountSuccess(index: number): Promise<void> {
    const account = await this.getAccount(index);
    const newHealthScore = Math.min(100, account.healthScore + 2);

    await this.storage.updateAccount(index, {
      healthScore: newHealthScore,
      successfulRequests: account.successfulRequests + 1,
      consecutiveFailures: 0,
    });
  }

  async markAccountRateLimited(index: number, retryAfterMs: number): Promise<void> {
    const account = await this.getAccount(index);
    const newHealthScore = Math.max(0, account.healthScore - 15);

    await this.storage.updateAccount(index, {
      healthScore: newHealthScore,
      rateLimitResetTime: Date.now() + retryAfterMs,
      consecutiveFailures: account.consecutiveFailures + 1,
    });
  }

  async markAccountFailure(index: number): Promise<void> {
    const account = await this.getAccount(index);
    const newHealthScore = Math.max(0, account.healthScore - 20);

    await this.storage.updateAccount(index, {
      healthScore: newHealthScore,
      consecutiveFailures: account.consecutiveFailures + 1,
    });
  }

  async getActiveKey(): Promise<string | null> {
    const account = await this.getNextAccount();
    return account?.account.key ?? null;
  }

  async listKeys(): Promise<KimiAccount[]> {
    const config = await this.storage.loadConfig();
    return config.accounts;
  }

  private async roundRobinRotation(config: KimiAccountsConfig): Promise<{ account: KimiAccount; index: number; reason: string }> {
    const availableIndices = this.getAvailableIndices(config);

    if (availableIndices.length === 0) {
      const soonestIndex = this.getSoonestAvailableIndex(config);
      const account = config.accounts[soonestIndex];
      return { account, index: soonestIndex, reason: 'all-rate-limited' };
    }

    const currentIndex = config.activeIndex;
    let nextIndex = availableIndices.find(idx => idx > currentIndex) ?? availableIndices[0];

    await this.storage.setActiveIndex(nextIndex);
    await this.markAccountUsed(nextIndex);

    return {
      account: config.accounts[nextIndex],
      index: nextIndex,
      reason: 'round-robin',
    };
  }

  private async stickyRotation(
    config: KimiAccountsConfig,
    forceRotation: boolean
  ): Promise<{ account: KimiAccount; index: number; reason: string }> {
    const currentIndex = config.activeIndex;
    const currentAccount = config.accounts[currentIndex];

    if (!forceRotation && !this.isRateLimited(currentAccount)) {
      await this.markAccountUsed(currentIndex);
      return {
        account: currentAccount,
        index: currentIndex,
        reason: 'sticky',
      };
    }

    const availableIndices = this.getAvailableIndices(config).filter(idx => idx !== currentIndex);

    if (availableIndices.length === 0) {
      const soonestIndex = this.getSoonestAvailableIndex(config);
      const account = config.accounts[soonestIndex];
      await this.storage.setActiveIndex(soonestIndex);
      return { account, index: soonestIndex, reason: 'all-rate-limited' };
    }

    const nextIndex = availableIndices[0];
    await this.storage.setActiveIndex(nextIndex);
    await this.markAccountUsed(nextIndex);

    return {
      account: config.accounts[nextIndex],
      index: nextIndex,
      reason: 'sticky-rotation',
    };
  }

  private async healthBasedRotation(
    config: KimiAccountsConfig,
    forceRotation: boolean
  ): Promise<{ account: KimiAccount; index: number; reason: string }> {
    const currentIndex = config.activeIndex;
    const currentAccount = config.accounts[currentIndex];

    if (!forceRotation && !this.isRateLimited(currentAccount) && currentAccount.healthScore > this.minHealthScore) {
      await this.markAccountUsed(currentIndex);
      return {
        account: currentAccount,
        index: currentIndex,
        reason: 'health-sticky',
      };
    }

    const availableIndices = this.getAvailableIndices(config);

    if (availableIndices.length === 0) {
      const soonestIndex = this.getSoonestAvailableIndex(config);
      const account = config.accounts[soonestIndex];
      await this.storage.setActiveIndex(soonestIndex);
      return { account, index: soonestIndex, reason: 'all-rate-limited' };
    }

    let bestIndex = availableIndices[0];
    let bestScore = this.calculateAccountScore(config.accounts[bestIndex], bestIndex === currentIndex);

    for (const index of availableIndices.slice(1)) {
      const account = config.accounts[index];
      const score = this.calculateAccountScore(account, index === currentIndex);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    await this.storage.setActiveIndex(bestIndex);
    await this.markAccountUsed(bestIndex);

    return {
      account: config.accounts[bestIndex],
      index: bestIndex,
      reason: 'health-based',
    };
  }

  private calculateAccountScore(account: KimiAccount, isCurrent: boolean): number {
    const timeSinceLastUse = Date.now() - account.lastUsed;
    const freshnessBonus = Math.min(20, timeSinceLastUse / (1000 * 60 * 60));

    let score = account.healthScore + freshnessBonus;

    if (isCurrent) {
      score += this.stickyBonus;
    }

    return score;
  }

  private getAvailableIndices(config: KimiAccountsConfig): number[] {
    return config.accounts
      .map((account, index) => ({ account, index }))
      .filter(({ account }) => !this.isRateLimited(account) && account.healthScore >= this.minHealthScore)
      .map(({ index }) => index);
  }

  private getSoonestAvailableIndex(config: KimiAccountsConfig): number {
    let soonestIndex = 0;
    let soonestTime = config.accounts[0].rateLimitResetTime;

    for (let i = 1; i < config.accounts.length; i++) {
      if (config.accounts[i].rateLimitResetTime < soonestTime) {
        soonestTime = config.accounts[i].rateLimitResetTime;
        soonestIndex = i;
      }
    }

    return soonestIndex;
  }

  private isRateLimited(account: KimiAccount): boolean {
    return account.rateLimitResetTime > Date.now();
  }

  private async getAccount(index: number): Promise<KimiAccount> {
    const config = await this.storage.loadConfig();
    if (index < 0 || index >= config.accounts.length) {
      throw new Error(`Invalid account index: ${index}`);
    }
    return config.accounts[index];
  }
}

// Plugin
let accountManager: KimiAccountManager | null = null;
let currentAccountIndex: number = 0;

async function getAccountManager(): Promise<KimiAccountManager> {
  if (!accountManager) {
    accountManager = new KimiAccountManager();
    await accountManager.init();
  }
  return accountManager;
}

interface OpenCodeAuth {
  type: 'api';
  key: string;
}

async function getAuth(): Promise<OpenCodeAuth | null> {
  const manager = await getAccountManager();
  const result = await manager.getNextAccount();

  if (!result) {
    return null;
  }

  currentAccountIndex = result.index;

  return {
    type: 'api',
    key: result.account.key,
  };
}

// @ts-nocheck

// Store client reference for toast notifications  
let openCodeClient: any = null;

export const KimiRotatorPlugin = async ({ client, directory, $ }: any) => {
  console.log("🎉 Kimi Rotator Plugin loaded!");

  // Store client for toast notifications
  openCodeClient = client;

  // Initialize the account manager
  accountManager = await getAccountManager();

  // Get the initial API key and set environment variables
  const result = await accountManager.getNextAccount();
  const allKeys = await accountManager.listKeys();
  const totalAccounts = allKeys.length;

  if (result) {
    const kimiBaseUrl = 'https://api.kimi.com/coding/v1';
    process.env.ANTHROPIC_BASE_URL = kimiBaseUrl;
    process.env.ANTHROPIC_API_KEY = result.account.key;
    console.log(`🔑 Set ANTHROPIC_BASE_URL=${kimiBaseUrl}`);
    console.log(`🔑 Initial key: ${result.account.key.substring(0, 15)}... (${result.index + 1}/${totalAccounts})`);
  }

  // Helper to show toast notifications (like antigravity plugin)
  const showToast = async (message: string, variant: 'info' | 'warning' | 'error' = 'info') => {
    if (!openCodeClient?.tui?.showToast) return;
    try {
      await openCodeClient.tui.showToast({ body: { message, variant } });
    } catch {
      // TUI may not be available
    }
  };

  // Intercept global fetch to rotate keys on each Anthropic API request
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: any, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    // Only intercept Kimi API requests
    if (url.includes('api.kimi.com')) {
      // Rotate to next key for this request
      const nextAccount = await accountManager!.getNextAccount();
      if (nextAccount) {
        const keyLabel = nextAccount.account.key.substring(0, 18) + '...';
        const position = nextAccount.index + 1;
        const allKeysNow = await accountManager!.listKeys();
        const total = allKeysNow.length;

        // Show toast notification (like antigravity: "Using Account 1 (1/3)")
        await showToast(`🔄 Using key: ${keyLabel} (${position}/${total})`, 'info');

        console.log(`🔄 Rotating to key: ${keyLabel} (${position}/${total})`);

        // Clone and update headers with new key
        const headers = new Headers(init?.headers);
        headers.set('x-api-key', nextAccount.account.key);
        headers.delete('Authorization'); // Anthropic SDK uses x-api-key

        return originalFetch(input, { ...init, headers });
      }
    }

    // Pass through for non-Kimi requests
    return originalFetch(input, init);
  };

  return {
    auth: {
      provider: 'kimi-rotator',
      methods: [{
        type: 'api' as const,
        label: 'Kimi API Key',
      }],
      loader: async (getAuth: () => Promise<OpenCodeAuth | null>, provider: any) => {
        console.log("🔑 Kimi Rotator auth loader called!");
        const auth = await getAuth();
        console.log("🔑 Auth from getAuth:", auth ? "found" : "null");
        if (!auth) {
          throw new Error('No Kimi API keys configured. Run: opencode kimi add-key <your-api-key>');
        }
        console.log("🔑 Returning auth with key:", auth.key.substring(0, 10) + "...");

        const kimiBaseUrl = 'https://api.kimi.com/coding/v1';

        return {
          apiKey: auth.key,
          baseURL: kimiBaseUrl,
          async fetch(input: any, init?: any) {
            // Rotation happens in the global fetch interceptor
            return globalThis.fetch(input, init);
          }
        };
      },
    },
  };
};

export default KimiRotatorPlugin;
