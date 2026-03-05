/**
 * Auth.gs (ONLY relevant parts shown as full file in your project)
 * - Update: apiAvatarPresetList() uses listAvatarPresets_() which now normalizes URLs
 * - Upload photo folder stays the same (folderId you provided)
 *
 * NEW:
 * - apiProfileGet(): load data profil (nama, email, fotoUrl, theme)
 * - apiProfileUpdate(payload): update nama, email, fotoUrl, theme
 * - apiProfileChangePassword(payload): ganti password (oldPassword wajib)
 * - Session expiry: Tanpa remember me = 2 jam (sessionStorage), Dengan remember me = 7 hari (localStorage)
 * - Hybrid session: Server + client token untuk per-device security
 */

// Session expiry configuration
const AUTH_CONFIG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.AUTH) || {};
const ID_GENERATOR_CONFIG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.ID_GENERATOR) || {};

const SESSION_SHORT_HOURS = Number(AUTH_CONFIG.SESSION_SHORT_HOURS || 2);  // Tanpa remember me: 2 jam
const SESSION_LONG_DAYS = Number(AUTH_CONFIG.SESSION_LONG_DAYS || 7);       // Dengan remember me: 7 hari
const SESSION_CACHE_MAX_SECONDS = Number(AUTH_CONFIG.SESSION_CACHE_MAX_SECONDS || 21600);
const AUTH_OTP_TTL_SECONDS = Number(AUTH_CONFIG.OTP_TTL_SECONDS || (10 * 60));
const AUTH_OTP_DIGITS = Number(AUTH_CONFIG.OTP_DIGITS || 6);
const AUTH_OTP_ALLOWED_PURPOSES = Array.isArray(AUTH_CONFIG.OTP_ALLOWED_PURPOSES)
  ? AUTH_CONFIG.OTP_ALLOWED_PURPOSES.map(p => String(p || '').trim().toLowerCase()).filter(Boolean)
  : ['signup', 'reset'];
const AUTH_PASSWORD_MIN_LENGTH = Number(AUTH_CONFIG.PASSWORD_MIN_LENGTH || 4);
const AUTH_PROFILE_PHOTO_ALLOWED_MIME_TYPES = Array.isArray(AUTH_CONFIG.PROFILE_PHOTO_ALLOWED_MIME_TYPES)
  ? AUTH_CONFIG.PROFILE_PHOTO_ALLOWED_MIME_TYPES
  : ['image/png', 'image/jpeg', 'image/webp'];
const AUTH_PROFILE_PHOTO_MAX_BYTES = Number(AUTH_CONFIG.PROFILE_PHOTO_MAX_BYTES || (1.5 * 1024 * 1024));

function generateSessionToken_() {
  // Generate random session token (32 chars)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token + '_' + Date.now();
}

function getGoogleUserEmail_() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || 'anonymous';
  } catch (e) {
    return 'anonymous';
  }
}

function getSessionKey_(suffix) {
  const googleEmail = getGoogleUserEmail_();
  return 'session_' + googleEmail + '_' + suffix;
}

function getSessionUser_(sessionToken) {
  const googleEmail = getGoogleUserEmail_();
  if (googleEmail === 'anonymous') return '';
  
  const cache = CacheService.getUserCache();
  const scriptProps = PropertiesService.getScriptProperties();
  
  // Try cache first (for short sessions)
  let sessionData = cache.get(getSessionKey_('data'));
  
  // If not in cache, try ScriptProperties (for remember me)
  if (!sessionData) {
    sessionData = scriptProps.getProperty(getSessionKey_('data'));
  }
  
  if (!sessionData) return '';
  
  try {
    const data = JSON.parse(sessionData);
    const username = data.username || '';
    const storedToken = data.token || '';
    const expiryTime = Number(data.expiry || 0);
    
    if (!username) return '';
    
    // Verify session token matches (per-device validation)
    if (sessionToken && storedToken && sessionToken !== storedToken) {
      // Token mismatch - different device or session replaced
      return '';
    }
    
    // Check session expiry
    const now = Date.now();
    if (now > expiryTime) {
      // Session expired - auto logout
      cache.remove(getSessionKey_('data'));
      scriptProps.deleteProperty(getSessionKey_('data'));
      return '';
    }
    
    return String(username);
  } catch (e) {
    return '';
  }
}

