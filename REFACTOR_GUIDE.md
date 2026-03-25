# 📋 REFACTOR_GUIDE: Major Refactor SiAP-BPK (Gaya OneDrive & FA Detail)

Dokumen ini adalah instruksi lengkap untuk agen pelaksana refactor major pada aplikasi SiAP-BPK.

## 🎯 Sasaran Utama
Mengubah aplikasi dari "Dashboard Monitoring Statis" menjadi **"Explorer Anggaran Dinamis (Gaya OneDrive)"**. User harus merasakan pengalaman menelusuri folder (drill-down) hingga ke transaksi terkecil.

## 🛠️ Langkah-langkah Eksekusi (Untuk Agent):

### 1. Struktur Navigasi & UI (Frontend)
- **Auto-Redirect**: Ubah flow paska-login agar langsung mengarah ke `/anggaran` (Budget Integration).
- **Sidebar Cleanup**: Sembunyikan menu-menu lama (Beranda, Progres Satker, Monitoring, dll) agar user tidak bingung. Sisakan hanya **"Explorer Anggaran"** dan **"Arsip Digital"**.
- **Interactive Breadcrumbs**: Implementasi bar navigasi path (Home > [Program] > [Output] > [Akun]) yang bisa diklik untuk navigasi mundur.
- **Drill-down Folder**: Gunakan tabel di mana klik pada baris akan "masuk" ke level hierarki di bawahnya (Program > Kegiatan > Output > SubOutput > Komponen > SubKomponen > Akun > Item > Transaksi).

### 2. Implementasi Kolom FA Detail (Frontend)
Tabel anggaran harus mengikuti kolom pada file benchmark berikut: 
Path: `/Users/fauzan/Downloads/Laporan Fa Detail (16 Segmen) (4).csv`

**Kolom Wajib:**
1. **Uraian** (Nama entitas)
2. **Pagu Revisi** & **Lock Pagu**
3. **Realisasi TA 2026** (Periode Lalu, Periode Ini, s.d. Periode, %)
4. **Sisa Anggaran**

### 3. Logika Temporal (Bulan)
- Tambahkan **Global Month Selector (Jan-Des)**.
- Implementasi logika perhitungan relasi temporal:
    - **Periode Ini**: Data pada bulan terpilih.
    - **Periode Lalu**: Akumulasi data Januari s.d Bulan (Pilihan - 1).
    - **s.d. Periode**: Total akumulasi Januari s.d Bulan Pilihan.

### 4. Manajemen Dokumen (Arsip Digital)
- **Reuse CAS Storage**: Tetap gunakan sistem Content Addressable Storage yang sudah ada untuk penyimpanan file fisik.
- **Hierarchical Linking**: Geser relasi `dokumen_bukti` agar tertempel di level **"Item"** atau **"Transaksi"** (level terdalam dari explorer), bukan di level paket.

---

# 💡 Tips Hemat Kredit (Cost Efficiency)

1. **Batch Processing**: Berikan instruksi ini dalam satu prompt besar agar agen bisa merencanakan semua perubahan dalam satu siklus pemikiran tanpa banyak bertanya.
2. **Path Absolut**: Selalu gunakan path absolut dalam instruksi pengerjaan agar agen tidak memboroskan kredit untuk mencari file secara manual.
3. **Verifikasi Final**: Minta agen melakukan verifikasi visual (screenshot) hanya di akhir pengerjaan atau pada milestone besar saja (per 25% progress).
4. **No Placeholders**: Instruksikan agen untuk menulis kode asli (production-ready), bukan sekadar komentar atau placeholder yang butuh perbaikan di giliran berikutnya.
5. **Direct Navigation**: Jika ada error, minta agen membacanya dari log docker (`docker-compose logs`) secara langsung untuk troubleshooting cepat.
