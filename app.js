/* ═══════════════════════════════════════════════════
   NOS PORTAL — app.js  [PATCHED v2]
   ═══════════════════════════════════════════════════
   التعديلات:
   FIX-1: الشيفت في البانر / br-shift لا يتقطع
   FIX-2: SCH Table يفتح جدول الأسبوع الحالي والجاي فور فتح التاب
   FIX-3: زرار Search يظهر في Step 1 في Call Log
   FIX-4: Time Off section مفتوح علطول بدون toggle
   FIX-5: كل أزرار Submit تعرض Loading spinner
   ═══════════════════════════════════════════════════ */


/* ─── 01. GLOBAL VARIABLES ─── */
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyZ9r-ydfSfduPl1Kg0Y8S8GECJe2cGCz9_3NgpI_F4mD35-oEVKnTfXa3gWEAo2GJb/exec';

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

/* Break notification fire-once flags */
let _notifFired = {
  break1_warn:false, break1_start:false, break1_end:false,
  lunch_warn:false,  lunch_start:false,  lunch_end:false,
  break2_warn:false, break2_start:false, break2_end:false,
  shift_warn:false,  shift_end:false,    shift_late:false,
};


/* ─── 02. THEME (DARK / LIGHT) ─── */
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
    menu.style.transform = 'translateX(-100%)';
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

function submitChangePassword() {
  const name  = document.getElementById('user-name').innerText.trim();
  const oldP  = document.getElementById('cp-old').value;
  const newP  = document.getElementById('cp-new').value;
  const confP = document.getElementById('cp-confirm').value;
  const msg   = document.getElementById('cp-msg');

  if (!oldP || !newP || !confP) { msg.style.color = 'var(--danger)'; msg.innerText = 'Fill all fields'; return; }
  if (newP !== confP)           { msg.style.color = 'var(--danger)'; msg.innerText = "Passwords don't match!"; return; }

  msg.style.color = 'var(--primary)'; msg.innerText = 'Updating...';
  gasRun('updatePassword', name, oldP, newP).then(res => {
    if (res.status === 'success') {
      msg.style.color = '#059669';
      msg.innerText   = 'Password updated successfully!';
      setTimeout(() => closeChangePassword(), 2000);
    } else {
      msg.style.color = 'var(--danger)';
      msg.innerText   = res.msg;
    }
  });
}


/* ─── 05. APP INIT ─── */
window.onload = function() {
  applyTheme();
  if ('Notification' in window) Notification.requestPermission();

  gasRun('getAgentList').then(result => {
    const s2 = document.getElementById('f-agent');
    s2.innerHTML = '<option value="">Select agent...</option>';
    if (result && result.length) {
      result.forEach(item => {
        agentCodeMap[item.name] = item.code;
        s2.add(new Option(item.name, item.name));
      });
    }

    try {
      const saved = sessionStorage.getItem('ns-session');
      if (saved) {
        const sess = JSON.parse(saved);
        if (sess && sess.name) {
          gasRun('processLogin', sess.name, 'REFRESH_MODE').then(res => {
            if (res.status === 'success') showDashboard(res);
            else {
              sessionStorage.removeItem('ns-session');
              document.getElementById('app-preloader').classList.add('hidden');
            }
          }).catch(() => {
            sessionStorage.removeItem('ns-session');
            document.getElementById('app-preloader').classList.add('hidden');
          });
        } else {
          document.getElementById('app-preloader').classList.add('hidden');
        }
      } else {
        document.getElementById('app-preloader').classList.add('hidden');
      }
    } catch(e) {
      document.getElementById('app-preloader').classList.add('hidden');
    }

  }).catch(() => {
    document.getElementById('app-preloader').classList.add('hidden');
  });

  /* ── FIX-4: Time Off section مفتوح علطول ── */
  const timeOffSection = document.getElementById('time-off-form');
  if (timeOffSection) timeOffSection.style.display = 'block';
};


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