// Helper: Extract sessionToken from payload and get username
function getSessionFromPayload_(payload) {
  const sessionToken = payload && payload.sessionToken ? String(payload.sessionToken) : '';
  return getSessionUser_(sessionToken);
}

function apiLogout() {
  const googleEmail = getGoogleUserEmail_();
  if (googleEmail === 'anonymous') return { ok: true };
  
  const cache = CacheService.getUserCache();
  const scriptProps = PropertiesService.getScriptProperties();
  
  cache.remove(getSessionKey_('data'));
  scriptProps.deleteProperty(getSessionKey_('data'));
  
  return { ok: true };
}

function apiLogin(username, password, rememberMe) {
  username = normalizeUsername_(username);
  password = String(password || '');
  rememberMe = Boolean(rememberMe);

  if (!username || !password) return { ok: false, message: 'Username & password wajib diisi.' };

  const found = findUserRowByUsername_(username);
  if (!found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };

  const row = found.row;
  const status = String(row[CONFIG.USERS_COL.status - 1] || '').toUpperCase();
  if (status && status !== 'ACTIVE') return { ok: false, message: 'User non-aktif.' };

  const storedHash = String(row[CONFIG.USERS_COL.password_hash - 1] || '');
  if (!storedHash) return { ok: false, message: 'Password user belum di-set.' };

  if (sha256_(password) !== storedHash) return { ok: false, message: 'Password salah.' };

  const googleEmail = getGoogleUserEmail_();
  if (googleEmail === 'anonymous') {
    return { ok: false, message: 'Tidak bisa mendapatkan Google Account info.' };
  }

  // Generate unique session token untuk device ini
  const sessionToken = generateSessionToken_();
  
  // Calculate session expiry
  const now = Date.now();
  let expiryTime;
  let expirySeconds;
  
  if (rememberMe) {
    // Remember me: 7 hari
    expiryTime = now + (SESSION_LONG_DAYS * 24 * 60 * 60 * 1000);
    expirySeconds = SESSION_LONG_DAYS * 24 * 60 * 60;
  } else {
    // Tanpa remember me: 2 jam (max 6 jam untuk Cache)
    expiryTime = now + (SESSION_SHORT_HOURS * 60 * 60 * 1000);
    expirySeconds = SESSION_SHORT_HOURS * 60 * 60;
  }

  const sessionData = JSON.stringify({
    username: username,
    token: sessionToken,
    expiry: expiryTime,
    loginAt: nowIso_()
  });

  const cache = CacheService.getUserCache();
  const scriptProps = PropertiesService.getScriptProperties();
  
  if (rememberMe) {
    // Remember me: Save to ScriptProperties (persistent)
    scriptProps.setProperty(getSessionKey_('data'), sessionData);
  } else {
    // No remember me: Save to Cache only (max 6 hours)
    cache.put(getSessionKey_('data'), sessionData, Math.min(expirySeconds, SESSION_CACHE_MAX_SECONDS));
  }

  ensureUserTxSheet(username);

  return { 
    ok: true, 
    username, 
    sessionToken: sessionToken,
    rememberMe: rememberMe,
    googleEmail: googleEmail,
    sessionExpiry: new Date(expiryTime).toISOString() 
  };
}

/**********************
 * OTP
 **********************/

