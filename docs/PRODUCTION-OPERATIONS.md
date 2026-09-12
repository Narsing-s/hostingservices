# Production Hosting Operations

Nexus is intended to operate as a real developer cloud, not a demo dashboard.

## Deployment acceptance

A deployment is production-ready only when:

1. The project belongs to an authenticated organization.
2. The requested CPU, memory, storage and replica envelope is within the organization quota.
3. The build records the actual source commit.
4. The build records an immutable Docker image ID.
5. A registry digest is recorded when available.
6. The release generation passes configured health and release gates.
7. Traffic is shifted only after the candidate is healthy.
8. The previous known-good generation remains recoverable.

## Preview environments

Preview environments must have an explicit expiration time. The current preview API returns `expiresAt`; production cleanup should remove expired preview environments and their workloads while never deleting production environments.

Recommended hosted configuration:

```text
PREVIEW_CLEANUP_INTERVAL_MS=300000
PREVIEW_DEFAULT_TTL_HOURS=168
PREVIEW_MAX_TTL_HOURS=168
```

## Resource admission

CPU and memory limits are organization resources. Admission must account for the effective replica envelope:

```text
effective replicas = max(requested replicas, autoscale.max)
reserved CPU       = cpu per replica × effective replicas
reserved memory    = memory per replica × effective replicas
```

This prevents an autoscaling service from silently exceeding the organization's capacity contract.

## Artifact identity

Mutable image tags are not sufficient for production promotion. The preferred identity order is:

1. Registry digest (`repository@sha256:...`)
2. Immutable local image ID when a registry digest is not yet available
3. Source commit as provenance

Promotion and rollback should reference the immutable artifact identity rather than rebuilding an old branch or tag.

## Hosted security requirements

Production deployments must use real HTTPS public URLs and non-placeholder secrets. Runtime workloads should run without privileged mode, with Linux capabilities dropped and `no-new-privileges` enabled. Arbitrary host filesystem mounts must remain disabled for tenant workloads.

## Operational checks

Before exposing Nexus to external customers:

- Verify organization isolation with two independent users.
- Verify one organization cannot read another organization's projects, deployments, logs, secrets or domains.
- Attempt a deployment above CPU and memory quota.
- Attempt autoscaling above the quota envelope.
- Verify rollback uses the previously built artifact.
- Verify an expired preview cannot remain routable.
- Verify private services are unreachable from the public ingress.
- Verify Git/provider callbacks cannot target localhost, private address ranges or cloud metadata endpoints.
- Verify backup restore on a disposable environment.
- Verify outbound webhook signatures and retry/idempotency behavior.

## Product truth

A green dashboard status is not sufficient evidence of production health. Nexus should report `Live` only when the intended deployment generation is healthy and the traffic controller has evidence that the generation is serving successfully.
