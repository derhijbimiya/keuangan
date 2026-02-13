/**
 * AppConfig.gs
 * - Tambah: helper normalisasi URL Google Drive untuk <img>
 * - Preset avatar dibaca dari sheet 'Data' kolom A (nama profil) dan B (link profil/file ID)
 */

const CONFIG = {
  USERS_SHEET_NAME: 'Users',
  DATA_SHEET_NAME: 'Data',
  TX_SHEET_PREFIX: 'TX_',
  TX1_SHEET_PREFIX: 'TX1_',
  TX2_SHEET_PREFIX: 'TX2_',
  TOT_SHEET_PREFIX: 'TOT_',

  USERS_COL: {
    id: 1,
    username: 2,
    nama: 3,
    email: 4,
    password_hash: 5,
    role: 6,
    status: 7,
    foto: 8,
    theme: 9
  },

  USERS_AVATAR_PRESET_COL: {
    nama_profil: 11, // K
    link_profil: 12  // L
  },

  TX_COL: {
    no: 1,
    tanggal: 2,
    pengeluaran: 3,
    pemasukan: 4,
    tabungan: 5,
    saldo_rekening: 6,
    id_transaksi: 7,

    no_pakai_tabungan: 11,
    tanggal_pakai_tabungan: 12,
    keperluan: 13,

    // UPDATED (TX2 structure v2):
    // TX2 kolom D sekarang: jumlah_tambah_tabungan
    // TX2 kolom E: jumlah_pakai_tabungan
    // TX2 kolom F: saldo_tabungan
    // TX2 kolom G: id_pakai_tabungan
    jumlah_tambah_tabungan: 14,
    jumlah_pakai_tabungan: 15,
    saldo_tabungan: 16,
    id_pakai_tabungan: 17,

    total_uang: 19,
    total_tabungan: 20,
    total_pemasukan: 21,
    total_pengeluaran: 22
  }
};

/**
 * Theme logos mapping - File IDs dari Google Drive
 * Ubah file ID di sini untuk mengganti logo tema
 */
const THEME_LOGOS = {
  'dark-blue-modern': '1Y81PgW88j34xDnqMJiZ9F5VKCs9_3DzD',
  'dark-red-japan': '1KKyK5H-J2YXAnPRPaQzjAQ0uyUTFf5fL',
  'cyber-pink': '1HNJVUBQDTyMZxXQPqNqxuNZU4XiNVTKj'
};

function getActiveSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheetOrThrow_(name) {
  const ss = getActiveSpreadsheet_();
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`Sheet tidak ditemukan: ${name}`);
  return sh;
}

function normalizeUsername_(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function sha256_(text) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    text,
    Utilities.Charset.UTF_8
  );
  return raw.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function isValidEmail_(email) {
  email = String(email || '').trim().toLowerCase();
  return Boolean(email) && email.includes('@') && email.includes('.');
}

function nowIso_() {
  return new Date().toISOString();
}

function newId_(prefix) {
  prefix = String(prefix || '').trim().toUpperCase();
  if (!prefix) prefix = 'A';

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const props = PropertiesService.getScriptProperties();
    const key = `__id_counter_${prefix}`;
    const curr = Number(props.getProperty(key) || '0') || 0;
    const next = curr + 1;
    props.setProperty(key, String(next));

    const shortNum = next % 1000;
    const numStr = String(shortNum).padStart(3, '0');
    return `${prefix}${numStr}`;
  } finally {
    lock.releaseLock();
  }
}

function findUserRowByUsername_(username) {
  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { rowIndex: 0, row: null };

  const values = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  username = String(username || '').toLowerCase();

  for (let i = 0; i < values.length; i++) {
    const u = String(values[i][CONFIG.USERS_COL.username - 1] || '').toLowerCase();
    if (u === username) return { rowIndex: i + 2, row: values[i] };
  }
  return { rowIndex: 0, row: null };
}

function findUserRowByEmail_(email) {
  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { rowIndex: 0, row: null };

  const values = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  email = String(email || '').trim().toLowerCase();

  for (let i = 0; i < values.length; i++) {
    const e = String(values[i][CONFIG.USERS_COL.email - 1] || '').trim().toLowerCase();
    if (e === email) return { rowIndex: i + 2, row: values[i] };
  }
  return { rowIndex: 0, row: null };
}

/**
 * Extract Drive fileId dari beberapa format URL:
 * - https://drive.google.com/file/d/<ID>/view
 * - https://drive.google.com/open?id=<ID>
 * - https://drive.google.com/uc?id=<ID>&export=view
 * - Atau langsung file ID (contoh: 1QnVbuaxbi5SUX4zfMVr8vl9YtkladjtR)
 */
function driveFileIdFromUrl_(url) {
  url = String(url || '').trim();
  if (!url) return '';

  // Cek apakah input sudah berupa file ID saja (tanpa URL)
  // File ID Google Drive biasanya 28-33 karakter alphanumeric + dash/underscore
  if (url.length >= 20 && url.length <= 50 && /^[a-zA-Z0-9_-]+$/.test(url)) {
    return url;
  }

  // /file/d/<id>/
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1 && m1[1]) return m1[1];

  // id=<id>
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return m2[1];

  return '';
}

/**
 * Normalisasi URL Drive agar bisa dipakai langsung di <img src="">
 * Menggunakan thumbnail API untuk embedding yang lebih reliable
 * return original jika bukan drive link / gagal extract id.
 */
function driveToDirectViewUrl_(url) {
  url = String(url || '').trim();
  if (!url) return '';
  
  const id = driveFileIdFromUrl_(url);
  if (!id) {
    Logger.log('driveToDirectViewUrl_: Failed to extract ID from: ' + url);
    return url;
  }
  
  // Gunakan thumbnail API untuk embedding yang lebih reliable
  const result = `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
  Logger.log('driveToDirectViewUrl_: ' + url + ' => ' + result);
  return result;
}

/**
 * Read avatar preset list from sheet 'Data' kolom A (nama profil) dan B (link profil)
 * return: [{ name, url }] url sudah direct-view.
 */
function listAvatarPresets_() {
  const sh = getSheetOrThrow_(CONFIG.DATA_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  // Kolom A = nama profil, Kolom B = link profil (file ID atau URL)
  const values = sh.getRange(2, 1, lastRow - 1, 2).getValues();

  const out = [];
  for (const r of values) {
    const name = String(r[0] || '').trim();
    const rawUrl = String(r[1] || '').trim();
    if (!name || !rawUrl) continue;

    out.push({ name, url: driveToDirectViewUrl_(rawUrl) });
  }
  return out;
}

/**
 * Get theme logo URL by theme key
 * @param {string} themeKey - Theme key (e.g., 'dark-blue-modern')
 * @return {string} Logo URL or empty string if not found
 */
function getThemeLogoUrl_(themeKey) {
  const fileId = THEME_LOGOS[themeKey];
  if (!fileId) return '';
  return driveToDirectViewUrl_(fileId);
}