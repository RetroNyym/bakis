'use strict';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const TILE = 48, COLS = 20, ROWS = 11, W = COLS * TILE, H = ROWS * TILE;
const LIGHT_R = 104;
const LIGHT_SPEED = 560;
const CONTACT = 26;
const LIT_SLOW = 0.45;
const STORE_KEY = 'bakis_progress_v1';

const LEVELS = [
  { name: 'İLK BAKIŞ', start: [2, 5], exit: [17, 5], crystals: [[4, 3], [4, 7], [11, 5]],
    count: 3, cap: 3, speed: 90, spawn: 3.0, dissolve: 1.4, grow: 0.5, decay: 0.04, par: [13, 18] },
  { name: 'ARA VERME', start: [1, 5], exit: [17, 5], crystals: [[3, 2], [3, 8], [12, 3], [12, 8]],
    count: 4, cap: 3, speed: 105, spawn: 2.8, dissolve: 1.5, grow: 0.5, decay: 0.045, par: [17, 26] },
  { name: 'SÜTUNLAR', start: [1, 5], exit: [18, 5], crystals: [[4, 2], [4, 8], [9, 5], [14, 2], [14, 8]],
    count: 5, cap: 4, speed: 120, spawn: 2.5, dissolve: 1.6, grow: 0.5, decay: 0.05, par: [26, 40] },
  { name: 'KÖŞE', start: [2, 9], exit: [18, 2], crystals: [[6, 2], [6, 5], [6, 8], [14, 3], [14, 8]],
    count: 6, cap: 4, speed: 135, spawn: 2.3, dissolve: 1.7, grow: 0.5, decay: 0.05, par: [29, 43] },
  { name: 'YAY', start: [1, 5], exit: [18, 1], crystals: [[3, 3], [3, 8], [8, 2], [8, 8], [13, 4], [17, 7]],
    count: 7, cap: 4, speed: 145, spawn: 2.1, dissolve: 1.8, grow: 0.5, decay: 0.055, par: [35, 53] },
  { name: 'ÜÇ HAT', start: [1, 5], exit: [18, 5], crystals: [[4, 2], [4, 5], [4, 8], [12, 2], [12, 5], [12, 8]],
    count: 7, cap: 4, speed: 150, spawn: 2.0, dissolve: 1.85, grow: 0.5, decay: 0.055, par: [35, 53] },
  { name: 'SIKIŞMA', start: [1, 5], exit: [18, 5], crystals: [[3, 2], [3, 5], [3, 8], [9, 3], [9, 8], [15, 2], [15, 8]],
    count: 8, cap: 4, speed: 160, spawn: 1.9, dissolve: 1.95, grow: 0.5, decay: 0.06, par: [39, 60] },
  { name: 'SON BAKIŞ', start: [1, 5], exit: [18, 1], crystals: [[3, 3], [3, 8], [7, 2], [7, 5], [11, 8], [15, 2], [15, 5], [17, 9]],
    count: 9, cap: 4, speed: 165, spawn: 1.9, dissolve: 2.0, grow: 0.5, decay: 0.06, par: [47, 71] }
];

const $ = id => document.getElementById(id);
const layers = ['menu', 'levels', 'result', 'pause'];
const hud = $('hud');

let screen = 'menu';
let levelIndex = 0;
let level = null;
let light = { x: 0, y: 0, tx: 0, ty: 0 };
let crystals = [];
let shadows = [];
let particles = [];
let exit = { x: W * 0.78, y: H * 0.5, open: false };
let spawned = 0, spawnTimer = 0, elapsed = 0, deaths = 0;
let shake = 0, flash = 0, openPlayed = false;
let progress = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return Object.assign({ unlocked: 1, best: {}, stars: {} }, JSON.parse(raw));
  } catch (e) {}
  return { unlocked: 1, best: {}, stars: {} };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) {}
}

function tile(c, r) { return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }; }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

