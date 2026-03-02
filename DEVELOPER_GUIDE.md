# Developer Guide - SiAP-PUSBANGKOMSDACKPS

Selamat datang di dokumentasi pengembang untuk **SiAP-PUSBANGKOMSDACKPS** (Sistem Aplikasi Pencairan - PUSBANGKOMSDACKPS). Dokumen ini berisi panduan lengkap untuk setup environment, struktur proyek, workflow pengembangan, dan deployment.

## 🛠 Tech Stack

### Backend
- **Language**: Go (Golang)
- **Framework**: [Echo v4](https://echo.labstack.com/)
- **Database Driver**: [pgx v5](https://github.com/jackc/pgx)
- **SQL Generator**: [sqlc](https://sqlc.dev/) (Type-safe SQL)
- **API Contract**: OpenAPI 3.0 with [oapi-codegen](https://github.com/deepmap/oapi-codegen)
- **Authentication**: JWT (JSON Web Tokens)

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand
- **Data Fetching**: TanStack Query v5
- **Icons**: Lucide React

### Infrastructure & Tools
- **Database**: PostgreSQL 16
- **Reverse Proxy**: Nginx
- **Containerization**: Docker & Docker Compose
- **Automation**: Makefile

---

## 🚀 Getting Started

### Prerequisites
Pastikan tools berikut sudah terinstall di mesin Anda:
- **Go** (v1.22+)
- **Node.js** (v22+)
- **Docker** & **Docker Compose**
- **Make** (Optional, tapi sangat direkomendasikan)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/keuangan-pusbangkom.git
cd keuangan-pusbangkom
```

### 2. Environment Setup

#### Backend (`backend/.env`)
Buat file `.env` di folder `backend/` (atau set environment variable secara manual).
Contoh konfigurasi minimal:
```ini
DB_URL=postgres://siap_admin:siap_password@localhost:5432/siap_bpk?sslmode=disable
JWT_SECRET=rahasia_super_aman_ganti_ini_di_prod
CAS_PATH=./storage/cas
BODY_LIMIT=50M
AUDIT_LOG_RETENTION_DAYS=90
```

#### Frontend (`frontend/.env`)
Salin file contoh yang ada:
```bash
cp frontend/.env.example frontend/.env
```
Sesuaikan `VITE_API_URL` jika backend berjalan di host/port berbeda (default biasanya `/api/v1` jika via proxy, atau `http://localhost:8080/api/v1` jika direct).

### 3. Menjalankan Aplikasi

#### Menggunakan Docker Compose (Recommended)
Cara termudah untuk menjalankan seluruh stack (Database + Backend + Frontend + Nginx):
```bash
# Build dan jalankan container
make docker-build
docker-compose up -d
```
Akses aplikasi di: `http://localhost`

#### Menjalankan Secara Manual (Development Mode)

**Database:**
Jalankan database saja menggunakan Docker:
```bash
docker-compose up -d db
```

**Backend:**
```bash
cd backend
go mod download
go run cmd/api/main.go
```
Backend akan berjalan di port default (biasanya 8080).

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Frontend akan berjalan di `http://localhost:5173`.

---

## 📂 Project Structure

```
├── backend/
│   ├── cmd/api/          # Entry point aplikasi backend
│   ├── internal/
│   │   ├── api/          # HTTP Handlers & Middleware
│   │   ├── db/           # Generated SQL Code (sqlc)
│   │   ├── services/     # Business Logic
│   │   └── util/         # Utility functions
│   ├── migrations/       # SQL Migration files
│   ├── query/            # Raw SQL queries for sqlc
│   ├── openapi.yaml      # API definition
│   └── sqlc.yaml         # Configuration for sqlc
├── frontend/
│   ├── src/
│   │   ├── features/     # Fitur module (Auth, Dashboard, dll)
│   │   ├── components/   # UI Components reusable
│   │   ├── services/     # API integration logic
│   │   └── stores/       # Global state (Zustand)
├── nginx/                # Konfigurasi Nginx
└── Makefile              # Automation scripts
```

---

## ⚙️ Development Workflow

### 1. Perubahan Database
Jika Anda mengubah skema database:
1. Buat file migrasi baru di `backend/migrations/`.
2. Edit query SQL di `backend/query/` jika diperlukan.
3. Generate kode Go baru:
   ```bash
   # Di dalam folder backend
   sqlc generate
   ```

### 2. Perubahan API
Jika Anda mengubah endpoint atau request/response:
1. Edit `backend/openapi.yaml`.
2. Generate kode handler interface:
   ```bash
   # Pastikan oapi-codegen terinstall
   # Biasanya sudah ada script di Makefile atau run manual:
   oapi-codegen -config oapi-codegen.yaml openapi.yaml
   ```
   *Catatan: Cek `backend/bin/oapi-codegen` atau konfigurasi generate yang digunakan.*

### 3. Testing
Gunakan Makefile untuk menjalankan test suite:
```bash
# Run backend tests
make backend-test

# Run frontend check
make frontend-check
```

---

## 🔍 Database Migrations
Migrasi database dikelola menggunakan tool file SQL di `backend/migrations/`.
Saat aplikasi dijalankan, pastikan migrasi `up` dijalankan ke database target.

---

## 📦 Deployment
Untuk production, gunakan file `docker-compose.prod.yml`:

```bash
# Build image production
make docker-build-prod

# Jalankan stack production
docker-compose -f docker-compose.prod.yml up -d
```

Pastikan environment variable di set dengan nilai production yang aman (terutama `JWT_SECRET` dan credentials database).

---

## 🛠 Troubleshooting

**Isu Koneksi Database:**
- Pastikan container `db` berjalan (`docker ps`).
- Cek `DB_URL` apakah sesuai dengan kredensial di `docker-compose.yml`.

**Isu CORS:**
- Jika frontend dan backend berjalan di port berbeda tanpa Nginx, pastikan konfigurasi CORS di backend mengizinkan origin frontend.
