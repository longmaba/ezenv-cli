#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const packagePath = path.join(__dirname, '..', 'package.json');

// Read package.json to get current version
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const newVersion = packageJson.version;

// Read existing changelog
const existingChangelog = fs.readFileSync(changelogPath, 'utf8');

// Get current date
const date = new Date().toISOString().split('T')[0];

// Check if this version already exists in changelog
if (existingChangelog.includes(`## [${newVersion}]`)) {
  console.log(`Version ${newVersion} already exists in CHANGELOG.md`);
  process.exit(0);
}

// Prepare new entry
const newEntry = `## [${newVersion}] - ${date}

### Added
- 

### Changed
- 

### Fixed
- 

### Removed
- 

`;

// Insert new entry after the header
const lines = existingChangelog.split('\n');
let insertIndex = 0;

// Find where to insert (after the header and description)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('## [')) {
    insertIndex = i;
    break;
  }
}

// Insert the new entry
lines.splice(insertIndex, 0, newEntry);

// Write back to file
fs.writeFileSync(changelogPath, lines.join('\n'));

console.log(`Added version ${newVersion} to CHANGELOG.md`);
console.log('Please update the changelog entries before committing.');