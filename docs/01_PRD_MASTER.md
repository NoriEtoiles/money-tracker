# 01 PRD Master

## Project Name

Money Tracker

## Product Type

Personal finance tracking web application, mobile-ready.

## Vision

Membantu pengguna memahami, mengontrol, dan merencanakan keuangan pribadi secara sederhana, aman, dan konsisten lintas perangkat.

## Product Positioning

Money Tracker adalah aplikasi pencatatan dan analisis keuangan pribadi yang mengutamakan:
- pencatatan cepat,
- budget yang mudah dipahami,
- laporan visual,
- keamanan data,
- exportability,
- dan fondasi teknis yang siap dikembangkan menjadi mobile app.

## Target User

### Primary Persona: Solo Planner

Pengguna individu yang ingin mengontrol pengeluaran, pemasukan, budget, dan target keuangan.

Kebutuhan:
- input transaksi cepat,
- kategori fleksibel,
- laporan bulanan,
- budget limit,
- recurring transactions,
- export data.

### Secondary Persona: Multi-Account User

Pengguna dengan banyak dompet/rekening/kartu/e-wallet.

Kebutuhan:
- multi-account,
- transfer antar akun,
- consolidated dashboard,
- cashflow report,
- account balance trend.

### Future Persona: Household Collaborator

Pengguna yang ingin berbagi budget dengan pasangan atau keluarga.

Kebutuhan:
- shared workspace,
- role permission,
- shared budget,
- audit activity.

## Core User Stories

### Auth

Sebagai pengguna, saya ingin membuat akun dan login dengan aman agar data keuangan saya tersimpan pribadi.

### Account Management

Sebagai pengguna, saya ingin membuat beberapa akun/dompet agar saldo tiap sumber uang dapat dilacak.

### Transaction Tracking

Sebagai pengguna, saya ingin mencatat pemasukan, pengeluaran, dan transfer agar histori keuangan saya rapi.

### Categorization

Sebagai pengguna, saya ingin mengelompokkan transaksi berdasarkan kategori dan tag agar laporan mudah dipahami.

### Budgeting

Sebagai pengguna, saya ingin membuat budget per kategori agar saya tahu batas pengeluaran bulanan.

### Reports

Sebagai pengguna, saya ingin melihat laporan spending, income, cashflow, dan net worth agar saya dapat mengambil keputusan lebih baik.

### Recurring Transactions

Sebagai pengguna, saya ingin transaksi rutin dibuat otomatis agar saya tidak perlu input berulang.

### Import/Export

Sebagai pengguna, saya ingin import dan export data agar saya tidak terkunci di satu aplikasi.

## MVP Acceptance Criteria

MVP dianggap selesai jika:

- User dapat register, login, logout.
- User dapat membuat minimal 1 account.
- User dapat membuat income transaction.
- User dapat membuat expense transaction.
- User dapat membuat transfer antar account.
- User dapat membuat category dan tag.
- User dapat membuat budget bulanan per kategori.
- Dashboard menampilkan ringkasan saldo, cashflow, dan budget.
- Reports menampilkan spending by category dan monthly cashflow.
- User dapat mencari dan memfilter transaksi.
- User dapat membuat recurring transaction.
- User dapat export transaksi ke CSV.
- Semua data user terisolasi dari user lain.
- API memiliki validasi input dan error format konsisten.
- Database memakai decimal/numeric untuk amount.
- Basic audit log tersedia untuk login, export, delete, dan perubahan security.
