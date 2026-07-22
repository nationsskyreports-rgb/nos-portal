/* ═══════════════════════════════════════════════════
   app-sch-table.js — SCH Table
   ═══════════════════════════════════════════════════ */

let schWeeks       = [];
let schAgents      = [];
let schMyDraft     = {};
let schAllDrafts   = {};
let schCurrentWeek = null;

function toggleSchAccordion(elementId) {
  const clickedItem   = document.getElementById(elementId);
  const allAccordions = document.querySelectorAll('.sch-accordion');
  const isOpen        = clickedItem.classList.contains('active');
  allAccordions.forEach(acc => acc.classList.remove('active'));
  if (!isOpen) clickedItem.classList.add('active');
}

function selectWeekChip(weekId, weekLabel, chipElement) {
  document.querySelectorAll('.week-chip').forEach(c => c.classList.remove('active'));
  if (chipElement) chipElement.classList.add('active');
  const pubAccordion = document.getElementById('acc-published');
  if (pubAccordion && !pubAccordion.classList.contains('active')) toggleSchAccordion('acc-published');
  loadSchTable(weekId);
}

async function initSchTab() {
  schWeeks = []; schAgents = [];
  try {
    const [pubWeeks, agents, shifts] = await Promise.all([
      sbFetchSch('schedule_weeks?select=id,week_start,week_end,status&status=eq.Published&order=week_start.desc'),
      sbFetchSch('agents?select=id,formal_name&status=eq.Active&order=formal_name'),
      sbFetchSch('shift_types?select=id,name,start_time,end_time,is_active&order=start_time')
    ]);
    schWeeks      = pubWeeks || [];
    schAgents     = agents   || [];
    schShiftTypes = shifts   || [];

    const agentName = document.getElementById('user-name').innerText.trim();
    const me = schAgents.find(a => a.formal_name.toLowerCase() === agentName.toLowerCase());
    if (me) schMyAgentId = me.id;

    const years  = [...new Set(schWeeks.map(w => w.week_start.substring(0,4)))].sort().reverse();
    const yearEl = document.getElementById('sch-filter-year');
    if (yearEl) {
      yearEl.innerHTML = '<option value="">All Years</option>' +
        years.map(y => `<option value="${y}">${y}</option>`).join('');
    }
    loadDraftGrid();
    autoSelectCurrentWeek();
  } catch(e) { console.error('SCH Tab failed:', e); }
}

function autoSelectCurrentWeek() {
  if (!schWeeks.length) return;
  const todayIso = getLocalDateStr();
  let targetWeek = schWeeks.find(w => w.week_start <= todayIso && w.week_end >= todayIso);
  if (!targetWeek) {
    const future = schWeeks.filter(w => w.week_start > todayIso).sort((a,b) => a.week_start.localeCompare(b.week_start));
    targetWeek = future[0] || schWeeks[0];
  }
  if (!targetWeek) return;
  const pubAccordion = document.getElementById('acc-published');
  if (pubAccordion && !pubAccordion.classList.contains('active')) toggleSchAccordion('acc-published');
  loadCurrentAndNextWeeks(targetWeek);
}

