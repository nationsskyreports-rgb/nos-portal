/* ═══════════════════════════════════════════════════
   app-utils.js — Globals, Supabase, gasRun, Modal, Toast
   ═══════════════════════════════════════════════════ */

/* ─── 01. GLOBAL VARIABLES ─── */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbzoZ9UyMCmaJ8oB1peBRRsHwEh2pYng_OeJ2v49Mu17wy1_j1O-vOKCDsj86FpnQk01/exec';

let isDark             = true;
let radioValues        = {};
let agentCodeMap       = {};
let selectedBreakType  = '';
let breakCheckTimer    = null;
let currentBreaks      = null;
let shiftEndSecs       = null;
let shiftEndNotified   = false;
let isMuted            = false;
let notifPlaying       = false;
let notifSoundCount    = 0;
let modalCb            = null;
let selectedTimeOffType= null;
let sessionAgent       = null;
let globalScheduleData = [];
let globalTeamData     = [];
let currentAnnualData  = { used: 0, left: 0 };
let schMyAgentId       = null;
let sbBreaksChannel    = null;
let swapPollTimer      = null;
let knownSwapStatuses  = {};

/* ─── FIX: submission tracker لمنع race conditions ─── */
let _activeSubmission  = 0;

let _notifFired = {
  break1_warn:false, break1_start:false, break1_end:false,
  lunch_warn:false,  lunch_start:false,  lunch_end:false,
  break2_warn:false, break2_start:false, break2_end:false,
  shift_warn:false,  shift_end:false,    shift_late:false,
};

/* ─── SUPABASE ─── */
const SB_URL_SCH = 'https://xzxdaupwwwdcwfnqweub.supabase.co';
// المفتاح الجديد (publishable) — آمن يظهر في المتصفح، بيتجاب من:
// Supabase → Project Settings → API Keys → Publishable key
const SB_KEY_SCH = 'sb_publishable_o6WgAntCWj8sD9jBhQQ0Tw_FA3GngrR';
const sbClient = window.supabase.createClient(SB_URL_SCH, SB_KEY_SCH, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'ns-auth-session',
  }
});

// Restore token from session if exists
// ⚠️ الـ publishable key مش JWT — مينفعش يتبعت كـ Bearer
//     لو مفيش token محفوظ، نخليه null والـ getAuthHeaders تتعامل
window._authToken = sessionStorage.getItem('ns-auth-token') || null;

// ── تحديث التوكن تلقائياً + استرداد ذكي ──
sbClient.auth.onAuthStateChange(async (event, session) => {
  if (session && session.access_token) {
    window._authToken = session.access_token;
    sessionStorage.setItem('ns-auth-token', session.access_token);
  }
  // لو السيشن ماتت وهو على الداشبورد — حاول recovery الأول قبل الـ logout
  if (event === 'SIGNED_OUT' && document.getElementById('screen-dashboard')?.style.display !== 'none') {
    // حاول تجدد السيشن — ممكن الـ event يكون من tab تاني (Admin Portal)
    try {
      const { data: refreshed } = await sbClient.auth.refreshSession();
      if (refreshed?.session) {
        window._authToken = refreshed.session.access_token;
        sessionStorage.setItem('ns-auth-token', refreshed.session.access_token);
        console.log('Session recovered after SIGNED_OUT event');
        return; // ✅ اتعالجت — ما ترجعش login
      }
    } catch(e) {}
    // فشل الـ recovery — ارجع login
    sessionStorage.removeItem('ns-session');
    sessionStorage.removeItem('ns-auth-token');
    window._authToken = null;
    _showLoginScreen();
  }
});

// ── إعادة تنشيط السيشن لما المستخدم يرجع للتاب ──
// المتصفح بيخنق الـ timers في التابات الخلفية فالتوكن ممكن يخلص
// من غير ما autoRefreshToken يلحق يجدده — ده بيصلح اللحظة دي
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  try {
    const { data: { session }, error } = await sbClient.auth.getSession();
    if (error || !session) {
      const { data: refreshed } = await sbClient.auth.refreshSession();
      if (refreshed?.session) {
        window._authToken = refreshed.session.access_token;
        sessionStorage.setItem('ns-auth-token', refreshed.session.access_token);
      }
    } else {
      window._authToken = session.access_token;
      sessionStorage.setItem('ns-auth-token', session.access_token);
    }
  } catch(e) { console.warn('Session refresh on focus:', e); }
});

// شاشة اللوجين ترجع بسلاسة من غير ريلود
function _showLoginScreen() {
  const dash  = document.getElementById('screen-dashboard');
  const login = document.getElementById('screen-login');
  const pre   = document.getElementById('app-preloader');
  if (dash)  dash.style.display  = 'none';
  if (login) login.style.display = 'block';
  if (pre)   pre.classList.add('hidden');
  const msg = document.getElementById('login-msg');
  if (msg) { msg.style.color = 'var(--warning)'; msg.innerHTML = '<i class="fas fa-clock"></i> Session expired — please sign in again'; }
}


