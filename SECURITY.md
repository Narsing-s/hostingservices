# Security Policy

## Supported versions

The `main` branch is the actively maintained development line. Security fixes should target the latest supported release or `main` unless a maintainer explicitly coordinates a backport.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for a security vulnerability.

Use GitHub's private security advisory/reporting flow for this repository when available. If private reporting is unavailable, contact the repository maintainers privately and include only the information needed to reproduce the issue.

Include:

- A clear description of the vulnerability.
- Affected component and version/commit.
- Reproduction steps or a minimal proof of concept.
- Expected versus actual behavior.
- Potential impact and severity.
- Any safe mitigation you know.

Do not include real customer data, passwords, access tokens, private keys, or production secrets in a report.

## What to expect

Maintainers will acknowledge a credible report as soon as reasonably possible, investigate it, and coordinate a fix and disclosure timeline. Please allow time for validation, patching, and downstream release preparation before public disclosure.

## Security design expectations

Nexus is a hosting control plane, so security-sensitive changes require extra care around:

- Authentication and authorization.
- OAuth callback validation and signed state.
- API tokens, scopes, expiry, and revocation.
- Secrets storage and redaction.
- Tenant/project/environment isolation.
- Container and runtime-node boundaries.
- Deployment artifact provenance.
- Provider credentials and webhooks.
- Audit events and privileged operations.
- SSRF, command injection, path traversal, and container escape risks.

Never put credentials into frontend bundles, logs, screenshots, fixtures, tests, or committed `.env` files.
