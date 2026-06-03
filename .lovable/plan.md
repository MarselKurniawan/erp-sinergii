# Rencana Implementasi

Ada 3 perubahan besar yang saling terkait. Karena scope-nya luas (menyentuh banyak halaman), saya pecah jadi fase yang bisa dikerjakan bertahap.

---

## 1. Auto-Generate Nomor Transaksi (semua dokumen)

**Tujuan:** User tidak bisa lagi ketik nomor manual. Sistem yang generate otomatis pakai `generate_document_number` (sudah ada di DB).

**Halaman yang diubah** (hilangkan input nomor, generate saat save):
- Sales Orders → `SO-YYYYMM-XXXX`
- Invoices → `INV-YYYYMM-XXXX`
- Sales Payments → `PAY-IN-YYYYMM-XXXX`
- Purchase Orders → `PO-YYYYMM-XXXX`
- Goods Receipts → `GR-YYYYMM-XXXX`
- Bills → `BILL-YYYYMM-XXXX`
- Purchase Payments → `PAY-OUT-YYYYMM-XXXX`
- Down Payments → `DP-YYYYMM-XXXX`
- Manual Journal Entries → `JE-YYYYMM-XXXX`
- POS Transactions → tetap format `INV-YYYYMMDD-XXXXX` (sudah otomatis)

**UI**: Field nomor jadi readonly + label "Auto-generated saat disimpan".

---

## 2. Role-Based Access Control (RBAC) Granular

**Tambahan role baru:**
- `superadmin` — bisa atur permission semua user, akses semua fitur
- `admin` — akses semua fitur operasional (tidak bisa atur permission)
- `user` — default no access, harus di-assign manual per fitur
- `cashier` — tetap khusus POS

**Database baru:**

```sql
-- Tambah 'superadmin' ke enum app_role
ALTER TYPE app_role ADD VALUE 'superadmin';

-- Tabel daftar fitur sistem
CREATE TABLE features (
  key TEXT PRIMARY KEY,         -- contoh: 'sales.invoices'
  module TEXT NOT NULL,         -- 'Sales', 'Purchase', 'Inventory', dst
  label TEXT NOT NULL,          -- 'Invoices'
  description TEXT
);

-- Permission per user per fitur per aksi
CREATE TABLE user_permissions (
  id UUID PK,
  user_id UUID,
  feature_key TEXT REFERENCES features(key),
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  UNIQUE(user_id, feature_key)
);
```

**Function check:**
```sql
has_permission(_user_id, _feature_key, _action) → boolean
-- superadmin & admin auto-true
-- lainnya cek user_permissions
```

**Frontend:**
- Hook `usePermissions()` → cache permission user di context
- Komponen `<RequirePermission feature="sales.invoices" action="edit">` untuk wrap tombol/route
- Sidebar dinamis: hanya tampil menu yang `can_view = true`
- Tombol Edit/Delete disembunyikan jika tidak ada izin

**Halaman baru: Settings → Permissions** (hanya superadmin)
- Pilih user → matriks fitur × aksi (checkbox view/create/edit/delete)
- Bulk apply per modul

---

## 3. Universal Audit Log

Sudah ada tabel `activity_logs` + helper `logActivity()`. Saat ini hanya dipakai sebagian. Yang perlu dilakukan:

**Strategi: Database triggers** (lebih reliable daripada panggil dari frontend di setiap tempat)

```sql
-- Generic trigger function yang catat INSERT/UPDATE/DELETE
CREATE FUNCTION audit_trigger() RETURNS trigger ...
  -- INSERT: log action='create' dengan snapshot row
  -- UPDATE: log action='update' dengan diff (old vs new)
  -- DELETE: log action='delete' dengan snapshot row
  -- Pakai auth.uid() untuk user_id, current_setting untuk context

-- Pasang ke semua tabel transaksi:
CREATE TRIGGER audit_xxx AFTER INSERT/UPDATE/DELETE ON <table>
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

**Tabel yang di-audit:** sales_orders, invoices, payments, purchase_orders, bills, goods_receipts, down_payments, journal_entries, pos_transactions, products, customers, suppliers, chart_of_accounts, fixed_assets, stock_transfers, stock_opname, companies, user_roles, user_permissions, user_companies.

**Audit Trail page** (sudah ada di `/accounting/activity-log`) tinggal pastikan filter & search jalan untuk volume baru.

---

## Estimasi Eksekusi

Karena scope sangat besar, saya sarankan kerjakan **bertahap** supaya tidak ada regression:

- **Fase 1** — Migration DB: enum superadmin, tabel features, user_permissions, audit triggers, function helper
- **Fase 2** — Auto-generate nomor di semua form (1 fase, semua sekaligus)
- **Fase 3** — RBAC frontend: hook, guard component, sidebar dinamis, halaman Permissions
- **Fase 4** — Verifikasi audit log muncul di setiap aksi

---

## Pertanyaan sebelum mulai

1. **Default permission untuk role `user`**: kosong (harus assign manual) atau view-only semua?
2. **User saat ini** (`marshel@sinergimanajemen.com`): apakah jadi `superadmin`? Admin lain ikut jadi `superadmin` atau tetap `admin`?
3. **Audit log untuk SELECT (view)**: dicatat juga atau cukup write-actions (create/update/delete) saja? *(rekomendasi: write saja, biar tidak membengkak)*
4. **Halaman Permissions**: matriks per user, atau bikin "permission templates/groups" (mis. role kustom) yang bisa di-assign ke banyak user?

Setelah dijawab, saya mulai dari Fase 1 (migration).
