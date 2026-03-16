<!--
  Filename: 2026-03-16-dockerfile-container-deployment-design.md
  Last Modified: 2026-03-16
  Summary: Design spec for containerizing vikunja-mcp with a hardened multi-stage Dockerfile
  Compliant With: DoD Container STIG, NIST SP800-53 Rev 5, FIPS 140-3
  Classification: UNCLASSIFIED
-->

# Design: Container Deployment for vikunja-mcp

**Date:** 2026-03-16
**Author:** Alex Ackerman
**Status:** Draft

## Summary

Add a hardened, multi-stage Dockerfile to the vikunja-mcp project so users can
build and run the MCP server as a container image. The container uses stdio
transport exclusively — no network ports are exposed. Users mount a token file
for Vikunja API authentication and pass non-secret configuration via an env
file.

## Goals

- Provide a portable, reproducible way to run vikunja-mcp
- Maintain the project's DoD STIG / NIST SP800-53 security posture
- Support both Docker and Podman runtimes
- Keep the existing non-containerized workflow intact

## Non-Goals

- SSE or HTTP transport (security implications not justified for single-user MCP)
- Docker Compose (stdio transport is not a long-running network service)
- Bundling a Vikunja instance (this project is a connector, not a distribution)
- Direct API token via environment variable (env vars are visible in process
  listings and container inspect output — violates NIST SC-28)

## Architecture

### Multi-Stage Dockerfile

**Base image:** `registry.access.redhat.com/ubi10/nodejs-22:10.1` for both
stages. UBI10 provides FIPS-validated crypto stack, vendor support, and STIG
benchmarks.

**Stage 1 — Builder:**

1. `WORKDIR /app`
2. Copy `package.json`, `package-lock.json`, `tsconfig.json`, `build.mjs`
3. `npm ci --ignore-scripts` — deterministic install, no post-install execution
4. Copy `src/`
5. `npm audit --audit-level=critical` — build gate for known vulnerabilities
6. `npm run lint` — TypeScript type checking gate
7. `npm run test` — all unit tests must pass before image is valid
8. `npm run build` — esbuild bundles to `dist/index.js`

**Note:** esbuild bundles all dependencies (MCP SDK, Zod) into a single
`dist/index.js` file (see `build.mjs` with `external: []`). No `node_modules`
are needed at runtime.

**Sourcemap handling:** The Dockerfile sets `ENV SOURCEMAP=false` in the builder
stage. `build.mjs` will be updated to read `process.env.SOURCEMAP !== 'false'`
to determine whether to emit sourcemaps. This preserves sourcemaps for local
development (`npm run build`) while excluding them from container builds. This
reduces image size and avoids referencing missing `.map` files in production
stack traces.

**Stage 2 — Runtime:**

1. `WORKDIR /app`
2. Create non-root user: `useradd --system --no-create-home --shell /sbin/nologin mcpuser`
   (requires `shadow-utils` — included in `ubi10/nodejs-22` but not UBI minimal)
3. Copy only `dist/index.js` from builder stage — owned by root, read-only to `mcpuser`
4. Set `ENV VIKUNJA_API_TOKEN_FILE=/run/secrets/vikunja-token`
5. OCI labels (see Labels section below)
6. `USER mcpuser`
7. `ENTRYPOINT ["node", "index.js"]`

The application directory `/app` is owned by root with `mcpuser` having
read-only access. The process only needs to execute `index.js` and read the
mounted token file — no write access required (AC-6).

**No HEALTHCHECK:** MCP stdio transport has no network endpoint to probe.
Container orchestrators should monitor the parent process (Claude Code, IDE,
etc.) instead.

**No EXPOSE:** No ports are used. The container communicates exclusively via
stdin/stdout pipes.

### Token File Contract

The container expects the Vikunja API token at a fixed path:
`/run/secrets/vikunja-token`. Users mount their local token file to this path
with read-only access. The `VIKUNJA_API_TOKEN_FILE` environment variable is
set in the Dockerfile and is not user-configurable.

This pattern is compatible with:
- Docker bind mounts (`-v /path/to/token:/run/secrets/vikunja-token:ro`)
- Podman bind mounts (same syntax, rootless by default)
- Kubernetes secrets (mount to same path)

### OCI Labels

Both `ARG` declarations belong inside the runtime stage (after the second
`FROM`). ARGs declared before `FROM` are not available inside build stages
unless re-declared.

```dockerfile
# Inside runtime stage, after FROM
ARG VERSION=1.0.0
ARG BUILD_DATE
LABEL org.opencontainers.image.authors="Alex Ackerman" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.title="vikunja-mcp" \
      org.opencontainers.image.description="Hardened MCP server for Vikunja task management" \
      org.opencontainers.image.source="https://github.com/darkhonor/vikunja-mcp" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.vendor="Alex Ackerman" \
      security-contact="security@securitymcp.io" \
      maintainer-contact="security@securitymcp.io" \
      classification="UNCLASSIFIED" \
      compliance="DoD Container STIG, NIST SP 800-53 Rev 5"
```

