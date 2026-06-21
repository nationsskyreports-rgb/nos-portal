/* ═══════════════════════════════════════════════════
   app-breaks-final-v4.js — Team, Break Notifications, Break Swap
   (Final Version with Integrated Close Button)
   ═══════════════════════════════════════════════════ */

// Configuration for Queue Coverage
const MIN_REQUIRED_COVERAGE = 1;

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
  const today = getLocalDateStr();
  try {
    const breaksRes = await fetch(
      `${SB_URL_SCH}/rest/v1/breaks?break_date=eq.${today}&select=*,agents(id,formal_name)`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` } }
    );
    const breaksData = await breaksRes.json();
    if (!breaksData || !breaksData.length) return;

    const schedRes  = await fetch(
      `${SB_URL_SCH}/rest/v1/schedule?shift_date=eq.${today}&select=agent_id,day_type`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` } }
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
        shift:  b.shift_time ? b.shift_time.trim() : 'N/A',
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


/* ─── LOAD TODAY BREAKS FROM SB ─── */
async function loadTodayBreaksFromSB(agentId) {
  const today = getLocalDateStr();
  try {
    const res  = await fetch(
      `${SB_URL_SCH}/rest/v1/breaks?agent_id=eq.${agentId}&break_date=eq.${today}&select=*`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` } }
    );
    const data = await res.json();
    if (!data || !data.length) return null;
    const b = data[0];
    return {
      break1:     b.break1     ? b.break1.substring(0,5)    : null,
      lunch:      b.lunch      ? b.lunch.substring(0,5)     : null,
      break2:     b.break2     ? b.break2.substring(0,5)    : null,
      shift_time: b.shift_time ? b.shift_time.trim()        : null,
    };
  } catch(e) { return null; }
}

function applyBreaksToUI(breaks) {
  if (!breaks) return;
  document.getElementById('br-break1').innerText = breaks.break1 || 'N/A';
  document.getElementById('br-lunch').innerText  = breaks.lunch  || 'N/A';
  document.getElementById('br-break2').innerText = breaks.break2 || 'N/A';

  if (breaks.shift_time) {
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
  const today = getLocalDateStr();
  if (sbBreaksChannel) { sbClient.removeChannel(sbBreaksChannel); sbBreaksChannel = null; }
  sbBreaksChannel = sbClient
    .channel('agent-breaks-' + agentId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'breaks', filter: `agent_id=eq.${agentId}` }, async (payload) => {
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
  // Silent team + personal breaks refresh every 5 minutes
  if (window._teamRefreshTimer) clearInterval(window._teamRefreshTimer);
  window._teamRefreshTimer = setInterval(async () => {
    // 1. Refresh team grid
    loadTeamBreaksFromSB();
    // 2. Reload agent's own breaks from DB and update banner + currentBreaks
    if (window.schMyAgentId) {
      const fresh = await loadTodayBreaksFromSB(window.schMyAgentId);
      if (fresh) {
        applyBreaksToUI(fresh);
        currentBreaks = fresh;
      }
    }
  }, 5 * 60 * 1000);
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
    <div id="swap-msg" style="font-size:13px;margin-bottom:12px;text-align:center;min-height:18px;"></div>
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
  
  const close = () => { if(ov.parentElement) document.body.removeChild(ov); if(box.parentElement) document.body.removeChild(box); };
  box.querySelector('#bm-cancel').onclick = close; ov.onclick = close;
  
  box.querySelector('#bm-confirm').onclick = () => {
    const h = box.querySelector('#bh').value, m = box.querySelector('#bm').value;
    const time = (h.length < 2 ? '0'+h : h) + ':' + (m.length < 2 ? '0'+m : m);
    close(); confirmBreakTime(time);
  };
}

function timeStrToMins(t) {
  if (!t) return 0;
  const p = t.substring(0,5).split(':');
  return (+p[0]) * 60 + (+p[1]);
}

function minsToTimeStr(m) {
  return Math.floor(m/60).toString().padStart(2,'0') + ':' + (m%60).toString().padStart(2,'0');
}

/**
 * Finds if a slot is available and ensures coverage
 */
async function findAvailableBreakSlot(requestedTime, breakType, requestingAgentId) {
  const today  = getLocalDateStr();
  const durMap = { 'Break 1': 15, 'Lunch': 30, 'Break 2': 15 };
  const dur    = durMap[breakType];
  const hdrs   = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };

  const [breaksRes, schedRes] = await Promise.all([
    fetch(`${SB_URL_SCH}/rest/v1/breaks?break_date=eq.${today}&select=*`, { headers: hdrs }),
    fetch(`${SB_URL_SCH}/rest/v1/schedule?shift_date=eq.${today}&select=agent_id,day_type`, { headers: hdrs }),
  ]);
  const allBreaks = await breaksRes.json();
  const schedData = await schedRes.json();

  const workingSet = new Set((schedData || []).filter(s => s.day_type === 'Work').map(s => s.agent_id));

  function shiftMinutes(shiftTime) {
    if (!shiftTime) return { s: 600, e: 1320 }; 
    const parts = shiftTime.trim().split(' - ');
    if (parts.length < 2) return { s: 600, e: 1320 };
    let s = timeStrToMins(parts[0].trim());
    let e = timeStrToMins(parts[1].trim());
    if (e <= s) e += 1440;
    return { s, e };
  }

  function isOnShiftDuring(agentRow, slotStart, slotEnd) {
    const sh = shiftMinutes(agentRow.shift_time);
    return sh.s <= slotStart && sh.e >= slotEnd;
  }

  function isOnBreakDuring(agentRow, slotStart, slotEnd) {
    const bDurs = [['break1', 15], ['lunch', 30], ['break2', 15]];
    return bDurs.some(([c, d]) => {
      if (!agentRow[c]) return false;
      const bSt = timeStrToMins(agentRow[c].substring(0, 5));
      const bEnd = bSt + d;
      return !(slotEnd <= bSt || slotStart >= bEnd);
    });
  }

  function countOnQueue(slotStart, slotEnd, isTargetRequested = false) {
    return allBreaks.filter(b => {
      if (!workingSet.has(b.agent_id)) return false;
      if (!isOnShiftDuring(b, slotStart, slotEnd)) return false;
      if (b.agent_id === requestingAgentId) {
          if (isTargetRequested) return false;
          return !isOnBreakDuring(b, slotStart, slotEnd);
      }
      return !isOnBreakDuring(b, slotStart, slotEnd);
    }).length;
  }

  const candidate = timeStrToMins(requestedTime);
  const myRow = allBreaks.find(b => b.agent_id === requestingAgentId);
  const myShift = shiftMinutes(myRow?.shift_time);
  
  function isValidSlot(slotMins) {
    if (slotMins < myShift.s || slotMins > myShift.e - dur) return false;
    for (let m = slotMins; m < slotMins + dur; m++) {
        if (countOnQueue(m, m + 1, true) < MIN_REQUIRED_COVERAGE) return false;
    }
    return true;
  }

  if (isValidSlot(candidate)) return null;

  for (let i = 1; i <= 12; i++) {
    const later = candidate + (i * 15);
    const earlier = candidate - (i * 15);
    if (later <= myShift.e - dur && isValidSlot(later)) return minsToTimeStr(later);
    if (earlier >= myShift.s && isValidSlot(earlier)) return minsToTimeStr(earlier);
  }

  return 'BLOCKED';
}

async function confirmBreakTime(time) {
  if (!schMyAgentId) { showToast('❌','Error','Agent not found!','danger',4000); return; }
  const today  = getLocalDateStr();
  const colMap = { 'Break 1': 'break1', 'Lunch': 'lunch', 'Break 2': 'break2' };
  const col    = colMap[selectedBreakType];
  const msg    = document.getElementById('swap-msg');
  if (!col) { showToast('❌','Error','Select break type first!','danger',4000); return; }

  msg.style.color = 'var(--muted)'; msg.innerText = 'Checking availability...';

  try {
    const suggestion = await findAvailableBreakSlot(time, selectedBreakType, schMyAgentId);

    if (suggestion === 'BLOCKED') {
      msg.style.color = 'var(--danger)';
      msg.innerText   = '❌ مش ممكن — لو اخدت البريك دا الكيو هيبقى فاضي ومفيش بديل قريب';
      return;
    }

    if (suggestion && suggestion !== time) {
      msg.style.color = 'var(--warn)';
      msg.innerText   = `⚠️ ${time} محجوز! أقرب وقت متاح: ${suggestion}`;
      const existingCont = document.getElementById('suggest-container');
      if (existingCont) existingCont.remove();
      
      const container = document.createElement('div');
      container.id = 'suggest-container';
      container.style.cssText = 'position:relative;margin-top:8px;width:100%;display:flex;align-items:center;';
      
      const suggestBtn = document.createElement('button');
      suggestBtn.innerText = `✅ استخدم ${suggestion}`;
      suggestBtn.style.cssText = 'padding:12px;padding-right:40px;background:var(--primary-gradient);color:white;border:none;border-radius:11px;cursor:pointer;font-weight:700;font-family:Plus Jakarta Sans,sans-serif;width:100%;box-shadow:0 4px 15px rgba(0,0,0,.2);text-align:center;';
      suggestBtn.onclick = () => { container.remove(); msg.innerText = ''; confirmBreakTime(suggestion); };
      
      const closeBtn = document.createElement('div');
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = 'position:absolute;right:12px;width:24px;height:24px;background:rgba(255,255,255,0.2);border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;font-weight:bold;transition:background 0.2s;';
      closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255,255,255,0.3)';
      closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
      closeBtn.onclick = (e) => { e.stopPropagation(); container.remove(); msg.innerText = ''; };
      
      container.appendChild(suggestBtn);
      container.appendChild(closeBtn);
      msg.parentElement.appendChild(container);
      return;
    }

    msg.innerText = 'Updating...';
    const res = await fetch(`${SB_URL_SCH}/rest/v1/breaks?agent_id=eq.${schMyAgentId}&break_date=eq.${today}`, {
      method: 'PATCH',
      headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ [col]: time + ':00', updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error('Update failed');

    await fetch(`${SB_URL_SCH}/rest/v1/requests`, {
      method: 'POST',
      headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        agent_id:   schMyAgentId,
        agent_name: document.getElementById('user-name')?.innerText.trim() || 'Agent',
        type:       'Break Change',
        status:     'Approved',
        details: JSON.stringify({ break_type: selectedBreakType, new_time: time, date: today }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    });

    if (currentBreaks) currentBreaks[col] = time;
    const elMap = { break1: 'br-break1', lunch: 'br-lunch', break2: 'br-break2' };
    const el = document.getElementById(elMap[col]);
    if (el) el.innerText = time;

    msg.style.color = 'var(--accent)'; msg.innerText = '✅ Updated!';
    showToast('✅', selectedBreakType + ' Updated!', 'New time: ' + time, 'success', 4000);
    loadTeamBreaksFromSB(); 
    selectedBreakType = '';
    document.querySelectorAll('.break-type-btn').forEach(b => b.classList.remove('selected'));

  } catch(e) {
    console.error(e);
    msg.style.color = 'var(--danger)'; msg.innerText = '❌ Failed. Try again.';
    showToast('❌', 'Update Failed!', 'Please try again.', 'danger', 4000);
  } finally {
    setTimeout(() => { if(msg) msg.innerText = ''; }, 4000);
  }
}
