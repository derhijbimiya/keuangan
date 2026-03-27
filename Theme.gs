/**
 * Theme.gs
 * - Theme acak di login
 * - Theme default user tersimpan di Users!I
 * - Dashboard bisa ganti theme & tersimpan permanen
 *
 * UPDATED v2:
 * - 3 tema baru: Cyber Pink, Dark Red Japan, Dark Blue Modern
 * - Variabel CSS lebih lengkap: --bg-main, --bg-card, --accent, --accent-soft, dll
 * - Backward compatibility untuk variabel lama (--bg, --card, --primary, dll)
 * - apiThemeList() mengembalikan css + description untuk setiap tema
 */

const THEME_DEFAULT_KEY = 'dark-blue-modern';

const THEME_REGISTRY = Object.freeze({
  'cyber-pink': {
  },
  'neon-tokyo-night': {
  },
  'emerald-forest': {
  },
  'inferno-gold': {
  },
  'sakura-moonlight': {
    name: 'Sakura Moonlight',
    description: 'Soft pink japan / moonlight',
    vars: {
      bgMain: '#0c070a',
      bgCard: '#180f14',
      accent: '#fb7185',
      accentSoft: 'rgba(251,113,133,.25)',
      textMain: '#fff0f4',
      textSoft: 'rgba(255,210,220,.7)',
      bgGradient: 'linear-gradient(135deg,#050304,#1a0c12)',
      topbarBg: '#12080c',
      inputBg: '#241018',
      borderColor: 'rgba(251,113,133,.4)',
      cardShadow: '0 0 20px rgba(251,113,133,.2)'
    }
  },
    name: 'Inferno Black Gold',
    description: 'Luxury dark / gold premium',
    vars: {
      bgMain: '#070707',
      bgCard: '#111111',
      accent: '#f5c542',
      accentSoft: 'rgba(245,197,66,.25)',
      textMain: '#fff8e6',
      textSoft: 'rgba(255,230,180,.7)',
      bgGradient: 'linear-gradient(135deg,#040404,#1a1405)',
      topbarBg: '#0e0e0e',
      inputBg: '#1a1a1a',
      borderColor: 'rgba(245,197,66,.4)',
      cardShadow: '0 0 25px rgba(245,197,66,.25)'
    }
  },
    name: 'Emerald Forest',
    description: 'Dark nature / emerald green',
    vars: {
      bgMain: '#050c08',
      bgCard: '#0c1a12',
      accent: '#22c55e',
      accentSoft: 'rgba(34,197,94,.25)',
      textMain: '#eafff2',
      textSoft: 'rgba(200,255,220,.7)',
      bgGradient: 'linear-gradient(135deg,#020805,#0a1a12)',
      topbarBg: '#08140d',
      inputBg: '#10281a',
      borderColor: 'rgba(34,197,94,.4)',
      cardShadow: '0 0 20px rgba(34,197,94,.2)'
    }
  },
    name: 'Neon Tokyo Night',
    description: 'Cyberpunk Tokyo / neon city night',
    vars: {
      bgMain: '#050008',
      bgCard: '#0f0618',
      accent: '#00f7ff',
      accentSoft: 'rgba(0,247,255,.25)',
      textMain: '#ffffff',
      textSoft: 'rgba(200,255,255,.7)',
      bgGradient: 'linear-gradient(135deg,#020005,#12001a)',
      topbarBg: '#0a0212',
      inputBg: '#160b22',
      borderColor: 'rgba(0,247,255,.4)',
      cardShadow: '0 0 25px rgba(0,247,255,.25)'
    }
  },
    name: 'Cyber Pink',
    description: 'Futuristik / cyber / gaming',
    vars: {
      bgMain: '#0b0610',
      bgCard: '#150a1f',
      accent: '#ff4fd8',
      accentSoft: 'rgba(255,79,216,.25)',
      textMain: '#ffffff',
      textSoft: 'rgba(255,255,255,.7)',
      bgGradient: 'linear-gradient(135deg,#07030a,#14081d)',
      topbarBg: '#120717',
      inputBg: '#1a0f25',
      borderColor: 'rgba(255,79,216,.3)',
      cardShadow: '0 0 25px rgba(255,79,216,.15)'
    }
  },
  'dark-red-japan': {
    name: 'Dark Red Japan',
    description: 'Nuansa Jepang modern / samurai / zen dark',
    vars: {
      bgMain: '#0d0505',
      bgCard: '#1a0b0b',
      accent: '#c1121f',
      accentSoft: 'rgba(193,18,31,.25)',
      textMain: '#fff5f5',
      textSoft: 'rgba(255,230,230,.7)',
      bgGradient: 'linear-gradient(135deg,#090303,#1a0808)',
      topbarBg: '#140707',
      inputBg: '#220c0c',
      borderColor: 'rgba(193,18,31,.4)',
      cardShadow: '0 0 20px rgba(193,18,31,.2)'
    }
  },
  'dark-blue-modern': {
    name: 'Dark Blue Modern',
    description: 'Tech style / professional',
    vars: {
      bgMain: '#050b14',
      bgCard: '#0b1624',
      accent: '#3b82f6',
      accentSoft: 'rgba(59,130,246,.25)',
      textMain: '#eaf2ff',
      textSoft: 'rgba(200,220,255,.7)',
      bgGradient: 'linear-gradient(135deg,#02070f,#07172c)',
      topbarBg: '#081427',
      inputBg: '#0e1d36',
      borderColor: 'rgba(59,130,246,.4)',
      cardShadow: '0 0 25px rgba(59,130,246,.2)'
    }
  },
  'galaxy-nebula': {
    name: 'Galaxy Nebula',
    description: 'Cosmic purple blue galaxy theme',
    vars: {
      bgMain: '#050412',
      bgCard: '#0d0b24',
      accent: '#8b5cf6',
      accentSoft: 'rgba(139,92,246,.25)',
      textMain: '#f4f0ff',
      textSoft: 'rgba(210,200,255,.7)',
      bgGradient: 'linear-gradient(135deg,#04030a,#120b2a)',
      topbarBg: '#08061a',
      inputBg: '#161236',
      borderColor: 'rgba(139,92,246,.4)',
      cardShadow: '0 0 28px rgba(139,92,246,.3)'
    }
  },
  'neon-pink': {
    name: 'Neon Pink Cyber Pro',
    description: 'Futuristic neon pink dark dashboard / cyber UI',
    vars: {
      bgMain: '#0d0012',
      bgCard: '#16001f',
      accent: '#ff00aa',
      accentSoft: 'rgba(255,0,170,.25)',
      textMain: '#ffffff',
      textSoft: 'rgba(255,180,220,.7)',
      bgGradient: 'linear-gradient(135deg,#1a0024,#ff00aa33)',
      topbarBg: '#24002e',
      inputBg: '#1f0028',
      borderColor: 'rgba(255,0,170,.6)',
      cardShadow: '0 0 25px rgba(255,0,170,.45)'
    }
  },
  'rose-neon-dream': {
    name: 'Rose Neon Dream',
    description: 'Soft neon pink futuristic theme',
    vars: {
      bgMain: '#0a0408',
      bgCard: '#160911',
      accent: '#f472b6',
      accentSoft: 'rgba(244,114,182,.25)',
      textMain: '#fff0f7',
      textSoft: 'rgba(255,200,225,.7)',
      bgGradient: 'linear-gradient(135deg,#050205,#1a0b14)',
      topbarBg: '#11060d',
      inputBg: '#24101c',
      borderColor: 'rgba(244,114,182,.4)',
      cardShadow: '0 0 24px rgba(244,114,182,.25)'
    }
  },
  'sakura-moonlight': {
    name: 'Sakura Moonlight',
    description: 'Soft pink moonlight glow',
    vars: {
      bgMain: '#141018',
      bgCard: '#1f1624',
      accent: '#ff8fa3',
      accentSoft: 'rgba(255,143,163,.35)',
      textMain: '#fff5f8',
      textSoft: 'rgba(255,220,230,.75)',
      bgGradient: 'linear-gradient(135deg,#0f0c1a,#1b1024,#1a0f18)',
      topbarBg: 'rgba(30,16,36,.75)',
      inputBg: '#25182d',
      borderColor: 'rgba(255,143,163,.45)',
      cardShadow: '0 0 35px rgba(255,143,163,.35)'
    }
  },
  'inferno-gold': {
    name: 'Inferno Black Gold',
    description: 'Luxury dark / gold premium',
    vars: {
      bgMain: '#070707',
      bgCard: '#111111',
      accent: '#f5c542',
      accentSoft: 'rgba(245,197,66,.25)',
      textMain: '#fff8e6',
      textSoft: 'rgba(255,230,180,.7)',
      bgGradient: 'linear-gradient(135deg,#040404,#1a1405)',
      topbarBg: '#0e0e0e',
      inputBg: '#1a1a1a',
      borderColor: 'rgba(245,197,66,.4)',
      cardShadow: '0 0 25px rgba(245,197,66,.25)'
    }
  },
  'neon-tokyo-night': {
    name: 'Neon Tokyo Night',
    description: 'Cyberpunk Tokyo / neon city night',
    vars: {
      bgMain: '#050008',
      bgCard: '#0f0618',
      accent: '#00f7ff',
      accentSoft: 'rgba(0,247,255,.25)',
      textMain: '#ffffff',
      textSoft: 'rgba(200,255,255,.7)',
      bgGradient: 'linear-gradient(135deg,#020005,#12001a)',
      topbarBg: '#0a0212',
      inputBg: '#160b22',
      borderColor: 'rgba(0,247,255,.4)',
      cardShadow: '0 0 25px rgba(0,247,255,.25)'
    }
  },
  'emerald-forest': {
    name: 'Emerald Forest',
    description: 'Dark nature / emerald green',
    vars: {
      bgMain: '#050c08',
      bgCard: '#0c1a12',
      accent: '#22c55e',
      accentSoft: 'rgba(34,197,94,.25)',
      textMain: '#eafff2',
      textSoft: 'rgba(200,255,220,.7)',
      bgGradient: 'linear-gradient(135deg,#020805,#0a1a12)',
      topbarBg: '#08140d',
      inputBg: '#10281a',
      borderColor: 'rgba(34,197,94,.4)',
      cardShadow: '0 0 20px rgba(34,197,94,.2)'
    }
  }
});

