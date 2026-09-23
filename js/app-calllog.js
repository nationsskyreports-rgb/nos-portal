/* ═══════════════════════════════════════════════════
   app-calllog.js — Call Log Form, Steps, Customer Search
   ═══════════════════════════════════════════════════ */

/* ─── CHANNEL HELPER ─── */
function getActiveTable() {
  return (window._activeChannel === 'whatsapp') ? 'whatsapp_logs' : 'call_logs';
}

function getChannelBadge(channel) {
  if (channel === 'whatsapp') {
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:#dcfce7;color:#16a34a;
      border:1px solid #86efac;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;">💬 WhatsApp</span>`;
  }
  return `<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#2563eb;
    border:1px solid #93c5fd;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;">📞 Call</span>`;
}

function getStatusBadge(status) {
  if (status === 'open') {
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,0.12);color:#D97706;
      border:1px solid rgba(245,158,11,0.3);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;">🟡 Open</span>`;
  }
  return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(16,185,129,0.12);color:#059669;
    border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;">✅ Closed</span>`;
}

async function toggleLogStatus(id, table, newStatus) {
  try {
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    const body = { status: newStatus, closed_at: newStatus === 'closed' ? new Date().toISOString() : null };
    const res = await fetch(`${SB_URL_SCH}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    showToast(newStatus === 'open' ? '🟡' : '✅', newStatus === 'open' ? 'Reopened' : 'Marked Closed', '', 'success', 2500);
    const agent = document.getElementById('user-name')?.innerText?.trim();
    if (agent && typeof fetchMyCallLog === 'function') fetchMyCallLog(agent);
  } catch(e) {
    showToast('⚠️', 'Update Failed', 'Could not update status. Try again.', 'danger', 3500);
  }
}

/* ─── 16. CALL LOG FORM ─── */
function onAgentSelect() {}

/* ─── STATUS / FOLLOW-UP TOGGLE ─── */
function toggleFollowupSection() {
  const status  = document.getElementById('f-status')?.value;
  const section = document.getElementById('followup-section');
  if (!section) return;
  section.style.display = (status === 'open') ? 'block' : 'none';
  if (status === 'open') {
    const dateEl = document.getElementById('f-followup-date');
    if (dateEl && !dateEl.value) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateEl.value = tomorrow.toLocaleDateString('en-CA');
    }
  }
}

/* ─── DYNAMIC CALL LOG OPTIONS FROM SUPABASE ─── */
let _chooseOptions = [];  // from call_log_choose_options
let _cat1Options   = [];  // from call_log_categories
let _cat2Cache     = {};  // cat1_id -> [items] from call_log_category2
let _cat3Cache     = {};  // cat2_id -> [items] from call_log_category3

async function loadCallLogOptions() {
  const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
  try {
    const [chooseRes, cat1Res] = await Promise.all([
      fetch(`${SB_URL_SCH}/rest/v1/call_log_choose_options?is_active=eq.true&order=sort_order,name`, { headers }).then(r => r.json()),
      fetch(`${SB_URL_SCH}/rest/v1/call_log_categories?is_active=eq.true&order=sort_order,name`, { headers }).then(r => r.json()),
    ]);
    _chooseOptions = chooseRes || [];
    _cat1Options   = cat1Res || [];

    // Populate Choose dropdown
    const projSel = document.getElementById('f-project');
    projSel.innerHTML = '<option value="">Choose...</option>';
    const projects = _chooseOptions.filter(o => o.option_type === 'project');
    const others   = _chooseOptions.filter(o => o.option_type !== 'project');
    if (projects.length) {
      projSel.innerHTML += '<option disabled style="font-weight:800;color:var(--primary);">── Projects ──</option>';
      projects.forEach(o => projSel.innerHTML += `<option>${o.name}</option>`);
    }
    if (others.length) {
      projSel.innerHTML += '<option disabled style="font-weight:800;color:var(--primary);">── General ──</option>';
      others.forEach(o => projSel.innerHTML += `<option>${o.name}</option>`);
    }

    // Populate Category 1 dropdown
    const cat1Sel = document.getElementById('f-category1');
    cat1Sel.innerHTML = '<option value="">Choose...</option>';
    _cat1Options.forEach(c => cat1Sel.innerHTML += `<option value="${c.id}">${c.name}</option>`);

  } catch(e) { console.error('loadCallLogOptions error:', e); }
}

function toggleProjectCategoryFields() {
  const project = document.getElementById('f-project')?.value || '';
  const isProject = _chooseOptions.some(o => o.name === project && o.option_type === 'project');
  const row = document.getElementById('classification-row');
  const cat1Group = document.getElementById('f-category1')?.closest('.form-group');
  const cat2Group = document.getElementById('f-category2')?.closest('.form-group');
  if (cat1Group) cat1Group.style.display = isProject ? '' : 'none';
  if (cat2Group) cat2Group.style.display = isProject ? '' : 'none';
  if (row) row.style.gridTemplateColumns = isProject ? '1fr 1fr 1fr' : '1fr';
  if (!isProject) {
    const cat1 = document.getElementById('f-category1');
    const cat2 = document.getElementById('f-category2');
    if (cat1) cat1.value = '';
    if (cat2) { cat2.innerHTML = '<option value="">Select Category 1 first...</option>'; cat2.disabled = true; }
    resetCategory3Field();
  }
}

async function onCategory1Change() {
  const cat1Sel   = document.getElementById('f-category1');
  const cat2      = document.getElementById('f-category2');
  const cat2Group = cat2.closest('.form-group');
  const cat1Id    = cat1Sel.value;

  resetCategory3Field();

  if (!cat1Id) {
    cat2.innerHTML = '<option value="">Select Category 1 first...</option>';
    cat2.disabled = true;
    if (cat2Group) cat2Group.style.display = '';
    return;
  }

  // Fetch from Supabase (cache for performance)
  if (!_cat2Cache[cat1Id]) {
    try {
      const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
      const res = await fetch(`${SB_URL_SCH}/rest/v1/call_log_category2?category1_id=eq.${cat1Id}&is_active=eq.true&order=sort_order,name`, { headers });
      _cat2Cache[cat1Id] = await res.json() || [];
    } catch(e) { _cat2Cache[cat1Id] = []; }
  }

  const items = _cat2Cache[cat1Id];

  if (!items.length) {
    // This Category 1 has no sub-categories at all — nothing more to pick, hide the field entirely.
    cat2.disabled = true;
    cat2.innerHTML = '<option value="">Choose...</option>';
    cat2.value = '';
    if (cat2Group) cat2Group.style.display = 'none';
    return;
  }

  if (cat2Group) cat2Group.style.display = '';
  cat2.disabled = false;
  // value stays the category name (backward compat with call_reason / Wrong Number / Call Dropped checks) —
  // data-id carries the row id so we can cascade into Category 3.
  cat2.innerHTML = '<option value="">Choose...</option>' +
    items.map(o => `<option value="${o.name}" data-id="${o.id}">${o.name}</option>`).join('');
}

function resetCategory3Field() {
  const row  = document.getElementById('category3-row');
  const cat3 = document.getElementById('f-category3');
  const classRow = document.getElementById('classification-row');
  if (row) row.style.display = 'none';
  if (cat3) { cat3.disabled = true; cat3.innerHTML = '<option value="">Choose...</option>'; cat3.value = ''; }
  if (classRow) classRow.style.gridTemplateColumns = '1fr 1fr 1fr';
}

async function onCategory2Change() {
  const cat2Sel = document.getElementById('f-category2');
  const cat2Id  = cat2Sel.selectedOptions[0]?.dataset.id || '';

  if (!cat2Id) { resetCategory3Field(); return; }

  if (!_cat3Cache[cat2Id]) {
    try {
      const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
      const res = await fetch(`${SB_URL_SCH}/rest/v1/call_log_category3?category2_id=eq.${cat2Id}&is_active=eq.true&order=sort_order,name`, { headers });
      _cat3Cache[cat2Id] = await res.json() || [];
    } catch(e) { _cat3Cache[cat2Id] = []; }
  }

  const items = _cat3Cache[cat2Id];
  const row      = document.getElementById('category3-row');
  const cat3     = document.getElementById('f-category3');
  const classRow = document.getElementById('classification-row');

  if (!items.length) { resetCategory3Field(); return; }

  cat3.disabled = false;
  cat3.innerHTML = '<option value="">Choose...</option>' +
    items.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
  if (row) row.style.display = '';
  if (classRow) classRow.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';
}

function toggleFormSections() { /* no-op — Wrong Number/Call Dropped are Quick Log only */ }

// Keep old function name as alias for backward compat
function filterCategory2ByCat1() { onCategory1Change(); }

window.addEventListener('load', () => {
  loadCallLogOptions().then(() => toggleProjectCategoryFields());
  setTimeout(loadAgentDashboard, 1500);
});

/* ═══ AGENT DASHBOARD — Month-to-Date KPIs ═══ */
async function loadAgentDashboard() {
  const agent = document.getElementById('user-name')?.innerText?.trim();
  if (!agent) return;

  try {
    const today     = getLocalDateStr();
    const monthStart = today.slice(0, 7) + '-01';
    const fromISO   = new Date(monthStart + 'T00:00:00+02:00').toISOString();
    const toISO     = new Date(today + 'T23:59:59+02:00').toISOString();
    const headers   = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
    const q = `agent_name=eq.${encodeURIComponent(agent)}&logged_at=gte.${fromISO}&logged_at=lte.${toISO}`;

    const [calls, wasps, rems] = await Promise.all([
      fetch(`${SB_URL_SCH}/rest/v1/call_logs?${q}&select=business_relativity`, { headers }).then(r => r.json()),
      fetch(`${SB_URL_SCH}/rest/v1/whatsapp_logs?${q}&select=business_relativity`, { headers }).then(r => r.json()),
      fetch(`${SB_URL_SCH}/rest/v1/call_reminders?agent_name=eq.${encodeURIComponent(agent)}&is_done=eq.false&reminder_date=lte.${today}&select=id`, { headers }).then(r => r.json()),
    ]);

    const callCount = (calls||[]).length;
    const waCount   = (wasps||[]).length;
    const total     = callCount + waCount;
    const biz       = [...(calls||[]), ...(wasps||[])].filter(c => c.business_relativity === 'Business Related').length;
    const remCount  = (rems||[]).length;

    const el = id => document.getElementById(id);
    el('dash-total').textContent = total;
    el('dash-calls').textContent = callCount;
    el('dash-wa').textContent    = waCount;
    el('dash-biz').textContent   = biz;
    el('dash-rem').textContent   = remCount;

    if (remCount > 0) el('dash-rem').style.animation = 'pulse 2s infinite';
  } catch(e) { /* silent */ }
}

/* ═══ AUTO-FILL — Customer name from mobile number ═══ */
let _mobileDebounce = null;

function onMobileInput(value) {
  clearTimeout(_mobileDebounce);
  const mobile = value.trim();
  const hint   = document.getElementById('mobile-autofill-hint');
  const hist   = document.getElementById('customer-history');

  if (mobile.length < 8) {
    if (hint) hint.style.display = 'none';
    if (hist) hist.style.display = 'none';
    return;
  }

  _mobileDebounce = setTimeout(() => lookupCustomer(mobile), 400);
}

async function lookupCustomer(mobile) {
  const hint = document.getElementById('mobile-autofill-hint');
  const hist = document.getElementById('customer-history');

  try {
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
    const encoded = encodeURIComponent(mobile);

    const [calls, wasps] = await Promise.all([
      fetch(`${SB_URL_SCH}/rest/v1/call_logs?customer_mobile=eq.${encoded}&select=id,customer_name,customer_mobile,project,category_1,call_reason,logged_at,agent_name&order=logged_at.desc&limit=10`, { headers }).then(r => r.json()),
      fetch(`${SB_URL_SCH}/rest/v1/whatsapp_logs?customer_mobile=eq.${encoded}&select=id,customer_name,customer_mobile,project,category_1,call_reason,logged_at,agent_name&order=logged_at.desc&limit=10`, { headers }).then(r => r.json()),
    ]);

    const all = [...(calls||[]), ...(wasps||[])].sort((a,b) => new Date(b.logged_at) - new Date(a.logged_at));

    if (!all.length) {
      if (hint) { hint.textContent = '🆕 New customer'; hint.style.display = 'block'; hint.style.color = '#3B82F6'; }
      if (hist) hist.style.display = 'none';
      return;
    }

    // Auto-fill customer name
    const lastName = all[0].customer_name;
    const cname = document.getElementById('f-cname');
    if (cname && !cname.value.trim() && lastName) {
      cname.value = lastName;
      if (hint) { hint.textContent = `✅ Auto-filled: ${lastName} (${all.length} previous call${all.length>1?'s':''})`; hint.style.display = 'block'; hint.style.color = '#10B981'; }
    } else {
      if (hint) { hint.textContent = `📋 ${all.length} previous call${all.length>1?'s':''} found`; hint.style.display = 'block'; hint.style.color = 'var(--primary)'; }
    }

    // Show customer history
    if (hist) {
      const list = document.getElementById('history-list');
      const count = document.getElementById('history-count');
      count.textContent = all.length + ' record(s)';

      list.innerHTML = all.slice(0, 5).map(c => {
        const date = c.logged_at ? new Date(c.logged_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '';
        const time = c.logged_at ? new Date(c.logged_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) : '';
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;">
            <div style="min-width:70px;color:var(--muted);font-weight:700;">${date} ${time}</div>
            <div style="flex:1;">
              <span style="font-weight:700;color:var(--accent,var(--primary));">${c.project || '—'}</span>
              ${c.category_1 ? '<span style="color:var(--muted);"> → </span><span style="color:var(--text);">' + c.category_1 + '</span>' : ''}
              ${c.call_reason ? '<span style="color:var(--muted);"> → </span><span style="color:var(--text);">' + c.call_reason + '</span>' : ''}
            </div>
            <div style="color:var(--muted);font-size:11px;">${c.agent_name || ''}</div>
          </div>`;
      }).join('');

      hist.style.display = '';
    }
  } catch(e) { /* silent */ }
}

