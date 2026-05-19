# Implementation Order

Ikuti urutan ini agar project aman dan tidak kacau.

## Step 1: Project Foundation

- setup repo
- setup frontend
- setup backend
- setup database
- setup ORM
- setup env
- setup lint/test/typecheck
- setup CI

Do not create business features yet.

## Step 2: Auth Foundation

- users table
- sessions table
- register
- login
- logout
- auth guard
- current user endpoint

## Step 3: Onboarding and Default Data

- profile settings
- default currency
- default categories
- create first account flow

## Step 4: Accounts

- account CRUD
- account list UI
- account form
- balance display

## Step 5: Categories and Tags

- category CRUD
- tag CRUD
- category selector
- tag selector

## Step 6: Transactions

- transaction table
- create income
- create expense
- list transactions
- edit transaction
- delete transaction
- update account balance
- transaction UI

## Step 7: Transfers

- transfer endpoint
- transfer group
- two-sided internal transaction
- transfer UI
- report exclusion logic

## Step 8: Budgets

- budget table
- budget CRUD
- spent calculation
- budget progress UI
- threshold warning

## Step 9: Dashboard

- total balance
- income month
- expense month
- net cashflow
- budget risk
- recent transactions

## Step 10: Reports

- spending by category
- cashflow by period
- net worth basic
- chart UI

## Step 11: Recurring Transactions

- recurring rules
- scheduled generation
- duplicate prevention
- pause/resume rule

## Step 12: CSV Import

- upload CSV
- map columns
- preview
- validate
- confirm import

## Step 13: CSV Export

- export request
- generate CSV
- signed download
- audit event

## Step 14: Settings and Privacy

- profile settings
- security settings
- data export shortcut
- delete account request
- audit log view

## Step 15: Production Hardening

- e2e tests
- security tests
- performance checks
- error monitoring
- backup verification
- documentation cleanup
