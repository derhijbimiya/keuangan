# 🔐 Session Security Documentation

## Critical Fix: Multi-User Session Isolation

### ⚠️ Previous Issue (CRITICAL SECURITY FLAW)
**Problem:** Saat deploy sebagai "Jalankan sebagai: Saya (wanschool04@gmail.com)", `PropertiesService.getUserProperties()` menggunakan properties milik **wanschool04@gmail.com** untuk SEMUA user yang akses app.

**Impact:**
- User A (akun google A) login → Session tersimpan di properties wanschool04@gmail.com
- User B (akun google B) akses app → Langsung masuk ke dashboard tanpa login!
- **Session sharing across different Google Accounts** 🚨

### ✅ New Solution: Google Account-Based Session Isolation

**Implementation:**
```javascript
// Auth.gs
function getGoogleUserEmail_() {
  return Session.getActiveUser().getEmail(); // Get actual Google Account email
}

function getSessionKey_(suffix) {
  const googleEmail = getGoogleUserEmail_();
  return 'session_' + googleEmail + '_' + suffix;
}
```

**Storage Strategy:**
1. **Short Session (2 hours, no remember me):**
   - Uses: `CacheService.getUserCache()`
   - Key: `session_{googleEmail}_data`
   - Auto-expire: 2 hours (max 6 hours untuk Cache limit)
   - Cleared on: Cache expiry, manual logout

2. **Long Session (7 days, with remember me):**
   - Uses: `PropertiesService.getScriptProperties()`
   - Key: `session_{googleEmail}_data`
   - Auto-expire: 7 days
   - Cleared on: Session expiry validation, manual logout

**Session Data Structure:**
```json
{
  "username": "wan",
  "token": "aBc123XyZ_1739467200000",
  "expiry": 1739467200000,
  "loginAt": "2026-02-13T10:30:00.000Z"
}
```

---

## 🔒 Security Features

### 1. Per-Google Account Isolation
- Setiap Google Account punya session terpisah
- User A (google A) login → User B (google B) harus login sendiri
- Session tidak bocor antar Google Account

### 2. Per-Device Token Validation
- Setiap device generate unique session token
- Token tersimpan di client storage (sessionStorage/localStorage)
- Server verify token match saat request

### 3. Auto-Expiry Mechanism
```javascript
// Check expiry on every request
const now = Date.now();
if (now > expiryTime) {
  // Auto logout
  cache.remove(getSessionKey_('data'));
  scriptProps.deleteProperty(getSessionKey_('data'));
  return '';
}
```

### 4. Token Mismatch Protection
```javascript
// Login di device baru = replace token lama
if (sessionToken && storedToken && sessionToken !== storedToken) {
  // Token mismatch - different device
  return '';
}
```

---

## 📱 Cross-Device Behavior

### Scenario 1: Login Tanpa "Remember Me" (2 Jam)
1. Login di **Chrome** → sessionToken tersimpan di **sessionStorage**
2. Buka **Firefox** (same Google Account) → **Harus login ulang**
3. sessionStorage tidak shared antar browser
4. Auto-expire setelah 2 jam

### Scenario 2: Login Dengan "Remember Me" (7 Hari)
1. Login di **Phone** (Google Account A) → sessionToken A
2. Login di **Laptop** (Google Account A) → sessionToken B **(replace A)**
3. Buka **Phone** lagi → Token mismatch → **Auto logout**
4. Harus login ulang di Phone → sessionToken C **(replace B)**
5. Laptop auto logout saat digunakan

### Scenario 3: Multiple Google Accounts
1. Login di **Chrome Profile 1** (Google Account A, username: wan)
2. Login di **Chrome Profile 2** (Google Account B, username: wan)
3. Both sessions **ISOLATED** - tidak saling ganggu
4. Masing-masing punya session key berbeda:
   - Profile 1: `session_accountA@gmail.com_data`
   - Profile 2: `session_accountB@gmail.com_data`

---

## 🎯 Testing Checklist

### Test 1: Multi-Account Isolation ✅
- [ ] Login dengan Google Account A di Chrome Profile 1
- [ ] Buka Chrome Profile 2 dengan Google Account B
- [ ] Verify: Profile 2 harus login ulang (tidak auto-masuk)

### Test 2: Session Expiry ✅
- [ ] Login tanpa remember me
- [ ] Tunggu 2+ jam
- [ ] Refresh page → Auto logout

### Test 3: Remember Me Persistence ✅
- [ ] Login dengan remember me
- [ ] Close browser
- [ ] Open browser lagi → Still logged in (< 7 hari)

### Test 4: Per-Device Token ✅
- [ ] Login di Phone dengan remember me
- [ ] Login di Laptop dengan remember me
- [ ] Buka Phone lagi → Auto logout (token mismatch)

---

## 🛠️ Deployment Configuration

**Required Settings:**
- Deploy as: **"Saya (wanschool04@gmail.com)"** ✅
- Execute as: **"User accessing the web app"** ⚠️ IMPORTANT!
- Who has access: **"Anyone"** or specific domain

**Why "Execute as User" is Critical:**
- `Session.getActiveUser()` returns actual user's Google Account
- Without this, session isolation won't work

---

## 📊 Session Storage Comparison

| Storage Type | Use Case | Max Duration | Shared Across |
|--------------|----------|--------------|---------------|
| `sessionStorage` | No remember me | Session only | Same tab only |
| `localStorage` | Remember me | Persistent | Same browser origin |
| `CacheService` | Short session | 6 hours max | Same Google Account |
| `ScriptProperties` | Long session | No limit | All users (with unique key) |

---

## 🔧 Technical Implementation

### Key Functions:
1. `getGoogleUserEmail_()` - Get actual Google Account email
2. `getSessionKey_(suffix)` - Generate unique key per Google Account
3. `getSessionUser_(sessionToken)` - Validate session with token
4. `apiLogin()` - Create session with token + expiry
5. `apiLogout()` - Clear session from cache + scriptProps

### Session Flow:
```
User Login
  ↓
Generate unique sessionToken
  ↓
Store in CacheService (2h) or ScriptProperties (7d)
  ↓
Send sessionToken to client
  ↓
Client stores in sessionStorage/localStorage
  ↓
Every request: Client sends sessionToken
  ↓
Server validates: googleEmail + token match + not expired
  ↓
Return username or empty string
```

---

## 📝 Migration Notes

**Breaking Changes:**
- Old sessions using `getUserProperties()` will be invalid
- All users need to **login again** after update
- Session keys changed from global to per-Google Account

**Backward Compatibility:**
- `getSessionUser_()` still accepts optional `sessionToken` parameter
- `doGet()` still works without token (for initial page load)
- Client storage (sessionStorage/localStorage) unchanged

---

## ✅ Benefits

1. **True Multi-User Support** - Each Google Account isolated
2. **Security** - Session tidak bocor antar user
3. **Per-Device Control** - Login baru = logout device lama
4. **Auto-Expiry** - 2 jam (short) / 7 hari (long)
5. **Token Validation** - Prevent session hijacking

---

## 🚨 Known Limitations

1. **Cache Limit:** CacheService max 6 hours, suitable untuk 2-hour session
2. **ScriptProperties Size:** Max 9KB per property (enough untuk session data)
3. **Anonymous Access:** Jika `getActiveUser()` gagal, return 'anonymous' = no session
4. **Deployment Requirement:** Must deploy dengan "Execute as: User accessing the web app"

---

Last Updated: February 13, 2026
