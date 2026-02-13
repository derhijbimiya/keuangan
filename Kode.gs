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
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // logged-in routes
    if (page === '' || page === 'home' || page === 'dashboard' || page === 'transaksi') {
      // Ensure new sheets exist (TX1_, TX2_, TOT_) after spreadsheet restructure
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
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // unknown -> fallback dashboard
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
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
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