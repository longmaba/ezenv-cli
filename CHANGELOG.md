# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-27

### Added
- Initial release of EzEnv CLI
- Authentication with device flow (OAuth 2.0)
- Project and environment management
- Secret pulling and synchronization
- Local `.env` file management
- Cross-platform support (macOS, Linux, Windows)
- Secure credential storage using system keychains
- Interactive command prompts
- JSON output format support
- Comprehensive error handling and user feedback

### Security
- Tokens stored in system credential stores
- All API communications over HTTPS
- Automatic token refresh
- No secrets logged or displayed in terminal output

[1.0.0]: https://github.com/ezenv/ezenv/releases/tag/v1.0.0