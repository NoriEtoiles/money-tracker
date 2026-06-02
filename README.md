# Money Tracker

Money Tracker adalah aplikasi personal finance tracking berbasis web-first dan mobile-ready. Repository ini memakai monorepo npm workspaces untuk memisahkan backend API, frontend web, dan dokumentasi produk.

## Struktur

```txt
/
|-- AGENTS.md
|-- README.md
|-- docker-compose.yml
|-- package.json
|-- tsconfig.base.json
|-- apps
|   |-- api
|   |   |-- prisma
|   |   `-- src
|   `-- web
|       `-- src
`-- docs
    |-- 00_OVERVIEW.md
    |-- 01_PRD_MASTER.md
    |-- 02_TECH_SPEC.md
    |-- 03_DATABASE_SCHEMA.md
    |-- 04_API_SPEC.md
    |-- 05_UI_UX_WIREFRAME.md
    |-- 06_ROADMAP.md
    |-- 07_TASK_BREAKDOWN.md
    |-- 08_AI_CODING_GUIDE.md
    |-- 09_SECURITY_PRIVACY.md
    |-- 10_QA_DEPLOYMENT.md
    |-- 11_DECISIONS_ASSUMPTIONS.md
    |-- prompts
    |   `-- CODEX_KICKOFF_PROMPT.md
    `-- tasks
        |-- MVP_EPICS.md
        `-- IMPLEMENTATION_ORDER.md
```

## Stack

- Web frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Test runner: Vitest
- CI: GitHub Actions

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment examples:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. Start PostgreSQL:

```bash
docker compose up -d postgres
```

4. Generate Prisma client:

```bash
npm run db:generate
```

5. Run the apps:

```bash
npm run dev:api
npm run dev:web
```

Default local URLs:
- API health check: `http://localhost:3001/api/v1/health`
- Web app: `http://localhost:3000`

## Scripts

- `npm run dev:api` starts the NestJS API.
- `npm run dev:web` starts the Next.js web app.
- `npm run db:generate` generates the Prisma client.
- `npm run db:migrate` runs Prisma migrations when models are added.
- `npm run typecheck` runs TypeScript checks for all workspaces.
- `npm run lint` runs ESLint for all workspaces.
- `npm run test` runs Vitest for all workspaces.
- `npm run build` builds all workspaces.

## Current Foundation

This foundation includes:
- backend skeleton
- frontend skeleton
- Prisma migration setup
- environment variable examples
- API health endpoint
- auth foundation endpoints for register, login, logout, and current user
- users, sessions, and audit event database models
- profile update endpoint
- default category seed endpoint
- account CRUD API with user-scoped access
- register/login/logout UI with local session storage
- account list and create/edit/archive UI
- category CRUD API with archive behavior
- tag CRUD API
- category and tag management UI
- reusable category and tag selector components for future transaction forms
- income/expense transaction CRUD API with account balance updates
- transaction list and create/edit/delete UI
- internal transfer API with linked transaction legs and balance updates
- transfer list and create/edit/delete UI
- monthly budget CRUD API with currency-specific spent calculations
- budget list and create/edit/archive UI with progress warnings
- read-only dashboard API/UI with per-currency balances, monthly cashflow, budget warnings, and recent transactions
- read-only reports API/UI for spending by category, monthly cashflow, and basic net worth charts
- recurring rule CRUD API/UI with daily, weekly, and monthly schedules, automatic generation, duplicate prevention, and pause/resume/archive actions
- lint/typecheck/test scripts
- basic CI workflow

Core endpoints:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `POST /api/v1/onboarding/default-data`
- `GET /api/v1/accounts`
- `POST /api/v1/accounts`
- `PATCH /api/v1/accounts/{accountId}`
- `DELETE /api/v1/accounts/{accountId}`
- `GET /api/v1/categories`
- `POST /api/v1/categories`
- `PATCH /api/v1/categories/{categoryId}`
- `DELETE /api/v1/categories/{categoryId}`
- `GET /api/v1/tags`
- `POST /api/v1/tags`
- `PATCH /api/v1/tags/{tagId}`
- `DELETE /api/v1/tags/{tagId}`
- `GET /api/v1/transactions`
- `POST /api/v1/transactions`
- `PATCH /api/v1/transactions/{transactionId}`
- `DELETE /api/v1/transactions/{transactionId}`
- `GET /api/v1/transfers`
- `POST /api/v1/transfers`
- `PATCH /api/v1/transfers/{transferGroupId}`
- `DELETE /api/v1/transfers/{transferGroupId}`
- `GET /api/v1/budgets`
- `POST /api/v1/budgets`
- `PATCH /api/v1/budgets/{budgetId}`
- `DELETE /api/v1/budgets/{budgetId}`
- `GET /api/v1/reports/dashboard`
- `GET /api/v1/reports/spending`
- `GET /api/v1/reports/cashflow`
- `GET /api/v1/reports/net-worth`
- `GET /api/v1/recurring-rules`
- `POST /api/v1/recurring-rules`
- `PATCH /api/v1/recurring-rules/{ruleId}`
- `DELETE /api/v1/recurring-rules/{ruleId}`
- `POST /api/v1/recurring-rules/{ruleId}/pause`
- `POST /api/v1/recurring-rules/{ruleId}/resume`

## Next Recommended Task

Follow `docs/tasks/IMPLEMENTATION_ORDER.md` and continue with **Step 12: CSV Import**:
- upload CSV
- map columns
- preview
- validate
- confirm import

Keep each task small, tested, and aligned with `AGENTS.md`.
