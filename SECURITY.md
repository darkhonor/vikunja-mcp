# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it
responsibly. **Do not open a public GitHub issue.**

### Contact

- **Email:** security@securitymcp.io
- **Response Time:** We aim to acknowledge reports within 48 hours and provide
  a fix or mitigation plan within 7 business days.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)

### Process

1. Report the vulnerability via the contact above
2. We will acknowledge receipt within 48 hours
3. We will investigate and determine severity
4. A fix will be developed and tested
5. A security advisory will be published alongside the fix
6. Credit will be given to the reporter (unless anonymity is requested)

## Security Standards

This project is hardened against the following standards:

- **NIST SP 800-53 Rev 5** — AC, AU, IA, SC, SI control families
- **DoD STIG** — Secure coding and configuration requirements
- **FIPS 140-2/3** — Cryptographic module requirements (HTTPS enforcement)

## Security Features

- HTTPS-only transport (rejects plaintext HTTP)
- File-based credential loading (Docker/K8s secrets compatible)
- Token file permission validation
- Typed error hierarchy with sanitized messages (no data leakage)
- Structured audit logging (NIST AU-2/AU-3)
- Token-bucket rate limiting with exponential backoff
- Input validation via Zod schemas (whitelist approach)
- No use of `eval`, `exec`, or dynamic code execution

## Dependencies

Dependencies are monitored via:

- **Dependabot** — Weekly automated dependency updates
- **npm audit** — Run on every CI build (critical threshold)
- **CycloneDX SBOM** — Generated on each release for supply chain transparency