async function loadCurrentAndNextWeeks(currentWeek) {
  const gridEl = document.getElementById('sch-table-grid');
  gridEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading...</div>';

  const todayIso = getLocalDateStr();
  const nextWeek = schWeeks.filter(w => w.week_start > currentWeek.week_end)
    .sort((a,b) => a.week_start.localeCompare(b.week_start))[0];

  let html = '';
  for (const [week, label] of [[currentWeek,'📅 This Week'], [nextWeek,'📆 Next Week']].filter(([w]) => w)) {
    const dates = getSchWeekDates(week.week_start, week.week_end);
    try {
      const records  = await sbFetchSch(`schedule?select=*&week_id=eq.${week.id}`);
      const schedMap = {};
      (records||[]).forEach(s => { schedMap[`${s.agent_id}_${s.shift_date}`] = s; });
      html += `<div style="margin-bottom:24px;">
        <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          ${label}
          <span style="font-size:10px;color:var(--muted);font-weight:600;">${fmtSchDate(week.week_start)} → ${fmtSchDate(week.week_end)}</span>
        </div>
        ${buildSchGrid(schAgents, dates, schedMap, todayIso)}
      </div>`;
    } catch(e) {}
  }
  gridEl.innerHTML = html || '<div class="empty-state">No schedule found.</div>';
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
  let cur = new Date(sy, sm-1, sd, 12, 0, 0);
  const endDate = new Date(ey, em-1, ed, 12, 0, 0);
  while (cur <= endDate) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
    dates.push({ iso, dayName: days[cur.getDay()], display: `${String(cur.getDate()).padStart(2,'0')}/${String(cur.getMonth()+1).padStart(2,'0')}` });
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function schCellStyle(dayType, shiftTypeId) {
  if (dayType === 'Work') {
    const st = schShiftTypes.find(s => s.id === shiftTypeId);
    const hr = st ? parseInt(st.start_time.substring(0,2)) : 8;
    if (hr < 12)      return 'color:#fff;border-color:#10b981;background:#10b981;font-weight:800;';
    else if (hr < 14) return 'color:#fff;border-color:#0ea5e9;background:#0ea5e9;font-weight:800;';
    else              return 'color:#000;border-color:#f59e0b;background:#f59e0b;font-weight:800;';
  }
  if (dayType === 'Annual') return 'color:#fff;border-color:#8b5cf6;background:#8b5cf6;font-weight:800;';
  if (dayType === 'Sick')   return 'color:#fff;border-color:#f43f5e;background:#f43f5e;font-weight:800;';
  if (dayType === 'Casual') return 'color:#000;border-color:#f59e0b;background:#f59e0b;font-weight:800;';
  if (dayType === 'PH')     return 'color:#fff;border-color:#3b82f6;background:#3b82f6;font-weight:800;';
  if (dayType === 'Task')   return 'color:#fff;border-color:#06b6d4;background:#06b6d4;font-weight:800;';
  return 'color:#94a3b8;border-color:#334155;background:#1e293b;font-weight:700;';
}

function schShiftLabel(dayType, shiftTypeId) {
  if (dayType === 'Work') {
    const st = schShiftTypes.find(s => s.id === shiftTypeId);
    return st ? st.start_time.substring(0,5)+' - '+st.end_time.substring(0,5)+' ('+st.name+')' : 'Work';
  }
  return dayType === 'Off' ? '— Off —' : dayType;
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
      let cell='— Off —', color='#fff', bg='#64748b', border='#64748b';
      if (dt==='Work'&&st) {
        cell = st.start_time.substring(0,5)+' - '+st.end_time.substring(0,5);
        const hr = parseInt(st.start_time.substring(0,2));
        if (hr < 12)      { bg='#10b981'; border='#10b981'; color='#fff'; }
        else if (hr < 14) { bg='#0ea5e9'; border='#0ea5e9'; color='#fff'; }
        else              { bg='#f59e0b'; border='#f59e0b'; color='#000'; }
      }
      else if (dt==='Annual') { bg='#8b5cf6'; border='#8b5cf6'; color='#fff'; cell='Annual'; }
      else if (dt==='Sick')   { bg='#f43f5e'; border='#f43f5e'; color='#fff'; cell='Sick';   }
      else if (dt==='Casual') { bg='#f59e0b'; border='#f59e0b'; color='#000'; cell='Casual'; }
      else if (dt==='PH')     { bg='#3b82f6'; border='#3b82f6'; color='#fff'; cell='PH';     }
      else if (dt==='Task')   { bg='#06b6d4'; border='#06b6d4'; color='#fff'; cell='Task';   }
      html += `<td style="padding:5px;border-bottom:1px solid var(--border);text-align:center;${isTd?'background:rgba(212,175,55,0.06);':''}"><div style="background:${bg};border:1.5px solid ${border};border-radius:8px;padding:5px 4px;font-size:11px;font-weight:800;color:${color};white-space:nowrap;">${cell}</div></td>`;
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

async function loadSchTable(weekId) {
  if (!weekId) return;
  const week   = schWeeks.find(w => w.id === weekId);
  if (!week)   return;
  const gridEl = document.getElementById('sch-table-grid');
  gridEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i> Loading data...</div>';
  const today  = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
  const dates  = getSchWeekDates(week.week_start, week.week_end);
  try {
    const records  = await sbFetchSch(`schedule?select=*&week_id=eq.${weekId}`);
    const schedMap = {};
    (records || []).forEach(s => { schedMap[`${s.agent_id}_${s.shift_date}`] = s; });
    gridEl.innerHTML = buildSchGrid(schAgents, dates, schedMap, today);
  } catch(e) { gridEl.innerHTML = '<div class="empty-state">Error loading schedule.</div>'; }
}

function buildShiftSelect(agentId, date, dayType, shiftTypeId, isEditable) {
  const style = schCellStyle(dayType, shiftTypeId);
  if (!isEditable) {
    return `<div style="padding:6px 4px;border:1.5px solid;border-radius:8px;font-size:10px;font-weight:700;text-align:center;${style};white-space:nowrap;">${schShiftLabel(dayType, shiftTypeId)}</div>`;
  }
  // الخانة القابلة للتعديل بقت زرار — ضغطة تفتح لوحة اختيار زي الأدمن بورتال
  return `<button type="button" data-schpick data-date="${date}"
            onclick="openSchPop(this)"
            style="width:100%;padding:6px 4px;border:1.5px solid;border-radius:8px;font-size:10px;font-weight:800;text-align:center;outline:none;cursor:pointer;font-family:inherit;white-space:nowrap;${style}">${schShiftLabel(dayType, shiftTypeId)}</button>`;
}

/* ═══════════════════════════════════════════
   لوحة اختيار الشيفت (بوب-أب) — نفس تجربة الأدمن بورتال
   ═══════════════════════════════════════════ */
const SCH_LEAVES = { Annual:'#8b5cf6', Sick:'#f43f5e', Casual:'#f59e0b', PH:'#3b82f6', Unpaid:'#64748b' };
let schPopCtx = null;

function schShiftEmoji(startTime) {
  const hr = parseInt((startTime || '08').substring(0,2));
  if (hr < 12) return '🌅';
  if (hr < 14) return '☀️';
  if (hr < 17) return '🌆';
  return '🌙';
}

function ensureSchPop() {
  if (document.getElementById('sch-pop')) return;
  const style = document.createElement('style');
  style.innerHTML = `
    #sch-pop-backdrop { position:fixed; inset:0; z-index:998; display:none; }
    #sch-pop {
      position:fixed; z-index:999; display:none;
      width:300px; max-width:calc(100vw - 20px);
      background:var(--surface, #0E1420); border:1px solid var(--border, rgba(212,175,55,.2));
      border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.5);
      padding:12px; animation:schPopIn .12s ease-out;
    }
    @keyframes schPopIn { from { opacity:0; transform:scale(.96) translateY(4px); } to { opacity:1; transform:none; } }
    #sch-pop .sp-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    #sch-pop .sp-title { font-size:12.5px; font-weight:800; color:var(--text, #F0F4FF); }
    #sch-pop .sp-close { background:none; border:none; color:var(--muted, #6B7A99); cursor:pointer; font-size:15px; padding:4px; }
    #sch-pop .sp-section { font-size:9.5px; font-weight:800; letter-spacing:1.2px; color:var(--muted, #6B7A99); text-transform:uppercase; margin:10px 2px 6px; }
    #sch-pop .sp-grid   { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
    #sch-pop .sp-leaves { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; }
    #sch-pop .sp-opt {
      border:1.5px solid transparent; border-radius:9px; padding:8px 6px;
      font-size:11px; font-weight:800; color:#fff; cursor:pointer; text-align:center;
      font-family:inherit; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      transition:transform .1s, filter .1s;
    }
    #sch-pop .sp-opt:active { transform:scale(.97); }
    #sch-pop .sp-opt.sp-current { outline:2.5px solid #D4AF37; outline-offset:1.5px; }
    #sch-pop .sp-off { grid-column:1 / -1; background:#334155; }
    @media (max-width:640px) {
      #sch-pop { left:10px !important; right:10px; width:auto; top:auto !important; bottom:12px; }
      #sch-pop-backdrop { background:rgba(0,0,0,.4); }
    }`;
  document.head.appendChild(style);
  const bd = document.createElement('div'); bd.id = 'sch-pop-backdrop'; bd.onclick = closeSchPop;
  const pp = document.createElement('div'); pp.id = 'sch-pop';
  document.body.appendChild(bd); document.body.appendChild(pp);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSchPop(); });
}

