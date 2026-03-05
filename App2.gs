// App2.gs
// Script Google Apps untuk fitur Keuangan 1


// Fungsi lama tidak dipakai dari HTML/Sidebar, karena getUi() error di context ini
// Fungsi baru untuk dipanggil dari google.script.run
function getApp2PageHtml() {
  return HtmlService.createHtmlOutputFromFile('App2page').getContent();
}
// Ambil daftar tema dari Theme.gs (API sama dengan dashboard)
// Wrapper API tema untuk App2, gunakan hanya satu definisi
function getThemes() {
  if (typeof apiThemeList === 'function') {
    var res = apiThemeList();
    if (res && res.ok && Array.isArray(res.themes)) return res.themes;
  }
  return [];
}

function setTheme(key) {
  if (typeof apiThemeSetMyTheme === 'function') {
    return apiThemeSetMyTheme(key);
  }
  return { ok: false, message: 'apiThemeSetMyTheme not found' };
}

function getUserTheme() {
  if (typeof apiThemeGetMyTheme === 'function') {
    var res = apiThemeGetMyTheme();
    if (res && res.ok && res.active && res.active.key) return res.active.key;
  }
  return '';
}

function sanitizeDriveFolderName_(name) {
  return String(name || '').replace(/[\\/:*?"<>|#\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getBendaharaRootFolder_() {
  const id = String(CONFIG.BENDAHARA_DRIVE_ROOT_FOLDER_ID || '').trim();
  if (!id) throw new Error('CONFIG.BENDAHARA_DRIVE_ROOT_FOLDER_ID belum diisi.');
  return DriveApp.getFolderById(id);
}

function getOrCreateChildFolder_(parentFolder, childName) {
  const safeName = sanitizeDriveFolderName_(childName);
  if (!safeName) throw new Error('Nama folder tidak valid/kosong.');
  const f = parentFolder.getFoldersByName(safeName);
  return f.hasNext() ? f.next() : parentFolder.createFolder(safeName);
}

function _buildBendaharaUserFolderName_(username, idUser) {
  return sanitizeDriveFolderName_(username || 'unknown_user') + ' (' + sanitizeDriveFolderName_(idUser || 'NO_ID') + ')';
}

function _getUserIdentityByUsername_(username) {
  const uname = normalizeUsername_(username);
  if (!uname) return { ok: false, message: 'Username kosong.' };
  const found = findUserRowByUsername_(uname);
  if (!found || !found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };
  const idUser = String(found.row[CONFIG.USERS_COL.id - 1] || '').trim();
  if (!idUser) return { ok: false, message: 'id_user kosong pada sheet Users.' };
  return {
    ok: true,
    username: uname,
    idUser: idUser,
    nama: String(found.row[CONFIG.USERS_COL.nama - 1] || '').trim(),
    email: String(found.row[CONFIG.USERS_COL.email - 1] || '').trim()
  };
}

function _getUserIdentityById_(idUser) {
  const idTarget = String(idUser || '').trim();
  if (!idTarget) return { ok: false, message: 'id_user kosong.' };
  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, message: 'Sheet Users kosong.' };
  const values = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowId = String(row[CONFIG.USERS_COL.id - 1] || '').trim();
    if (rowId !== idTarget) continue;
    return {
      ok: true,
      username: normalizeUsername_(String(row[CONFIG.USERS_COL.username - 1] || '').trim()),
      idUser: rowId,
      nama: String(row[CONFIG.USERS_COL.nama - 1] || '').trim(),
      email: String(row[CONFIG.USERS_COL.email - 1] || '').trim()
    };
  }
  return { ok: false, message: 'id_user tidak ditemukan di Users.' };
}

function getBendaharaSpreadsheet_() {
  const id = String(CONFIG.BENDAHARA_SPREADSHEET_ID || '').trim();
  if (!id) throw new Error('CONFIG.BENDAHARA_SPREADSHEET_ID belum diisi.');
  return SpreadsheetApp.openById(id);
}

function _bendaharaCfg_() {
  return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.BENDAHARA) || {};
}

function _paymentCfg_() {
  return (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.PAYMENT) || {};
}

function _bendaharaTx4SheetName_(username) {
  const tx4Prefix = String((typeof CONFIG !== 'undefined' && CONFIG.TX4_SHEET_PREFIX) || 'TX4_');
  return tx4Prefix + normalizeUsername_(username || '');
}

