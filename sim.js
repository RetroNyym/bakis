const fs = require('fs');
const src = fs.readFileSync(__dirname + '/game.js', 'utf8');
const LEVELS = eval(src.match(/const LEVELS = (\[[\s\S]*?\n\]);/)[1]);

const TILE = 48, W = 960, H = 528;
const g = n => Number(src.match(new RegExp('const ' + n + ' = ([\\d.]+);'))[1]);
const LIGHT_R = g('LIGHT_R'), LIGHT_SPEED = g('LIGHT_SPEED'), CONTACT = g('CONTACT'), LIT_SLOW = g('LIT_SLOW');
const MODE = process.argv[2] || 'skilled';
const tile = (c, r) => ({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE });
const d = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function run(L) {
  const st = tile(L.start[0], L.start[1]);
  let lx = st.x, ly = st.y, tx = st.x, ty = st.y;
  const ex = tile(L.exit[0], L.exit[1]);
  const cry = L.crystals.map(p => { const q = tile(p[0], p[1]); return { x: q.x, y: q.y, g: 0 }; });
  let sh = [], spawned = 0, spawnTimer = 0, t = 0, deaths = 0, open = false;
  const edge = () => {
    for (let i = 0; i < 30; i++) {
      const s = (Math.random() * 4) | 0;
      let x, y;
      if (s === 0) { x = Math.random() * W; y = 26; }
      else if (s === 1) { x = W - 26; y = Math.random() * H; }
      else if (s === 2) { x = Math.random() * W; y = H - 26; }
      else { x = 26; y = Math.random() * H; }
      if (d(x, y, lx, ly) < 320) continue;
      if (sh.some(o => d(x, y, o.x, o.y) < 90)) continue;
      return { x, y };
    }
    return { x: 30, y: 30 };
  };

  for (let step = 0; step < 60 * 300; step++) {
    const dt = 1 / 60;
    t += dt;

    const inc = cry.filter(c => c.g < 1);
    if (inc.length === 0) {
      tx = ex.x; ty = ex.y;
    } else {
      let threat = null, td = 430;
      if (MODE === 'skilled') {
        for (const s of sh) {
          const ds = d(lx, ly, s.x, s.y);
          if (ds < td) { td = ds; threat = s; }
        }
      }
      if (threat) {
        const ux = (lx - threat.x) / Math.max(1, td);
        const uy = (ly - threat.y) / Math.max(1, td);
        tx = threat.x + ux * 97;
        ty = threat.y + uy * 97;
      } else {
        let best = null, bd = 1e9;
        for (const c of inc) {
          const dd = d(lx, ly, c.x, c.y) - c.g * 240;
          if (dd < bd) { bd = dd; best = c; }
        }
        tx = best.x; ty = best.y;
      }
      tx = clamp(tx, 30, W - 30);
      ty = clamp(ty, 30, H - 30);
    }

    const ddx = tx - lx, ddy = ty - ly, dd = Math.hypot(ddx, ddy);
    const stp = LIGHT_SPEED * dt;
    if (dd > 0.001) { const m = Math.min(1, stp / dd); lx += ddx * m; ly += ddy * m; }

    let grown = 0;
    for (const c of cry) {
      if (c.g >= 1) { c.g = 1; grown++; continue; }
      const lit = d(lx, ly, c.x, c.y) <= LIGHT_R;
      if (lit) c.g = Math.min(1, c.g + L.grow * dt);
      else c.g = Math.max(0, c.g - L.decay * dt);
      if (c.g >= 1) grown++;
    }
    if (grown === cry.length) open = true;

    spawnTimer += dt;
    if (spawnTimer >= L.spawn) {
      spawnTimer = 0;
      if (spawned < L.count && sh.length < L.cap) { const p = edge(); sh.push({ x: p.x, y: p.y, melt: 0 }); spawned++; }
    }

    let hit = false;
    for (const s of sh) {
      if (s.dead) continue;
      const dsl = d(lx, ly, s.x, s.y);
      const lit = dsl <= LIGHT_R;
      if (lit) {
        s.melt += dt;
        if (s.melt >= L.dissolve) { s.dead = true; continue; }
      } else {
        s.melt = Math.max(0, s.melt - dt * 0.7);
      }
      const sp = L.speed * (lit ? LIT_SLOW : (dsl < 175 ? 1.35 : 1));
      const a = Math.atan2(ly - s.y, lx - s.x);
      s.x += Math.cos(a) * sp * dt;
      s.y += Math.sin(a) * sp * dt;
      if (dsl < CONTACT) hit = true;
    }
    sh = sh.filter(s => !s.dead);

    if (hit) {
      return { ok: false, t, deaths: 1, reason: 'death' };
    }

    if (open && d(lx, ly, ex.x, ex.y) < 44) {
      const p = L.par;
      return { ok: true, t, deaths, stars: t <= p[0] ? 3 : t <= p[1] ? 2 : 1 };
    }
  }
  return { ok: false, t: 300, deaths, reason: 'timeout' };
}

const RUNS = 14;
LEVELS.forEach((L, i) => {
  const res = [];
  for (let k = 0; k < RUNS; k++) res.push(run(L));
  const oks = res.filter(r => r.ok);
  const times = oks.map(r => Math.round(r.t * 10) / 10);
  console.log(
    String(i + 1).padStart(2) + ' ' + L.name.padEnd(11) +
    ' win ' + oks.length + '/' + RUNS +
    '  time ' + (times.length ? Math.min(...times) + '..' + Math.max(...times) : '-') +
    '  par ' + L.par.join('/') +
    '  stars ' + (oks.length ? oks.map(r => r.stars).join('') : '-') +
    '  deaths ' + res.map(r => r.deaths).join(',') +
    (oks.length < RUNS ? '  FAIL ' + res.filter(r => !r.ok).map(r => r.reason).join('|') : '')
  );
});
