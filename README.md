<!-- Filename: README.md -->
<!-- Last Modified: 2026-03-15 -->
<!-- Summary: Hardened MCP server for Vikunja task management -->
<!-- Compliant With: DoD STIG, NIST SP800-53 Rev 5 -->
<!-- Classification: UNCLASSIFIED -->

# vikunja-mcp (Hardened)

A security-hardened fork of [jrejaud/vikunja-mcp](https://github.com/jrejaud/vikunja-mcp) — an MCP server for [Vikunja](https://vikunja.io), the open-source task management app. Provides 16 tools for managing projects, tasks, and labels through Claude Code or any MCP-compatible client.

## Credit

This project is a fork of the original work by **Jordan Rejaud** ([jrejaud](https://github.com/jrejaud)). The upstream project provides a clean, functional MCP implementation with excellent architectural decisions — minimal dependencies, strict TypeScript, and Zod-based input validation. This fork builds on that solid foundation with enterprise-grade security hardening.

## Hardening Overview

This fork applies DoD STIG and NIST SP800-53 Rev 5 security controls to make the MCP suitable for deployment in security-conscious environments. The following hardening measures are planned or implemented:

### Transport Security (NIST SC-8, SC-13)

- **HTTPS Enforcement** — Reject plaintext `http://` URLs for the Vikunja API endpoint
- **Custom CA Certificate Support** — Load trusted CA bundles for environments using private PKI (e.g., DoD PKI, internal CAs)
- **TLS 1.2+ Requirement** — Enforce minimum TLS version for all API communication

### Credential Protection (NIST SC-28, IA-5)

- **Secrets Management Integration** — Support for loading API tokens from file-based secrets, environment variable indirection, or HashiCorp Vault
- **Configuration Hardening** — Guidance and tooling for secure token storage with appropriate file permissions
- **No Plaintext Tokens in Config** — Deprecate direct token embedding in `~/.claude.json`

### Audit & Accountability (NIST AU-2, AU-3)

- **Operation Logging** — Structured audit log of all create, update, and delete operations
- **Log Format** — Timestamp (UTC), operation type, resource ID, success/failure status
- **Log Integrity** — Configurable log output for integration with centralized log management

### Error Handling & Information Protection (NIST SI-11)

- **Sanitized Error Messages** — Strip raw API responses from error output to prevent information disclosure
- **Typed Error Handling** — Custom error classes for authentication failures, rate limits, validation errors, and server errors
- **Partial Failure Reporting** — Bulk operations report per-item success/failure instead of silent partial completion

### Input Validation (NIST SI-10)

- **Extended Schema Validation** — Validate color hex codes, date formats (ISO 8601), ID ranges, and URL formats beyond base Zod schemas
- **Response Validation** — Validate API responses to detect unexpected data from the server
- **URL Sanitization** — Prevent SSRF by validating the Vikunja URL against an allowlist or pattern

### Availability & Resilience (NIST SC-5)

- **Rate Limiting** — Configurable per-operation rate limits to prevent resource exhaustion
- **Bulk Operation Throttling** — Sequential batch operations with configurable concurrency limits
- **Retry with Exponential Backoff** — Automatic retry for transient failures (429, 503) with jitter

### Testing & Quality (NIST CM-5, SI-6)

- **Unit Test Suite** — Tests for client methods, input validation, and error handling
- **Integration Tests** — Mock Vikunja API tests for end-to-end tool verification
- **CI/CD Pipeline** — Automated build, test, lint, and security scanning

### Documentation & Compliance

- **Security Documentation** — Threat model, configuration hardening guide, and vulnerability disclosure process
- **Compliance Headers** — All source files include DoD STIG/NIST compliance headers
- **SBOM Generation** — Software Bill of Materials for supply chain transparency (NIST SR-4)

## Setup

### Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `VIKUNJA_URL` | Yes | Your Vikunja instance URL (**HTTPS required**) |
| `VIKUNJA_API_TOKEN` | Yes | API token from Vikunja Settings > API Tokens |
| `NODE_EXTRA_CA_CERTS` | No | Path to custom CA certificate bundle for private PKI |
| `VIKUNJA_LOG_LEVEL` | No | Logging verbosity: `error`, `warn`, `info`, `debug` (default: `info`) |

### Claude Code Configuration

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "vikunja": {
      "command": "node",
      "args": ["/path/to/vikunja-mcp/dist/index.js"],
      "env": {
        "VIKUNJA_URL": "https://vikunja.example.com",
        "VIKUNJA_API_TOKEN": "tk_your_token_here",
        "NODE_EXTRA_CA_CERTS": "/path/to/ca-chain.crt"
      }
    }
  }
}
```

## Tools (16)

### Projects
- **vikunja_list_projects** — List all projects
- **vikunja_create_project** — Create a project (supports nesting via `parent_project_id`)
- **vikunja_update_project** — Update project title, description, archive status
- **vikunja_delete_project** — Delete a project and all its tasks

### Tasks
- **vikunja_list_tasks** — List tasks across all projects (search, filter, sort, paginate)
- **vikunja_list_project_tasks** — List tasks in a specific project
- **vikunja_get_task** — Get full task details
- **vikunja_create_task** — Create a task in a project
- **vikunja_update_task** — Update task fields
- **vikunja_complete_task** — Mark a task as done
- **vikunja_delete_task** — Delete a task
- **vikunja_bulk_create_tasks** — Create multiple tasks at once

### Labels
- **vikunja_list_labels** — List all labels
- **vikunja_create_label** — Create a label with optional color
- **vikunja_add_label_to_task** — Assign a label to a task
- **vikunja_remove_label_from_task** — Remove a label from a task

## Build from Source

```bash
git clone https://github.com/darkhonor/vikunja-mcp.git
cd vikunja-mcp
npm install
npm run build
```

## API Notes

This MCP wraps the [Vikunja REST API v1](https://vikunja.io/docs/api/). A few quirks:

- Vikunja uses **PUT for creation** and **POST for updates** (opposite of typical REST)
- Listing tasks in a project requires a View ID — the MCP handles this automatically by fetching the first view
- Dates use ISO 8601 format: `2026-03-15T00:00:00Z`
- API tokens can be created in Vikunja under Settings > API Tokens

## License

MIT — See [LICENSE](LICENSE) for details.

Original work Copyright (c) 2026 Jordan Rejaud.
Hardened fork maintained by Alex Ackerman ([darkhonor](https://github.com/darkhonor)).
