// Opening scene: four process inks pour onto a blank carton, print it where they land,
// then the blank folds into the finished Larré box. Everything is a function of p ∈ [0,1]
// (the scroll position through the opening), so the scene plays forwards and backwards.
import * as T from '../assets/vendor/three.module.min.js';
import {RGBELoader} from '../assets/vendor/RGBELoader.js';
import {makeCarton} from './etui.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (a, b, u) => a + (b - a) * u;
const rand = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// Pour timing (p), impact point in print UV, ink colour and the channel it reveals.
export const pours = [
  {name: 'cyan', color: 0x0094c9, start: .07, uv: [.30, .62], channel: 0},
  {name: 'magenta', color: 0xd3166f, start: .17, uv: [.62, .40], channel: 1},
  {name: 'jaune', color: 0xf6c400, start: .27, uv: [.45, .30], channel: 2},
  {name: 'noir', color: 0x16191a, start: .37, uv: [.55, .66], channel: 3}
];
const FALL = .055, SPREAD = .16;

// The carton's printed material, with each process colour revealed from its own impact point.
function inkedMaterial(base, reveal) {
  const m = base.clone();
  m.onBeforeCompile = shader => {
    shader.uniforms.reveal = reveal;
    shader.fragmentShader = 'uniform vec4 reveal[4];\n' + shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 substrate=vec3(0.90466,0.87962,0.79130);
      vec3 whole=texture2D(map, vMapUv).rgb;
      vec3 refl=clamp(whole/substrate,vec3(.001),vec3(1.));
      float black=1.-max(max(refl.r,refl.g),refl.b);
      vec3 cmy=1.-refl/max(.001,1.-black);
      vec4 cover;
      for(int i=0;i<4;i++){
        vec2 d=(vMapUv-reveal[i].xy)*vec2(1.,1.25);
        float wob=.035*sin(atan(d.y,d.x)*7.+float(i)*2.1)+.02*sin(atan(d.y,d.x)*13.+float(i));
        float r=reveal[i].z*(1.+wob);
        cover[i]=1.-smoothstep(r-.035,r,length(d));
      }
      diffuseColor.rgb *= substrate*(1.-cover.rgb*cmy)*(1.-cover.a*black);`);
  };
  m.customProgramCacheKey = () => 'larre-encre-reveal';
  return m;
}

// A falling column of viscous ink: necked under the nozzle, swelling at the head.
function stream(scene, material) {
  const radial = 18, rows = 64;
  const geo = new T.CylinderGeometry(1, 1, 1, radial, rows, false);
  const mesh = new T.Mesh(geo, material);
  mesh.castShadow = true; mesh.frustumCulled = false;
  const base = geo.attributes.position.array.slice();
  scene.add(mesh);
  return {mesh, update(top, head, x, z, thickness, phase) {
    const pos = geo.attributes.position, len = Math.max(1e-4, top - head);
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const u = by + .5;                         // 0 at the head, 1 at the top
      const y = head + u * len;
      const neck = mix(1.35, .45, Math.pow(u, .6));
      const pulse = 1 + .16 * Math.sin(u * 22 - phase * 9) * (1 - u);
      const r = thickness * neck * pulse;
      const sway = .006 * Math.sin(u * 5 + phase * 3);
      pos.setXYZ(i, x + bx * r + sway, y, z + bz * r);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
    mesh.visible = len > .002;
  }};
}

export async function inkScene(canvas) {
  const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .82;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  // Seamless studio in the manner of a colour-chart film: the whole set takes the tint of
  // the ink being poured, from bare paper to cyan, magenta, yellow, then a deep green.
  const studio = new T.Color(0xefe8dc);
  scene.background = studio;
  scene.fog = new T.Fog(studio, 3.2, 7);
  const env = await new RGBELoader().loadAsync('assets/matieres/atelier.hdr');
  env.mapping = T.EquirectangularReflectionMapping;
  scene.environment = env; scene.environmentIntensity = .8;

  const key = new T.DirectionalLight(0xfff0dc, 3.4);
  key.position.set(-1.2, 2.4, 1.1);
  Object.assign(key.shadow.camera, {left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: .1, far: 6}); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0002;
  const rim = new T.DirectionalLight(0xffffff, .8); rim.position.set(1.4, .8, -1.6);
  scene.add(key, key.target, rim, new T.HemisphereLight(0xffffff, 0xcfc4b2, .55));
  // A soft studio floor that disappears in the fog.
  const floorMat = new T.MeshStandardMaterial({color: studio, roughness: .92});
  const floor = new T.Mesh(new T.CircleGeometry(9, 64), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; floor.receiveShadow = true; scene.add(floor);

  // The hero carton, printed by the pours.
  const reveal = {value: pours.map(p => new T.Vector4(p.uv[0], p.uv[1], 0, 0))};
  const hero = makeCarton(scene);
  const swapped = new Map();
  const swap = m => {
    if (!m?.map) return m;
    if (!swapped.has(m)) swapped.set(m, inkedMaterial(m, reveal));
    return swapped.get(m);
  };
  hero.pivot.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.castShadow = o.receiveShadow = true;
  });
  // Floating finished boxes for the closing shot.
  const flock = Array.from({length: 7}, (_, i) => {
    const c = makeCarton(scene);
    c.pivot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return {c, seed: i};
  });

  // Inks: glossy liquid, a column each, a crown of droplets and a spreading pool.
  const inks = pours.map((p, i) => {
    const material = new T.MeshPhysicalMaterial({color: p.color, roughness: .07, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, sheen: .3});
    const col = stream(scene, material);
    const drops = Array.from({length: 22}, (_, k) => {
      const d = new T.Mesh(new T.SphereGeometry(1, 20, 14), material); d.castShadow = true; scene.add(d);
      return {d, a: rand(k + i * 31) * Math.PI * 2, v: .35 + rand(k * 3 + i) * .55, up: .5 + rand(k * 7 + i) * .9, s: .004 + rand(k * 5 + i) * .007};
    });
    // A puddle with an irregular, bulging rim, as viscous ink makes on board.
    const outline = new T.Shape();
    for (let k = 0; k <= 64; k++) {
      const a = k / 64 * Math.PI * 2, r = 1 + .16 * Math.sin(3 * a + i * 2) + .09 * Math.sin(7 * a + i) + .05 * Math.sin(13 * a + i * 3);
      k ? outline.lineTo(Math.cos(a) * r, Math.sin(a) * r) : outline.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const poolGeo = new T.ExtrudeGeometry(outline, {depth: 0, bevelEnabled: true, bevelThickness: .5, bevelSize: .3, bevelSegments: 6, curveSegments: 64});
    poolGeo.rotateX(-Math.PI / 2);
    const pool = new T.Mesh(poolGeo, material); pool.castShadow = true; scene.add(pool);
    return {p, col, drops, pool};
  });

  const camera = new T.PerspectiveCamera(32, 1, .01, 20);
  const world = new T.Vector3(), probe = new T.Object3D(); hero.pivot.add(probe);
  // UV of the flat print → position on the flat blank, measured once on the real model.
  hero.pose({});
  hero.pivot.updateMatrixWorld(true);
  const box3 = new T.Box3();
  hero.pivot.traverse(o => {
    if (o.isMesh && o.visible && [].concat(o.material).some(m => m?.map)) box3.expandByObject(o);
  });
  const flat = {x0: box3.min.x, x1: box3.max.x, z0: box3.min.z, z1: box3.max.z, y: box3.max.y};
  const centre = box3.getCenter(new T.Vector3());

  function impact(p) {
    return new T.Vector3(mix(flat.x0, flat.x1, p.uv[0]), flat.y + .001, mix(flat.z1, flat.z0, p.uv[1]));
  }

  let width = 0, height = 0;
  function draw(progress, clock = 0) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== width || h !== height) {
      width = w; height = h;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    const p = clamp(progress), portrait = w / h < .9;
    // 1. Pours. 2. Fold (.50–.70). 3. Stand and close (.70–.86). 4. Spin among floating boxes.
    const fold = ease(.50, .62, p), glue = ease(.56, .64, p), stand = ease(.64, .76, p), open = ease(.68, .80, p);
    const shutB = ease(.76, .83, p), shutT = ease(.80, .88, p);
    const spin = ease(.70, 1, p) * Math.PI * 1.6 + Math.sin(clock * .5) * .03;
    const lift = ease(.62, .78, p) * .12;
    hero.pose({x: 0, y: lift, z: 0, roll: 0, rise: stand * Math.PI / 2, yaw: spin,
      foldLeft: fold, foldBack: ease(.54, .66, p), glue, open, closeBottom: shutB, closeTop: shutT});

    inks.forEach(({p: pour, col, drops, pool}, i) => {
      const at = impact(pour), t0 = pour.start, hit = t0 + FALL;
      const headY = mix(.75, at.y + .006, ease(t0, hit, p));
      const topY = mix(.75, at.y + .004, ease(hit + .015, hit + .07, p));
      const visible = p > t0 && p < hit + .08;
      col.mesh.visible = visible;
      if (visible) col.update(topY, headY, at.x, at.z, .016, p * 40 + i);
      // Crown splash: droplets thrown up and out, then falling back on the sheet.
      const s = clamp((p - hit) / .07);
      drops.forEach(({d, a, v, up, s: size}) => {
        d.visible = s > 0 && s < 1;
        if (!d.visible) return;
        const r = v * s * .11, y = at.y + up * .12 * (s - s * s * 1.15);
        d.position.set(at.x + Math.cos(a) * r, Math.max(at.y + .002, y), at.z + Math.sin(a) * r);
        d.scale.set(size * 1.6 * (1 - s * .6), size * 1.6 * (1 - s * .6) * (1 + (1 - s) * 1.2), size * 1.6 * (1 - s * .6));
      });
      // The pool spreads, then soaks into the board as the print appears.
      const spread = ease(hit, hit + SPREAD, p), soak = ease(hit + .035, hit + .13, p);
      reveal.value[i].z = spread * .75;
      pool.visible = spread > 0 && soak < 1 && fold < .02;
      pool.position.copy(at); const size = (.012 + spread * .042) * (1 - soak * .35); pool.scale.set(size, .014 * (1 - soak), size);
    });

    flock.forEach(({c, seed}) => {
      const k = ease(.82 + seed * .012, .97, p);
      c.pivot.visible = k > 0;
      if (!k) return;
      const a = seed / 7 * Math.PI * 2 + p * 1.5, r = mix(1.6, .34 + rand(seed) * .2, k);
      c.pose({x: centre.x + Math.cos(a) * r, y: .08 + rand(seed + 3) * .32 + Math.sin(clock * .7 + seed) * .02, z: centre.z + Math.sin(a) * r - .1,
        rise: Math.PI / 2, yaw: a * 1.3 + p * 3, foldLeft: 1, foldBack: 1, glue: 1, open: 1, close: 1});
      c.pivot.scale.setScalar(.5 + rand(seed + 9) * .15);
    });

    // Studio tint follows the inks, as the set does in a colour-chart film.
    const tints = [0xddd3c2, 0xbfdde8, 0xedc6d6, 0xf2dc9c, 0xd9d4ca, 0xe4dccd];
    const stops = [0, pours[0].start + FALL, pours[1].start + FALL, pours[2].start + FALL, pours[3].start + FALL, .86];
    let k = 0; while (k < stops.length - 2 && p >= stops[k + 1]) k++;
    const blend = ease(stops[k + 1] - .04, stops[k + 1] + .03, p);
    studio.set(tints[k]).lerp(new T.Color(tints[k + 1]), blend);
    floorMat.color.copy(studio); scene.fog.color.copy(studio);
    // Camera: overhead on the blank, low during the pours, orbit as the box stands.
    const orbit = mix(-.45, .75, ease(.0, 1, p));
    const dist = (mix(.62, .5, ease(.05, .3, p)) + ease(.55, .8, p) * .22 + ease(.84, .98, p) * .35) * (portrait ? 1.6 : 1);
    const camY = mix(.62, .3, ease(.02, .25, p)) + ease(.6, .8, p) * .05;
    const target = new T.Vector3(centre.x, mix(.0, .13, ease(.62, .8, p)), centre.z);
    camera.position.set(target.x + Math.sin(orbit) * dist, camY, target.z + Math.cos(orbit) * dist);
    camera.lookAt(target);
    key.target.position.copy(target);
    renderer.render(scene, camera);
  }
  draw(0);
  return {draw, renderer, scene, camera};
}