function openSchPop(chipEl) {
  ensureSchPop();
  const date  = chipEl.dataset.date;
  schPopCtx = { date, chipEl };

  const draft      = schMyDraft[date] || { day_type: 'Off', shift_type_id: null };
  const currentVal = draft.day_type === 'Work' && draft.shift_type_id ? `Work__${draft.shift_type_id}` : draft.day_type;
  const visible    = schShiftTypes.filter(st => st.is_active !== false);

  let html = `
    <div class="sp-head"><div class="sp-title">📝 ${date.split('-').reverse().slice(0,2).join('/')}</div>
    <button class="sp-close" onclick="closeSchPop()">✕</button></div>
    <button class="sp-opt sp-off ${currentVal==='Off'?'sp-current':''}" onclick="pickSchShift('Off')">— Off —</button>
    <div class="sp-section">⏰ Shifts</div><div class="sp-grid">`;

  visible.forEach(st => {
    const val = `Work__${st.id}`;
    const hr  = parseInt(st.start_time.substring(0,2));
    const bg  = hr < 12 ? '#10b981' : hr < 14 ? '#0ea5e9' : '#f59e0b';
    const fg  = hr >= 14 ? '#000' : '#fff';
    html += `<button class="sp-opt ${currentVal===val?'sp-current':''}" style="background:${bg};color:${fg};" title="${st.name}"
              onclick="pickSchShift('${val}')">${schShiftEmoji(st.start_time)} ${st.start_time.substring(0,5)}-${st.end_time.substring(0,5)}</button>`;
  });

  html += `</div><div class="sp-section">🏖️ Leaves</div><div class="sp-leaves">`;
  Object.entries(SCH_LEAVES).forEach(([t, color]) => {
    html += `<button class="sp-opt ${currentVal===t?'sp-current':''}" style="background:${color};" onclick="pickSchShift('${t}')">${t}</button>`;
  });
  html += `</div>`;

  const pop = document.getElementById('sch-pop');
  pop.innerHTML = html;
  document.getElementById('sch-pop-backdrop').style.display = 'block';
  pop.style.display = 'block';
  if (window.innerWidth > 640) {
    const r = chipEl.getBoundingClientRect();
    const pw = 300, ph = pop.offsetHeight || 280;
    let left = Math.min(Math.max(8, r.left + r.width/2 - pw/2), window.innerWidth - pw - 8);
    let top  = r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    pop.style.left = left + 'px';
    pop.style.top  = top + 'px';
  }
}

