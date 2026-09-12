# Support

## Start here

1. Read `README.md` and the relevant document under `docs/`.
2. Check GitHub Issues for an existing report.
3. Reproduce locally with Docker Compose when possible.
4. Include the exact command, endpoint, status, error message, commit, and relevant logs with secrets removed.

## Production incidents

For a live deployment incident, prioritize service recovery over feature changes:

1. Check deployment and runtime health.
2. Inspect logs and metrics.
3. Freeze or pause a bad rollout.
4. Roll back to the last known-good immutable deployment when appropriate.
5. Capture an incident timeline and root cause.
6. Add a regression test before closing the incident.

Never paste credentials, access tokens, cookies, private keys, or customer data into public issues.

## Feature requests

Describe the user problem, current workaround, desired behavior, and why the change should belong in Nexus rather than only in a provider-specific adapter.