/* ─── LOCAL DATE (Cairo timezone) ─── */
function getLocalDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
}
async function getAuthHeaders(extra) {
  // دايماً جيب أحدث token من الـ session
  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session && session.access_token) {
      window._authToken = session.access_token;
      sessionStorage.setItem('ns-auth-token', session.access_token);
    }
  } catch(e) {}
  // ⚠️ لو مفيش JWT، استخدم الـ publishable key كـ Bearer (PostgREST بيقبله في الـ apikey header)
  const bearerToken = window._authToken || SB_KEY_SCH;
  return Object.assign({
    'apikey':        SB_KEY_SCH,
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type':  'application/json'
  }, extra || {});
}

/* ─── FIX: expose للـ offline-calllog.js ─── */
window.SB_URL_SCH = SB_URL_SCH;
window.SB_KEY_SCH = SB_KEY_SCH;

async function sbFetchSch(path, _isRetry) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SB_URL_SCH}/rest/v1/${path}`, { headers });
  if (res.ok) return res.json();

  // ── لو التوكن خلص — جدده وأعد المحاولة مرة واحدة ──
  if (!_isRetry && (res.status === 401 || res.status === 403)) {
    try {
      const { data: refreshed } = await sbClient.auth.refreshSession();
      if (refreshed?.session) {
        window._authToken = refreshed.session.access_token;
        sessionStorage.setItem('ns-auth-token', refreshed.session.access_token);
        return sbFetchSch(path, true);
      }
    } catch(e) {}
    // لو الـ refresh فشل — جرب بالـ apikey بدون Bearer JWT
    if (!_isRetry) {
      try {
        const fallbackRes = await fetch(`${SB_URL_SCH}/rest/v1/${path}`, {
          headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json' }
        });
        if (fallbackRes.ok) return fallbackRes.json();
      } catch(e) {}
    }
  }
  // لو فشل retry — نرجّع [] بدل ما الصفحة تموت
  try { return await res.json(); } catch(e) { return []; }
}

/* ─── UTILITY: gasRun (FIXED — CORS) ─── */
function gasRun(action, ...args) {
  /*
   * FIX: الـ GAS بيعمل redirect من HTTP → HTTPS
   * وده بيكسر الـ CORS لأن الـ browser بيحذف headers عند الـ redirect.
   * الحل: نبعت الـ action كـ query param + body معاً،
   * ونستخدم Content-Type: text/plain عشان نتجنب الـ preflight request.
   */
  const url = GAS_URL + '?action=' + encodeURIComponent(action);

  return fetch(url, {
    method:  'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body:    JSON.stringify({ action, args })
  })
  .then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  })
  .then(text => {
    try {
      return JSON.parse(text);
    } catch(e) {
      console.error('gasRun — invalid JSON:', text.substring(0, 200));
      throw new Error('Invalid JSON response');
    }
  });
}

/* ─── UTILITY: setButtonLoading ─── */
function setButtonLoading(btn, isLoading, label) {
  if (!btn) return;
  if (isLoading) {
    btn._origHTML     = btn.innerHTML;
    btn._origDisabled = btn.disabled;
    btn.disabled      = true;
    btn.style.opacity = '0.8';
    btn.innerHTML     = `<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>${label || 'Loading...'}`;
  } else {
    btn.disabled      = btn._origDisabled || false;
    btn.style.opacity = '1';
    btn.innerHTML     = btn._origHTML || label || 'Submit';
  }
}

/* ─── 06. MODAL & ALERT ─── */
function showModal(title, msg, confirm) {
  return new Promise(resolve => {
    modalCb = resolve;
    document.getElementById('modal-title').innerText  = title;
    document.getElementById('modal-msg').innerText    = msg;
    document.getElementById('modal-cancel').style.display = confirm ? 'block' : 'none';
    document.getElementById('modal-ok').innerText     = confirm ? 'Yes' : 'OK';
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('modal-box').style.display     = 'block';
  });
}

function closeModal(result) {
  document.getElementById('modal-overlay').style.display = 'none';
  document.getElementById('modal-box').style.display     = 'none';
  if (modalCb) { modalCb(result); modalCb = null; }
}

function customAlert(t, m)   { return showModal(t, m, false); }
function customConfirm(t, m) { return showModal(t, m, true); }

function togglePw(id, btn) {
  const el = document.getElementById(id);
  const ic = btn.querySelector('i');
  el.type      = el.type === 'password' ? 'text' : 'password';
  ic.className = el.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}

/* ─── 20. TOAST NOTIFICATIONS ─── */
function showToast(icon, title, sub, type, duration) {
  type     = type     || 'info';
  duration = duration !== undefined ? duration : 6000;
  const container = document.getElementById('nos-toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'nos-toast t-' + type;
  const barColors = { info:'var(--primary-gradient)', warn:'linear-gradient(90deg,#f59e0b,#d97706)', danger:'linear-gradient(90deg,#ef4444,#dc2626)', success:'linear-gradient(90deg,#059669,#047857)' };
  const barStyle  = duration > 0 ? `animation-duration:${duration}ms;background:${barColors[type]||barColors.info};` : '';
  toast.innerHTML =
    `<div class="nos-toast-icon">${icon}</div>` +
    `<div class="nos-toast-body"><div class="nos-toast-title">${title}</div>${sub?`<div class="nos-toast-sub">${sub}</div>`:''}</div>` +
    `<button class="nos-toast-close" onclick="dismissToast(this.parentElement)">✕</button>` +
    (duration > 0 ? `<div class="nos-toast-bar" style="${barStyle}"></div>` : '');
  container.appendChild(toast);
  playNotifSoundTyped(type);
  if (duration > 0) setTimeout(() => dismissToast(toast), duration);
  return toast;
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains('hiding')) return;
  toast.classList.add('hiding');
  setTimeout(() => { if (toast.parentElement) toast.parentElement.removeChild(toast); }, 400);
}

function logoutToast() { showToast('✅','Logged out successfully!','See you next shift!','success',5000); }

/* ─── RESULT POPUP ─── */
function showResultPopup(type, title, msg, btnText, onClose) {
  const el = document.getElementById('nos-result-popup');
  el.innerHTML = `
    <div class="nos-popup-inner">
      <div class="nos-popup-icon ${type}">${type === 'success' ? '✅' : '❌'}</div>
      <div class="nos-popup-title">${title}</div>
      <div class="nos-popup-msg">${msg}</div>
      <button class="nos-popup-btn ${type === 'error' ? 'danger' : ''}"
        onclick="closeResultPopup()">${btnText || 'تمام'}</button>
    </div>`;
  el.style.display = 'flex';
  window._popupOnClose = onClose || null;
  if (type === 'success') {
    window._popupAutoClose = setTimeout(() => closeResultPopup(), 4000);
  }
  el.onclick = function(e) { if (e.target === el) closeResultPopup(); };
}

function closeResultPopup() {
  const el = document.getElementById('nos-result-popup');
  if (!el) return;
  el.style.display = 'none';
  el.innerHTML = '';
  if (window._popupAutoClose) { clearTimeout(window._popupAutoClose); window._popupAutoClose = null; }
  if (window._popupOnClose)   { window._popupOnClose(); window._popupOnClose = null; }
}

function copySummary() {
  const name   = document.getElementById('cs-name').innerText;
  const mobile = document.getElementById('cs-mobile').innerText;
  const reason = document.getElementById('cs-reason').innerText;
  const text   = `Name: ${name}\nMobile: ${mobile}\nReason: ${reason}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋', 'Copied!', 'Customer info copied to clipboard', 'success', 3000);
  });
}