/* ─── CREATE FOLLOW-UP LINKED TO A LOG ─── */
async function createFollowupForLog(logId, sourceTable, customerName, customerMobile, date, time, note) {
  if (!logId || !date) return;
  const agent = document.getElementById('user-name')?.innerText?.trim() || '';
  try {
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    await fetch(`${SB_URL_SCH}/rest/v1/call_reminders`, {
      method: 'POST', headers,
      body: JSON.stringify({
        agent_id: window.schMyAgentId || null,
        agent_name: agent,
        customer_name: customerName || null,
        customer_mobile: customerMobile || null,
        reminder_date: date,
        reminder_time: time || null,
        note: note || '',
        call_log_id: logId,
        source_table: sourceTable,
        is_done: false,
      })
    });
    if (typeof loadMyReminders === 'function') loadMyReminders();
  } catch(e) { console.warn('createFollowupForLog failed:', e); }
}

/* ─── REMINDER SYSTEM ─── */
function _remEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function openReminderModal(customerName, customerMobile, callLogId) {
  const existing = document.getElementById('reminder-modal');
  if (existing) existing.remove();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defDate = tomorrow.toLocaleDateString('en-CA');

  const modal = document.createElement('div');
  modal.id = 'reminder-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:460px;padding:24px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:800;color:var(--text);">⏰ Set Reminder</div>
        <button onclick="document.getElementById('reminder-modal').remove()"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;width:34px;height:34px;font-size:16px;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div style="background:var(--surface2);border-radius:12px;padding:12px;margin-bottom:14px;font-size:13px;">
        <div style="font-weight:700;color:var(--text);">👤 ${_remEsc(customerName) || '—'}</div>
        <div style="color:var(--muted);font-family:monospace;">${_remEsc(customerMobile) || '—'}</div>
      </div>

      <!-- Previous follow-ups — populated async, hidden if none/error -->
      <div id="rem-history" style="display:none;margin-bottom:14px;"></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:6px;">Date</label>
          <input type="date" id="rem-date" class="form-input" value="${defDate}">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:6px;">Time (optional)</label>
          <input type="time" id="rem-time" class="form-input">
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;font-weight:700;color:var(--muted);display:block;margin-bottom:6px;">Note</label>
        <textarea id="rem-note" class="form-input" rows="3" placeholder="Follow up about..."></textarea>
      </div>
      <button onclick="saveReminder('${(customerName||'').replace(/'/g,"\\'")}','${(customerMobile||'').replace(/'/g,"\\'")}','${callLogId||''}')"
        style="width:100%;padding:14px;background:var(--primary-gradient);color:white;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;">
        ⏰ Save Reminder
      </button>
    </div>`;
  document.body.appendChild(modal);

  // Fire-and-forget: fetch previous follow-ups for this customer.
  // If it fails (e.g. RLS blocks it) the modal still works for creating a new one.
  if (customerMobile) loadReminderHistory(customerMobile);
}

async function loadReminderHistory(customerMobile) {
  const wrap = document.getElementById('rem-history');
  if (!wrap) return;
  const currentAgent = document.getElementById('user-name')?.innerText?.trim() || '';

  try {
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
    const encoded = encodeURIComponent(customerMobile);
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/call_reminders?customer_mobile=eq.${encoded}&order=reminder_date.desc,reminder_time.desc&limit=10`,
      { headers }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const rows = data.map(r => {
      const isDone  = r.is_done === true;
      const isPast  = !isDone && r.reminder_date && r.reminder_date < today;
      const isToday = !isDone && r.reminder_date === today;
      const icon    = isDone ? '✅' : isPast ? '🔴' : isToday ? '🟡' : '⏳';
      const color   = isDone ? '#10B981' : isPast ? '#EF4444' : isToday ? '#F59E0B' : 'var(--muted)';
      const label   = isDone ? 'Done' : isPast ? 'Overdue' : isToday ? 'Today' : 'Upcoming';
      const dateStr = r.reminder_date
        ? new Date(r.reminder_date + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
        : '—';
      const timeStr = r.reminder_time ? r.reminder_time.substring(0, 5) : '';
      const who     = (r.agent_name && r.agent_name === currentAgent) ? 'You' : (r.agent_name || '?');
      const note    = (r.note || '').trim() || '(no note)';

      return `
        <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:12px;">
          <div style="min-width:18px;padding-top:1px;font-size:14px;">${icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;">
              <span style="font-weight:700;color:var(--text);">${_remEsc(dateStr)}${timeStr ? ' · ' + _remEsc(timeStr) : ''}</span>
              <span style="font-size:10px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:0.6px;">${label}</span>
              <span style="font-size:10px;color:var(--muted);">by ${_remEsc(who)}</span>
            </div>
            <div style="color:var(--muted);margin-top:3px;line-height:1.45;word-wrap:break-word;">${_remEsc(note)}</div>
          </div>
        </div>`;
    }).join('');

    wrap.innerHTML = `
      <div style="background:var(--surface2);border-radius:12px;padding:12px 14px;border:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.7px;">
            📋 Previous Follow-ups
          </div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;">${data.length} record${data.length > 1 ? 's' : ''}</div>
        </div>
        <div style="max-height:200px;overflow-y:auto;margin:0 -4px;padding:0 4px;">
          ${rows}
        </div>
      </div>`;
    wrap.style.display = 'block';
    // Remove trailing border on last row
    const rowsWrap = wrap.querySelector('div[style*="max-height:200px"]');
    if (rowsWrap && rowsWrap.lastElementChild) rowsWrap.lastElementChild.style.borderBottom = 'none';
  } catch (e) { /* silent — modal still works */ }
}

async function saveReminder(customerName, customerMobile, callLogId) {
  const date = document.getElementById('rem-date').value;
  const time = document.getElementById('rem-time').value || null;
  const note = document.getElementById('rem-note').value.trim();
  const agent = document.getElementById('user-name')?.innerText?.trim() || '';

  if (!date) { showToast('⚠️', 'Error', 'Please select a date', 'warn', 3000); return; }

  try {
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    const res = await fetch(`${SB_URL_SCH}/rest/v1/call_reminders`, {
      method: 'POST', headers,
      body: JSON.stringify({
        agent_id: window.schMyAgentId || null,
        agent_name: agent,
        customer_name: customerName,
        customer_mobile: customerMobile,
        reminder_date: date,
        reminder_time: time,
        note: note,
        call_log_id: callLogId || null,
        is_done: false,
      })
    });
    if (!res.ok) throw new Error(await res.text());

    document.getElementById('reminder-modal').remove();
    showToast('✅', 'Reminder Set!', `${customerName} — ${date}`, 'success', 4000);
    if (typeof loadMyReminders === 'function') loadMyReminders();
  } catch(e) {
    showToast('❌', 'Error', e.message, 'error', 5000);
  }
}

/* ─── MY REMINDERS — Upcoming / Done / All ─── */
let _reminderFilter = 'upcoming';

function _remTabBtn(mode, label) {
  const active = _reminderFilter === mode;
  return `<button data-rem-tab="${mode}" onclick="setReminderFilter('${mode}')"
    style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 10px;border-radius:8px;border:none;background:${active ? 'var(--surface)' : 'transparent'};color:${active ? 'var(--text)' : 'var(--muted)'};font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.2s;${active ? 'box-shadow:0 2px 8px rgba(0,0,0,0.15);' : ''}">
    <span>${label}</span>
    <span class="rem-count" data-rem-count="${mode}" style="opacity:0.75;font-size:11px;background:var(--surface2);padding:1px 7px;border-radius:8px;min-width:20px;text-align:center;">·</span>
  </button>`;
}

function setReminderFilter(mode) {
  _reminderFilter = mode;
  // Update tab visual state without full re-render
  document.querySelectorAll('[data-rem-tab]').forEach(btn => {
    const active = btn.dataset.remTab === mode;
    btn.style.background = active ? 'var(--surface)' : 'transparent';
    btn.style.color      = active ? 'var(--text)'    : 'var(--muted)';
    btn.style.boxShadow  = active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none';
  });
  loadMyReminders();
}

