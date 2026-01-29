#!/usr/bin/env node

import { KimiAccountManager } from '../dist/accounts.js';

const args = process.argv.slice(2);
const command = args[0];

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
      case 'set-strategy':
        await setStrategy(manager, args.slice(1));
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

async function addKey(manager, args) {
  const key = args[0];
  const name = args[1];

  if (!key) {
    console.error('Usage: opencode kimi add-key <api-key> [name]');
    process.exit(1);
  }

  const account = await manager.addKey(key, name);
  const accounts = await manager.listKeys();
  console.log(`✓ Added Kimi API key: ${account.name}`);
  console.log(`  Index: ${accounts.length - 1}`);
}

async function listKeys(manager) {
  const accounts = await manager.listKeys();

  if (accounts.length === 0) {
    console.log('No Kimi API keys configured.');
    console.log('Run: opencode kimi add-key <your-api-key>');
    return;
  }

  const { KimiStorage } = await import('../dist/storage.js');
  const storage = new KimiStorage();
  const fullConfig = await storage.loadConfig();
  const activeIndex = fullConfig.activeIndex;

  console.log(`\nKimi API Keys (${accounts.length} total, strategy: ${fullConfig.rotationStrategy}):\n`);

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
    console.error('Usage: opencode kimi remove-key <index>');
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

async function setStrategy(manager, args) {
  const strategy = args[0];
  
  if (!['round-robin', 'health-based', 'sticky'].includes(strategy)) {
    console.error('Usage: opencode kimi set-strategy <round-robin|health-based|sticky>');
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

function showHelp() {
  console.log('Kimi API Key Rotator for OpenCode');
  console.log('');
  console.log('Usage: opencode kimi <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  add-key <key> [name]     Add a new Kimi API key');
  console.log('  list-keys                 List all configured keys');
  console.log('  remove-key <index>        Remove a key by index');
  console.log('  rotate                    Manually rotate to next key');
  console.log('  set-strategy <strategy>   Set rotation strategy');
  console.log('  help                      Show this help message');
  console.log('');
  console.log('Strategies:');
  console.log('  round-robin   - Cycle through keys sequentially');
  console.log('  health-based  - Use health scores + LRU (default)');
  console.log('  sticky        - Stay on one key until rate limited');
  console.log('');
  console.log('Examples:');
  console.log('  opencode kimi add-key sk-kimi-xxx MyAccount');
  console.log('  opencode kimi list-keys');
  console.log('  opencode kimi rotate');
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
