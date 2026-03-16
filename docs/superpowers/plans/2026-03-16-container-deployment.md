<!--
  Filename: 2026-03-16-container-deployment.md
  Last Modified: 2026-03-16
  Summary: Implementation plan for hardened Dockerfile and container deployment docs
  Compliant With: DoD Container STIG, NIST SP800-53 Rev 5
  Classification: UNCLASSIFIED
-->

# Container Deployment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hardened multi-stage Dockerfile and container deployment documentation so users can build and run vikunja-mcp as a container image via Podman or Docker.

**Architecture:** Multi-stage Dockerfile using `registry.access.redhat.com/ubi10/nodejs-22:10.1` for both stages. Builder stage runs audit, lint, test, and build gates. Runtime stage contains only the bundled `dist/index.js` running as a non-root user. stdio transport only — no network ports.

**Tech Stack:** Dockerfile (multi-stage), UBI10 Node 22, esbuild, Podman/Docker

**Spec:** `docs/superpowers/specs/2026-03-16-dockerfile-container-deployment-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `build.mjs` | Add SOURCEMAP env var toggle |
| Create | `Dockerfile` | Multi-stage hardened container build |
| Create | `.dockerignore` | Minimal build context |
| Modify | `README.md` | Container deployment section |

---

## Chunk 1: Build Script and Container Image

### Task 1: Update build.mjs to support SOURCEMAP env toggle

The build script currently hardcodes `sourcemap: true`. The Dockerfile needs to disable sourcemaps for production container builds via `ENV SOURCEMAP=false`.

**Files:**

- Modify: `build.mjs:23`

- [ ] **Step 1: Update sourcemap config to read env var**

In `build.mjs`, change line 23 from:

```javascript
  sourcemap: true,
```

to:

```javascript
  sourcemap: process.env.SOURCEMAP !== 'false',
```

This preserves the default behavior (`true` when env var is unset) while allowing the Dockerfile to disable it.

- [ ] **Step 2: Verify local build still produces sourcemap**

Run:

```bash
npm run build
```

Expected: `dist/index.js` and `dist/index.js.map` both exist.

```bash
ls -la dist/index.js dist/index.js.map
```

- [ ] **Step 3: Verify SOURCEMAP=false suppresses sourcemap**

Run:

```bash
rm -f dist/index.js.map
SOURCEMAP=false npm run build
```

Expected: `dist/index.js` exists, `dist/index.js.map` does NOT exist.
The `rm -f` ensures a stale sourcemap from Step 2 doesn't cause a false negative.

```bash
ls -la dist/index.js && ! ls dist/index.js.map 2>/dev/null && echo "PASS: no sourcemap"
```

- [ ] **Step 4: Commit**

```bash
git add build.mjs
git commit -m "build: add SOURCEMAP env toggle for container builds

Default behavior unchanged (sourcemaps enabled). Setting SOURCEMAP=false
disables sourcemap generation for production container images.

NIST SA-11: Build configuration management."
```

---

### Task 2: Create .dockerignore

Keep the build context minimal — only files needed by the Dockerfile should be sent to the daemon.

**Files:**

- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```dockerignore
# Filename: .dockerignore
# Last Modified: 2026-03-16
# Summary: Exclude unnecessary files from container build context
# Compliant With: DoD Container STIG, NIST SP800-53 Rev 5
# Classification: UNCLASSIFIED

# Dependencies (installed fresh in builder stage)
node_modules/

# Build output (built fresh in builder stage)
dist/

# Version control
.git/
.github/

# Documentation and planning (not needed in image)
.plans/
docs/
*.md

# Environment and secrets (must never be baked into image)
.env*

# Development config (not needed in build)
.nvmrc
vitest.config.*

# Test coverage artifacts
coverage/

# IDE
.vscode/
.idea/
```

- [ ] **Step 2: Verify build context excludes large directories**

Run:

```bash
# Show what the build context would include (approximate)
git ls-files | grep -v -E '^(node_modules|dist|\.git|\.github|\.plans|docs|coverage)/' | grep -v -E '\.(md|env)$' | grep -v -E '^(\.nvmrc|vitest\.config)'
```

Expected: Only `src/`, `package.json`, `package-lock.json`, `tsconfig.json`, `build.mjs`, `Dockerfile`, `LICENSE` and similar essential files.

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "build: add .dockerignore for minimal build context

Excludes node_modules, dist, .git, docs, .env files, coverage artifacts,
and IDE config from container build context. Dependencies and build output
are created fresh in the builder stage.

NIST CM-5: Configuration management for build artifacts."
```

