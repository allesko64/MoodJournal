async function loadNavbar(activePageKey) {
  const container = document.getElementById('navbar-root');
  if (!container) {
    return;
  }

  const inPagesDir = window.location.pathname.includes('/pages/');
  const basePath = inPagesDir ? '..' : '.';

  try {
    const response = await fetch(`${basePath}/partials/navbar.html`);
    const html = await response.text();
    container.innerHTML = html;
    highlightActiveNav(activePageKey);
    initThemeToggle();
  } catch (error) {
    console.error('Failed to load navbar:', error);
  }
}

function highlightActiveNav(activePageKey) {
  const links = document.querySelectorAll('.nav-links a');
  links.forEach((link) => {
    if (link.dataset.page === activePageKey) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function initThemeToggle() {
  const saved = localStorage.getItem('mindfulme-theme') || 'light';
  applyTheme(saved);

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('mindfulme-theme', next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

(function () {
  const saved = localStorage.getItem('mindfulme-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();
