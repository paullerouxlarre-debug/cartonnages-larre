// Outer dressing of the three machines, after the industrial references (sheetfed offset presses,
// Autoplaten die-cutters, straight-line folder-gluers): rounded unit hoods, guards with windows,
// signal columns, consoles and the piles at the delivery. Only shapes and colours are borrowed:
// no brand, logo or lettering. Parts that would hide the mechanism in close-ups go on `cover`,
// which the film removes for its sectional shots.
import * as T from '../assets/vendor/three.module.min.js';
import {offsetLayout} from './impression.js';
import {paint as p, box, cylinder, group, mesh, cabinet, panel, bolt} from './machines-pieces.js';

const glass = new T.MeshStandardMaterial({color:0xcfe0e4, roughness:.06, metalness:.1, transparent:true, opacity:.2, depthWrite:false});
const lamp = c => new T.MeshStandardMaterial({color:c, emissive:c, emissiveIntensity:1.6, roughness:.4});
const lamps = {green:lamp(0x3fd16b), amber:lamp(0xf2a531), off:new T.MeshStandardMaterial({color:0x6f3a34, roughness:.4})};
const white = new T.MeshStandardMaterial({color:0xecebe6, roughness:.36, metalness:.08});
const anthracite = new T.MeshStandardMaterial({color:0x2b2f31, roughness:.5, metalness:.25});

// A signal column: green while the machine runs, the amber and red stages dark.
function signal(root, x, y, z) {
  cylinder(root, x, y + .09, z, .012, .18, p.steel, 'y');
  for (const [i, m] of [lamps.off, lamps.amber, lamps.green].entries())
    cylinder(root, x, y + .2 + i * .052, z, .028, .046, i === 2 ? m : i === 1 ? p.amber : m, 'y');
  cylinder(root, x, y + .36, z, .03, .012, anthracite, 'y');
}

// A swivelling touch screen on an arm, with a lit interface.
let screenMat;
function screen() {
  if (screenMat) return screenMat;
  const c = document.createElement('canvas'); c.width = 320; c.height = 200;
  const x = c.getContext('2d');
  x.fillStyle = '#0f1a1e'; x.fillRect(0, 0, 320, 200);
  x.fillStyle = '#1d3a44'; x.fillRect(0, 0, 320, 26);
  x.fillStyle = '#8fd0c0'; x.fillRect(10, 9, 60, 8);
  for (let i = 0; i < 7; i++) { x.fillStyle = ['#c2512c', '#1b1d1e', '#1aa0d6', '#e0267b', '#f3c614', '#295c4c', '#d9d4c8'][i]; x.fillRect(14 + i * 42, 150 - (40 + (i * 23) % 60), 28, 40 + (i * 23) % 60); }
  x.strokeStyle = '#8fd0c0'; x.lineWidth = 2; x.beginPath();
  for (let i = 0; i <= 30; i++) x.lineTo(14 + i * 10, 60 + Math.sin(i * .7) * 10); x.stroke();
  x.fillStyle = '#3fd16b'; x.fillRect(270, 170, 36, 16);
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
  screenMat = new T.MeshStandardMaterial({map, emissive:0xffffff, emissiveMap:map, emissiveIntensity:.85, roughness:.2});
  return screenMat;
}
function console_(root, x, y, z, ry = 0) {
  const g = group(root, x, y, z); g.rotation.y = ry;
  cylinder(g, 0, -.18, 0, .018, .36, p.steel, 'y');
  cabinet(g, 0, .02, 0, .42, .28, .05, anthracite, .01);
  mesh(g, new T.PlaneGeometry(.38, .24), screen(), 0, .02, .026);
}

// Hinged guard with a large window: frame, glass and two handles.
function guard(root, x, y, z, w, h, side = 1) {
  const g = group(root, x, y, z);
  for (const [dx, dy, gw, gh] of [[0, h / 2 - .02, w, .04], [0, -h / 2 + .02, w, .04], [-w / 2 + .02, 0, .04, h], [w / 2 - .02, 0, .04, h]])
    box(g, dx, dy, 0, gw, gh, .025, white);
  mesh(g, new T.PlaneGeometry(w - .06, h - .06), glass, 0, 0, .002 * side);
  for (const dx of [-w * .3, w * .3]) box(g, dx, -h / 2 + .1, side * .03, .12, .018, .02, p.aluminum);
}

function press(fixed, cover) {
  const xs = offsetLayout.unitCenters, last = xs[xs.length - 1];
  // Rounded hood on each unit, and the dark gap between two units.
  const hood = new T.CylinderGeometry(.45, .45, 1.24, 28, 1, false, -Math.PI / 2, Math.PI);
  for (const x of xs) {
    const h = mesh(cover, hood, white, x, 2.18, 0);
    h.rotation.x = Math.PI / 2; h.scale.set(1, 1, .32);
    box(cover, x + .5, 1.3, .62, .07, 1.7, .03, anthracite);
  }
  // Long delivery hood with a window over the pile, and the dryer glow inside it.
  const L = 2.91 + last - 1.35;
  cabinet(cover, L - .1, 2.12, 0, 1.6, .22, 1.3, white, .03);
  guard(cover, L + .1, 1.55, .66, .9, .62);
  signal(fixed, L + .55, 2.23, .5);
  // Operator console beside the delivery: desk, lit colour bars and a large screen.
  const desk = group(fixed, L + 1.55, 0, 1.25); desk.rotation.y = -.5;
  cabinet(desk, 0, .45, 0, 1.2, .9, .7, white, .02);
  box(desk, 0, .91, .05, 1.22, .04, .74, anthracite);
  console_(desk, 0, 1.3, -.2);
}

function diecutter(fixed, cover) {
  // Stripping and blanking sections closed by windowed guards; dark base under them.
  cabinet(cover, 1.15, .45, 0, 2.3, .7, 1.26, anthracite, .02);
  for (const side of [-1, 1]) {
    guard(cover, .62, 1.38, side * .66, .95, .95, side);
    guard(cover, 1.66, 1.38, side * .66, .95, .95, side);
    box(cover, 1.15, 1.92, side * .63, 2.3, .14, .06, white);
  }
  cabinet(cover, 1.15, 2.02, 0, 2.3, .1, 1.3, white, .02);
  signal(fixed, -.55, 2.17, -.5);
  console_(fixed, -1.25, 1.55, .9, .4);
}

function gluer(fixed, cover) {
  // Clear hinged covers over the folding and delivery belts.
  for (let x = -1.7; x < 2.6; x += .62) {
    const g = group(cover, x, 1.36, 0);
    for (const z of [-.2, .2]) box(g, 0, 0, z, .58, .02, .02, white);
    mesh(g, new T.BoxGeometry(.56, .005, .42), glass, 0, .02, 0);
    box(g, 0, -.07, .21, .58, .14, .01, glass);
  }
  signal(fixed, -2.0, 1.25, -.42);
  console_(fixed, 2.7, 1.3, .7, -.5);
  // The box stream leaves into a collecting table.
  cabinet(fixed, 3.35, .85, 0, .8, .06, .5, p.aluminum, .01);
  for (const dx of [-.35, .35]) for (const dz of [-.2, .2]) cylinder(fixed, 3.35 + dx, .42, dz, .02, .82, p.steel, 'y');
}

export function dress(kind, fixed, cover) {
  ({offset:press, decoupe:diecutter, collage:gluer})[kind]?.(fixed, cover);
}
