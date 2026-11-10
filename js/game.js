// Neon Defense: a cyber/neon pixel-art tower defense game.
// Viruses travel along the circuit path toward your server core. Build towers to stop them.
// Mouse: click a tower in the side panel (or press 1-3), then click an empty tile to build.
// Click a built tower to select it, then upgrade (U) or sell (S).
// Space / N = next wave, F = fast forward, P = pause, M = mute, Esc / right-click = cancel.

(() => {
  const TILE = 16;
  const COLS = 20;
  const ROWS = 12;
  const HUD_H = 16;
  const MAP_W = COLS * TILE; // 320
  const PANEL_W = 96;
  const W = MAP_W + PANEL_W; // 416
  const H = HUD_H + ROWS * TILE; // 208
  const MAX_WAVES = 15;
  const START_MONEY = 150;
  const START_LIVES = 20;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  // ---------------------------------------------------------------- scaling
  function fit() {
    const scale = Math.max(1, Math.min((window.innerWidth - 32) / W, (window.innerHeight - 40) / H));
    const s = scale >= 2 ? Math.floor(scale) : scale;
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------------------------------------------------------------- storage
  function loadBest() {
    try { return Number(localStorage.getItem('neonDefenseBest')) || 0; } catch { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem('neonDefenseBest', String(v)); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- audio
  let audio = null;
  let muted = false;
  const lastBeep = {};
  function beep(freq, dur, type = 'square', vol = 0.05, slide = 0, key = null) {
    if (muted) return;
    if (key) {
      const now = performance.now();
      if (lastBeep[key] && now - lastBeep[key] < 60) return; // avoid walls of noise
      lastBeep[key] = now;
    }
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch { /* audio not available */ }
  }
  const sfx = {
    laser: () => beep(1200, 0.05, 'square', 0.015, -500, 'laser'),
    cannon: () => beep(160, 0.15, 'triangle', 0.06, -90, 'cannon'),
    boom: () => beep(90, 0.2, 'sawtooth', 0.04, -50, 'boom'),
    emp: () => beep(500, 0.25, 'sine', 0.04, -350, 'emp'),
    kill: () => beep(700, 0.06, 'square', 0.025, 300, 'kill'),
    build: () => { beep(440, 0.06, 'square', 0.04); setTimeout(() => beep(660, 0.08, 'square', 0.04), 50); },
    sell: () => beep(520, 0.12, 'triangle', 0.05, -260),
    leak: () => beep(140, 0.35, 'sawtooth', 0.07, -80, 'leak'),
    wave: () => { beep(330, 0.1, 'triangle', 0.06); setTimeout(() => beep(495, 0.14, 'triangle', 0.06), 90); },
    deny: () => beep(110, 0.12, 'square', 0.04),
  };

  // ---------------------------------------------------------------- map
  // Path corners in grid coordinates. The first point is just off the left edge.
  const WAYPOINTS = [[-1, 2], [4, 2], [4, 8], [9, 8], [9, 3], [14, 3], [14, 9], [17, 9], [17, 5], [19, 5]];
  const CORE = { c: 19, r: 5 };
  const pathSet = new Set();
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    let [c, r] = WAYPOINTS[i];
    const [c2, r2] = WAYPOINTS[i + 1];
    while (c !== c2 || r !== r2) {
      if (c >= 0) pathSet.add(`${c},${r}`);
      c += Math.sign(c2 - c);
      r += Math.sign(r2 - r);
    }
    pathSet.add(`${c},${r}`);
  }
  pathSet.delete(`${CORE.c},${CORE.r}`);
  const isPath = (c, r) => pathSet.has(`${c},${r}`);
  const WP = WAYPOINTS.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Pre-render the circuit-board map once.
  const mapCanvas = (() => {
    const cv = document.createElement('canvas');
    cv.width = MAP_W; cv.height = ROWS * TILE;
    const c = cv.getContext('2d');
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * TILE;
        const y = r * TILE;
        if (isPath(col, r)) {
          c.fillStyle = '#1d0b3a';
          c.fillRect(x, y, TILE, TILE);
          c.fillStyle = '#2a1250';
          c.fillRect(x + 7, y + 7, 2, 2);
          const edges = [
            [col, r - 1, x, y, TILE, 1], [col, r + 1, x, y + TILE - 1, TILE, 1],
            [col - 1, r, x, y, 1, TILE], [col + 1, r, x + TILE - 1, y, 1, TILE],
          ];
          for (const [nc, nr, ex, ey, ew, eh] of edges) {
            const open = isPath(nc, nr) || (nc < 0 && nr === WAYPOINTS[0][1]) || (nc === CORE.c && nr === CORE.r);
            if (open) continue;
            c.fillStyle = '#ff3ef2';
            c.fillRect(ex, ey, ew, eh);
          }
        } else {
          c.fillStyle = (col + r) % 2 ? '#0d0420' : '#0f0525';
          c.fillRect(x, y, TILE, TILE);
          c.fillStyle = '#1b0d38';
          c.fillRect(x, y, 1, 1);
          // Decorative circuit traces.
          if (Math.random() < 0.3) {
            c.fillStyle = '#24104a';
            const horiz = Math.random() < 0.5;
            const off = 3 + Math.floor(Math.random() * 10);
            if (horiz) c.fillRect(x, y + off, TILE, 1); else c.fillRect(x + off, y, 1, TILE);
            c.fillStyle = '#3d1a6e';
            if (horiz) c.fillRect(x + off, y + off - 1, 3, 3); else c.fillRect(x + off - 1, y + off, 3, 3);
          }
        }
      }
    }
    return cv;
  })();

  let pathLength = 0;
  const segLen = [];
  for (let i = 1; i < WP.length; i++) {
    const l = Math.hypot(WP[i].x - WP[i - 1].x, WP[i].y - WP[i - 1].y);
    segLen.push(l);
    pathLength += l;
  }
  function pointAt(d) {
    for (let i = 0; i < segLen.length; i++) {
      if (d <= segLen[i]) {
        const f = d / segLen[i];
        return { x: WP[i].x + (WP[i + 1].x - WP[i].x) * f, y: WP[i].y + (WP[i + 1].y - WP[i].y) * f };
      }
      d -= segLen[i];
    }
    return WP[WP.length - 1];
  }

  // ---------------------------------------------------------------- definitions
  const TOWERS = {
    laser: {
      name: 'LASER', key: '1', color: '#29f6ff', cost: 50, upgrades: [60, 100],
      range: [44, 50, 58], dmg: [4, 7, 12], rate: [4, 5, 6],
      base: 'baseLaser', head: 'laserHead', blurb: 'FAST BEAM',
    },
    emp: {
      name: 'EMP', key: '2', color: '#ff3ef2', cost: 70, upgrades: [70, 110],
      range: [32, 38, 44], dmg: [2, 3, 5], rate: [1.2, 1.4, 1.6], slow: [0.55, 0.45, 0.35],
      base: 'baseEmp', head: 'empHead', blurb: 'SLOWS ALL',
    },
    cannon: {
      name: 'CANNON', key: '3', color: '#ffe14d', cost: 100, upgrades: [90, 140],
      range: [54, 60, 68], dmg: [16, 28, 45], rate: [0.8, 0.9, 1.0], splash: [20, 22, 26],
      base: 'baseCannon', head: 'cannonHead', blurb: 'SPLASH',
    },
  };
  const TOWER_ORDER = ['laser', 'emp', 'cannon'];

  const ENEMIES = {
    bug: { hp: 20, speed: 28, reward: 5, armor: 0, leak: 1, frames: ['bug1', 'bug2'], color: '#39ff88' },
    worm: { hp: 14, speed: 52, reward: 6, armor: 0, leak: 1, frames: ['worm1', 'worm2'], color: '#ff9f1c' },
    trojan: { hp: 80, speed: 18, reward: 14, armor: 3, leak: 2, frames: ['trojan1', 'trojan2'], color: '#ff4d6d' },
    boss: { hp: 650, speed: 14, reward: 80, armor: 4, leak: 8, frames: ['boss1', 'boss2'], color: '#ff3ef2' },
  };

  function buildWave(n) {
    const list = [];
    const count = 6 + n * 2;
    for (let i = 0; i < count; i++) {
      let type = 'bug';
      const roll = Math.random();
      if (n >= 3 && roll < 0.3) type = 'worm';
      if (n >= 5 && roll > 0.78) type = 'trojan';
      if (n >= 9 && roll > 0.6) type = 'trojan';
      list.push(type);
    }
    if (n === 4) list.splice(4, 0, 'worm', 'worm', 'worm', 'worm');
    if (n % 5 === 0) list.push('boss');
    const gap = Math.max(0.4, 0.85 - n * 0.03);
    return list.map((type, i) => ({ type, at: i * gap }));
  }

  // ---------------------------------------------------------------- state
  let state = 'title'; // title | play | over | won
  let paused = false;
  let fast = false;
  let best = loadBest();
  let money, lives, wave, waveActive, spawnQueue, spawnClock;
  let towers, enemies, shots, beams, rings, particles, popups;
  let buildType = null;
  let selected = null;
  let hover = null; // { c, r } on the map, or null
  let mouse = { x: -1, y: -1 };
  let coreHit = 0;
  let banner = null;
  let time = 0;

  function reset() {
    money = START_MONEY;
    lives = START_LIVES;
    wave = 0;
    waveActive = false;
    spawnQueue = [];
    spawnClock = 0;
    towers = [];
    enemies = [];
    shots = [];
    beams = [];
    rings = [];
    particles = [];
    popups = [];
    buildType = null;
    selected = null;
    coreHit = 0;
    paused = false;
    banner = { text: 'BUILD TOWERS, THEN PRESS SPACE', t: 3 };
  }
  reset();

  // ---------------------------------------------------------------- helpers
  const towerAt = (c, r) => towers.find((t) => t.c === c && t.r === r);
  function canBuildAt(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && !isPath(c, r) &&
      !(c === CORE.c && r === CORE.r) && !towerAt(c, r);
  }
  const stat = (t, key) => TOWERS[t.type][key][t.level];
  const upgradeCost = (t) => (t.level < 2 ? TOWERS[t.type].upgrades[t.level] : null);
  const sellValue = (t) => Math.floor(t.invested * 0.7);

  function popup(x, y, text, color = '#ffe14d') {
    popups.push({ x, y, text, color, life: 0.9 });
  }
  function burst(x, y, colors, n, power = 60) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(power * 0.3, power);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6), max: 0.6, color: colors[i % colors.length] });
    }
  }

  // ---------------------------------------------------------------- actions
  function startWave() {
    if (state !== 'play' || waveActive || wave >= MAX_WAVES) return;
    wave++;
    waveActive = true;
    spawnQueue = buildWave(wave);
    spawnClock = 0;
    banner = { text: wave % 5 === 0 ? `WAVE ${wave}: BOSS INCOMING` : `WAVE ${wave}`, t: 1.6 };
    sfx.wave();
  }

  function build(c, r) {
    const def = TOWERS[buildType];
    if (!canBuildAt(c, r)) { sfx.deny(); return; }
    if (money < def.cost) { sfx.deny(); popup(c * TILE, r * TILE + HUD_H, 'NEED $', '#ff4d6d'); return; }
    money -= def.cost;
    const t = { type: buildType, c, r, x: c * TILE + 8, y: r * TILE + 8, level: 0, cd: 0, angle: 0, invested: def.cost };
    towers.push(t);
    burst(t.x, t.y, [def.color, '#ffffff'], 10, 50);
    sfx.build();
    if (money < def.cost) buildType = null;
  }

  function upgrade() {
    if (!selected) return;
    const cost = upgradeCost(selected);
    if (cost === null) return;
    if (money < cost) { sfx.deny(); popup(selected.x - 8, selected.y - 10 + HUD_H, 'NEED $', '#ff4d6d'); return; }
    money -= cost;
    selected.level++;
    selected.invested += cost;
    burst(selected.x, selected.y, [TOWERS[selected.type].color, '#ffffff'], 14, 60);
    popup(selected.x - 8, selected.y - 10 + HUD_H, `LV${selected.level + 1}`, TOWERS[selected.type].color);
    sfx.build();
  }

  function sell() {
    if (!selected) return;
    const v = sellValue(selected);
    money += v;
    popup(selected.x - 8, selected.y - 10 + HUD_H, `+$${v}`);
    burst(selected.x, selected.y, ['#6b5b95', '#ffffff'], 10, 40);
    towers = towers.filter((t) => t !== selected);
    selected = null;
    sfx.sell();
  }

  function damage(e, amount, ignoreArmor = false) {
    if (e.dead) return;
    e.hp -= ignoreArmor ? amount : Math.max(1, amount - e.armor);
    e.flash = 0.06;
    if (e.hp <= 0) {
      e.dead = true;
      money += e.reward;
      popup(e.x - 6, e.y - 8 + HUD_H, `+${e.reward}`);
      const big = e.type === 'boss';
      burst(e.x, e.y, [ENEMIES[e.type].color, '#ffffff'], big ? 30 : 10, big ? 90 : 55);
      sfx.kill();
    }
  }

  // ---------------------------------------------------------------- update
  function spawn(type) {
    const def = ENEMIES[type];
    const mul = 1 + 0.2 * (wave - 1) + 0.012 * (wave - 1) ** 2;
    const hp = Math.round(def.hp * mul);
    enemies.push({
      type, x: WP[0].x, y: WP[0].y, seg: 1, dist: 0, hp, maxHp: hp,
      speed: def.speed, armor: def.armor, leak: def.leak,
      reward: Math.round(def.reward * (1 + 0.04 * (wave - 1))),
      slowT: 0, slowMul: 1, anim: rand(0, 1), flash: 0,
    });
  }

  function update(dt) {
    time += dt;

    // Spawning.
    if (waveActive) {
      spawnClock += dt;
      while (spawnQueue.length && spawnQueue[0].at <= spawnClock) spawn(spawnQueue.shift().type);
    }

    // Enemies.
    for (const e of enemies) {
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
      let move = e.speed * e.slowMul * dt;
      e.anim += (dt * e.speed * e.slowMul) / 10;
      e.flash = Math.max(0, e.flash - dt);
      while (move > 0 && e.seg < WP.length) {
        const dx = WP[e.seg].x - e.x;
        const dy = WP[e.seg].y - e.y;
        const d = Math.hypot(dx, dy);
        if (d <= move) {
          e.x = WP[e.seg].x; e.y = WP[e.seg].y; e.seg++; move -= d; e.dist += d;
        } else {
          e.x += (dx / d) * move; e.y += (dy / d) * move; e.dist += move; move = 0;
        }
      }
      if (e.seg >= WP.length && !e.dead) {
        e.dead = true;
        lives -= e.leak;
        coreHit = 0.4;
        burst(e.x, e.y, ['#ff4d6d', '#29f6ff'], 12, 60);
        sfx.leak();
      }
    }

    // Towers.
    for (const t of towers) {
      t.cd -= dt;
      const range = stat(t, 'range');
      let target = null;
      for (const e of enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) <= range && (!target || e.dist > target.dist)) target = e;
      }
      if (target && t.type !== 'emp') {
        const want = Math.atan2(target.y - t.y, target.x - t.x);
        let diff = want - t.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        t.angle += diff * Math.min(1, dt * 18);
      }
      if (!target || t.cd > 0) continue;
      t.cd = 1 / stat(t, 'rate');
      if (t.type === 'laser') {
        damage(target, stat(t, 'dmg'));
        beams.push({ x1: t.x + Math.cos(t.angle) * 7, y1: t.y + Math.sin(t.angle) * 7, x2: target.x, y2: target.y, t: 0.07, w: t.level + 1 });
        sfx.laser();
      } else if (t.type === 'cannon') {
        shots.push({ x: t.x + Math.cos(t.angle) * 7, y: t.y + Math.sin(t.angle) * 7, target, tx: target.x, ty: target.y, dmg: stat(t, 'dmg'), splash: stat(t, 'splash') });
        sfx.cannon();
      } else {
        const slow = stat(t, 'slow');
        for (const e of enemies) {
          if (e.dead || Math.hypot(e.x - t.x, e.y - t.y) > range) continue;
          damage(e, stat(t, 'dmg'), true);
          e.slowMul = Math.min(e.slowMul, slow);
          e.slowT = 1.3;
        }
        rings.push({ x: t.x, y: t.y, r: range, t: 0.35 });
        t.pulse = 0.2;
        sfx.emp();
      }
    }

    // Cannon shells home in on their target, then explode.
    for (const s of shots) {
      if (s.target && !s.target.dead) { s.tx = s.target.x; s.ty = s.target.y; }
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const d = Math.hypot(dx, dy);
      const step = 150 * dt;
      if (d <= step) {
        s.done = true;
        for (const e of enemies) {
          if (!e.dead && Math.hypot(e.x - s.tx, e.y - s.ty) <= s.splash) damage(e, s.dmg);
        }
        burst(s.tx, s.ty, ['#ffe14d', '#ff9f1c', '#ffffff'], 12, 70);
        rings.push({ x: s.tx, y: s.ty, r: s.splash, t: 0.2, color: '#ffe14d' });
        sfx.boom();
      } else {
        s.x += (dx / d) * step; s.y += (dy / d) * step;
      }
    }
    shots = shots.filter((s) => !s.done);
    enemies = enemies.filter((e) => !e.dead);
    for (const t of towers) if (t.pulse) t.pulse = Math.max(0, t.pulse - dt);

    // Wave end / game end.
    if (lives <= 0) {
      lives = 0;
      state = 'over';
      if (wave - 1 > best) { best = wave - 1; saveBest(best); }
      selected = null; buildType = null;
      return;
    }
    if (waveActive && spawnQueue.length === 0 && enemies.length === 0) {
      waveActive = false;
      if (wave > best) { best = wave; saveBest(best); }
      if (wave >= MAX_WAVES) {
        state = 'won';
        selected = null; buildType = null;
      } else {
        const bonus = 20 + wave * 5;
        money += bonus;
        banner = { text: `WAVE CLEAR  +$${bonus}`, t: 2 };
      }
    }

    updateFx(dt);
  }

  function updateFx(dt) {
    for (const b of beams) b.t -= dt;
    beams = beams.filter((b) => b.t > 0);
    for (const r of rings) r.t -= dt;
    rings = rings.filter((r) => r.t > 0);
    for (const p of particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of popups) { p.life -= dt; p.y -= 16 * dt; }
    popups = popups.filter((p) => p.life > 0);
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    coreHit = Math.max(0, coreHit - dt);
  }

  // ---------------------------------------------------------------- drawing
  function text(str, x, y, color = '#ffffff', align = 'left', glow = null, size = 8) {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#05010f';
    ctx.fillText(str, Math.round(x) + 1, Math.round(y) + 1);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 5; }
    ctx.fillStyle = color;
    ctx.fillText(str, Math.round(x), Math.round(y));
    ctx.shadowBlur = 0;
  }

  function drawTower(t, x, y, angle, alpha = 1) {
    const def = TOWERS[t.type];
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    ctx.drawImage(SPRITES[def.base], x - 8, y - 8);
    const head = SPRITES[def.head];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (t.type === 'emp') {
      if (t.pulse) { ctx.shadowColor = '#ff3ef2'; ctx.shadowBlur = 8; }
      ctx.drawImage(head, -5, -5);
    } else {
      ctx.rotate(angle);
      ctx.drawImage(head, -4, -4);
    }
    ctx.restore();
    for (let i = 0; i <= t.level; i++) {
      ctx.fillStyle = def.color;
      ctx.fillRect(x - 4 + i * 3, y + 5, 2, 1);
    }
    ctx.globalAlpha = prev;
  }

  function drawRange(x, y, r, color) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r - 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawMap() {
    ctx.drawImage(mapCanvas, 0, 0);

    // Spawn portal.
    const py = WAYPOINTS[0][1] * TILE + 8;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const r = 3 + ((time * 8 + i * 3) % 9);
      ctx.globalAlpha = 1 - r / 12;
      ctx.strokeStyle = '#ff4d6d';
      ctx.beginPath(); ctx.arc(0, py, r, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Data packets flowing along the path.
    ctx.fillStyle = 'rgba(41, 246, 255, 0.3)';
    for (let i = 0; i < 18; i++) {
      const p = pointAt((time * 20 + i * 40) % pathLength);
      ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
    }

    // Core.
    const cx = CORE.c * TILE;
    const cy = CORE.r * TILE;
    if (coreHit > 0 && Math.floor(coreHit * 20) % 2) {
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(cx - 1, cy - 1, 18, 18);
    }
    ctx.shadowColor = '#29f6ff'; ctx.shadowBlur = 6;
    ctx.drawImage(SPRITES.core[Math.floor(time * 3) % 2], cx, cy);
    ctx.shadowBlur = 0;
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(0, HUD_H);
    drawMap();

    if (selected) drawRange(selected.x, selected.y, stat(selected, 'range'), TOWERS[selected.type].color);
    for (const t of towers) drawTower(t, t.x, t.y, t.angle);

    for (const e of enemies) {
      const def = ENEMIES[e.type];
      const img = SPRITES[def.frames[Math.floor(e.anim) % 2]];
      const x = Math.round(e.x - img.width / 2);
      const y = Math.round(e.y - img.height / 2);
      ctx.shadowColor = def.color; ctx.shadowBlur = 4;
      ctx.drawImage(img, x, y);
      ctx.shadowBlur = 0;
      if (e.flash > 0) {
        ctx.globalAlpha = 0.7; ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(img, x, y);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      if (e.slowT > 0) {
        ctx.fillStyle = '#ff3ef2';
        ctx.fillRect(x - 1, y + img.height - 1, 1, 1);
        ctx.fillRect(x + img.width, y + 1, 1, 1);
      }
      if (e.hp < e.maxHp) {
        const bw = Math.max(10, img.width);
        const bx = Math.round(e.x - bw / 2);
        ctx.fillStyle = '#3a0d1f';
        ctx.fillRect(bx, y - 3, bw, 1);
        ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#39ff88' : '#ff4d6d';
        ctx.fillRect(bx, y - 3, Math.max(1, Math.round((bw * e.hp) / e.maxHp)), 1);
      }
    }

    for (const s of shots) {
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 3, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    for (const b of beams) {
      ctx.strokeStyle = '#29f6ff';
      ctx.lineWidth = b.w;
      ctx.shadowColor = '#29f6ff'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    ctx.lineWidth = 1;
    for (const r of rings) {
      ctx.globalAlpha = Math.min(1, r.t * 4);
      ctx.strokeStyle = r.color || '#ff3ef2';
      const rr = r.color ? r.r : r.r * (1 - (r.t / 0.35) * 0.7);
      ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, rr), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;

    // Build preview / hover outline.
    if (state === 'play' && buildType && hover) {
      const ok = canBuildAt(hover.c, hover.r) && money >= TOWERS[buildType].cost;
      const x = hover.c * TILE + 8;
      const y = hover.r * TILE + 8;
      drawRange(x, y, TOWERS[buildType].range[0], ok ? TOWERS[buildType].color : '#ff4d6d');
      drawTower({ type: buildType, level: 0 }, x, y, 0, 0.7);
      if (!ok) {
        ctx.strokeStyle = '#ff4d6d';
        ctx.strokeRect(hover.c * TILE + 0.5, hover.r * TILE + 0.5, TILE - 1, TILE - 1);
      }
    } else if (state === 'play' && hover && towerAt(hover.c, hover.r) && towerAt(hover.c, hover.r) !== selected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.strokeRect(hover.c * TILE + 0.5, hover.r * TILE + 0.5, TILE - 1, TILE - 1);
    }
    ctx.restore();

    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      text(p.text, p.x, p.y, p.color);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- HUD & panel
  const PX = MAP_W;
  const buttons = [];
  function button(id, x, y, w, h) {
    buttons.push({ id, x, y, w, h });
    return mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h;
  }
  function box(x, y, w, h, border, fill = '#12062a') {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawHud() {
    ctx.fillStyle = '#0a0218';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = '#ff3ef2';
    ctx.fillRect(0, HUD_H - 1, W, 1);
    ctx.drawImage(SPRITES.heart, 6, 4);
    text(String(lives), 16, 4, coreHit > 0 ? '#ff4d6d' : '#29f6ff');
    ctx.drawImage(SPRITES.chip, 48, 4);
    text(`$${money}`, 58, 4, '#ffe14d');
    text(`WAVE ${wave}/${MAX_WAVES}`, 120, 4, '#ff3ef2');
    if (fast) text('>>', 222, 4, '#29f6ff');
    if (paused) text('PAUSED', 244, 4, '#ffffff');
    if (muted) text('MUTE', W - 6, 4, '#6b5b95', 'right');
  }

  function drawPanel() {
    buttons.length = 0;
    ctx.fillStyle = '#0a0218';
    ctx.fillRect(PX, HUD_H, PANEL_W, H - HUD_H);
    ctx.fillStyle = '#3d1a6e';
    ctx.fillRect(PX, HUD_H, 1, H - HUD_H);

    text('BUILD', PX + 6, HUD_H + 4, '#6b5b95');
    TOWER_ORDER.forEach((type, i) => {
      const def = TOWERS[type];
      const x = PX + 4;
      const y = HUD_H + 15 + i * 30;
      const hot = button(`build:${type}`, x, y, 88, 27);
      const afford = money >= def.cost;
      const active = buildType === type;
      box(x, y, 88, 27, active ? def.color : hot ? '#6b5b95' : '#2a1250', active ? '#1d0b3a' : '#12062a');
      ctx.globalAlpha = afford ? 1 : 0.4;
      drawTower({ type, level: 0 }, x + 11, y + 13, -0.5);
      text(def.name, x + 22, y + 5, def.color);
      text(`$${def.cost}`, x + 22, y + 16, afford ? '#ffe14d' : '#ff4d6d');
      ctx.globalAlpha = 1;
      text(def.key, x + 80, y + 16, '#6b5b95');
    });

    const iy = HUD_H + 108;
    if (selected) {
      const t = selected;
      const def = TOWERS[t.type];
      text(`${def.name} L${t.level + 1}`, PX + 6, iy, def.color);
      const line = t.type === 'emp' ? `SLOW ${Math.round((1 - stat(t, 'slow')) * 100)}%` : `DMG ${stat(t, 'dmg')}`;
      text(line, PX + 6, iy + 11, '#ffffff');
      text(`RNG ${stat(t, 'range')}`, PX + 6, iy + 21, '#ffffff');
      const up = upgradeCost(t);
      const uy = iy + 33;
      if (up !== null) {
        const hot = button('upgrade', PX + 4, uy, 88, 14);
        box(PX + 4, uy, 88, 14, money >= up ? (hot ? '#39ff88' : '#127a46') : '#3a0d1f');
        text(`UP $${up}`, PX + 8, uy + 3, money >= up ? '#39ff88' : '#ff4d6d');
        text('U', PX + 82, uy + 3, '#6b5b95');
      } else {
        box(PX + 4, uy, 88, 14, '#2a1250');
        text('MAX LEVEL', PX + 8, uy + 3, '#6b5b95');
      }
      const sy = uy + 17;
      const hot = button('sell', PX + 4, sy, 88, 14);
      box(PX + 4, sy, 88, 14, hot ? '#ff9f1c' : '#6a3a12');
      text(`SELL $${sellValue(t)}`, PX + 8, sy + 3, '#ff9f1c');
      text('S', PX + 82, sy + 3, '#6b5b95');
    } else if (buildType) {
      const def = TOWERS[buildType];
      text(def.blurb, PX + 6, iy, def.color);
      text('CLICK A', PX + 6, iy + 14, '#6b5b95');
      text('FREE TILE', PX + 6, iy + 24, '#6b5b95');
      text('ESC CANCEL', PX + 6, iy + 38, '#6b5b95');
    } else {
      text('CLICK A', PX + 6, iy, '#6b5b95');
      text('TOWER TO', PX + 6, iy + 10, '#6b5b95');
      text('UPGRADE', PX + 6, iy + 20, '#6b5b95');
      text('F  FAST', PX + 6, iy + 36, '#6b5b95');
      text('P  PAUSE', PX + 6, iy + 46, '#6b5b95');
    }

    const wy = H - 22;
    if (state === 'play') {
      if (!waveActive) {
        const hot = button('wave', PX + 4, wy, 88, 18);
        const pulse = Math.floor(time * 2) % 2 === 0;
        box(PX + 4, wy, 88, 18, hot || pulse ? '#29f6ff' : '#0e8fa8', hot ? '#0e2a3a' : '#12062a');
        text('NEXT WAVE', PX + 48, wy + 5, '#29f6ff', 'center', '#29f6ff');
      } else {
        box(PX + 4, wy, 88, 18, '#2a1250');
        text(`${spawnQueue.length + enemies.length} LEFT`, PX + 48, wy + 5, '#ff4d6d', 'center');
      }
    }
  }

  function drawOverlay() {
    if (banner && state === 'play') {
      ctx.globalAlpha = Math.min(1, banner.t * 2);
      ctx.fillStyle = 'rgba(10, 2, 24, 0.75)';
      ctx.fillRect(0, HUD_H + 80, MAP_W, 22);
      text(banner.text, MAP_W / 2, HUD_H + 87, '#ffffff', 'center', '#ff3ef2');
      ctx.globalAlpha = 1;
    }
    const blink = Math.floor(time * 2) % 2 === 0;
    if (state === 'title') {
      ctx.fillStyle = 'rgba(5, 1, 15, 0.82)';
      ctx.fillRect(0, 0, W, H);
      text('NEON DEFENSE', W / 2, 36, '#29f6ff', 'center', '#29f6ff', 16);
      text('VIRUSES ARE COMING FOR THE CORE', W / 2, 64, '#ffffff', 'center');
      const f = Math.floor(time * 4) % 2;
      const lineup = [f ? 'bug2' : 'bug1', f ? 'worm2' : 'worm1', f ? 'trojan2' : 'trojan1', f ? 'boss2' : 'boss1'];
      let lx = W / 2 - 84;
      for (const name of lineup) {
        const img = SPRITES[name];
        ctx.drawImage(img, lx, 93 - img.height, img.width * 2, img.height * 2);
        lx += img.width * 2 + 8;
      }
      ctx.drawImage(SPRITES.core[Math.floor(time * 3) % 2], lx + 8, 78, 30, 30);
      text('CLICK A TOWER, THEN A TILE TO BUILD', W / 2, 118, '#ffe14d', 'center');
      text(`SURVIVE ${MAX_WAVES} WAVES`, W / 2, 130, '#ffe14d', 'center');
      if (blink) text('CLICK OR PRESS SPACE TO START', W / 2, 150, '#ff3ef2', 'center', '#ff3ef2');
      if (best) text(`BEST: WAVE ${best}`, W / 2, 170, '#6b5b95', 'center');
    } else if (state === 'over' || state === 'won') {
      ctx.fillStyle = 'rgba(5, 1, 15, 0.8)';
      ctx.fillRect(0, 60, W, 82);
      if (state === 'over') {
        text('CORE BREACHED', W / 2, 72, '#ff4d6d', 'center', '#ff4d6d', 16);
        text(`YOU HELD ${wave - 1} WAVES   BEST ${best}`, W / 2, 100, '#ffffff', 'center');
      } else {
        text('NETWORK SECURED', W / 2, 72, '#39ff88', 'center', '#39ff88', 16);
        text(`ALL ${MAX_WAVES} WAVES CLEARED, ${lives} LIVES LEFT`, W / 2, 100, '#ffffff', 'center');
      }
      if (blink) text('CLICK OR PRESS SPACE TO PLAY AGAIN', W / 2, 122, '#29f6ff', 'center', '#29f6ff');
    } else if (paused) {
      ctx.fillStyle = 'rgba(5, 1, 15, 0.6)';
      ctx.fillRect(0, HUD_H, MAP_W, H - HUD_H);
      text('PAUSED', MAP_W / 2, H / 2 - 4, '#ffffff', 'center', '#29f6ff', 16);
    }
  }

  function draw() {
    ctx.fillStyle = '#05010f';
    ctx.fillRect(0, 0, W, H);
    drawWorld();
    drawHud();
    drawPanel();
    drawOverlay();
  }

  // ---------------------------------------------------------------- input
  function toCanvas(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: (ev.clientX - rect.left) * (W / rect.width), y: (ev.clientY - rect.top) * (H / rect.height) };
  }
  function updateHover() {
    const c = Math.floor(mouse.x / TILE);
    const r = Math.floor((mouse.y - HUD_H) / TILE);
    hover = mouse.x >= 0 && mouse.x < MAP_W && mouse.y >= HUD_H && r < ROWS ? { c, r } : null;
  }

  canvas.addEventListener('pointermove', (ev) => { mouse = toCanvas(ev); updateHover(); });
  canvas.addEventListener('pointerleave', () => { hover = null; mouse = { x: -1, y: -1 }; });
  canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); buildType = null; selected = null; });

  function startGame() { reset(); state = 'play'; sfx.wave(); }

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    mouse = toCanvas(ev);
    updateHover();
    if (state === 'title' || state === 'over' || state === 'won') { startGame(); return; }

    const hit = buttons.find((b) => mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h);
    if (hit) {
      if (hit.id.startsWith('build:')) {
        const type = hit.id.slice(6);
        buildType = buildType === type ? null : type;
        selected = null;
      } else if (hit.id === 'upgrade') upgrade();
      else if (hit.id === 'sell') sell();
      else if (hit.id === 'wave') startWave();
      return;
    }
    if (!hover || paused) return;
    const t = towerAt(hover.c, hover.r);
    if (t) { selected = t; buildType = null; return; }
    if (buildType) { build(hover.c, hover.r); return; }
    selected = null;
  });

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'KeyM') { muted = !muted; return; }
    const startKey = e.code === 'Space' || e.code === 'Enter';
    if (state === 'title' && startKey) { startGame(); return; }
    if ((state === 'over' || state === 'won') && (startKey || e.code === 'KeyR')) { startGame(); return; }
    if (state !== 'play') return;
    if (e.code === 'KeyP') { paused = !paused; return; }
    if (e.code === 'KeyF') { fast = !fast; return; }
    if (startKey || e.code === 'KeyN') { startWave(); return; }
    if (e.code === 'Escape') { buildType = null; selected = null; return; }
    const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (idx >= 0) {
      const type = TOWER_ORDER[idx];
      buildType = buildType === type ? null : type;
      selected = null;
      return;
    }
    if (e.code === 'KeyU') upgrade();
    if (e.code === 'KeyS') sell();
  });
  window.addEventListener('blur', () => { if (state === 'play') paused = true; });

  // ---------------------------------------------------------------- loop
  const STEP = 1 / 120;
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      if (state === 'play' && !paused) {
        update(STEP);
        if (fast && state === 'play') update(STEP);
      } else {
        time += STEP;
        updateFx(STEP);
      }
      acc -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Exposed for automated testing only.
  window.__neonDefense = {
    get state() { return state; }, get wave() { return wave; }, get money() { return money; },
    get lives() { return lives; }, get waveActive() { return waveActive; }, get towers() { return towers; },
    canBuildAt, isPath,
  };
})();