let AC = null;
function ac() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (C) AC = new C();
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, type, vol, to) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
const sfx = {
  spawn() { tone(150, 0.22, 'sawtooth', 0.07, 90); },
  melt() { tone(520, 0.28, 'triangle', 0.1, 180); },
  grow() { tone(760, 0.09, 'sine', 0.05, 900); },
  open() { tone(660, 0.16, 'sine', 0.1); setTimeout(() => tone(880, 0.2, 'sine', 0.1), 110); },
  death() { tone(220, 0.55, 'sawtooth', 0.14, 55); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.24, 'triangle', 0.1), i * 95)); },
  star(n) { tone(700 + n * 160, 0.18, 'sine', 0.1); },
  ui() { tone(440, 0.06, 'sine', 0.06); }
};

function setScreen(s) {
  screen = s;
  layers.forEach(id => $(id).classList.toggle('hidden', id !== s));
  hud.classList.toggle('hidden', !(s === 'play' || s === 'paused' || s === 'result'));
}

function startLevel(i) {
  levelIndex = i;
  level = LEVELS[i];
  const s = tile(level.start[0], level.start[1]);
  light.x = light.tx = s.x;
  light.y = light.ty = s.y;
  const e = tile(level.exit[0], level.exit[1]);
  exit.x = e.x; exit.y = e.y; exit.open = false;
  crystals = level.crystals.map(p => { const q = tile(p[0], p[1]); return { x: q.x, y: q.y, g: 0, played: false }; });
  shadows = [];
  particles = [];
  spawned = 0; spawnTimer = 0; elapsed = 0; deaths = 0;
  shake = 0; flash = 0; openPlayed = false;
  setScreen('play');
  updateHUD();
}

function edgePoint() {
  for (let i = 0; i < 30; i++) {
    const side = (Math.random() * 4) | 0;
    let x, y;
    if (side === 0) { x = Math.random() * W; y = 26; }
    else if (side === 1) { x = W - 26; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H - 26; }
    else { x = 26; y = Math.random() * H; }
    if (dist(x, y, light.x, light.y) < 320) continue;
    if (shadows.some(s => dist(x, y, s.x, s.y) < 90)) continue;
    return { x, y };
  }
  return { x: 30, y: 30 };
}

function spawnShadow() {
  const p = edgePoint();
  shadows.push({ x: p.x, y: p.y, melt: 0, wob: Math.random() * 6.28, dead: false });
  spawned++;
  sfx.spawn();
  burst(p.x, p.y, '#a06bff', 10, 70);
}

function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = spd * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.5, max: 1, c: color, s: 1.5 + Math.random() * 2.5 });
  }
}

function retry() { sfx.ui(); startLevel(levelIndex); }

function die() {
  deaths++;
  flash = 1; shake = 16;
  sfx.death();
  burst(light.x, light.y, '#ff5f7a', 34, 220);
  showResult(false);
}

function win() {
  const t = elapsed;
  const p = level.par;
  const st = t <= p[0] ? 3 : (t <= p[1] ? 2 : 1);
  const key = String(levelIndex);
  if (!progress.best[key] || t < progress.best[key]) progress.best[key] = t;
  progress.stars[key] = Math.max(progress.stars[key] || 0, st);
  progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, levelIndex + 2));
  save();
  sfx.win();
  setTimeout(() => sfx.star(st), 380);
  burst(exit.x, exit.y, '#8dffc4', 46, 240);
  showResult(true, st, t);
}

function showResult(ok, st, t) {
  $('rTitle').textContent = ok ? (levelIndex === LEVELS.length - 1 ? 'HEPSİ TAMAM' : 'BÖLÜM TAMAM') : 'YAKALANDIN';
  $('rStars').textContent = ok ? '★'.repeat(st) + '☆'.repeat(3 - st) : '☆☆☆';
  $('rStars').style.color = ok ? '#ffcf7a' : '#6d7791';
  $('rTime').textContent = (ok ? t.toFixed(1) : elapsed.toFixed(1)) + 's';
  $('rDeaths').textContent = String(deaths);
  const b = progress.best[String(levelIndex)];
  $('rBest').textContent = b ? b.toFixed(1) + 's' : '—';
  $('btnNext').classList.toggle('hidden', !ok || levelIndex >= LEVELS.length - 1);
  $('btnNext').textContent = levelIndex >= LEVELS.length - 1 ? 'MENÜ' : 'SONRAKİ';
  setScreen('result');
}

