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
    const first = dt.firstChild;
    const n = first && first.nodeType === Node.TEXT_NODE ? parseInt(first.textContent, 10) : NaN;
    if (Number.isNaN(n)) return null;
    const unit = dt.querySelector('.unit');
    const label = document.createElement('span');
    label.className = 'sr-only';
    label.textContent = dt.textContent.trim();
    const shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(n);
    shown.append(num);
    if (unit) shown.append(unit);
    dt.replaceChildren(label, shown);
    return { dt, num, n, from: Number(dt.dataset.from) || 0, done: false };
  }).filter(Boolean);

  function count(m) {
    if (m.done) return;
    m.done = true;
    m.dt.parentElement.classList.add('is-counted');
    if (!lively()) return;
    const start = performance.now();
    m.num.textContent = String(m.from);
    const tick = (t) => {
      const p = clamp((t - start) / 1100, 0, 1);
      m.num.textContent = String(Math.round(m.from + (m.n - m.from) * (1 - Math.pow(1 - p, 4))));
      if (p < 1) requestAnimationFrame(tick);
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

    const targets = document.querySelectorAll('.section-head, .job, .card, .manifest-row, .sub-head, .edu li, .contact-main > *, .status-cell');
    for (const el of targets) {
      if (el.getBoundingClientRect().top < window.innerHeight) continue;
      el.classList.add('reveal');
      reveal.observe(el);
    }

    const counter = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const m = metrics.find((x) => x.dt === e.target);
        if (m) setTimeout(() => count(m), 120);
        counter.unobserve(e.target);
      }
    }, { threshold: 0.35 });
    for (const m of metrics) counter.observe(m.dt);
  } else {
    metrics.forEach((m) => { m.done = true; });
  }

  const ship = document.querySelector('.ship');
  if (ship) {
    const button = ship.querySelector('[data-ship]');
    const stages = [...ship.querySelectorAll('[data-stage]')];
    const log = ship.querySelector('.ship-log');
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const say = (text, warn = false) => {
      log.textContent = text;
      log.classList.toggle('is-warn', warn);
    };
    const mark = (li, state) => {
      li.classList.remove('is-run', 'is-ok', 'is-fail');
      if (state) li.classList.add(state);
    };
    let runs = 0;
    let busy = false;

    const run = async ({ drop = true, step = 380 } = {}) => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      ship.classList.remove('is-done');
      stages.forEach((li) => mark(li, null));
      if (!lively()) {
        stages.forEach((li) => mark(li, 'is-ok'));
        say('deployed ✓');
      } else {
        // Every third manual run hits a flaky test so the pipeline has something to recover from.
        const flaky = drop && runs++ % 3 === 1;
        for (const li of stages) {
          const stage = li.textContent.trim();
          mark(li, 'is-run');
          say(`${stage}…`);
          await wait(step);
          if (flaky && stage === 'test') {
            mark(li, 'is-fail');
            say('test failed, retrying', true);
            await wait(900);
            mark(li, 'is-run');
            say('retry 1/1…');
            await wait(step + 120);
            mark(li, 'is-ok');
            say('retry 1/1 passed');
            await wait(500);
            continue;
          }
          mark(li, 'is-ok');
        }
        if (drop) window.__namePhysics?.drop();
        say('deployed ✓');
      }
      ship.classList.add('is-done');
      button.disabled = false;
      busy = false;
    };

    button.addEventListener('click', () => run());
    if (lively() && !ship.closest('[hidden]')) setTimeout(() => run({ drop: false, step: 260 }), 600);
  }

  const clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length && 'Intl' in window) {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const tickClock = () => {
      const time = fmt.format(new Date());
      clocks.forEach((el) => { el.textContent = 'clockBare' in el.dataset ? time : `${time} EAT`; });
    };
    tickClock();
    setInterval(tickClock, 30000);
  }

  const timeline = document.querySelector('.timeline');
  if (timeline && motionOn) {
    let queued = false;
    const fill = () => {
      queued = false;
      const r = timeline.getBoundingClientRect();
      const p = clamp((window.innerHeight * 0.62 - r.top) / r.height, 0, 1);
      timeline.style.setProperty('--fill', p.toFixed(4));
    };
    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(fill);
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    fill();
  }

  document.querySelectorAll('.board').forEach((board) => {
    board.addEventListener('pointermove', (e) => {
      if (!fine.matches || !lively() || e.pointerType !== 'mouse') return;
      const r = board.getBoundingClientRect();
      board.style.setProperty('--sx', `${(e.clientX - r.left).toFixed(0)}px`);
      board.style.setProperty('--sy', `${(e.clientY - r.top).toFixed(0)}px`);
      board.classList.add('is-lit');
    });
    board.addEventListener('pointerleave', () => board.classList.remove('is-lit'));
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
    if (now - idleSince < 15000 || now - lastFidget < 20000) return;
    lastFidget = now;
    physics.hop(Math.floor(Math.random() * physics.letters.length), 0.3);
  }, 1000);
})();
