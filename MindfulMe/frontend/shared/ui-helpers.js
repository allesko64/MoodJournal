// Shared UI utilities: navbar loader, theme toggle, toast.

async function loadNavbar(activePageKey) {
  const container = document.getElementById('navbar-root');
  if (!container) return;

  // All pages are now served from the same origin root.
  // Paths in features/ are one level deep: /features/journal/journal.html
  // The navbar partial is always at /partials/navbar.html
  try {
    const response = await fetch('/partials/navbar.html');
    const html = await response.text();
    container.innerHTML = html;
    highlightActiveNav(activePageKey);
    initThemeToggle();
    initHamburgerMenu();
  } catch (error) {
    console.error('Failed to load navbar:', error);
  }
}

function initHamburgerMenu() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    hamburger.classList.toggle('active');
  });

  // Close menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('active');
      hamburger.classList.remove('active');
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar')) {
      navLinks.classList.remove('active');
      hamburger.classList.remove('active');
    }
  });
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

// Apply saved theme immediately to avoid flash
(function () {
  const saved = localStorage.getItem('mindfulme-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();
