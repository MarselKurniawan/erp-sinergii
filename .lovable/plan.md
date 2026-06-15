## Scope
Implement 4 major feature groups across DB, RPC, and UI:

1. **Inventory Costing (FIFO + Weighted Average)**
2. **Bank Reconciliation**
3. **Production Order (Manufacturing)**
4. **Reporting tambahan + Operational gaps** (soft delete, attachments, notifications, exec dashboard)

Karena ini sangat besar (~15 fitur, ~30+ file), aku breakdown jadi **4 fase migrasi terpisah** supaya bisa di-review per fase dan rollback aman kalau ada masalah.

---

## Fase 1 — Costing FIFO/Average + Inventory Valuation Report

### DB
- Tambah kolom `costing_method` di `companies` (enum: `fifo` | `average`), default `average`
- Tambah `unit_cost` & `remaining_qty` di `inventory_movements` (untuk FIFO layer tracking)
- Tambah `average_cost` di `inventory_stock` (untuk WAC running)
- RPC `compute_cogs(product_id, warehouse_id, qty)` → return COGS sesuai method
  - **FIFO**: ambil layer tertua dari `inventory_movements` yang `remaining_qty > 0`
  - **Average**: pakai `inventory_stock.average_cost`
- Update `_record_inventory_movement`:
  - Saat IN → buat layer baru (FIFO) atau recompute WAC: `new_avg = (old_qty*old_avg + in_qty*in_cost) / (old_qty+in_qty)`
  - Saat OUT → konsumsi layer FIFO / decrement WAC qty (avg tetap)
- Trigger di POS / SO Invoice / Stock Transfer OUT → auto pakai `compute_cogs`

### UI
- `Settings → Akuntansi`: dropdown pilih costing method per company
- `Reports → Inventory Valuation` (baru): tabel produk × warehouse × qty × avg_cost × total_value, dengan filter as-of date

---

## Fase 2 — Bank Reconciliation

### DB
- Table `bank_statements` (id, company_id, account_id [COA bank], period_start, period_end, opening_balance, closing_balance, status, imported_at)
- Table `bank_statement_lines` (id, statement_id, txn_date, description, ref_number, debit, credit, matched_payment_id, matched_je_line_id, status: `unmatched|matched|manual`)
- RPC `auto_match_bank_lines(statement_id)` → fuzzy match by date±3 hari + amount exact ke `payments` & `journal_entry_lines`
- RPC `finalize_bank_recon(statement_id)` → set semua lines matched/manual, lock statement

### UI
- `Banking → Rekonsiliasi Bank`:
  - List bank statement per akun
  - Import CSV (kolom: date, description, ref, debit, credit) atau input manual
  - Tampilan side-by-side: bank lines kiri, payment/JE kandidat kanan
  - Tombol Auto-match + manual link/unlink + Finalize

---

## Fase 3 — Production Order (Manufacturing)

### DB
- Table `production_orders` (id, company_id, order_number, product_id [finished], recipe_id, planned_qty, produced_qty, warehouse_id, start_date, finish_date, status: `draft|in_progress|completed|cancelled`, total_cost)
- Table `production_order_materials` (id, po_id, material_id, planned_qty, consumed_qty, unit_cost, total_cost) — di-snapshot dari recipe saat draft
- RPC `start_production(po_id)`:
  - Consume material → OUT dari warehouse (pakai costing_method)
  - Buat JE: D WIP / C Inventory Material
- RPC `complete_production(po_id, actual_qty)`:
  - IN finished good ke warehouse dengan `unit_cost = total_material_cost / actual_qty`
  - Buat JE: D Inventory Finished / C WIP
- Tambah COA wajib: `WIP (Work In Progress)` 1-1400

### UI
- `Manufacturing → Production Order` (menu baru di sidebar):
  - List, Create (pilih produk + recipe + qty + warehouse → auto-load BOM)
  - Detail dengan tombol Start → Complete
  - Cetak Work Order

---

## Fase 4 — Reporting tambahan + Operational gaps

### Reporting (UI baru, semua read dari existing tables)
- **Trial Balance Komparatif**: 2+ periode side-by-side, kolom: Akun | Period A Dr | Period A Cr | Period B Dr | Period B Cr | Variance
- **Cash Flow Indirect**: Net Income → adjustment non-cash (depresiasi) → ∆ working capital (AR, AP, Inventory) → CF Operasi + Investing + Financing
- **Customer Statement**: per customer, semua invoice + payment + saldo running per tanggal
- **Supplier Statement**: per supplier, semua bill + payment + saldo running

### Soft Delete / Void
- Tambah `voided_at`, `voided_by`, `void_reason` di: `invoices`, `bills`, `payments`, `journal_entries`, `pos_transactions`, `sales_orders`, `purchase_orders`
- RPC `void_transaction(entity_type, entity_id, reason)`:
  - Set voided_* fields
  - Buat reversing JE (D ↔ C swap) tanggal hari ini
  - Audit log otomatis (trigger sudah ada)
- UI: tombol "Void" di detail transaksi (ganti tombol Delete untuk role non-superadmin), dialog input reason, filter "Sembunyikan voided" di list

### Attachment
- Storage bucket `transaction-attachments` (private, RLS by company)
- Table `transaction_attachments` (id, company_id, entity_type, entity_id, file_path, file_name, mime_type, size, uploaded_by, uploaded_at)
- Component `<AttachmentList entityType entityId />` reusable → pasang di detail Invoice/Bill/GR/Payment/JE
- Upload (drag-drop), preview thumbnail untuk image, download untuk PDF

### Notifications
- Table `notifications` (id, user_id, company_id, type, title, message, link, read_at, created_at)
- Scheduled function (pg_cron, daily 6 AM):
  - Invoice jatuh tempo ≤7 hari & outstanding > 0 → notify sales/admin
  - Bill jatuh tempo ≤7 hari → notify purchasing/admin
  - Stock < min_stock → notify warehouse PIC
  - PO/SO status `pending_approval` >24 jam → notify approver
- UI: bell icon di header, dropdown list, badge unread count, mark as read

### Executive Dashboard (Consolidated)
- Halaman `/dashboard/executive` (akses: superadmin/admin only)
- Tidak filter per company — tampil semua company user punya akses
- KPI Cards: Total Revenue, Net Profit, Cash Position, AR, AP (sum lintas company)
- Chart: Revenue per Company (bar), Profit Margin trend (line), Top 5 Products lintas company
- Table: ringkasan per company (Revenue, Profit, Outstanding AR/AP, Stock Value)

---

## Eksekusi
Aku akan kerjakan **Fase 1 → 2 → 3 → 4 berurutan**. Setiap fase = 1 migrasi DB + UI changes, lalu lanjut fase berikutnya. Total estimasi ~4 ronde kerja besar.

## Catatan teknis
- Semua tabel baru: RLS by `user_has_company_access` + GRANT authenticated/service_role
- Semua RPC: `SECURITY DEFINER`, cek akses company di awal
- Period closing guard otomatis berlaku (sudah ada trigger di JE, invoices, bills, dll)
- Audit log otomatis (trigger sudah pasang di 40+ tabel)
- Bahasa UI: Indonesian
- Komponen dropdown: `SearchableSelect`

## Pertanyaan sebelum mulai
Mau aku langsung gas Fase 1 (Costing FIFO/Avg + Valuation Report) sekarang, atau ada penyesuaian scope di salah satu fase?
