# Nexus manifest (`nexus.yaml`)

Nexus supports a declarative deployment manifest through the CLI.

## Commands

```bash
nexus validate nexus.yaml
nexus deploy nexus.yaml
```

Set `NEXUS_API_URL` when the API is not local:

```bash
NEXUS_API_URL=https://api.example.com nexus deploy nexus.yaml
```

On Windows PowerShell:

```powershell
$env:NEXUS_API_URL="https://api.example.com"
nexus deploy nexus.yaml
```

## Supported manifest

```yaml
version: 1
name: my-service

service:
  type: web
  source:
    type: git
    repo: https://github.com/example/my-service.git
    ref: main
  build:
    runtime: auto
    service: frontend
  runtime:
    port: 3000
    health:
      path: /health
      mode: auto
  deploy:
    replicas: 1
    zeroDowntime: true
    rollbackOnFailure: true

env:
  NODE_ENV: production

secrets:
  - DATABASE_URL
  - API_KEY
```

### Important behavior

- `version` must be `1`.
- Git is currently the supported manifest source type for `nexus deploy`.
- `service.build.service` selects a discovered monorepo service such as `backend`, `frontend`, or `sandbox-worker`.
- `env` values are sent as deployment environment variables.
- `secrets` declares names only. Secret values must be configured through Nexus and must not be committed to Git.
- `service.runtime.port`, `health.path`, and `health.mode` map to the existing deployment API.
- `service.deploy.replicas`, `zeroDowntime`, and `rollbackOnFailure` are validated as manifest fields; runtime orchestration for those policies remains a platform capability being expanded separately.
- `nexus deploy` creates a Nexus project and submits the deployment to the existing API lifecycle (`queued → building → starting → ready/failed`).

## CI usage

A safe CI pattern is to validate pull requests and deploy only from a protected branch:

```bash
nexus validate nexus.yaml
# after approval / protected-branch checks:
nexus deploy nexus.yaml
```

Never put passwords, API keys, database credentials, or provider tokens in `nexus.yaml`.
