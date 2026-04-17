/* ═══════════════════════════════════════════════════
   app-core.js — Theme, Login, Dashboard, Navigation
   ═══════════════════════════════════════════════════ */

/* ─── 02. THEME ─── */
function applyTheme() {
  const dmIcon   = document.getElementById('side-darkmode-icon');
  const dmLabel  = document.getElementById('side-darkmode-label');
  const dmToggle = document.getElementById('side-darkmode-toggle');
  const dmKnob   = document.getElementById('side-darkmode-knob');
  if (isDark) {
    document.documentElement.classList.remove('light');
    if (dmIcon)   dmIcon.innerText   = '🌙';
    if (dmLabel)  dmLabel.innerText  = 'Currently Dark';
    if (dmToggle) dmToggle.style.background = 'var(--primary-gradient)';
    if (dmKnob)   dmKnob.style.transform    = 'translateX(0)';
  } else {
    document.documentElement.classList.add('light');
    if (dmIcon)   dmIcon.innerText   = '☀️';
    if (dmLabel)  dmLabel.innerText  = 'Currently Light';
    if (dmToggle) dmToggle.style.background = 'rgba(100,116,139,0.3)';
    if (dmKnob)   dmKnob.style.transform    = 'translateX(-18px)';
  }
}

function toggleDark() {
  isDark = !isDark;
  localStorage.setItem('ns-dark', isDark);
  applyTheme();
}

(function() {
  const saved = localStorage.getItem('ns-dark');
  isDark = saved === null ? true : saved === 'true';
})();
document.addEventListener('DOMContentLoaded', applyTheme);


/* ─── 03. SIDE MENU ─── */
function toggleSideMenu() {
  const menu    = document.getElementById('side-menu');
  const overlay = document.getElementById('side-menu-overlay');
  const isOpen  = menu.style.display === 'flex';
  if (isOpen) {
    closeSideMenu();
  } else {
    menu.style.transform  = 'translateX(-100%)';
    overlay.style.opacity = '0';
    menu.style.display    = 'flex';
    overlay.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      menu.style.transition    = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
      overlay.style.transition = 'opacity 0.35s ease';
      menu.style.transform     = 'translateX(0)';
      overlay.style.opacity    = '1';
    }));
    const name = document.getElementById('user-name').innerText.trim();
    document.getElementById('side-name').innerText = name;
    applyTheme();
  }
}

function closeSideMenu() {
  const menu    = document.getElementById('side-menu');
  const overlay = document.getElementById('side-menu-overlay');
  menu.style.transform  = 'translateX(-100%)';
  overlay.style.opacity = '0';
  setTimeout(() => {
    menu.style.display    = 'none';
    overlay.style.display = 'none';
    overlay.style.opacity = '1';
  }, 300);
}

/* ─── 04. CHANGE PASSWORD ─── */
function openChangePassword() {
  ['cp-old','cp-new','cp-confirm'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('cp-msg').innerText = '';
  document.getElementById('cp-overlay').style.display = 'block';
  document.getElementById('cp-modal').style.display   = 'block';
}

function closeChangePassword() {
  document.getElementById('cp-overlay').style.display = 'none';
  document.getElementById('cp-modal').style.display   = 'none';
}

async function submitChangePassword() {
  const name  = document.getElementById('user-name').innerText.trim();
  const oldP  = document.getElementById('cp-old').value;
  const newP  = document.getElementById('cp-new').value;
  const confP = document.getElementById('cp-confirm').value;
  const msg   = document.getElementById('cp-msg');

  if (!oldP || !newP || !confP) { msg.style.color = 'var(--danger)'; msg.innerText = 'Fill all fields'; return; }
  if (newP !== confP)           { msg.style.color = 'var(--danger)'; msg.innerText = "Passwords don't match!"; return; }

  msg.style.color = 'var(--primary)'; msg.innerText = 'Updating...';

  try {
    const res  = await fetch(
      `${SB_URL_SCH}/rest/v1/agents?select=id,password_hash&formal_name=eq.${encodeURIComponent(name)}&limit=1`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();

    if (!data || !data.length) { msg.style.color = 'var(--danger)'; msg.innerText = 'User not found'; return; }

    if (data[0].password_hash !== oldP) { msg.style.color = 'var(--danger)'; msg.innerText = 'Old password incorrect'; return; }
    const upd = await fetch(
      `${SB_URL_SCH}/rest/v1/agents?id=eq.${data[0].id}`,
      {
        method:  'PATCH',
        headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password_hash: newP, updated_at: new Date().toISOString() })
      }
    );

    if (upd.ok) {
      msg.style.color = '#059669';
      msg.innerText   = 'Password updated successfully!';
      setTimeout(() => closeChangePassword(), 2000);
    } else {
      msg.style.color = 'var(--danger)'; msg.innerText = 'Update failed. Try again.';
    }
  } catch(e) {
    msg.style.color = 'var(--danger)'; msg.innerText = 'Connection error!';
  }
}

