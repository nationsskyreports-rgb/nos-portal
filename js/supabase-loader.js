// Supabase loader — works around Tracking Prevention by loading dynamically
(function() {
  if (window.supabase) return; // already loaded
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  s.onload = function() { 
    if (window._onSupabaseReady) window._onSupabaseReady();
  };
  document.head.appendChild(s);
})();
