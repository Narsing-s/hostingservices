# Platform routes

| Route | Purpose |
|---|---|
| `GET /api/v1/readiness` | API + engine readiness |
| `GET /api/v1/platform/overview` | Organization, project, service and deployment overview |
| `POST /api/v1/organizations` | Create organization |
| `POST /api/v1/tokens` | Create scoped API token |
| `GET /api/v1/tokens` | List user tokens |
| `DELETE /api/v1/tokens/:id` | Revoke token |
| `GET /api/v1/runtime/nodes` | Inspect runtime fleet capacity |
| `POST /api/v1/runtime/nodes` | Register/update runtime node |
| `POST /api/v1/runtime/nodes/:name/heartbeat` | Update node heartbeat/capacity |
| `POST /api/v1/services/:serviceId/managed-data` | Provision PostgreSQL/Redis |
| `GET /api/v1/services/:serviceId/managed-data` | List managed data instances |
| `GET /api/v1/audit` | Organization audit stream |
| `POST /api/v1/usage` | Record usage event |

All user-facing platform routes require a valid session. Runtime node heartbeat is an internal agent route and must be protected by a private network or service authentication before public multi-tenant deployment.
