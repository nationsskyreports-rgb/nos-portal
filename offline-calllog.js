/* ═══════════════════════════════════════════════════
   NOS PORTAL — offline-calllog.js
   Offline support for Call Log with auto-sync
   
   أضف في الـ HTML بعد app.js:
   <script src="offline-calllog.js"></script>
   ═══════════════════════════════════════════════════ */

const OFFLINE_KEY = 'nos_offline_calls';

/* ── BADGE STYLES ── */
(function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    #offline-badge {
      display: none;
      position: fixed;
      top: 68px; left: 16px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 8px 14px;
      border-radius: 50px;
      font-size: 12px;
      font-weight: 700;
      font-family: 'Plus Jakarta Sans', sans-serif;
      z-index: 9000;
      box-shadow: 0 4px 16px rgba(245,158,11,0.4);
      cursor: pointer;
      align-items: center;
      gap: 8px;
      animation: badgeIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
      border: 1px solid rgba(255,255,255,0.2);
    }
    #offline-badge.show { display: flex; }
    @keyframes badgeIn {
      from { opacity:0; transform: translateX(-20px) scale(0.8); }
      to   { opacity:1; transform: translateX(0) scale(1); }
    }
    #offline-badge .badge-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: white; opacity: 0.8;
      animation: dotPulse 1.5s ease-in-out infinite;
    }
    @keyframes dotPulse {
      0%,100% { opacity: 0.8; transform: scale(1); }
      50%      { opacity: 0.4; transform: scale(0.7); }
    }

    #offline-status-bar {
      display: none;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      margin: 8px 16px 0;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    #offline-status-bar.offline {
      display: flex;
      background: rgba(239,68,68,0.1);
      border: 1.5px solid rgba(239,68,68,0.3);
      color: #ef4444;
    }
    #offline-status-bar.syncing {
      display: flex;
      background: rgba(245,158,11,0.1);
      border: 1.5px solid rgba(245,158,11,0.3);
      color: #f59e0b;
    }
    #offline-status-bar.synced {
      display: flex;
      background: rgba(5,150,105,0.1);
      border: 1.5px solid rgba(5,150,105,0.3);
      color: #059669;
      animation: syncedFade 3s ease forwards;
    }
    @keyframes syncedFade {
      0%,70% { opacity: 1; }
      100%    { opacity: 0; }
    }
  `;
  document.head.appendChild(s);

  /* Badge */
  const badge = document.createElement('div');
  badge.id = 'offline-badge';
  badge.innerHTML = `<div class="badge-dot"></div><span id="offline-badge-text">0 pending</span>`;
  badge.title = 'Pending calls — click to sync now';
  badge.onclick = () => syncOfflineCalls();
  document.body.appendChild(badge);

  /* Status bar — يظهر في تاب الـ Call Log */
  const bar = document.createElement('div');
  bar.id = 'offline-status-bar';
  document.body.appendChild(bar);
})();


/* ── STORAGE HELPERS ── */
function getOfflineCalls() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY)) || []; }
  catch(e) { return []; }
}

function saveOfflineCalls(calls) {
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(calls));
}

function addOfflineCall(data) {
  const calls = getOfflineCalls();
  calls.push({ ...data, _offlineId: Date.now(), _savedAt: new Date().toISOString() });
  saveOfflineCalls(calls);
  updateBadge();
}

function removeOfflineCall(id) {
  const calls = getOfflineCalls().filter(c => c._offlineId !== id);
  saveOfflineCalls(calls);
  updateBadge();
}


/* ── BADGE UPDATE ── */
function updateBadge() {
  const calls  = getOfflineCalls();
  const badge  = document.getElementById('offline-badge');
  const text   = document.getElementById('offline-badge-text');
  if (!badge) return;

  if (calls.length > 0) {
    badge.classList.add('show');
    text.textContent = `${calls.length} pending call${calls.length > 1 ? 's' : ''}`;
  } else {
    badge.classList.remove('show');
  }
}


/* ── STATUS BAR ── */
function setStatusBar(state, msg) {
  const bar = document.getElementById('offline-status-bar');
  if (!bar) return;

  const icons = {
    offline:  '🔴',
    syncing:  '🔄',
    synced:   '✅',
  };

  bar.className = state;
  bar.innerHTML = `<span>${icons[state] || 'ℹ️'}</span><span>${msg}</span>`;

  /* ابعت للـ call log tab */
  const callLogTab = document.getElementById('tab-form');
  if (callLogTab && !callLogTab.querySelector('#offline-status-bar')) {
    callLogTab.insertBefore(bar, callLogTab.firstChild);
  }

  if (state === 'synced') {
    setTimeout(() => { bar.className = ''; bar.innerHTML = ''; }, 3000);
  }
}


/* ── SUPABASE INSERT HELPER ── */
function sbInsertCallLog(data, savedAt) {
  const SB_URL = window.SB_URL_SCH;
  const SB_KEY = window.SB_KEY_SCH;
  if (!SB_URL || !SB_KEY) return Promise.resolve();

  const isQ = (data.reason === 'Wrong Number' || data.reason === 'Call Dropped');

  return fetch(`${SB_URL}/rest/v1/call_logs`, {
    method: 'POST',
    headers: {
      'apikey':        SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal'
    },
    body: JSON.stringify({
      agent_name:            data.agent,
      customer_name:         isQ ? null : (data.cname  || null),
      customer_mobile:       isQ ? null : (data.mobile || null),
      call_reason:           data.reason,
      communication_channel: isQ ? null : (data.channel   || null),
      media_source:          isQ ? null : (data.media     || null),
      business_relativity:   isQ ? null : (data.bizrel    || null),
      sales_call_requested:  isQ ? null : (data.salescall || null),
      budget:                isQ ? null : (data.budget    || null),
      unit_type:             isQ ? null : (data.unit      || null),
      extra_notes:           data.extra || null,
      logged_at:             savedAt || new Date().toISOString(),
    })
  }).catch(e => console.warn('SB insert failed:', e));
}


/* ── SYNC OFFLINE CALLS ── */
async function syncOfflineCalls() {
  const calls = getOfflineCalls();
  if (!calls.length) return;
  if (!navigator.onLine) {
    setStatusBar('offline', `You're offline — ${calls.length} call(s) pending sync`);
    return;
  }

  setStatusBar('syncing', `Syncing ${calls.length} pending call(s)...`);

  let synced = 0;
  for (const call of calls) {
    try {
      const { _offlineId, _savedAt, ...data } = call;
      const action = data._channel === 'whatsapp' ? 'submitWhatsAppLog' : 'submitCallLog';
      delete data._channel;

      // ✅ حفظ في Supabase أولاً — مستقل عن GAS
      await sbInsertCallLog(data, _savedAt);

      // ✅ ثم GAS
      const res = await gasRun(action, data);
      if (res.status === 'success') {
        removeOfflineCall(_offlineId);
        synced++;
      }
    } catch(e) {
      console.warn('Sync failed for call:', call._offlineId);
    }
  }

  const remaining = getOfflineCalls().length;
  if (synced > 0 && remaining === 0) {
    setStatusBar('synced', `${synced} call(s) synced successfully!`);
    if (window.showToast) showToast('✅', 'Calls Synced!', `${synced} pending call(s) uploaded successfully.`, 'success', 5000);
  } else if (remaining > 0) {
    setStatusBar('offline', `${remaining} call(s) still pending — check connection`);
  }

  updateBadge();
}


