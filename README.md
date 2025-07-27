# EzEnv CLI

Command-line interface for EzEnv - Secure environment variable management for development teams.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Commands](#commands)
- [Authentication](#authentication)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Installation

### Global Installation (Recommended)

```bash
npm install -g @ezenv/cli
```

### Using npx (No Installation Required)

```bash
npx @ezenv/cli [command]
```

### Using Yarn

```bash
yarn global add @ezenv/cli
```

### Using pnpm

```bash
pnpm add -g @ezenv/cli
```

## Quick Start

1. **Authenticate with EzEnv:**
   ```bash
   ezenv auth login
   ```

2. **Initialize a project in your current directory:**
   ```bash
   ezenv init
   ```

3. **Pull environment variables:**
   ```bash
   ezenv pull
   ```

That's it! Your `.env` file now contains your team's shared environment variables.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Operating System**: macOS, Linux, or Windows
- **Network**: Internet connection for API access

## Commands

### Authentication

```bash
# Login to EzEnv
ezenv auth login

# Check authentication status
ezenv auth status

# Logout from EzEnv
ezenv auth logout
```

### Project Management

```bash
# List all available projects
ezenv projects list

# Select a project to work with
ezenv projects select <project-id>
# or interactively:
ezenv projects select
```

### Environment Management

```bash
# List environments for current project
ezenv env list

# Select an environment
ezenv env select <environment-name>
# or interactively:
ezenv env select
```

### Secret Management

```bash
# Initialize EzEnv in current directory
ezenv init

# Pull secrets from selected environment
ezenv pull

# Compare local .env with remote secrets
ezenv diff

# Sync local changes to remote (coming soon)
ezenv sync

# Show current configuration status
ezenv status
```

### Command Options

Most commands support these global options:

```bash
--help, -h     Show help for a command
--version, -v  Show CLI version
--verbose      Enable verbose logging
--json         Output in JSON format (where applicable)
```

## Authentication

EzEnv CLI uses device authentication flow for secure, browser-based login:

1. Run `ezenv auth login`
2. Visit the provided URL in your browser
3. Enter the device code shown in your terminal
4. Authenticate with your EzEnv credentials
5. Return to the terminal - you're now logged in!

### Token Storage

Authentication tokens are stored securely in your system's credential store:
- **macOS**: Keychain
- **Linux**: Secret Service API/libsecret
- **Windows**: Windows Credential Manager

### Token Refresh

The CLI automatically refreshes expired tokens. If you encounter authentication issues, try logging out and back in:

```bash
ezenv auth logout
ezenv auth login
```

## Configuration

### Project Configuration

After running `ezenv init`, a `.ezenv` configuration file is created:

```json
{
  "projectId": "your-project-id",
  "environment": "development"
}
```

### Environment Variables

The CLI respects these environment variables:

- `EZENV_API_URL`: Override the default API endpoint
- `EZENV_ENVIRONMENT`: Default environment to use
- `EZENV_PROJECT_ID`: Default project ID
- `DEBUG`: Enable debug logging (`DEBUG=ezenv:*`)

### Git Integration

The CLI automatically adds `.env` to your `.gitignore` file when running `ezenv init` to prevent accidental commits of secrets.

## Troubleshooting

### Common Issues

#### Authentication Failed

```bash
Error: Authentication failed
```

**Solutions:**
- Verify your email and password are correct
- Check your internet connection
- Ensure you have an active EzEnv account
- Try logging out and back in

#### Network Connection Issues

```bash
Error: Network request failed
```

**Solutions:**
- Check your internet connection
- Verify firewall settings allow HTTPS traffic
- If behind a proxy, configure proxy settings

#### Permission Denied

```bash
Error: Permission denied writing to .env
```

**Solutions:**
- Check file permissions in your project directory
- Ensure you have write access to the current directory
- On Unix systems, you may need to use `sudo` for global installation

#### Project Not Found

```bash
Error: Project not found
```

**Solutions:**
- Run `ezenv projects list` to see available projects
- Ensure you have access to the project
- Check if you're authenticated: `ezenv auth status`

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
DEBUG=ezenv:* ezenv pull
```

### Getting Help

```bash
# Show general help
ezenv --help

# Show help for a specific command
ezenv auth --help
ezenv pull --help
```

## Development

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/longmaba/ezenv-cliezenv.git
cd ezenv/packages/cli

# Install dependencies
pnpm install

# Run in development mode
pnpm dev
```

### Available Scripts

```bash
# Development
pnpm dev          # Run CLI in development mode
pnpm dev:watch    # Run with auto-reload

# Building
pnpm build        # Build for production
pnpm build:prod   # Clean build for production

# Testing
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Generate coverage report

# Code Quality
pnpm lint         # Lint code
pnpm lint:fix     # Fix linting issues
pnpm typecheck    # Run TypeScript type checking
```

### Project Structure

```
packages/cli/
├── src/
│   ├── commands/      # Command implementations
│   ├── services/      # Business logic
│   ├── utils/         # Utility functions
│   └── index.ts       # CLI entry point
├── tests/             # Test files
├── dist/              # Compiled output
└── package.json       # Package configuration
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/longmaba/ezenv-cliezenv/blob/main/CONTRIBUTING.md) for details.

### Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/longmaba/ezenv-cliezenv/issues/new) on GitHub.

## Support

- **Documentation**: [https://docs.ezenv.dev](https://ezenv.dev/docs)
- **Issues**: [GitHub Issues](https://github.com/longmaba/ezenv-cli/issues)
- **Discord**: [Join our community](https://discord.gg/ezenv)
- **Email**: support@ezenv.dev

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

Made with ❤️ by the EzEnv Team