/* ─── 05. APP INIT (FIXED — parallel GAS calls) ─── */
window.onload = async function() {
  applyTheme();
  if ('Notification' in window) Notification.requestPermission();
  let savedSession = null;
  try {
    const saved = sessionStorage.getItem('ns-session');
    if (saved) {
      const sess = JSON.parse(saved);
      if (sess && sess.name) savedSession = sess;
    }
  } catch(e) {}
  const agentListCall = fetch(
    `${SB_URL_SCH}/rest/v1/agents?select=formal_name&status=eq.Active&order=formal_name`,
    { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
  )
  .then(r => r.json())
  .then(data => (data || []).map(a => ({ name: a.formal_name, code: '' })))
  .catch(() => []);
  const loginCall = savedSession
    ? gasRun('processLogin', savedSession.name, 'REFRESH_MODE').catch(() => null)
    : Promise.resolve(null);
  const [agentResult, loginRes] = await Promise.all([agentListCall, loginCall]);
  const s2 = document.getElementById('f-agent');
  s2.innerHTML = '<option value="">Select agent...</option>';
  if (agentResult && agentResult.length) {
    agentResult.forEach(item => {
      agentCodeMap[item.name] = item.code;
      s2.add(new Option(item.name, item.name));
    });
  }
  if (loginRes && loginRes.status === 'success') {
    showDashboard(loginRes);
  } else {
    if (savedSession) sessionStorage.removeItem('ns-session');
    document.getElementById('app-preloader').classList.add('hidden');
  }
  const tof = document.getElementById('time-off-form');
  if (tof) tof.style.display = 'block';
  scheduleNightlyRefresh();
};

function scheduleNightlyRefresh() {
  const now    = new Date();
  const target = new Date();
  target.setHours(3, 0, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  const msUntil3AM = target - now;
  setTimeout(() => {
    window.location.reload(true);
  }, msUntil3AM);
  console.log(`Auto refresh in ${Math.round(msUntil3AM / 1000 / 60)} minutes`);
}

/* ─── 07. LOGIN & AUTH ─── */
function handleLoginSubmit(event) { event.preventDefault(); login(); }

function toggleReset(show) {
  const loginForm = document.getElementById('login-form-area');
  const resetForm = document.getElementById('reset-form');
  const agentName = document.getElementById('empList').value;
  if (show) {
    loginForm.classList.add('hidden');
    resetForm.classList.remove('hidden');
    document.getElementById('reset-agent-name').innerText = agentName || '';
  } else {
    resetForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  }
}

async function login() {
  document.getElementById('app-preloader').classList.remove('hidden');
  const name = document.getElementById('empList').value.trim();
  const pass = document.getElementById('pass').value;
  const msg  = document.getElementById('login-msg');
  const btn  = document.getElementById('loginBtn');

  if (!name || !pass) {
    document.getElementById('app-preloader').classList.add('hidden');
    customAlert('Error', 'Please enter name and password');
    return;
  }

  msg.style.color = 'var(--primary)';
  msg.innerHTML   = '<i class="fas fa-spinner spinner"></i> Verifying...';
  btn.disabled    = true;
  setButtonLoading(btn, true, 'Verifying...');

  try {
    const res  = await fetch(
      `${SB_URL_SCH}/rest/v1/agents?select=id,formal_name,role,password_hash,status&formal_name=eq.${encodeURIComponent(name)}&status=eq.Active&limit=1`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();

    setButtonLoading(btn, false, 'Login');
    btn.disabled = false;

    if (!data || !data.length) {
      document.getElementById('app-preloader').classList.add('hidden');
      msg.style.color = 'var(--danger)';
      msg.innerHTML   = '<i class="fas fa-times-circle"></i> Account not found!';
      return;
    }

    const agent = data[0];

    if (agent.password_hash !== pass) {
      document.getElementById('app-preloader').classList.add('hidden');
      msg.style.color = 'var(--danger)';
      msg.innerHTML   = '<i class="fas fa-times-circle"></i> Invalid Password';
      return;
    }

    schMyAgentId = agent.id;
    const loginRes = {
      status:         'success',
      name:           agent.formal_name,
      role:           agent.role || 'Agent',
      data:           null,
      schedule:       [],
      todayBreaks:    { shift: 'N/A', break1: '-', lunch: '-', break2: '-' },
      allStaffBreaks: [],
      userRequests:   []
    };

    showDashboard(loginRes);

  } catch(e) {
    setButtonLoading(btn, false, 'Login');
    btn.disabled = false;
    document.getElementById('app-preloader').classList.add('hidden');
    msg.style.color = 'var(--danger)';
    msg.innerHTML   = '<i class="fas fa-wifi"></i> Connection error!';
    console.error('Login error:', e);
  }
}

function submitReset() {
  const name  = document.getElementById('empList').value;
  const oldP  = document.getElementById('old-pass').value;
  const newP  = document.getElementById('new-pass').value;
  const confP = document.getElementById('confirm-pass').value;
  if (!oldP || !newP || !confP) { customAlert('Error', 'Fill all fields'); return; }
  if (newP !== confP)           { customAlert('Error', "Passwords don't match!"); return; }
  gasRun('updatePassword', name, oldP, newP).then(res => {
    if (res.status === 'success') customAlert('Success', 'Password updated!').then(() => toggleReset(false));
    else customAlert('Error', res.msg);
  });
}

function logout() {
  logoutToast();
  document.getElementById('side-menu').style.display         = 'none';
  document.getElementById('side-menu-overlay').style.display = 'none';
  try { sessionStorage.removeItem('ns-session'); } catch(e) {}
  sessionAgent = null;
  if (breakCheckTimer) clearInterval(breakCheckTimer);
  if (window._teamRefreshTimer) clearInterval(window._teamRefreshTimer);
  if (sbBreaksChannel) { sbClient.removeChannel(sbBreaksChannel); sbBreaksChannel = null; }
  stopNotifSound();
  currentBreaks = null; shiftEndSecs = null; shiftEndNotified = false;

  document.getElementById('screen-dashboard').style.display = 'none';
  document.getElementById('screen-login').style.display     = 'flex';

  const logo = document.getElementById('nsdAnimatedLogo');
  if (logo) {
    logo.classList.remove('logo-exit');
    logo.style.animation = 'none';
    void logo.offsetWidth;
    logo.style.animation = '';
  }

  document.getElementById('pass').value         = '';
  document.getElementById('login-msg').innerHTML = '';
  document.getElementById('empList').selectedIndex = 0;
  ['conformance','missing','aht','calls','annual','exceptions','quality']
    .forEach(k => document.getElementById('d-' + k).innerText = '-');

  switchTab('tab-dashboard', null, 0);
}


/* ─── 08. DASHBOARD ─── */
function showDashboard(res) {
  const logo = document.getElementById('nsdAnimatedLogo');
  if (logo) logo.classList.add('logo-exit');

  try { sessionStorage.setItem('ns-session', JSON.stringify({ name: res.name })); } catch(e) {}
  sessionAgent = res.name;
  window.currentUserRole = res.role || 'Agent';

  document.getElementById('screen-login').style.display     = 'none';
  document.getElementById('screen-dashboard').style.display = 'block';
  pushHistoryState();

  const initials = res.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('nav-avatar').innerText = initials;
  document.getElementById('user-name').innerText  = res.name;
  document.getElementById('f-agent').value        = res.name;
  loadLastTwoCalls(res.name);

  if (checkDataAvailability(res.data)) {
    currentAnnualData.left = res.data.annual    || 0;
    currentAnnualData.used = res.data.totalUsed || 0;
    ['conformance','missing','aht','calls','annual','exceptions','quality']
      .forEach(k => document.getElementById('d-' + k).innerText = res.data[k] || '-');
  }

  const shift     = res.todayBreaks ? res.todayBreaks.shift : 'N/A';
  const isWorking = shift && shift !== 'OFF' && shift !== 'N/A' && shift !== '-'
    && shift.trim() !== '' && !/^(annual|sick|casual|ph|task)$/i.test(shift.trim());

  const statusBanner = document.getElementById('status-banner');
  const breaksArea   = document.getElementById('today-breaks-area');

  renderTeam(res.allStaffBreaks || []);
  loadTeamBreaksFromSB();

  if (isWorking) {
    statusBanner.style.display = 'block';
    breaksArea.style.display   = 'block';
    document.getElementById('status-icon').innerText = '💼';

    const statusTextEl = document.getElementById('status-text');
    statusTextEl.innerText        = shift;
    statusTextEl.style.color      = 'var(--primary)';
    statusTextEl.style.whiteSpace = 'nowrap';
    statusTextEl.style.overflow   = 'visible';
    statusTextEl.style.fontSize   = 'clamp(11px, 3vw, 18px)';
    statusTextEl.style.maxWidth   = '100%';
    statusTextEl.style.display    = 'block';
    document.getElementById('status-sub-text').innerText = 'Enjoy your shift!';

    const brShiftEl = document.getElementById('br-shift');
    if (brShiftEl) {
      brShiftEl.innerText          = 'SHIFT: ' + shift;
      brShiftEl.style.whiteSpace   = 'nowrap';
      brShiftEl.style.overflow     = 'hidden';
      brShiftEl.style.textOverflow = 'ellipsis';
      brShiftEl.style.maxWidth     = '200px';
      brShiftEl.title              = shift;
    }

    try {
      const end = shift.split('-')[1].trim().split(':');
      shiftEndSecs     = parseInt(end[0]) * 3600 + parseInt(end[1] || 0) * 60;
      shiftEndNotified = false;
    } catch(e) {}

    const agentName = res.name;
    sbFetchSch(`agents?select=id&formal_name=eq.${encodeURIComponent(agentName)}&status=eq.Active`)
      .then(async agents => {
        if (!agents || !agents.length) { _applyGASBreaks(res.todayBreaks); return; }
        const agentId = agents[0].id;
        schMyAgentId  = agentId;
        const breaks  = await loadTodayBreaksFromSB(agentId);
        if (breaks) applyBreaksToUI(breaks);
        else _applyGASBreaks(res.todayBreaks);
        subscribeTodayBreaks(agentId);
      });

  } else {
    statusBanner.style.display = 'block';
    breaksArea.style.display   = 'none';
    const shiftLow = shift.toLowerCase();
    let ico, col, sub;
    if      (shiftLow.includes('annual'))  { ico='🏖️'; col='var(--accent)';  sub='Enjoy your annual leave!'; }
    else if (shiftLow.includes('sick'))    { ico='❤️‍🩹'; col='var(--danger)'; sub='Get well soon!'; }
    else if (shiftLow.includes('casual'))  { ico='☕';  col='var(--warn)';   sub='Casual leave today.'; }
    else if (shiftLow === 'ph' || shiftLow.includes('holiday')) { ico='🎉'; col='var(--accent)'; sub='Public Holiday!'; }
    else if (shiftLow.includes('task'))    { ico='📋'; col='#3b82f6';        sub='Task day!'; }
    else                                   { ico='😴'; col='var(--muted)';   sub='Enjoy your day off!'; }
    document.getElementById('status-icon').innerText     = ico;
    document.getElementById('status-text').innerText     = shift;
    document.getElementById('status-text').style.color   = col;
    document.getElementById('status-sub-text').innerText = sub;
    if (breakCheckTimer) clearInterval(breakCheckTimer);
    if (swapPollTimer)   clearInterval(swapPollTimer);
    knownSwapStatuses = {};
  }

  schShiftTypes = [];
  loadAgentSchedule();
  loadMyRequests();
  globalScheduleData = res.schedule       || [];
  globalTeamData     = res.allStaffBreaks || [];
  populateSwapForm();

  const tof = document.getElementById('time-off-form');
  if (tof) tof.style.display = 'block';

  document.getElementById('app-preloader').classList.add('hidden');
}

function _applyGASBreaks(todayBreaks) {
  document.getElementById('br-break1').innerText = todayBreaks?.break1 || 'N/A';
  document.getElementById('br-lunch').innerText  = todayBreaks?.lunch  || 'N/A';
  document.getElementById('br-break2').innerText = todayBreaks?.break2 || 'N/A';
  startBreakChecker(todayBreaks || {});
}

function refreshData() {
  const name   = document.getElementById('user-name').innerText.trim();
  const avatar = document.getElementById('nav-avatar');
  avatar.style.animation = 'spin 0.8s linear infinite';
  gasRun('processLogin', name, 'REFRESH_MODE').then(res => {
    avatar.style.animation = '';
    if (res.status === 'success') showDashboard(res);
  }).catch(() => { avatar.style.animation = ''; });
}

function checkDataAvailability(data) {
  const banner  = document.getElementById('no-data-banner');
  const kpiGrid = document.querySelector('.kpi-grid');
  if (!data) {
    banner.style.display        = 'block';
    kpiGrid.style.opacity       = '0.15';
    kpiGrid.style.filter        = 'grayscale(1)';
    kpiGrid.style.pointerEvents = 'none';
    return false;
  } else {
    banner.style.display        = 'none';
    kpiGrid.style.opacity       = '1';
    kpiGrid.style.filter        = 'none';
    kpiGrid.style.pointerEvents = 'auto';
    return true;
  }
}


/* ─── 12. KPI FILTER ─── */
function changeMonthData() {
  const month  = document.getElementById('monthFilter').value;
  const name   = document.getElementById('user-name').innerText.trim();
  const loader = document.getElementById('filter-loader');
  loader.classList.remove('hidden');
  document.getElementById('annual-label').innerText = month === 'CURRENT' ? 'Annual Left' : 'Annual Used';
  gasRun('getFilteredData', name, month).then(data => {
    loader.classList.add('hidden');
    if (checkDataAvailability(data)) {
      if (month === 'CURRENT') currentAnnualData.left = data.annual || 0;
      currentAnnualData.used = data.totalUsed || 0;
      ['conformance','missing','aht','calls','annual','exceptions','quality']
        .forEach(k => document.getElementById('d-' + k).innerText = data[k] || '-');
    }
  });
}


/* ─── 21. ANNUAL LEAVE ─── */
function showAnnualDetails() {
  const details = document.getElementById('annual-details');
  if (details.style.display !== 'none') { details.style.display = 'none'; return; }
  const name = document.getElementById('user-name').innerText.trim();
  details.style.display = 'block';
  ['annual-entitlement','annual-carry','annual-total','annual-used','annual-remaining']
    .forEach(id => document.getElementById(id).innerText = '...');
  gasRun('getAnnualData', name).then(data => {
    if (!data) { details.style.display = 'none'; return; }
    document.getElementById('annual-entitlement').innerText = data.entitlement + ' Days';
    document.getElementById('annual-carry').innerText       = data.carryOver   + ' Days';
    document.getElementById('annual-total').innerText       = data.total       + ' Days';
    document.getElementById('annual-used').innerText        = data.used        + ' Days';
    document.getElementById('annual-remaining').innerText   = data.remaining   + ' Days';
    const monthsDiv = document.getElementById('annual-months');
    monthsDiv.innerHTML = data.months && data.months.length
      ? data.months.map(m => '📅 '+m.month+': <b>'+m.used+' Days</b>').join(' &nbsp;|&nbsp; ')
      : '';
  });
}


/* ─── 22. MISSING PUNCH ─── */
async function sendMissingPunch() {
  const name             = document.getElementById('user-name').innerText.trim();
  const missingPunchDate = document.getElementById('missingPunchDate').value;
  if (!missingPunchDate) { customAlert('Error', 'Please select a date for the missing punch.'); return; }
  if (!schMyAgentId)     { customAlert('Error', 'Agent not found — please refresh!'); return; }

  customConfirm('Confirm', 'Report Missing Punch for ' + missingPunchDate + '?').then(async r => {
    if (!r) return;
    const mpBtn = document.querySelector('[onclick="sendMissingPunch()"]');
    if (mpBtn) setButtonLoading(mpBtn, true, 'Sending...');
    try {
      const res = await fetch(`${SB_URL_SCH}/rest/v1/requests`, {
        method:  'POST',
        headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          agent_id: schMyAgentId, agent_name: name, type: 'Missing Punch', status: 'Pending',
          details: JSON.stringify({ date: missingPunchDate }),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        })
      });
      if (mpBtn) setButtonLoading(mpBtn, false, '⚠️ Report Punch');
      if (res.ok) showToast('⚠️','Missing Punch Reported!','Your report for '+missingPunchDate+' has been sent.','warn',6000);
      else customAlert('Error', 'Failed. Try again.');
    } catch(e) {
      if (mpBtn) setButtonLoading(mpBtn, false, '⚠️ Report Punch');
      customAlert('Error', 'Connection error!');
    }
  });
}


/* ─── 23. NAVIGATION & TABS ─── */
function switchTab(id, btn, idx) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  if (id !== 'tab-form' && typeof _activeChannel !== 'undefined' && _activeChannel) {
    _activeChannel = null;
    var fa = document.getElementById('calllog-form-area');
    if (fa) fa.style.display = 'none';
    var bc = document.getElementById('btn-channel-call');
    var bw = document.getElementById('btn-channel-whatsapp');
    if (bc) { bc.style.borderColor = 'var(--border)'; bc.style.background = 'var(--surface)'; }
    if (bw) { bw.style.borderColor = 'var(--border)'; bw.style.background = 'var(--surface)'; }
  }
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'tab-kb')        loadKBSections();
  if (id === 'tab-form') { const btn = document.getElementById('formSubmitBtn'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to Database'; } }
  if (id === 'tab-schedule')  loadAgentSchedule();
  if (id === 'tab-sch-table') initSchTab();
  if (id === 'tab-mylog')     loadMyCallLog(); 
  if (btn) btn.classList.add('active');
  const bnBtns = document.querySelectorAll('.bottom-nav-btn');
  if (bnBtns[idx]) bnBtns[idx].classList.add('active');
}

function pushHistoryState() { history.pushState(null, '', window.location.href); }

window.addEventListener('popstate', () => {
  const dashboard = document.getElementById('screen-dashboard');
  if (dashboard && dashboard.style.display === 'block') {
    customConfirm('Logout', 'Are you sure you want to logout?').then(r => {
      if (r) logout();
      else   history.pushState(null, '', window.location.href);
    });
  }
});

document.addEventListener('touchmove', e => {
  const dashboard = document.getElementById('screen-dashboard');
  if (dashboard && dashboard.style.display === 'block') {
    const touch  = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    if (target && !dashboard.contains(target)) e.preventDefault();
  }
}, { passive: false });
