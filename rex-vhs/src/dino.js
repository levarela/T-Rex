// Dinosaurio bípedo procedural: cuerpo "lofteado" (anillos elípticos a lo largo
// de una columna) que se deforma cada frame, patas con IK de 2 huesos y
// mandíbula articulada. Sirve para el T-rex y, con otra escala, para los raptores.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const SEG = 14; // lados de cada anillo

function crom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Interpola nodos [pos, off, rx, ry] a n anillos suaves.
function resample(nodes, n) {
  const out = [], m = nodes.length - 1;
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * m, k = Math.min(m - 1, Math.floor(f)), t = f - k;
    const a = nodes[Math.max(0, k - 1)], b = nodes[k], c = nodes[k + 1], d = nodes[Math.min(m, k + 2)];
    out.push([0, 1, 2, 3].map((j) => (j < 2 ? crom(a[j], b[j], c[j], d[j], t) : Math.max(0.01, crom(a[j], b[j], c[j], d[j], t)))));
  }
  return out;
}

function loftGeometry(nRings, vRepeat = 1) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(nRings * (SEG + 1) * 3);
  const uv = new Float32Array(nRings * (SEG + 1) * 2);
  const idx = [];
  for (let i = 0; i < nRings; i++) {
    for (let j = 0; j <= SEG; j++) {
      const k = i * (SEG + 1) + j;
      uv[k * 2] = j / SEG;
      uv[k * 2 + 1] = (i / (nRings - 1)) * vRepeat;
      if (i < nRings - 1 && j < SEG) {
        const a = k, b = k + 1, c = k + SEG + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _u = new THREE.Vector3();

// Escribe los vértices. centers: Vector3[], radii: [rx, ry][], up: vector de referencia.
// shape(j, sin) permite aplanar media sección (cráneo/mandíbula).
function writeLoft(geo, centers, radii, up, shape) {
  const pos = geo.attributes.position.array, n = centers.length;
  for (let i = 0; i < n; i++) {
    const a = centers[Math.max(0, i - 1)], b = centers[Math.min(n - 1, i + 1)];
    _t.subVectors(b, a).normalize();
    _s.crossVectors(up, _t).normalize();
    _u.crossVectors(_t, _s);
    const c = centers[i], rx = radii[i][0], ry = radii[i][1];
    for (let j = 0; j <= SEG; j++) {
      const ang = (j / SEG) * TAU;
      const cs = Math.cos(ang) * rx;
      let sn = Math.sin(ang);
      sn = (shape ? shape(sn, i / (n - 1)) : sn) * ry;
      const k = (i * (SEG + 1) + j) * 3;
      pos[k] = c.x + _s.x * cs + _u.x * sn;
      pos[k + 1] = c.y + _s.y * cs + _u.y * sn;
      pos[k + 2] = c.z + _s.z * cs + _u.z * sn;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
  // cose la costura (j=0 y j=SEG comparten posición)
  const nor = geo.attributes.normal.array;
  for (let i = 0; i < n; i++) {
    const k0 = i * (SEG + 1) * 3, k1 = (i * (SEG + 1) + SEG) * 3;
    for (let q = 0; q < 3; q++) {
      const v = nor[k0 + q] + nor[k1 + q];
      nor[k0 + q] = nor[k1 + q] = v;
    }
  }
  geo.normalizeNormals();
}

const UP_Y = new THREE.Vector3(0, 1, 0);
const UP_Z = new THREE.Vector3(0, 0, 1);

// Pieza estática a lo largo de +Z. nodes: [z, y, rx, ry]
function staticLoftZ(nodes, n, mat, shape, vRepeat = 1) {
  const rs = resample(nodes, n);
  const geo = loftGeometry(n, vRepeat);
  writeLoft(geo, rs.map((r) => new THREE.Vector3(0, r[1], r[0])), rs.map((r) => [r[2], r[3]]), UP_Y, shape);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

// Segmento de pata/brazo: cuelga hacia -Y desde el origen. nodes: [dist, offZ, rx, rz]
function limb(nodes, mat, n = 8) {
  const rs = resample(nodes, n);
  const geo = loftGeometry(n, 1);
  writeLoft(geo, rs.map((r) => new THREE.Vector3(0, -r[0], r[1])), rs.map((r) => [r[2], r[3]]), UP_Z);
  // las extremidades usan solo la franja oscura (lomo) de la textura de piel
  const uv = geo.attributes.uv.array;
  for (let i = 0; i < uv.length; i += 2) uv[i] = 0.1 + uv[i] * 0.24;
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

// Columna base (de la punta de la cola al final del cuello): [z, y, rx, ry]
const SPINE = [
  [-7.4, 3.25, 0.03, 0.03], [-6.4, 3.3, 0.14, 0.16], [-5.3, 3.36, 0.27, 0.31], [-4.2, 3.42, 0.41, 0.48],
  [-3.1, 3.48, 0.56, 0.68], [-2.0, 3.55, 0.74, 0.92], [-0.9, 3.62, 0.95, 1.18], [0.2, 3.68, 1.08, 1.34],
  [1.2, 3.74, 1.06, 1.3], [2.1, 3.9, 0.92, 1.12], [2.8, 4.22, 0.7, 0.88], [3.35, 4.68, 0.56, 0.7],
  [3.8, 5.1, 0.5, 0.6], [4.15, 5.32, 0.46, 0.55],
];
const N_BODY = 44;
const HEAD_Z = 4.0, HEAD_Y = 5.28;
const HIP = { x: 0.82, y: 3.3, z: -0.25 };
const L1 = 1.95, L2 = 1.85, LM = 1.25;

export class Dino {
  constructor({ scale = 1, skin, eye = 0xffc02a, headScale = 1, armScale = 1 }) {
    this.scale = scale;
    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);
    const mat = new THREE.MeshStandardMaterial({ map: skin.map, bumpMap: skin.bump, bumpScale: 1.6, roughness: 0.5, metalness: 0.0 });
    this.mat = mat;

    // torso: pivota en la cadera para inclinar el cuerpo sin mover las patas
    this.torso = new THREE.Group();
    this.torso.position.set(0, HIP.y + 0.2, HIP.z);
    this.root.add(this.torso);
    this.torsoIn = new THREE.Group();
    this.torsoIn.position.copy(this.torso.position).negate();
    this.torso.add(this.torsoIn);

    this.base = resample(SPINE, N_BODY);
    this.centers = this.base.map((r) => new THREE.Vector3(0, r[1], r[0]));
    this.radii = this.base.map((r) => [r[2], r[3]]);
    this.bodyGeo = loftGeometry(N_BODY, 1);
    this.body = new THREE.Mesh(this.bodyGeo, mat);
    this.body.castShadow = true;
    this.body.frustumCulled = false;
    this.torsoIn.add(this.body);

    // cabeza
    this.head = new THREE.Group();
    this.head.scale.setScalar(headScale);
    this.torsoIn.add(this.head);
    const flatBottom = (sn) => (sn < 0 ? sn * 0.38 : sn);
    const flatTop = (sn) => (sn > 0 ? sn * 0.3 : sn);
    const skull = staticLoftZ([
      [-0.75, -0.12, 0.4, 0.45], [-0.2, 0.05, 0.6, 0.62], [0.35, 0.16, 0.7, 0.66], [0.85, 0.16, 0.66, 0.58],
      [1.35, 0.08, 0.5, 0.48], [1.9, 0.02, 0.44, 0.44], [2.4, -0.02, 0.4, 0.4], [2.72, -0.08, 0.3, 0.3], [2.86, -0.14, 0.08, 0.1],
    ], 18, mat, flatBottom, 0.6);
    this.head.add(skull);
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -0.1, 0.1);
    this.head.add(this.jaw);
    const jawMesh = staticLoftZ([
      [-0.5, -0.05, 0.3, 0.3], [0.0, -0.12, 0.56, 0.5], [0.6, -0.14, 0.6, 0.46], [1.2, -0.1, 0.44, 0.36],
      [1.8, -0.06, 0.38, 0.3], [2.3, -0.02, 0.33, 0.26], [2.58, 0.0, 0.2, 0.18], [2.68, 0.0, 0.05, 0.06],
    ], 16, mat, flatTop, 0.6);
    this.jaw.add(jawMesh);
    // interior de la boca
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x5a1218, roughness: 0.4 });
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 1.9), mouthMat);
    tongue.position.set(0, -0.03, 1.25);
    this.jaw.add(tongue);
    const palate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 2.0), mouthMat);
    palate.position.set(0, -0.2, 1.4);
    this.head.add(palate);
    // dientes
    const toothGeo = new THREE.ConeGeometry(0.045, 0.24, 5);
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xe8dfc4, roughness: 0.35 });
    const nT = 11;
    const upper = new THREE.InstancedMesh(toothGeo, toothMat, nT * 2 + 3);
    const lower = new THREE.InstancedMesh(toothGeo, toothMat, nT * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
    for (let i = 0; i < nT; i++) {
      const t = i / (nT - 1), z = 1.0 + t * 1.65;
      const wU = 0.56 - t * 0.2 - t * t * 0.08, wL = 0.5 - t * 0.2 - t * t * 0.06;
      for (const sgn of [-1, 1]) {
        const k = i * 2 + (sgn > 0 ? 1 : 0), s = 0.75 + ((i * 7 + k) % 5) * 0.12;
        e.set(Math.PI, 0, sgn * 0.12); q.setFromEuler(e); sc.set(1, s * 1.15, 1);
        m4.compose(new THREE.Vector3(sgn * wU, -0.3 - s * 0.1, z), q, sc);
        upper.setMatrixAt(k, m4);
        e.set(0, 0, sgn * -0.1); q.setFromEuler(e); sc.set(0.9, s * 0.8, 0.9);
        m4.compose(new THREE.Vector3(sgn * wL, 0.02 + s * 0.06, z - 0.12), q, sc);
        lower.setMatrixAt(k, m4);
      }
    }
    for (let i = 0; i < 3; i++) { // dientes frontales
      e.set(Math.PI, 0, 0); q.setFromEuler(e); sc.set(1, 1, 1);
      m4.compose(new THREE.Vector3((i - 1) * 0.16, -0.36, 2.72), q, sc);
      upper.setMatrixAt(nT * 2 + i, m4);
    }
    this.head.add(upper);
    this.jaw.add(lower);
    // ojos y arcos superciliares
    const eyeGeo = new THREE.SphereGeometry(0.085, 10, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: eye, emissive: eye, emissiveIntensity: 0.9, roughness: 0.2 });
    const pupMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const sgn of [-1, 1]) {
      const ey = new THREE.Mesh(eyeGeo, eyeMat);
      ey.position.set(sgn * 0.6, 0.42, 0.72);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pupMat);
      pu.position.set(sgn * 0.055, 0, 0.035);
      pu.scale.set(0.7, 1.3, 0.7);
      ey.add(pu);
      this.head.add(ey);
      const brow = limb([[0, 0, 0.05, 0.09], [0.25, 0, 0.13, 0.16], [0.6, 0, 0.11, 0.13], [0.8, 0, 0.03, 0.04]], mat, 6);
      brow.position.set(sgn * 0.52, 0.64, 0.25);
      brow.rotation.set(-1.45, 0, sgn * 0.12);
      this.head.add(brow);
    }
    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0, -0.25, 1.9);
    this.head.add(this.mouth);

    // bracitos
    for (const sgn of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sgn * 0.78, 3.35, 2.25);
      arm.rotation.set(-0.5, 0, sgn * 0.25);
      arm.scale.setScalar(armScale);
      const upperArm = limb([[0, 0, 0.14, 0.16], [0.3, 0, 0.13, 0.15], [0.62, 0, 0.09, 0.1]], mat, 5);
      const fore = limb([[0, 0, 0.09, 0.1], [0.3, 0, 0.07, 0.08], [0.5, 0, 0.04, 0.05], [0.62, 0, 0.01, 0.02]], mat, 5);
      fore.position.y = -0.58;
      fore.rotation.x = -1.3;
      arm.add(upperArm, fore);
      this.torsoIn.add(arm);
    }

    // patas
    this.legs = [];
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.5 });
    for (const sgn of [-1, 1]) {
      const leg = { sgn, down: true };
      leg.thigh = limb([[-0.45, 0, 0.3, 0.55], [0.1, 0.05, 0.54, 0.95], [0.8, 0.05, 0.5, 0.82], [1.5, 0, 0.38, 0.54], [L1 + 0.14, 0, 0.3, 0.36]], mat, 9);
      leg.shin = limb([[-0.18, 0, 0.3, 0.36], [0.35, -0.12, 0.34, 0.52], [1.0, -0.05, 0.24, 0.33], [L2 + 0.06, 0, 0.19, 0.22]], mat, 8);
      leg.meta = limb([[-0.1, 0, 0.19, 0.22], [0.5, 0, 0.17, 0.19], [LM, 0, 0.23, 0.24]], mat, 6);
      leg.foot = new THREE.Group();
      for (let i = -1; i <= 1; i++) {
        const toe = limb([[-0.1, 0, 0.12, 0.1], [0.4, 0, 0.15, 0.13], [0.85 + (i === 0 ? 0.25 : 0), 0, 0.1, 0.09]], mat, 5);
        toe.rotation.set(-Math.PI / 2 + 0.06, 0, 0);
        toe.rotation.y = 0; // se orienta con el grupo
        const tg = new THREE.Group();
        tg.rotation.y = i * 0.42 * sgn * -1;
        tg.position.y = 0.14;
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.36, 5), clawMat);
        claw.rotation.x = Math.PI / 2 + 0.35;
        claw.position.set(0, -0.04, 0.98 + (i === 0 ? 0.25 : 0));
        tg.add(toe, claw);
        leg.foot.add(tg);
      }
      this.root.add(leg.thigh, leg.shin, leg.meta, leg.foot);
      this.legs.push(leg);
    }

    // estado de animación
    this.phase = 0;
    this.time = Math.random() * 10;
    this.biteT = -1;    // 0..1 mientras muerde
    this.roarT = -1;    // 0..1 mientras ruge
    this.chewT = -1;    // 0..1 mientras traga
    this.dead = 0;      // 0..1 caída
    this.headOff = new THREE.Vector3();
    this.steps = [];    // eventos de pisada del frame
    this.update(0, 0, 0);
  }

  get busy() { return this.biteT >= 0 || this.roarT >= 0 || this.chewT >= 0; }

  update(dt, speed, turn) {
    const sc = this.scale;
    const v = speed / sc;
    this.time += dt;
    const t = this.time;
    this.steps.length = 0;
    const gait = Math.min(1, Math.abs(v) / 2.2);
    const stride = 2.5 + Math.min(1.6, Math.abs(v) * 0.13);
    const duty = 0.6 - Math.min(0.15, Math.abs(v) * 0.012);
    this.phase += (v * dt) / (stride / duty);
    const ph = this.phase;

    // acciones
    let jawOpen = 0.04 + 0.03 * Math.sin(t * 1.7), pitch = 0, headPitch = 0;
    const ho = this.headOff.set(0, 0, 0);
    if (this.biteT >= 0) {
      const p = this.biteT;
      const lunge = Math.sin(Math.PI * Math.min(1, p / 0.8)) ** 1.2;
      jawOpen = p < 0.42 ? 0.95 * Math.min(1, p / 0.25) : 0.95 * Math.max(0, 1 - (p - 0.42) / 0.09);
      pitch = 0.3 * lunge; headPitch = 0.42 * lunge;
      ho.set(0, -1.5 * lunge, 0.9 * lunge);
    } else if (this.roarT >= 0) {
      const p = this.roarT, env = Math.min(1, p / 0.15) * Math.min(1, (1 - p) / 0.2);
      jawOpen = env * (0.85 + 0.06 * Math.sin(t * 46));
      pitch = -0.07 * env; headPitch = -0.3 * env;
      ho.set(Math.sin(t * 9) * 0.12 * env, 0.25 * env, 0.5 * env);
    } else if (this.chewT >= 0) {
      const p = this.chewT, env = Math.min(1, p / 0.12) * Math.min(1, (1 - p) / 0.15);
      jawOpen = 0.12 + 0.35 * Math.abs(Math.sin(p * Math.PI * 5)) * env;
      pitch = -0.12 * env; headPitch = -0.55 * env;
      ho.set(Math.sin(p * 30) * 0.25 * env, 0.6 * env, 0);
    }
    const run = Math.min(1, Math.abs(v) / 11);
    pitch += 0.06 * run;

    // cuerpo: vaivén y balanceo
    const bob = -Math.cos(ph * TAU * 2) * 0.13 * gait + Math.sin(t * 1.1) * 0.03;
    const drop = this.dead * 2.3;
    this.torso.position.y = HIP.y + 0.2 + bob - drop;
    this.torso.rotation.x = pitch + this.dead * 0.12;
    this.torso.rotation.z = Math.sin(ph * TAU) * 0.045 * gait + this.dead * 1.2;
    this.torso.rotation.y = Math.sin(ph * TAU) * 0.05 * gait;

    // columna: cola y cuello
    const breathe = 1 + Math.sin(t * 1.6) * 0.015;
    for (let i = 0; i < N_BODY; i++) {
      const b = this.base[i], c = this.centers[i], z = b[0];
      c.set(0, b[1], z);
      if (z < -0.6) {
        const s = (-0.6 - z) / 6.8;
        c.x = Math.sin(t * 1.4 - s * 2.6) * 0.5 * s * s * (1 - gait * 0.5)
          + Math.sin(ph * TAU - s * 2.4) * 0.65 * s * Math.sqrt(s) * gait
          - turn * 1.5 * s * s;
        c.y += Math.sin(t * 1.1 - s * 2) * 0.12 * s + 0.35 * s * s * run - this.dead * 0.6 * s;
      } else if (z > 2.2) {
        const w = Math.min(1, (z - 2.2) / (HEAD_Z - 2.2)), k = w * w * (3 - 2 * w);
        c.x += (ho.x + turn * 0.5) * k;
        c.y += (ho.y - 0.18 * run) * k;
        c.z += ho.z * k;
      }
      this.radii[i][0] = b[2] * (z > -1 && z < 2.5 ? breathe : 1);
    }
    writeLoft(this.bodyGeo, this.centers, this.radii, UP_Y);
    this.head.position.set(ho.x + turn * 0.5, HEAD_Y + ho.y - 0.18 * run, HEAD_Z + ho.z);
    this.head.rotation.set(0.1 + headPitch + Math.sin(ph * TAU * 2 + 1) * 0.03 * gait, turn * 0.45 + Math.sin(t * 0.7) * 0.05, 0);
    this.jaw.rotation.x = jawOpen;

    // patas (IK en el plano YZ)
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i];
      let p = (ph + i * 0.5) % 1;
      if (p < 0) p += 1;
      let fz, fy = 0, alpha = 0.42, toe = 0;
      const down = p < duty;
      if (down) {
        const u = p / duty;
        fz = stride * (0.5 - u);
        alpha += 0.55 * Math.max(0, u - 0.6) / 0.4;
      } else {
        const u = (p - duty) / (1 - duty), su = u * u * (3 - 2 * u);
        fz = stride * (-0.5 + su);
        fy = Math.sin(Math.PI * u) * (0.75 + 0.5 * run);
        alpha += 0.55 * (1 - u) + 0.5 * Math.sin(Math.PI * u);
        toe = Math.sin(Math.PI * u) * 0.75;
      }
      fz = fz * gait + 0.25;
      fy *= gait;
      alpha = 0.42 + (alpha - 0.42) * gait;
      toe *= gait;
      if (down && !leg.down && gait > 0.3) this.steps.push(i);
      leg.down = down;

      const hx = leg.sgn * HIP.x;
      const hy = HIP.y + bob - drop * 0.95, hz = HIP.z;
      const az = fz - Math.sin(alpha) * LM, ay = fy + Math.cos(alpha) * LM;
      let dz = az - hz, dy = ay - hy;
      let d = Math.hypot(dz, dy);
      const maxD = L1 + L2 - 0.02;
      if (d > maxD) { dz *= maxD / d; dy *= maxD / d; d = maxD; }
      const beta = Math.atan2(dz, -dy);
      const a = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
      const th = beta + a;
      const kz = hz + Math.sin(th) * L1, ky = hy - Math.cos(th) * L1;
      const ax = hz + dz, ayy = hy + dy;
      leg.thigh.position.set(hx, hy, hz);
      leg.thigh.rotation.x = -th;
      leg.shin.position.set(hx, ky, kz);
      leg.shin.rotation.x = Math.atan2(-(ax - kz), -(ayy - ky));
      leg.meta.position.set(hx, ayy, ax);
      const fzz = ax + Math.sin(alpha) * LM, fyy = ayy - Math.cos(alpha) * LM;
      leg.meta.rotation.x = Math.atan2(-(fzz - ax), -(fyy - ayy));
      leg.foot.position.set(hx, Math.max(0, fyy), fzz);
      leg.foot.rotation.x = toe;
    }
  }
}
