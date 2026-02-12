/**
 * AppConfig.gs
 * - Tambah: helper normalisasi URL Google Drive untuk <img>
 * - Preset avatar di Users!K:L dikembalikan sebagai direct-view url
 */

const CONFIG = {
  USERS_SHEET_NAME: 'Users',
  TX_SHEET_PREFIX: 'TX_',

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
 * - https://drive.google.com/file/d/FILE_ID/...
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID&...
 * Return direct-view URL: https://drive.google.com/uc?export=view&id=FILE_ID
 */
function normalizeDriveImageUrl_(url) {
  if (!url) return '';
  url = String(url).trim();
  if (!url) return '';

  // Already normalized?
  if (url.startsWith('https://drive.google.com/uc?export=view&id=')) {
    return url;
  }

  let fileId = '';

  // Pattern 1: /file/d/FILE_ID/
  let match = url.match(/\/file\/d\/([^\/\?]+)/);
  if (match) {
    fileId = match[1];
  }

  // Pattern 2: ?id=FILE_ID
  if (!fileId) {
    match = url.match(/[?&]id=([^&]+)/);
    if (match) {
      fileId = match[1];
    }
  }

  // Pattern 3: /d/FILE_ID
  if (!fileId) {
    match = url.match(/\/d\/([^\/\?]+)/);
    if (match) {
      fileId = match[1];
    }
  }

  if (!fileId) {
    // Not a recognized Google Drive URL, return as-is
    return url;
  }

  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}