function normalizeEmail_(email) { return String(email || '').trim().toLowerCase(); }
function normalizePurpose_(purpose) { return String(purpose || '').trim().toLowerCase(); }
function generateOtp_() {
  const digits = Math.max(4, Math.floor(AUTH_OTP_DIGITS));
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

function otpCacheKey_(purpose, email) {
  return `otp:${normalizePurpose_(purpose)}:${normalizeEmail_(email)}`;
}
function otpFallbackKey_(purpose, email) {
  return `otp_fallback:${normalizePurpose_(purpose)}:${normalizeEmail_(email)}`;
}
function otpFallbackPut_(purpose, email, otp) {
  const expMs = Date.now() + (AUTH_OTP_TTL_SECONDS * 1000);
  PropertiesService.getScriptProperties().setProperty(
    otpFallbackKey_(purpose, email),
    JSON.stringify({ otp: String(otp), expMs })
  );
}
function otpFallbackGet_(purpose, email) {
  const raw = PropertiesService.getScriptProperties().getProperty(otpFallbackKey_(purpose, email));
  if (!raw) return { ok: false };
  let data = null;
  try { data = JSON.parse(raw); } catch(e) { data = null; }
  if (!data || !data.otp || !data.expMs) return { ok: false };
  if (Date.now() > Number(data.expMs)) return { ok: false };
  return { ok: true, otp: String(data.otp) };
}
function otpFallbackRemove_(purpose, email) {
  PropertiesService.getScriptProperties().deleteProperty(otpFallbackKey_(purpose, email));
}

function apiSendOtp(purpose, email) {
  purpose = normalizePurpose_(purpose);
  email = normalizeEmail_(email);

  if (!AUTH_OTP_ALLOWED_PURPOSES.includes(purpose)) return { ok: false, message: 'Purpose tidak valid.' };
  if (!isValidEmail_(email)) return { ok: false, message: 'Email tidak valid.' };

  const existing = findUserRowByEmail_(email);
  if (purpose === 'signup' && existing.rowIndex) return { ok: false, message: 'Email sudah terdaftar. Silakan login.' };
  if (purpose === 'reset' && !existing.rowIndex) return { ok: false, message: 'Email belum terdaftar.' };

  const otp = generateOtp_();
  CacheService.getScriptCache().put(otpCacheKey_(purpose, email), otp, AUTH_OTP_TTL_SECONDS);
  otpFallbackPut_(purpose, email, otp);

  const subject = purpose === 'signup'
    ? 'Kode Verifikasi Daftar - Monitoring Keuangan'
    : 'Kode Verifikasi Reset Password - Monitoring Keuangan';

  const body =
`Kode verifikasi kamu: ${otp}

Berlaku selama ${Math.floor(AUTH_OTP_TTL_SECONDS / 60)} menit.
Jika kamu tidak merasa meminta kode ini, abaikan email ini.`;

  MailApp.sendEmail(email, subject, body);
  return { ok: true, message: 'Kode verifikasi telah dikirim ke email.' };
}

function verifyOtp_(purpose, email, otpInput) {
  purpose = normalizePurpose_(purpose);
  email = normalizeEmail_(email);
  otpInput = String(otpInput || '').trim();

  const cache = CacheService.getScriptCache();
  const key = otpCacheKey_(purpose, email);
  const stored = cache.get(key);

  if (stored) {
    if (String(stored) !== otpInput) return { ok: false, message: 'Kode OTP salah.' };
    cache.remove(key);
    otpFallbackRemove_(purpose, email);
    return { ok: true };
  }

  const fb = otpFallbackGet_(purpose, email);
  if (!fb.ok) return { ok: false, message: 'Kode OTP tidak ditemukan / sudah kadaluarsa.' };
  if (String(fb.otp) !== otpInput) return { ok: false, message: 'Kode OTP salah.' };

  otpFallbackRemove_(purpose, email);
  return { ok: true };
}

/**********************
 * Preset avatar list API
 **********************/
function apiAvatarPresetList() {
  return { ok: true, presets: listAvatarPresets_() };
}

/**********************
 * Upload Foto -> Drive Folder tertentu
 **********************/
const AUTH_PROFILE_PHOTO_FOLDER_ID = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.STORAGE && APP_CONFIG.STORAGE.PROFILE_PHOTO_FOLDER_ID) || '';

