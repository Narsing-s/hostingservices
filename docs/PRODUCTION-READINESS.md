# Production Readiness

Nexus is intended to operate as a real hosted developer cloud. **A dashboard that returns success is not enough.** A capability is production-ready only when the control plane, durable state, runtime, networking, observability, security and recovery path work together.

## 1. Real service journey

- [ ] Sign up/login works against the deployed API, not localhost.
- [ ] OAuth callbacks use exact HTTPS production URLs.
- [ ] Organization membership is created and enforced.
- [ ] Project creation persists and reloads correctly.
- [ ] A user can create a web/worker/cron/private service.
- [ ] Git/Docker deployment can be created from the UI and CLI.
- [ ] Source ref and actual source commit are recorded.
- [ ] Deployment progress survives browser refresh.
- [ ] Build logs are visible while a build is running.
- [ ] Runtime logs are visible after deployment.
- [ ] Failed deployments expose a useful reason and recovery action.
- [ ] Successful deployments expose the actual reachable URL.
- [ ] Custom domains require ownership verification.
- [ ] HTTPS/TLS is issued and renewed by the configured provider.
- [ ] Rollback changes traffic to a selected known-good generation.

## 2. Immutable artifacts

- [x] Build records the source commit.
- [x] Build records the Docker immutable image ID.
- [x] Build records a registry digest when one is available.
- [ ] Artifact identity is persisted in a dedicated provenance record.
- [ ] Promotion prefers immutable digest over mutable tag.
- [ ] Rollback uses the previously recorded immutable artifact.
- [ ] Artifact retention policy is enforced.
- [ ] SBOM is generated and retained.
- [ ] Vulnerability scan gates production promotion.
- [ ] Image signing/admission is enabled for hosted production.

## 3. Release safety

- [ ] Candidate health is verified before traffic shift.
- [ ] Required release gates can block promotion.
- [ ] Canary percentages are validated and end at 100%.
- [ ] Rollback does not rebuild the previous artifact.
- [ ] Traffic changes are durable and observable.
- [ ] Concurrent deployment requests are idempotent or safely serialized.
- [ ] Deployment generation is propagated to logs and routing decisions.
- [ ] Deployment cancellation is durable and safe.

## 4. Runtime reliability

- [ ] API, engine, agent, Postgres and Redis health endpoints work.
- [ ] Runtime node heartbeats expire safely.
- [ ] Deployment work can fail over to a healthy node.
- [ ] Queue jobs have bounded retries and backoff.
- [ ] Worker crashes are detected and recovered.
- [x] Resource limits are enforced at the runtime boundary.
- [x] Runtime containers are non-privileged.
- [x] Linux capabilities are dropped.
- [x] `no-new-privileges` is enabled.
- [x] Unsafe host filesystem binds are blocked by default.
- [ ] Runtime egress policy is enforced.
- [ ] Application containers cannot reach control-plane secrets/services.

## 5. Tenant isolation and authorization

- [ ] Every organization-owned resource resolves through organization membership.
- [ ] Project read/write operations are tenant-scoped.
- [ ] Service/deployment/domain operations are tenant-scoped.
- [ ] Cross-tenant IDs return not-found/forbidden without leaking data.
- [ ] API tokens are scope-checked on every privileged route.
- [ ] Organization roles are enforced server-side.
- [ ] Destructive operations require appropriate authorization.

## 6. Quotas, billing and abuse prevention

- [ ] Project/service/member limits are enforced before admission.
- [ ] CPU/memory/storage limits are enforced before deployment acceptance.
- [ ] Runtime/database quotas are enforced at the durable boundary.
- [ ] Deployment concurrency is limited per tenant.
- [ ] Build concurrency is limited per tenant.
- [ ] Usage is recorded from server-side runtime evidence.
- [ ] Billing usage is reconciled independently from the UI.
- [ ] Abuse/rate limits protect public API and build endpoints.
- [ ] Budget alerts and hard limits are available.

## 7. Network and SSRF security

