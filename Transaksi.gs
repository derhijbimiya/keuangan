/**
 * Mengambil id_user dari sheet Users berdasarkan username
 * @param {string} username
 * @return {string} id_user atau '' jika tidak ditemukan
 */
const PAYMENT_CONFIG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.PAYMENT) || {};
const TX_ID_GENERATOR_CONFIG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.ID_GENERATOR) || {};
const DATA2_SHEET_NAME = (typeof CONFIG !== 'undefined' && CONFIG.DATA2_SHEET_NAME) || 'Data2';

function _sanitizeUploadFilename_(name) {
  const raw = String(name || '').trim();
  if (!raw) return 'file';
  return raw.replace(/[\\/:*?"<>|#\[\]]/g, '_').replace(/\s+/g, ' ').trim();
}

function _escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _isImageMimeType_(mimeType) {
  return /^image\//i.test(String(mimeType || '').trim());
}

function _buildMergedStruckPdfBlob_(files, outputName) {
  const safeName = _sanitizeUploadFilename_(outputName || 'struck.pdf').replace(/\.pdf$/i, '') + '.pdf';
  const pages = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i] || {};
    const mimeType = String(file.mimeType || '').trim();
    const base64 = String(file.base64 || '');
    const fileName = _escapeHtml_(_sanitizeUploadFilename_(file.filename || ('struck_' + (i + 1))));

    if (!_isImageMimeType_(mimeType)) {
      throw new Error('Merge ke PDF hanya mendukung file gambar (JPG/PNG/WEBP).');
    }
    if (!base64) {
      throw new Error('Ada file struck yang kosong.');
    }

    pages.push(
      '<section class="page">' +
      '<div class="caption">' + fileName + '</div>' +
      '<img src="data:' + mimeType + ';base64,' + base64 + '" alt="' + fileName + '">' +
      '</section>'
    );
  }

  const html =
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    '@page{size:A4;margin:18mm 12mm;}' +
    'html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#111;}' +
    '.page{page-break-after:always;break-after:page;}' +
    '.page:last-child{page-break-after:auto;break-after:auto;}' +
    '.caption{font-size:11px;margin-bottom:8px;word-break:break-word;}' +
    'img{display:block;width:100%;height:auto;max-height:250mm;object-fit:contain;border:0;}' +
    '</style></head><body>' + pages.join('') + '</body></html>';

  return Utilities.newBlob(html, 'text/html', 'struck_merge.html').getAs(MimeType.PDF).setName(safeName);
}

function _getStruckUploadFolder_(projectName) {
  const username = String(getSessionUser_() || '').trim();
  if (!username) throw new Error('Belum login.');

  const project = String(projectName || '').trim();
  if (project && typeof _getUserIdentityByUsername_ === 'function' && typeof ensureBendaharaProjectFolder_ === 'function') {
    const userInfo = _getUserIdentityByUsername_(username);
    if (userInfo && userInfo.ok) {
      const folderRes = ensureBendaharaProjectFolder_(userInfo.idUser, userInfo.username, project);
      if (folderRes && folderRes.ok && folderRes.projectFolderId) {
        return DriveApp.getFolderById(folderRes.projectFolderId);
      }
    }
  }

  if (typeof ensureBendaharaUserFolderByUsername_ === 'function') {
    const userFolderRes = ensureBendaharaUserFolderByUsername_(username);
    if (userFolderRes && userFolderRes.ok && userFolderRes.folderId) {
      return DriveApp.getFolderById(userFolderRes.folderId);
    }
  }

  const profileFolderId = String((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.STORAGE && APP_CONFIG.STORAGE.PROFILE_PHOTO_FOLDER_ID) || '').trim();
  if (profileFolderId) return DriveApp.getFolderById(profileFolderId);

  return DriveApp.getRootFolder();
}

/**
 * Upload struck transaksi.
 * - Jika 1 file: simpan sebagai file asli.
 * - Jika >1 file: digabung menjadi 1 file PDF.
 *
 * payload format baru:
 * {
 *   files: [{ filename, mimeType, base64 }, ...],
 *   projectName?: string
 * }
 *
 * payload kompatibilitas lama:
 * {
 *   filename, mimeType, base64, projectName?
 * }
 */
function apiUploadStruck(payload) {
  try {
    const filesIn = Array.isArray(payload && payload.files) ? payload.files : [];
    const legacyBase64 = String(payload && payload.base64 || '');
    const legacyName = String(payload && payload.filename || '').trim();
    const legacyMime = String(payload && payload.mimeType || '').trim();
    const projectName = String(payload && payload.projectName || '').trim();

    const files = filesIn.length > 0
      ? filesIn
      : (legacyBase64 ? [{ filename: legacyName, mimeType: legacyMime, base64: legacyBase64 }] : []);

    if (!files.length) return { ok: false, message: 'File struck kosong.' };

    const folder = _getStruckUploadFolder_(projectName);
    const now = new Date();
    const stamp = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Jakarta', 'yyyyMMdd_HHmmss');
    const username = normalizeUsername_(getSessionUser_());
    const safeUser = _sanitizeUploadFilename_(username || 'user');

    const preparedFiles = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i] || {};
      const base64 = String(f.base64 || '');
      if (!base64) return { ok: false, message: 'Ada file struck yang kosong.' };

      const mimeType = String(f.mimeType || 'application/octet-stream').trim() || 'application/octet-stream';
      const fileNameIn = _sanitizeUploadFilename_(f.filename || ('struck_' + (i + 1)));
      preparedFiles.push({ filename: fileNameIn, mimeType: mimeType, base64: base64 });
    }

    let finalFile;
    if (preparedFiles.length === 1) {
      const single = preparedFiles[0];
      const bytes = Utilities.base64Decode(single.base64);
      const singleBlob = Utilities.newBlob(bytes, single.mimeType, single.filename);
      const singleName = _sanitizeUploadFilename_(singleBlob.getName() || ('struck_' + stamp));
      singleBlob.setName(singleName);
      finalFile = folder.createFile(singleBlob);
    } else {
      const pdfName = `struck_${safeUser}_${stamp}.pdf`;
      const mergedPdfBlob = _buildMergedStruckPdfBlob_(preparedFiles, pdfName);
      finalFile = folder.createFile(mergedPdfBlob);
    }

    finalFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = finalFile.getId();
    const directViewTemplate = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.URL && APP_CONFIG.URL.DRIVE_DIRECT_VIEW_URL_TEMPLATE) || 'https://drive.google.com/uc?export=view&id={id}';
    const urlDirect = directViewTemplate.replace('{id}', fileId);

    return {
      ok: true,
      fileId: fileId,
      url: urlDirect,
      fileName: finalFile.getName(),
      fileCount: preparedFiles.length,
      merged: preparedFiles.length > 1
    };
  } catch (err) {
    return { ok: false, message: 'Gagal upload struck: ' + err };
  }
}

