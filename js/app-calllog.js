/* ═══════════════════════════════════════════════════
   app-calllog.js — Call Log Form, Steps, Customer Search
   ═══════════════════════════════════════════════════ */

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

/* ─── QUICK LOG (WITH SUPABASE) ─── */

function quickLogCall(reason) {
  const agent = document.getElementById('f-agent').value;
  if (!agent) { customAlert('Error', 'Please select Agent Name first!'); return; }

  showToast('⏳', 'Logging...', reason + ' — Please wait...', 'info', 4000);

  const gasAction = (_activeChannel === 'whatsapp') ? 'submitWhatsAppLog' : 'submitCallLog';
  const data = {
    agent, reason,
    cname: '', mobile: '', bizrel: '', salescall: '',
    channel: '', media: '', budget: '', unit: '', extra: ''
  };

  const submissionId = ++_activeSubmission;

  // 1. Supabase — بنستنى الرد ✅
  fetch(`${SB_URL_SCH}/rest/v1/call_logs`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      agent_name: data.agent, customer_name: '', customer_mobile: '',
      call_reason: data.reason, communication_channel: '', media_source: '',
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
    showToast('✅', 'Quick Logged!', reason, 'success', 3000);
    loadLastTwoCalls(agent);
  })
  .catch(e => {
    if (submissionId !== _activeSubmission) return;
    console.error('Quick Log Error:', e);
    showFormErr('Connection error. Please try again.');
  });

  // 2. GAS — Fire and Forget في الخلفية 🔥
  gasRun(gasAction, data)
    .catch(e => console.warn('GAS sync failed (non-critical):', e));
}