function themeNormalizeKey_(key) {
  key = String(key || '').trim();
  
  // Backward compatibility - map old theme keys to new ones
  const aliases = {
    'pink-hitam-modern': 'cyber-pink',
    'dark-japan-modern': 'dark-red-japan'
  };
  
  if (aliases[key]) {
    key = aliases[key];
  }
  
  return THEME_REGISTRY[key] ? key : THEME_DEFAULT_KEY;
}

function themeVarsToCss_(vars) {
  const v = vars || {};
  const defaultVars = THEME_REGISTRY[THEME_DEFAULT_KEY].vars;
  
  const safe = {
    bgMain: v.bgMain || defaultVars.bgMain,
    bgCard: v.bgCard || defaultVars.bgCard,
    accent: v.accent || defaultVars.accent,
    accentSoft: v.accentSoft || defaultVars.accentSoft,
    textMain: v.textMain || defaultVars.textMain,
    textSoft: v.textSoft || defaultVars.textSoft,
    bgGradient: v.bgGradient || defaultVars.bgGradient,
    topbarBg: v.topbarBg || defaultVars.topbarBg,
    inputBg: v.inputBg || defaultVars.inputBg,
    borderColor: v.borderColor || defaultVars.borderColor,
    cardShadow: v.cardShadow || defaultVars.cardShadow
  };

  // Generate CSS dengan variabel baru + backward compatibility untuk variabel lama
  return `:root{
  --bg-main:${safe.bgMain};
  --bg-card:${safe.bgCard};
  --accent:${safe.accent};
  --accent-soft:${safe.accentSoft};
  --text-main:${safe.textMain};
  --text-soft:${safe.textSoft};
  --topbar-bg:${safe.topbarBg};
  --input-bg:${safe.inputBg};
  --border-color:${safe.borderColor};
  --card-shadow:${safe.cardShadow};
  
  /* Backward compatibility - map ke variabel lama */
  --bg:${safe.bgMain};
  --card:${safe.bgCard};
  --text:${safe.textMain};
  --muted:${safe.textSoft};
  --primary:${safe.accent};
  --primary2:${safe.accent};
  --border:${safe.borderColor};
  --inputBg:${safe.inputBg};
}

/* Apply body background with theme gradient */
body.auth,
body.dashboard{
  background:${safe.bgGradient}!important;
  color:${safe.textMain};
}

body.auth .phone,
body.dashboard .cardx,
body.dashboard .panelx,
body.dashboard .chart-card,
body.dashboard .xcard,
body.dashboard .menu-card{
  background:${safe.bgCard};
  border:1px solid ${safe.borderColor};
  box-shadow:${safe.cardShadow};
}

body.auth .topbar,
body.dashboard .topbar{
  background:${safe.topbarBg};
  border-color:${safe.borderColor};
}

body.auth .btn,
body.auth .btn.primary,
body.dashboard .btn,
body.dashboard .btn.primary{
  background:linear-gradient(135deg,${safe.accent},${safe.accent})!important;
  color:${safe.bgMain}!important;
}

body.auth .seg2btn.active,
body.dashboard .seg2btn.active,
body.auth .mode-btn.active,
body.dashboard .mode-btn.active{
  background:${safe.accent}!important;
  color:${safe.bgMain}!important;
}

body.auth .value-xl,
body.dashboard .value-xl{
  color:${safe.accent}!important;
}

body.auth select,
body.auth input,
body.dashboard select,
body.dashboard input{
  background:${safe.inputBg};
  color:${safe.textMain};
  border-color:${safe.borderColor};
}

body.dashboard .mini-btn.glow{
  background:${safe.accent}!important;
  color:${safe.bgMain}!important;
}

body.dashboard .brand-mark{
  background:linear-gradient(135deg,${safe.accentSoft},${safe.accent})!important;
}

body.dashboard .pill,
body.auth .badge-v2{
  background:${safe.accentSoft}!important;
  color:${safe.textMain}!important;
}

body.dashboard .report-v.positive,
body.dashboard .td-nominal.positive{
  color:${safe.accent}!important;
}

body.dashboard .td-keperluan.pemasukan{
  background:${safe.accentSoft}!important;
  color:${safe.textMain}!important;
}`;
}

