# Restructure Sidebar + Bangun Halaman yang Belum Ada

Saya akan **ganti total struktur menu sidebar** sesuai daftar yang Anda kirim, lalu **buat halaman baru** untuk submenu yang belum ada — dikerjakan urut dari atas ke bawah.

## Pemetaan Menu (Nama Baru → Halaman)

```text
Dashboard                                   → /dashboard (ADA)

Sale
├─ Create New Sale                          → /sales/invoices?new=1 (ADA, tambah auto-open)
├─ Sale List                                → /sales/invoices (ADA)
├─ Create New Estimate          [BARU]      → /sales/estimates/new
├─ Estimate List                [BARU]      → /sales/estimates
├─ New Sale Order                           → /sales/orders?new=1 (ADA)
├─ Sale Order List                          → /sales/orders (ADA)
└─ Sale Return                  [BARU]      → /sales/returns

Purchase
├─ New Purchase                             → /purchases/bills?new=1 (ADA)
├─ Purchase List                            → /purchases/bills (ADA)
├─ New Purchase Order                       → /purchases/orders?new=1 (ADA)
├─ Purchase Order List                      → /purchases/orders (ADA)
└─ Purchase Return              [BARU]      → /purchases/returns

Expense                         [BARU GROUP]
├─ New Expenses                 [BARU]      → /expenses/new
└─ Expenses List                [BARU]      → /expenses

Payment & Cash/Bank
├─ New Payment                              → /sales/payments?new=1 (ADA, gabungan)
├─ Payment List                             → /sales/payments + /purchases/payments
├─ New Cash/Bank Transfer       [BARU]      → /cash-bank/transfers/new
├─ Cash/Bank Transfer List      [BARU]      → /cash-bank/transfers
├─ Show Cash/Bank Balance                   → /cash-bank (ADA)
└─ Fix Payment Mapping Issues   [BARU]      → /cash-bank/fix-mapping

Receipt                         [BARU]      → /receipts

Capital Transaction             [BARU GROUP]
├─ New Transaction              [BARU]      → /capital/new
└─ Transaction List             [BARU]      → /capital

Accounts
├─ New Account                              → /accounts?new=1 (ADA)
├─ Account List                             → /accounts (ADA)
└─ Manage Opening Balance       [BARU]      → /accounts/opening-balance

Journal
├─ New Journal                              → /journal?new=1 (ADA)
└─ Journal List                             → /journal (ADA)

Customer & Supplier
├─ New Customer/Supplier                    → /contacts/new (gabung)
├─ Customer/Supplier List       [BARU]      → /contacts (gabungan Customer + Supplier)
└─ Show Receivables/Payables    [BARU]      → /contacts/receivables-payables

Product/Services
├─ New Product                              → /products?new=1 (ADA)
└─ Product List                             → /products (ADA)

Reports
├─ All Reports                              → /reports (ADA list)
├─ Sales Report
│  ├─ Sales / Payment Report    [BARU]      → /reports/sales-payment
│  ├─ Product Sales Report      [BARU]      → /reports/product-sales
│  ├─ Sales By Clients - Top 5  [BARU]      → /reports/top-clients
│  ├─ Sales By Products - Top 5 [BARU]      → /reports/top-products
│  ├─ Sale Order Report         [BARU]      → /reports/sale-orders
│  ├─ Invoice Aging Sales                   → /reports/aged-receivables (ADA)
│  ├─ Detailed Sales Report                 → /reports/sales (ADA)
│  └─ Sales Return Report       [BARU]      → /reports/sales-returns
├─ Purchase Report
│  ├─ Product Purchase Report   [BARU]      → /reports/product-purchase
│  ├─ Purchase Report                       → /reports/purchases (ADA)
│  ├─ Invoice Aging Supplier                → /reports/aged-payables (ADA)
│  ├─ Purchase Order Report     [BARU]      → /reports/purchase-orders
│  ├─ Detailed Purchase Report  [BARU]      → /reports/purchases-detailed
│  └─ Purchase Return Report    [BARU]      → /reports/purchase-returns
├─ Profit & Loss Report
│  ├─ Monthly/Weekly/Daily P&L - COGS              [BARU]   → /reports/pl-cogs-period
│  ├─ Monthly/Weekly/Daily P&L - Stock Changes    [BARU]   → /reports/pl-stock-period
│  ├─ P&L Using COGS                                → /reports/profit-loss (ADA)
│  ├─ P&L Using Opening/Closing Stock   [BARU]      → /reports/pl-stock
│  ├─ Product wise Profit/Loss          [BARU]      → /reports/pl-product
│  ├─ Invoice wise Profit/Loss          [BARU]      → /reports/pl-invoice
│  └─ Client wise Profit/Loss           [BARU]      → /reports/pl-client
├─ Balance Sheet Report
│  ├─ Balance Sheet                                 → /reports/balance-sheet (ADA)
│  └─ Trial Balance                                 → /reports/trial-balance (ADA)
└─ Other Reports
   ├─ Expense Report             [BARU]    → /reports/expense
   ├─ Detailed Expense Report    [BARU]    → /reports/expense-detailed
   ├─ Inventory Report                     → /reports/inventory (ADA)
   ├─ Day Book Report            [BARU]    → /reports/day-book
   ├─ Cash Flow Statement                  → /reports/cashflow (ADA)
   └─ Tax Report                           → /reports/tax (ADA)

Settings → Primary Settings
├─ User Profile                             → /settings/profile (ADA)
├─ Discount and Taxes          [BARU]       → /settings/discount-tax
├─ Terms and Conditions        [BARU]       → /settings/terms
├─ Invoice Theme               [BARU]       → /settings/invoice-theme
├─ Printer Settings                         → /pos/printer-settings (ADA)
├─ Balance Sheet Setting       [BARU]       → /settings/balance-sheet
├─ Customize Dashboard         [BARU]       → /settings/dashboard
├─ Enable / Disable Feature    [BARU]       → /settings/features
├─ Show/Hide Fields            [BARU]       → /settings/fields
├─ Inventory Setting           [BARU]       → /settings/inventory
├─ Payment Tracking            [BARU]       → /settings/payment-tracking
├─ Banking Details & PayPal.Me [BARU]       → /settings/banking
└─ Manage Fields in Documents  [BARU]       → /settings/document-fields
```

