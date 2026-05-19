# 06 Roadmap

## Development Strategy

Build in small, testable phases.

```txt
Foundation
→ Core Ledger
→ Budgeting
→ Reports
→ Import/Export
→ Production Hardening
→ Mobile Foundation
→ Advanced Finance
→ Bank Sync
```

## Phase 0: Discovery and Setup

Output:
- repo setup
- docs folder
- architecture skeleton
- database migration setup
- CI pipeline
- lint/test/typecheck
- design tokens

Duration target:
- 1-2 weeks

## Phase 1: MVP Web Core

Output:
- auth
- user profile
- accounts
- categories
- tags
- transaction CRUD
- transfers
- dashboard
- budget
- recurring rules
- reports dasar
- CSV import/export
- audit log dasar

Duration target:
- 12-20 weeks depending team size.

## Phase 2: Web Beta Hardening

Output:
- better error handling
- performance optimization
- security review
- backup/restore plan
- observability
- privacy settings
- export improvements
- onboarding polish

Duration target:
- 3-6 weeks

## Phase 3: Mobile App Foundation

Output:
- Expo React Native app
- login
- dashboard
- add transaction
- transaction list
- basic sync
- push notification foundation

Duration target:
- 8-14 weeks

## Phase 4: Advanced Finance

Output:
- goals
- debt planner
- subscription tracker
- receipt attachment
- OCR
- advanced reports
- smart alerts

Duration target:
- 8-16 weeks

## Phase 5: Bank Sync

Output:
- external connections
- provider consent
- account mapping
- transaction sync
- webhook receiver
- reconciliation dashboard
- disconnect/revoke flow

Duration target:
- variable, depending launch country and provider.

## Release Policy

### Internal Alpha

Must include:
- account CRUD
- transaction CRUD
- categories
- dashboard basic

### Private Beta

Must include:
- budgets
- reports
- recurring
- import/export
- audit logs
- basic settings

### Public Beta

Must include:
- security hardening
- observability
- privacy policy
- data export
- onboarding
- production backup

## MVP Cut Line

Do not include in MVP:
- OCR
- bank sync
- AI insight
- shared finance
- investment tracking
- advanced automation
- mobile app full feature parity
