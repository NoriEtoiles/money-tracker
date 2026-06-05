# 04 API Specification

## API Principles

- Prefix all endpoints with `/api/v1`.
- Use JSON request/response.
- Use Bearer token auth for protected endpoints.
- Use cursor pagination for list endpoints.
- Use standard error format.
- Never return data from another user.
- Validate request body strictly.

## Standard Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "amount",
        "message": "Amount must be greater than 0"
      }
    ],
    "requestId": "req_123"
  }
}
```

## Auth

### POST `/api/v1/auth/register`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "displayName": "Noirrr"
}
```

Response:

```json
{
  "userId": "uuid",
  "status": "created"
}
```

### POST `/api/v1/auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "refreshToken": "token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Noirrr"
  }
}
```

### POST `/api/v1/auth/logout`

Protected.

Response:

```json
{
  "success": true
}
```

### POST `/api/v1/auth/change-password`

Protected. Verifies the current password, updates the password hash, keeps the
current session active, revokes other sessions, and emits a safe audit event.
Passwords, hashes, tokens, and raw password input are never returned or audited.

Request:

```json
{
  "currentPassword": "StrongPassword123!",
  "newPassword": "AnotherStrongPassword123!"
}
```

Response:

```json
{
  "success": true,
  "revokedCount": 1
}
```

### GET `/api/v1/auth/sessions`

Protected. Returns active, unrevoked sessions for the authenticated user only.
The response never includes refresh tokens, token hashes, password hashes, raw
tokens, or session secrets.

Response:

```json
{
  "items": [
    {
      "sessionId": "uuid",
      "userAgent": "Mozilla/5.0 ...",
      "createdAt": "2026-06-04T07:00:00.000Z",
      "expiresAt": "2026-06-05T07:00:00.000Z",
      "isCurrent": true
    }
  ]
}
```

### POST `/api/v1/auth/sessions/{sessionId}/revoke`

Protected. Revokes one other active session owned by the authenticated user.
The current session must be revoked through logout instead.

Response:

```json
{
  "success": true,
  "revokedCount": 1
}
```

### POST `/api/v1/auth/sessions/revoke-others`

Protected. Revokes all other active sessions owned by the authenticated user.

Response:

```json
{
  "success": true,
  "revokedCount": 2
}
```

## Users

### GET `/api/v1/me`

Response:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "Noirrr",
  "defaultCurrency": "IDR",
  "locale": "id-ID",
  "timezone": "Asia/Jakarta"
}
```

### PATCH `/api/v1/me`

Protected.

Request:

```json
{
  "displayName": "Noirrr",
  "defaultCurrency": "IDR",
  "locale": "id-ID",
  "timezone": "Asia/Jakarta"
}
```

Response:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "Noirrr",
  "defaultCurrency": "IDR",
  "locale": "id-ID",
  "timezone": "Asia/Jakarta"
}
```

Profile updates audit only changed field names, never profile values.

### GET `/api/v1/me/deletion-request`

Protected. Returns the authenticated user's pending delete-account request, if
one exists. This is an intent/request flow only and does not hard-delete user or
financial data.

Response:

```json
{
  "request": {
    "status": "pending",
    "requestedAt": "2026-06-04T07:00:00.000Z"
  }
}
```

When no pending request exists:

```json
{
  "request": null
}
```

### POST `/api/v1/me/deletion-request`

Protected. Requires the current password and exact confirmation phrase
`DELETE MY ACCOUNT`. Request creation is idempotent for an existing pending
request and race-safe through a database uniqueness constraint. The API never
stores the typed phrase or password.

Request:

```json
{
  "currentPassword": "StrongPassword123!",
  "confirmationPhrase": "DELETE MY ACCOUNT"
}
```

Response matches `GET /api/v1/me/deletion-request`.

## Audit Events

### GET `/api/v1/audit-events`

Protected cursor-paginated audit log for the authenticated user only.

Query params:
- `cursor`
- `limit`

Response:

```json
{
  "items": [
    {
      "eventType": "csv_export_download",
      "entityType": "export",
      "createdAt": "2026-06-04T07:00:00.000Z",
      "metadata": {
        "status": "downloaded",
        "rowCount": 24,
        "filters": {
          "dateFrom": "2026-01-01",
          "dateTo": "2026-12-31",
          "currency": "IDR"
        }
      }
    }
  ],
  "nextCursor": null
}
```

Audit metadata is returned through an explicit whitelist only. Unknown fields and
unsafe historical fields are dropped, including secrets, tokens, raw URLs, server
paths, notes, merchants, CSV content, raw request bodies, emails, password data,
and arbitrary nested metadata.

## Onboarding

### POST `/api/v1/onboarding/default-data`

Protected.

Seeds default categories for the authenticated user. The operation is idempotent by category `kind` and `name`.

Response:

```json
{
  "status": "ready",
  "categories": [
    {
      "id": "uuid",
      "name": "Food",
      "kind": "expense",
      "parentId": null,
      "colorToken": "orange",
      "iconToken": "utensils",
      "sortOrder": 110
    }
  ]
}
```

## Accounts

### GET `/api/v1/accounts`

Protected.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Cash",
      "type": "cash",
      "currency": "IDR",
      "initialBalance": "1000000.0000",
      "currentBalance": "1000000.0000",
      "includeInNetWorth": true,
      "institutionName": null,
      "sortOrder": 0,
      "archivedAt": null
    }
  ]
}
```