function closeSchPop() {
  const pop = document.getElementById('sch-pop');
  if (pop) pop.style.display = 'none';
  const bd = document.getElementById('sch-pop-backdrop');
  if (bd) bd.style.display = 'none';
  schPopCtx = null;
}

function pickSchShift(val) {
  if (!schPopCtx) return;
  const { date, chipEl } = schPopCtx;
  let dayType = val, shiftTypeId = null;
  if (val.startsWith('Work__')) { dayType = 'Work'; shiftTypeId = val.split('__')[1]; }
  schMyDraft[date] = { day_type: dayType, shift_type_id: shiftTypeId };
  chipEl.style.cssText = chipEl.style.cssText.split('color:')[0]
    + 'width:100%;padding:6px 4px;border:1.5px solid;border-radius:8px;font-size:10px;font-weight:800;text-align:center;outline:none;cursor:pointer;font-family:inherit;white-space:nowrap;'
    + schCellStyle(dayType, shiftTypeId);
  chipEl.innerText = schShiftLabel(dayType, shiftTypeId);
  closeSchPop();
}

async function loadDraftGrid() {
  const draftEl   = document.getElementById('sch-draft-grid');
  draftEl.innerHTML = '<div class="empty-state"><i class="fas fa-spinner spinner"></i></div>';
  const draftWeeks = await sbFetchSch('schedule_weeks?select=id,week_start,week_end&status=eq.Draft&order=week_start.desc');
  if (!draftWeeks || !draftWeeks.length) {
    draftEl.innerHTML = '<div class="empty-state">No draft weeks available</div>'; return;
  }
  const draftWeek  = draftWeeks[0];
  schCurrentWeek   = draftWeek;
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
    const isMe       = agent.id === schMyAgentId;
    const agentDraft = isMe ? schMyDraft : (schAllDrafts[agent.id] || {});
    draftHtml += `<tr style="background:${idx%2===0?'var(--surface)':'var(--surface2)'};">
      <td style="padding:8px 12px;font-size:12px;font-weight:700;border-bottom:1px solid var(--border);white-space:nowrap;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:26px;height:26px;border-radius:50%;background:${isMe?'var(--primary-gradient)':'linear-gradient(135deg,#475569,#334155)'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;flex-shrink:0;">${agent.formal_name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)}</div>
          <span style="color:${isMe?'var(--primary)':'var(--text)'};">${agent.formal_name}${isMe?' (You)':''}</span>
        </div>
      </td>`;
    draftDates.forEach(d => {
      const draft = agentDraft[d.iso] || { day_type: 'Off', shift_type_id: null };
      const isTd  = d.iso === today;
      draftHtml += `<td style="padding:5px;border-bottom:1px solid var(--border);text-align:center;${isTd?'background:rgba(212,175,55,0.04);':''}">${buildShiftSelect(agent.id, d.iso, draft.day_type, draft.shift_type_id, isMe)}</td>`;
    });
    draftHtml += `</tr>`;
  });
  draftHtml += `</tbody></table></div>`;
  const table = document.createElement('div');
  table.innerHTML = draftHtml;
  draftEl.appendChild(table);

  if (!isSchRequestOpen()) {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-top:16px;padding:16px;background:rgba(239,68,68,0.06);border:1.5px solid rgba(239,68,68,0.3);border-radius:12px;text-align:center;font-size:13px;font-weight:700;color:#ef4444;white-space:pre-line;';
    banner.innerText = schRequestClosedMsg();
    draftEl.appendChild(banner);
    draftEl.querySelectorAll('select, button[data-schpick]').forEach(s => { s.disabled = true; s.style.opacity = '.5'; s.style.cursor = 'not-allowed'; });
  }
}

