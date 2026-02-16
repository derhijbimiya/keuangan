// App2.gs
// Script Google Apps untuk fitur Keuangan 1


// Fungsi lama tidak dipakai dari HTML/Sidebar, karena getUi() error di context ini
// Fungsi baru untuk dipanggil dari google.script.run
function getApp2PageHtml() {
  return HtmlService.createHtmlOutputFromFile('App2page').getContent();

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