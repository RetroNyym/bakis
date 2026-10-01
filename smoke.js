const vm = require('vm');
const fs = require('fs');

const grad = () => ({ addColorStop() {} });
const ctxStub = new Proxy({}, {
  get(t, p) {
    if (p === 'createRadialGradient' || p === 'createLinearGradient' || p === 'createPattern') return grad;
    if (p === 'canvas') return t.canvas;
    if (p in t) return t[p];
    return function () { return undefined; };
  },
  set(t, p, v) { t[p] = v; return true; }
});

const handlers = {};
function makeEl(id) {
  const el = {
    id, style: {}, children: [], className: '', innerHTML: '', textContent: '',
    title: '', disabled: false, width: 0, height: 0,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { el.children.push(c); return c; },
    addEventListener() {},
    removeChild() {},
    getContext() { ctxStub.canvas = el; return ctxStub; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 528 }; }
  };
  Object.defineProperty(el, 'onclick', {
    get() { return handlers[id] || null; },
    set(v) { handlers[id] = v; }
  });
  return el;
}

const els = {};
const document = {
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  createElement(tag) { return makeEl(tag + Math.random()); },
  addEventListener() {},
  body: makeEl('body')
};

const rafQueue = [];
const sandbox = {
  document,
  window: { addEventListener() {}, devicePixelRatio: 2, AudioContext: undefined, webkitAudioContext: undefined },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  performance: { now: () => Date.now() },
  requestAnimationFrame: cb => { rafQueue.push(cb); return rafQueue.length; },
  setTimeout: (fn, ms) => setTimeout(fn, 0),
  clearTimeout,
  console
};
sandbox.globalThis = sandbox;
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

let src = fs.readFileSync(__dirname + '/game.js', 'utf8');
src += '\n;globalThis.__T = { startLevel, update, render, setScreen, buildLevels, LEVELS, getScreen: () => screen, getLight: () => light, getCrystals: () => crystals, getExit: () => exit, setTarget: (x, y) => { light.tx = x; light.ty = y; } };';

try {
  vm.runInContext(src, sandbox, { filename: 'game.js' });
  console.log('OK  load/parse/init');
} catch (e) {
  console.log('FAIL load: ' + e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

const T = sandbox.__T;
const fail = (label, e) => { console.log('FAIL ' + label + ': ' + (e.stack || e).split('\n').slice(0, 4).join(' | ')); process.exitCode = 1; };

try {
  T.buildLevels();
  console.log('OK  buildLevels (' + els['lvGrid'].children.length + ' buttons)');
} catch (e) { fail('buildLevels', e); }

const uiTests = ['btnPlay', 'btnLevels', 'btnReset', 'btnBack', 'btnNext', 'btnRetry', 'btnMenu', 'btnResume', 'btnPauseRetry', 'btnPauseMenu'];
for (const id of uiTests) {
  try {
    const h = handlers[id];
    if (!h) { console.log('WARN no handler for ' + id); continue; }
    h();
  } catch (e) { fail('handler ' + id, e); }
}
console.log('OK  ui handlers');

let frames = 0;
for (let li = 0; li < T.LEVELS.length; li++) {
  try {
    T.startLevel(li);
    const L = T.LEVELS[li];
    const light = T.getLight();
    const ex = T.getExit();
    let t = li * 10;
    let forced = 0;
    for (let f = 0; f < 60 * 90; f++) {
      const crys = T.getCrystals();
      if (T.getScreen() !== 'play') break;
      if (f > 40 && forced === 0) {
        for (const c of crys) c.g = 1;
        forced = 1;
      }
      if (forced === 1) { light.tx = ex.x; light.ty = ex.y; }
      else {
        const c = crys.find(c => c.g < 1);
        if (c) { light.tx = c.x + Math.sin(f * 0.05) * 40; light.ty = c.y + Math.cos(f * 0.05) * 40; }
      }
      t += 1 / 60;
      T.update(1 / 60);
      T.render(t, 1 / 60);
      frames++;
    }
    const st = T.getScreen();
    if (st !== 'result') console.log('WARN level ' + (li + 1) + ' ended screen=' + st);
    else console.log('OK  level ' + (li + 1) + ' simulated -> ' + st + ' (' + els['rTitle'].textContent + ', ' + els['rStars'].textContent + ')');
  } catch (e) { fail('level ' + (li + 1), e); }
}

try {
  for (const id of ['btnMenu', 'btnLevels', 'btnBack', 'btnPlay']) if (handlers[id]) handlers[id]();
  if (typeof sandbox.loop !== 'function') throw new Error('loop() not exposed on global');
  let now = 100000;
  for (let i = 0; i < 400; i++) { now += 16.7; sandbox.loop(now); frames++; }
  console.log('OK  real loop() across menu/play/pause/result (' + sandbox.__T.getScreen() + ')');
} catch (e) { fail('loop', e); }

console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED (' + frames + ' frames)');
