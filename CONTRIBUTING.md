# Contributing to vikunja-mcp

Thank you for your interest in contributing to this security-hardened MCP server.

## Security-First Development

All contributions must comply with:

- **NIST SP 800-53 Rev 5** security controls
- **DoD STIG** secure coding practices
- The compliance directives in the project CLAUDE.md

### Before You Submit

- [ ] All source files include the compliance file header
- [ ] No hardcoded credentials, tokens, or secrets
- [ ] Input validation uses Zod schemas (whitelist approach)
- [ ] Error messages do not expose sensitive data (NIST SI-11)
- [ ] Mutating operations include audit logging
- [ ] New features have corresponding unit tests
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes

## Development Setup

```bash
# Clone the repository
git clone https://github.com/darkhonor/vikunja-mcp.git
cd vikunja-mcp

# Use the pinned Node.js version
nvm use

# Install dependencies
npm ci

# Build
npm run build

# Run tests
npm test

# Type check
npm run lint
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VIKUNJA_URL` | Yes | Vikunja instance URL (HTTPS only) |
| `VIKUNJA_API_TOKEN_FILE` | Preferred | Path to file containing API token |
| `VIKUNJA_API_TOKEN` | Fallback | Direct API token value |
| `VIKUNJA_LOG_LEVEL` | No | Log level: error, warn, info (default), debug |
| `VIKUNJA_RATE_LIMIT` | No | Requests per minute (default: 30) |

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes following the security guidelines above
3. Ensure all checks pass (lint, build, test)
4. Submit a PR with a clear description of changes and NIST controls addressed
5. PRs require at least one review before merging

## Reporting Security Issues

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure process.
**Do not open public issues for security vulnerabilities.**