### POST `/api/v1/accounts`

Protected.

Request:

```json
{
  "name": "BCA Utama",
  "type": "bank",
  "currency": "IDR",
  "initialBalance": "1500000.0000",
  "includeInNetWorth": true,
  "institutionName": "BCA",
  "sortOrder": 0
}
```

Response:

```json
{
  "id": "uuid",
  "name": "BCA Utama",
  "type": "bank",
  "currency": "IDR",
  "initialBalance": "1500000.0000",
  "currentBalance": "1500000.0000",
  "includeInNetWorth": true,
  "institutionName": "BCA",
  "sortOrder": 0,
  "archivedAt": null
}
```

### PATCH `/api/v1/accounts/{accountId}`

Protected. Account lookup must be scoped by authenticated user.

Request:

```json
{
  "name": "BCA Personal",
  "includeInNetWorth": true,
  "institutionName": "BCA",
  "sortOrder": 10
}
```

### DELETE `/api/v1/accounts/{accountId}`

Protected. Archives the account so financial history is not hard-deleted.

Response:

```json
{
  "success": true,
  "mode": "archived"
}
```

## Categories

### GET `/api/v1/categories`

Protected.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Food",
      "kind": "expense",
      "parentId": null,
      "colorToken": "orange",
      "iconToken": "utensils",
      "sortOrder": 0,
      "archivedAt": null
    }
  ]
}
```

### POST `/api/v1/categories`

Protected.

Request:

```json
{
  "name": "Food",
  "kind": "expense",
  "parentId": null,
  "colorToken": "orange",
  "iconToken": "utensils",
  "sortOrder": 0
}
```

### PATCH `/api/v1/categories/{categoryId}`

Protected. Category lookup must be scoped by authenticated user.

Request:

```json
{
  "name": "Meals",
  "parentId": null,
  "colorToken": "orange",
  "iconToken": "utensils",
  "sortOrder": 10
}
```

### DELETE `/api/v1/categories/{categoryId}`

Protected. Archives the category.

Response:

```json
{
  "success": true,
  "mode": "archived"
}
```

## Tags

### GET `/api/v1/tags`

Protected.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "kantor",
      "colorToken": "blue"
    }
  ]
}
```

### POST `/api/v1/tags`

Protected.

Request:

```json
{
  "name": "kantor",
  "colorToken": "blue"
}
```

### PATCH `/api/v1/tags/{tagId}`

Protected. Tag lookup must be scoped by authenticated user.

Request:

```json
{
  "name": "office",
  "colorToken": "blue"
}
```

### DELETE `/api/v1/tags/{tagId}`

Protected.

Response:

```json
{
  "success": true
}
```

## Transactions

### GET `/api/v1/transactions`

Query params:
- `cursor`
- `limit`
- `accountId`
- `categoryId`
- `type`
- `dateFrom`
- `dateTo`
- `search`
- `minAmount`
- `maxAmount`

