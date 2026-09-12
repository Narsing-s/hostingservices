# Nexus runtime security model

## Control plane

User-facing API routes authenticate through the session and organization membership. Secrets are encrypted at rest with AES-256-GCM and production requires `SECRETS_ENCRYPTION_KEY`.

## Engine plane

The engine is an internal trust boundary. Runtime, build, queue, container and managed-data endpoints require `X-Engine-Secret`, derived from `ENGINE_INTERNAL_SECRET`. Only `/health` remains unauthenticated for readiness probes.

`ENGINE_INTERNAL_SECRET` must be different from `AUTH_SECRET`, `SECRETS_ENCRYPTION_KEY`, and `ENGINE_CALLBACK_SECRET`.

## Node agents

Runtime nodes must send the same authenticated internal header for heartbeats. Production deployments should place the engine behind a private network/security group and deny direct public ingress even with the header.

## Remaining hardening

- Run builders in isolated, non-root sandboxes.
- Drop Linux capabilities and use seccomp/AppArmor or equivalent policies.
- Restrict egress from untrusted builds.
- Enforce workspace, disk, CPU, memory and execution-time limits.
- Scan built images before promotion.
- Add rate limiting and CSRF protection to the public API.
- Complete centralized RBAC coverage for all legacy project/deployment endpoints.