function _setRemCount(mode, n) {
  const el = document.querySelector(`[data-rem-count="${mode}"]`);
  if (el) el.innerText = n;
}

async function loadMyReminders() {
  const agent = document.getElementById('user-name')?.innerText?.trim();
  const wrap  = document.getElementById('reminders-list');
  if (!wrap || !agent) return;

  try {
    const today = getLocalDateStr();
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
    // Fetch ALL reminders for this agent so we can show counters and switch filter client-side
    const res = await fetch(`${SB_URL_SCH}/rest/v1/call_reminders?agent_name=eq.${encodeURIComponent(agent)}&order=reminder_date.desc,reminder_time.desc&limit=300`, { headers });
    const all = await res.json() || [];

    const upcoming = all.filter(r => !r.is_done)
                        .sort((a, b) => (a.reminder_date + (a.reminder_time || '')).localeCompare(b.reminder_date + (b.reminder_time || '')));
    const done     = all.filter(r => r.is_done);

    _setRemCount('upcoming', upcoming.length);
    _setRemCount('done',     done.length);
    _setRemCount('all',      all.length);

    const list = _reminderFilter === 'upcoming' ? upcoming
               : _reminderFilter === 'done'     ? done
               : all;

    if (!list.length) {
      const emptyMsg = _reminderFilter === 'upcoming' ? 'No upcoming reminders ✨'
                     : _reminderFilter === 'done'     ? 'No completed follow-ups yet'
                     : 'No reminders yet';
      wrap.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">${emptyMsg}</div>`;
      return;
    }

    wrap.innerHTML = list.map(r => _renderReminderRow(r, today)).join('');
  } catch(e) {
    wrap.innerHTML = '<div style="color:var(--danger);font-size:12px;padding:10px;">Failed to load reminders</div>';
  }
}

function _renderReminderRow(r, today) {
  const isDone  = r.is_done === true;
  const isToday = !isDone && r.reminder_date === today;
  const isPast  = !isDone && r.reminder_date && r.reminder_date < today;

  const border  = isDone ? 'rgba(16,185,129,.35)'
                : isPast  ? 'var(--danger)'
                : isToday ? 'var(--primary)'
                : 'var(--border)';
  const bgTint  = isDone ? 'background-image:linear-gradient(90deg, rgba(16,185,129,.06), transparent);' : '';

  const dateStr = r.reminder_date
    ? new Date(r.reminder_date + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
    : '—';

  const badge = isDone  ? `<span style="font-weight:800;color:#10B981;">✅ DONE</span> · <span>${_remEsc(dateStr)}</span>`
              : isPast  ? `<span style="font-weight:800;color:var(--danger);">🔴 OVERDUE</span> · <span>${_remEsc(dateStr)}</span>`
              : isToday ? `<span style="font-weight:800;color:var(--primary);">🟡 TODAY</span>`
              :           `<span style="font-weight:700;">⏳ ${_remEsc(dateStr)}</span>`;

  const actionBtn = isDone ? '' : `<button onclick="markReminderDone('${r.id}')" title="Mark done"
      style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;color:#10B981;cursor:pointer;flex-shrink:0;">
      ✓ Done
    </button>`;

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid ${border};border-radius:12px;margin-bottom:8px;background:var(--surface);${bgTint}">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span style="font-weight:800;font-size:13px;color:var(--text);${isDone ? 'opacity:0.85;' : ''}">${_remEsc(r.customer_name) || '—'}</span>
          <span style="font-size:11px;color:var(--muted);font-family:monospace;">${_remEsc(r.customer_mobile) || ''}</span>
        </div>
        <div style="font-size:11px;color:var(--muted);word-wrap:break-word;">
          ${badge}
          ${r.reminder_time ? ' · ' + _remEsc(r.reminder_time.substring(0,5)) : ''}
          ${r.note ? ' · ' + _remEsc(r.note) : ''}
        </div>
      </div>
      ${actionBtn}
    </div>`;
}

async function markReminderDone(id) {
  try {
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json' };
    await fetch(`${SB_URL_SCH}/rest/v1/call_reminders?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify({ is_done: true }) });
    showToast('✅', 'Done!', 'Reminder marked as complete', 'success', 3000);
    loadMyReminders();
  } catch(e) { showToast('❌', 'Error', e.message, 'error', 4000); }
}

/* ─── QUICK LOG ─── */
function quickLogCall(reason) {
  const agent = document.getElementById('f-agent').value;
  if (!agent) { customAlert('Error', 'Please select Agent Name first!'); return; }
  showQuickLogNoteModal(reason, agent);
}

function showQuickLogNoteModal(reason, agent) {
  const existing = document.getElementById('quick-log-note-modal');
  if (existing) existing.remove();
  const existingOv = document.getElementById('quick-log-note-overlay');
  if (existingOv) existingOv.remove();

  const ov = document.createElement('div');
  ov.id = 'quick-log-note-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;backdrop-filter:blur(4px);';

  const box = document.createElement('div');
  box.id = 'quick-log-note-modal';
  box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:24px;min-width:300px;max-width:420px;width:90%;z-index:9999;box-shadow:0 20px 60px rgba(0,0,0,.4);';
  box.innerHTML = `
    <div style="font-family:Syne,sans-serif;font-size:17px;font-weight:800;color:var(--text);margin-bottom:4px;">${reason}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px;">Please add a short note before logging this.</div>
    <textarea id="ql-note" class="form-input" rows="3" placeholder="Note..." style="width:100%;resize:vertical;margin-bottom:8px;"></textarea>
    <div id="ql-note-err" style="display:none;color:var(--danger);font-size:12px;margin-bottom:10px;">Please write a note before logging.</div>
    <div style="display:flex;gap:10px;">
      <button id="ql-cancel" style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:11px;color:var(--muted);cursor:pointer;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;">Cancel</button>
      <button id="ql-confirm" style="flex:1;padding:12px;background:var(--primary-gradient);color:#fff;border:none;border-radius:11px;cursor:pointer;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;">Log ${reason}</button>
    </div>`;
  document.body.appendChild(ov);
  document.body.appendChild(box);

  const close = () => {
    if (ov.parentElement) document.body.removeChild(ov);
    if (box.parentElement) document.body.removeChild(box);
  };
  document.getElementById('ql-cancel').onclick = close;
  ov.onclick = close;

  document.getElementById('ql-confirm').onclick = () => {
    const note = document.getElementById('ql-note').value.trim();
    if (!note) { document.getElementById('ql-note-err').style.display = 'block'; return; }
    close();
    submitQuickLog(reason, agent, note);
  };

  setTimeout(() => document.getElementById('ql-note')?.focus(), 100);
}

function submitQuickLog(reason, agent, note) {
  const table = getActiveTable();
  const label = (window._activeChannel === 'whatsapp') ? 'WhatsApp' : 'Call';
  showToast('⏳', 'Logging...', reason + ' — Please wait...', 'info', 4000);

  const submissionId = ++_activeSubmission;

  fetch(`${SB_URL_SCH}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY_SCH,
      'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      agent_name: agent, call_direction: 'inbound',
      customer_name: '', customer_mobile: '',
      project: '', category_1: '', category_3: '',
      call_reason: reason, communication_channel: '', media_source: '',
      business_relativity: '', sales_call_requested: '',
      budget: '', unit_type: '', unit_code: '', extra_notes: note,
      status: 'closed', closed_at: new Date().toISOString(),
      logged_at: new Date().toISOString(),
    })
  })
  .then(() => {
    if (submissionId !== _activeSubmission) return;
    const bar = document.getElementById('call-summary-bar');
    document.getElementById('cs-name').innerText   = '—';
    document.getElementById('cs-mobile').innerText = '—';
    document.getElementById('cs-reason').innerText = reason;
    if (bar) { bar.style.display = 'flex'; setTimeout(() => bar.style.display = 'none', 30000); }
    resetCallForm();
    showToast('✅', `${label} Logged!`, reason, 'success', 3000);
  })
  .catch(() => {
    if (submissionId !== _activeSubmission) return;
    if (typeof addOfflineCall === 'function') {
      addOfflineCall({ agent, reason, project:'', category1:'', category3:'', cname:'', mobile:'', bizrel:'', salescall:'',
        channel:'', media:'', budget:'', unit:'', unitCode:'', extra: note, status:'closed', _channel: window._activeChannel || 'call' });
      if (window.showToast) showToast('📥','Saved Offline!', reason + ' — Will sync when back online.', 'warn', 6000);
      if (typeof setStatusBar === 'function') setStatusBar('offline', `You're offline — ${getOfflineCalls().length} call(s) pending sync`);
    } else {
      showFormErr('Connection error. Please try again.');
    }
  });
}

