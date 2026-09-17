/* ═══════════════════════════════════════════════════
   app-live-tracker.js — Live Break & Bathroom Timer
   Tracks actual start/stop times against daily limits
   (60 min breaks + 15 min bathroom) using break_sessions.
   ═══════════════════════════════════════════════════ */

const LT_LIMITS = { break: 60, bathroom: 15 }; // minutes allowed per day

let ltCurrentSession = null;   // { id, type, started_at: Date } — open session, if any
let ltTodaySessions  = [];     // completed sessions today: [{ type, started_at, ended_at }]
let ltTickTimer      = null;
let ltRefreshTimer   = null;

function ltHeaders(isWrite) {
  const h = {
    'apikey': SB_KEY_SCH,
    'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`,
  };
  if (isWrite) {
    h['Content-Type'] = 'application/json';
    h['Prefer'] = 'return=representation';
  }
  return h;
}

/* ─── INIT ─── */
async function initLiveTracker(agentId) {
  if (!agentId) return;
  window._ltAgentId = agentId;

  await ltLoadToday(agentId);
  ltRender();

  if (ltTickTimer) clearInterval(ltTickTimer);
  ltTickTimer = setInterval(ltRender, 1000); // live clock while a session is open

  if (ltRefreshTimer) clearInterval(ltRefreshTimer);
  ltRefreshTimer = setInterval(() => ltLoadToday(agentId).then(ltRender), 60000); // resync every minute
}

/* ─── LOAD TODAY'S SESSIONS ─── */
async function ltLoadToday(agentId) {
  const today = getLocalDateStr();
  try {
    const res = await fetch(
      `${SB_URL_SCH}/rest/v1/break_sessions?agent_id=eq.${agentId}&session_date=eq.${today}&select=*&order=started_at.asc`,
      { headers: ltHeaders(false) }
    );
    const rows = await res.json();
    if (!Array.isArray(rows)) return;

    ltTodaySessions  = [];
    ltCurrentSession = null;

    rows.forEach(r => {
      if (!r.ended_at) {
        ltCurrentSession = { id: r.id, type: r.type, started_at: new Date(r.started_at) };
      } else {
        ltTodaySessions.push({
          type:       r.type,
          started_at: new Date(r.started_at),
          ended_at:   new Date(r.ended_at),
        });
      }
    });
  } catch (e) { console.error('Live tracker load error:', e); }
}

/* ─── CALCULATIONS ─── */
function ltUsedMinutes(type) {
  let ms = 0;
  ltTodaySessions.filter(s => s.type === type).forEach(s => { ms += (s.ended_at - s.started_at); });
  if (ltCurrentSession && ltCurrentSession.type === type) {
    ms += (Date.now() - ltCurrentSession.started_at);
  }
  return ms / 60000;
}

function ltFormatClock(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ─── RENDER ─── */
function ltRender() {
  ['break', 'bathroom'].forEach(type => {
    const used  = ltUsedMinutes(type);
    const limit = LT_LIMITS[type];
    const pct   = Math.min(100, (used / limit) * 100);

    const fill = document.getElementById(`lt-${type}-fill`);
    const nums = document.getElementById(`lt-${type}-numbers`);

    if (fill) {
      fill.style.width = pct + '%';
      fill.classList.remove('lt-warn', 'lt-danger');
      if (used >= limit) fill.classList.add('lt-danger');
      else if (used >= limit * 0.8) fill.classList.add('lt-warn');
    }
    if (nums) {
      const remaining = limit - used;
      nums.innerText = remaining >= 0
        ? `${used.toFixed(1)} / ${limit} min — ${remaining.toFixed(1)} left`
        : `${used.toFixed(1)} / ${limit} min — over by ${Math.abs(remaining).toFixed(1)}`;
      nums.style.color = used >= limit ? 'var(--danger)' : (used >= limit * 0.8 ? 'var(--warn)' : '');
    }
  });

  const breakBtn    = document.getElementById('lt-break-btn');
  const bathroomBtn = document.getElementById('lt-bathroom-btn');
  const banner      = document.getElementById('lt-active-banner');
  const activeText  = document.getElementById('lt-active-text');
  const activeTimer = document.getElementById('lt-active-timer');

  if (ltCurrentSession) {
    const isBreak = ltCurrentSession.type === 'break';
    if (banner)      banner.style.display = 'flex';
    if (activeText)  activeText.innerText  = isBreak ? '☕ Break in progress' : '🚻 Bathroom in progress';
    if (activeTimer) activeTimer.innerText = ltFormatClock(Date.now() - ltCurrentSession.started_at);

    if (breakBtn) {
      if (isBreak) {
        breakBtn.disabled = false;
        breakBtn.classList.add('c-danger');
        breakBtn.innerHTML = '<i class="fas fa-stop"></i> End Break';
      } else {
        breakBtn.disabled = true;
        breakBtn.classList.remove('c-danger');
      }
    }
    if (bathroomBtn) {
      if (!isBreak) {
        bathroomBtn.disabled = false;
        bathroomBtn.classList.add('c-danger');
        bathroomBtn.innerHTML = '<i class="fas fa-stop"></i> End Bathroom';
      } else {
        bathroomBtn.disabled = true;
        bathroomBtn.classList.remove('c-danger');
      }
    }
  } else {
    if (banner) banner.style.display = 'none';
    if (breakBtn) {
      breakBtn.disabled = false;
      breakBtn.classList.remove('c-danger');
      breakBtn.innerHTML = '<i class="fas fa-coffee"></i> Start Break';
    }
    if (bathroomBtn) {
      bathroomBtn.disabled = false;
      bathroomBtn.classList.remove('c-danger');
      bathroomBtn.innerHTML = '<i class="fas fa-restroom"></i> Start Bathroom';
    }
  }
}

/* ─── START / STOP ─── */
async function ltToggle(type) {
  const agentId = window._ltAgentId || window.schMyAgentId;
  if (!agentId) { showToast('❌', 'Error', 'Agent not found!', 'danger', 4000); return; }

  try {
    if (ltCurrentSession) {
      if (ltCurrentSession.type !== type) return; // the other button is disabled, shouldn't happen
      await fetch(`${SB_URL_SCH}/rest/v1/break_sessions?id=eq.${ltCurrentSession.id}`, {
        method: 'PATCH',
        headers: ltHeaders(true),
        body: JSON.stringify({ ended_at: new Date().toISOString() }),
      });
      showToast(type === 'break' ? '☕' : '🚻', `${type === 'break' ? 'Break' : 'Bathroom'} ended`, 'Timer stopped', 'info', 3000);
    } else {
      const today = getLocalDateStr();
      const res = await fetch(`${SB_URL_SCH}/rest/v1/break_sessions`, {
        method: 'POST',
        headers: ltHeaders(true),
        body: JSON.stringify({ agent_id: agentId, session_date: today, type, started_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Insert failed');
      showToast(type === 'break' ? '☕' : '🚻', `${type === 'break' ? 'Break' : 'Bathroom'} started`, 'Timer running', 'success', 3000);
    }
  } catch (e) {
    console.error(e);
    showToast('❌', 'Failed', 'Could not update timer, try again.', 'danger', 4000);
  } finally {
    await ltLoadToday(agentId);
    ltRender();
  }
}

window.initLiveTracker = initLiveTracker;
window.ltToggle        = ltToggle;