function themeBuildResponse_(key) {
  const normKey = themeNormalizeKey_(key);
  const t = THEME_REGISTRY[normKey] || THEME_REGISTRY[THEME_DEFAULT_KEY];
  return { 
    key: normKey, 
    name: t.name, 
    vars: t.vars, 
    css: themeVarsToCss_(t.vars),
    logoUrl: getThemeLogoUrl_(normKey)
  };
}

function apiThemeList() {
  const themes = Object.keys(THEME_REGISTRY).map(k => {
    const t = THEME_REGISTRY[k];
    return { 
      key: k, 
      name: t.name, 
      description: t.description || '',
      css: themeVarsToCss_(t.vars) 
    };
  });
  return { ok: true, themes: themes };
}

function apiThemeRandomForLogin() {
  const keys = Object.keys(THEME_REGISTRY);
  const randKey = keys[Math.floor(Math.random() * keys.length)] || THEME_DEFAULT_KEY;
  return { ok: true, active: themeBuildResponse_(randKey) };
}

function themeGetUserThemeKey_(username) {
  username = normalizeUsername_(username);
  const found = findUserRowByUsername_(username);
  if (!found.rowIndex) return THEME_DEFAULT_KEY;

  const raw = String(found.row[CONFIG.USERS_COL.theme - 1] || '').trim();
  return themeNormalizeKey_(raw);
}

