import { KimiAccountManager } from './accounts.js';

interface OpenCodeAuth {
  type: 'api';
  key: string;
}

interface OpenCodePlugin {
  auth?: {
    provider: string;
    loader: (getAuth: () => Promise<OpenCodeAuth | null>, provider: string) => Promise<unknown>;
  };
}

let accountManager: KimiAccountManager | null = null;

async function getAccountManager(): Promise<KimiAccountManager> {
  if (!accountManager) {
    accountManager = new KimiAccountManager();
    await accountManager.init();
  }
  return accountManager;
}

export async function getAuth(): Promise<OpenCodeAuth | null> {
  const manager = await getAccountManager();
  const key = await manager.getActiveKey();
  
  if (!key) {
    return null;
  }
  
  return {
    type: 'api',
    key,
  };
}

export async function handleRateLimit(retryAfterMs: number): Promise<void> {
  const manager = await getAccountManager();
  const config = await manager.listKeys();
  
  if (config.length === 0) return;
  
  const activeIndex = config.findIndex((_, idx) => idx === 0);
  await manager.markAccountRateLimited(activeIndex >= 0 ? activeIndex : 0, retryAfterMs);
}

export async function handleSuccess(): Promise<void> {
  const manager = await getAccountManager();
  const config = await manager.listKeys();
  
  if (config.length === 0) return;
  
  const activeIndex = 0;
  await manager.markAccountSuccess(activeIndex);
}

export async function handleFailure(): Promise<void> {
  const manager = await getAccountManager();
  const config = await manager.listKeys();
  
  if (config.length === 0) return;
  
  const activeIndex = 0;
  await manager.markAccountFailure(activeIndex);
}

const plugin: OpenCodePlugin = {
  auth: {
    provider: 'kimi-for-coding',
    loader: async (getAuth) => {
      const auth = await getAuth();
      if (!auth) {
        throw new Error(
          'No Kimi API keys configured. Run: opencode kimi add-key <your-api-key>'
        );
      }
      return auth;
    },
  },
};

export default plugin;
export { KimiAccountManager };
