/* ═══════════════════════════════════════════════════
   NOS PORTAL — app.js (MODIFIED)
   كل الـ JavaScript الخاص بالبورتال
   ═══════════════════════════════════════════════════
   التعديلات المطبقة:
   1. إصلاح الـ Schedule في الـ Inner
   2. عرض الأسبوع الحالي والقادم قبل الـ Publish
   3. إضافة زرار Search في الخطوة الأولى
   4. فتح Time Off Request Table دائماً
   5. إضافة Loading لأزرار الـ Submit
   ═══════════════════════════════════════════════════
   الترتيب:
   01. Global Variables    (المتغيرات العامة)
   02. Theme (Dark/Light)  (الثيم)
   03. Side Menu           (القائمة الجانبية)
   04. Change Password     (تغيير الباسورد)
   05. App Init (onload)   (تشغيل التطبيق)
   06. Modal & Alert       (النوافذ)
   07. Login & Auth        (الدخول)
   08. Dashboard           (الداشبورد)
   09. Schedule Render     (عرض الجدول)
   10. Team Render         (عرض الفريق)
   11. Requests Render     (عرض الطلبات)
   12. KPI Filter          (فلتر KPI)
   13. Break Notifications (إشعارات الاستراحة)
   14. Break Swap          (تبادل الاستراحة)
   15. Excuse / Time Off   (الأعذار والإجازات)
   16. Call Log Form       (سجل المكالمات)
   17. Customer Search     (بحث العملاء)
   18. Knowledge Base      (قاعدة المعرفة)
   19. Shift Swap          (تبديل الشيفت)
   20. Toast Notifications (الإشعارات العائمة)
   21. Annual Leave        (الإجازة السنوية)
   22. Missing Punch       (Missing Punch)
   23. Navigation & Tabs   (التنقل)
   24. Utility Functions   (مساعدات)
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
let knownSwapStatuses  = {};
let swapPollTimer      = null;
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
  const btn   = document.getElementById('cpSubmitBtn');

  if (!oldP || !newP || !confP) { msg.style.color = 'var(--danger)'; msg.innerText = 'Fill all fields'; return; }
  if (newP !== confP)           { msg.style.color = 'var(--danger)'; msg.innerText = "Passwords don't match!"; return; }

  // ✅ تعديل #5: إضافة loading indicator
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
  msg.style.color = 'var(--primary)'; msg.innerText = 'Updating...';
  
  gasRun('updatePassword', name, oldP, newP).then(res => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Update Password';
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

  gasRun('processLogin', name, pass).then(res => {
    btn.disabled = false;
    if (res.status === 'success') {
      showDashboard(res);
    } else {
      document.getElementById('app-preloader').classList.add('hidden');
      msg.style.color = 'var(--danger)';
      msg.innerHTML   = '<i class="fas fa-times-circle"></i> ' + res.msg;
    }
  }).catch(() => {
    btn.disabled = false;
    document.getElementById('app-preloader').classList.add('hidden');
    msg.style.color = 'var(--danger)';
    msg.innerHTML   = '<i class="fas fa-wifi"></i> Network error. Please try again.';
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
  if (swapPollTimer)   clearInterval(swapPollTimer);
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
    document.getElementById('status-text').innerText     = shift;
    document.getElementById('status-text').style.color   = 'var(--primary)';
    document.getElementById('status-sub-text').innerText = 'Enjoy your shift!';
    document.getElementById('br-shift').innerText        = 'SHIFT: ' + shift;

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
  renderRequests(res.userRequests || []);
  globalScheduleData = res.schedule      || [];
  globalTeamData     = res.allStaffBreaks || [];
  populateSwapForm();
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
/* ✅ تعديل #1: إصلاح الـ Schedule في الـ Inner */
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
  const nextWeekEnd   = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

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
      const todayClass = d.date === today.getDate() ? ' nos-today' : '';
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
function renderRequests(requests) {
  const container = document.getElementById('requests-list');
  if (!requests.length) { container.innerHTML = '<div class="empty-state">No previous requests found.</div>'; return; }
  container.innerHTML = '';
  const icons = {'Missing Punch':'fa-fingerprint','Excuse':'fa-exclamation-circle','Time Off':'fa-calendar-check','Shift Swap':'fa-exchange-alt'};
  requests.forEach(req => {
    const cls = req.status === 'Approved' ? 'status-approved' : req.status === 'Rejected' ? 'status-rejected' : 'status-pending';
    const div = document.createElement('div');
    div.className = 'req-card';
    div.innerHTML = `<div style="flex:1">
      <div class="req-type"><i class="fas ${icons[req.type]||'fa-file'}" style="margin-right:6px"></i>${req.type}</div>
      <div class="req-detail">${req.details||''}</div>
      <div class="req-date"><i class="fas fa-calendar" style="margin-right:4px"></i>${req.date}${req.time?' - '+req.time:''}</div>
    </div><div class="req-status ${cls}">${req.status}</div>`;
    container.appendChild(div);
  });
}

