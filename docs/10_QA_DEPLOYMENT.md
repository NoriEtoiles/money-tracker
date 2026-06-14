# 10 QA and Deployment

## QA Strategy

Testing layers:
- unit tests,
- integration tests,
- e2e smoke tests,
- security tests,
- performance tests for reports/imports.

## Required Unit Tests

- amount calculation
- account balance update
- transfer creation
- budget spent calculation
- recurring transaction schedule
- CSV row validation
- report aggregation

## Required Integration Tests

- register/login/logout
- create account
- create transaction
- update transaction
- delete transaction
- create transfer
- create budget
- list dashboard
- export transactions
- cross-user authorization denial

## Required E2E Flows

Step 15A adds API-level e2e/security smoke tests that start the built API,
exercise it over HTTP against PostgreSQL, and clean up disposable test users.
Browser e2e remains deferred.

### Flow 1: First User Setup

- register
- login
- create account
- add transaction
- view dashboard

### Flow 2: Budgeting

- create category
- create budget
- create expense
- see budget usage

### Flow 3: Export

- create transactions
- request export
- download CSV
- verify audit event

## CI Pipeline

Minimum pipeline:

```txt
install
→ migrate deploy
→ generate Prisma client
→ typecheck
→ lint
→ unit tests
→ API e2e/security smoke tests
→ build
```

CI must use `prisma migrate deploy` against the test PostgreSQL service. It must
not use `prisma migrate dev` because CI must not create migrations.

## Environments

### Development

- local database
- local backend
- local frontend
- seed data allowed

### Staging

- production-like config
- test data only
- used for QA and demo

### Production

- real user data
- strict secrets management
- backups enabled
- monitoring enabled

## Deployment Strategy

MVP:
- frontend deployed separately from API.
- API deployed as managed service/container.
- PostgreSQL managed database.
- migration run as deployment step.

## Backup Requirements

- automated daily backup,
- point-in-time recovery if possible,
- restore drill before public beta,
- final backup before risky migration.

## Observability

Track:
- API latency
- error rate
- auth failure rate
- import failure rate
- export job status
- report generation time
- transaction creation success rate

## Production Readiness Checklist

- [ ] HTTPS enabled
- [ ] environment variables configured
- [ ] database backup enabled
- [ ] migrations tested
- [ ] auth flows tested
- [ ] cross-user access tested
- [ ] error monitoring enabled
- [ ] logs sanitized
- [ ] export works
- [ ] delete account flow works
- [ ] privacy/security settings available
