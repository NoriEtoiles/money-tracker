# 00 Overview

## Ringkasan

Money Tracker adalah aplikasi personal finance tracking yang dibangun sebagai **web-first control center** dan nantinya dikembangkan menjadi **mobile daily companion**.

Produk ini membantu pengguna:
- mencatat pemasukan dan pengeluaran,
- mengelola akun/dompet/rekening,
- membuat budget,
- memonitor cashflow,
- melihat laporan keuangan,
- mengatur transaksi rutin,
- mengekspor data,
- dan nantinya melakukan bank sync, OCR receipt, goals, debt planner, serta AI insight.

## Strategi Produk

Strategi utama:

```txt
Manual-first
-> Cloud sync
-> Advanced reports
-> Mobile app
-> OCR / goals / debt planner
-> Bank sync
-> AI insight
```

## Alasan Strategi Manual-First

Bank sync bergantung pada:
- negara launch,
- provider open banking,
- izin pengguna,
- dukungan institusi keuangan,
- kualitas data transaksi,
- dan biaya integrasi.

Karena itu MVP harus tetap berguna tanpa bank sync.

## MVP Scope

MVP wajib mencakup:

- Authentication
- User profile
- Account/wallet management
- Transaction CRUD
- Income / expense / transfer
- Categories and tags
- Monthly budget
- Recurring transactions
- Dashboard
- Reports dasar
- Search and filter
- CSV import
- CSV export
- Audit log dasar
- Security settings dasar

## Phase 2 Scope

- Mobile app
- Receipt attachment
- OCR
- Goals
- Debt planner
- Smart alerts
- Advanced reports
- Subscription tracker
- Multi-currency conversion
- Bank sync provider integration

## Phase 3 Scope

- Shared finance
- Family/household budgets
- Investment snapshot
- AI insight
- Forecasting
- Public API / webhook
- Advanced automation rules
