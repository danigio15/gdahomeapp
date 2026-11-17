/* Extracted from dashboard-en.html; feature changes belong in src/sections. */
(function(){try{var p=localStorage.getItem('cd_theme')||'auto';var d=p==='dark'||(p==='auto'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.setAttribute('data-theme','dark');}catch(e){}
/* The theme is decided: the boot veil stops following the system one. */
try{document.documentElement.setAttribute('data-tema-letto','');}catch(e){}})();
