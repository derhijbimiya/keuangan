const CONFIG = {
  USERS_SHEET: "Users",
  SESSION_KEY: "USER_SESSION"
};

function hashPassword(password) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function checkLogin(usernameOrEmail, password) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.USERS_SHEET);
    if (!sh) return { status: false };
    
    const data = sh.getDataRange().getValues();
    const hash = hashPassword(password);

    for (let i = 1; i < data.length; i++) {
      if ((data[i][1] === usernameOrEmail || data[i][2] === usernameOrEmail) && data[i][3] === hash) {
        return { status: true, username: data[i][1], email: data[i][2] };
      }
    }
    return { status: false };
  } catch (err) {
    return { status: false };
  }
}

function doLogin(username, password) {
  const res = checkLogin(username, password);
  if (res.status) { 
    setSession(res);
    res.url = ScriptApp.getService().getUrl() + "?page=home";
  } else {
    res.url = "";
  }
  return res;
}

function setSession(user) {
  const sessionData = {
    username: user.username,
    email: user.email,
    timestamp: new Date().getTime()
  };
  PropertiesService.getUserProperties().setProperty(CONFIG.SESSION_KEY, JSON.stringify(sessionData));
}

function getSession() {
  const data = PropertiesService.getUserProperties().getProperty(CONFIG.SESSION_KEY);
  if (!data) return null;
  try {
    const session = JSON.parse(data);
    const now = new Date().getTime();
    const SESSION_TIMEOUT = 5 * 60 * 1000;
    
    if (now - session.timestamp > SESSION_TIMEOUT) {
      PropertiesService.getUserProperties().deleteProperty(CONFIG.SESSION_KEY);
      return null;
    }
    
    return session;
  } catch (e) {
    return null;
  }
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty(CONFIG.SESSION_KEY);
  return { status: true, url: ScriptApp.getService().getUrl() };
}