## Strategi Eksekusi (Urut dari Atas)

Karena halaman baru yang dibutuhkan **>30 halaman**, saya kerjakan **bertahap urut atas → bawah** sesuai permintaan, **batch per grup menu**, supaya bisa Anda review per batch tanpa nunggu lama.

### Batch 1 — Sidebar Restructure + Sale group
- Tulis ulang `src/components/layout/Sidebar.tsx` total dengan struktur menu di atas (semua item terdaftar; submenu yang halaman-nya belum ada → arahkan ke route baru).
- Tambah grup menu baru di urutan persis seperti yang Anda kirim.
- Buat halaman: **Estimates (list + new)**, **Sales Return**.
- Tambah route di `App.tsx`.

### Batch 2 — Purchase + Expense + Payment/Cash Bank
- Buat: **Purchase Return**, **Expenses (list + new)**, **Cash/Bank Transfer (list + new)**, **Fix Payment Mapping**.

### Batch 3 — Receipt + Capital Transaction + Accounts/Journal extras
- Buat: **Receipt**, **Capital Transaction (list + new)**, **Manage Opening Balance**.

### Batch 4 — Customer & Supplier gabungan
- Buat halaman gabungan **Contacts** dan **Receivables/Payables** combo view.

### Batch 5 — Reports baru (Sales group, Purchase group)
- Buat 6 report Sales + 5 report Purchase.

### Batch 6 — Reports P&L variants + Other reports
- Buat 6 P&L variant + 3 Other reports baru.

### Batch 7 — Settings sub-pages
- Buat 11 halaman settings.

## Catatan Penting

1. **Tidak ada fitur lama yang dihapus** — Inventory, POS, Manufacturing, Banking Reconciliation, Fixed Assets, Period Closing dll tetap ada tapi **dipindah ke section "Advanced" di bawah** supaya menu utama bersih sesuai spek Anda. Konfirmasi kalau mau dibuang total.
2. **Bahasa menu** akan saya pakai **persis seperti yang Anda kirim (English)** karena daftar Anda English. Kalau mau Bahasa Indonesia, bilang sebelum saya mulai.
3. **Database** — beberapa halaman butuh tabel baru (estimates, sales_returns, purchase_returns, expenses, cash_bank_transfers, receipts, capital_transactions, opening_balances). Tiap batch akan disertai migrasi.
4. **Estimasi total** — 7 batch, masing-masing 1 reply.

## Mulai Batch 1?

Konfirmasi:
- (A) **Mulai Batch 1 sekarang** (Sidebar baru + Sale group), atau
- (B) Ada nama/urutan menu yang perlu diubah dulu, atau
- (C) Pilih bahasa menu (English seperti spek vs Indonesia)?