function apiThemeGetMyTheme() {
  const username = getSessionUser_();
  Logger.log('[apiThemeGetMyTheme] username: ' + username);
  // Tambahan log: cek isi THEME_REGISTRY
  Logger.log('[apiThemeGetMyTheme] THEME_REGISTRY: ' + JSON.stringify(THEME_REGISTRY));
  if (!username) return { ok: false, message: 'Belum login atau session expired.' };

  const key = themeGetUserThemeKey_(username);
  const themes = Object.keys(THEME_REGISTRY).map(k => ({ 
    key: k, 
    name: THEME_REGISTRY[k].name,
    description: THEME_REGISTRY[k].description || ''
  }));

  Logger.log('[apiThemeGetMyTheme] themes: ' + JSON.stringify(themes));
  Logger.log('[apiThemeGetMyTheme] active: ' + JSON.stringify(themeBuildResponse_(key)));
  return { ok: true, active: themeBuildResponse_(key), themes: themes };
}

function apiThemeSetMyTheme(themeKey) {
  const username = getSessionUser_();
  if (!username) return { ok: false, message: 'Belum login.' };

  const key = themeNormalizeKey_(themeKey);
  const found = findUserRowByUsername_(normalizeUsername_(username));
  if (!found.rowIndex) return { ok: false, message: 'User tidak ditemukan.' };

  const sh = getSheetOrThrow_(CONFIG.USERS_SHEET_NAME);
  sh.getRange(found.rowIndex, CONFIG.USERS_COL.theme).setValue(key);

  return { ok: true, active: themeBuildResponse_(key) };
}