Build with: `podman build --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t vikunja-mcp .`

## Container Runtime Configuration

### .claude.json with Podman

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
        "-v", "/path/to/vikunja-token:/run/secrets/vikunja-token:ro",
        "darkhonor/vikunja-mcp:latest"
      ]
    }
  }
}
```

### .claude.json with Docker

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
        "-v", "/path/to/vikunja-token:/run/secrets/vikunja-token:ro",
        "darkhonor/vikunja-mcp:latest"
      ]
    }
  }
}
```

### Flags

| Flag                              | Purpose                                                        |
|-----------------------------------|----------------------------------------------------------------|
| `-i`                              | Keeps stdin open — required for MCP stdio transport            |
| `--rm`                            | Auto-remove container when MCP session ends                    |
| `--read-only`                     | Read-only root filesystem — container writes nothing to disk   |
| `--cap-drop=ALL`                  | Drop all Linux capabilities — none needed (DoD Container STIG) |
| `--security-opt=no-new-privileges`| Prevent privilege escalation via setuid/setgid binaries        |
| `--env-file`                      | Non-secret configuration (VIKUNJA_URL, log level, rate limit)  |
| `-v ...:ro`                       | Mount token file read-only into container                      |

**Critical:** Never use `-t` (TTY allocation). TTY escape sequences corrupt the
JSON-RPC protocol used by MCP.

### Example .env File

```bash
VIKUNJA_URL=https://vikunja.example.com
VIKUNJA_LOG_LEVEL=info
VIKUNJA_RATE_LIMIT=30
```

This file contains non-secret configuration only. The API token is always
provided via the mounted file at `/run/secrets/vikunja-token`.

## Files & Changes

### New Files

**`Dockerfile`**

- DoD compliance file header
- Multi-stage build as described in Architecture
- Non-root runtime user
- OCI labels
- No HEALTHCHECK, no EXPOSE (with comments explaining why)

**`.dockerignore`**

- Excludes: `node_modules/`, `dist/`, `.git/`, `.github/`, `.plans/`,
  `docs/`, `*.md`, `.env*`, `.nvmrc`, `vitest.config.*`, test coverage artifacts

### Modified Files

**`README.md`**

- New "Container Deployment" section after "Build from Source"
- Build commands for both Podman and Docker
- `.claude.json` configuration examples for both runtimes
- `.env` file example with non-secret config
- Token file mount explanation with NIST SC-28/IA-5 security rationale
- Flag reference table
- Warning about `-t` flag

## Security Controls

| NIST Control                      | Implementation                                                      |
|-----------------------------------|---------------------------------------------------------------------|
| SC-28 (Protection at Rest) | Token via mounted file only, no env var token support in container |
| IA-5 (Authenticator Management) | Fixed mount path `/run/secrets/vikunja-token`, read-only |
| CM-5 (Access Restrictions for Change) | Build gates: audit, lint, test before image is valid |
| SA-11 (Developer Testing) | Tests run during image build — failing tests block image creation |
| SR-4 (Provenance) | OCI labels with source, author, compliance metadata |
| AC-6 (Least Privilege) | Non-root `mcpuser`, no shell, no login, read-only token mount |
| SI-10 (Input Validation) | Inherited from application — Zod schemas on all tool inputs |

## Testing

### Build Verification

```bash
# Build
podman build -t vikunja-mcp:test .

# Verify non-root user
podman run --rm vikunja-mcp:test whoami
# Expected: mcpuser

# Verify no unnecessary packages
podman run --rm vikunja-mcp:test ls /usr/local/bin/
# Should show node only

# Verify single application file in /app
podman run --rm --entrypoint ls vikunja-mcp:test /app/
# Expected: index.js only
```

### Runtime Verification

```bash
# Create a test token file
echo "test-token" > /tmp/vikunja-test-token
chmod 600 /tmp/vikunja-test-token

# Verify container starts and attempts to process MCP input.
# The test token is not a real Vikunja API token, so any Vikunja API call
# will return 401. This test validates that the container starts, reads
# config, and responds to the MCP initialize handshake — not that it can
# reach Vikunja.
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | \
  podman run --rm -i \
    --read-only --cap-drop=ALL --security-opt=no-new-privileges \
    -e VIKUNJA_URL=https://vikunja.example.com \
    -v /tmp/vikunja-test-token:/run/secrets/vikunja-token:ro \
    vikunja-mcp:test
# Expected: JSON-RPC response with server capabilities
```
