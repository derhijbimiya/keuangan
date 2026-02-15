/**
 * API: Upload struck file to Google Drive (per user folder)
 * payload: { filename, mimeType, base64 }
 * returns: { ok, url, message }
 */
function apiUploadStruck(payload) {
  try {
    if (!payload || !payload.base64 || !payload.filename) {
      Logger.log('[apiUploadStruck] Payload tidak valid: ' + JSON.stringify(payload));
      return { ok: false, message: 'File tidak valid.' };
    }
    const MASTER_FOLDER_ID = '1QpD1L_igJOdLwfGSbQ58Zm8AhSMk7zfB';
    const username = getSessionUser_ && getSessionUser_();
    if (!username) {
      Logger.log('[apiUploadStruck] User tidak ditemukan!');
      return { ok: false, message: 'User tidak ditemukan.' };
    }
    Logger.log('[apiUploadStruck] Username: ' + username);
    let userFolder;
    try {
      userFolder = getOrCreateUserDriveFolder_(MASTER_FOLDER_ID, username);
      Logger.log('[apiUploadStruck] User folder ready: ' + userFolder.getName());
    } catch (e) {
      Logger.log('[apiUploadStruck] ERROR getOrCreateUserDriveFolder_: ' + e.toString());
      return { ok: false, message: 'Gagal akses folder Drive: ' + e.message };
    }
    const ext = payload.filename.includes('.') ? payload.filename.substring(payload.filename.lastIndexOf('.')) : '';
    const baseName = payload.filename.replace(/\.[^/.]+$/, '');
    const finalName = baseName + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss') + ext;
    let file;
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(payload.base64), payload.mimeType, payload.filename);
      file = userFolder.createFile(blob).setName(finalName);
      Logger.log('[apiUploadStruck] File created: ' + file.getName() + ' | ' + file.getUrl());
    } catch (e) {
      Logger.log('[apiUploadStruck] ERROR createFile: ' + e.toString());
      return { ok: false, message: 'Gagal upload file: ' + e.message };
    }
    return { ok: true, url: file.getUrl(), message: '✅ File struck berhasil diupload.' };
  } catch (err) {
    Logger.log('[apiUploadStruck] ERROR umum: ' + err.toString());
    return { ok: false, message: '❌ Error upload struck: ' + err.message };
  }
}

/**
 * Helper: Get or create user folder in Drive
 * @param {string} parentFolderId
 * @param {string} username
 * @returns {Folder}
 */
function getOrCreateUserDriveFolder_(parentFolderId, username) {
  try {
    const parent = DriveApp.getFolderById(parentFolderId);
    const folders = parent.getFoldersByName(username);
    if (folders.hasNext()) {
      Logger.log('[getOrCreateUserDriveFolder_] Folder sudah ada: ' + username);
      return folders.next();
    } else {
      Logger.log('[getOrCreateUserDriveFolder_] Membuat folder baru: ' + username);
      return parent.createFolder(username);
    }
  } catch (e) {
    Logger.log('[getOrCreateUserDriveFolder_] ERROR: ' + e.toString());
    throw e;
  }
}
/**
 * Main.gs (UPDATED)
 * - apiDashboardHeader(): ambil nama lengkap + foto url dari Users
 * - apiDashboardSummary(rangeKey): ringkasan untuk range waktu (all/12m/3m/1m/custom)
 * - apiDashboardCharts(rangeKey): data chart (income vs expense, income line, saving line)
 *
 * UPDATE SPREADSHEET STRUCTURE (ROMBAK):
 * - TX1_<username> : khusus transaksi rekening (A..H)
 * - TX2_<username> : khusus transaksi tabungan dipakai (A..F)
 * - TOT_<username> : khusus total/rekap (row 1 header, row 2 values)
 */

function ensureUserTxSheet(username) {
  // memastikan 3 sheet baru (TX1_, TX2_, TOT_)
  username = normalizeUsername_(username);
  if (!username) throw new Error('Username kosong.');

  const ss = getActiveSpreadsheet_();

  const sh1 = ensureUserTx1Sheet_(ss, username);
  const sh2 = ensureUserTx2Sheet_(ss, username);
  const shT = ensureUserTotSheet_(ss, username);

  return { ok: true, sheets: { tx1: sh1.getName(), tx2: sh2.getName(), tot: shT.getName() } };
}

