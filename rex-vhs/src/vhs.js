// Post-proceso "cinta VHS": se renderiza a baja resolución (480 líneas) y se
// pasa por un shader con sangrado de croma, jitter de línea, banda de tracking,
// ruido, dropouts, scanlines y viñeta.
import * as THREE from 'three';

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform float time, glitch, exposure, flash;
uniform vec2 res;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 tone(vec3 c){
  c *= exposure;
  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14); // ACES aprox.
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
vec3 samp(vec2 uv){ return tone(texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb); }
vec3 rgb2yiq(vec3 c){ return vec3(dot(c, vec3(.299,.587,.114)), dot(c, vec3(.596,-.274,-.322)), dot(c, vec3(.211,-.523,.312))); }
vec3 yiq2rgb(vec3 c){ return vec3(c.x + .956*c.y + .621*c.z, c.x - .272*c.y - .647*c.z, c.x - 1.106*c.y + 1.703*c.z); }

void main(){
  vec2 uv = vUv;
  float line = floor(uv.y * res.y);
  float fr = floor(time * 30.0);
  // jitter horizontal por línea + ondulación lenta de la cinta
  uv.x += (hash(vec2(line, fr)) - 0.5) * (0.0016 + glitch * 0.03);
  uv.x += sin(uv.y * 7.0 + time * 1.7) * 0.0009;
  // banda de tracking que sube
  float bandY = fract(time * 0.055 + 0.2);
  float bd = uv.y - bandY;
  float band = exp(-bd * bd * 1400.0);
  uv.x += band * (0.012 + glitch * 0.06) * sin(time * 50.0 + uv.y * 320.0);
  // conmutación de cabezales (borde inferior)
  float hs = smoothstep(0.03, 0.0, uv.y);
  uv.x += hs * (0.04 + 0.02 * sin(time * 11.0));
  // salto vertical ocasional con glitch
  uv.y = fract(uv.y + glitch * 0.08 * step(0.5, hash(vec2(fr, 3.0))));

  float px = 1.0 / res.x;
  // luma: poco ancho de banda -> ligero desenfoque horizontal
  vec3 c0 = rgb2yiq(samp(uv));
  float y = c0.x * 0.5 + rgb2yiq(samp(uv + vec2(px, 0.0))).x * 0.25 + rgb2yiq(samp(uv - vec2(px, 0.0))).x * 0.25;
  // croma: mucho menos ancho de banda y corrida hacia la derecha
  vec2 iq = c0.yz;
  for (int i = 1; i <= 4; i++) {
    iq += rgb2yiq(samp(uv - vec2(float(i) * 2.2 * px, 0.0))).yz;
  }
  iq = iq / 5.0 * 1.25;
  iq += (hash(vec2(line, fr + 9.0)) - 0.5) * 0.02; // ruido de croma por línea
  vec3 col = yiq2rgb(vec3(y, iq));

  // nieve
  float n = hash(uv * res + fr * 7.31) - 0.5;
  col += n * (0.085 + band * 0.35 + glitch * 0.4 + hs * 0.6);
  // dropouts: rayitas blancas
  float dl = hash(vec2(line * 0.37, fr));
  if (dl > 0.9982 - glitch * 0.06) {
    float sx = hash(vec2(line * 1.7, fr + 1.0));
    col += smoothstep(sx, sx + 0.01, vUv.x) * smoothstep(sx + 0.22, sx + 0.04, vUv.x) * 0.55;
  }
  // scanlines + viñeta + negros lavados y tinte frío
  col *= 0.9 + 0.1 * sin(vUv.y * res.y * 6.2832);
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.85;
  col = col * 0.9 + vec3(0.04, 0.045, 0.06);
  col += flash;
  gl_FragColor = vec4(col, 1.0);
}`;

export class VHS {
  constructor(renderer, w = 640, h = 480) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true,
    });
    this.uniforms = {
      tDiffuse: { value: this.target.texture }, time: { value: 0 }, glitch: { value: 0 },
      exposure: { value: 1.0 }, flash: { value: 0 }, res: { value: new THREE.Vector2(w, h) },
    };
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, fragmentShader: FRAG, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  }

  render(scene, camera, time) {
    const r = this.renderer;
    this.uniforms.time.value = time;
    r.setRenderTarget(this.target);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
