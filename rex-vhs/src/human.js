// Presa humana: figura low-poly articulada + IA de huir / esconderse.
import * as THREE from 'three';

const box = (w, h, d, mat, y = -h / 2) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, y, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
};

export class Human {
  constructor({ coat = 0xd9b21c, pants = 0x2b2f3a, skin = 0xd9a583, hair = 0x2a1c12 } = {}) {
    const M = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const coatM = M(coat, 0.45), pantsM = M(pants), skinM = M(skin), hairM = M(hair);
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // cadera
    this.root.add(this.body);
    this.torso = box(0.46, 0.62, 0.26, coatM, 0.31);
    this.body.add(this.torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), skinM);
    head.position.y = 0.78;
    head.castShadow = true;
    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.133, 10, 8, 0, 6.283, 0, 1.5), hairM);
    hairMesh.position.set(0, 0.795, -0.012);
    this.torso.add(head, hairMesh);
    this.arms = [], this.legs = [], this.knees = [];
    for (const s of [-1, 1]) {
      const arm = box(0.12, 0.6, 0.13, coatM);
      arm.position.set(s * 0.3, 0.6, 0);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), skinM);
      hand.position.y = -0.62;
      arm.add(hand);
      this.torso.add(arm);
      this.arms.push(arm);
      const leg = box(0.17, 0.44, 0.18, pantsM);
      leg.position.set(s * 0.12, 0, 0);
      const knee = box(0.15, 0.44, 0.16, pantsM);
      knee.position.y = -0.43;
      const shoe = box(0.16, 0.08, 0.28, M(0x151515), -0.04);
      shoe.position.set(0, -0.42, 0.06);
      knee.add(shoe);
      leg.add(knee);
      this.body.add(leg);
      this.legs.push(leg);
      this.knees.push(knee);
    }
    // linterna: lo delata en la oscuridad
    this.lamp = new THREE.PointLight(0xfff0c0, 6, 9, 2);
    this.lamp.position.set(0.3, 0.35, 0.4);
    this.torso.add(this.lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xfff6d0 }));
    bulb.position.copy(this.lamp.position);
    this.torso.add(bulb);

    this.pos = new THREE.Vector2();
    this.heading = 0;
    this.speed = 0;
    this.state = 'run'; // run | hide | trip | caught
    this.cover = null;
    this.panic = 0;
    this.fatigue = 0;
    this.stateT = 0;
    this.jukeT = 0;
    this.jukeSign = 1;
    this.cycle = 0;
    this.crouch = 0;
    this.dodgeT = 0;
    this.slowT = 0;
    this.dodgeX = 0;
    this.dodgeZ = 0;
  }

  reset(x, z) {
    this.pos.set(x, z);
    this.state = 'run';
    this.cover = null;
    this.panic = 0;
    this.fatigue = 0;
    this.stateT = 0;
    this.crouch = 0;
    this.dodgeT = 0;
    this.slowT = 0;
    this.root.visible = true;
    this.root.scale.setScalar(1);
    this.root.rotation.set(0, 0, 0);
    this.lamp.intensity = 6;
  }

  pickCover(obstacles, rex, exclude) {
    let best = null, bestS = -1e9;
    const toRexX = rex.x - this.pos.x, toRexY = rex.y - this.pos.y, dR = Math.hypot(toRexX, toRexY) || 1;
    for (const o of obstacles) {
      if (o === exclude || !o.cover) continue;
      const dx = o.x - this.pos.x, dz = o.z - this.pos.y, d = Math.hypot(dx, dz) || 1;
      const dRexO = Math.hypot(o.x - rex.x, o.z - rex.y);
      const toward = (dx * toRexX + dz * toRexY) / (d * dR); // 1 = hay que pasar por el rex
      const s = dRexO * 1.0 - d * 0.7 - Math.max(0, toward) * 30 + Math.sin(o.x * 3.1 + this.stateT) * 4;
      if (s > bestS) { bestS = s; best = o; }
    }
    this.cover = best;
  }

  // Punto de escondite: lado del obstáculo opuesto al rex.
  hidePoint(rex, out) {
    const o = this.cover;
    let dx = o.x - rex.x, dz = o.z - rex.y;
    const d = Math.hypot(dx, dz) || 1;
    return out.set(o.x + (dx / d) * (o.r + 0.9), o.z + (dz / d) * (o.r + 0.9));
  }

  scare(strength, obstacles, rex) { // rugido
    if (this.state === 'caught') return;
    if (this.state === 'hide') { this.bolt(obstacles, rex); return; }
    if (this.state !== 'run' || strength < 0.5) return;
    // fresco solo trastabilla; cansado se va al piso
    if (this.fatigue > 0.45) { this.state = 'trip'; this.stateT = 0; } else this.slowT = 0.8;
  }

  // Al ver venir el mordisco se tira a un costado; cuanto más cansado, menos reflejos.
  tryDodge(rex, heading) {
    if (this.state !== 'run' || this.dodgeT > 0) return false;
    const dx = this.pos.x - rex.x, dz = this.pos.y - rex.y;
    if (Math.hypot(dx, dz) > 11 || Math.random() > 1.25 - 1.1 * this.fatigue) return false;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const side = dx * fz - dz * fx >= 0 ? 1 : -1;
    this.dodgeX = fz * side; this.dodgeZ = -fx * side; this.dodgeT = 0.45;
    return true;
  }

  bolt(obstacles, rex) {
    const prev = this.cover;
    this.pickCover(obstacles, rex, prev);
    this.state = 'run';
    this.stateT = 0;
    this.panic = 0;
    this.screamed = false;
  }

  update(dt, rex, rexSpeed, obstacles, bound) {
    const tmp = Human._v;
    this.stateT += dt;
    if (this.state === 'caught') return;
    const dx = this.pos.x - rex.x, dz = this.pos.y - rex.y, dRex = Math.hypot(dx, dz) || 1;
    let mvx = 0, mvz = 0, sp = 0;

    if (this.state === 'trip') {
      if (this.stateT > 3) { this.state = 'run'; this.stateT = 0; }
    } else {
      if (!this.cover) this.pickCover(obstacles, rex, null);
      this.hidePoint(rex, tmp);
      let tx = tmp.x - this.pos.x, tz = tmp.y - this.pos.y;
      const dT = Math.hypot(tx, tz) || 1;
      if (this.state === 'run') {
        this.fatigue = Math.min(1, this.fatigue + dt / 32);
        sp = 6.6 - 1.9 * this.fatigue;
        if (this.slowT > 0) { this.slowT -= dt; sp *= 0.35; }
        tx /= dT; tz /= dT;
        if (dRex < 11) { // el rex encima: huir en zigzag
          this.jukeT -= dt;
          if (this.jukeT <= 0) { this.jukeT = 0.5 + Math.random() * 0.6; this.jukeSign = Math.random() < 0.5 ? -1 : 1; }
          const ax = dx / dRex, az = dz / dRex, w = 1 - dRex / 11;
          tx = tx * (1 - w) + (ax + -az * this.jukeSign * 0.9) * w;
          tz = tz * (1 - w) + (az + ax * this.jukeSign * 0.9) * w;
          const n = Math.hypot(tx, tz) || 1; tx /= n; tz /= n;
        } else if (this.stateT > 2.5 && dT > 12) {
          // re-evaluar si el rex cortó el camino
          const toward = (tx * -dx + tz * -dz) / dRex;
          if (toward > 0.75) { this.pickCover(obstacles, rex, this.cover); this.stateT = 0; }
        }
        mvx = tx; mvz = tz;
        if (this.dodgeT > 0) { this.dodgeT -= dt; mvx = this.dodgeX; mvz = this.dodgeZ; sp = 15; }
        if (dT < 0.9 && dRex > 12) { this.state = 'hide'; this.stateT = 0; this.panic = 0; }
      } else if (this.state === 'hide') {
        this.fatigue = Math.max(0, this.fatigue - dt / 22);
        if (dT > 0.25) { sp = Math.min(3.4, dT * 3); mvx = tx / dT; mvz = tz / dT; }
        if (dRex < 15) this.panic += dt * (dRex < 10 ? 2.2 : 0.8);
        else this.panic = Math.max(0, this.panic - dt * 0.5);
        if (this.panic > 1.6 || dRex < 7.5) this.bolt(obstacles, rex);
      }
    }

    this.pos.x += mvx * sp * dt;
    this.pos.y += mvz * sp * dt;
    // colisiones
    for (const o of obstacles) {
      const ox = this.pos.x - o.x, oz = this.pos.y - o.z, d = Math.hypot(ox, oz), min = o.r + 0.35;
      if (d < min && d > 1e-4) { this.pos.x = o.x + (ox / d) * min; this.pos.y = o.z + (oz / d) * min; }
    }
    bound(this.pos, 1.5);
    this.speed = sp;
    if (sp > 0.3) {
      const want = Math.atan2(mvx, mvz);
      let dh = want - this.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.heading += dh * Math.min(1, dt * 10);
    } else if (this.state === 'hide') {
      const want = Math.atan2(-dx, -dz); // espía hacia el rex
      let dh = want - this.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.heading += dh * Math.min(1, dt * 3);
    }
    this.animate(dt);
  }

  animate(dt) {
    const tripped = this.state === 'trip';
    const wantCrouch = this.state === 'hide' ? 1 : 0;
    this.crouch += (wantCrouch - this.crouch) * Math.min(1, dt * 6);
    const c = this.crouch;
    this.cycle += dt * (2.5 + this.speed * 1.9);
    const sw = Math.sin(this.cycle) * Math.min(1, this.speed / 3) * (1 - c * 0.5);
    this.root.position.set(this.pos.x, 0, this.pos.y);
    this.root.rotation.y = this.heading;
    const fall = tripped ? Math.min(1, this.stateT * 5) * Math.min(1, (3 - this.stateT) * 2) : 0;
    this.body.position.y = 0.9 - c * 0.36 - fall * 0.7 + Math.abs(Math.cos(this.cycle)) * 0.05 * Math.min(1, this.speed / 3);
    this.body.rotation.x = fall * 1.45;
    this.torso.rotation.x = 0.18 * Math.min(1, this.speed / 4) + c * 0.55;
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      this.legs[i].rotation.x = -s * sw * 0.95 - c * 1.25 - fall * 0.3;
      this.knees[i].rotation.x = Math.max(0, s * sw) * 1.3 + c * 2.1 + 0.1;
      this.arms[i].rotation.x = s * sw * 1.1 - c * 0.5 - fall * 2.4;
      this.arms[i].rotation.z = -s * (0.08 + fall * 0.5);
    }
  }
}
Human._v = new THREE.Vector2();