- [ ] Git repository URLs are validated.
- [ ] User-supplied webhook/callback URLs are validated.
- [ ] Localhost/private/link-local/metadata targets are blocked where appropriate.
- [ ] DNS rebinding is considered for outbound fetches.
- [ ] Build network access is explicitly controlled.
- [ ] Runtime egress policy is configurable.
- [ ] Private services cannot accidentally become public.

## 8. Data durability

- [ ] Deployment state is persisted.
- [ ] Recovery points have a restore path.
- [ ] Database migrations are explicit and repeatable.
- [ ] Stateful workloads use persistent storage.
- [ ] Backups have retention policies.
- [ ] Backups have periodic restore verification.
- [ ] PostgreSQL/Redis credentials are generated and rotatable.
- [ ] Deletion protection is available for production databases.
- [ ] Disaster recovery procedures are documented.

## 9. Preview environments

- [ ] Pull-request previews can be created from Git events.
- [ ] Preview services are isolated from production.
- [ ] Preview URLs are generated automatically.
- [ ] Preview access can be protected.
- [ ] Closed/expired previews are automatically cleaned up.
- [ ] Preview resources count toward quotas.
- [ ] Production resources cannot be accidentally deleted by preview cleanup.

## 10. Observability

Every production operation should answer:

- What happened?
- Which user/organization/project/service caused it?
- Which deployment/generation was involved?
- Which node/provider executed it?
- How long did it take?
- What failed?
- Can it be retried safely?
- What is the next recommended action?

The UI must distinguish `Live`, `Deploying`, `Degraded`, `Failed`, `Blocked` and `Unknown`.

## 11. Webhooks and notifications

- [ ] Outbound events are signed with HMAC.
- [ ] Delivery IDs provide idempotency.
- [ ] Failed deliveries retry with bounded exponential backoff.
- [ ] Delivery attempts are observable.
- [ ] Dead-letter events are retained.
- [ ] Notifications can be configured per organization/project/service.

## 12. CI/CD gates

Required checks should include:

- TypeScript/build validation
- Platform contract tests
- Docker Compose configuration validation
- Dependency/security audit
- Secret scanning
- Full Compose smoke test
- Browser E2E
- Deployment lifecycle tests
- Rollback/canary tests
- SBOM and image scan

A green workflow is necessary but not sufficient. Production acceptance also requires a successful end-to-end deployment against a real configured environment.

## 13. Hosted production configuration

The frontend must use:

```text
NEXT_PUBLIC_NEXUS_API_URL=https://<actual-public-api-domain>
```

The API must use real production values for:

```text
DATABASE_URL
AUTH_SECRET
ENGINE_INTERNAL_SECRET
ENGINE_CALLBACK_SECRET
SECRETS_ENCRYPTION_KEY
WEB_URL=https://<console-domain>
PUBLIC_API_URL=https://<api-domain>
ENGINE_URL=https://<engine-control-domain>
```

Placeholder domains and localhost URLs are development-only.

## 14. Real hosted acceptance test

Before calling Nexus a production hosted service, run this against a real production-like environment:

```text
Create organization
  ↓
Create project/service
  ↓
Connect Git repository
  ↓
Push commit
  ↓
Webhook/deployment admission
  ↓
Quota + authorization checks
  ↓
Sandboxed build
  ↓
Record source commit + immutable image identity
  ↓
Candidate deployment
  ↓
Health gate
  ↓
HTTPS public URL
  ↓
Traffic verification
  ↓
Logs + metrics
  ↓
Second deployment
  ↓
Introduce controlled failure
  ↓
Detect failure
  ↓
Rollback known-good artifact
  ↓
Verify previous generation receives traffic
```

This test must use real DNS/TLS, PostgreSQL/Redis, durable storage, runtime nodes and the configured registry/provider. Local Docker Compose is valuable for development but is not proof of hosted production readiness.

## 15. Operational rule

If the UI says **Live**, Nexus must have evidence that the selected generation is healthy and receiving the intended traffic. If it cannot prove that, it must show **Unknown**, **Degraded**, or **Blocked** instead of claiming success.
