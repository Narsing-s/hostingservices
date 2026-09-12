# Platform API quickstart

After signing in, create a project environment and a database/Redis service. Then open `/platform` in the web console.

## Readiness

```bash
curl http://localhost:4000/api/v1/readiness
```

## Runtime nodes

```bash
curl -X POST http://localhost:4000/api/v1/runtime/nodes \
  -H 'content-type: application/json' \
  --cookie 'nexus_session=YOUR_SESSION' \
  -d '{"name":"local-1","endpoint":"http://127.0.0.1:4100","region":"local","capacityCpuMillis":8000,"capacityMemoryBytes":17179869184}'
```

## Managed data

Use the service ID of a `database` or `redis` service:

```bash
curl -X POST http://localhost:4000/api/v1/services/SERVICE_ID/managed-data \
  -H 'content-type: application/json' \
  --cookie 'nexus_session=YOUR_SESSION' \
  -d '{}'
```

The response contains the endpoint but not the generated credential. The connection URI is encrypted in the platform secret store and should be injected into application services rather than copied into source code.