function getIdUserByUsername(username) {
  if (!username) return '';
  var ss = getActiveSpreadsheet_ ? getActiveSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.USERS_SHEET_NAME || 'Users');
  if (!sh) return '';
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { // Mulai dari 1, skip header
    var row = data[i];
    var uname = String(row[CONFIG.USERS_COL.username - 1] || '').trim().toLowerCase();
    if (uname === String(username).trim().toLowerCase()) {
      return String(row[CONFIG.USERS_COL.id - 1] || '').trim();
    }
  }
  return '';
}
/**
 * Mengambil daftar metode pembayaran (Kolom F) dari Sheet Data2 yang sesuai dengan id_user (Kolom C)
 * @param {string} id_user
 * @return {Array} - Array metode unik (selain kosong), urut abjad
 */
function getMetodeByUser(id_user) {
  if (!id_user) return [];
  var ss = getActiveSpreadsheet_ ? getActiveSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DATA2_SHEET_NAME);
  if (!sh) return [];
  var data = sh.getDataRange().getValues();
  var metodeSet = {};
  for (var i = 1; i < data.length; i++) { // Mulai dari 1, skip header
    var row = data[i];
    var id = String(row[2] || '').trim(); // Kolom C (index 2)
    var metode = String(row[5] || '').trim(); // Kolom F (index 5)
    if (id === id_user && metode) {
      metodeSet[metode] = true;
    }
  }
  return Object.keys(metodeSet).sort();
}

/**
 * Ambil data rekening user dari sheet Data2 untuk ditampilkan di modal TOTAL rekening.
 * Output kolom:
 * - nama   : Data2 kolom F
 * - wallet : Data2 kolom A
 * - saldo  : Data2 kolom E
 */
function apiGetRekeningWalletTable() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.', rows: [] };

  const found = findUserRowByUsername_(normalizeUsername_(username));
  if (!found || !found.rowIndex) {
    return { ok: false, message: 'User tidak ditemukan.', rows: [] };
  }

  const idUser = String(found.row[CONFIG.USERS_COL.id - 1] || '').trim();
  if (!idUser) {
    return { ok: false, message: 'id_user tidak ditemukan.', rows: [] };
  }

  const ss = getActiveSpreadsheet_ ? getActiveSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(DATA2_SHEET_NAME);
  if (!sh) return { ok: false, message: `Sheet ${DATA2_SHEET_NAME} tidak ditemukan.`, rows: [] };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, rows: [] };

  const values = sh.getRange(2, 1, lastRow - 1, Math.max(6, sh.getLastColumn())).getValues();
  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowUserId = String(row[2] || '').trim(); // C
    if (rowUserId !== idUser) continue;

    rows.push({
      nama: String(row[5] || '').trim(),   // F
      wallet: String(row[0] || '').trim(), // A
      saldo: Number(row[4] || 0) || 0      // E
    });
  }

  rows.sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id', { sensitivity: 'base' }));

  return { ok: true, rows: rows };
}

function _normalizeMetodeName_(name) {
  return String(name || '').trim();
}

function _isCashMetode_(name) {
  const cashLabel = String(PAYMENT_CONFIG.CASH_LABEL || 'Cash').toLowerCase();
  return _normalizeMetodeName_(name).toLowerCase() === cashLabel;
}

/**
 * Helper: Update saldo di Sheet Data2 berdasarkan id_user dan nama (kolom F)
 * @param {string} id_user - id_user di kolom C
 * @param {string} namaWallet - nama wallet (kolom F) misal: "BMRI(1234567890)" atau "GoPay(Utama)"
 * @param {number} perubahan - nominal perubahan saldo (positif untuk tambah, negatif untuk kurang)
 * @return {Object} - {ok: bool, message: string, newSaldo: number}
 */
function updateSaldoData2_(id_user, namaWallet, perubahan) {
  var normalizedUserId = String(id_user || '').trim();
  var normalizedWallet = _normalizeMetodeName_(namaWallet);

  if (!normalizedUserId || !normalizedWallet) {
    return { ok: false, message: 'id_user atau namaWallet kosong', newSaldo: 0 };
  }

  // Cash tidak disimpan di Data2, jadi selalu skip total
  if (_isCashMetode_(normalizedWallet)) {
    return {
      ok: true,
      skipped: true,
      message: 'Metode cash di-skip (tidak update Data2).',
      newSaldo: 0
    };
  }
  
  var ss = getActiveSpreadsheet_ ? getActiveSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DATA2_SHEET_NAME);
  if (!sh) return { ok: false, message: 'Sheet ' + DATA2_SHEET_NAME + ' tidak ditemukan', newSaldo: 0 };
  
  var data = sh.getDataRange().getValues();
  var targetRow = -1;
  
  // Cari row yang match: Kolom C (id_user) = id_user AND Kolom F (Nama) = namaWallet
  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][2] || '').trim(); // Kolom C
    var rowNama = _normalizeMetodeName_(data[i][5]); // Kolom F
    if (rowId === normalizedUserId && rowNama === normalizedWallet) {
      targetRow = i + 1; // Convert ke 1-based row number
      break;
    }
  }
  
  if (targetRow === -1) {
    return {
      ok: false,
      message: 'Wallet tidak ditemukan untuk user/metode: ' + normalizedUserId + ' / ' + normalizedWallet,
      newSaldo: 0
    };
  }
  
  // Update saldo: Kolom E (index 4)
  var oldSaldo = Number(data[targetRow - 1][4] || 0) || 0;
  var newSaldo = oldSaldo + perubahan;
  
  sh.getRange(targetRow, 5).setValue(newSaldo); // Kolom E = column 5
  
  Logger.log('[updateSaldoData2_] Updated: user=' + normalizedUserId + ', metode=' + normalizedWallet + ', saldo ' + oldSaldo + ' → ' + newSaldo);
  
  return { ok: true, message: 'Saldo updated', newSaldo: newSaldo, oldSaldo: oldSaldo };
}

function getSaldoData2ByUserMetode_(id_user, namaWallet) {
  var normalizedUserId = String(id_user || '').trim();
  var normalizedWallet = _normalizeMetodeName_(namaWallet);

  if (!normalizedUserId || !normalizedWallet) {
    return { ok: false, message: 'id_user atau namaWallet kosong', saldo: 0 };
  }

  if (_isCashMetode_(normalizedWallet)) {
    return { ok: true, skipped: true, saldo: Number.POSITIVE_INFINITY };
  }

  var ss = getActiveSpreadsheet_ ? getActiveSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DATA2_SHEET_NAME);
  if (!sh) return { ok: false, message: 'Sheet ' + DATA2_SHEET_NAME + ' tidak ditemukan', saldo: 0 };

  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][2] || '').trim();
    var rowNama = _normalizeMetodeName_(data[i][5]);
    if (rowId === normalizedUserId && rowNama === normalizedWallet) {
      return { ok: true, saldo: Number(data[i][4] || 0) || 0 };
    }
  }

  return {
    ok: false,
    message: 'Metode tidak ditemukan untuk user/metode: ' + normalizedUserId + ' / ' + normalizedWallet,
    saldo: 0
  };
}

