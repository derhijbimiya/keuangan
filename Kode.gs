function getAppUrl() {
  return ScriptApp.getService().getUrl();
}
/**
 * Code.gs (FIX blank/white page after login/logout) + URL helpers + apiGetAppUrl
 */
function doGet(e) {
  e = e || {};
  const params = e.parameter || {};
  const page = String(params.page || '').trim().toLowerCase();

  const username = getSessionUser_();

  try {
    if (!username) {
      const t = HtmlService.createTemplateFromFile('loginpage');
      t.appUrl = ScriptApp.getService().getUrl();
      return t.evaluate()
        .setTitle('Financial Applications V2')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no') // FIX: Kunci agar tidak kecil di HP
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // logged-in routes
    if (page === '' || page === 'home' || page === 'dashboard' || page === 'transaksi') {
      ensureUserTxSheet(username);
      const t = HtmlService.createTemplateFromFile('dashboardpage');
      t.initialData = {
        username: username,
        activePage: page || 'home',
        homeUrl: getHomeUrl(),
        transaksiUrl: getTransaksiUrl()
      };
      return t.evaluate()
        .setTitle('Dashboard')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } else if (page === 'app2') {
      // Keuangan 1 sebagai web app (pakai templating agar CSS ter-load)
      const t = HtmlService.createTemplateFromFile('App2page');
      return t.evaluate()
        .setTitle('Keuangan 1')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } else if (page === 'tentang') {
      // Tentang
      const html = HtmlService.createHtmlOutputFromFile('tentangpage')
        .setTitle('Tentang Aplikasi')
        .setWidth(420)
        .setHeight(600)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      return html;
    }

    // Default fallback: dashboard
    ensureUserTxSheet(username);
    const t = HtmlService.createTemplateFromFile('dashboardpage');
    t.initialData = {
      username: username,
      activePage: 'home',
      homeUrl: getHomeUrl(),
      transaksiUrl: getTransaksiUrl()
    };
    return t.evaluate()
      .setTitle('Dashboard')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput(
      `<h3>Render error</h3><pre>${String(err)}</pre>`
    ).setTitle('Error');
  }
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function getTransaksiUrl() {
  return ScriptApp.getService().getUrl() + '?page=transaksi';
}

function getHomeUrl() {
  return ScriptApp.getService().getUrl();
}

function apiGetAppUrl() {
  return { ok: true, url: ScriptApp.getService().getUrl() };
}
