import type { Plugin } from '@opencode-ai/plugin';
import { KimiAccountManager } from './accounts.js';
import type { KimiAccount } from './types.js';

interface OpenCodeAuth {
  type: 'api';
  key: string;
}

const BILLING_LIMIT_PATTERNS = [
  "you've reached your usage limit for this billing cycle",
  'billing limit',
  'usage limit exceeded',
  'quota exceeded',
  'insufficient credits',
  'payment required',
];

const DEBUG_MODE = process.env.KIMI_ROTATOR_DEBUG === 'true';

let accountManager: KimiAccountManager | null = null;
let currentAccountIndex = 0;
let originalFetch: typeof globalThis.fetch | null = null;

function debugLog(message: string, data?: unknown) {
  if (DEBUG_MODE) {
    console.log(`[KimiRotator Debug] ${message}`, data ?? '');
  }
}

async function getAccountManager(): Promise<KimiAccountManager> {
  if (!accountManager) {
    accountManager = new KimiAccountManager();
    await accountManager.init();
  }
  return accountManager;
}

async function getAuth(): Promise<OpenCodeAuth | null> {
  const manager = await getAccountManager();
  // Use getCurrentAccount to get the active key WITHOUT rotating
  // Rotation only happens in the fetch interceptor on actual API calls
  const result = await manager.getCurrentAccount();

  if (!result) {
    return null;
  }

  currentAccountIndex = result.index;

  return {
    type: 'api',
    key: result.account.key,
  };
}

let openCodeClient: {
  tui?: {
    showToast: (options: {
      body: { message: string; variant: 'info' | 'warning' | 'error' };
    }) => Promise<unknown>;
  };
} | null = null;

let toastQueue: { message: string; variant: 'info' | 'warning' | 'error' }[] = [];

async function showToast(message: string, variant: 'info' | 'warning' | 'error' = 'info') {
  if (!openCodeClient?.tui?.showToast) {
    toastQueue.push({ message, variant });
    return;
  }
  try {
    await openCodeClient.tui.showToast({ body: { message, variant } });
  } catch {
    return;
  }
}

async function flushToastQueue() {
  if (!openCodeClient?.tui?.showToast) return;
  while (toastQueue.length > 0) {
    const toast = toastQueue.shift();
    if (toast) {
      try {
        await openCodeClient.tui.showToast({
          body: { message: toast.message, variant: toast.variant },
        });
      } catch {
        return;
      }
    }
  }
}

export const KimiRotatorPlugin: Plugin = async ({ client }) => {
  openCodeClient = client;

  accountManager = await getAccountManager();

  // Use getCurrentAccount for init - don't rotate on plugin load
  const result = await accountManager.getCurrentAccount();

  if (result) {
    const kimiBaseUrl = 'https://api.kimi.com/coding/v1';
    process.env.ANTHROPIC_BASE_URL = kimiBaseUrl;
    process.env.ANTHROPIC_API_KEY = result.account.key;
  }

  originalFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: string | Request | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('api.kimi.com')) {
      if (!accountManager) {
        throw new Error('Account manager not initialized');
      }
      const nextAccount = await accountManager.getNextAccount();
      if (nextAccount) {
        currentAccountIndex = nextAccount.index;
        const keyLabel = nextAccount.account.key.substring(0, 18) + '...';
        const position = nextAccount.index + 1;
        const allKeysNow = await accountManager.listKeys();
        const total = allKeysNow.length;

        await showToast(`🔄 Using key: ${keyLabel} (${String(position)}/${String(total)})`, 'info');

        const headers = new Headers(init?.headers);
        headers.set('x-api-key', nextAccount.account.key);
        headers.delete('Authorization');

        const requestStartTime = Date.now();
        const today = new Date().toISOString().split('T')[0];

        if (!originalFetch) {
          throw new Error('Original fetch not available');
        }

        try {
          const response = await originalFetch(input, { ...init, headers });
          const responseTime = Date.now() - requestStartTime;

          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
            await accountManager.markAccountRateLimited(currentAccountIndex, retryAfterMs);
            await showToast(`⚠️ Key ${String(position)} rate limited`, 'warning');
          } else if (response.ok) {
            await accountManager.markAccountSuccess(currentAccountIndex, responseTime, today);
          } else if (response.status >= 500) {
            await accountManager.markAccountFailure(currentAccountIndex);
          } else if (response.status === 400 || response.status === 403) {
            const clonedResponse = response.clone();
            try {
              const bodyText = await clonedResponse.text();
              const bodyLower = bodyText.toLowerCase();

              debugLog(`HTTP ${response.status} for key ${String(position)}`, {
                bodyPreview: bodyText.substring(0, 200).replace(/\s+/g, ' '),
              });

              const isBillingLimit = BILLING_LIMIT_PATTERNS.some((pattern) =>
                bodyLower.includes(pattern)
              );

              if (isBillingLimit && accountManager) {
                const result = await accountManager.recordBillingLimitHit(currentAccountIndex);
                if (result.isConfirmed) {
                  const resetTime = new Date();
                  resetTime.setDate(resetTime.getDate() + 1);
                  resetTime.setHours(0, 0, 0, 0);
                  const hoursUntilReset = Math.ceil(
                    (resetTime.getTime() - Date.now()) / (1000 * 60 * 60)
                  );
                  await showToast(
                    `🚫 Key ${String(position)} billing limit reached - cooldown for ${String(hoursUntilReset)}h`,
                    'warning'
                  );
                } else {
                  debugLog(
                    `Billing limit hit ${2 - result.hitsNeeded}/2 for key ${String(position)} - not confirmed yet`
                  );
                }
              } else if (accountManager) {
                debugLog(
                  `HTTP ${response.status} but not billing limit for key ${String(position)}`
                );
                await accountManager.resetBillingLimitHits(currentAccountIndex);
                await accountManager.markAccountFailure(currentAccountIndex);
              }
            } catch (error) {
              debugLog('Error reading response body:', error);
            }
          }

          return response;
        } catch (error: unknown) {
          await accountManager.markAccountFailure(currentAccountIndex);
          throw error;
        }
      }
    }

    if (!originalFetch) {
      throw new Error('Original fetch not available');
    }
    return originalFetch(input, init);
  };

  const showInitialToast = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await flushToastQueue();
    await showToast('🎉 Kimi Rotator Plugin loaded!', 'info');
  };

  showInitialToast().catch(() => undefined);

  const pluginReturn = {
    auth: {
      provider: 'kimi-rotator',
      methods: [
        {
          type: 'api' as const,
          label: 'Kimi API Key',
        },
      ],
      loader: async () => {
        const auth = await getAuth();
        if (!auth) {
          throw new Error('No Kimi API keys configured. Run: opencode-kimi add-key');
        }

        const kimiBaseUrl = 'https://api.kimi.com/coding/v1';

        return {
          apiKey: auth.key,
          baseURL: kimiBaseUrl,
          async fetch(input: string | Request | URL, init?: RequestInit) {
            return globalThis.fetch(input, init);
          },
        };
      },
    },
    cleanup: () => {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
        originalFetch = null;
      }
      openCodeClient = null;
      accountManager = null;
      toastQueue = [];
    },
  };

  return pluginReturn;
};

export default KimiRotatorPlugin;
export type { KimiAccount };
