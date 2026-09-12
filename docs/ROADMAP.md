# Nexus production roadmap

Nexus is being built as a real hosting control plane, not a UI mock.

## Implemented

- Git and Docker-image deployments
- Web, worker, cron and private services
- Health checks, rollback and zero-downtime rollout foundation
- Organizations and RBAC
- Environments and service graph foundation
- Encrypted secrets
- Usage events and organization quotas
- Runtime node registration and capacity scheduling primitive
- Docker-backed PostgreSQL and Redis provisioning
- Persistent data volumes
- Custom domains and DNS verification
- Deployment history and runtime/build log APIs
- Preview environment lifecycle API
- Production readiness endpoint

## Next production milestones

1. **Multi-node scheduler:** reserve CPU/RAM atomically, heartbeat expiry, draining, placement and rescheduling.
2. **Build sandbox:** isolated builders, network policy, non-root execution, capability dropping, disk/time limits and workspace cleanup.
3. **Observability:** SSE/WebSocket log streaming, metrics, service events and alerting.
4. **Data plane:** snapshots, backups, restore, upgrades, replicas and managed database lifecycle.
5. **Git integration:** GitHub App installation, pull-request previews and automatic cleanup on PR close.
6. **Networking:** wildcard preview domains, automated ACME certificates and service-to-service discovery.
7. **Commercial layer:** plan limits, metering aggregation, invoices and spend controls.
8. **Reliability:** API/engine HA, queue failover, Postgres backups, disaster recovery and multi-region control-plane strategy.

## Product differentiators

- **Application graph:** source, services, data and dependencies are visible as one system.
- **Recovery-first deployments:** health, rollout and rollback are modeled together.
- **Portable runtime nodes:** self-hosted or cloud Docker capacity can join the same control plane.
- **Environment workflows:** production, staging and previews share the same service model.
- **Infrastructure autopilot:** future placement, scaling and recovery decisions can be automated without hiding operational state.
