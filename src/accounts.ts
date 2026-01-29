import { KimiStorage } from './storage.js';
import { KimiAccount, KimiAccountsConfig } from './types.js';

type RotationStrategy = 'round-robin' | 'health-based' | 'sticky';

interface RotationResult {
  account: KimiAccount;
  index: number;
  reason: string;
}

export class KimiAccountManager {
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

  async getNextAccount(forceRotation = false): Promise<RotationResult | null> {
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
    await this.storage.updateAccount(index, {
      lastUsed: Date.now(),
      totalRequests: (await this.getAccount(index)).totalRequests + 1,
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

  async setRotationStrategy(strategy: RotationStrategy): Promise<void> {
    const config = await this.storage.loadConfig();
    config.rotationStrategy = strategy;
    await this.storage.saveConfig(config);
  }

  async addKey(key: string, name?: string): Promise<KimiAccount> {
    return this.storage.addAccount(key, name);
  }

  async removeKey(index: number): Promise<void> {
    return this.storage.removeAccount(index);
  }

  async listKeys(): Promise<KimiAccount[]> {
    return this.storage.listAccounts();
  }

  async rotateToNext(): Promise<RotationResult | null> {
    return this.getNextAccount(true);
  }

  private async roundRobinRotation(config: KimiAccountsConfig): Promise<RotationResult> {
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
  ): Promise<RotationResult> {
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
  ): Promise<RotationResult> {
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
    const accounts = await this.storage.listAccounts();
    if (index < 0 || index >= accounts.length) {
      throw new Error(`Invalid account index: ${index}`);
    }
    return accounts[index];
  }
}
