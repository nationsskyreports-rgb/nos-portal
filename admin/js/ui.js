// ═══════════════════════════════════════════
// NOS Admin — UI Helpers
// ═══════════════════════════════════════════

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type]||'✅'}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('hide'); setTimeout(()=>toast.remove(),400); }, 3500);
}

function openModal(title, msg, onConfirm) {
  document.getElementById('modal-title').innerText = title;
  document.getElementById('modal-msg').innerText = msg;
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('modal-confirm').onclick = () => { closeModal(); onConfirm(); };
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function openPanel(title) {
  document.getElementById('panel-title').innerText = title;
  document.getElementById('panel-overlay').classList.add('open');
  document.getElementById('slide-panel').classList.add('open');
}
function closePanel() {
  document.getElementById('panel-overlay').classList.remove('open');
  document.getElementById('slide-panel').classList.remove('open');
}

function loading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><div>Loading...</div></div>`;
}

function empty(id, msg='No data found') {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span>${msg}</div>`;
}

function statusBadge(status) {
  const map = {
    'Active':'badge-success','Inactive':'badge-danger',
    'Approved':'badge-success','Rejected':'badge-danger','Pending':'badge-warning',
    'Published':'badge-info','Open':'badge-success','Closed':'badge-danger',
    'Draft':'badge-muted','Admin':'badge-purple','Manager':'badge-info','Agent':'badge-muted',
    'Work':'badge-success','Off':'badge-muted','Annual':'badge-purple',
    'Sick':'badge-danger','Casual':'badge-warning','PH':'badge-info','Task':'badge-blue'
  };
  return `<span class="badge ${map[status]||'badge-muted'}">${status}</span>`;
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}

function formatTime(t) {
  if (!t) return '-';
  return t.substring(0,5);
}

function debounce(fn, delay=300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(()=>fn(...args), delay); };
}