function doGet(e) {
  const user = getSession();
  
  if (!user) {
    return HtmlService.createTemplateFromFile("LoginPage")
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : "home";

  if (page === "home") {
    return HtmlService.createTemplateFromFile("HomePage")
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (page === "transaksi") {
    return HtmlService.createTemplateFromFile("TransaksiPage")
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createTemplateFromFile("HomePage")
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getDashboardData() {
  const user = getSession();
  if (!user) return null;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shRekap = ss.getSheetByName("Rekap");
    const shUangSaya = ss.getSheetByName("Uang Saya");
    const shUangBendahara = ss.getSheetByName("Uang Bendahara");

    if (!shRekap) return null;

    let uangSayaPengeluaran = "0", uangSayaPemasukan = "0";
    let uangBendaharaPengeluaran = "0", uangBendaharaPemasukan = "0";

    if (shUangSaya) {
      uangSayaPengeluaran = shUangSaya.getRange("I16").getDisplayValue() || "0";
      uangSayaPemasukan = shUangSaya.getRange("I24").getDisplayValue() || "0";
    }

    if (shUangBendahara) {
      uangBendaharaPengeluaran = shUangBendahara.getRange("I15").getDisplayValue() || "0";
      uangBendaharaPemasukan = shUangBendahara.getRange("I23").getDisplayValue() || "0";
    }

    const result = {
      user: user.username,
      uangDiRekening: shRekap.getRange("D2").getDisplayValue() || "0",
      saya: shRekap.getRange("A12").getDisplayValue() || "0",
      bendahara: shRekap.getRange("E12").getDisplayValue() || "0",
      admin: shRekap.getRange("D17").getDisplayValue() || "0",
      uangSayaPengeluaran: uangSayaPengeluaran,
      uangSayaPemasukan: uangSayaPemasukan,
      uangBendaharaPengeluaran: uangBendaharaPengeluaran,
      uangBendaharaPemasukan: uangBendaharaPemasukan
    };

    return result;
  } catch (e) {
    Logger.log("ERROR getDashboardData: " + e);
    return null;
  }
}

function getUangSayaHistory() { return getGenericHistory("Uang Saya", 3, "normal"); }
function getUangBendaharaHistory() { return getGenericHistory("Uang Bendahara", 3, "normal"); }
function getUangAdminHistory() { return getGenericHistory("Uang Admin", 2, "admin"); }

function getGenericHistory(sheetName, startRow, type) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return [];

    const lastRow = sh.getLastRow();
    if (lastRow < startRow) return [];

    const data = sh.getRange(startRow, 1, (lastRow - startRow + 1), 7).getDisplayValues();
    
    return data.map(row => {
      if (type === "admin") {
        return { no: row[0], tanggal: row[1], deskripsi: row[2], struck: row[3], potongan: row[4], keterangan: row[5], saldo: row[6] };
      } else {
        return { no: row[0], tanggal: row[1], keterangan: row[2], struck: row[3], pemasukan: row[4], pengeluaran: row[5], saldo: row[6] };
      }
    }).filter(item => item.tanggal !== "");
  } catch (err) {
    Logger.log("Error di " + sheetName + ": " + err);
    return [];
  }
}

function saveTransaction(data) {
  const user = getSession();
  if (!user) return { status: false, msg: "Session habis" };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(data.sheet);
    if (!sh) return { status: false, msg: "Sheet tidak ditemukan" };

    const lastRow = sh.getLastRow();
    let saldoSebelumnya = 0;

    if (lastRow >= 3) {
      const saldoCell = sh.getRange(lastRow, 7).getValue();
      saldoSebelumnya = parseFloat(saldoCell) || 0;
    } else {
      const g2Value = sh.getRange("G2").getValue();
      saldoSebelumnya = parseFloat(g2Value) || 0;
    }

    const masuk = parseFloat(data.masuk) || 0;
    const keluar = parseFloat(data.keluar) || 0;
    const saldoBaru = saldoSebelumnya + masuk - keluar;

    const row = lastRow + 1;
    sh.appendRow([
      row - 2,
      data.tgl,
      data.ket,
      "",
      masuk,
      keluar,
      saldoBaru
    ]);

    if (lastRow < 3) {
      sh.getRange("G2").setValue(saldoBaru);
    }

    return { status: true, msg: "Data berhasil disimpan", row: row, saldoBaru: saldoBaru };
  } catch (e) {
    return { status: false, msg: "Error: " + e.toString() };
  }
}

function getMasterFolderId() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Rekap");
    if (!sh) return null;
    
    const folderId = sh.getRange("O2").getValue();
    if (!folderId || folderId.toString().trim() === "") return null;
    
    return folderId.toString().trim();
  } catch (err) {
    Logger.log("Error getting folder ID: " + err);
    return null;
  }
}

function handleUploadByRow(fileData, prefix, sheetName, rowNum, option) {
  try {
    if (!fileData || fileData.length === 0) throw new Error("Tidak ada file untuk diupload.");
    
    const MASTER_FOLDER_ID = getMasterFolderId();
    if (!MASTER_FOLDER_ID) throw new Error("Folder ID tidak ditemukan di sheet Rekap cell O2");
    
    const folder = DriveApp.getFolderById(MASTER_FOLDER_ID);
    let fileUrl = "";
    
    if (fileData.length === 1) {
      const f = fileData[0];
      const finalName = (prefix || "Struk") + "_" + getTimestamp() + getFileExt(f.name);
      const blob = Utilities.newBlob(Utilities.base64Decode(f.data), f.type, f.name);
      const file = folder.createFile(blob).setName(finalName);
      fileUrl = file.getUrl();
    } else {
      const folderName = (prefix || "Struk") + "_" + getTimestamp();
      const newFolder = folder.createFolder(folderName);
      for (let i = 0; i < fileData.length; i++) {
        const file = fileData[i];
        const finalName = file.name.replace(/\.[^/.]+$/, "") + "_" + getTimestamp() + getFileExt(file.name);
        const blob = Utilities.newBlob(Utilities.base64Decode(file.data), file.type, file.name);
        newFolder.createFile(blob).setName(finalName);
      }
      fileUrl = newFolder.getUrl();
    }

    if (fileUrl && rowNum) {
      saveStrukToSheet(sheetName, rowNum, fileUrl);
    }

    return { status: true, msg: "Struk berhasil diupload", url: fileUrl };
  } catch (err) {
    return { status: false, msg: "Error upload: " + err.message };
  }
}

