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

### POST `/api/v1/recurring-rules`

Request:

```json
{
  "name": "Gaji bulanan",
  "frequency": "monthly",
  "intervalCount": 1,
  "dayOfMonth": 25,
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

### GET `/api/v1/reports/cashflow`

### GET `/api/v1/reports/net-worth`

## Import

### POST `/api/v1/imports/csv`

Multipart upload.

Response:

```json
{
  "importId": "uuid",
  "status": "mapping_required",
  "detectedColumns": ["date", "amount", "description"]
}
```

### POST `/api/v1/imports/{importId}/confirm`

Request:

```json
{
  "mapping": {
    "date": "transactionAt",
    "amount": "amount",
    "description": "merchant"
  }
}
```

## Export

### POST `/api/v1/exports`

Request:

```json
{
  "type": "transactions_csv",
  "dateFrom": "2026-01-01",
  "dateTo": "2026-12-31"
}
```

Response:

```json
{
  "exportId": "uuid",
  "status": "queued"
}
```

### GET `/api/v1/exports/{exportId}`

Response:

```json
{
  "status": "ready",
  "downloadUrl": "signed-url",
  "expiresAt": "2026-05-16T10:00:00+07:00"
}
```
