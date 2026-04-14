/* ═══════════════════════════════════════════════════
   app-kb.js — Knowledge Base
   ═══════════════════════════════════════════════════ */

let kbSections         = [];
let kbLoaded           = false;
let kbActiveIdx        = -1;
let kbEditMode         = false;
let kbSidebarCollapsed = false;

function loadKBSections() {
  if (kbLoaded) return;
  const listEl = document.getElementById('kb-sections-list');
  listEl.innerHTML = '<div class="kb-no-results"><i class="fas fa-spinner spinner"></i></div>';
  if (window.loadKBFromFirestore) {
    window.loadKBFromFirestore().then(data => {
      if (data && data.length) {
        kbSections = data; kbLoaded = true;
        renderKBSidebar(kbSections);
      } else {
        listEl.innerHTML = '<div class="kb-no-results"><i class="fas fa-folder-open"></i>No sections found</div>';
      }
    }).catch(() => {
      listEl.innerHTML = '<div class="kb-no-results"><i class="fas fa-exclamation-triangle"></i>Failed to load</div>';
    });
  }
}

function renderKBSidebar(sections) {
  const list = document.getElementById('kb-sections-list');
  if (!list) return;
  if (!sections.length) {
    list.innerHTML = '<div class="kb-no-results"><i class="fas fa-search"></i>No matching sections</div>';
    return;
  }
  list.innerHTML = sections.map((s, idx) => {
    const isActive = idx === kbActiveIdx ? ' kb-active' : '';
    return `<div class="kb-section-item${isActive}" data-idx="${idx}" onclick="openKBSection(${idx})">
      <div class="kb-section-icon"><i class="fas fa-file-alt"></i></div>
      <div class="kb-section-title">${s.title}</div>
    </div>`;
  }).join('');
}

function filterKBSidebar(query) {
  const filtered = query.trim()
    ? kbSections.filter(s => s.title.toLowerCase().includes(query.toLowerCase()))
    : kbSections;
  renderKBSidebar(filtered);
}

function toggleKBSidebar() {
  const sidebar = document.getElementById('kb-sidebar');
  kbSidebarCollapsed = !kbSidebarCollapsed;
  kbSidebarCollapsed ? sidebar.classList.add('kb-collapsed') : sidebar.classList.remove('kb-collapsed');
}

function openKBSection(idx) {
  const s = kbSections[idx]; if (!s) return;
  kbActiveIdx = idx; kbEditMode = false;
  updateKBToolbarState();

  const placeholder  = document.getElementById('kb-placeholder');
  const contentBody  = document.getElementById('kb-content-body');
  const currentTitle = document.getElementById('kb-current-title');
  currentTitle.innerText = s.title;
  if (placeholder) placeholder.remove();

  const content = (s.content || 'No content available.')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  contentBody.innerHTML = `<div class="kb-article">
    <div class="kb-article-title">${s.title}</div>
    <div class="kb-article-divider"></div>
    <div class="kb-article-body">${content}</div>
  </div>`;
  renderKBSidebar(kbSections);
}

function enterKBEditMode() {
  if (kbActiveIdx < 0 || !kbSections[kbActiveIdx]) return;
  kbEditMode = true; updateKBToolbarState();
  const s = kbSections[kbActiveIdx];
  document.getElementById('kb-content-body').innerHTML = `
    <div class="kb-article" style="direction:ltr;text-align:left;padding-bottom:8px;">
      <div class="kb-article-title">${s.title}</div>
      <div class="kb-article-divider" style="margin-left:0;"></div>
    </div>
    <textarea class="kb-edit-area" id="kb-edit-textarea">${s.content||''}</textarea>`;
}

function cancelKBEdit() {
  if (kbActiveIdx < 0) return;
  kbEditMode = false; updateKBToolbarState();
  openKBSection(kbActiveIdx);
}

function saveKBEdit() {
  if (kbActiveIdx < 0 || !kbSections[kbActiveIdx]) return;
  const s          = kbSections[kbActiveIdx];
  const newContent = document.getElementById('kb-edit-textarea').value;
  if (!window.saveKBSection) return;
  const saveBtn    = document.getElementById('kb-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML= '<i class="fas fa-spinner spinner"></i><span class="kb-btn-label">Saving</span>';
  window.saveKBSection(s.id, newContent).then(ok => {
    saveBtn.disabled = false;
    saveBtn.innerHTML= '<i class="fas fa-check"></i><span class="kb-btn-label">Save</span>';
    if (ok) {
      kbSections[kbActiveIdx].content = newContent;
      kbEditMode = false; updateKBToolbarState();
      openKBSection(kbActiveIdx);
      showToast('✅', 'Section Saved!', s.title+' has been updated.', 'success', 4000);
    } else {
      showToast('❌', 'Save Failed!', 'Could not save changes.', 'danger', 4000);
    }
  });
}

function updateKBToolbarState() {
  const editBtn   = document.getElementById('kb-edit-btn');
  const saveBtn   = document.getElementById('kb-save-btn');
  const cancelBtn = document.getElementById('kb-cancel-btn');
  const isAdmin   = window.currentUserRole === 'Admin';
  if (kbEditMode) {
    editBtn.classList.remove('kb-visible');
    saveBtn.classList.add('kb-visible');
    cancelBtn.classList.add('kb-visible');
  } else {
    editBtn.classList.remove('kb-visible');
    saveBtn.classList.remove('kb-visible');
    cancelBtn.classList.remove('kb-visible');
    if (isAdmin && kbActiveIdx >= 0) editBtn.classList.add('kb-visible');
  }
}