function exportRequests(type) {
  const name = document.getElementById('user-name').innerText.trim();
  gasRun('exportRequestsViaEmail', name, type).then(res => customAlert('Export', res.msg));
}


/* ─── 12. KPI FILTER ─── */
function changeMonthData() {
  const month  = document.getElementById('monthFilter').value;
  const name   = document.getElementById('user-name').innerText.trim();
  const loader = document.getElementById('filter-loader');
  loader.classList.remove('hidden');
  gasRun('getMonthlyData', name, month).then(res => {
    loader.classList.add('hidden');
    if (res.status === 'success' && res.data) {
      ['conformance','missing','aht','calls','annual','exceptions','quality']
        .forEach(k => document.getElementById('d-' + k).innerText = res.data[k] || '-');
    }
  });
}


/* ─── 13. BREAK NOTIFICATIONS ─── */
let sbBreaksChannel = null;

async function loadTodayBreaksFromSB(agentId) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/breaks?agent_id=eq.${agentId}&break_date=eq.${today}`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();
    if (data && data.length) {
      const b = data[0];
      return {
        break1: b.break1 ? b.break1.substring(0,5) : null,
        lunch:  b.lunch  ? b.lunch.substring(0,5)  : null,
        break2: b.break2 ? b.break2.substring(0,5) : null,
      };
    }
    return null;
  } catch(e) { console.error('Error loading breaks:', e); return null; }
}

function applyBreaksToUI(breaks) {
  currentBreaks = breaks;
  if (breaks.break1) document.getElementById('br-break1').innerText = breaks.break1;
  if (breaks.lunch)  document.getElementById('br-lunch').innerText  = breaks.lunch;
  if (breaks.break2) document.getElementById('br-break2').innerText = breaks.break2;
  startBreakChecker(breaks);
}

function startBreakChecker(breaks) {
  if (breakCheckTimer) clearInterval(breakCheckTimer);
  breakCheckTimer = setInterval(() => checkBreakNotifications(breaks), 30000);
}

function checkBreakNotifications(breaks) {
  const now = new Date();
  const curSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  function timeToSecs(t) { if (!t) return null; const p = t.split(':'); return parseInt(p[0]) * 3600 + parseInt(p[1]) * 60; }
  function notif(key, title, msg, icon) {
    if (!_notifFired[key]) {
      _notifFired[key] = true;
      if (Notification && Notification.permission === 'granted') {
        new Notification(title, { body: msg, icon: icon || '🔔', tag: key });
      }
      playNotifSound();
    }
  }

  const b1s = timeToSecs(breaks.break1);
  const ls  = timeToSecs(breaks.lunch);
  const b2s = timeToSecs(breaks.break2);

  if (b1s && curSecs >= b1s - 300 && curSecs < b1s) notif('break1_warn', 'Break 1 Soon', 'Your break 1 starts in 5 minutes!', '⏰');
  if (b1s && curSecs >= b1s && curSecs < b1s + 60) notif('break1_start', 'Break 1 Started', 'Enjoy your break!', '☕');
  if (b1s && curSecs >= b1s + 900 && curSecs < b1s + 960) notif('break1_end', 'Break 1 Ending', 'Your break is ending soon.', '⏳');

  if (ls && curSecs >= ls - 300 && curSecs < ls) notif('lunch_warn', 'Lunch Soon', 'Your lunch starts in 5 minutes!', '⏰');
  if (ls && curSecs >= ls && curSecs < ls + 60) notif('lunch_start', 'Lunch Time', 'Enjoy your lunch!', '🍽️');
  if (ls && curSecs >= ls + 1800 && curSecs < ls + 1860) notif('lunch_end', 'Lunch Ending', 'Your lunch is ending soon.', '⏳');

  if (b2s && curSecs >= b2s - 300 && curSecs < b2s) notif('break2_warn', 'Break 2 Soon', 'Your break 2 starts in 5 minutes!', '⏰');
  if (b2s && curSecs >= b2s && curSecs < b2s + 60) notif('break2_start', 'Break 2 Started', 'Enjoy your break!', '☕');
  if (b2s && curSecs >= b2s + 900 && curSecs < b2s + 960) notif('break2_end', 'Break 2 Ending', 'Your break is ending soon.', '⏳');

  if (shiftEndSecs && curSecs >= shiftEndSecs - 300 && curSecs < shiftEndSecs && !shiftEndNotified) {
    shiftEndNotified = true;
    notif('shift_warn', 'Shift Ending', 'Your shift ends in 5 minutes!', '⏰');
  }
}

function playNotifSound() {
  if (isMuted || notifPlaying) return;
  notifPlaying = true;
  const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
  audio.play().catch(() => {}).finally(() => { notifPlaying = false; });
}

function stopNotifSound() { isMuted = true; }


/* ─── 14. BREAK SWAP ─── */
async function findAvailableBreakSlot(requestedTime, breakType, shiftStart, shiftEnd) {
  if (!schMyAgentId) return null;
  const today = new Date().toISOString().split('T')[0];

  try {
    const allBreaks = await fetch(
      `${SB_URL_SCH}/rest/v1/breaks?break_date=eq.${today}`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    ).then(r => r.json());

    const dur = 15;
    const noBreakStart = timeStrToMins(shiftStart);
    const noBreakEnd = timeStrToMins(shiftEnd);

    function hasConflict(slotMins) {
      const slotEnd = slotMins + dur;
      const col = { 'Break 1': 'break1', 'Lunch': 'lunch', 'Break 2': 'break2' }[breakType];
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
  } catch(e) {
    console.error('Error finding break slot:', e);
    return null;
  }
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

  btn.disabled    = true;
  msg.style.color = 'var(--muted)';
  msg.innerText   = 'Checking availability...';

  try {
    const shiftText = document.getElementById('br-shift').innerText.replace('SHIFT: ','');
    const shiftParts = shiftText.split(' - ');
    const shiftStart = shiftParts[0]?.trim() || '00:00';
    const shiftEnd   = shiftParts[1]?.trim() || '23:00';

    const suggestion = await findAvailableBreakSlot(time, selectedBreakType, shiftStart, shiftEnd);

    if (suggestion) {
      btn.disabled = false;
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
    btn.disabled = false;
    setTimeout(() => msg.innerText = '', 4000);
  }
}


/* ─── 15. EXCUSE & TIME OFF ─── */
function sendExcuse() {
  const rawDate    = document.getElementById('excuseDate').value;
  const excuseType = document.getElementById('excuseType').value;
  if (!rawDate)    { customAlert('Error', 'Please select a date!'); return; }
  if (!excuseType) { customAlert('Error', 'Please select excuse type!'); return; }
  const name = document.getElementById('user-name').innerText.trim();
  const msg  = document.getElementById('excuse-msg');
  const btn  = document.getElementById('excuseBtn');
  
  // ✅ تعديل #5: إضافة loading indicator
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  msg.innerText = '';
  
  gasRun('submitExcuseFromWeb', name, rawDate, excuseType).then(res => {
    btn.disabled    = false;
    btn.innerHTML   = '<i class="fas fa-paper-plane"></i> Submit Excuse';
    msg.style.color = res.status === 'success' ? 'var(--accent)' : 'var(--danger)';
    msg.innerText   = res.msg;
    if (res.status === 'success') customAlert('Success', res.msg);
    setTimeout(() => msg.innerText = '', 5000);
  });
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

/* ✅ تعديل #4: فتح Time Off Request Table دائماً */
function selectTimeOffType(type) {
  if (selectedTimeOffType === type) {
    selectedTimeOffType = null;
    document.getElementById('time-off-form').style.display = 'none';
    document.querySelectorAll('.action-row .action-btn').forEach(b => b.style.opacity = '1');
    return;
  }
  selectedTimeOffType = type;
  document.getElementById('time-off-form').style.display = 'block';
  document.getElementById('time-off-table').style.display = 'block';  // ← إضافة: فتح الجدول دائماً
  ['timeOffFromDate','timeOffToDate','timeOffNotes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('time-off-msg').innerText = '';
  document.querySelectorAll('.action-row .action-btn').forEach(b => b.style.opacity = '0.4');
  event.currentTarget.style.opacity    = '1';
  event.currentTarget.style.borderWidth= '2px';
}

function cancelTimeOffForm() {
  selectedTimeOffType = null;
  document.getElementById('time-off-form').style.display = 'none';
  document.getElementById('time-off-table').style.display = 'block';  // ← إضافة: الجدول يبقى مفتوح
  document.querySelectorAll('.action-row .action-btn').forEach(b => b.style.opacity = '1');
}

function submitTimeOffRequest() {
  const type  = selectedTimeOffType;
  const from  = document.getElementById('timeOffFromDate').value;
  const to    = document.getElementById('timeOffToDate').value;
  const notes = document.getElementById('timeOffNotes').value;
  const name  = document.getElementById('user-name').innerText.trim();
  const msg   = document.getElementById('time-off-msg');
  const btn   = document.getElementById('submitTimeOffBtn');
  
  if (!from || !to) { msg.style.color='var(--danger)'; msg.innerText='Please select both dates!'; return; }
  
  // ✅ تعديل #5: إضافة loading indicator
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  
  gasRun('submitTimeOffRequest', name, type, from, to, notes).then(res => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit';
    if (res.status === 'success') {
      showToast('✅', type+' Request Submitted!', 'Pending review by manager.', 'success', 6000);
      setTimeout(() => { cancelTimeOffForm(); refreshData(); }, 2000);
    } else {
      msg.style.color = 'var(--danger)'; msg.innerText = res.msg || '';
    }
  });
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
  
  // ✅ تعديل #5: إضافة loading indicator
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

  const slowTimer = setTimeout(() => {
    if (btn.disabled) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Almost there...';
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

  gasRun(gasAction, data).then(res => {
    clearTimeout(slowTimer);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to Database';
    if (res.status === 'success') {
      const bar = document.getElementById('call-summary-bar');
      document.getElementById('cs-name').innerText   = cname  || '—';
      document.getElementById('cs-mobile').innerText = mobile || '—';
      document.getElementById('cs-reason').innerText = reason || '—';
      bar.style.display = 'flex';
      setTimeout(() => bar.style.display = 'none', 30000);
      resetCallForm();
      showToast('✅', 'Call Logged!', cname ? cname + ' — ' + mobile : reason, 'success', 5000);  
    } else {
      showFormErr(res.msg || 'Something went wrong.');
    }
  }).catch(err => {
    clearTimeout(slowTimer);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to Database';
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

/* ✅ تعديل #3: إضافة زرار Search في الخطوة الأولى */
function goStep(n) {
  // Validate before going forward
  if (n > _currentStep) {
    if (_currentStep === 1) {
      const agent  = document.getElementById('f-agent').value;
      const reason = document.getElementById('f-reason').value;
      if (!agent || !reason) { showFormErr('Please select Agent and Call Reason!'); return; }
      if (reason === 'Wrong Number' || reason === 'Call Dropped') { n = 4; }
    }
  }

  // Update dots & lines
  for (let i = 1; i <= 4; i++) {
    const dot  = document.getElementById('sdot-' + i);
    const line = document.getElementById('sline-' + i);
    if (i < n)       { dot.className = 'step-dot done'; dot.innerHTML = '✓'; }
    else if (i === n) { dot.className = 'step-dot active'; dot.innerHTML = i; }
    else              { dot.className = 'step-dot'; dot.innerHTML = i; }
    if (line) line.className = i < n ? 'step-line done' : 'step-line';
  }

  // Show panel
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  _currentStep = n;

  // ← إضافة: عرض/إخفاء زرار البحث حسب الخطوة الحالية
  const searchBtn = document.getElementById('search-customer-btn');
  if (searchBtn) {
    searchBtn.style.display = (n === 1) ? 'block' : 'none';
  }
}

function showFormErr(msg) {
  showResultPopup('error', 'Check Your Data', msg, 'Got it');
}


/* ─── 17. CUSTOMER SEARCH ─── */
function searchCustomer() {
  const query      = document.getElementById('search-query').value.trim();
  const resultsDiv = document.getElementById('search-results');
  if (!query) { resultsDiv.innerHTML = '<div class="empty-state">Please enter a name or mobile number.</div>'; return; }
  resultsDiv.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
  gasRun('searchCustomer', query).then(res => {
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
  listEl.innerHTML = '<div class="kb-no-results"><i class="fas fa-spinner fa-spin"></i></div>';
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
  
  // ✅ تعديل #5: إضافة loading indicator
  saveBtn.disabled = true;
  saveBtn.innerHTML= '<i class="fas fa-spinner fa-spin"></i><span class="kb-btn-label">Saving</span>';
  
  window.saveKBSection(s.id, newContent).then(ok => {
    saveBtn.disabled = false;
    saveBtn.innerHTML= '<i class="fas fa-check"></i><span class="kb-btn-label">Save</span>';
    if (ok) {
      s.content = newContent;
      cancelKBEdit();
      showToast('✅', 'Saved!', 'Knowledge base article saved.', 'success', 3000);
    } else {
      showToast('❌', 'Error', 'Failed to save article.', 'danger', 3000);
    }
  }).catch(() => {
    saveBtn.disabled = false;
    saveBtn.innerHTML= '<i class="fas fa-check"></i><span class="kb-btn-label">Save</span>';
    showToast('❌', 'Error', 'Failed to save article.', 'danger', 3000);
  });
}

function updateKBToolbarState() {
  const editBtn = document.getElementById('kb-edit-btn');
  const saveBtn = document.getElementById('kb-save-btn');
  const cancelBtn = document.getElementById('kb-cancel-btn');
  if (!editBtn || !saveBtn || !cancelBtn) return;
  if (kbEditMode) {
    editBtn.style.display = 'none';
    saveBtn.style.display = 'block';
    cancelBtn.style.display = 'block';
  } else {
    editBtn.style.display = 'block';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
  }
}


/* ─── 19. SHIFT SWAP ─── */
let schWeeks       = [];
let schAgents      = [];
let schShiftTypes  = [];
let schCurrentWeek = null;
let schAllDrafts   = {};
let schMyDraft     = {};

async function findAvailableShiftSlot(agentId, date, shiftTypeId) {
  try {
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/schedule?shift_date=eq.${date}&shift_type_id=eq.${shiftTypeId}&select=count`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();
    return data && data.length ? data[0].count : 0;
  } catch(e) {
    console.error('Error checking shift availability:', e);
    return 0;
  }
}

