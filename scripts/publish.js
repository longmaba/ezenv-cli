#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function publish() {
  console.log('🚀 EzEnv CLI Publishing Script\n');

  try {
    // Check if we're on a clean git state
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      console.error('❌ Working directory is not clean. Please commit all changes first.');
      process.exit(1);
    }

    // Check if we're on main branch
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    if (currentBranch !== 'main') {
      const proceed = await question(`⚠️  You're on branch "${currentBranch}", not "main". Continue? (y/N) `);
      if (proceed.toLowerCase() !== 'y') {
        console.log('Publishing cancelled.');
        process.exit(0);
      }
    }

    // Read current version
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;

    console.log(`Current version: ${currentVersion}`);

    // Ask for version bump type
    const bumpType = await question('\nVersion bump type (patch/minor/major): ');
    if (!['patch', 'minor', 'major'].includes(bumpType)) {
      console.error('❌ Invalid version bump type');
      process.exit(1);
    }

    // Run tests
    console.log('\n📋 Running tests...');
    execSync('pnpm test', { stdio: 'inherit' });

    // Run lint
    console.log('\n🔍 Running linter...');
    execSync('pnpm lint', { stdio: 'inherit' });

    // Run typecheck
    console.log('\n📝 Running type check...');
    execSync('pnpm typecheck', { stdio: 'inherit' });

    // Build
    console.log('\n🔨 Building package...');
    execSync('pnpm build:prod', { stdio: 'inherit' });

    // Bump version
    console.log(`\n📦 Bumping version (${bumpType})...`);
    execSync(`npm version ${bumpType}`, { stdio: 'inherit' });

    // Get new version
    const newPackageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const newVersion = newPackageJson.version;

    // Create git tag
    console.log(`\n🏷️  Creating git tag v${newVersion}...`);
    execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });

    // Confirm before publishing
    const confirmPublish = await question(`\n🚀 Ready to publish v${newVersion} to npm. Continue? (y/N) `);
    if (confirmPublish.toLowerCase() !== 'y') {
      console.log('Publishing cancelled. You may want to:');
      console.log(`  git tag -d v${newVersion}`);
      console.log(`  git reset --hard HEAD~1`);
      process.exit(0);
    }

    // Publish to npm
    console.log('\n📤 Publishing to npm...');
    execSync('pnpm publish --access public', { stdio: 'inherit' });

    // Push to git
    console.log('\n📤 Pushing to git...');
    execSync('git push origin main', { stdio: 'inherit' });
    execSync('git push origin --tags', { stdio: 'inherit' });

    console.log(`\n✅ Successfully published @ezenv/cli@${newVersion}!`);
    console.log('\nNext steps:');
    console.log('  1. Create a GitHub release with release notes');
    console.log('  2. Update documentation if needed');
    console.log('  3. Announce the release to the team');

  } catch (error) {
    console.error('\n❌ Publishing failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the publish script
publish();