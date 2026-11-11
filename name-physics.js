(() => {
  const name = document.querySelector('[data-physics]');
  if (!name) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hint = document.querySelector('.name-hint');
  const letters = [];

  name.querySelectorAll('.name-line').forEach((line, row) => {
    const text = line.textContent.trim();
    line.textContent = '';
    for (const c of text) {
      const el = document.createElement('span');
      el.className = 'ch';
      el.textContent = c;
      line.appendChild(el);
      letters.push({ el, row, x: 0, y: 0, a: 0, vx: 0, vy: 0, va: 0, cx: 0, cy: 0, h: 1, wait: 0 });
    }
  });

  const BOUNCE = 0.42, KX = 70, CX = 7, KA = 90, CA = 8, SUB = 1 / 120;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  let raf = 0, last = 0, ptr = null, g = 3000;

  function measure() {
    for (const L of letters) {
      L.cx = L.el.offsetLeft + L.el.offsetWidth / 2;
      L.cy = L.el.offsetTop + L.el.offsetHeight / 2;
      L.h = L.el.offsetHeight || 1;
    }
    g = 20 * letters[0].h;
  }

  function step(dt) {
    let busy = false;
    for (const L of letters) {
      if (L.wait > 0) {
        L.wait -= dt;
        if (L.wait <= 0) L.el.style.opacity = '';
        busy = true;
        continue;
      }
      L.vx += (-KX * L.x - CX * L.vx) * dt;
      L.va += (-KA * L.a - CA * L.va) * dt;
      if (L.y < 0 || L.vy < 0) L.vy += g * dt;
      L.x += L.vx * dt;
      L.y += L.vy * dt;
      L.a += L.va * dt;
      if (L.y >= 0) {
        L.y = 0;
        if (L.vy > 0.5 * Math.sqrt(g * L.h * 0.02)) {
          L.vy *= -BOUNCE;
          L.va += L.vx * 0.006;
        } else L.vy = 0;
      }
      if (Math.abs(L.x) > 0.15 || L.y < -0.15 || L.vy || Math.abs(L.vx) > 1 || Math.abs(L.a) > 0.002 || Math.abs(L.va) > 0.02) busy = true;
    }
    return busy;
  }

  function render(rest) {
    for (const L of letters) {
      if (rest) { L.x = L.y = L.a = L.vx = L.vy = L.va = L.wait = 0; L.el.style.opacity = ''; }
      L.el.style.transform = rest ? '' : `translate(${L.x.toFixed(2)}px, ${L.y.toFixed(2)}px) rotate(${L.a.toFixed(4)}rad)`;
    }
  }

  function frame(t) {
    let acc = clamp((t - last) / 1000, 0, 0.05);
    last = t;
    let busy = true;
    while (acc > 1e-6) {
      const h = Math.min(SUB, acc);
      busy = step(h);
      acc -= h;
    }
    render(!busy);
    raf = busy ? requestAnimationFrame(frame) : 0;
  }

  function wake() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function hop(i, power = 1) {
    if (reduce.matches) return;
    const hit = letters[i];
    if (!hit) return;
    letters.forEach((L, j) => {
      const k = Math.abs(j - i);
      if (L.row !== hit.row || k > 3 || L.wait > 0) return;
      const f = [1, 0.42, 0.18, 0.07][k] * power;
      L.vy = Math.min(L.vy, -Math.sqrt(2 * g * L.h * 0.95) * Math.sqrt(f));
      L.vx += (Math.random() - 0.5) * 0.9 * L.h * f;
      L.va += (Math.random() - 0.5) * 9 * f;
    });
    wake();
  }

  function brush(e) {
    if (reduce.matches || (e.pointerType === 'touch' && !e.isPrimary)) return;
    const r = name.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top, now = e.timeStamp;
    const prev = ptr;
    ptr = { x: px, y: py, t: now };
    if (!prev || now - prev.t > 120) return;
    const dt = Math.max(8, now - prev.t) / 1000;
    const pvx = (px - prev.x) / dt, pvy = (py - prev.y) / dt;
    if (Math.hypot(pvx, pvy) < 150) return;
    let touched = false;
    for (const L of letters) {
      if (L.wait > 0) continue;
      const R = L.h * 0.5;
      const d = Math.hypot(L.cx + L.x - px, L.cy + L.y - py);
      if (d >= R) continue;
      const f = 1 - d / R;
      const kick = Math.sqrt(2 * g * L.h * 0.6);
      L.vx = clamp(L.vx + pvx * 0.22 * f, -4 * L.h, 4 * L.h);
      L.vy = clamp(L.vy - (Math.abs(pvx) * 0.3 + Math.max(0, -pvy) * 0.35) * f, -kick, L.vy);
      L.va = clamp(L.va + pvx * 0.0035 * f, -7, 7);
      touched = true;
    }
    if (touched) wake();
  }

  function drop() {
    if (reduce.matches) return;
    const top = Math.max(0, name.getBoundingClientRect().top);
    letters.forEach((L, i) => {
      L.wait = 0.15 + i * 0.055;
      L.x = L.vx = L.vy = L.va = 0;
      L.y = -(top + L.cy + L.h * (0.4 + Math.random() * 0.5));
      L.a = (Math.random() - 0.5) * 0.5;
      L.el.style.opacity = '0';
    });
    render(false);
    wake();
  }

  measure();
  if (hint) hint.hidden = reduce.matches;
  const dropButton = document.querySelector('[data-drop]');
  if (dropButton) dropButton.addEventListener('click', () => { measure(); drop(); });

  name.addEventListener('pointermove', brush);
  name.addEventListener('pointerleave', () => { ptr = null; });
  name.addEventListener('click', (e) => {
    const t = e.target.closest('.ch');
    if (t) hop(letters.findIndex((L) => L.el === t));
  });

  reduce.addEventListener('change', () => {
    if (reduce.matches) {
      cancelAnimationFrame(raf);
      raf = 0;
      render(true);
    }
    if (hint) hint.hidden = reduce.matches;
  });

  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; measure(); });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  if (!reduce.matches && name.getBoundingClientRect().bottom > 0) drop();
  name.classList.add('is-ready');

  window.__namePhysics = {
    letters,
    hop,
    drop,
    settled: () => !raf,
  };
})();