Step 6 supports `type` values `income` and `expense` only. Transaction tag filtering is deferred.
Transfer rows are excluded from this endpoint and are managed through `/api/v1/transfers`.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "type": "expense",
      "amount": "85000.0000",
      "currency": "IDR",
      "account": {
        "id": "uuid",
        "name": "Cash"
      },
      "category": {
        "id": "uuid",
        "name": "Food"
      },
      "merchant": "Warung Makan",
      "note": "Makan siang",
      "source": "manual",
      "status": "posted",
      "transactionAt": "2026-05-16T08:30:00+07:00"
    }
  ],
  "nextCursor": null
}
```

### POST `/api/v1/transactions`

Request:

```json
{
  "accountId": "uuid",
  "type": "expense",
  "amount": "85000.00",
  "currency": "IDR",
  "categoryId": "uuid",
  "transactionAt": "2026-05-16T08:30:00+07:00",
  "merchant": "Warung Makan",
  "note": "Makan siang"
}
```

Response:

```json
{
  "id": "uuid",
  "type": "expense",
  "amount": "85000.0000",
  "currency": "IDR",
  "account": {
    "id": "uuid",
    "name": "Cash"
  },
  "category": {
    "id": "uuid",
    "name": "Food"
  },
  "merchant": "Warung Makan",
  "note": "Makan siang",
  "source": "manual",
  "status": "posted",
  "transactionAt": "2026-05-16T08:30:00.000Z"
}
```

Transaction tags (`tagIds`) and budget impact response fields are deferred until their
respective later steps.

### PATCH `/api/v1/transactions/{transactionId}`

Protected. Transaction lookup must be scoped by authenticated user. Updating amount,
type, account, or soft-delete state updates account balance using decimal-safe logic.

Request:

```json
{
  "accountId": "uuid",
  "type": "income",
  "amount": "95000.0000",
  "currency": "IDR",
  "categoryId": "uuid",
  "transactionAt": "2026-05-16T08:30:00+07:00",
  "merchant": "Client",
  "note": "Invoice payment"
}
```

Response matches `POST /api/v1/transactions`.

### DELETE `/api/v1/transactions/{transactionId}`

Protected. Soft-deletes the transaction and reverses its account balance impact.

Response:

```json
{
  "success": true,
  "mode": "soft_deleted"
}
```

## Transfers

### GET `/api/v1/transfers`

Protected. Returns one grouped transfer record per `transferGroupId`, not the two
raw transaction legs.

Query params:
- `cursor`
- `limit`

Response:

```json
{
  "items": [
    {
      "transferGroupId": "uuid",
      "outflowTransactionId": "uuid",
      "inflowTransactionId": "uuid",
      "fromAccount": {
        "id": "uuid",
        "name": "Cash"
      },
      "toAccount": {
        "id": "uuid",
        "name": "E-wallet"
      },
      "amount": "250000.0000",
      "currency": "IDR",
      "note": "Top up e-wallet",
      "status": "posted",
      "transactionAt": "2026-05-16T02:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### POST `/api/v1/transfers`

Protected. Creates two linked transfer transaction rows and updates both account balances atomically.
Currency is derived from the validated source and destination accounts; cross-currency
transfers are deferred.

Request:

```json
{
  "fromAccountId": "uuid",
  "toAccountId": "uuid",
  "amount": "250000.00",
  "transactionAt": "2026-05-16T09:00:00+07:00",
  "note": "Top up e-wallet"
}
```

Response:

```json
{
  "transferGroupId": "uuid",
  "outflowTransactionId": "uuid",
  "inflowTransactionId": "uuid",
  "fromAccount": {
    "id": "uuid",
    "name": "Cash"
  },
  "toAccount": {
    "id": "uuid",
    "name": "E-wallet"
  },
  "amount": "250000.0000",
  "currency": "IDR",
  "note": "Top up e-wallet",
  "status": "posted",
  "transactionAt": "2026-05-16T02:00:00.000Z"
}
```

### PATCH `/api/v1/transfers/{transferGroupId}`

Protected. Updates the transfer pair atomically. The request cannot directly set
currency; if either account changes, currency is re-derived after validating both
accounts use the same currency.

Request:

```json
{
  "fromAccountId": "uuid",
  "toAccountId": "uuid",
  "amount": "300000.00",
  "transactionAt": "2026-05-16T09:00:00+07:00",
  "note": "Top up e-wallet"
}
```

Response matches `POST /api/v1/transfers`.

### DELETE `/api/v1/transfers/{transferGroupId}`

Protected. Soft-deletes both transfer legs and reverses both account balance impacts atomically.

Response:

```json
{
  "success": true,
  "mode": "soft_deleted"
}
```

## Budgets

### GET `/api/v1/budgets`

Protected. Lists active budgets for a monthly period. `periodStart` is required and
must be the first day of a month. `currency` is optional and, when provided, must
be three uppercase letters.

Query params:
- `periodStart`
- `currency`

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "category": {
        "id": "uuid",
        "name": "Food"
      },
      "periodStart": "2026-05-01",
      "periodEnd": "2026-06-01",
      "amount": "1500000.0000",
      "currency": "IDR",
      "thresholdPercentage": "80.00",
      "spentAmount": "415000.0000",
      "remainingAmount": "1085000.0000",
      "spentPercentage": "27.67",
      "isThresholdExceeded": false,
      "status": "active"
    }
  ]
}
```

### POST `/api/v1/budgets`

Protected. Creates a monthly budget for an expense category. `periodEnd` is derived
as the first day of the next month. Creating an archived same category/month/currency
budget reactivates and updates it; creating an active duplicate returns a conflict.

Request:

```json
{
  "categoryId": "uuid",
  "periodStart": "2026-05-01",
  "amount": "1500000.00",
  "currency": "IDR",
  "thresholdPercentage": 80
}
```

Response matches a budget item from `GET /api/v1/budgets`.

### PATCH `/api/v1/budgets/{budgetId}`

Protected. Budget lookup is scoped by authenticated user. Updating to another
existing category/month/currency identity, active or archived, returns a conflict.

Request:

```json
{
  "categoryId": "uuid",
  "periodStart": "2026-06-01",
  "amount": "1750000.00",
  "currency": "IDR",
  "thresholdPercentage": 85
}
```

Response matches a budget item from `GET /api/v1/budgets`.

### DELETE `/api/v1/budgets/{budgetId}`

Protected. Archives the budget.

Response:

```json
{
  "success": true,
  "mode": "archived"
}
```

Budget spent calculation includes only transactions with the same user, category,
and currency where `type = "expense"`, `deletedAt = null`, `isDeleted = false`,
`transferGroupId = null`, `transferSide = null`, `transactionAt >= periodStart`,
and `transactionAt < periodEnd`.

## Recurring Rules

### GET `/api/v1/recurring-rules`

Protected. Lists non-archived rules owned by the authenticated user. Query params:
- `cursor`
- `limit`

### POST `/api/v1/recurring-rules`

Protected. Creates an income or expense recurring rule. Supported frequencies are
`daily`, `weekly`, and `monthly`. The backend snapshots the authenticated user's
timezone and derives the first upcoming occurrence from `startAt`; historical
occurrences are not backfilled when creating a rule.

Request:

```json
{
  "name": "Gaji bulanan",
  "frequency": "monthly",
  "intervalCount": 1,
  "startAt": "2026-05-25T09:00:00+07:00",
  "template": {
    "accountId": "uuid",
    "type": "income",
    "amount": "5000000.00",
    "currency": "IDR",
    "categoryId": "uuid",
    "merchant": "Salary"
  }
}
```

Response:

```json
{
  "id": "uuid",
  "name": "Gaji bulanan",
  "frequency": "monthly",
  "intervalCount": 1,
  "timezone": "Asia/Jakarta",
  "startAt": "2026-05-25T02:00:00.000Z",
  "endAt": null,
  "nextRunAt": "2026-06-25T02:00:00.000Z",
  "lastRunAt": null,
  "pausedAt": null,
  "lastGenerationErrorCode": null,
  "status": "active",
  "template": {
    "accountId": "uuid",
    "type": "income",
    "amount": "5000000.0000",
    "currency": "IDR",
    "categoryId": "uuid",
    "merchant": "Salary"
  }
}
```

The template intentionally has no note field. Account and category lookup is
scoped by the authenticated user. Template currency must match the active account
currency, and category kind must match transaction type.

### PATCH `/api/v1/recurring-rules/{ruleId}`

Protected. Updates rule fields or the complete template. Template-only updates
preserve the next scheduled occurrence. Schedule updates recompute the next
upcoming occurrence without historical backfill.

### DELETE `/api/v1/recurring-rules/{ruleId}`

Protected. Archives the rule without deleting generated ledger history.

Response:

```json
{
  "success": true,
  "mode": "archived"
}
```

### POST `/api/v1/recurring-rules/{ruleId}/pause`

Protected. Pauses future generation.

### POST `/api/v1/recurring-rules/{ruleId}/resume`

Protected. Validates dependencies and resumes at the next upcoming occurrence.
Occurrences during the paused period are skipped.

The in-process scheduler catches up occurrences missed during API downtime in
bounded batches. Each generated transaction is a normal editable, soft-deletable,
non-transfer ledger row with `source = "recurring"` and
`transactionAt = recurringOccurrenceAt`. Database uniqueness on
`(user_id, recurring_rule_id, recurring_occurrence_at)` prevents regeneration,
including after soft delete. An unavailable account or category auto-pauses the
rule with a safe error code.

## Reports

### GET `/api/v1/reports/dashboard`

Protected. Returns the read-only Dashboard MVP payload for one monthly period.
Dashboard money totals are grouped by currency because FX conversion is not part
of the MVP.

Query params:
- `periodStart` optional `YYYY-MM-DD`; when provided it must be the first day of
  a month. Defaults to the current month.
- `recentLimit` optional number, default `5`, max `10`.

Response:

```json
{
  "periodStart": "2026-05-01",
  "periodEnd": "2026-06-01",
  "summaryByCurrency": [
    {
      "currency": "IDR",
      "totalBalance": "5000000.0000",
      "monthlyIncome": "8000000.0000",
      "monthlyExpense": "3500000.0000",
      "netCashflow": "4500000.0000"
    }
  ],
  "budgetSummary": {
    "activeBudgetCount": 2,
    "thresholdExceededCount": 1,
    "warnings": [
      {
        "budgetId": "uuid",
        "category": {
          "id": "uuid",
          "name": "Food"
        },
        "amount": "1500000.0000",
        "currency": "IDR",
        "spentAmount": "1230000.0000",
        "remainingAmount": "270000.0000",
        "spentPercentage": "82.00",
        "thresholdPercentage": "80.00",
        "isThresholdExceeded": true
      }
    ]
  },
  "recentTransactions": [
    {
      "id": "uuid",
      "type": "expense",
      "amount": "85000.0000",
      "currency": "IDR",
      "account": {
        "id": "uuid",
        "name": "Cash"
      },
      "category": {
        "id": "uuid",
        "name": "Food"
      },
      "merchant": "Warung Makan",
      "status": "posted",
      "transactionAt": "2026-05-16T08:30:00.000Z"
    }
  ]
}
```

Dashboard income/expense and recent transactions include only the authenticated
user's normal income/expense rows in the selected period where `deletedAt = null`,
`isDeleted = false`, `transferGroupId = null`, and `transferSide = null`. Recent
dashboard transactions intentionally do not include notes. Budget warnings use
the same spent calculation rules as `GET /api/v1/budgets`.

### GET `/api/v1/reports/spending`

Protected. Returns expense spending grouped by category for an explicit date range.
Money totals are grouped per currency; the API does not convert or combine
currencies.

Query params:
- `dateFrom` required `YYYY-MM-DD`, inclusive.
- `dateTo` required `YYYY-MM-DD`, user-facing inclusive. The backend queries
  `transactionAt >= dateFrom` and `transactionAt < nextDay(dateTo)` using UTC
  date-only boundaries.
- `currency` optional three-letter uppercase currency code.

Response:

```json
{
  "dateFrom": "2026-05-01",
  "dateTo": "2026-05-31",
  "items": [
    {
      "category": {
        "id": "uuid",
        "name": "Food"
      },
      "currency": "IDR",
      "amount": "850000.0000",
      "percentage": "62.96"
    },
    {
      "category": null,
      "currency": "IDR",
      "amount": "50000.0000",
      "percentage": "3.70"
    }
  ],
  "totalsByCurrency": [
    {
      "currency": "IDR",
      "totalAmount": "1350000.0000"
    }
  ]
}
```

Rows include only the authenticated user's normal expense transactions where
`deletedAt = null`, `isDeleted = false`, `transferGroupId = null`,
`transferSide = null`, and `transactionAt` is in range. Percentages are
calculated within each currency. Items are sorted by currency and then amount
descending.

### GET `/api/v1/reports/cashflow`

Protected. Returns monthly income, expense, and net cashflow buckets for an
explicit date range. Transfers are excluded and currencies are kept separate.

Query params:
- `dateFrom` required `YYYY-MM-DD`, inclusive.
- `dateTo` required `YYYY-MM-DD`, user-facing inclusive. The backend queries
  `transactionAt >= dateFrom` and `transactionAt < nextDay(dateTo)` using UTC
  date-only boundaries.
- `currency` optional three-letter uppercase currency code.

Response:

```json
{
  "dateFrom": "2026-05-01",
  "dateTo": "2026-06-30",
  "grain": "month",
  "buckets": [
    {
      "periodStart": "2026-05-01",
      "periodEnd": "2026-06-01",
      "currency": "IDR",
      "incomeAmount": "8000000.0000",
      "expenseAmount": "3500000.0000",
      "netCashflow": "4500000.0000"
    }
  ]
}
```

Rows include only the authenticated user's normal income/expense transactions
where `deletedAt = null`, `isDeleted = false`, `transferGroupId = null`,
`transferSide = null`, and `transactionAt` is in range. Buckets are sorted by
`periodStart` ascending, then currency.

### GET `/api/v1/reports/net-worth`

Protected. Returns a current net worth snapshot from active account balances.
This is not a historical trend and does not perform FX conversion.

Query params:
- `currency` optional three-letter uppercase currency code.

Response:

```json
{
  "asOf": "2026-05-27T15:00:00.000Z",
  "summaryByCurrency": [
    {
      "currency": "IDR",
      "totalBalance": "5000000.0000",
      "accountCount": 2
    }
  ],
  "accounts": [
    {
      "id": "uuid",
      "name": "Cash",
      "type": "cash",
      "currency": "IDR",
      "currentBalance": "1000000.0000",
      "sortOrder": 0
    }
  ]
}
```

Net worth includes only active, non-deleted accounts for the authenticated user
where `includeInNetWorth = true`. Accounts are sorted by currency, sort order,
name, creation time, and id.

## Import

### POST `/api/v1/imports/csv`

Protected multipart upload. Use field `file`. Accept UTF-8 `.csv` files up to
1 MiB, 1,000 data rows, and 50 columns. Comma and semicolon delimiters are
detected deterministically. Raw CSV bytes are never stored.

Response:

```json
{
  "importId": "uuid",
  "filename": "statement.csv",
  "status": "mapping_required",
  "detectedColumns": ["date", "amount", "description"],
  "rowCount": 2,
  "expiresAt": "2026-06-03T10:00:00.000Z"
}
```

### POST `/api/v1/imports/{importId}/preview`

Protected. The import lookup and destination account lookup are scoped by the
authenticated user. One account is selected for the whole statement and currency
is derived from that account.

Request:

```json
{
  "accountId": "uuid",
  "amountSignConvention": "positive_income",
  "mapping": {
    "transactionAt": "date",
    "amount": "amount",
    "merchant": "description"
  }
}
```

`transactionAt` and `amount` are required mappings. `merchant` is optional.
`amountSignConvention` is `positive_income` or `positive_expense`. Dates accept
`YYYY-MM-DD` as midnight in the user's timezone or ISO 8601 datetimes with an
explicit offset. Amounts use strict signed decimals with `.` as the decimal
separator; zero, thousands separators, and locale decimal formats are rejected.

Response:

```json
{
  "importId": "uuid",
  "status": "ready_to_import",
  "summary": {
    "totalRowCount": 2,
    "validRowCount": 2,
    "invalidRowCount": 0,
    "incomeRowCount": 1,
    "expenseRowCount": 1,
    "importedRowCount": 0
  },
  "rows": [
    {
      "rowNumber": 2,
      "transactionAt": "2026-06-01T17:00:00.000Z",
      "amount": "125000.0000",
      "currency": "IDR",
      "type": "expense",
      "merchant": "Lunch",
      "errors": []
    }
  ]
}
```

Preview responses return normalized mapped fields and safe row errors only. Raw
unselected columns are never exposed.

### POST `/api/v1/imports/{importId}/confirm`

Protected. Uses the last successful preview, revalidates every row inside one
database transaction, and rejects the entire import if any row or the destination
account is invalid. Repeated confirmation returns the completed summary without
creating duplicate ledger rows.

Confirmed rows are normal uncategorized, note-free income/expense transactions
with `source = "import"`. They have null transfer and recurring metadata and
naturally affect account balances, dashboard, and reports.

### GET `/api/v1/imports`

Protected cursor-paginated recent import history. Returns safe summary fields,
filename, status, and timestamps only. Staged rows and raw mapping internals are
never returned.

## Export

CSV Export MVP supports transaction CSV export only. Export requests store safe
filters and metadata, but CSV bytes are not stored. Downloads are generated on
demand from the stored filters, so the export is not an immutable snapshot.

### POST `/api/v1/exports`

Protected. Creates a short-lived transaction CSV export request for the
authenticated user. `dateFrom` uses UTC date-only inclusive semantics. `dateTo`
is user-facing inclusive and queried as `< nextDay(dateTo)`. `currency` filters
only; no FX conversion is performed.

Request:

```json
{
  "exportType": "transactions_csv",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-12-31",
  "accountId": "uuid",
  "currency": "IDR",
  "transactionType": "expense"
}
```

All filters except `exportType` are optional. `transactionType` may be `income`,
`expense`, or `transfer`. When `accountId` is provided, the account lookup is
scoped by authenticated user and deleted accounts are rejected.

Response:

```json
{
  "exportId": "uuid",
  "exportType": "transactions_csv",
  "status": "ready",
  "filters": {
    "dateFrom": "2026-01-01",
    "dateTo": "2026-12-31",
    "accountId": "uuid",
    "currency": "IDR",
    "transactionType": "expense"
  },
  "filename": "money-tracker-transactions-2026-01-01-to-2026-12-31-2026-06-03.csv",
  "rowCount": null,
  "downloadUrl": "/exports/{exportId}/download?token=signed-token",
  "expiresAt": "2026-06-03T10:15:00.000Z",
  "createdAt": "2026-06-03T10:00:00.000Z",
  "completedAt": null
}
```

### GET `/api/v1/exports/{exportId}`

Protected. Export lookup is scoped by authenticated user. Expired exports return
`status = "expired"` and `downloadUrl = null`.

Response:

```json
{
  "exportId": "uuid",
  "exportType": "transactions_csv",
  "status": "ready",
  "filters": {
    "dateFrom": "2026-01-01",
    "dateTo": "2026-12-31"
  },
  "filename": "money-tracker-transactions-2026-01-01-to-2026-12-31-2026-06-03.csv",
  "rowCount": null,
  "downloadUrl": "/exports/{exportId}/download?token=signed-token",
  "expiresAt": "2026-06-03T10:15:00.000Z",
  "createdAt": "2026-06-03T10:00:00.000Z",
  "completedAt": null
}
```

### GET `/api/v1/exports`

Protected cursor-paginated export history for the authenticated user. Returns
safe metadata only; CSV content is never returned from history. Signed download
URLs may be returned to the authenticated client until expiry, but raw tokens are
not persisted, audited, or logged.

Query params:
- `cursor`
- `limit`

Response:

```json
{
  "items": [
    {
      "exportId": "uuid",
      "exportType": "transactions_csv",
      "status": "downloaded",
      "filters": {
        "dateFrom": "2026-01-01",
        "dateTo": "2026-12-31"
      },
      "filename": "money-tracker-transactions-2026-01-01-to-2026-12-31-2026-06-03.csv",
      "rowCount": 24,
      "downloadUrl": "/exports/{exportId}/download?token=signed-token",
      "expiresAt": "2026-06-03T10:15:00.000Z",
      "createdAt": "2026-06-03T10:00:00.000Z",
      "completedAt": "2026-06-03T10:02:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### GET `/api/v1/exports/{exportId}/download?token=...`

Protected. Requires both an active bearer token and a valid signed download
token. The signed token is short-lived, purpose-bound to CSV export download,
tamper-resistant, and not stored raw. Wrong-user, expired, and tampered tokens
are rejected.

Response is UTF-8 `text/csv` with `Content-Disposition: attachment`.

CSV columns, in stable order:

```txt
transaction_id,transaction_at,transaction_type,amount,currency,account_id,account_name,account_type,category_id,category_name,merchant,note,status,source,transfer_group_id,transfer_side
```

Rows include the authenticated user's non-deleted ledger rows only, including
income, expense, and transfer legs. Deleted rows, soft-deleted rows, other-user
rows, and rows attached to deleted accounts are excluded. Amounts are decimal
strings with four fractional digits. `source` identifies `manual`, `recurring`,
or `import` rows without exposing import or recurring internal IDs. Transfer
rows include `transfer_group_id` and `transfer_side` so linked transfer legs can
be understood. User-entered text fields are escaped for CSV and neutralized
against spreadsheet formula injection.
