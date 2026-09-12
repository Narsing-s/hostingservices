# Production-readiness next gate

Nexus already has runtime hardening, production configuration validation, quotas, release strategies, rollback/recovery primitives, previews, domains/TLS, and provider abstractions.

This gate defines the next non-negotiable production controls before treating the platform as a public multi-tenant PaaS.

## P0 — must be enforced in code

- [ ] Every project/service/deployment/domain query is authorized through workspace membership.
- [ ] Deployment admission performs quota preflight before returning an accepted deployment.
- [ ] Built artifacts are immutable: deployment records the source commit, image ID/digest and build provenance.
- [ ] Runtime promotion uses the immutable image digest rather than a mutable tag.
- [ ] User-controlled repository URLs and callback URLs are protected against SSRF and metadata-network access.
- [ ] Preview environments have an expiry timestamp and automatic garbage collection.
- [ ] Outbound webhooks are signed, retried with backoff, and idempotent.
- [ ] Managed database backups have retention, restore verification, and deletion protection.

## P1 — launch quality

- [ ] Usage/billing reconciliation is based on durable metering rather than request-side counters.
- [ ] Incident alerts and service-level objectives are visible to operators.
- [ ] Runtime nodes enforce egress policy and are independently replaceable.
- [ ] Image scanning/admission policy is enforced before production promotion.
- [ ] Multi-region recovery has a documented RTO/RPO and tested failover path.

## Release rule

A feature is not considered production-ready merely because a UI exposes it. The control plane, database, worker and runtime must enforce the same invariant. Any security or quota rule that can be bypassed by calling an internal endpoint directly is a launch blocker.