function updateHUD() {
  const done = crystals.filter(c => c.g >= 1).length;
  $('lvChip').innerHTML = 'BÖLÜM <b>' + (levelIndex + 1) + '</b> · <span id="lvName">' + level.name + '</span>';
  $('cryChip').innerHTML = 'KRISTAL <b>' + done + '/' + crystals.length + '</b>';
  $('shChip').innerHTML = 'GÖLGE <b>' + (shadows.length + (level.count - spawned)) + '</b>';
  $('tChip').innerHTML = 'SÜRE <b>' + elapsed.toFixed(1) + '</b>';
}

function update(dt) {
  elapsed += dt;

  const dx = light.tx - light.x, dy = light.ty - light.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const step = LIGHT_SPEED * dt;
  if (d > 0.001) {
    const m = Math.min(1, step / d);
    light.x += dx * m; light.y += dy * m;
  }
  light.x = clamp(light.x, 8, W - 8);
  light.y = clamp(light.y, 8, H - 8);

  let grown = 0;
  for (const c of crystals) {
    if (c.g >= 1) { c.g = 1; grown++; continue; }
    const lit = dist(light.x, light.y, c.x, c.y) <= LIGHT_R;
    const before = c.g;
    if (lit) {
      c.g = Math.min(1, c.g + level.grow * dt);
      if (c.g >= 1) { burst(c.x, c.y, '#8ef0ff', 18, 130); sfx.grow(); }
      else if (Math.floor(c.g * 8) > Math.floor(before * 8)) sfx.grow();
    } else {
      c.g = Math.max(0, c.g - level.decay * dt);
    }
    if (c.g >= 1) grown++;
  }

  if (grown === crystals.length && !exit.open) {
    exit.open = true;
    if (!openPlayed) { openPlayed = true; sfx.open(); burst(exit.x, exit.y, '#8dffc4', 26, 170); }
  }

  spawnTimer += dt;
  if (spawnTimer >= level.spawn) {
    spawnTimer = 0;
    if (spawned < level.count && shadows.length < level.cap) spawnShadow();
  }

  for (const s of shadows) {
    if (s.dead) continue;
    const dsl = dist(s.x, s.y, light.x, light.y);
    const lit = dsl <= LIGHT_R;
    if (lit) {
      s.melt += dt;
      if (s.melt >= level.dissolve) {
        s.dead = true;
        burst(s.x, s.y, '#b78bff', 22, 150);
        sfx.melt();
        continue;
      }
    } else {
      s.melt = Math.max(0, s.melt - dt * 0.7);
    }
    let sp = level.speed * (lit ? LIT_SLOW : (dsl < 175 ? 1.35 : 1));
    const a = Math.atan2(light.y - s.y, light.x - s.x);
    s.x += Math.cos(a) * sp * dt;
    s.y += Math.sin(a) * sp * dt;
    if (dsl < CONTACT) { die(); break; }
    s.wob += dt * 3;
  }
  if (screen !== 'play') return;
  shadows = shadows.filter(s => !s.dead);

  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
  }
  particles = particles.filter(p => p.life > 0);

  if (exit.open && dist(light.x, light.y, exit.x, exit.y) < 44) { win(); return; }

  updateHUD();
}

function drawBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0c15');
  g.addColorStop(1, '#06070d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,150,220,0.055)';
  ctx.lineWidth = 1;
  for (let x = TILE; x < W; x += TILE) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
  for (let y = TILE; y < H; y += TILE) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(140,175,255,0.16)';
  ctx.strokeRect(10.5, 10.5, W - 21, H - 21);
}

function drawExit(t) {
  ctx.save();
  ctx.translate(exit.x, exit.y);
  const pulse = exit.open ? 1 + Math.sin(t * 5) * 0.09 : 1;
  ctx.lineWidth = 5;
  ctx.strokeStyle = exit.open ? 'rgba(120,255,190,0.9)' : 'rgba(255,110,130,0.35)';
  if (!exit.open) ctx.setLineDash([7, 9]);
  ctx.beginPath(); ctx.arc(0, 0, 26 * pulse, 0, 6.283); ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = exit.open ? 'rgba(120,255,190,0.4)' : 'rgba(255,110,130,0.18)';
  ctx.beginPath(); ctx.arc(0, 0, 36 * pulse, 0, 6.283); ctx.stroke();
  ctx.fillStyle = exit.open ? 'rgba(120,255,190,0.18)' : 'rgba(255,110,130,0.07)';
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, 6.283); ctx.fill();
  ctx.restore();
}

