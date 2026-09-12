# Immutable Artifact Provenance

Nexus treats a production build as an immutable artifact, not as a mutable Docker tag.

## Artifact identity

For Git-backed deployments, the provenance contract contains:

- repository URL
- requested ref
- resolved source commit
- generated or supplied Dockerfile/runtime
- Docker image reference
- immutable Docker image ID
- registry digest when available
- deployment/generation consuming the artifact

The engine build pipeline captures the source commit and image inspection data. The API database schema provides `deployment_artifacts` as the durable control-plane record.

## Persistence contract

The `deployment_artifacts` table is one-to-one with a deployment and stores:

```text
repository
ref
source_commit
image
image_id
digest
organization_id
created_at
```

A database trigger captures provenance when the deployment runtime callback contains either:

```json
{
  "buildProvenance": {
    "repository": "https://github.com/example/app",
    "ref": "main",
    "sourceCommit": "<commit-sha>",
    "image": "nexus/build:<id>",
    "imageId": "sha256:<docker-image-id>",
    "digest": "sha256:<registry-digest>"
  }
}
```

or the equivalent `artifactProvenance` object.

## Promotion rule

A release controller should prefer, in order:

1. registry digest (`image@sha256:...`) when available;
2. immutable Docker image ID for node-local execution;
3. never a mutable tag as the sole production identity.

This is important for rollback: a rollback must point to the exact previously validated artifact rather than rebuilding the old source or resolving a tag again.

## Required next integration

The remaining integration is to pass the engine's `buildFromGit()` provenance result into the API deployment lifecycle callback as `buildProvenance`. Once that callback is wired, the database trigger persists the artifact automatically.

The schema is deliberately compatible with both local Docker-only deployments and registry-backed production deployments.

## Operational checks

A production acceptance test should prove:

1. a Git deployment records the resolved source commit;
2. the built image has an immutable image ID;
3. the deployment has a corresponding `deployment_artifacts` row;
4. a registry-backed build records its digest;
5. a rollback reuses the exact artifact identity;
6. a mutable tag change cannot silently change an existing release.