function populateSwapForm() {
  const agentSelect = document.getElementById('swap-agent-select');
  if (!agentSelect) return;
  agentSelect.innerHTML = '<option value="">Select agent to swap with...</option>';
  (globalTeamData || []).forEach(agent => {
    if (agent.name !== sessionAgent) {
      agentSelect.add(new Option(agent.name, agent.name));
    }
  });
}

function submitShiftSwap() {
  const agent1 = sessionAgent;
  const agent2 = document.getElementById('swap-agent-select').value;
  const date   = document.getElementById('swap-date').value;
  const msg    = document.getElementById('swap-msg');
  const btn    = document.getElementById('swapBtn');

  if (!agent2) { msg.innerText = 'Please select an agent'; return; }
  if (!date)   { msg.innerText = 'Please select a date'; return; }

  // ✅ تعديل #5: إضافة loading indicator
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  msg.innerText = 'Processing swap request...';

  gasRun('submitShiftSwap', agent1, agent2, date).then(res => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-exchange-alt"></i> Request Swap';
    if (res.status === 'success') {
      msg.innerText = '✅ Swap request submitted!';
      showToast('✅', 'Swap Requested!', `Waiting for ${agent2}'s response.`, 'success', 5000);
      setTimeout(() => {
        document.getElementById('swap-agent-select').value = '';
        document.getElementById('swap-date').value = '';
        msg.innerText = '';
      }, 3000);
    } else {
      msg.innerText = '❌ ' + (res.msg || 'Failed to submit swap');
    }
  }).catch(() => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-exchange-alt"></i> Request Swap';
    msg.innerText = '❌ Network error';
  });
}


