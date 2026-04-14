/* ═══════════════════════════════════════════════════
   app-schedule.js — Schedule Render & loadAgentSchedule
   ═══════════════════════════════════════════════════ */

let schShiftTypes = [];

/* ─── 09. SCHEDULE RENDER (GAS data) ─── */
function renderSchedule(scheduleData) {
  const container = document.getElementById('schedule-content');
  if (typeof scheduleData === 'string') {
    container.innerHTML = scheduleData.trim() ? scheduleData : '<div class="empty-state">No schedule found.</div>';
    return;
  }
  if (!scheduleData || !scheduleData.length) {
    container.innerHTML = '<div class="empty-state">No schedule found.</div>';
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const dayOfWeek     = today.getDay();
  const weekStart     = new Date(today); weekStart.setDate(today.getDate() - dayOfWeek);
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
      if (displayShift) html += `<div class="nos-shift-time${shiftClass}" style="flex-shrink:0">${displayShift}</div>`;
      html += badge;
      if (d.isToday) html += '<span class="nos-today-badge">TODAY</span>';
      html += '</div></div>';
    });
    html += '</div></div>';
    return html;
  }

  container.innerHTML = `<div class="sched-container">${buildWeekHtml(thisWeek,'📅 THIS WEEK')}${buildWeekHtml(nextWeek,'📆 NEXT WEEK')}</div>`;
}


/* ─── 09. LOAD AGENT SCHEDULE (Supabase) ─── */
async function loadAgentSchedule() {
  schMyAgentId  = null;
  schShiftTypes = [];
  const agentName = document.getElementById('user-name').innerText.trim();
  const container = document.getElementById('schedule-content');
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading...</div>';

  const [agents, shifts] = await Promise.all([
    sbFetchSch('agents?select=id,formal_name&status=eq.Active'),
    sbFetchSch('shift_types?select=id,name,start_time,end_time&is_active=eq.true')
  ]);
  schShiftTypes = shifts || [];

  const me = (agents||[]).find(a => a.formal_name.trim().toLowerCase() === agentName.trim().toLowerCase());
  if (me) schMyAgentId = me.id;
  if (!schMyAgentId) { container.innerHTML = '<div class="empty-state">Schedule not found.</div>'; return; }

  const today    = new Date(); today.setHours(0,0,0,0);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const curDay   = today.getDay();

  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - curDay);
  const nextWeekStart = new Date(thisWeekStart); nextWeekStart.setDate(thisWeekStart.getDate() + 7);
  const nextWeekEnd   = new Date(nextWeekStart); nextWeekEnd.setDate(nextWeekStart.getDate() + 6); nextWeekEnd.setHours(23,59,59,999);
  const thisWeekEnd   = new Date(thisWeekStart); thisWeekEnd.setDate(thisWeekStart.getDate() + 6); thisWeekEnd.setHours(23,59,59,999);

  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const pubWeeks = await sbFetchSch('schedule_weeks?select=id&status=eq.Published');
  const publishedWeekIds = (pubWeeks||[]).map(w => w.id).join(',');
  if (!publishedWeekIds) { container.innerHTML = '<div class="empty-state">No published schedule.</div>'; return; }

  const records = await sbFetchSch(`schedule?select=*&agent_id=eq.${schMyAgentId}&shift_date=gte.${fmt(thisWeekStart)}&shift_date=lte.${fmt(nextWeekEnd)}&week_id=in.(${publishedWeekIds})`);
  const schedMap = {};
  (records||[]).forEach(s => { schedMap[s.shift_date] = s; });

  function buildDays(startDate, endDate) {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const result = [];
    let cur = new Date(startDate);
    while (cur <= endDate) {
      const iso     = fmt(cur);
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
      } else if (d.dayType === 'Work') {
        displayShift = d.st ? d.st.start_time.substring(0,5) + ' - ' + d.st.end_time.substring(0,5) : 'Working';
        badge = '<span class="nos-status-badge nos-badge-work">Working</span>';
      } else if (d.dayType === 'Annual') { badge = '<span class="nos-status-badge nos-badge-annual">Annual</span>';
      } else if (d.dayType === 'Sick')   { badge = '<span class="nos-status-badge nos-badge-sick">Sick</span>';
      } else if (d.dayType === 'Casual') { badge = '<span class="nos-status-badge nos-badge-casual">Casual</span>';
      } else if (d.dayType === 'PH')     { badge = '<span class="nos-status-badge nos-badge-ph">Public Holiday</span>';
      } else if (d.dayType === 'Task')   { badge = '<span class="nos-status-badge nos-badge-task">Task</span>'; }

      html += `<div class="nos-day-card${todayClass}" style="animation-delay:${i*40}ms">
        <div class="nos-date-block">
          <div class="nos-day-name">${d.dayName}</div>
          <div class="nos-day-num">${d.dayNum}</div>
        </div>
        <div class="nos-shift-block">
          ${displayShift ? `<div class="nos-shift-time${shiftClass}" style="flex-shrink:0">${displayShift}</div>` : ''}
          ${badge}
          ${d.isToday ? '<span class="nos-today-badge">TODAY</span>' : ''}
        </div>
      </div>`;
    });
    html += '</div></div>';
    return html;
  }

  container.innerHTML = `<div class="sched-container">
    ${buildWeekHtml(buildDays(thisWeekStart, thisWeekEnd), '📅 THIS WEEK')}
    ${buildWeekHtml(buildDays(nextWeekStart, nextWeekEnd), '📆 NEXT WEEK')}
  </div>`;
}


/* ─── renderAgentWeek ─── */
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
    } else if (dayType === 'Annual') { shift = ''; badge = '<span class="nos-status-badge nos-badge-annual">Annual</span>'; shiftClass = '';
    } else if (dayType === 'Sick')   { shift = ''; badge = '<span class="nos-status-badge nos-badge-sick">Sick</span>'; shiftClass = '';
    } else if (dayType === 'Casual') { shift = ''; badge = '<span class="nos-status-badge nos-badge-casual">Casual</span>'; shiftClass = '';
    } else if (dayType === 'PH')     { shift = ''; badge = '<span class="nos-status-badge nos-badge-ph">Public Holiday</span>'; shiftClass = '';
    } else if (dayType === 'Task')   { shift = ''; badge = '<span class="nos-status-badge nos-badge-task">Task</span>'; shiftClass = '';
    } else { badge = '<span class="nos-status-badge nos-badge-off">OFF</span>'; }

    html += `<div class="nos-day-card${isToday?' nos-today':''}" style="animation-delay:${i*40}ms">
      <div class="nos-date-block">
        <div class="nos-day-name">${d.dayName}</div>
        <div class="nos-day-num">${d.display.split('/')[0]}</div>
      </div>
      <div class="nos-shift-block">
        ${shift ? `<div class="nos-shift-time${shiftClass}" style="flex-shrink:0">${shift}</div>` : ''}
        ${badge}
        ${isToday ? '<span class="nos-today-badge">TODAY</span>' : ''}
      </div>
    </div>`;
  });
  html += '</div>';
  daysEl.innerHTML = html;
}
