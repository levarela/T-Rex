import * as THREE from 'three';
import { Dino } from './dino.js';
import { Human } from './human.js';
import { VHS } from './vhs.js';
import { Sfx } from './audio.js';
import { skinTextures } from './textures.js';
import { buildWorld, ARENA_R, FENCE_Z } from './world.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage'), wrap = $('wrap');
const TIME_LIMIT = 90;
const PREY_NAME = 'R. MÉNDEZ, AUDITOR';

// ── render ──
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 4 / 3, 0.5, 400);
const vhs = new VHS(renderer, 640, 480);
const sfx = new Sfx();

function fit() {
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const w = Math.max(160, Math.floor(Math.min(W, (H * 4) / 3))), h = Math.floor((w * 3) / 4);
  stage.style.width = w + 'px';
  stage.style.height = h + 'px';
  stage.style.fontSize = h / 19 + 'px';
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', fit);
fit();

// ── mundo y actores ──
const world = buildWorld(scene);
const obstacles = world.obstacles;
const rexDino = new Dino({ skin: skinTextures({ seed: 7 }) });
scene.add(rexDino.root);
const human = new Human();
scene.add(human.root);
const raptorSkin = skinTextures({ back: [70, 58, 30], belly: [170, 150, 105], stripe: [20, 30, 22], seed: 3 });

const rex = { pos: new THREE.Vector2(), heading: 0, speed: 0, turn: 0, hp: 100, stamina: 1, roarCd: 0, hit: false, exhausted: false, recover: 0 };
const raptors = [];
const game = { state: 'title', time: TIME_LIMIT, elapsed: 0, t: 0, paused: false, glitch: 0, shake: 0, msgT: 0, endT: 0, raptorsOut: false, lastBeep: 99 };
const camState = { heading: 0, pos: new THREE.Vector3(0, 9, -50), look: new THREE.Vector3() };

function bound(p, margin) {
  const d = Math.hypot(p.x, p.y), max = ARENA_R - margin;
  if (d > max) { p.x *= max / d; p.y *= max / d; }
  if (p.y < FENCE_Z + 3 + margin) p.y = FENCE_Z + 3 + margin;
}
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

class Raptor {
  constructor(i) {
    this.dino = new Dino({ scale: 0.3, skin: raptorSkin, eye: 0xff5a1a, headScale: 0.82, armScale: 1.9 });
    this.pos = new THREE.Vector2();
    this.i = i;
    scene.add(this.dino.root);
    this.reset();
  }
  reset() {
    this.hp = 2; this.state = 'off'; this.timer = 2 + this.i * 1.5; this.heading = 0; this.speed = 0;
    this.angle = this.i * Math.PI; this.dir = this.i ? 1 : -1;
    this.dino.dead = 0; this.dino.biteT = -1;
    this.dino.root.visible = false;
  }
  spawn() {
    const a = rex.heading + Math.PI + (this.i ? 0.6 : -0.6); // por detrás
    this.pos.set(rex.pos.x + Math.sin(a) * 45, rex.pos.y + Math.cos(a) * 45);
    bound(this.pos, -6);
    this.state = 'stalk';
    this.dino.root.visible = true;
  }
  hurt() {
    this.hp--;
    sfx.roar(3.4, 0.35, 0.4);
    const dx = this.pos.x - rex.pos.x, dz = this.pos.y - rex.pos.y, d = Math.hypot(dx, dz) || 1;
    this.pos.x += (dx / d) * 3.5; this.pos.y += (dz / d) * 3.5;
    if (this.hp <= 0) { this.state = 'dead'; this.speed = 0; } else { this.state = 'retreat'; this.timer = 2.2; }
  }
  update(dt) {
    const D = this.dino;
    if (this.state === 'off') return;
    if (this.state === 'dead') {
      D.dead = Math.min(1, D.dead + dt * 2.5);
      D.update(dt, 0, 0);
      this.place();
      return;
    }
    const dx = rex.pos.x - this.pos.x, dz = rex.pos.y - this.pos.y, d = Math.hypot(dx, dz) || 1;
    let tx = 0, tz = 0, sp = 0;
    this.timer -= dt;
    if (this.state === 'stalk') {
      this.angle += this.dir * 0.55 * dt;
      tx = rex.pos.x + Math.sin(this.angle) * 13 - this.pos.x;
      tz = rex.pos.y + Math.cos(this.angle) * 13 - this.pos.y;
      const dT = Math.hypot(tx, tz);
      sp = dT > 14 ? 13.5 : Math.min(10, dT * 2 + 3);
      if (this.timer <= 0 && d < 26 && game.state === 'play') { this.state = 'lunge'; this.timer = 3; sfx.roar(3.0, 0.22, 0.3); }
    } else if (this.state === 'lunge') {
      tx = dx; tz = dz; sp = 14;
      if (d < 3.6) {
        D.biteT = 0;
        damageRex(5);
        this.state = 'retreat'; this.timer = 1.5;
      } else if (this.timer <= 0) { this.state = 'stalk'; this.timer = 2 + Math.random() * 2; }
    } else if (this.state === 'retreat') {
      tx = -dx; tz = -dz; sp = 12;
      if (this.timer <= 0) { this.state = 'stalk'; this.timer = 3 + Math.random() * 3.5; this.angle = Math.atan2(-dx, -dz); }
    }
    const n = Math.hypot(tx, tz) || 1;
    this.speed += (sp - this.speed) * Math.min(1, dt * 5);
    const want = Math.atan2(tx, tz), dh = angDiff(want, this.heading);
    const turn = Math.max(-1, Math.min(1, dh * 2));
    this.heading += dh * Math.min(1, dt * 7);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.y += Math.cos(this.heading) * this.speed * dt;
    for (const o of obstacles) {
      const ox = this.pos.x - o.x, oz = this.pos.y - o.z, dd = Math.hypot(ox, oz), min = o.r + 0.7;
      if (dd < min && dd > 1e-4) { this.pos.x = o.x + (ox / dd) * min; this.pos.y = o.z + (oz / dd) * min; }
    }
    if (D.biteT >= 0) { D.biteT += dt / 0.45; if (D.biteT >= 1) D.biteT = -1; }
    D.update(dt, this.speed, turn * 0.6);
    this.place();
  }
  place() {
    this.dino.root.position.set(this.pos.x, 0, this.pos.y);
    this.dino.root.rotation.y = this.heading;
  }
}
for (let i = 0; i < 2; i++) raptors.push(new Raptor(i));

// ── HUD ──
const hud = {
  play: $('osd-play'), timer: $('osd-timer'), prey: $('osd-prey'), hp: $('osd-hp'), st: $('osd-st'), msg: $('osd-msg'),
  arrow: $('osd-arrow'), dist: $('osd-dist'), warn: $('osd-warn'), title: $('title'), end: $('end'), endH: $('end-h'), endP: $('end-p'),
  hudBox: $('hud'), roar: $('osd-roar'),
};
const cache = {};
function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }

