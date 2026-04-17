/* ═══════════════════════════════════════════════════
   app-requests.js — Requests, Excuse, Time Off, Shift Swap
   ═══════════════════════════════════════════════════ */

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
      if (req.type === 'Time Off')           details = `${d.request_type||''} · ${d.from_date||''} → ${d.to_date||''}`;
      else if (req.type === 'Shift Swap')    details = `${d.date||''} · with ${d.colleague||''}`;
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

function exportRequests(format) {
  showToast('ℹ️', 'Coming Soon', 'Export feature will be available soon.', 'info', 3000);
}

function silentRefreshRequests() { loadMyRequests(); }


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
    const d   = new Date(rawDate);
    const my  = d.toLocaleString('en-US', { month: 'long' }) + ' ' + d.getFullYear();
    const balRes  = await fetch(
      `${SB_URL_SCH}/rest/v1/excuses?agent_id=eq.${schMyAgentId}&status=eq.Approved&month_year=eq.${encodeURIComponent(my)}`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const balData = await balRes.json();
    if (balData.length >= 2) {
      customAlert('Error', 'You have reached the maximum excuses for this month!');
      setButtonLoading(btn, false, '✓ Submit'); btn.disabled = false; return;
    }

    const schedRes  = await fetch(
      `${SB_URL_SCH}/rest/v1/schedule?agent_id=eq.${schMyAgentId}&shift_date=eq.${rawDate}&select=day_type`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const schedData = await schedRes.json();
    if (!schedData.length || schedData[0].day_type !== 'Work') {
      customAlert('Error', 'You are not scheduled to work on this day!');
      setButtonLoading(btn, false, '✓ Submit'); btn.disabled = false; return;
    }

    const res = await fetch(`${SB_URL_SCH}/rest/v1/excuses`, {
      method:  'POST',
      headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        agent_id: schMyAgentId, agent_name: name, excuse_date: rawDate, excuse_type: excuseType,
        status: 'Approved', month_year: my, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
    });

    setButtonLoading(btn, false, '✓ Submit'); btn.disabled = false;

    if (res.ok) {
      msg.style.color = 'var(--accent)'; msg.innerText = '✅ Excuse approved!';
      customAlert('Success', 'Excuse submitted and approved automatically!');
      setTimeout(() => msg.innerText = '', 5000);
    } else {
      msg.style.color = 'var(--danger)'; msg.innerText = '❌ Failed. Try again.';
    }
  } catch(e) {
    setButtonLoading(btn, false, '✓ Submit'); btn.disabled = false;
    msg.style.color = 'var(--danger)'; msg.innerText = '❌ Connection error!';
  }
}

