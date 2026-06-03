# 02 Technical Specification

## Recommended Stack

| Layer | Teknologi |
|---|---|
| Web Frontend | Next.js + TypeScript |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Mobile Future | Expo React Native |
| Queue | Redis-backed queue / managed queue |
| Object Storage | S3-compatible storage |
| Auth | OIDC-compatible auth provider |
| CI/CD | GitHub Actions |
| Hosting | Vercel for web, managed container for API |
| Monitoring | Error tracking + metrics + structured logs |

## Architecture Pattern

Gunakan modular monolith terlebih dahulu.

Alasan:
- lebih mudah dikembangkan di MVP,
- lebih sederhana untuk testing,
- masih bisa dipecah menjadi service terpisah nanti,
- cocok untuk domain money tracking yang membutuhkan konsistensi data.

## Backend Module Structure

```txt
src/
  common/
    decorators/
    guards/
    filters/
    interceptors/
    pipes/
    utils/
  modules/
    auth/
    users/
    accounts/
    transactions/
    categories/
    tags/
    budgets/
    recurring/
    reports/
    imports/
    exports/
    notifications/
    audit/
  prisma/
  config/
```

## Frontend Structure

```txt
src/
  app/
  components/
    ui/
    forms/
    charts/
    layout/
  features/
    auth/
    dashboard/
    accounts/
    transactions/
    budgets/
    reports/
    settings/
  lib/
    api/
    auth/
    validation/
    formatters/
  hooks/
  types/
```

## Domain Rules

### Money Amount

- Jangan gunakan floating point.
- Gunakan decimal/numeric di database.
- Di API, amount boleh dikirim sebagai string atau integer minor unit.
- Untuk IDR, minor unit bisa tetap disimpan sebagai decimal agar multi-currency kompatibel.

### Transaction Type

Supported:
- `income`
- `expense`
- `transfer`

### Transaction Source

Supported:
- `manual`
- `import`
- `recurring`
- `ocr`
- `bank_sync`

MVP hanya wajib:
- `manual`
- `import`
- `recurring`

### Account Type

Supported:
- `cash`
- `bank`
- `e_wallet`
- `credit_card`
- `debt`
- `investment`

MVP minimal:
- `cash`
- `bank`
- `e_wallet`
- `credit_card`

## Auth Flow

MVP:
- email/password
- email verification optional
- refresh token/session
- logout
- revoke session

Phase 2:
- OAuth/OIDC
- MFA
- passkey/WebAuthn
- trusted devices

## Sync Strategy

MVP web:
- server as source of truth.
- client fetches latest state through API.

Mobile future:
- local draft queue.
- offline add transaction.
- sync when online.
- conflict strategy: server wins for same field, with audit trail.
- conflict banner for user-visible conflicts.

## Reporting Strategy

Reports should be generated from transactions table first.

Optimization later:
- daily account balance snapshot,
- materialized views,
- cached report aggregates,
- background report generation.

## Export Strategy

MVP:
- CSV export for transactions.

Phase 2:
- XLSX export.
- full JSON export.
- downloadable archive with manifest.

## Import Strategy

MVP:
- CSV upload.
- mapping columns.
- preview rows.
- validate rows.
- import confirmed rows.
- store import history.
- stage parsed rows temporarily in PostgreSQL and clear them after confirmation or expiry.
- import one account statement per file; derive currency from the selected account.
- use signed decimal amounts to derive income or expense without FX conversion.

## Notification Strategy

MVP:
- in-app notifications.

Phase 2:
- email notifications.
- push notifications.
- budget threshold alerts.
- recurring transaction reminders.

## Logging and Observability

Log:
- request id
- user id
- endpoint
- status code
- latency
- error code

Do not log:
- raw password
- tokens
- full financial notes
- uploaded receipt content
- sensitive bank sync payload
