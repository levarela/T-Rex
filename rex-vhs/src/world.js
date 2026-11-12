// Escenario 01: "El cerco roto". Un claro de selva de noche, bajo la lluvia,
// junto a la cerca eléctrica del recinto y el camino de servicio.
import * as THREE from 'three';
import { rng, groundTextures, barkTexture, frondTexture, signTexture } from './textures.js';

export const ARENA_R = 56;
export const FENCE_Z = -57;

export function buildWorld(scene) {
  const r = rng(1993);
  const obstacles = []; // { x, z, r, cover }
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const put = (inst, i, x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => {
    e.set(rx, ry, rz); q.setFromEuler(e); v.set(x, y, z); s.set(sx, sy, sz);
    inst.setMatrixAt(i, m4.compose(v, q, s));
  };

  // ── cielo / niebla ──
  const FOG = new THREE.Color(0x111d2c);
  scene.background = FOG.clone();
  scene.fog = new THREE.FogExp2(FOG.getHex(), 0.0125);

  // ── suelo ──
  const gt = groundTextures();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    std({ map: gt.map, roughnessMap: gt.rough, roughness: 1, metalness: 0.0, color: 0xb0b0a0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // camino de servicio embarrado
  const road = new THREE.Mesh(new THREE.PlaneGeometry(240, 8), std({ color: 0x2a231a, roughness: 0.35, map: gt.rough }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, -47);
  road.receiveShadow = true;
  scene.add(road);

  // ── luces ──
  scene.add(new THREE.HemisphereLight(0x8aa2d8, 0x222c22, 1.9));
  const moon = new THREE.DirectionalLight(0xa9bcff, 2.6);
  moon.position.set(-30, 60, 20);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  const sc = moon.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 10; sc.far = 140;
  moon.shadow.bias = -0.0015;
  moon.shadow.normalBias = 0.06;
  scene.add(moon, moon.target);
  const fill = new THREE.PointLight(0xb8c8ff, 520, 60, 1.6);
  scene.add(fill);
  const bolt = new THREE.DirectionalLight(0xdfe8ff, 0);
  bolt.position.set(40, 80, -60);
  scene.add(bolt);

  // esfera deformada: copas y rocas con sombreado suave
  const blob = (amp, f) => {
    const g = new THREE.SphereGeometry(1, 12, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 + amp * (Math.sin(x * f + y * 2.3) * Math.cos(z * f * 1.3 + x) + 0.5 * Math.sin(y * f * 2.1 + z * 3.7));
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    return g;
  };

  // ── selva perimetral (instanciada) ──
  const bark = barkTexture();
  const N_TREES = 230;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.6, 1, 7), std({ map: bark, roughness: 0.9 }), N_TREES);
  const leafMat = std({ color: 0x24472a, roughness: 0.8 });
  const crowns = new THREE.InstancedMesh(blob(0.22, 4.1), leafMat, N_TREES * 2);
  for (let i = 0; i < N_TREES; i++) {
    const a = r() * Math.PI * 2, d = ARENA_R + 15 + r() * r() * 60;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = 12 + r() * 14, w = 1 + r() * 1.6;
    put(trunks, i, x, h / 2, z, r() * 6, w, h, w);
    const cr = 4 + r() * 4.5;
    put(crowns, i * 2, x, h + cr * 0.2, z, r() * 6, cr * 1.3, cr * 0.8, cr * 1.3);
    put(crowns, i * 2 + 1, x + (r() - 0.5) * 5, h - cr * 0.5, z + (r() - 0.5) * 5, r() * 6, cr, cr * 0.7, cr);
  }
  scene.add(trunks, crowns);
  // muro oscuro de fondo para tapar el horizonte
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 34, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x060c0c, side: THREE.BackSide, fog: true }));
  wall.position.y = 17;
  scene.add(wall);

  // ── árboles gigantes dentro del claro (cobertura) ──
  const bigTrees = [[-30, -22, 1.7], [31, -18, 1.5], [9, 37, 1.9], [-24, 33, 1.6], [-2, 6, 1.4], [40, 22, 1.5], [-43, 6, 1.6]];
  const bigTrunkMat = std({ map: bark, roughness: 0.9, color: 0xbbbbbb });
  bigTrees.forEach(([x, z, rad], i) => {
    const h = 22 + r() * 6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.7, rad * 1.25, h, 10), bigTrunkMat);
    trunk.position.set(x, h / 2, z);
    trunk.castShadow = true;
    scene.add(trunk);
    for (let k = 0; k < 5; k++) { // raíces
      const a = (k / 5) * 6.283 + i, root = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.55, 3.2, 5), bigTrunkMat);
      root.position.set(x + Math.cos(a) * rad * 1.1, 1.1, z + Math.sin(a) * rad * 1.1);
      root.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      scene.add(root);
    }
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(crowns.geometry, leafMat), cr = 6 + r() * 4;
      c.position.set(x + (r() - 0.5) * 8, h + (r() - 0.3) * 4, z + (r() - 0.5) * 8);
      c.scale.set(cr * 1.4, cr * 0.7, cr * 1.4);
      c.rotation.y = r() * 6;
      scene.add(c);
    }
    obstacles.push({ x, z, r: rad * 1.35, cover: true });
  });

  // ── helechos y palmas bajas (sin colisión) ──
  const frond = frondTexture();
  const fernGeo = new THREE.PlaneGeometry(1, 1);
  fernGeo.translate(0, 0.5, 0);
  const fernMat = std({ map: frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, color: 0x5d7a55 });
  const N_FERN = 420;
  const ferns = new THREE.InstancedMesh(fernGeo, fernMat, N_FERN * 3);
  for (let i = 0; i < N_FERN; i++) {
    const a = r() * Math.PI * 2;
    const edge = r() < 0.6;
    const d = edge ? ARENA_R - 2 + r() * 26 : Math.sqrt(r()) * ARENA_R;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const size = (edge ? 2.6 : 1.2) + r() * (edge ? 3.5 : 1.4), ry = r() * 3.14;
    const onRoad = Math.abs(z + 47) < 6;
    for (let k = 0; k < 3; k++) put(ferns, i * 3 + k, x, onRoad ? -50 : -0.05, z, ry + k * 1.047, size * 1.3, size, 1, 0, 0);
  }
  scene.add(ferns);

  // ── rocas ──
  const rockGeo = blob(0.16, 2.6);
  const rockMat = std({ color: 0x3c3f3b, roughness: 0.6 });
  const rocks = [[-27, 6, 4.2], [-5, 29, 3.4], [24, -34, 3.0], [46, -4, 3.2], [-12, -30, 2.6]];
  rocks.forEach(([x, z, rad]) => {
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(rockGeo, rockMat), rr = rad * (k ? 0.45 + r() * 0.25 : 1);
      const a = r() * 6.283;
      m.position.set(x + (k ? Math.cos(a) * rad * 0.9 : 0), rr * 0.35, z + (k ? Math.sin(a) * rad * 0.9 : 0));
      m.scale.set(rr, rr * 0.8, rr);
      m.rotation.set(r(), r() * 6, r());
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    obstacles.push({ x, z, r: rad * 1.05, cover: true });
  });

  // ── caseta de mantenimiento ──
  {
    const g = new THREE.Group();
    const wood = std({ color: 0x5a4a36, roughness: 0.8, map: bark });
    const wallsM = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 4.6), wood);
    wallsM.position.y = 1.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.9, 2.2, 4), std({ color: 0x3b3a2a, roughness: 0.7, flatShading: true }));
    roof.position.y = 4.3;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.15, 1, 0.9);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.1), std({ color: 0x1b1712 }));
    door.position.set(-1, 1.1, 2.33);
    const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    lampM.position.set(0.6, 2.9, 2.5);
    const lamp = new THREE.PointLight(0xffb060, 40, 22, 2);
    lamp.position.set(0.6, 2.8, 3.2);
    g.add(wallsM, roof, door, lampM, lamp);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(24, 0, 9);
    g.rotation.y = -0.5;
    scene.add(g);
    obstacles.push({ x: 24, z: 9, r: 4.1, cover: true });
  }

  // ── vehículos del tour ──
  const paint = std({ color: 0xb9b08f, roughness: 0.35, metalness: 0.3 });
  const stripe = std({ color: 0x8e2a1c, roughness: 0.4 });
  const dark = std({ color: 0x0c0f12, roughness: 0.15, metalness: 0.6 });
  const tire = std({ color: 0x111111, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const headlights = [];
  function vehicle(x, z, ry, lightsOn, tipped) {
    const g = new THREE.Group(), inner = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 4.7), paint);
    body.position.y = 0.95;
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.03, 0.22, 4.72), stripe);
    band.position.y = 1.0;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.75, 2.7), dark);
    cabin.position.set(0, 1.72, -0.35);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.1, 2.8), paint);
    roof.position.set(0, 2.14, -0.35);
    inner.add(body, band, cabin, roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, tire);
      w.position.set(sx * 0.95, 0.42, sz * 1.5);
      inner.add(w);
    }
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: lightsOn ? 0xfff4d0 : 0x333333 }));
      l.position.set(sx * 0.7, 1.0, 2.36);
      inner.add(l);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: lightsOn ? 0xff2010 : 0x300000 }));
      tl.position.set(sx * 0.75, 1.05, -2.37);
      inner.add(tl);
    }
    if (lightsOn) {
      const sp = new THREE.SpotLight(0xfff0c8, 900, 70, 0.42, 0.6, 1.6);
      sp.position.set(0, 1.1, 2.3);
      sp.target.position.set(0, 0.2, 22);
      inner.add(sp, sp.target);
      headlights.push(sp);
    }
    if (tipped) { inner.rotation.z = 1.42; inner.position.set(0.3, 0.75, 0); }
    inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(inner);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    obstacles.push({ x, z, r: 2.9, cover: true });
  }
  vehicle(-9, -46.5, 1.2, true, false);
  vehicle(15, -41, 2.5, false, true);

  // ── cerca eléctrica rota ──
  {
    const postGeo = new THREE.CylinderGeometry(0.22, 0.28, 8, 8);
    const postMat = std({ color: 0x6f7377, roughness: 0.4, metalness: 0.6 });
    const xs = [];
    for (let x = -88; x <= 88; x += 8) xs.push(x);
    const posts = new THREE.InstancedMesh(postGeo, postMat, xs.length);
    const wireGeo = new THREE.BoxGeometry(8, 0.06, 0.06);
    const wires = new THREE.InstancedMesh(wireGeo, std({ color: 0x8a8f94, roughness: 0.3, metalness: 0.8 }), xs.length * 7);
    let wi = 0;
    xs.forEach((x, i) => {
      const broken = Math.abs(x) < 9;
      if (broken) put(posts, i, x * 1.1, 0.9, FENCE_Z + 3 + Math.abs(x) * 0.3, 0, 1, 1, 1, 1.25, x < 0 ? 0.5 : -0.4);
      else put(posts, i, x, 4, FENCE_Z, 0, 1, 1, 1);
      if (i < xs.length - 1) {
        const mid = x + 4, gap = Math.abs(mid) < 13;
        for (let k = 0; k < 7; k++) {
          if (gap) { // cables cortados que cuelgan
            const side = mid < 0 ? -1 : 1;
            put(wires, wi++, side * 12 - side * 0.5, 4 - k * 0.35, FENCE_Z + 0.2, 0, 0.5 + r() * 0.3, 1, 1, 0, side * (1.2 + r() * 0.3));
          } else put(wires, wi++, mid, 1 + k * 1.05, FENCE_Z, 0, 1, 1, 1);
        }
      }
    });
    wires.count = wi;
    posts.castShadow = true;
    scene.add(posts, wires);
    const sign = signTexture(['PELIGRO', '10.000 VOLTIOS']);
    for (const x of [-28, 28, -60, 60]) {
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), std({ map: sign, roughness: 0.5, emissive: 0x333300 }));
      sm.position.set(x, 3.2, FENCE_Z + 0.12);
      scene.add(sm);
    }
    // reflectores sobre postes altos
    for (const x of [-22, 22]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 14, 8), postMat);
      pole.position.set(x, 7, FENCE_Z + 1.5);
      const lampM = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.8), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
      lampM.position.set(x, 14, FENCE_Z + 1.9);
      const sp = new THREE.SpotLight(0xffe6b8, 2600, 110, 0.62, 0.7, 1.7);
      sp.position.set(x, 14, FENCE_Z + 2);
      sp.target.position.set(x * 0.6, 0, -18);
      scene.add(pole, lampM, sp, sp.target);
    }
  }

  // ── lluvia ──
  const N_RAIN = 1500, RW = 70, RH = 34;
  const rainPos = new Float32Array(N_RAIN * 6), rainSeed = new Float32Array(N_RAIN * 3);
  for (let i = 0; i < N_RAIN * 3; i++) rainSeed[i] = r();
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa8bcd8, transparent: true, opacity: 0.2, fog: false }));
  rain.frustumCulled = false;
  scene.add(rain);
  const wrap = (a, m) => ((a % m) + m) % m;

  // ── tormenta ──
  let nextBolt = 5, boltT = -1;
  const state = { flash: 0 };

  function update(dt, t, cam, focus, sfx) {
    // lluvia alrededor de la cámara
    const fall = t * 42;
    for (let i = 0; i < N_RAIN; i++) {
      const x = cam.x + wrap(rainSeed[i * 3] * RW - cam.x, RW) - RW / 2;
      const z = cam.z + wrap(rainSeed[i * 3 + 2] * RW - cam.z, RW) - RW / 2;
      const y = wrap(rainSeed[i * 3 + 1] * RH - fall * (0.8 + rainSeed[i * 3] * 0.4), RH);
      const k = i * 6;
      rainPos[k] = x; rainPos[k + 1] = y; rainPos[k + 2] = z;
      rainPos[k + 3] = x + 0.12; rainPos[k + 4] = y + 1.1; rainPos[k + 5] = z + 0.05;
    }
    rainGeo.attributes.position.needsUpdate = true;
    // la sombra de la luna sigue al foco
    fill.position.set(focus.x * 0.6 + cam.x * 0.4, 13, focus.z * 0.6 + cam.z * 0.4);
    moon.target.position.set(focus.x, 0, focus.z);
    moon.position.set(focus.x - 34, 55, focus.z - 22);
    // relámpagos
    nextBolt -= dt;
    if (nextBolt <= 0) { nextBolt = 7 + Math.random() * 10; boltT = 0; sfx && sfx.thunder(); }
    let f = 0;
    if (boltT >= 0) {
      boltT += dt;
      f = boltT < 0.07 ? 1 : boltT < 0.14 ? 0.15 : boltT < 0.24 ? 0.8 : Math.max(0, 1 - (boltT - 0.24) / 0.35) * 0.5;
      if (boltT > 0.6) boltT = -1;
    }
    state.flash = f;
    bolt.intensity = f * 5;
    scene.background.copy(FOG).lerp(new THREE.Color(0x8a9cc0), f * 0.55);
    scene.fog.color.copy(scene.background);
    // faros que parpadean
    for (const h of headlights) h.intensity = 900 * (0.85 + 0.15 * Math.sin(t * 31) * Math.sin(t * 7.3));
  }

  return { obstacles, update, state };
}
