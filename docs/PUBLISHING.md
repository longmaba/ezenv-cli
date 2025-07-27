# Publishing Guide for @ezenv/cli

This document outlines the process for publishing the EzEnv CLI to npm.

## Prerequisites

Before publishing, ensure you have:

1. **npm Account**: You must have an npm account with publish permissions for the `@ezenv` scope
2. **Authentication**: Be logged in to npm (`npm login`)
3. **Git Access**: Push access to the main repository
4. **Clean Working Directory**: No uncommitted changes

## Pre-Release Checklist

Before releasing a new version, complete this checklist:

- [ ] All tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Build succeeds (`pnpm build:prod`)
- [ ] Cross-platform tests pass (`pnpm test:install`)
- [ ] CHANGELOG.md is updated with release notes
- [ ] Version bump is appropriate (patch/minor/major)
- [ ] Documentation is updated if needed

## Release Process

### Automated Release (Recommended)

Use the automated publish script:

```bash
node scripts/publish.js
```

This script will:
1. Verify git status is clean
2. Confirm you're on the main branch
3. Run all tests and checks
4. Build the package
5. Bump the version
6. Create a git tag
7. Publish to npm
8. Push changes to git

### Manual Release

If you need to publish manually:

1. **Ensure clean git state**
   ```bash
   git status
   ```

2. **Run all checks**
   ```bash
   pnpm test
   pnpm lint
   pnpm typecheck
   ```

3. **Build the package**
   ```bash
   pnpm build:prod
   ```

4. **Test the package locally**
   ```bash
   npm pack --dry-run
   ```

5. **Bump version**
   ```bash
   # For patch release (1.0.0 → 1.0.1)
   npm version patch
   
   # For minor release (1.0.0 → 1.1.0)
   npm version minor
   
   # For major release (1.0.0 → 2.0.0)
   npm version major
   ```

6. **Publish to npm**
   ```bash
   pnpm publish --access public
   ```

7. **Push to git**
   ```bash
   git push origin main
   git push origin --tags
   ```

## Publishing Beta Versions

To publish a beta version:

```bash
# Bump to beta version
npm version prerelease --preid=beta

# Publish with beta tag
pnpm release:beta
```

## Dry Run

To test the publishing process without actually publishing:

```bash
pnpm release:dry
```

## Version Strategy

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features, backward compatible
- **PATCH** (0.0.x): Bug fixes, backward compatible

### When to bump versions:

#### Patch Version (1.0.0 → 1.0.1)
- Bug fixes
- Security patches
- Documentation updates
- Dependency updates (non-breaking)

#### Minor Version (1.0.0 → 1.1.0)
- New commands or features
- New options to existing commands
- Performance improvements
- Dependency updates (potentially breaking, but handled gracefully)

#### Major Version (1.0.0 → 2.0.0)
- Removal of commands or options
- Changed command behavior
- Changed output format
- Minimum Node.js version change
- Breaking configuration changes

## Post-Release Tasks

After publishing:

1. **Create GitHub Release**
   - Go to https://github.com/longmaba/ezenv-cliezenv/releases
   - Click "Draft a new release"
   - Select the version tag
   - Copy release notes from CHANGELOG.md
   - Publish release

2. **Update Documentation**
   - Update any references to the CLI version
   - Update installation instructions if needed
   - Update API documentation if commands changed

3. **Announce Release**
   - Post in team chat/Slack
   - Update project status board
   - Tweet/blog if major release

4. **Monitor npm Package**
   - Check https://www.npmjs.com/package/@ezenv/cli
   - Verify package details are correct
   - Monitor download statistics

## Troubleshooting

### npm publish fails with 403

**Problem**: No publish access to @ezenv scope

**Solution**: 
```bash
# Ensure you're logged in
npm whoami

# Check access
npm access ls-packages

# Request access from package owner
```

### Git tag already exists

**Problem**: Version already tagged in git

**Solution**:
```bash
# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin :refs/tags/v1.0.0

# Re-run version bump
npm version patch
```

### Build fails before publish

**Problem**: TypeScript or test errors

**Solution**:
1. Fix the errors
2. Commit changes
3. Re-run publish process

### Package too large

**Problem**: npm package exceeds size limits

**Solution**:
1. Check .npmignore file
2. Run `npm pack --dry-run` to see included files
3. Remove unnecessary files
4. Consider splitting into multiple packages

## Security Considerations

1. **Never publish with secrets**: Ensure no `.env` files or credentials are included
2. **Review dependencies**: Check for security vulnerabilities with `npm audit`
3. **Use 2FA**: Enable two-factor authentication on npm account
4. **Minimal permissions**: Only grant publish access to necessary team members

## Rollback Procedure

If a bad version is published:

1. **Deprecate the version**
   ```bash
   npm deprecate @ezenv/cli@1.0.1 "Critical bug, use 1.0.2 instead"
   ```

2. **Publish a fix**
   - Fix the issue
   - Bump version
   - Publish new version

3. **Unpublish (last resort)**
   ```bash
   # Only within 72 hours of publish
   npm unpublish @ezenv/cli@1.0.1
   ```
   Note: Unpublishing is discouraged and has restrictions

## Release Notes Template

When creating release notes, use this template:

```markdown
## [Version] - YYYY-MM-DD

### 🎉 New Features
- Feature description (#PR)

### 🐛 Bug Fixes
- Fix description (#PR)

### 📚 Documentation
- Documentation updates

### 🔧 Maintenance
- Dependency updates
- Internal improvements

### ⚠️ Breaking Changes
- Description of breaking change
- Migration guide
```

## Contact

For publishing access or issues:
- Team Lead: team-lead@ezenv.dev
- DevOps: devops@ezenv.dev