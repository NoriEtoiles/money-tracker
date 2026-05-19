# 07 Task Breakdown

## Epic 1: Project Foundation

### Feature: Repository Setup

Tasks:
- Initialize frontend app.
- Initialize backend app.
- Configure TypeScript.
- Configure linting and formatting.
- Configure test framework.
- Configure environment variables.
- Add root `AGENTS.md`.
- Add `/docs`.

Acceptance criteria:
- `npm run lint` works.
- `npm run test` works.
- `npm run typecheck` works.
- README explains local setup.

## Epic 2: Authentication

### Feature: Register

Tasks:
- Create `users` table.
- Create password hashing service.
- Create register endpoint.
- Add validation.
- Add duplicate email handling.
- Add audit event for registration.
- Add frontend register form.

Acceptance criteria:
- User can register.
- Invalid email returns validation error.
- Duplicate email returns safe error.
- Password is never stored raw.

### Feature: Login/Logout

Tasks:
- Create sessions table.
- Implement login endpoint.
- Implement refresh session.
- Implement logout endpoint.
- Add auth guard.
- Add frontend login page.
- Add session persistence.

Acceptance criteria:
- User can login.
- Protected routes reject unauthenticated user.
- Logout revokes session.

## Epic 3: Account Management

### Feature: Account CRUD

Tasks:
- Create `accounts` table.
- Create account DTO.
- Create account endpoints.
- Create account service.
- Add frontend account list.
- Add add/edit account form.
- Add archive/delete behavior.

Acceptance criteria:
- User can create account.
- User can edit account.
- User can archive account.
- User cannot access another user's account.

## Epic 4: Category and Tags

### Feature: Categories

Tasks:
- Create categories table.
- Seed default categories.
- Add CRUD endpoints.
- Add category selector.
- Add category management UI.

Acceptance criteria:
- User has default categories after onboarding.
- User can create custom category.
- User can archive category.

### Feature: Tags

Tasks:
- Create tags table.
- Create transaction_tags table.
- Add tag CRUD.
- Add tag selector to transaction form.

Acceptance criteria:
- User can add tags to transaction.
- User can filter transaction by tag.

## Epic 5: Transactions

### Feature: Expense and Income

Tasks:
- Create transactions table.
- Implement create transaction endpoint.
- Implement list transaction endpoint.
- Implement update transaction endpoint.
- Implement delete transaction endpoint.
- Update account balance on transaction create/update/delete.
- Add transaction list UI.
- Add transaction form UI.
- Add tests for amount calculation.

Acceptance criteria:
- User can create income.
- User can create expense.
- Balance updates correctly.
- Deleted transaction no longer affects reports.
- User cannot access another user's transaction.

### Feature: Transfers

Tasks:
- Implement transfer group ID.
- Create transfer endpoint.
- Create outflow and inflow transactions.
- Ensure transfer does not count as expense/income in reports.
- Add transfer UI.

Acceptance criteria:
- Transfer moves balance between accounts.
- Transfer does not inflate spending report.
- Editing transfer maintains consistency.

## Epic 6: Budgeting

### Feature: Monthly Budget

Tasks:
- Create budgets table.
- Implement budget endpoints.
- Implement budget calculation service.
- Add budget list UI.
- Add budget detail UI.
- Add threshold warning.

Acceptance criteria:
- User can set category budget.
- User can see spent/remaining.
- User gets warning when threshold exceeded.

## Epic 7: Recurring Transactions

### Feature: Recurring Rules

Tasks:
- Create recurring_rules table.
- Implement rule CRUD.
- Implement job to generate due transactions.
- Add recurring list UI.
- Add rule form UI.

Acceptance criteria:
- Rule generates transaction on schedule.
- Rule can be paused.
- Duplicate generation is prevented.

## Epic 8: Reports

### Feature: Dashboard

Tasks:
- Create dashboard endpoint.
- Calculate total balance.
- Calculate monthly income.
- Calculate monthly expense.
- Calculate budget risk.
- Add dashboard UI.

Acceptance criteria:
- Dashboard loads under target latency.
- Values match transaction data.

### Feature: Spending Report

Tasks:
- Create spending report endpoint.
- Group expense by category.
- Add chart UI.
- Add date range filter.

Acceptance criteria:
- Spending report excludes transfers.
- Spending report respects date range.

### Feature: Cashflow Report

Tasks:
- Create cashflow endpoint.
- Group income and expense by period.
- Add line/bar chart.

Acceptance criteria:
- Cashflow reflects income minus expense.
- Transfers excluded from net cashflow.

## Epic 9: Import/Export

### Feature: CSV Import

Tasks:
- Create imports table.
- Implement upload endpoint.
- Implement mapping preview.
- Implement validation.
- Implement import confirmation.
- Add import wizard UI.

Acceptance criteria:
- User can upload CSV.
- User can map columns.
- Invalid rows are shown clearly.
- Confirmed rows become transactions.

### Feature: CSV Export

Tasks:
- Create exports table.
- Implement export request endpoint.
- Generate CSV file.
- Add signed download URL.
- Add export UI.
- Add audit event.

Acceptance criteria:
- User can export own transactions.
- Export contains expected columns.
- Export action is audited.

## Epic 10: Settings and Privacy

Tasks:
- Add profile settings.
- Add security settings.
- Add data export shortcut.
- Add delete account request flow.
- Add audit events view.

Acceptance criteria:
- User can update profile.
- User can export data.
- Sensitive actions are audited.