function saveStrukToSheet(sheetName, rowNum, fileUrl) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;

    const cellRef = sh.getRange(rowNum, 4);
    const formula = `"${fileUrl}"`;
    cellRef.setFormula(formula);
  } catch (err) {
    Logger.log("Error saving struk link: " + err);
  }
}

function getFileExt(filename) {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.substring(lastDot);
}

function getTimestamp() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
}

function getProfileData() {
  const user = getSession();
  if (!user) return {};
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!sh) return {};
  
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === user.username) {
      return { username: data[i][1], email: data[i][2] };
    }
  }
  return {};
}

function updateProfile(profile) {
  const user = getSession();
  if (!user) return { status: false, msg: 'Session habis' };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (!sh) return { status: false, msg: 'Sheet Users tidak ditemukan' };
  
  const data = sh.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === user.username) {
      try {
        if (profile.username && profile.username.trim() !== "") {
          sh.getRange(i + 1, 2).setValue(profile.username);
        }
        
        if (profile.email && profile.email.trim() !== "") {
          sh.getRange(i + 1, 3).setValue(profile.email);
        }
        
        if (profile.password && profile.password.trim() !== "") {
          sh.getRange(i + 1, 4).setValue(hashPassword(profile.password));
        }
        
        setSession({
          username: profile.username || data[i][1],
          email: profile.email || data[i][2]
        });
        
        return { status: true, msg: 'Profil berhasil diupdate' };
      } catch (e) {
        return { status: false, msg: 'Error: ' + e.toString() };
      }
    }
  }
  
  return { status: false, msg: 'User tidak ditemukan' };
}

function deleteDriveItemByUrl_(url) {
  try {
    if (!url || url === "-" || url.toString().trim() === "") return;

    const idMatch = url.toString().match(/[-\w]{25,}/);
    if (!idMatch) return;

    const id = idMatch[0];

    try {
      DriveApp.getFileById(id).setTrashed(true);
      return;
    } catch (e) {}

    try {
      DriveApp.getFolderById(id).setTrashed(true);
      return;
    } catch (e) {}

  } catch (err) {
    Logger.log("deleteDriveItemByUrl_ error: " + err);
  }
}

function deleteTransactionRow_(sh, actualRow) {
  const lastRow = sh.getLastRow();

  const struckUrl = sh.getRange(actualRow, 4).getDisplayValue(); // kolom D
  if (struckUrl && struckUrl !== "-" && struckUrl.toString().trim() !== "") {
    deleteDriveItemByUrl_(struckUrl);
  }

  if (actualRow < lastRow) {
    const sourceRange = sh.getRange(actualRow + 1, 1, lastRow - actualRow, 7); // A:G dari bawahnya
    const sourceValues = sourceRange.getValues();

    const targetRange = sh.getRange(actualRow, 1, lastRow - actualRow, 7); // tempel mulai baris yang dihapus
    targetRange.setValues(sourceValues);
  }

  sh.getRange(lastRow, 1, 1, 7).clearContent();
}

