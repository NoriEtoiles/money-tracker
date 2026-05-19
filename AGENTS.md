# AGENTS.md

Instruksi untuk AI coding agent yang bekerja pada repository Money Tracker.

## Project Identity

Project ini adalah aplikasi **Money Tracker** untuk tracking keuangan pribadi.

Arah produk:
- Web app terlebih dahulu.
- Mobile app dikembangkan setelah fondasi web stabil.
- MVP harus mendukung pencatatan manual, kategori, tags, akun/dompet, budget, recurring transaction, report dasar, CSV import, dan CSV export.
- Bank sync, OCR, AI insight, shared finance, investment tracking, dan attachment lanjutan adalah fitur Phase 2 atau lanjutan.

## Bahasa dan Style

- Gunakan TypeScript untuk frontend dan backend.
- Gunakan naming yang eksplisit dan konsisten.
- Jangan membuat abstraction berlebihan sebelum dibutuhkan.
- Prioritaskan readability, correctness, dan testability.
- Gunakan komentar hanya untuk logic yang tidak obvious.
- Ikuti gaya dan pola yang sudah ada di repository sebelum membuat pola baru.

## Recommended Stack

Default stack:
- Web frontend: Next.js
- Backend: NestJS
- Database: PostgreSQL
- ORM: Prisma
- Mobile future: Expo React Native
- Auth: OIDC-compatible provider, dengan opsi MFA/passkey di fase lanjut
- Queue: Redis-backed queue atau managed queue
- Storage: S3-compatible object storage

Jika stack project berbeda, sesuaikan implementasi tetapi pertahankan domain model, security rule, dan API contract.

## Architecture Rules

Gunakan modular monolith berbasis domain untuk MVP.

Backend structure yang direkomendasikan:

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

Frontend structure yang direkomendasikan:

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

Setiap module backend minimal memiliki:
- controller / route
- service
- DTO / validation schema
- repository atau Prisma access layer
- tests

## MVP Boundary

MVP core:
- auth foundation
- onboarding dan default data
- accounts
- categories dan tags
- manual transactions: income, expense, transfer
- budgets
- dashboard
- reports dasar
- recurring transactions
- CSV import
- CSV export
- settings dan privacy dasar

Jangan implementasi fitur Phase 2 sebelum MVP core selesai:
- bank sync
- OCR
- AI insight
- shared finance
- investment tracking lanjutan
- attachment/receipt workflow lanjutan
- advanced notification channel

## Non-Negotiable Rules

1. Jangan menyimpan nominal uang sebagai floating point.
2. Gunakan decimal/numeric untuk amount di database.
3. Di API, amount harus dikirim sebagai string decimal atau integer minor unit yang konsisten.
4. Semua entity user-owned wajib memiliki `user_id`.
5. Semua query data user harus scoped by authenticated user, bukan hanya by record id.
6. Jangan expose data atau internal database ID milik user lain.
7. Gunakan soft delete atau archive untuk data finansial penting.
8. Tambahkan audit log untuk aksi sensitif.
9. Jangan implementasi bank sync sebelum ledger manual stabil.
10. Jangan implementasi AI insight sebelum report dasar akurat.
11. Jangan hardcode currency hanya IDR; default boleh IDR, tapi schema harus multi-currency ready.

## Security Rules

- Password harus di-hash dengan algoritma kuat.
- Token/session harus dapat direvoke.
- Endpoint protected harus validasi auth dan authorization.
- Semua input harus divalidasi dengan DTO atau validation schema.
- Attachment upload harus dibatasi ukuran dan tipe file.
- Export data harus butuh auth aktif dan audit event.
- Delete account harus menggunakan confirmation step.
- Jangan log raw password, token, full financial notes, uploaded receipt content, atau payload sensitif.
- Tambahkan test untuk cross-user access denial pada fitur user-owned.

## API and Contract Rules

- Prefix endpoint mengikuti `docs/04_API_SPEC.md`, yaitu `/api/v1`.
- Gunakan JSON request/response untuk API biasa.
- Gunakan standard error format dari `docs/04_API_SPEC.md`.
- Gunakan cursor pagination untuk list endpoint.
- Validasi request body secara ketat.
- Setelah mengubah API contract, update dokumen API terkait.
- Setelah mengubah schema database, sertakan migration.
- Setelah mengubah behavior domain penting, update docs yang relevan di `/docs`.

## Testing Requirements

Minimal setiap fitur core memiliki:
- unit test untuk domain logic
- integration test untuk API + database
- e2e smoke test untuk flow utama bila flow sudah tersedia

Core domain yang wajib dites:
- create income transaction
- create expense transaction
- create transfer
- update transaction category
- budget spending calculation
- recurring transaction generation
- CSV import mapping
- export transaction data
- authorization isolation

## Implementation Behavior

Saat mengerjakan task:
1. Baca `AGENTS.md`.
2. Baca dokumen terkait di `/docs`, terutama spec yang sesuai dengan task.
3. Ikuti urutan implementasi dari `docs/tasks/IMPLEMENTATION_ORDER.md`.
4. Pilih satu task kecil yang bisa dites.
5. Jelaskan implementation plan singkat sebelum perubahan besar.
6. Implementasikan perubahan dengan scope kecil.
7. Tambahkan atau update test relevan.
8. Jalankan typecheck, test, lint, atau check lain yang tersedia dan relevan.
9. Ringkas hasil, file penting yang berubah, dan check yang dijalankan.

Jangan:
- langsung membuat semua fitur sekaligus,
- membuat fitur Phase 2 sebelum MVP core selesai,
- mengubah public contract tanpa update docs,
- membuat schema tanpa migration,
- mengabaikan authorization scoping,
- membuat abstraction besar tanpa kebutuhan nyata.

## Definition of Done

Sebuah task dianggap selesai jika:
- kode berjalan untuk flow yang diubah
- typecheck lolos
- test relevan lolos
- query user-owned scoped by authenticated user
- tidak ada data leakage antar user
- amount tidak memakai floating point untuk penyimpanan uang
- error handling jelas dan mengikuti format API
- audit log ditambahkan untuk aksi sensitif
- migration disertakan bila schema berubah
- dokumentasi terkait diperbarui bila contract berubah
- hasil akhir diringkas dengan jelas untuk reviewer
