// Neon Dash: a cyber/neon pixel-art endless runner.
// Controls: Space / Up / W = jump (hold for higher), Down / S = duck (fast-fall in the air),
// P = pause, M = mute, Space / Enter = start / restart.

(() => {
  const W = 320;
  const H = 180;
  const S = 2; // sprite scale in logical pixels
  const GROUND = 150;
  const PLAYER_X = 48;

  const GRAVITY = 980;
  const JUMP_VEL = -340;
  const JUMP_CUT = -130;
  const FAST_FALL = 1800;
  const START_SPEED = 130;
  const MAX_SPEED = 340;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  // ---------------------------------------------------------------- scaling
  function fit() {
    const scale = Math.max(1, Math.min(window.innerWidth / W, window.innerHeight / H));
    const s = scale >= 2 ? Math.floor(scale) : scale;
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------------------------------------------------------------- storage
  function loadBest() {
    try { return Number(localStorage.getItem('neonDashBest')) || 0; } catch { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem('neonDashBest', String(v)); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- audio
  let audio = null;
  let muted = false;
  function beep(freq, dur, type = 'square', vol = 0.06, slide = 0) {
    if (muted) return;
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
    jump: () => beep(420, 0.12, 'square', 0.05, 380),
    chip: () => { beep(880, 0.08, 'square', 0.04); setTimeout(() => beep(1320, 0.1, 'square', 0.04), 60); },
    die: () => beep(300, 0.5, 'sawtooth', 0.07, -260),
    milestone: () => { beep(660, 0.08, 'triangle', 0.06); setTimeout(() => beep(990, 0.12, 'triangle', 0.06), 80); },
  };

  // ---------------------------------------------------------------- background art
  function rand(a, b) { return a + Math.random() * (b - a); }

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#0b0221');
  sky.addColorStop(0.55, '#2a0845');
  sky.addColorStop(1, '#6a0f5c');

  const stars = Array.from({ length: 70 }, () => ({
    x: Math.floor(rand(0, W)), y: Math.floor(rand(0, GROUND - 50)),
    p: rand(0, Math.PI * 2), b: Math.random() < 0.2,
  }));

  // Pixel sunset sun with the classic horizontal cut-outs.
  const sunCanvas = (() => {
    const r = 34;
    const cv = document.createElement('canvas');
    cv.width = r * 2; cv.height = r * 2;
    const c = cv.getContext('2d');
    for (let y = 0; y < r * 2; y++) {
      const dy = y - r + 0.5;
      const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (y > r * 0.9) {
        const band = Math.floor((y - r * 0.9) / 5);
        const gap = 1 + Math.floor(band / 2);
        if ((y - Math.floor(r * 0.9)) % 5 < gap) continue;
      }
      const t = y / (r * 2);
      const rr = 255;
      const gg = Math.round(225 - t * 190);
      const bb = Math.round(77 + t * 150);
      c.fillStyle = `rgb(${rr},${gg},${bb})`;
      c.fillRect(r - half, y, half * 2, 1);
    }
    return cv;
  })();

  // Procedural skyline strips, rendered once and tiled.
  function buildSkyline(width, minH, maxH, body, edge, windows, density) {
    const cv = document.createElement('canvas');
    cv.width = width; cv.height = maxH + 10;
    const c = cv.getContext('2d');
    let x = 0;
    while (x < width) {
      const bw = Math.floor(rand(12, 30));
      const bh = Math.floor(rand(minH, maxH));
      const top = cv.height - bh;
      c.fillStyle = body;
      c.fillRect(x, top, bw, bh);
      c.fillStyle = edge;
      c.fillRect(x, top, bw, 1);
      c.fillRect(x, top, 1, bh);
      if (Math.random() < 0.3) c.fillRect(x + Math.floor(bw / 2), top - 5, 1, 5); // antenna
      for (let wy = top + 3; wy < cv.height - 3; wy += 4) {
        for (let wx = x + 3; wx < x + bw - 2; wx += 4) {
          if (Math.random() < density) {
            c.fillStyle = windows[Math.floor(Math.random() * windows.length)];
            c.fillRect(wx, wy, 2, 1);
          }
        }
      }
      x += bw + Math.floor(rand(0, 4));
    }
    return cv;
  }
  const farCity = buildSkyline(640, 20, 60, '#1d0b3a', '#3d1a6e', ['#3b2a7a', '#5a2f8a'], 0.35);
  const nearCity = buildSkyline(640, 14, 42, '#12062a', '#6a2a8a', ['#29f6ff', '#ff3ef2', '#ffe14d'], 0.18);

  function drawTiled(img, offset, y) {
    const w = img.width;
    const x = -Math.floor(((offset % w) + w) % w);
    ctx.drawImage(img, x, y);
    ctx.drawImage(img, x + w, y);
  }

  function drawBackground(time, scroll) {
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND);

    for (const s of stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + s.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.b ? '#29f6ff' : '#ffffff';
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    ctx.globalAlpha = 1;

    ctx.drawImage(sunCanvas, 222, GROUND - 78);
    drawTiled(farCity, scroll * 0.12, GROUND - farCity.height);
    drawTiled(nearCity, scroll * 0.3, GROUND - nearCity.height);

    // Ground with a perspective neon grid.
    ctx.fillStyle = '#0d0420';
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = 'rgba(255, 62, 242, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const vx = W / 2;
    const spacing = 24;
    const off = (scroll % spacing);
    for (let i = -16; i <= 16; i++) {
      const bx = vx + i * spacing * 4 - off * 4;
      ctx.moveTo(vx + (bx - vx) * 0.08 + 0.5, GROUND);
      ctx.lineTo(bx + 0.5, H);
    }
    for (let i = 0; i < 8; i++) {
      const t = ((i + (scroll % 40) / 40) % 8) / 8;
      const y = Math.round(GROUND + (H - GROUND) * t * t) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff3ef2';
    ctx.fillRect(0, GROUND, W, 1);
    ctx.fillStyle = 'rgba(255, 62, 242, 0.35)';
    ctx.fillRect(0, GROUND + 1, W, 1);
  }

  // ---------------------------------------------------------------- game state
  let state = 'title';
  let paused = false;
  let best = loadBest();
  let player, obstacles, pickups, particles, popups;
  let speed, distance, chips, score, spawnIn, chipIn, elapsed, shake, flash, nextMilestone;
  const keys = new Set();

  function reset() {
    player = { y: GROUND, vy: 0, onGround: true, ducking: false, anim: 0, alive: true };
    obstacles = [];
    pickups = [];
    particles = [];
    popups = [];
    speed = START_SPEED;
    distance = 0;
    chips = 0;
    score = 0;
    spawnIn = 220;
    chipIn = 320;
    elapsed = 0;
    shake = 0;
    flash = 0;
    nextMilestone = 500;
  }
  reset();

  function playerBox() {
    if (player.ducking && player.onGround) {
      return { x: PLAYER_X + 2, y: player.y - 16, w: 24, h: 16 };
    }
    return { x: PLAYER_X + 5, y: player.y - 26, w: 14, h: 24 };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function burst(x, y, colors, n, power = 120) {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const sp = rand(power * 0.3, power);
      particles.push({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 40,
        life: rand(0.4, 0.9), max: 0.9, color: colors[i % colors.length], g: 300,
      });
    }
  }

  // ---------------------------------------------------------------- spawning
  function spawnObstacle() {
    const roll = Math.random();
    const droneChance = elapsed > 8 ? 0.35 : 0;
    if (roll < droneChance) {
      const low = Math.random() < 0.7;
      obstacles.push({
        type: 'drone', x: W + 10, w: 28, h: 16,
        // Low drones must be ducked under (or jumped high over); high ones punish jumping.
        y: low ? GROUND - 20 - 16 : GROUND - 48 - 16,
        bob: rand(0, Math.PI * 2),
      });
    } else {
      const maxSeg = Math.min(4, 1 + Math.floor(elapsed / 12));
      const seg = 1 + Math.floor(Math.random() * maxSeg);
      const sprite = SPRITES.walls[seg - 1];
      obstacles.push({ type: 'wall', x: W + 10, w: sprite.width * S, h: sprite.height * S, sprite });
      if (elapsed > 20 && Math.random() < 0.25) {
        const s2 = SPRITES.walls[0];
        obstacles.push({ type: 'wall', x: W + 10 + sprite.width * S + 6, w: s2.width * S, h: s2.height * S, sprite: s2 });
      }
    }
    const minGap = speed * 0.8 + 50;
    spawnIn = minGap + rand(0, 160);
  }

  function spawnChip() {
    const high = Math.random() < 0.5;
    pickups.push({ x: W + 10, y: high ? GROUND - 70 : GROUND - 26, w: 14, h: 14, t: rand(0, 6) });
    chipIn = rand(260, 520);
  }

  // ---------------------------------------------------------------- update
  function jumpPressed() {
    return keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW');
  }
  function duckPressed() {
    return keys.has('ArrowDown') || keys.has('KeyS');
  }

  function update(dt) {
    elapsed += dt;
    speed = Math.min(MAX_SPEED, START_SPEED + elapsed * 4.5);
    const dx = speed * dt;
    distance += dx;

    // Player physics.
    player.ducking = duckPressed();
    if (!player.onGround) {
      player.vy += (player.ducking ? FAST_FALL : GRAVITY) * dt;
      if (!jumpPressed() && player.vy < JUMP_CUT) player.vy = JUMP_CUT;
    }
    player.y += player.vy * dt;
    if (player.y >= GROUND) {
      if (!player.onGround) burst(PLAYER_X + 12, GROUND, ['#29f6ff', '#0e8fa8'], 6, 60);
      player.y = GROUND;
      player.vy = 0;
      player.onGround = true;
    }
    player.anim += dt * (speed / 12);

    // Neon trail.
    if (Math.random() < 0.6) {
      const b = playerBox();
      particles.push({
        x: b.x, y: rand(b.y + 4, b.y + b.h - 2), vx: -speed * 0.6, vy: 0,
        life: 0.3, max: 0.3, color: Math.random() < 0.5 ? '#29f6ff' : '#ff3ef2', g: 0,
      });
    }

    // World.
    spawnIn -= dx;
    if (spawnIn <= 0) spawnObstacle();
    chipIn -= dx;
    if (chipIn <= 0) spawnChip();

    for (const o of obstacles) {
      o.x -= dx;
      if (o.type === 'drone') {
        o.bob += dt * 6;
        o.x -= dt * 30; // drones fly towards you a little faster
      }
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -20);
    for (const p of pickups) { p.x -= dx; p.t += dt; }
    pickups = pickups.filter((p) => p.x + p.w > -20 && !p.taken);

    // Collisions.
    const pb = playerBox();
    for (const o of obstacles) {
      const ob = o.type === 'wall'
        ? { x: o.x + 4, y: GROUND - o.h + 4, w: o.w - 8, h: o.h - 4 }
        : { x: o.x + 4, y: o.y + Math.round(Math.sin(o.bob)) + 4, w: o.w - 8, h: o.h - 8 };
      if (overlap(pb, ob)) { die(); return; }
    }
    for (const p of pickups) {
      if (overlap(pb, { x: p.x, y: p.y, w: p.w, h: p.h })) {
        p.taken = true;
        chips++;
        burst(p.x + 7, p.y + 7, ['#ffe14d', '#ff9f1c', '#ffffff'], 12, 90);
        popups.push({ x: p.x, y: p.y, text: '+50', life: 0.8 });
        sfx.chip();
      }
    }

    score = Math.floor(distance / 10) + chips * 50;
    if (score >= nextMilestone) {
      sfx.milestone();
      flash = 0.15;
      popups.push({ x: W / 2 - 16, y: 40, text: `${nextMilestone}!`, life: 1.0 });
      nextMilestone += 500;
    }

    updateFx(dt);
  }

  function updateFx(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of popups) { p.life -= dt; p.y -= 20 * dt; }
    popups = popups.filter((p) => p.life > 0);
    shake = Math.max(0, shake - dt);
    flash = Math.max(0, flash - dt);
  }

  function die() {
    player.alive = false;
    state = 'over';
    shake = 0.35;
    flash = 0.2;
    sfx.die();
    const b = playerBox();
    burst(b.x + b.w / 2, b.y + b.h / 2, ['#29f6ff', '#ff3ef2', '#ffffff', '#ff4d6d'], 40, 180);
    if (score > best) { best = score; saveBest(best); }
  }

  // ---------------------------------------------------------------- draw
  function sprite(img, x, y, glow) {
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 6; }
    ctx.drawImage(img, Math.round(x), Math.round(y), img.width * S, img.height * S);
    ctx.shadowBlur = 0;
  }

  function text(str, x, y, color = '#ffffff', size = 8, align = 'left', glow = null) {
    ctx.font = `${size}px "Press Start 2P", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#12062a';
    ctx.fillText(str, x + 1, y + 1);
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 6; }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function drawPlayer() {
    let img;
    if (!player.alive) { sprite(SPRITES.dead, PLAYER_X, GROUND - SPRITES.dead.height * S, '#ff4d6d'); return; }
    if (!player.onGround) img = SPRITES.jump;
    else if (player.ducking) img = Math.floor(player.anim) % 2 ? SPRITES.duck2 : SPRITES.duck1;
    else img = [SPRITES.run1, SPRITES.run2, SPRITES.run3, SPRITES.run2][Math.floor(player.anim) % 4];
    sprite(img, PLAYER_X, player.y - img.height * S, '#29f6ff');
  }

  function draw(time) {
    ctx.save();
    if (shake > 0) ctx.translate(Math.round(rand(-3, 3)), Math.round(rand(-3, 3)));

    drawBackground(time, distance);

    for (const p of pickups) {
      sprite(SPRITES.chip, p.x, p.y + Math.round(Math.sin(p.t * 4) * 2), '#ffe14d');
    }
    for (const o of obstacles) {
      if (o.type === 'wall') sprite(o.sprite, o.x, GROUND - o.h, '#ff3ef2');
      else {
        const img = Math.floor(o.bob * 1.5) % 2 ? SPRITES.drone2 : SPRITES.drone1;
        sprite(img, o.x, o.y + Math.round(Math.sin(o.bob)), '#ff4d6d');
      }
    }

    if (state === 'title') {
      sprite(SPRITES[['run1', 'run2', 'run3', 'run2'][Math.floor(time * 10) % 4]], PLAYER_X, GROUND - 28, '#29f6ff');
    } else {
      drawPlayer();
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    ctx.globalAlpha = 1;
    for (const p of popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      text(p.text, p.x, p.y, '#ffe14d', 8, 'left', '#ff9f1c');
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    if (state !== 'title') {
      text(`SCORE ${String(score).padStart(5, '0')}`, 8, 8, '#29f6ff', 8, 'left', '#29f6ff');
      text(`HI ${String(best).padStart(5, '0')}`, W - 8, 8, '#ff3ef2', 8, 'right', '#ff3ef2');
      sprite(SPRITES.chip, 8, 20);
      text(`x${chips}`, 26, 24, '#ffe14d', 8);
    }
    if (muted) text('MUTED', W - 8, 20, '#6b5b95', 8, 'right');

    const blink = Math.floor(time * 2) % 2 === 0;
    if (state === 'title') {
      ctx.fillStyle = 'rgba(11, 2, 33, 0.55)';
      ctx.fillRect(0, 34, W, 82);
      text('NEON DASH', W / 2, 44, '#29f6ff', 16, 'center', '#29f6ff');
      text('NEON DASH', W / 2 + 1, 45, 'rgba(255,62,242,0.35)', 16, 'center');
      text('SPACE / UP  JUMP   DOWN  DUCK', W / 2, 74, '#ffffff', 8, 'center');
      text('DODGE FIREWALLS + DRONES, GRAB CHIPS', W / 2, 86, '#ffe14d', 8, 'center');
      if (blink) text('PRESS SPACE TO START', W / 2, 102, '#ff3ef2', 8, 'center', '#ff3ef2');
      if (best) text(`HI ${best}`, W / 2, 124, '#ff3ef2', 8, 'center');
    } else if (state === 'over') {
      ctx.fillStyle = 'rgba(11, 2, 33, 0.6)';
      ctx.fillRect(0, 50, W, 66);
      text('CONNECTION LOST', W / 2, 60, '#ff4d6d', 12, 'center', '#ff4d6d');
      text(`SCORE ${score}   HI ${best}`, W / 2, 82, '#ffffff', 8, 'center');
      if (blink) text('PRESS SPACE TO RETRY', W / 2, 98, '#29f6ff', 8, 'center', '#29f6ff');
    } else if (paused) {
      ctx.fillStyle = 'rgba(11, 2, 33, 0.6)';
      ctx.fillRect(0, 70, W, 30);
      text('PAUSED', W / 2, 80, '#ffffff', 12, 'center', '#29f6ff');
    }
  }

  // ---------------------------------------------------------------- input
  const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter'];
  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) { keys.add(e.code); return; }
    keys.add(e.code);

    if (e.code === 'KeyM') { muted = !muted; return; }

    const startKey = e.code === 'Space' || e.code === 'Enter';
    if (state === 'title' && startKey) {
      reset();
      state = 'play';
      sfx.milestone();
      return;
    }
    if (state === 'over' && startKey && shake <= 0.1) {
      reset();
      state = 'play';
      return;
    }
    if (state === 'play') {
      if (e.code === 'KeyP') { paused = !paused; return; }
      if (!paused && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') && player.onGround) {
        player.vy = JUMP_VEL;
        player.onGround = false;
        sfx.jump();
      }
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    if (state === 'play') paused = true;
  });

  // ---------------------------------------------------------------- loop
  const STEP = 1 / 120;
  let acc = 0;
  let last = performance.now();
  function frame(now) {
    const time = now / 1000;
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= STEP) {
      if (state === 'play' && !paused) update(STEP);
      else if (state !== 'play') { updateFx(STEP); if (state === 'title') distance += 40 * STEP; }
      acc -= STEP;
    }
    draw(time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Exposed for automated testing only.
  window.__neonDash = { get state() { return state; }, get score() { return score; }, get obstacles() { return obstacles; }, get player() { return player; } };
})();
