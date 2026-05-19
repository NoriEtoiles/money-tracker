# Codex Kickoff Prompt

Copy-paste prompt ini ke Codex atau AI coding agent.

```txt
You are working on the Money Tracker project.

First, read:
- AGENTS.md
- docs/00_OVERVIEW.md
- docs/01_PRD_MASTER.md
- docs/02_TECH_SPEC.md
- docs/03_DATABASE_SCHEMA.md
- docs/04_API_SPEC.md
- docs/07_TASK_BREAKDOWN.md
- docs/08_AI_CODING_GUIDE.md
- docs/09_SECURITY_PRIVACY.md
- docs/tasks/IMPLEMENTATION_ORDER.md

Project goal:
Build a web-first, mobile-ready personal finance tracker.

Important product strategy:
- MVP is manual-first.
- Bank sync is not part of MVP.
- OCR, AI insights, shared finance, investment tracking, and mobile app are later phases.
- The MVP must have strong foundations for auth, accounts, transactions, categories, tags, budgets, reports, CSV import/export, and audit logs.
- Follow docs/tasks/IMPLEMENTATION_ORDER.md and work on one small testable task at a time.

Non-negotiable engineering rules:
- Do not use floating point for money.
- Use decimal/numeric for amounts in the database.
- Use string decimal or a consistent integer minor-unit representation for money amounts in the API.
- Every user-owned table/entity must include user_id.
- Every user-owned query must be scoped by the authenticated user, not only by record id.
- Never expose data across users.
- Add tests for financial domain logic and authorization isolation.
- Keep architecture modular.
- Add a migration when schema changes.
- Update API/docs when public contracts change.
- Do not implement out-of-scope or Phase 2 features before MVP core is complete.

Start by creating only the initial project foundation:
1. backend skeleton
2. frontend skeleton
3. database migration setup
4. environment variable examples
5. health check endpoint
6. base README local setup
7. lint/typecheck/test scripts
8. basic CI scripts

Do not implement business features yet.
Do not implement all features at once.

After creating the foundation, summarize:
- files created
- how to run locally
- checks run
- next recommended implementation task
```
