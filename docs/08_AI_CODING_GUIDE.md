# 08 AI Coding Guide

## Purpose

Dokumen ini dibuat agar Codex atau AI coding agent lain dapat mengerjakan project secara konsisten tanpa keluar dari scope.

## How to Start

Prompt awal ada di:

```txt
docs/prompts/CODEX_KICKOFF_PROMPT.md
```

Setelah agent membaca prompt tersebut, minta agent mulai dari:

```txt
docs/tasks/IMPLEMENTATION_ORDER.md
```

## Working Mode

Gunakan pola:

```txt
Read docs
-> Select one task
-> Explain implementation plan briefly
-> Modify code
-> Add tests
-> Run checks
-> Summarize result
```

## Do Not Do

AI agent tidak boleh:
- langsung membuat semua fitur sekaligus,
- membuat bank sync sebelum manual ledger stabil,
- membuat AI insight sebelum report dasar akurat,
- menyimpan amount sebagai float,
- hardcode semua currency sebagai IDR,
- mengabaikan authorization,
- membuat API response tidak konsisten,
- membuat schema tanpa migration,
- mengubah API/schema contract tanpa update docs,
- membuat fitur Phase 2 sebelum MVP core selesai.

## Prompt Pattern per Task

Gunakan format ini saat meminta agent mengerjakan task:

```txt
Read AGENTS.md and all relevant files in /docs.

Task:
[deskripsikan task kecil]

Constraints:
- Follow the existing architecture.
- Add tests.
- Do not implement out-of-scope features.
- Update docs only if API/schema contract changes.
- Scope every user-owned query by authenticated user.
- Use decimal/string handling for money amounts.

Definition of done:
- Typecheck passes.
- Tests pass.
- No user data leakage.
- Error handling is consistent.
- Relevant docs are updated when contracts change.
```

## Recommended First Prompt

```txt
Read AGENTS.md and docs/00_OVERVIEW.md through docs/04_API_SPEC.md.

Then create the initial project architecture for the Money Tracker MVP using the recommended stack.

Do not implement all features yet. Only create:
- backend skeleton
- frontend skeleton
- environment config examples
- database migration setup
- health check endpoint
- basic CI scripts
- README local setup instructions

After that, summarize the file structure and next recommended task.
```

## Code Review Checklist for AI Output

Before accepting AI changes, check:

- Does it follow `AGENTS.md`?
- Are financial amounts handled safely?
- Is every user-owned query scoped by user?
- Are DTOs/validation schemas present?
- Are tests included?
- Is error handling consistent?
- Is documentation updated if contract changed?
- Are secrets avoided in code?
- Are logs safe?
- Are Phase 2 features avoided until MVP core is complete?