function apiUploadProfilePhoto(payload) {
  try {
    const filenameIn = String(payload?.filename || '').trim();
    const mimeType = String(payload?.mimeType || '').trim();
    const base64 = String(payload?.base64 || '');
    if (!base64) return { ok: false, message: 'File foto kosong.' };

    const finalMime = AUTH_PROFILE_PHOTO_ALLOWED_MIME_TYPES.includes(mimeType) ? mimeType : 'image/png';

    const ext =
      finalMime === 'image/jpeg' ? 'jpg' :
      finalMime === 'image/webp' ? 'webp' : 'png';

    const prefixProfilePhoto = String(ID_GENERATOR_CONFIG.PREFIX_PROFILE_PHOTO || 'P');
    const safeName = filenameIn || (`profile_${newId_(prefixProfilePhoto)}.${ext}`);

    const bytes = Utilities.base64Decode(base64);
    if (bytes.length > AUTH_PROFILE_PHOTO_MAX_BYTES) {
      return { ok: false, message: 'Ukuran foto terlalu besar.' };
    }
    const blob = Utilities.newBlob(bytes, finalMime, safeName);

    if (!AUTH_PROFILE_PHOTO_FOLDER_ID) {
      return { ok: false, message: 'Konfigurasi PROFILE_PHOTO_FOLDER_ID belum diisi di Konfigurasi.gs.' };
    }

    const folder = DriveApp.getFolderById(AUTH_PROFILE_PHOTO_FOLDER_ID);
    const file = folder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const directViewTemplate = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.URL && APP_CONFIG.URL.DRIVE_DIRECT_VIEW_URL_TEMPLATE) || 'https://drive.google.com/uc?export=view&id={id}';
    const urlDirect = directViewTemplate.replace('{id}', fileId);

    return { ok: true, fileId, url: urlDirect };
  } catch (err) {
    return { ok: false, message: 'Gagal upload foto: ' + err };
  }
}

/**********************
 * SIGNUP / RESET (unchanged)
 **********************/
function apiSignup(payload) {
  const username = normalizeUsername_(payload?.username);
  const nama = String(payload?.nama || '').trim();
  const email = normalizeEmail_(payload?.email);
  const otp = String(payload?.otp || '').trim();
  const password = String(payload?.password || '');
  const theme = themeNormalizeKey_(payload?.theme);
  const fotoUrl = String(payload?.fotoUrl || '').trim();

  if (!username) return { ok: false, message: 'Username wajib diisi.' };
  if (!nama) return { ok: false, message: 'Nama wajib diisi.' };
  if (!isValidEmail_(email)) return { ok: false, message: 'Email tidak valid.' };
  if (password.length < AUTH_PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password minimal ${AUTH_PASSWORD_MIN_LENGTH} karakter.` };
  }

  const otpRes = verifyOtp_('signup', email, otp);
  if (!otpRes.ok) return otpRes;

  if (findUserRowByUsername_(username).rowIndex) return { ok: false, message: 'Username sudah dipakai.' };
  if (findUserRowByEmail_(email).rowIndex) return { ok: false, message: 'Email sudah terdaftar.' };

  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  const id = newId_('U');

  const row = [];
  row[CONFIG.USERS_COL.id - 1] = id;
  row[CONFIG.USERS_COL.username - 1] = username;
  row[CONFIG.USERS_COL.nama - 1] = nama;
  row[CONFIG.USERS_COL.email - 1] = email;
  row[CONFIG.USERS_COL.password_hash - 1] = sha256_(password);
  row[CONFIG.USERS_COL.role - 1] = 'USER';
  row[CONFIG.USERS_COL.status - 1] = 'ACTIVE';
  row[CONFIG.USERS_COL.foto - 1] = fotoUrl;
  row[CONFIG.USERS_COL.theme - 1] = theme;

  sh.appendRow(row);
  ensureUserTxSheet(username);

  try {
    ensureBendaharaUserFolderByUsername_(username);
  } catch (err) {
    Logger.log('[apiSignup] Gagal auto-create folder bendahara untuk user baru: ' + err);
  }

  try {
    ensureBendaharaTx4SheetByUsername_(username);
  } catch (err) {
    Logger.log('[apiSignup] Gagal auto-create sheet TX4 bendahara untuk user baru: ' + err);
  }

  return { ok: true, message: 'Akun berhasil dibuat. Silakan login.' };
}

function apiResetPassword(payload) {
  const email = normalizeEmail_(payload?.email);
  const otp = String(payload?.otp || '').trim();
  const newPassword = String(payload?.newPassword || '');

  if (!isValidEmail_(email)) return { ok: false, message: 'Email tidak valid.' };
  if (newPassword.length < AUTH_PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password baru minimal ${AUTH_PASSWORD_MIN_LENGTH} karakter.` };
  }

  const otpRes = verifyOtp_('reset', email, otp);
  if (!otpRes.ok) return otpRes;

  const found = findUserRowByEmail_(email);
  if (!found.rowIndex) return { ok: false, message: 'Email tidak terdaftar.' };

  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  sh.getRange(found.rowIndex, CONFIG.USERS_COL.password_hash).setValue(sha256_(newPassword));

  return { ok: true, message: 'Password berhasil diubah. Silakan login.' };
}

