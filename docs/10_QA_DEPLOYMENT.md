# 10 QA and Deployment

## QA Strategy

Testing layers:
- unit tests,
- integration tests,
- e2e smoke tests,
- security tests,
- local/manual performance smoke tests for core read/export paths.

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
-> migrate deploy
-> generate Prisma client
-> typecheck
-> lint
-> unit tests
-> API e2e/security smoke tests
-> build
```

CI must use `prisma migrate deploy` against the test PostgreSQL service. It must
not use `prisma migrate dev` because CI must not create migrations.
`npm run test:performance` is local/manual only and must not be added to CI
unless the environment is later made stable enough for timing smoke checks.

## Performance Smoke

Run local performance smoke after migrations and Prisma client generation:

```bash
npm run test:performance
```

The smoke test seeds a disposable synthetic user with moderate ledger data,
checks broad latency thresholds for transaction list, dashboard, reports, and
CSV export download, then removes the disposable data. It is not a benchmark and
should not trigger broad optimization work. Thresholds can be widened locally
when diagnosing slow machines:

```bash
PERFORMANCE_SMOKE_MAX_ENDPOINT_MS=8000 PERFORMANCE_SMOKE_MAX_EXPORT_DOWNLOAD_MS=15000 npm run test:performance
```

If the smoke fails consistently on a normal local machine, investigate only the
specific slow endpoint. Do not add indexes or migrations without a concrete
finding and approval.

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

### Local Docker Compose Backup/Restore Drill

Local backup drill outputs belong in `.local-backups/`, which is ignored by git.
Database dumps contain sensitive financial data. Never commit dumps, never paste
production secrets into docs, and never use real production credentials for this
local drill.

1. Start local PostgreSQL and create an ignored backup directory.

```bash
docker compose up -d postgres
mkdir .local-backups
```

2. Create a custom-format dump inside the container and copy it into the ignored
   local backup directory.

```bash
docker compose exec -T postgres pg_dump -U money_tracker -d money_tracker -Fc -f /tmp/money-tracker-local.dump
docker compose cp postgres:/tmp/money-tracker-local.dump .local-backups/money-tracker-local.dump
```

3. Restore into a temporary verification database, not the active development
   database.

```bash
docker compose exec -T postgres createdb -U money_tracker money_tracker_restore_check
docker compose cp .local-backups/money-tracker-local.dump postgres:/tmp/money-tracker-local.dump
docker compose exec -T postgres pg_restore -U money_tracker -d money_tracker_restore_check /tmp/money-tracker-local.dump
```

4. Run a simple verification query, then remove the temporary verification
   database.

```bash
docker compose exec -T postgres psql -U money_tracker -d money_tracker_restore_check -c "SELECT COUNT(*) FROM users;"
docker compose exec -T postgres dropdb -U money_tracker money_tracker_restore_check
```

If the restore database already exists from a failed run, drop only
`money_tracker_restore_check` and rerun the restore step. Do not restore a drill
dump over the active `money_tracker` database.

## Observability

Track:
- API latency
- error rate
- auth failure rate
- import failure rate
- export job status
- report generation time
- transaction creation success rate

Step 15B readiness adds request ID correlation through `X-Request-Id` and
standard API error bodies. Paid monitoring vendor integration is deferred. Any
future logging must follow the safe logging rules in `docs/09_SECURITY_PRIVACY.md`.

## Production Readiness Checklist

- [ ] HTTPS enabled
- [ ] environment variables configured
- [ ] database backup enabled
- [ ] restore drill verified
- [ ] migrations tested
- [ ] auth flows tested
- [ ] cross-user access tested
- [ ] request ID correlation verified
- [ ] error monitoring enabled or operational owner explicitly assigned
- [ ] logs sanitized and query strings/tokens excluded
- [ ] local performance smoke reviewed
- [ ] export works
- [ ] delete account flow works
- [ ] privacy/security settings available