function message(text, secs = 2.5) { hud.msg.textContent = text; hud.msg.hidden = false; game.msgT = secs; }

function damageRex(n) {
  if (game.state !== 'play') return;
  rex.hp = Math.max(0, rex.hp - n);
  game.glitch = Math.max(game.glitch, 0.6);
  game.shake = Math.max(game.shake, 0.5);
  sfx.hurt();
  if (rex.hp <= 0) end('dead');
}

// ── flujo ──
function reset() {
  rex.pos.set(0, -34); rex.heading = 0; rex.speed = 0; rex.turn = 0; rex.hp = 100; rex.stamina = 1; rex.roarCd = 0; rex.exhausted = false; rex.recover = 0;
  rexDino.biteT = rexDino.roarT = rexDino.chewT = -1; rexDino.dead = 0;
  scene.add(human.root);
  human.reset(6, 0);
  human.heading = 0;
  human.cover = null;
  raptors.forEach((r) => r.reset());
  Object.assign(game, { time: TIME_LIMIT, elapsed: 0, raptorsOut: false, endT: 0, lastBeep: 99, glitch: 1 });
  camState.heading = 0;
  camState.pos.set(0, 10, -52);
}

function startGame() {
  sfx.start();
  reset();
  game.state = 'play';
  hud.title.hidden = true; hud.end.hidden = true; hud.hudBox.hidden = false;
  message('ESCENA 01 · EL CERCO ROTO', 3);
  sfx.roar(1, 0.9);
  rexDino.roarT = 0;
  game.shake = 0.6;
}

function end(kind) {
  if (game.state !== 'play') return;
  game.state = kind; // win | timeout | dead
  game.endT = 0;
  game.glitch = Math.max(game.glitch, kind === 'win' ? 0.2 : 1);
}

function showEnd() {
  const k = game.state;
  hud.endH.textContent = k === 'win' ? 'ALMUERZO SERVIDO' : k === 'timeout' ? 'SE ESCAPÓ' : 'FIN DE LA CINTA';
  hud.endP.textContent = k === 'win'
    ? `Presa: ${PREY_NAME}. Te sobraron ${Math.ceil(game.time)} s.\nESCENA 02: próximamente.`
    : k === 'timeout' ? 'Se acabó el tiempo y la presa llegó al búnker.' : 'Los raptores pudieron con el rey.';
  hud.end.hidden = false;
}

