# SINERGI ERP — User Flow Lengkap

Panduan alur pakai end-to-end. Ikuti urutan agar semua modul terhubung (jurnal otomatis, stok, laporan).

---

## 0. Setup Awal (Superadmin / Admin, 1x saja)

```
Login → Select Company → Settings
```

1. **Settings → Companies** — buat/pilih perusahaan (isi `business_type`).
2. **Settings → Users** — buat user via Edge Function (bukan sign-up). Assign role: `admin` / `user` / `cashier`.
3. **Settings → Permissions** — untuk role `user`, centang fitur per modul (view/create/edit/delete).
4. **Chart of Accounts** — generate default COA sesuai industri (Trading / Service / Manufacturing).
5. **Settings → Numbering** — atur format nomor dokumen (INV, BILL, PO, JE, dst).
6. **Settings → Account Mapping** — map akun default per Customer / Supplier / Product (Piutang, Hutang, Penjualan, HPP, Persediaan, Pajak).
7. **Settings → Enable Features / Show-Hide Fields / Discount-Tax / Terms** — sesuaikan modul aktif.
8. **Inventory → Warehouses** — buat gudang.
9. **Accounts → Manage Opening Balance** — input saldo awal COA & stok.
10. **Settings → System Health Check** — jalankan scan; klik **Auto-Fix Mapping** untuk isi mapping kosong.

---

## 1. Master Data

| Modul | Menu | Catatan |
|---|---|---|
| Produk jadi | Inventory / Sales → Products | Kode otomatis `PRD-YYYYMM-XXXX` bila dikosongi |
| Bahan baku | Inventory → Materials | Satuan terkecil dipakai otomatis di Recipe/BOM |
| Recipe/BOM | Inventory → Recipes | Dropdown satuan dari grup satuan material |
| Customer | Contacts / Sales → Customers | Auto-code |
| Supplier | Contacts / Purchases → Suppliers | Auto-code |
| Kategori Biaya | Expenses → Categories | Map ke akun default |

---

## 2. Flow Penjualan (Sales)

```
Estimate (opsional)
   └─► Sales Order ──► Down Payment (opsional)
                          │
                          ▼
                     Invoice  ◄── Recurring Template (opsional)
                          │
                          ▼
                     Payment (Receipt kas masuk)
                          │
                          ▼
              [Auto] Journal Entry + Update AR
```

- **Convert Estimate → Invoice** langsung dari halaman Estimates.
- Invoice `posted` → trigger `auto_post_invoice` bikin JE (Dr Piutang, Cr Penjualan, Cr PPN).
- Payment `approved` → trigger `auto_post_payment` bikin JE (Dr Kas, Cr Piutang) & update outstanding.
- **Sales Return** menghasilkan JE balik + stok masuk kembali.

---

## 3. Flow Pembelian (Purchase)

```
Purchase Order ──[approval]──► Confirm
      │
      ▼
Goods Receipt (stok masuk, WAC/FIFO)
      │
      ▼
Bill (auto dari GR) ──[approval]──► [Auto] JE (Dr Persediaan/HPP, Dr PPN, Cr Hutang)
      │
      ▼
Payment ──[approval]──► [Auto] JE (Dr Hutang, Cr Kas) + alokasi ke Bill
      │
      ▼
Purchase Return (opsional)
```

- **Approval Center** (`/approvals`) wajib untuk PO, Bill, Payment. Tanpa approve → trigger `guard_approval_required` block.
- Harga baru di Material otomatis **weighted-average** dengan stok lama.

---

## 4. Flow POS (Kasir)

```
Buka Sesi Kas (POS Cash Session)
      │
      ├── Transaksi Langsung
      │     └─► Pilih item → Bayar → Cetak struk → [Auto] JE + stok keluar
      │
      └── Open Table
            └─► Klik "Open Tabel" di POS → pilih meja
                      │
                      ▼
                Tambah item → klik "Tambah ke Meja {nama}"
                      │
                      ▼  (bisa berulang, item tersimpan di meja)
                      │
                Klik "Bayar & Tutup Meja"
                      │
                      ▼
              [Auto] pos_transaction terhubung ke open_table_id
              → meja otomatis di-close → stok keluar → JE
```

- Halaman **Open Tables** (`/pos/open-tables`) hanya **read-only snapshot**. Tambah/ubah item hanya via POS.
- **Tutup Kas** wajib rekonsiliasi (Kas Seharusnya vs Aktual). Diblok bila masih ada meja aktif.
- Deposit / Uang Muka meja tersedia di menu Deposits.

---

## 5. Kas & Bank

```
Cash & Bank Transfers ── antar akun kas/bank
Receipts               ── penerimaan kas non-invoice
Expenses               ── pengeluaran → JE otomatis pakai Expense Category
Bank Reconciliation    ── import CSV mutasi bank → auto-match ke Payments
Fix Payment Mapping    ── perbaiki mapping akun kas historis
```

---

## 6. Akuntansi & Aset

- **Journal Entries** — input manual (harus balance Debit=Credit).
- **Capital Transactions** — setoran/prive pemilik.
- **Fixed Assets** — auto depresiasi bulanan (straight-line / declining).
- **Period Closing** — kunci periode; transaksi tanggal ≤ periode ditolak.
- **Activity Log** — audit trail otomatis semua CRUD.

---

## 7. Manufaktur (opsional)

```
Recipe/BOM ──► Production Order (draft)
                    │
                Start Production ── konsumsi bahan (stok keluar, FIFO/WAC)
                    │
                Complete Production ── stok produk jadi masuk dgn unit cost = total material / qty
```

---

## 8. Laporan (Reports)

Sudah tersedia:
- **Finansial**: Trial Balance, Balance Sheet, Profit & Loss (6 varian), Cashflow (Direct/Indirect), General Ledger, Day Book.
- **AR/AP**: Aged Receivables/Payables, Customer/Supplier Statement.
- **Sales/Purchase**: Sales/Purchase Report, Detailed, Return, Order, Payment.
- **Produk**: Product Sales/Purchase, Top Products/Clients.
- **Inventory**: Stock Card, Valuation, Inventory Report.
- **Pajak**: Tax Report (PPN Masukan vs Keluaran).
- **POS**: POS Reports (revenue, tax, payment method).

Semua laporan filter by **company + date range**, export CSV/Excel dengan metadata.

---

## 9. Recurring & Otomatisasi

- **Recurring Templates** (`/recurring/templates`) — Invoice/Bill berulang (daily/weekly/monthly/yearly). Tombol **Run Now** untuk generate manual.
- Trigger DB otomatis: journal posting, inventory movement, notification jatuh tempo (7 hari), audit log.

---

## 10. Approval & Notifikasi

```
User buat PO/Bill/Payment → status "pending"
   │
   ▼
Admin buka /approvals → Approve / Reject
   │
   ▼
Approved → JE otomatis + notifikasi ke pembuat
Rejected → alasan tercatat, dokumen tidak diproses
```

Notification bell di header menampilkan: approval required, invoice/bill due.

---

## Ringkasan Prasyarat sebelum "Go Live"

- [x] Company & user + role
- [x] COA lengkap + Account Mapping
- [x] Numbering format
- [x] Warehouse & Opening Balance
- [x] Master Customer/Supplier/Product/Material
- [x] Health Check hijau semua
- [x] Sesi POS + Printer (jika retail/F&B)

Setelah semua centang → sistem siap dipakai penuh.
