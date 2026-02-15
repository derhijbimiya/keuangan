/**
 * Urutkan dan hitung ulang saldo untuk semua user (TX1 & TX2).
 * Panggil dari Apps Script Editor: manualSortAndRecalcAllUsers_()
 */
function manualSortAndRecalcAllUsers_() {
  const ss = getActiveSpreadsheet_();
  const usersSheet = ss.getSheetByName(CONFIG.USERS_SHEET_NAME);
  if (!usersSheet) throw new Error('Sheet Users tidak ditemukan');
  const users = usersSheet.getRange(2, CONFIG.USERS_COL.username, usersSheet.getLastRow() - 1, 1).getValues()
    .map(r => String(r[0] || '').trim()).filter(Boolean);
  let count = 0;
  users.forEach(username => {
    try {
      const uname = normalizeUsername_(username);
      const sh1 = ensureUserTx1Sheet(ss, uname);
      const sh2 = ensureUserTx2Sheet(ss, uname);
      sortTxSheetByDate_(sh1, 2);
      recalculateSaldoTx1_(sh1);
      sortTxSheetByDate_(sh2, 2);
      recalculateSaldoTx2_(sh2);
      _updateTotSheet_(uname);
      count++;
    } catch (e) {
      Logger.log('Gagal proses user: ' + username + ' => ' + e);
    }
  });
  Logger.log('Selesai proses ' + count + ' user.');
}
/**
 * Mengurutkan sheet transaksi berdasarkan tanggal (ascending)
 * @param {Sheet} sheet - sheet transaksi
 * @param {number} tanggalCol - index kolom tanggal (1-based)
 */
function sortTxSheetByDate_(sheet, tanggalCol) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return; // hanya header + 1 data, tidak perlu urut
  // Urutkan seluruh data (tanpa header)
  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .sort({ column: tanggalCol, ascending: true });
}

/**
 * Hitung ulang saldo rekening di TX1 sheet setelah urut tanggal
 * Kolom saldo: F (6)
 */
function recalculateSaldoTx1_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  let saldo = 0;
  for (let i = 2; i <= lastRow; i++) {
    const pengeluaran = Number(sheet.getRange(i, 3).getValue()) || 0;
    const pemasukan = Number(sheet.getRange(i, 4).getValue()) || 0;
    const tabungan = Number(sheet.getRange(i, 5).getValue()) || 0;
    saldo = saldo + pemasukan - pengeluaran - tabungan;
    sheet.getRange(i, 6).setValue(saldo);
  }
}

/**
 * Hitung ulang saldo tabungan di TX2 sheet setelah urut tanggal
 * Kolom saldo: F (6)
 */