function undoLastExcuse() {
  customConfirm('Confirm', 'Remove your last excuse request?').then(async r => {
    if (!r) return;
    if (!schMyAgentId) { customAlert('Error', 'Agent not found — please refresh!'); return; }

    const msg = document.getElementById('excuse-msg');
    try {
      const res  = await fetch(
        `${SB_URL_SCH}/rest/v1/excuses?agent_id=eq.${schMyAgentId}&order=created_at.desc&limit=1`,
        { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
      );
      const data = await res.json();

      if (!data || !data.length) {
        msg.style.color = 'var(--danger)';
        msg.innerText   = 'No excuses found to undo.';
        return;
      }

      const delRes = await fetch(
        `${SB_URL_SCH}/rest/v1/excuses?id=eq.${data[0].id}`,
        { method: 'DELETE', headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
      );

      if (delRes.ok) {
        msg.style.color = 'var(--warn)';
        msg.innerText   = '✅ Last excuse removed successfully.';
        customAlert('Success', 'Last excuse removed successfully.');
      } else {
        msg.style.color = 'var(--danger)';
        msg.innerText   = '❌ Failed. Try again.';
      }
    } catch(e) {
      msg.style.color = 'var(--danger)';
      msg.innerText   = '❌ Connection error!';
    }
  });
}
function selectTimeOffType(type) {
  selectedTimeOffType = type;
  const form = document.getElementById('time-off-form');
  if (form) form.style.display = 'block';

  ['timeOffFromDate','timeOffToDate','timeOffNotes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const msgEl = document.getElementById('time-off-msg');
  if (msgEl) msgEl.innerText = '';

  document.querySelectorAll('.action-row .action-btn').forEach(b => {
    b.style.opacity = '0.5'; b.style.borderWidth = '1px';
  });
  if (event && event.currentTarget) {
    event.currentTarget.style.opacity = '1'; event.currentTarget.style.borderWidth = '2px';
  }
}

function cancelTimeOffForm() {
  selectedTimeOffType = null;
  document.querySelectorAll('.action-row .action-btn').forEach(b => {
    b.style.opacity = '1'; b.style.borderWidth = '1px';
  });
  ['timeOffFromDate','timeOffToDate','timeOffNotes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
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

  if (!type)         { msg.style.color='var(--danger)'; msg.innerText='Please select a leave type first!'; return; }
  if (!from || !to)  { msg.style.color='var(--danger)'; msg.innerText='Please select both dates!'; return; }
  if (!schMyAgentId) { msg.style.color='var(--danger)'; msg.innerText='Agent not found — please refresh!'; return; }

  setButtonLoading(btn, true, 'Submitting...');

  try {
    const res = await fetch(`${SB_URL_SCH}/rest/v1/requests`, {
      method:  'POST',
      headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        agent_id: schMyAgentId, agent_name: name, type: 'Time Off', status: 'Pending',
        details: JSON.stringify({ request_type: type, from_date: from, to_date: to, notes: notes || '' }),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
    });

    setButtonLoading(btn, false, '✈️ Submit Request');

    if (res.ok) {
      showToast('✅', type+' Request Submitted!', 'Pending review by manager.', 'success', 6000);
      setTimeout(() => { cancelTimeOffForm(); }, 2000);
    } else {
      msg.style.color = 'var(--danger)'; msg.innerText = '❌ Failed. Try again.';
    }
  } catch(e) {
    setButtonLoading(btn, false, '✈️ Submit Request');
    msg.style.color = 'var(--danger)'; msg.innerText = '❌ Connection error!';
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
    opt.textContent = d.day + ' — ' + d.date + ' (' + (shift || 'Off') + ')' + (d.isToday ? '  ◀ Today' : '');
    daySelect.appendChild(opt);
  });

  colleagueSelect.innerHTML = '<option value="">Choose a colleague...</option>';
  const currentName = document.getElementById('user-name').innerText.trim();
  globalTeamData.forEach(s => {
    if (s.name !== currentName) {
      const opt = document.createElement('option');
      opt.value = s.name; opt.textContent = s.name + '  —  ' + (s.shift || 'OFF');
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
  const date            = document.getElementById('swap-day-select').value;
  const shiftEl         = document.getElementById('swap-your-shift');
  const boxEl           = document.getElementById('swap-your-box');
  const warningEl       = document.getElementById('swap-warning');
  const warningText     = document.getElementById('swap-warning-text');
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

  const [y, mo, d2] = [date.split('/')[2], date.split('/')[1], date.split('/')[0]];
  const dateISO = `${y}-${mo.padStart(2,'0')}-${d2.padStart(2,'0')}`;

  fetch(
    `${SB_URL_SCH}/rest/v1/schedule?shift_date=eq.${dateISO}&select=day_type,shift_type_id,agents(formal_name),shift_types(start_time,end_time)`,
    { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
  )
  .then(r => r.json())
  .then(rows => {
    (rows || []).forEach(s => {
      const name = s.agents?.formal_name || '';
      if (!name || name === currentName) return;
      const shift = s.day_type === 'Work' && s.shift_types
        ? s.shift_types.start_time.substring(0,5) + ' - ' + s.shift_types.end_time.substring(0,5)
        : s.day_type || 'OFF';
      const opt       = document.createElement('option');
      opt.value       = name;
      opt.textContent = name + '  —  ' + shift;
      colleagueSelect.appendChild(opt);
    });
  })
  .catch(() => {});
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

  const [y, mo, d2] = [date.split('/')[2], date.split('/')[1], date.split('/')[0]];
  const dateISO     = `${y}-${mo.padStart(2,'0')}-${d2.padStart(2,'0')}`;

  fetch(
    `${SB_URL_SCH}/rest/v1/schedule?shift_date=eq.${dateISO}&select=day_type,shift_types(start_time,end_time),agents(formal_name)`,
    { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
  )
  .then(r => r.json())
  .then(rows => {
    const row = (rows || []).find(s => s.agents?.formal_name === colleague);
    if (row && row.day_type === 'Work' && row.shift_types) {
      const shift = row.shift_types.start_time.substring(0,5) + ' - ' + row.shift_types.end_time.substring(0,5);
      shiftEl.innerText = shift;
      shiftEl.className = 'swap-compare-value';
      boxEl.classList.add('swap-active');
    } else {
      shiftEl.innerText = 'No shift on this day';
      shiftEl.className = 'swap-compare-value swap-empty';
    }
  })
  .catch(() => {
    shiftEl.innerText = 'Error loading';
    shiftEl.className = 'swap-compare-value swap-empty';
  });
}

function submitShiftSwap() {
  const date       = document.getElementById('swap-day-select').value;
  const colleague  = document.getElementById('swap-colleague-select').value;
  const notes      = document.getElementById('swap-notes').value.trim();
  const name       = document.getElementById('user-name').innerText.trim();
  const msg        = document.getElementById('swap-request-msg');
  const btn        = document.getElementById('swap-submit-btn');
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
        headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          agent_id: schMyAgentId, agent_name: name, type: 'Shift Swap', status: 'Pending',
          details: JSON.stringify({ date, agent_shift: yourShift, colleague, their_shift: theirShift, notes: notes || '' }),
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        })
      });

      setButtonLoading(btn, false, '🔄 Submit Shift Swap Request');

      if (res.ok) {
        msg.style.color = '#059669'; msg.innerText = 'Request submitted! Pending admin approval.';
        showToast('⏳','Request Submitted!','Your swap request is now waiting for admin approval.','warn',7000);
        document.getElementById('swap-day-select').value       = '';
        document.getElementById('swap-colleague-select').value = '';
        document.getElementById('swap-notes').value            = '';
        resetSwapDisplay();
        setTimeout(() => msg.innerText = '', 6000);
      } else {
        msg.style.color = 'var(--danger)'; msg.innerText = '❌ Failed. Try again.';
      }
    } catch(e) {
      setButtonLoading(btn, false, '🔄 Submit Shift Swap Request');
      msg.style.color = 'var(--danger)'; msg.innerText = '❌ Connection error!';
    }
  });
}
