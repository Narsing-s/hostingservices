# Monorepo deployments

Nexus supports repositories that contain multiple deployable services, such as:

```text
my-repo/
  backend/
    Dockerfile
  frontend/
    Dockerfile
```

## Automatic selection

When a repository has multiple first-level Dockerfiles, the engine discovers all of them. If no service is specified, Nexus prefers a service named `backend`, `api`, `server`, or `app`; otherwise it uses the first discovered service.

The build log reports the selected service and all discovered services.

## Explicit service selection

The runtime build API accepts an optional `service` field:

```json
{
  "repo": "https://github.com/Narsing-s/dw-ai-copilot",
  "ref": "main",
  "image": "nexus/build:dwcopilot-backend",
  "service": "backend"
}
```

For the frontend:

```json
{
  "repo": "https://github.com/Narsing-s/dw-ai-copilot",
  "ref": "main",
  "image": "nexus/build:dwcopilot-frontend",
  "service": "frontend"
}
```

The deployment API also accepts `service` and forwards it to the engine.

## Local verification

From the repository root:

```bash
npm install
npm run build
npm run dev:engine
```

Then test the engine directly:

```bash
curl -X POST http://localhost:4100/api/v1/runtime/build \
  -H "content-type: application/json" \
  -d '{"repo":"https://github.com/Narsing-s/dw-ai-copilot","ref":"main","image":"nexus/test:dw-backend","service":"backend"}'
```

To test the frontend service, change `service` to `frontend` and use a different image tag.

## CLI compatibility

A CLI that sends builds to Nexus should pass the optional service through to `/api/v1/runtime/build`. Older CLI binaries that only send `repo`, `ref`, and `image` still work because Nexus performs automatic monorepo detection.
