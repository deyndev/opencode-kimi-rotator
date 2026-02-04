import { z } from 'zod';

export const KimiAccountSchema = z.object({
  key: z.string().min(1),
  name: z.string().optional(),
  addedAt: z.number(),
  lastUsed: z.number(),
  rateLimitResetTime: z.number().default(0),
  billingLimitResetTime: z.number().default(0),
  healthScore: z.number().min(0).max(100).default(100),
  consecutiveFailures: z.number().default(0),
  consecutiveBillingLimitHits: z.number().default(0),
  totalRequests: z.number().default(0),
  successfulRequests: z.number().default(0),
  responseTimes: z.array(z.number()).default([]),
  dailyRequests: z.record(z.number()).default({}),
});

export const KimiAccountsConfigSchema = z.object({
  version: z.number().default(1),
  accounts: z.array(KimiAccountSchema),
  activeIndex: z.number().default(0),
  rotationStrategy: z.enum(['round-robin', 'health-based', 'sticky']).default('health-based'),
  autoRefreshHealth: z.boolean().default(true),
  healthRefreshCooldownMinutes: z.number().min(1).max(1440).default(30),
});

export type KimiAccount = z.infer<typeof KimiAccountSchema>;
export type KimiAccountsConfig = z.infer<typeof KimiAccountsConfigSchema>;

export const DEFAULT_ACCOUNT: Omit<KimiAccount, 'key' | 'addedAt' | 'lastUsed'> = {
  rateLimitResetTime: 0,
  billingLimitResetTime: 0,
  healthScore: 100,
  consecutiveFailures: 0,
  consecutiveBillingLimitHits: 0,
  totalRequests: 0,
  successfulRequests: 0,
  responseTimes: [],
  dailyRequests: {},
};

export const DEFAULT_CONFIG: Omit<KimiAccountsConfig, 'accounts'> = {
  version: 1,
  activeIndex: 0,
  rotationStrategy: 'health-based',
  autoRefreshHealth: true,
  healthRefreshCooldownMinutes: 30,
};
