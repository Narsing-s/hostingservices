# Nexus implementation roadmap

## Implemented foundation
- Fastify API and deployment engine separation.
- Docker provider using the local Docker Engine socket.
- Host agent health endpoint.
- AES-256-GCM secret encryption utility.
- Local PostgreSQL and Redis development infrastructure.
- Shared deployment contracts.

## Next production milestones
1. Persist projects, services, environments, deployments and logs in PostgreSQL.
2. Add Redis/BullMQ queues for builds and deployments.
3. Add GitHub webhook verification and Git-based builds.
4. Add immutable image registry support and deployment rollbacks.
5. Add real-time deployment events/log streaming.
6. Add domains, TLS and service-to-service private networking.
7. Add Postgres branches, snapshots, backups and restore workflows.
8. Add usage metering, quotas and billing.
9. Add preview environments for pull requests.
10. Add provider adapters for Kubernetes and external cloud hosts.

The control plane must never report a deployment as healthy until the workload has actually started and passed its configured health check.