function ensureMetodeSaldoMencukupi_(id_user, namaWallet, nominal, contextLabel) {
  var value = Number(nominal || 0) || 0;
  if (!(value > 0)) return { ok: true, skipped: true };

  var saldoRes = getSaldoData2ByUserMetode_(id_user, namaWallet);
  if (!saldoRes || !saldoRes.ok) {
    return {
      ok: false,
      code: 'METODE_TIDAK_DITEMUKAN',
      message: (saldoRes && saldoRes.message) || 'Metode tidak ditemukan.',
      saldoMetode: Number(saldoRes && saldoRes.saldo || 0) || 0,
      nominal: value,
      konteks: contextLabel || ''
    };
  }

  if (saldoRes.skipped) {
    return { ok: true, skipped: true, saldoMetode: Number.POSITIVE_INFINITY };
  }

  var saldoMetode = Number(saldoRes.saldo || 0) || 0;
  if (saldoMetode < value) {
    return {
      ok: false,
      code: 'SALDO_METODE_TIDAK_CUKUP',
      message: 'Saldo metode tidak cukup untuk transaksi ini.',
      saldoMetode: saldoMetode,
      nominal: value,
      kekurangan: value - saldoMetode,
      konteks: contextLabel || ''
    };
  }

  return { ok: true, saldoMetode: saldoMetode };
}

function apiGetSaldoMetodeAktif(metode) {
  var username = getSessionUser_();
  if (!username) {
    return { ok: false, canView: false, message: 'Belum login.', metode: String(metode || '').trim(), saldo: 0 };
  }

  var idUser = '';
  try {
    if (typeof getIdUserByUsername === 'function') {
      idUser = String(getIdUserByUsername(username) || '').trim();
    }
  } catch (err) {
    idUser = '';
  }

  if (!idUser) {
    return { ok: false, canView: false, message: 'id_user tidak ditemukan.', metode: String(metode || '').trim(), saldo: 0 };
  }

  var metodeName = String(metode || '').trim();
  if (!metodeName) {
    return { ok: false, canView: false, message: 'Metode kosong.', metode: '', saldo: 0 };
  }

  if (_isCashMetode_(metodeName)) {
    return {
      ok: true,
      canView: false,
      isCash: true,
      message: 'Metode cash tidak memiliki saldo terpisah di Data2.',
      metode: metodeName,
      saldo: Number.POSITIVE_INFINITY
    };
  }

  var saldoRes = getSaldoData2ByUserMetode_(idUser, metodeName);
  if (!saldoRes || !saldoRes.ok) {
    return {
      ok: false,
      canView: false,
      message: (saldoRes && saldoRes.message) || 'Saldo metode tidak ditemukan.',
      metode: metodeName,
      saldo: Number(saldoRes && saldoRes.saldo || 0) || 0
    };
  }

  return {
    ok: true,
    canView: true,
    message: 'Saldo metode ditemukan.',
    metode: metodeName,
    saldo: Number(saldoRes.saldo || 0) || 0
  };
}
// Mapping kode bank dan e-wallet
const BANK_KODE_MAP = (PAYMENT_CONFIG && PAYMENT_CONFIG.BANK_KODE_MAP) || {
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
  'Mizuho Bank Indonesia (MHBK)': 'MHBK',
};

const EWALLET_KODE_MAP = (PAYMENT_CONFIG && PAYMENT_CONFIG.EWALLET_KODE_MAP) || {
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
  'Paytren': 'Paytren',
};
/**
 * Tambah data rekening/e-wallet ke sheet Data2
 * @param {Object} data - { jenis, no_rek, id_user, nama_unik, uang }
 * @return {Object} - { ok, message }
 */
function addWalletRekening(data) {
  try {
    // Validasi input
    var jenis = String(data.jenis || '').trim();
    var no_rek = String(data.no_rek || '').trim();
    var id_user = String(data.id_user || '').trim();
    var nama_unik = String(data.nama_unik || '').trim();
    var uang = Number(data.uang || 0);
    // Jika id_user kosong dan username ada, lookup id_user dari sheet Users
    if (!id_user && data.username) {
      var found = findUserRowByUsername_(normalizeUsername_(data.username));
      if (found && found.row) {
        id_user = String(found.row[CONFIG.USERS_COL.id - 1] || '').trim();
      }
    }
    // Debug log username dan id_user
    Logger.log('addWalletRekening | username session:', data.username);
    Logger.log('addWalletRekening | id_user:', id_user);

    // Tentukan kode bank/ewallet
    var kode = '';
    if (BANK_KODE_MAP[jenis]) {
      kode = BANK_KODE_MAP[jenis];
    } else if (EWALLET_KODE_MAP[jenis]) {
      kode = EWALLET_KODE_MAP[jenis];
    }

    // Tentukan kolom Nama
    var namaKolom = '';
    if (no_rek) {
      namaKolom = kode + ' (' + no_rek + ')';
    } else if (nama_unik) {
      namaKolom = kode + ' (' + nama_unik + ')';
    }
    // Validasi utama (mengikuti Main.gs)
    if (!jenis) {
      return { ok: false, message: 'Jenis wajib diisi.', debug: { username: data.username, id_user: id_user } };
    }
    if (!id_user) {
      return { ok: false, message: 'Akun Anda belum terdaftar di Users. Silakan hubungi admin untuk pendaftaran akses.', debug: { username: data.username, id_user: id_user } };
    }
    if (!(no_rek || nama_unik)) {
      return { ok: false, message: 'Isi salah satu: No.Rek/No.HP atau Nama Unik.', debug: { username: data.username, id_user: id_user } };
    }
    if (no_rek && nama_unik) {
      return { ok: false, message: 'Hanya boleh isi salah satu: No.Rek/No.HP atau Nama Unik.', debug: { username: data.username, id_user: id_user } };
    }
    // Ambil sheet Data2
    var ss = getActiveSpreadsheet_ ? getActiveSpreadsheet_() : SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(DATA2_SHEET_NAME);
    if (!sh) return { ok: false, message: 'Sheet ' + DATA2_SHEET_NAME + ' tidak ditemukan.' };
    // Cari baris kosong berikutnya
    var nextRow = sh.getLastRow() + 1;
    // Susun data sesuai urutan kolom: Jenis | No.hp/No.Rek | id_user | Nama_unik | uang | Nama | Kode
    var row = [jenis, no_rek, id_user, nama_unik, uang, namaKolom, kode];
    sh.getRange(nextRow, 1, 1, row.length).setValues([row]);
    return { ok: true, message: 'Rekening/e-wallet berhasil ditambahkan.' };
  } catch (e) {
    return { ok: false, message: 'Error: ' + e.message };
  }
}
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

function _isAppendDateInOrder_(sheet, tanggalCol, newDate) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return true;

  const lastValue = sheet.getRange(lastRow, tanggalCol).getValue();
  const lastDate = _toDate_(lastValue);
  if (!lastDate) return true;

  const newDateOnly = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate()).getTime();
  const lastDateOnly = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate()).getTime();
  return newDateOnly >= lastDateOnly;
}