function drawCrystals() {
  for (const c of crystals) {
    ctx.save();
    ctx.translate(c.x, c.y);
    const g = c.g;
    if (g > 0) {
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 46);
      rg.addColorStop(0, 'rgba(150,240,255,' + (0.5 * g) + ')');
      rg.addColorStop(1, 'rgba(150,240,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.283); ctx.fill();
    }
    const s = 7 + g * 11;
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath();
    ctx.fillStyle = g >= 1 ? '#aef6ff' : 'rgba(' + Math.round(60 + g * 90) + ',' + Math.round(110 + g * 120) + ',' + Math.round(150 + g * 90) + ',1)';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + g * 0.6) + ')';
    ctx.stroke();
    if (g >= 1) {
      ctx.beginPath(); ctx.moveTo(0, -s * 0.55); ctx.lineTo(s * 0.3, -s * 0.1); ctx.lineTo(-s * 0.2, -s * 0.1); ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    }
    ctx.restore();
  }
}

function drawShadows(t) {
  for (const s of shadows) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const w = Math.sin(s.wob) * 2;
    const r = 15 + w;
    const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, r + 14);
    rg.addColorStop(0, 'rgba(40,20,70,0.95)');
    rg.addColorStop(0.6, 'rgba(20,10,40,0.75)');
    rg.addColorStop(1, 'rgba(10,5,25,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, r + 14, 0, 6.283); ctx.fill();

    ctx.fillStyle = 'rgba(14,8,28,0.96)';
    ctx.beginPath();
    ctx.moveTo(-r, r * 0.9);
    ctx.quadraticCurveTo(-r * 1.1, -r, 0, -r * 1.05);
    ctx.quadraticCurveTo(r * 1.1, -r, r, r * 0.9);
    ctx.quadraticCurveTo(r * 0.4, r * 0.6, 0, r * 0.95);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.6, -r, r * 0.9);
    ctx.closePath(); ctx.fill();

    const m = s.melt / level.dissolve;
    const eye = s.melt > 0 ? 'rgba(255,180,220,' + (1 - m * 0.7) + ')' : 'rgba(255,90,120,0.95)';
    ctx.fillStyle = eye;
    ctx.beginPath(); ctx.arc(-5, -3, 2.8, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -3, 2.8, 0, 6.283); ctx.fill();

    if (m > 0) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(200,150,255,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, r + 9, -1.5708, -1.5708 + 6.283 * m); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}

function drawDarkness() {
  const R = 720;
  const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, R);
  g.addColorStop(0, 'rgba(4,5,11,0)');
  g.addColorStop((LIGHT_R * 0.6) / R, 'rgba(4,5,11,0.06)');
  g.addColorStop((LIGHT_R * 1.02) / R, 'rgba(4,5,11,0.52)');
  g.addColorStop((LIGHT_R * 1.45) / R, 'rgba(4,5,11,0.7)');
  g.addColorStop(1, 'rgba(4,5,11,0.74)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawGlow() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, LIGHT_R);
  g.addColorStop(0, 'rgba(255,250,225,0.30)');
  g.addColorStop(0.45, 'rgba(255,240,200,0.13)');
  g.addColorStop(1, 'rgba(255,235,190,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(light.x, light.y, LIGHT_R, 0, 6.283); ctx.fill();
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,245,215,0.35)';
  ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.arc(light.x, light.y, LIGHT_R, 0, 6.283); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,252,235,0.95)';
  ctx.beginPath(); ctx.arc(light.x, light.y, 5, 0, 6.283); ctx.fill();
}