function isSchRequestOpen() {
  return true;
}

function schRequestClosedMsg() {
  const next = new Date();
  const daysUntilSun = (7 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + daysUntilSun);
  return `🔒 Requests are closed now.\nOpens every Sunday — next opening: ${String(next.getDate()).padStart(2,'0')}/${String(next.getMonth()+1).padStart(2,'0')}`;
}

async function submitSchRequest() {
  if (!isSchRequestOpen()) { customAlert('Closed', schRequestClosedMsg()); return; }
  if (!schCurrentWeek)     { customAlert('Error', 'No draft week available!'); return; }
  if (!schMyAgentId)       { customAlert('Error', 'Agent not found!'); return; }

  const agentName = document.getElementById('user-name').innerText.trim();
  const msg       = document.getElementById('sch-request-msg');
  const submitBtn = document.querySelector('[onclick="submitSchRequest()"]');
  if (submitBtn) setButtonLoading(submitBtn, true, 'Submitting...');
  msg.style.color = 'var(--muted)'; msg.innerText = 'Submitting...';

  const details  = { week_id: schCurrentWeek.id, week_start: schCurrentWeek.week_start, draft: schMyDraft };
  const existing = await sbFetchSch(`requests?select=id,details&agent_id=eq.${schMyAgentId}&type=eq.Schedule%20Request&status=eq.Pending&order=created_at.desc&limit=1`);
  let existingId = null;
  if (existing && existing.length) {
    try {
      const det = JSON.parse(existing[0].details);
      if (det.week_id === schCurrentWeek.id) existingId = existing[0].id;
    } catch(e) {}
  }

  const body = JSON.stringify(existingId
    ? { details: JSON.stringify(details), updated_at: new Date().toISOString() }
    : { agent_id: schMyAgentId, agent_name: agentName, type: 'Schedule Request', details: JSON.stringify(details), status: 'Pending', created_at: new Date().toISOString() }
  );

  try {
    const res = await fetch(`${SB_URL_SCH}/rest/v1/requests${existingId ? '?id=eq.'+existingId : ''}`, {
      method:  existingId ? 'PATCH' : 'POST',
      headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body
    });

    if (submitBtn) setButtonLoading(submitBtn, false, '📤 Submit Schedule Request');

    if (Object.keys(schMyDraft).length) {
      const upserts = Object.entries(schMyDraft).map(([date, entry]) => ({
        agent_id: schMyAgentId, week_id: schCurrentWeek.id, shift_date: date,
        day_type: entry.day_type, shift_type_id: entry.shift_type_id || null, status: 'Pending'
      }));
      await fetch(`${SB_URL_SCH}/rest/v1/schedule`, {
        method:  'POST',
        headers: { 'apikey': SB_KEY_SCH, 'Authorization': `Bearer ${window._authToken || SB_KEY_SCH}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(upserts)
      });
    }

    if (res.ok) {
      msg.style.color = '#10b981'; msg.innerText = '✅ Request submitted!';
      showToast('✅', 'Schedule Request Submitted!', 'Pending admin review.', 'success', 5000);
      setTimeout(() => msg.innerText = '', 5000);
    } else {
      msg.style.color = 'var(--danger)'; msg.innerText = `❌ Failed (${res.status}). Try again.`;
    }
  } catch(e) {
    if (submitBtn) setButtonLoading(submitBtn, false, '📤 Submit Schedule Request');
    msg.style.color = 'var(--danger)'; msg.innerText = '❌ Connection error!';
  }
}

function resetSchDraft() {
  schMyDraft = {};
  document.querySelectorAll('#sch-draft-grid select').forEach(sel => {
    sel.value = 'Off';
    sel.style.cssText += ';' + schCellStyle('Off');
  });
}

function filterSchWeeks() {
  const year   = document.getElementById('sch-filter-year').value;
  const month  = document.getElementById('sch-filter-month').value;
  const loader = document.getElementById('weeks-loader');
  const wrapper = document.getElementById('weeks-chips-wrapper');
  const list   = document.getElementById('weeks-list');

  loader.style.display  = 'block';
  wrapper.style.display = 'none';

  const filtered = schWeeks.filter(w => {
    if (year  && !w.week_start.startsWith(year))        return false;
    if (month && w.week_start.substring(5,7) !== month) return false;
    return true;
  });

  setTimeout(() => {
    loader.style.display = 'none';
    if (!filtered.length) { wrapper.style.display = 'none'; return; }
    wrapper.style.display = 'block';
    list.innerHTML = filtered.map(w => `
      <div class="week-chip" onclick="selectWeekChip('${w.id}', '${fmtSchDate(w.week_start)} → ${fmtSchDate(w.week_end)}', this)">
        <i class="far fa-calendar-alt"></i>
        <span>${fmtSchDate(w.week_start)} → ${fmtSchDate(w.week_end)}</span>
      </div>`).join('');
    document.getElementById('sch-table-grid').innerHTML = '<div class="empty-state">Select a week to view schedule.</div>';
  }, 300);
}
