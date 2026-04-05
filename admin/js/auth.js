// ═══════════════════════════════════════════
// NOS Admin — Auth
// ═══════════════════════════════════════════
function checkAuth() {
  const session = sessionStorage.getItem('nos-admin');
  if (!session) { window.location.href = 'login.html'; return null; }
  return JSON.parse(session);
}
function logout() {
  sessionStorage.removeItem('nos-admin');
  const isInPages = window.location.pathname.includes('/pages/');
window.location.href = isInPages ? '../login.html' : 'login.html';

}
function getAdminName() {
  const session = sessionStorage.getItem('nos-admin');
  if (!session) return 'Admin';
  return JSON.parse(session).username || 'Admin';
}