/* ─── SUBMIT FORM ─── */
function submitCallLogForm() {
  const agent   = document.getElementById('f-agent').value;
  const project = document.getElementById('f-project').value;
  const cat1    = document.getElementById('f-category1').value;
  let   reason  = document.getElementById('f-category2').value;
  const cat3Row = document.getElementById('category3-row');
  const cat3    = (cat3Row && cat3Row.style.display !== 'none') ? document.getElementById('f-category3').value : '';
  const mobile  = document.getElementById('f-mobile').value.trim();
  const cname   = document.getElementById('f-cname').value.trim();
  const isQ     = (reason === 'Wrong Number' || reason === 'Call Dropped');
  const isProject = _chooseOptions.some(o => o.name === project && o.option_type === 'project');
  const cat2Group   = document.getElementById('f-category2')?.closest('.form-group');
  const cat2Visible = !!(cat2Group && cat2Group.style.display !== 'none');

  const status   = document.getElementById('f-status')?.value || 'closed';
  const fuDate   = document.getElementById('f-followup-date')?.value || '';
  const fuTime   = document.getElementById('f-followup-time')?.value || '';
  const fuNote   = document.getElementById('f-followup-note')?.value.trim() || '';

  if (!agent)                              { showFormErr('Please select Agent Name!'); return; }
  if (isProject && cat2Visible && !reason) { showFormErr('Please select Category 2!'); return; }
  if (!isQ && !project)                    { showFormErr('Please select Choose!'); return; }
  if (isProject && !cat1)                  { showFormErr('Please select Category 1!'); return; }
  if (isProject && cat3Row && cat3Row.style.display !== 'none' && !cat3) { showFormErr('Please select Category 3!'); return; }

  // Resolve Category 1 name from the ID for storage
  const cat1Name = isProject ? (_cat1Options.find(c => c.id === cat1)?.name || cat1) : '';
  // Category 1 has no sub-categories — its own name is the most specific choice we have
  if (isProject && !cat2Visible) reason = cat1Name;
  if (!isQ && !cname)                      { showFormErr('Please enter Customer Name!'); return; }
  if (!isQ && !mobile)                     { showFormErr('Please enter Customer Mobile!'); return; }
  if (!isQ && !document.getElementById('f-salescall').value) { showFormErr('Select Sales Call Requested!'); return; }
  if (!isQ && !document.getElementById('f-channel').value)   { showFormErr('Select Communication Channel!'); return; }
  if (!isQ && !document.getElementById('f-media').value)     { showFormErr('Select Media Source!'); return; }
  if (status === 'open' && !fuDate)        { showFormErr('Please select a Follow-up Date!'); return; }

  // Require a comment before submitting (except Quick Log)
  const commentVal = document.getElementById('f-extra').value.trim();
  if (!isQ && !commentVal)                 { showFormErr('Please add a comment before submitting!'); document.getElementById('f-extra')?.focus(); return; }

  const table = getActiveTable();
  const label = (window._activeChannel === 'whatsapp') ? 'WhatsApp' : 'Call';
  const submissionId = ++_activeSubmission;
  const btn = document.getElementById('formSubmitBtn');
  if (btn) setButtonLoading(btn, true, 'Submitting...');

  const slowTimer = setTimeout(() => {
    if (submissionId !== _activeSubmission) return;
    const liveBtnSlow = document.getElementById('formSubmitBtn');
    if (liveBtnSlow && liveBtnSlow.disabled) setButtonLoading(liveBtnSlow, true, 'Almost there...');
  }, 5000);

  document.getElementById('form-error').style.display = 'none';

  const data = {
    agent, reason,
    project:   isQ ? '' : project,
    category1: isQ || !isProject ? '' : cat1Name,
    category3: isQ || !isProject ? '' : cat3,
    direction: document.getElementById('f-direction').value || 'inbound',
    cname:     isQ ? '' : cname,
    mobile:    isQ ? '' : mobile,
    bizrel:    '',
    salescall: isQ ? '' : (document.getElementById('f-salescall').value || ''),
    channel:   isQ ? '' : (document.getElementById('f-channel').value   || ''),
    media:     isQ ? '' : (document.getElementById('f-media').value     || ''),
    budget:    '',
    unit:      '',
    unitCode:  isQ ? '' : (document.getElementById('f-unit-code').value.trim() || ''),
    status,
    extra: document.getElementById('f-extra').value.trim()
  };

  fetch(`${SB_URL_SCH}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY_SCH,
      'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`,
      'Content-Type': 'application/json',
      'Prefer': status === 'open' ? 'return=representation' : 'return=minimal'
    },
    body: JSON.stringify({
      agent_name:            data.agent,
      call_direction:        data.direction,
      customer_name:         data.cname,
      customer_mobile:       data.mobile,
      project:               data.project,
      category_1:            data.category1,
      category_3:            data.category3,
      call_reason:           data.reason,
      communication_channel: data.channel,
      media_source:          data.media,
      business_relativity:   data.bizrel,
      sales_call_requested:  data.salescall,
      budget:                data.budget,
      unit_type:             data.unit,
      unit_code:             data.unitCode,
      extra_notes:           data.extra,
      status:                data.status,
      closed_at:             data.status === 'closed' ? new Date().toISOString() : null,
      logged_at:             new Date().toISOString(),
    })
  })
  .then(async res => {
    clearTimeout(slowTimer);
    if (submissionId !== _activeSubmission) return;
    const liveBtn = document.getElementById('formSubmitBtn');
    if (liveBtn) setButtonLoading(liveBtn, false, '📤 Submit to Database');
    if (res.ok) {
      if (status === 'open') {
        try {
          const rows = await res.json();
          const newId = rows && rows[0] && rows[0].id;
          if (newId) createFollowupForLog(newId, table, cname, mobile, fuDate, fuTime, fuNote);
        } catch(e) { /* silent — call still logged */ }
      }
      const bar = document.getElementById('call-summary-bar');
      document.getElementById('cs-name').innerText   = cname  || '—';
      document.getElementById('cs-mobile').innerText = mobile || '—';
      document.getElementById('cs-reason').innerText = reason || '—';
      if (bar) { bar.style.display = 'flex'; setTimeout(() => bar.style.display = 'none', 30000); }
      resetCallForm();
      showToast('✅', `${label} Logged!`, cname ? cname + ' — ' + mobile : reason, 'success', 5000);
    } else {
      showFormErr('Something went wrong. Please try again.');
    }
  })
  .catch(() => {
    clearTimeout(slowTimer);
    if (submissionId !== _activeSubmission) return;
    const liveBtnErr = document.getElementById('formSubmitBtn');
    if (liveBtnErr) setButtonLoading(liveBtnErr, false, '📤 Submit to Database');
    if (typeof addOfflineCall === 'function') {
      addOfflineCall({ ...data, fuDate, fuTime, fuNote, _channel: window._activeChannel || 'call' });
      if (window.showResultPopup) {
        showResultPopup('success','Saved Offline 📥',
          "No internet. Call saved and will sync automatically when you're back online.",
          'Got it!', () => { if (typeof resetCallForm==='function') resetCallForm(); });
      } else if (window.showToast) {
        showToast('📥','Saved Offline!','Will sync when connection is restored.','warn',6000);
        if (typeof resetCallForm==='function') resetCallForm();
      }
      if (typeof setStatusBar==='function') setStatusBar('offline', `You're offline — ${getOfflineCalls().length} call(s) pending sync`);
    } else {
      showFormErr('Connection error. Please try again.');
    }
  });
}

function resetCallForm() {
  ['f-project','f-category1','f-category2','f-mobile','f-extra',
   'f-salescall','f-channel','f-media','f-unit-code',
   'f-followup-date','f-followup-time','f-followup-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-cname').value = '';
  const dirEl = document.getElementById('f-direction');
  if (dirEl) dirEl.value = 'inbound';
  const statusEl = document.getElementById('f-status');
  if (statusEl) statusEl.value = 'closed';
  toggleFollowupSection();
  // أعد إظهار التفاصيل، وأخفِ التصنيفات حتى يتم اختيار مشروع فعلي
  const fullSection = document.getElementById('full-details-section');
  if (fullSection) fullSection.style.display = '';
  const category2 = document.getElementById('f-category2');
  if (category2) {
    category2.disabled = true;
    category2.innerHTML = '<option value="">Select sub-category...</option>';
  }
  resetCategory3Field();
  toggleProjectCategoryFields();
  document.getElementById('form-success').style.display = 'none';
  document.getElementById('form-error').style.display   = 'none';
  // Clear autofill and customer history
  const hint = document.getElementById('mobile-autofill-hint');
  const hist = document.getElementById('customer-history');
  if (hint) hint.style.display = 'none';
  if (hist) hist.style.display = 'none';
  // Refresh dashboard after submit
  setTimeout(loadAgentDashboard, 500);
}

/* ─── goStep — kept as no-op for backward compat ─── */
let _currentStep = 1;
function goStep(n) { /* no-op — single page form */ }

function showFormErr(msg) {
  showResultPopup('error', 'Check Your Data', msg, 'Got it');
}