---

### Task 3: Create the Dockerfile

The core deliverable — multi-stage hardened Dockerfile per the design spec.

**Files:**

- Create: `Dockerfile`

**Reference:** `docs/superpowers/specs/2026-03-16-dockerfile-container-deployment-design.md` — Architecture section

- [ ] **Step 1: Create the Dockerfile**

```dockerfile
# Filename: Dockerfile
# Last Modified: 2026-03-16
# Summary: Multi-stage hardened container build for vikunja-mcp
# Compliant With: DoD Container STIG, NIST SP800-53 Rev 5
# Classification: UNCLASSIFIED
#
# Security Controls:
#   SC-28, IA-5  — Token via mounted file only (/run/secrets/vikunja-token)
#   CM-5, SA-11  — Build gates: npm audit, lint, test before image is valid
#   AC-6         — Non-root runtime user, no shell, no home directory
#   SR-4         — OCI labels for provenance and compliance metadata
#
# No HEALTHCHECK: MCP uses stdio transport — no network endpoint to probe.
# No EXPOSE: No ports used. Communication is exclusively via stdin/stdout.

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM registry.access.redhat.com/ubi10/nodejs-22:10.1 AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching (NIST CM-5)
COPY package.json package-lock.json tsconfig.json build.mjs ./

# Deterministic install — no post-install script execution (SA-11)
RUN npm ci --ignore-scripts

# Copy source
COPY src/ src/

# Build gates — all must pass before image is valid
# Security audit: fail on critical vulnerabilities (RA-5)
RUN npm audit --audit-level=critical

# Type checking gate (SA-11)
RUN npm run lint

# Unit tests — 81 tests must pass (SA-11)
RUN npm run test

# Production build — sourcemaps disabled for container image
ENV SOURCEMAP=false
RUN npm run build

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM registry.access.redhat.com/ubi10/nodejs-22:10.1

WORKDIR /app

# OCI labels for provenance and compliance (SR-4)
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

# Create non-root runtime user (AC-6)
# shadow-utils is included in ubi10/nodejs-22 (not UBI minimal)
RUN useradd --system --no-create-home --shell /sbin/nologin mcpuser

# Copy only the bundled application from builder stage
# esbuild bundles all dependencies (MCP SDK, Zod) into a single file
# (see build.mjs with external: []). No node_modules needed at runtime.
COPY --from=builder /app/dist/index.js ./index.js

# Token file mount point — fixed path, not user-configurable (SC-28, IA-5)
ENV VIKUNJA_API_TOKEN_FILE=/run/secrets/vikunja-token

# Application directory owned by root, read-only to mcpuser (AC-6)
RUN chown root:root /app/index.js && chmod 444 /app/index.js

# Drop to non-root user (AC-6)
USER mcpuser

ENTRYPOINT ["node", "index.js"]
```

- [ ] **Step 2: Build the image**

Run:

```bash
podman build --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t vikunja-mcp:test .
```

Expected: Build completes successfully. All audit, lint, and test gates pass during the builder stage.

- [ ] **Step 3: Verify non-root user**

Run:

```bash
podman run --rm --entrypoint whoami vikunja-mcp:test
```

Expected output: `mcpuser`

- [ ] **Step 4: Verify single application file**

Run:

```bash
podman run --rm --entrypoint ls vikunja-mcp:test /app/
```

Expected output: `index.js` (only file in /app)

- [ ] **Step 5: Verify OCI labels**

Run:

```bash
podman inspect vikunja-mcp:test --format '{{index .Config.Labels "compliance"}}'
```

Expected output: `DoD Container STIG, NIST SP 800-53 Rev 5`

- [ ] **Step 6: Verify no sourcemap in image**

Run:

```bash
podman run --rm --entrypoint ls vikunja-mcp:test /app/
```

Expected: Only `index.js`, no `index.js.map`.

- [ ] **Step 7: Runtime verification — MCP initialize handshake**

Run:

```bash
echo "test-token" > /tmp/vikunja-test-token && chmod 600 /tmp/vikunja-test-token

echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | \
  podman run --rm -i \
    --read-only --cap-drop=ALL --security-opt=no-new-privileges \
    -e VIKUNJA_URL=https://vikunja.example.com \
    -v /tmp/vikunja-test-token:/run/secrets/vikunja-token:ro \
    vikunja-mcp:test
```