/**********************
 * PROFILE (NEW)
 **********************/
function apiProfileGet() {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const found = findUserRowByUsername_(normalizeUsername_(username));
  if (!found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };

  const row = found.row;

  const nama = String(row[CONFIG.USERS_COL.nama - 1] || '').trim();
  const email = String(row[CONFIG.USERS_COL.email - 1] || '').trim();
  const fotoUrl = String(row[CONFIG.USERS_COL.foto - 1] || '').trim();
  const themeKey = String(row[CONFIG.USERS_COL.theme - 1] || '').trim();

  return {
    ok: true,
    username: username,
    nama: nama,
    email: email,
    fotoUrl: fotoUrl ? driveToDirectViewUrl_(fotoUrl) : '',
    themeKey: themeNormalizeKey_(themeKey)
  };
}

function apiProfileUpdate(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const found = findUserRowByUsername_(normalizeUsername_(username));
  if (!found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };

  let fotoUrl = String(payload?.fotoUrl || '').trim();
  // Jika hanya update foto (dari simpan foto), langsung update kolom foto saja
  if (fotoUrl && !payload?.nama && !payload?.email && !payload?.themeKey) {
    const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
    sh.getRange(found.rowIndex, CONFIG.USERS_COL.foto).setValue(fotoUrl);
    return {
      ok: true,
      message: 'Foto profil berhasil diupdate.',
      profile: { username, fotoUrl }
    };
  }
  // Mode update profil lengkap (nama/email/theme/foto)
  const nama = String(payload?.nama || '').trim();
  const email = normalizeEmail_(payload?.email);
  const themeKey = themeNormalizeKey_(payload?.themeKey);
  if (!nama) return { ok: false, message: 'Nama wajib diisi.' };
  if (!isValidEmail_(email)) return { ok: false, message: 'Email tidak valid.' };
  // email uniqueness (boleh sama dengan email milik user sendiri)
  const emailFound = findUserRowByEmail_(email);
  if (emailFound.rowIndex && emailFound.rowIndex !== found.rowIndex) {
    return { ok: false, message: 'Email sudah dipakai user lain.' };
  }
  // Ambil foto lama jika payload.fotoUrl kosong
  if (!fotoUrl) {
    fotoUrl = String(found.row[CONFIG.USERS_COL.foto - 1] || '').trim();
  }
  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  sh.getRange(found.rowIndex, CONFIG.USERS_COL.nama).setValue(nama);
  sh.getRange(found.rowIndex, CONFIG.USERS_COL.email).setValue(email);
  sh.getRange(found.rowIndex, CONFIG.USERS_COL.foto).setValue(fotoUrl);
  sh.getRange(found.rowIndex, CONFIG.USERS_COL.theme).setValue(themeKey);
  return {
    ok: true,
    message: 'Profil berhasil disimpan.',
    profile: { username, nama, email, fotoUrl, themeKey }
  };
}

function apiProfileChangePassword(payload) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const found = findUserRowByUsername_(normalizeUsername_(username));
  if (!found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };

  const oldPassword = String(payload?.oldPassword || '');
  const newPassword = String(payload?.newPassword || '');
  const newPassword2 = String(payload?.newPassword2 || '');

  if (!oldPassword) return { ok: false, message: 'Password lama wajib diisi.' };
  if (newPassword.length < AUTH_PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password baru minimal ${AUTH_PASSWORD_MIN_LENGTH} karakter.` };
  }
  if (newPassword !== newPassword2) return { ok: false, message: 'Confirm password tidak sama.' };

  const storedHash = String(found.row[CONFIG.USERS_COL.password_hash - 1] || '');
  if (!storedHash) return { ok: false, message: 'Password user belum di-set.' };

  if (sha256_(oldPassword) !== storedHash) return { ok: false, message: 'Password lama salah.' };

  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  sh.getRange(found.rowIndex, CONFIG.USERS_COL.password_hash).setValue(sha256_(newPassword));

  return { ok: true, message: 'Password berhasil diubah.' };
}