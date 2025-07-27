#!/usr/bin/env node

const { execSync } = require('child_process');
const { chmodSync, existsSync } = require('fs');
const { join } = require('path');

console.log('Building CLI package...');

const projectRoot = join(__dirname, '..');

try {
  // Clean dist directory
  execSync('pnpm run clean', { stdio: 'inherit', cwd: projectRoot });
  
  // Compile TypeScript
  execSync('npx tsc', { stdio: 'inherit', cwd: projectRoot });
  
  // Ensure the main entry point is executable
  const entryPoint = join(projectRoot, 'dist', 'index.js');
  if (existsSync(entryPoint)) {
    chmodSync(entryPoint, '755');
    console.log('✓ Build completed successfully');
    console.log('✓ Entry point marked as executable');
  } else {
    console.error('Error: Entry point not found after build');
    process.exit(1);
  }
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}