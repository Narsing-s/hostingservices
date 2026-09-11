# Local development

## Prerequisites

- Node.js 20+
- Docker Desktop
- npm 10+

## Start infrastructure

```bash
npm install
docker compose up -d
```

PostgreSQL is available at `localhost:5432` and Redis at `localhost:6379`. The compose credentials are development-only.

Set:

```text
DATABASE_URL=postgresql://nexus:nexus_dev_only@localhost:5432/nexus
NEXUS_SECRETS_KEY=replace-with-a-long-random-secret
```

Run services in separate terminals:

```bash
npm run dev:api
npm run dev:engine
npm run dev:agent
npm run dev
```

The first end-to-end deployment target is an existing Docker image. Example request:

```bash
curl -X POST http://localhost:4100/deployments \
  -H 'content-type: application/json' \
  -d '{"serviceId":"demo","source":{"type":"image","image":"nginx:alpine"},"port":8080}'
```

The engine talks to the local Docker Engine. On Windows Docker Desktop, the default named pipe is used; on Linux the default is `/var/run/docker.sock`. `DOCKER_HOST`/`DOCKER_SOCKET` can override this.