/* ─── SUBMIT FORM (FIXED) ─── */
function submitCallLogForm() {
  const agent  = document.getElementById('f-agent').value;
  const reason = document.getElementById('f-reason').value;
  const mobile = document.getElementById('f-mobile').value.trim();
  const cname  = document.getElementById('f-cname').value.trim();
  const isQ    = (reason === 'Wrong Number' || reason === 'Call Dropped');

  if (!agent)                              { showFormErr('Please select Agent Name!'); return; }
  if (!reason)                             { showFormErr('Please select Call Reason!'); return; }
  if (!isQ && !cname)                      { showFormErr('Please enter Customer Name!'); return; }
  if (!isQ && !mobile)                     { showFormErr('Please enter Customer Mobile!'); return; }
  if (!isQ && !radioValues['f-bizrel'])    { showFormErr('Select Business Relativity!'); return; }
  if (!isQ && !radioValues['f-salescall']) { showFormErr('Select Sales Call Requested!'); return; }
  if (!isQ && !radioValues['f-channel'])   { showFormErr('Select Communication Channel!'); return; }
  if (!isQ && !radioValues['f-media'])     { showFormErr('Select Media Source!'); return; }
  if (!isQ && !radioValues['f-budget'])    { showFormErr('Select Budget!'); return; }
  if (!isQ && !radioValues['f-unit'])      { showFormErr('Select Unit Type!'); return; }

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

  // Supabase
  fetch(`${SB_URL_SCH}/rest/v1/call_logs`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
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
      showToast('✅', 'Call Logged!', cname ? cname + ' — ' + mobile : reason, 'success', 5000);
      loadLastTwoCalls(data.agent);
    } else {
      showFormErr('Something went wrong. Please try again.');
    }
  })
  .catch(err => {
    clearTimeout(slowTimer);
    if (submissionId !== _activeSubmission) return;
    const liveBtnErr = document.getElementById('formSubmitBtn');
    if (liveBtnErr) setButtonLoading(liveBtnErr, false, '📤 Submit to Database');
    showFormErr('Connection error. Please try again.');
    console.error('submitCallLogForm error:', err);
  });

  // GAS — Fire and Forget
  const gasAction = (_activeChannel === 'whatsapp') ? 'submitWhatsAppLog' : 'submitCallLog';
  gasRun(gasAction, data).catch(e => console.warn('GAS sync failed:', e));
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

  const searchBtn = document.querySelector('[onclick="searchCustomer()"]');
  if (searchBtn) setButtonLoading(searchBtn, true, 'Searching...');

  const normalizedQuery = query.replace(/^0+/, '');

  fetch(
    `${SB_URL_SCH}/rest/v1/call_logs?or=(customer_name.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(normalizedQuery)}%25)&order=logged_at.desc&limit=20`,
    { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
  )
  .then(r => r.json())
  .then(results => {
    if (searchBtn) setButtonLoading(searchBtn, false, '🔍 Search');
    if (!results || !results.length) {
      resultsDiv.innerHTML = `<div class="empty-state">No results found for "${query}"</div>`;
      return;
    }
    let html = `<div style="font-size:13px;font-weight:700;color:var(--muted);margin-bottom:10px;">${results.length} result(s) found</div>`;
    results.forEach(r => {
      const reasonColor = (r.call_reason === 'Wrong Number' || r.call_reason === 'Call Dropped') ? 'var(--muted)' : 'var(--primary)';
      html += `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--primary);margin-bottom:8px;">📞 Call</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;background:var(--primary-gradient);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:13px;">${r.customer_name?r.customer_name[0].toUpperCase():'?'}</div>
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--text);">${r.customer_name||'N/A'}</div>
              <div style="font-size:12px;color:var(--muted);">${r.customer_mobile||'-'}</div>
            </div>
          </div>
          <div style="font-size:11px;color:var(--muted);">${r.logged_at ? new Date(r.logged_at).toLocaleDateString('en-GB') : ''}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
          <div><span style="color:var(--muted);">Reason: </span><span style="font-weight:600;color:${reasonColor};">${r.call_reason||'-'}</span></div>
          <div><span style="color:var(--muted);">Agent: </span><span style="font-weight:600;color:var(--text);">${r.agent_name||'-'}</span></div>
          <div><span style="color:var(--muted);">Media: </span><span style="font-weight:600;color:var(--text);">${r.media_source||'-'}</span></div>
          <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:600;color:var(--text);">${r.communication_channel||'-'}</span></div>
          <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:600;color:var(--text);">${r.budget||'-'}</span></div>
          <div><span style="color:var(--muted);">Unit: </span><span style="font-weight:600;color:var(--text);">${r.unit_type||'-'}</span></div>
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

/* ─── LAST TWO CALLS ─── */
async function loadLastTwoCalls(agentName) {
  try {
    const res  = await fetch(
      `${SB_URL_SCH}/rest/v1/call_logs?agent_name=eq.${encodeURIComponent(agentName)}&order=logged_at.desc&limit=2`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();
    const el   = document.getElementById('last-two-calls');
    if (!el) return;
    if (!data || !data.length) { el.innerHTML = ''; return; }
    el.innerHTML = data.map(c => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:10px;background:var(--primary-gradient);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📞</div>
            <div>
              <div style="font-size:13px;font-weight:800;color:var(--text);">${c.customer_name || '—'}</div>
              <div style="font-size:11px;color:var(--muted);font-family:monospace;">${c.customer_mobile || '—'}</div>
            </div>
          </div>
          <div style="font-size:10px;color:var(--muted);white-space:nowrap;">${c.logged_at ? new Date(c.logged_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;font-size:11px;">
          <div><span style="color:var(--muted);">Reason: </span><span style="font-weight:700;color:var(--primary);">${c.call_reason||'—'}</span></div>
          <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:700;color:var(--text);">${c.communication_channel||'—'}</span></div>
          <div><span style="color:var(--muted);">Media: </span><span style="font-weight:700;color:var(--text);">${c.media_source||'—'}</span></div>
          <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:700;color:var(--text);">${c.budget||'—'}</span></div>
          <div><span style="color:var(--muted);">Unit: </span><span style="font-weight:700;color:var(--text);">${c.unit_type||'—'}</span></div>
          <div><span style="color:var(--muted);">Sales: </span><span style="font-weight:700;color:var(--text);">${c.sales_call_requested||'—'}</span></div>
        </div>
        ${c.extra_notes&&c.extra_notes.trim()&&c.extra_notes!=='-'?`<div style="margin-top:8px;padding:8px;background:var(--surface);border-radius:8px;border:1px solid var(--border);font-size:11px;color:var(--muted);"><i class="fas fa-sticky-note" style="margin-right:5px;color:var(--warn);"></i>${c.extra_notes}</div>`:''}
      </div>`).join('');
  } catch(e) { console.warn('loadLastTwoCalls error:', e); }
}

/* ─── STEP 1 SEARCH ─── */
async function step1SearchCustomer() {
  const query     = (document.getElementById('step1-search-input')?.value || '').trim();
  const resultsEl = document.getElementById('step1-search-results');
  const btn       = document.getElementById('inline-search-btn');
  if (!query || !resultsEl) return;

  setButtonLoading(btn, true, 'Searching...');
  resultsEl.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0;"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
  const normalizedQuery = query.replace(/^0+/, '');

  try {
    const res  = await fetch(
      `${SB_URL_SCH}/rest/v1/call_logs?or=(customer_name.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(query)}%25,customer_mobile.ilike.%25${encodeURIComponent(normalizedQuery)}%25)&order=logged_at.desc&limit=5`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();

    let html = '';
    if (!data || !data.length) {
      html = `<div style="font-size:12px;color:var(--muted);padding:4px 0;">No results for "${query}"</div>`;
    } else {
      html += `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">📋 ${data.length} result(s)</div>`;
      html += data.map(c => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:6px;font-size:12px;">
          <div style="font-weight:700;color:var(--text);">${c.customer_name || 'N/A'}</div>
          <div style="color:var(--muted);font-family:monospace;">${c.customer_mobile || '-'}</div>
          <div style="color:var(--muted);">${c.call_reason || '-'} · ${c.agent_name || '-'}</div>
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
async function loadMyCallLog() {
  const agent     = document.getElementById('user-name').innerText.trim();
  const container = document.getElementById('tab-mylog');
  const today     = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div style="padding:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
        <div class="section-label" style="margin:0"><i class="fas fa-phone-alt"></i> My Call Log</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="date" id="mylog-from" class="form-input" style="width:140px;font-size:13px;" value="${today}">
          <input type="date" id="mylog-to"   class="form-input" style="width:140px;font-size:13px;" value="${today}">
          <button class="action-btn c-accent" onclick="fetchMyCallLog('${agent}')"><i class="fas fa-search"></i> Filter</button>
        </div>
      </div>
      <div id="mylog-content"><div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading...</div></div>
    </div>`;

  await fetchMyCallLog(agent);
}

async function fetchMyCallLog(agent) {
  const container = document.getElementById('mylog-content');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading...</div>';

  try {
    const fromDate = document.getElementById('mylog-from')?.value;
    const toDate   = document.getElementById('mylog-to')?.value;
    if (!fromDate || !toDate) return;

    const fromISO = new Date(fromDate).toISOString();
    const toISO   = new Date(toDate + 'T23:59:59').toISOString();

    const res  = await fetch(
      `${SB_URL_SCH}/rest/v1/call_logs?agent_name=eq.${encodeURIComponent(agent)}&logged_at=gte.${fromISO}&logged_at=lte.${toISO}&order=logged_at.desc`,
      { headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${SB_KEY_SCH}` } }
    );
    const data = await res.json();

    if (!data || !data.length) {
      container.innerHTML = '<div class="empty-state">No calls found for this period.</div>';
      return;
    }

    const total    = data.length;
    const business = data.filter(c => c.business_relativity === 'Business Related').length;
    const sales    = data.filter(c => c.sales_call_requested === 'Yes').length;

    let html = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Total Calls</div>
          <div style="font-size:24px;font-weight:800;color:var(--primary);">${total}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Business</div>
          <div style="font-size:24px;font-weight:800;color:#059669;">${business}</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">Sales Req.</div>
          <div style="font-size:24px;font-weight:800;color:#3b82f6;">${sales}</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">`;

    data.forEach(c => {
      const time = c.logged_at ? new Date(c.logged_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '';
      const date = c.logged_at ? new Date(c.logged_at).toLocaleDateString('en-GB') : '';
      const isQ  = c.call_reason === 'Wrong Number' || c.call_reason === 'Call Dropped';
      const reasonColor = isQ ? 'var(--muted)' : 'var(--primary)';

      html += `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:38px;height:38px;background:var(--primary-gradient);border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">📞</div>
              <div>
                <div style="font-weight:800;font-size:14px;color:var(--text);">${c.customer_name || '—'}</div>
                <div style="font-size:12px;color:var(--muted);font-family:monospace;">${c.customer_mobile || '—'}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:700;color:var(--primary);">${time}</div>
              <div style="font-size:11px;color:var(--muted);">${date}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;">
            <div><span style="color:var(--muted);">Reason: </span><span style="font-weight:700;color:${reasonColor};">${c.call_reason||'—'}</span></div>
            <div><span style="color:var(--muted);">Channel: </span><span style="font-weight:600;color:var(--text);">${c.communication_channel||'—'}</span></div>
            <div><span style="color:var(--muted);">Media: </span><span style="font-weight:600;color:var(--text);">${c.media_source||'—'}</span></div>
            <div><span style="color:var(--muted);">Budget: </span><span style="font-weight:600;color:var(--text);">${c.budget||'—'}</span></div>
            <div><span style="color:var(--muted);">Unit: </span><span style="font-weight:600;color:var(--text);">${c.unit_type||'—'}</span></div>
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
