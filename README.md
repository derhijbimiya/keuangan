
# Financial Applications V2

## Kata Pengantar
Selamat datang di Financial Applications V2, aplikasi manajemen keuangan pribadi multi-user berbasis Google Apps Script dan Google Sheets. Aplikasi ini dirancang untuk membantu Anda mencatat transaksi, mengelola tabungan, dan memantau keuangan dengan mudah melalui dashboard interaktif.

## Fungsi Utama Aplikasi
- Multi-user dengan sistem login & autentikasi
- Dashboard interaktif (grafik, saldo, rekap)
- Pencatatan transaksi rekening & tabungan
- Manajemen tabungan (tambah, pakai, transfer)
- Rekap otomatis saldo & transaksi
- Multi-tema tampilan (dark/light)
- Upload & preset foto profil
- Reset password via OTP email

## Fitur Utama

- ✅ Multi-user dengan sistem autentikasi
- ✅ Dashboard interaktif dengan chart/grafik
- ✅ Pencatatan transaksi rekening (pemasukan, pengeluaran, transfer tabungan)
- ✅ Manajemen tabungan (tambah manual, pakai tabungan)
- ✅ Rekap otomatis dan ringkasan keuangan
- ✅ Multi-tema tampilan
- ✅ Upload foto profil
- ✅ Reset password dengan OTP via email


## Daftar File & Kegunaan

### Backend (Google Apps Script - .gs)
- **AppConfig.gs**: Konfigurasi utama aplikasi, mapping kolom sheet, preset avatar.
- **Auth.gs**: Sistem login, registrasi, OTP, update profil, validasi session.
- **Main.gs**: API dashboard, summary data, endpoint utama frontend.
- **Transaksi.gs**: Logika transaksi rekening & tabungan, CRUD transaksi.
- **Theme.gs**: Manajemen tema UI (dark/light/custom).
- **Kode.gs**: Helper functions, entry point Apps Script.
- **SESSION_SECURITY_DOCS.md**: Dokumentasi keamanan session (referensi).

### Frontend (HTML/CSS)
- **loginpage.html**: Halaman login, registrasi, reset password.
- **dashboardpage.html**: Dashboard utama, chart, form transaksi, popup menu.
- **styleslogin.html**: CSS halaman login/registrasi.
- **stylesdashboard.html**: CSS dashboard, popup, theme, responsive.

---


## Struktur Spreadsheet
Aplikasi menggunakan Google Sheets dengan struktur sheet dinamis per user. Berikut struktur utama:


### Sheet: Users
Data akun pengguna (login, profil, tema, foto).

| Kolom | Nama Kolom     | Keterangan                                 |
|-------|----------------|---------------------------------------------|
| A     | id             | ID user (contoh: U001)                      |
| B     | username       | Username login                              |
| C     | nama           | Nama lengkap                                |
| D     | email          | Email user                                  |
| E     | password_hash  | Password hash (SHA-256)                     |
| F     | role           | USER/ADMIN                                  |
| G     | status         | ACTIVE/INACTIVE                             |
| H     | foto           | File ID/link foto profil Google Drive        |
| I     | theme          | Tema tampilan                               |

---


### Sheet: Data
Preset avatar/foto profil pilihan user.

| Kolom | Nama Kolom   | Keterangan                                 |
|-------|--------------|---------------------------------------------|
| A     | nama_profil  | Nama karakter/avatar preset                 |
| B     | link_profil  | File ID foto di Google Drive                |

**Catatan:**
- File di Google Drive harus di-set sharing "Anyone with link can view"

---


### Sheet: TX1_[username]
Sheet transaksi rekening utama (otomatis per user, contoh: TX1_eki).

| Kolom | Nama Kolom      | Keterangan                       |
|-------|------------|------------|
| A | no | Nomor urut transaksi |
| B | tanggal | Tanggal transaksi (YYYY-MM-DD) |
| C | pengeluaran | Jumlah uang keluar |
| D | pemasukan | Jumlah uang masuk |
| E | tabungan | Transfer ke tabungan dari rekening |
| F | saldo_rekening | Saldo rekening setelah transaksi |
| G | id_transaksi | Kode unik transaksi (TX...) |
| H | keterangan | Catatan/keterangan transaksi |
| I | struck | Link/file bukti transaksi (upload struck ke Google Drive) |

