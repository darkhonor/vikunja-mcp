<!-- Filename: README.md -->
<!-- Last Modified: 2026-03-16 -->
<!-- Summary: Hardened MCP server for Vikunja task management -->
<!-- Compliant With: DoD STIG, NIST SP800-53 Rev 5 -->
<!-- Classification: UNCLASSIFIED -->

# vikunja-mcp (Hardened)

> **This is a fork of [jrejaud/vikunja-mcp](https://github.com/jrejaud/vikunja-mcp) by [Jordan Rejaud](https://github.com/jrejaud).**
> The original project is an excellent, cleanly architected MCP server for
> [Vikunja](https://vikunja.io) with minimal dependencies, strict TypeScript,
> and Zod-based input validation. All credit for the original design and
> implementation belongs to Jordan. This fork applies security hardening
> for use in DoD and enterprise environments.

A [Model Context Protocol](https://modelcontextprotocol.io/) server that connects AI assistants to [Vikunja](https://vikunja.io) task management. 16 tools for managing projects, tasks, and labels — hardened for DoD and enterprise deployment.

## Setup (Container — Recommended)

### Pull from GHCR

```bash
# Pull the latest release
docker pull ghcr.io/darkhonor/vikunja-mcp:latest

# Or a specific version
docker pull ghcr.io/darkhonor/vikunja-mcp:1.0.0
```

Multi-architecture images are available for `linux/amd64` and `linux/arm64`.

### Build Locally

```bash
# Podman (recommended for DoD environments — rootless, daemonless)
podman build --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t vikunja-mcp .

# Docker
docker build --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t vikunja-mcp .
```

The multi-stage build runs `npm audit`, type checking, and all 81 unit tests as
build gates. A failing gate blocks image creation (NIST CM-5, SA-11).

### Configure Claude Code

Create a `.env` file with non-secret configuration:

```bash
VIKUNJA_URL=https://vikunja.example.com
VIKUNJA_LOG_LEVEL=info
VIKUNJA_RATE_LIMIT=30
```

Create a token file containing your Vikunja API token:

```bash
mkdir -p ~/.config/vikunja-mcp
echo "your-api-token" > ~/.config/vikunja-mcp/token
chmod 604 ~/.config/vikunja-mcp/token
```

> **Note:** The token file must be readable by the container user (UID 998).
> Use `chmod 604` (owner read-write, others read) for local Docker/Podman
> bind mounts. In Kubernetes, use `fsGroup` in the pod security context to
> match the file group to the container user.

Add to `~/.claude.json`:

**Podman:**

```json
{
  "mcpServers": {
    "vikunja": {
      "command": "podman",
      "args": [
        "run", "--rm", "-i",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--env-file", "/path/to/.env",
        "-v", "/path/to/token:/run/secrets/vikunja-token:ro",
        "ghcr.io/darkhonor/vikunja-mcp:latest"
      ]
    }
  }
}
```

**Docker:**

```json
{
  "mcpServers": {
    "vikunja": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--env-file", "/path/to/.env",
        "-v", "/path/to/token:/run/secrets/vikunja-token:ro",
        "ghcr.io/darkhonor/vikunja-mcp:latest"
      ]
    }
  }
}
```

### Runtime Flags

| Flag | Purpose |
| ---- | ------- |
| `-i` | Keeps stdin open — required for MCP stdio transport |
| `--rm` | Auto-remove container when MCP session ends |
| `--read-only` | Read-only root filesystem — container writes nothing to disk |
| `--cap-drop=ALL` | Drop all Linux capabilities (DoD Container STIG) |
| `--security-opt=no-new-privileges` | Prevent privilege escalation via setuid/setgid |
| `--env-file` | Non-secret configuration (URL, log level, rate limit) |
| `-v ...:ro` | Mount token file read-only into container |

> **Warning:** Never use `-t` (TTY allocation). TTY escape sequences corrupt
> the JSON-RPC protocol used by MCP stdio transport.

### Token Authentication (NIST SC-28, IA-5)

The container expects the API token mounted as a file at
`/run/secrets/vikunja-token`. This path is fixed and not configurable.
The `.env` file contains only non-secret configuration — the token is
**never** passed as an environment variable.

Environment variables are visible in process listings (`ps auxe`) and container
inspect output (`podman inspect`). File-based secrets avoid this exposure.

## Setup (Node.js — Alternative)

If you prefer to run the MCP server directly without a container:

### Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `VIKUNJA_URL` | Yes | Your Vikunja instance URL (**HTTPS required**) |
| `VIKUNJA_API_TOKEN_FILE` | Preferred | Path to file containing API token |
| `VIKUNJA_API_TOKEN` | Fallback | Direct API token value |
| `VIKUNJA_LOG_LEVEL` | No | Logging verbosity: `error`, `warn`, `info` (default), `debug` |
| `VIKUNJA_RATE_LIMIT` | No | Max requests per minute (default: 30) |
| `NODE_EXTRA_CA_CERTS` | No | Path to custom CA certificate bundle for private PKI |

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
        "VIKUNJA_API_TOKEN_FILE": "/path/to/vikunja-token",
        "NODE_EXTRA_CA_CERTS": "/path/to/ca-chain.crt"
      }
    }
  }
}
```

### Build from Source

```bash
git clone https://github.com/darkhonor/vikunja-mcp.git
cd vikunja-mcp
nvm use           # Uses .nvmrc (Node 22)
npm install
npm run build
npm test          # 81 tests across 5 modules
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
- **vikunja_bulk_create_tasks** — Create multiple tasks at once (1-50, rate-limited)

