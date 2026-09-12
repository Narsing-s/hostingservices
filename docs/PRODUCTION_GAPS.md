# Production gaps

Nexus now has the control-plane boundaries for organizations, environments, services, encrypted secrets, API tokens, usage, runtime nodes, managed data metadata, readiness and a live infrastructure console.

The following still require external infrastructure before a public multi-tenant launch:

1. Multi-host scheduler execution and agent authentication.
2. Hardened build sandbox with isolated network/filesystem, timeouts and image scanning.
3. Managed volume provider and snapshot/restore workflow.
4. PostgreSQL/Redis HA, backups and point-in-time recovery.
5. Streaming logs and metrics with retention and alerting.
6. GitHub App installation plus pull-request preview environments and cleanup.
7. Billing, quotas, concurrency limits and usage enforcement.
8. DNS/TLS automation at scale and wildcard preview routing.
9. Rate limiting, CSRF protection and centralized RBAC checks on every project/deployment endpoint.
10. Versioned database migrations instead of startup schema bootstrap.

These are infrastructure requirements, not UI placeholders. The current managed-data implementation is intentionally Docker-host based for local/single-node operation and must be replaced or backed by a durable provider for a production SaaS fleet.