// ── entrada ──
const keys = new Set();
const press = { bite: false, roar: false };
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
  if (e.repeat) return;
  keys.add(c);
  if (c === 'Enter' || c === 'Space') {
    if (game.state === 'title') return startGame();
    if (game.state !== 'play' && game.endT > 2.5) return startGame();
  }
  if (c === 'Space' || c === 'KeyJ') press.bite = true;
  if (c === 'KeyR' || c === 'KeyE' || c === 'KeyK') press.roar = true;
  if (c === 'KeyM') sfx.toggleMute();
  if (c === 'KeyP' && game.state === 'play') { game.paused = !game.paused; setText(hud.play, 'play', game.paused ? 'PAUSA ▌▌' : 'PLAY ▶'); }
  if (c === 'KeyF') { const p = document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen && wrap.requestFullscreen(); p && p.catch && p.catch(() => {}); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
stage.addEventListener('pointerdown', () => {
  window.focus();
  if (game.state === 'title') startGame();
  else if (game.state === 'play') press.bite = true;
  else if (game.endT > 2.5) startGame();
});
const down = (...cs) => cs.some((c) => keys.has(c));

// ── actualización ──
const _v = new THREE.Vector3(), _m = new THREE.Vector3();

function updateRex(dt) {
  const D = rexDino, alive = game.state !== 'dead';
  const playing = game.state === 'play';
  let fwd = 0, trn = 0;
  if (playing) {
    fwd = (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0);
    trn = (down('KeyA', 'ArrowLeft') ? 1 : 0) - (down('KeyD', 'ArrowRight') ? 1 : 0);
  }
  const wantSprint = playing && fwd > 0 && down('ShiftLeft', 'ShiftRight') && !rex.exhausted;
  if (wantSprint) { rex.stamina -= dt / 5.5; if (rex.stamina <= 0) { rex.stamina = 0; rex.exhausted = true; } }
  else { rex.stamina = Math.min(1, rex.stamina + dt / 7); if (rex.stamina > 0.3) rex.exhausted = false; }
  let target = fwd > 0 ? (wantSprint ? 12 : 6.8) : fwd < 0 ? -3 : 0;
  if (D.chewT >= 0) target = 0;
  else if (D.roarT >= 0) target *= 0.55;
  else if (D.biteT >= 0) target *= 0.75;
  else if (rex.recover > 0) target *= 0.3; // mordisco al aire: pierde el paso
  if (!alive) target = 0;
  const acc = Math.abs(target) > Math.abs(rex.speed) ? 8 : 13;
  rex.speed += Math.max(-acc * dt, Math.min(acc * dt, target - rex.speed));
  const rate = (1.95 - 0.55 * Math.min(1, Math.abs(rex.speed) / 12)) * (D.biteT >= 0 ? 0.2 : D.roarT >= 0 ? 0.6 : 1); // el mordisco compromete la dirección
  rex.turn += ((alive ? trn : 0) - rex.turn) * Math.min(1, dt * 5);
  rex.heading += rex.turn * rate * dt;
  rex.pos.x += Math.sin(rex.heading) * rex.speed * dt;
  rex.pos.y += Math.cos(rex.heading) * rex.speed * dt;
  for (const o of obstacles) {
    const ox = rex.pos.x - o.x, oz = rex.pos.y - o.z, d = Math.hypot(ox, oz), min = o.r + 2.1;
    if (d < min && d > 1e-4) { rex.pos.x = o.x + (ox / d) * min; rex.pos.y = o.z + (oz / d) * min; rex.speed *= 1 - Math.min(1, dt * 2); }
  }
  bound(rex.pos, 3);

  // acciones
  rex.roarCd = Math.max(0, rex.roarCd - dt);
  rex.recover = Math.max(0, rex.recover - dt);
  if (playing && !D.busy && rex.recover <= 0) {
    if (press.bite) {
      D.biteT = 0; rex.hit = false; sfx.bite();
      if (human.tryDodge(rex.pos, rex.heading)) message('¡ESQUIVÓ!', 0.9);
    }
    else if (press.roar && rex.roarCd <= 0) {
      D.roarT = 0; rex.roarCd = 7; sfx.roar(1, 1, 1.4); game.shake = Math.max(game.shake, 0.9);
      const d = human.pos.distanceTo(rex.pos);
      if (d < 36) { human.scare(1 - d / 36, obstacles, rex.pos); if (human.state === 'trip') sfx.scream(); }
      for (const r of raptors) if (r.state !== 'dead' && r.state !== 'off' && r.pos.distanceTo(rex.pos) < 26) { r.state = 'retreat'; r.timer = 3.5; }
    }
  }
  press.bite = press.roar = false;
  if (D.biteT >= 0) {
    D.biteT += dt / 0.62;
    if (!rex.hit && D.biteT > 0.4 && D.biteT < 0.55 && playing) {
      D.mouth.getWorldPosition(_m);
      if (human.state !== 'caught' && Math.hypot(_m.x - human.pos.x, _m.z - human.pos.y) < 1.8) {
        rex.hit = true;
        human.state = 'caught';
        human.lamp.intensity = 0;
        D.mouth.add(human.root);
        human.root.position.set(0, -0.1, 0.2);
        human.root.rotation.set(0, Math.PI / 2, Math.PI / 2);
        sfx.scream();
        game.shake = 0.6;
        end('win');
      } else for (const r of raptors) {
        if (r.state !== 'dead' && r.state !== 'off' && Math.hypot(_m.x - r.pos.x, _m.z - r.pos.y) < 3.1) { rex.hit = true; r.hurt(); game.shake = 0.5; break; }
      }
    }
    if (D.biteT >= 1) { D.biteT = -1; if (!rex.hit) rex.recover = 0.8; if (game.state === 'win' && D.chewT < 0 && human.root.visible) D.chewT = 0; }
  }
  if (D.roarT >= 0) { D.roarT += dt / (playing ? 1.4 : 2.0); if (D.roarT >= 1) D.roarT = -1; }
  if (D.chewT >= 0) {
    D.chewT += dt / 2.0;
    if (D.chewT > 0.6 && human.root.visible) { human.root.visible = false; sfx.bite(); }
    if (D.chewT >= 1) { D.chewT = -1; D.roarT = 0; sfx.roar(0.95, 1, 2.3); game.shake = 1; }
  }
  if (!alive) D.dead = Math.min(1, D.dead + dt * 1.2);

  const animSpeed = Math.abs(rex.speed) > 0.4 ? rex.speed : Math.abs(rex.turn) * 1.6;
  D.update(dt, animSpeed, rex.turn * Math.min(1, 0.35 + Math.abs(rex.speed) / 8));
  D.root.position.set(rex.pos.x, 0, rex.pos.y);
  D.root.rotation.y = rex.heading;
  if (D.steps.length) {
    const run = Math.abs(rex.speed) / 12;
    sfx.step(0.55 + run * 0.6);
    game.shake = Math.max(game.shake, 0.16 + run * 0.3);
  }
}

function updateCamera(dt) {
  const t = game.t;
  if (game.state === 'title') {
    const a = t * 0.12 + 2.4;
    camera.position.set(rex.pos.x + Math.sin(a) * 14, 3.0 + Math.sin(t * 0.2) * 0.8, rex.pos.y + Math.cos(a) * 14);
    camera.lookAt(rex.pos.x, 4.3, rex.pos.y);
    return;
  }
  const ended = game.state !== 'play';
  const follow = ended ? camState.heading + dt * 0.25 : rex.heading;
  camState.heading += angDiff(follow, camState.heading) * Math.min(1, dt * 2.6);
  const h = camState.heading, run = Math.min(1, Math.abs(rex.speed) / 12);
  const dist = 10.5 + run * 2.5, height = 5.2 - run * 0.5, side = 4.2;
  _v.set(rex.pos.x - Math.sin(h) * dist - Math.cos(h) * side, height, rex.pos.y - Math.cos(h) * dist + Math.sin(h) * side);
  // que la cámara no se meta en la selva ni cruce la cerca
  const d = Math.hypot(_v.x, _v.z), max = ARENA_R + 9;
  if (d > max) { _v.x *= max / d; _v.z *= max / d; }
  if (_v.z < FENCE_Z + 1.2) _v.z = FENCE_Z + 1.2;
  for (const o of obstacles) { // ni dentro de troncos y rocas
    const ox = _v.x - o.x, oz = _v.z - o.z, dd = Math.hypot(ox, oz), min = o.r + 1.6;
    if (dd < min && dd > 1e-4) { _v.x = o.x + (ox / dd) * min; _v.z = o.z + (oz / dd) * min; }
  }
  camState.pos.lerp(_v, Math.min(1, dt * 4));
  camera.position.copy(camState.pos);
  const sh = game.shake * game.shake;
  camera.position.x += (Math.random() - 0.5) * sh * 1.1;
  camera.position.y += (Math.random() - 0.5) * sh * 1.1;
  _v.set(rex.pos.x + Math.sin(rex.heading) * 7, 4.3, rex.pos.y + Math.cos(rex.heading) * 7);
  camState.look.lerp(_v, Math.min(1, dt * 5));
  camera.lookAt(camState.look);
  camera.rotation.z += (Math.random() - 0.5) * sh * 0.05;
  camera.fov = 58 + run * 7;
  camera.updateProjectionMatrix();
}

function updateHud() {
  const tt = Math.max(0, game.time), mm = Math.floor(tt / 60), ss = Math.floor(tt % 60), cc = Math.floor((tt % 1) * 30);
  setText(hud.timer, 'timer', `-00:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(cc).padStart(2, '0')}`);
  hud.timer.classList.toggle('alert', game.time < 15);
  const hpW = Math.round(rex.hp) + '%', stW = Math.round(rex.stamina * 100) + '%';
  if (cache.hp !== hpW) { cache.hp = hpW; hud.hp.style.width = hpW; }
  if (cache.st !== stW) { cache.st = stW; hud.st.style.width = stW; }
  hud.st.classList.toggle('low', rex.exhausted);
  hud.hp.classList.toggle('low', rex.hp < 35);
  setText(hud.roar, 'roar', rex.roarCd > 0 ? `RUGIDO ${Math.ceil(rex.roarCd)}` : 'RUGIDO OK');
  const dx = human.pos.x - rex.pos.x, dz = human.pos.y - rex.pos.y, d = Math.hypot(dx, dz);
  const st = human.state === 'hide' ? 'ESCONDIDO' : human.state === 'trip' ? '¡CAÍDO!' : human.state === 'caught' ? 'ALMORZADO' : human.fatigue > 0.65 ? 'AGOTADO' : 'CORRIENDO';
  setText(hud.prey, 'prey', `PRESA: ${PREY_NAME} · ${st}`);
  setText(hud.dist, 'dist', `${Math.round(d)} m`);
  hud.arrow.style.transform = `rotate(${-angDiff(Math.atan2(dx, dz), camState.heading)}rad)`;
  const alive = raptors.filter((r) => r.state !== 'off' && r.state !== 'dead').length;
  hud.warn.hidden = !(alive && game.state === 'play');
  setText(hud.warn, 'warn', `▲ RAPTORES ×${alive}`);
}

function update(dt) {
  game.t += dt;
  if (game.state === 'play') {
    game.time -= dt;
    game.elapsed += dt;
    if (game.time <= 10 && Math.ceil(game.time) !== game.lastBeep) { game.lastBeep = Math.ceil(game.time); sfx.beep(game.time <= 3 ? 1200 : 880); }
    if (game.time <= 0) end('timeout');
    if (!game.raptorsOut && game.elapsed > 16) {
      game.raptorsOut = true;
      raptors.forEach((r) => r.spawn());
      message('ALGO SE MUEVE EN LA SELVA…', 3);
      sfx.roar(3.0, 0.3, 0.5);
    }
  } else if (game.state !== 'title') {
    game.endT += dt;
    if (game.endT > 2.5 && hud.end.hidden && (game.state !== 'win' || !rexDino.busy || game.endT > 7)) showEnd();
  }
  updateRex(dt);
  const before = human.state;
  human.update(dt, rex.pos, rex.speed, obstacles, bound);
  if (before === 'hide' && human.state === 'run' && game.state === 'play') sfx.scream();
  for (const r of raptors) r.update(dt);
  if (game.msgT > 0) { game.msgT -= dt; if (game.msgT <= 0) hud.msg.hidden = true; }
  game.shake = Math.max(0, game.shake - dt * 1.6);
  game.glitch = Math.max(0, game.glitch - dt * 1.4);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!game.paused) {
    update(dt);
    updateCamera(dt);
    world.update(dt, game.t, camera.position, rexDino.root.position, sfx);
    if (game.state !== 'title') updateHud();
  }
  vhs.uniforms.glitch.value = game.glitch + (game.paused ? 0.25 : 0) + (game.state === 'title' ? 0.03 : 0);
  vhs.uniforms.flash.value = world.state.flash * 0.05;
  vhs.render(scene, camera, now / 1000);
}

reset();
game.glitch = 0;
human.root.visible = false;
requestAnimationFrame(frame);

// para depurar / pruebas automáticas
window.__rexvhs = { game, rex, human, raptors, startGame, keys, press, camera, rexDino, vhs, step: update, cam: updateCamera };
