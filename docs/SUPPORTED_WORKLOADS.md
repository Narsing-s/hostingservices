# Nexus Hosting workload support

Nexus is designed around a workload model instead of a single framework.

## Application workloads

| Workload | Source | Public | Health | Notes |
| --- | --- | --- | --- | --- |
| Web / frontend | Git or Docker image | Yes | HTTP, Docker | Custom domains + Traefik routing |
| Backend / API | Git or Docker image | Yes or private | HTTP, Docker | Node, Python, Go, Java, Rust, .NET, PHP, Ruby auto-detection |
| Worker | Git or Docker image | No | Process, Docker | Long-running queues/consumers |
| Private service | Git or Docker image | No | Process, HTTP, Docker | Service-to-service traffic on the runtime network |
| Cron / job | Git or Docker image | No | Process, Docker | Run through the worker/runtime layer; scheduler integration is planned |

## Build behavior

1. A repository `Dockerfile` always wins.
2. If no Dockerfile exists, Nexus generates a production Dockerfile for supported project layouts.
3. Static Node/Vite/Astro/Angular applications are served by Nginx.
4. Server-side Node applications run with the project's `start` script.
5. Python projects use Gunicorn and support Django via `DJANGO_WSGI_MODULE`.
6. Go projects use a multi-stage static binary image.
7. Maven and Gradle Java projects use JRE runtime images.
8. Rust, .NET, PHP and Ruby projects have production-oriented generated images.
9. A custom `command` can override the image command at deployment time.

## Runtime features

- Redis-backed durable deployment queue
- Idempotent deployment requests
- Docker runtime isolation on a shared Nexus network
- Health-gated traffic switching for public web services
- Custom domains with DNS ownership verification
- Optional TLS through Traefik
- Environment variables without putting them in the image
- Deployment logs
- Rollback primitives
- Private workloads that do not receive public routing

## API examples

### Web service

```json
{
  "projectId": "...",
  "repo": "https://github.com/example/app",
  "serviceType": "web",
  "containerPort": 3000,
  "healthPath": "/health",
  "public": true
}
```

### Worker

```json
{
  "projectId": "...",
  "repo": "https://github.com/example/worker",
  "serviceType": "worker",
  "public": false,
  "healthMode": "process",
  "command": ["npm", "run", "worker"]
}
```

### Private backend

```json
{
  "projectId": "...",
  "repo": "https://github.com/example/api",
  "serviceType": "private",
  "public": false,
  "containerPort": 8080,
  "healthMode": "http",
  "healthPath": "/health"
}
```

## Production boundary

The current engine is a Docker-backed single-node runtime foundation. Before exposing it as a multi-tenant public cloud, add authentication/authorization, isolated build workers, image registry storage, resource quotas, encrypted secrets, persistent database provisioning, backups, scheduler execution, distributed routing and multi-node scheduling. These are platform capabilities, not something that should be simulated by the UI.