/* ─── 20. TOAST NOTIFICATIONS ─── */
function showToast(icon, title, msg, type, duration) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration || 5000);
}

function logoutToast() {
  showToast('👋', 'Goodbye!', 'You have been logged out.', 'info', 3000);
}


/* ─── 21. ANNUAL LEAVE ─── */
function openAnnualLeaveModal() {
  const modal = document.getElementById('annual-leave-modal');
  const used = document.getElementById('annual-used');
  const left = document.getElementById('annual-left');
  used.innerText = currentAnnualData.used || 0;
  left.innerText = currentAnnualData.left || 0;
  modal.style.display = 'flex';
}

function closeAnnualLeaveModal() {
  document.getElementById('annual-leave-modal').style.display = 'none';
}


/* ─── 22. MISSING PUNCH ─── */
function submitMissingPunch() {
  const date = document.getElementById('missing-date').value;
  const time = document.getElementById('missing-time').value;
  const type = document.getElementById('missing-type').value;
  const name = document.getElementById('user-name').innerText.trim();
  const msg  = document.getElementById('missing-msg');
  const btn  = document.getElementById('missingBtn');

  if (!date || !time || !type) { msg.innerText = 'Please fill all fields'; return; }

  // ✅ تعديل #5: إضافة loading indicator
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
  msg.innerText = '';

  gasRun('submitMissingPunch', name, date, time, type).then(res => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit';
    if (res.status === 'success') {
      msg.innerText = '✅ Missing punch submitted!';
      showToast('✅', 'Missing Punch Submitted!', 'Pending manager approval.', 'success', 5000);
      setTimeout(() => {
        document.getElementById('missing-date').value = '';
        document.getElementById('missing-time').value = '';
        document.getElementById('missing-type').value = '';
        msg.innerText = '';
      }, 3000);
    } else {
      msg.innerText = '❌ ' + (res.msg || 'Failed to submit');
    }
  });
}


