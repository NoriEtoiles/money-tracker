# Session Handoff

## 1. Project Goal

Money Tracker is a web-first, mobile-ready personal finance tracker. MVP scope is manual-first: auth, onboarding/default data, accounts, categories/tags, manual transactions, transfers, budgets, dashboard/reports, recurring transactions, CSV import/export, settings/privacy, and audit logs. Do not implement bank sync, OCR, AI insight, shared finance, advanced investments, or attachment workflows before MVP core is stable.

## 2. Current Architecture Summary

- Monorepo with npm workspaces: `apps/api` and `apps/web`.
- Backend: NestJS + TypeScript, modular monolith, `/api/v1` global prefix.
- Frontend: Next.js App Router + TypeScript.
- Database: PostgreSQL via Prisma.
- Validation: Nest `ValidationPipe` + class-validator DTOs.
- Auth: email/password, bcrypt password hashing, JWT access token, hashed refresh token stored in `sessions`.
- Security pattern: all user-owned queries are scoped by authenticated `userId`; sensitive actions emit audit events.
- Money pattern: API uses decimal strings; database uses Prisma/PostgreSQL decimal fields; backend balance math uses `Prisma.Decimal`.
- Tooling: Vitest, ESLint flat config, TypeScript strict checks, GitHub Actions CI.

## 3. Current Implementation Status

Completed through `docs/tasks/IMPLEMENTATION_ORDER.md` Step 14:
- Step 1 Project Foundation: done.
- Step 2 Auth Foundation: done.
- Step 3 Onboarding/default data: partially done.
- Step 4 Accounts: backend CRUD and web UI done.
- Step 5 Categories and Tags: backend CRUD, web UI, and reusable selectors done.
- Step 6 Transactions: income/expense CRUD, list UI, form UI, soft delete, account balance updates, unit tests, and database verification done.
- Step 7 Transfers: internal transfer CRUD, linked transfer legs, transfer UI, transaction endpoint guards, and transfer unit tests done.
- Step 8 Budgets: monthly budget table, guarded budget CRUD, currency-specific spent calculation, threshold warnings, budget UI, and unit tests done.
- Step 9 Dashboard: guarded dashboard endpoint, per-currency balance/cashflow summary, budget warnings, recent transactions, dashboard UI, and unit tests done.
- Step 10 Reports: guarded spending, cashflow, and net worth endpoints, Reports UI tab with chart-style views, API docs, and unit tests done.
- Step 11 Recurring Transactions: guarded recurring rule CRUD/lifecycle endpoints, in-process scheduled generation, duplicate prevention, Recurring UI tab, and unit tests done.
- Step 12 CSV Import: guarded upload/preview/confirm/history endpoints, temporary parsed staging, atomic ledger confirmation, Import UI tab, and unit tests done.
- Step 13 CSV Export: guarded export request/status/history/download endpoints, on-demand transaction CSV generation, signed download, Export UI tab, audit events, and unit tests done.
- Step 14 Settings and Privacy: profile settings, password change, active session management, export shortcut, delete-account request intent flow, sanitized audit log view, migration, docs, unit tests, HTTP smoke, and visual smoke done.

Migrations exist. Docker Desktop is now installed and Docker CLI/Compose commands work. PostgreSQL starts through Docker Compose, and the existing migrations apply successfully.

## 4. Features Already Completed

