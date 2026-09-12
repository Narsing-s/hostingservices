# Production Readiness

Nexus is a hosting platform, so "build passes" is not the definition of done. This checklist is used before calling a capability production-ready.

## 1. User journey

- [ ] Sign up/login works against the deployed API, not localhost.
- [ ] OAuth callbacks use exact HTTPS production URLs.
- [ ] Project creation persists and reloads correctly.
- [ ] Git/Docker deployment can be created from the UI and CLI.
- [ ] Deployment progress survives browser refresh.
- [ ] Logs are visible while a deployment is running.
- [ ] Failed deployments expose a useful reason and recovery action.
- [ ] Successful deployments expose the actual reachable URL.
- [ ] Rollback changes traffic to the selected known-good generation.

## 2. Release safety

- [ ] Candidate health is verified before traffic shift.
- [ ] Required release gates can block promotion.
- [ ] Canary percentages are validated and end at 100%.
- [ ] Rollback does not rebuild the previous artifact.
- [ ] Traffic changes are durable and observable.
- [ ] Concurrent deployment requests are idempotent or safely serialized.
- [ ] Deployment generation is propagated to logs and routing decisions.

## 3. Runtime reliability

- [ ] API, engine, agent, Postgres and Redis health endpoints work.
- [ ] Runtime node heartbeats expire safely.
- [ ] Deployment work can fail over to a healthy node.
- [ ] Queue names are valid for BullMQ/Redis and stable across restarts.
- [ ] Worker crashes are retried with bounded backoff.
- [ ] Resource limits are enforced at the runtime boundary.
- [ ] Containers cannot accidentally expose internal control-plane services.

## 4. Security

- [ ] No secrets are bundled into frontend JavaScript.
- [ ] Production web builds require an explicit public API URL.
- [ ] API authorization is checked for every privileged project/environment operation.
- [ ] OAuth state is signed and validated.
- [ ] Tokens can expire and be revoked.
- [ ] Secret values are redacted from logs and error payloads.
- [ ] User-provided repositories, images, domains, commands and paths are validated.
- [ ] Security reports have a private disclosure path.

## 5. Data durability

- [ ] Deployment state is persisted.
- [ ] Recovery points have a restore path.
- [ ] Database migrations are explicit and repeatable.
- [ ] Stateful workloads use persistent storage.
- [ ] Backups have retention and restore verification.
- [ ] Destructive operations require appropriate authorization.

## 6. Observability

Every production operation should answer:

- What happened?
- Which user/project/environment caused it?
- Which deployment/generation was involved?
- Which node/provider executed it?
- How long did it take?
- What failed?
- Can it be retried safely?
- What is the next recommended action?

## 7. CI/CD gates

Required checks should include, as applicable:

- TypeScript/build validation
- Platform contract tests
- Docker Compose configuration validation
- Dependency/security audit
- Secret scanning
- Full Compose smoke test
- Browser E2E
- Deployment lifecycle tests
- Rollback/canary tests

A green workflow is necessary but not sufficient: production acceptance also requires a successful end-to-end deployment against a real configured environment.

## 8. Hosted production configuration

The frontend must use:

```text
NEXT_PUBLIC_NEXUS_API_URL=https://<actual-public-api-domain>
```

The API must use real production values for `WEB_URL`, `PUBLIC_API_URL`, `AUTH_SECRET`, database/Redis connectivity, OAuth callbacks, and any provider credentials. Placeholder domains and localhost URLs are development-only.

## 9. Operational rule

If the UI says **Live**, the platform must have evidence that the selected generation is actually healthy and receiving the intended traffic. If the platform cannot prove that, it must show **Unknown**, **Degraded**, or **Blocked** instead of claiming success.