/* ─── 23. NAVIGATION & TABS ─── */
function switchTab(tabId, btn, idx) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  if (btn) btn.classList.add('active');

  if (tabId === 'tab-sch-table') initSchTab();
}

function pushHistoryState() {
  if (window.history && window.history.pushState) {
    window.history.pushState({ page: 'dashboard' }, 'Dashboard', window.location.href);
  }
}


/* ─── 24. UTILITY FUNCTIONS ─── */
async function sbFetchSch(path) {
  try {
    const res = await fetch(`${SB_URL_SCH}/rest/v1/${path}`, {
      headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` }
    });
    return res.ok ? res.json() : null;
  } catch(e) {
    console.error('Supabase fetch error:', e);
    return null;
  }
}

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
    filterSchWeeks();
    loadDraftGrid();
  } catch(e) {
    console.error('SCH Tab failed:', e);
  }
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
      if      (dt==='Work'&&st) { cell=st.start_time.substring(0,5)+' - '+st.end_time.substring(0,5); color='#10b981'; bg='rgba(16,185,129,0.05)'; border='rgba(16,185,129,0.3)'; }
      else if (dt==='Annual')   { cell='Annual'; color='#8b5cf6'; bg='rgba(139,92,246,0.05)'; border='rgba(139,92,246,0.3)'; }
      else if (dt==='Sick')     { cell='Sick';   color='#ef4444'; bg='rgba(239,68,68,0.05)';  border='rgba(239,68,68,0.3)'; }
      else if (dt==='Casual')   { cell='Casual'; color='#f59e0b'; bg='rgba(245,158,11,0.05)'; border='rgba(245,158,11,0.3)'; }
      else if (dt==='PH')       { cell='PH';     color='#3b82f6'; bg='rgba(59,130,246,0.05)'; border='rgba(59,130,246,0.3)'; }
      else if (dt==='Task')     { cell='Task';   color='#06b6d4'; bg='rgba(6,182,212,0.05)';  border='rgba(6,182,212,0.3)'; }
      html += `<td style="padding:5px;border-bottom:1px solid var(--border);text-align:center;${isTd?'background:rgba(212,175,55,0.04);':''}"><div style="background:${bg};border:1.5px solid ${border};border-radius:8px;padding:5px 4px;font-size:10px;font-weight:700;color:${color};white-space:nowrap;">${cell}</div></td>`;
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

/* ✅ تعديل #2: عرض الأسبوع الحالي والقادم قبل الـ Publish */
async function loadSchTable(weekId) {
  if (!weekId) return;
  
  const week = schWeeks.find(w => w.id === weekId);
  if (!week) return;
  
  const gridEl = document.getElementById('sch-table-grid');
  
  // عرض معاينة الأسبوع الحالي والقادم قبل الـ Publish
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
  const dates = getSchWeekDates(week.week_start, week.week_end);
  
  gridEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Loading schedule preview...</div>';
  
  try {
    const records = await sbFetchSch(`schedule?select=*&week_id=eq.${weekId}`);
    const schedMap = {};
    (records || []).forEach(s => { schedMap[`${s.agent_id}_${s.shift_date}`] = s; });
    
    // عرض الجدول مع معاينة الأسبوع
    let previewHtml = `<div style="margin-bottom:20px;padding:12px;background:var(--surface2);border-radius:10px;border-left:4px solid var(--primary);">
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px;">📅 Schedule Preview</div>
      <div style="font-size:13px;color:var(--text);font-weight:600;">${fmtSchDate(week.week_start)} → ${fmtSchDate(week.week_end)}</div>
    </div>`;
    
    gridEl.innerHTML = previewHtml + buildSchGrid(schAgents, dates, schedMap, today);
  } catch(e) {
    gridEl.innerHTML = '<div class="empty-state">Error loading schedule.</div>';
  }
}

async function loadDraftGrid() {
  const draftEl = document.getElementById('sch-draft-grid');
  draftEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i></div>';
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
    draftHtml += `<tr style="background:${idx%2===0?'var(--surface)':'var(--surface2)'};">
      <td style="padding:8px 12px;font-size:12px;font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:26px;height:26px;border-radius:50%;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;flex-shrink:0;">${agent.formal_name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>
          <span style="color:var(--text);">${agent.formal_name}</span>
        </div>
      </td>`;
    draftDates.forEach(d => {
      const myDraft = schMyDraft[d.iso];
      const dt = myDraft ? myDraft.dayType : 'Off';
      const st = schShiftTypes.find(s => s.id === (myDraft ? myDraft.shiftTypeId : null));
      const isTd = d.iso === today;
      let cell='— Off —', color='var(--muted)', bg='transparent', border='transparent';
      if      (dt==='Work'&&st) { cell=st.start_time.substring(0,5)+' - '+st.end_time.substring(0,5); color='#10b981'; bg='rgba(16,185,129,0.05)'; border='rgba(16,185,129,0.3)'; }
      else if (dt==='Annual')   { cell='Annual'; color='#8b5cf6'; bg='rgba(139,92,246,0.05)'; border='rgba(139,92,246,0.3)'; }
      else if (dt==='Sick')     { cell='Sick';   color='#ef4444'; bg='rgba(239,68,68,0.05)';  border='rgba(239,68,68,0.3)'; }
      else if (dt==='Casual')   { cell='Casual'; color='#f59e0b'; bg='rgba(245,158,11,0.05)'; border='rgba(245,158,11,0.3)'; }
      else if (dt==='PH')       { cell='PH';     color='#3b82f6'; bg='rgba(59,130,246,0.05)'; border='rgba(59,130,246,0.3)'; }
      else if (dt==='Task')     { cell='Task';   color='#06b6d4'; bg='rgba(6,182,212,0.05)';  border='rgba(6,182,212,0.3)'; }
      draftHtml += `<td style="padding:5px;border-bottom:1px solid var(--border);text-align:center;${isTd?'background:rgba(212,175,55,0.04);':''}"><div style="background:${bg};border:1.5px solid ${border};border-radius:8px;padding:5px 4px;font-size:10px;font-weight:700;color:${color};white-space:nowrap;">${cell}</div></td>`;
    });
    draftHtml += `</tr>`;
  });

  draftHtml += `<tr style="background:var(--surface2);"><td style="padding:8px 12px;font-size:10px;color:var(--muted);font-weight:700;">Daily Count</td>`;
  draftDates.forEach(d => {
    const w = schAgents.filter(a => { const dr=schAllDrafts[a.id]; return dr&&dr[d.iso]&&dr[d.iso].dayType==='Work'; }).length;
    draftHtml += `<td style="padding:8px;text-align:center;font-size:12px;font-weight:800;color:#10b981;">${w} <span style="font-size:9px;color:var(--muted);font-weight:400;">working</span></td>`;
  });
  draftHtml += `</tr></tbody></table></div>`;

  const gridDiv = document.createElement('div');
  gridDiv.innerHTML = draftHtml;
  draftEl.appendChild(gridDiv);
}

function onSchDraftChange(sel) {
  const date = sel.getAttribute('data-date');
  const value = sel.value;
  if (!schMyDraft[date]) schMyDraft[date] = {};
  if (value === 'Off') {
    schMyDraft[date].dayType = 'Off';
    schMyDraft[date].shiftTypeId = null;
  } else if (value.startsWith('Work__')) {
    schMyDraft[date].dayType = 'Work';
    schMyDraft[date].shiftTypeId = value.split('__')[1];
  } else {
    schMyDraft[date].dayType = value;
    schMyDraft[date].shiftTypeId = null;
  }
  sel.style.cssText += ';' + schCellStyle(schMyDraft[date].dayType);
}

function submitSchDraft() {
  if (!schMyAgentId || !schCurrentWeek) { showToast('❌','Error','Missing data','danger',4000); return; }
  const btn = document.getElementById('submitDraftBtn');
  
  // ✅ تعديل #5: إضافة loading indicator
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

  const details = {
    week_id: schCurrentWeek.id,
    week_start: schCurrentWeek.week_start,
    week_end: schCurrentWeek.week_end,
    draft: schMyDraft
  };

  gasRun('submitScheduleDraft', schMyAgentId, JSON.stringify(details)).then(res => {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Draft';
    if (res.status === 'success') {
      showToast('✅', 'Draft Submitted!', 'Waiting for approval.', 'success', 5000);
      schMyDraft = {};
      resetSchDraft();
    } else {
      showToast('❌', 'Error', res.msg || 'Failed to submit', 'danger', 4000);
    }
  });
}

function selectWeekChip(weekId, label, el) {
  document.querySelectorAll('.week-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  loadSchTable(weekId);
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