- API health endpoint: `GET /api/v1/health`.
- Auth API: register, login, logout, current user.
- User profile update: `PATCH /api/v1/me`.
- Onboarding default data seed: `POST /api/v1/onboarding/default-data`.
- Account API/UI: list, create, update, archive, balance display.
- Category API/UI: list, create, update, archive.
- Tag API/UI: list, create, update, delete.
- Reusable category and tag selector components.
- Transaction API/UI: list, create, update, soft delete for income and expense.
- Transaction account balance updates on create/update/delete.
- Transfer API/UI: grouped internal transfers between two user-owned same-currency accounts.
- Transfer create/update/delete updates both account balances atomically and soft-deletes both linked legs.
- API/docs updated for implemented ledger, transfer, and budget contracts.
- Budget API/UI: monthly category budgets with explicit currency, create/update/archive behavior, spent/remaining/progress calculation, and threshold warning state.
- Dashboard API/UI: read-only monthly dashboard with per-currency total balance, income, expense, net cashflow, Step 8-compatible budget warnings, and recent normal transactions without notes.
- Reports API/UI: read-only spending by category, monthly cashflow, and current net worth snapshot reports with per-currency grouping and chart-style web views.
- Recurring API/UI: daily, weekly, and monthly income/expense rules with user-timezone schedules, automatic generation, duplicate prevention, and pause/resume/archive actions.
- CSV Import API/UI: account-statement upload, comma/semicolon detection, safe mapped preview, all-or-nothing confirmation, expiry cleanup, recent safe history, and imported transaction badge.
- CSV Export API/UI: transaction CSV export requests, optional filters, short-lived signed downloads, safe export history, and audit events.
- Settings and Privacy API/UI: profile update reuse, password change, active session list/revoke, data export shortcut, pending delete-account request, and sanitized audit log view.

## 5. Important Files

