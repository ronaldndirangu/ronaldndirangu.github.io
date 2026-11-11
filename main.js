(() => {
  document.documentElement.classList.add('js');
  const header = document.getElementById('site-header');
  const toggle = document.querySelector('.menu-toggle');
  const links = document.getElementById('nav-links');
  const navAnchors = links ? [...links.querySelectorAll('a[href^="#"]')] : [];
  const sections = [...document.querySelectorAll('main section[id]')];

  function setMenu(open) {
    if (!toggle || !links) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    links.classList.toggle('is-open', open);
  }

  if (toggle && links) {
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.nav')) setMenu(false); });
    links.closest('.nav').addEventListener('focusout', (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest('.nav')) setMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  let ticking = false;
  function update() {
    ticking = false;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);

    const line = window.innerHeight * 0.35;
    let current = null;
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= line) current = s;
    }
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom && sections.length) current = sections[sections.length - 1];
    const id = current ? current.id : '';
    for (const a of navAnchors) {
      if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    }
  }
  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();

  const themeToggle = document.getElementById('theme-toggle');
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const validTheme = (t) => t === 'light' || t === 'dark';
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('theme'); } catch (_) {}
  let manualTheme = validTheme(new URLSearchParams(location.search).get('scoutTheme')) || validTheme(savedTheme);
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
  }
  themeToggle.hidden = false;
  setTheme(document.documentElement.dataset.theme);
  themeToggle.addEventListener('click', () => {
    manualTheme = true;
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      setTheme(next);
      try { localStorage.setItem('theme', next); } catch (_) {}
    };
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply();
      return;
    }
    const r = themeToggle.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  });
  colorScheme.addEventListener('change', (event) => {
    if (!manualTheme) setTheme(event.matches ? 'dark' : 'light');
  });
  window.matchMedia('(min-width: 601px)').addEventListener('change', (event) => {
    if (event.matches) setMenu(false);
  });

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const copyBtn = document.getElementById('copy-email');
  const toast = document.getElementById('copy-toast');
  let toastTimer = 0;

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('is-on');
      toast.textContent = '';
    }, 2000);
  }

  if (copyBtn) {
    copyBtn.hidden = false;
    copyBtn.addEventListener('click', async () => {
      const text = copyBtn.dataset.email || '';
      let ok = false;
      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(text); ok = true; } catch (_) { ok = false; }
      }
      if (!ok) ok = fallbackCopy(text);
      showToast(ok ? 'Copied' : 'Copy failed');
      if (ok) copyBtn.dispatchEvent(new CustomEvent('copied', { bubbles: true }));
    });
  }
})();