/* ─── 17. CUSTOMER SEARCH — يبحث في الجدولين ─── */
function searchCustomer() {
  const query      = document.getElementById('search-query').value.trim();
  const resultsDiv = document.getElementById('search-results');
  if (!query) { resultsDiv.innerHTML = '<div class="empty-state">Please enter a name or mobile number.</div>'; return; }
  resultsDiv.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Searching...</div>';

  const searchBtn = document.querySelector('[onclick="searchCustomer()"]');
  if (searchBtn) setButtonLoading(searchBtn, true, 'Searching...');

  const normalizedQuery = query.replace(/^0+/, '');
  const qFilter = `or=(customer_name.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(normalizedQuery)}%25)&order=logged_at.desc&limit=20`;
  const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };

  Promise.all([
    fetch(`${SB_URL_SCH}/rest/v1/call_logs?${qFilter}`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'call'}))),
    fetch(`${SB_URL_SCH}/rest/v1/whatsapp_logs?${qFilter}`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'whatsapp'}))),
  ])
  .then(([calls, wasps]) => {
    if (searchBtn) setButtonLoading(searchBtn, false, '🔍 Search');
    const results = [...calls, ...wasps].sort((a,b) => new Date(b.logged_at) - new Date(a.logged_at)).slice(0, 20);
    if (!results.length) {
      resultsDiv.innerHTML = `<div class="empty-state">No results found for "${query}"</div>`;
      return;
    }
    let html = `<div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:10px;">${results.length} result(s) found</div>`;
    results.forEach(r => {
      const reasonColor = (r.call_reason === 'Wrong Number' || r.call_reason === 'Call Dropped') ? 'var(--muted)' : 'var(--primary)';
      html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          ${getChannelBadge(r._source)}
          <div style="font-size:11px;color:var(--muted);">${r.logged_at ? new Date(r.logged_at).toLocaleDateString('en-GB') : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="width:36px;height:36px;background:var(--primary-gradient);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:13px;">${r.customer_name?r.customer_name[0].toUpperCase():'?'}</div>
          <div>
            <div style="font-weight:700;font-size:14px;color:var(--text);">${r.customer_name||'N/A'}</div>
            <div style="font-size:12px;color:var(--muted);">${r.customer_mobile||'-'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
          <div><span style="color:var(--muted);">Project: </span><span style="font-weight:600;color:var(--accent,var(--primary));">${r.project||'-'}</span></div>
          <div><span style="color:var(--muted);">Category: </span><span style="font-weight:600;color:${reasonColor};">${r.category_1 ? r.category_1 + ' → ' : ''}${r.call_reason||'-'}</span></div>
          <div><span style="color:var(--muted);">Agent: </span><span style="font-weight:600;color:var(--text);">${r.agent_name||'-'}</span></div>
          <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:600;color:var(--text);">${r.communication_channel||'-'}</span></div>
          <div><span style="color:var(--muted);">Media: </span><span style="font-weight:600;color:var(--text);">${r.media_source||'-'}</span></div>
          <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:600;color:var(--text);">${r.budget||'-'}</span></div>
        </div>
        ${r.extra_notes&&r.extra_notes.trim()&&r.extra_notes!=='-'?`<div style="margin-top:10px;padding:10px;background:var(--surface);border-radius:10px;border:1px solid var(--border);font-size:12px;color:var(--muted);"><i class="fas fa-sticky-note" style="margin-right:6px;color:var(--warn);"></i>${r.extra_notes}</div>`:''}
      </div>`;
    });
    resultsDiv.innerHTML = html;
  })
  .catch(() => {
    if (searchBtn) setButtonLoading(searchBtn, false, '🔍 Search');
    resultsDiv.innerHTML = '<div class="empty-state">Connection error. Try again.</div>';
  });
}

function clearSearch() {
  document.getElementById('search-query').value = '';
  document.getElementById('search-results').innerHTML = '';
}

/* ─── LAST TWO CALLS — من الجدولين ─── */
async function loadLastTwoCalls(agentName) {
  try {
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
    const [calls, wasps] = await Promise.all([
      fetch(`${SB_URL_SCH}/rest/v1/call_logs?agent_name=eq.${encodeURIComponent(agentName)}&order=logged_at.desc&limit=5`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'call'}))),
      fetch(`${SB_URL_SCH}/rest/v1/whatsapp_logs?agent_name=eq.${encodeURIComponent(agentName)}&order=logged_at.desc&limit=5`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'whatsapp'}))),
    ]);

    const data = [...calls, ...wasps].sort((a,b) => new Date(b.logged_at) - new Date(a.logged_at)).slice(0, 2);
    const el = document.getElementById('last-two-calls');
    if (!el) return;
    if (!data.length) { el.innerHTML = ''; return; }

    el.innerHTML = data.map(c => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          ${getChannelBadge(c._source)}
          <div style="font-size:10px;color:var(--muted);">${c.logged_at ? new Date(c.logged_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div style="width:34px;height:34px;border-radius:10px;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">${c._source==='whatsapp'?'💬':'📞'}</div>
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--text);">${c.customer_name || '—'}</div>
            <div style="font-size:11px;color:var(--muted);font-family:monospace;">${c.customer_mobile || '—'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;">
          <div><span style="color:var(--muted);">Project: </span><span style="font-weight:700;color:var(--accent,var(--primary));">${c.project||'—'}</span></div>
          <div><span style="color:var(--muted);">Category: </span><span style="font-weight:700;color:var(--primary);">${c.category_1 ? c.category_1 + ' → ' : ''}${c.call_reason||'—'}</span></div>
          <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:700;color:var(--text);">${c.communication_channel||'—'}</span></div>
          <div><span style="color:var(--muted);">Media: </span><span style="font-weight:700;color:var(--text);">${c.media_source||'—'}</span></div>
          <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:700;color:var(--text);">${c.budget||'—'}</span></div>
          <div><span style="color:var(--muted);">Sales: </span><span style="font-weight:700;color:var(--text);">${c.sales_call_requested||'—'}</span></div>
        </div>
        ${c.extra_notes&&c.extra_notes.trim()&&c.extra_notes!=='-'?`<div style="margin-top:8px;padding:8px;background:var(--surface);border-radius:8px;border:1px solid var(--border);font-size:11px;color:var(--muted);"><i class="fas fa-sticky-note" style="margin-right:5px;color:var(--warn);"></i>${c.extra_notes}</div>`:''}`
    ).join('');
  } catch(e) { console.warn('loadLastTwoCalls error:', e); }
}

/* ─── STEP 1 SEARCH — من الجدولين ─── */
async function step1SearchCustomer() {
  const query     = (document.getElementById('step1-search-input')?.value || '').trim();
  const resultsEl = document.getElementById('step1-search-results');
  const btn       = document.getElementById('inline-search-btn');
  if (!query || !resultsEl) return;

  setButtonLoading(btn, true, 'Searching...');
  resultsEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
  const normalizedQuery = query.replace(/^0+/, '');
  const qFilter = `or=(customer_name.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(normalizedQuery)}%25)&order=logged_at.desc&limit=5`;
  const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };

  try {
    const [calls, wasps] = await Promise.all([
      fetch(`${SB_URL_SCH}/rest/v1/call_logs?${qFilter}`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'call'}))),
      fetch(`${SB_URL_SCH}/rest/v1/whatsapp_logs?${qFilter}`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'whatsapp'}))),
    ]);
    const data = [...calls, ...wasps].sort((a,b) => new Date(b.logged_at) - new Date(a.logged_at)).slice(0, 5);

    let html = '';
    if (!data.length) {
      html = `<div style="font-size:12px;color:var(--muted);padding:4px 0;">No results for "${query}"</div>`;
    } else {
      html += `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📋 ${data.length} result(s)</div>`;
      html += data.map(c => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:6px;font-size:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <div style="font-weight:700;color:var(--text);">${c.customer_name || 'N/A'}</div>
            ${getChannelBadge(c._source)}
          </div>
          <div style="color:var(--muted);font-family:monospace;">${c.customer_mobile || '-'}</div>
          <div style="color:var(--muted);">${c.project ? c.project + ' · ' : ''}${c.call_reason || '-'} · ${c.agent_name || '-'}</div>
          <div style="color:var(--muted);font-size:11px;">${c.logged_at ? new Date(c.logged_at).toLocaleDateString('en-GB') : ''}</div>
        </div>`).join('');
    }
    resultsEl.innerHTML = html;
  } catch(e) {
    resultsEl.innerHTML = '<div style="font-size:12px;color:var(--danger);">Connection error</div>';
  } finally {
    setButtonLoading(btn, false, '🔍 Search');
  }
}

function clearStep1Search() {
  const input   = document.getElementById('step1-search-input');
  const results = document.getElementById('step1-search-results');
  if (input)   input.value = '';
  if (results) results.innerHTML = '';
}

/* ─── DOM READY ─── */
document.addEventListener('DOMContentLoaded', () => {
  const tof = document.getElementById('time-off-form');
  if (tof) tof.style.display = 'block';
});

/* ─── MY CALL LOG — من الجدولين ─── */
let _mylogRaw          = [];   // آخر داتا اتجابت من السيرفر (الفترة المختارة)
let _mylogStatus       = 'all';   // all | open | closed
let _mylogSource       = 'all';   // all | call | whatsapp
let _mylogCategory     = 'all';   // all | <category_1 value>
let _mylogSearch       = '';
let _mylogDatePreset   = 'today';

function _mylogTabBtn(group, mode, label, countKey) {
  const active = (group === 'status' ? _mylogStatus : _mylogSource) === mode;
  return `<button data-mylog-tab="${group}:${mode}" onclick="setMyLogTab('${group}','${mode}')"
    style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 10px;border-radius:8px;border:none;background:${active ? 'var(--surface)' : 'transparent'};color:${active ? 'var(--text)' : 'var(--muted)'};font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:all 0.2s;white-space:nowrap;${active ? 'box-shadow:0 2px 8px rgba(0,0,0,0.15);' : ''}">
    <span>${label}</span>
    <span class="mylog-count" data-mylog-count="${group}:${mode}" style="opacity:0.75;font-size:11px;background:var(--surface2);padding:1px 7px;border-radius:8px;min-width:20px;text-align:center;">·</span>
  </button>`;
}

function setMyLogTab(group, mode) {
  if (group === 'status') _mylogStatus = mode; else _mylogSource = mode;
  document.querySelectorAll(`[data-mylog-tab^="${group}:"]`).forEach(btn => {
    const active = btn.dataset.mylogTab === `${group}:${mode}`;
    btn.style.background = active ? 'var(--surface)' : 'transparent';
    btn.style.color      = active ? 'var(--text)'    : 'var(--muted)';
    btn.style.boxShadow  = active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none';
  });
  renderMyCallLogList();
}

function setMyLogCategory(val) {
  _mylogCategory = val || 'all';
  renderMyCallLogList();
}

let _mylogSearchDebounce = null;
function setMyLogSearch(val) {
  clearTimeout(_mylogSearchDebounce);
  _mylogSearchDebounce = setTimeout(() => {
    _mylogSearch = (val || '').trim().toLowerCase();
    renderMyCallLogList();
  }, 120);
}

function setMyLogRange(preset) {
  const from = document.getElementById('mylog-from');
  const to = document.getElementById('mylog-to');
  if (!from || !to) return;
  const today = new Date();
  const iso = d => d.toLocaleDateString('en-CA');
  const start = new Date(today);
  if (preset === 'week') start.setDate(today.getDate() - 6);
  if (preset === 'month') start.setDate(1);
  if (preset === 'all') start.setFullYear(today.getFullYear() - 2);
  from.value = iso(start);
  to.value = iso(today);
  _mylogDatePreset = preset;
  document.querySelectorAll('[data-mylog-range]').forEach(btn => {
    const active = btn.dataset.mylogRange === preset;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const agent = document.getElementById('user-name')?.innerText?.trim();
  if (agent) fetchMyCallLog(agent);
}

function countActiveMyLogFilters() {
  return [_mylogStatus !== 'all', _mylogSource !== 'all', _mylogCategory !== 'all', !!_mylogSearch].filter(Boolean).length;
}

function clearMyLogFilters() {
  _mylogStatus = 'all'; _mylogSource = 'all'; _mylogCategory = 'all'; _mylogSearch = '';
  const searchEl = document.getElementById('mylog-search');
  if (searchEl) searchEl.value = '';
  const catEl = document.getElementById('mylog-cat-filter');
  if (catEl) catEl.value = 'all';
  document.querySelectorAll('[data-mylog-tab]').forEach(btn => {
    const active = btn.dataset.mylogTab.endsWith(':all');
    btn.style.background = active ? 'var(--surface)' : 'transparent';
    btn.style.color      = active ? 'var(--text)'    : 'var(--muted)';
    btn.style.boxShadow  = active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none';
  });
  renderMyCallLogList();
}

async function loadMyCallLog() {
  const agent     = document.getElementById('user-name').innerText.trim();
  const container = document.getElementById('tab-mylog');
  const today     = getLocalDateStr();

  _mylogStatus = 'all'; _mylogSource = 'all'; _mylogCategory = 'all'; _mylogSearch = '';

  container.innerHTML = `
    <div style="padding:16px;">
      <!-- ═══ REMINDERS SECTION ═══ -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div class="section-label" style="margin:0"><i class="fas fa-bell" style="color:#F59E0B;"></i> My Reminders</div>
          <button class="action-btn c-accent" onclick="loadMyReminders()" style="font-size:11px;padding:6px 12px;"><i class="fas fa-sync-alt"></i></button>
        </div>
        <!-- Reminders filter tabs -->
        <div style="display:flex;gap:4px;padding:4px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;">
          ${_remTabBtn('upcoming', '⏳ Upcoming')}
          ${_remTabBtn('done',     '✅ Done')}
          ${_remTabBtn('all',      '📋 All')}
        </div>
        <div id="reminders-list"><div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;">Loading...</div></div>
      </div>

      <div class="mylog-toolbar">
        <div class="mylog-toolbar-title">
          <div class="section-label" style="margin:0"><i class="fas fa-phone-alt"></i> My Call Log</div>
          <span class="mylog-live-hint"><i class="fas fa-circle"></i> Live view</span>
        </div>
        <div class="mylog-date-controls">
          <div class="mylog-range-chips" role="group" aria-label="Date range">
            <button type="button" data-mylog-range="today" class="mylog-range is-active" onclick="setMyLogRange('today')">Today</button>
            <button type="button" data-mylog-range="week" class="mylog-range" onclick="setMyLogRange('week')">7 days</button>
            <button type="button" data-mylog-range="month" class="mylog-range" onclick="setMyLogRange('month')">This month</button>
            <button type="button" data-mylog-range="all" class="mylog-range" onclick="setMyLogRange('all')">2 years</button>
          </div>
          <div class="mylog-date-inputs">
            <input type="date" id="mylog-from" class="form-input" aria-label="From date" value="${today}">
            <span>→</span>
            <input type="date" id="mylog-to" class="form-input" aria-label="To date" value="${today}">
            <button class="action-btn c-accent" onclick="fetchMyCallLog(document.getElementById('user-name').innerText.trim())"><i class="fas fa-sync-alt"></i><span>Apply</span></button>
          </div>
        </div>
      </div>

      <!-- ═══ SMART FILTER BAR ═══ -->
      <div class="mylog-filter-card">
        <div class="mylog-filter-head"><div><strong>Find a conversation</strong><span>Combine filters to narrow down instantly</span></div><span class="mylog-active-count" id="mylog-active-count">0 active</span></div>
        <div class="mylog-filter-grid">
          <div class="mylog-filter-group"><label>Status</label><div class="mylog-segmented">${_mylogTabBtn('status','all','All')} ${_mylogTabBtn('status','open','🟡 Open')} ${_mylogTabBtn('status','closed','✅ Closed')}</div></div>
          <div class="mylog-filter-group"><label>Channel</label><div class="mylog-segmented">${_mylogTabBtn('source','all','All')} ${_mylogTabBtn('source','call','📞 Calls')} ${_mylogTabBtn('source','whatsapp','💬 WhatsApp')}</div></div>
          <label class="mylog-search-wrap"><i class="fas fa-search"></i><input type="search" id="mylog-search" class="form-input" placeholder="Name, mobile, project, unit, reason..." oninput="setMyLogSearch(this.value)"><button type="button" onclick="document.getElementById('mylog-search').value='';setMyLogSearch('')" aria-label="Clear search">×</button></label>
          <select id="mylog-cat-filter" class="form-input mylog-category-select" onchange="setMyLogCategory(this.value)" aria-label="Category"><option value="all">All Categories</option></select>
          <button class="mylog-reset-btn" onclick="clearMyLogFilters()"><i class="fas fa-rotate-left"></i> Reset filters</button>
          <button class="mylog-reset-btn" onclick="exportMyCallLogCSV()" style="color:var(--primary);border-color:var(--primary);"><i class="fas fa-download"></i> Export CSV</button>
        </div>
      </div>

      <div id="mylog-content"><div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading...</div></div>
    </div>`;

  await fetchMyCallLog(agent);
  loadMyReminders();
}

async function fetchMyCallLog(agent) {
  const container = document.getElementById('mylog-content');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading...</div>';

  try {
    const fromDate = document.getElementById('mylog-from')?.value;
    const toDate   = document.getElementById('mylog-to')?.value;
    if (!fromDate || !toDate) return;

    const fromISO = new Date(fromDate + 'T00:00:00+03:00').toISOString();
    const toISO   = new Date(toDate   + 'T23:59:59+03:00').toISOString();
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
    const q = `agent_name=eq.${encodeURIComponent(agent)}&logged_at=gte.${fromISO}&logged_at=lte.${toISO}&order=logged_at.desc`;

    const [calls, wasps] = await Promise.all([
      fetch(`${SB_URL_SCH}/rest/v1/call_logs?${q}`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'call'}))),
      fetch(`${SB_URL_SCH}/rest/v1/whatsapp_logs?${q}`, { headers }).then(r => r.json()).then(d => (d||[]).map(r => ({...r, _source:'whatsapp'}))),
    ]);

    _mylogRaw = [...calls, ...wasps].sort((a,b) => new Date(b.logged_at) - new Date(a.logged_at));

    // Keep smart filters while changing the date range; only discard a category that vanished.
    const searchEl = document.getElementById('mylog-search');
    if (searchEl) searchEl.value = _mylogSearch;

    // Populate category dropdown from whatever's actually in this data
    const catEl = document.getElementById('mylog-cat-filter');
    if (catEl) {
      const cats = [...new Set(_mylogRaw.map(c => c.category_1).filter(Boolean))].sort();
      catEl.innerHTML = '<option value="all">All Categories</option>' +
        cats.map(cat => `<option value="${cat.replace(/"/g,'&quot;')}">${cat}</option>`).join('');
      if (_mylogCategory !== 'all' && !cats.includes(_mylogCategory)) _mylogCategory = 'all';
      catEl.value = _mylogCategory;
    }

    renderMyCallLogList();

  } catch(e) {
    container.innerHTML = '<div class="empty-state">Connection error. Try again.</div>';
    console.error('fetchMyCallLog error:', e);
  }
}

