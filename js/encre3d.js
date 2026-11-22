// Opening scene, played by the scroll position p ∈ [0,1], forwards and backwards.
// 1. Impression: four process inks pour onto a blank press sheet and print it where they spread.
// 2. Découpe: cutting rules trace the four poses, crease rules mark the folds, the waste drops.
// 3. Pliage-collage: one pose folds, a glue bead runs along the side tab, the sleeve closes.
// 4. The box stands, closes and turns among other finished boxes.
import * as T from '../assets/vendor/three.module.min.js';
import {RGBELoader} from '../assets/vendor/RGBELoader.js';
import {makeCarton, makeStrippedSheet, imposePositions, blankOutline, stock} from './etui.js';
import {materials, zCenter} from './papier.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (a, b, x) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (a, b, u) => a + (b - a) * u;
const rand = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// The sheet floats above the studio floor so the waste can fall onto it.
const SHEET_Y = .26;
// The pose that becomes the box sits at the world origin.
const HERO = 2;
const TURN = 2.25;
// Pour timing (p), impact point on the sheet (world x, z) and ink colour.
export const pours = [
  {name: 'cyan', color: 0x0094c9, start: .055, at: [-.13, .19]},
  {name: 'magenta', color: 0xd3166f, start: .125, at: [-.38, .52]},
  {name: 'jaune', color: 0xf6c400, start: .195, at: [-.02, .54]},
  {name: 'noir', color: 0x16191a, start: .265, at: [-.33, -.06]}
];
const FALL = .045, SPREAD = .135;
// Découpe and stripping, then the folding of the hero pose.
const CUT = [.445, .505], PRESS = [.505, .53], DROP = [.53, .6], AWAY = [.565, .64], SWAP = .615;

