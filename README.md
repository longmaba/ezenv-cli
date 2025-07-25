# EzEnv CLI

Command-line interface for EzEnv - Secure environment variable management platform.

## Installation

```bash
npm install -g @ezenv/cli
# or
npx @ezenv/cli
```

## Requirements

- Node.js >= 18.0.0
- pnpm >= 8.0.0 (for development)

## Usage

```bash
# Authenticate
ezenv auth login

# List projects
ezenv projects list

# Select a project
ezenv projects select <project-id>

# Pull secrets to .env file
ezenv pull

# Initialize a new project
ezenv init
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

## License

MIT