function _bendaharaTx4Header_() {
  return [
    'no_bendahara',
    'tanggal_bendahara',
    'pengeluaran_bendahara',
    'pemasukan_bendahara',
    'saldo_rekening_bendahara',
    'id_transaksi_bendahara',
    'keterangan_bendahara',
    'struck_bendahara',
    'id_Project',
    'nama_project',
    'metode_bendahara'
  ];
}

function _applyBendaharaTx4SheetLayout_(sh) {
  const header = _bendaharaTx4Header_();
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
  sh.getRange('C:E').setNumberFormat('#,##0');
}

function _ensureBendaharaTx4SheetByUsernameCore_(username) {
  const uname = normalizeUsername_(username);
  if (!uname) return { ok: false, message: 'Username kosong.' };

  const ss = getBendaharaSpreadsheet_();
  const sheetName = _bendaharaTx4SheetName_(uname);
  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  }
  _applyBendaharaTx4SheetLayout_(sh);

  return { ok: true, username: uname, sheetName: sheetName, sheetId: sh.getSheetId() };
}

function ensureBendaharaTx4SheetByUsername_(username) {
  const userInfo = _getUserIdentityByUsername_(username);
  return userInfo.ok ? _ensureBendaharaTx4SheetByUsernameCore_(userInfo.username) : userInfo;
}

function ensureBendaharaTx4SheetById_(idUser) {
  const userInfo = _getUserIdentityById_(idUser);
  return userInfo.ok ? _ensureBendaharaTx4SheetByUsernameCore_(userInfo.username) : userInfo;
}

function ensureBendaharaUserFolderByUsername_(username) {
  const userInfo = _getUserIdentityByUsername_(username);
  if (!userInfo.ok) return userInfo;
  const userFolder = getOrCreateChildFolder_(getBendaharaRootFolder_(), _buildBendaharaUserFolderName_(userInfo.username, userInfo.idUser));
  return {
    ok: true,
    username: userInfo.username,
    idUser: userInfo.idUser,
    folderId: userFolder.getId(),
    folderName: userFolder.getName(),
    folderUrl: userFolder.getUrl()
  };
}

function ensureBendaharaUserFolderById_(idUser) {
  const userInfo = _getUserIdentityById_(idUser);
  if (!userInfo.ok) return userInfo;
  const userFolder = getOrCreateChildFolder_(getBendaharaRootFolder_(), _buildBendaharaUserFolderName_(userInfo.username, userInfo.idUser));
  return {
    ok: true,
    username: userInfo.username,
    idUser: userInfo.idUser,
    folderId: userFolder.getId(),
    folderName: userFolder.getName(),
    folderUrl: userFolder.getUrl()
  };
}

function ensureBendaharaProjectFolder_(idUser, username, projectName) {
  const userFolder = getOrCreateChildFolder_(getBendaharaRootFolder_(), _buildBendaharaUserFolderName_(username, idUser));
  const project = sanitizeDriveFolderName_(projectName);
  if (!project) return { ok: false, message: 'Nama project wajib diisi.' };
  const pf = getOrCreateChildFolder_(userFolder, project);
  return {
    ok: true,
    idUser: idUser,
    username: username,
    project: project,
    userFolderId: userFolder.getId(),
    userFolderUrl: userFolder.getUrl(),
    projectFolderId: pf.getId(),
    projectFolderUrl: pf.getUrl()
  };
}

function apiEnsureMyBendaharaProjectFolder(projectName) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };
  const userInfo = _getUserIdentityByUsername_(username);
  return userInfo.ok ? ensureBendaharaProjectFolder_(userInfo.idUser, userInfo.username, projectName) : userInfo;
}

function apiEnsureBendaharaProjectFolderByUserId(idUser, projectName) {
  const userInfo = _getUserIdentityById_(idUser);
  return userInfo.ok ? ensureBendaharaProjectFolder_(userInfo.idUser, userInfo.username, projectName) : userInfo;
}