// Printed board revealed channel by channel from each impact point. Coordinates are in
// world space; once a pour has spread it covers everything, so later motion keeps the print.
function inkedMaterial(base, reveal) {
  const m = base.clone();
  m.onBeforeCompile = shader => {
    shader.uniforms.reveal = reveal;
    shader.vertexShader = 'varying vec3 vInkW;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvInkW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = 'uniform vec4 reveal[4];\nvarying vec3 vInkW;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 substrate=vec3(0.90466,0.87962,0.79130);
      vec3 whole=texture2D(map, vMapUv).rgb;
      vec3 refl=clamp(whole/substrate,vec3(.001),vec3(1.));
      float black=1.-max(max(refl.r,refl.g),refl.b);
      vec3 cmy=1.-refl/max(.001,1.-black);
      vec4 cover;
      for(int i=0;i<4;i++){
        vec2 d=vInkW.xz-reveal[i].xy;
        float a=atan(d.y,d.x);
        float wob=.05*sin(a*5.+float(i)*2.1)+.025*sin(a*11.+float(i));
        float r=reveal[i].z*(1.+wob);
        cover[i]=1.-smoothstep(r-.018,r,length(d));
      }
      diffuseColor.rgb *= substrate*(1.-cover.rgb*cmy)*(1.-cover.a*black);`);
  };
  m.customProgramCacheKey = () => 'larre-encre-monde';
  return m;
}

// A falling column of viscous liquid: necked under the nozzle, swelling at the head.
function stream(scene, material) {
  const geo = new T.CylinderGeometry(1, 1, 1, 18, 64, false);
  const mesh = new T.Mesh(geo, material);
  mesh.castShadow = true; mesh.frustumCulled = false;
  const base = geo.attributes.position.array.slice();
  scene.add(mesh);
  return {mesh, update(top, head, x, z, thickness, phase) {
    const pos = geo.attributes.position, len = Math.max(1e-4, top - head);
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const u = by + .5;
      const neck = mix(1.35, .45, Math.pow(u, .6));
      const r = thickness * neck * (1 + .16 * Math.sin(u * 22 - phase * 9) * (1 - u));
      pos.setXYZ(i, x + bx * r + .006 * Math.sin(u * 5 + phase * 3), head + u * len, z + bz * r);
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
    mesh.visible = len > .002;
  }};
}

// A flat ribbon drawn in path order, so its draw range traces the line progressively.
function ribbon(paths, width, material, y) {
  const v = [];
  for (const path of paths) for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const len = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / len * width / 2, nz = (bx - ax) / len * width / 2;
    v.push(ax - nx, y, az - nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz,
      ax - nx, y, az - nz, bx + nx, y, bz + nz, ax + nx, y, az + nz);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(v, 3));
  const mesh = new T.Mesh(geo, material);
  mesh.frustumCulled = false; mesh.renderOrder = 2;
  const count = v.length / 3;
  return {mesh, trace(u) { geo.setDrawRange(0, Math.floor(clamp(u) * count / 6) * 6); mesh.visible = u > 0; }};
}

export async function inkScene(canvas) {
  const renderer = new T.WebGLRenderer({canvas, antialias: true, alpha: false, powerPreference: 'high-performance'});
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .82;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  // Seamless studio in the manner of a colour-chart film: the set takes the tint of each ink.
  const studio = new T.Color(0xefe8dc);
  scene.background = studio;
  scene.fog = new T.Fog(studio, 3.4, 8);
  const env = await new RGBELoader().loadAsync('assets/matieres/atelier.hdr');
  env.mapping = T.EquirectangularReflectionMapping;
  scene.environment = env; scene.environmentIntensity = .8;

  const key = new T.DirectionalLight(0xfff0dc, 3.4);
  key.position.set(-1.3, 2.8, 1.2);
  Object.assign(key.shadow.camera, {left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: .1, far: 7});
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0002; key.shadow.radius = 6;
  const rim = new T.DirectionalLight(0xffffff, .8); rim.position.set(1.4, .8, -1.6);
  scene.add(key, key.target, rim, new T.HemisphereLight(0xffffff, 0xcfc4b2, .55));
  const floorMat = new T.MeshStandardMaterial({color: studio, roughness: .92});
  const floor = new T.Mesh(new T.CircleGeometry(12, 64), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.002; floor.receiveShadow = true; scene.add(floor);

  // Printed surfaces share one inked material each, revealed by the pours.
  const reveal = {value: pours.map(p => new T.Vector4(p.at[0], p.at[1], 0, 0))};
  const lib = materials(), swapped = new Map();
  const swap = m => {
    if (m !== lib.outer && m !== lib.plainSheet) return m;
    if (!swapped.has(m)) swapped.set(m, inkedMaterial(m, reveal));
    return swapped.get(m);
  };
  const inked = root => root.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.castShadow = o.receiveShadow = true;
  });

  // The press sheet: four poses, the carrier frame and the offcuts between the flaps.
  const sheet = makeStrippedSheet(scene);
  const hp = imposePositions[HERO];
  sheet.pivot.position.set(-hp.x, SHEET_Y, -hp.z);
  inked(sheet.pivot);
  const fallers = [sheet.carrier, ...sheet.waste.children].map((mesh, i) => ({
    mesh, i, p0: mesh.position.clone(), r0: mesh.rotation.clone(), carrier: mesh === sheet.carrier
  }));
  const others = sheet.poses.map((mesh, i) => ({mesh, i, p0: mesh.position.clone()})).filter(o => o.i !== HERO);

  // Cutting and crease rules for every pose, traced on the sheet before the press closes.
  const outline = blankOutline();
  const {front, side, length} = stock, half = length / 2;
  const cutMat = new T.MeshBasicMaterial({color: 0xff6a2c, toneMapped: false, transparent: true, depthWrite: false, side: T.DoubleSide});
  const creaseMat = new T.MeshBasicMaterial({color: 0xffffff, toneMapped: false, transparent: true, depthWrite: false, side: T.DoubleSide});
  const cutPaths = [], creasePaths = [];
  for (const {x, z} of imposePositions) {
    const loop = outline.map(([u, v]) => [x + v, z + u]);
    cutPaths.push([...loop, loop[0]]);
    // Body creases run across the sheet; dashes, as a crease rule leaves no cut.
    for (const cz of [-side, 0, front, front + side].map(c => c - zCenter)) {
      for (let s = -half; s < half - .004; s += .012) creasePaths.push([[x + s, z + cz], [x + Math.min(half, s + .007), z + cz]]);
    }
  }
  // One ribbon per pose, so the four contours are cut at the same time, as by one forme.
  const cuts = cutPaths.map(path => ribbon([path], .006, cutMat, .0012));
  const creases = ribbon(creasePaths, .004, creaseMat, .0011);
  sheet.pivot.add(...cuts.map(c => c.mesh), creases.mesh);

  // The box that the hero pose becomes, and the finished boxes of the closing shot.
  const hero = makeCarton(scene);
  inked(hero.pivot);
  let glueBead = null;
  hero.pivot.traverse(o => { if (o.isMesh && o.material?.color?.getHex?.() === 0xf0e9cd) glueBead = o; });
  // The bead is laid on the glue tab while the pose is still flat, then follows the tab.
  const tabRun = length - .04, bead = new T.Mesh(new T.CapsuleGeometry(.5, 1, 6, 16), new T.MeshPhysicalMaterial({color: 0xe9a93a, roughness: .12, clearcoat: 1, clearcoatRoughness: .05}));
  bead.rotation.z = Math.PI / 2; bead.castShadow = true;
  glueBead?.parent.add(bead);
  const flock = Array.from({length: 7}, (_, i) => {
    const c = makeCarton(scene);
    c.pivot.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return {c, seed: i};
  });

  // Inks: glossy liquid, a column each, a crown of droplets and a spreading pool.
  const inks = pours.map((p, i) => {
    const material = new T.MeshPhysicalMaterial({color: p.color, roughness: .07, metalness: 0, clearcoat: 1, clearcoatRoughness: .04, sheen: .3});
    const col = stream(scene, material);
    const drops = Array.from({length: 26}, (_, k) => {
      const d = new T.Mesh(new T.SphereGeometry(1, 20, 14), material); d.castShadow = true; scene.add(d);
      return {d, a: rand(k + i * 31) * Math.PI * 2, v: .35 + rand(k * 3 + i) * .55, up: .5 + rand(k * 7 + i) * .9, s: .006 + rand(k * 5 + i) * .010};
    });
    const outlineShape = new T.Shape();
    for (let k = 0; k <= 64; k++) {
      const a = k / 64 * Math.PI * 2, r = 1 + .16 * Math.sin(3 * a + i * 2) + .09 * Math.sin(7 * a + i) + .05 * Math.sin(13 * a + i * 3);
      k ? outlineShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : outlineShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const poolGeo = new T.ExtrudeGeometry(outlineShape, {depth: 0, bevelEnabled: true, bevelThickness: .5, bevelSize: .3, bevelSegments: 6, curveSegments: 64});
    poolGeo.rotateX(-Math.PI / 2);
    const pool = new T.Mesh(poolGeo, material); pool.castShadow = true; scene.add(pool);
    return {p, col, drops, pool};
  });
  // Glue: a thin pale thread from a nozzle onto the side tab.
  const glueMat = new T.MeshPhysicalMaterial({color: 0xe9a93a, roughness: .12, clearcoat: 1, clearcoatRoughness: .05});
  const glueThread = stream(scene, glueMat);
  const nozzle = new T.Mesh(new T.ConeGeometry(.012, .05, 24), new T.MeshPhysicalMaterial({color: 0x2a3432, metalness: .85, roughness: .25}));
  nozzle.rotation.x = Math.PI; scene.add(nozzle);

  const camera = new T.PerspectiveCamera(32, 1, .01, 30);
  const sheetCentre = new T.Vector3(-hp.x, SHEET_Y, -hp.z);
  const boxCentre = new T.Vector3(0, SHEET_Y, 0);
  const tmp = new T.Vector3(), target = new T.Vector3();
  // Centre of the erected box in the pivot frame, so the camera frames the box, not its hinge.
  hero.pose({rise: Math.PI / 2, foldLeft: 1, foldBack: 1, glue: 1, open: 1, close: 1});
  hero.pivot.updateMatrixWorld(true);
  const erected = hero.pivot.worldToLocal(new T.Box3().setFromObject(hero.pivot).getCenter(new T.Vector3()));

  let width = 0, height = 0;
  function draw(progress, clock = 0) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== width || h !== height) {
      width = w; height = h;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // In landscape the captions sit on the left: shift the picture towards the right.
      if (w / h > 1.1) camera.setViewOffset(w, h, -w * .1, 0, w, h); else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    }
    const p = clamp(progress), portrait = w / h < .9;

    // 1. Pours on the sheet.
    inks.forEach(({p: pour, col, drops, pool}, i) => {
      const x = pour.at[0], z = pour.at[1], y = SHEET_Y, t0 = pour.start, hit = t0 + FALL;
      const headY = mix(1.9, y + .008, ease(t0, hit, p));
      const topY = mix(1.9, y + .006, ease(hit + .012, hit + .06, p));
      const on = p > t0 && p < hit + .07;
      col.mesh.visible = on;
      if (on) col.update(topY, headY, x, z, .026, p * 40 + i);
      const s = clamp((p - hit) / .06);
      drops.forEach(({d, a, v, up, s: size}) => {
        d.visible = s > 0 && s < 1;
        if (!d.visible) return;
        const r = v * s * .15, dy = up * .22 * (s - s * s * 1.15);
        d.position.set(x + Math.cos(a) * r, Math.max(y + .003, y + dy), z + Math.sin(a) * r);
        const k = size * 1.6 * (1 - s * .6);
        d.scale.set(k, k * (1 + (1 - s) * 1.2), k);
      });
      const spread = ease(hit, hit + SPREAD, p), soak = ease(hit + .03, hit + .11, p);
      // The front sweeps the whole sheet, then keeps going so the print stays complete.
      reveal.value[i].z = spread * 1.5 + ease(hit + SPREAD, 1, p) * 3;
      pool.visible = spread > 0 && soak < 1;
      pool.position.set(x, y + .001, z);
      const size = (.02 + spread * .07) * (1 - soak * .35); pool.scale.set(size, .02 * (1 - soak), size);
    });

    // 2. Découpe: rules trace, the press closes, the waste and the other poses leave.
    const trace = ease(CUT[0], CUT[1], p), press = Math.sin(Math.PI * clamp((p - PRESS[0]) / (PRESS[1] - PRESS[0])));
    cuts.forEach(c => c.trace(trace)); creases.trace(ease(CUT[0] + .02, CUT[1] + .01, p));
    const fadeRules = 1 - ease(DROP[0] + .02, AWAY[1], p);
    cutMat.opacity = fadeRules; creaseMat.opacity = .85 * fadeRules;
    cutMat.color.setHex(0xff6a2c).lerp(new T.Color(0xffffff), press * .8);
    sheet.pivot.position.y = SHEET_Y - press * .006;
    for (const f of fallers) {
      const delay = f.carrier ? .012 : (f.i % 4) * .006;
      const u = ease(DROP[0] + delay, DROP[1] + delay, p), g = u * u;
      const out = f.carrier ? 0 : 1;
      const dir = tmp.set(f.p0.x, 0, f.p0.z).normalize();
      f.mesh.position.set(f.p0.x + dir.x * .12 * u * out, f.p0.y - (SHEET_Y - .0006 * (1 + f.i % 3)) * g, f.p0.z + dir.z * .12 * u * out);
      const tumble = Math.sin(Math.PI * u) * (f.carrier ? .05 : .5);
      f.mesh.rotation.set(f.r0.x + tumble * (f.i % 2 ? 1 : -1), f.r0.y + u * (f.i % 3 - 1) * .4, f.r0.z + tumble * .6);
    }
    for (const o of others) {
      const u = ease(AWAY[0] + o.i * .006, AWAY[1], p);
      const dx = o.p0.x - hp.x, dz = o.p0.z - hp.z, n = Math.hypot(dx, dz) || 1;
      o.mesh.position.set(o.p0.x + dx / n * 1.6 * u, o.p0.y + .25 * Math.sin(Math.PI * u * .5), o.p0.z + dz / n * 1.6 * u);
      o.mesh.rotation.set(0, u * (o.i % 2 ? .7 : -.7), 0);
      o.mesh.visible = u < .999;
    }
    const heroIsBox = p >= SWAP;
    sheet.poses[HERO].visible = !heroIsBox;

    // 3. Pliage-collage, then 4. erect, close and turn.
    const glue = ease(.625, .675, p), fold = ease(.68, .73, p), back = ease(.725, .775, p);
    const stand = ease(.78, .85, p), open = ease(.80, .87, p);
    const shutB = ease(.85, .9, p), shutT = ease(.88, .94, p);
    const spin = ease(.78, 1, p) * Math.PI * 1.6 + Math.sin(clock * .5) * .03;
    const lift = ease(.78, .87, p) * .1;
    // Turn the flat pose so the glue tab and the folds face the camera.
    const turn = TURN * ease(.6, .64, p) * (1 - ease(.76, .84, p));
    hero.pivot.visible = heroIsBox;
    hero.pose({x: 0, y: SHEET_Y + lift, z: 0, rise: stand * Math.PI / 2, yaw: spin + turn,
      foldLeft: fold, foldBack: back, glue: 0, open, closeBottom: shutB, closeTop: shutT});
    // The glue thread follows the head of the bead along the tab.
    const run = tabRun * glue, x0 = -tabRun / 2;
    // The tab is folded onto its joint: the bead is then held inside, out of sight.
    bead.visible = heroIsBox && glue > .002 && fold < .9;
    bead.position.set(x0 + run / 2, -stock.thickness - .0022, -stock.tab * .5);
    bead.scale.set(.007, Math.max(.0001, run / 2), .007);
    const gluing = bead.visible && glue < .995;
    glueThread.mesh.visible = nozzle.visible = false;
    if (gluing) {
      hero.pivot.updateMatrixWorld(true);
      const head = bead.parent.localToWorld(tmp.set(x0 + run, -stock.thickness - .0014, -stock.tab * .5));
      glueThread.update(head.y + .22, head.y + .001, head.x, head.z, .0032, p * 60);
      nozzle.position.set(head.x, head.y + .245, head.z); nozzle.visible = true;
    }

    flock.forEach(({c, seed}) => {
      const k = ease(.9 + seed * .01, 1, p);
      c.pivot.visible = k > 0;
      if (!k) return;
      const a = seed / 7 * Math.PI * 2 + p * 1.5, r = mix(1.8, .36 + rand(seed) * .22, k);
      c.pose({x: Math.cos(a) * r, y: SHEET_Y - .12 + rand(seed + 3) * .34 + Math.sin(clock * .7 + seed) * .02, z: Math.sin(a) * r - .1,
        rise: Math.PI / 2, yaw: a * 1.3 + p * 3, foldLeft: 1, foldBack: 1, glue: 1, open: 1, close: 1});
      c.pivot.scale.setScalar(.5 + rand(seed + 9) * .15);
    });

    // Studio tint: bare paper, the four inks, a cool grey for the cut, warm paper for the glue.
    const tints = [0xddd3c2, 0xbfdde8, 0xedc6d6, 0xf2dc9c, 0xd2cec6, 0xc9d0cf, 0xe6dccb, 0xe4dccd];
    const stops = [0, ...pours.map(q => q.start + FALL), CUT[0], .6, .9];
    let k = 0; while (k < stops.length - 2 && p >= stops[k + 1]) k++;
    studio.set(tints[k]).lerp(new T.Color(tints[k + 1]), ease(stops[k + 1] - .04, stops[k + 1] + .03, p));
    floorMat.color.copy(studio); scene.fog.color.copy(studio);

    // Camera: the whole sheet for the print and the cut, then in on the pose, then an orbit.
    const onBox = ease(.56, .66, p);
    target.lerpVectors(sheetCentre, boxCentre, onBox);
    hero.pivot.updateMatrixWorld(true);
    target.lerp(hero.pivot.localToWorld(tmp.copy(erected)), ease(.76, .86, p));
    // Close in on the glue tab while the bead is laid.
    const close = ease(.6, .63, p) * (1 - ease(.675, .705, p));
    if (close > 0 && glueBead) target.lerp(glueBead.parent.localToWorld(tmp.set(0, 0, -stock.tab * .5)), close * .6);
    const orbit = mix(-.35, .2, ease(0, .5, p)) + ease(.6, 1, p) * .7;
    const dist = (mix(1.75, 1.5, ease(.04, .3, p)) * (1 - onBox) + mix(.98, 1.05, ease(.77, .9, p)) * onBox + ease(.9, 1, p) * .3) * (1 - .2 * close) * (portrait ? 1.55 : 1);
    const elev = mix(1.05, .62, ease(.02, .3, p)) * (1 - onBox) + mix(.8, .32, ease(.74, .9, p)) * onBox;
    camera.position.set(target.x + Math.sin(orbit) * dist * Math.cos(elev), target.y + Math.sin(elev) * dist, target.z + Math.cos(orbit) * dist * Math.cos(elev));
    camera.lookAt(target);
    key.target.position.copy(target);
    renderer.render(scene, camera);
  }
  draw(0);
  return {draw, renderer, scene, camera};
}