**Fungsi:**
- Mencatat semua transaksi rekening (pemasukan, pengeluaran, transfer ke tabungan)
- Saldo rekening dihitung otomatis
- Upload struck: file bukti transaksi dapat di-upload dan link file otomatis tercatat di kolom struck

---


### Sheet: TX2_[username]
Sheet transaksi tabungan (otomatis per user, contoh: TX2_eki).

| Kolom | Nama Kolom      | Keterangan                       |
|-------|------------|------------|
| A | no_pakai_tabungan | Nomor urut |
| B | tanggal_pakai_tabungan | Tanggal transaksi tabungan |
| C | keperluan | Keterangan/keperluan |
| D | jumlah_tambah_tabungan | Tabungan masuk (manual) |
| E | jumlah_pakai_tabungan | Tabungan keluar (dipakai) |
| F | saldo_tabungan | Saldo tabungan setelah transaksi |
| G | id_pakai_tabungan | Kode unik transaksi (TXT...) |

**Fungsi:**
- Mencatat transaksi tambah tabungan manual
- Mencatat penggunaan/penarikan tabungan
- Saldo tabungan dihitung otomatis dari:
  - Tabungan dari rekening (TX1 kolom E)
  - Tambah tabungan manual (TX2 kolom D)
  - Dikurangi pakai tabungan (TX2 kolom E)

---


### Sheet: TOT_[username]
Sheet rekap total keuangan (otomatis per user, contoh: TOT_eki).

| Kolom | Nama Kolom      | Keterangan                       |
|-------|------------|------------|
| A | total_uang | Total saldo rekening saat ini |
| B | total_tabungan | Total saldo tabungan saat ini |
| C | total_pemasukan | Total semua pemasukan (dari TX1) |
| D | total_pengeluaran | Total semua pengeluaran (dari TX1) |
| E | total_tabungan | Total transfer ke tabungan dari rekening (dari TX1 kolom E) |
| F | tot_pemasukan_tabungan | Total pemasukan tabungan (rekening + manual) |
| G | total_pengeluaran_tabungan | Total pengeluaran tabungan (dari TX2) |
| H | — | (Reserved untuk fitur masa depan) |

**Format:**
- Row 1: Header
- Row 2: Nilai total (dihitung otomatis)

---


## Ringkasan Sheet per User
| Sheet            | Fungsi                        | Contoh         |
|------------------|-------------------------------|----------------|
| Users            | Data login & profil           | (shared)       |
| Data             | Avatar preset/foto profil     | (shared)       |
| TX1_[username]   | Transaksi rekening utama      | TX1_eki        |
| TX2_[username]   | Transaksi tabungan            | TX2_eki        |
| TOT_[username]   | Rekap total keuangan          | TOT_eki        |

---


## Alur Kerja Singkat
1. Register/Login → User membuat akun atau login
2. Dashboard → Lihat saldo, tabungan, grafik
3. Tambah transaksi rekening/tabungan
4. Analisis keuangan via chart
5. Filter data sesuai periode

---


## Teknologi
- Google Apps Script (backend)
- Google Sheets (database)
- HTML/CSS/JavaScript (frontend)
- Chart.js (visualisasi data)
- Canvas API (avatar fallback)

---


## Foto Profil & Avatar
Jika foto profil gagal di-load, sistem otomatis generate avatar fallback (initial nama, warna acak, via Canvas API). File foto harus di Google Drive (sharing: anyone with link can view).

---


## Catatan Penting
- Password di-hash SHA-256
- OTP via email
- Foto profil di Google Drive
- Multi-tema (CSS variables)
- Responsive (mobile & desktop)

---


---

Untuk panduan instalasi, setup spreadsheet, dan troubleshooting, lihat file INSTALL.md.

---
Financial Applications V2 - Personal Finance Management System