function getFilteredMyLogData() {
  const term = _mylogSearch;
  return _mylogRaw.filter(c => {
    if (_mylogStatus === 'open'   && c.status !== 'open')  return false;
    if (_mylogStatus === 'closed' && c.status === 'open')  return false;
    if (_mylogSource !== 'all'    && c._source !== _mylogSource) return false;
    if (_mylogCategory !== 'all' && c.category_1 !== _mylogCategory) return false;
    if (term) {
      const hay = `${c.customer_name||''} ${c.customer_mobile||''} ${c.unit_code||''} ${c.project||''} ${c.category_1||''} ${c.call_reason||''} ${c.communication_channel||''} ${c.media_source||''} ${c.budget||''} ${c.extra_notes||''}`.toLowerCase();
      const terms = term.split(/\s+/).filter(Boolean);
      if (!terms.every(token => hay.includes(token))) return false;
    }
    return true;
  });
}

function renderMyCallLogList() {
  const container = document.getElementById('mylog-content');
  if (!container) return;

  const raw = _mylogRaw;

  // ─── counts for the tab badges (computed from the FULL date-range data, not the filtered subset) ───
  _setMylogCount('status:all',    raw.length);
  _setMylogCount('status:open',   raw.filter(c => c.status === 'open').length);
  _setMylogCount('status:closed', raw.filter(c => c.status !== 'open').length);
  _setMylogCount('source:all',      raw.length);
  _setMylogCount('source:call',     raw.filter(c => c._source === 'call').length);
  _setMylogCount('source:whatsapp', raw.filter(c => c._source === 'whatsapp').length);

  // ─── apply the smart filter ───
  const data = getFilteredMyLogData();

  const activeCountEl = document.getElementById('mylog-active-count');
  if (activeCountEl) activeCountEl.textContent = `${countActiveMyLogFilters()} active`;

  if (!raw.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><br>No conversations in this date range.<br><small>Try 7 days or This month.</small></div>';
    return;
  }
  if (!data.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-filter"></i><br>No conversations match these filters.<br><a onclick="clearMyLogFilters()" style="cursor:pointer;color:var(--primary);font-weight:700;">Clear filters</a></div>`;
    return;
  }

  const total      = data.length;
  const totalCalls = data.filter(c => c._source === 'call').length;
  const totalWasps = data.filter(c => c._source === 'whatsapp').length;
  const business   = data.filter(c => c.business_relativity === 'Business Related').length;
  const sales      = data.filter(c => c.sales_call_requested === 'Yes').length;

  let html = `
    <div class="mylog-results-summary"><span><strong>${total}</strong> conversations found</span><span>${countActiveMyLogFilters() ? 'Filtered view' : 'All results'} · ${document.getElementById('mylog-from')?.value || ''} → ${document.getElementById('mylog-to')?.value || ''}</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Total</div>
        <div style="font-size:24px;font-weight:800;color:var(--primary);">${total}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">📞 Calls</div>
        <div style="font-size:24px;font-weight:800;color:#2563eb;">${totalCalls}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">💬 WhatsApp</div>
        <div style="font-size:24px;font-weight:800;color:#16a34a;">${totalWasps}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Sales Req.</div>
        <div style="font-size:24px;font-weight:800;color:#7c3aed;">${sales}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">`;

  data.forEach(c => {
    const time = c.logged_at ? new Date(c.logged_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
    const date = c.logged_at ? new Date(c.logged_at).toLocaleDateString('en-GB') : '';
    const isQ  = c.call_reason === 'Wrong Number' || c.call_reason === 'Call Dropped';
    const reasonColor = isQ ? 'var(--muted)' : 'var(--primary)';
    const icon = c._source === 'whatsapp' ? '💬' : '📞';

    html += `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;background:var(--primary-gradient);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">${icon}</div>
            <div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                <div style="font-weight:800;font-size:14px;color:var(--text);">${c.customer_name || '—'}</div>
                ${getChannelBadge(c._source)}
                ${getStatusBadge(c.status)}
              </div>
              <div style="font-size:12px;color:var(--muted);font-family:monospace;">${c.customer_mobile || '—'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:700;color:var(--primary);">${time}</div>
              <div style="font-size:11px;color:var(--muted);">${date}</div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <button onclick="openEditCallModal(${JSON.stringify({...c, _sourceTable: c._source === 'whatsapp' ? 'whatsapp_logs' : 'call_logs'}).replace(/"/g,'&quot;')})"
                style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:var(--primary);cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;">
                ✏️ Edit
              </button>
              <button onclick="confirmDeleteCallLog('${c.id}','${c._source === 'whatsapp' ? 'whatsapp_logs' : 'call_logs'}','${(c.customer_name||'—').replace(/'/g,"\\'")}','${c.call_reason||'—'}')"
                style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:var(--danger);cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:all 0.2s;"
                onmouseover="this.style.background='rgba(239,68,68,0.15)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'">
                🗑️ Delete
              </button>
              ${!isQ ? `<button onclick="openReminderModal('${(c.customer_name||'').replace(/'/g,"\\'")}','${(c.customer_mobile||'').replace(/'/g,"\\'")}','${c.id}')"
                style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:#F59E0B;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;transition:all 0.2s;"
                onmouseover="this.style.background='rgba(245,158,11,0.15)'" onmouseout="this.style.background='rgba(245,158,11,0.08)'">
                ⏰ Remind
              </button>` : ''}
              ${!isQ ? (c.status === 'open'
                ? `<button onclick="toggleLogStatus('${c.id}','${c._source === 'whatsapp' ? 'whatsapp_logs' : 'call_logs'}','closed')"
                    style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:#059669;cursor:pointer;white-space:nowrap;">
                    ✅ Mark Closed
                  </button>`
                : `<button onclick="toggleLogStatus('${c.id}','${c._source === 'whatsapp' ? 'whatsapp_logs' : 'call_logs'}','open')"
                    style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:#F59E0B;cursor:pointer;white-space:nowrap;">
                    🟡 Reopen
                  </button>`) : ''}
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;">
          <div><span style="color:var(--muted);">Project: </span><span style="font-weight:700;color:var(--accent,var(--primary));">${c.project||'—'}</span></div>
          <div><span style="color:var(--muted);">Category: </span><span style="font-weight:700;color:${reasonColor};">${c.category_1 ? c.category_1 + ' → ' : ''}${c.call_reason||'—'}</span></div>
          <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:600;color:var(--text);">${c.communication_channel||'—'}</span></div>
          <div><span style="color:var(--muted);">Media: </span><span style="font-weight:600;color:var(--text);">${c.media_source||'—'}</span></div>
          <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:600;color:var(--text);">${c.budget||'—'}</span></div>
          <div><span style="color:var(--muted);">Sales: </span><span style="font-weight:600;color:var(--text);">${c.sales_call_requested||'—'}</span></div>
          ${c.unit_code ? `<div><span style="color:var(--muted);">Unit Code: </span><span style="font-weight:600;color:var(--text);">${c.unit_code}</span></div>` : ''}
        </div>
        ${c.extra_notes&&c.extra_notes.trim()&&c.extra_notes!=='-' ? `
        <div style="margin-top:10px;padding:10px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);font-size:12px;color:var(--muted);">
          <i class="fas fa-sticky-note" style="margin-right:6px;color:var(--warn);"></i>${c.extra_notes}
        </div>` : ''}
      </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

/* ─── EXPORT MY CALL LOG — downloads the currently filtered list as CSV ─── */
function _csvEscape(val) {
  const s = (val === null || val === undefined) ? '' : String(val);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportMyCallLogCSV() {
  const data = getFilteredMyLogData();
  if (!data.length) { showToast('⚠️', 'Nothing to export', 'No conversations match the current filters.', 'warn', 4000); return; }

  const headers = [
    'Date', 'Time', 'Type', 'Status', 'Customer Name', 'Customer Mobile',
    'Choose', 'Category 1', 'Category 2', 'Category 3',
    'Communication Channel', 'Media Source', 'Sales Call Requested',
    'Unit Code', 'Notes'
  ];

  const rows = data.map(c => {
    const dt = c.logged_at ? new Date(c.logged_at) : null;
    return [
      dt ? dt.toLocaleDateString('en-GB') : '',
      dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
      c._source === 'whatsapp' ? 'WhatsApp' : 'Call',
      c.status === 'open' ? 'Open' : 'Closed',
      c.customer_name || '',
      c.customer_mobile || '',
      c.project || '',
      c.category_1 || '',
      c.call_reason || '',
      c.category_3 || '',
      c.communication_channel || '',
      c.media_source || '',
      c.sales_call_requested || '',
      c.unit_code || '',
      c.extra_notes || '',
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(_csvEscape).join(','))
    .join('\r\n');

  // Prefix with a UTF-8 BOM so Excel opens Arabic/special characters correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const agentName = (document.getElementById('user-name')?.innerText || 'agent').trim().replace(/\s+/g, '-');
  const fromDate = document.getElementById('mylog-from')?.value || '';
  const toDate   = document.getElementById('mylog-to')?.value || '';

  const a = document.createElement('a');
  a.href = url;
  a.download = `call-log-${agentName}-${fromDate}_to_${toDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('📥', 'Exported!', `${data.length} conversation(s) downloaded.`, 'success', 4000);
}

function _setMylogCount(key, n) {
  const el = document.querySelector(`[data-mylog-count="${key}"]`);
  if (el) el.innerText = n;
}

/* ─── DELETE CALL LOG ─── */
async function confirmDeleteCallLog(id, table, customerName, reason) {
  const confirmed = await customConfirm(
    '🗑️ Delete Call Log',
    `Are you sure you want to delete this log?\n\n👤 Customer: ${customerName}\n📋 Reason: ${reason}\n\nThis action cannot be undone.`
  );
  if (!confirmed) return;
  await deleteCallLog(id, table);
}

async function deleteCallLog(id, table) {
  try {
    const res = await fetch(`${SB_URL_SCH}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SB_KEY_SCH,
        'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`,
        'Prefer': 'return=minimal'
      }
    });

    if (!res.ok) throw new Error('Delete failed: ' + res.status);

    showToast('🗑️', 'Log Deleted', 'Call log removed successfully.', 'success', 3000);

    // أعد تحميل الـ list
    const agent = document.getElementById('user-name').innerText.trim();
    if (agent && typeof fetchMyCallLog === 'function') fetchMyCallLog(agent);

  } catch(e) {
    console.error('deleteCallLog error:', e);
    showToast('⚠️', 'Delete Failed', 'Could not delete this log. Try again.', 'danger', 4000);
  }
}

