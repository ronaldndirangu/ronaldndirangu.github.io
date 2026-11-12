(() => {
  const host = document.querySelector('[data-sim]');
  const canvas = host?.querySelector('.sim-canvas');
  const live = host?.querySelector('.sim-live');
  const ctx = canvas?.getContext?.('2d');
  if (!host || !live || !ctx) return;

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fallback = host.querySelector('.sim-fallback');
  const hud = host.querySelector('.sim-hud');
  const statusEl = host.querySelector('.sim-status');
  const statusText = host.querySelector('.sim-status-text');
  const countEl = host.querySelector('.sim-count');
  const addBtn = host.querySelector('[data-sim-add]');
  const removeBtn = host.querySelector('[data-sim-remove]');
  const pauseBtn = host.querySelector('[data-sim-pause]');

  const ARRIVALS = 8;
  const RATE = 5;
  const SLOTS = 4;
  const MIN = 1;
  const MAX = 4;
  const HOP = 0.55;
  const GRAVITY = 560;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  live.hidden = false;
  if (fallback) fallback.hidden = true;
  host.classList.add('is-live');

  let c = {};
  const readColors = () => {
    const cs = getComputedStyle(root);
    const v = (name, alt) => cs.getPropertyValue(name).trim() || alt;
    c = {
      board: v('--cp-board', '#13170f'),
      led: v('--cp-led', '#ffb524'),
      go: v('--cp-go', '#7ed492'),
      fail: v('--cp-fail', '#ff6a5c'),
      text: v('--cp-board-text', '#e9eee0'),
      muted: v('--cp-board-muted', '#a0ab96'),
    };
  };

  const g = { w: 0, h: 0, dpr: 1, pad: 16, font: 10, px: 5, label: 0, top: 0, bottom: 0, mid: 0, spread: 20, ux: 0, lx: 0, lw: 40, lh: 28, sx: 0, sw: 96, sh: 30 };
  const servers = [];
  let reqs = [];
  let spawnIn = 0;
  let rr = 0;
  let settled = false;
  let state = '';
  let nudge = true;

  const makeServer = (alpha = 0) => ({ y: g.mid, ty: g.mid, queue: 0, busy: 0, shake: 0, flash: 0, alpha });
  const personY = (i) => g.mid + (i - 1) * g.spread;

  const place = (animate) => {
    const n = servers.length;
    const avail = g.bottom - g.top;
    const gap = n > 3 ? 6 : 8;
    g.sh = clamp((avail - gap * (n - 1)) / n, 18, 44);
    const total = n * g.sh + (n - 1) * gap;
    const first = g.mid - total / 2 + g.sh / 2;
    servers.forEach((s, i) => {
      s.ty = first + i * (g.sh + gap);
      if (!animate) s.y = s.ty;
    });
  };

  const layout = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    const small = w < 420;
    g.w = w;
    g.h = h;
    g.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * g.dpr);
    canvas.height = Math.round(h * g.dpr);
    g.pad = small ? 12 : 18;
    g.font = small ? 11 : 13;
    g.px = small ? 6 : 8;
    g.k = small ? 1.1 : 1.3;
    g.label = g.pad + g.font / 2 + 2;
    g.top = g.label + g.font + 10;
    g.bottom = h - (hud ? hud.offsetHeight + 14 : 52);
    g.mid = (g.top + g.bottom) / 2;
    g.spread = Math.min(30, (g.bottom - g.top) / 3.4);
    g.ux = g.pad + 6 * g.k;
    g.lw = small ? 42 : 56;
    g.lh = small ? 30 : 38;
    g.lx = w * 0.4;
    g.sw = clamp(w * 0.27, 100, 144);
    g.sx = w - g.pad - g.sw - 8;
    place(false);
    return true;
  };

  const drop = (r, s) => {
    r.phase = 'drop';
    r.vx = -(10 + Math.random() * 30);
    r.vy = -(30 + Math.random() * 40);
    r.life = 0.45;
    if (s) s.shake = 0.22;
  };

  const arrive = (r) => {
    const s = r.srv;
    if (s.queue < SLOTS) {
      s.queue++;
      r.phase = 'done';
    } else {
      drop(r, s);
    }
  };

  const updateStatus = () => {
    const cap = servers.length * RATE;
    let next = 'ok';
    if (cap < ARRIVALS) next = 'fail';
    else if (!settled) {
      settled = servers.every((s) => s.queue <= 1);
      next = settled ? 'ok' : 'warn';
    }
    if (next === state) return;
    state = next;
    if (statusEl) statusEl.dataset.state = next;
    if (statusText) {
      statusText.textContent = next === 'fail'
        ? `Overloaded · dropping ${ARRIVALS - cap}/s`
        : next === 'warn' ? 'Recovering · draining queue' : 'Healthy · every request served';
    }
  };

  const step = (dt) => {
    spawnIn -= dt;
    while (spawnIn <= 0) {
      reqs.push({ phase: 'in', t: 0, p: Math.floor(Math.random() * 3), x: 0, y: 0 });
      spawnIn += (0.55 + Math.random() * 0.9) / ARRIVALS;
    }

    for (const s of servers) {
      s.y += (s.ty - s.y) * Math.min(1, dt * 10);
      s.alpha = Math.min(1, s.alpha + dt * 4);
      s.shake = Math.max(0, s.shake - dt);
      s.flash = Math.max(0, s.flash - dt);
      if (s.busy > 0) {
        s.busy -= dt;
        if (s.busy <= 0) {
          const spill = -s.busy;
          s.busy = 0;
          s.flash = 0.16;
          reqs.push({ phase: 'out', x: g.sx + g.sw + 4, y: s.y, life: 0.5 });
          if (s.queue > 0) {
            s.queue--;
            s.busy = Math.max(0.001, 1 / RATE - spill);
          }
        }
      } else if (s.queue > 0) {
        s.queue--;
        s.busy = 1 / RATE;
      }
    }

    const n = servers.length;
    for (const r of reqs) {
      if (r.phase === 'in') {
        r.t += dt / HOP;
        const e = Math.min(1, r.t);
        const x0 = g.ux + 9 * g.k;
        const y0 = personY(r.p);
        r.x = x0 + (g.lx - g.lw / 2 - x0) * e;
        r.y = y0 + (g.mid - y0) * e;
        if (r.t >= 1) {
          r.phase = 'route';
          r.t = 0;
          r.srv = servers[rr % n];
          rr = (rr + 1) % n;
        }
      } else if (r.phase === 'route') {
        if (!servers.includes(r.srv)) {
          drop(r, null);
          continue;
        }
        r.t += dt / HOP;
        const e = Math.min(1, r.t);
        const x0 = g.lx + g.lw / 2;
        r.x = x0 + (g.sx - x0) * e;
        r.y = g.mid + (r.srv.y - g.mid) * e;
        if (r.t >= 1) arrive(r);
      } else if (r.phase === 'drop') {
        r.vy += GRAVITY * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.life -= dt;
      } else if (r.phase === 'out') {
        r.x += 46 * dt;
        r.life -= dt;
      }
    }
    reqs = reqs.filter((r) => r.phase === 'in' || r.phase === 'route' || (r.phase !== 'done' && r.life > 0 && r.y < g.h + 10));
    updateStatus();
  };

  const rrect = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  };

  const draw = () => {
    if (!g.w) return;
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    ctx.font = `600 ${g.font}px "JetBrains Mono", Consolas, monospace`;
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.6px';

    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.fillText(`USERS · ${ARRIVALS}/S`, g.pad, g.label);
    ctx.textAlign = 'center';
    ctx.fillText('BALANCER', g.lx, g.label);
    ctx.textAlign = 'right';
    ctx.fillText(`SERVERS · ${RATE}/S EACH`, g.w - g.pad, g.label);

    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = c.muted;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(g.ux + 9 * g.k, personY(i));
      ctx.lineTo(g.lx - g.lw / 2, g.mid);
    }
    for (const s of servers) {
      ctx.moveTo(g.lx + g.lw / 2, g.mid);
      ctx.lineTo(g.sx, s.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.fillStyle = c.text;
    for (let i = 0; i < 3; i++) {
      const y = personY(i);
      const k = g.k;
      ctx.fillRect(g.ux - 2 * k, y - 8 * k, 5 * k, 5 * k);
      ctx.fillRect(g.ux - 4 * k, y - 2 * k, 9 * k, 7 * k);
    }

    for (const r of reqs) {
      if (r.phase === 'done') continue;
      let col = c.led;
      let a = 1;
      if (r.phase === 'drop') {
        col = c.fail;
        a = clamp(r.life / 0.45, 0, 1);
      } else if (r.phase === 'out') {
        col = c.go;
        a = clamp(r.life / 0.5, 0, 1);
      }
      ctx.fillStyle = col;
      ctx.globalAlpha = a * 0.22;
      ctx.fillRect(r.x - g.px, r.y - g.px, g.px * 2, g.px * 2);
      ctx.globalAlpha = a;
      ctx.fillRect(r.x - g.px / 2, r.y - g.px / 2, g.px, g.px);
    }
    ctx.globalAlpha = 1;

    ctx.lineWidth = 1.5;
    rrect(g.lx - g.lw / 2, g.mid - g.lh / 2, g.lw, g.lh, 5);
    ctx.fillStyle = c.board;
    ctx.fill();
    ctx.strokeStyle = c.text;
    ctx.stroke();
    ctx.fillStyle = c.text;
    ctx.textAlign = 'center';
    ctx.fillText('LB', g.lx, g.mid + 0.5);

    const sz = g.px + 1;
    servers.forEach((s, i) => {
      const hot = s.queue >= SLOTS;
      const col = hot ? c.fail : s.queue >= 2 ? c.led : c.go;
      const x = g.sx + (s.shake > 0 ? Math.sin(s.shake * 90) * 2.2 : 0);
      const y = s.y - g.sh / 2;
      ctx.globalAlpha = s.alpha;
      rrect(x, y, g.sw, g.sh, 5);
      ctx.fillStyle = c.board;
      ctx.fill();
      if (hot) {
        ctx.globalAlpha = s.alpha * 0.16;
        ctx.fillStyle = c.fail;
        ctx.fill();
        ctx.globalAlpha = s.alpha;
      }
      ctx.strokeStyle = col;
      ctx.stroke();

      ctx.fillStyle = hot ? c.fail : c.text;
      ctx.textAlign = 'left';
      ctx.fillText(`S${i + 1}`, x + 8, s.y + 0.5);

      const re = x + g.sw - 8;
      const top = s.y - sz / 2;
      ctx.fillStyle = s.busy > 0 || s.flash > 0 ? c.go : c.muted;
      ctx.globalAlpha = s.alpha * (s.busy > 0 || s.flash > 0 ? 1 : 0.35);
      ctx.fillRect(re - sz, top, sz, sz);
      ctx.globalAlpha = s.alpha;
      for (let k = 0; k < SLOTS; k++) {
        const sx = re - sz - 8 - (k + 1) * sz - k * 3;
        if (k < s.queue) {
          ctx.fillStyle = hot ? c.fail : c.led;
          ctx.fillRect(sx, top, sz, sz);
        } else {
          ctx.strokeStyle = c.muted;
          ctx.lineWidth = 1;
          ctx.globalAlpha = s.alpha * 0.5;
          ctx.strokeRect(sx + 0.5, top + 0.5, sz - 1, sz - 1);
          ctx.globalAlpha = s.alpha;
          ctx.lineWidth = 1.5;
        }
      }
    });
    ctx.globalAlpha = 1;
  };

  const sync = () => {
    const n = servers.length;
    if (countEl) countEl.textContent = String(n);
    if (removeBtn) {
      const atMin = n <= MIN;
      if (atMin && document.activeElement === removeBtn) addBtn?.focus();
      removeBtn.disabled = atMin;
      removeBtn.style.visibility = atMin ? 'hidden' : '';
      removeBtn.setAttribute('aria-label', `Remove a server (${n} running)`);
    }
    if (addBtn) {
      addBtn.disabled = n >= MAX;
      addBtn.setAttribute('aria-label', `Add a server (${n} running)`);
    }
    settled = false;
  };

  const warm = (seconds) => {
    for (let i = 0, steps = Math.round(seconds * 60); i < steps; i++) step(1 / 60);
  };

  const snapshot = () => {
    reqs = [];
    spawnIn = 0;
    servers.forEach((s) => {
      s.queue = 0;
      s.busy = 0;
      s.alpha = 1;
      s.y = s.ty;
    });
    warm(3.2);
    servers.forEach((s) => { s.shake = 0; });
    draw();
  };

  let raf = 0;
  let last = 0;
  let inView = false;
  let seen = 0;
  let demoing = false;
  let touched = false;
  let userPaused = false;

  const addServer = () => {
    if (servers.length >= MAX) return;
    nudge = false;
    addBtn?.classList.remove('is-hint');
    const s = makeServer();
    servers.push(s);
    place(true);
    s.y = s.ty;
    sync();
    refresh();
  };

  const tick = (now) => {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    if (!touched && nudge && servers.length === 1) {
      seen += dt;
      if (seen > 0.8) addBtn?.classList.add('is-hint');
      if (seen > 6 && !demoing && statusText) {
        demoing = true;
        statusText.textContent = 'Demo · adding a server';
      }
      if (seen > 8) {
        addBtn?.classList.add('is-auto');
        setTimeout(() => addBtn?.classList.remove('is-auto'), 220);
        addServer();
      }
    }
    draw();
    if (inView && !document.hidden && !userPaused) raf = requestAnimationFrame(tick);
  };
  const play = () => {
    if (raf || userPaused || reduce.matches || !inView || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const pause = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const refresh = () => {
    if (reduce.matches) snapshot();
    else {
      updateStatus();
      if (!raf) draw();
    }
  };

  addBtn?.addEventListener('click', () => {
    touched = true;
    addServer();
  });

  removeBtn?.addEventListener('click', () => {
    if (servers.length <= MIN) return;
    touched = true;
    nudge = false;
    const s = servers.pop();
    const lost = s.queue + (s.busy > 0 ? 1 : 0);
    for (let i = 0; i < lost; i++) {
      const r = { x: g.sx + 8 + i * 8, y: s.y };
      drop(r, null);
      reqs.push(r);
    }
    place(true);
    sync();
    refresh();
  });

  readColors();
  servers.push(makeServer(1));
  layout();
  sync();

  const syncPause = () => {
    if (!pauseBtn) return;
    pauseBtn.hidden = reduce.matches;
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.setAttribute('aria-label', userPaused ? 'Play demo' : 'Pause demo');
    host.classList.toggle('is-paused', userPaused);
  };
  pauseBtn?.addEventListener('click', () => {
    userPaused = !userPaused;
    syncPause();
    if (userPaused) pause();
    else play();
  });
  syncPause();
  if (reduce.matches) snapshot();
  else {
    warm(1.6);
    draw();
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (!layout()) return;
      if (reduce.matches) snapshot();
      else if (!raf) draw();
    }).observe(canvas);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) play();
      else pause();
    }, { threshold: 0.15 }).observe(host);
  } else {
    inView = true;
    play();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else play();
  });

  reduce.addEventListener?.('change', () => {
    syncPause();
    if (reduce.matches) {
      pause();
      snapshot();
    } else play();
  });

  new MutationObserver(() => {
    readColors();
    if (!raf) draw();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  document.fonts?.ready.then(() => {
    if (!raf) draw();
  });
})();
