import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import lockfile from 'proper-lockfile';
import {
  KimiAccountsConfig,
  KimiAccountsConfigSchema,
  KimiAccount,
  DEFAULT_CONFIG,
  DEFAULT_ACCOUNT,
} from './types.js';

const ACCOUNTS_FILE_NAME = 'kimi-accounts.json';
const GITIGNORE_CONTENT = '# Kimi Rotator\nkimi-accounts.json\n';

export class KimiStorage {
  private configDir: string;
  private accountsFilePath: string;
  private lockOptions = {
    stale: 5000,
    retries: 3,
  };

  constructor() {
    this.configDir = path.join(os.homedir(), '.config', 'opencode');
    this.accountsFilePath = path.join(this.configDir, ACCOUNTS_FILE_NAME);
  }

  async init(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    
    const gitignorePath = path.join(this.configDir, '.gitignore');
    try {
      await fs.access(gitignorePath);
    } catch {
      await fs.appendFile(gitignorePath, GITIGNORE_CONTENT, 'utf-8');
    }

    try {
      await fs.access(this.accountsFilePath);
    } catch {
      await this.saveConfig({
        ...DEFAULT_CONFIG,
        accounts: [],
      });
    }
  }

  async loadConfig(): Promise<KimiAccountsConfig> {
    const release = await this.acquireLock();
    try {
      const data = await fs.readFile(this.accountsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      return KimiAccountsConfigSchema.parse(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        const config = { ...DEFAULT_CONFIG, accounts: [] };
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
      const validated = KimiAccountsConfigSchema.parse(config);
      await fs.writeFile(
        this.accountsFilePath,
        JSON.stringify(validated, null, 2),
        'utf-8'
      );
    } finally {
      await release();
    }
  }

  async addAccount(key: string, name?: string): Promise<KimiAccount> {
    const config = await this.loadConfig();
    
    const existingIndex = config.accounts.findIndex(a => a.key === key);
    if (existingIndex !== -1) {
      throw new Error('This API key already exists');
    }

    const now = Date.now();
    const newAccount: KimiAccount = {
      key,
      name: name || `Account ${config.accounts.length + 1}`,
      addedAt: now,
      lastUsed: now,
      ...DEFAULT_ACCOUNT,
    };

    config.accounts.push(newAccount);
    await this.saveConfig(config);
    
    return newAccount;
  }

  async removeAccount(index: number): Promise<void> {
    const config = await this.loadConfig();
    
    if (index < 0 || index >= config.accounts.length) {
      throw new Error(`Invalid account index: ${index}`);
    }

    config.accounts.splice(index, 1);
    
    if (config.activeIndex >= config.accounts.length) {
      config.activeIndex = Math.max(0, config.accounts.length - 1);
    }

    await this.saveConfig(config);
  }

  async listAccounts(): Promise<KimiAccount[]> {
    const config = await this.loadConfig();
    return config.accounts;
  }

  async getActiveAccount(): Promise<KimiAccount | null> {
    const config = await this.loadConfig();
    if (config.accounts.length === 0) {
      return null;
    }
    return config.accounts[config.activeIndex];
  }

  async setActiveIndex(index: number): Promise<void> {
    const config = await this.loadConfig();
    
    if (index < 0 || index >= config.accounts.length) {
      throw new Error(`Invalid account index: ${index}`);
    }

    config.activeIndex = index;
    await this.saveConfig(config);
  }

  async updateAccount(index: number, updates: Partial<KimiAccount>): Promise<void> {
    const config = await this.loadConfig();
    
    if (index < 0 || index >= config.accounts.length) {
      throw new Error(`Invalid account index: ${index}`);
    }

    config.accounts[index] = { ...config.accounts[index], ...updates };
    await this.saveConfig(config);
  }

  private async acquireLock(): Promise<() => Promise<void>> {
    await fs.mkdir(path.dirname(this.accountsFilePath), { recursive: true });
    
    try {
      await fs.access(this.accountsFilePath);
    } catch {
      await fs.writeFile(
        this.accountsFilePath,
        JSON.stringify({ ...DEFAULT_CONFIG, accounts: [] })
      );
    }
    
    const release = await lockfile.lock(this.accountsFilePath, this.lockOptions);
    return release;
  }
}
