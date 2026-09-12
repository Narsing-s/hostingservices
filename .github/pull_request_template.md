## Summary

<!-- What changed and why? -->

## User impact

- [ ] No user-visible change
- [ ] UI / developer experience
- [ ] Deployment / runtime behavior
- [ ] API / CLI contract
- [ ] Security / permissions
- [ ] Data / migration

## Reliability checklist

- [ ] Failure paths are explicit.
- [ ] Operations are idempotent where retries are possible.
- [ ] Timeouts and bounded retries are present where needed.
- [ ] Health/readiness behavior reflects real service state.
- [ ] Rollback/recovery behavior is considered.
- [ ] Logs and audit/activity data do not expose secrets.

## Validation

- [ ] `npm run build`
- [ ] `docker compose config`
- [ ] Relevant unit/contract tests
- [ ] Runtime/Compose smoke test
- [ ] Browser E2E / UI verification (when applicable)

## Security

- [ ] No secrets or credentials were added.
- [ ] Authorization is enforced server-side.
- [ ] User-controlled URLs, paths, commands, and images are validated.
- [ ] Security-sensitive changes are covered by tests or documented review.

## Documentation

- [ ] README/docs updated when behavior or contracts changed.
- [ ] Configuration/migration steps documented.

## Rollback

<!-- How can this change be safely reverted or rolled back? -->