Expected: JSON-RPC response containing server capabilities (the Vikunja API call will fail with 401 since the token is fake, but the MCP handshake should succeed).

Clean up:

```bash
rm /tmp/vikunja-test-token
```

- [ ] **Step 8: Commit**

```bash
git add Dockerfile
git commit -m "feat: add hardened multi-stage Dockerfile

UBI10 Node 22 base image for both stages. Builder runs npm audit,
lint, and test gates before producing the bundle. Runtime stage
contains only the bundled index.js running as non-root mcpuser.

Security controls:
- SC-28, IA-5: Token via mounted file at /run/secrets/vikunja-token
- CM-5, SA-11: Build gates (audit, lint, test) block invalid images
- AC-6: Non-root user, no shell, no home, read-only app directory
- SR-4: OCI labels with provenance and compliance metadata

No HEALTHCHECK (stdio transport, no network endpoint).
No EXPOSE (no ports, stdin/stdout only)."
```

---

## Chunk 2: README Documentation

### Task 4: Add Container Deployment section to README

Add documentation between "Build from Source" and "API Notes" sections.

**Files:**

- Modify: `README.md:103` (after "Build from Source" section, before "API Notes")

- [ ] **Step 1: Add Container Deployment section**

Insert the following after line 103 (after the closing ``` of Build from Source) and before the `## API Notes` heading:

```markdown
## Container Deployment

### Build the Image

```bash
# Podman (recommended for DoD environments — rootless, daemonless)
podman build --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t vikunja-mcp .

# Docker
docker build --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t vikunja-mcp .
```

The multi-stage build runs `npm audit`, type checking, and all 81 unit tests as
build gates. A failing gate blocks image creation (NIST CM-5, SA-11).

> **Note:** These examples use the local image tag `vikunja-mcp:latest`. If
> publishing to a registry, substitute with the registry-qualified name
> (e.g., `darkhonor/vikunja-mcp:latest`).

### Configure Claude Code

Create a `.env` file with non-secret configuration:

```bash
VIKUNJA_URL=https://vikunja.example.com
VIKUNJA_LOG_LEVEL=info
VIKUNJA_RATE_LIMIT=30
```

Create a token file containing your Vikunja API token:

```bash
echo "your-api-token" > ~/.config/vikunja-mcp/token
chmod 600 ~/.config/vikunja-mcp/token
```

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
        "vikunja-mcp:latest"
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
        "vikunja-mcp:latest"
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
```

- [ ] **Step 2: Verify README renders correctly**

Run:

```bash
head -180 README.md
```

Verify the new section appears between "Build from Source" and "API Notes" with correct formatting.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add container deployment section to README

Documents build commands (Podman and Docker), .claude.json configuration
for both runtimes, runtime hardening flags, .env file setup, and
token file authentication with NIST SC-28/IA-5 security rationale.

Includes warning about -t flag corrupting MCP stdio protocol."
```

---

## Final Verification

After all tasks are complete:

> **Note:** All verification commands use `podman`. Docker users should
> substitute `docker` for `podman` in each command.

- [ ] **Run the full test suite to confirm nothing is broken**

```bash
npm run lint && npm test
```

Expected: Type checking passes, all 81 tests pass.

- [ ] **Verify README section ordering is intact**

```bash
grep -n "^## " README.md
```

Expected: Sections appear in order: Setup, Tools, Build from Source,
Container Deployment, API Notes, Security & Compliance, License.

- [ ] **Rebuild the container image from clean state**

```bash
podman rmi vikunja-mcp:test 2>/dev/null; podman build --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) -t vikunja-mcp:test .
```

Expected: Clean build succeeds with all gates passing.

- [ ] **Run end-to-end container test with hardening flags**

```bash
echo "test-token" > /tmp/vikunja-test-token && chmod 600 /tmp/vikunja-test-token

echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | \
  podman run --rm -i \
    --read-only --cap-drop=ALL --security-opt=no-new-privileges \
    -e VIKUNJA_URL=https://vikunja.example.com \
    -v /tmp/vikunja-test-token:/run/secrets/vikunja-token:ro \
    vikunja-mcp:test

rm /tmp/vikunja-test-token
```

Expected: JSON-RPC response with server capabilities. The test token is fake,
so any Vikunja API calls would return 401 — this test validates the MCP
handshake, not Vikunja connectivity.