function apiBendaharaAddProject(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const userInfo = _getUserIdentityByUsername_(username);
  if (!userInfo.ok) return userInfo;

  const projectName = String(payload && payload.projectName || '').trim();
  if (!projectName) return { ok: false, message: 'Nama project wajib diisi.' };
  const bendaharaCfg = _bendaharaCfg_();
  const projectNameMaxLength = Number(bendaharaCfg.PROJECT_NAME_MAX_LENGTH || 80);
  if (projectName.length > projectNameMaxLength) {
    return { ok: false, message: `Nama project maksimal ${projectNameMaxLength} karakter.` };
  }

  const lock = LockService.getScriptLock();
  let generatedProjectId = '';
  try {
    lock.waitLock(Number(bendaharaCfg.LOCK_TIMEOUT_MS || 15000));

    const ss = getBendaharaSpreadsheet_();
    const sh = ss.getSheetByName(CONFIG.BENDAHARA_DATA_SHEET_NAME || 'Data');
    if (!sh) return { ok: false, message: 'Sheet Data bendahara tidak ditemukan.' };

    const normalized = projectName.toLowerCase();
    const lastRow = sh.getLastRow();
    if (lastRow >= 2) {
      const values = sh.getRange(2, 1, lastRow - 1, 2).getValues();
      for (let i = 0; i < values.length; i++) {
        const rowIdUser = String(values[i][0] || '').trim();
        const rowProject = String(values[i][1] || '').trim();
        if (rowIdUser === userInfo.idUser && rowProject.toLowerCase() === normalized) {
          try { ensureBendaharaProjectFolder_(userInfo.idUser, userInfo.username, projectName); } catch (e) {}
          return { ok: true, duplicated: true, message: 'Project sudah ada.', idUser: userInfo.idUser, projectName: rowProject };
        }
      }
    }

    const cols = _bendaharaDataHeaderMap_(sh);
    const rowWidth = Math.max(sh.getLastColumn(), cols.idProjectCol, cols.saldoCol, cols.projectCol, cols.idUserCol, 4);
    const row = new Array(rowWidth).fill('');
    generatedProjectId = _nextGlobalProjectId_(sh, cols);
    row[cols.idUserCol - 1] = userInfo.idUser;
    row[cols.projectCol - 1] = projectName;
    row[cols.saldoCol - 1] = 0;
    row[cols.idProjectCol - 1] = generatedProjectId;
    sh.appendRow(row);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }

  let folder = null;
  try {
    folder = ensureBendaharaProjectFolder_(userInfo.idUser, userInfo.username, projectName);
  } catch (err) {
    Logger.log('[apiBendaharaAddProject] Gagal create folder project: ' + err);
  }

  try { ensureBendaharaTx4SheetByUsername_(userInfo.username); } catch (e) {}

  return {
    ok: true,
    duplicated: false,
    message: 'Project berhasil ditambahkan.',
    idUser: userInfo.idUser,
    projectName: projectName,
    idProject: generatedProjectId,
    folderUrl: folder && folder.projectFolderUrl ? folder.projectFolderUrl : ''
  };
}

function apiBendaharaListMyProjects() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.', projects: [] };

  const userInfo = _getUserIdentityByUsername_(username);
  if (!userInfo.ok) return { ok: false, message: userInfo.message || 'User tidak ditemukan.', projects: [] };

  const ss = getBendaharaSpreadsheet_();
  const sh = ss.getSheetByName(CONFIG.BENDAHARA_DATA_SHEET_NAME || 'Data');
  if (!sh) return { ok: false, message: 'Sheet Data bendahara tidak ditemukan.', projects: [] };

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, projects: [] };

  const values = sh.getRange(2, 1, lastRow - 1, 2).getValues();
  const seen = {};
  const projects = [];

  for (let i = 0; i < values.length; i++) {
    const rowIdUser = String(values[i][0] || '').trim();
    if (rowIdUser !== userInfo.idUser) continue;

    const project = String(values[i][1] || '').trim();
    if (!project) continue;

    const key = project.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    projects.push(project);
  }

  projects.sort(function(a, b){ return a.localeCompare(b, 'id', { sensitivity: 'base' }); });
  return { ok: true, idUser: userInfo.idUser, projects: projects };
}

function _bendaharaDataHeaderMap_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 4);
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const norm = {};
  for (let i = 0; i < header.length; i++) {
    const key = String(header[i] || '').trim().toLowerCase();
    if (key) norm[key] = i + 1;
  }
  return {
    idUserCol: norm['id_user'] || 1,
    projectCol: norm['project'] || 2,
    saldoCol: norm['saldo'] || 3,
    idProjectCol: norm['id_project'] || 4
  };
}

function _normalizeBendaharaNominal_(value) {
  const n = Number(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : 0;
}

function _bendaharaLettersToNumber_(letters) {
  const s = String(letters || '').trim().toUpperCase();
  if (!s) return 0;
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 65 || code > 90) return 0;
    n = n * 26 + (code - 64);
  }
  return n;
}