/* ─── CHANNEL SELECTOR ─── */
var _activeChannel = null;

function selectChannel(ch) {
  var formArea  = document.getElementById('calllog-form-area');
  var btnCall   = document.getElementById('btn-channel-call');
  var btnWA     = document.getElementById('btn-channel-whatsapp');
  var swCall    = document.getElementById('switch-call-btn');
  var swWA      = document.getElementById('switch-wa-btn');
  var icon      = document.getElementById('calllog-channel-icon');
  var title     = document.getElementById('calllog-channel-title');

  goStep(1);
  _currentStep = 1;

  /* ─── FIX: إلغاء أي submission قديمة عند تغيير الـ channel ─── */
  _activeSubmission++;

  if (_activeChannel === ch) {
    _activeChannel = null;
    formArea.style.display = 'none';
    btnCall.style.borderColor = 'var(--border)'; btnCall.style.background = 'var(--surface)';
    btnWA.style.borderColor   = 'var(--border)'; btnWA.style.background   = 'var(--surface)';
    return;
  }

  _activeChannel = ch;
  formArea.style.display = 'block';

  if (ch === 'call') {
    icon.innerText  = '📞'; title.innerText = 'Call Log';
    btnCall.style.borderColor = 'var(--primary)'; btnCall.style.background = 'rgba(212,175,55,0.1)';
    btnWA.style.borderColor   = 'var(--border)';  btnWA.style.background   = 'var(--surface)';
    swCall.style.borderColor  = 'var(--primary)'; swCall.style.color       = 'var(--primary)';
    swWA.style.borderColor    = 'var(--border)';  swWA.style.color         = 'var(--muted)';
    setTimeout(function() {
      var mobileOpt = document.querySelector('#f-channel .radio-opt:nth-child(2)');
      if (mobileOpt) selectRadio('f-channel', mobileOpt, 'Mobile');
    }, 100);
  } else {
    icon.innerText  = '💬'; title.innerText = 'WhatsApp Log';
    btnWA.style.borderColor   = '#25d366';        btnWA.style.background   = 'rgba(37,211,102,0.08)';
    btnCall.style.borderColor = 'var(--border)';  btnCall.style.background = 'var(--surface)';
    swWA.style.borderColor    = '#25d366';         swWA.style.color         = '#25d366';
    swCall.style.borderColor  = 'var(--border)';  swCall.style.color       = 'var(--muted)';
    setTimeout(function() {
      var waOpt = document.querySelector('#f-channel .radio-opt:first-child');
      if (waOpt) selectRadio('f-channel', waOpt, 'Whatsapp');
    }, 100);
  }

  formArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
