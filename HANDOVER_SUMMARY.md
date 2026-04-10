# 📝 Ringkasan Perubahan Fitur (Handover SiAP-BPK)

Dokumen ini memuat ringkasan perubahan dan pembaruan fitur terbaru pada sistem SiAP-BPK sebelum proses *handover* tahap akhir.

---

## 🚀 Fitur Baru & Peningkatan

### 1. DIPA / RKKS Budget Module Refactor
- **Snapshot Bulanan**: Menerapkan arsitektur immutable (tidak dapat diubah) menggunakan snapshot untuk data anggaran, dengan periode revisi bulanan yang lebih ketat.
- **Preview Import Excel**: Penambahan *UI Feedback* untuk validasi data hasil import Excel sebelum di-commit ke database. Memastikan data selalu konsisten.

### 2. Arsip Digital & Penyimpanan Berbasis CAS 
- **Decoupled Storage Service**: Modul penyimpanan file kini telah mandiri (`storage-service`) agar kinerja utama aplikasi backend (API) tidak terbebani proses read/write dokumen.
- **UI Peningkatan**: Modal Arsip Digital diperlebar demi User Experience (UX). Notifikasi dan penambahan metadata (seperti daftar *Uploader*) sekarang terpampang rapi menggantikan *browser alert*.

### 3. Pembersihan Modul Usang (Legacy Cleanup)
- Menghapuskan modul yang sudah tidak relevan dari platform (termasuk *Paket*, *Dashboard Old*, *EWS*, dan *Audit Trail* redundant). 
- Struktur frontend sekarang lebih ringan dan waktu render aplikasi lebih responsif.

### 4. Granular User Permissions
- Panel manajemen *User Access* telah dibersihkan dari fungsi yang tidak digunakan. Akses *Role-Based Access Control* (RBAC) pada frontend telah dikaitkan langsung dengan API backend, sehingga keamanan sistem jauh lebih baik.

---

## 🛠️ Persiapan Stabilitas Sistem (Testing & Validation Handover)

Semua pemeriksaan pre-handover berikut telah diselesaikan dan berhasil terverifikasi hijau (Pass):
1. ✅ **Uji Frontend (Vitest)**: Seluruh 46 tes unit (`npm run test`) lolos dengan sukses.
2. ✅ **Uji Backend (Go Test)**: Pengujian handler, middleware, core services, logic, beserta `storage-service` berhasil dilewati.
3. ✅ **Build Production**: Image production frontend (Vite Typescript) maupun Go Backend sukses terkompilasi tanpa *error* type-check sedikitpun.
4. ✅ **Verifikasi Backup (Cronjob)**: Pemeriksaan cronjob internal Docker (rclone SharePoint Backup) telah terbukti terasosiasi dan siap digunakan untuk skema DR (Disaster Recovery).
5. ✅ **Database Snapshot**: Snapshot SQL final berhasil dieksekusi dengan *zero error* dan tersimpan aman di direktori lokal (`./postgres_data/final_snapshot.sql`).

Mengenai tes uji manual End-to-End (*E2E: Import -> Monitoring -> Upload Dokumen*), disarankan untuk kembali diujikan langsung oleh pengguna pada lingkungan STAGING / UAT menggunakan prosedur yang berlaku.

**Status Saat Ini:** Aplikasi *SiAP-BPK* berada dalam status *Production Ready* dan siap untuk proses deployment tahap lanjut!
