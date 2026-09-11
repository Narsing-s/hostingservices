# Nexus CLI

The repository now includes a first-party `nexus` CLI for repository builds and monorepo service discovery.

## Install locally

From the repository root:

```bash
npm install
npm link ./packages/cli
```

Verify:

```bash
nexus --help
```

If a previous global Nexus CLI is installed, the linked workspace CLI should be the one resolved by `npm`.

## Discover services

```bash
nexus services https://github.com/Narsing-s/dw-ai-copilot @ main
```

For a repository with `backend/Dockerfile` and `frontend/Dockerfile`, Nexus reports both services.

## Build a service

```bash
nexus build https://github.com/Narsing-s/dw-ai-copilot @ main --service backend
```

Or select the frontend:

```bash
nexus build https://github.com/Narsing-s/dw-ai-copilot @ main --service frontend
```

Without `--service`, the engine keeps backward compatibility and automatically selects a preferred backend-like service (`backend`, `api`, `server`, `app`) when multiple first-level Dockerfiles exist.

## Engine location

The CLI sends build and discovery requests to:

```text
http://localhost:4100
```

Override it for a remote Nexus engine:

```bash
NEXUS_ENGINE_URL=https://your-engine.example.com nexus services https://github.com/owner/repo @ main
```

## Product behavior

Nexus now has three layers for monorepos:

1. **Engine detection** discovers first-level Dockerfile services and supported runtimes.
2. **API discovery** exposes `/api/v1/repositories/detect` for the web console and other clients.
3. **CLI** exposes `nexus services` and `nexus build --service` for developer workflows.

Older clients that send only repository, ref and image remain supported because service selection is optional.
