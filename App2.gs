// App2.gs
// Script Google Apps untuk fitur Keuangan 1


// Fungsi lama tidak dipakai dari HTML/Sidebar, karena getUi() error di context ini
// Fungsi baru untuk dipanggil dari google.script.run
function getApp2PageHtml() {
  return HtmlService.createHtmlOutputFromFile('App2page').getContent();
}

// Tambahkan fungsi lain untuk fitur Keuangan 1 di sini nanti.