import { KimiAccountManager } from './accounts.js';

interface OpenCodeAuth {
  type: 'api';
  key: string;
}

let accountManager: KimiAccountManager | null = null;
let currentAccountIndex: number = 0;

async function getAccountManager(): Promise<KimiAccountManager> {
  if (!accountManager) {
    accountManager = new KimiAccountManager();
    await accountManager.init();
  }
  return accountManager;
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

async function handleRateLimit(retryAfterMs: number): Promise<void> {
  const manager = await getAccountManager();
  await manager.markAccountRateLimited(currentAccountIndex, retryAfterMs);
}

async function handleSuccess(): Promise<void> {
  const manager = await getAccountManager();
  await manager.markAccountSuccess(currentAccountIndex);
}

async function handleFailure(): Promise<void> {
  const manager = await getAccountManager();
  await manager.markAccountFailure(currentAccountIndex);
}

// OpenCode expects a named Plugin export
export async function KimiRotatorPlugin(input: any) {
  console.log('🎉 Kimi Rotator Plugin loading!');
  
  // Initialize the account manager
  await getAccountManager();
  
  return {
    event: async ({ event }: { event: any }) => {
      // Handle events if needed
    },
    auth: {
      provider: 'kimi-for-coding',
      loader: async (getAuth: () => Promise<OpenCodeAuth | null>) => {
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
}

// Also export as default for compatibility
export default KimiRotatorPlugin;
export { KimiAccountManager };
