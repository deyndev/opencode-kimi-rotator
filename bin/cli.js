#!/usr/bin/env node

import { KimiAccountManager } from '../dist/accounts.js';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { promises as fs } from 'fs';
import { Buffer } from 'buffer';

const args = process.argv.slice(2);
const command = args[0];

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

async function main() {
  const manager = new KimiAccountManager();
  await manager.init();

  try {
    switch (command) {
      case 'add-key':
        await addKey(manager, args.slice(1));
        break;
      case 'list-keys':
        await listKeys(manager);
        break;
      case 'remove-key':
        await removeKey(manager, args.slice(1));
        break;
      case 'rotate':
        await rotate(manager);
        break;
      case 'use-key':
        await useKey(manager, args.slice(1));
        break;
      case 'set-strategy':
        await setStrategy(manager, args.slice(1));
        break;
      case 'stats':
        await showStats(manager);
        break;
      case 'refresh-health':
        await refreshHealth(manager);
        break;
      case 'set-auto-refresh':
        await setAutoRefresh(manager, args.slice(1));
        break;
      case 'set-cooldown':
        await setCooldown(manager, args.slice(1));
        break;
      case 'export-keys':
        await exportKeys(manager, args.slice(1));
        break;
      case 'import-keys':
        await importKeys(manager, args.slice(1));
        break;
      case 'clear-limits':
        await clearLimits(manager, args.slice(1));
        break;
      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const API_KEY_PATTERN = /^sk-kimi-[a-zA-Z0-9_-]+$/;
const API_KEY_MIN_LENGTH = 20;
const API_KEY_MAX_LENGTH = 128;
const MAX_ACCOUNTS = 100;
const MAX_ACCOUNT_NAME_LENGTH = 64;

function validateApiKey(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  if (!key.startsWith('sk-kimi-')) {
    return { valid: false, error: 'API key must start with "sk-kimi-"' };
  }

  if (key.length < API_KEY_MIN_LENGTH) {
    return { valid: false, error: `API key must be at least ${API_KEY_MIN_LENGTH} characters` };
  }

  if (key.length > API_KEY_MAX_LENGTH) {
    return { valid: false, error: `API key must not exceed ${API_KEY_MAX_LENGTH} characters` };
  }

  if (!API_KEY_PATTERN.test(key)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }

  return { valid: true };
}

function sanitizeAccountName(name) {
  if (!name) return null;

  const trimmed = name.trim();

  if (trimmed.length === 0) return null;

  if (trimmed.length > MAX_ACCOUNT_NAME_LENGTH) {
    return trimmed.substring(0, MAX_ACCOUNT_NAME_LENGTH);
  }

  return trimmed.replace(/[<>\"']/g, '');
}

async function addKey(manager, args) {
  const key = args[0];
  const rawName = args[1];

  if (!key) {
    console.error('Usage: opencode-kimi add-key <api-key> [name]');
    process.exit(1);
  }

  const validation = validateApiKey(key);
  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    process.exit(1);
  }

  const accounts = await manager.listKeys();
  if (accounts.length >= MAX_ACCOUNTS) {
    console.error(`Error: Maximum number of accounts (${MAX_ACCOUNTS}) reached`);
    process.exit(1);
  }

  const name = sanitizeAccountName(rawName);

  try {
    const account = await manager.addKey(key, name);
    const updatedAccounts = await manager.listKeys();
    console.log(`✓ Added Kimi API key: ${account.name}`);
    console.log(`  Index: ${updatedAccounts.length - 1}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function listKeys(manager) {
  const accounts = await manager.listKeys();

  if (accounts.length === 0) {
    console.log('No Kimi API keys configured.');
    console.log('Run: opencode-kimi add-key <your-api-key>');
    return;
  }

  const { KimiStorage } = await import('../dist/storage.js');
  const storage = new KimiStorage();
  const fullConfig = await storage.loadConfig();
  const activeIndex = fullConfig.activeIndex;

  console.log(
    `\nKimi API Keys (${accounts.length} total, strategy: ${fullConfig.rotationStrategy}):\n`
  );

  accounts.forEach((account, index) => {
    const isActive = index === activeIndex;
    const isRateLimited = account.rateLimitResetTime > Date.now();
    const healthBar = getHealthBar(account.healthScore);

    console.log(`${isActive ? '●' : '○'} [${index}] ${account.name}`);
    console.log(`   Key: ${maskKey(account.key)}`);
    console.log(`   Health: ${healthBar} ${account.healthScore}%`);
    console.log(`   Requests: ${account.successfulRequests}/${account.totalRequests} successful`);

    if (isRateLimited) {
      const waitTime = Math.ceil((account.rateLimitResetTime - Date.now()) / 1000 / 60);
      console.log(`   Status: ⏱️  Rate limited (~${waitTime}m remaining)`);
    } else if (account.consecutiveFailures > 0) {
      console.log(`   Status: ⚠️  ${account.consecutiveFailures} consecutive failures`);
    } else {
      console.log(`   Status: ✓ Active`);
    }

    console.log();
  });
}

async function removeKey(manager, args) {
  const index = parseInt(args[0], 10);

  if (isNaN(index)) {
    console.error('Usage: opencode-kimi remove-key <index>');
    process.exit(1);
  }

  const accounts = await manager.listKeys();
  if (index < 0 || index >= accounts.length) {
    console.error(`Invalid index. Valid range: 0-${accounts.length - 1}`);
    process.exit(1);
  }

  await manager.removeKey(index);
  console.log(`✓ Removed Kimi API key at index ${index}`);
}

async function rotate(manager) {
  const result = await manager.rotateToNext();

  if (!result) {
    console.log('No Kimi API keys configured.');
    return;
  }

  console.log(`✓ Rotated to next Kimi API key`);
  console.log(`  Now using: ${result.account.name} (index ${result.index})`);
  console.log(`  Reason: ${result.reason}`);
}

async function useKey(manager, args) {
  const index = parseInt(args[0], 10);

  if (isNaN(index)) {
    console.error('Usage: opencode-kimi use-key <index>');
    process.exit(1);
  }

  const accounts = await manager.listKeys();
  if (index < 0 || index >= accounts.length) {
    console.error(`Invalid index. Valid range: 0-${accounts.length - 1}`);
    process.exit(1);
  }

  await manager.setActiveIndex(index);
  console.log(`✓ Now using: ${accounts[index].name} (index ${index})`);
}

async function setStrategy(manager, args) {
  const strategy = args[0];

  if (!['round-robin', 'health-based', 'sticky'].includes(strategy)) {
    console.error('Usage: opencode-kimi set-strategy <round-robin|health-based|sticky>');
    console.error('');
    console.error('Strategies:');
    console.error('  round-robin  - Cycle through keys sequentially');
    console.error('  health-based - Use health scores + LRU (default)');
    console.error('  sticky       - Stay on one key until rate limited');
    process.exit(1);
  }

  await manager.setRotationStrategy(strategy);
  console.log(`✓ Rotation strategy set to: ${strategy}`);
}

async function showStats(manager) {
  const accounts = await manager.listKeys();

  if (accounts.length === 0) {
    console.log('No Kimi API keys configured.');
    console.log('Run: opencode-kimi add-key <your-api-key>');
    return;
  }

  console.log('\n📊 Usage Statistics\n');

  let totalRequests = 0;
  let totalSuccessful = 0;
  let totalResponseTimes = [];
  const today = new Date().toISOString().split('T')[0];
  const last7Days = getLast7Days();

  accounts.forEach((account, index) => {
    console.log(`[${index}] ${account.name}`);
    console.log(`   Total Requests: ${account.totalRequests}`);
    console.log(`   Successful: ${account.successfulRequests}`);
    console.log(`   Failed: ${account.totalRequests - account.successfulRequests}`);

    if (account.totalRequests > 0) {
      const successRate = ((account.successfulRequests / account.totalRequests) * 100).toFixed(1);
      console.log(`   Success Rate: ${successRate}%`);
    }

    if (account.responseTimes && account.responseTimes.length > 0) {
      const avg = average(account.responseTimes);
      const min = Math.min(...account.responseTimes);
      const max = Math.max(...account.responseTimes);
      console.log(`   Avg Response Time: ${avg}ms`);
      console.log(`   Response Time Range: ${min}ms - ${max}ms`);
      totalResponseTimes.push(...account.responseTimes);
    } else {
      console.log(`   Avg Response Time: N/A`);
    }

    const todayCount = account.dailyRequests?.[today] || 0;
    console.log(`   Requests Today: ${todayCount}`);

    const weeklyTotal = last7Days.reduce(
      (sum, day) => sum + (account.dailyRequests?.[day] || 0),
      0
    );
    console.log(`   Requests Last 7 Days: ${weeklyTotal}`);

    console.log();

    totalRequests += account.totalRequests;
    totalSuccessful += account.successfulRequests;
  });

  console.log('─'.repeat(50));
  console.log('📈 Aggregate Statistics');
  console.log(`   Total Requests (All Keys): ${totalRequests}`);
  console.log(`   Total Successful: ${totalSuccessful}`);
  if (totalRequests > 0) {
    const overallRate = ((totalSuccessful / totalRequests) * 100).toFixed(1);
    console.log(`   Overall Success Rate: ${overallRate}%`);
  }
  if (totalResponseTimes.length > 0) {
    const overallAvg = average(totalResponseTimes);
    console.log(`   Overall Avg Response Time: ${overallAvg}ms`);
  }
  console.log();
}

function getLast7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function average(arr) {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

async function refreshHealth(manager) {
  const result = await manager.refreshHealthScores();

  if (result.refreshed === 0) {
    console.log('No keys needed health refresh.');
    console.log('Keys must be below 100% health and past the cooldown period.');
    return;
  }

  console.log(`✓ Refreshed health for ${result.refreshed} key(s):`);
  result.details.forEach((detail) => {
    console.log(`  ${detail}`);
  });
}

async function setAutoRefresh(manager, args) {
  const enabled = args[0];

  if (enabled !== 'true' && enabled !== 'false') {
    console.error('Usage: opencode-kimi set-auto-refresh <true|false>');
    console.error('');
    console.error('When enabled, health scores will automatically refresh');
    console.error('after the cooldown period when keys are rate limited.');
    process.exit(1);
  }

  await manager.setAutoRefreshHealth(enabled === 'true');
  console.log(`✓ Auto-refresh health: ${enabled}`);
}

async function setCooldown(manager, args) {
  const minutes = parseInt(args[0], 10);

  if (isNaN(minutes) || minutes < 1 || minutes > 1440) {
    console.error('Usage: opencode-kimi set-cooldown <minutes>');
    console.error('');
    console.error('Set the cooldown period (in minutes) before health scores');
    console.error('can be refreshed after a rate limit. Range: 1-1440');
    console.error('');
    console.error('Examples:');
    console.error('  opencode-kimi set-cooldown 30   # 30 minutes (default)');
    console.error('  opencode-kimi set-cooldown 60   # 1 hour');
    console.error('  opencode-kimi set-cooldown 180  # 3 hours');
    process.exit(1);
  }

  await manager.setHealthRefreshCooldown(minutes);
  console.log(`✓ Health refresh cooldown: ${minutes} minutes`);
}

async function exportKeys(manager, args) {
  const filePath = args[0] || 'kimi-keys-backup.json.enc';

  const accounts = await manager.listKeys();
  if (accounts.length === 0) {
    console.log('No keys to export.');
    return;
  }

  const { KimiStorage } = await import('../dist/storage.js');
  const storage = new KimiStorage();
  const config = await storage.loadConfig();

  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: config.accounts,
    rotationStrategy: config.rotationStrategy,
    autoRefreshHealth: config.autoRefreshHealth,
    healthRefreshCooldownMinutes: config.healthRefreshCooldownMinutes,
  };

  const password = await promptPassword('Enter encryption password: ');
  const confirmPassword = await promptPassword('Confirm encryption password: ');

  if (password !== confirmPassword) {
    console.error('Error: Passwords do not match');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    process.exit(1);
  }

  const encrypted = encryptData(JSON.stringify(exportData), password);
  await fs.writeFile(filePath, encrypted, 'utf-8');

  console.log(`✓ Exported ${accounts.length} key(s) to: ${filePath}`);
  console.log('  Keep this file and your password safe!');
}

async function importKeys(manager, args) {
  const filePath = args[0];

  if (!filePath) {
    console.error('Usage: opencode-kimi import-keys <file>');
    console.error('');
    console.error('Import keys from an encrypted backup file.');
    console.error('Keys will be merged with existing keys (duplicates skipped).');
    process.exit(1);
  }

  let encryptedData;
  try {
    encryptedData = await fs.readFile(filePath, 'utf-8');
  } catch {
    console.error(`Error: Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const password = await promptPassword('Enter decryption password: ');

  let decrypted;
  try {
    decrypted = decryptData(encryptedData, password);
  } catch {
    console.error('Error: Failed to decrypt file. Wrong password?');
    process.exit(1);
  }

  let importData;
  try {
    importData = JSON.parse(decrypted);
  } catch {
    console.error('Error: Invalid backup file format');
    process.exit(1);
  }

  if (!importData.accounts || !Array.isArray(importData.accounts)) {
    console.error('Error: Invalid backup file format');
    process.exit(1);
  }

  const existingKeys = await manager.listKeys();
  const existingKeySet = new Set(existingKeys.map((a) => a.key));

  let imported = 0;
  let skipped = 0;

  for (const account of importData.accounts) {
    if (existingKeySet.has(account.key)) {
      skipped++;
      continue;
    }

    try {
      await manager.addKey(account.key, account.name);
      imported++;
    } catch (error) {
      console.error(`Error importing key "${account.name}": ${error.message}`);
    }
  }

  console.log(`✓ Import complete:`);
  console.log(`  Imported: ${imported} key(s)`);
  console.log(`  Skipped (duplicates): ${skipped} key(s)`);

  if (imported > 0 && importData.rotationStrategy) {
    await manager.setRotationStrategy(importData.rotationStrategy);
    console.log(`  Restored rotation strategy: ${importData.rotationStrategy}`);
  }
}

function encryptData(data, password) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const result = Buffer.concat([salt, iv, authTag, encrypted]);
  return result.toString('base64');
}

function decryptData(encryptedData, password) {
  const data = Buffer.from(encryptedData, 'base64');

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = scryptSync(password, salt, KEY_LENGTH);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf-8');
}

async function promptPassword(prompt) {
  const { createInterface } = await import('readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function clearLimits(manager, args) {
  const index = parseInt(args[0], 10);

  if (isNaN(index)) {
    console.error('Usage: opencode-kimi clear-limits <index>');
    console.error('');
    console.error('Clear billing and rate limits for a specific key.');
    console.error('Use "all" to clear limits for all keys.');
    process.exit(1);
  }

  if (args[0] === 'all') {
    const accounts = await manager.listKeys();
    let cleared = 0;
    for (let i = 0; i < accounts.length; i++) {
      await manager.clearAccountLimits(i);
      cleared++;
    }
    console.log(`✓ Cleared limits for all ${cleared} key(s)`);
    return;
  }

  const accounts = await manager.listKeys();
  if (index < 0 || index >= accounts.length) {
    console.error(`Invalid index. Valid range: 0-${accounts.length - 1}`);
    process.exit(1);
  }

  await manager.clearAccountLimits(index);
  console.log(`✓ Cleared limits for key: ${accounts[index].name} (index ${index})`);
}

function showHelp() {
  console.log('Kimi API Key Rotator for OpenCode');
  console.log('');
  console.log('Usage: opencode-kimi <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  add-key <key> [name]      Add a new Kimi API key');
  console.log('  list-keys                  List all configured keys');
  console.log('  remove-key <index>         Remove a key by index');
  console.log('  rotate                     Manually rotate to next key');
  console.log('  use-key <index>            Switch to a specific key');
  console.log('  set-strategy <strategy>    Set rotation strategy');
  console.log('  stats                      Show usage statistics');
  console.log('  refresh-health             Manually refresh health scores');
  console.log('  set-auto-refresh <true|false>  Enable/disable auto-refresh');
  console.log('  set-cooldown <minutes>     Set health refresh cooldown');
  console.log('  clear-limits <index|all>   Clear billing/rate limits for key(s)');
  console.log('  export-keys [file]         Export keys to encrypted file');
  console.log('  import-keys <file>         Import keys from encrypted file');
  console.log('  help                       Show this help message');
  console.log('');
  console.log('Strategies:');
  console.log('  round-robin   - Cycle through keys sequentially');
  console.log('  health-based  - Use health scores + LRU (default)');
  console.log('  sticky        - Stay on one key until rate limited');
  console.log('');
  console.log('Examples:');
  console.log('  opencode-kimi add-key sk-kimi-xxx MyAccount');
  console.log('  opencode-kimi list-keys');
  console.log('  opencode-kimi rotate');
  console.log('  opencode-kimi use-key 1');
  console.log('  opencode-kimi stats');
  console.log('  opencode-kimi refresh-health');
  console.log('  opencode-kimi export-keys backup.json.enc');
  console.log('  opencode-kimi import-keys backup.json.enc');
}

function maskKey(key) {
  if (key.length <= 12) return '***';
  return key.slice(0, 6) + '...' + key.slice(-6);
}

function getHealthBar(score) {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return bar;
}

main();
