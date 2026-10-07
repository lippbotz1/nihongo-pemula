



/* ============ DATA GLOBAL (di-load dari Firebase) ============ */
let EMBEDDED_USERS = [];
let EMBEDDED_WA = { number: '', message: 'Halo Admin, saya ingin membeli premium Nihongo.' };
let EMBEDDED_PRICING = [];
let EMBEDDED_REVIEWS = [];

/* FIREBASE */
const FIREBASE_CONFIG = {apiKey:"AIzaSyAxbjct95CVVLnL_NdJ9X-IjR2ax1peW0E",authDomain:"nihongo-premium.firebaseapp.com",databaseURL:"https://nihongo-premium-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"nihongo-premium",storageBucket:"nihongo-premium.firebasestorage.app",messagingSenderId:"1056567790903",appId:"1:1056567790903:web:6a3de665e9170d846a9eb2"};
let firebaseDB = null;
try { if (typeof firebase !== 'undefined') { if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG); firebaseDB = firebase.database(); } } catch (e) { console.warn('Firebase init:', e); }

async function loadRemoteConfig() {
  if (!firebaseDB) { console.warn('Firebase tidak tersedia'); return false; }
  try {
    const snap = await firebaseDB.ref('nihongo_config').once('value');
    const data = snap.val();
    if (!data) { console.warn('Data config kosong di Firebase'); return false; }
    EMBEDDED_USERS = [];
    EMBEDDED_WA = data.wa || { number: '', message: 'Halo Admin, saya ingin membeli premium Nihongo.' };
    EMBEDDED_PRICING = data.pricing || [];
    EMBEDDED_REVIEWS = data.reviews || [];
    console.log('✅ Data dari Firebase:', { users: EMBEDDED_USERS.length, pricing: EMBEDDED_PRICING.length, reviews: EMBEDDED_REVIEWS.length, wa: EMBEDDED_WA.number });
    return true;
  } catch (e) { console.error('Gagal load Firebase:', e); return false; }
}

