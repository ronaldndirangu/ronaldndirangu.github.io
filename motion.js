(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const lively = () => !reduce.matches;
  const motionOn = root.classList.contains('motion') && lively() && 'IntersectionObserver' in window;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const header = document.getElementById('site-header');
  if (header) {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress container';
    bar.setAttribute('aria-hidden', 'true');
    header.appendChild(bar);
    let queued = false;
    const paint = () => {
      queued = false;
      const max = root.scrollHeight - window.innerHeight;
      bar.style.setProperty('--p', max > 0 ? clamp(window.scrollY / max, 0, 1).toFixed(4) : '0');
    };
    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    paint();
  }

  const metrics = [...document.querySelectorAll('.metric dt')].map((dt) => {
    const final = dt.textContent.trim();
    const match = final.match(/^(\d+)(.*)$/);
    if (!match) return null;
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = final;
    const shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    shown.textContent = final;
    dt.replaceChildren(label, shown);
    return { dt, shown, final, n: Number(match[1]), suffix: match[2], done: false };
  }).filter(Boolean);

  function count(m) {
    if (m.done) return;
    m.done = true;
    m.dt.parentElement.classList.add('is-counted');
    if (!lively()) {
      m.shown.textContent = m.final;
      return;
    }
    const start = performance.now();
    const tick = (t) => {
      const p = clamp((t - start) / 1400, 0, 1);
      m.shown.textContent = Math.round(m.n * (1 - Math.pow(1 - p, 4))) + m.suffix;
      if (p < 1) requestAnimationFrame(tick);
      else m.shown.textContent = m.final;
    };
    requestAnimationFrame(tick);
  }

  if (motionOn) {
    const reveal = new IntersectionObserver((entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--d', `${Math.min(k++, 5) * 90}ms`);
        e.target.classList.add('is-in');
        reveal.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });

    const targets = document.querySelectorAll('.section-head, .split-head, .job, .card, .skill-group, .sub-head, .edu li, .contact-card > *');
    for (const el of targets) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      el.classList.add('reveal');
      el.querySelectorAll('.tags li').forEach((li, i) => li.style.setProperty('--i', String(i)));
      reveal.observe(el);
    }

    const counter = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const m = metrics.find((x) => x.dt === e.target);
        if (m) setTimeout(() => count(m), 250);
        counter.unobserve(e.target);
      }
    }, { threshold: 1, rootMargin: '0px 0px -5% 0px' });
    for (const m of metrics) {
      m.shown.textContent = '0' + m.suffix;
      counter.observe(m.dt);
    }
  } else {
    metrics.forEach((m) => { m.done = true; });
  }

  document.querySelectorAll('.shot').forEach((shot) => {
    shot.addEventListener('pointermove', (e) => {
      if (!fine.matches || !lively() || e.pointerType !== 'mouse') return;
      const r = shot.getBoundingClientRect();
      const x = clamp((e.clientX - r.left) / r.width, 0, 1);
      const y = clamp((e.clientY - r.top) / r.height, 0, 1);
      shot.classList.add('is-tilting');
      shot.style.setProperty('--ry', `${((x - 0.5) * 8).toFixed(2)}deg`);
      shot.style.setProperty('--rx', `${((0.5 - y) * 6).toFixed(2)}deg`);
      shot.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      shot.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    });
    shot.addEventListener('pointerleave', () => {
      shot.classList.remove('is-tilting');
      for (const p of ['--rx', '--ry', '--gx', '--gy']) shot.style.removeProperty(p);
    });
  });

  document.querySelectorAll('.link-pill').forEach((pill) => {
    pill.addEventListener('pointermove', (e) => {
      if (!fine.matches || !lively()) return;
      const r = pill.getBoundingClientRect();
      const dx = clamp((e.clientX - r.left - r.width / 2) * 0.2, -8, 8);
      const dy = clamp((e.clientY - r.top - r.height / 2) * 0.3, -6, 6);
      pill.style.setProperty('--mx', `${dx.toFixed(1)}px`);
      pill.style.setProperty('--my', `${dy.toFixed(1)}px`);
    });
    pill.addEventListener('pointerleave', () => {
      pill.style.removeProperty('--mx');
      pill.style.removeProperty('--my');
    });
  });

  document.addEventListener('copied', (e) => {
    if (!lively() || !(e.target instanceof Element)) return;
    const r = e.target.getBoundingClientRect();
    const x = r.left + Math.min(r.width / 2, 40);
    const y = r.top + r.height / 2;
    const layer = document.createElement('div');
    layer.className = 'burst';
    layer.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 24; i++) {
      const bit = document.createElement('i');
      bit.style.left = `${x}px`;
      bit.style.top = `${y}px`;
      layer.appendChild(bit);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
      const speed = 70 + Math.random() * 120;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed;
      const spin = (Math.random() - 0.5) * 720;
      bit.animate([
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(spin / 2).toFixed(0)}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${(dx * 1.3).toFixed(1)}px, ${(dy + 150).toFixed(1)}px) rotate(${spin.toFixed(0)}deg) scale(0.5)`, opacity: 0 },
      ], { duration: 1000 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 1600);
  });

  const physics = window.__namePhysics;
  const name = document.querySelector('[data-physics]');
  if (!physics || !name) return;

  const nameInView = () => {
    const r = name.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.key.length !== 1) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (!nameInView()) return;
    const key = e.key.toLowerCase();
    physics.letters.forEach((L, i) => {
      if (L.el.textContent.toLowerCase() === key) physics.hop(i, 0.7);
    });
  });

  document.querySelectorAll('a[href="#top"]').forEach((a) => a.addEventListener('click', () => {
    if (!lively()) return;
    const start = performance.now();
    const wait = () => {
      if (window.scrollY < 4) physics.drop();
      else if (performance.now() - start < 2500) requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
  }));

  let idleSince = performance.now();
  let lastFidget = 0;
  const poke = () => { idleSince = performance.now(); };
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(type, poke, { passive: true });
  name.addEventListener('pointermove', poke);
  setInterval(() => {
    const now = performance.now();
    if (!lively() || document.hidden || !physics.settled() || !nameInView()) return;
    if (now - idleSince < 5000 || now - lastFidget < 6000) return;
    lastFidget = now;
    physics.hop(Math.floor(Math.random() * physics.letters.length), 0.3);
  }, 1000);
})();
