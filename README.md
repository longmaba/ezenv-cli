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
# Authenticate with email and password
ezenv auth login

# Check authentication status
ezenv auth status

# Logout
ezenv auth logout

# List projects
ezenv projects list

# Select a project
ezenv projects select <project-id>

# Pull secrets to .env file
ezenv pull

# Initialize a new project
ezenv init
```

## Authentication

The CLI uses email/password authentication. When you run `ezenv auth login`, you'll be prompted to enter:
1. Your email address
2. Your password (input is masked for security)

The authentication tokens are stored securely in your system's credential store.

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

## Troubleshooting

### Authentication Issues

- **Invalid email or password**: Double-check your credentials. Passwords are case-sensitive.
- **Network connection failed**: Check your internet connection and firewall settings.
- **Rate limiting**: If you see "Too many authentication attempts", wait a few minutes before trying again.
- **Token expired**: The CLI will automatically refresh your token. If issues persist, run `ezenv auth logout` followed by `ezenv auth login`.

### Environment Variables

Make sure you have the following environment variables set:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

## License

MIT