function _bendaharaNumberToLetters_(num) {
  let n = Number(num || 0) || 0;
  if (n <= 0) return '';
  let out = '';
  while (n > 0) {
    n--;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

function _bendaharaStructuredIdToSeq_(idValue, prefix) {
  const pref = String(prefix || '').trim().toUpperCase();
  if (!pref) return 0;
  const raw = String(idValue || '').trim().toUpperCase();
  const bendaharaCfg = _bendaharaCfg_();
  const blockSize = Number(bendaharaCfg.STRUCTURED_ID_BLOCK_SIZE || 999);
  const re = new RegExp('^' + pref + '([A-Z]*)(\\d{3})$');
  const m = raw.match(re);
  if (!m) return 0;
  const lettersNum = _bendaharaLettersToNumber_(m[1] || '');
  const serial = Number(m[2] || 0) || 0;
  if (serial < 1 || serial > blockSize) return 0;
  return lettersNum * blockSize + serial;
}

function _bendaharaStructuredSeqToId_(seqValue, prefix) {
  const pref = String(prefix || '').trim().toUpperCase();
  const bendaharaCfg = _bendaharaCfg_();
  const blockSize = Number(bendaharaCfg.STRUCTURED_ID_BLOCK_SIZE || 999);
  let seq = Number(seqValue || 0) || 0;
  if (!pref || seq < 1) seq = 1;
  const block = Math.floor((seq - 1) / blockSize);
  const serial = ((seq - 1) % blockSize) + 1;
  const letters = block <= 0 ? '' : _bendaharaNumberToLetters_(block);
  return pref + letters + String(serial).padStart(3, '0');
}

function _scanMaxProjectSeq_(sheetData, cols) {
  const bendaharaCfg = _bendaharaCfg_();
  const projectPrefix = String(bendaharaCfg.PROJECT_ID_PREFIX || 'PJC');
  const lastRow = sheetData.getLastRow();
  if (lastRow < 2) return 0;
  const width = Math.max(cols.idProjectCol, 4);
  const values = sheetData.getRange(2, 1, lastRow - 1, width).getValues();
  let maxSeq = 0;
  for (let i = 0; i < values.length; i++) {
    const idProject = values[i][cols.idProjectCol - 1];
    const seq = _bendaharaStructuredIdToSeq_(idProject, projectPrefix);
    if (seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

function _scanMaxBendaharaTransSeq_(ssBendahara) {
  const bendaharaCfg = _bendaharaCfg_();
  const txPrefix = String(bendaharaCfg.TRANSACTION_ID_PREFIX || 'BDH');
  const tx4Prefix = String((typeof CONFIG !== 'undefined' && CONFIG.TX4_SHEET_PREFIX) || 'TX4_');
  const sheets = ssBendahara.getSheets();
  let maxSeq = 0;
  for (let s = 0; s < sheets.length; s++) {
    const sh = sheets[s];
    const name = String(sh.getName() || '');
    if (name.indexOf(tx4Prefix) !== 0) continue;
    const lastRow = sh.getLastRow();
    if (lastRow < 2) continue;
    const ids = sh.getRange(2, 6, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      const seq = _bendaharaStructuredIdToSeq_(ids[i][0], txPrefix);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return maxSeq;
}

function _nextGlobalStructuredId_(propKey, prefix, scanMaxFn) {
  const props = PropertiesService.getScriptProperties();
  let stored = Number(props.getProperty(propKey) || 0) || 0;
  let scanned = 0;
  if (typeof scanMaxFn === 'function') {
    scanned = Number(scanMaxFn() || 0) || 0;
  }
  if (scanned > stored) stored = scanned;
  const nextSeq = stored + 1;
  props.setProperty(propKey, String(nextSeq));
  return _bendaharaStructuredSeqToId_(nextSeq, prefix);
}

function _nextGlobalProjectId_(sheetData, cols) {
  const bendaharaCfg = _bendaharaCfg_();
  const projectPrefix = String(bendaharaCfg.PROJECT_ID_PREFIX || 'PJC');
  return _nextGlobalStructuredId_('__bendahara_seq_project_pjc', projectPrefix, function(){
    return _scanMaxProjectSeq_(sheetData, cols);
  });
}

function _nextGlobalBendaharaTransId_(ssBendahara) {
  const bendaharaCfg = _bendaharaCfg_();
  const txPrefix = String(bendaharaCfg.TRANSACTION_ID_PREFIX || 'BDH');
  return _nextGlobalStructuredId_('__bendahara_seq_tx_bdh', txPrefix, function(){
    return _scanMaxBendaharaTransSeq_(ssBendahara);
  });
}

function _findBendaharaProjectRow_(sheet, cols, idUser, projectName) {
  const targetProject = String(projectName || '').trim().toLowerCase();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const width = Math.max(cols.idProjectCol, cols.saldoCol, cols.projectCol, cols.idUserCol);
  const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowIdUser = String(row[cols.idUserCol - 1] || '').trim();
    const rowProject = String(row[cols.projectCol - 1] || '').trim();
    if (!rowIdUser || !rowProject) continue;
    if (rowIdUser !== idUser) continue;
    if (rowProject.toLowerCase() !== targetProject) continue;

    return {
      rowNumber: i + 2,
      rowProject: rowProject,
      idProject: String(row[cols.idProjectCol - 1] || '').trim(),
      saldo: Number(row[cols.saldoCol - 1] || 0) || 0
    };
  }
  return null;
}

function apiBendaharaListMetode() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.', metode: [] };

  const userInfo = _getUserIdentityByUsername_(username);
  if (!userInfo.ok) return { ok: false, message: userInfo.message || 'User tidak ditemukan.', metode: [] };

  let metode = [];
  try {
    if (typeof getMetodeByUser === 'function') {
      metode = getMetodeByUser(userInfo.idUser) || [];
    }
  } catch (err) {
    return { ok: false, message: 'Gagal memuat metode: ' + err.message, metode: [] };
  }

  metode = metode.map(function(m){ return String(m || '').trim(); }).filter(Boolean);
  const cashLabel = String(_paymentCfg_().CASH_LABEL || 'Cash');
  if (metode.map(function(m){ return m.toLowerCase(); }).indexOf(cashLabel.toLowerCase()) < 0) {
    metode.unshift(cashLabel);
  }
  return { ok: true, idUser: userInfo.idUser, metode: metode };
}

function apiBendaharaSummary(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const userInfo = _getUserIdentityByUsername_(username);
  if (!userInfo.ok) return { ok: false, message: userInfo.message || 'User tidak ditemukan.' };

  const projectName = String(payload && payload.projectName || '').trim();
  const ssB = getBendaharaSpreadsheet_();
  const shData = ssB.getSheetByName(CONFIG.BENDAHARA_DATA_SHEET_NAME || 'Data');
  if (!shData) return { ok: false, message: 'Sheet Data bendahara tidak ditemukan.' };

  const cols = _bendaharaDataHeaderMap_(shData);
  const lastRow = shData.getLastRow();
  let saldoProjectAktif = 0;
  let saldoSemuaProject = 0;

  if (lastRow >= 2) {
    const width = Math.max(cols.idProjectCol, cols.saldoCol, cols.projectCol, cols.idUserCol);
    const values = shData.getRange(2, 1, lastRow - 1, width).getValues();
    const targetLower = projectName.toLowerCase();

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowIdUser = String(row[cols.idUserCol - 1] || '').trim();
      if (rowIdUser !== userInfo.idUser) continue;

      const rowProject = String(row[cols.projectCol - 1] || '').trim();
      const saldo = Number(row[cols.saldoCol - 1] || 0) || 0;
      saldoSemuaProject += saldo;
      if (targetLower && rowProject.toLowerCase() === targetLower) {
        saldoProjectAktif = saldo;
      }
    }
  }

  let totalUangUtama = 0;
  try {
    const ssMain = getActiveSpreadsheet_();
    const totPrefix = String(CONFIG.TOT_SHEET_PREFIX || 'TOT_');
    const shTot = ssMain.getSheetByName(totPrefix + userInfo.username);
    if (shTot && shTot.getLastRow() >= 2) {
      totalUangUtama = Number(shTot.getRange(2, 1).getValue() || 0) || 0;
    }
  } catch (err) {
    // Tidak memblokir summary jika sheet TOT tidak tersedia.
  }

  const saldoRekening = saldoSemuaProject + totalUangUtama;

  return {
    ok: true,
    projectName: projectName,
    saldoProjectAktif: saldoProjectAktif,
    saldoSemuaProject: saldoSemuaProject,
    saldoRekening: saldoRekening
  };
}

function _bendaharaToYmd_(value) {
  if (!value) return '';
  const d = (value instanceof Date) ? value : new Date(value);
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function apiBendaharaGetTableData(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.', rows: [] };

  const userInfo = _getUserIdentityByUsername_(username);
  if (!userInfo.ok) return { ok: false, message: userInfo.message || 'User tidak ditemukan.', rows: [] };

  const projectName = String(payload && payload.projectName || '').trim().toLowerCase();
  const tx4Res = ensureBendaharaTx4SheetByUsername_(userInfo.username);
  if (!tx4Res || !tx4Res.ok) {
    return { ok: false, message: (tx4Res && tx4Res.message) || 'Gagal menyiapkan sheet TX4.', rows: [] };
  }

  const ssB = getBendaharaSpreadsheet_();
  const shTx4 = ssB.getSheetByName(tx4Res.sheetName);
  if (!shTx4) return { ok: false, message: 'Sheet TX4 tidak ditemukan.', rows: [] };

  const lastRow = shTx4.getLastRow();
  if (lastRow < 2) return { ok: true, rows: [] };

  const values = shTx4.getRange(2, 1, lastRow - 1, Math.max(11, shTx4.getLastColumn())).getValues();
  const rows = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const namaProject = String(row[9] || '').trim(); // J
    if (projectName && namaProject.toLowerCase() !== projectName) continue;

    const pengeluaran = Number(row[2] || 0) || 0; // C
    const pemasukan = Number(row[3] || 0) || 0;   // D
    const nominal = pemasukan > 0 ? pemasukan : (pengeluaran > 0 ? -pengeluaran : 0);
    const jenis = pemasukan > 0 ? 'pemasukan' : (pengeluaran > 0 ? 'pengeluaran' : '-');

    rows.push({
      no: Number(row[0] || 0) || 0,
      tanggal: _bendaharaToYmd_(row[1]), // B
      pengeluaran: pengeluaran,
      pemasukan: pemasukan,
      nominal: nominal,
      saldo: Number(row[4] || 0) || 0, // E
      idTransaksi: String(row[5] || '').trim(), // F
      keterangan: String(row[6] || '').trim(), // G
      struck: String(row[7] || '').trim(), // H
      idProject: String(row[8] || '').trim(), // I
      project: namaProject,
      metode: String(row[10] || '').trim(), // K
      jenis: jenis
    });
  }

  rows.sort(function(a, b){
    if (a.tanggal === b.tanggal) return b.no - a.no;
    return a.tanggal < b.tanggal ? 1 : -1;
  });

  return { ok: true, rows: rows };
}

function apiBendaharaAddTransaksi(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const userInfo = _getUserIdentityByUsername_(username);
  if (!userInfo.ok) return { ok: false, message: userInfo.message || 'User tidak ditemukan.' };

  const projectName = String(payload && payload.projectName || '').trim();
  const metode = String(payload && payload.metode || '').trim();
  const tanggalInput = String(payload && payload.tanggal || '').trim();
  const keterangan = String(payload && payload.keterangan || '').trim();
  const struckUrl = String(payload && payload.struckUrl || '').trim();
  const pengeluaran = _normalizeBendaharaNominal_(payload && payload.pengeluaran);
  const pemasukan = _normalizeBendaharaNominal_(payload && payload.pemasukan);
  const cashLabel = String(_paymentCfg_().CASH_LABEL || 'Cash');
  const isCash = metode.toLowerCase() === cashLabel.toLowerCase();

  if (!projectName) return { ok: false, message: 'Project wajib dipilih.' };
  if (!metode) return { ok: false, message: 'Metode bendahara wajib dipilih.' };
  if ((pengeluaran > 0 && pemasukan > 0) || (pengeluaran <= 0 && pemasukan <= 0)) {
    return { ok: false, message: 'Isi salah satu nominal: pengeluaran atau pemasukan.' };
  }

  const tanggal = tanggalInput ? new Date(tanggalInput) : new Date();
  if (!(tanggal instanceof Date) || isNaN(tanggal.getTime())) {
    return { ok: false, message: 'Tanggal transaksi tidak valid.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(Number(_bendaharaCfg_().LOCK_TIMEOUT_MS || 15000));
    const ssB = getBendaharaSpreadsheet_();
    const shData = ssB.getSheetByName(CONFIG.BENDAHARA_DATA_SHEET_NAME || 'Data');
    if (!shData) return { ok: false, message: 'Sheet Data bendahara tidak ditemukan.' };

    const cols = _bendaharaDataHeaderMap_(shData);
    const foundProject = _findBendaharaProjectRow_(shData, cols, userInfo.idUser, projectName);
    if (!foundProject) {
      return { ok: false, message: 'Project tidak ditemukan di sheet Data bendahara.' };
    }

    const prevSaldoProject = Number(foundProject.saldo || 0) || 0;
    const perubahan = isCash ? 0 : (pemasukan - pengeluaran);
    const nextSaldoProject = prevSaldoProject + perubahan;
    if (!isCash && nextSaldoProject < 0) {
      return { ok: false, message: 'Saldo project tidak cukup untuk pengeluaran ini.' };
    }

    if (!isCash && pengeluaran > 0) {
      if (typeof ensureMetodeSaldoMencukupi_ === 'function') {
        const cekSaldoMetode = ensureMetodeSaldoMencukupi_(userInfo.idUser, metode, pengeluaran, 'bendahara-pengeluaran');
        if (!cekSaldoMetode || !cekSaldoMetode.ok) {
          return {
            ok: false,
            code: (cekSaldoMetode && cekSaldoMetode.code) || 'SALDO_METODE_TIDAK_CUKUP',
            message: (cekSaldoMetode && cekSaldoMetode.message) || 'Saldo metode tidak cukup untuk pengeluaran ini.',
            saldoMetode: Number(cekSaldoMetode && cekSaldoMetode.saldoMetode || 0) || 0,
            nominal: pengeluaran,
            kekurangan: Number(cekSaldoMetode && cekSaldoMetode.kekurangan || 0) || 0,
            metode: metode
          };
        }
      }
    }

    let metodeResult = { ok: true, skipped: true, newSaldo: 0, oldSaldo: 0 };
    if (!isCash) {
      if (typeof updateSaldoData2_ !== 'function') {
        return { ok: false, message: 'API update saldo metode (Data2) tidak tersedia.' };
      }

      metodeResult = updateSaldoData2_(userInfo.idUser, metode, perubahan);
      if (!metodeResult || !metodeResult.ok) {
        return { ok: false, message: (metodeResult && metodeResult.message) || 'Gagal update saldo metode.' };
      }
    }

    const tx4Res = ensureBendaharaTx4SheetByUsername_(userInfo.username);
    if (!tx4Res || !tx4Res.ok) {
      return { ok: false, message: (tx4Res && tx4Res.message) || 'Gagal menyiapkan sheet TX4.' };
    }

    const shTx4 = ssB.getSheetByName(tx4Res.sheetName);
    if (!shTx4) return { ok: false, message: 'Sheet TX4 bendahara tidak ditemukan.' };

    const nextNo = Math.max(1, shTx4.getLastRow());
    const idTransaksi = _nextGlobalBendaharaTransId_(ssB);
    const row = [
      nextNo,
      tanggal,
      pengeluaran > 0 ? pengeluaran : 0,
      pemasukan > 0 ? pemasukan : 0,
      nextSaldoProject,
      idTransaksi,
      keterangan,
      struckUrl,
      foundProject.idProject || '',
      foundProject.rowProject,
      metode
    ];

    const targetRow = shTx4.getLastRow() + 1;
    shTx4.getRange(targetRow, 1, 1, row.length).setValues([row]);
    if (!isCash) {
      shData.getRange(foundProject.rowNumber, cols.saldoCol).setValue(nextSaldoProject);
    }

    return {
      ok: true,
      message: 'Transaksi bendahara berhasil disimpan.',
      idTransaksi: idTransaksi,
      saldoProjectSebelum: prevSaldoProject,
      saldoProjectSesudah: nextSaldoProject,
      saldoMetodeSesudah: metodeResult.newSaldo,
      metode: metode,
      projectName: foundProject.rowProject
    };
  } catch (err) {
    return { ok: false, message: 'Gagal menyimpan transaksi bendahara: ' + err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function manualCreateBendaharaFoldersForExistingUsers_() {
  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, total: 0, created: 0, failed: 0, details: [] };
  const values = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  const details = [];
  let created = 0, failed = 0;
  for (let i = 0; i < values.length; i++) {
    const row = values[i], r = i + 2;
    const idUser = String(row[CONFIG.USERS_COL.id - 1] || '').trim();
    const username = normalizeUsername_(row[CONFIG.USERS_COL.username - 1]);
    if (!idUser || !username) { failed++; details.push({ row: r, ok: false, message: 'id_user/username kosong.' }); continue; }
    try {
      const res = ensureBendaharaUserFolderById_(idUser);
      if (res.ok) { created++; details.push({ row: r, ok: true, idUser: idUser, username: username, folderName: res.folderName, folderUrl: res.folderUrl }); }
      else { failed++; details.push({ row: r, ok: false, idUser: idUser, username: username, message: res.message || 'Unknown error' }); }
    } catch (err) {
      failed++; details.push({ row: r, ok: false, idUser: idUser, username: username, message: String(err) });
    }
  }
  return { ok: true, total: values.length, created: created, failed: failed, details: details };
}

function manualCreateBendaharaTx4SheetsForExistingUsers_() {
  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, total: 0, created: 0, failed: 0, details: [] };

  const values = sh.getRange(2, 1, lastRow - 1, 9).getValues();
  const details = [];
  let created = 0, failed = 0;

  for (let i = 0; i < values.length; i++) {
    const r = i + 2;
    const idUser = String(values[i][CONFIG.USERS_COL.id - 1] || '').trim();
    const username = normalizeUsername_(values[i][CONFIG.USERS_COL.username - 1]);
    if (!idUser || !username) { failed++; details.push({ row: r, ok: false, message: 'id_user/username kosong.' }); continue; }

    try {
      const res = ensureBendaharaTx4SheetByUsername_(username);
      if (res.ok) { created++; details.push({ row: r, ok: true, idUser: idUser, username: username, sheetName: res.sheetName }); }
      else { failed++; details.push({ row: r, ok: false, idUser: idUser, username: username, message: res.message || 'Unknown error' }); }
    } catch (err) {
      failed++; details.push({ row: r, ok: false, idUser: idUser, username: username, message: String(err) });
    }
  }

  return { ok: true, total: values.length, created: created, failed: failed, details: details };
}

function manualSyncBendaharaProjectFoldersFromDataSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.BENDAHARA_SPREADSHEET_ID);
  const sh = ss.getSheetByName(CONFIG.BENDAHARA_DATA_SHEET_NAME || 'Data');
  if (!sh) throw new Error('Sheet Data bendahara tidak ditemukan.');
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: true, total: 0, createdUserFolder: 0, createdProjectFolder: 0, failed: 0, details: [] };
  const values = sh.getRange(2, 1, lastRow - 1, 2).getValues();
  let createdUserFolder = 0, createdProjectFolder = 0, failed = 0;
  const details = [];
  for (let i = 0; i < values.length; i++) {
    const rowNumber = i + 2;
    const idUser = String(values[i][CONFIG.BENDAHARA_DATA_COL.id_user - 1] || '').trim();
    const projectName = String(values[i][CONFIG.BENDAHARA_DATA_COL.project - 1] || '').trim();
    if (!idUser) { failed++; details.push({ row: rowNumber, ok: false, message: 'id_user kosong.' }); continue; }
    const userInfo = _getUserIdentityById_(idUser);
    if (!userInfo.ok) { failed++; details.push({ row: rowNumber, ok: false, idUser: idUser, message: userInfo.message || 'User tidak ditemukan.' }); continue; }
    try {
      const userFolderResult = ensureBendaharaUserFolderById_(idUser);
      if (userFolderResult.ok) createdUserFolder++;
      if (!projectName) { details.push({ row: rowNumber, ok: true, idUser: idUser, username: userInfo.username, message: 'Project kosong, hanya memastikan folder user.' }); continue; }
      const projectResult = ensureBendaharaProjectFolder_(idUser, userInfo.username, projectName);
      if (projectResult.ok) {
        createdProjectFolder++;
        details.push({ row: rowNumber, ok: true, idUser: idUser, username: userInfo.username, project: projectResult.project, userFolderUrl: projectResult.userFolderUrl, projectFolderUrl: projectResult.projectFolderUrl });
      } else {
        failed++;
        details.push({ row: rowNumber, ok: false, idUser: idUser, project: projectName, message: projectResult.message || 'Gagal create project folder' });
      }
    } catch (err) {
      failed++; details.push({ row: rowNumber, ok: false, idUser: idUser, project: projectName, message: String(err) });
    }
  }
  return { ok: true, total: values.length, createdUserFolder: createdUserFolder, createdProjectFolder: createdProjectFolder, failed: failed, details: details };
}

function manualCreateBendaharaFoldersForExistingUsers() {
  return manualCreateBendaharaFoldersForExistingUsers_();
}

function manualCreateBendaharaTx4SheetsForExistingUsers() {
  return manualCreateBendaharaTx4SheetsForExistingUsers_();
}

function manualSyncBendaharaProjectFoldersFromDataSheet() {
  return manualSyncBendaharaProjectFoldersFromDataSheet_();
}

function manualSetupBendaharaForExistingUsers() {
  return {
    ok: true,
    folders: manualCreateBendaharaFoldersForExistingUsers_(),
    tx4Sheets: manualCreateBendaharaTx4SheetsForExistingUsers_(),
    projects: manualSyncBendaharaProjectFoldersFromDataSheet_()
  };
}