function drawMarkers() {
  ctx.save();
  for (const c of crystals) {
    if (c.g >= 1) continue;
    const a = 0.22 + 0.14 * Math.sin(elapsed * 3 + c.x * 0.01);
    ctx.strokeStyle = 'rgba(150,235,255,' + a + ')';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 6]);
    ctx.beginPath(); ctx.arc(c.x, c.y, 20, 0, 6.283); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawDanger() {
  let near = 1e9;
  for (const s of shadows) near = Math.min(near, dist(s.x, s.y, light.x, light.y));
  if (near > 240) return;
  const a = clamp((240 - near) / 240, 0, 1) * 0.5;
  const g = ctx.createRadialGradient(light.x, light.y, LIGHT_R * 0.4, light.x, light.y, 460);
  g.addColorStop(0, 'rgba(255,40,70,0)');
  g.addColorStop(1, 'rgba(255,40,70,' + a + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function render(t, dt) {
  if (shake > 0) shake = Math.max(0, shake - dt * 40);
  if (flash > 0) flash = Math.max(0, flash - dt * 1.6);
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  drawBg();
  drawExit(t);
  drawCrystals();
  drawShadows(t);
  drawParticles();
  drawDarkness();
  drawMarkers();
  drawGlow();
  drawDanger();
  if (flash > 0) {
    ctx.fillStyle = 'rgba(255,40,70,' + (flash * 0.4) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function buildLevels() {
  const grid = $('lvGrid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const b = document.createElement('button');
    b.className = 'lv';
    const unlocked = i < progress.unlocked;
    b.disabled = !unlocked;
    const st = progress.stars[String(i)] || 0;
    b.innerHTML = '<span class="n">' + (unlocked ? i + 1 : '🔒') + '</span><span class="s">' + '★'.repeat(st) + '☆'.repeat(3 - st) + '</span>';
    b.title = lv.name;
    b.onclick = () => { sfx.ui(); startLevel(i); };
    grid.appendChild(b);
  });
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function point(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('pointerdown', e => {
  ac();
  const p = point(e);
  light.tx = p.x; light.ty = p.y;
});
canvas.addEventListener('pointermove', e => {
  if (screen !== 'play') return;
  const p = point(e);
  light.tx = p.x; light.ty = p.y;
});

window.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (screen === 'play') { sfx.ui(); setScreen('paused'); }
    else if (screen === 'paused') { sfx.ui(); setScreen('play'); }
  }
  if ((e.key === 'r' || e.key === 'R') && (screen === 'play' || screen === 'paused')) retry();
});
window.addEventListener('blur', () => { if (screen === 'play') setScreen('paused'); });

$('btnPlay').onclick = () => { ac(); sfx.ui(); startLevel(Math.min(progress.unlocked - 1, LEVELS.length - 1)); };
$('btnLevels').onclick = () => { ac(); sfx.ui(); buildLevels(); setScreen('levels'); };
$('btnReset').onclick = () => {
  sfx.ui();
  progress = { unlocked: 1, best: {}, stars: {} };
  save(); buildLevels();
};
$('btnBack').onclick = () => { sfx.ui(); setScreen('menu'); };
$('btnNext').onclick = () => {
  sfx.ui();
  if (levelIndex < LEVELS.length - 1) startLevel(levelIndex + 1);
  else setScreen('menu');
};
$('btnRetry').onclick = retry;
$('btnMenu').onclick = () => { sfx.ui(); setScreen('menu'); };
$('btnResume').onclick = () => { sfx.ui(); setScreen('play'); };
$('btnPauseRetry').onclick = retry;
$('btnPauseMenu').onclick = () => { sfx.ui(); setScreen('menu'); };

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (screen === 'play') update(dt);
  if (screen === 'play' || screen === 'paused' || screen === 'result') render(now / 1000, dt);
  else {
    ctx.clearRect(0, 0, W, H);
    drawBg();
    const t = now / 1000;
    light.x = light.tx = W / 2 + Math.cos(t * 0.5) * 240;
    light.y = light.ty = H / 2 + Math.sin(t * 0.8) * 110;
    drawExit(t);
    drawDarkness();
    drawGlow();
  }
  requestAnimationFrame(loop);
}
setScreen('menu');
requestAnimationFrame(loop);
