# Release readiness

## Single-node/local

- [x] Docker-backed web/worker/private deployments
- [x] Resource limits
- [x] Encrypted secrets
- [x] API token authentication
- [x] Managed PostgreSQL/Redis containers
- [x] Persistent named volumes for managed data
- [x] Runtime node registry
- [x] Readiness endpoint
- [x] Infrastructure control center

## SaaS production

- [ ] Multi-node agent authentication and scheduling
- [ ] Durable managed database HA/backups/PITR
- [ ] Build sandbox isolation and image scanning
- [ ] Streaming observability and retention
- [ ] Preview environments on pull requests
- [ ] Quotas/billing/usage enforcement
- [ ] Versioned migrations
- [ ] Full project/deployment RBAC enforcement
- [ ] Rate limiting and CSRF protection
- [ ] Production DNS/TLS automation

Do not advertise the unchecked SaaS items as production guarantees until their infrastructure is deployed and tested.
