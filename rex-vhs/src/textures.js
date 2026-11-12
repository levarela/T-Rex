// Texturas procedurales (canvas 2D): nada de assets externos.
import * as THREE from 'three';

// PRNG determinista para que el escenario sea igual en cada carga.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeatX = 1, repeatY = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function blobs(g, r, n, w, h, minR, maxR, colorFn) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = minR + r() * (maxR - minR);
    g.fillStyle = colorFn(r);
    // se dibuja 9 veces para que la textura sea continua al repetirse
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      g.beginPath();
      g.ellipse(x + ox * w, y + oy * h, rad, rad * (0.6 + r() * 0.6), r() * 3.14, 0, 6.283);
      g.fill();
    }
  }
}

// Piel de reptil. u = alrededor del cuerpo (0.25 = lomo, 0.75 = panza), v = a lo largo.
export function skinTextures({ back = [58, 52, 40], belly = [150, 135, 100], stripe = [22, 20, 16], seed = 7 }) {
  const W = 512, H = 512, r = rng(seed);
  const [c, g] = canvas(W, H);
  const [cb, gb] = canvas(W, H);
  // degradado lomo -> panza (en x)
  for (let x = 0; x < W; x++) {
    const u = x / W;
    const k = 0.5 + 0.5 * Math.cos((u - 0.75) * 6.283); // 1 en panza, 0 en lomo
    const m = Math.pow(k, 1.6);
    g.fillStyle = `rgb(${back[0] + (belly[0] - back[0]) * m | 0},${back[1] + (belly[1] - back[1]) * m | 0},${back[2] + (belly[2] - back[2]) * m | 0})`;
    g.fillRect(x, 0, 1, H);
  }
  // franjas oscuras que bajan desde el lomo
  for (let i = 0; i < 16; i++) {
    const y = (i + r() * 0.5) * (H / 16), th = 6 + r() * 12, len = 70 + r() * 90;
    const grd = g.createLinearGradient(W * 0.25 - len, 0, W * 0.25 + len, 0);
    const col = `${stripe[0]},${stripe[1]},${stripe[2]}`;
    grd.addColorStop(0, `rgba(${col},0)`);
    grd.addColorStop(0.5, `rgba(${col},0.75)`);
    grd.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(W * 0.25, y, len, th, (r() - 0.5) * 0.15, 0, 6.283);
    g.fill();
  }
  // escamas y manchas
  gb.fillStyle = '#808080';
  gb.fillRect(0, 0, W, H);
  blobs(g, r, 2600, W, H, 2, 6, (q) => (q() > 0.5 ? `rgba(0,0,0,${0.05 + q() * 0.12})` : `rgba(255,240,200,${0.03 + q() * 0.07})`));
  blobs(gb, r, 3200, W, H, 2, 5, (q) => { const v = 90 + q() * 110 | 0; return `rgba(${v},${v},${v},0.8)`; });
  blobs(g, r, 60, W, H, 14, 40, () => 'rgba(0,0,0,0.10)');
  return { map: tex(c, 1, 4), bump: tex(cb, 2, 8, false) };
}

export function groundTextures() {
  const W = 512, H = 512, r = rng(21);
  const [c, g] = canvas(W, H);
  const [cr, gr] = canvas(W, H);
  g.fillStyle = '#2a2a1c';
  g.fillRect(0, 0, W, H);
  blobs(g, r, 300, W, H, 10, 50, (q) => `rgba(${30 + q() * 30 | 0},${28 + q() * 26 | 0},${14 + q() * 14 | 0},0.35)`);
  blobs(g, r, 260, W, H, 6, 26, (q) => `rgba(${28 + q() * 26 | 0},${50 + q() * 40 | 0},${18 + q() * 16 | 0},0.5)`);
  // briznas
  for (let i = 0; i < 2600; i++) {
    const x = r() * W, y = r() * H;
    g.strokeStyle = `rgba(${40 + r() * 40 | 0},${70 + r() * 60 | 0},${24 + r() * 20 | 0},0.55)`;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 5, y - 2 - r() * 6);
    g.stroke();
  }
  // rugosidad: charcos = zonas oscuras (lisas, brillan con los focos)
  gr.fillStyle = '#d8d8d8';
  gr.fillRect(0, 0, W, H);
  blobs(gr, r, 26, W, H, 18, 60, () => 'rgba(20,20,20,0.9)');
  blobs(gr, r, 500, W, H, 2, 8, (q) => `rgba(${120 + q() * 120 | 0},${120 + q() * 120 | 0},${120 + q() * 120 | 0},0.5)`);
  blobs(g, r, 0, W, H, 0, 0, () => '#000');
  return { map: tex(c, 14, 14), rough: tex(cr, 5, 5, false) };
}

export function barkTexture() {
  const W = 128, H = 256, r = rng(5);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#3a2f24';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    g.strokeStyle = r() > 0.5 ? `rgba(15,12,8,${0.2 + r() * 0.4})` : `rgba(110,100,80,${0.1 + r() * 0.2})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    g.moveTo(x, r() * H);
    g.lineTo(x + (r() - 0.5) * 8, r() * H);
    g.stroke();
  }
  blobs(g, r, 30, W, H, 4, 14, () => 'rgba(60,90,50,0.25)'); // musgo
  return tex(c, 2, 3);
}

// Fronda de helecho/palma con transparencia.
export function frondTexture() {
  const W = 256, H = 256, r = rng(11);
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  for (let f = 0; f < 9; f++) {
    const ang = -Math.PI / 2 + (f - 4) * 0.33 + (r() - 0.5) * 0.1;
    const len = 150 + r() * 90;
    g.save();
    g.translate(W / 2, H);
    g.rotate(ang + Math.PI / 2);
    const shade = 50 + r() * 50 | 0;
    g.strokeStyle = `rgb(${shade * 0.45 | 0},${shade + 30},${shade * 0.4 | 0})`;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(12, -len * 0.5, 0, -len);
    g.stroke();
    for (let i = 3; i < 26; i++) {
      const t = i / 26, y = -len * t, x = 12 * Math.sin(t * Math.PI) * 0.9, l = 30 * Math.sin(t * Math.PI) + 5;
      g.lineWidth = 3.4;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x - l, y - l * 0.45);
      g.moveTo(x, y); g.lineTo(x + l, y - l * 0.45);
      g.stroke();
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function signTexture(lines, bg = '#d8c21a', fg = '#141414') {
  const [c, g] = canvas(256, 160);
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(6, 6, 244, 148);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.font = 'bold 40px Arial, sans-serif';
  g.fillText(lines[0], 128, 66);
  g.font = 'bold 30px Arial, sans-serif';
  g.fillText(lines[1], 128, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