function recalcSaldoAndNo_(sh) {
  const newLastRow = sh.getLastRow();
  const colA = sh.getRange(1, 1, newLastRow, 1).getValues().flat();
  let effectiveLastRow = 0;
  for (let r = colA.length - 1; r >= 0; r--) {
    if (colA[r] !== "" && colA[r] !== null) {
      effectiveLastRow = r + 1;
      break;
    }
  }

  if (effectiveLastRow >= 3) {
    const range = sh.getRange(3, 1, effectiveLastRow - 2, 7);
    const values = range.getValues();

    let saldoSebelumnya = parseFloat(sh.getRange("G2").getValue()) || 0;

    const saldoValues = [];
    for (let i = 0; i < values.length; i++) {
      const masuk = parseFloat(values[i][4]) || 0;  // Kolom E
      const keluar = parseFloat(values[i][5]) || 0; // Kolom F
      const saldoBaru = saldoSebelumnya + masuk - keluar;

      saldoValues.push([saldoBaru]);
      saldoSebelumnya = saldoBaru;
    }

    sh.getRange(3, 7, saldoValues.length, 1).setValues(saldoValues);
    sh.getRange("G2").setValue(saldoSebelumnya);

    const noValues = [];
    for (let i = 1; i <= effectiveLastRow - 2; i++) {
      noValues.push([i]);
    }
    sh.getRange(3, 1, noValues.length, 1).setValues(noValues);
  } else {
    sh.getRange("G2").setValue(0);
  }

  return effectiveLastRow;
}

/**
 * ✅ Hapus beberapa transaksi sekaligus (berdasarkan "no" yang tampil di tabel)
 * rowNumbers: array of string/number, contoh: [1,2,5]
 */
function deleteTransactionRows(sheetName, rowNumbers) {
  const user = getSession();
  if (!user) return { status: false, msg: "Session habis" };

  try {
    if (!rowNumbers || !Array.isArray(rowNumbers) || rowNumbers.length === 0) {
      return { status: false, msg: "Tidak ada data yang dipilih" };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return { status: false, msg: "Sheet tidak ditemukan" };

    const lastRow = sh.getLastRow();

    const unique = Array.from(new Set(rowNumbers.map(n => parseInt(n, 10)).filter(n => !isNaN(n))));
    unique.sort((a, b) => b - a); // descending supaya shift-up tidak mengacaukan index bawah

    let deleted = 0;
    const failed = [];

    for (let i = 0; i < unique.length; i++) {
      const rowNo = unique[i];
      const actualRow = rowNo + 2; // data mulai baris 3

      if (actualRow < 3 || actualRow > lastRow) {
        failed.push(rowNo);
        continue;
      }

      try {
        deleteTransactionRow_(sh, actualRow);
        deleted++;
      } catch (e) {
        failed.push(rowNo);
      }
    }

    recalcSaldoAndNo_(sh);

    if (deleted === 0) {
      return { status: false, msg: "Tidak ada data yang berhasil dihapus", deleted: 0, failed: failed };
    }

    if (failed.length > 0) {
      return { status: true, msg: "Sebagian data berhasil dihapus", deleted: deleted, failed: failed };
    }

    return { status: true, msg: "✅ Data berhasil dihapus!", deleted: deleted, failed: [] };
  } catch (e) {
    Logger.log("Error deleteTransactionRows: " + e.toString());
    return { status: false, msg: "Error: " + e.toString() };
  }
}

/**
 * Backward compatibility: hapus satu baris tetap jalan
 */
function deleteTransactionRow(sheetName, rowNumber) {
  return deleteTransactionRows(sheetName, [rowNumber]);
}

function debugSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  Logger.log("=== DAFTAR SHEET ===");
  sheets.forEach(sheet => {
    Logger.log("Sheet: " + sheet.getName() + " | Last Row: " + sheet.getLastRow());
  });
}

function clearSessionOnPageLoad() {
  return true;
}

function getTransaksiUrl() {
  return ScriptApp.getService().getUrl() + "?page=transaksi";
}

function getHomeUrl() {
  return ScriptApp.getService().getUrl();
}

function getDriveFolderUrl() {
  const user = getSession();
  if (!user) return "";

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName("Rekap");
    if (!sh) return "";

    const folderUrl = sh.getRange("O3").getDisplayValue();
    return folderUrl ? folderUrl.toString().trim() : "";
  } catch (e) {
    Logger.log("Error getDriveFolderUrl: " + e);
    return "";
  }
}