/**
 * Hitung ulang saldo rekening di TX1 sheet setelah urut tanggal
 * Kolom saldo: F (6)
 */
function recalculateSaldoTx1_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const saldoValues = [];
  let saldo = 0;
  for (let i = 0; i < rows.length; i++) {
    const pengeluaran = Number(rows[i][2]) || 0;
    const pemasukan = Number(rows[i][3]) || 0;
    const tabungan = Number(rows[i][4]) || 0;
    saldo = saldo + pemasukan - pengeluaran - tabungan;
    saldoValues.push([saldo]);
  }

  sheet.getRange(2, 6, saldoValues.length, 1).setValues(saldoValues);
}

/**
 * Hitung ulang saldo tabungan di TX2 sheet setelah urut tanggal
 * Kolom saldo: F (6)
 */
function recalculateSaldoTx2_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const rows = sheet.getRange(2, 4, lastRow - 1, 2).getValues();
  const saldoValues = [];
  let saldo = 0;
  for (let i = 0; i < rows.length; i++) {
    const tambah = Number(rows[i][0]) || 0;
    const pakai = Number(rows[i][1]) || 0;
    saldo = saldo + tambah - pakai;
    saldoValues.push([saldo]);
  }

  sheet.getRange(2, 6, saldoValues.length, 1).setValues(saldoValues);
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
  const tx1Prefix = String(CONFIG.TX1_SHEET_PREFIX || 'TX1_');
  const sheetName = `${tx1Prefix}${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) {
    // Upgrade header jika belum ada kolom metode
    const header = sh.getRange(1, 1, 1, Math.max(10, sh.getLastColumn())).getValues()[0] || [];
    if (header.length < 10 || String(header[9] || '').toLowerCase() !== 'metode') {
      // Tambahkan kolom metode jika belum ada
      const newHeader = [
        'no', 'tanggal', 'pengeluaran', 'pemasukan', 'tabungan', 'saldo_rekening', 'id_transaksi', 'keterangan', 'struck', 'Metode'
      ];
      sh.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
      sh.autoResizeColumns(1, newHeader.length);
    }
    return sh;
  }

  sh = ss.insertSheet(sheetName);

  // Header TX1: A..J (tambah kolom struck & metode)
  const header = [
    'no', 'tanggal', 'pengeluaran', 'pemasukan', 'tabungan', 'saldo_rekening', 'id_transaksi', 'keterangan', 'struck', 'Metode'
  ];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);

  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sh.getRange('C:F').setNumberFormat('#,##0');

  return sh;
}

function ensureUserTx2Sheet_(ss, username) {
  const tx2Prefix = String(CONFIG.TX2_SHEET_PREFIX || 'TX2_');
  const sheetName = `${tx2Prefix}${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) {
    // Upgrade header jika belum ada kolom metode
    const header = sh.getRange(1, 1, 1, Math.max(8, sh.getLastColumn())).getValues()[0] || [];
    if (header.length < 8 || String(header[7] || '').toLowerCase() !== 'metode') {
      // Tambahkan kolom metode jika belum ada
      const newHeader = [
        'no_pakai_tabungan',
        'tanggal_pakai_tabungan',
        'keperluan',
        'jumlah_tambah_tabungan',
        'jumlah_pakai_tabungan',
        'saldo_tabungan',
        'id_pakai_tabungan',
        'Metode'
      ];
      sh.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
      sh.autoResizeColumns(1, newHeader.length);
    }
    return sh;
  }

  sh = ss.insertSheet(sheetName);

  // Header TX2: A..H (tambah kolom metode)
  const header = [
    'no_pakai_tabungan',
    'tanggal_pakai_tabungan',
    'keperluan',
    'jumlah_tambah_tabungan',
    'jumlah_pakai_tabungan',
    'saldo_tabungan',
    'id_pakai_tabungan',
    'Metode'
  ];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);

  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sh.getRange('D:F').setNumberFormat('#,##0');

  return sh;
}