### Labels

- **vikunja_list_labels** — List all labels
- **vikunja_create_label** — Create a label with optional color
- **vikunja_add_label_to_task** — Assign a label to a task
- **vikunja_remove_label_from_task** — Remove a label from a task

## API Notes

This MCP wraps the [Vikunja REST API v1](https://vikunja.io/docs/api/). A few quirks:

- Vikunja uses **PUT for creation** and **POST for updates** (opposite of typical REST)
- Listing tasks in a project requires a View ID — the MCP handles this automatically by fetching the first view
- Dates use ISO 8601 format: `2026-03-15T00:00:00Z`
- API tokens can be created in Vikunja under Settings > API Tokens

## Security & Compliance

This fork implements the following DoD STIG and NIST SP800-53 Rev 5 security controls:

### Transport Security (SC-8, SC-13)

- HTTPS enforced at startup — plaintext `http://` URLs are rejected
- Custom CA support via `NODE_EXTRA_CA_CERTS` for private PKI (DoD PKI, internal CAs)

### Credential Protection (SC-28, IA-5)

- File-based token loading via `VIKUNJA_API_TOKEN_FILE` (Docker/K8s secrets compatible)
- Token file permission validation — warns on world-readable files
- Tokens never appear in logs or error messages

### Audit Logging (AU-2, AU-3)

- Structured JSON audit entries written to stderr (MCP convention)
- Mutating operations (create/update/delete) logged at `info` level
- Read operations logged at `debug` level for low-noise production use
- Configurable via `VIKUNJA_LOG_LEVEL` environment variable
- Fields: timestamp (ISO 8601), level, operation, resource, resourceId, status, error

### Error Handling (SI-11)

- Typed error hierarchy: `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ValidationError`, `RateLimitError`, `ServerError`
- Raw API response bodies stored privately for debug — never surfaced to MCP output
- Bulk operations report per-item success/failure for forensic traceability

### Input Validation (SI-10)

- Zod schemas enforce whitelist validation on all tool inputs
- Validated types: positive IDs, hex color codes (`#RRGGBB`), ISO 8601 datetimes, priority (0-4), pagination bounds (1-200), sort order
- Bulk create bounded to 1-50 tasks per call

### Rate Limiting & Resilience (SC-5)

- Token-bucket rate limiter — configurable via `VIKUNJA_RATE_LIMIT` (default: 30 req/min)
- Automatic retry on 429 (Too Many Requests) and 503 (Service Unavailable)
- Exponential backoff with jitter: base 1s, max 30s, up to 3 retries
- Respects `Retry-After` header from Vikunja

### Testing & CI/CD (CM-5, SI-6, SA-11)

- 81 unit tests across 5 modules (Vitest)
- CI pipeline: build, lint, test on Node 20 and 22
- npm audit on every build (critical threshold)
- CycloneDX SBOM generated on each release (SR-4)
- Dependabot for weekly dependency monitoring
- Branch protection with required reviews

### Documentation & Compliance (PL-2)

- All source files carry DoD STIG/NIST SP800-53 compliance headers
- SECURITY.md with vulnerability disclosure process
- CODEOWNERS for review enforcement on security-critical files

## License

MIT — See [LICENSE](LICENSE) for details.

Original work Copyright (c) 2026 Jordan Rejaud.
Hardened fork maintained by Alex Ackerman ([darkhonor](https://github.com/darkhonor)).