Backend:
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260517040000_transactions/migration.sql`
- `apps/api/src/modules/transactions/*`
- `apps/api/src/modules/budgets/*`
- `apps/api/src/modules/reports/*`
- `apps/api/src/modules/reports/reports.service.ts`
- `apps/api/src/modules/reports/reports.service.spec.ts`
- `apps/api/src/modules/recurring/*`
- `apps/api/src/modules/imports/*`
- `apps/api/src/modules/exports/*`
- `apps/api/src/modules/settings/*`
- `apps/api/src/modules/audit/*`
- `apps/api/src/modules/auth/*`
- `apps/api/src/app.module.ts`
- `apps/api/prisma/migrations/20260517050000_transfers/migration.sql`
- `apps/api/prisma/migrations/20260517060000_budgets/migration.sql`
- `apps/api/prisma/migrations/20260531000000_recurring_rules/migration.sql`
- `apps/api/prisma/migrations/20260602000000_csv_imports/migration.sql`
- `apps/api/prisma/migrations/20260603000000_csv_exports/migration.sql`
- `apps/api/prisma/migrations/20260604000000_settings_privacy/migration.sql`

Frontend:
- `apps/web/src/features/app/app-shell.tsx`
- `apps/web/src/features/transactions/transactions-page.tsx`
- `apps/web/src/features/transfers/transfers-page.tsx`
- `apps/web/src/features/budgets/budgets-page.tsx`
- `apps/web/src/features/dashboard/dashboard-page.tsx`
- `apps/web/src/features/reports/reports-page.tsx`
- `apps/web/src/features/recurring/recurring-page.tsx`
- `apps/web/src/features/imports/imports-page.tsx`
- `apps/web/src/features/exports/exports-page.tsx`
- `apps/web/src/features/settings/settings-page.tsx`
- `apps/web/src/lib/api/transactions.ts`
- `apps/web/src/lib/api/transfers.ts`
- `apps/web/src/lib/api/budgets.ts`
- `apps/web/src/lib/api/dashboard.ts`
- `apps/web/src/lib/api/reports.ts`
- `apps/web/src/lib/api/recurring-rules.ts`
- `apps/web/src/lib/api/imports.ts`
- `apps/web/src/lib/api/exports.ts`
- `apps/web/src/lib/api/settings.ts`
- Existing account/category/tag feature files and selectors

Docs:
- `README.md`
- `docs/03_DATABASE_SCHEMA.md`
- `docs/04_API_SPEC.md`
- `docs/SESSION_HANDOFF.md`

## 6. Important Technical Decisions Made

- Keep API and web in one npm workspace monorepo.
- Use string decimal amounts at API boundaries; Prisma `Decimal(18,4)` for stored money values.
- Transaction create/update/delete balance mutations run inside Prisma transactions.
- Transaction delete is soft delete (`is_deleted`, `deleted_at`) and reverses account balance impact.
- Step 6 normal transactions support only `income` and `expense`.
- Normal transaction endpoints are intentionally income/expense-only and exclude transfer legs.
- Transfers use `transfer_group_id` plus `transfer_side` to link one outflow and one inflow row.
- Transfer currency is derived from the source/destination accounts; FX transfers are deferred.
- Transfer rows have `category_id = NULL` and must be excluded from normal income/expense reporting.
- Transaction tags and `budgetImpact` are explicitly deferred.
- Category kind must match transaction type.
- Archived/deleted accounts and categories cannot be used for new or updated transactions.
- Budgets are strictly monthly: `period_start` must be the first day of the month and `period_end` is derived as the first day of the next month.
- Budget currency is explicit and budget spending only includes same-currency, non-transfer, non-deleted expense transactions.
- Budget uniqueness is `(user_id, category_id, period_start, currency)`; creating the same archived identity reactivates it, while update collisions are rejected.
- Dashboard money summaries are grouped per currency; no FX conversion is attempted in MVP.
- Dashboard monthly income/expense excludes deleted rows, soft-deleted rows, transfer rows, and other-user rows.
- Dashboard recent transactions are scoped to the selected dashboard month and intentionally omit notes from the payload.
- Step 10 report date ranges use UTC date-only boundaries: `dateFrom` is inclusive and `dateTo` is user-facing inclusive via `transactionAt >= dateFrom` and `transactionAt < nextDay(dateTo)`.
- Spending reports group normal expense transactions by category and currency, sort by currency then amount descending, and calculate percentages per currency only.
- Cashflow reports group normal income/expense transactions into monthly buckets sorted by `periodStart` ascending, then currency.
- Net worth reports are current snapshots from active, non-deleted, `includeInNetWorth = true` account balances sorted by currency, sort order, name, creation time, and id.
- Step 10 reports are read-only, exclude transfer rows, and never perform FX conversion or combine currencies.
- Step 11 recurring templates support normal `income` and `expense` only; recurring transfers are deferred.
- Recurring rules snapshot the user's timezone at creation and keep local wall-clock cadence for daily, weekly, and monthly schedules.
- Monthly recurrence stores the original day intent, clamps short months to their final day, and does not drift after the short month.
- API downtime is caught up in batches of at most 100 occurrences per scheduler tick; pause/resume intentionally skips the paused period.
- Generated recurring rows are normal editable and soft-deletable ledger rows with `source = "recurring"`, and database uniqueness prevents deleted occurrences from being generated again.
- Unavailable recurring account/category dependencies auto-pause the rule with safe error codes only.
- Step 12 CSV Import accepts one account statement per file, derives currency from the selected account, and derives income/expense from a selectable signed-amount convention.
- Parsed CSV staging rows expire after 24 hours and are cleared after confirmation or expiry; raw CSV bytes are never stored.
- Import confirmation revalidates all rows inside one Prisma transaction, creates uncategorized note-free `source = "import"` ledger rows, applies one decimal-safe balance delta, and stores safe count-only audit metadata.
- Import retry uniqueness is enforced by unfiltered `(user_id, import_id, import_row_number)` uniqueness, including after soft delete. Separate uploads may contain identical rows.
- Step 13 CSV Export uses `exportType = "transactions_csv"` and `transactionType` for transaction filtering to avoid DTO naming ambiguity.
- CSV Export stores only safe request filters and metadata; CSV bytes and raw signed tokens are not persisted, so exports are on-demand downloads rather than immutable snapshots.
- CSV Export supports optional `dateFrom`, `dateTo`, `accountId`, `currency`, and `transactionType` filters; date ranges reuse Step 10 UTC date-only inclusive semantics.
- CSV Export includes non-deleted ledger rows for the authenticated user, including transfer legs, and excludes other-user rows, deleted/soft-deleted rows, and rows attached to deleted accounts.
- CSV Export amount values use `Prisma.Decimal.toFixed(4)` strings, preserve original currencies, and never perform FX conversion.
- CSV Export signed downloads require active bearer auth plus a short-lived purpose-bound token; wrong-user, expired, and tampered token cases are rejected.
- CSV Export audit metadata is privacy-first: safe filters, status, row count, and timestamps only; CSV content, notes, merchant text, raw URLs, and tokens are not audited.
- Step 14 profile settings reuse existing `GET/PATCH /api/v1/me` fields only: `displayName`, `defaultCurrency`, `locale`, and `timezone`.
- Profile update audit metadata stores changed field names only, never profile values.
- Change password verifies the current password, updates the password hash, keeps the current session active, and revokes other active sessions.
- Session list/revoke endpoints are scoped by authenticated `userId`; revoked sessions are rejected by the existing `JwtAuthGuard` because it requires `revokedAt = null`.
- Session responses never expose refresh tokens, token hashes, password hashes, raw tokens, or session secrets.
- Delete-account request is an intent flow only. It creates/returns one pending request per user through a partial unique index and does not hard-delete users or financial records.
- Delete-account request validation requires current password plus exact phrase `DELETE MY ACCOUNT`, but neither value is stored or audited.
- User-facing audit log responses are explicitly whitelist-sanitized and drop unknown/unsafe metadata, including secrets, tokens, raw URLs, server paths, notes, merchants, CSV content, raw request bodies, emails, password data, and arbitrary nested metadata.
- Settings Data Export is only a UI shortcut to the existing Export tab; CSV Export core behavior was not changed.
- Auth UI stores tokens in localStorage temporarily; acceptable for MVP scaffolding but should be revisited before production hardening.

## 7. Current Unfinished Work

- Create-first-account onboarding flow polish.
- Database-backed integration tests for user-owned authorization isolation.
- Transaction tags are not implemented; `transaction_tags` table is still deferred.
- Refresh token endpoint/session renewal is not implemented yet.
- Production-grade auth storage is not implemented.
- Step 15 Production Hardening is not implemented yet.

## 8. Known Bugs or Risks

- `npm audit --omit=dev` previously reported 2 moderate advisories from `next -> postcss`; `npm audit fix --force` suggested a breaking dependency change, so it was not applied.
- Latest Docker/PostgreSQL verification:
  - `docker --version` succeeded.
  - `docker compose version` succeeded.
  - `docker compose up -d postgres` succeeded.
  - `money-tracker-postgres` container was running.
  - `npm.cmd run db:migrate` successfully applied migrations through:
    - `20260517000000_auth_foundation`
    - `20260517010000_onboarding_default_categories`
    - `20260517020000_accounts`
    - `20260517030000_tags`
    - `20260517040000_transactions`
    - `20260517050000_transfers`
- Step 6 Prisma schema/database drift is resolved:
  - Added `@default(now())` to the affected `updatedAt` fields while keeping `@updatedAt`.
  - Added `apps/api/prisma/migrations/migration_lock.toml` with `provider = "postgresql"` because it was missing.
  - Explicitly set FK referential actions in `apps/api/prisma/schema.prisma` to match the already-applied plain PostgreSQL migration behavior: `onDelete: NoAction` and `onUpdate: NoAction`.
- Exact Prisma relation alignment completed:
  - `Session.user`
  - `AuditEvent.user`
  - `Category.user`
  - `Category.parent`
  - `Account.user`
  - `Tag.user`
  - `Transaction.user`
  - `Transaction.account`
  - `Transaction.category`
- Final Step 7 verification results:
  - `docker compose up -d postgres` passed.
  - `npm.cmd run db:migrate` passed and applied `20260517050000_transfers` with no prompt.
  - `npm.cmd run db:generate` passed.
  - `npm.cmd run typecheck` passed.
  - `npm.cmd run lint` passed.
  - API tests passed: 28 tests.
  - Web tests passed: 1 test.
  - `npm.cmd run build` passed.
- Step 8 adds migration `20260517060000_budgets`; Step 9 Dashboard does not add a schema migration.
- Final Step 8 Budgets MVP manual QA result:
  - Step 8 Budgets MVP is complete.
  - A small runtime bug was found during smoke testing:
    - `BudgetsModule` initially did not import `AuthModule`.
    - Budget endpoints failed because `JwtAuthGuard` could not resolve `TokenService`.
    - This was fixed by importing `AuthModule` in `BudgetsModule`.
    - `npm.cmd run typecheck` and `npm.cmd run test` passed after the fix.
  - Manual smoke test passed:
    - Budgets tab appears.
    - Login with test account works.
    - Create budget for expense category works.
    - Income category budget is rejected with `400`.
    - Normal budget amount works.
    - Progress/spent/remaining display correctly.
    - Expense transaction in the same category increases `spentAmount`.
    - Income transaction does not affect `spentAmount`.
    - Transfers do not affect `spentAmount`.
    - Deleted expense transaction decreases/reverses `spentAmount`.
    - Different budget currencies do not mix spending.
    - Edit amount/threshold/month/currency works.
    - Archive budget works.
    - Recreate same category+month+currency after archive reactivates/updates the same budget instead of creating duplicates.
  - Current local servers:
    - Web: `http://localhost:3000`
    - API health: `http://localhost:3001/api/v1/health`
- Final Step 9 Dashboard MVP implementation:
  - `GET /api/v1/reports/dashboard` is protected by `JwtAuthGuard`.
  - Dashboard returns per-currency total balance, monthly income, monthly expense, net cashflow, budget warnings, and recent normal transactions.
  - Monthly income/expense explicitly filters `deletedAt: null`, `isDeleted: false`, `transferGroupId: null`, `transferSide: null`, and authenticated `userId`.
  - Budget warnings use the same spent rules as Step 8.
  - Frontend Dashboard is read-only and only formats backend decimal strings.
  - Step 9 Dashboard MVP is complete, automated validation passed, manual smoke passed, committed locally as `c50542c Implement dashboard MVP`, and pushed to GitHub.
  - Validation passed:
    - `db:migrate`
    - `db:generate`
    - `typecheck`
    - `lint`
    - `test`: API 46 tests, Web 1 test
    - `build`
  - Manual smoke passed:
    - Dashboard is the default first tab.
    - Summary, recent transactions, transfer exclusion, deleted transaction exclusion, note omission, budget warning parity, and month selector behavior were checked through the web app.
- Previous dev server log files may exist (`web.server.log`, `web.server.err.log`, etc.) and are not meaningful source artifacts.
- `.env` files exist locally for development and are ignored by `.gitignore`; do not commit secrets.
- Some tests are unit-only; authorization isolation still needs database-backed integration tests.
- Final Step 10 Reports MVP implementation:
  - `GET /api/v1/reports/spending` is protected by `JwtAuthGuard` and returns spending grouped by category/currency with per-currency totals and percentages.
  - `GET /api/v1/reports/cashflow` is protected by `JwtAuthGuard` and returns monthly income/expense/net buckets.
  - `GET /api/v1/reports/net-worth` is protected by `JwtAuthGuard` and returns a current account-balance snapshot grouped per currency.
  - Spending and cashflow use inclusive UTC date-only ranges and exclude other-user rows, deleted rows, soft-deleted rows, transfers, and out-of-range rows.
  - Frontend Reports tab includes date range controls, optional currency filter, Spending/Cashflow/Net Worth tabs, and chart-style visual bars from backend-provided decimal strings.
  - No schema migration was added for Step 10.
  - During validation, old local API/web Node dev servers were stopped because they locked Prisma's Windows query engine DLL and blocked `db:generate`.
  - Validation passed:
    - `docker compose up -d postgres`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:generate`
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`: API 51 tests, Web 1 test
    - `npm.cmd run build`
- Final Step 11 Recurring Transactions MVP implementation:
  - Step 11 changes were implemented, validated, committed as `af3d286 Implement recurring transactions`, and pushed.
  - `GET/POST/PATCH/DELETE /api/v1/recurring-rules` and `POST .../{ruleId}/pause|resume` are protected by `JwtAuthGuard`.
  - `@nestjs/schedule` runs bounded recurring generation inside the API process; Luxon handles timezone-aware calendar arithmetic.
  - Generated transactions, decimal-safe account balance updates, schedule advancement, and safe audit events commit atomically.
  - `ux_transactions_recurring_occurrence` enforces duplicate prevention across retries and remains effective after soft delete.
  - Frontend Recurring tab supports create/edit/pause/resume/archive and generated transaction rows show a `Recurring` badge.
  - Validation passed:
    - `docker compose up -d postgres`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:generate`
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`: API 63 tests, Web 1 test
    - `npm.cmd run build`
    - `git diff --check`
  - HTTP/database smoke passed:
    - Cron generated a due recurring expense row with `source = "recurring"` and matching `recurring_occurrence_at`.
    - The generated expense updated account balance, budget spent amount, dashboard monthly expense, and spending report amount.
    - Pause, resume, archive, safe audit metadata, and the unfiltered database unique occurrence index were verified.
- Final Step 12 CSV Import MVP implementation:
  - Step 12 changes were implemented, automated validation passed, HTTP/database smoke passed, human visual smoke passed, committed as `0e7493e Implement CSV import MVP`, and pushed to GitHub.
  - Latest verified repo state after the Step 12 push: branch `main`, working tree clean.
  - `GET /api/v1/imports`, `POST /api/v1/imports/csv`, `POST /api/v1/imports/{importId}/preview`, and `POST /api/v1/imports/{importId}/confirm` are protected by `JwtAuthGuard`.
  - UTF-8 CSV upload supports deterministic comma/semicolon detection, maximum 1 MiB, maximum 1,000 data rows, maximum 50 columns, strict signed decimal amounts, and unambiguous ISO dates.
  - Confirmed imported rows are uncategorized, note-free, normal income/expense ledger rows with `source = "import"` and null transfer/recurring metadata.
  - Validation passed:
    - `docker compose up -d postgres`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:generate`
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`: API 78 tests, Web 2 tests
    - `npm.cmd run build`
    - `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma`
    - `npx.cmd prisma migrate diff --from-schema-datasource apps/api/prisma/schema.prisma --to-schema-datamodel apps/api/prisma/schema.prisma --script`
    - `git diff --check`
  - HTTP/database smoke passed with 32 assertions:
    - Upload, delimiter detection, preview validation, safe response surfaces, atomic confirmation, repeated confirmation, balance mutation, dashboard/reports propagation, transfer exclusion, currency separation, cross-user denial, unavailable-account rejection, staging cleanup, count-only audit metadata, and unfiltered database retry uniqueness after soft delete were verified.
- Final Step 13 CSV Export MVP implementation:
  - Step 13 changes were implemented and validated in the working tree. Commit/push has not been performed in this session.
  - `GET /api/v1/exports`, `POST /api/v1/exports`, `GET /api/v1/exports/{exportId}`, and `GET /api/v1/exports/{exportId}/download?token=...` are protected by `JwtAuthGuard`.
  - Export requests store safe filters and metadata in `exports`; CSV content and raw signed tokens are never stored.
  - Transaction CSV is generated on demand at download time from stored filters. `rowCount` is updated to match the rows actually sent during download.
  - Download requires both active bearer auth and a short-lived signed token bound to export id, user id, purpose, and expiry.
  - CSV rows include non-deleted income, expense, and transfer ledger rows, including transfer group/side fields, while excluding other-user rows, deleted rows, soft-deleted rows, and rows attached to deleted accounts.
  - CSV amount values remain decimal strings with four fractional digits; currencies are filtered/exported only and never converted.
  - CSV text fields are escaped and user-entered text is neutralized against spreadsheet formula injection.
  - Export UI tab supports date range, account, currency, transaction type filters, request export, history, and authenticated blob download.
  - Validation passed:
    - `docker compose up -d postgres`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:generate`
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`: API 86 tests, Web 4 tests
    - `npm.cmd run build`
    - `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma`
    - `git diff --check` exited 0 with CRLF normalization warnings only
  - HTTP/API smoke passed:
    - Registered users, created accounts, created income/expense transactions and a transfer, requested export, checked status/history, downloaded CSV, verified signed token tamper rejection, cross-user status/download denial, CSV formula neutralization, no `user_id` in CSV, downloaded row count, and safe audit metadata.
  - Human visual smoke passed:
    - Export tab loaded through the web app, filters rendered, export request succeeded from UI, history/download row appeared, and screenshot inspection showed no incoherent overlap in the Export UI.
- Final Step 14 Settings and Privacy MVP implementation:
  - Step 14 changes were implemented and validated in the working tree. Commit/push has not been performed in this session.
  - `POST /api/v1/auth/change-password`, `GET /api/v1/auth/sessions`, `POST /api/v1/auth/sessions/{sessionId}/revoke`, and `POST /api/v1/auth/sessions/revoke-others` are protected by `JwtAuthGuard`.
  - `GET/POST /api/v1/me/deletion-request` records an idempotent pending account deletion request only; no user or financial data is hard-deleted.
  - `GET /api/v1/audit-events` returns cursor-paginated, authenticated user-scoped audit events with whitelist-sanitized metadata.
  - Settings UI tab supports Profile, Security, Data Export shortcut, Delete Account Request, and Audit Log sections.
  - Validation passed:
    - `docker compose up -d postgres`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:generate`
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`: API 98 tests, Web 7 tests
    - `npm.cmd run build`
    - `npx.cmd prisma migrate status --schema apps/api/prisma/schema.prisma`
    - `git diff --check` exited 0 with CRLF normalization warnings only
  - HTTP/API smoke passed with 22 assertions:
    - Register/login, profile update, active session list, current-session revoke rejection, other-session revoke, revoked-token guard denial, password change current-session preservation, new-password login, delete request validation/idempotency, user still active after request, audit log user scoping, and no password/token/raw URL leakage in audit response were verified.
  - Human visual smoke passed:
    - Settings tab rendered through the web app using a real API-authenticated local session.
    - Profile, Security, Data Export, Delete Account, and Audit Log sections rendered without desktop horizontal overflow or incoherent overlap in top and bottom screenshots.

## 9. Next Recommended Task

Step 14 Settings and Privacy MVP is complete and validated in the working tree. Based on `docs/tasks/IMPLEMENTATION_ORDER.md`, the next recommended task is Step 15: Production Hardening.

Confirmed Step 15 scope from `docs/tasks/IMPLEMENTATION_ORDER.md`:
- e2e tests
- security tests
- performance checks
- error monitoring
- backup verification
- documentation cleanup

## 10. Exact Prompt for Next Codex Session

```txt
Read AGENTS.md, README.md, docs/SESSION_HANDOFF.md, docs/03_DATABASE_SCHEMA.md, docs/04_API_SPEC.md, docs/07_TASK_BREAKDOWN.md, and docs/tasks/IMPLEMENTATION_ORDER.md.

Continue the Money Tracker MVP from the current repo state.

Task:
Plan and implement Step 15: Production Hardening. Step 14 Settings and Privacy is complete.

Requirements:
- Use plan mode first.
- Verify `docker compose up -d postgres`, `npm.cmd run db:migrate`, `npm.cmd run db:generate`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build`.
- Do not implement bank sync, OCR, AI insight, attachments, shared finance, or investments.
- Keep production hardening changes narrow and aligned with existing MVP contracts.
- Keep all user-owned behavior scoped through the authenticated session.
- Do not expose raw tokens, password hashes, financial notes, CSV contents, or other sensitive payloads in hardening surfaces.
- Add e2e/security/performance/monitoring/backup/documentation hardening checks where applicable.
- Run npm.cmd run db:generate, npm.cmd run typecheck, npm.cmd run lint, npm.cmd run test, and npm.cmd run build.
```
