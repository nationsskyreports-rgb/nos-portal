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

/* ─── 16. CALL LOG FORM ─── */
function onAgentSelect() {}

function selectRadio(groupId, el, value) {
  document.querySelectorAll('#' + groupId + ' .radio-opt').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  radioValues[groupId] = value;
}

/* ─── DYNAMIC CALL LOG OPTIONS FROM SUPABASE ─── */
let _chooseOptions = [];  // from call_log_choose_options
let _cat1Options   = [];  // from call_log_categories
let _cat2Cache     = {};  // cat1_id -> [items] from call_log_category2

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
  }
}

async function onCategory1Change() {
  const cat1Sel = document.getElementById('f-category1');
  const cat2    = document.getElementById('f-category2');
  const cat1Id  = cat1Sel.value;

  if (!cat1Id) {
    cat2.innerHTML = '<option value="">Select Category 1 first...</option>';
    cat2.disabled = true;
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
  cat2.disabled = false;
  cat2.innerHTML = '<option value="">Choose...</option>' +
    items.map(o => `<option>${o.name}</option>`).join('');
}

function toggleFormSections() { /* no-op — Wrong Number/Call Dropped are Quick Log only */ }

// Keep old function name as alias for backward compat
function filterCategory2ByCat1() { onCategory1Change(); }

window.addEventListener('load', () => {
  loadCallLogOptions().then(() => toggleProjectCategoryFields());
});

/* ─── REMINDER SYSTEM ─── */
async function openReminderModal(customerName, customerMobile, callLogId) {
  const existing = document.getElementById('reminder-modal');
  if (existing) existing.remove();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defDate = tomorrow.toLocaleDateString('en-CA');

  const modal = document.createElement('div');
  modal.id = 'reminder-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:20px;width:100%;max-width:420px;padding:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <div style="font-size:16px;font-weight:800;color:var(--text);">⏰ Set Reminder</div>
        <button onclick="document.getElementById('reminder-modal').remove()"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;width:34px;height:34px;font-size:16px;cursor:pointer;color:var(--muted);">✕</button>
      </div>
      <div style="background:var(--surface2);border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px;">
        <div style="font-weight:700;color:var(--text);">👤 ${customerName || '—'}</div>
        <div style="color:var(--muted);font-family:monospace;">${customerMobile || '—'}</div>
      </div>
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

async function loadMyReminders() {
  const agent = document.getElementById('user-name')?.innerText?.trim();
  const wrap  = document.getElementById('reminders-list');
  if (!wrap || !agent) return;

  try {
    const today = getLocalDateStr();
    const headers = { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}` };
    const res = await fetch(`${SB_URL_SCH}/rest/v1/call_reminders?agent_name=eq.${encodeURIComponent(agent)}&is_done=eq.false&order=reminder_date,reminder_time`, { headers });
    const data = await res.json() || [];

    if (!data.length) {
      wrap.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px;">No upcoming reminders ✨</div>';
      return;
    }

    wrap.innerHTML = data.map(r => {
      const isToday  = r.reminder_date === today;
      const isPast   = r.reminder_date < today;
      const border   = isPast ? 'var(--danger)' : isToday ? 'var(--primary)' : 'var(--border)';
      const dateBadge = isPast ? '🔴 Overdue' : isToday ? '🟡 Today' : r.reminder_date;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid ${border};border-radius:12px;margin-bottom:8px;background:var(--surface);">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="font-weight:800;font-size:13px;color:var(--text);">${r.customer_name || '—'}</span>
              <span style="font-size:11px;color:var(--muted);font-family:monospace;">${r.customer_mobile || ''}</span>
            </div>
            <div style="font-size:11px;color:var(--muted);">
              <span style="font-weight:700;${isPast?'color:var(--danger);':isToday?'color:var(--primary);':''}">${dateBadge}</span>
              ${r.reminder_time ? ' · ' + r.reminder_time.substring(0,5) : ''}
              ${r.note ? ' · ' + r.note : ''}
            </div>
          </div>
          <button onclick="markReminderDone('${r.id}')" title="Mark done"
            style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:10px;padding:8px 12px;font-size:12px;font-weight:700;color:#10B981;cursor:pointer;">
            ✓ Done
          </button>
        </div>`;
    }).join('');
  } catch(e) {
    wrap.innerHTML = '<div style="color:var(--danger);font-size:12px;padding:10px;">Failed to load reminders</div>';
  }
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
      project: '', category_1: '',
      call_reason: reason, communication_channel: '', media_source: '',
      business_relativity: '', sales_call_requested: '',
      budget: '', unit_type: '', extra_notes: '',
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
      addOfflineCall({ agent, reason, cname:'', mobile:'', bizrel:'', salescall:'',
        channel:'', media:'', budget:'', unit:'', extra:'', _channel: window._activeChannel || 'call' });
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
  const reason  = document.getElementById('f-category2').value;
  const mobile  = document.getElementById('f-mobile').value.trim();
  const cname   = document.getElementById('f-cname').value.trim();
  const isQ     = (reason === 'Wrong Number' || reason === 'Call Dropped');
  const isProject = _chooseOptions.some(o => o.name === project && o.option_type === 'project');

  if (!agent)                              { showFormErr('Please select Agent Name!'); return; }
  if (isProject && !reason)                { showFormErr('Please select Category 2!'); return; }
  if (!isQ && !project)                    { showFormErr('Please select Choose!'); return; }
  if (isProject && !cat1)                  { showFormErr('Please select Category 1!'); return; }

  // Resolve Category 1 name from the ID for storage
  const cat1Name = isProject ? (_cat1Options.find(c => c.id === cat1)?.name || cat1) : '';
  if (!isQ && !cname)                      { showFormErr('Please enter Customer Name!'); return; }
  if (!isQ && !mobile)                     { showFormErr('Please enter Customer Mobile!'); return; }
  if (!isQ && !radioValues['f-bizrel'])    { showFormErr('Select Business Relativity!'); return; }
  if (!isQ && !radioValues['f-salescall']) { showFormErr('Select Sales Call Requested!'); return; }
  if (!isQ && !radioValues['f-channel'])   { showFormErr('Select Communication Channel!'); return; }
  if (!isQ && !radioValues['f-media'])     { showFormErr('Select Media Source!'); return; }
  if (!isQ && !radioValues['f-budget'])    { showFormErr('Select Budget!'); return; }
  if (!isQ && !radioValues['f-unit'])      { showFormErr('Select Unit Type!'); return; }

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
    direction: radioValues['f-direction'] || 'inbound',
    cname:     isQ ? '' : cname,
    mobile:    isQ ? '' : mobile,
    bizrel:    isQ ? '' : (radioValues['f-bizrel']    || ''),
    salescall: isQ ? '' : (radioValues['f-salescall'] || ''),
    channel:   isQ ? '' : (radioValues['f-channel']   || ''),
    media:     isQ ? '' : (radioValues['f-media']      || ''),
    budget:    isQ ? '' : (radioValues['f-budget']     || ''),
    unit:      isQ ? '' : (radioValues['f-unit']       || ''),
    extra: document.getElementById('f-extra').value.trim()
  };

  fetch(`${SB_URL_SCH}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY_SCH,
      'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      agent_name:            data.agent,
      call_direction:        data.direction,
      customer_name:         data.cname,
      customer_mobile:       data.mobile,
      project:               data.project,
      category_1:            data.category1,
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
  })
  .then(res => {
    clearTimeout(slowTimer);
    if (submissionId !== _activeSubmission) return;
    const liveBtn = document.getElementById('formSubmitBtn');
    if (liveBtn) setButtonLoading(liveBtn, false, '📤 Submit to Database');
    if (res.ok) {
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
      addOfflineCall({ ...data, _channel: window._activeChannel || 'call' });
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
  ['f-project','f-category1','f-category2','f-mobile','f-extra'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('f-cname').value = '';
  radioValues = { 'f-direction': 'inbound' };
  document.querySelectorAll('.radio-opt').forEach(o => o.classList.remove('selected'));
  const inboundOpt = document.querySelector('#f-direction .radio-opt');
  if (inboundOpt) inboundOpt.classList.add('selected');
  // أعد إظهار التفاصيل، وأخفِ التصنيفات حتى يتم اختيار مشروع فعلي
  const fullSection = document.getElementById('full-details-section');
  if (fullSection) fullSection.style.display = '';
  const category2 = document.getElementById('f-category2');
  if (category2) {
    category2.disabled = true;
    category2.innerHTML = '<option value="">Select sub-category...</option>';
  }
  toggleProjectCategoryFields();
  document.getElementById('form-success').style.display = 'none';
  document.getElementById('form-error').style.display   = 'none';
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
async function loadMyCallLog() {
  const agent     = document.getElementById('user-name').innerText.trim();
  const container = document.getElementById('tab-mylog');
  const today     = getLocalDateStr();

  container.innerHTML = `
    <div style="padding:16px;">
      <!-- ═══ REMINDERS SECTION ═══ -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="section-label" style="margin:0"><i class="fas fa-bell" style="color:#F59E0B;"></i> My Reminders</div>
          <button class="action-btn c-accent" onclick="loadMyReminders()" style="font-size:11px;padding:6px 12px;"><i class="fas fa-sync-alt"></i></button>
        </div>
        <div id="reminders-list"><div style="text-align:center;color:var(--muted);padding:12px;font-size:12px;">Loading...</div></div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div class="section-label" style="margin:0"><i class="fas fa-phone-alt"></i> My Log</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="date" id="mylog-from" class="form-input" style="width:140px;font-size:13px;" value="${today}">
          <input type="date" id="mylog-to"   class="form-input" style="width:140px;font-size:13px;" value="${today}">
          <button class="action-btn c-accent" onclick="fetchMyCallLog(document.getElementById('user-name').innerText.trim())"><i class="fas fa-search"></i> Filter</button>
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

    const data = [...calls, ...wasps].sort((a,b) => new Date(b.logged_at) - new Date(a.logged_at));

    if (!data.length) {
      container.innerHTML = '<div class="empty-state">No logs found for this period.</div>';
      return;
    }

    const total      = data.length;
    const totalCalls = calls.length;
    const totalWasps = wasps.length;
    const business   = data.filter(c => c.business_relativity === 'Business Related').length;
    const sales      = data.filter(c => c.sales_call_requested === 'Yes').length;

    let html = `
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
          </div>
          ${c.extra_notes&&c.extra_notes.trim()&&c.extra_notes!=='-' ? `
          <div style="margin-top:10px;padding:10px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);font-size:12px;color:var(--muted);">
            <i class="fas fa-sticky-note" style="margin-right:6px;color:var(--warn);"></i>${c.extra_notes}
          </div>` : ''}
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;

  } catch(e) {
    container.innerHTML = '<div class="empty-state">Connection error. Try again.</div>';
    console.error('fetchMyCallLog error:', e);
  }
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

  const projectOptions  = ['Sky Ridge Elite','Sky Ridge Executives','Zomra','Perla','Upviews','Jirian','Isla','Asking about the projects','Jirian campaign','Jirian Island campaign','Broker','Delayed sales call','EOI Refund','Collaboration request','Non-Business General Inquiry','Business General Inquiry','Complaint',"Shakira's Event"];
  const cat1Options     = ['Request','Complaint','Inquiry'];
  const reasonOptions   = ['Sales Lead','Events','EOI Refund','Wrong Number','Call Dropped','Resale','Data Update','Finishing Process','Delivery Date','Financial - Bounced Cheque','Financial - Postponing Cheque','Financial - Receiving Cheque','Financial - Cash Discount','Financial - Cash Payment','Financial - Changing Cheques','Financial - Collective Cheque','Financial - Down Payment','Financial - Due Payment','Financial - Payment Receipt','Financial - Maintenance Cheque','Financial - Pay In Advance','Financial - Payment Details','Financial - Redeposit','Financial - Relinquishment','Financial - Reschedule','Other','Unit Movement','Modification','Receiving Contract','EOI Payment','Pre Delivery Site Visit','Delegation','Construction Update','Cancellation','Delivery Inspection','Unit Upgrade','Unit Downgrade','Auto Cad','Sales - Attitude','Sales - Wrong Info'];
  const channelOptions  = ['Whatsapp','Mobile','Email','Alternative Mobile','SMS','N/A'];
  const mediaOptions    = ['Billboards','Saw site','Facebook','Instagram','Linkedin','Word of mouth','TV ad.','Youtube','N/A'];
  const budgetOptions   = ['0 - 10','10 - 20','20 +','N/A'];
  const unitOptions     = ['Apartment','Villa','Commercial','Admin','Twin House','Stand Alone House','Town House','N/A'];
  const bizrelOptions   = ['Business Related','Non-Business Related'];
  const salesOptions    = ['Yes','No','N/A'];

  function opts(list, current) {
    return list.map(o => `<option value="${o}" ${current === o ? 'selected' : ''}>${o}</option>`).join('');
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
              <select id="edit-cat1" class="form-input"><option value="">—</option>${opts(cat1Options, callData.category_1)}</select>
            </div>
          </div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px;">Category 2</label>
          <select id="edit-reason" class="form-input" onchange="toggleEditSections()">${opts(reasonOptions, callData.call_reason)}</select>
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
}

function toggleEditSections() {
  const reason = document.getElementById('edit-reason')?.value;
  const isQ = reason === 'Wrong Number' || reason === 'Call Dropped';
  const extra = document.getElementById('edit-extra-fields');
  const projFields = document.getElementById('edit-project-fields');
  if (extra) extra.style.display = isQ ? 'none' : '';
  if (projFields) projFields.style.display = isQ ? 'none' : '';
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
  const cname     = document.getElementById('edit-cname').value.trim();
  const mobile    = document.getElementById('edit-mobile').value.trim();
  const channel   = isQ ? '' : document.getElementById('edit-channel').value;
  const media     = isQ ? '' : document.getElementById('edit-media').value;
  const budget    = isQ ? '' : document.getElementById('edit-budget').value;
  const unit      = isQ ? '' : document.getElementById('edit-unit').value;
  const bizrel    = isQ ? '' : document.getElementById('edit-bizrel').value;
  const salescall = isQ ? '' : document.getElementById('edit-salescall').value;
  const extra     = document.getElementById('edit-extra').value.trim();

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
          call_reason:           reason,
          communication_channel: channel,
          media_source:          media,
          budget,
          unit_type:             unit,
          business_relativity:   bizrel,
          sales_call_requested:  salescall,
          extra_notes:           extra,
        })
      }
    );

    if (res.ok) {
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
    badge.style.cssText = 'position:fixed;top:12px;right:70px;z-index:9990;cursor:pointer;';
    badge.onclick = () => { switchTab('mylog'); };
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
