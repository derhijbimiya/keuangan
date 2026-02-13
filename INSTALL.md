# Panduan Instalasi & Deploy Financial Applications V2

## 1. Pengantar
Aplikasi ini adalah sistem manajemen keuangan pribadi multi-user berbasis Google Apps Script dan Google Sheets. Dirancang untuk pencatatan transaksi, tabungan, dan rekap keuangan dengan tampilan dashboard modern.

## 2. Cara Instalasi

### a. Siapkan Google Spreadsheet
1. Buat Google Spreadsheet baru.
2. Buat sheet berikut (nama persis, case sensitive):
   - Users
   - Data
   - (Sheet transaksi dan rekap akan dibuat otomatis per user)
3. Isi sheet Users dan Data sesuai struktur di README.md.

### b. Deploy Apps Script
1. Buka menu Extensions > Apps Script di spreadsheet.
2. Buat file-file berikut di editor Apps Script:
   - AppConfig.gs
   - Auth.gs
   - Kode.gs
   - Main.gs
   - Transaksi.gs
   - Theme.gs
3. Copy-paste isi file dari repo ke masing-masing file di Apps Script.
4. Buat file HTML:
   - loginpage.html
   - dashboardpage.html
   - styleslogin.html
   - stylesdashboard.html
   - (Copy-paste sesuai repo)
5. Set loginpage.html sebagai entry point (Publish > Deploy as web app).
6. Set akses: Anyone, even anonymous.

### c. Konfigurasi Lanjutan
- Pastikan kolom foto di Users berisi File ID Google Drive (sharing: anyone with link can view).
- Cek CSP (Content Security Policy) jika ada masalah gambar.

## 3. Troubleshooting
- Jika ada error login, cek sheet Users dan Apps Script sudah benar.
- Jika foto profil tidak muncul, cek permission file di Google Drive.
- Untuk bantuan lebih lanjut, hubungi: wanschool04@gmail.com

---

Selamat menggunakan aplikasi Financial Applications V2!