/* AUTH + DEVICE LOCK */
function getDeviceId() { let id = localStorage.getItem('nihongo_device_id'); if (!id) { id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem('nihongo_device_id', id); } catch (e) {} } return id; }
function getDeviceName() { const ua = navigator.userAgent; let b = 'Browser'; if (ua.includes('Chrome')) b = 'Chrome'; else if (ua.includes('Firefox')) b = 'Firefox'; else if (ua.includes('Safari')) b = 'Safari'; let os = 'Unknown'; if (/Android/i.test(ua)) os = 'Android'; else if (/iPhone|iPad/i.test(ua)) os = 'iOS'; else if (/Windows/i.test(ua)) os = 'Windows'; else if (/Mac/i.test(ua)) os = 'macOS'; else if (/Linux/i.test(ua)) os = 'Linux'; return b + ' · ' + os; }
async function checkDeviceLock(email) { if (!firebaseDB) return { ok: true }; try { const deviceId = getDeviceId(); const key = email.replace(/\./g, ','); const snap = await firebaseDB.ref('device_lock/' + key).once('value'); const data = snap.val(); if (!data || !data.deviceId || data.deviceId === deviceId) return { ok: true }; return { ok: false, msg: 'Akun ini sedang aktif di perangkat lain (' + (data.deviceName || 'unknown') + '). Logout dari perangkat tersebut atau hubungi admin untuk reset.' }; } catch (e) { return { ok: true }; } }
async function setDeviceLock(email) { if (!firebaseDB) return; try { const key = email.replace(/\./g, ','); await firebaseDB.ref('device_lock/' + key).set({ deviceId: getDeviceId(), deviceName: getDeviceName(), loginAt: Date.now() }); } catch (e) {} }
async function clearDeviceLock(email) { if (!firebaseDB) return; try { const key = email.replace(/\./g, ','); const snap = await firebaseDB.ref('device_lock/' + key).once('value'); const data = snap.val(); if (!data || data.deviceId === getDeviceId()) await firebaseDB.ref('device_lock/' + key).remove(); } catch (e) {} }
let loginHistoryRef = null;
async function recordLogin(user) {
  if (!firebaseDB || !user || !user.uid) return;
  try {
    const ref = firebaseDB.ref('login_history/' + user.uid);
    const snap = await ref.once('value');
    const old = snap.val() || {};
    const now = Date.now();
    await ref.set({
      hasLoggedIn: true,
      firstLoginAt: old.firstLoginAt ? Number(old.firstLoginAt) : now,
      lastLoginAt: now,
      email: user.email || old.email || ''
    });
  } catch(e) { console.warn('Login history:', e); }
}
let presenceTimer = null;
let presenceRef = null;
let presenceConnectedRef = null;
async function setPresence(user) {
  if (!firebaseDB || !user || !user.uid) return;
  try {
    if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
    presenceRef = firebaseDB.ref('presence/' + user.uid);
    const connectedRef = firebaseDB.ref('.info/connected');
    presenceConnectedRef = connectedRef;
    const onlineData = {
      online: true,
      email: user.email || '',
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
    const offlineData = {
      online: false,
      email: user.email || '',
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    };
    await presenceRef.onDisconnect().set(offlineData);
    await presenceRef.set(onlineData);
    connectedRef.on('value', snap => {
      if (snap.val() === true && presenceRef && currentUser && currentUser.uid === user.uid) {
        presenceRef.onDisconnect().set(offlineData).catch(() => {});
        presenceRef.update({online:true, lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(() => {});
      }
    });
    presenceTimer = setInterval(() => {
      if (presenceRef && currentUser && currentUser.uid === user.uid) {
        presenceRef.update({online:true, lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(() => {});
      }
    }, 15000);
  } catch (e) {
    console.warn('Presence error:', e);
  }
}
async function clearPresence() {
  if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
  try { if (presenceConnectedRef) presenceConnectedRef.off(); } catch (e) {}
  presenceConnectedRef = null;
  if (!firebaseDB || !currentUser || !currentUser.uid) return;
  try {
    const ref = firebaseDB.ref('presence/' + currentUser.uid);
    await ref.onDisconnect().cancel();
    await ref.update({online:false, lastSeen:firebase.database.ServerValue.TIMESTAMP});
  } catch (e) {}
}
let deviceWatcherTimer = null;
let licenseWatcherTimer = null;
let currentUser = null;
let currentLicense = null;
let firebaseAuth = null;
let authPersistenceReady = Promise.resolve();
try {
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebaseAuth = firebase.auth();
    // PENTING: sesi login harus disimpan di browser.
    // Dengan LOCAL, refresh/tutup-buka website tidak meminta login lagi.
    authPersistenceReady = firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(() => console.log('✅ Firebase Auth persistence: LOCAL'))
      .catch(e => { console.warn('Auth persistence LOCAL gagal:', e); });
  }
} catch (e) { console.warn('Firebase Auth init:', e); }
function getLicenseActive(lic) { if (!lic || lic.active === false) return false; const exp = lic.expiresAt ? Number(lic.expiresAt) : null; return !exp || exp > Date.now(); }
async function loadLicense(user) { if (!firebaseDB || !user) return null; try { const snap = await firebaseDB.ref('licenses/' + user.uid).once('value'); const lic = snap.val(); if (!lic) return null; const expiresAt = lic.expiresAt ? Number(lic.expiresAt) : null; return { ...lic, expiresAt, email: user.email || lic.email || '', uid: user.uid, active: lic.active !== false && (!expiresAt || expiresAt > Date.now()) }; } catch (e) { console.warn('License load:', e); return null; } }
function stopWatchers() { if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; } if (deviceWatcherTimer) { clearInterval(deviceWatcherTimer); deviceWatcherTimer = null; } if (licenseWatcherTimer) { clearInterval(licenseWatcherTimer); licenseWatcherTimer = null; } }
function startDeviceWatcher(email) { if (!firebaseDB || !email) return; if (deviceWatcherTimer) clearInterval(deviceWatcherTimer); const deviceId = getDeviceId(); deviceWatcherTimer = setInterval(async () => { try { const key = email.replace(/\./g, ','); const snap = await firebaseDB.ref('device_lock/' + key).once('value'); const data = snap.val(); if (!data || data.deviceId !== deviceId) { if (currentUser && currentUser.email === email) { alert('⚠️ Sesi berakhir.'); await clearPresence(); stopWatchers(); try { await firebaseAuth.signOut(); } catch (e) {} currentUser = null; currentLicense = null; showGate(); } } } catch (e) {} }, 30000); }
function startLicenseWatcher() { if (licenseWatcherTimer) clearInterval(licenseWatcherTimer); licenseWatcherTimer = setInterval(async () => { if (!currentUser) return; const lic = await loadLicense(currentUser); if (!getLicenseActive(lic)) { await clearPresence(); stopWatchers(); try { await firebaseAuth.signOut(); } catch (e) {} currentUser = null; currentLicense = null; showGate(); alert('⚠️ Lisensi Premium sudah tidak aktif atau kedaluwarsa.'); } else { currentLicense = lic; if (document.getElementById('pengaturan')?.classList.contains('active')) renderAkun(); } }, 15000); }
function isLoggedIn() { return !!currentUser && getLicenseActive(currentLicense); }
async function login(email, password) {
  try {
    if (!firebaseAuth) return { ok: false, msg: 'Firebase Auth belum tersedia.' };
    await authPersistenceReady;
    const cred = await firebaseAuth.signInWithEmailAndPassword(String(email).trim(), String(password));
    const lic = await loadLicense(cred.user);
    if (!lic) { await firebaseAuth.signOut(); return { ok: false, msg: 'Akun belum memiliki lisensi Premium.' }; }
    if (!getLicenseActive(lic)) { await firebaseAuth.signOut(); return { ok: false, msg: 'Lisensi akun sudah tidak aktif atau kedaluwarsa.' }; }
    const lockCheck = await checkDeviceLock(cred.user.email);
    if (!lockCheck.ok) { await firebaseAuth.signOut(); return { ok: false, msg: lockCheck.msg, deviceLocked: true }; }
    await setDeviceLock(cred.user.email);
    currentUser = cred.user;
    currentLicense = lic;
    await recordLogin(currentUser);
    await setPresence(currentUser);
    startDeviceWatcher(cred.user.email);
    startLicenseWatcher();
    return { ok: true, account: lic };
  } catch (e) {
    const code = String(e && e.code || '');
    const msg = code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' ? 'Email atau password salah.' : (code === 'auth/too-many-requests' ? 'Terlalu banyak percobaan. Coba lagi beberapa saat.' : (e && e.message ? e.message : 'Login gagal.'));
    return { ok: false, msg };
  }
}
async function logout() { const email = currentUser && currentUser.email; await clearPresence(); stopWatchers(); if (email) await clearDeviceLock(email); try { if (firebaseAuth) await firebaseAuth.signOut(); } catch (e) {} currentUser = null; currentLicense = null; showGate(); }
function showGate() { document.getElementById('premiumGate').style.display = 'flex'; document.getElementById('mainApp').classList.add('blurred'); }
function showApp() { document.getElementById('premiumGate').style.display = 'none'; document.getElementById('mainApp').classList.remove('blurred'); renderAkun(); }
async function checkAutoLogin() {
  // Firebase Auth LOCAL adalah sumber sesi yang sebenarnya. Jangan pernah
  // meminta password ulang hanya karena halaman baru selesai dimuat.
  showGate();
  if (!firebaseAuth) return;
  try {
    await authPersistenceReady;
    await new Promise(resolve => {
      let finished = false;
      const finish = () => { if (!finished) { finished = true; resolve(); } };
      const unsub = firebaseAuth.onAuthStateChanged(async user => {
        try {
          if (!user) { finish(); return; }
          const lic = await loadLicense(user);
          if (!getLicenseActive(lic)) {
            try { await firebaseAuth.signOut(); } catch (e) {}
            finish(); return;
          }
          const lockCheck = await checkDeviceLock(user.email);
          if (!lockCheck.ok) {
            try { await firebaseAuth.signOut(); } catch (e) {}
            setTimeout(() => alert('⚠️ ' + lockCheck.msg), 250);
            finish(); return;
          }
          currentUser = user;
          currentLicense = lic;
          // Sesi dipulihkan otomatis; ini BUKAN login ulang.
          await setDeviceLock(user.email);
          await setPresence(user);
          startDeviceWatcher(user.email);
          startLicenseWatcher();
          showApp();
        } catch (e) {
          console.warn('Pemulihan sesi:', e);
        } finally {
          try { unsub(); } catch (e) {}
          finish();
        }
      });
      // Safety timeout: jangan menggantung di layar login jika Firebase lambat.
      setTimeout(finish, 12000);
    });
  } catch (e) { console.warn('Auto login:', e); }
}
function renderAkun() {
  if (!currentUser) return;
  const acc = currentLicense;
  if (!acc) return;
  document.getElementById('akunAvatar').textContent = acc.email[0].toUpperCase();
  document.getElementById('akunEmail').textContent = acc.email;
  document.getElementById('akunEmailDetail').textContent = acc.email;
  const isLifetime = acc.duration === 9999;
  const daysLeft = isLifetime ? Infinity : Math.max(0, Math.ceil((acc.expiresAt - Date.now()) / 86400000));
  const totalDays = isLifetime ? null : acc.duration;
  const percentLeft = isLifetime ? 100 : Math.min(100, Math.round((daysLeft / totalDays) * 100));
  const badgeEl = document.getElementById('akunBadge');
  if (isLifetime) { badgeEl.textContent = '♾️ LIFETIME'; } else { badgeEl.textContent = '⭐ PREMIUM'; }
  const statusEl = document.getElementById('akunStatusDetail');
  if (isLifetime) { statusEl.textContent = 'Aktif Selamanya'; statusEl.className = 'value mint'; }
  else if (daysLeft <= 0) { statusEl.textContent = 'Kedaluwarsa'; statusEl.className = 'value danger'; }
  else if (daysLeft <= 7) { statusEl.textContent = 'Segera Berakhir'; statusEl.className = 'value warn'; }
  else { statusEl.textContent = 'Aktif'; statusEl.className = 'value mint'; }
  let dl = '-'; if (isLifetime) dl = 'Lifetime'; else if (totalDays === 30) dl = '1 Bulan'; else if (totalDays === 90) dl = '3 Bulan'; else if (totalDays === 365) dl = '1 Tahun'; else dl = totalDays + ' hari';
  document.getElementById('akunDuration').textContent = dl;
  const fmtDate = (ts) => new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const startDate = acc.createdAt || (acc.expiresAt ? acc.expiresAt - (totalDays * 86400000) : Date.now());
  document.getElementById('akunStart').textContent = fmtDate(startDate);
  if (isLifetime) { document.getElementById('akunExpiry').textContent = 'Selamanya ♾️'; document.getElementById('akunProgressWrap').style.display = 'none'; }
  else {
    document.getElementById('akunExpiry').textContent = fmtDate(acc.expiresAt);
    document.getElementById('akunDaysLeft').textContent = daysLeft + ' hari';
    document.getElementById('akunProgressWrap').style.display = 'block';
    document.getElementById('akunProgressBar').style.width = percentLeft + '%';
  }
}

const formalityDict = {
  'こんにちは': { category:'Sapaan Siang', variants:[{level:'Kasual',jp:'やあ',romaji:'yaa',id:'Hai',note:'Ke teman'},{level:'Sopan',jp:'こんにちは',romaji:'konnichiwa',id:'Selamat siang',note:'Standar'},{level:'Formal',jp:'ごきげんよう',romaji:'gokigenyou',id:'Salam sejahtera',note:'Sangat formal'}]},
  'おはよう': { category:'Sapaan Pagi', variants:[{level:'Kasual',jp:'おはよう',romaji:'ohayou',id:'Pagi!',note:'Ke teman'},{level:'Sopan',jp:'おはようございます',romaji:'ohayou gozaimasu',id:'Selamat pagi',note:'Standar'}]},
  'ありがとう': { category:'Terima Kasih', variants:[{level:'Kasual',jp:'ありがとう',romaji:'arigatou',id:'Makasih',note:'Ke teman'},{level:'Sopan',jp:'ありがとうございます',romaji:'arigatou gozaimasu',id:'Terima kasih',note:'Standar'},{level:'Formal',jp:'誠にありがとうございます',romaji:'makoto ni arigatou gozaimasu',id:'Terima kasih sebesar-besarnya',note:'Bisnis'}]},
  'すみません': { category:'Permisi/Maaf', variants:[{level:'Kasual',jp:'ごめん',romaji:'gomen',id:'Maaf',note:'Ke teman'},{level:'Sopan',jp:'すみません',romaji:'sumimasen',id:'Permisi/Maaf',note:'Standar'},{level:'Formal',jp:'申し訳ございません',romaji:'moushiwake gozaimasen',id:'Mohon maaf',note:'Bisnis'}]},
  'はい': { category:'Ya', variants:[{level:'Kasual',jp:'うん',romaji:'un',id:'Iya',note:'Ke teman'},{level:'Sopan',jp:'はい',romaji:'hai',id:'Ya',note:'Standar'},{level:'Formal',jp:'かしこまりました',romaji:'kashikomarimashita',id:'Baik',note:'Bisnis'}]},
  'お疲れ様': { category:'Kerja Keras', variants:[{level:'Kasual',jp:'お疲れ',romaji:'otsukare',id:'Capek ya',note:'Ke teman'},{level:'Sopan',jp:'お疲れ様です',romaji:'otsukaresama desu',id:'Terima kasih atas kerja kerasnya',note:'Kantor'},{level:'Formal',jp:'お疲れ様でございます',romaji:'otsukaresama de gozaimasu',id:'Terima kasih banyak',note:'Bisnis'}]},
  '食べる': { category:'Makan', variants:[{level:'Kasual',jp:'食べる',romaji:'taberu',id:'Makan',note:'Kamus'},{level:'Sopan',jp:'食べます',romaji:'tabemasu',id:'Makan (sopan)',note:'Standar'},{level:'Hormat',jp:'召し上がる',romaji:'meshiagaru',id:'Makan (hormat)',note:'Untuk atasan'},{level:'Rendah hati',jp:'いただく',romaji:'itadaku',id:'Makan (rendah hati)',note:'Diri sendiri'}]},
  '行く': { category:'Pergi', variants:[{level:'Kasual',jp:'行く',romaji:'iku',id:'Pergi',note:'Kamus'},{level:'Sopan',jp:'行きます',romaji:'ikimasu',id:'Pergi (sopan)',note:'Standar'},{level:'Hormat',jp:'いらっしゃる',romaji:'irassharu',id:'Pergi (hormat)',note:'Untuk atasan'}]},
  '見る': { category:'Melihat', variants:[{level:'Kasual',jp:'見る',romaji:'miru',id:'Lihat',note:'Kamus'},{level:'Sopan',jp:'見ます',romaji:'mimasu',id:'Lihat (sopan)',note:'Standar'},{level:'Hormat',jp:'ご覧になる',romaji:'goran ni naru',id:'Melihat (hormat)',note:'Untuk atasan'}]}
};
function renderFormality(info) {
  const matches = Array.isArray(info) ? info : [{ key: null, info: info }];
  const container = document.getElementById('formalityContent');
  if (!container) return;
  container.innerHTML = matches.map(({ key, info: entry }) =>
    '<div class="formality-category">📊 ' + entry.category + '</div>' +
    '<div class="formality-list">' + entry.variants.map(v =>
      '<div class="formality-item" data-speak="' + v.jp.replace(/"/g,'&quot;') + '"><div class="formality-level">' + v.level + '</div><div class="formality-jp">' + v.jp + '</div><div class="formality-romaji">' + v.romaji + '</div><div class="formality-id">🇮🇩 ' + v.id + '</div><div class="formality-note">' + v.note + '</div></div>'
    ).join('') + '</div>'
  ).join('');
}
function renderKesopananList() {
  const el = document.getElementById('kesopananList');
  if (!el) return;
  el.innerHTML = Object.keys(formalityDict).map(key => {
    const entry = formalityDict[key];
    return '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px"><div style="font-size:13px;font-weight:800;color:var(--violet);margin-bottom:10px">📊 ' + entry.category + '</div>' + entry.variants.map(v => '<div class="formality-item" data-speak="' + v.jp.replace(/"/g,'&quot;') + '" style="margin-bottom:6px"><div class="formality-level">' + v.level + '</div><div class="formality-jp">' + v.jp + '</div><div class="formality-romaji">' + v.romaji + '</div><div class="formality-id">🇮🇩 ' + v.id + '</div><div class="formality-note">' + v.note + '</div></div>').join('') + '</div>';
  }).join('');
}

function getPricingValues(p) {
  const original = Math.max(0, Number(p.price) || 0);
  const discountPrice = Number(p.discountPrice);
  const hasDiscountPrice = Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < original;
  const finalPrice = hasDiscountPrice ? discountPrice : original;
  return { original, finalPrice, hasDiscountPrice };
}
function renderStore() {
  const priceTable = document.getElementById('priceTable');
  if (EMBEDDED_PRICING.length > 0) {
    priceTable.innerHTML = '<div class="price-table-header">💎 Pilih Paket</div>' + EMBEDDED_PRICING.map((p, i) => {
      const v = getPricingValues(p);
      return '<div class="price-row ' + (i === 0 ? 'selected' : '') + '" data-duration="' + escapeHtml(p.duration) + '" data-price="' + v.finalPrice + '">' +
        '<div class="price-info"><div class="price-duration">' + escapeHtml(p.duration) + '</div><div class="price-desc">' + escapeHtml(p.desc || '') + '</div></div>' +
        '<div class="price-amount">' + (v.hasDiscountPrice ? '<div class="price-original">Rp ' + v.original.toLocaleString('id-ID') + '</div>' : '') +
        '<div class="price-final">Rp ' + v.finalPrice.toLocaleString('id-ID') + '</div>' +
        (v.hasDiscountPrice ? '<span class="price-discount-badge">DISKON</span>' : '') + '</div></div>';
    }).join('');
    document.querySelectorAll('.price-row').forEach(row => { row.addEventListener('click', () => { document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected')); row.classList.add('selected'); updateWALink(); }); });
  } else { priceTable.innerHTML = '<div class="price-table-header">💎 Paket belum tersedia</div>'; }
  updateWALink();
  if (EMBEDDED_REVIEWS.length > 0) {
    document.getElementById('reviewsSection').style.display = 'block';
    document.getElementById('reviewsList').innerHTML = EMBEDDED_REVIEWS.map(r => '<div class="review-item"><div class="review-stars">' + '⭐'.repeat(r.stars) + '</div><div class="review-name">' + escapeHtml(r.name) + '</div><div class="review-text">' + escapeHtml(r.text) + '</div></div>').join('');
  }
}
function updateWALink() {
  const selected = document.querySelector('.price-row.selected');
  const btn = document.getElementById('waBtn');
  if (!btn) return;
  if (!selected) { btn.onclick = (e) => { e.preventDefault(); alert('Pilih paket dulu 😊'); }; return; }
  if (!EMBEDDED_WA.number) { btn.href = '#'; btn.style.opacity = '0.7'; btn.onclick = (e) => { e.preventDefault(); alert('⚠️ Nomor WA admin belum diatur.'); }; return; }
  const duration = selected.dataset.duration || '';
  const finalPrice = Number(selected.dataset.price || 0);
  const msg = String(EMBEDDED_WA.message || 'Halo Admin, saya ingin membeli premium Nihongo.') + '\n\nPaket: ' + duration + '\nHarga: Rp ' + finalPrice.toLocaleString('id-ID');
  const url = 'https://wa.me/' + String(EMBEDDED_WA.number).replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent(msg);
  btn.href = url; btn.target = '_blank'; btn.rel = 'noopener noreferrer'; btn.style.opacity = '1'; btn.onclick = null;
}
function escapeHtml(x) { return String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function initGate() {
  const storePage = document.getElementById('storePage');
  const loginPage = document.getElementById('loginPage');
  const errEl = document.getElementById('loginError');
  document.getElementById('openLoginBtn').addEventListener('click', () => { storePage.style.display = 'none'; loginPage.classList.add('show'); errEl.classList.remove('show'); });
  document.getElementById('backToStoreBtn').addEventListener('click', () => { loginPage.classList.remove('show'); storePage.style.display = 'block'; });
  async function doLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) { errEl.textContent = 'Email dan password wajib diisi!'; errEl.classList.add('show'); return; }
    const btn = document.getElementById('doLoginBtn');
    const oldText = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Memeriksa...';
    const res = await login(email, password);
    btn.disabled = false; btn.textContent = oldText;
    if (res.ok) { errEl.classList.remove('show'); document.getElementById('loginEmail').value = ''; document.getElementById('loginPassword').value = ''; showApp(); }
    else {
      errEl.textContent = res.msg; errEl.classList.add('show');
      if (res.deviceLocked && EMBEDDED_WA.number) {
        const waMsg = 'Halo Admin, akun saya (' + email + ') terkunci. Mohon reset device.';
        errEl.innerHTML = res.msg + '<br><br><a href="https://wa.me/' + EMBEDDED_WA.number + '?text=' + encodeURIComponent(waMsg) + '" target="_blank" style="display:inline-block;padding:10px 18px;background:linear-gradient(135deg,#4f8cff,#258bd8);color:#fff;border-radius:100px;text-decoration:none;font-weight:800;font-size:12px">📱 Hubungi Admin via WA</a>';
      }
    }
  }
  document.getElementById('doLoginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('akunLogoutBtn').addEventListener('click', () => { if (confirm('Yakin logout?')) logout(); });
  const vm = document.getElementById('voiceMaleInline'), vf = document.getElementById('voiceFemaleInline');
  if (vm && vf) {
    vm.addEventListener('click', () => { currentVoiceGender = 'male'; localStorage.setItem('voice_gender','male'); updateVoiceUI(); speak('こんにちは'); });
    vf.addEventListener('click', () => { currentVoiceGender = 'female'; localStorage.setItem('voice_gender','female'); updateVoiceUI(); speak('こんにちは'); });
  }
  const tv = document.getElementById('testVoiceBtn');
  if (tv) tv.addEventListener('click', () => speak('こんにちは、私は日本語を勉強しています'));
}

document.getElementById('mainTabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn'); if (!btn) return;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  btn.classList.add('active'); window.scrollTo(0, 0);
  if (btn.dataset.tab === 'pengaturan') renderAkun();
});
document.getElementById('learnTabs').addEventListener('click', e => {
  const btn = e.target.closest('.learn-tab'); if (!btn) return;
  document.querySelectorAll('.learn-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('#learnTabs .learn-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('learn-' + btn.dataset.learn).classList.add('active');
  btn.classList.add('active');
});
document.getElementById('quizTabs').addEventListener('click', e => {
  const btn = e.target.closest('.learn-tab'); if (!btn) return;
  document.querySelectorAll('#quizTabs .learn-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); startQuiz(btn.dataset.quiz);
});

let maleVoice = null, femaleVoice = null;
let currentVoiceGender = localStorage.getItem('voice_gender') || 'male';
let speaking = false;
function initVoices() { if (!('speechSynthesis' in window)) return; const voices = speechSynthesis.getVoices(); const jp = voices.filter(v => v.lang.startsWith('ja')); maleVoice = jp[0] || null; femaleVoice = jp[1] || jp[0] || null; updateVoiceUI(); }
if ('speechSynthesis' in window) { initVoices(); speechSynthesis.onvoiceschanged = initVoices; }
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  if (speaking) { try { speechSynthesis.cancel(); } catch (e) {} }
  speaking = true;
  try { speechSynthesis.cancel();
    const clean = String(text).replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ja-JP'; u.rate = Math.max(0.5, Math.min(1.5, Number(localStorage.getItem('jl_speech_rate') || 0.85))); u.volume = 1;
    if (currentVoiceGender === 'female') { u.pitch = 1.02; if (femaleVoice) u.voice = femaleVoice; } else { u.pitch = 0.92; if (maleVoice) u.voice = maleVoice; }
    u.onend = () => { speaking = false; }; u.onerror = () => { speaking = false; };
    speechSynthesis.speak(u);
  } catch (e) { speaking = false; }
}
function updateVoiceUI() {
  const m = document.getElementById('voiceMaleOpt'), f = document.getElementById('voiceFemaleOpt'), b = document.getElementById('voiceMainBtn');
  if (m) { if (currentVoiceGender === 'male') { m.classList.add('active'); f.classList.remove('active'); b.textContent = '👨'; } else { f.classList.add('active'); m.classList.remove('active'); b.textContent = '👩'; } }
  const vm = document.getElementById('voiceMaleInline'), vf = document.getElementById('voiceFemaleInline');
  if (vm && vf) {
    vm.style.cssText = 'padding:8px 14px;font-size:11px;' + (currentVoiceGender === 'male' ? 'border-color:var(--indigo);color:#7dc0ff' : '');
    vf.style.cssText = 'padding:8px 14px;font-size:11px;' + (currentVoiceGender === 'female' ? 'border-color:var(--indigo);color:#7dc0ff' : '');
  }
}
document.getElementById('voiceMainBtn').addEventListener('click', e => { e.stopPropagation(); document.getElementById('voicePicker').classList.toggle('show'); });
document.getElementById('voiceMaleOpt').addEventListener('click', () => { currentVoiceGender = 'male'; localStorage.setItem('voice_gender','male'); updateVoiceUI(); document.getElementById('voicePicker').classList.remove('show'); });
document.getElementById('voiceFemaleOpt').addEventListener('click', () => { currentVoiceGender = 'female'; localStorage.setItem('voice_gender','female'); updateVoiceUI(); document.getElementById('voicePicker').classList.remove('show'); });
document.addEventListener('click', e => { const vt = document.querySelector('.voice-toggle'); if (vt && !vt.contains(e.target)) document.getElementById('voicePicker').classList.remove('show'); });

let lastSpeakTime = 0;
document.body.addEventListener('click', e => {
  const selectable = e.target.closest('.kana-item,.kanji-item,.phrase-row,.grammar-box,.formality-item,.vocab-item,.quiz-option,.flashcard,.task,.price-row');
  const speakEl = e.target.closest('[data-speak]');
  if (!selectable && !speakEl) return;
  if (selectable) {
    document.querySelectorAll('.kana-item.is-selected,.kanji-item.is-selected,.phrase-row.is-selected,.grammar-box.is-selected,.formality-item.is-selected,.vocab-item.is-selected,.quiz-option.is-selected,.flashcard.is-selected,.task.is-selected,.price-row.selected').forEach(x => {
      if (x !== selectable) { x.classList.remove('is-selected','tap-flash','tap-ripple'); x.setAttribute('aria-pressed','false'); }
    });
    selectable.classList.remove('tap-flash','tap-ripple');
    void selectable.offsetWidth;
    selectable.classList.add('is-selected','tap-flash','tap-ripple');
    selectable.setAttribute('aria-pressed','true');
    setTimeout(() => selectable.classList.remove('tap-flash','tap-ripple'), 500);
  }
  const targetSpeak = speakEl || selectable;
  const text = targetSpeak && targetSpeak.getAttribute ? targetSpeak.getAttribute('data-speak') : '';
  if (!text) return;
  const now = Date.now(); if (now - lastSpeakTime < 250) return;
  lastSpeakTime = now;
  speak(text);
}, { passive: true });

const KANJI_WORDS = {
  'こんにちは':'konnichiwa','こんばんは':'konbanwa','おはよう':'ohayou','おはようございます':'ohayou gozaimasu','ありがとう':'arigatou','ありがとうございます':'arigatou gozaimasu','すみません':'sumimasen','ごめんなさい':'gomen nasai','さようなら':'sayounara','はじめまして':'hajimemashite','いただきます':'itadakimasu','ごちそうさまでした':'gochisousama deshita','おやすみなさい':'oyasuminasai','いってきます':'ittekimasu','いってらっしゃい':'itterasshai','おかえりなさい':'okaerinasai','ただいま':'tadaima','おめでとう':'omedetou','よろしくお願いします':'yoroshiku onegaishimasu','よろしく':'yoroshiku','お疲れ様です':'otsukaresama desu','お疲れ様':'otsukaresama','お疲れ':'otsukare','失礼します':'shitsurei shimasu','申し訳ありません':'moushiwake arimasen','召し上がれ':'meshiagare','食べる':'taberu','食べます':'tabemasu','飲む':'nomu','飲みます':'nomimasu','行く':'iku','行きます':'ikimasu','来る':'kuru','来ます':'kimasu','見る':'miru','見ます':'mimasu','聞く':'kiku','読む':'yomu','書く':'kaku','話す':'hanasu','買う':'kau','会う':'au','作る':'tsukuru','使う':'tsukau','働く':'hataraku','寝る':'neru','起きる':'okiru','帰る':'kaeru','言う':'iu','思う':'omou','知る':'shiru','考える':'kangaeru','立つ':'tatsu','座る':'suwaru','歩く':'aruku','走る':'hashiru','泳ぐ':'oyogu','飛ぶ':'tobu','遊ぶ':'asobu','笑う':'warau','泣く':'naku','歌う':'utau','待つ':'matsu','持つ':'motsu','取る':'toru','置く':'oku','開ける':'akeru','閉める':'shimeru','送る':'okuru','受ける':'ukeru','渡す':'watasu','貸す':'kasu','借りる':'kariru','教える':'oshieru','習う':'narau','覚える':'oboeru','忘れる':'wasureru','着る':'kiru','脱ぐ':'nugu','洗う':'arau','始める':'hajimeru','終わる':'owaru','止める':'tomeru','動く':'ugoku','変わる':'kawaru','住む':'sumu','通る':'tooru','急ぐ':'isogu','死ぬ':'shinu','建てる':'tateru','切る':'kiru','私':'watashi','僕':'boku','俺':'ore','これは':'kore wa','それは':'sore wa','あれは':'are wa','大きい':'ookii','小さい':'chiisai','高い':'takai','安い':'yasui','新しい':'atarashii','古い':'furui','長い':'nagai','短い':'mijikai','白い':'shiroi','黒い':'kuroi','赤い':'akai','青い':'aoi','明るい':'akarui','暗い':'kurai','弱い':'yowai','強い':'tsuyoi','優しい':'yasashii','多い':'ooi','少ない':'sukunai','早い':'hayai','速い':'hayai','遅い':'osoi','暑い':'atsui','寒い':'samui','暖かい':'atatakai','涼しい':'suzushii','重い':'omoi','軽い':'karui','広い':'hiroi','狭い':'semai','深い':'fukai','浅い':'asai','甘い':'amai','辛い':'karai','苦い':'nigai','楽しい':'tanoshii','嬉しい':'ureshii','悲しい':'kanashii','美しい':'utsukushii','面白い':'omoshiroi','つまらない':'tsumaranai','可愛い':'kawaii','きれい':'kirei','元気':'genki','大丈夫':'daijoubu','好き':'suki','嫌い':'kirai','有名':'yuumei','静か':'shizuka','賑やか':'nigiyaka','便利':'benri','大切':'taisetsu','日本':'nihon','日本人':'nihonjin','日本語':'nihongo','学生':'gakusei','学校':'gakkou','先生':'sensei','大学':'daigaku','会社':'kaisha','仕事':'shigoto','家族':'kazoku','今日':'kyou','明日':'ashita','昨日':'kinou','時間':'jikan','月曜日':'getsuyoubi','火曜日':'kayoubi','水曜日':'suiyoubi','木曜日':'mokuyoubi','金曜日':'kinyoubi','土曜日':'doyoubi','日曜日':'nichiyoubi','電車':'densha','自転車':'jitensha','飛行機':'hikouki','図書館':'toshokan','病院':'byouin','銀行':'ginkou','料理':'ryouri','水':'mizu','火':'hi','山':'yama','川':'kawa','空':'sora','海':'umi','またね':'mata ne','じゃあね':'jaa ne','どういたしまして':'dou itashimashite','ごめん':'gomen','トイレはどこですか':'toire wa doko desu ka','いくらですか':'ikura desu ka','わかりません':'wakarimasen','わかりました':'wakarimashita','たすけて':'tasukete','助けてください':'tasukete kudasai','どうぞ':'douzo','お願いします':'onegaishimasu'
};
// Context-safe corrections: never read 無事 or 祈る character-by-character.
KANJI_WORDS['無事']='buji'; KANJI_WORDS['祈る']='inoru'; KANJI_WORDS['無事を祈る']='buji o inoru'; KANJI_WORDS['無事を祈ります']='buji o inorimasu'; KANJI_WORDS['お仕事頑張ってください']='oshigoto ganbatte kudasai';

const localWordMeaning = {
  "おはよう":"Selamat pagi (kasual)","おはようございます":"Selamat pagi (sopan)","こんにちは":"Halo / selamat siang","こんばんは":"Selamat malam","おやすみ":"Selamat tidur","さようなら":"Selamat tinggal","またね":"Sampai jumpa","じゃあね":"Dadah","ありがとう":"Terima kasih (kasual)","ありがとうございます":"Terima kasih (sopan)","どういたしまして":"Sama-sama","すみません":"Permisi / maaf","ごめんなさい":"Maaf","ごめん":"Maaf (kasual)","はじめまして":"Salam kenal","よろしくお願いします":"Mohon bantuannya","いただきます":"Sebelum makan","ごちそうさまでした":"Terima kasih atas makanannya","いってきます":"Saya pergi dulu","いってらっしゃい":"Hati-hati di jalan","ただいま":"Saya sudah pulang","おかえりなさい":"Selamat datang kembali","おめでとう":"Selamat","お疲れ様です":"Terima kasih atas kerja kerasnya","失礼します":"Permisi","召し上がれ":"Silakan makan","食べる":"makan","食べます":"makan (sopan)","飲む":"minum","飲みます":"minum (sopan)","行く":"pergi","行きます":"pergi (sopan)","来る":"datang","来ます":"datang (sopan)","見る":"melihat","見ます":"melihat (sopan)","聞く":"mendengar / bertanya","読む":"membaca","書く":"menulis","話す":"berbicara","買う":"membeli","会う":"bertemu","作る":"membuat","使う":"menggunakan","働く":"bekerja","寝る":"tidur","起きる":"bangun","帰る":"pulang","言う":"mengatakan","思う":"berpikir","知る":"tahu","私":"saya","僕":"saya (pria)","俺":"saya (pria, kasual)","これは":"ini","それは":"itu","あれは":"itu (jauh)","大きい":"besar","小さい":"kecil","高い":"tinggi / mahal","安い":"murah","新しい":"baru","古い":"lama","長い":"panjang","短い":"pendek","白い":"putih","黒い":"hitam","赤い":"merah","青い":"biru","明るい":"terang","暗い":"gelap","弱い":"lemah","強い":"kuat","優しい":"baik hati","多い":"banyak","少ない":"sedikit","早い":"awal","速い":"cepat","遅い":"lambat","暑い":"panas","寒い":"dingin","暖かい":"hangat","涼しい":"sejuk","重い":"berat","軽い":"ringan","広い":"luas","狭い":"sempit","深い":"dalam","浅い":"dangkal","甘い":"manis","辛い":"pedas","苦い":"pahit","楽しい":"menyenangkan","嬉しい":"senang","悲しい":"sedih","美しい":"indah","面白い":"menarik","つまらない":"membosankan","可愛い":"lucu","きれい":"indah / bersih","元気":"sehat","大丈夫":"tidak apa-apa","好き":"suka","嫌い":"tidak suka","有名":"terkenal","静か":"tenang","賑やか":"ramai","便利":"praktis","大切":"penting","日本":"Jepang","日本人":"orang Jepang","日本語":"bahasa Jepang","学生":"pelajar","学校":"sekolah","先生":"guru","大学":"universitas","会社":"perusahaan","仕事":"pekerjaan","家族":"keluarga","今日":"hari ini","明日":"besok","昨日":"kemarin","時間":"waktu","月曜日":"Senin","火曜日":"Selasa","水曜日":"Rabu","木曜日":"Kamis","金曜日":"Jumat","土曜日":"Sabtu","日曜日":"Minggu","電車":"kereta","自転車":"sepeda","飛行機":"pesawat","図書館":"perpustakaan","病院":"rumah sakit","銀行":"bank","料理":"masakan","水":"air","火":"api","山":"gunung","川":"sungai","空":"langit","海":"laut","トイレはどこですか":"Di mana toiletnya?","いくらですか":"Berapa harganya?","わかりません":"Saya tidak mengerti","わかりました":"Saya mengerti","たすけて":"Tolong!","助けてください":"Tolong saya","どうぞ":"Silakan","お願いします":"Mohon","無事":"selamat; tanpa masalah","祈る":"berdoa; mendoakan","無事を祈る":"mendoakan keselamatan","無事を祈ります":"saya mendoakan keselamatan","お仕事頑張ってください":"Semangat bekerja; semoga lancar bekerja","お仕事":"pekerjaan (sopan)"
};


/* ===== Structured learning database =====
   Existing dictionary entries are preserved; these curated entries add explicit
   kana/POS/category/JLPT/formality/example metadata without guessing unknown fields.
*/
const CORE_VOCAB = [
['会う','あう','au','bertemu','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','友達に会います。','Tomodachi ni aimasu.','Saya bertemu teman.'],
['朝','あさ','asa','pagi','Kata benda','Waktu','N5','Neutral','毎朝七時に起きます。','Maiasa shichi-ji ni okimasu.','Saya bangun pukul tujuh setiap pagi.'],
['昼','ひる','hiru','siang','Kata benda','Waktu','N5','Neutral','昼にご飯を食べます。','Hiru ni gohan o tabemasu.','Saya makan siang.'],
['夜','よる','yoru','malam','Kata benda','Waktu','N5','Neutral','夜は家で勉強します。','Yoru wa ie de benkyou shimasu.','Malam hari saya belajar di rumah.'],
['毎日','まいにち','mainichi','setiap hari','Kata keterangan','Waktu & Frekuensi','N5','Neutral','毎日日本語を勉強します。','Mainichi nihongo o benkyou shimasu.','Saya belajar bahasa Jepang setiap hari.'],
['毎朝','まいあさ','maiasa','setiap pagi','Kata keterangan','Waktu & Frekuensi','N5','Neutral','毎朝コーヒーを飲みます。','Maiasa koohii o nomimasu.','Saya minum kopi setiap pagi.'],
['毎晩','まいばん','maiban','setiap malam','Kata keterangan','Waktu & Frekuensi','N5','Neutral','毎晩本を読みます。','Maiban hon o yomimasu.','Saya membaca buku setiap malam.'],
['週末','しゅうまつ','shuumatsu','akhir pekan','Kata benda','Waktu','N5','Neutral','週末に映画を見ます。','Shuumatsu ni eiga o mimasu.','Saya menonton film pada akhir pekan.'],
['朝ご飯','あさごはん','asagohan','sarapan','Kata benda','Makanan','N5','Neutral','朝ご飯を食べました。','Asagohan o tabemashita.','Saya sudah sarapan.'],
['昼ご飯','ひるごはん','hirugohan','makan siang','Kata benda','Makanan','N5','Neutral','昼ご飯は何ですか。','Hirugohan wa nan desu ka.','Apa makan siangnya?'],
['晩ご飯','ばんごはん','bangohan','makan malam','Kata benda','Makanan','N5','Neutral','晩ご飯を作ります。','Bangohan o tsukurimasu.','Saya membuat makan malam.'],
['食べ物','たべもの','tabemono','makanan','Kata benda','Makanan','N5','Neutral','好きな食べ物は何ですか。','Suki na tabemono wa nan desu ka.','Apa makanan yang kamu suka?'],
['飲み物','のみもの','nomimono','minuman','Kata benda','Minuman','N5','Neutral','飲み物はいかがですか。','Nomimono wa ikaga desu ka.','Mau minum apa?'],
['お水','おみず','omizu','air minum','Kata benda','Minuman','N5','Polite','お水をください。','Omizu o kudasai.','Tolong beri saya air.'],
['お茶','おちゃ','ocha','teh','Kata benda','Minuman','N5','Neutral','お茶を飲みます。','Ocha o nomimasu.','Saya minum teh.'],
['コーヒー','こーひー','koohii','kopi','Kata benda','Minuman','N5','Neutral','コーヒーをお願いします。','Koohii o onegaishimasu.','Kopi, tolong.'],
['牛乳','ぎゅうにゅう','gyuunyuu','susu','Kata benda','Minuman','N5','Neutral','毎朝牛乳を飲みます。','Maiasa gyuunyuu o nomimasu.','Saya minum susu setiap pagi.'],
['ご飯','ごはん','gohan','nasi; makanan','Kata benda','Makanan','N5','Neutral','ご飯を食べます。','Gohan o tabemasu.','Saya makan nasi.'],
['肉','にく','niku','daging','Kata benda','Makanan','N5','Neutral','肉を食べません。','Niku o tabemasen.','Saya tidak makan daging.'],
['魚','さかな','sakana','ikan','Kata benda','Makanan','N5','Neutral','魚が好きです。','Sakana ga suki desu.','Saya suka ikan.'],
['野菜','やさい','yasai','sayuran','Kata benda','Makanan','N5','Neutral','野菜を食べます。','Yasai o tabemasu.','Saya makan sayuran.'],
['果物','くだもの','kudamono','buah','Kata benda','Makanan','N5','Neutral','果物を買います。','Kudamono o kaimasu.','Saya membeli buah.'],
['卵','たまご','tamago','telur','Kata benda','Makanan','N5','Neutral','卵を二つ買いました。','Tamago o futatsu kaimashita.','Saya membeli dua telur.'],
['美味しい','おいしい','oishii','enak','Kata sifat -i','Makanan','N5','Neutral','この料理は美味しいです。','Kono ryouri wa oishii desu.','Masakan ini enak.'],
['まずい','まずい','mazui','tidak enak','Kata sifat -i','Makanan','N5','Neutral','この料理はまずいです。','Kono ryouri wa mazui desu.','Masakan ini tidak enak.'],
['甘い','あまい','amai','manis','Kata sifat -i','Makanan','N5','Neutral','このケーキは甘いです。','Kono keeki wa amai desu.','Kue ini manis.'],
['辛い','からい','karai','pedas','Kata sifat -i','Makanan','N5','Neutral','この料理は辛いです。','Kono ryouri wa karai desu.','Masakan ini pedas.'],
['塩辛い','しおからい','shiokarai','asin','Kata sifat -i','Makanan',null,'Neutral',null,null,null],
['お腹が空く','おなかがすく','onaka ga suku','menjadi lapar','Kata kerja','Aktivitas Sehari-hari',null,'Neutral','お腹が空きました。','Onaka ga sukimashita.','Saya lapar.'],
['喉が渇く','のどがかわく','nodo ga kawaku','menjadi haus','Kata kerja','Aktivitas Sehari-hari',null,'Neutral','喉が渇きました。','Nodo ga kawakimashita.','Saya haus.'],
['眠い','ねむい','nemui','mengantuk','Kata sifat -i','Perasaan & Emosi','N5','Neutral','今日は眠いです。','Kyou wa nemui desu.','Hari ini saya mengantuk.'],
['疲れる','つかれる','tsukareru','lelah','Kata kerja','Aktivitas Sehari-hari','N4','Neutral','今日は疲れました。','Kyou wa tsukaremashita.','Hari ini saya lelah.'],
['楽しい','たのしい','tanoshii','menyenangkan','Kata sifat -i','Perasaan & Emosi','N5','Neutral','日本語の勉強は楽しいです。','Nihongo no benkyou wa tanoshii desu.','Belajar bahasa Jepang menyenangkan.'],
['嬉しい','うれしい','ureshii','senang','Kata sifat -i','Perasaan & Emosi','N5','Neutral','とても嬉しいです。','Totemo ureshii desu.','Saya sangat senang.'],
['悲しい','かなしい','kanashii','sedih','Kata sifat -i','Perasaan & Emosi','N4','Neutral','少し悲しいです。','Sukoshi kanashii desu.','Saya sedikit sedih.'],
['心配','しんぱい','shinpai','khawatir','Kata benda / na-adjective','Perasaan & Emosi','N4','Neutral','心配しないでください。','Shinpai shinaide kudasai.','Jangan khawatir.'],
['元気','げんき','genki','sehat; bersemangat','Na-adjective','Perasaan & Emosi','N5','Neutral','お元気ですか。','O-genki desu ka.','Apa kabar?'],
['大丈夫','だいじょうぶ','daijoubu','tidak apa-apa; baik-baik saja','Na-adjective','Percakapan Sehari-hari','N5','Neutral','大丈夫です。','Daijoubu desu.','Tidak apa-apa.'],
['簡単','かんたん','kantan','mudah; sederhana','Na-adjective','Kata Sifat','N4','Neutral','この問題は簡単です。','Kono mondai wa kantan desu.','Soal ini mudah.'],
['難しい','むずかしい','muzukashii','sulit','Kata sifat -i','Kata Sifat','N4','Neutral','日本語は難しいです。','Nihongo wa muzukashii desu.','Bahasa Jepang sulit.'],
['便利','べんり','benri','praktis; nyaman','Na-adjective','Kata Sifat','N4','Neutral','このアプリは便利です。','Kono apuri wa benri desu.','Aplikasi ini praktis.'],
['静か','しずか','shizuka','tenang; sunyi','Na-adjective','Kata Sifat','N5','Neutral','この町は静かです。','Kono machi wa shizuka desu.','Kota ini tenang.'],
['賑やか','にぎやか','nigiyaka','ramai; meriah','Na-adjective','Kata Sifat','N5','Neutral','駅は賑やかです。','Eki wa nigiyaka desu.','Stasiun ramai.'],
['親切','しんせつ','shinsetsu','baik hati; ramah','Na-adjective','Kata Sifat','N4','Neutral','先生は親切です。','Sensei wa shinsetsu desu.','Guru itu baik hati.'],
['有名','ゆうめい','yuumei','terkenal','Na-adjective','Kata Sifat','N5','Neutral','京都は有名です。','Kyouto wa yuumei desu.','Kyoto terkenal.'],
['大切','たいせつ','taisetsu','penting; berharga','Na-adjective','Kata Sifat','N4','Neutral','家族は大切です。','Kazoku wa taisetsu desu.','Keluarga itu penting.'],
['必要','ひつよう','hitsuyou','perlu; diperlukan','Na-adjective / kata benda','Kehidupan Sosial','N4','Neutral','パスポートが必要です。','Pasupooto ga hitsuyou desu.','Paspor diperlukan.'],
['危ない','あぶない','abunai','berbahaya','Kata sifat -i','Kesehatan & Keselamatan','N5','Neutral','ここは危ないです。','Koko wa abunai desu.','Tempat ini berbahaya.'],
['痛い','いたい','itai','sakit','Kata sifat -i','Kesehatan & Tubuh','N5','Neutral','頭が痛いです。','Atama ga itai desu.','Kepala saya sakit.'],
['薬','くすり','kusuri','obat','Kata benda','Kesehatan & Tubuh','N5','Neutral','薬を飲みます。','Kusuri o nomimasu.','Saya minum obat.'],
['病気','びょうき','byouki','sakit; penyakit','Kata benda','Kesehatan & Tubuh','N5','Neutral','病気になりました。','Byouki ni narimashita.','Saya jatuh sakit.'],
['病院','びょういん','byouin','rumah sakit','Kata benda','Tempat','N5','Neutral','病院へ行きます。','Byouin e ikimasu.','Saya pergi ke rumah sakit.'],
['医者','いしゃ','isha','dokter','Kata benda','Pekerjaan & Profesi','N5','Neutral','医者に相談します。','Isha ni soudan shimasu.','Saya berkonsultasi dengan dokter.'],
['頭','あたま','atama','kepala','Kata benda','Bagian Tubuh','N5','Neutral','頭を洗います。','Atama o araimasu.','Saya mencuci kepala.'],
['顔','かお','kao','wajah','Kata benda','Bagian Tubuh','N5','Neutral','顔を洗います。','Kao o araimasu.','Saya mencuci wajah.'],
['目','め','me','mata','Kata benda','Bagian Tubuh','N5','Neutral','目が痛いです。','Me ga itai desu.','Mata saya sakit.'],
['耳','みみ','mimi','telinga','Kata benda','Bagian Tubuh','N5','Neutral',null,null,null],
['口','くち','kuchi','mulut','Kata benda','Bagian Tubuh','N5','Neutral',null,null,null],
['手','て','te','tangan','Kata benda','Bagian Tubuh','N5','Neutral',null,null,null],
['足','あし','ashi','kaki; tungkai','Kata benda','Bagian Tubuh','N5','Neutral','足が痛いです。','Ashi ga itai desu.','Kaki saya sakit.'],
['体','からだ','karada','tubuh','Kata benda','Bagian Tubuh','N5','Neutral','体に気をつけてください。','Karada ni ki o tsukete kudasai.','Jaga kesehatan tubuh.'],
['歯','は','ha','gigi','Kata benda','Bagian Tubuh','N5','Neutral','歯を磨きます。','Ha o migakimasu.','Saya menyikat gigi.'],
['学校','がっこう','gakkou','sekolah','Kata benda','Sekolah & Belajar','N5','Neutral','学校へ行きます。','Gakkou e ikimasu.','Saya pergi ke sekolah.'],
['大学','だいがく','daigaku','universitas','Kata benda','Sekolah & Belajar','N5','Neutral','大学で勉強しています。','Daigaku de benkyou shiteimasu.','Saya sedang belajar di universitas.'],
['教室','きょうしつ','kyoushitsu','ruang kelas','Kata benda','Sekolah & Belajar','N5','Neutral','教室に入ります。','Kyoushitsu ni hairimasu.','Saya masuk ke ruang kelas.'],
['学生','がくせい','gakusei','pelajar; mahasiswa','Kata benda','Sekolah & Belajar','N5','Neutral','私は学生です。','Watashi wa gakusei desu.','Saya seorang pelajar.'],
['生徒','せいと','seito','murid; siswa','Kata benda','Sekolah & Belajar','N5','Neutral',null,null,null],
['先生','せんせい','sensei','guru; dokter (sapaan)','Kata benda','Sekolah & Belajar','N5','Polite','先生に質問します。','Sensei ni shitsumon shimasu.','Saya bertanya kepada guru.'],
['授業','じゅぎょう','jugyou','pelajaran; kelas','Kata benda','Sekolah & Belajar','N4','Neutral','授業が始まります。','Jugyou ga hajimarimasu.','Pelajaran dimulai.'],
['宿題','しゅくだい','shukudai','pekerjaan rumah','Kata benda','Sekolah & Belajar','N5','Neutral','宿題をします。','Shukudai o shimasu.','Saya mengerjakan PR.'],
['質問','しつもん','shitsumon','pertanyaan','Kata benda','Sekolah & Belajar','N5','Neutral','質問があります。','Shitsumon ga arimasu.','Saya punya pertanyaan.'],
['答える','こたえる','kotaeru','menjawab','Kata kerja','Sekolah & Belajar','N5','Neutral','質問に答えます。','Shitsumon ni kotaemasu.','Saya menjawab pertanyaan.'],
['勉強する','べんきょうする','benkyou suru','belajar','Kata kerja','Sekolah & Belajar','N5','Neutral','毎日勉強します。','Mainichi benkyou shimasu.','Saya belajar setiap hari.'],
['読む','よむ','yomu','membaca','Kata kerja','Sekolah & Belajar','N5','Neutral','本を読みます。','Hon o yomimasu.','Saya membaca buku.'],
['書く','かく','kaku','menulis','Kata kerja','Sekolah & Belajar','N5','Neutral','名前を書きます。','Namae o kakimasu.','Saya menulis nama.'],
['聞く','きく','kiku','mendengar; bertanya','Kata kerja','Percakapan Sehari-hari','N5','Neutral','先生に聞きます。','Sensei ni kikimasu.','Saya bertanya kepada guru.'],
['話す','はなす','hanasu','berbicara','Kata kerja','Percakapan Sehari-hari','N5','Neutral','日本語を話します。','Nihongo o hanashimasu.','Saya berbicara bahasa Jepang.'],
['言う','いう','iu','mengatakan','Kata kerja','Percakapan Sehari-hari','N5','Neutral','名前を言います。','Namae o iimasu.','Saya menyebutkan nama.'],
['思う','おもう','omou','berpikir; merasa','Kata kerja','Percakapan Sehari-hari','N4','Neutral','そう思います。','Sou omoimasu.','Saya pikir begitu.'],
['知る','しる','shiru','mengetahui','Kata kerja','Percakapan Sehari-hari','N5','Neutral','それを知りません。','Sore o shirimasen.','Saya tidak tahu itu.'],
['分かる','わかる','wakaru','mengerti; memahami','Kata kerja','Percakapan Sehari-hari','N5','Neutral','日本語が分かります。','Nihongo ga wakarimasu.','Saya mengerti bahasa Jepang.'],
['使う','つかう','tsukau','menggunakan','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','このペンを使います。','Kono pen o tsukaimasu.','Saya menggunakan pena ini.'],
['作る','つくる','tsukuru','membuat','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','料理を作ります。','Ryouri o tsukurimasu.','Saya memasak.'],
['買う','かう','kau','membeli','Kata kerja','Belanja','N5','Neutral','スーパーで買います。','Suupaa de kaimasu.','Saya membeli di supermarket.'],
['売る','うる','uru','menjual','Kata kerja','Belanja','N5','Neutral','店で野菜を売ります。','Mise de yasai o urimasu.','Saya menjual sayuran di toko.'],
['借りる','かりる','kariru','meminjam','Kata kerja','Sekolah & Belajar','N5','Neutral','本を借ります。','Hon o karimasu.','Saya meminjam buku.'],
['貸す','かす','kasu','meminjamkan','Kata kerja','Kehidupan Sosial','N5','Neutral','友達にペンを貸します。','Tomodachi ni pen o kashimasu.','Saya meminjamkan pena kepada teman.'],
['教える','おしえる','oshieru','mengajar; memberi tahu','Kata kerja','Sekolah & Belajar','N5','Neutral','日本語を教えます。','Nihongo o oshiemasu.','Saya mengajar bahasa Jepang.'],
['習う','ならう','narau','belajar dari seseorang','Kata kerja','Sekolah & Belajar','N5','Neutral','先生に日本語を習います。','Sensei ni nihongo o naraimasu.','Saya belajar bahasa Jepang dari guru.'],
['覚える','おぼえる','oboeru','mengingat; menghafal','Kata kerja','Sekolah & Belajar','N5','Neutral','新しい言葉を覚えます。','Atarashii kotoba o oboemasu.','Saya menghafal kata baru.'],
['忘れる','わすれる','wasureru','lupa','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','宿題を忘れました。','Shukudai o wasuremashita.','Saya lupa PR.'],
['開ける','あける','akeru','membuka','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','ドアを開けます。','Doa o akemasu.','Saya membuka pintu.'],
['閉める','しめる','shimeru','menutup','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','窓を閉めます。','Mado o shimemasu.','Saya menutup jendela.'],
['入る','はいる','hairu','masuk','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','部屋に入ります。','Heya ni hairimasu.','Saya masuk kamar.'],
['出る','でる','deru','keluar; pergi keluar','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','家を出ます。','Ie o demasu.','Saya keluar rumah.'],
['座る','すわる','suwaru','duduk','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','ここに座ってください。','Koko ni suwatte kudasai.','Silakan duduk di sini.'],
['立つ','たつ','tatsu','berdiri','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','ここに立ちます。','Koko ni tachimasu.','Saya berdiri di sini.'],
['歩く','あるく','aruku','berjalan','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','駅まで歩きます。','Eki made arukimasu.','Saya berjalan sampai stasiun.'],
['走る','はしる','hashiru','berlari','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','公園で走ります。','Kouen de hashirimasu.','Saya berlari di taman.'],
['泳ぐ','およぐ','oyogu','berenang','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','プールで泳ぎます。','Puuru de oyogimasu.','Saya berenang di kolam.'],
['料理する','りょうりする','ryouri suru','memasak','Kata kerja','Makanan','N5','Neutral','週末に料理します。','Shuumatsu ni ryouri shimasu.','Saya memasak pada akhir pekan.'],
['洗う','あらう','arau','mencuci','Kata kerja','Rumah','N5','Neutral','手を洗います。','Te o araimasu.','Saya mencuci tangan.'],
['掃除する','そうじする','souji suru','membersihkan','Kata kerja','Rumah','N5','Neutral','部屋を掃除します。','Heya o souji shimasu.','Saya membersihkan kamar.'],
['働く','はたらく','hataraku','bekerja','Kata kerja','Pekerjaan & Profesi','N5','Neutral','会社で働いています。','Kaisha de hataraiteimasu.','Saya bekerja di perusahaan.'],
['休む','やすむ','yasumu','beristirahat; libur','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','今日は休みます。','Kyou wa yasumimasu.','Hari ini saya beristirahat.'],
['寝る','ねる','neru','tidur','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','十一時に寝ます。','Juuichi-ji ni nemasu.','Saya tidur pukul sebelas.'],
['起きる','おきる','okiru','bangun','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','六時に起きます。','Roku-ji ni okimasu.','Saya bangun pukul enam.'],
['帰る','かえる','kaeru','pulang','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','六時に帰ります。','Roku-ji ni kaerimasu.','Saya pulang pukul enam.'],
['来る','くる','kuru','datang','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','友達が来ます。','Tomodachi ga kimasu.','Teman datang.'],
['行く','いく','iku','pergi','Kata kerja','Transportasi','N5','Neutral','学校へ行きます。','Gakkou e ikimasu.','Saya pergi ke sekolah.'],
['乗る','のる','noru','naik; menaiki','Kata kerja','Transportasi','N5','Neutral','電車に乗ります。','Densha ni norimasu.','Saya naik kereta.'],
['降りる','おりる','oriru','turun dari kendaraan','Kata kerja','Transportasi','N5','Neutral','駅で電車を降ります。','Eki de densha o orimasu.','Saya turun dari kereta di stasiun.'],
['着く','つく','tsuku','tiba','Kata kerja','Transportasi','N5','Neutral','駅に着きました。','Eki ni tsukimashita.','Saya sudah tiba di stasiun.'],
['出発する','しゅっぱつする','shuppatsu suru','berangkat','Kata kerja','Perjalanan','N4','Neutral','八時に出発します。','Hachi-ji ni shuppatsu shimasu.','Berangkat pukul delapan.'],
['到着する','とうちゃくする','touchaku suru','tiba','Kata kerja','Perjalanan','N4','Neutral','東京に到着しました。','Toukyou ni touchaku shimashita.','Saya sudah tiba di Tokyo.'],
['駅','えき','eki','stasiun','Kata benda','Transportasi','N5','Neutral','駅はどこですか。','Eki wa doko desu ka.','Di mana stasiunnya?'],
['電車','でんしゃ','densha','kereta listrik','Kata benda','Transportasi','N5','Neutral','電車で行きます。','Densha de ikimasu.','Saya pergi naik kereta.'],
['地下鉄','ちかてつ','chikatetsu','kereta bawah tanah','Kata benda','Transportasi','N5','Neutral',null,null,null],
['バス','ばす','basu','bus','Kata benda','Transportasi','N5','Neutral','バスで行きます。','Basu de ikimasu.','Saya pergi naik bus.'],
['タクシー','たくしー','takushii','taksi','Kata benda','Transportasi','N5','Neutral',null,null,null],
['自転車','じてんしゃ','jitensha','sepeda','Kata benda','Transportasi','N5','Neutral','自転車で学校へ行きます。','Jitensha de gakkou e ikimasu.','Saya pergi ke sekolah naik sepeda.'],
['飛行機','ひこうき','hikouki','pesawat','Kata benda','Transportasi','N5','Neutral',null,null,null],
['車','くるま','kuruma','mobil; kendaraan','Kata benda','Transportasi','N5','Neutral',null,null,null],
['切符','きっぷ','kippu','tiket','Kata benda','Perjalanan','N5','Neutral','切符を買います。','Kippu o kaimasu.','Saya membeli tiket.'],
['空港','くうこう','kuukou','bandara','Kata benda','Tempat','N4','Neutral',null,null,null],
['ホテル','ほてる','hoteru','hotel','Kata benda','Tempat','N5','Neutral','ホテルに泊まります。','Hoteru ni tomarimasu.','Saya menginap di hotel.'],
['家','いえ','ie','rumah','Kata benda','Rumah','N5','Neutral','家に帰ります。','Ie ni kaerimasu.','Saya pulang ke rumah.'],
['部屋','へや','heya','kamar; ruangan','Kata benda','Rumah','N5','Neutral','部屋を掃除します。','Heya o souji shimasu.','Saya membersihkan kamar.'],
['台所','だいどころ','daidokoro','dapur','Kata benda','Rumah','N5','Neutral',null,null,null],
['玄関','げんかん','genkan','pintu masuk rumah','Kata benda','Rumah','N4','Neutral',null,null,null],
['窓','まど','mado','jendela','Kata benda','Rumah','N5','Neutral','窓を開けます。','Mado o akemasu.','Saya membuka jendela.'],
['ドア','どあ','doa','pintu','Kata benda','Rumah','N5','Neutral',null,null,null],
['机','つくえ','tsukue','meja belajar','Kata benda','Rumah','N5','Neutral',null,null,null],
['椅子','いす','isu','kursi','Kata benda','Rumah','N5','Neutral',null,null,null],
['冷蔵庫','れいぞうこ','reizouko','kulkas','Kata benda','Rumah','N5','Neutral',null,null,null],
['公園','こうえん','kouen','taman','Kata benda','Tempat','N5','Neutral','公園で散歩します。','Kouen de sanpo shimasu.','Saya berjalan-jalan di taman.'],
['銀行','ぎんこう','ginkou','bank','Kata benda','Tempat','N5','Neutral',null,null,null],
['郵便局','ゆうびんきょく','yuubinkyoku','kantor pos','Kata benda','Tempat','N4','Neutral',null,null,null],
['図書館','としょかん','toshokan','perpustakaan','Kata benda','Tempat','N5','Neutral','図書館で本を読みます。','Toshokan de hon o yomimasu.','Saya membaca buku di perpustakaan.'],
['店','みせ','mise','toko','Kata benda','Belanja','N5','Neutral',null,null,null],
['スーパー','すーぱー','suupaa','supermarket','Kata benda','Belanja','N5','Neutral','スーパーで買い物します。','Suupaa de kaimono shimasu.','Saya berbelanja di supermarket.'],
['コンビニ','こんびに','konbini','minimarket','Kata benda','Belanja','N4','Neutral',null,null,null],
['レストラン','れすとらん','resutoran','restoran','Kata benda','Restoran','N5','Neutral','レストランで食べます。','Resutoran de tabemasu.','Saya makan di restoran.'],
['メニュー','めにゅー','menyuu','menu','Kata benda','Restoran','N4','Neutral','メニューを見せてください。','Menyuu o misete kudasai.','Tolong tunjukkan menunya.'],
['値段','ねだん','nedan','harga','Kata benda','Belanja','N4','Neutral','値段はいくらですか。','Nedan wa ikura desu ka.','Berapa harganya?'],
['安い','やすい','yasui','murah','Kata sifat -i','Belanja','N5','Neutral','この店は安いです。','Kono mise wa yasui desu.','Toko ini murah.'],
['高い','たかい','takai','tinggi; mahal','Kata sifat -i','Belanja','N5','Neutral','この靴は高いです。','Kono kutsu wa takai desu.','Sepatu ini mahal.'],
['店員','てんいん','tenin','pegawai toko','Kata benda','Belanja','N4','Polite',null,null,null],
['仕事','しごと','shigoto','pekerjaan','Kata benda','Pekerjaan & Profesi','N5','Neutral','仕事があります。','Shigoto ga arimasu.','Saya punya pekerjaan.'],
['会社','かいしゃ','kaisha','perusahaan; kantor','Kata benda','Pekerjaan & Profesi','N5','Neutral','会社で働きます。','Kaisha de hatarakimasu.','Saya bekerja di perusahaan.'],
['会社員','かいしゃいん','kaishain','karyawan perusahaan','Kata benda','Pekerjaan & Profesi','N4','Neutral',null,null,null],
['社員','しゃいん','shain','karyawan; staf','Kata benda','Pekerjaan & Profesi','N4','Neutral',null,null,null],
['社長','しゃちょう','shachou','direktur; presiden perusahaan','Kata benda','Pekerjaan & Profesi','N4','Neutral',null,null,null],
['警察官','けいさつかん','keisatsukan','polisi','Kata benda','Pekerjaan & Profesi','N4','Neutral',null,null,null],
['看護師','かんごし','kangoshi','perawat','Kata benda','Pekerjaan & Profesi',null,'Neutral',null,null,null],
['医者','いしゃ','isha','dokter','Kata benda','Pekerjaan & Profesi','N5','Neutral',null,null,null],
['先生','せんせい','sensei','guru; dokter (sapaan)','Kata benda','Pekerjaan & Profesi','N5','Polite',null,null,null],
['学生','がくせい','gakusei','pelajar; mahasiswa','Kata benda','Sekolah & Belajar','N5','Neutral',null,null,null],
['趣味','しゅみ','shumi','hobi','Kata benda','Hobi','N4','Neutral','趣味は音楽です。','Shumi wa ongaku desu.','Hobi saya adalah musik.'],
['音楽','おんがく','ongaku','musik','Kata benda','Hobi','N5','Neutral','音楽を聞きます。','Ongaku o kikimasu.','Saya mendengarkan musik.'],
['映画','えいが','eiga','film','Kata benda','Hobi','N5','Neutral','映画を見ます。','Eiga o mimasu.','Saya menonton film.'],
['写真','しゃしん','shashin','foto','Kata benda','Hobi','N5','Neutral','写真を撮ります。','Shashin o torimasu.','Saya mengambil foto.'],
['旅行','りょこう','ryokou','perjalanan; wisata','Kata benda','Perjalanan','N5','Neutral','日本へ旅行します。','Nihon e ryokou shimasu.','Saya bepergian ke Jepang.'],
['天気','てんき','tenki','cuaca','Kata benda','Cuaca & Alam','N5','Neutral','今日はいい天気です。','Kyou wa ii tenki desu.','Cuaca hari ini bagus.'],
['雨','あめ','ame','hujan','Kata benda','Cuaca & Alam','N5','Neutral','今日は雨です。','Kyou wa ame desu.','Hari ini hujan.'],
['雪','ゆき','yuki','salju','Kata benda','Cuaca & Alam','N5','Neutral',null,null,null],
['風','かぜ','kaze','angin','Kata benda','Cuaca & Alam','N5','Neutral',null,null,null],
['暑い','あつい','atsui','panas (cuaca)','Kata sifat -i','Cuaca & Alam','N5','Neutral','今日は暑いです。','Kyou wa atsui desu.','Hari ini panas.'],
['寒い','さむい','samui','dingin (cuaca)','Kata sifat -i','Cuaca & Alam','N5','Neutral','今日は寒いです。','Kyou wa samui desu.','Hari ini dingin.'],
['暖かい','あたたかい','atatakai','hangat','Kata sifat -i','Cuaca & Alam','N5','Neutral','今日は暖かいです。','Kyou wa atatakai desu.','Hari ini hangat.'],
['涼しい','すずしい','suzushii','sejuk','Kata sifat -i','Cuaca & Alam','N5','Neutral','風が涼しいです。','Kaze ga suzushii desu.','Anginnya sejuk.'],
['山','やま','yama','gunung','Kata benda','Cuaca & Alam','N5','Neutral',null,null,null],
['海','うみ','umi','laut','Kata benda','Cuaca & Alam','N5','Neutral',null,null,null],
['川','かわ','kawa','sungai','Kata benda','Cuaca & Alam','N5','Neutral',null,null,null],
['空','そら','sora','langit','Kata benda','Cuaca & Alam','N5','Neutral',null,null,null],
['春','はる','haru','musim semi','Kata benda','Waktu','N5','Neutral',null,null,null],
['夏','なつ','natsu','musim panas','Kata benda','Waktu','N5','Neutral',null,null,null],
['秋','あき','aki','musim gugur','Kata benda','Waktu','N5','Neutral',null,null,null],
['冬','ふゆ','fuyu','musim dingin','Kata benda','Waktu','N5','Neutral',null,null,null],
['何','なに','nani','apa','Kata tanya','Kata Tanya','N5','Neutral','これは何ですか。','Kore wa nan desu ka.','Ini apa?'],
['誰','だれ','dare','siapa','Kata tanya','Kata Tanya','N5','Neutral','あの人は誰ですか。','Ano hito wa dare desu ka.','Siapa orang itu?'],
['どこ','どこ','doko','di mana','Kata tanya','Kata Tanya','N5','Neutral','トイレはどこですか。','Toire wa doko desu ka.','Di mana toiletnya?'],
['いつ','いつ','itsu','kapan','Kata tanya','Kata Tanya','N5','Neutral','いつ日本へ行きますか。','Itsu Nihon e ikimasu ka.','Kapan pergi ke Jepang?'],
['なぜ','なぜ','naze','mengapa','Kata tanya','Kata Tanya','N5','Neutral','なぜですか。','Naze desu ka.','Mengapa?'],
['どうして','どうして','doushite','mengapa; kenapa','Kata tanya','Kata Tanya','N5','Neutral','どうして遅れましたか。','Doushite okuremashita ka.','Kenapa terlambat?'],
['どう','どう','dou','bagaimana','Kata tanya','Kata Tanya','N5','Neutral','これはどうですか。','Kore wa dou desu ka.','Bagaimana menurutmu tentang ini?'],
['どれ','どれ','dore','yang mana','Kata tanya','Kata Tanya','N5','Neutral','どれが好きですか。','Dore ga suki desu ka.','Yang mana yang kamu suka?'],
['どの','どの','dono','yang mana + kata benda','Kata tanya','Kata Tanya','N5','Neutral','どの本ですか。','Dono hon desu ka.','Buku yang mana?'],
['いくら','いくら','ikura','berapa harga','Kata tanya','Kata Tanya','N5','Neutral','これはいくらですか。','Kore wa ikura desu ka.','Ini berapa harganya?'],
['いくつ','いくつ','ikutsu','berapa banyak; umur berapa','Kata tanya','Kata Tanya','N5','Neutral','りんごはいくつありますか。','Ringo wa ikutsu arimasu ka.','Ada berapa apel?'],
['何時','なんじ','nanji','jam berapa','Kata tanya','Waktu','N5','Neutral','今何時ですか。','Ima nanji desu ka.','Sekarang jam berapa?'],
['何曜日','なんようび','nanyoubi','hari apa','Kata tanya','Waktu','N5','Neutral','今日は何曜日ですか。','Kyou wa nanyoubi desu ka.','Hari ini hari apa?'],
['今日','きょう','kyou','hari ini','Kata benda','Waktu','N5','Neutral',null,null,null],
['明日','あした','ashita','besok','Kata benda','Waktu','N5','Neutral',null,null,null],
['昨日','きのう','kinou','kemarin','Kata benda','Waktu','N5','Neutral',null,null,null],
['今週','こんしゅう','konshuu','minggu ini','Kata benda','Waktu','N5','Neutral',null,null,null],
['来週','らいしゅう','raishuu','minggu depan','Kata benda','Waktu','N5','Neutral',null,null,null],
['先週','せんしゅう','senshuu','minggu lalu','Kata benda','Waktu','N5','Neutral',null,null,null],
['今月','こんげつ','kongetsu','bulan ini','Kata benda','Waktu','N5','Neutral',null,null,null],
['来月','らいげつ','raigetsu','bulan depan','Kata benda','Waktu','N5','Neutral',null,null,null],
['先月','せんげつ','sengetsu','bulan lalu','Kata benda','Waktu','N5','Neutral',null,null,null],
['今年','ことし','kotoshi','tahun ini','Kata benda','Waktu','N5','Neutral',null,null,null],
['来年','らいねん','rainen','tahun depan','Kata benda','Waktu','N5','Neutral',null,null,null],
['去年','きょねん','kyonen','tahun lalu','Kata benda','Waktu','N5','Neutral',null,null,null],
['時間','じかん','jikan','waktu; durasi','Kata benda','Waktu','N5','Neutral',null,null,null],
['今朝','けさ','kesa','pagi ini','Kata benda','Waktu','N5','Neutral',null,null,null],
['今晩','こんばん','konban','malam ini','Kata benda','Waktu','N5','Neutral',null,null,null],
['いつも','いつも','itsumo','selalu','Kata keterangan','Waktu & Frekuensi','N5','Neutral',null,null,null],
['時々','ときどき','tokidoki','kadang-kadang','Kata keterangan','Waktu & Frekuensi','N5','Neutral',null,null,null],
['たまに','たまに','tamani','sesekali','Kata keterangan','Waktu & Frekuensi','N4','Neutral',null,null,null],
['すぐに','すぐに','suguni','segera','Kata keterangan','Waktu & Frekuensi','N5','Neutral',null,null,null],
['とても','とても','totemo','sangat','Kata keterangan','Kata Keterangan','N5','Neutral',null,null,null],
['少し','すこし','sukoshi','sedikit','Kata keterangan','Kata Keterangan','N5','Neutral',null,null,null],
['たくさん','たくさん','takusan','banyak','Kata keterangan','Kata Keterangan','N5','Neutral',null,null,null],
['全部','ぜんぶ','zenbu','semua','Kata benda/keterangan','Kata Keterangan','N5','Neutral',null,null,null],
['一緒','いっしょ','issho','bersama','Kata benda/keterangan','Percakapan Sehari-hari','N5','Neutral','一緒に行きましょう。','Issho ni ikimashou.','Mari pergi bersama.'],
['名前','なまえ','namae','nama','Kata benda','Perkenalan','N5','Neutral','お名前は何ですか。','O-namae wa nan desu ka.','Siapa nama Anda?'],
['友達','ともだち','tomodachi','teman','Kata benda','Kehidupan Sosial','N5','Neutral','友達と話します。','Tomodachi to hanashimasu.','Saya berbicara dengan teman.'],
['家族','かぞく','kazoku','keluarga','Kata benda','Keluarga','N5','Neutral','家族と住んでいます。','Kazoku to sundeimasu.','Saya tinggal bersama keluarga.'],
['父','ちち','chichi','ayah (sendiri)','Kata benda','Keluarga','N5','Neutral','父は会社員です。','Chichi wa kaishain desu.','Ayah saya adalah karyawan perusahaan.'],
['母','はは','haha','ibu (sendiri)','Kata benda','Keluarga','N5','Neutral','母は料理が好きです。','Haha wa ryouri ga suki desu.','Ibu saya suka memasak.'],
['お父さん','おとうさん','otousan','ayah (sapaan/keluarga orang lain)','Kata benda','Keluarga','N5','Polite',null,null,null],
['お母さん','おかあさん','okaasan','ibu (sapaan/keluarga orang lain)','Kata benda','Keluarga','N5','Polite',null,null,null],
['兄','あに','ani','kakak laki-laki (sendiri)','Kata benda','Keluarga','N5','Neutral',null,null,null],
['姉','あね','ane','kakak perempuan (sendiri)','Kata benda','Keluarga','N5','Neutral',null,null,null],
['弟','おとうと','otouto','adik laki-laki','Kata benda','Keluarga','N5','Neutral',null,null,null],
['妹','いもうと','imouto','adik perempuan','Kata benda','Keluarga','N5','Neutral',null,null,null],
['夫','おっと','otto','suami (sendiri)','Kata benda','Keluarga','N4','Neutral',null,null,null],
['妻','つま','tsuma','istri (sendiri)','Kata benda','Keluarga','N4','Neutral',null,null,null],
['子供','こども','kodomo','anak','Kata benda','Keluarga','N5','Neutral',null,null,null],
['男の子','おとこのこ','otokonoko','anak laki-laki','Kata benda','Keluarga','N5','Neutral',null,null,null],
['女の子','おんなのこ','onnanoko','anak perempuan','Kata benda','Keluarga','N5','Neutral',null,null,null],
['祖父','そふ','sofu','kakek (sendiri)','Kata benda','Keluarga','N4','Neutral',null,null,null],
['祖母','そぼ','sobo','nenek (sendiri)','Kata benda','Keluarga','N4','Neutral',null,null,null],
['おじいさん','おじいさん','ojiisan','kakek; pria lanjut usia','Kata benda','Keluarga','N5','Polite',null,null,null],
['おばあさん','おばあさん','obaasan','nenek; wanita lanjut usia','Kata benda','Keluarga','N5','Polite',null,null,null],
['会社員','かいしゃいん','kaishain','karyawan perusahaan','Kata benda','Pekerjaan & Profesi','N4','Neutral',null,null,null],
['運転手','うんてんしゅ','untenshu','sopir','Kata benda','Pekerjaan & Profesi','N5','Neutral',null,null,null],
['警官','けいかん','keikan','polisi','Kata benda','Pekerjaan & Profesi','N5','Neutral',null,null,null],
['店長','てんちょう','tenchou','kepala toko','Kata benda','Pekerjaan & Profesi',null,'Neutral',null,null,null],
['部長','ぶちょう','buchou','kepala departemen','Kata benda','Pekerjaan & Profesi',null,'Neutral',null,null,null],
['社長','しゃちょう','shachou','direktur perusahaan','Kata benda','Pekerjaan & Profesi','N4','Neutral',null,null,null],
['プログラマー','ぷろぐらまー','puroguramaa','programmer','Kata benda','Pekerjaan & Profesi',null,'Neutral',null,null,null],
['エンジニア','えんじにあ','enjinia','insinyur; engineer','Kata benda','Pekerjaan & Profesi',null,'Neutral',null,null,null],
['店','みせ','mise','toko','Kata benda','Belanja','N5','Neutral',null,null,null],
['買い物','かいもの','kaimono','belanja','Kata benda','Belanja','N5','Neutral','買い物に行きます。','Kaimono ni ikimasu.','Saya pergi berbelanja.'],
['お金','おかね','okane','uang','Kata benda','Belanja','N5','Neutral','お金があります。','Okane ga arimasu.','Saya punya uang.'],
['財布','さいふ','saifu','dompet','Kata benda','Belanja','N5','Neutral',null,null,null],
['カード','かーど','kaado','kartu','Kata benda','Belanja',null,'Neutral',null,null,null],
['現金','げんきん','genkin','uang tunai','Kata benda','Belanja','N4','Neutral',null,null,null],
['レシート','れしーと','reshiito','struk','Kata benda','Belanja',null,'Neutral',null,null,null],
['色','いろ','iro','warna','Kata benda','Warna','N5','Neutral','好きな色は何ですか。','Suki na iro wa nan desu ka.','Warna favoritmu apa?'],
['赤い','あかい','akai','merah','Kata sifat -i','Warna','N5','Neutral',null,null,null],
['青い','あおい','aoi','biru','Kata sifat -i','Warna','N5','Neutral',null,null,null],
['白い','しろい','shiroi','putih','Kata sifat -i','Warna','N5','Neutral',null,null,null],
['黒い','くろい','kuroi','hitam','Kata sifat -i','Warna','N5','Neutral',null,null,null],
['黄色い','きいろい','kiiroi','kuning','Kata sifat -i','Warna','N5','Neutral',null,null,null],
['茶色','ちゃいろ','chairo','cokelat','Kata benda','Warna','N5','Neutral',null,null,null],
['大きい','おおきい','ookii','besar','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['小さい','ちいさい','chiisai','kecil','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['新しい','あたらしい','atarashii','baru','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['古い','ふるい','furui','lama; tua (benda)','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['長い','ながい','nagai','panjang','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['短い','みじかい','mijikai','pendek','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['早い','はやい','hayai','awal; cepat (waktu)','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['速い','はやい','hayai','cepat (kecepatan)','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['遅い','おそい','osoi','lambat; terlambat','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['重い','おもい','omoi','berat','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['軽い','かるい','karui','ringan','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['広い','ひろい','hiroi','luas','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['狭い','せまい','semai','sempit','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['深い','ふかい','fukai','dalam','Kata sifat -i','Kata Sifat','N4','Neutral',null,null,null],
['浅い','あさい','asai','dangkal','Kata sifat -i','Kata Sifat','N4','Neutral',null,null,null],
['強い','つよい','tsuyoi','kuat','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['弱い','よわい','yowai','lemah','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['優しい','やさしい','yasashii','baik hati; lembut','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['面白い','おもしろい','omoshiroi','menarik; lucu','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['可愛い','かわいい','kawaii','lucu; menggemaskan','Kata sifat -i','Kata Sifat','N5','Neutral',null,null,null],
['嫌い','きらい','kirai','tidak suka; benci','Na-adjective','Perasaan & Emosi','N5','Neutral',null,null,null],
['好き','すき','suki','suka','Na-adjective','Perasaan & Emosi','N5','Neutral','日本語が好きです。','Nihongo ga suki desu.','Saya suka bahasa Jepang.'],
['暇','ひま','hima','senggang; tidak sibuk','Na-adjective','Perasaan & Emosi','N5','Neutral',null,null,null],
['忙しい','いそがしい','isogashii','sibuk','Kata sifat -i','Aktivitas Sehari-hari','N5','Neutral','今日は忙しいです。','Kyou wa isogashii desu.','Hari ini sibuk.'],
['上手','じょうず','jouzu','pandai; mahir','Na-adjective','Kemampuan','N5','Neutral','日本語が上手ですね。','Nihongo ga jouzu desu ne.','Bahasa Jepangnya bagus/mahir ya.'],
['下手','へた','heta','tidak mahir','Na-adjective','Kemampuan','N4','Neutral','私は料理が下手です。','Watashi wa ryouri ga heta desu.','Saya tidak pandai memasak.'],
['大好き','だいすき','daisuki','sangat suka','Na-adjective','Perasaan & Emosi','N5','Neutral',null,null,null],
['本','ほん','hon','buku','Kata benda','Sekolah & Belajar','N5','Neutral','本を読みます。','Hon o yomimasu.','Saya membaca buku.'],
['辞書','じしょ','jisho','kamus','Kata benda','Sekolah & Belajar','N5','Neutral','辞書を使います。','Jisho o tsukaimasu.','Saya menggunakan kamus.'],
['鉛筆','えんぴつ','enpitsu','pensil','Kata benda','Sekolah & Belajar','N5','Neutral',null,null,null],
['ペン','ぺん','pen','pena','Kata benda','Sekolah & Belajar','N5','Neutral',null,null,null],
['ノート','のーと','nooto','buku catatan','Kata benda','Sekolah & Belajar','N5','Neutral',null,null,null],
['問題','もんだい','mondai','soal; masalah','Kata benda','Sekolah & Belajar','N5','Neutral',null,null,null],
['試験','しけん','shiken','ujian','Kata benda','Sekolah & Belajar','N4','Neutral','明日試験があります。','Ashita shiken ga arimasu.','Besok ada ujian.'],
['合格','ごうかく','goukaku','lulus; kelulusan','Kata benda','Sekolah & Belajar',null,'Neutral',null,null,null],
['練習','れんしゅう','renshuu','latihan','Kata benda','Sekolah & Belajar','N4','Neutral','毎日練習します。','Mainichi renshuu shimasu.','Saya berlatih setiap hari.'],
['準備','じゅんび','junbi','persiapan; mempersiapkan','Kata benda / suru','Aktivitas Sehari-hari','N4','Neutral','旅行の準備をします。','Ryokou no junbi o shimasu.','Saya menyiapkan perjalanan.'],
['紹介','しょうかい','shoukai','perkenalan; memperkenalkan','Kata benda / suru','Perkenalan','N4','Neutral','友達を紹介します。','Tomodachi o shoukai shimasu.','Saya memperkenalkan teman.'],
['約束','やくそく','yakusoku','janji','Kata benda / suru','Kehidupan Sosial','N4','Neutral','約束を守ります。','Yakusoku o mamorimasu.','Saya menepati janji.'],
['必要','ひつよう','hitsuyou','perlu','Na-adjective','Kata Keterangan','N4','Neutral',null,null,null],
['本当','ほんとう','hontou','benar; sungguh','Na-adjective','Percakapan Sehari-hari','N4','Neutral','本当ですか。','Hontou desu ka.','Benarkah?'],
['多分','たぶん','tabun','mungkin','Kata keterangan','Kata Keterangan','N5','Neutral','多分大丈夫です。','Tabun daijoubu desu.','Mungkin tidak apa-apa.'],
['もちろん','もちろん','mochiron','tentu saja','Kata keterangan','Percakapan Sehari-hari','N4','Neutral',null,null,null],
['ちょっと','ちょっと','chotto','sedikit; sebentar','Kata keterangan','Percakapan Sehari-hari','N5','Neutral','ちょっと待ってください。','Chotto matte kudasai.','Tolong tunggu sebentar.'],
['まだ','まだ','mada','masih; belum','Kata keterangan','Waktu & Frekuensi','N5','Neutral','まだ食べていません。','Mada tabeteimasen.','Saya belum makan.'],
['もう','もう','mou','sudah; lagi','Kata keterangan','Waktu & Frekuensi','N5','Neutral','もう帰ります。','Mou kaerimasu.','Saya akan pulang sekarang.'],
['一度','いちど','ichido','sekali','Kata benda/keterangan','Waktu & Frekuensi','N4','Neutral','もう一度お願いします。','Mou ichido onegaishimasu.','Tolong sekali lagi.'],
['初めて','はじめて','hajimete','untuk pertama kali','Kata keterangan','Waktu & Frekuensi','N5','Neutral','初めて日本へ来ました。','Hajimete Nihon e kimashita.','Saya datang ke Jepang untuk pertama kali.'],
['一緒に','いっしょに','issho ni','bersama','Kata keterangan','Percakapan Sehari-hari','N5','Neutral','一緒に食べましょう。','Issho ni tabemashou.','Mari makan bersama.'],
['ください','ください','kudasai','tolong; berikan','Ungkapan','Restoran','N5','Polite','水をください。','Mizu o kudasai.','Tolong beri saya air.'],
['お願いします','おねがいします','onegaishimasu','tolong; mohon','Ungkapan','Formal','N5','Polite','よろしくお願いします。','Yoroshiku onegaishimasu.','Mohon kerja samanya.'],
['すみません','すみません','sumimasen','permisi; maaf','Ungkapan','Sapaan & Ungkapan','N5','Polite','すみません、駅はどこですか。','Sumimasen, eki wa doko desu ka.','Permisi, stasiun di mana?'],
['ごめんなさい','ごめんなさい','gomen nasai','maaf','Ungkapan','Sapaan & Ungkapan','N5','Polite','遅れてごめんなさい。','Okurete gomen nasai.','Maaf saya terlambat.'],
['よろしくお願いします','よろしくおねがいします','yoroshiku onegaishimasu','mohon bantuannya; mohon kerja samanya','Ungkapan','Formal','N5','Polite','これからよろしくお願いします。','Kore kara yoroshiku onegaishimasu.','Mohon kerja samanya mulai sekarang.'],
['お疲れ様です','おつかれさまです','otsukaresama desu','terima kasih atas kerja kerasnya','Ungkapan','Ungkapan Formal','N4','Polite','お疲れ様です。','Otsukaresama desu.','Terima kasih atas kerja kerasnya.'],
['いってきます','いってきます','ittekimasu','saya pergi dulu dan akan kembali','Ungkapan','Percakapan Sehari-hari','N5','Neutral','いってきます。','Ittekimasu.','Saya pergi dulu.'],
['いってらっしゃい','いってらっしゃい','itterasshai','hati-hati; sampai nanti','Ungkapan','Percakapan Sehari-hari','N5','Neutral','いってらっしゃい。','Itterasshai.','Hati-hati, sampai nanti.'],
['ただいま','ただいま','tadaima','saya sudah pulang','Ungkapan','Percakapan Sehari-hari','N5','Neutral','ただいま。','Tadaima.','Saya sudah pulang.'],
['おかえり','おかえり','okaeri','selamat datang kembali (kasual)','Ungkapan','Percakapan Sehari-hari','N5','Casual','おかえり！','Okaeri!','Selamat datang kembali!'],
['おかえりなさい','おかえりなさい','okaerinasai','selamat datang kembali','Ungkapan','Percakapan Sehari-hari','N5','Polite','おかえりなさい。','Okaerinasai.','Selamat datang kembali.'],
['おやすみ','おやすみ','oyasumi','selamat tidur (kasual)','Ungkapan','Sapaan & Ungkapan','N5','Casual','おやすみ。','Oyasumi.','Selamat tidur.'],
['おやすみなさい','おやすみなさい','oyasuminasai','selamat tidur','Ungkapan','Sapaan & Ungkapan','N5','Polite','おやすみなさい。','Oyasuminasai.','Selamat tidur.'],
['ありがとう','ありがとう','arigatou','terima kasih','Ungkapan','Sapaan & Ungkapan','N5','Casual','ありがとう！','Arigatou!','Terima kasih!'],
['ありがとうございます','ありがとうございます','arigatou gozaimasu','terima kasih','Ungkapan','Ungkapan Formal','N5','Polite','ありがとうございます。','Arigatou gozaimasu.','Terima kasih.'],
['どういたしまして','どういたしまして','dou itashimashite','sama-sama','Ungkapan','Sapaan & Ungkapan','N5','Polite',null,null,null],
['はじめまして','はじめまして','hajimemashite','salam kenal','Ungkapan','Perkenalan','N5','Polite','はじめまして。アリーフです。','Hajimemashite. Ariifu desu.','Salam kenal. Saya Alief.'],
['こんにちは','こんにちは','konnichiwa','halo; selamat siang','Ungkapan','Sapaan & Ungkapan','N5','Polite','こんにちは。お元気ですか。','Konnichiwa. O-genki desu ka.','Halo. Apa kabar?'],
['おはよう','おはよう','ohayou','selamat pagi','Ungkapan','Sapaan & Ungkapan','N5','Casual','おはよう！','Ohayou!','Selamat pagi!'],
['おはようございます','おはようございます','ohayou gozaimasu','selamat pagi','Ungkapan','Sapaan & Ungkapan','N5','Polite','おはようございます。','Ohayou gozaimasu.','Selamat pagi.'],
['こんばんは','こんばんは','konbanwa','selamat malam','Ungkapan','Sapaan & Ungkapan','N5','Polite','こんばんは。','Konbanwa.','Selamat malam.'],
['さようなら','さようなら','sayounara','selamat tinggal','Ungkapan','Sapaan & Ungkapan','N5','Neutral','さようなら。また明日。','Sayounara. Mata ashita.','Selamat tinggal. Sampai besok.'],
['またね','またね','mata ne','sampai jumpa','Ungkapan','Sapaan & Ungkapan','N5','Casual','またね！','Mata ne!','Sampai jumpa!'],
['お元気ですか','おげんきですか','o-genki desu ka','apa kabar?','Ungkapan','Percakapan Sehari-hari','N5','Polite','お元気ですか。','O-genki desu ka.','Apa kabar?'],
['元気です','げんきです','genki desu','saya baik; sehat','Ungkapan','Percakapan Sehari-hari','N5','Polite','元気です。ありがとうございます。','Genki desu. Arigatou gozaimasu.','Saya baik. Terima kasih.'],
['大丈夫です','だいじょうぶです','daijoubu desu','tidak apa-apa; saya baik-baik saja','Ungkapan','Percakapan Sehari-hari','N5','Polite','大丈夫です。','Daijoubu desu.','Tidak apa-apa.'],
['無事','ぶじ','buji','selamat; tanpa masalah','Kata benda/na-adjective','Kehidupan Sosial','N4','Neutral','無事に着きました。','Buji ni tsukimashita.','Saya tiba dengan selamat.'],
['祈る','いのる','inoru','berdoa; mendoakan','Kata kerja','Ungkapan','N4','Neutral','成功を祈ります。','Seikou o inorimasu.','Saya mendoakan kesuksesan.'],
['頑張る','がんばる','ganbaru','berusaha keras; semangat','Kata kerja','Perasaan & Emosi','N4','Neutral','日本語の勉強を頑張ります。','Nihongo no benkyou o ganbarimasu.','Saya akan berusaha keras belajar bahasa Jepang.'],
['お仕事','おしごと','oshigoto','pekerjaan (bentuk sopan)','Kata benda','Pekerjaan & Profesi','N4','Polite',null,null,null],
['お仕事頑張ってください','おしごとがんばってください','oshigoto ganbatte kudasai','semangat bekerja; semoga lancar bekerja','Ungkapan','Pekerjaan & Profesi',null,'Polite','お仕事頑張ってください。','Oshigoto ganbatte kudasai.','Semangat bekerja.'],
['気をつけて','きをつけて','ki o tsukete','hati-hati','Ungkapan','Percakapan Sehari-hari','N5','Neutral','気をつけて帰ってください。','Ki o tsukete kaette kudasai.','Hati-hati saat pulang.'],
['手伝う','てつだう','tetsudau','membantu','Kata kerja','Kehidupan Sosial','N4','Neutral','手伝ってください。','Tetsudatte kudasai.','Tolong bantu saya.'],
['待つ','まつ','matsu','menunggu','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','ここで待ってください。','Koko de matte kudasai.','Tolong tunggu di sini.'],
['持つ','もつ','motsu','memegang; membawa; memiliki','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','かばんを持ちます。','Kaban o mochimasu.','Saya membawa tas.'],
['取る','とる','toru','mengambil','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','写真を撮ります。','Shashin o torimasu.','Saya mengambil foto.'],
['送る','おくる','okuru','mengirim; mengantar','Kata kerja','Kehidupan Sosial','N4','Neutral','メールを送ります。','Meeru o okurimasu.','Saya mengirim email.'],
['受ける','うける','ukeru','menerima; mengikuti (ujian/pelajaran)','Kata kerja','Sekolah & Belajar','N4','Neutral','試験を受けます。','Shiken o ukemasu.','Saya mengikuti ujian.'],
['始める','はじめる','hajimeru','memulai','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','勉強を始めます。','Benkyou o hajimemasu.','Saya mulai belajar.'],
['終わる','おわる','owaru','selesai; berakhir','Kata kerja','Aktivitas Sehari-hari','N5','Neutral','授業が終わります。','Jugyou ga owarimasu.','Pelajaran selesai.'],
['止める','とめる','tomeru','menghentikan','Kata kerja','Aktivitas Sehari-hari','N4','Neutral','車を止めます。','Kuruma o tomemasu.','Saya menghentikan mobil.'],
['変える','かえる','kaeru','mengubah','Kata kerja','Aktivitas Sehari-hari','N4','Neutral',null,null,null],
['変わる','かわる','kawaru','berubah','Kata kerja','Aktivitas Sehari-hari','N4','Neutral',null,null,null],
['住む','すむ','sumu','tinggal; menetap','Kata kerja','Rumah','N5','Neutral','東京に住んでいます。','Toukyou ni sundeimasu.','Saya tinggal di Tokyo.'],
['働く','はたらく','hataraku','bekerja','Kata kerja','Pekerjaan & Profesi','N5','Neutral',null,null,null],
['運転する','うんてんする','unten suru','mengemudi','Kata kerja','Transportasi','N5','Neutral','車を運転します。','Kuruma o unten shimasu.','Saya mengemudi mobil.'],
['写真を撮る','しゃしんをとる','shashin o toru','mengambil foto','Frasa','Hobi','N5','Neutral','写真を撮ってもいいですか。','Shashin o totte mo ii desu ka.','Bolehkah saya mengambil foto?'],
['映画を見る','えいがをみる','eiga o miru','menonton film','Frasa','Hobi','N5','Neutral','週末に映画を見ます。','Shuumatsu ni eiga o mimasu.','Saya menonton film pada akhir pekan.'],
['日本語を勉強する','にほんごをべんきょうする','nihongo o benkyou suru','belajar bahasa Jepang','Frasa','Sekolah & Belajar','N5','Neutral','毎日日本語を勉強します。','Mainichi nihongo o benkyou shimasu.','Saya belajar bahasa Jepang setiap hari.'],
['日本語が好きです','にほんごがすきです','nihongo ga suki desu','saya suka bahasa Jepang','Kalimat','Percakapan Sehari-hari','N5','Polite','日本語が好きです。','Nihongo ga suki desu.','Saya suka bahasa Jepang.'],
['私の名前は','わたしのなまえは','watashi no namae wa','nama saya adalah','Frasa','Perkenalan','N5','Neutral',null,null,null],
['インドネシアから来ました','いんどねしあからきました','Indonesia kara kimashita','saya berasal/datang dari Indonesia','Kalimat','Perkenalan',null,'Polite','インドネシアから来ました。','Indonesia kara kimashita.','Saya dari Indonesia.']
];

const LEARNING_DB = CORE_VOCAB.map((x,i)=>({id:'core-'+String(i+1).padStart(4,'0'),kanji:x[0],japanese:x[0],kana:x[1],romaji:x[2],meaning:x[3],pos:x[4],category:x[5],jlpt:x[6],formality:x[7],example:x[8]||'',exampleRomaji:x[9]||'',exampleId:x[10]||'',source:'curated-core',verified:true}));
const DB_BY_JP=new Map(LEARNING_DB.map(x=>[normalizeTranslateKey(x.japanese),x]));
const DB_BY_ROMAJI=new Map(LEARNING_DB.map(x=>[normalizeTranslateKey(x.romaji),x]));
function dbFind(q){const k=normalizeTranslateKey(q); if(!k)return null; return DB_BY_JP.get(k)||DB_BY_ROMAJI.get(k)||LEARNING_DB.find(x=>normalizeTranslateKey(x.kana)===k)||LEARNING_DB.find(x=>normalizeTranslateKey(x.meaning).split(/[;,/]/).some(v=>v.trim()===k))||null;}
const JP_PHRASE_READINGS={
 '自己紹介':'jiko shoukai','自己紹介させてください':'jiko shoukai sasete kudasai','出身':'shusshin','出身です':'shusshin desu','させてください':'sasete kudasai','です':'desu','私の名前は':'watashi no namae wa','名前は':'namae wa','インドネシア出身です':'Indonesia shusshin desu',
 'こんにちは':'konnichiwa','こんにちは、自己紹介させてください。私の名前はアリーフです。インドネシア出身です。':'konnichiwa, jiko shoukai sasete kudasai. watashi no namae wa Ariifu desu. Indonesia shusshin desu','こんにちは、はじめまして。私の名前はアリーフです。インドネシアから来ました。':'konnichiwa, hajimemashite. watashi no namae wa Ariifu desu. Indonesia kara kimashita','自己紹介させてください。':'jiko shoukai sasete kudasai.','私の名前はアリーフです。':'watashi no namae wa Ariifu desu.','私の名前はアリフです。':'watashi no namae wa Arifu desu.','インドネシア出身です。':'Indonesia shusshin desu.','インドネシアから来ました。':'Indonesia kara kimashita.','私はインドネシア出身です。':'watashi wa Indonesia shusshin desu.','私はインドネシアから来ました。':'watashi wa Indonesia kara kimashita.','よろしくお願いします。':'yoroshiku onegaishimasu.','ありがとうございます。':'arigatou gozaimasu.','お元気ですか。':'o-genki desu ka.','元気です。':'genki desu.','わかりました。':'wakarimashita.','わかりません。':'wakarimasen.','日本語を勉強しています。':'nihongo o benkyou shiteimasu.','日本へ旅行したいです。':'Nihon e ryokou shitai desu.','将来、日本へ旅行したいです。':'shourai, Nihon e ryokou shitai desu.','お仕事頑張ってください。':'oshigoto ganbatte kudasai.','お疲れ様です。':'otsukaresama desu.','気をつけてください。':'ki o tsukete kudasai.','どういたしまして。':'dou itashimashite.','大丈夫です。':'daijoubu desu.','ちょっと待ってください。':'chotto matte kudasai.','もう一度お願いします。':'mou ichido onegaishimasu.','こちらこそよろしくお願いします。':'kochira koso yoroshiku onegaishimasu.','ありがとう':'arigatou','ありがとうございます':'arigatou gozaimasu','すみません':'sumimasen','ごめんなさい':'gomen nasai','はじめまして':'hajimemashite','よろしくお願いします':'yoroshiku onegaishimasu','食べる':'taberu','食べます':'tabemasu','日本語を勉強しています':'nihongo o benkyou shiteimasu','私は学生です':'watashi wa gakusei desu','お元気ですか':'o-genki desu ka','インドネシアから来ました':'Indonesia kara kimashita','こんばんは':'konbanwa','おはようございます':'ohayou gozaimasu','お仕事頑張ってください':'oshigoto ganbatte kudasai','無事を祈る':'buji o inoru','無事を祈ります':'buji o inorimasu','無事に':'buji ni','日本語を勉強します':'nihongo o benkyou shimasu','私の名前は':'watashi no namae wa','日本語を勉強しています。将来、日本へ旅行したいです。':'nihongo o benkyou shiteimasu. shourai, nihon e ryokou shitai desu.','こんにちは、はじめまして。私の名前はアリーフです。インドネシアから来ました。':'konnichiwa, hajimemashite. watashi no namae wa arief desu. Indonesia kara kimashita.'
};
// Expanded Japanese reading library: longest-match first, so long sentences
// can be converted even when the exact complete sentence is not in the dictionary.
const JP_ROMAJI_EXPANDED={
 '自己紹介させてください':'jiko shoukai sasete kudasai','自己紹介':'jiko shoukai','はじめまして':'hajimemashite',
 '私の名前は':'watashi no namae wa','私の名前':'watashi no namae','名前は':'namae wa','名前':'namae',
 'アリーフです':'Ariifu desu','アリフです':'Arifu desu','インドネシア出身です':'Indonesia shusshin desu',
 'インドネシアから来ました':'Indonesia kara kimashita','インドネシア出身':'Indonesia shusshin','インドネシアから':'Indonesia kara',
 '日本語を勉強しています':'nihongo o benkyou shiteimasu','日本語を勉強します':'nihongo o benkyou shimasu','日本語を勉強する':'nihongo o benkyou suru',
 '日本語が好きです':'nihongo ga suki desu','日本語':'nihongo','勉強しています':'benkyou shiteimasu','勉強します':'benkyou shimasu',
 '将来':'shourai','旅行したいです':'ryokou shitai desu','旅行したい':'ryokou shitai','日本へ':'Nihon e','日本に':'Nihon ni','日本から':'Nihon kara','日本':'Nihon',
 'お仕事頑張ってください':'oshigoto ganbatte kudasai','頑張ってください':'ganbatte kudasai','頑張ります':'ganbarimasu','頑張る':'ganbaru','お仕事':'oshigoto',
 'お疲れ様です':'otsukaresama desu','お疲れ様でした':'otsukaresama deshita','お疲れ様':'otsukaresama',
 'ありがとうございます':'arigatou gozaimasu','ありがとう':'arigatou','どういたしまして':'dou itashimashite',
 'よろしくお願いします':'yoroshiku onegaishimasu','よろしく':'yoroshiku','こちらこそ':'kochira koso',
 'お元気ですか':'o-genki desu ka','元気です':'genki desu','大丈夫です':'daijoubu desu','わかりました':'wakarimashita','わかりません':'wakarimasen',
 'ちょっと待ってください':'chotto matte kudasai','もう一度お願いします':'mou ichido onegaishimasu','気をつけてください':'ki o tsukete kudasai',
 '無事を祈ります':'buji o inorimasu','無事を祈る':'buji o inoru','無事に':'buji ni','祈ります':'inorimasu','祈る':'inoru','無事':'buji',
 '食べます':'tabemasu','食べる':'taberu','飲みます':'nomimasu','飲む':'nomu','行きます':'ikimasu','行く':'iku','来ます':'kimasu','来る':'kuru',
 '見ます':'mimasu','見る':'miru','聞きます':'kikimasu','聞く':'kiku','読みます':'yomimasu','読む':'yomu','書きます':'kakimasu','書く':'kaku',
 '話します':'hanashimasu','話す':'hanasu','買います':'kaimasu','買う':'kau','会います':'aimasu','会う':'au','働きます':'hatarakimasu','働く':'hataraku',
 '住んでいます':'sundeimasu','住みます':'sumimasu','住む':'sumu','使います':'tsukaimasu','使う':'tsukau','作ります':'tsukurimasu','作る':'tsukuru',
 '今日':'kyou','明日':'ashita','昨日':'kinou','毎日':'mainichi','今':'ima','朝':'asa','昼':'hiru','夜':'yoru','時間':'jikan',
 'です':'desu','でした':'deshita','ます':'masu','ました':'mashita','ません':'masen','ください':'kudasai','から来ました':'kara kimashita','から':'kara','まで':'made',
 '私は':'watashi wa','私が':'watashi ga','私を':'watashi o','私は':'watashi wa','あなたは':'anata wa','あなたが':'anata ga','あなたを':'anata o',
 'これからも':'kore kara mo','これから':'kore kara','とても':'totemo','本当に':'hontou ni','少し':'sukoshi','ちょっと':'chotto','もう':'mou','また':'mata','そして':'soshite','でも':'demo',
 'ですか':'desu ka','ますか':'masu ka','ませんか':'masen ka','でしょうか':'deshou ka','でしょう':'deshou','と思います':'to omoimasu','と思う':'to omou'
};
const JP_ROMAJI_EXPANDED_KEYS=Object.keys(JP_ROMAJI_EXPANDED).sort((a,b)=>b.length-a.length);

const ID_TO_JP={
 'selamat bekerja':'お仕事頑張ってください','semangat bekerja':'お仕事頑張ってください','semoga lancar bekerja':'お仕事頑張ってください','halo':'こんにちは、はじめまして。','hallo':'こんにちは、はじめまして。','selamat pagi':'おはようございます','selamat siang':'こんにちは','selamat malam':'こんばんは','selamat tidur':'おやすみなさい','terima kasih':'ありがとうございます','sama-sama':'どういたしまして','maaf':'ごめんなさい','permisi':'すみません','salam kenal':'はじめまして','apa kabar':'お元気ですか','saya baik':'元気です','tidak apa-apa':'大丈夫です','saya mengerti':'わかりました','saya tidak mengerti':'わかりません','saya tidak tahu':'知りません','di mana toiletnya':'トイレはどこですか','berapa harganya':'いくらですか','saya suka bahasa jepang':'日本語が好きです','saya belajar bahasa jepang':'日本語を勉強しています','saya tinggal di indonesia':'インドネシアに住んでいます','saya pergi dulu':'行ってきます','hati-hati di jalan':'いってらっしゃい'
};
const ROMAJI_NAME_MAP={'アリーフ':'Arief','アリフ':'Arief','インドネシア':'Indonesia'};
function normalizeRomajiOutput(text){
 let out=String(text||'')
   .replace(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g,'')
   .replace(/[、。！？「」『』【】〔〕〈〉《》・]/g,' ')
   .replace(/[，．]/g, m => m === '，' ? ',' : '.')
   .replace(/\u3000/g,' ')
   .replace(/[ \t\r\n]+/g,' ').trim();
 out=out.replace(/\s+([,.!?])/g,'$1').replace(/([,.!?])(?=\S)/g,'$1 ');
 out=out.replace(/\bha\b/gi,'wa').replace(/\bhe\b/gi,'e').replace(/\bwo\b/gi,'o');
 if(out){out=out.charAt(0).toUpperCase()+out.slice(1);out=out.replace(/([.!?]\s+)([a-z])/g,(m,p,c)=>p+c.toUpperCase())}
 return out;
}
function smartRomaji(text){
 let src=String(text||'').normalize('NFKC').trim(); if(!src)return '';
 const normalizedSource=src.replace(/[\u3000]/g,' ').replace(/\s+/g,' ').trim();
 const exact=JP_PHRASE_READINGS[normalizedSource]||JP_PHRASE_READINGS[src]||KANJI_WORDS[normalizedSource]||KANJI_WORDS[src]||JP_ROMAJI_EXPANDED[normalizedSource];
 if(exact)return normalizeRomajiOutput(exact);

 // Preserve punctuation while replacing the longest known Japanese chunks.
 let out='', i=0;
 while(i<src.length){
   let matched=false;
   for(const key of JP_ROMAJI_EXPANDED_KEYS){
     if(src.startsWith(key,i)){ out+=' '+JP_ROMAJI_EXPANDED[key]+' '; i+=key.length; matched=true; break; }
   }
   if(matched) continue;
   for(const key of Object.keys(ROMAJI_NAME_MAP).sort((a,b)=>b.length-a.length)){
     if(src.startsWith(key,i)){ out+=' '+ROMAJI_NAME_MAP[key]+' '; i+=key.length; matched=true; break; }
   }
   if(matched) continue;
   let found=null;
   for(const key of Object.keys(KANJI_WORDS).sort((a,b)=>b.length-a.length)){
     if(src.startsWith(key,i)){ found=key; break; }
   }
   if(found){ out+=' '+KANJI_WORDS[found]+' '; i+=found.length; continue; }
   const ch=src[i];
   if(/[、。！？「」『』【】〔〕〈〉《》・，．,.!?]/.test(ch)){out+=ch;i++;continue;}
   // Kana fallback for individual kana / kana words.
   const two=src.slice(i,i+2), one=src[i];
   const kanaDig={'きゃ':'kya','きゅ':'kyu','きょ':'kyo','しゃ':'sha','しゅ':'shu','しょ':'sho','ちゃ':'cha','ちゅ':'chu','ちょ':'cho','にゃ':'nya','にゅ':'nyu','にょ':'nyo','ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo','みゃ':'mya','みゅ':'myu','みょ':'myo','りゃ':'rya','りゅ':'ryu','りょ':'ryo','ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo','じゃ':'ja','じゅ':'ju','じょ':'jo','びゃ':'bya','びゅ':'byu','びょ':'byo','ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo'};
   const kana={'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko','さ':'sa','し':'shi','す':'su','せ':'se','そ':'so','た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to','な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no','は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho','ま':'ma','み':'mi','む':'mu','め':'me','も':'mo','や':'ya','ゆ':'yu','よ':'yo','ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro','わ':'wa','を':'wo','ん':'n','が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go','ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo','だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do','ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo','ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po','ゔ':'vu',
     'ア':'a','イ':'i','ウ':'u','エ':'e','オ':'o','カ':'ka','キ':'ki','ク':'ku','ケ':'ke','コ':'ko','サ':'sa','シ':'shi','ス':'su','セ':'se','ソ':'so','タ':'ta','チ':'chi','ツ':'tsu','テ':'te','ト':'to','ナ':'na','ニ':'ni','ヌ':'nu','ネ':'ne','ノ':'no','ハ':'ha','ヒ':'hi','フ':'fu','ヘ':'he','ホ':'ho','マ':'ma','ミ':'mi','ム':'mu','メ':'me','モ':'mo','ヤ':'ya','ユ':'yu','ヨ':'yo','ラ':'ra','リ':'ri','ル':'ru','レ':'re','ロ':'ro','ワ':'wa','ヲ':'wo','ン':'n','ガ':'ga','ギ':'gi','グ':'gu','ゲ':'ge','ゴ':'go','ザ':'za','ジ':'ji','ズ':'zu','ゼ':'ze','ゾ':'zo','ダ':'da','ヂ':'ji','ヅ':'zu','デ':'de','ド':'do','バ':'ba','ビ':'bi','ブ':'bu','ベ':'be','ボ':'bo','パ':'pa','ピ':'pi','プ':'pu','ペ':'pe','ポ':'po'};
   if(kanaDig[two]){out+=' '+kanaDig[two];i+=2;continue;}
   if(kana[one]){out+=' '+kana[one];i++;continue;}
   out+=one;i++;
 }
 out=out.replace(/\s+/g,' ').trim();
 // If any Kanji remains, do not invent a reading. API fallback may handle it.
 if(/[\u3400-\u9fff\uf900-\ufaff]/.test(out))return '';
 out=out.replace(/\bwo\b/gi,'o').replace(/\bhe\b/gi,'e').replace(/\bha\b/gi,'wa');
 out=out.replace(/\s+([、。,.!?])/g,'$1').replace(/([、。,.!?])(?=\S)/g,'$1 ');
 return normalizeRomajiOutput(out);
}
function isJapaneseText(t){return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(String(t||''))}
function romajiIsLatin(t){return !!t&&!isJapaneseText(t)&&/^[A-Za-z0-9\s.,!?"“”‘’\-:;()\/]+$/.test(String(t).trim())}
function findLocalRomaji(jp){const clean=cleanJp(jp);const e=dbFind(clean)||entryForJapanese(clean);const candidates=[e?.romaji,KANJI_WORDS[clean],JP_PHRASE_READINGS[clean],JP_ROMAJI_EXPANDED[clean],smartRomaji(clean)];for(const r of candidates){if(romajiIsLatin(r))return normalizeRomajiOutput(r)}return ''}
function entryForJapanese(text){return dbFind(text)||Object.entries(JP_PHRASE_READINGS).map(([jp,r])=>({japanese:jp,romaji:r,meaning:localWordMeaning[jp]||'',pos:'Frasa',category:'Ungkapan',jlpt:null,formality:'Neutral',example:'',exampleRomaji:'',exampleId:''})).find(x=>normalizeTranslateKey(x.japanese)===normalizeTranslateKey(text))||null}
function detectPoliteness(jp,entry){const t=String(jp||'');if(entry?.formality)return entry.formality;if(/(?:です|ます|ました|ません|ませんか|ください|ございます|でした|でしょう)/.test(t))return 'Sopan / Polite';if(/(?:だよ|だね|だぜ|じゃん|だ$|ない$|た$|る$)/.test(t))return 'Casual / Informal';return 'Netral / Neutral';}
function detectWordType(jp,entry){if(entry?.pos)return entry.pos;const t=String(jp||'');if(/[。！？!?]/.test(t))return 'Kalimat';if(/(?:ます|ません|ました|ませんでした)$/.test(t))return 'Kata kerja (bentuk sopan)';if(/る$/.test(t))return 'Kata kerja';return 'Ungkapan / Kosakata';}
function makeExplanation(jp,id,entry,politeness){if(entry?.note)return entry.note;const type=detectWordType(jp,entry);if(type==='Kalimat')return politeness.startsWith('Sopan')?'Kalimat yang menggunakan bentuk sopan dan natural untuk percakapan sehari-hari.':'Kalimat natural yang dapat digunakan sesuai konteks percakapan.';if(type.includes('Kata kerja'))return 'Kata kerja yang dapat dipelajari bersama bentuk dan konteks penggunaannya.';return 'Ungkapan yang umum digunakan dalam Bahasa Jepang.';}
function renderTranslateDetails(entry,fallbackFormality,jp,id){const e=entry||{};const formality=detectPoliteness(jp,e)||fallbackFormality||'Netral / Neutral';const set=(idEl,v)=>{const el=document.getElementById(idEl);if(el)el.textContent=v||'—'};set('resultPos',detectWordType(jp,e));set('resultForm',e.form||((String(jp||'').endsWith('ます')||String(jp||'').endsWith('です'))?'Bentuk sopan':'—'));set('resultJlpt',e.jlpt||'Tidak ditentukan');set('resultFormalityMain',formality);set('resultNote',makeExplanation(jp,id,e,formality));const ex=document.getElementById('translateExample');if(e.example){ex.style.display='block';set('resultExampleJp',e.example);set('resultExampleRomaji',e.exampleRomaji||smartRomaji(e.example));set('resultExampleId',e.exampleId)}else ex.style.display='none';}
function escapeAttr(s){return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function normalizeTranslateKey(t){return String(t||'').normalize('NFKC').trim().replace(/[。、！？!?.,]+$/g,'').replace(/\s+/g,' ').toLowerCase()}
function cleanJp(t){return String(t||'').trim()}
const TRANSLATE_CACHE_KEY='nihongo_translate_cache_v2',TRANSLATE_CACHE_TTL=2592000000;
function getTranslateCache(key){try{const all=JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY)||'{}');const hit=all[key];if(hit&&Date.now()-hit.ts<TRANSLATE_CACHE_TTL)return hit.data}catch(e){}return null}
function setTranslateCache(key,data){try{const all=JSON.parse(localStorage.getItem(TRANSLATE_CACHE_KEY)||'{}');all[key]={ts:Date.now(),data};const keys=Object.keys(all);while(keys.length>80)delete all[keys.shift()];localStorage.setItem(TRANSLATE_CACHE_KEY,JSON.stringify(all))}catch(e){}}
let translateAbortController=null;
async function fetchTranslateProvider(sl,tl,text){
  if(translateAbortController)try{translateAbortController.abort()}catch(e){}
  translateAbortController=new AbortController();
  const signal=translateAbortController.signal;
  const url='/api/translate?sl='+encodeURIComponent(sl)+'&tl='+encodeURIComponent(tl)+'&q='+encodeURIComponent(text);
  const r=await fetch(url,{headers:{accept:'application/json'},signal});
  let d={}; try{d=await r.json()}catch(e){}
  if(!r.ok || d.available===false) {
    const err=new Error(d.message||'Translate sedang tidak tersedia.');
    err.code=d.error||'translate_unavailable';
    err.status=r.status;
    throw err;
  }
  return d;
}
let currentTranslationState=null;
function showTranslationResult(ai,original){
  const clean=String(ai?.translatedText||'').trim();
  const romaji=String(ai?.romaji||'').trim();
  const id=String(ai?.meaning||'').trim();
  const formality=String(ai?.formality||'Sopan / Polite').trim();
  currentTranslationState={jp:clean,id,romaji,originalText:original,entry:null,formality,ai};
  document.getElementById('resultMain').textContent=clean;
  const romajiEl=document.getElementById('resultRomaji');
  romajiEl.textContent=romaji||'Bacaan belum tersedia';
  romajiEl.classList.toggle('romaji-unavailable',!romaji);
  document.getElementById('resultMeaning').textContent=id||'—';
  const set=(idEl,v)=>{const el=document.getElementById(idEl);if(el)el.textContent=v||'—'};
  set('resultFormalityMain',formality);
  set('resultNote',ai?.explanation||'Terjemahan AI berhasil.');
  set('resultPos',ai?.pos||'—');
  set('resultForm',ai?.form||'—');
  set('resultJlpt',ai?.jlpt||'Tidak ditentukan');
  const ex=document.getElementById('translateExample');
  if(ex)ex.style.display='none';
  const resultBox=document.getElementById('translateResult');
  resultBox.classList.add('show');
  resultBox.setAttribute('data-speak',clean);
  const formalityBox=document.getElementById('formalityBox');
  const content=document.getElementById('formalityContent');
  if(content) content.textContent=(formality||'Sopan / Polite')+' — '+(ai?.alternative&&ai.alternative!=='—'?'Alternatif: '+ai.alternative:'Bentuk sopan diprioritaskan oleh AI.');
  if(formalityBox)formalityBox.classList.add('show');
  addToHistory({jp:clean,romaji:romaji||'—',id,originalText:original});
  setTimeout(()=>speak(clean),120);
  return currentTranslationState;
}
async function doTranslate(){
  const input=document.getElementById('translateInput').value.trim();
  if(!input)return;
  const btn=document.getElementById('translateBtn'),resultBox=document.getElementById('translateResult'),notFoundBox=document.getElementById('translateNotFound'),formalityBox=document.getElementById('formalityBox');
  if(btn.disabled)return;
  btn.disabled=true;
  const old=btn.textContent;
  btn.textContent='⏳ Menerjemahkan dengan AI…';
  resultBox.classList.remove('show');
  notFoundBox.classList.remove('show');
  formalityBox.classList.remove('show');
  try{
    const isJp=isJapaneseText(input);
    const ai=await fetchTranslateProvider(isJp?'ja':'id',isJp?'id':'ja',input);
    showTranslationResult(ai,input);
  }catch(e){
    if(e?.name!=='AbortError'){
      const strong=notFoundBox.querySelector('strong');
      if(strong)strong.textContent='⚠️ Translate sedang tidak tersedia.';
      const note=notFoundBox.querySelector('br')?.nextSibling;
      if(note)note.textContent=' Jika Translate sedang tidak tersedia, coba lagi beberapa saat.';
      notFoundBox.classList.add('show');
    }
  }finally{
    btn.disabled=false;
    btn.textContent=old;
  }
}
function addToHistory(entry) {
  let h = JSON.parse(localStorage.getItem('translate_history_v19') || '[]');
  h = h.filter(x => x.originalText !== entry.originalText);
  h.unshift(entry); h = h.slice(0, 15);
  try { localStorage.setItem('translate_history_v19', JSON.stringify(h)); } catch (e) {}
  renderHistory();
}
function renderHistory() {
  const h = JSON.parse(localStorage.getItem('translate_history_v19') || '[]');
  const list = document.getElementById('historyList');
  if (h.length === 0) { list.innerHTML = '<div class="history-empty">Belum ada riwayat.</div>'; return; }
  list.innerHTML = h.map(x => '<div class="history-item-row" data-speak="' + (x.jp || '').replace(/"/g,'&quot;') + '"><div class="history-item-jp">' + (x.jp || '') + '</div><div class="history-item-romaji">' + (x.romaji || '-') + '</div><div class="history-item-id">' + (x.id || '') + '</div></div>').join('');
}
function clearHistory() { if (!confirm('Hapus?')) return; localStorage.removeItem('translate_history_v19'); renderHistory(); }

const hiraganaData = [['あ','a'],['い','i'],['う','u'],['え','e'],['お','o'],['か','ka'],['き','ki'],['く','ku'],['け','ke'],['こ','ko'],['さ','sa'],['し','shi'],['す','su'],['せ','se'],['そ','so'],['た','ta'],['ち','chi'],['つ','tsu'],['て','te'],['と','to'],['な','na'],['に','ni'],['ぬ','nu'],['ね','ne'],['の','no'],['は','ha'],['ひ','hi'],['ふ','fu'],['へ','he'],['ほ','ho'],['ま','ma'],['み','mi'],['む','mu'],['め','me'],['も','mo'],['や','ya'],['ゆ','yu'],['よ','yo'],['ら','ra'],['り','ri'],['る','ru'],['れ','re'],['ろ','ro'],['わ','wa'],['を','wo'],['ん','n']];
const hiraganaDakuten = [['が','ga'],['ぎ','gi'],['ぐ','gu'],['げ','ge'],['ご','go'],['ざ','za'],['じ','ji'],['ず','zu'],['ぜ','ze'],['ぞ','zo'],['だ','da'],['で','de'],['ど','do'],['ば','ba'],['び','bi'],['ぶ','bu'],['べ','be'],['ぼ','bo'],['ぱ','pa'],['ぴ','pi'],['ぷ','pu'],['ぺ','pe'],['ぽ','po']];
const katakanaData = [['ア','a'],['イ','i'],['ウ','u'],['エ','e'],['オ','o'],['カ','ka'],['キ','ki'],['ク','ku'],['ケ','ke'],['コ','ko'],['サ','sa'],['シ','shi'],['ス','su'],['セ','se'],['ソ','so'],['タ','ta'],['チ','chi'],['ツ','tsu'],['テ','te'],['ト','to'],['ナ','na'],['ニ','ni'],['ヌ','nu'],['ネ','ne'],['ノ','no'],['ハ','ha'],['ヒ','hi'],['フ','fu'],['ヘ','he'],['ホ','ho'],['マ','ma'],['ミ','mi'],['ム','mu'],['メ','me'],['モ','mo'],['ヤ','ya'],['ユ','yu'],['ヨ','yo'],['ラ','ra'],['リ','ri'],['ル','ru'],['レ','re'],['ロ','ro'],['ワ','wa'],['ヲ','wo'],['ン','n']];
const katakanaDakuten = [['ガ','ga'],['ギ','gi'],['グ','gu'],['ゲ','ge'],['ゴ','go'],['ザ','za'],['ジ','ji'],['ズ','zu'],['ゼ','ze'],['ゾ','zo'],['ダ','da'],['デ','de'],['ド','do'],['バ','ba'],['ビ','bi'],['ブ','bu'],['ベ','be'],['ボ','bo'],['パ','pa'],['ピ','pi'],['プ','pu'],['ペ','pe'],['ポ','po']];
const kanjiData = [['一','satu','ichi'],['二','dua','ni'],['三','tiga','san'],['四','empat','yon'],['五','lima','go'],['六','enam','roku'],['七','tujuh','nana'],['八','delapan','hachi'],['九','sembilan','kyuu'],['十','sepuluh','juu'],['百','ratus','hyaku'],['千','ribu','sen'],['万','sepuluh ribu','man'],['円','yen','en'],['日','hari','hi'],['月','bulan','tsuki'],['年','tahun','toshi'],['時','waktu','toki'],['今','sekarang','ima'],['前','sebelum','mae'],['人','orang','hito'],['子','anak','ko'],['女','perempuan','onna'],['男','laki-laki','otoko'],['父','ayah','chichi'],['母','ibu','haha'],['友','teman','tomo'],['先','sebelumnya','saki'],['生','hidup','ikiru'],['名','nama','na'],['国','negara','kuni'],['学','belajar','manabu'],['駅','stasiun','eki'],['店','toko','mise'],['道','jalan','michi'],['山','gunung','yama'],['川','sungai','kawa'],['天','langit','ten'],['気','perasaan','ki'],['上','atas','ue'],['下','bawah','shita'],['中','dalam','naka'],['外','luar','soto'],['左','kiri','hidari'],['右','kanan','migi'],['東','timur','higashi'],['西','barat','nishi'],['南','selatan','minami'],['北','utara','kita'],['家','rumah','ie'],['行','pergi','iku'],['来','datang','kuru'],['見','melihat','miru'],['聞','dengar','kiku'],['読','baca','yomu'],['書','tulis','kaku'],['話','bicara','hanasu'],['食','makan','taberu'],['飲','minum','nomu'],['買','beli','kau'],['大','besar','ookii'],['小','kecil','chiisai'],['高','tinggi','takai'],['安','murah','yasui'],['新','baru','atarashii'],['古','lama','furui'],['長','panjang','nagai'],['白','putih','shiroi'],['黒','hitam','kuroi'],['赤','merah','akai'],['青','biru','aoi'],['本','buku','hon'],['水','air','mizu'],['金','uang','kane'],['電','listrik','den'],['車','mobil','kuruma'],['手','tangan','te'],['目','mata','me'],['口','mulut','kuchi'],['語','bahasa','go']];
const frasaData = [['おはようございます','ohayou gozaimasu','Selamat pagi'],['こんにちは','konnichiwa','Halo'],['こんばんは','konbanwa','Selamat malam'],['おやすみなさい','oyasuminasai','Selamat tidur'],['さようなら','sayounara','Selamat tinggal'],['またね','mata ne','Sampai jumpa'],['ありがとうございます','arigatou gozaimasu','Terima kasih'],['どういたしまして','dou itashimashite','Sama-sama'],['すみません','sumimasen','Permisi'],['ごめんなさい','gomen nasai','Maaf'],['いただきます','itadakimasu','Sebelum makan'],['ごちそうさまでした','gochisousama deshita','Terima kasih makanannya'],['おいしい','oishii','Enak'],['トイレはどこですか','toire wa doko desu ka','Di mana toiletnya?'],['いくらですか','ikura desu ka','Berapa harganya?'],['わかりません','wakarimasen','Saya tidak mengerti'],['わかりました','wakarimashita','Saya mengerti'],['たすけて','tasukete','Tolong!']];
const angkaData = [['一','ichi','1'],['二','ni','2'],['三','san','3'],['四','yon','4'],['五','go','5'],['六','roku','6'],['七','nana','7'],['八','hachi','8'],['九','kyuu','9'],['十','juu','10']];
const hariData = [['月曜日','getsuyoubi','Senin'],['火曜日','kayoubi','Selasa'],['水曜日','suiyoubi','Rabu'],['木曜日','mokuyoubi','Kamis'],['金曜日','kinyoubi','Jumat'],['土曜日','doyoubi','Sabtu'],['日曜日','nichiyoubi','Minggu']];

function renderGrid(id, data, type) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = data.map(([a, b, c]) => {
    if (type === 'kana') return '<div class="kana-item" data-speak="' + a + '"><div class="kana-char">' + a + '</div><div class="kana-romaji">' + b + '</div></div>';
    if (type === 'kanji') return '<div class="kanji-item" data-speak="' + c + '"><div class="kanji-char">' + a + '</div><div class="kanji-mean">' + b + '</div><div class="kanji-read">' + c + '</div></div>';
    return '';
  }).join('');
}
function renderPhraseList(id, data) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = data.map(([jp, romaji, id]) => '<div class="phrase-row" data-speak="' + jp + '"><div class="phrase-jp">' + jp + '</div><div class="phrase-romaji">' + romaji + '</div><div class="phrase-id">' + id + '</div></div>').join('');
}
renderGrid('hiraganaGrid', hiraganaData, 'kana');
renderGrid('hiraganaDakuten', hiraganaDakuten, 'kana');
renderGrid('katakanaGrid', katakanaData, 'kana');
renderGrid('katakanaDakuten', katakanaDakuten, 'kana');
renderGrid('kanjiGrid', kanjiData, 'kanji');
renderPhraseList('frasaList', frasaData);
renderPhraseList('angkaList', angkaData);
renderPhraseList('hariList', hariData);

const quizSource = { hiragana: hiraganaData, katakana: katakanaData, kanji: kanjiData.map(([q, mean]) => [q, mean]), frasa: frasaData.map(([q, r, id]) => [q, id]) };
let currentQuizType = 'hiragana', currentQuizQuestions = [], currentQuestionIndex = 0, currentScore = 0;
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function generateOptions(correct, type) {
  const pool = [...new Set((quizSource[type] || []).map(item => item[1]).filter(Boolean))];
  const opts = [correct]; const shuffled = shuffle(pool);
  for (const p of shuffled) { if (opts.length >= 4) break; if (!opts.includes(p)) opts.push(p); }
  return shuffle(opts);
}
function startQuiz(type, btn) {
  currentQuizType = type; const all = quizSource[type] || [];
  currentQuizQuestions = shuffle(all).slice(0, 10); currentQuestionIndex = 0; currentScore = 0;
  const labels = { hiragana:'HIRAGANA', katakana:'KATAKANA', kanji:'KANJI', frasa:'FRASA', kosakata:'KOSAKATA', romaji:'ROMAJI', arti:'ARTI', kana:'KANA → KANJI' };
  document.getElementById('quizCategoryLabel').textContent = labels[type] || 'KUIS';
  document.getElementById('quizTotal').textContent = currentQuizQuestions.length;
  document.getElementById('quizScore').textContent = '0';
  if (btn) { document.querySelectorAll('#quizTabs .learn-tab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  renderQuestion();
}
function renderQuestion() {
  if (currentQuestionIndex >= currentQuizQuestions.length) { endQuiz(); return; }
  const [q, a] = currentQuizQuestions[currentQuestionIndex];
  document.getElementById('quizNum').textContent = currentQuestionIndex + 1;
  document.getElementById('quizQuestion').textContent = q;
  document.getElementById('quizHint').textContent = currentQuizType==='romaji' ? 'Pilih romaji yang benar.' : currentQuizType==='arti'||currentQuizType==='kanji'||currentQuizType==='frasa' ? 'Pilih arti yang benar.' : currentQuizType==='kana' ? 'Pilih bentuk Jepang yang benar.' : 'Apa bacaan karakter ini?';
  const optsContainer = document.getElementById('quizOptions'); optsContainer.innerHTML = '';
  generateOptions(a, currentQuizType).forEach(opt => {
    const b = document.createElement('button'); b.className = 'quiz-option'; b.textContent = opt;
    b.addEventListener('click', () => checkAnswer(b, opt, a, q)); optsContainer.appendChild(b);
  });
}
function checkAnswer(btn, chosen, correct, question) {
  document.querySelectorAll('.quiz-option').forEach(o => { o.disabled = true; if (o.textContent === correct) o.classList.add('correct'); });
  if (chosen === correct) { currentScore++; document.getElementById('quizScore').textContent = currentScore; speak(question); } else btn.classList.add('wrong');
  const totalNow = currentQuizQuestions.length || 1;
  const bestPct = Math.round((currentScore / totalNow) * 100);
  if (bestPct > Number(localStorage.getItem(JL_BEST) || 0)) localStorage.setItem(JL_BEST, String(bestPct));
  if (typeof renderDash === 'function') renderDash();
  setTimeout(() => { currentQuestionIndex++; renderQuestion(); }, 1100);
}
function endQuiz() {
  const total = currentQuizQuestions.length;
  const percent = total ? Math.round((currentScore / total) * 100) : 0;
  document.getElementById('quizQuestion').textContent = '🎉';
  document.getElementById('quizHint').textContent = percent >= 80 ? '🌟 Hebat!' : percent >= 60 ? '👍 Bagus!' : '💪 Coba lagi!';
  document.getElementById('quizOptions').innerHTML = '<div style="grid-column:1/-1;padding:20px"><div style="font-size:48px;font-weight:900;background:var(--gp);-webkit-background-clip:text;background-clip:text;color:transparent">' + currentScore + ' / ' + total + '</div><div style="font-size:14px;color:var(--text-soft);font-weight:700">Skor Akhir</div></div>';
}

const JL_FAV='jl_favorites_v1', JL_MASTER='jl_mastered_v1', JL_BEST='jl_best_quiz_v1';
function jlLoad(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return[]}}
function jlSave(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
const jlFav=new Set(jlLoad(JL_FAV)), jlMaster=new Set(jlLoad(JL_MASTER));
function jlKey(jp){return cleanJp(jp)}
function buildLearningVocab(){
 const map=new Map();
 const add=(item)=>{if(!item||!item.japanese||!item.meaning)return;const k=normalizeTranslateKey(item.japanese);if(!k)return;if(!map.has(k))map.set(k,item)};
 LEARNING_DB.forEach(add);
 Object.keys(KANJI_WORDS||{}).forEach(jp=>{if(!map.has(normalizeTranslateKey(jp)))add({id:'legacy-'+jp,japanese:jp,kanji:/[\u4e00-\u9faf]/.test(jp)?jp:'',kana:'',romaji:KANJI_WORDS[jp],meaning:localWordMeaning[jp]||'',pos:'Tidak ditentukan',category:'Belum dikategorikan',jlpt:null,formality:'Tidak ditentukan',example:'',exampleRomaji:'',exampleId:'',source:'legacy',verified:!!localWordMeaning[jp]})});
 frasaData.forEach(([jp,r,id])=>add({id:'phrase-'+jp,japanese:jp,kanji:/[\u4e00-\u9faf]/.test(jp)?jp:'',kana:'',romaji:r,meaning:id,pos:'Ungkapan',category:'Sapaan & Ungkapan',jlpt:null,formality:'Tidak ditentukan',example:'',exampleRomaji:'',exampleId:'',source:'legacy-phrase',verified:true}));
 angkaData.forEach(([jp,r,id])=>add({id:'num-'+jp,japanese:jp,kanji:jp,kana:'',romaji:r,meaning:id,pos:'Kata benda/angka',category:'Angka',jlpt:'N5',formality:'Neutral',example:'',exampleRomaji:'',exampleId:'',source:'legacy-number',verified:true}));
 hariData.forEach(([jp,r,id])=>add({id:'day-'+jp,japanese:jp,kanji:jp,kana:'',romaji:r,meaning:id,pos:'Kata benda',category:'Hari & Tanggal',jlpt:'N5',formality:'Neutral',example:'',exampleRomaji:'',exampleId:'',source:'legacy-day',verified:true}));
 return [...map.values()];
}
const JL_VOCAB=buildLearningVocab();
quizSource.romaji=JL_VOCAB.map(x=>[x.japanese,x.romaji||smartRomaji(x.japanese)]); quizSource.arti=JL_VOCAB.map(x=>[x.japanese,x.meaning]); quizSource.kana=JL_VOCAB.filter(x=>x.kana).map(x=>[x.kana,x.japanese]);
quizSource.kosakata=JL_VOCAB.map(x=>[x.jp||x.japanese,x.meaning]);
let flashIndex=0,flashPool=[];
function renderDash(){
 const m=[...jlMaster].length,f=[...jlFav].length,t=JL_VOCAB.length;const el=id=>document.getElementById(id);if(!el('dashVocab'))return;
 el('dashVocab').textContent=t;el('dashFav').textContent=f;el('dashMastered').textContent=m;const p=t?Math.min(100,Math.round(m/t*100)):0;el('dashProgressBar').style.width=p+'%';el('dashProgressText').textContent=m+' / '+t+' dikuasai ('+p+'%)';el('dashBest').textContent=(Number(localStorage.getItem(JL_BEST)||0))+'%';const st=document.getElementById('streakCount');el('dashStreak').textContent=(st?st.textContent:'0')+' hari';
}
function renderVocabList(q){
 q=q||'';const box=document.getElementById('vocabList');if(!box)return;const k=normalizeTranslateKey(q);let arr=JL_VOCAB;
 if(k){arr=arr.filter(x=>[x.japanese,x.kanji,x.kana,x.romaji,x.meaning,x.category,x.pos].some(v=>normalizeTranslateKey(v).includes(k)))}
 box.innerHTML=arr.slice(0,80).map(x=>'<div class="vocab-item"><div class="vocab-main"><div class="vocab-jp">'+escapeHtml(x.japanese)+'</div><div class="vocab-romaji">'+escapeHtml(x.romaji||smartRomaji(x.japanese))+'</div><div class="vocab-meaning">'+escapeHtml(x.meaning)+'</div><div class="vocab-extra-meta">'+escapeHtml(x.pos||'—')+' · '+escapeHtml(x.category||'—')+' · '+escapeHtml(x.formality||'—')+(x.jlpt?' · '+escapeHtml(x.jlpt):'')+'</div></div><button class="icon-btn '+(jlFav.has(jlKey(x.japanese))?'active':'')+'" data-fav="'+escapeAttr(x.japanese)+'">'+(jlFav.has(jlKey(x.japanese))?'★':'☆')+'</button><button class="icon-btn" data-speak="'+escapeAttr(x.japanese)+'">🔊</button></div>').join('')||'<div class="up-muted">Tidak ditemukan.</div>';
}
function nextFlash(){
 if(!flashPool.length)flashPool=shuffle(JL_VOCAB).slice(0,Math.max(1,Number(localStorage.getItem('jl_flash_limit')||20)));
 const x=flashPool[flashIndex%flashPool.length];flashIndex++;window.JL_CURRENT=x;const card=document.getElementById('mainFlashcard');if(card)card.classList.remove('revealed');
 document.getElementById('flashJp').textContent=x.japanese;document.getElementById('flashRomaji').textContent=x.romaji||smartRomaji(x.japanese);document.getElementById('flashMeaning').textContent='Tekan "Arti"';document.getElementById('flashMeta').textContent=[x.pos,x.category,x.formality,x.jlpt].filter(Boolean).join(' · ');document.getElementById('flashExample').textContent=x.example?x.example+' — '+(x.exampleRomaji||smartRomaji(x.example))+' — '+x.exampleId:'';document.getElementById('flashFav').textContent=jlFav.has(jlKey(x.japanese))?'★':'☆';document.getElementById('flashFav').classList.toggle('active',jlFav.has(jlKey(x.japanese)));
}
function toggleFavorite(jp){const k=jlKey(jp);jlFav.has(k)?jlFav.delete(k):jlFav.add(k);jlSave(JL_FAV,[...jlFav]);try{localStorage.setItem('jl_favorite_data_v2',JSON.stringify([...jlFav].map(k=>JL_VOCAB.find(x=>jlKey(x.japanese)===k)).filter(Boolean)))}catch(e){}renderDash();renderVocabList(document.getElementById('vocabSearch')?.value||'');if(window.JL_CURRENT&&window.JL_CURRENT.japanese===jp){document.getElementById('flashFav').textContent=jlFav.has(k)?'★':'☆'}}
function markMastered(){if(!window.JL_CURRENT)return;jlMaster.add(jlKey(window.JL_CURRENT.japanese));jlSave(JL_MASTER,[...jlMaster]);renderDash();nextFlash()}
document.getElementById('vocabSearchBtn').addEventListener('click',()=>renderVocabList(document.getElementById('vocabSearch').value));
document.getElementById('vocabSearch').addEventListener('input',e=>renderVocabList(e.target.value));
document.getElementById('vocabList').addEventListener('click',e=>{const f=e.target.closest('[data-fav]');const sp=e.target.closest('[data-speak]');if(f)toggleFavorite(f.dataset.fav);if(sp)speak(sp.dataset.speak)});
document.getElementById('flashReveal').addEventListener('click',()=>{if(window.JL_CURRENT){document.getElementById('flashMeaning').textContent=window.JL_CURRENT.meaning;document.getElementById('mainFlashcard')?.classList.add('revealed')}});
document.getElementById('flashSpeak').addEventListener('click',()=>{if(window.JL_CURRENT)speak(window.JL_CURRENT.japanese)});
document.getElementById('flashFav').addEventListener('click',()=>{if(window.JL_CURRENT)toggleFavorite(window.JL_CURRENT.japanese)});
document.getElementById('flashMaster').addEventListener('click',markMastered);
document.getElementById('flashNext').addEventListener('click',nextFlash);
const savedSpeechRate = localStorage.getItem('jl_speech_rate'); if (savedSpeechRate) document.getElementById('speechRate').value = savedSpeechRate;
const savedFlashLimit = localStorage.getItem('jl_flash_limit'); if (savedFlashLimit) document.getElementById('flashLimit').value = savedFlashLimit;
document.getElementById('speechRate').addEventListener('change',e=>localStorage.setItem('jl_speech_rate',e.target.value));
document.getElementById('flashLimit').addEventListener('change',e=>{localStorage.setItem('jl_flash_limit',e.target.value);flashPool=[];flashIndex=0;nextFlash()});
document.getElementById('resetLearningBtn').addEventListener('click',()=>{if(confirm('Reset?')){jlFav.clear();jlMaster.clear();jlSave(JL_FAV,[]);jlSave(JL_MASTER,[]);renderDash();renderVocabList();nextFlash()}});
renderVocabList();nextFlash();setTimeout(renderDash,0);

const STORAGE_KEY='nihongo_checklist_v16', STREAK_KEY='nihongo_streak_v16';
const today = new Date();
document.getElementById('todayDate').textContent = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const todayKey = today.toISOString().split('T')[0];
let progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
if (progress.date !== todayKey) { progress = { date: todayKey, tasks: {} }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) {} }
let streakData = JSON.parse(localStorage.getItem(STREAK_KEY) || '{"lastDate":"","count":0}');
(function () { const y = new Date(today); y.setDate(y.getDate() - 1); const yk = y.toISOString().split('T')[0]; if (streakData.lastDate === todayKey) {} else if (streakData.lastDate === yk) { streakData.count += 1; streakData.lastDate = todayKey; } else { streakData.count = 1; streakData.lastDate = todayKey; } try { localStorage.setItem(STREAK_KEY, JSON.stringify(streakData)); } catch (e) {} document.getElementById('streakCount').textContent = streakData.count; })();
document.querySelectorAll('.task').forEach(task => {
  if (progress.tasks[task.dataset.id]) task.classList.add('done');
  task.addEventListener('click', () => { task.classList.toggle('done'); progress.tasks[task.dataset.id] = task.classList.contains('done'); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) {} updateProgress(); });
});
function updateProgress() {
  const all = document.querySelectorAll('.task'), done = document.querySelectorAll('.task.done');
  const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';
  document.getElementById('progressCount').textContent = done.length + ' / ' + all.length + ' tugas';
  document.querySelectorAll('.count').forEach(el => { const s = el.dataset.section; const p = s === 'pagi' ? 'p' : s === 'siang' ? 's' : s === 'malam' ? 'm' : 'w'; const st = document.querySelectorAll('.task[data-id^="' + p + '"]'), sd = document.querySelectorAll('.task[data-id^="' + p + '"].done'); el.textContent = sd.length + '/' + st.length; });
}
function resetAll() { if (!confirm('Reset checklist hari ini?')) return; progress.tasks = {}; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) {} document.querySelectorAll('.task').forEach(t => t.classList.remove('done')); updateProgress(); }

document.getElementById('translateBtn').addEventListener('click', doTranslate);
document.getElementById('translateInput').addEventListener('keydown', e => { if (e.key === 'Enter') doTranslate(); });
document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
document.getElementById('newQuizBtn').addEventListener('click', () => startQuiz(currentQuizType));
document.getElementById('resetBtn').addEventListener('click', resetAll);
document.getElementById('resultSpeakBtn')?.addEventListener('click',()=>{if(currentTranslationState?.jp)speak(currentTranslationState.jp)});
document.getElementById('resultCopyBtn')?.addEventListener('click',async()=>{const x=currentTranslationState;if(!x)return;try{await navigator.clipboard.writeText(x.jp+'\n'+(x.romaji||'')+'\n'+x.id);const b=document.getElementById('resultCopyBtn'),old=b.textContent;b.textContent='✅ Tersalin';setTimeout(()=>b.textContent=old,1200)}catch(e){}});
document.getElementById('resultFavBtn')?.addEventListener('click',()=>{const x=currentTranslationState;if(!x)return;const k=jlKey(x.jp);jlFav.has(k)?jlFav.delete(k):jlFav.add(k);jlSave(JL_FAV,[...jlFav]);const b=document.getElementById('resultFavBtn');b.textContent=jlFav.has(k)?'⭐ Favorit tersimpan':'☆ Favorit'});
document.getElementById('resultLearnBtn')?.addEventListener('click',()=>{const x=currentTranslationState;if(!x)return;document.querySelector('[data-tab="upgrade"]')?.click();setTimeout(()=>{const inp=document.getElementById('vocabSearch');if(inp){inp.value=x.jp;renderVocabList(x.jp)}},80)});
document.getElementById('resultAltBtn')?.addEventListener('click',()=>{const b=document.getElementById('formalityBox');if(b){b.classList.toggle('show');b.scrollIntoView({behavior:'smooth',block:'nearest'})}});

/* INIT */
async function init() {
  const overlay = document.getElementById('loadingOverlay');
  try {
    await loadRemoteConfig();
  if (!firebaseAuth) console.warn('Firebase Auth script tidak tersedia.');
  } catch (e) { console.warn(e); }
  overlay.classList.add('hidden');
  renderHistory(); updateProgress(); startQuiz('hiragana');
  renderStore(); initGate(); renderKesopananList();
  checkAutoLogin();
}
init();
