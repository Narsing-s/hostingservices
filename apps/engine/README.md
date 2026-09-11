# Nexus Engine

The engine accepts deployment requests and places them in the durable `nexus-deployments` BullMQ queue. A separate worker consumes those jobs and performs Docker deployment/rollback.

## Runtime

- API: `npm run dev`
- Worker: `npm run dev:worker`
- Build: `npm run build`
- API port: `4100`
- Redis: `REDIS_URL` (defaults to local `redis://127.0.0.1:6379`)

## Production requirements

Run at least one engine API and one worker process, and use a persistent Redis service. The queue uses retries with exponential backoff and supports `Idempotency-Key` on deployment requests.

The Docker engine socket is a privileged control surface. Do not expose the engine API publicly without authentication and network isolation.
