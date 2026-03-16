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

# UBI Node images run as non-root by default; switch to root for build
USER 0

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

# UBI Node images run as non-root by default; switch to root for setup
USER 0

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