function ensureUserTx1Sheet_(ss, username) {
  const sheetName = `${CONFIG.TX1_SHEET_PREFIX}${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) return sh;

  sh = ss.insertSheet(sheetName);

  const header = [
    'no', 'tanggal', 'pengeluaran', 'pemasukan', 'tabungan', 'saldo_rekening', 'id_transaksi', 'keterangan', 'struck'
  ];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);

  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sh.getRange('C:F').setNumberFormat('#,##0');

  return sh;
}

function ensureUserTx2Sheet_(ss, username) {
  const sheetName = `${CONFIG.TX2_SHEET_PREFIX}${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) return sh;

  sh = ss.insertSheet(sheetName);

  const header = [
    'no_pakai_tabungan', 'tanggal_pakai_tabungan', 'keperluan', 'jumlah_tambah_tabungan', 'jumlah_pakai_tabungan', 'saldo_tabungan', 'id_pakai_tabungan'
  ];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);

  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sh.getRange('D:F').setNumberFormat('#,##0');

  return sh;
}

function ensureUserTotSheet_(ss, username) {
  const sheetName = `${CONFIG.TOT_SHEET_PREFIX}${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) return sh;

  sh = ss.insertSheet(sheetName);

  const header = [
    'total_uang',
    'total_tabungan',
    'total_pemasukan',
    'total_pengeluaran',
    'tot_pemasukan_tabungan',
    'total_pengeluaran_tabungan'
  ];

  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
  sh.getRange('A2:F2').setNumberFormat('#,##0');

  sh.getRange(2, 1, 1, header.length).setValues([[0, 0, 0, 0, 0, 0]]);

  return sh;
}

/* ===========================
 * OLD API (kept) - still works, writes to TX1
 * =========================== */
function apiAddTxMain(payload) {
  const jenisLegacy = (Number(payload && payload.pengeluaran || 0) > 0) ? 'pengeluaran'
    : (Number(payload && payload.pemasukan || 0) > 0) ? 'pemasukan'
      : (Number(payload && payload.tabungan || 0) > 0) ? 'tabungan'
        : '';

  const nominalLegacy = Number(payload && (payload.pengeluaran || payload.pemasukan || payload.tabungan) || 0) || 0;

  return apiAddTxRekening({
    tanggal: payload && payload.tanggal,
    jenis: jenisLegacy,
    nominal: nominalLegacy,
    keterangan: (payload && payload.keterangan) || ''
  });
}

/* ===========================
 * DASHBOARD NEW APIS
 * =========================== */

function apiDashboardHeader() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const found = findUserRowByUsername_(normalizeUsername_(username));
  if (!found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };

  const nama = String(found.row[CONFIG.USERS_COL.nama - 1] || '').trim();
  const foto = String(found.row[CONFIG.USERS_COL.foto - 1] || '').trim();
  
  Logger.log('apiDashboardHeader: foto raw = ' + foto);
  const fotoUrl = foto ? driveToDirectViewUrl_(foto) : '';
  Logger.log('apiDashboardHeader: fotoUrl converted = ' + fotoUrl);

  return { ok: true, username: username, nama: nama || username, fotoUrl: fotoUrl };
}

function _rangeFromKey_(rangeKey) {
  // Handle custom range string format: "custom:YYYY-MM-DD:YYYY-MM-DD"
  if (typeof rangeKey === 'string' && rangeKey.startsWith('custom:')) {
    const parts = rangeKey.split(':');
    if (parts.length === 3) {
      const startStr = parts[1].trim();
      const endStr = parts[2].trim();
      
      Logger.log('Parsing custom range string: start=' + startStr + ', end=' + endStr);
      
      if (startStr && endStr) {
        // Parse dates at start and end of day
        const start = new Date(startStr + 'T00:00:00');
        const end = new Date(endStr + 'T23:59:59');
        
        Logger.log('Parsed dates: start=' + start + ', end=' + end);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          return { key: 'custom', start, end };
        }
      }
    }
  }
  
  // Handle custom range object (fallback)
  if (typeof rangeKey === 'object' && rangeKey.mode === 'custom') {
    // Parse dates in script timezone to avoid offset issues
    const tz = Session.getScriptTimeZone();
    const startStr = String(rangeKey.start || '').trim();
    const endStr = String(rangeKey.end || '').trim();
    
    if (startStr && endStr) {
      // Create dates at start and end of day in script timezone
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T23:59:59');
      
      Logger.log('Custom range parsed: start=' + start + ', end=' + end);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { key: 'custom', start, end };
      }
    }
  }
  
  // Handle preset string
  rangeKey = String(rangeKey || 'all').trim().toLowerCase();
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (rangeKey === '1m') {
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);
    return { key: '1m', start, end };
  }
  if (rangeKey === '3m') {
    const start = new Date(end);
    start.setMonth(start.getMonth() - 3);
    return { key: '3m', start, end };
  }
  if (rangeKey === '12m') {
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    return { key: '12m', start, end };
  }
  return { key: 'all', start: null, end };
}

function _readTx1Rows_(username) {
  const ss = getActiveSpreadsheet_();
  const sh = ensureUserTx1Sheet_(ss, normalizeUsername_(username));
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, 8).getValues(); // A..H
}

/**
 * DEBUG FUNCTION - Panggil ini untuk melihat semua data tanggal di TX1 dan TX2
 */
function debugShowAllDates() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };
  
  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);
  
  Logger.log('=== TX1 DATES ===');
  tx1.forEach((row, idx) => {
    const tanggal = row[1];
    const pemasukan = row[3];
    const pengeluaran = row[2];
    const tabungan = row[4];
    Logger.log(`Row ${idx+2}: Tanggal=${tanggal}, Pemasukan=${pemasukan}, Pengeluaran=${pengeluaran}, Tabungan=${tabungan}`);
  });
  
  Logger.log('=== TX2 DATES ===');
  tx2.forEach((row, idx) => {
    const tanggal = row[1];
    const pakai = row[3];
    Logger.log(`Row ${idx+2}: Tanggal=${tanggal}, Pakai=${pakai}`);
  });
  
  return { ok: true, tx1Count: tx1.length, tx2Count: tx2.length };
}

/**
 * API Debug - untuk frontend
 */
function apiDebugDates() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };
  
  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);
  
  const tx1Dates = tx1.map((row, idx) => ({
    row: idx + 2,
    tanggal: row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : 'null',
    pemasukan: row[3] || 0,
    pengeluaran: row[2] || 0,
    tabungan: row[4] || 0
  }));
  
  const tx2Dates = tx2.map((row, idx) => ({
    row: idx + 2,
    tanggal: row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : 'null',
    pakai: row[3] || 0
  }));
  
  return {
    ok: true,
    tx1: tx1Dates,
    tx2: tx2Dates
  };
}

function _readTx2Rows_(username) {
  const ss = getActiveSpreadsheet_();
  const sh = ensureUserTx2Sheet_(ss, normalizeUsername_(username));
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, 7).getValues(); // A..G (7 kolom)
}

function _toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const d = new Date(String(v || '').trim());
  if (!isNaN(d.getTime())) return d;
  return null;
}

function _sumTx1InRange_(rows, start, end) {
  let income = 0, expense = 0, savingIn = 0;
  let matchCount = 0;
  
  for (const r of rows) {
    const dt = _toDate_(r[1]);
    if (!dt) continue;
    
    // Normalize date to start of day for comparison
    const dtDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const startDay = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null;
    const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
    
    if (startDay && dtDay < startDay) continue;
    if (endDay && dtDay > endDay) continue;

    matchCount++;
    expense += Number(r[2] || 0) || 0;
    income += Number(r[3] || 0) || 0;
    savingIn += Number(r[4] || 0) || 0;
  }
  
  Logger.log('TX1 rows matched: ' + matchCount + ', income=' + income + ', expense=' + expense + ', savingIn=' + savingIn);
  return { income, expense, savingIn };
}

function _sumTx2InRange_(rows, start, end) {
  let savingIn = 0;   // TX2 kolom D (tambah tabungan)
  let savingOut = 0;  // TX2 kolom E (pakai tabungan)
  let matchCount = 0;
  
  for (const r of rows) {
    const dt = _toDate_(r[1]);
    if (!dt) continue;
    
    // Normalize date to start of day for comparison
    const dtDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const startDay = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null;
    const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
    
    if (startDay && dtDay < startDay) continue;
    if (endDay && dtDay > endDay) continue;
    
    matchCount++;
    savingIn += Number(r[3] || 0) || 0;   // kolom D
    savingOut += Number(r[4] || 0) || 0;  // kolom E
  }
  
  Logger.log('TX2 rows matched in range: ' + matchCount + ', savingIn=' + savingIn + ', savingOut=' + savingOut);
  return { savingIn, savingOut };
}

function _updateTotSheet_(username) {
  username = normalizeUsername_(username);
  const ss = getActiveSpreadsheet_();

  ensureUserTx1Sheet_(ss, username);
  ensureUserTx2Sheet_(ss, username);
  const shT = ensureUserTotSheet_(ss, username);

  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);

  let total_uang = 0;
  for (let i = tx1.length - 1; i >= 0; i--) {
    const v = Number(tx1[i][5]);
    if (isFinite(v)) { total_uang = v; break; }
  }

  // FIXED: Saldo tabungan hanya dihitung dari TX2 saja (bukan TX1+TX2)
  // Karena saat transaksi "tabungan dari rekening", data sudah dicatat di TX2 kolom D
  // TX1 kolom E hanya untuk tracking/audit saja
  const sumTabMasukDariRekening = tx1.reduce((a, r) => a + (Number(r[4] || 0) || 0), 0); // untuk info saja
  const sumTabMasuk = tx2.reduce((a, r) => a + (Number(r[3] || 0) || 0), 0);  // TX2 kolom D (semua tabungan masuk)
  const sumTabKeluar = tx2.reduce((a, r) => a + (Number(r[4] || 0) || 0), 0); // TX2 kolom E (semua tabungan keluar)
  const total_tabungan = sumTabMasuk - sumTabKeluar;  // Saldo tabungan = masuk - keluar (HANYA dari TX2)

  const total_pemasukan = tx1.reduce((a, r) => a + (Number(r[3] || 0) || 0), 0);
  const total_pengeluaran = tx1.reduce((a, r) => a + (Number(r[2] || 0) || 0), 0);

  const tot_pemasukan_tabungan = sumTabMasuk;  // Total tabungan masuk (dari TX2 saja)
  const total_pengeluaran_tabungan = sumTabKeluar;

  shT.getRange(2, 1, 1, 6).setValues([[
    total_uang,
    total_tabungan,
    total_pemasukan,
    total_pengeluaran,
    tot_pemasukan_tabungan,
    total_pengeluaran_tabungan
  ]]);

  return {
    total_uang,
    total_tabungan,
    total_pemasukan,
    total_pengeluaran,
    tot_pemasukan_tabungan,
    total_pengeluaran_tabungan
  };
}

function apiDashboardSummary(rangeKey) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);

  const r = _rangeFromKey_(rangeKey);
  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);
  const tot = _updateTotSheet_(username);

  const sum1 = _sumTx1InRange_(tx1, r.start, r.end);
  const sum2 = _sumTx2InRange_(tx2, r.start, r.end);

  return {
    ok: true,
    range: { key: r.key, start: r.start ? r.start.toISOString() : '', end: r.end.toISOString() },
    total_uang: tot.total_uang,
    total_tabungan: tot.total_tabungan,
    pemasukan: sum1.income,
    pengeluaran: sum1.expense,
    tabungan_masuk: sum1.savingIn,   // Sekarang hanya dari TX1 kolom E
    tabungan_keluar: sum2.savingOut
  };
}

/**
 * API untuk custom date range dengan parameter terpisah
 */
function apiDashboardSummaryCustom(startDate, endDate) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);

  Logger.log('===== apiDashboardSummaryCustom called =====');
  Logger.log('startDate: ' + startDate);
  Logger.log('endDate: ' + endDate);

  // Parse dates
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  
  Logger.log('Parsed: start=' + start + ', end=' + end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, message: 'Invalid date format' };
  }

  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);
  const tot = _updateTotSheet_(username);

  const sum1 = _sumTx1InRange_(tx1, start, end);
  const sum2 = _sumTx2InRange_(tx2, start, end);

  return {
    ok: true,
    range: { key: 'custom', start: start.toISOString(), end: end.toISOString() },
    total_uang: tot.total_uang,
    total_tabungan: tot.total_tabungan,
    pemasukan: sum1.income,
    pengeluaran: sum1.expense,
    tabungan_masuk: sum1.savingIn,   // Sekarang hanya dari TX1 kolom E
    tabungan_keluar: sum2.savingOut
  };
}

function _groupDailyTx1_(rows, start, end, colIndex0Based) {
  const m = {};
  for (const r of rows) {
    const dt = _toDate_(r[1]);
    if (!dt) continue;
    if (start && dt < start) continue;
    if (end && dt > end) continue;

    const key = Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const v = Number(r[colIndex0Based] || 0) || 0;
    m[key] = (m[key] || 0) + v;
  }
  return m;
}

function _groupDailyTx2_(rows, start, end, colIndex0Based) {
  const m = {};
  for (const r of rows) {
    const dt = _toDate_(r[1]);
    if (!dt) continue;
    if (start && dt < start) continue;
    if (end && dt > end) continue;

    const key = Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const v = Number(r[colIndex0Based] || 0) || 0;
    m[key] = (m[key] || 0) + v;
  }
  return m;
}

function apiDashboardCharts(rangeKey) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);

  const r = _rangeFromKey_(rangeKey);
  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);

  const incomeDaily = _groupDailyTx1_(tx1, r.start, r.end, 3);
  const expenseDaily = _groupDailyTx1_(tx1, r.start, r.end, 2);
  const savingInDaily = _groupDailyTx2_(tx2, r.start, r.end, 3);  // FIXED: dari TX2 kolom D (bukan TX1)

  const keySet = {};
  Object.keys(incomeDaily).forEach(k => keySet[k] = true);
  Object.keys(expenseDaily).forEach(k => keySet[k] = true);
  Object.keys(savingInDaily).forEach(k => keySet[k] = true);

  const labels = Object.keys(keySet).sort();
  const incomeSeries = labels.map(k => incomeDaily[k] || 0);
  const expenseSeries = labels.map(k => expenseDaily[k] || 0);
  const savingSeries = labels.map(k => savingInDaily[k] || 0);

  const sum1 = _sumTx1InRange_(tx1, r.start, r.end);

  return {
    ok: true,
    range: { key: r.key, start: r.start ? r.start.toISOString() : '', end: r.end.toISOString() },
    compare: {
      labels: ['Pemasukan', 'Pengeluaran'],
      values: [sum1.income, sum1.expense]
    },
    incomeLine: { labels, values: incomeSeries },
    expenseLine: { labels, values: expenseSeries },
    savingLine: { labels, values: savingSeries }
  };
}

/**
 * API untuk custom date range charts dengan parameter terpisah
 */
function apiDashboardChartsCustom(startDate, endDate) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);

  Logger.log('===== apiDashboardChartsCustom called =====');
  Logger.log('startDate: ' + startDate);
  Logger.log('endDate: ' + endDate);

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  
  Logger.log('Parsed: start=' + start + ', end=' + end);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { ok: false, message: 'Invalid date format' };
  }

  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);

  const incomeDaily = _groupDailyTx1_(tx1, start, end, 3);
  const expenseDaily = _groupDailyTx1_(tx1, start, end, 2);
  const savingInDaily = _groupDailyTx2_(tx2, start, end, 3);  // FIXED: dari TX2 kolom D

  const keySet = {};
  Object.keys(incomeDaily).forEach(k => keySet[k] = true);
  Object.keys(expenseDaily).forEach(k => keySet[k] = true);
  Object.keys(savingInDaily).forEach(k => keySet[k] = true);

  const labels = Object.keys(keySet).sort();
  const incomeSeries = labels.map(k => incomeDaily[k] || 0);
  const expenseSeries = labels.map(k => expenseDaily[k] || 0);
  const savingSeries = labels.map(k => savingInDaily[k] || 0);

  const sum1 = _sumTx1InRange_(tx1, start, end);

  return {
    ok: true,
    range: { key: 'custom', start: start.toISOString(), end: end.toISOString() },
    compare: {
      labels: ['Pemasukan', 'Pengeluaran'],
      values: [sum1.income, sum1.expense]
    },
    incomeLine: { labels, values: incomeSeries },
    expenseLine: { labels, values: expenseSeries },
    savingLine: { labels, values: savingSeries }
  };
}

/* ===========================
 * TRANSAKSI APIs (NEW STRUCTURE)
 * =========================== */

function _lastNumberInSheetCol_(sh, colIndex1Based) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  const values = sh.getRange(2, colIndex1Based, lastRow - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    const n = Number(values[i][0]);
    if (isFinite(n) && n > 0) return n;
  }
  return 0;
}

function _lastSaldoFromTx1_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  const values = sh.getRange(2, 6, lastRow - 1, 1).getValues(); // F saldo_rekening
  for (let i = values.length - 1; i >= 0; i--) {
    const n = Number(values[i][0]);
    if (isFinite(n)) return n;
  }
  return 0;
}

/**
 * payload:
 * - tanggal: yyyy-mm-dd
 * - jenis: pengeluaran|pemasukan|tabungan
 * - nominal
 * - keterangan (optional)
 */
function apiAddTxRekening(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);
  const ss = getActiveSpreadsheet_();
  const sh = ensureUserTx1Sheet_(ss, normalizeUsername_(username));

  const tanggalStr = String(payload?.tanggal || '').trim();
  const jenis = String(payload?.jenis || '').trim().toLowerCase();
  const nominal = Number(payload?.nominal || 0) || 0;
  const keterangan = String(payload?.keterangan || '').trim();
  const struck = String(payload?.struck || '').trim(); // link struck

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!['pengeluaran', 'pemasukan', 'tabungan'].includes(jenis)) {
    return { ok: false, message: 'Jenis transaksi tidak valid.' };
  }
  if (!(nominal > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };

  const no = _lastNumberInSheetCol_(sh, 1) + 1;
  const idTransaksi = newId_('TX');

  const prevSaldo = _lastSaldoFromTx1_(sh);
  let nextSaldo = prevSaldo;

  let pengeluaran = 0, pemasukan = 0, tabungan = 0;
  if (jenis === 'pengeluaran') { pengeluaran = nominal; nextSaldo = prevSaldo - nominal; }
  if (jenis === 'pemasukan') { pemasukan = nominal; nextSaldo = prevSaldo + nominal; }
  if (jenis === 'tabungan') { tabungan = nominal; nextSaldo = prevSaldo - nominal; }

  // Simpan ke TX1
  const nextRow = sh.getLastRow() + 1;
  const row = [no, tanggal, pengeluaran, pemasukan, tabungan, nextSaldo, idTransaksi, keterangan, struck];
  sh.getRange(nextRow, 1, 1, row.length).setValues([row]);

  // PENTING: Jika tabungan, LANGSUNG simpan juga ke TX2 (INLINE)
  let tx2Created = false;
  if (jenis === 'tabungan') {
    try {
      const uname = normalizeUsername_(username);
      const sh2 = ensureUserTx2Sheet_(ss, uname);
      const shTot = ensureUserTotSheet_(ss, uname);
      
      const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
      const prevSaldoTab = _lastSaldoTabunganFromTot_(shTot);
      const nextSaldoTab = prevSaldoTab + nominal;
      
      const nextRowTx2 = sh2.getLastRow() + 1;
      const keperluanTx2 = keterangan || 'Transfer dari rekening';
      const rowTx2 = [noPakai, tanggal, keperluanTx2, nominal, 0, nextSaldoTab, idTransaksi];
      
      sh2.getRange(nextRowTx2, 1, 1, rowTx2.length).setValues([rowTx2]);
      
      tx2Created = true;
      Logger.log('✅ TX2 CREATED: row=' + nextRowTx2 + ', id=' + idTransaksi);
      
    } catch (e) {
      Logger.log('❌ ERROR TX2: ' + e.toString());
    }
  }

  _updateTotSheet_(normalizeUsername_(username));

  const timestamp = new Date().toLocaleTimeString('id-ID');
  const msg = tx2Created 
    ? '✅ Transaksi rekening & tabungan tersimpan. [' + timestamp + ']' 
    : '⚠️ Transaksi rekening tersimpan (TX2 gagal). [' + timestamp + ']';
  
  return { 
    ok: true, 
    message: msg, 
    id_transaksi: idTransaksi, 
    row: nextRow, 
    saldo_rekening: nextSaldo,
    tx2_created: tx2Created
  };
}

/**
 * Helper function: buat record di TX2 saat ada transaksi tabungan dari rekening
 */
function _createTx2FromTabungan_(username, tanggal, nominal, idTransaksi, ss) {
  const uname = normalizeUsername_(username);
  const sh2 = ensureUserTx2Sheet_(ss, uname);
  const shTot = ensureUserTotSheet_(ss, uname);
  
  const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
  const prevSaldoTab = _lastSaldoTabunganFromTot_(shTot);
  const nextSaldoTab = prevSaldoTab + nominal;
  
  const nextRowTx2 = sh2.getLastRow() + 1;
  const rowTx2 = [noPakai, tanggal, 'uang dari rekening', nominal, 0, nextSaldoTab, idTransaksi];
  
  sh2.getRange(nextRowTx2, 1, 1, rowTx2.length).setValues([rowTx2]);
  
  Logger.log('✅ TX2 created: row=' + nextRowTx2 + ', id=' + idTransaksi + ', nominal=' + nominal);
}

/**
 * UTILITY: Fix missing TX2 records untuk transaksi tabungan yang sudah ada
 * Panggil ini SEKALI dari Apps Script Editor untuk fix data lama
 */
function fixMissingTx2Records() {
  const username = getSessionUser_();
  if (!username) {
    Logger.log('ERROR: Belum login');
    return;
  }
  
  const ss = getActiveSpreadsheet_();
  const uname = normalizeUsername_(username);
  const sh1 = ensureUserTx1Sheet_(ss, uname);
  const sh2 = ensureUserTx2Sheet_(ss, uname);
  
  Logger.log('=== FIXING MISSING TX2 RECORDS ===');
  
  // Baca semua TX1
  const lastRow = sh1.getLastRow();
  if (lastRow < 2) {
    Logger.log('No TX1 data');
    return;
  }
  
  const tx1Data = sh1.getRange(2, 1, lastRow - 1, 8).getValues();
  
  // Baca semua TX2 yang sudah ada
  const tx2LastRow = sh2.getLastRow();
  const existingTx2Ids = new Set();
  
  if (tx2LastRow >= 2) {
    const tx2Data = sh2.getRange(2, 1, tx2LastRow - 1, 7).getValues();
    tx2Data.forEach(row => {
      const id = String(row[6] || '').trim(); // kolom G = id_pakai_tabungan
      if (id) existingTx2Ids.add(id);
    });
  }
  
  Logger.log('Existing TX2 IDs: ' + Array.from(existingTx2Ids).join(', '));
  
  let fixed = 0;
  let currentSaldo = 0;
  
  // Loop semua TX1, cari yang tabungan tapi belum ada di TX2
  for (let i = 0; i < tx1Data.length; i++) {
    const row = tx1Data[i];
    const tanggal = row[1];
    const tabungan = Number(row[4] || 0) || 0; // kolom E
    const idTransaksi = String(row[6] || '').trim(); // kolom G
    
    if (tabungan > 0 && idTransaksi && !existingTx2Ids.has(idTransaksi)) {
      // Missing TX2 record! Create it
      Logger.log('FIXING: TX1 row ' + (i+2) + ', ID=' + idTransaksi + ', tabungan=' + tabungan);
      
      currentSaldo += tabungan;
      const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
      const nextRowTx2 = sh2.getLastRow() + 1;
      const rowTx2 = [noPakai, tanggal, 'uang dari rekening', tabungan, 0, currentSaldo, idTransaksi];
      
      sh2.getRange(nextRowTx2, 1, 1, rowTx2.length).setValues([rowTx2]);
      fixed++;
      
      Logger.log('✅ Created TX2 row ' + nextRowTx2);
    } else if (tabungan > 0) {
      currentSaldo += tabungan;
    }
  }
  
  Logger.log('=== DONE: Fixed ' + fixed + ' missing TX2 records ===');
  
  // Update totals
  _updateTotSheet_(uname);
  Logger.log('Totals updated');
  
  return { ok: true, fixed: fixed };
}

function _lastSaldoTabunganFromTot_(shTot) {
  const v = shTot.getRange(2, 2).getValue(); // B total_tabungan
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

/**
 * payload:
 * - tanggal_pakai_tabungan
 * - keperluan (wajib)
 * - jumlah_pakai_tabungan
 */
function apiAddPakaiTabungan(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);
  const ss = getActiveSpreadsheet_();

  const uname = normalizeUsername_(username);
  const sh2 = ensureUserTx2Sheet_(ss, uname);
  const shTot = ensureUserTotSheet_(ss, uname);

  const tanggalStr = String(payload?.tanggal_pakai_tabungan || '').trim();
  const keperluan = String(payload?.keperluan || '').trim();
  const jumlah = Number(payload?.jumlah_pakai_tabungan || 0) || 0;

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!keperluan) return { ok: false, message: 'Keperluan wajib diisi.' };
  if (!(jumlah > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };

  const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
  const idPakai = newId_('AX');

  const prevSaldo = _lastSaldoTabunganFromTot_(shTot);
  const nextSaldo = prevSaldo - jumlah;

  const nextRow = sh2.getLastRow() + 1;
  const row = [noPakai, tanggal, keperluan, 0, jumlah, nextSaldo, idPakai];
  sh2.getRange(nextRow, 1, 1, row.length).setValues([row]);

  _updateTotSheet_(uname);

  return { ok: true, message: 'Pakai tabungan tersimpan.', id_pakai_tabungan: idPakai, row: nextRow, saldo_tabungan: nextSaldo };
}

/**
 * payload:
 * - tanggal_tabungan
 * - keperluan (wajib)
 * - jumlah_tambah_tabungan
 */
function apiAddTabunganManual(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);
  const ss = getActiveSpreadsheet_();

  const uname = normalizeUsername_(username);
  const sh2 = ensureUserTx2Sheet_(ss, uname);
  const shTot = ensureUserTotSheet_(ss, uname);

  const tanggalStr = String(payload?.tanggal_tabungan || '').trim();
  const keperluan = String(payload?.keperluan || '').trim();
  const jumlah = Number(payload?.jumlah_tambah_tabungan || 0) || 0;

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!keperluan) return { ok: false, message: 'Keperluan wajib diisi.' };
  if (!(jumlah > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };

  const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
  const idPakai = newId_('AX');

  const prevSaldo = _lastSaldoTabunganFromTot_(shTot);
  const nextSaldo = prevSaldo + jumlah;

  const nextRow = sh2.getLastRow() + 1;
  const row = [noPakai, tanggal, keperluan, jumlah, 0, nextSaldo, idPakai];
  sh2.getRange(nextRow, 1, 1, row.length).setValues([row]);

  _updateTotSheet_(uname);

  return { ok: true, message: 'Tambah tabungan tersimpan.', id_pakai_tabungan: idPakai, row: nextRow, saldo_tabungan: nextSaldo };
}

function apiTxSummary() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);
  const ss = getActiveSpreadsheet_();
  const shTot = ensureUserTotSheet_(ss, normalizeUsername_(username));

  const row = shTot.getRange(2, 1, 1, 6).getValues()[0] || [0, 0, 0, 0, 0, 0];

  return {
    ok: true,
    total_uang: row[0] || 0,
    total_tabungan: row[1] || 0,
    total_pemasukan: row[2] || 0,
    total_pengeluaran: row[3] || 0
  };
}

/**
 * apiGetTableData()
 * Mengambil data untuk tabel rekening dan tabungan
 */
function apiGetTableData() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const uname = normalizeUsername_(username);
  ensureUserTxSheet(username);
  const ss = getActiveSpreadsheet_();

  Logger.log('=== apiGetTableData ===');
  Logger.log('Username: ' + username);
  Logger.log('Normalized: ' + uname);

  // Get TX1 data (Rekening)
  const sh1 = ss.getSheetByName(`${CONFIG.TX1_SHEET_PREFIX}${uname}`);
  const rekeningData = [];
  
  if (sh1) {
    const lastRow = sh1.getLastRow();
    Logger.log('TX1 Sheet: ' + sh1.getName() + ', LastRow: ' + lastRow);
    
    if (lastRow > 1) {
      const data = sh1.getRange(2, 1, lastRow - 1, 8).getValues();
      Logger.log('TX1 Data rows: ' + data.length);
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const idTransaksi = String(row[6] || '');
        const tanggal = row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
        const pengeluaran = Number(row[2] || 0);
        const pemasukan = Number(row[3] || 0);
        const tabungan = Number(row[4] || 0);
        const keterangan = String(row[7] || '');
        
        let keperluan = '';
        let nominal = 0;
        
        if (pemasukan > 0) {
          keperluan = 'Pemasukan';
          nominal = pemasukan;
        } else if (pengeluaran > 0) {
          keperluan = 'Pengeluaran';
          nominal = pengeluaran;
        } else if (tabungan > 0) {
          keperluan = 'Tabungan';
          nominal = tabungan;
        }
        
        if (idTransaksi) {
          rekeningData.push({
            idTransaksi: idTransaksi,
            tanggal: tanggal,
            keperluan: keperluan,
            nominal: nominal,
            keterangan: keterangan
          });
          Logger.log('TX1 Row ' + (i+2) + ': ' + idTransaksi + ' | ' + tanggal + ' | ' + keperluan + ' | ' + nominal);
        }
      }
    }
  } else {
    Logger.log('TX1 Sheet NOT FOUND: ' + `${CONFIG.TX1_SHEET_PREFIX}${uname}`);
  }

  // Get TX2 data (Tabungan)
  const sh2 = ss.getSheetByName(`${CONFIG.TX2_SHEET_PREFIX}${uname}`);
  const tabunganData = [];
  
  if (sh2) {
    const lastRow = sh2.getLastRow();
    Logger.log('TX2 Sheet: ' + sh2.getName() + ', LastRow: ' + lastRow);
    
    if (lastRow > 1) {
      const data = sh2.getRange(2, 1, lastRow - 1, 7).getValues(); // 7 kolom: A-G
      Logger.log('TX2 Data rows: ' + data.length);
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const idTransaksi = String(row[6] || ''); // Kolom G (index 6) = id_pakai_tabungan
        const tanggal = row[1] ? Utilities.formatDate(new Date(row[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
        const keperluan = String(row[2] || '');   // Kolom C = keperluan
        const tabMasuk = Number(row[3] || 0);   // Kolom D = jumlah_tambah_tabungan
        const tabKeluar = Number(row[4] || 0);  // Kolom E = jumlah_pakai_tabungan
        
        // Nominal positif untuk masuk, negatif untuk keluar
        const nominal = tabMasuk > 0 ? tabMasuk : (tabKeluar > 0 ? -tabKeluar : 0);
        
        if (idTransaksi) {
          tabunganData.push({
            idTransaksi: idTransaksi,
            tanggal: tanggal,
            nominal: nominal,
            keterangan: keperluan
          });
          Logger.log('TX2 Row ' + (i+2) + ': ' + idTransaksi + ' | ' + tanggal + ' | ' + nominal + ' | ' + keperluan);
        }
      }
    }
  } else {
    Logger.log('TX2 Sheet NOT FOUND: ' + `${CONFIG.TX2_SHEET_PREFIX}${uname}`);
  }

  // Sort by date descending (newest first)
  rekeningData.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  tabunganData.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  Logger.log('=== RESULT ===');
  Logger.log('Rekening: ' + rekeningData.length + ' rows');
  Logger.log('Tabungan: ' + tabunganData.length + ' rows');

  return {
    ok: true,
    rekening: rekeningData,
    tabungan: tabunganData
  };
}

/**
 * Mengembalikan HTML dashboard utama (untuk sidebar/dialog)
 */
function getDashboardPageHtml() {
  return HtmlService.createHtmlOutputFromFile('dashboardpage').getContent();
}

/**
 * Mengembalikan URL Web App utama (untuk redirect dari dialog/sidebar)
 */
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/**
 * Fungsi backend untuk tombol kembali (home/dashboard)
 */
function getHomeUrl() {
  return ScriptApp.getService().getUrl();
}