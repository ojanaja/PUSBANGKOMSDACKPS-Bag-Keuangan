# SiAP-BPK (Sistem Aplikasi Pencairan - BPK)

Selamat datang di repositori utama **SiAP-BPK** (sebelumnya SiAP-PUSBANGKOMSDACKPS). Sistem ini adalah platform terpadu untuk memfasilitasi pencairan anggaran, monitoring, dan manajemen arsip digital.

## 🌟 Fitur Utama Terbaru

- **Arsip Digital Terintegrasi**: Upload dan manajemen dokumen berbasis CAS (Content-Addressable Storage) dengan informasi Uploader.
- **DIPA/RKKS Budget Module**: Snapshot bulanan untuk anggaran dengan fitur preview import Excel.
- **Role-Based Access Control (RBAC)**: Sistem permission yang granular untuk mengatur akses per fitur.
- **Automated Backup**: Cronjob harian otomatis untuk backup database dan storage ke Google Drive/SharePoint.

---

## 🚀 Instalasi & Menjalankan Aplikasi (Production)

Pastikan mesin telah memiliki **Docker** dan **Docker Compose** terinstall.

### 1. Persiapan Environment
Salin template environment untuk production:

```bash
cp .env.prod.example .env
```
Sesuaikan isi `.env`, terutama untuk kredensial `POSTGRES_PASSWORD` dan `JWT_SECRET`.

### 2. Konfigurasi Rclone (Untuk Backup)
Pastikan file `rclone.conf` tersedia pada *root directory* sebelum menjalankan Docker Compose. File ini digunakan untuk sinkronisasi otomatis ke SharePoint / Google Drive.

```bash
touch rclone.conf
# Edit rclone.conf dengan kredensial SharePoint/Google Drive Anda
```

### 3. Build & Run stack
Gunakan Docker Compose untuk membangun image dan menjalankan stack production:

```bash
make docker-build-prod
docker-compose -f docker-compose.prod.yml up -d
```
Aplikasi akan tersedia pada `https://localhost:8443` (atau sesuai konfigurasi reverse proxy tunnel/Nginx Anda).

---

## 🛠 Panduan Developer

Untuk pengembangan aktif, referensikan panduan berikut:
- **[Developer Guide](./DEVELOPER_GUIDE.md)**: Arsitektur, struktur folder, testing, dan tata cara migrasi database.
- **[User Manual](./USER_MANUAL.md)**: Panduan penggunaan fungsional UI bagi pengguna akhir.

## 🗄️ Backup & Restore

### Backup
Sistem backup harian sudah otomatis berjalan via cronjob di dalam container `keuangan-backup`. 
Anda juga dapat melakukan backup manual:
```bash
./scripts/backup_to_sharepoint.sh
```

### Restore Database (Disaster Recovery)
```bash
docker exec -i keuangan-db psql -U keuangan_admin -d keuangan_pusbangkom < /var/lib/postgresql/data/final_snapshot.sql
```

## 🧪 Testing

```bash
# Menjalankan Frontend Test (Pastikan Anda menggunakan npm)
cd frontend && npm run test

# Menjalankan Backend Test (Go)
cd backend && go test ./...
cd storage-service && go test ./...
```