/* ─── EDIT CALL LOG MODAL — يعدّل في الجدول الصح ─── */
function openEditCallModal(callData) {
  const existing = document.getElementById('edit-call-modal');
  if (existing) existing.remove();

  // Dynamic options from loaded Supabase data
  const projectOptions = _chooseOptions.map(o => o.name);

  // Category 1 — keep the row's own id so we can cascade; always include the
  // record's current value even if it's since been renamed/removed (backward compat).
  let cat1List = _cat1Options.map(c => ({ id: c.id, name: c.name }));
  if (callData.category_1 && !cat1List.some(c => c.name === callData.category_1)) {
    cat1List.push({ id: '', name: callData.category_1 });
  }

  // Category 2 — same pooled fallback as before, used only until the real cascade loads
  // (or forever, for legacy/quick-log entries with no matching Category 1).
  let reasonOptions = [];
  Object.values(_cat2Cache).forEach(items => items.forEach(i => { if (!reasonOptions.includes(i.name)) reasonOptions.push(i.name); }));
  if (callData.call_reason && !reasonOptions.includes(callData.call_reason)) reasonOptions.push(callData.call_reason);
  if (!reasonOptions.length) reasonOptions = ['Wrong Number','Call Dropped','Sales Lead','Events','Other'];

  const channelOptions  = ['Whatsapp','Mobile','Email','Alternative Mobile','SMS','N/A'];
  const mediaOptions    = ['Billboards','Saw site','Facebook','Instagram','Linkedin','Word of mouth','TV ad.','Youtube','N/A'];
  const budgetOptions   = ['0 - 10','10 - 20','20 +','N/A'];
  const unitOptions     = ['Apartment','Villa','Commercial','Admin','Twin House','Stand Alone House','Town House','N/A'];
  const bizrelOptions   = ['Business Related','Non-Business Related'];
  const salesOptions    = ['Yes','No','N/A'];

  function opts(list, current) {
    return list.map(o => `<option value="${o}" ${current === o ? 'selected' : ''}>${o}</option>`).join('');
  }
  function optsWithId(list, current) {
    return list.map(o => `<option value="${o.name}" data-id="${o.id}" ${current === o.name ? 'selected' : ''}>${o.name}</option>`).join('');
  }

  const isQ          = callData.call_reason === 'Wrong Number' || callData.call_reason === 'Call Dropped';
  const sourceTable  = callData._sourceTable || 'call_logs';
  const sourceLabel  = sourceTable === 'whatsapp_logs' ? 'WhatsApp' : 'Call';

  const modal = document.createElement('div');
  modal.id = 'edit-call-modal';
  modal.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;`;

  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;padding:24px;position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:16px;font-weight:800;color:var(--text);">✏️ Edit ${sourceLabel} Log</div>
          ${getChannelBadge(sourceTable === 'whatsapp_logs' ? 'whatsapp' : 'call')}
        </div>
        <button onclick="document.getElementById('edit-call-modal').remove()"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;width:34px;height:34px;font-size:16px;cursor:pointer;color:var(--muted);">✕</button>
      </div>

      <input type="hidden" id="edit-call-id"    value="${callData.id}">
      <input type="hidden" id="edit-call-table"  value="${sourceTable}">
      <input type="hidden" id="edit-prev-status" value="${callData.status || 'closed'}">

      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Customer Name</label>
          <input id="edit-cname" class="form-input" type="text" value="${callData.customer_name || ''}" placeholder="Customer Name">
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Customer Mobile</label>
          <input id="edit-mobile" class="form-input" type="text" value="${callData.customer_mobile || ''}" placeholder="Customer Mobile">
        </div>
        <div id="edit-project-fields" style="${isQ ? 'display:none' : ''}">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Project</label>
              <select id="edit-project" class="form-input"><option value="">—</option>${opts(projectOptions, callData.project)}</select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Category 1</label>
              <select id="edit-cat1" class="form-input" onchange="onEditCategory1Change()"><option value="">—</option>${optsWithId(cat1List, callData.category_1)}</select>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Category 2</label>
            <select id="edit-reason" class="form-input" onchange="onEditCategory2Change()">${opts(reasonOptions, callData.call_reason)}</select>
          </div>
          <div id="edit-cat3-field" style="${callData.category_3 ? '' : 'display:none'}">
            <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Category 3</label>
            <select id="edit-cat3" class="form-input">
              ${callData.category_3 ? `<option value="${callData.category_3}" selected>${callData.category_3}</option>` : '<option value="">—</option>'}
            </select>
          </div>
        </div>
        <div id="edit-status-fields" style="${isQ ? 'display:none' : ''}">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Status</label>
            <select id="edit-status" class="form-input" onchange="toggleEditFollowupSection()">
              <option value="closed" ${callData.status !== 'open' ? 'selected' : ''}>✅ Closed</option>
              <option value="open" ${callData.status === 'open' ? 'selected' : ''}>🟡 Open — needs follow-up</option>
            </select>
          </div>
          <div id="edit-followup-section" style="${callData.status === 'open' ? '' : 'display:none'};background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;margin-top:10px;">
            <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">⏰ New Follow-up (optional)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
              <input type="date" id="edit-followup-date" class="form-input">
              <input type="time" id="edit-followup-time" class="form-input">
            </div>
            <textarea id="edit-followup-note" class="form-input" rows="2" placeholder="Follow up about..."></textarea>
          </div>
        </div>
        <div id="edit-extra-fields" style="${isQ ? 'display:none' : ''}">
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Business Relativity</label>
              <select id="edit-bizrel" class="form-input">${opts(bizrelOptions, callData.business_relativity)}</select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Sales Call Requested</label>
              <select id="edit-salescall" class="form-input">${opts(salesOptions, callData.sales_call_requested)}</select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Communication Channel</label>
              <select id="edit-channel" class="form-input">${opts(channelOptions, callData.communication_channel)}</select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Media Source</label>
              <select id="edit-media" class="form-input">${opts(mediaOptions, callData.media_source)}</select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Budget</label>
              <select id="edit-budget" class="form-input">${opts(budgetOptions, callData.budget)}</select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Unit Type</label>
              <select id="edit-unit" class="form-input">${opts(unitOptions, callData.unit_type)}</select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Unit Code</label>
              <input id="edit-unit-code" class="form-input" type="text" value="${callData.unit_code || ''}" placeholder="e.g. A-204">
            </div>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Extra Notes</label>
          <textarea id="edit-extra" class="form-input" rows="3" placeholder="Extra Notes..." style="resize:vertical;">${callData.extra_notes || ''}</textarea>
        </div>
        <div id="edit-error-msg" style="display:none;background:#fee2e2;border-radius:10px;padding:10px;font-size:13px;font-weight:600;color:#dc2626;"></div>
        <button id="edit-save-btn" onclick="saveEditCallLog()"
          style="background:var(--primary-gradient);border:none;border-radius:12px;padding:14px;font-size:14px;font-weight:800;color:white;cursor:pointer;width:100%;">
          💾 Save Changes
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Upgrade Category 2 / Category 3 to the real cascading lists now that the modal exists,
  // preserving whatever is currently selected.
  initEditCategoryCascade(callData);
}

/* ─── EDIT MODAL — Category cascade (upgrades the flat fallback lists to real cascades) ─── */
async function initEditCategoryCascade(callData) {
  const cat1Sel = document.getElementById('edit-cat1');
  const cat1Id  = cat1Sel?.selectedOptions[0]?.dataset.id || '';
  if (!cat1Id) return; // legacy/quick-log entry with no matching Category 1 — keep the flat fallback list
  await loadEditCategory2(cat1Id, callData.call_reason, callData.category_3);
}

async function loadEditCategory2(cat1Id, currentReason, currentCat3) {
  const cat2Sel = document.getElementById('edit-reason');
  if (!cat2Sel) return;

  if (!_cat2Cache[cat1Id]) {
    try {
      const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
      const res = await fetch(`${SB_URL_SCH}/rest/v1/call_log_category2?category1_id=eq.${cat1Id}&is_active=eq.true&order=sort_order,name`, { headers });
      _cat2Cache[cat1Id] = await res.json() || [];
    } catch(e) { _cat2Cache[cat1Id] = []; }
  }

  const items = _cat2Cache[cat1Id];
  if (!items.length) return; // this Category 1 has no sub-categories — leave the flat fallback list as-is

  let list = items.map(o => ({ id: o.id, name: o.name }));
  if (currentReason && !list.some(o => o.name === currentReason)) list.push({ id: '', name: currentReason });

  cat2Sel.innerHTML = list.map(o =>
    `<option value="${o.name}" data-id="${o.id}" ${currentReason === o.name ? 'selected' : ''}>${o.name}</option>`
  ).join('');

  const selectedId = cat2Sel.selectedOptions[0]?.dataset.id || '';
  if (selectedId) await loadEditCategory3(selectedId, currentCat3);
  else resetEditCategory3Field();
}

async function loadEditCategory3(cat2Id, currentCat3) {
  const field = document.getElementById('edit-cat3-field');
  const cat3Sel = document.getElementById('edit-cat3');
  if (!field || !cat3Sel) return;

  if (!_cat3Cache[cat2Id]) {
    try {
      const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
      const res = await fetch(`${SB_URL_SCH}/rest/v1/call_log_category3?category2_id=eq.${cat2Id}&is_active=eq.true&order=sort_order,name`, { headers });
      _cat3Cache[cat2Id] = await res.json() || [];
    } catch(e) { _cat3Cache[cat2Id] = []; }
  }

  const items = _cat3Cache[cat2Id];
  if (!items.length) { resetEditCategory3Field(); return; }

  let list = items.map(o => o.name);
  if (currentCat3 && !list.includes(currentCat3)) list.push(currentCat3);

  cat3Sel.innerHTML = '<option value="">Choose...</option>' +
    list.map(name => `<option value="${name}" ${currentCat3 === name ? 'selected' : ''}>${name}</option>`).join('');
  field.style.display = '';
}

function resetEditCategory3Field() {
  const field = document.getElementById('edit-cat3-field');
  const cat3Sel = document.getElementById('edit-cat3');
  if (field) field.style.display = 'none';
  if (cat3Sel) { cat3Sel.innerHTML = '<option value="">—</option>'; cat3Sel.value = ''; }
}

async function onEditCategory1Change() {
  const cat1Sel = document.getElementById('edit-cat1');
  const cat1Id  = cat1Sel?.selectedOptions[0]?.dataset.id || '';
  resetEditCategory3Field();
  if (!cat1Id) return;
  await loadEditCategory2(cat1Id, '', '');
}

async function onEditCategory2Change() {
  toggleEditSections();
  const cat2Sel = document.getElementById('edit-reason');
  const cat2Id  = cat2Sel?.selectedOptions[0]?.dataset.id || '';
  if (!cat2Id) { resetEditCategory3Field(); return; }
  await loadEditCategory3(cat2Id, '');
}

function toggleEditSections() {
  const reason = document.getElementById('edit-reason')?.value;
  const isQ = reason === 'Wrong Number' || reason === 'Call Dropped';
  const extra = document.getElementById('edit-extra-fields');
  const projFields = document.getElementById('edit-project-fields');
  const statusFields = document.getElementById('edit-status-fields');
  if (extra) extra.style.display = isQ ? 'none' : '';
  if (projFields) projFields.style.display = isQ ? 'none' : '';
  if (statusFields) statusFields.style.display = isQ ? 'none' : '';
}

function toggleEditFollowupSection() {
  const status  = document.getElementById('edit-status')?.value;
  const section = document.getElementById('edit-followup-section');
  if (!section) return;
  section.style.display = (status === 'open') ? 'block' : 'none';
}

async function saveEditCallLog() {
  const id          = document.getElementById('edit-call-id').value;
  const sourceTable = document.getElementById('edit-call-table').value || 'call_logs';
  const reason      = document.getElementById('edit-reason').value;
  const isQ         = reason === 'Wrong Number' || reason === 'Call Dropped';
  const errEl       = document.getElementById('edit-error-msg');
  const saveBtn     = document.getElementById('edit-save-btn');

  const project   = isQ ? '' : (document.getElementById('edit-project')?.value || '');
  const cat1      = isQ ? '' : (document.getElementById('edit-cat1')?.value || '');
  const cat3      = isQ ? '' : (document.getElementById('edit-cat3')?.value || '');
  const cname     = document.getElementById('edit-cname').value.trim();
  const mobile    = document.getElementById('edit-mobile').value.trim();
  const channel   = isQ ? '' : document.getElementById('edit-channel').value;
  const media     = isQ ? '' : document.getElementById('edit-media').value;
  const budget    = isQ ? '' : document.getElementById('edit-budget').value;
  const unit      = isQ ? '' : document.getElementById('edit-unit').value;
  const unitCode  = isQ ? '' : document.getElementById('edit-unit-code').value.trim();
  const bizrel    = isQ ? '' : document.getElementById('edit-bizrel').value;
  const salescall = isQ ? '' : document.getElementById('edit-salescall').value;
  const extra     = document.getElementById('edit-extra').value.trim();
  const status    = isQ ? 'closed' : (document.getElementById('edit-status')?.value || 'closed');
  const prevStatus = document.getElementById('edit-prev-status')?.value || 'closed';
  const fuDate    = document.getElementById('edit-followup-date')?.value || '';
  const fuTime    = document.getElementById('edit-followup-time')?.value || '';
  const fuNote    = document.getElementById('edit-followup-note')?.value.trim() || '';

  if (!isQ && !project) { showEditError('Please select Project'); return; }
  if (!isQ && !cat1)    { showEditError('Please select Category 1'); return; }
  if (!isQ && !cname)   { showEditError('Please enter Customer Name'); return; }
  if (!isQ && !mobile)  { showEditError('Please enter Customer Mobile'); return; }

  errEl.style.display = 'none';
  setButtonLoading(saveBtn, true, 'Saving...');

  try {
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/${sourceTable}?id=eq.${id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SB_KEY_SCH,
          'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          customer_name:         isQ ? '' : cname,
          customer_mobile:       isQ ? '' : mobile,
          project:               project,
          category_1:            cat1,
          category_3:            cat3,
          call_reason:           reason,
          communication_channel: channel,
          media_source:          media,
          budget,
          unit_type:             unit,
          unit_code:             unitCode,
          business_relativity:   bizrel,
          sales_call_requested:  salescall,
          extra_notes:           extra,
          status:                status,
          ...(status !== prevStatus
            ? { closed_at: status === 'closed' ? new Date().toISOString() : null }
            : {}),
        })
      }
    );

    if (res.ok) {
      if (status === 'open' && fuDate) {
        createFollowupForLog(id, sourceTable, cname, mobile, fuDate, fuTime, fuNote);
      }
      document.getElementById('edit-call-modal').remove();
      if (window.showToast) showToast('✅', 'Updated!', 'Log updated successfully.', 'success', 3000);
      const agent = document.getElementById('user-name')?.innerText.trim();
      if (agent && typeof fetchMyCallLog === 'function') fetchMyCallLog(agent);
    } else {
      const err = await res.text();
      showEditError('Save failed: ' + err);
      setButtonLoading(saveBtn, false, '💾 Save Changes');
    }
  } catch(e) {
    showEditError('Connection error. Please try again.');
    setButtonLoading(saveBtn, false, '💾 Save Changes');
  }
}

function showEditError(msg) {
  const el = document.getElementById('edit-error-msg');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

/* ═══════════════════════════════════════════════════
   REMINDER AUTO-CHECK — Browser Notifications
   ═══════════════════════════════════════════════════ */
let _reminderCheckInterval = null;
let _notifiedReminderIds   = new Set(JSON.parse(localStorage.getItem('nos_notified_reminders') || '[]'));

function initReminderAutoCheck() {
  // Request browser notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Check immediately on load, then every 60 seconds
  setTimeout(() => checkDueReminders(), 3000);
  _reminderCheckInterval = setInterval(checkDueReminders, 60000);
}

async function checkDueReminders() {
  const agent = document.getElementById('user-name')?.innerText?.trim();
  if (!agent) return;

  try {
    const now     = new Date();
    const today   = getLocalDateStr();
    const curTime = now.toLocaleTimeString('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit' });
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };

    // Fetch all non-done reminders for today or overdue
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/call_reminders?agent_name=eq.${encodeURIComponent(agent)}&is_done=eq.false&reminder_date=lte.${today}&order=reminder_date,reminder_time`,
      { headers }
    );
    const reminders = await res.json() || [];
    if (!reminders.length) return;

    // Filter to ones that are due now (overdue dates, or today with time <= now)
    const due = reminders.filter(r => {
      if (r.reminder_date < today) return true;  // overdue
      if (!r.reminder_time) return true;          // today, no specific time
      return r.reminder_time.substring(0, 5) <= curTime;  // today, time passed
    });

    if (!due.length) return;

    // Show notifications for new ones only
    due.forEach(r => {
      if (_notifiedReminderIds.has(r.id)) return;
      _notifiedReminderIds.add(r.id);

      const title = `⏰ Reminder: ${r.customer_name || 'Customer'}`;
      const body  = [
        r.customer_mobile || '',
        r.note || '',
        r.reminder_date < today ? '🔴 OVERDUE' : ''
      ].filter(Boolean).join(' · ');

      // In-app toast
      if (typeof showToast === 'function') {
        showToast('⏰', title, body, 'warn', 10000);
      }

      // Browser desktop notification
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, {
            body: body,
            icon: 'assets/icon-192.png',
            tag: 'reminder-' + r.id,
            requireInteraction: true,
          });
          n.onclick = () => { window.focus(); n.close(); };
        } catch(e) { /* mobile Safari doesn't support new Notification() */ }
      }
    });

    // Save notified IDs to localStorage (keep only last 200)
    const arr = [..._notifiedReminderIds].slice(-200);
    localStorage.setItem('nos_notified_reminders', JSON.stringify(arr));

    // Update reminder badge if exists
    updateReminderBadge(due.length);

  } catch(e) { /* silent — don't break the app */ }
}

function updateReminderBadge(count) {
  let badge = document.getElementById('reminder-badge');
  if (!badge) {
    // Create a floating badge at top-right
    badge = document.createElement('div');
    badge.id = 'reminder-badge';
    badge.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9990;cursor:pointer;';
    badge.onclick = () => { switchTab('tab-mylog', null, 6); };
    document.body.appendChild(badge);
  }
  if (count > 0) {
    badge.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);border-radius:12px;padding:6px 14px;animation:pulse 2s infinite;">
        <span style="font-size:14px;">⏰</span>
        <span style="font-size:12px;font-weight:800;color:#F59E0B;">${count} reminder${count > 1 ? 's' : ''} due</span>
      </div>`;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// Start auto-check when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initReminderAutoCheck, 2000);
});
