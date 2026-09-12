# Contributing to Nexus Hosting

Thank you for helping build Nexus Hosting. We want contributions that improve reliability, developer experience, security, portability, and real-world operability.

## Before you start

1. Read the `README.md` and `docs/` platform contracts.
2. Check existing issues and pull requests before starting substantial work.
3. For a large feature, open an issue first so the architecture can be reviewed.
4. Never commit credentials, tokens, private keys, production URLs containing secrets, or customer data.

## Local setup

Requirements:

- Node.js 20+
- Docker Desktop / Docker Engine
- Git

```bash
npm install
npm run infra:up
npm run dev:api
npm run dev:engine
npm run dev
```

For the full platform stack:

```bash
docker compose up --build
```

## Engineering principles

### Reliability first

A hosting platform must fail safely. Prefer durable state, idempotent operations, health gates, retries with bounded backoff, explicit timeouts, rollback paths, and observable failure states.

### No fake success

Do not mark a deployment, health check, release, migration, provider operation, or test as successful unless the operation actually completed. UI status must reflect backend truth.

### Provider neutrality

New infrastructure capabilities should use provider contracts instead of coupling product logic directly to one vendor. Provider-specific code belongs behind an adapter.

### Secure by default

Secrets remain server-side and encrypted at rest where applicable. Validate authorization at the API boundary. Do not expose provider credentials to browser code. Avoid logging tokens, passwords, cookies, or secret environment values.

### Backward compatibility

Public API contracts and deployment manifests should evolve deliberately. Prefer additive changes, migrations, versioned contracts, and compatibility tests.

### Observable operations

Important state changes should produce structured audit/activity information. Deployment and runtime failures should include actionable diagnostics without leaking secrets.

## Pull requests

Every pull request should explain:

- What changed and why.
- User-visible behavior.
- Failure modes and rollback behavior.
- Security or permission implications.
- Migration/configuration requirements.
- Tests performed locally and in CI.

Keep pull requests focused. Large changes should be split into independently reviewable commits when practical.

## Required validation

Before opening a PR, run the checks relevant to your change:

```bash
npm run build
docker compose config
docker compose build api web engine agent
```

For runtime changes, run the full Compose stack and verify `/health` endpoints. For UI changes, run the browser E2E workflow or equivalent Playwright tests.

Never disable a failing test merely to make CI green. Fix the underlying issue or document a justified, reviewed exception.

## Commit messages

Use clear imperative messages, for example:

- `feat: add deployment release gates`
- `fix: prevent stale deployment traffic`
- `test: cover provider health failure`
- `docs: improve production setup`

## Architecture changes

For changes to deployment lifecycle, routing, persistence, providers, security, authentication, or data schemas, update the relevant contract documentation and tests in the same change.

## Security issues

Do not open a public issue for a suspected vulnerability. Follow `SECURITY.md` instead.

## License

By contributing intentionally to this repository, you agree that your contribution is provided under the Apache License 2.0, subject to any separate written agreement with the project owner.
