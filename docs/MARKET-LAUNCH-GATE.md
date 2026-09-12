# Nexus Market Launch Gate

This is the release gate for a real public hosting product. A green build is not enough: Nexus may only be advertised as generally available when the required control-plane, runtime, security, reliability, billing and support paths have evidence.

## Launch tiers

### Tier 0 — Private alpha

Allowed when the platform runs only on infrastructure controlled by the operator.

Required:

- [ ] real Git/Docker deployment succeeds end-to-end;
- [ ] durable deployment state survives API/browser restart;
- [ ] queue workers process jobs after restart;
- [ ] health checks gate traffic;
- [ ] rollback restores an existing artifact;
- [ ] secrets are encrypted and redacted;
- [ ] runtime nodes cannot expose the control plane accidentally;
- [ ] backups and restore have been exercised.

### Tier 1 — Public beta

Required in addition to Tier 0:

- [ ] GitHub App/OAuth installation flow is documented and works for personal and organization repositories;
- [ ] signed webhook verification, replay protection, deduplication and bounded retries are tested;
- [ ] API authentication, project RBAC and token revocation are enforced consistently;
- [ ] abuse controls exist for builds, deployments, logs, domains, outbound network and resource consumption;
- [ ] per-tenant quotas are enforced before work reaches the runtime;
- [ ] custom domains and TLS renewal have monitoring and recovery paths;
- [ ] preview environments expire and are garbage-collected;
- [ ] deployment and runtime logs are streamed without leaking secrets;
- [ ] incident alerts and operator runbooks exist;
- [ ] a published status page or equivalent incident communication path exists;
- [ ] support contact and security disclosure process are public.

### Tier 2 — General availability

Required in addition to Tier 1:

- [ ] billing provider, plans, metering, invoices, payment failure handling and subscription lifecycle are implemented;
- [ ] resource usage is attributable to organization/project/environment/service;
- [ ] budget limits can prevent runaway builds, storage and compute;
- [ ] database backups have retention, encryption and automated restore verification;
- [ ] disaster recovery objectives are documented with tested recovery procedures;
- [ ] runtime isolation is independently reviewed for the threat model of untrusted customer workloads;
- [ ] multi-tenant data access tests cover every privileged API family;
- [ ] SLOs are measured from real production telemetry;
- [ ] canary/rollback automation is tested against injected failures;
- [ ] upgrade and migration rollback procedures are tested;
- [ ] artifact provenance and image digests are recorded for every release;
- [ ] operational ownership, on-call rotation and incident severity definitions are established.

## Non-negotiable customer journey

A new user should be able to complete:

```text
Sign up
  ↓
Create project
  ↓
Connect GitHub or provide a Git/image source
  ↓
Detect service
  ↓
Deploy
  ↓
Watch build + release evidence
  ↓
Receive a reachable URL
  ↓
Attach a custom domain
  ↓
Scale / inspect / rollback
```

The UI must never claim `Live` from an optimistic client state. `Live` requires server-side evidence that the selected generation is healthy and receiving intended traffic.

## Security launch blockers

Do not expose public customer workloads until all of these are answered:

1. How is a tenant prevented from reaching another tenant's container, filesystem, metadata, credentials or internal control-plane endpoints?
2. How are privileged engine requests authenticated and rotated?
3. How are customer-supplied Docker images, commands, repositories and build scripts isolated?
4. How are SSRF and unsafe outbound network access controlled?
5. How are logs and error payloads scrubbed for secrets?
6. How are domains prevented from being used to hijack another customer's hostname?
7. How are webhook replays prevented from creating duplicate deployments?
8. How are resource exhaustion and denial-of-wallet attacks bounded?

## Product differentiation

Nexus should compete on proof, not feature-count claims:

- **Evidence-first releases:** every promotion explains the signals that allowed it.
- **Application graph releases:** related web/API/worker/data services can be reasoned about as one topology.
- **Recovery points:** rollback restores a known-good artifact and configuration without rebuilding it.
- **Portable runtime:** Docker/provider contracts reduce infrastructure lock-in.
- **Cost-aware scheduling:** reliability and cost are both inputs to placement decisions.
- **Escape hatch:** deployment specifications remain portable enough to move infrastructure.
- **Autopilot:** incident diagnosis should recommend bounded, auditable actions rather than silently changing production.

## Release decision

`READY FOR PUBLIC BETA` requires Tier 0 + Tier 1 evidence.

`READY FOR GENERAL AVAILABILITY` requires Tier 0 + Tier 1 + Tier 2 evidence.

A repository workflow being green is necessary but never sufficient for either decision.