function recalculateSaldoTx2_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  let saldo = 0;
  for (let i = 2; i <= lastRow; i++) {
    const tambah = Number(sheet.getRange(i, 4).getValue()) || 0;
    const pakai = Number(sheet.getRange(i, 5).getValue()) || 0;
    saldo = saldo + tambah - pakai;
    sheet.getRange(i, 6).setValue(saldo);
  }
}
/**
 * Transaksi.gs (UPDATED sesuai penambahan kolom jumlah_tambah_tabungan di TX2
 * dan update TOT sheet menambahkan kolom "total_tabungan" (Masuk Ke Tabungan dari rekening))
 *
 * UPDATE SPREADSHEET STRUCTURE (ROMBAK) + tambahan:
 * - TX1_<username> : transaksi rekening (A..H)
 *      A no
 *      B tanggal
 *      C pengeluaran
 *      D pemasukan
 *      E tabungan              (transfer ke tabungan dari rekening)
 *      F saldo_rekening
 *      G id_transaksi
 *      H keterangan
 *
 * - TX2_<username> : transaksi tabungan dipakai + tambah manual (A..G)
 *      A no_pakai_tabungan
 *      B tanggal_pakai_tabungan
 *      C keperluan
 *      D jumlah_tambah_tabungan   (NEW)
 *      E jumlah_pakai_tabungan
 *      F saldo_tabungan
 *      G id_pakai_tabungan
 *
 * - TOT_<username> : total/rekap (row 1 header, row 2 values)  (UPDATED)
 *      A total_uang
 *      B total_tabungan                 (saldo tabungan saat ini)
 *      C total_pemasukan
 *      D total_pengeluaran
 *      E total_tabungan                 (Masuk ke tabungan dari rekening)  <-- REQUEST kamu (kolom E)
 *      F tot_pemasukan_tabungan         (total tabungan masuk: rekening + manual)
 *      G total_pengeluaran_tabungan
 *
 * FIX BUG yang kamu laporkan:
 * - "Saat transaksi tabungan dari rekening, uangnya ga masuk tabungan"
 *   => total_tabungan (saldo) dihitung dari:
 *        SUM(TX1.tabungan) + SUM(TX2.jumlah_tambah_tabungan) - SUM(TX2.jumlah_pakai_tabungan)
 *
 * Catatan penting:
 * - Kamu minta ada kolom E di TOT bernama "total_tabungan" untuk "Masuk Ke Tabungan" (dari rekening).
 *   Ini nama header memang jadi duplikat dengan kolom B (saldo). Aku ikuti sesuai request & screenshot.
 *   Secara data:
 *     - TOT!B2 = saldo tabungan sekarang
 *     - TOT!E2 = total transfer tabungan dari rekening (SUM TX1 kolom E)
 */

function ensureUserTxSheet(username) {
  // BACKWARD COMPAT: memastikan 3 sheet baru (TX1_, TX2_, TOT_)
  username = normalizeUsername_(username);
  if (!username) throw new Error('Username kosong.');

  const ss = getActiveSpreadsheet_();

  const sh1 = ensureUserTx1Sheet_(ss, username);
  const sh2 = ensureUserTx2Sheet_(ss, username);
  const shT = ensureUserTotSheet_(ss, username);

  return { ok: true, sheets: { tx1: sh1.getName(), tx2: sh2.getName(), tot: shT.getName() } };
}

function ensureUserTx1Sheet_(ss, username) {
  const sheetName = `TX1_${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) return sh;

  sh = ss.insertSheet(sheetName);

  // Header TX1: A..I (tambah kolom struck)
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
  const sheetName = `TX2_${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) {
    // upgrade header jika file lama masih A..F (tanpa jumlah_tambah_tabungan)
    const header = sh.getRange(1, 1, 1, Math.max(7, sh.getLastColumn())).getValues()[0] || [];
    const needUpgrade =
      String(header[0] || '').trim() === 'no_pakai_tabungan' &&
      String(header[1] || '').trim() === 'tanggal_pakai_tabungan' &&
      String(header[2] || '').trim() === 'keperluan' &&
      String(header[3] || '').trim() === 'jumlah_pakai_tabungan'; // old format

    if (needUpgrade) {
      // old: A no, B tanggal, C keperluan, D jumlah_pakai, E saldo, F id
      // new: A no, B tanggal, C keperluan, D jumlah_tambah, E jumlah_pakai, F saldo, G id
      sh.getRange(1, 1, 1, 7).setValues([[
        'no_pakai_tabungan',
        'tanggal_pakai_tabungan',
        'keperluan',
        'jumlah_tambah_tabungan',
        'jumlah_pakai_tabungan',
        'saldo_tabungan',
        'id_pakai_tabungan'
      ]]);

      // geser data lama D..F ke E..G (mulai row 2)
      const lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        const oldVals = sh.getRange(2, 4, lastRow - 1, 3).getValues(); // D..F
        sh.getRange(2, 5, lastRow - 1, 3).setValues(oldVals);          // E..G
        sh.getRange(2, 4, lastRow - 1, 1).clearContent();              // D kosong
      }

      sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
      sh.getRange('D:F').setNumberFormat('#,##0');
      sh.autoResizeColumns(1, 7);
    }

    return sh;
  }

  sh = ss.insertSheet(sheetName);

  // Header TX2: A..G (UPDATED)
  const header = [
    'no_pakai_tabungan',
    'tanggal_pakai_tabungan',
    'keperluan',
    'jumlah_tambah_tabungan',
    'jumlah_pakai_tabungan',
    'saldo_tabungan',
    'id_pakai_tabungan'
  ];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);

  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sh.getRange('D:F').setNumberFormat('#,##0');

  return sh;
}