function login() {
  document.getElementById('app-preloader').classList.remove('hidden');
  const name = document.getElementById('empList').value;
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
  /* FIX-5 */ setButtonLoading(btn, true, 'Verifying...');

  gasRun('processLogin', name, pass).then(res => {
    /* FIX-5 */ setButtonLoading(btn, false, 'Login');
    btn.disabled = false;
    if (res.status === 'success') {
      showDashboard(res);
    } else {
      document.getElementById('app-preloader').classList.add('hidden');
      msg.style.color = 'var(--danger)';
      msg.innerHTML   = '<i class="fas fa-times-circle"></i> ' + res.msg;
    }
  }).catch(() => {
    /* FIX-5 */ setButtonLoading(btn, false, 'Login');
    btn.disabled = false;
    document.getElementById('app-preloader').classList.add('hidden');
    msg.style.color = 'var(--danger)';
    msg.innerHTML   = '<i class="fas fa-wifi"></i> Connection error!';
  });
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
  document.getElementById('side-menu').style.display        = 'none';
  document.getElementById('side-menu-overlay').style.display= 'none';
  try { sessionStorage.removeItem('ns-session'); } catch(e) {}
  sessionAgent = null;
  if (breakCheckTimer) clearInterval(breakCheckTimer);
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

  document.getElementById('pass').value        = '';
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
  document.getElementById('nav-avatar').innerText  = initials;
  document.getElementById('user-name').innerText   = res.name;
  document.getElementById('f-agent').value         = res.name;
  loadLastTwoCalls(res.name); 

  if (checkDataAvailability(res.data)) {
    currentAnnualData.left = res.data.annual   || 0;
    currentAnnualData.used = res.data.totalUsed|| 0;
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
    document.getElementById('status-icon').innerText     = '💼';

    /* ── FIX-1: عرض الشيفت كامل بدون تقطيع ── */
    const statusTextEl = document.getElementById('status-text');
    statusTextEl.innerText   = shift;
    statusTextEl.style.color = 'var(--primary)';
    /* إضافة CSS يمنع الاقتطاع */
    statusTextEl.style.whiteSpace  = 'nowrap';
    statusTextEl.style.overflow    = 'visible';
   statusTextEl.style.fontSize     = 'clamp(11px, 3vw, 18px)';
   statusTextEl.style.maxWidth     = '100%';
   statusTextEl.style.overflow     = 'hidden';
   statusTextEl.style.textOverflow = 'ellipsis';
   statusTextEl.style.display      = 'block';
  
    document.getElementById('status-sub-text').innerText = 'Enjoy your shift!';

    /* FIX-1: br-shift بدون تقطيع */
    const brShiftEl = document.getElementById('br-shift');
    if (brShiftEl) {
      brShiftEl.innerText         = 'SHIFT: ' + shift;
      brShiftEl.style.whiteSpace  = 'nowrap';
      brShiftEl.style.overflow    = 'hidden';
      brShiftEl.style.textOverflow= 'ellipsis';
      brShiftEl.style.maxWidth    = '200px';
      brShiftEl.title             = shift; // tooltip كامل
    }

    try {
      const end = shift.split('-')[1].trim().split(':');
      shiftEndSecs     = parseInt(end[0]) * 3600 + parseInt(end[1] || 0) * 60;
      shiftEndNotified = false;
    } catch(e) {}

    const agentName = res.name;
    sbFetchSch(`agents?select=id&formal_name=eq.${encodeURIComponent(agentName)}&status=eq.Active`)
      .then(async agents => {
        if (!agents || !agents.length) {
          _applyGASBreaks(res.todayBreaks);
          return;
        }
        const agentId = agents[0].id;
        schMyAgentId  = agentId;

        const breaks = await loadTodayBreaksFromSB(agentId);
        if (breaks) {
          applyBreaksToUI(breaks);
        } else {
          _applyGASBreaks(res.todayBreaks);
        }

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
  globalScheduleData = res.schedule      || [];
  globalTeamData     = res.allStaffBreaks || [];
  populateSwapForm();

  /* ── FIX-4: التايم اوف مفتوح علطول ── */
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
    banner.style.display         = 'block';
    kpiGrid.style.opacity        = '0.15';
    kpiGrid.style.filter         = 'grayscale(1)';
    kpiGrid.style.pointerEvents  = 'none';
    return false;
  } else {
    banner.style.display         = 'none';
    kpiGrid.style.opacity        = '1';
    kpiGrid.style.filter         = 'none';
    kpiGrid.style.pointerEvents  = 'auto';
    return true;
  }
}


/* ─── 09. SCHEDULE RENDER ─── */
function renderSchedule(scheduleData) {
  const container = document.getElementById('schedule-content');
  if (typeof scheduleData === 'string') {
    container.innerHTML = scheduleData.trim()
      ? scheduleData
      : '<div class="empty-state">No schedule found.</div>';
    return;
  }
  if (!scheduleData || !scheduleData.length) {
    container.innerHTML = '<div class="empty-state">No schedule found.</div>';
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const dayOfWeek   = today.getDay();
  const weekStart   = new Date(today); weekStart.setDate(today.getDate() - dayOfWeek);
  const nextWeekStart = new Date(weekStart); nextWeekStart.setDate(weekStart.getDate() + 7);

  const thisWeek = [], nextWeek = [];
  scheduleData.forEach(d => {
    const parts = d.date.split('/');
    const dt    = new Date(parts[2], parts[1]-1, parts[0]); dt.setHours(0,0,0,0);
    if (dt < nextWeekStart) thisWeek.push(d); else nextWeek.push(d);
  });

  function buildWeekHtml(days, label) {
    if (!days.length) return '';
    let html = `<div class="week-section"><div class="nos-week-label">${label}</div><div class="nos-days-list">`;
    days.forEach((d, i) => {
      const shift      = (d.shift || '').toString().trim();
      const shiftLower = shift.toLowerCase();
      const todayClass = d.isToday ? ' nos-today' : '';
      const delay      = i * 40;
      let badge = '', displayShift = shift, shiftClass = '';

      if (!shift || shift === '-' || shift === '0' || shiftLower === 'off') {
        badge = '<span class="nos-status-badge nos-badge-off">OFF</span>';
        displayShift = 'Day Off'; shiftClass = ' nos-off';
      } else if (shiftLower === 'annual' || shiftLower.includes('annual leave')) {
        badge = '<span class="nos-status-badge nos-badge-annual">Annual</span>'; displayShift = '';
      } else if (shiftLower === 'sick' || shiftLower.includes('sick leave')) {
        badge = '<span class="nos-status-badge nos-badge-sick">Sick</span>'; displayShift = '';
      } else if (shiftLower === 'casual' || shiftLower.includes('casual leave')) {
        badge = '<span class="nos-status-badge nos-badge-casual">Casual</span>'; displayShift = '';
      } else if (shiftLower === 'ph' || shiftLower.includes('holiday')) {
        badge = '<span class="nos-status-badge nos-badge-ph">Public Holiday</span>'; displayShift = '';
      } else if (shiftLower === 'task' || shiftLower.includes('task day')) {
        badge = '<span class="nos-status-badge nos-badge-task">Task</span>'; displayShift = '';
      } else {
        badge = '<span class="nos-status-badge nos-badge-work">Working</span>';
      }

      html += `<div class="nos-day-card${todayClass}" style="animation-delay:${delay}ms">`;
      html += `<div class="nos-date-block"><div class="nos-day-name">${d.day||''}</div><div class="nos-day-num">${d.date?d.date.split('/')[0]:'–'}</div></div>`;
      html += `<div class="nos-shift-block">`;
      if (displayShift) html += `<div class="nos-shift-time${shiftClass}">${displayShift}</div>`;
      html += badge;
      if (d.isToday) html += '<span class="nos-today-badge">TODAY</span>';
      html += '</div></div>';
    });
    html += '</div></div>';
    return html;
  }

  container.innerHTML = `<div class="sched-container">${buildWeekHtml(thisWeek,'📅 THIS WEEK')}${buildWeekHtml(nextWeek,'📆 NEXT WEEK')}</div>`;
}

async function loadAgentSchedule() {
  const agentName = document.getElementById('user-name').innerText.trim();
  const [agents, shifts] = await Promise.all([
    sbFetchSch('agents?select=id,formal_name&status=eq.Active'),
    sbFetchSch('shift_types?select=id,name,start_time,end_time&is_active=eq.true')
  ]);
  schShiftTypes = shifts || [];
  const me = (agents||[]).find(a => a.formal_name.toLowerCase() === agentName.toLowerCase());
  if (me) schMyAgentId = me.id;

  const container = document.getElementById('schedule-content');
  if (!schMyAgentId) { container.innerHTML = '<div class="empty-state">Schedule not found.</div>'; return; }

  const records = await sbFetchSch(`schedule?select=*,schedule_weeks(week_start,week_end,status)&agent_id=eq.${schMyAgentId}`);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const curDay = today.getDay();
  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - curDay);
  const nextWeekStart = new Date(thisWeekStart); nextWeekStart.setDate(thisWeekStart.getDate() + 7);
  const nextWeekEnd   = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

  const schedMap = {};
  (records||[]).forEach(s => { schedMap[s.shift_date] = s; });

  function buildDays(startDate, endDate) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const result = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      const entry   = schedMap[iso];
      const dayType = entry ? entry.day_type : null;
      const stId    = entry ? entry.shift_type_id : null;
      const st      = schShiftTypes.find(s => s.id === stId);
      result.push({ iso, dayName: days[cur.getDay()], dayNum: String(cur.getDate()).padStart(2,'0'), dayType, st, isToday: iso === todayIso });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }

  function buildWeekHtml(days, label) {
    if (!days.length) return '';
    let html = `<div class="week-section"><div class="nos-week-label">${label}</div><div class="nos-days-list">`;
    days.forEach((d, i) => {
      const todayClass = d.isToday ? ' nos-today' : '';
      let badge = '', displayShift = '', shiftClass = '';

      if (!d.dayType || d.dayType === 'Off') {
        badge = '<span class="nos-status-badge nos-badge-off">OFF</span>';
        displayShift = 'Day Off'; shiftClass = ' nos-off';
      } else if (d.dayType === 'Work' && d.st) {
        displayShift = d.st.start_time.substring(0,5) + ' - ' + d.st.end_time.substring(0,5);
        badge = '<span class="nos-status-badge nos-badge-work">Working</span>';
      } else if (d.dayType === 'Annual') {
        badge = '<span class="nos-status-badge nos-badge-annual">Annual</span>';
      } else if (d.dayType === 'Sick') {
        badge = '<span class="nos-status-badge nos-badge-sick">Sick</span>';
      } else if (d.dayType === 'Casual') {
        badge = '<span class="nos-status-badge nos-badge-casual">Casual</span>';
      } else if (d.dayType === 'PH') {
        badge = '<span class="nos-status-badge nos-badge-ph">Public Holiday</span>';
      } else if (d.dayType === 'Task') {
        badge = '<span class="nos-status-badge nos-badge-task">Task</span>';
      }

      html += `<div class="nos-day-card${todayClass}" style="animation-delay:${i*40}ms">
        <div class="nos-date-block">
          <div class="nos-day-name">${d.dayName}</div>
          <div class="nos-day-num">${d.dayNum}</div>
        </div>
        <div class="nos-shift-block">
          ${displayShift ? `<div class="nos-shift-time${shiftClass}">${displayShift}</div>` : ''}
          ${badge}
          ${d.isToday ? '<span class="nos-today-badge">TODAY</span>' : ''}
        </div>
      </div>`;
    });
    html += '</div></div>';
    return html;
  }

  const thisWeekDays = buildDays(thisWeekStart, new Date(thisWeekStart.getTime() + 6*24*60*60*1000));
  const nextWeekDays = buildDays(nextWeekStart, nextWeekEnd);

  container.innerHTML = `<div class="sched-container">
    ${buildWeekHtml(thisWeekDays, '📅 THIS WEEK')}
    ${buildWeekHtml(nextWeekDays, '📆 NEXT WEEK')}
  </div>`;
}

function renderAgentWeek() {
  const weekId = document.getElementById('agent-sched-week').value;
  const week   = (window._agentSchedWeeks||[]).find(w => w.id === weekId);
  if (!week) return;

  const dates  = getSchWeekDates(week.week_start, week.week_end);
  const today  = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
  const daysEl = document.getElementById('agent-sched-days');

  let html = '<div class="nos-days-list">';
  dates.forEach((d, i) => {
    const entry   = (window._agentSchedMap||{})[d.iso];
    const dayType = entry ? entry.day_type : 'Off';
    const stId    = entry ? entry.shift_type_id : null;
    const st      = schShiftTypes.find(s => s.id === stId);
    const isToday = d.iso === today;

    let shift = 'Day Off', badge = '', shiftClass = ' nos-off';
    if (dayType === 'Work' && st) {
      shift = st.start_time.substring(0,5) + ' - ' + st.end_time.substring(0,5);
      badge = '<span class="nos-status-badge nos-badge-work">Working</span>';
      shiftClass = '';
    } else if (dayType === 'Annual') {
      shift = ''; badge = '<span class="nos-status-badge nos-badge-annual">Annual</span>'; shiftClass = '';
    } else if (dayType === 'Sick') {
      shift = ''; badge = '<span class="nos-status-badge nos-badge-sick">Sick</span>'; shiftClass = '';
    } else if (dayType === 'Casual') {
      shift = ''; badge = '<span class="nos-status-badge nos-badge-casual">Casual</span>'; shiftClass = '';
    } else if (dayType === 'PH') {
      shift = ''; badge = '<span class="nos-status-badge nos-badge-ph">Public Holiday</span>'; shiftClass = '';
    } else if (dayType === 'Task') {
      shift = ''; badge = '<span class="nos-status-badge nos-badge-task">Task</span>'; shiftClass = '';
    } else {
      badge = '<span class="nos-status-badge nos-badge-off">OFF</span>';
    }

    html += `<div class="nos-day-card${isToday?' nos-today':''}" style="animation-delay:${i*40}ms">
      <div class="nos-date-block">
        <div class="nos-day-name">${d.dayName}</div>
        <div class="nos-day-num">${d.display.split('/')[0]}</div>
      </div>
      <div class="nos-shift-block">
        ${shift ? `<div class="nos-shift-time${shiftClass}">${shift}</div>` : ''}
        ${badge}
        ${isToday ? '<span class="nos-today-badge">TODAY</span>' : ''}
      </div>
    </div>`;
  });
  html += '</div>';
  daysEl.innerHTML = html;
}


/* ─── 10. TEAM RENDER ─── */
function renderTeam(staff) {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  if (!staff.length) { grid.innerHTML = '<div class="empty-state">No team data available</div>'; return; }
  staff.forEach(s => {
    const init = s.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-card-header">
        <div class="team-avatar">${init}</div>
        <div class="team-name">${s.name}</div>
        <div class="team-shift">${s.shift || 'N/A'}</div>
      </div>
      <div class="team-break-row"><div class="team-break-dot" style="background:var(--primary)"></div><div class="team-break-label">Break 1</div><div class="team-break-time">${s.break1 || '-'}</div></div>
      <div class="team-break-row"><div class="team-break-dot" style="background:var(--accent)"></div><div class="team-break-label">Lunch</div><div class="team-break-time">${s.lunch || '-'}</div></div>
      <div class="team-break-row"><div class="team-break-dot" style="background:var(--danger)"></div><div class="team-break-label">Break 2</div><div class="team-break-time">${s.break2 || '-'}</div></div>`;
    grid.appendChild(card);
  });
}

async function loadTeamBreaksFromSB() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const breaksRes = await fetch(
      `${SB_URL_SCH}/rest/v1/breaks?break_date=eq.${today}&select=*,agents(id,formal_name)`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const breaksData = await breaksRes.json();
    if (!breaksData || !breaksData.length) return;

    const schedRes = await fetch(
      `${SB_URL_SCH}/rest/v1/schedule?shift_date=eq.${today}&select=agent_id,day_type`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const schedData = await schedRes.json();

    const dayTypeMap = {};
    (schedData || []).forEach(s => { dayTypeMap[s.agent_id] = s.day_type; });

    const staff = breaksData
      .filter(b => {
        const agentId = b.agents?.id || b.agent_id;
        return dayTypeMap[agentId] === 'Work';
      })
      .map(b => ({
        name:   b.agents?.formal_name || 'Unknown',
        shift:  b.shift_time ? b.shift_time.substring(0,11) : 'N/A',
        break1: b.break1 ? b.break1.substring(0,5) : '-',
        lunch:  b.lunch  ? b.lunch.substring(0,5)  : '-',
        break2: b.break2 ? b.break2.substring(0,5) : '-',
      }));

    staff.sort((a, b) => {
      const aTime = a.shift ? a.shift.split(' - ')[0] : '99:99';
      const bTime = b.shift ? b.shift.split(' - ')[0] : '99:99';
      return aTime.localeCompare(bTime);
    });
    renderTeam(staff);

  } catch(e) { console.error('Team breaks error:', e); }
}


/* ─── 11. REQUESTS RENDER ─── */
async function loadMyRequests() {
  if (!schMyAgentId) return;
  try {
    const res  = await fetch(
      `${SB_URL_SCH}/rest/v1/requests?agent_id=eq.${schMyAgentId}&order=created_at.desc`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();
    renderRequests(data || []);
  } catch(e) { console.error('loadMyRequests error:', e); }
}

function renderRequests(requests) {
  const container = document.getElementById('requests-list');
  if (!requests.length) { container.innerHTML = '<div class="empty-state">No previous requests found.</div>'; return; }
  container.innerHTML = '';
  const icons = {
    'Missing Punch':    'fa-fingerprint',
    'Excuse':           'fa-exclamation-circle',
    'Time Off':         'fa-calendar-check',
    'Shift Swap':       'fa-exchange-alt',
    'Schedule Request': 'fa-calendar-alt',
    'Break Change':     'fa-coffee',
  };
  requests.forEach(req => {
    const cls = req.status === 'Approved' ? 'status-approved' : req.status === 'Rejected' ? 'status-rejected' : 'status-pending';
    let details = '';
    try {
      const d = typeof req.details === 'string' ? JSON.parse(req.details) : req.details;
      if (req.type === 'Time Off')         details = `${d.request_type||''} · ${d.from_date||''} → ${d.to_date||''}`;
      else if (req.type === 'Shift Swap')  details = `${d.date||''} · with ${d.colleague||''}`;
      else if (req.type === 'Missing Punch') details = `Date: ${d.date||''}`;
      else if (req.type === 'Schedule Request') details = `أسبوع: ${d.week_start||''}`;
      else details = req.details || '';
    } catch(e) { details = ''; }

    const date = req.created_at ? new Date(req.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '';
    const time = req.created_at ? new Date(req.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';

    const div = document.createElement('div');
    div.className = 'req-card';
    div.innerHTML = `<div style="flex:1">
      <div class="req-type"><i class="fas ${icons[req.type]||'fa-file'}" style="margin-right:6px"></i>${req.type}</div>
      <div class="req-detail">${details}</div>
      <div class="req-date"><i class="fas fa-calendar" style="margin-right:4px"></i>${date} - ${time}</div>
    </div><div class="req-status ${cls}">${req.status}</div>`;
    container.appendChild(div);
  });
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


/* ─── 13. BREAK NOTIFICATIONS ─── */
function parseBreakTime(t) {
  if (!t || t === '-' || t === 'N/A') return null;
  const m = t.toString().match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null;
}

function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function addMins(timeStr, mins) {
  if (!timeStr) return '';
  const m = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!m) return timeStr;
  const total = parseInt(m[1]) * 60 + parseInt(m[2]) + mins;
  const h = Math.floor(total / 60) % 24, mn = total % 60;
  return (h < 10 ? '0'+h : h) + ':' + (mn < 10 ? '0'+mn : mn);
}

function showBanner(bannerId, title, sub) {
  const el = document.getElementById(bannerId); if (!el) return;
  const t  = el.querySelector('.notif-title');
  const s  = el.querySelector('.notif-sub');
  if (t) t.innerText = title;
  if (s) s.innerText = sub;
  el.classList.remove('hidden');
}
function hideBanner(bannerId) {
  const el = document.getElementById(bannerId);
  if (el) el.classList.add('hidden');
}

function sendNotif(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon:'logo.png', badge:'icon-192.png', vibrate:[200,100,200] });
  }
}

function checkBreaks() {
  if (!currentBreaks) return;
  const now  = nowMinutes();
  const fire = (key, fn) => { if (!_notifFired[key]) { _notifFired[key] = true; fn(); } };

  const b1 = parseBreakTime(currentBreaks.break1);
  if (b1 !== null) {
    if (now === b1-1)  fire('break1_warn',  () => { sendNotif('⏰ Break 1 in 1 minute!', 'Starting at '+currentBreaks.break1); showBanner('break-notif','⏰ Break 1 in 1 minute!','Starting at '+currentBreaks.break1); showToast('🔔','Break 1 starts in 1 minute!','Get ready — '+currentBreaks.break1,'warn',55000); });
    if (now === b1)    fire('break1_start', () => { sendNotif('☕ Break 1 has started!','15 min — back at '+addMins(currentBreaks.break1,15)); hideBanner('break-notif'); showBanner('break-notif','☕ Break 1 has started!','15 min — back at '+addMins(currentBreaks.break1,15)); showToast('☕','Break 1 has started!','15 min. Back at '+addMins(currentBreaks.break1,15),'success',10000); });
    if (now === b1+15) fire('break1_end',   () => { sendNotif('⏰ Break 1 is over!','Back to work!'); hideBanner('break-notif'); showToast('⏰','Break 1 is over!','Back to work!','info',8000); });
  }

  const ln = parseBreakTime(currentBreaks.lunch);
  if (ln !== null) {
    if (now === ln-1)  fire('lunch_warn',  () => { sendNotif('⏰ Lunch in 1 minute!','Starting at '+currentBreaks.lunch); showBanner('break-notif','⏰ Lunch in 1 minute!','Starting at '+currentBreaks.lunch); showToast('🔔','Lunch Break starts in 1 minute!','Get ready — '+currentBreaks.lunch,'warn',55000); });
    if (now === ln)    fire('lunch_start', () => { sendNotif('🍽️ Lunch has started!','30 min — back at '+addMins(currentBreaks.lunch,30)); hideBanner('break-notif'); showBanner('break-notif','🍽️ Lunch has started!','30 min — back at '+addMins(currentBreaks.lunch,30)); showToast('🍽️','Lunch Break has started!','30 min. Back at '+addMins(currentBreaks.lunch,30),'success',10000); });
    if (now === ln+30) fire('lunch_end',   () => { sendNotif('⏰ Lunch is over!','Back to work!'); hideBanner('break-notif'); showToast('⏰','Lunch Break is over!','Back to work!','info',8000); });
  }

  const b2 = parseBreakTime(currentBreaks.break2);
  if (b2 !== null) {
    if (now === b2-1)  fire('break2_warn',  () => { sendNotif('⏰ Break 2 in 1 minute!','Starting at '+currentBreaks.break2); showBanner('break-notif','⏰ Break 2 in 1 minute!','Starting at '+currentBreaks.break2); showToast('🔔','Break 2 starts in 1 minute!','Get ready — '+currentBreaks.break2,'warn',55000); });
    if (now === b2)    fire('break2_start', () => { sendNotif('☕ Break 2 has started!','15 min — back at '+addMins(currentBreaks.break2,15)); hideBanner('break-notif'); showBanner('break-notif','☕ Break 2 has started!','15 min — back at '+addMins(currentBreaks.break2,15)); showToast('☕','Break 2 has started!','15 min. Back at '+addMins(currentBreaks.break2,15),'success',10000); });
    if (now === b2+15) fire('break2_end',   () => { sendNotif('⏰ Break 2 is over!','Back to work!'); hideBanner('break-notif'); showToast('⏰','Break 2 is over!','Back to work!','info',8000); });
  }

  checkShiftEnd();
}

function checkShiftEnd() {
  if (shiftEndSecs === null) return;
  const nowMin      = nowMinutes();
  const shiftEndMin = Math.floor(shiftEndSecs / 60);
  const fire        = (key, fn) => { if (!_notifFired[key]) { _notifFired[key] = true; fn(); } };
  if (nowMin === shiftEndMin-15) fire('shift_warn', () => { showBanner('shift-end-notif','⏰ Shift ends in 15 minutes!','Start wrapping up.'); showToast('⏰','Shift ends in 15 minutes!','Start wrapping things up.','warn',12000); });
  if (nowMin === shiftEndMin)    fire('shift_end',  () => { showBanner('shift-end-notif','🚨 Your shift has ended!','Please logout now.'); showToast('🚨','Your shift has ended!','Please logout now.','danger',0); shiftEndNotified = true; });
  if (shiftEndNotified && nowMin === shiftEndMin+10) fire('shift_late', () => { showToast('🚨',"Still logged in!",'Shift ended 10 min ago. Please logout!','danger',0); });
}

function startBreakChecker(breaks) {
  currentBreaks = breaks;
  Object.keys(_notifFired).forEach(k => _notifFired[k] = false);
  shiftEndNotified = false;
  if (breakCheckTimer) clearInterval(breakCheckTimer);
  checkBreaks();
  breakCheckTimer = setInterval(checkBreaks, 30000);
}

function playNotifSoundTyped(type) {
  if (isMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const configs = {
      info:   [{f:600,t:0},{f:800,t:0.15}],
      warn:   [{f:800,t:0},{f:700,t:0.2},{f:800,t:0.4}],
      danger: [{f:400,t:0},{f:300,t:0.15},{f:400,t:0.3},{f:300,t:0.45}],
      success:[{f:600,t:0},{f:800,t:0.1},{f:1000,t:0.2}]
    };
    (configs[type] || configs.info).forEach(b => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = b.f; osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, ctx.currentTime + b.t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + b.t + 0.35);
      osc.start(ctx.currentTime + b.t); osc.stop(ctx.currentTime + b.t + 0.4);
    });
  } catch(e) {}
}

function stopNotifSound() { notifPlaying = false; isMuted = false; notifSoundCount = 0; }


/* ─── 14. BREAK SWAP ─── */
function selectBreakType(type, btn) {
  if (selectedBreakType === type) {
    selectedBreakType = '';
    btn.classList.remove('selected');
  } else {
    selectedBreakType = type;
    document.querySelectorAll('.break-type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
}

function sendBreakSwapRequest() {
  if (!selectedBreakType) { customAlert('Error', 'Please select a break type!'); return; }
  showBreakTimeModal();
}

function showBreakTimeModal() {
  const ov  = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;backdrop-filter:blur(4px);';
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:24px;min-width:300px;max-width:380px;width:90%;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,.4);';
  box.innerHTML = `
    <div style="font-family:Syne,sans-serif;font-size:17px;font-weight:800;color:var(--text);margin-bottom:16px;">Choose ${selectedBreakType} Time</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
      <div><label class="form-label">Hour</label><input type="number" id="bh" min="0" max="23" placeholder="00" class="form-input" style="text-align:center;font-size:20px;font-weight:800;"></div>
      <div><label class="form-label">Minute</label><input type="number" id="bm" min="0" max="59" placeholder="00" class="form-input" style="text-align:center;font-size:20px;font-weight:800;"></div>
    </div>
    <div style="display:flex;gap:10px;">
      <button id="bm-cancel" style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;color:var(--muted);cursor:pointer;font-weight:600;font-family:Plus Jakarta Sans,sans-serif;">Cancel</button>
      <button id="bm-confirm" style="flex:1;padding:12px;background:var(--primary-gradient);color:#fff;border:none;border-radius:11px;cursor:pointer;font-weight:700;font-family:Plus Jakarta Sans,sans-serif;opacity:.4;" disabled>Confirm</button>
    </div>`;
  document.body.appendChild(ov); document.body.appendChild(box);

  function validate() {
    const h = box.querySelector('#bh').value, m = box.querySelector('#bm').value;
    const ok = h !== '' && m !== '' && +h >= 0 && +h <= 23 && +m >= 0 && +m <= 59;
    box.querySelector('#bm-confirm').disabled = !ok;
    box.querySelector('#bm-confirm').style.opacity = ok ? 1 : 0.4;
  }
  box.querySelector('#bh').addEventListener('input', validate);
  box.querySelector('#bm').addEventListener('input', validate);
  const close = () => { document.body.removeChild(ov); document.body.removeChild(box); };
  box.querySelector('#bm-cancel').onclick = close; ov.onclick = close;
  box.querySelector('#bm-confirm').onclick = () => {
    const h = box.querySelector('#bh').value, m = box.querySelector('#bm').value;
    const time = (h.length < 2 ? '0'+h : h) + ':' + (m.length < 2 ? '0'+m : m);
    close(); confirmBreakTime(time);
  };
}

async function findAvailableBreakSlot(requestedTime, breakType, agentShiftStart, agentShiftEnd) {
  const today   = new Date().toISOString().split('T')[0];
  const colMap  = { 'Break 1': 'break1', 'Lunch': 'lunch', 'Break 2': 'break2' };
  const col     = colMap[breakType];
  const durMap  = { 'Break 1': 15, 'Lunch': 30, 'Break 2': 15 };
  const dur     = durMap[breakType];

  const res  = await fetch(
    `${SB_URL_SCH}/rest/v1/breaks?break_date=eq.${today}&select=*`,
    { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
  );
  const allBreaks = await res.json();

  const shiftStart = timeStrToMins(agentShiftStart);
  const shiftEnd   = timeStrToMins(agentShiftEnd);
  const noBreakStart = shiftStart + 60;
  const noBreakEnd   = shiftEnd   - 60;

  function hasConflict(slotMins) {
    const slotEnd = slotMins + dur;
    let count = 0;
    allBreaks.forEach(b => {
      if (!b[col]) return;
      const bStart = timeStrToMins(b[col].substring(0,5));
      const bEnd   = bStart + dur;
      const overlap = !(slotEnd <= bStart || slotMins >= bEnd);
      if (overlap) {
        const overlapMins = Math.min(slotEnd, bEnd) - Math.max(slotMins, bStart);
        if (overlapMins > 15) count++;
      }
    });
    return count >= 2;
  }

  let candidate = timeStrToMins(requestedTime);
  if (!hasConflict(candidate) && candidate >= noBreakStart && candidate <= noBreakEnd - dur) {
    return null;
  }

  for (let i = 1; i <= 8; i++) {
    const next = candidate + (i * 15);
    if (next > noBreakEnd - dur) break;
    if (!hasConflict(next)) {
      return minsToTimeStr(next);
    }
  }

  return null;
}

function timeStrToMins(t) {
  if (!t) return 0;
  const p = t.substring(0,5).split(':');
  return (+p[0]) * 60 + (+p[1]);
}

function minsToTimeStr(m) {
  return Math.floor(m/60).toString().padStart(2,'0') + ':' + (m%60).toString().padStart(2,'0');
}

async function confirmBreakTime(time) {
  if (!schMyAgentId) { showToast('❌','Error','Agent not found!','danger',4000); return; }

  const today  = new Date().toISOString().split('T')[0];
  const colMap = { 'Break 1': 'break1', 'Lunch': 'lunch', 'Break 2': 'break2' };
  const col    = colMap[selectedBreakType];
  const btn    = document.getElementById('swapBtn');
  const msg    = document.getElementById('swap-msg');

  if (!col) { showToast('❌','Error','Select break type first!','danger',4000); return; }

  /* FIX-5 */ setButtonLoading(btn, true, 'Updating...');
  msg.style.color = 'var(--muted)';
  msg.innerText   = 'Checking availability...';

  try {
    const shiftText = document.getElementById('br-shift').innerText.replace('SHIFT: ','');
    const shiftParts = shiftText.split(' - ');
    const shiftStart = shiftParts[0]?.trim() || '00:00';
    const shiftEnd   = shiftParts[1]?.trim() || '23:00';

    const suggestion = await findAvailableBreakSlot(time, selectedBreakType, shiftStart, shiftEnd);

    if (suggestion) {
      /* FIX-5 */ setButtonLoading(btn, false, '🔄 Swap Break');
      msg.style.color = 'var(--warn)';
      msg.innerText   = `⚠️ ${time} محجوز! أقرب وقت متاح: ${suggestion}`;

      const existingBtn = document.getElementById('suggest-btn');
      if (existingBtn) existingBtn.remove();
      const suggestBtn = document.createElement('button');
      suggestBtn.id        = 'suggest-btn';
      suggestBtn.innerText = `✅ استخدم ${suggestion}`;
      suggestBtn.style.cssText = 'margin-top:8px;padding:8px 16px;background:var(--primary-gradient);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-family:inherit;width:100%;';
      suggestBtn.onclick = () => {
        suggestBtn.remove();
        msg.innerText = '';
        confirmBreakTime(suggestion);
      };
      msg.parentElement.appendChild(suggestBtn);
      return;
    }

    msg.innerText = 'Updating...';

    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/breaks?agent_id=eq.${schMyAgentId}&break_date=eq.${today}`,
      {
        method:  'PATCH',
        headers: {
          'apikey':        SB_KEY_SCH,
          'Authorization': `Bearer ${SB_KEY_SCH}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal'
        },
        body: JSON.stringify({ [col]: time + ':00', updated_at: new Date().toISOString() })
      }
    );

    if (!res.ok) throw new Error('Update failed');

    if (currentBreaks) currentBreaks[col] = time;
    const elMap = { break1: 'br-break1', lunch: 'br-lunch', break2: 'br-break2' };
    const el = document.getElementById(elMap[col]);
    if (el) el.innerText = time;

    msg.style.color = 'var(--accent)';
    msg.innerText   = '✅ Updated!';
    showToast('✅', selectedBreakType + ' Updated!', 'New time: ' + time, 'success', 4000);

    selectedBreakType = '';
    document.querySelectorAll('.break-type-btn').forEach(b => b.classList.remove('selected'));

  } catch(e) {
    msg.style.color = 'var(--danger)';
    msg.innerText   = '❌ Failed. Try again.';
    showToast('❌', 'Update Failed!', 'Please try again.', 'danger', 4000);
  } finally {
    /* FIX-5 */ setButtonLoading(btn, false, '🔄 Swap Break');
    setTimeout(() => msg.innerText = '', 4000);
  }
}


/* ─── 15. EXCUSE & TIME OFF ─── */
async function sendExcuse() {
  const rawDate    = document.getElementById('excuseDate').value;
  const excuseType = document.getElementById('excuseType').value;
  if (!rawDate)    { customAlert('Error', 'Please select a date!'); return; }
  if (!excuseType) { customAlert('Error', 'Please select excuse type!'); return; }
  if (!schMyAgentId) { customAlert('Error', 'Agent not found — please refresh!'); return; }

  const name = document.getElementById('user-name').innerText.trim();
  const msg  = document.getElementById('excuse-msg');
  const btn  = document.getElementById('excuseBtn');

  setButtonLoading(btn, true, 'Submitting...');
  btn.disabled = true; msg.innerText = '';

  try {
    // 1. تحقق من الرصيد
    const d   = new Date(rawDate);
    const my  = d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear();
    const balRes  = await fetch(
      `${SB_URL_SCH}/rest/v1/excuses?agent_id=eq.${schMyAgentId}&status=eq.Approved&month_year=eq.${encodeURIComponent(my)}`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const balData = await balRes.json();
    if (balData.length >= 2) {
      customAlert('Error', 'You have reached the maximum excuses for this month!');
      setButtonLoading(btn, false, '✓ Submit');
      btn.disabled = false;
      return;
    }

    // 2. تحقق من الجدول
    const schedRes  = await fetch(
      `${SB_URL_SCH}/rest/v1/schedule?agent_id=eq.${schMyAgentId}&shift_date=eq.${rawDate}&select=day_type`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const schedData = await schedRes.json();
    if (!schedData.length || schedData[0].day_type !== 'Work') {
      customAlert('Error', 'You are not scheduled to work on this day!');
      setButtonLoading(btn, false, '✓ Submit');
      btn.disabled = false;
      return;
    }

    // 3. حفظ بـ Approved مباشرة
    const res = await fetch(`${SB_URL_SCH}/rest/v1/excuses`, {
      method:  'POST',
      headers: {
        'apikey':        SB_KEY_SCH,
        'Authorization': `Bearer ${SB_KEY_SCH}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify({
        agent_id:    schMyAgentId,
        agent_name:  name,
        excuse_date: rawDate,
        excuse_type: excuseType,
        status:      'Approved',
        month_year:  my,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
    });

    setButtonLoading(btn, false, '✓ Submit');
    btn.disabled = false;

    if (res.ok) {
      msg.style.color = 'var(--accent)';
      msg.innerText   = '✅ Excuse approved!';
      customAlert('Success', 'Excuse submitted and approved automatically!');
      setTimeout(() => msg.innerText = '', 5000);
    } else {
      msg.style.color = 'var(--danger)';
      msg.innerText   = '❌ Failed. Try again.';
    }
  } catch(e) {
    setButtonLoading(btn, false, '✓ Submit');
    btn.disabled    = false;
    msg.style.color = 'var(--danger)';
    msg.innerText   = '❌ Connection error!';
  }
}

function undoLastExcuse() {
  const name = document.getElementById('user-name').innerText.trim();
  customConfirm('Confirm', 'Remove your last excuse request?').then(r => {
    if (!r) return;
    gasRun('undoExcuseFromWeb', name).then(res => {
      document.getElementById('excuse-msg').style.color = res.status === 'success' ? 'var(--warn)' : 'var(--danger)';
      document.getElementById('excuse-msg').innerText   = res.msg;
      if (res.status === 'success') customAlert('Success', res.msg);
    });
  });
}

/* ── FIX-4: selectTimeOffType — علطول بيعرض الفورم ── */
function selectTimeOffType(type) {
  selectedTimeOffType = type;
  const form = document.getElementById('time-off-form');
  if (form) form.style.display = 'block';

  ['timeOffFromDate','timeOffToDate','timeOffNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const msgEl = document.getElementById('time-off-msg');
  if (msgEl) msgEl.innerText = '';

  /* هايلايت الزرار المختار */
  document.querySelectorAll('.action-row .action-btn').forEach(b => {
    b.style.opacity     = '0.5';
    b.style.borderWidth = '1px';
  });
  if (event && event.currentTarget) {
    event.currentTarget.style.opacity     = '1';
    event.currentTarget.style.borderWidth = '2px';
  }
}

function cancelTimeOffForm() {
  selectedTimeOffType = null;
  /* FIX-4: لا نخفي الفورم، بس نعمل reset للاختيار */
  document.querySelectorAll('.action-row .action-btn').forEach(b => {
    b.style.opacity = '1'; b.style.borderWidth = '1px';
  });
  ['timeOffFromDate','timeOffToDate','timeOffNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const msgEl = document.getElementById('time-off-msg');
  if (msgEl) msgEl.innerText = '';
}

async function submitTimeOffRequest() {
  const type  = selectedTimeOffType;
  const from  = document.getElementById('timeOffFromDate').value;
  const to    = document.getElementById('timeOffToDate').value;
  const notes = document.getElementById('timeOffNotes').value;
  const name  = document.getElementById('user-name').innerText.trim();
  const msg   = document.getElementById('time-off-msg');
  const btn   = document.getElementById('submitTimeOffBtn');

  if (!type)        { msg.style.color='var(--danger)'; msg.innerText='Please select a leave type first!'; return; }
  if (!from || !to) { msg.style.color='var(--danger)'; msg.innerText='Please select both dates!'; return; }
  if (!schMyAgentId){ msg.style.color='var(--danger)'; msg.innerText='Agent not found — please refresh!'; return; }

  setButtonLoading(btn, true, 'Submitting...');

  try {
    const res = await fetch(`${SB_URL_SCH}/rest/v1/requests`, {
      method:  'POST',
      headers: {
        'apikey':        SB_KEY_SCH,
        'Authorization': `Bearer ${SB_KEY_SCH}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify({
        agent_id:   schMyAgentId,
        agent_name: name,
        type:       'Time Off',
        status:     'Pending',
        details:    JSON.stringify({ request_type: type, from_date: from, to_date: to, notes: notes || '' }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    });

    setButtonLoading(btn, false, '✈️ Submit Request');

    if (res.ok) {
      showToast('✅', type+' Request Submitted!', 'Pending review by manager.', 'success', 6000);
      setTimeout(() => { cancelTimeOffForm(); }, 2000);
    } else {
      msg.style.color = 'var(--danger)';
      msg.innerText   = '❌ Failed. Try again.';
    }
  } catch(e) {
    setButtonLoading(btn, false, '✈️ Submit Request');
    msg.style.color = 'var(--danger)';
    msg.innerText   = '❌ Connection error!';
  }
}

/* ─── 16. CALL LOG FORM ─── */
function onAgentSelect() {}

function selectRadio(groupId, el, value) {
  document.querySelectorAll('#' + groupId + ' .radio-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  radioValues[groupId] = value;
}

function toggleFormSections() {
  const r = document.getElementById('f-reason').value;
  const q = (r === 'Wrong Number' || r === 'Call Dropped');
  const mobileSection = document.getElementById('mobile-section');
  if (mobileSection) mobileSection.style.display = q ? 'none' : 'block';
}

function quickLogCall(reason) {
  const agent = document.getElementById('f-agent').value;
  if (!agent) { customAlert('Error', 'Please select Agent Name first!'); return; }
  document.getElementById('f-reason').value = reason;
  goStep(4);
  setTimeout(() => submitCallLogForm(), 200);
}

function submitCallLogForm() {
  const agent  = document.getElementById('f-agent').value;
  const reason = document.getElementById('f-reason').value;
  const mobile = document.getElementById('f-mobile').value.trim();
  const cname  = document.getElementById('f-cname').value.trim();
  const isQ    = (reason === 'Wrong Number' || reason === 'Call Dropped');

  if (!agent)  { showFormErr('Please select Agent Name!'); return; }
  if (!reason) { showFormErr('Please select Call Reason!'); return; }
  if (!isQ && !cname)                     { showFormErr('Please enter Customer Name!'); return; }
  if (!isQ && !mobile)                    { showFormErr('Please enter Customer Mobile!'); return; }
  if (!isQ && !radioValues['f-bizrel'])   { showFormErr('Select Business Relativity!'); return; }
  if (!isQ && !radioValues['f-salescall']){ showFormErr('Select Sales Call Requested!'); return; }
  if (!isQ && !radioValues['f-channel'])  { showFormErr('Select Communication Channel!'); return; }
  if (!isQ && !radioValues['f-media'])    { showFormErr('Select Media Source!'); return; }
  if (!isQ && !radioValues['f-budget'])   { showFormErr('Select Budget!'); return; }
  if (!isQ && !radioValues['f-unit'])     { showFormErr('Select Unit Type!'); return; }

  const btn = document.getElementById('formSubmitBtn');
  /* FIX-5 */ setButtonLoading(btn, true, 'Submitting...');

  const slowTimer = setTimeout(() => {
    if (btn.disabled) setButtonLoading(btn, true, 'Almost there...');
  }, 5000);

  document.getElementById('form-error').style.display = 'none';

  const data = {
    agent, reason,
    cname:     isQ ? '' : cname,
    mobile:    isQ ? '' : mobile,
    bizrel:    isQ ? '' : (radioValues['f-bizrel']    || ''),
    salescall: isQ ? '' : (radioValues['f-salescall'] || ''),
    channel:   isQ ? '' : (radioValues['f-channel']   || ''),
    media:     isQ ? '' : (radioValues['f-media']     || ''),
    budget:    isQ ? '' : (radioValues['f-budget']    || ''),
    unit:      isQ ? '' : (radioValues['f-unit']      || ''),
    extra: document.getElementById('f-extra').value.trim()
  };

  const gasAction = (_activeChannel === 'whatsapp') ? 'submitWhatsAppLog' : 'submitCallLog';


   // حفظ في Supabase بالتوازي مع GAS
if (!isQ) {
  fetch(`${SB_URL_SCH}/rest/v1/call_logs`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY_SCH,
      'Authorization': `Bearer ${SB_KEY_SCH}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      agent_name:            data.agent,
      customer_name:         data.cname,
      customer_mobile:       data.mobile,
      call_reason:           data.reason,
      communication_channel: data.channel,
      media_source:          data.media,
      business_relativity:   data.bizrel,
      sales_call_requested:  data.salescall,
      budget:                data.budget,
      unit_type:             data.unit,
      extra_notes:           data.extra,
      logged_at:             new Date().toISOString(),
    })
  }).catch(e => console.warn('SB call log failed:', e));
}

gasRun(gasAction, data).then(res => {
   
   
   clearTimeout(slowTimer);
    /* FIX-5 */ setButtonLoading(btn, false, '📤 Submit to Database');
    if (res.status === 'success') {
      const bar = document.getElementById('call-summary-bar');
      document.getElementById('cs-name').innerText   = cname  || '—';
      document.getElementById('cs-mobile').innerText = mobile || '—';
      document.getElementById('cs-reason').innerText = reason || '—';
      bar.style.display = 'flex';
      setTimeout(() => bar.style.display = 'none', 30000);
      resetCallForm();
      showToast('✅', 'Call Logged!', cname ? cname + ' — ' + mobile : reason, 'success', 5000);
      loadLastTwoCalls(data.agent); 
    } else {
      showFormErr(res.msg || 'Something went wrong.');
    }
  }).catch(err => {
    clearTimeout(slowTimer);
    /* FIX-5 */ setButtonLoading(btn, false, '📤 Submit to Database');
    showFormErr('Network error. Please try again.');
    console.error('gasRun error:', err);
  });
}

function resetCallForm() {
  ['f-reason','f-mobile','f-extra'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-cname').value = '';
  radioValues = {};
  document.querySelectorAll('.radio-opt').forEach(o => o.classList.remove('selected'));
  document.getElementById('mobile-section').style.display = 'block';
  document.getElementById('form-success').style.display   = 'none';
  document.getElementById('form-error').style.display     = 'none';
  goStep(1);
}

/* ─── STEP NAVIGATION ─── */
let _currentStep = 1;

function goStep(n) {
  if (n > _currentStep) {
    if (_currentStep === 1) {
      const agent  = document.getElementById('f-agent').value;
      const reason = document.getElementById('f-reason').value;
      if (!agent || !reason) { showFormErr('Please select Agent and Call Reason!'); return; }
      if (reason === 'Wrong Number' || reason === 'Call Dropped') { n = 4; }
    }
  }

  for (let i = 1; i <= 4; i++) {
    const dot  = document.getElementById('sdot-' + i);
    const line = document.getElementById('sline-' + i);
    if (i < n)        { dot.className = 'step-dot done'; dot.innerHTML = '✓'; }
    else if (i === n) { dot.className = 'step-dot active'; dot.innerHTML = i; }
    else              { dot.className = 'step-dot'; dot.innerHTML = i; }
    if (line) line.className = i < n ? 'step-line done' : 'step-line';
  }

  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  _currentStep = n;
}

function showFormErr(msg) {
  showResultPopup('error', 'Check Your Data', msg, 'Got it');
}


/* ─── 17. CUSTOMER SEARCH ─── */
function searchCustomer() {
  const query      = document.getElementById('search-query').value.trim();
  const resultsDiv = document.getElementById('search-results');
  if (!query) { resultsDiv.innerHTML = '<div class="empty-state">Please enter a name or mobile number.</div>'; return; }
  resultsDiv.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Searching...</div>';

  /* FIX-5: زرار البحث يعمل loading */
  const searchBtn = document.getElementById('search-btn') || document.querySelector('[onclick="searchCustomer()"]');
  if (searchBtn) setButtonLoading(searchBtn, true, 'Searching...');

  gasRun('searchCustomer', query).then(res => {
    if (searchBtn) setButtonLoading(searchBtn, false, '🔍 Search');
    if (res.status !== 'success' || !res.results.length) {
      resultsDiv.innerHTML = `<div class="empty-state">No results found for "${query}"</div>`;
      return;
    }
    let html = `<div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:10px;">${res.count} result(s) found</div>`;
    res.results.forEach(r => {
      const reasonColor = (r.reason === 'Wrong Number' || r.reason === 'Call Dropped') ? 'var(--muted)' : 'var(--primary)';
      const sourceColor = r.source === '💬 WhatsApp' ? '#25d366' : 'var(--primary)';
      html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;color:${sourceColor};margin-bottom:8px;">${r.source||''}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;background:var(--primary-gradient);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:13px;">${r.name?r.name[0].toUpperCase():'?'}</div>
            <div><div style="font-weight:700;font-size:14px;color:var(--text);">${r.name||'N/A'}</div>
            <div style="font-size:12px;color:var(--muted);">${r.mobile||'-'}${r.mobile2&&r.mobile2!=='-'&&r.mobile2!=='NA'?' · '+r.mobile2:''}</div></div>
          </div>
          <div style="font-size:11px;color:var(--muted);">${r.timestamp||''}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
          <div><span style="color:var(--muted);">Reason: </span><span style="font-weight:600;color:${reasonColor};">${r.reason||'-'}</span></div>
          <div><span style="color:var(--muted);">Agent: </span><span style="font-weight:600;color:var(--text);">${r.agent||'-'}</span></div>
          <div><span style="color:var(--muted);">Media: </span><span style="font-weight:600;color:var(--text);">${r.media||'-'}</span></div>
          <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:600;color:var(--text);">${r.channel||'-'}</span></div>
          <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:600;color:var(--text);">${r.budget||'-'}</span></div>
          <div><span style="color:var(--muted);">Unit: </span><span style="font-weight:600;color:var(--text);">${r.unit||'-'}</span></div>
        </div>
        ${r.extra&&r.extra.trim()&&r.extra!=='-'?`<div style="margin-top:10px;padding:10px;background:var(--surface);border-radius:10px;border:1px solid var(--border);font-size:12px;color:var(--muted);"><i class="fas fa-sticky-note" style="margin-right:6px;color:var(--warn);"></i>${r.extra}</div>`:''}
      </div>`;
    });
    resultsDiv.innerHTML = html;
  }).catch(() => {
    if (searchBtn) setButtonLoading(searchBtn, false, '🔍 Search');
  });
}

function clearSearch() {
  document.getElementById('search-query').value = '';
  document.getElementById('search-results').innerHTML = '';
}


/* ─── 18. KNOWLEDGE BASE ─── */
let kbSections         = [];
let kbLoaded           = false;
let kbActiveIdx        = -1;
let kbEditMode         = false;
let kbSidebarCollapsed = false;

function loadKBSections() {
  if (kbLoaded) return;
  const listEl = document.getElementById('kb-sections-list');
  listEl.innerHTML = '<div class="kb-no-results"><i class="fas fa-spinner spinner"></i></div>';
  if (window.loadKBFromFirestore) {
    window.loadKBFromFirestore().then(data => {
      if (data && data.length) {
        kbSections = data; kbLoaded = true;
        renderKBSidebar(kbSections);
      } else {
        listEl.innerHTML = '<div class="kb-no-results"><i class="fas fa-folder-open"></i>No sections found</div>';
      }
    }).catch(() => {
      listEl.innerHTML = '<div class="kb-no-results"><i class="fas fa-exclamation-triangle"></i>Failed to load</div>';
    });
  }
}

function renderKBSidebar(sections) {
  const list = document.getElementById('kb-sections-list');
  if (!list) return;
  if (!sections.length) {
    list.innerHTML = '<div class="kb-no-results"><i class="fas fa-search"></i>No matching sections</div>';
    return;
  }
  list.innerHTML = sections.map((s, idx) => {
    const isActive = idx === kbActiveIdx ? ' kb-active' : '';
    return `<div class="kb-section-item${isActive}" data-idx="${idx}" onclick="openKBSection(${idx})">
      <div class="kb-section-icon"><i class="fas fa-file-alt"></i></div>
      <div class="kb-section-title">${s.title}</div>
    </div>`;
  }).join('');
}

function filterKBSidebar(query) {
  const filtered = query.trim()
    ? kbSections.filter(s => s.title.toLowerCase().includes(query.toLowerCase()))
    : kbSections;
  renderKBSidebar(filtered);
}

function toggleKBSidebar() {
  const sidebar   = document.getElementById('kb-sidebar');
  kbSidebarCollapsed = !kbSidebarCollapsed;
  kbSidebarCollapsed ? sidebar.classList.add('kb-collapsed') : sidebar.classList.remove('kb-collapsed');
}

function openKBSection(idx) {
  const s = kbSections[idx]; if (!s) return;
  kbActiveIdx = idx; kbEditMode = false;
  updateKBToolbarState();

  const placeholder  = document.getElementById('kb-placeholder');
  const contentBody  = document.getElementById('kb-content-body');
  const currentTitle = document.getElementById('kb-current-title');
  currentTitle.innerText = s.title;
  if (placeholder) placeholder.remove();

  const content = (s.content || 'No content available.')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  contentBody.innerHTML = `<div class="kb-article">
    <div class="kb-article-title">${s.title}</div>
    <div class="kb-article-divider"></div>
    <div class="kb-article-body">${content}</div>
  </div>`;
  renderKBSidebar(kbSections);
}

function enterKBEditMode() {
  if (kbActiveIdx < 0 || !kbSections[kbActiveIdx]) return;
  kbEditMode = true; updateKBToolbarState();
  const s = kbSections[kbActiveIdx];
  document.getElementById('kb-content-body').innerHTML = `
    <div class="kb-article" style="direction:ltr;text-align:left;padding-bottom:8px;">
      <div class="kb-article-title">${s.title}</div>
      <div class="kb-article-divider" style="margin-left:0;"></div>
    </div>
    <textarea class="kb-edit-area" id="kb-edit-textarea">${s.content||''}</textarea>`;
}

function cancelKBEdit() {
  if (kbActiveIdx < 0) return;
  kbEditMode = false; updateKBToolbarState();
  openKBSection(kbActiveIdx);
}

function saveKBEdit() {
  if (kbActiveIdx < 0 || !kbSections[kbActiveIdx]) return;
  const s          = kbSections[kbActiveIdx];
  const newContent = document.getElementById('kb-edit-textarea').value;
  if (!window.saveKBSection) return;
  const saveBtn = document.getElementById('kb-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML= '<i class="fas fa-spinner spinner"></i><span class="kb-btn-label">Saving</span>';
  window.saveKBSection(s.id, newContent).then(ok => {
    saveBtn.disabled = false;
    saveBtn.innerHTML= '<i class="fas fa-check"></i><span class="kb-btn-label">Save</span>';
    if (ok) {
      kbSections[kbActiveIdx].content = newContent;
      kbEditMode = false; updateKBToolbarState();
      openKBSection(kbActiveIdx);
      showToast('✅', 'Section Saved!', s.title+' has been updated.', 'success', 4000);
    } else {
      showToast('❌', 'Save Failed!', 'Could not save changes.', 'danger', 4000);
    }
  });
}

function updateKBToolbarState() {
  const editBtn   = document.getElementById('kb-edit-btn');
  const saveBtn   = document.getElementById('kb-save-btn');
  const cancelBtn = document.getElementById('kb-cancel-btn');
  const isAdmin   = window.currentUserRole === 'Admin';
  if (kbEditMode) {
    editBtn.classList.remove('kb-visible');
    saveBtn.classList.add('kb-visible');
    cancelBtn.classList.add('kb-visible');
  } else {
    editBtn.classList.remove('kb-visible');
    saveBtn.classList.remove('kb-visible');
    cancelBtn.classList.remove('kb-visible');
    if (isAdmin && kbActiveIdx >= 0) editBtn.classList.add('kb-visible');
  }
}


/* ─── 19. SHIFT SWAP ─── */
function populateSwapForm() {
  const daySelect       = document.getElementById('swap-day-select');
  const colleagueSelect = document.getElementById('swap-colleague-select');
  const now             = new Date();

  daySelect.innerHTML = '<option value="">Choose a day...</option>';

  globalScheduleData.forEach(d => {
    const shift   = (d.shift || '').toString().trim();
    const parts   = d.date.split('/');
    const dayDate = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
    dayDate.setHours(23,59,59,999);

    if (dayDate < now) return;

    const opt = document.createElement('option');
    opt.value       = d.date;
    opt.disabled    = false;
    opt.textContent = d.day + ' — ' + d.date + ' (' + (shift || 'Off') + ')' + (d.isToday ? '  ◀ Today' : '');
    daySelect.appendChild(opt);
  });

  colleagueSelect.innerHTML = '<option value="">Choose a colleague...</option>';
  const currentName = document.getElementById('user-name').innerText.trim();
  globalTeamData.forEach(s => {
    if (s.name !== currentName) {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name + '  —  ' + (s.shift || 'OFF');
      colleagueSelect.appendChild(opt);
    }
  });
  resetSwapDisplay();
}

function resetSwapDisplay() {
  document.getElementById('swap-your-shift').innerText      = 'Select a day';
  document.getElementById('swap-your-shift').className      = 'swap-compare-value swap-empty';
  document.getElementById('swap-colleague-shift').innerText = 'Select a colleague';
  document.getElementById('swap-colleague-shift').className = 'swap-compare-value swap-empty';
  document.getElementById('swap-your-box').classList.remove('swap-active');
  document.getElementById('swap-colleague-box').classList.remove('swap-active');
  document.getElementById('swap-warning').style.display = 'none';
}

function getMinutesToShift(dateStr, shiftStr) {
  const dp   = dateStr.split('/');
  const tp   = shiftStr.split(' - ')[0].split(':');
  const shiftDate = new Date(parseInt(dp[2]), parseInt(dp[1])-1, parseInt(dp[0]), parseInt(tp[0]), parseInt(tp[1]), 0, 0);
  return Math.floor((shiftDate - new Date()) / 60000);
}

function onSwapDayChange() {
  const date         = document.getElementById('swap-day-select').value;
  const shiftEl      = document.getElementById('swap-your-shift');
  const boxEl        = document.getElementById('swap-your-box');
  const warningEl    = document.getElementById('swap-warning');
  const warningText  = document.getElementById('swap-warning-text');
  const colleagueSelect = document.getElementById('swap-colleague-select');

  document.getElementById('swap-colleague-shift').innerText = 'Select a colleague';
  document.getElementById('swap-colleague-shift').className = 'swap-compare-value swap-empty';
  document.getElementById('swap-colleague-box').classList.remove('swap-active');
  warningEl.style.display = 'none';

  if (!date) {
    shiftEl.innerText = 'Select a day'; shiftEl.className = 'swap-compare-value swap-empty';
    boxEl.classList.remove('swap-active');
    colleagueSelect.innerHTML = '<option value="">Choose a colleague...</option>';
    return;
  }

  const day = globalScheduleData.find(d => d.date === date);
  if (!day || !day.shift) { shiftEl.innerText = 'N/A'; shiftEl.className = 'swap-compare-value swap-empty'; return; }
  shiftEl.innerText = day.shift; shiftEl.className = 'swap-compare-value'; boxEl.classList.add('swap-active');

  const mins = getMinutesToShift(date, day.shift);
  if (mins < 120) {
    const h = Math.floor(Math.abs(mins)/60), m = Math.abs(mins)%60;
    warningText.innerText   = 'Your shift starts in ' + (h>0?h+'h '+m+'m':m+'m') + '. Swap requests must be submitted at least 2 hours before.';
    warningEl.style.display = 'flex';
  }

  colleagueSelect.innerHTML = '<option value="">Choose a colleague...</option>';
  const currentName = document.getElementById('user-name').innerText.trim();
  gasRun('getDayShifts', date).then(res => {
    if (res && res.shifts && res.shifts.length) {
      res.shifts.forEach(s => {
        if (s.name !== currentName) {
          const opt = document.createElement('option');
          opt.value = s.name; opt.textContent = s.name + '  —  ' + (s.shift || 'OFF');
          colleagueSelect.appendChild(opt);
        }
      });
    }
  });
}

function onSwapColleagueChange() {
  const date      = document.getElementById('swap-day-select').value;
  const colleague = document.getElementById('swap-colleague-select').value;
  const shiftEl   = document.getElementById('swap-colleague-shift');
  const boxEl     = document.getElementById('swap-colleague-box');

  if (!date || !colleague) {
    shiftEl.innerText = 'Select a colleague'; shiftEl.className = 'swap-compare-value swap-empty';
    boxEl.classList.remove('swap-active'); return;
  }

  shiftEl.innerText = 'Loading...'; shiftEl.className = 'swap-compare-value swap-empty';
  boxEl.classList.remove('swap-active');

  gasRun('getColleagueShift', colleague, date).then(res => {
    if (res && res.shift) {
      shiftEl.innerText = res.shift; shiftEl.className = 'swap-compare-value'; boxEl.classList.add('swap-active');
    } else {
      shiftEl.innerText = 'No shift on this day'; shiftEl.className = 'swap-compare-value swap-empty';
    }
  }).catch(() => { shiftEl.innerText = 'Error loading'; shiftEl.className = 'swap-compare-value swap-empty'; });
}

function submitShiftSwap() {
  const date      = document.getElementById('swap-day-select').value;
  const colleague = document.getElementById('swap-colleague-select').value;
  const notes     = document.getElementById('swap-notes').value.trim();
  const name      = document.getElementById('user-name').innerText.trim();
  const msg       = document.getElementById('swap-request-msg');
  const btn       = document.getElementById('swap-submit-btn');
  const yourShift  = document.getElementById('swap-your-shift').innerText;
  const theirShift = document.getElementById('swap-colleague-shift').innerText;

  if (!date)      { customAlert('Error', 'Please select a working day!'); return; }
  if (!colleague) { customAlert('Error', 'Please select a colleague!'); return; }
  if (!schMyAgentId) { customAlert('Error', 'Agent not found — please refresh!'); return; }
  if (yourShift  === 'N/A' || yourShift  === 'Select a day')        { customAlert('Error', 'No valid shift found for you!'); return; }
  if (theirShift === 'No shift on this day' || theirShift === 'Select a colleague') { customAlert('Error', "Colleague has no shift on this day!"); return; }

  const day = globalScheduleData.find(d => d.date === date);
  if (day && getMinutesToShift(date, day.shift) < 120) {
    customAlert('Too Late', 'Swap requests must be submitted at least 2 hours before your shift starts.');
    return;
  }

  customConfirm('Confirm Swap', `Swap your shift (${yourShift}) with ${colleague} (${theirShift}) on ${date}?`).then(async ok => {
    if (!ok) return;
    setButtonLoading(btn, true, 'Submitting...');
    try {
      const res = await fetch(`${SB_URL_SCH}/rest/v1/requests`, {
        method:  'POST',
        headers: {
          'apikey':        SB_KEY_SCH,
          'Authorization': `Bearer ${SB_KEY_SCH}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal'
        },
        body: JSON.stringify({
          agent_id:   schMyAgentId,
          agent_name: name,
          type:       'Shift Swap',
          status:     'Pending',
          details:    JSON.stringify({ date, agent_shift: yourShift, colleague, their_shift: theirShift, notes: notes || '' }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      });

      setButtonLoading(btn, false, '🔄 Submit Shift Swap Request');

      if (res.ok) {
        msg.style.color = '#059669';
        msg.innerText   = 'Request submitted! Pending admin approval.';
        showToast('⏳','Request Submitted!','Your swap request is now waiting for admin approval.','warn',7000);
        document.getElementById('swap-day-select').value       = '';
        document.getElementById('swap-colleague-select').value = '';
        document.getElementById('swap-notes').value            = '';
        resetSwapDisplay();
        setTimeout(() => msg.innerText = '', 6000);
      } else {
        msg.style.color = 'var(--danger)';
        msg.innerText   = '❌ Failed. Try again.';
      }
    } catch(e) {
      setButtonLoading(btn, false, '🔄 Submit Shift Swap Request');
      msg.style.color = 'var(--danger)';
      msg.innerText   = '❌ Connection error!';
    }
  });
}

function silentRefreshRequests() {
  loadMyRequests();
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
    document.getElementById('annual-carry').innerText       = data.carryOver  + ' Days';
    document.getElementById('annual-total').innerText       = data.total      + ' Days';
    document.getElementById('annual-used').innerText        = data.used       + ' Days';
    document.getElementById('annual-remaining').innerText   = data.remaining  + ' Days';
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
        headers: {
          'apikey':        SB_KEY_SCH,
          'Authorization': `Bearer ${SB_KEY_SCH}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal'
        },
        body: JSON.stringify({
          agent_id:   schMyAgentId,
          agent_name: name,
          type:       'Missing Punch',
          status:     'Pending',
          details:    JSON.stringify({ date: missingPunchDate }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      });

      if (mpBtn) setButtonLoading(mpBtn, false, '⚠️ Report Punch');

      if (res.ok) {
        showToast('⚠️','Missing Punch Reported!','Your report for '+missingPunchDate+' has been sent.','warn',6000);
      } else {
        customAlert('Error', 'Failed. Try again.');
      }
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
  if (id === 'tab-kb') loadKBSections();
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


/* ─── 24. UTILITY FUNCTIONS ─── */
function gasRun(action, ...args) {
  return fetch(GAS_URL, {
    method:  'POST',
    redirect:'follow',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ action, args })
  })
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
  .then(text => { try { return JSON.parse(text); } catch(e) { throw new Error('Invalid JSON response'); } });
}

/* ── FIX-5: دالة عامة لعمل loading على أي زرار ── */
function setButtonLoading(btn, isLoading, label) {
  if (!btn) return;
  if (isLoading) {
    btn._origHTML    = btn.innerHTML;
    btn._origDisabled = btn.disabled;
    btn.disabled    = true;
    btn.style.opacity = '0.8';
    btn.innerHTML   = `<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>${label || 'Loading...'}`;
  } else {
    btn.disabled    = btn._origDisabled || false;
    btn.style.opacity = '1';
    btn.innerHTML   = btn._origHTML || label || 'Submit';
  }
}

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


/* ─── 25. SCH TABLE ─── */
const SB_URL_SCH = 'https://xzxdaupwwwdcwfnqweub.supabase.co';
const SB_KEY_SCH = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6eGRhdXB3d3dkY3dmbnF3ZXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTM5NTAsImV4cCI6MjA5MDg4OTk1MH0.KjNZpFvLxh8XfDDoWdpVsIQZAh1PjzGXOrfDmApZ4K8';

const sbClient = window.supabase.createClient(SB_URL_SCH, SB_KEY_SCH);
let sbBreaksChannel = null;

let schWeeks       = [];
let schAgents      = [];
let schShiftTypes  = [];
let schMyDraft     = {};
let schAllDrafts   = {};
let schCurrentWeek = null;

function toggleSchAccordion(elementId) {
  const clickedItem = document.getElementById(elementId);
  const allAccordions = document.querySelectorAll('.sch-accordion');
  const isOpen = clickedItem.classList.contains('active');
  allAccordions.forEach(acc => { acc.classList.remove('active'); });
  if (!isOpen) { clickedItem.classList.add('active'); }
}

function selectWeekChip(weekId, weekLabel, chipElement) {
  document.querySelectorAll('.week-chip').forEach(c => c.classList.remove('active'));
  if(chipElement) chipElement.classList.add('active');
  const pubAccordion = document.getElementById('acc-published');
  if (pubAccordion && !pubAccordion.classList.contains('active')) {
    toggleSchAccordion('acc-published');
  }
  loadSchTable(weekId);
}

async function sbFetchSch(path) {
  const res = await fetch(`${SB_URL_SCH}/rest/v1/${path}`, {
    headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json' }
  });
  return res.json();
}

async function loadTodayBreaksFromSB(agentId) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/breaks?agent_id=eq.${agentId}&break_date=eq.${today}&select=*`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();
    if (!data || !data.length) return null;
    const b = data[0];
    return {
      break1:     b.break1     ? b.break1.substring(0,5)     : null,
      lunch:      b.lunch      ? b.lunch.substring(0,5)      : null,
      break2:     b.break2     ? b.break2.substring(0,5)     : null,
      shift_time: b.shift_time ? b.shift_time.trim() : null,
    };
  } catch(e) { return null; }
}

function applyBreaksToUI(breaks) {
  if (!breaks) return;
  document.getElementById('br-break1').innerText = breaks.break1 || 'N/A';
  document.getElementById('br-lunch').innerText  = breaks.lunch  || 'N/A';
  document.getElementById('br-break2').innerText = breaks.break2 || 'N/A';

  if (breaks.shift_time) {
    /* FIX-1: br-shift with style يمنع تقطيع النص */
    const brShiftEl = document.getElementById('br-shift');
    if (brShiftEl) {
      brShiftEl.innerText          = 'SHIFT: ' + breaks.shift_time;
      brShiftEl.style.whiteSpace   = 'nowrap';
      brShiftEl.style.overflow     = 'hidden';
      brShiftEl.style.textOverflow = 'ellipsis';
      brShiftEl.style.maxWidth     = 'none';
      brShiftEl.title              = breaks.shift_time;
    }
    const statusTextEl = document.getElementById('status-text');
    if (statusTextEl) {
      statusTextEl.innerText        = breaks.shift_time;
      statusTextEl.style.whiteSpace = 'nowrap';
      statusTextEl.style.overflow   = 'visible';
      statusTextEl.style.fontSize   = 'clamp(14px, 4vw, 22px)';
    }
  }
  currentBreaks = breaks;
  startBreakChecker(breaks);
}

function subscribeTodayBreaks(agentId) {
  const today = new Date().toISOString().split('T')[0];

  if (sbBreaksChannel) { sbClient.removeChannel(sbBreaksChannel); sbBreaksChannel = null; }

  sbBreaksChannel = sbClient
    .channel('agent-breaks-' + agentId)
    .on('postgres_changes', {
      event:  '*',
      schema: 'public',
      table:  'breaks',
      filter: `agent_id=eq.${agentId}`
    }, async (payload) => {
      const b = payload.new;
      if (!b || b.break_date !== today) return;

      const updated = {
        break1: b.break1 ? b.break1.substring(0,5) : null,
        lunch:  b.lunch  ? b.lunch.substring(0,5)  : null,
        break2: b.break2 ? b.break2.substring(0,5) : null,
      };
      applyBreaksToUI(updated);
      showToast('🔔', 'Breaks Updated!',
        `☕ ${updated.break1 || '-'}  🍽 ${updated.lunch || '-'}  🫖 ${updated.break2 || '-'}`,
        'info', 6000);
    })
    .subscribe();
}

/* ── FIX-2: initSchTab يفتح جدول الأسبوع الحالي والجاي تلقائياً ── */
async function initSchTab() {
  schWeeks = []; schAgents = [];
  try {
    const [pubWeeks, agents, shifts] = await Promise.all([
      sbFetchSch('schedule_weeks?select=id,week_start,week_end,status&status=eq.Published&order=week_start.desc'),
      sbFetchSch('agents?select=id,formal_name&status=eq.Active&order=formal_name'),
      sbFetchSch('shift_types?select=id,name,start_time,end_time&is_active=eq.true&order=start_time')
    ]);
    schWeeks      = pubWeeks || [];
    schAgents     = agents   || [];
    schShiftTypes = shifts   || [];

    const agentName = document.getElementById('user-name').innerText.trim();
    const me = schAgents.find(a => a.formal_name.toLowerCase() === agentName.toLowerCase());
    if (me) schMyAgentId = me.id;

    const years = [...new Set(schWeeks.map(w => w.week_start.substring(0,4)))].sort().reverse();
    const yearEl = document.getElementById('sch-filter-year');
    if (yearEl) {
      yearEl.innerHTML = '<option value="">All Years</option>' +
        years.map(y => `<option value="${y}">${y}</option>`).join('');
    }
    loadDraftGrid();
    autoSelectCurrentWeek();

  } catch(e) {
    console.error('SCH Tab failed:', e);
  }
}

function autoSelectCurrentWeek() {
  if (!schWeeks.length) return;
  const todayIso = new Date().toISOString().split('T')[0];

  let targetWeek = schWeeks.find(w => w.week_start <= todayIso && w.week_end >= todayIso);
  if (!targetWeek) {
    const future = schWeeks.filter(w => w.week_start > todayIso).sort((a,b) => a.week_start.localeCompare(b.week_start));
    targetWeek = future[0] || schWeeks[0];
  }
  if (!targetWeek) return;

  const pubAccordion = document.getElementById('acc-published');
  if (pubAccordion && !pubAccordion.classList.contains('active')) {
    toggleSchAccordion('acc-published');
  }

  loadCurrentAndNextWeeks(targetWeek);
}

async function loadCurrentAndNextWeeks(currentWeek) {
  const gridEl = document.getElementById('sch-table-grid');
  gridEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading...</div>';

  const todayIso = new Date().toISOString().split('T')[0];
  const nextWeek = schWeeks.filter(w => w.week_start > currentWeek.week_end)
    .sort((a,b) => a.week_start.localeCompare(b.week_start))[0];

  let html = '';
  for (const [week, label] of [[currentWeek,'📅 This Week'], [nextWeek,'📆 Next Week']].filter(([w]) => w)) {
    const dates = getSchWeekDates(week.week_start, week.week_end);
    try {
      const records = await sbFetchSch(`schedule?select=*&week_id=eq.${week.id}`);
      const schedMap = {};
      (records||[]).forEach(s => { schedMap[`${s.agent_id}_${s.shift_date}`] = s; });
      html += `
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            ${label}
            <span style="font-size:10px;color:var(--muted);font-weight:600;">${fmtSchDate(week.week_start)} → ${fmtSchDate(week.week_end)}</span>
          </div>
          ${buildSchGrid(schAgents, dates, schedMap, todayIso)}
        </div>`;
    } catch(e) {}
  }
  gridEl.innerHTML = html || '<div class="empty-state">No schedule found.</div>';
}

function fmtSchDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${day}/${m}`;
}

function getSchWeekDates(start, end) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dates = [];
  const [sy,sm,sd] = start.split('-').map(Number);
  const [ey,em,ed] = end.split('-').map(Number);
  let cur = new Date(sy, sm-1, sd);
  const endDate = new Date(ey, em-1, ed);
  while (cur <= endDate) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    dates.push({ iso, dayName: days[cur.getDay()], display: `${String(cur.getDate()).padStart(2,'0')}/${String(cur.getMonth()+1).padStart(2,'0')}` });
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function schCellStyle(dayType) {
  if (dayType === 'Work')   return 'color:#10b981;border-color:rgba(16,185,129,0.4);background:rgba(16,185,129,0.06)';
  if (dayType === 'Annual') return 'color:#8b5cf6;border-color:rgba(139,92,246,0.4);background:rgba(139,92,246,0.06)';
  if (dayType === 'Sick')   return 'color:#ef4444;border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.06)';
  if (dayType === 'Casual') return 'color:#f59e0b;border-color:rgba(245,158,11,0.4);background:rgba(245,158,11,0.06)';
  if (dayType === 'PH')     return 'color:#3b82f6;border-color:rgba(59,130,246,0.4);background:rgba(59,130,246,0.06)';
  return 'color:var(--muted);border-color:var(--border);background:var(--surface2)';
}

function schShiftLabel(dayType, shiftTypeId) {
  if (dayType === 'Work') {
    const st = schShiftTypes.find(s => s.id === shiftTypeId);
    return st ? st.start_time.substring(0,5)+' - '+st.end_time.substring(0,5)+' ('+st.name+')' : 'Work';
  }
  return dayType === 'Off' ? '— Off —' : dayType;
}

function buildShiftSelect(agentId, date, dayType, shiftTypeId, isEditable) {
  const style = schCellStyle(dayType);
  if (!isEditable) {
    return `<div style="padding:6px 4px;border:1.5px solid;border-radius:8px;font-size:10px;font-weight:700;text-align:center;${style};white-space:nowrap;">${schShiftLabel(dayType, shiftTypeId)}</div>`;
  }
  const opts = [
    `<option value="Off" ${dayType==='Off'?'selected':''}>— Off —</option>`,
    ...schShiftTypes.map(st => `<option value="Work__${st.id}" ${dayType==='Work'&&shiftTypeId===st.id?'selected':''}>${st.start_time.substring(0,5)} - ${st.end_time.substring(0,5)} (${st.name})</option>`),
    `<option value="Annual" ${dayType==='Annual'?'selected':''}>Annual</option>`,
    `<option value="Sick"   ${dayType==='Sick'?'selected':''}>Sick</option>`,
    `<option value="Casual" ${dayType==='Casual'?'selected':''}>Casual</option>`,
    `<option value="PH"     ${dayType==='PH'?'selected':''}>PH</option>`,
  ].join('');
  return `<select data-date="${date}" onchange="onSchDraftChange(this)" style="width:100%;padding:6px 4px;border:1.5px solid;border-radius:8px;font-size:10px;font-weight:700;text-align:center;outline:none;cursor:pointer;font-family:inherit;${style}">${opts}</select>`;
}

function buildSchGrid(agents, dates, schedMap, today) {
  let html = `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%;border-collapse:collapse;font-size:11px;min-width:600px;"><thead><tr>
    <th style="padding:8px 12px;background:var(--surface2);color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);text-align:left;min-width:120px;">Agent</th>`;
  dates.forEach(d => {
    const isTd = d.iso === today;
    html += `<th style="padding:8px;background:var(--surface2);color:${isTd?'#D4AF37':'var(--muted)'};font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border);text-align:center;white-space:nowrap;"><div>${d.dayName}</div><div style="font-size:9px;margin-top:2px;">${d.display}</div></th>`;
  });
  html += `</tr></thead><tbody>`;

  agents.forEach((agent, idx) => {
    html += `<tr style="background:${idx%2===0?'var(--surface)':'var(--surface2)'};">
      <td style="padding:8px 12px;font-size:12px;font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;flex-shrink:0;">${agent.formal_name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>
          <span style="color:var(--text);">${agent.formal_name}</span>
        </div>
      </td>`;
    dates.forEach(d => {
      const e  = schedMap[`${agent.id}_${d.iso}`];
      const dt = e ? e.day_type : 'Off';
      const st = schShiftTypes.find(s => s.id === (e ? e.shift_type_id : null));
      const isTd = d.iso === today;
      let cell='— Off —', color='var(--muted)', bg='transparent', border='transparent';
       if (dt==='Work'&&st) {
  cell = st.start_time.substring(0,5)+' - '+st.end_time.substring(0,5);
  const hr = parseInt(st.start_time.substring(0,2));
       if (hr < 12)      { color='#059669'; bg='rgba(16,185,129,0.18)';  border='rgba(16,185,129,0.6)'; }
       else if (hr < 14) { color='#1d4ed8'; bg='rgba(59,130,246,0.18)';  border='rgba(59,130,246,0.6)'; }
       else             { color='#92400e'; bg='rgba(251,191,36,0.25)';   border='rgba(251,191,36,0.7)'; }
       }
      else if (dt==='Annual')   { cell='Annual'; color='#8b5cf6'; bg='rgba(139,92,246,0.05)'; border='rgba(139,92,246,0.3)'; }
      else if (dt==='Sick')     { cell='Sick';   color='#ef4444'; bg='rgba(239,68,68,0.05)';  border='rgba(239,68,68,0.3)'; }
      else if (dt==='Casual')   { cell='Casual'; color='#f59e0b'; bg='rgba(245,158,11,0.05)'; border='rgba(245,158,11,0.3)'; }
      else if (dt==='PH')       { cell='PH';     color='#3b82f6'; bg='rgba(59,130,246,0.05)'; border='rgba(59,130,246,0.3)'; }
      else if (dt==='Task')     { cell='Task';   color='#06b6d4'; bg='rgba(6,182,212,0.05)';  border='rgba(6,182,212,0.3)'; }
      const isYellow = dt==='Work' && st && parseInt(st.start_time.substring(0,2)) >= 14; html += `<td style="padding:5px;border-bottom:1px solid var(--border);text-align:center;${isTd?'background:rgba(212,175,55,0.04);':''}"><div style="background:${bg};border:1.5px solid ${border};border-radius:8px;padding:5px 4px;font-size:${isYellow?'13px':'12px'};font-weight:800;color:${color};white-space:nowrap;">${cell}</div></td>`;
    });
    html += `</tr>`;
  });

  html += `<tr style="background:var(--surface2);"><td style="padding:8px 12px;font-size:10px;color:var(--muted);font-weight:700;">Daily Count</td>`;
  dates.forEach(d => {
    const w = agents.filter(a => { const e=schedMap[`${a.id}_${d.iso}`]; return e&&e.day_type==='Work'; }).length;
    html += `<td style="padding:8px;text-align:center;font-size:12px;font-weight:800;color:#10b981;">${w} <span style="font-size:9px;color:var(--muted);font-weight:400;">working</span></td>`;
  });
  html += `</tr></tbody></table></div>`;
  return html;
}

async function loadSchTable(weekId) {
  if (!weekId) return;

  const week = schWeeks.find(w => w.id === weekId);
  if (!week) return;

  const gridEl = document.getElementById('sch-table-grid');
  gridEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading data...</div>';

  const today = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
  const dates = getSchWeekDates(week.week_start, week.week_end);

  try {
    const records = await sbFetchSch(`schedule?select=*&week_id=eq.${weekId}`);
    const schedMap = {};
    (records || []).forEach(s => { schedMap[`${s.agent_id}_${s.shift_date}`] = s; });
    gridEl.innerHTML = buildSchGrid(schAgents, dates, schedMap, today);
  } catch(e) {
    gridEl.innerHTML = '<div class="empty-state">Error loading schedule.</div>';
  }
}

async function loadDraftGrid() {
  const draftEl = document.getElementById('sch-draft-grid');
  draftEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i></div>';
  const draftWeeks = await sbFetchSch('schedule_weeks?select=id,week_start,week_end&status=eq.Draft&order=week_start.desc');
  if (!draftWeeks || !draftWeeks.length) {
    draftEl.innerHTML = '<div class="empty-state">No draft weeks available</div>';
    return;
  }
  const draftWeek = draftWeeks[0];
  schCurrentWeek  = draftWeek;
  const today      = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
  const draftDates = getSchWeekDates(draftWeek.week_start, draftWeek.week_end);
  const allReqs    = await sbFetchSch(`requests?select=*&type=eq.Schedule%20Request&status=eq.Pending&order=created_at.desc`);

  schAllDrafts = {}; schMyDraft = {};
  (allReqs || []).forEach(req => {
    try {
      const det = JSON.parse(req.details);
      if (det.week_id === draftWeek.id && !schAllDrafts[req.agent_id]) {
        schAllDrafts[req.agent_id] = det.draft || {};
      }
    } catch(e) {}
  });
  if (schMyAgentId && schAllDrafts[schMyAgentId]) schMyDraft = { ...schAllDrafts[schMyAgentId] };

  draftEl.innerHTML = '';
  const title = document.createElement('div');
  title.style.cssText = 'font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px;padding:4px 0;';
  title.innerText = `📝 Draft Week: ${fmtSchDate(draftWeek.week_start)} → ${fmtSchDate(draftWeek.week_end)}`;
  draftEl.appendChild(title);

  let draftHtml = `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%;border-collapse:collapse;font-size:11px;min-width:600px;"><thead><tr>
    <th style="padding:8px 12px;background:var(--surface2);color:var(--muted);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid var(--border);text-align:left;min-width:120px;">Agent</th>`;
  draftDates.forEach(d => {
    const isTd = d.iso === today;
    draftHtml += `<th style="padding:8px;background:var(--surface2);color:${isTd?'#D4AF37':'var(--muted)'};font-size:10px;font-weight:700;text-transform:uppercase;border-bottom:1px solid var(--border);text-align:center;white-space:nowrap;"><div>${d.dayName}</div><div style="font-size:9px;margin-top:2px;">${d.display}</div></th>`;
  });
  draftHtml += `</tr></thead><tbody>`;

  schAgents.forEach((agent, idx) => {
    const isMe       = agent.id === schMyAgentId;
    const agentDraft = isMe ? schMyDraft : (schAllDrafts[agent.id] || {});
    draftHtml += `<tr style="background:${idx%2===0?'var(--surface)':'var(--surface2)'};">
      <td style="padding:8px 12px;font-size:12px;font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:26px;height:26px;border-radius:50%;background:${isMe?'var(--primary-gradient)':'linear-gradient(135deg,#475569,#334155)'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;flex-shrink:0;">${agent.formal_name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>
          <span style="color:${isMe?'var(--primary)':'var(--text)'};">${agent.formal_name}${isMe?' (You)':''}</span>
        </div>
      </td>`;
    draftDates.forEach(d => {
      const draft = agentDraft[d.iso] || { day_type: 'Off', shift_type_id: null };
      const isTd  = d.iso === today;
      draftHtml += `<td style="padding:5px;border-bottom:1px solid var(--border);text-align:center;${isTd?'background:rgba(212,175,55,0.04);':''}">${buildShiftSelect(agent.id, d.iso, draft.day_type, draft.shift_type_id, isMe)}</td>`;
    });
    draftHtml += `</tr>`;
  });

  draftHtml += `</tbody></table></div>`;
  const table = document.createElement('div');
  table.innerHTML = draftHtml;
  draftEl.appendChild(table);

  if (!isSchRequestOpen()) {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-top:16px;padding:16px;background:rgba(239,68,68,0.06);border:1.5px solid rgba(239,68,68,0.3);border-radius:12px;text-align:center;font-size:13px;font-weight:700;color:#ef4444;white-space:pre-line;';
    banner.innerText = schRequestClosedMsg();
    draftEl.appendChild(banner);
    draftEl.querySelectorAll('select').forEach(s => s.disabled = true);
  }
}

function onSchDraftChange(sel) {
  const date = sel.dataset.date;
  const val  = sel.value;
  let dayType = val, shiftTypeId = null;
  if (val.startsWith('Work__')) { dayType = 'Work'; shiftTypeId = val.split('__')[1]; }
  schMyDraft[date] = { day_type: dayType, shift_type_id: shiftTypeId };
  sel.style.cssText += ';' + schCellStyle(dayType);
}

function isSchRequestOpen() {
  const day = new Date().getDay();
  return day === 0 || day === 1 || day === 2;
}

function schRequestClosedMsg() {
  const next = new Date();
  const daysUntilSun = (7 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilSun);
  return `🔒 Requests are closed now.\nOpens every Sunday — next opening: ${String(next.getDate()).padStart(2,'0')}/${String(next.getMonth()+1).padStart(2,'0')}`;
}

async function submitSchRequest() {
  if (!isSchRequestOpen()) { customAlert('Closed', schRequestClosedMsg()); return; }
  if (!schCurrentWeek)     { customAlert('Error', 'No draft week available!'); return; }
  if (!schMyAgentId)       { customAlert('Error', 'Agent not found!'); return; }

  const agentName = document.getElementById('user-name').innerText.trim();
  const msg = document.getElementById('sch-request-msg');
  const submitBtn = document.querySelector('[onclick="submitSchRequest()"]');
  /* FIX-5 */ if (submitBtn) setButtonLoading(submitBtn, true, 'Submitting...');
  msg.style.color = 'var(--muted)'; msg.innerText = 'Submitting...';

  const details = { week_id: schCurrentWeek.id, week_start: schCurrentWeek.week_start, draft: schMyDraft };
  const existing = await sbFetchSch(`requests?select=id,details&agent_id=eq.${schMyAgentId}&type=eq.Schedule%20Request&status=eq.Pending&order=created_at.desc&limit=1`);
  let existingId = null;
  if (existing && existing.length) {
    try {
      const det = JSON.parse(existing[0].details);
      if (det.week_id === schCurrentWeek.id) existingId = existing[0].id;
    } catch(e) {}
  }

  const body = JSON.stringify(existingId
    ? { details: JSON.stringify(details), updated_at: new Date().toISOString() }
    : { agent_id: schMyAgentId, agent_name: agentName, type: 'Schedule Request', details: JSON.stringify(details), status: 'Pending', created_at: new Date().toISOString() }
  );

  const res = await fetch(`${SB_URL_SCH}/rest/v1/requests${existingId ? '?id=eq.'+existingId : ''}`, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body
  });

  /* FIX-5 */ if (submitBtn) setButtonLoading(submitBtn, false, '📤 Submit Schedule Request');
  if (res.ok) {
    msg.style.color = '#10b981'; msg.innerText = '✅ Request submitted!';
    showToast('✅', 'Schedule Request Submitted!', 'Pending admin review.', 'success', 5000);
    setTimeout(() => msg.innerText = '', 5000);
  } else {
    msg.style.color = 'var(--danger)'; msg.innerText = '❌ Failed. Try again.';
  }
}

function resetSchDraft() {
  schMyDraft = {};
  document.querySelectorAll('#sch-draft-grid select').forEach(sel => {
    sel.value = 'Off';
    sel.style.cssText += ';' + schCellStyle('Off');
  });
}

function filterSchWeeks() {
  const year  = document.getElementById('sch-filter-year').value;
  const month = document.getElementById('sch-filter-month').value;
  const loader = document.getElementById('weeks-loader');
  const wrapper = document.getElementById('weeks-chips-wrapper');
  const list   = document.getElementById('weeks-list');

  loader.style.display = 'block';
  wrapper.style.display = 'none';

  const filtered = schWeeks.filter(w => {
    if (year  && !w.week_start.startsWith(year))        return false;
    if (month && w.week_start.substring(5,7) !== month) return false;
    return true;
  });

  setTimeout(() => {
    loader.style.display = 'none';

    if (!filtered.length) {
      wrapper.style.display = 'none';
      return;
    }

    wrapper.style.display = 'block';
    list.innerHTML = filtered.map(w => `
      <div class="week-chip" onclick="selectWeekChip('${w.id}', '${fmtSchDate(w.week_start)} → ${fmtSchDate(w.week_end)}', this)">
        <i class="far fa-calendar-alt"></i>
        <span>${fmtSchDate(w.week_start)} → ${fmtSchDate(w.week_end)}</span>
      </div>
    `).join('');

    document.getElementById('sch-table-grid').innerHTML = '<div class="empty-state">Select a week to view schedule.</div>';
  }, 300);
}

if (!window._schTabHooked) {
  window._schTabHooked = true;
  const origSwitchTab = switchTab;
  window.switchTab = function(id, btn, idx) {
    origSwitchTab(id, btn, idx);
    if (id === 'tab-sch-table') initSchTab();
  };
}

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

/* ── FIX-3: Search button inline في Step 1 ──
   ملاحظة: الزرار ده محتاج يتضاف في الـ HTML بتاع step-1
   بس هنا بنعمل inject له تلقائياً لو مش موجود
*/
document.addEventListener('DOMContentLoaded', () => {
  /* FIX-3: أضف زرار البحث في step-1 لو مش موجود */
  const step1 = document.getElementById('step-1');
  if (step1 && !document.getElementById('inline-search-btn')) {
    const searchWrapper = document.createElement('div');
    searchWrapper.style.cssText = 'margin-top:16px;';
    searchWrapper.innerHTML = `
      <div style="border-top:1px solid var(--border);padding-top:16px;margin-top:8px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
          ⚡ Quick Customer Search
        </div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="step1-search-input" placeholder="Name or mobile..."
            class="form-input" style="flex:1;"
            onkeydown="if(event.key==='Enter') step1SearchCustomer()">
          <button id="inline-search-btn"
            onclick="step1SearchCustomer()"
            style="padding:10px 16px;background:var(--primary-gradient);color:white;border:none;border-radius:11px;cursor:pointer;font-weight:700;font-family:inherit;white-space:nowrap;">
            🔍 Search
          </button>
        </div>
        <div id="step1-search-results" style="margin-top:10px;"></div>
      </div>`;
    step1.appendChild(searchWrapper);
  }

  /* FIX-4: Time Off مفتوح علطول */
  const tof = document.getElementById('time-off-form');
  if (tof) tof.style.display = 'block';
});

/* FIX-3: دالة البحث الصغيرة في Step 1 */
async function step1SearchCustomer() {
  const query = (document.getElementById('step1-search-input')?.value || '').trim();
  const resultsEl = document.getElementById('step1-search-results');
  const btn = document.getElementById('inline-search-btn');
  if (!query || !resultsEl) return;

  setButtonLoading(btn, true, 'Searching...');
  resultsEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';

  try {
    const [gasRes, sbRes] = await Promise.allSettled([
      gasRun('searchCustomer', query),
      fetch(`${SB_URL_SCH}/rest/v1/call_logs?or=(customer_name.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(query)}%25)&order=logged_at.desc&limit=5`,
        { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
      ).then(r => r.json())
    ]);

// GAS results
    const gasResults = (gasRes.status === 'fulfilled' && gasRes.value?.status === 'success')
      ? gasRes.value.results || [] : [];
    // Supabase results
    const sbResults = (sbRes.status === 'fulfilled' && Array.isArray(sbRes.value))
      ? sbRes.value : [];
    // Deduplicate بالموبايل والاسم
    const normalize  = m => (m || '').replace(/\s/g, '').replace(/^0/, '');
    const gasNames   = new Set(gasResults.map(r => (r.name || '').toLowerCase().trim()));
    const gasMobiles = new Set(gasResults.map(r => normalize(r.mobile)));
    const uniqueSB   = sbResults.filter(c =>
      !gasMobiles.has(normalize(c.customer_mobile)) &&
      !gasNames.has((c.customer_name || '').toLowerCase().trim())
    );
    let html = '';
    const total = gasResults.length + uniqueSB.length;
     
    // GAS results
    if (gasResults.length) {
      html += `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📋 GAS — ${gasResults.length} result(s)</div>`;
      html += gasResults.slice(0, 3).map(r => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:6px;font-size:12px;">
          <div style="font-weight:700;color:var(--text);">${r.name || 'N/A'}</div>
          <div style="color:var(--muted);font-family:monospace;">${r.mobile || '-'}</div>
          <div style="color:var(--muted);">${r.reason || '-'} · ${r.agent || '-'}</div>
          <div style="color:var(--muted);font-size:11px;">${r.timestamp || ''}</div>
        </div>`).join('');
    }

    // Supabase results
    if (uniqueSB.length) {
      html += `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:10px 0 6px;">🗄️ Database — ${uniqueSB.length} result(s)</div>`;
      html += uniqueSB.map(c => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:6px;font-size:12px;">
          <div style="font-weight:700;color:var(--text);">${c.customer_name || 'N/A'}</div>
          <div style="color:var(--muted);font-family:monospace;">${c.customer_mobile || '-'}${c.customer_mobile2 && c.customer_mobile2 !== '-' ? ' · ' + c.customer_mobile2 : ''}</div>
          <div style="color:var(--muted);">${c.call_reason || '-'} · ${c.agent_name || '-'}</div>
          <div style="color:var(--muted);font-size:11px;">${c.logged_at ? new Date(c.logged_at).toLocaleDateString('en-GB') : ''}</div>
        </div>`).join('');
    }

    if (!total) {
      html = `<div style="font-size:12px;color:var(--muted);padding:4px 0;">No results for "${query}"</div>`;
    }

    resultsEl.innerHTML = html;

  } catch(e) {
    resultsEl.innerHTML = '<div style="font-size:12px;color:var(--danger);">Connection error</div>';
  } finally {
    setButtonLoading(btn, false, '🔍 Search');
  }
}

async function loadLastTwoCalls(agentName) {
  try {
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/call_logs?agent_name=eq.${encodeURIComponent(agentName)}&order=logged_at.desc&limit=2`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();
    const el = document.getElementById('last-two-calls');
    if (!el) return;
    if (!data || !data.length) { el.innerHTML = ''; return; }
    el.innerHTML = data.map(c => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:10px;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📞</div>
            <div>
              <div style="font-size:13px;font-weight:800;color:var(--text);">${c.customer_name || '—'}</div>
              <div style="font-size:11px;color:var(--muted);font-family:monospace;">${c.customer_mobile || '—'}${c.customer_mobile2 && c.customer_mobile2 !== '-' && c.customer_mobile2 !== 'N/A' ? ' · ' + c.customer_mobile2 : ''}</div>
            </div>
          </div>
          <div style="font-size:10px;color:var(--muted);white-space:nowrap;">${c.logged_at ? new Date(c.logged_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;">
          <div><span style="color:var(--muted);">Reason: </span><span style="font-weight:700;color:var(--primary);">${c.call_reason || '—'}</span></div>
          <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:700;color:var(--text);">${c.communication_channel || '—'}</span></div>
          <div><span style="color:var(--muted);">Media: </span><span style="font-weight:700;color:var(--text);">${c.media_source || '—'}</span></div>
          <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:700;color:var(--text);">${c.budget || '—'}</span></div>
          <div><span style="color:var(--muted);">Unit: </span><span style="font-weight:700;color:var(--text);">${c.unit_type || '—'}</span></div>
          <div><span style="color:var(--muted);">Sales: </span><span style="font-weight:700;color:var(--text);">${c.sales_call_requested || '—'}</span></div>
        </div>
        ${c.extra_notes && c.extra_notes.trim() && c.extra_notes !== '-' ? `
        <div style="margin-top:8px;padding:8px;background:var(--surface);border-radius:8px;border:1px solid var(--border);font-size:11px;color:var(--muted);">
          <i class="fas fa-sticky-note" style="margin-right:5px;color:var(--warn);"></i>${c.extra_notes}
        </div>` : ''}
      </div>
    `).join('');
  } catch(e) { console.warn('loadLastTwoCalls error:', e); }
}
function clearStep1Search() {
  const input = document.getElementById('step1-search-input');
  const results = document.getElementById('step1-search-results');
  if (input) input.value = '';
  if (results) results.innerHTML = '';
}
