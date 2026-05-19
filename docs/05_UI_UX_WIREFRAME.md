# 05 UI/UX Wireframe

## UX Principles

- Data harus mudah dibaca.
- Tambah transaksi harus cepat.
- Dashboard tidak boleh terlalu ramai.
- User harus selalu tahu saldo, spending, dan budget status.
- Mobile future harus mengutamakan quick capture.
- Web harus menjadi control center.

## Information Architecture

```txt
App
├── Dashboard
├── Transactions
│   ├── Transaction List
│   ├── Add Transaction
│   ├── Transaction Detail
│   └── Filters
├── Accounts
│   ├── Account List
│   ├── Account Detail
│   └── Add/Edit Account
├── Budgets
│   ├── Budget List
│   └── Budget Detail
├── Reports
│   ├── Spending Report
│   ├── Cashflow Report
│   └── Net Worth Report
├── Recurring
│   ├── Recurring List
│   └── Add/Edit Rule
├── Import/Export
└── Settings
    ├── Profile
    ├── Security
    ├── Notifications
    └── Data & Privacy
```

## Dashboard Wireframe

```txt
+------------------------------------------------------+
| Money Tracker                         [User Avatar]  |
+------------------------------------------------------+
| Total Balance     Income This Month   Expense Month  |
| Rp 5.000.000      Rp 8.000.000        Rp 3.500.000   |
+------------------------------------------------------+
| Budget Risk                                          |
| Food        ████████░░ 82%                           |
| Transport   █████░░░░░ 50%                           |
+------------------------------------------------------+
| Cashflow Chart                                       |
| [Line / Bar Chart]                                   |
+------------------------------------------------------+
| Recent Transactions                                  |
| - Food       Warung Makan       -Rp 85.000           |
| - Salary     Monthly Salary     +Rp 5.000.000        |
+------------------------------------------------------+
| [Add Transaction]                                    |
+------------------------------------------------------+
```

## Add Transaction Wireframe

```txt
+------------------------------------------------------+
| Add Transaction                                      |
+------------------------------------------------------+
| Type: [Expense] [Income] [Transfer]                  |
| Amount: Rp [____________]                            |
| Account: [Cash v]                                    |
| Category: [Food v]                                   |
| Date: [Today v]                                      |
| Merchant: [________________]                         |
| Note: [____________________]                         |
| Tags: [kantor] [+]                                   |
|                                                      |
| [Cancel]                              [Save]         |
+------------------------------------------------------+
```

## Transactions List Wireframe

```txt
+------------------------------------------------------+
| Transactions                          [+ Add]        |
+------------------------------------------------------+
| Search...                                             |
| [Date] [Account] [Category] [Type] [More Filters]    |
+------------------------------------------------------+
| Today                                                |
| Food          Warung Makan       Cash    -85.000     |
| Transport     Gojek              E-Wallet -20.000    |
+------------------------------------------------------+
| Yesterday                                            |
| Salary        Monthly Salary     BCA     +5.000.000  |
+------------------------------------------------------+
```

## Budgets Wireframe

```txt
+------------------------------------------------------+
| Budgets                              [May 2026 v]    |
+------------------------------------------------------+
| Food          Rp 415k / Rp 1.5m      27%             |
| Transport     Rp 300k / Rp 600k      50%             |
| Entertainment Rp 900k / Rp 1m        90% ⚠           |
+------------------------------------------------------+
| [+ Add Budget]                                       |
+------------------------------------------------------+
```

## Reports Wireframe

```txt
+------------------------------------------------------+
| Reports                              [May 2026 v]    |
+------------------------------------------------------+
| Tabs: [Spending] [Cashflow] [Net Worth]              |
+------------------------------------------------------+
| Spending by Category                                 |
| [Donut Chart]                                        |
+------------------------------------------------------+
| Category Breakdown                                   |
| Food          Rp 415.000                             |
| Transport     Rp 300.000                             |
+------------------------------------------------------+
```

## Settings Wireframe

```txt
+------------------------------------------------------+
| Settings                                             |
+------------------------------------------------------+
| Profile                                              |
| Security                                             |
| Notifications                                        |
| Data & Privacy                                       |
| Export Data                                          |
| Delete Account                                       |
+------------------------------------------------------+
```

## Component Inventory

### Core UI

- Button
- Input
- Select
- Date picker
- Modal
- Drawer
- Sheet
- Tabs
- Card
- Toast
- Badge
- Progress bar
- Skeleton loading
- Empty state
- Error state

### Finance Components

- Amount input
- Currency display
- Account selector
- Category selector
- Tag selector
- Transaction row
- Budget progress
- Balance card
- Cashflow chart
- Spending donut chart
- Export dialog
- Import mapping table

## Empty States

### No Transactions

Message:
> Belum ada transaksi. Tambahkan transaksi pertama untuk mulai melihat laporan keuanganmu.

CTA:
> Tambah Transaksi

### No Budget

Message:
> Budget membantu kamu mengontrol pengeluaran sebelum melewati batas.

CTA:
> Buat Budget

### No Account

Message:
> Buat akun/dompet pertama untuk mulai tracking saldo.

CTA:
> Buat Account

## Error States

### Import Failed

Show:
- file name
- row number
- column name
- reason
- retry button

### Transaction Save Failed

Show:
- user-friendly message
- keep form data
- retry button

## Responsive Rules

Desktop:
- sidebar navigation
- dashboard cards in grid
- reports with large charts
- transactions table/list hybrid

Mobile future:
- bottom navigation
- floating add button
- add transaction as bottom sheet
- compact reports
- quick amount keypad