function ensureUserTotSheet_(ss, username) {
  const totPrefix = String(CONFIG.TOT_SHEET_PREFIX || 'TOT_');
  const sheetName = `${totPrefix}${username}`;
  let sh = ss.getSheetByName(sheetName);
  if (sh) {
    // ===== Upgrade TOT structure (minimal, based on previous code) =====
    // old header: 6 cols
    // new header: 7 cols (kolom E = total_tabungan.1 sesuai spreadsheet.md)
    const lastCol = sh.getLastColumn();
    const header = sh.getRange(1, 1, 1, Math.max(7, lastCol)).getValues()[0] || [];

    const has7 =
      String(header[0] || '').trim() === 'total_uang' &&
      String(header[1] || '').trim() === 'total_tabungan' &&
      String(header[2] || '').trim() === 'total_pemasukan' &&
      String(header[3] || '').trim() === 'total_pengeluaran' &&
      String(header[4] || '').trim() === 'total_tabungan.1' &&
      String(header[5] || '').trim() === 'tot_pemasukan_tabungan' &&
      String(header[6] || '').trim() === 'total_pengeluaran_tabungan';

    if (!has7) {
      // Set header sesuai spreadsheet.md
      sh.getRange(1, 1, 1, 7).setValues([[
        'total_uang',
        'total_tabungan',
        'total_pemasukan',
        'total_pengeluaran',
        'total_tabungan.1',
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
    'total_tabungan.1',
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
  const namaDepan = String((nama || username).split(/\s+/)[0] || '').trim() || username;
  const foto = String(found.row[CONFIG.USERS_COL.foto - 1] || '').trim();
  const id_user = String(found.row[CONFIG.USERS_COL.id - 1] || '').trim();

  return {
    ok: true,
    username: username,
    nama: nama || username,
    namaDepan: namaDepan,
    fotoUrl: foto,
    id_user: id_user
  };
}

function _getSaldoSemuaProjectByUserId_(idUser) {
  const normalizedIdUser = String(idUser || '').trim();
  if (!normalizedIdUser) return 0;

  try {
    if (typeof getBendaharaSpreadsheet_ !== 'function') return 0;
    const ssB = getBendaharaSpreadsheet_();
    if (!ssB) return 0;

    const shData = ssB.getSheetByName(CONFIG.BENDAHARA_DATA_SHEET_NAME || 'Data');
    if (!shData) return 0;

    let idUserCol = 2;
    let saldoCol = 4;
    if (typeof _bendaharaDataHeaderMap_ === 'function') {
      const cols = _bendaharaDataHeaderMap_(shData);
      if (cols && cols.idUserCol && cols.saldoCol) {
        idUserCol = cols.idUserCol;
        saldoCol = cols.saldoCol;
      }
    }

    const lastRow = shData.getLastRow();
    if (lastRow < 2) return 0;

    const width = Math.max(idUserCol, saldoCol);
    const values = shData.getRange(2, 1, lastRow - 1, width).getValues();
    let total = 0;
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowUserId = String(row[idUserCol - 1] || '').trim();
      if (rowUserId !== normalizedIdUser) continue;
      total += Number(row[saldoCol - 1] || 0) || 0;
    }
    return total;
  } catch (err) {
    return 0;
  }
}

function _rangeFromKey_(rangeKey) {
  rangeKey = String(rangeKey || 'all').trim().toLowerCase();
  const now = new Date();
  const end = _atEndOfDay_(now);

  if (rangeKey.indexOf('custom:') === 0) {
    const parts = rangeKey.split(':');
    const custom = _rangeFromCustomDates_(parts[1], parts[2]);
    if (custom.ok) {
      return { key: 'custom', start: custom.start, end: custom.end };
    }
    return { key: 'all', start: null, end: end };
  }

  if (rangeKey === '1m') {
    const start = _atStartOfDay_(_subtractMonthsClamped_(now, 1));
    return { key: '1m', start, end };
  }
  if (rangeKey === '3m') {
    const start = _atStartOfDay_(_subtractMonthsClamped_(now, 3));
    return { key: '3m', start, end };
  }
  if (rangeKey === '12m') {
    const start = _atStartOfDay_(_subtractMonthsClamped_(now, 12));
    return { key: '12m', start, end };
  }
  return { key: 'all', start: null, end };
}

function _atStartOfDay_(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function _atEndOfDay_(dateValue) {
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function _subtractMonthsClamped_(baseDate, monthsBack) {
  const source = baseDate instanceof Date ? baseDate : new Date(baseDate);
  const targetMonthStart = new Date(source.getFullYear(), source.getMonth() - Number(monthsBack || 0), 1);
  const lastDayOfTargetMonth = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(source.getDate(), lastDayOfTargetMonth);
  return new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth(), safeDay);
}

function _parseYmdAsLocalDate_(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;

  const result = new Date(y, m - 1, d);
  if (
    result.getFullYear() !== y ||
    result.getMonth() !== (m - 1) ||
    result.getDate() !== d
  ) {
    return null;
  }
  return result;
}

function _rangeFromCustomDates_(startYmd, endYmd) {
  const startDate = _parseYmdAsLocalDate_(startYmd);
  const endDate = _parseYmdAsLocalDate_(endYmd);
  if (!startDate || !endDate) {
    return { ok: false, message: 'Format tanggal custom tidak valid (YYYY-MM-DD).' };
  }

  if (startDate.getTime() > endDate.getTime()) {
    return { ok: false, message: 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir.' };
  }

  return {
    ok: true,
    key: 'custom',
    start: _atStartOfDay_(startDate),
    end: _atEndOfDay_(endDate)
  };
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

function _buildDashboardSummaryByRange_(username, rangeObj) {
  ensureUserTxSheet(username);

  const found = findUserRowByUsername_(normalizeUsername_(username));
  const idUser = found && found.rowIndex ? String(found.row[CONFIG.USERS_COL.id - 1] || '').trim() : '';

  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);
  const tot = _updateTotSheet_(username);
  const saldoSemuaProject = _getSaldoSemuaProjectByUserId_(idUser);

  const sum1 = _sumTx1InRange_(tx1, rangeObj.start, rangeObj.end);
  const sum2 = _sumTx2InRange_(tx2, rangeObj.start, rangeObj.end);

  return {
    ok: true,
    range: {
      key: rangeObj.key,
      start: rangeObj.start ? rangeObj.start.toISOString() : '',
      end: rangeObj.end ? rangeObj.end.toISOString() : ''
    },
    total_uang: tot.total_uang,
    total_tabungan: tot.total_tabungan,
    saldo_semua_project: saldoSemuaProject,
    saldo_rekening_total: (Number(tot.total_uang || 0) || 0) + (Number(saldoSemuaProject || 0) || 0),
    pemasukan: sum1.income,
    pengeluaran: sum1.expense,
    tabungan_masuk: sum1.savingIn,
    tabungan_keluar: sum2.savingOut
  };
}

function _buildDashboardChartsByRange_(username, rangeObj) {
  ensureUserTxSheet(username);

  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);

  const incomeDaily = _groupDailyTx1_(tx1, rangeObj.start, rangeObj.end, 3);   // pemasukan
  const expenseDaily = _groupDailyTx1_(tx1, rangeObj.start, rangeObj.end, 2);  // pengeluaran

  const savingFromRekDaily = _groupDailyTx1_(tx1, rangeObj.start, rangeObj.end, 4); // tabungan dari rekening
  const savingManualDaily = _groupDailyTx2_(tx2, rangeObj.start, rangeObj.end, 3);  // tambah manual

  const keySet = {};
  Object.keys(incomeDaily).forEach(k => keySet[k] = true);
  Object.keys(expenseDaily).forEach(k => keySet[k] = true);
  Object.keys(savingFromRekDaily).forEach(k => keySet[k] = true);
  Object.keys(savingManualDaily).forEach(k => keySet[k] = true);

  const labels = Object.keys(keySet).sort();
  const incomeSeries = labels.map(k => incomeDaily[k] || 0);
  const expenseSeries = labels.map(k => expenseDaily[k] || 0);
  const savingSeries = labels.map(k => (savingFromRekDaily[k] || 0) + (savingManualDaily[k] || 0));

  const sum1 = _sumTx1InRange_(tx1, rangeObj.start, rangeObj.end);

  return {
    ok: true,
    range: {
      key: rangeObj.key,
      start: rangeObj.start ? rangeObj.start.toISOString() : '',
      end: rangeObj.end ? rangeObj.end.toISOString() : ''
    },
    compare: {
      labels: ['Pemasukan', 'Pengeluaran'],
      values: [sum1.income, sum1.expense]
    },
    incomeLine: { labels, values: incomeSeries },
    expenseLine: { labels, values: expenseSeries },
    savingLine: { labels, values: savingSeries }
  };
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

  const r = _rangeFromKey_(rangeKey);
  return _buildDashboardSummaryByRange_(username, r);
}

function apiDashboardSummaryCustom(startYmd, endYmd) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const r = _rangeFromCustomDates_(startYmd, endYmd);
  if (!r.ok) return { ok: false, message: r.message || 'Rentang custom tidak valid.' };

  return _buildDashboardSummaryByRange_(username, r);
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

  const r = _rangeFromKey_(rangeKey);
  return _buildDashboardChartsByRange_(username, r);
}

function apiDashboardChartsCustom(startYmd, endYmd) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const r = _rangeFromCustomDates_(startYmd, endYmd);
  if (!r.ok) return { ok: false, message: r.message || 'Rentang custom tidak valid.' };

  return _buildDashboardChartsByRange_(username, r);
}

function _formatDateYmd_(value) {
  const dt = _toDate_(value);
  if (!dt) return '';
  const tz = Session.getScriptTimeZone() || 'Asia/Jakarta';
  return Utilities.formatDate(dt, tz, 'yyyy-MM-dd');
}

function apiGetTableData() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.', rekening: [], tabungan: [] };

  ensureUserTxSheet(username);

  const tx1 = _readTx1Rows_(username);
  const tx2 = _readTx2Rows_(username);
  const rekening = [];
  const tabungan = [];

  for (let i = 0; i < tx1.length; i++) {
    const row = tx1[i] || [];
    const tanggal = _formatDateYmd_(row[1]);
    if (!tanggal) continue;

    const idTransaksi = String(row[6] || '').trim();
    const keterangan = String(row[7] || '').trim();
    const struck = String(row[8] || '').trim();
    const pengeluaran = Number(row[2] || 0) || 0;
    const pemasukan = Number(row[3] || 0) || 0;
    const transferTabungan = Number(row[4] || 0) || 0;

    if (pemasukan > 0) {
      rekening.push({
        idTransaksi: idTransaksi,
        tanggal: tanggal,
        keperluan: 'pemasukan',
        nominal: pemasukan,
        keterangan: keterangan,
        struck: struck
      });
    }

    if (pengeluaran > 0) {
      rekening.push({
        idTransaksi: idTransaksi,
        tanggal: tanggal,
        keperluan: 'pengeluaran',
        nominal: pengeluaran,
        keterangan: keterangan,
        struck: struck
      });
    }

    if (transferTabungan > 0) {
      rekening.push({
        idTransaksi: idTransaksi,
        tanggal: tanggal,
        keperluan: 'tabungan',
        nominal: transferTabungan,
        keterangan: keterangan,
        struck: struck
      });
    }
  }

  for (let j = 0; j < tx2.length; j++) {
    const row2 = tx2[j] || [];
    const tanggal2 = _formatDateYmd_(row2[1]);
    if (!tanggal2) continue;

    const idPakai = String(row2[6] || '').trim();
    const ket = String(row2[2] || '').trim();
    const tambah = Number(row2[3] || 0) || 0;
    const pakai = Number(row2[4] || 0) || 0;

    if (tambah > 0) {
      tabungan.push({
        idTransaksi: idPakai,
        tanggal: tanggal2,
        nominal: tambah,
        keterangan: ket,
        struck: ''
      });
    }

    if (pakai > 0) {
      tabungan.push({
        idTransaksi: idPakai,
        tanggal: tanggal2,
        nominal: -pakai,
        keterangan: ket,
        struck: ''
      });
    }
  }

  const sorterDesc = function(a, b) {
    const da = String(a && a.tanggal || '');
    const db = String(b && b.tanggal || '');
    if (da === db) {
      const ia = String(a && a.idTransaksi || '');
      const ib = String(b && b.idTransaksi || '');
      return ia < ib ? 1 : (ia > ib ? -1 : 0);
    }
    return da < db ? 1 : -1;
  };

  rekening.sort(sorterDesc);
  tabungan.sort(sorterDesc);

  return {
    ok: true,
    rekening: rekening,
    tabungan: tabungan
  };
}

function apiDebugDates() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.', tx1: [], tx2: [] };

  ensureUserTxSheet(username);

  const tx1 = _readTx1Rows_(username).map(function(row) {
    return {
      no: row[0],
      tanggal_raw: row[1],
      tanggal: _formatDateYmd_(row[1]),
      pengeluaran: Number(row[2] || 0) || 0,
      pemasukan: Number(row[3] || 0) || 0,
      tabungan: Number(row[4] || 0) || 0,
      saldo: Number(row[5] || 0) || 0,
      id: String(row[6] || '').trim(),
      keterangan: String(row[7] || '').trim(),
      struck: String(row[8] || '').trim()
    };
  });

  const tx2 = _readTx2Rows_(username).map(function(row) {
    return {
      no: row[0],
      tanggal_raw: row[1],
      tanggal: _formatDateYmd_(row[1]),
      keperluan: String(row[2] || '').trim(),
      tambah: Number(row[3] || 0) || 0,
      pakai: Number(row[4] || 0) || 0,
      saldo: Number(row[5] || 0) || 0,
      id: String(row[6] || '').trim()
    };
  });

  return { ok: true, tx1: tx1, tx2: tx2 };
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
 * - metode: nama metode (dari dropdown)
 * - tabunganMode: 'tetap'|'pindah' (hanya saat tabungan, default 'tetap')
 * - metodeTujuan: nama metode tujuan (hanya saat tabungan + pindah)
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
  const metode = String(payload?.metode || '').trim();
  const tabunganMode = String(payload?.tabunganMode || 'tetap').trim().toLowerCase();
  const metodeTujuan = String(payload?.metodeTujuan || '').trim();
  const konfirmasiAmbilTabungan = Boolean(payload?.konfirmasiAmbilTabungan);
  const jumlahAmbilTabunganInput = Number(payload?.jumlahAmbilTabungan || 0) || 0;

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!['pengeluaran', 'pemasukan', 'tabungan'].includes(jenis)) {
    return { ok: false, message: 'Jenis transaksi tidak valid.' };
  }
  if (!['tetap', 'pindah'].includes(tabunganMode)) {
    return { ok: false, message: 'Mode tabungan tidak valid.' };
  }
  if (!(nominal > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };

  if (jenis === 'tabungan' && tabunganMode === 'pindah') {
    if (!metode) {
      return { ok: false, message: 'Metode sumber wajib diisi untuk mode pindah.' };
    }
    if (!metodeTujuan) {
      return { ok: false, message: 'Metode tujuan wajib diisi untuk mode pindah.' };
    }
    if (_isCashMetode_(metode) || _isCashMetode_(metodeTujuan)) {
      return { ok: false, message: 'Mode pindah hanya boleh antar metode non-cash.' };
    }
    if (_normalizeMetodeName_(metode).toLowerCase() === _normalizeMetodeName_(metodeTujuan).toLowerCase()) {
      return { ok: false, message: 'Metode tujuan tidak boleh sama dengan metode sumber.' };
    }
  }

  if (jenis === 'pengeluaran' || jenis === 'tabungan') {
    if (!metode) {
      return { ok: false, message: 'Metode wajib dipilih untuk transaksi pengeluaran/tabungan.' };
    }

    const idUserForSaldo = getIdUserByUsername(username);
    if (!idUserForSaldo) {
      return { ok: false, message: 'id_user tidak ditemukan untuk validasi saldo metode.' };
    }

    const cekSaldoMetode = ensureMetodeSaldoMencukupi_(
      idUserForSaldo,
      metode,
      nominal,
      jenis === 'pengeluaran' ? 'rekening-pengeluaran' : 'rekening-tabungan'
    );
    if (!cekSaldoMetode.ok) {
      return {
        ok: false,
        code: cekSaldoMetode.code || 'SALDO_METODE_TIDAK_CUKUP',
        message: cekSaldoMetode.message || 'Saldo metode tidak cukup.',
        saldoMetode: Number(cekSaldoMetode.saldoMetode || 0) || 0,
        nominal: nominal,
        kekurangan: Number(cekSaldoMetode.kekurangan || 0) || 0,
        metode: metode
      };
    }
  }

  const no = _lastNumberInSheetCol_(sh, 1) + 1; // col A
  const idTransaksi = newId_(String(TX_ID_GENERATOR_CONFIG.PREFIX_TX_REKENING || 'TX'));

  const prevSaldo = _lastSaldoFromTx1_(sh);
  let topupFromTabungan = 0;
  let nextSaldo = prevSaldo;

  if ((jenis === 'pengeluaran' || jenis === 'tabungan') && nominal > prevSaldo) {
    const kekurangan = nominal - prevSaldo;
    const latestTot = _updateTotSheet_(uname);
    const saldoTabunganSaatIni = Number(latestTot.total_tabungan || 0) || 0;

    if (saldoTabunganSaatIni < kekurangan) {
      return {
        ok: false,
        code: 'SALDO_TIDAK_CUKUP',
        message: 'Saldo rekening tidak cukup dan saldo tabungan tidak mencukupi untuk menutup kekurangan transaksi.',
        needsTopupFromTabungan: false,
        canCoverFromTabungan: false,
        saldoRekening: prevSaldo,
        saldoTabungan: saldoTabunganSaatIni,
        nominal: nominal,
        kekurangan: kekurangan
      };
    }

    if (!konfirmasiAmbilTabungan) {
      return {
        ok: false,
        code: 'PERLU_KONFIRMASI_AMBIL_TABUNGAN',
        needsTopupFromTabungan: true,
        canCoverFromTabungan: true,
        message: 'Saldo rekening tidak cukup. Masukkan nominal pengambilan dari tabungan.',
        saldoRekening: prevSaldo,
        saldoTabungan: saldoTabunganSaatIni,
        nominal: nominal,
        kekurangan: kekurangan,
        minimumAmbil: kekurangan,
        maximumAmbil: saldoTabunganSaatIni
      };
    }

    if (!(jumlahAmbilTabunganInput > 0)) {
      return {
        ok: false,
        code: 'NOMINAL_AMBIL_INVALID',
        message: 'Nominal pengambilan tabungan harus lebih dari 0.',
        saldoRekening: prevSaldo,
        saldoTabungan: saldoTabunganSaatIni,
        nominal: nominal,
        kekurangan: kekurangan,
        minimumAmbil: kekurangan,
        maximumAmbil: saldoTabunganSaatIni
      };
    }

    if (jumlahAmbilTabunganInput < kekurangan) {
      return {
        ok: false,
        code: 'NOMINAL_AMBIL_KURANG',
        message: 'Nominal pengambilan tabungan tidak boleh kurang dari nilai kekurangan transaksi.',
        saldoRekening: prevSaldo,
        saldoTabungan: saldoTabunganSaatIni,
        nominal: nominal,
        kekurangan: kekurangan,
        minimumAmbil: kekurangan,
        maximumAmbil: saldoTabunganSaatIni
      };
    }

    if (jumlahAmbilTabunganInput > saldoTabunganSaatIni) {
      return {
        ok: false,
        code: 'SALDO_TABUNGAN_TIDAK_CUKUP',
        message: 'Saldo tabungan tidak cukup untuk nominal pengambilan yang diminta.',
        saldoRekening: prevSaldo,
        saldoTabungan: saldoTabunganSaatIni,
        nominal: nominal,
        kekurangan: kekurangan,
        minimumAmbil: kekurangan,
        maximumAmbil: saldoTabunganSaatIni
      };
    }

    topupFromTabungan = jumlahAmbilTabunganInput;
  }

  let pengeluaran = 0, pemasukan = 0, tabungan = 0;
  if (jenis === 'pengeluaran') { pengeluaran = nominal; nextSaldo = prevSaldo + topupFromTabungan - nominal; }
  if (jenis === 'pemasukan') { pemasukan = nominal; nextSaldo = prevSaldo + nominal; }
  if (jenis === 'tabungan') { tabungan = nominal; nextSaldo = prevSaldo + topupFromTabungan - nominal; }

  const shouldSortAndRecalcTx1 = !_isAppendDateInOrder_(sh, 2, tanggal);
  const nextRow = sh.getLastRow() + 1;
  const keteranganFinal = topupFromTabungan > 0
    ? (keterangan
      ? keterangan + ' | Topup dari tabungan: ' + topupFromTabungan
      : 'Topup dari tabungan: ' + topupFromTabungan)
    : keterangan;
  // Tambahkan kolom struck (default kosong, bisa diupdate setelah upload)
  // Kolom: A no, B tanggal, C pengeluaran, D pemasukan, E tabungan, F saldo, G id, H ket, I struck, J metode
  const row = [no, tanggal, pengeluaran, pemasukan, tabungan, nextSaldo, idTransaksi, keteranganFinal, '', metode];
  if (payload && payload.struck) row[8] = payload.struck;
  sh.getRange(nextRow, 1, 1, row.length).setValues([row]);

  // Setelah input, hanya urutkan/hitung ulang jika tanggal out-of-order
  if (shouldSortAndRecalcTx1) {
    sortTxSheetByDate_(sh, 2); // tanggal di kolom 2
    recalculateSaldoTx1_(sh);
  }

  if (topupFromTabungan > 0) {
    const sh2Topup = ensureUserTx2Sheet_(ss, uname);
    const shTotTopup = ensureUserTotSheet_(ss, uname);
    const noTopup = _lastNumberInSheetCol_(sh2Topup, 1) + 1;
    const idTopup = newId_(String(TX_ID_GENERATOR_CONFIG.PREFIX_TX_TABUNGAN || 'AX'));
    const prevSaldoTabungan = _lastSaldoTabunganFromTot_(shTotTopup);
    const nextSaldoTabungan = prevSaldoTabungan - topupFromTabungan;
    const shouldSortAndRecalcTx2Topup = !_isAppendDateInOrder_(sh2Topup, 2, tanggal);
    const nextRowTopup = sh2Topup.getLastRow() + 1;
    const ketTopup = 'Pemakaian Kekurangan';

    const rowTopup = [noTopup, tanggal, ketTopup, 0, topupFromTabungan, nextSaldoTabungan, idTopup, metode || 'AUTO_TOPUP'];
    sh2Topup.getRange(nextRowTopup, 1, 1, rowTopup.length).setValues([rowTopup]);

    if (shouldSortAndRecalcTx2Topup) {
      sortTxSheetByDate_(sh2Topup, 2);
      recalculateSaldoTx2_(sh2Topup);
    }
  }

  // ===== UPDATE SALDO DATA2 (ATURAN FINAL) =====
  const id_user = getIdUserByUsername(username);
  if (!id_user) {
    Logger.log('[apiAddTxRekening] id_user tidak ditemukan, skip update Data2 untuk username=' + username);
  } else {
    if (jenis === 'pemasukan') {
      if (metode && !_isCashMetode_(metode)) {
        const resIn = updateSaldoData2_(id_user, metode, nominal);
        Logger.log('[apiAddTxRekening] pemasukan + Data2:', resIn);
      }
    } else if (jenis === 'pengeluaran') {
      if (metode && !_isCashMetode_(metode)) {
        const resOut = updateSaldoData2_(id_user, metode, -nominal);
        Logger.log('[apiAddTxRekening] pengeluaran - Data2:', resOut);
      }
    } else if (jenis === 'tabungan') {
      if (tabunganMode === 'tetap') {
        // Mode tetap: tidak mengubah Data2
        Logger.log('[apiAddTxRekening] tabungan mode tetap: skip update Data2');
      } else if (tabunganMode === 'pindah') {
        // Mode pindah: asal minus, tujuan plus (keduanya non-cash)
        const resAsal = updateSaldoData2_(id_user, metode, -nominal);
        const resTujuan = updateSaldoData2_(id_user, metodeTujuan, nominal);
        Logger.log('[apiAddTxRekening] tabungan pindah asal - Data2:', resAsal);
        Logger.log('[apiAddTxRekening] tabungan pindah tujuan + Data2:', resTujuan);
      }
    }
  }

  // Jika jenis tabungan, tambahkan juga ke TX2
  if (jenis === 'tabungan') {
    const sh2 = ensureUserTx2Sheet_(ss, uname);
    const shTot = ensureUserTotSheet_(ss, uname);
    const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
    const prevSaldoTabungan = _lastSaldoTabunganFromTot_(shTot);
    const nextSaldoTabungan = prevSaldoTabungan + nominal;
    const shouldSortAndRecalcTx2 = !_isAppendDateInOrder_(sh2, 2, tanggal);
    const nextRowTx2 = sh2.getLastRow() + 1;
    // Kolom: A no, B tanggal, C keperluan, D tambah, E pakai, F saldo, G id, H metode
    const row2 = [noPakai, tanggal, keterangan || 'Transfer dari rekening', nominal, 0, nextSaldoTabungan, idTransaksi, metode];
    sh2.getRange(nextRowTx2, 1, 1, row2.length).setValues([row2]);
    // Hanya urutkan/hitung ulang jika tanggal out-of-order
    if (shouldSortAndRecalcTx2) {
      sortTxSheetByDate_(sh2, 2);
      recalculateSaldoTx2_(sh2);
    }
  }

  _updateTotSheet_(uname);
  return {
    ok: true,
    message: topupFromTabungan > 0
      ? 'Transaksi rekening tersimpan. Pengambilan tabungan berhasil dicatat sebagai Pemakaian Kekurangan.'
      : 'Transaksi rekening tersimpan.',
    id_transaksi: idTransaksi,
    row: nextRow,
    saldo_rekening: nextSaldo,
    autoTopupFromTabungan: topupFromTabungan
  };
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
  const metode = String(payload?.metode || '').trim();

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!keperluan) return { ok: false, message: 'Keperluan wajib diisi.' };
  if (!(jumlah > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };
  if (!metode) return { ok: false, message: 'Metode wajib dipilih untuk transaksi tabungan.' };

  const idUserForSaldo = getIdUserByUsername(username);
  if (!idUserForSaldo) {
    return { ok: false, message: 'id_user tidak ditemukan untuk validasi saldo metode.' };
  }

  const cekSaldoMetode = ensureMetodeSaldoMencukupi_(idUserForSaldo, metode, jumlah, 'tabungan-pakai');
  if (!cekSaldoMetode.ok) {
    return {
      ok: false,
      code: cekSaldoMetode.code || 'SALDO_METODE_TIDAK_CUKUP',
      message: cekSaldoMetode.message || 'Saldo metode tidak cukup untuk transaksi tabungan ini.',
      saldoMetode: Number(cekSaldoMetode.saldoMetode || 0) || 0,
      nominal: jumlah,
      kekurangan: Number(cekSaldoMetode.kekurangan || 0) || 0,
      metode: metode
    };
  }

  const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1; // col A
  const idPakai = newId_(String(TX_ID_GENERATOR_CONFIG.PREFIX_TX_TABUNGAN || 'AX'));

  const latestTot = _updateTotSheet_(uname);
  const prevSaldo = Number(latestTot.total_tabungan || 0) || 0;
  if (jumlah > prevSaldo) {
    return {
      ok: false,
      code: 'SALDO_TABUNGAN_TIDAK_CUKUP',
      message: 'Saldo tabungan tidak cukup untuk transaksi ini.',
      saldo_tabungan: prevSaldo,
      nominal: jumlah,
      kekurangan: jumlah - prevSaldo
    };
  }
  const nextSaldo = prevSaldo - jumlah;

  const shouldSortAndRecalcTx2 = !_isAppendDateInOrder_(sh2, 2, tanggal);
  const nextRow = sh2.getLastRow() + 1;

  const row = [noPakai, tanggal, keperluan, 0, jumlah, nextSaldo, idPakai, metode];
  sh2.getRange(nextRow, 1, 1, row.length).setValues([row]);
  if (shouldSortAndRecalcTx2) {
    sortTxSheetByDate_(sh2, 2);
    recalculateSaldoTx2_(sh2);
  }
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
  const metode = String(payload?.metode || '').trim();

  if (!tanggalStr) return { ok: false, message: 'Tanggal wajib diisi.' };
  const tanggal = new Date(tanggalStr + 'T00:00:00');
  if (isNaN(tanggal.getTime())) return { ok: false, message: 'Tanggal tidak valid.' };

  if (!(jumlah > 0)) return { ok: false, message: 'Nominal harus lebih dari 0.' };

  const noPakai = _lastNumberInSheetCol_(sh2, 1) + 1;
  const idPakai = newId_(String(TX_ID_GENERATOR_CONFIG.PREFIX_TX_TABUNGAN || 'AX'));

  const prevSaldo = _lastSaldoTabunganFromTot_(shTot);
  const nextSaldo = prevSaldo + jumlah;

  const shouldSortAndRecalcTx2 = !_isAppendDateInOrder_(sh2, 2, tanggal);
  const nextRow = sh2.getLastRow() + 1;

  const row = [noPakai, tanggal, keperluan, jumlah, 0, nextSaldo, idPakai, metode];
  sh2.getRange(nextRow, 1, 1, row.length).setValues([row]);
  if (shouldSortAndRecalcTx2) {
    sortTxSheetByDate_(sh2, 2);
    recalculateSaldoTx2_(sh2);
  }
  _updateTotSheet_(uname);
  return { ok: true, message: 'Tambah tabungan tersimpan.', id_pakai_tabungan: idPakai, row: nextRow, saldo_tabungan: nextSaldo };
}

function apiAddTabunganManual(payload) {
  return apiAddTambahTabungan({
    tanggal_pakai_tabungan: payload && payload.tanggal_tabungan,
    keperluan: payload && payload.keperluan,
    jumlah_tambah_tabungan: payload && payload.jumlah_tambah_tabungan,
    metode: payload && payload.metode
  });
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