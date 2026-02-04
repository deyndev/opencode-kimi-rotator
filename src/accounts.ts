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
  private minHealthScore = 30;
  private stickyBonus = 50;

  constructor() {
    this.storage = new KimiStorage();
  }

  async init(): Promise<void> {
    await this.storage.init();
  }

  /**
   * Gets the current active account WITHOUT rotating.
   * Use this for initial key fetches where you don't want to consume a rotation.
   */
  async getCurrentAccount(): Promise<RotationResult | null> {
    const config = await this.storage.loadConfig();

    if (config.accounts.length === 0) {
      return null;
    }

    const currentIndex = config.activeIndex;
    const account = config.accounts[currentIndex];

    return {
      account,
      index: currentIndex,
      reason: 'current',
    };
  }

  /**
   * Gets the next account and advances rotation.
   * Use this when actually making an API request to rotate to the next key.
   */
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

  async markAccountSuccess(index: number, responseTime?: number, date?: string): Promise<void> {
    const account = await this.getAccount(index);
    const newHealthScore = Math.min(100, account.healthScore + 2);

    const updates: Partial<KimiAccount> = {
      healthScore: newHealthScore,
      successfulRequests: account.successfulRequests + 1,
      consecutiveFailures: 0,
    };

    if (responseTime !== undefined) {
      const responseTimes = [...account.responseTimes, responseTime];
      if (responseTimes.length > 100) {
        responseTimes.shift();
      }
      updates.responseTimes = responseTimes;
    }

    if (date) {
      const dailyRequests = { ...account.dailyRequests };
      dailyRequests[date] = (dailyRequests[date] || 0) + 1;
      updates.dailyRequests = dailyRequests;
    }

    await this.storage.updateAccount(index, updates);
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

  async markAccountBillingLimited(index: number): Promise<void> {
    const account = await this.getAccount(index);
    const newHealthScore = Math.max(0, account.healthScore - 30);

    // Set cooldown until end of current day (midnight) + 24 hours
    // This ensures the key won't be tried again for at least 24 hours
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    const cooldownUntil = endOfDay.getTime();

    await this.storage.updateAccount(index, {
      healthScore: newHealthScore,
      billingLimitResetTime: cooldownUntil,
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

  async setActiveIndex(index: number): Promise<void> {
    return this.storage.setActiveIndex(index);
  }

  async setAutoRefreshHealth(enabled: boolean): Promise<void> {
    const config = await this.storage.loadConfig();
    config.autoRefreshHealth = enabled;
    await this.storage.saveConfig(config);
  }

  async setHealthRefreshCooldown(minutes: number): Promise<void> {
    if (minutes < 1 || minutes > 1440) {
      throw new Error('Cooldown must be between 1 and 1440 minutes (24 hours)');
    }
    const config = await this.storage.loadConfig();
    config.healthRefreshCooldownMinutes = minutes;
    await this.storage.saveConfig(config);
  }

  async refreshHealthScores(): Promise<{ refreshed: number; details: string[] }> {
    const config = await this.storage.loadConfig();
    const now = Date.now();
    const cooldownMs = config.healthRefreshCooldownMinutes * 60 * 1000;
    let refreshed = 0;
    const details: string[] = [];

    for (let i = 0; i < config.accounts.length; i++) {
      const account = config.accounts[i];
      const timeSinceRateLimit = now - account.rateLimitResetTime;

      const shouldRefresh =
        config.autoRefreshHealth &&
        account.healthScore < 100 &&
        timeSinceRateLimit >= cooldownMs &&
        account.rateLimitResetTime <= now;

      if (shouldRefresh) {
        const oldScore = account.healthScore;
        const newScore = Math.min(100, oldScore + 10);
        await this.storage.updateAccount(i, {
          healthScore: newScore,
          consecutiveFailures: 0,
        });
        refreshed++;
        details.push(`${account.name}: ${oldScore}% → ${newScore}%`);
      }
    }

    return { refreshed, details };
  }

  private async roundRobinRotation(config: KimiAccountsConfig): Promise<RotationResult> {
    const availableIndices = this.getAvailableIndices(config);

    if (availableIndices.length === 0) {
      const soonestIndex = this.getSoonestAvailableIndex(config);
      const account = config.accounts[soonestIndex];
      return { account, index: soonestIndex, reason: 'all-rate-limited' };
    }

    const nextIndex = await this.storage.getAndIncrementActiveIndex(availableIndices);
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

    const availableIndices = this.getAvailableIndices(config).filter((idx) => idx !== currentIndex);

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

    if (
      !forceRotation &&
      !this.isRateLimited(currentAccount) &&
      currentAccount.healthScore > this.minHealthScore
    ) {
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
    let bestScore = this.calculateAccountScore(
      config.accounts[bestIndex],
      bestIndex === currentIndex
    );

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
      .filter(
        ({ account }) => !this.isRateLimited(account) && account.healthScore >= this.minHealthScore
      )
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
    const now = Date.now();
    const rateLimited = account.rateLimitResetTime > now;
    const billingLimited = (account.billingLimitResetTime ?? 0) > now;
    return rateLimited || billingLimited;
  }

  private async getAccount(index: number): Promise<KimiAccount> {
    const accounts = await this.storage.listAccounts();
    if (index < 0 || index >= accounts.length) {
      throw new Error(`Invalid account index: ${String(index)}`);
    }
    return accounts[index];
  }
}
