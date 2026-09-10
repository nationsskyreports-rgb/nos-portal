// ═══════════════════════════════════════════════════════════════
// NOS Portal — Agent Enhancements v1.0
// Self-contained: injects UI + styles + logic on DOMContentLoaded
// Features: Paste Caller ID, Call Timer, Reminder Alerts, Daily Target
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── Wait for page to be ready ──
  const _ready = (fn) => {
    if (document.readyState !== 'loading') setTimeout(fn, 600);
    else document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 600));
  };

  // ═════════════════════════════════════
  // INJECT STYLES
  // ═════════════════════════════════════
  function injectStyles() {
    const css = `
/* ── Paste Caller ID Button ── */
.paste-caller-btn {
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 14px; border-radius:11px;
  background:linear-gradient(135deg,#2563eb,#3b82f6);
  color:#fff; border:none; cursor:pointer;
  font-size:12px; font-weight:700; font-family:inherit;
  transition:all 0.2s; white-space:nowrap;
  box-shadow:0 2px 8px rgba(37,99,235,0.3);
}
.paste-caller-btn:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(37,99,235,0.4); }
.paste-caller-btn:active { transform:scale(0.97); }
.paste-caller-btn.pasted {
  background:linear-gradient(135deg,#059669,#10B981);
  box-shadow:0 2px 8px rgba(5,150,105,0.3);
}

/* ── Call Timer Widget ── */
.call-timer-widget {
  position:fixed; bottom:90px; right:20px; z-index:8000;
  background:var(--surface,#0f172a); border:1.5px solid var(--border,rgba(255,255,255,0.08));
  border-radius:18px; padding:12px 16px;
  box-shadow:0 8px 32px rgba(0,0,0,0.3);
  display:flex; align-items:center; gap:10px;
  font-family:'Plus Jakarta Sans',sans-serif;
  transition:all 0.3s cubic-bezier(0.4,0,0.2,1);
  opacity:0; transform:translateY(20px); pointer-events:none;
}
.call-timer-widget.visible { opacity:1; transform:translateY(0); pointer-events:all; }
.call-timer-widget.recording { border-color:rgba(239,68,68,0.5); }
.call-timer-widget.recording .ct-dot { background:#ef4444; animation:ct-pulse 1s infinite; }

.ct-dot { width:10px; height:10px; border-radius:50%; background:var(--muted,#64748b); flex-shrink:0; transition:background 0.3s; }
@keyframes ct-pulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:0.5;transform:scale(1.3);} }

.ct-time { font-family:'JetBrains Mono',monospace; font-size:20px; font-weight:800; color:var(--text,#e2e8f0); min-width:72px; text-align:center; letter-spacing:1px; }

.ct-btns { display:flex; gap:4px; }
.ct-btn {
  width:32px; height:32px; border-radius:10px;
  border:1px solid var(--border,rgba(255,255,255,0.08));
  background:var(--surface2,#1e293b); color:var(--muted,#64748b);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:12px; transition:all 0.15s;
}
.ct-btn:hover { color:var(--text,#e2e8f0); border-color:var(--primary,#2563eb); background:rgba(37,99,235,0.1); }
.ct-btn.active { color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); }

/* ── Reminder Alert Banner ── */
.reminder-alert-banner {
  position:fixed; top:0; left:0; right:0; z-index:9999;
  background:linear-gradient(135deg,#f59e0b,#d97706);
  color:#0f172a; padding:10px 20px;
  display:flex; align-items:center; gap:12px;
  font-size:13px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif;
  transform:translateY(-100%); transition:transform 0.4s cubic-bezier(0.4,0,0.2,1);
  box-shadow:0 4px 20px rgba(245,158,11,0.3);
}
.reminder-alert-banner.visible { transform:translateY(0); }
.reminder-alert-banner .ra-icon { font-size:20px; flex-shrink:0; }
.reminder-alert-banner .ra-text { flex:1; }
.reminder-alert-banner .ra-count {
  background:rgba(0,0,0,0.15); padding:4px 12px; border-radius:20px;
  font-size:12px; font-weight:800;
}
.reminder-alert-banner .ra-close {
  width:28px; height:28px; border-radius:8px; border:none;
  background:rgba(0,0,0,0.1); color:#0f172a; cursor:pointer;
  display:flex; align-items:center; justify-content:center; font-size:14px;
  transition:background 0.15s;
}
.reminder-alert-banner .ra-close:hover { background:rgba(0,0,0,0.2); }
.reminder-alert-banner .ra-action {
  padding:6px 14px; border-radius:8px; border:2px solid rgba(0,0,0,0.15);
  background:rgba(0,0,0,0.08); color:#0f172a; cursor:pointer;
  font-size:12px; font-weight:800; font-family:inherit; transition:all 0.15s;
}
.reminder-alert-banner .ra-action:hover { background:rgba(0,0,0,0.15); }

/* ── Daily Target Ring ── */
.daily-target-widget {
  background:var(--surface,#0f172a); border:1.5px solid var(--border,rgba(255,255,255,0.08));
  border-radius:16px; padding:16px; text-align:center;
  margin-bottom:14px;
}
.dt-ring-wrap { position:relative; width:90px; height:90px; margin:0 auto 10px; }
.dt-ring-svg { width:90px; height:90px; transform:rotate(-90deg); }
.dt-ring-bg { fill:none; stroke:var(--surface2,#1e293b); stroke-width:8; }
.dt-ring-fill { fill:none; stroke-width:8; stroke-linecap:round; transition:stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1), stroke 0.3s; }
.dt-center {
  position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center;
}
.dt-count { font-family:'Syne',sans-serif; font-size:24px; font-weight:900; color:var(--text,#e2e8f0); line-height:1; }
.dt-label { font-size:9px; font-weight:700; color:var(--muted,#64748b); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px; }
.dt-target-text { font-size:11px; color:var(--muted,#64748b); font-weight:600; }
.dt-edit-btn {
  margin-top:6px; padding:4px 12px; border-radius:8px;
  border:1px solid var(--border,rgba(255,255,255,0.08));
  background:transparent; color:var(--muted,#64748b); cursor:pointer;
  font-size:10px; font-weight:700; font-family:inherit; transition:all 0.15s;
}
.dt-edit-btn:hover { color:var(--primary,#2563eb); border-color:var(--primary,#2563eb); }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ═════════════════════════════════════
  // 1. PASTE CALLER ID
  // ═════════════════════════════════════
  function initPasteCallerID() {
    const mobileInput = document.getElementById('f-mobile');
    if (!mobileInput) return;

    // Find the parent container and inject the button
    const group = mobileInput.closest('.form-group');
    if (!group) return;

    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'margin-top:6px;display:flex;gap:6px;';
    btnWrap.innerHTML = `
      <button type="button" class="paste-caller-btn" id="paste-caller-btn" onclick="window._pasteCallerID()">
        <i class="fas fa-clipboard"></i> Paste Number
      </button>
      <span id="paste-status" style="font-size:11px;color:var(--muted);align-self:center;display:none;"></span>
    `;
    group.appendChild(btnWrap);

    // Global function
    window._pasteCallerID = async function () {
      const btn = document.getElementById('paste-caller-btn');
      const status = document.getElementById('paste-status');
      try {
        const text = await navigator.clipboard.readText();
        // Clean: keep only digits and + sign
        const cleaned = text.replace(/[^\d+]/g, '').trim();
        if (!cleaned || cleaned.length < 7) {
          status.style.display = 'inline';
          status.style.color = '#ef4444';
          status.textContent = '⚠ No valid number in clipboard';
          setTimeout(() => { status.style.display = 'none'; }, 3000);
          return;
        }

        mobileInput.value = cleaned;
        mobileInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Trigger auto-lookup if exists
        if (typeof onMobileInput === 'function') onMobileInput(cleaned);

        // Visual feedback
        btn.classList.add('pasted');
        btn.innerHTML = '<i class="fas fa-check"></i> Pasted!';
        status.style.display = 'inline';
        status.style.color = '#10B981';
        status.textContent = cleaned;

        setTimeout(() => {
          btn.classList.remove('pasted');
          btn.innerHTML = '<i class="fas fa-clipboard"></i> Paste Number';
        }, 2500);
      } catch (err) {
        // Clipboard permission denied — fallback to manual
        status.style.display = 'inline';
        status.style.color = '#f59e0b';
        status.textContent = '⚠ Clipboard blocked — use Ctrl+V';
        setTimeout(() => { status.style.display = 'none'; }, 3000);
      }
    };

    // Also allow Ctrl+Shift+V as a keyboard shortcut to paste into mobile field
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        window._pasteCallerID();
      }
    });
  }

  // ═════════════════════════════════════
  // 2. CALL TIMER
  // ═════════════════════════════════════
  let _timerInterval = null;
  let _timerSeconds = 0;
  let _timerRunning = false;

  function initCallTimer() {
    const widget = document.createElement('div');
    widget.className = 'call-timer-widget';
    widget.id = 'call-timer-widget';
    widget.innerHTML = `
      <div class="ct-dot"></div>
      <div class="ct-time" id="ct-display">00:00</div>
      <div class="ct-btns">
        <button class="ct-btn" id="ct-toggle" title="Start/Pause" onclick="window._toggleTimer()">
          <i class="fas fa-play"></i>
        </button>
        <button class="ct-btn" id="ct-reset" title="Reset" onclick="window._resetTimer()">
          <i class="fas fa-redo"></i>
        </button>
      </div>
    `;
    document.body.appendChild(widget);

    // Show timer when Call Log tab is active
    const checkTabVisibility = () => {
      const formTab = document.getElementById('tab-form');
      const timerW = document.getElementById('call-timer-widget');
      if (!formTab || !timerW) return;
      const isActive = formTab.classList.contains('active') || formTab.style.display === 'block';
      timerW.classList.toggle('visible', isActive);
    };

    // Override switchTab to hook into tab changes
    const origSwitch = window.switchTab;
    window.switchTab = function () {
      if (origSwitch) origSwitch.apply(this, arguments);
      setTimeout(checkTabVisibility, 50);
    };
    setTimeout(checkTabVisibility, 1000);

    window._toggleTimer = function () {
      const btn = document.getElementById('ct-toggle');
      const widget = document.getElementById('call-timer-widget');
      if (_timerRunning) {
        // Pause
        clearInterval(_timerInterval);
        _timerRunning = false;
        btn.innerHTML = '<i class="fas fa-play"></i>';
        btn.classList.remove('active');
        widget.classList.remove('recording');
      } else {
        // Start
        _timerRunning = true;
        btn.innerHTML = '<i class="fas fa-pause"></i>';
        btn.classList.add('active');
        widget.classList.add('recording');
        _timerInterval = setInterval(() => {
          _timerSeconds++;
          const m = String(Math.floor(_timerSeconds / 60)).padStart(2, '0');
          const s = String(_timerSeconds % 60).padStart(2, '0');
          document.getElementById('ct-display').textContent = `${m}:${s}`;
        }, 1000);
      }
    };

    window._resetTimer = function () {
      clearInterval(_timerInterval);
      _timerRunning = false;
      _timerSeconds = 0;
      document.getElementById('ct-display').textContent = '00:00';
      document.getElementById('ct-toggle').innerHTML = '<i class="fas fa-play"></i>';
      document.getElementById('ct-toggle').classList.remove('active');
      document.getElementById('call-timer-widget').classList.remove('recording');
    };
  }

  // ═════════════════════════════════════
  // 3. REMINDER NOTIFICATIONS
  // ═════════════════════════════════════
  function initReminderAlerts() {
    // Check for due reminders after a delay (let the page load first)
    setTimeout(checkDueReminders, 3000);
    // Re-check every 5 minutes
    setInterval(checkDueReminders, 5 * 60 * 1000);
  }

  async function checkDueReminders() {
    try {
      const session = JSON.parse(localStorage.getItem('nos_session') || 'null');
      if (!session || !session.name) return;

      const agent = session.name;
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

      const headers = {
        'apikey': typeof SB_KEY_SCH !== 'undefined' ? SB_KEY_SCH : '',
        'Authorization': `Bearer ${window._authToken || (typeof SB_KEY_SCH !== 'undefined' ? SB_KEY_SCH : '')}`
      };

      if (!headers.apikey) return;

      const url = `${typeof SB_URL_SCH !== 'undefined' ? SB_URL_SCH : ''}/rest/v1/call_reminders?agent_name=eq.${encodeURIComponent(agent)}&is_done=eq.false&reminder_date=lte.${today}&select=id,customer_name,customer_mobile,reminder_date,reminder_time,notes&order=reminder_date,reminder_time&limit=20`;

      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const reminders = await res.json();

      if (!reminders || !reminders.length) {
        // Hide banner if no reminders
        const existing = document.getElementById('reminder-alert-banner');
        if (existing) existing.classList.remove('visible');
        return;
      }

      // Count overdue vs today
      const overdue = reminders.filter(r => r.reminder_date < today).length;
      const todayCount = reminders.length - overdue;

      showReminderBanner(reminders.length, overdue, todayCount, reminders[0]);
    } catch (e) {
      // Silent fail
    }
  }

  function showReminderBanner(total, overdue, todayCount, firstReminder) {
    let banner = document.getElementById('reminder-alert-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'reminder-alert-banner';
      banner.id = 'reminder-alert-banner';
      document.body.appendChild(banner);
    }

    const overdueText = overdue > 0 ? `${overdue} overdue` : '';
    const todayText = todayCount > 0 ? `${todayCount} today` : '';
    const parts = [overdueText, todayText].filter(Boolean).join(' + ');

    const name = firstReminder.customer_name || firstReminder.customer_mobile || 'Unknown';

    banner.innerHTML = `
      <span class="ra-icon">🔔</span>
      <span class="ra-text">
        You have <strong>${total} pending reminder${total > 1 ? 's' : ''}</strong> (${parts})
        — Next: <strong>${name}</strong>
      </span>
      <span class="ra-count">${total}</span>
      <button class="ra-action" onclick="window._goToReminders()">View All</button>
      <button class="ra-close" onclick="this.parentElement.classList.remove('visible')">✕</button>
    `;

    setTimeout(() => banner.classList.add('visible'), 100);
  }

  window._goToReminders = function () {
    // Switch to Call Log tab and scroll to reminders section
    const banner = document.getElementById('reminder-alert-banner');
    if (banner) banner.classList.remove('visible');

    // Find and click the Call Log tab button
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn, idx) => {
      if (btn.textContent.includes('Call Log') && !btn.textContent.includes('My')) {
        btn.click();
      }
    });

    // Open reminders filter if available
    setTimeout(() => {
      if (typeof loadReminders === 'function') loadReminders();
      const remList = document.querySelector('#reminders-section, [id*="reminder"]');
      if (remList) remList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  };

  // ═════════════════════════════════════
  // 4. DAILY TARGET TRACKER
  // ═════════════════════════════════════
  const TARGET_KEY = 'nos_daily_target';
  const DEFAULT_TARGET = 30;

  function initDailyTarget() {
    // Inject into the agent-dashboard area (inside Call Log tab)
    const dashboard = document.getElementById('agent-dashboard');
    if (!dashboard) return;

    const target = parseInt(localStorage.getItem(TARGET_KEY)) || DEFAULT_TARGET;

    const widget = document.createElement('div');
    widget.className = 'daily-target-widget';
    widget.id = 'daily-target-widget';
    widget.innerHTML = buildTargetHTML(0, target);

    // Insert before the stats grid
    dashboard.insertBefore(widget, dashboard.firstChild);

    // Observe changes to dash-total to update the ring
    const totalEl = document.getElementById('dash-total');
    if (totalEl) {
      const observer = new MutationObserver(() => updateTargetRing());
      observer.observe(totalEl, { childList: true, characterData: true, subtree: true });
    }

    // Also check periodically
    setInterval(updateTargetRing, 5000);
    setTimeout(updateTargetRing, 2000);
  }

  function buildTargetHTML(current, target) {
    const pct = Math.min(100, Math.round((current / target) * 100));
    const circumference = 2 * Math.PI * 37; // r=37
    const offset = circumference - (pct / 100) * circumference;
    const color = pct >= 100 ? '#10B981' : pct >= 70 ? '#f59e0b' : '#3b82f6';

    return `
      <div style="display:flex;align-items:center;gap:16px;">
        <div class="dt-ring-wrap">
          <svg class="dt-ring-svg" viewBox="0 0 90 90">
            <circle class="dt-ring-bg" cx="45" cy="45" r="37"/>
            <circle class="dt-ring-fill" id="dt-ring-fill" cx="45" cy="45" r="37"
              stroke="${color}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div class="dt-center">
            <div class="dt-count" id="dt-current">${current}</div>
            <div class="dt-label">calls</div>
          </div>
        </div>
        <div style="flex:1;text-align:left;">
          <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:800;color:var(--text,#e2e8f0);margin-bottom:2px;">
            Daily Target
          </div>
          <div class="dt-target-text" id="dt-target-text">
            ${current} / ${target} calls (${pct}%)
          </div>
          <div style="margin-top:6px;height:6px;background:var(--surface2,#1e293b);border-radius:3px;overflow:hidden;">
            <div id="dt-progress-bar" style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1);"></div>
          </div>
          <button class="dt-edit-btn" onclick="window._editDailyTarget()">
            <i class="fas fa-cog"></i> Set Target
          </button>
        </div>
      </div>
    `;
  }

  function updateTargetRing() {
    const totalEl = document.getElementById('dash-total');
    if (!totalEl) return;
    const current = parseInt(totalEl.textContent) || 0;
    const target = parseInt(localStorage.getItem(TARGET_KEY)) || DEFAULT_TARGET;

    const pct = Math.min(100, Math.round((current / target) * 100));
    const circumference = 2 * Math.PI * 37;
    const offset = circumference - (pct / 100) * circumference;
    const color = pct >= 100 ? '#10B981' : pct >= 70 ? '#f59e0b' : '#3b82f6';

    const ring = document.getElementById('dt-ring-fill');
    const countEl = document.getElementById('dt-current');
    const textEl = document.getElementById('dt-target-text');
    const barEl = document.getElementById('dt-progress-bar');

    if (ring) { ring.style.strokeDashoffset = offset; ring.style.stroke = color; }
    if (countEl) countEl.textContent = current;
    if (textEl) textEl.textContent = `${current} / ${target} calls (${pct}%)`;
    if (barEl) { barEl.style.width = `${pct}%`; barEl.style.background = color; }
  }

  window._editDailyTarget = function () {
    const current = parseInt(localStorage.getItem(TARGET_KEY)) || DEFAULT_TARGET;
    // Use showPrompt if available, else prompt()
    if (typeof showPrompt === 'function') {
      showPrompt('Set Daily Target', String(current), 'How many calls is your daily goal?').then(val => {
        if (val !== null && !isNaN(parseInt(val))) {
          localStorage.setItem(TARGET_KEY, parseInt(val));
          updateTargetRing();
          if (typeof showToast === 'function') showToast(`Target set to ${parseInt(val)} calls`, 'success');
        }
      });
    } else {
      const val = prompt('Daily call target:', current);
      if (val !== null && !isNaN(parseInt(val))) {
        localStorage.setItem(TARGET_KEY, parseInt(val));
        updateTargetRing();
      }
    }
  };

  // ═════════════════════════════════════
  // INIT ALL
  // ═════════════════════════════════════
  _ready(function () {
    injectStyles();
    initPasteCallerID();
    initCallTimer();
    initReminderAlerts();
    initDailyTarget();
  });

})();