/* ── PATCH submitCallLogForm ── */
(function patchCallLog() {
  const wait = setInterval(() => {
    if (typeof window.submitCallLogForm !== 'function' || typeof window.gasRun !== 'function') return;
    clearInterval(wait);

    const _origSubmit = window.submitCallLogForm;

    window.submitCallLogForm = function() {
      /* لو أونلاين — شتغل عادي */
      if (navigator.onLine) {
        _origSubmit.apply(this, arguments);
        return;
      }

      /* أوف لاين — احفظ محلياً */
      const agent   = document.getElementById('f-agent')?.value;
      const reason  = document.getElementById('f-reason')?.value;
      const mobile  = document.getElementById('f-mobile')?.value?.trim();
      const cname   = document.getElementById('f-cname')?.value?.trim();
      const isQ     = (reason === 'Wrong Number' || reason === 'Call Dropped');

      if (!agent)  { showFormErr('Please select Agent Name!'); return; }
      if (!reason) { showFormErr('Please select Call Reason!'); return; }
      if (!isQ && !cname)  { showFormErr('Please enter Customer Name!'); return; }
      if (!isQ && !mobile) { showFormErr('Please enter Customer Mobile!'); return; }

      const data = {
        agent, reason,
        cname:     isQ ? '' : cname,
        mobile:    isQ ? '' : mobile,
        bizrel:    isQ ? '' : (window.radioValues?.['f-bizrel']    || ''),
        salescall: isQ ? '' : (window.radioValues?.['f-salescall'] || ''),
        channel:   isQ ? '' : (window.radioValues?.['f-channel']   || ''),
        media:     isQ ? '' : (window.radioValues?.['f-media']     || ''),
        budget:    isQ ? '' : (window.radioValues?.['f-budget']    || ''),
        unit:      isQ ? '' : (window.radioValues?.['f-unit']      || ''),
        extra:     document.getElementById('f-extra')?.value?.trim() || '',
        _channel:  window._activeChannel || 'call',
      };

      addOfflineCall(data);

      if (window.showResultPopup) {
        showResultPopup(
          'success',
          'Saved Offline 📥',
          'No internet connection. Call saved locally and will sync automatically when you\'re back online.',
          'Got it!',
          () => { if (typeof window.resetCallForm === 'function') window.resetCallForm(); }
        );
      } else if (window.showToast) {
        showToast('📥', 'Saved Offline!', 'Will sync when connection is restored.', 'warn', 6000);
        if (typeof window.resetCallForm === 'function') window.resetCallForm();
      }

      setStatusBar('offline', `You're offline — ${getOfflineCalls().length} call(s) pending sync`);
    };

    console.log('%c Offline Call Log ✓ ', 'background:#f59e0b;color:#000;font-weight:800;border-radius:4px;padding:4px 8px;');
  }, 150);
})();


/* ── NETWORK LISTENERS ── */
window.addEventListener('online', () => {
  console.log('Back online — syncing...');
  setTimeout(syncOfflineCalls, 1000);
});

window.addEventListener('offline', () => {
  setStatusBar('offline', "You're offline — calls will be saved locally");
  if (window.showToast) {
    showToast('🔴', 'You\'re Offline', 'Call logs will be saved locally and synced when connection is restored.', 'warn', 8000);
  }
});


/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  updateBadge();

  /* لو فيه pending calls ومتصل، sync فوراً */
  if (navigator.onLine && getOfflineCalls().length > 0) {
    setTimeout(syncOfflineCalls, 2000);
  }

  if (!navigator.onLine) {
    setStatusBar('offline', "You're offline — calls will be saved locally");
  }
});