function ensureUserTotSheet_(ss, username) {
  const sheetName = `TOT_${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) {
    // ===== Upgrade TOT structure (minimal, based on previous code) =====
    // old header: 6 cols
    // new header: 7 cols (tambah kolom E "total_tabungan" untuk masuk tabungan dari rekening)
    const lastCol = sh.getLastColumn();
    const header = sh.getRange(1, 1, 1, Math.max(7, lastCol)).getValues()[0] || [];

    const has7 =
      String(header[0] || '').trim() === 'total_uang' &&
      String(header[1] || '').trim() === 'total_tabungan' &&
      String(header[2] || '').trim() === 'total_pemasukan' &&
      String(header[3] || '').trim() === 'total_pengeluaran' &&
      String(header[4] || '').trim() === 'total_tabungan' &&                 // kolom E (baru) sesuai request
      String(header[5] || '').trim() === 'tot_pemasukan_tabungan' &&
      String(header[6] || '').trim() === 'total_pengeluaran_tabungan';

    if (!has7) {
      // Set header baru persis seperti yang kamu minta (kolom E = total_tabungan untuk "Masuk Ke Tabungan")
      sh.getRange(1, 1, 1, 7).setValues([[
        'total_uang',
        'total_tabungan',
        'total_pemasukan',
        'total_pengeluaran',
        'total_tabungan',
        'tot_pemasukan_tabungan',
        'total_pengeluaran_tabungan'
      ]]);

      // Jika sudah ada nilai row 2 format lama (A..F), kita upgrade minimal:
      // old row2: [total_uang, total_tabungan, total_pemasukan, total_pengeluaran, tot_pemasukan_tabungan, total_pengeluaran_tabungan]
      // new row2: [total_uang, total_tabungan, total_pemasukan, total_pengeluaran, total_tabungan_masuk_dari_rekening, tot_pemasukan_tabungan, total_pengeluaran_tabungan]
      // -> geser old E->F, old F->G, dan set new E = 0 (akan dihitung ulang oleh _updateTotSheet_)
      const lastRow = sh.getLastRow();
      if (lastRow >= 2) {
        const old = sh.getRange(2, 1, 1, Math.min(6, lastCol)).getValues()[0] || [];
        const a = old[0] || 0;
        const b = old[1] || 0;
        const c = old[2] || 0;
        const d = old[3] || 0;
        const oldE = old[4] || 0; // dulu tot_pemasukan_tabungan
        const oldF = old[5] || 0; // dulu total_pengeluaran_tabungan

        sh.getRange(2, 1, 1, 7).setValues([[
          a, b, c, d,
          0,        // new E (masuk tabungan dari rekening) -> akan dihitung ulang
          oldE,     // new F
          oldF      // new G
        ]]);
      } else {
        sh.getRange(2, 1, 1, 7).setValues([[0, 0, 0, 0, 0, 0, 0]]);
      }

      sh.autoResizeColumns(1, 7);
      sh.getRange('A2:G2').setNumberFormat('#,##0');
    } else {
      // ensure number format for new structure
      sh.getRange('A2:G2').setNumberFormat('#,##0');
    }

    return sh;
  }

  // ===== Create new TOT sheet with NEW structure =====
  sh = ss.insertSheet(sheetName);

  const header = [
    'total_uang',
    'total_tabungan',
    'total_pemasukan',
    'total_pengeluaran',
    'total_tabungan',            // kolom E: "Masuk ke Tabungan" dari rekening (sesuai request)
    'tot_pemasukan_tabungan',
    'total_pengeluaran_tabungan'
  ];

  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
  sh.getRange('A2:G2').setNumberFormat('#,##0');

  // initialize row 2 with zeros
  sh.getRange(2, 1, 1, header.length).setValues([[0, 0, 0, 0, 0, 0, 0]]);

  return sh;
}

/* ===========================
 * OLD API (kept) - still works, writes to TX1
 * =========================== */
function apiAddTxMain(payload) {
  // map legacy call to rekening tx
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
 * DASHBOARD APIS
 * =========================== */

function apiDashboardHeader() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const found = findUserRowByUsername_(normalizeUsername_(username));
  if (!found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };

  const nama = String(found.row[CONFIG.USERS_COL.nama - 1] || '').trim();
  const foto = String(found.row[CONFIG.USERS_COL.foto - 1] || '').trim();

  return { ok: true, username: username, nama: nama || username, fotoUrl: foto };
}

function _rangeFromKey_(rangeKey) {
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
  return sh.getRange(2, 1, lastRow - 1, 9).getValues(); // A..I
}

function _readTx2Rows_(username) {
  const ss = getActiveSpreadsheet_();
  const sh = ensureUserTx2Sheet_(ss, normalizeUsername_(username));
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, 7).getValues(); // A..G
}

function _toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const d = new Date(String(v || '').trim());
  if (!isNaN(d.getTime())) return d;
  return null;
}

function _sumTx1InRange_(rows, start, end) {
  // TX1 columns: A no, B tanggal, C pengeluaran, D pemasukan, E tabungan
  let income = 0, expense = 0, savingIn = 0;
  for (const r of rows) {
    const dt = _toDate_(r[1]);
    if (!dt) continue;
    if (start && dt < start) continue;
    if (end && dt > end) continue;

    expense += Number(r[2] || 0) || 0;
    income += Number(r[3] || 0) || 0;
    savingIn += Number(r[4] || 0) || 0; // tabungan dari rekening
  }
  return { income, expense, savingIn };
}

function _sumTx2InRange_(rows, start, end) {
  // TX2 columns: A no, B tanggal, C keperluan, D tambah, E pakai, F saldo, G id
  let savingOut = 0;
  let savingManualIn = 0;

  for (const r of rows) {
    const dt = _toDate_(r[1]);
    if (!dt) continue;
    if (start && dt < start) continue;
    if (end && dt > end) continue;

    savingManualIn += Number(r[3] || 0) || 0; // tambah manual
    savingOut += Number(r[4] || 0) || 0;      // pakai tabungan
  }
  return { savingOut, savingManualIn };
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

  const total_pemasukan = tx1.reduce((a, r) => a + (Number(r[3] || 0) || 0), 0);
  const total_pengeluaran = tx1.reduce((a, r) => a + (Number(r[2] || 0) || 0), 0);

  // FIXED: tabungan masuk dari rekening (TX1 E) - untuk info/tracking saja
  const sumTabMasukDariRekening = tx1.reduce((a, r) => a + (Number(r[4] || 0) || 0), 0);

  // tabungan masuk semua (TX2 D) - termasuk dari rekening + manual
  const sumTabTambahManual = tx2.reduce((a, r) => a + (Number(r[3] || 0) || 0), 0);

  // tabungan keluar (TX2 E)
  const sumTabKeluar = tx2.reduce((a, r) => a + (Number(r[4] || 0) || 0), 0);

  // FIXED: saldo tabungan HANYA dari TX2 (bukan TX1+TX2) untuk hindari double counting
  // Karena saat transaksi "tabungan dari rekening", data sudah dicatat di TX2 kolom D
  const total_tabungan_saldo = sumTabTambahManual - sumTabKeluar;

  // total tabungan masuk (dari TX2 saja)
  const tot_pemasukan_tabungan = sumTabTambahManual;

  const total_pengeluaran_tabungan = sumTabKeluar;

  // UPDATED: tulis ke TOT row2 A..G
  // A total_uang
  // B total_tabungan (saldo)
  // C total_pemasukan
  // D total_pengeluaran
  // E total_tabungan (Masuk ke tabungan dari rekening) = sumTabMasukDariRekening
  // F tot_pemasukan_tabungan
  // G total_pengeluaran_tabungan
  shT.getRange(2, 1, 1, 7).setValues([[
    total_uang,
    total_tabungan_saldo,
    total_pemasukan,
    total_pengeluaran,
    sumTabMasukDariRekening,
    tot_pemasukan_tabungan,
    total_pengeluaran_tabungan
  ]]);

  return {
    total_uang,
    total_tabungan: total_tabungan_saldo,
    total_pemasukan,
    total_pengeluaran,
    total_tabungan_masuk_dari_rekening: sumTabMasukDariRekening,
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

    tabungan_masuk: sum1.savingIn,
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

  const incomeDaily = _groupDailyTx1_(tx1, r.start, r.end, 3);   // pemasukan
  const expenseDaily = _groupDailyTx1_(tx1, r.start, r.end, 2);  // pengeluaran

  const savingFromRekDaily = _groupDailyTx1_(tx1, r.start, r.end, 4); // tabungan dari rekening
  const savingManualDaily = _groupDailyTx2_(tx2, r.start, r.end, 3);  // tambah manual

  const keySet = {};
  Object.keys(incomeDaily).forEach(k => keySet[k] = true);
  Object.keys(expenseDaily).forEach(k => keySet[k] = true);
  Object.keys(savingFromRekDaily).forEach(k => keySet[k] = true);
  Object.keys(savingManualDaily).forEach(k => keySet[k] = true);

  const labels = Object.keys(keySet).sort();
  const incomeSeries = labels.map(k => incomeDaily[k] || 0);
  const expenseSeries = labels.map(k => expenseDaily[k] || 0);
  const savingSeries = labels.map(k => (savingFromRekDaily[k] || 0) + (savingManualDaily[k] || 0));

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

/* ===========================
 * TRANSAKSI APIs
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
  const uname = normalizeUsername_(username);
  const sh = ensureUserTx1Sheet_(ss, uname);

  const tanggalStr = String(payload?.tanggal || '').trim();
  const jenis = String(payload?.jenis || '').trim().toLowerCase();
  const nominal = Number(payload?.nominal || 0) || 0;
  const keterangan = String(payload?.keterangan || '').trim();

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!['pengeluaran', 'pemasukan', 'tabungan'].includes(jenis)) {
    return { ok: false, message: 'Jenis transaksi tidak valid.' };
  }
  if (!(nominal > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };

  const no = _lastNumberInSheetCol_(sh, 1) + 1; // col A
  const idTransaksi = newId_('TX');

  const prevSaldo = _lastSaldoFromTx1_(sh);
  let nextSaldo = prevSaldo;

  let pengeluaran = 0, pemasukan = 0, tabungan = 0;
  if (jenis === 'pengeluaran') { pengeluaran = nominal; nextSaldo = prevSaldo - nominal; }
  if (jenis === 'pemasukan') { pemasukan = nominal; nextSaldo = prevSaldo + nominal; }
  if (jenis === 'tabungan') { tabungan = nominal; nextSaldo = prevSaldo - nominal; }

  const nextRow = sh.getLastRow() + 1;
  // Tambahkan kolom struck (default kosong, bisa diupdate setelah upload)
  const row = [no, tanggal, pengeluaran, pemasukan, tabungan, nextSaldo, idTransaksi, keterangan, ''];
  if (payload && payload.struck) row[8] = payload.struck;
  sh.getRange(nextRow, 1, 1, row.length).setValues([row]);

  // Setelah input, urutkan sheet dan hitung ulang saldo
  sortTxSheetByDate_(sh, 2); // tanggal di kolom 2
  recalculateSaldoTx1_(sh);

  // Jika jenis tabungan, tambahkan juga ke TX2
  if (jenis === 'tabungan') {
    const sh2 = ensureUserTx2Sheet_(ss, uname);
    const shTot = ensureUserTotSheet_(ss, uname);
    const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
    const prevSaldoTabungan = _lastSaldoTabunganFromTot_(shTot);
    const nextSaldoTabungan = prevSaldoTabungan + nominal;
    const nextRowTx2 = sh2.getLastRow() + 1;
    const row2 = [noPakai, tanggal, keterangan || 'Transfer dari rekening', nominal, 0, nextSaldoTabungan, idTransaksi];
    sh2.getRange(nextRowTx2, 1, 1, row2.length).setValues([row2]);
    // Urutkan dan hitung ulang saldo tabungan
    sortTxSheetByDate_(sh2, 2);
    recalculateSaldoTx2_(sh2);
  }

  _updateTotSheet_(uname);
  return { ok: true, message: 'Transaksi rekening tersimpan.', id_transaksi: idTransaksi, row: nextRow, saldo_rekening: nextSaldo };
}

function _lastSaldoTabunganFromTot_(shTot) {
  const v = shTot.getRange(2, 2).getValue(); // B total_tabungan (saldo)
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

  const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1; // col A
  const idPakai = newId_('AX');

  const prevSaldo = _lastSaldoTabunganFromTot_(shTot);
  const nextSaldo = prevSaldo - jumlah;

  const nextRow = sh2.getLastRow() + 1;

  const row = [noPakai, tanggal, keperluan, 0, jumlah, nextSaldo, idPakai];
  sh2.getRange(nextRow, 1, 1, row.length).setValues([row]);
  sortTxSheetByDate_(sh2, 2);
  recalculateSaldoTx2_(sh2);
  _updateTotSheet_(uname);
  return { ok: true, message: 'Pakai tabungan tersimpan.', id_pakai_tabungan: idPakai, row: nextRow, saldo_tabungan: nextSaldo };
}

/**
 * NEW API:
 * tambah manual tabungan (tanpa lewat rekening)
 *
 * payload:
 * - tanggal_pakai_tabungan
 * - keperluan (optional)
 * - jumlah_tambah_tabungan
 */
function apiAddTambahTabungan(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);
  const ss = getActiveSpreadsheet_();

  const uname = normalizeUsername_(username);
  const sh2 = ensureUserTx2Sheet_(ss, uname);
  const shTot = ensureUserTotSheet_(ss, uname);

  const tanggalStr = String(payload?.tanggal_pakai_tabungan || '').trim();
  const keperluan = String(payload?.keperluan || '').trim();
  const jumlah = Number(payload?.jumlah_tambah_tabungan || 0) || 0;

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!(jumlah > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };

  const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
  const idPakai = newId_('AX');

  const prevSaldo = _lastSaldoTabunganFromTot_(shTot);
  const nextSaldo = prevSaldo + jumlah;

  const nextRow = sh2.getLastRow() + 1;

  const row = [noPakai, tanggal, keperluan, jumlah, 0, nextSaldo, idPakai];
  sh2.getRange(nextRow, 1, 1, row.length).setValues([row]);
  sortTxSheetByDate_(sh2, 2);
  recalculateSaldoTx2_(sh2);
  _updateTotSheet_(uname);
  return { ok: true, message: 'Tambah tabungan tersimpan.', id_pakai_tabungan: idPakai, row: nextRow, saldo_tabungan: nextSaldo };
}

function apiTxSummary() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  ensureUserTxSheet(username);
  const ss = getActiveSpreadsheet_();
  const shTot = ensureUserTotSheet_(ss, normalizeUsername_(username));

  // UPDATED: TOT sekarang 7 kolom, tapi summary lama butuh 4 field -> tetap kompatibel
  const row = shTot.getRange(2, 1, 1, 7).getValues()[0] || [0,0,0,0,0,0,0];

  return {
    ok: true,
    total_uang: row[0] || 0,
    total_tabungan: row[1] || 0,
    total_pemasukan: row[2] || 0,
    total_pengeluaran: row[3] || 0
  };
}