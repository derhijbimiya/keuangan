// =============================================
// KONFIGURASI TERPUSAT APLIKASI
// =============================================
// Tujuan:
// - Menjadi satu-satunya tempat untuk nilai yang kemungkinan berubah.
// - Memudahkan maintenance tanpa cari nilai hardcoded di banyak file.
//
// Cara ubah yang aman:
// 1) Edit nilai hanya di file ini.
// 2) Jangan ubah nama key (kecuali sekalian update pemakai key di kode lain).
// 3) Untuk ID Google Drive/Spreadsheet gunakan ID murni, bukan URL penuh.
// 4) Setelah ubah, jalankan uji cepat fitur terkait (Bendahara, upload foto, tema, dsb).

const APP_CONFIG = {
  // -----------------------------------------------------------------
  // APP2_PAGE
  // Konfigurasi akses halaman Bendahara/App2.
  // -----------------------------------------------------------------
  APP2_PAGE: {
    // BlockApp2:
    // - 'Ya'    : menu Bendahara ditahan (muncul popup sedang pengembangan)
    // - 'Tidak' : menu Bendahara bisa diakses normal
    BlockApp2: 'Tidak',

    // App2OpenMode:
    // - '1' : buka Bendahara di tab/halaman yang sama
    // - '2' : buka Bendahara di tab baru
    App2OpenMode: '1'
  },

  // -----------------------------------------------------------------
  // AUTH
  // Konfigurasi autentikasi, session, OTP, dan validasi input user.
  // -----------------------------------------------------------------
  AUTH: {
    // SESSION_SHORT_HOURS:
    // Durasi session tanpa "Remember me" (satuan jam).
    // Cara ubah: ganti angka jam sesuai kebutuhan security policy.
    SESSION_SHORT_HOURS: 2,

    // SESSION_LONG_DAYS:
    // Durasi session dengan "Remember me" (satuan hari).
    // Cara ubah: ganti angka hari (contoh 7 -> 14).
    SESSION_LONG_DAYS: 7,

    // SESSION_CACHE_MAX_SECONDS:
    // Batas maksimal TTL cache session di CacheService.
    // Cara ubah: ganti detik, pastikan sesuai batas platform.
    SESSION_CACHE_MAX_SECONDS: 21600,

    // SESSION_TOKEN_KEY:
    // Key storage session token di browser (localStorage/sessionStorage).
    // Cara ubah: jika ganti nama key, update juga semua pemakai key di frontend.
    SESSION_TOKEN_KEY: 'sessionToken',

    // OTP_TTL_SECONDS:
    // Masa berlaku OTP dalam detik.
    // Cara ubah: ganti detik (contoh 600 = 10 menit).
    OTP_TTL_SECONDS: 10 * 60,

    // OTP_DIGITS:
    // Panjang digit OTP.
    // Cara ubah: ganti angka digit OTP (contoh 6 -> 5/8) lalu sesuaikan UI/validasi.
    OTP_DIGITS: 6,

    // OTP_ALLOWED_PURPOSES:
    // Daftar tujuan OTP yang valid di backend.
    // Cara ubah: tambah/hapus purpose, lalu update alur pemanggil API OTP.
    OTP_ALLOWED_PURPOSES: ['signup', 'reset'],

    // PASSWORD_MIN_LENGTH:
    // Panjang minimal password user.
    // Cara ubah: ganti angka minimal, lalu sinkronkan pesan validasi frontend.
    PASSWORD_MIN_LENGTH: 4,

    // PROFILE_PHOTO_MAX_BYTES:
    // Batas ukuran upload foto profil (byte).
    // Cara ubah: sesuaikan byte (contoh 1.5MB = 1572864).
    PROFILE_PHOTO_MAX_BYTES: 1.5 * 1024 * 1024,

    // PROFILE_PHOTO_ALLOWED_MIME_TYPES:
    // Daftar MIME type yang diizinkan untuk upload foto profil.
    // Cara ubah: tambah/hapus mime type sesuai kebutuhan.
    PROFILE_PHOTO_ALLOWED_MIME_TYPES: ['image/png', 'image/jpeg', 'image/webp']
  },

  // -----------------------------------------------------------------
  // ID_GENERATOR
  // Pengaturan generator ID internal aplikasi.
  // -----------------------------------------------------------------
  ID_GENERATOR: {
    // COUNTER_LOCK_TIMEOUT_MS:
    // Timeout lock (ms) saat generate ID agar aman dari race condition.
    // Cara ubah: naikkan jika sering lock timeout saat traffic tinggi.
    COUNTER_LOCK_TIMEOUT_MS: 10000,

    // SHORT_NUMBER_MODULO:
    // Modulo nomor pendek untuk format ID (rolling).
    // Cara ubah: ganti sesuai skema ID yang diinginkan.
    SHORT_NUMBER_MODULO: 1000,

    // SHORT_NUMBER_PAD_LENGTH:
    // Jumlah digit padding nomor ID (contoh 3 -> 001).
    // Cara ubah: ganti digit, pastikan kompatibel dengan parser ID lama.
    SHORT_NUMBER_PAD_LENGTH: 3,

    // DEFAULT_PREFIX:
    // Prefix fallback jika generator dipanggil tanpa prefix.
    // Cara ubah: ganti huruf default.
    DEFAULT_PREFIX: 'A',

    // Prefix khusus per entitas.
    // Cara ubah: ubah hanya jika skema ID baru sudah disiapkan menyeluruh.
    PREFIX_USER: 'U',
    PREFIX_PROFILE_PHOTO: 'P',
    PREFIX_TX_REKENING: 'TX',
    PREFIX_TX_TABUNGAN: 'AX'
  },

  // -----------------------------------------------------------------
  // STORAGE
  // Semua ID resource Google Drive/Spreadsheet untuk storage.
  // Format value: ID murni (contoh: 1AbC...)
  // -----------------------------------------------------------------
  STORAGE: {
    // Folder root Drive untuk arsip file Bendahara.
    // Di bawah folder ini sistem membuat subfolder per user/project.
    BENDAHARA_DRIVE_ROOT_FOLDER_ID: '1Rx6O0a0O2lBC6DuTmuVg7OhZlFg12SJo',

    // Spreadsheet khusus modul Bendahara (terpisah dari spreadsheet utama).
    BENDAHARA_SPREADSHEET_ID: '1LrFtofmKkIyhuFepw83GZiwLVX4YlczBI2yv1haHN9g',

    // Folder Drive untuk upload foto profil user.
    PROFILE_PHOTO_FOLDER_ID: '1z9FqYharqvWu6j5tzZmoDWKHHd018GG6'
  },

  // -----------------------------------------------------------------
  // URL
  // Template URL yang dipakai sistem untuk membentuk link dinamis.
  // Catatan: pertahankan placeholder {id} pada template Drive.
  // -----------------------------------------------------------------
  URL: {
    // Template URL thumbnail Google Drive.
    // {id} akan diganti otomatis dengan fileId.
    DRIVE_THUMBNAIL_URL_TEMPLATE: 'https://drive.google.com/thumbnail?id={id}&sz=w400',

    // Template URL direct-view Google Drive.
    // Dipakai untuk membuka/menampilkan file secara langsung.
    DRIVE_DIRECT_VIEW_URL_TEMPLATE: 'https://drive.google.com/uc?export=view&id={id}',

    // Base URL fallback avatar berbasis nama.
    // Nama user akan di-encode dan ditempel di belakang URL ini.
    UI_AVATAR_BASE_URL: 'https://ui-avatars.com/api/?name=',

    // DRIVE_FILE_ID_MIN_LENGTH / MAX_LENGTH:
    // Batas panjang fileId Google Drive untuk validasi sederhana.
    // Cara ubah: sesuaikan jika ada pola ID baru.
    DRIVE_FILE_ID_MIN_LENGTH: 20,
    DRIVE_FILE_ID_MAX_LENGTH: 50
  },

  // -----------------------------------------------------------------
  // SHEET
  // Nama sheet dan prefix sheet dinamis.
  // Ubah ini hanya jika struktur spreadsheet memang ikut diubah.
  // -----------------------------------------------------------------
  SHEET: {
    // Nama sheet master akun user.
    USERS_SHEET_NAME: 'Users',

    // Nama sheet data umum/preset avatar.
    DATA_SHEET_NAME: 'Data',

    // Nama sheet data rekening/e-wallet user.
    // Cara ubah: jika nama sheet utama rekening diganti.
    DATA2_SHEET_NAME: 'Data2',

    // Prefix lawas (jika masih dipakai util tertentu).
    TX_SHEET_PREFIX: 'TX_',

    // Prefix sheet transaksi rekening per user: TX1_username
    TX1_SHEET_PREFIX: 'TX1_',

    // Prefix sheet transaksi tabungan per user: TX2_username
    TX2_SHEET_PREFIX: 'TX2_',

    // Prefix sheet ringkasan total per user: TOT_username
    TOT_SHEET_PREFIX: 'TOT_',

    // Prefix sheet bendahara per user: TX4_username
    // Cara ubah: jika naming sheet bendahara diubah.
    TX4_SHEET_PREFIX: 'TX4_',

    // Nama sheet master project pada spreadsheet Bendahara.
    BENDAHARA_DATA_SHEET_NAME: 'Data'
  },

  // -----------------------------------------------------------------
  // BENDAHARA
  // Konfigurasi khusus modul Bendahara.
  // -----------------------------------------------------------------
  BENDAHARA: {
    // LOCK_TIMEOUT_MS:
    // Timeout lock (ms) saat create project / transaksi bendahara.
    // Cara ubah: naikkan jika lock sering timeout.
    LOCK_TIMEOUT_MS: 15000,

    // PROJECT_ID_PREFIX / TRANSACTION_ID_PREFIX:
    // Prefix ID global untuk data bendahara.
    // Cara ubah: ubah jika migrasi format ID bendahara.
    PROJECT_ID_PREFIX: 'PJC',
    TRANSACTION_ID_PREFIX: 'BDH',

    // STRUCTURED_ID_BLOCK_SIZE:
    // Ukuran blok serial per kombinasi huruf pada ID terstruktur.
    // Cara ubah: ubah hanya jika parser/generator ID ikut diupdate.
    STRUCTURED_ID_BLOCK_SIZE: 999,

    // PROJECT_NAME_MAX_LENGTH:
    // Batas panjang nama project pada UI.
    // Cara ubah: sesuaikan dengan validasi frontend/backend.
    PROJECT_NAME_MAX_LENGTH: 80,

    // EXPORT_DEFAULT_YEARS:
    // Rentang default export jika tanggal kosong (tahun ke belakang).
    // Cara ubah: 1 berarti 1 tahun terakhir.
    EXPORT_DEFAULT_YEARS: 1,

    // EXPORT_MAX_RANGE_DAYS:
    // Batas maksimal rentang export data.
    // Cara ubah: naikkan/turunkan sesuai kebutuhan performa.
    EXPORT_MAX_RANGE_DAYS: 366,

    // TABLE_DEFAULT_ITEMS_PER_PAGE:
    // Jumlah default data per halaman tabel bendahara.
    // Cara ubah: sesuaikan kebutuhan UX/performa.
    TABLE_DEFAULT_ITEMS_PER_PAGE: 15,

    // TABLE_PAGE_SIZE_OPTIONS:
    // Opsi pagination yang ditampilkan di UI bendahara.
    // Cara ubah: tambah/hapus opsi angka.
    TABLE_PAGE_SIZE_OPTIONS: [15, 25, 50, 100]
  },

  // -----------------------------------------------------------------
  // PAYMENT
  // Master referensi metode pembayaran bank/e-wallet.
  // -----------------------------------------------------------------
  PAYMENT: {
    // CASH_LABEL:
    // Label metode cash yang dipakai lintas modul.
    // Cara ubah: jika ingin istilah selain "Cash".
    CASH_LABEL: 'Cash',

    // BANK_KODE_MAP:
    // Mapping nama bank -> kode singkat.
    // Cara ubah: tambahkan entri baru dengan format 'Nama': 'Kode'.
    BANK_KODE_MAP: {
      'Bank Mandiri (BMRI)': 'BMRI',
      'Bank Rakyat Indonesia (BRI)': 'BRI',
      'Bank Negara Indonesia (BNI)': 'BNI',
      'Bank Tabungan Negara (BTN)': 'BTN',
      'Bank Central Asia (BCA)': 'BCA',
      'Bank CIMB Niaga (CIMB Niaga)': 'CIMB Niaga',
      'Bank Danamon (BDMN)': 'BDMN',
      'Bank Permata (BNLI)': 'BNLI',
      'Bank Panin (PNBN)': 'PNBN',
      'Bank OCBC NISP (NISP)': 'NISP',
      'Bank Mega (MEGA)': 'MEGA',
      'Bank Sinarmas (BSIM)': 'BSIM',
      'Bank Mayapada (MAYA)': 'MAYA',
      'Bank Capital Indonesia (BACA)': 'BACA',
      'Bank Bukopin (BBKP)': 'BBKP',
      'Bank Victoria (BVIC)': 'BVIC',
      'Bank Artha Graha Internasional (INPC)': 'INPC',
      'Bank Maspion Indonesia (BMAS)': 'BMAS',
      'Bank Jago (ARTO)': 'ARTO',
      'Bank Neo Commerce (BBYB)': 'BBYB',
      'Allo Bank (BBHI)': 'BBHI',
      'Bank Raya Indonesia (AGRO)': 'AGRO',
      'Bank Amar Indonesia (AMAR)': 'AMAR',
      'SeaBank Indonesia (BSEA)': 'BSEA',
      'Bank BTPN (BTPN)': 'BTPN',
      'Bank Syariah Indonesia (BSI)': 'BSI',
      'Bank Muamalat Indonesia (BMI)': 'BMI',
      'BCA Syariah (BCAS)': 'BCAS',
      'Bank Mega Syariah (BMS)': 'BMS',
      'Bank Panin Dubai Syariah (PNBS)': 'PNBS',
      'Bank Aladin Syariah (BANK)': 'BANK',
      'Bank Tabungan Negara Syariah (BTN Syariah)': 'BTN Syariah',
      'Citibank Indonesia (CITI)': 'CITI',
      'HSBC Indonesia (HSBC)': 'HSBC',
      'Standard Chartered Bank Indonesia (SCB)': 'SCB',
      'Bank of China Indonesia (BOC)': 'BOC',
      'JP Morgan Chase Bank Indonesia (JPM)': 'JPM',
      'Bank Commonwealth Indonesia (BCI)': 'BCI',
      'Bank UOB Indonesia (UOB)': 'UOB',
      'Bank DBS Indonesia (DBS)': 'DBS',
      'Bank ANZ Indonesia (ANZ)': 'ANZ',
      'Bank of India Indonesia (BOI)': 'BOI',
      'Bangkok Bank Indonesia (BBL)': 'BBL',
      'Mizuho Bank Indonesia (MHBK)': 'MHBK'
    },

    // EWALLET_KODE_MAP:
    // Mapping nama e-wallet -> kode singkat.
    // Cara ubah: tambahkan entri baru jika ada provider baru.
    EWALLET_KODE_MAP: {
      'GoPay': 'GoPay',
      'OVO': 'OVO',
      'DANA': 'DANA',
      'ShopeePay': 'ShopeePay',
      'LinkAja': 'LinkAja',
      'Jenius': 'Jenius',
      'i.saku': 'i.saku',
      'Sakuku': 'Sakuku',
      'DOKU': 'DOKU',
      'AstraPay': 'AstraPay',
      'MotionPay': 'MotionPay',
      'KasPro': 'KasPro',
      'Paytren': 'Paytren'
    },

    // BANK_LIST_UI / EWALLET_LIST_UI:
    // Daftar opsi yang ditampilkan di frontend autocomplete/dropdown.
    // Cara ubah: sesuaikan daftar UI agar sinkron dengan map kode di atas.
    BANK_LIST_UI: [
      'Bank Mandiri (BMRI)',
      'Bank Rakyat Indonesia (BRI)',
      'Bank Negara Indonesia (BNI)',
      'Bank Tabungan Negara (BTN)',
      'Bank Central Asia (BCA)',
      'Bank CIMB Niaga (CIMB Niaga)',
      'Bank Danamon (BDMN)',
      'Bank Permata (BNLI)',
      'Bank Panin (PNBN)',
      'Bank OCBC NISP (NISP)',
      'Bank Mega (MEGA)',
      'Bank Sinarmas (BSIM)',
      'Bank Mayapada (MAYA)',
      'Bank Capital Indonesia (BACA)',
      'Bank Bukopin (BBKP)',
      'Bank Victoria (BVIC)',
      'Bank Artha Graha Internasional (INPC)',
      'Bank Maspion Indonesia (BMAS)',
      'Bank Jago (ARTO)',
      'Bank Neo Commerce (BBYB)',
      'Allo Bank (BBHI)',
      'Bank Raya Indonesia (AGRO)',
      'Bank Amar Indonesia (AMAR)',
      'SeaBank Indonesia (BSEA)',
      'Bank BTPN (BTPN)'
    ],
    EWALLET_LIST_UI: [
      'GoPay',
      'OVO',
      'DANA',
      'ShopeePay',
      'LinkAja',
      'Jenius (milik BTPN)',
      'i.saku',
      'Sakuku',
      'DOKU',
      'AstraPay',
      'MotionPay',
      'KasPro',
      'Paytren'
    ]
  },

  // -----------------------------------------------------------------
  // THEME
  // Konfigurasi default dan alias key tema.
  // -----------------------------------------------------------------
  THEME: {
    // THEME_DEFAULT_KEY:
    // Tema fallback jika user belum punya tema / key invalid.
    // Cara ubah: gunakan salah satu key yang ada di THEME_LOGOS / THEME_REGISTRY.
    THEME_DEFAULT_KEY: 'dark-blue-modern',

    // THEME_ALIASES:
    // Mapping key lama -> key baru (backward compatibility).
    // Cara ubah: tambah alias jika migrasi nama tema.
    THEME_ALIASES: {
      'pink-hitam-modern': 'cyber-pink',
      'dark-japan-modern': 'dark-red-japan'
    }
  },

  // -----------------------------------------------------------------
  // CDN
  // Endpoint library frontend eksternal.
  // -----------------------------------------------------------------
  CDN: {
    // Cara ubah: ganti URL jika upgrade versi library.
    CHART_JS_URL: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    JSPDF_URL: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    JSPDF_AUTOTABLE_URL: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
    XLSX_URL: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    CHOICES_CSS_URL: 'https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css',
    CHOICES_JS_URL: 'https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js'
  },

  // -----------------------------------------------------------------
  // THEME_LOGOS
  // Mapping key tema -> fileId logo di Drive.
  // Jika mengganti logo tema:
  // 1) upload logo baru ke Drive,
  // 2) ambil fileId,
  // 3) ganti value sesuai key tema.
  // -----------------------------------------------------------------
  THEME_LOGOS: {
    'dark-blue-modern': '1Y81PgW88j34xDnqMJiZ9F5VKCs9_3DzD',
    'dark-red-japan': '1KKyK5H-J2YXAnPRPaQzjAQ0uyUTFf5fL',
    'cyber-pink': '1HNJVUBQDTyMZxXQPqNqxuNZU4XiNVTKj',
    'galaxy-nebula': '1WCI7gZ1F0SdWd7Xt66AWeFWeJMJ7ewDF',
    'neon-pink': '1t9rOkToSDUtKyUL4k5FTG1VOGJ3UW2KV',
    'rose-neon-dream': '1iMuAvwTbQfpaOx1mYm-saLSILUQGiG7_',
    'sakura-moonlight': '1OfiSbovuH9EM91s7Dq683rEuaHOO9AAf',
    'inferno-gold': '1hmI9z-KTwuetN4PYePA_ukoPf-Im3k8S',
    'neon-tokyo-night': '16biHWntfEe0Go6wmrMdwODGr3XkNx8UG',
    'emerald-forest': '1zGdKGRlmRuDlhk_raRN-63ys92UqX2U5'
  }
};
