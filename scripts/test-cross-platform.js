#!/usr/bin/env node

const { execSync } = require('child_process');
const os = require('os');

console.log('🧪 Running cross-platform installation tests...\n');

const platform = os.platform();
console.log(`Platform detected: ${platform}`);
console.log(`Node version: ${process.version}`);
console.log(`npm version: ${execSync('npm --version', { encoding: 'utf8' }).trim()}\n`);

try {
  if (platform === 'win32') {
    console.log('Running Windows tests...');
    execSync('powershell -ExecutionPolicy Bypass -File scripts/test-install.ps1', { 
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
  } else {
    console.log('Running Unix tests...');
    execSync('bash scripts/test-install.sh', { 
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
  }
} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
}