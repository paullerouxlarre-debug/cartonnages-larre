import * as T from '../assets/vendor/three.module.min.js';
import {box, cylinder, group, mesh, bar} from './matiere.js';

export {box, cylinder, group, mesh, bar};
export const paperLine = 1.16;

function grain(strength, brushed = false) {
  const size = 128;
  const bytes = new Uint8Array(size * size * 4);
  let seed = 2367;
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (let y = 0; y < size; y++) {
    const line = brushed ? (random() - .5) * strength : 0;
    for (let x = 0; x < size; x++) {
      const color = Math.min(255, Math.max(0, Math.round(225 + line + (random() - .5) * strength)));
      const i = (y * size + x) * 4;
      bytes[i] = bytes[i + 1] = bytes[i + 2] = color;
      bytes[i + 3] = 255;
    }
  }
  const map = new T.DataTexture(bytes, size, size, T.RGBAFormat);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.repeat.set(brushed ? 2 : 6, brushed ? 4 : 6);
  map.minFilter = T.LinearMipmapLinearFilter;
  map.magFilter = T.LinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

const stipple = grain(43);
const brush = grain(58, true);
function surface(color, metalness = .12, roughness = .46, roughnessMap = stipple) {
  return new T.MeshStandardMaterial({color, metalness, roughness, roughnessMap});
}
export const paint = {
  pearl: surface(0xe1e1dc, .22, .38),
  gray: surface(0xb1b8b9, .24, .43),
  blueGray: surface(0x8f989e, .22, .45),
  graphite: surface(0x323638, .31, .48),
  cast: surface(0x53595a, .47, .55),
  seam: surface(0x191d1f, .05, .66),
  rubber: surface(0x292b2a, .02, .77),
  pressBlanket: surface(0x384345, .03, .59),
  belt: surface(0x477f57, .015, .72),
  beltEdge: surface(0x88a27e, .03, .64),
  steel: surface(0xc3c7c6, .84, .25, brush),
  aluminum: surface(0xa0a6a7, .73, .42, brush),
  hardened: surface(0x777977, .80, .34, brush),
  brass: surface(0xb79960, .65, .39, brush),
  ply: surface(0xc5a37a, .01, .70),
  pad: surface(0x95665f, .01, .81),
  red: surface(0xa73224), yellow: surface(0xd6b84d), green: surface(0x347953),
  amber: surface(0xb88034), cable: surface(0x242727, .04, .52)
};

// The cutting form is laminated birch. Use a single shaded surface for the exposed
// veneers, including their thin glue lines, so nothing shimmers in the macro shot.
paint.ply.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 plyPoint; varying vec3 plyNormal;\n'+shader.vertexShader
    .replace('#include <begin_vertex>','#include <begin_vertex>\nplyPoint=position+.5; plyNormal=normal;');
  shader.fragmentShader=`varying vec3 plyPoint; varying vec3 plyNormal;
    float timberNoise(vec2 v){
      vec2 i=floor(v),f=fract(v);f=f*f*(3.-2.*f);
      vec4 n=fract(sin(vec4(dot(i,vec2(12.9,78.2)),dot(i+vec2(1,0),vec2(12.9,78.2)),dot(i+vec2(0,1),vec2(12.9,78.2)),dot(i+vec2(1,1),vec2(12.9,78.2))))*43758.55);
      return mix(mix(n.x,n.y,f.x),mix(n.z,n.w,f.x),f.y);
    }
    `+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float faceGrain=timberNoise(plyPoint.xz*vec2(3.,67.))*.08+timberNoise(plyPoint.xz*vec2(6.,290.))*.05;
      float axis=abs(plyNormal.z)>.5?plyPoint.x:plyPoint.z;
      float lamin=plyPoint.y*12.+.043*sin(axis*18.)+.015*sin(axis*59.);
      float layer=fract(lamin);
      float darkSeam=1.-smoothstep(.025,.12,min(layer,1.-layer));
      float sideGrain=.91+.10*mod(floor(lamin),2.)-.16*darkSeam+.075*timberNoise(vec2(axis*25.,plyPoint.y*130.));
      diffuseColor.rgb*=mix(sideGrain,.94+faceGrain,abs(plyNormal.y));`);
};

const profiles = new Map();
// Folded metal skins use millimetre edge radii. UVs remain stable as the camera approaches.
export function panel(root, x,y,z, outline, depth, material, radius = .005) {
  const key = JSON.stringify([outline, depth, radius]);
  let geometry = profiles.get(key);
  if (!geometry) {
    const shape = new T.Shape(outline.map(([u,v]) => new T.Vector2(u,v)));
    geometry = new T.ExtrudeGeometry(shape, {depth, bevelEnabled:radius > 0, bevelSize:radius,
      bevelThickness:radius, bevelSegments:2, curveSegments:2});
    geometry.translate(0,0,-depth/2);
    profiles.set(key,geometry);
  }
  return mesh(root,geometry,material,x,y,z);
}

export function cabinet(root,x,y,z,width,height,depth,material,radius=.008) {
  const a=width / 2, b=height / 2;
  return panel(root,x,y,z,[[-a,-b],[a,-b],[a,b],[-a,b]],depth,material,radius);
}

const boltGeometry = new T.CylinderGeometry(1,1,1,6);
const socketGeometry = new T.CylinderGeometry(1,1,1,6);
// Socket centres sit inside the bright head outline seen on the operator side.
export function bolt(root,x,y,z,r=.009) {
  const head = mesh(root,boltGeometry,paint.steel,x,y,z);
  head.scale.set(r,.54*r,r);
  head.rotation.x = Math.PI/2;
  const socket = mesh(root,socketGeometry,paint.seam,x,y,z+.29*r);
  socket.scale.set(r*.37,.09*r,r*.37);
  socket.rotation.x = Math.PI/2;
}

export function hose(root,coords,radius,material=paint.cable,segments=18) {
  const curve = new T.CatmullRomCurve3(coords.map(coord=>new T.Vector3(...coord)));
  return mesh(root,new T.TubeGeometry(curve,segments,radius,7,false),material);
}

export function feet(root,x1,x2,z=.62) {
  for (const x of [x1,x2]) for (const side of [-z,z]) {
    cylinder(root,x,.049,side,.063,.075,paint.rubber,'y');
    cylinder(root,x,.105,side,.028,.08,paint.steel,'y');
    box(root,x,.146,side,.155,.025,.125,paint.cast);
  }
}

export function dial(root,x,y,z) {
  cylinder(root,x,y,z,.037,.027,paint.seam);
  cylinder(root,x,y,z+.016,.025,.013,paint.graphite);
  bar(root,[x-.005,y,z+.026],[x+.062,y+.020,z+.030],.007,paint.graphite);
}

export function adjustableGuide(root,x,y,z,dir) {
  cylinder(root,x,y+.064,z,.014,.166,paint.steel,'y');
  cabinet(root,x,y+.10,z,.045,.047,.048,paint.cast,.003);
  cylinder(root,x,y+.098,z+dir*.044,.010,.110,paint.steel);
  box(root,x,y+.064,z+dir*.088,.093,.10,.014,paint.aluminum);
}

export function footboard(root,from,to,z) {
  const center=(from+to)/2;
  box(root,center,.43,z,to-from,.072,.36,paint.graphite);
  // Aluminium edging and traction ribs run along the outside of the deck.
  box(root,center,.465,z+.15,to-from,.009,.022,paint.aluminum);
  for(let x=from+.045;x<to;x+=.056) box(root,x,.468,z-.006,.007,.006,.29,paint.hardened);
  for(let x=from+.10;x<to;x+=.85) {
    cylinder(root,x,.86,z+.143,.014,.76,paint.steel,'y');
    cylinder(root,x,.493,z+.143,.028,.044,paint.cast,'y');
  }
  for(const h of [.82,1.23]) bar(root,[from,h,z+.143],[to,h,z+.143],.013,paint.steel);
}

// The front enclosure and the hidden mechanism are separate groups so a cut can reveal the nip.
export function roller(root,x,y,z,radius,width,material,moving,sign=1,channel=false) {
  const carrier=group(root,x,y,z);
  cylinder(carrier,0,0,0,radius,width,material);
  for(const side of [-1,1]) {
    cylinder(carrier,0,0,side*(width/2-.008),radius+.0011,.014,paint.hardened);
    cylinder(carrier,0,0,side*(width/2+.006),radius*.71,.012,paint.aluminum);
    cylinder(carrier,0,0,side*(width/2+.019),radius*.26,.023,paint.steel);
  }
  if(channel) {
    box(carrier,0,radius-.0007,0,.014,.004,width-.046,paint.seam);
    for(const zPin of [-.38,-.19,0,.19,.38]) {
      if(Math.abs(zPin)<width/2-.04) box(carrier,0,radius+.0013,zPin,.007,.002,.032,paint.aluminum);
    }
  }
  // The narrow line models the index mark on the end ring.
  box(carrier,0,radius*.48,width/2+.0133,.002,radius*.12,.0021,paint.cast);
  moving.push({carrier,radius,sign});
  return carrier;
}

let display, warning;
function labelTexture(kind) {
  if(kind==='display' && display) return display;
  if(kind==='warning' && warning) return warning;
  const canvas=document.createElement('canvas');
  canvas.width=256; canvas.height=kind==='display'?164:160;
  const ctx=canvas.getContext('2d');
  if(kind==='display') {
    ctx.fillStyle='#243e48';ctx.fillRect(0,0,256,164);
    ctx.fillStyle='#6a8992';ctx.fillRect(0,0,256,17);
    ctx.fillStyle='#b9c7c3';ctx.font='10px sans-serif';ctx.fillText('PRODUCTION',9,12);
    for(let row=0;row<3;row++) {
      const y=32+row*36;
      ctx.fillStyle='#47616b';ctx.fillRect(13,y,190,20);
      ctx.fillStyle=['#9fbca9','#9ab6bd','#afbf98'][row];ctx.fillRect(16,y+5,128-row*21,9);
      ctx.fillStyle='#819397';ctx.fillRect(213,y,27,20);
    }
    ctx.fillStyle='#86aa91';ctx.fillRect(14,145,12,6);
  } else {
    ctx.fillStyle='#ded9ca';ctx.fillRect(0,0,256,160);
    ctx.beginPath();ctx.moveTo(22,122);ctx.lineTo(75,21);ctx.lineTo(130,122);ctx.closePath();
    ctx.fillStyle='#d6b449';ctx.fill();ctx.lineWidth=5;ctx.strokeStyle='#252c2c';ctx.stroke();
    ctx.fillStyle='#222726';ctx.fillRect(71,55,8,33);ctx.fillRect(71,96,8,8);
    for(let i=0;i<4;i++)ctx.fillRect(145,49+i*18,87-i*8,4);
  }
  const map=new T.CanvasTexture(canvas);
  map.colorSpace=T.SRGBColorSpace;
  const material=new T.MeshStandardMaterial({map,roughness:kind==='display'?.24:.6,metalness:kind==='display'?.16:.02});
  if(kind==='display')display=material;else warning=material;
  return material;
}
export function safetyLabel(root,x,y,z,width=.075) {
  mesh(root,new T.PlaneGeometry(width,width*.625),labelTexture('warning'),x,y,z).castShadow=false;
}

export function controlPanel(root,x,y,z) {
  cabinet(root,x,y,z,.265,.37,.079,paint.blueGray,.008);
  cabinet(root,x,y+.059,z+.045,.205,.146,.018,paint.seam,.003);
  mesh(root,new T.PlaneGeometry(.183,.118),labelTexture('display'),x,y+.060,z+.056);
  for(const [i,m] of [paint.green,paint.graphite,paint.graphite].entries()){
    const px=x-.076+i*.047;
    cylinder(root,px,y-.058,z+.044,.016,.011,paint.steel);
    cylinder(root,px,y-.058,z+.052,.012,.010,m);
  }
  cylinder(root,x+.067,y-.112,z+.044,.030,.012,paint.yellow);
  cylinder(root,x+.067,y-.112,z+.063,.021,.030,paint.red);
}

export function feeder(root,motion,x,downstream) {
  const far=downstream?-1:1;
  const rear=x+far*.22;
  for(const z of [-.595,.595]) {
    box(root,rear,.68,z,.095,1.09,.087,paint.blueGray);
    cylinder(root,rear,1.36,z,.022,.37,paint.steel,'y');
    cylinder(root,x-far*.30,1.09,z,.011,.28,paint.steel,'y');
    box(root,x-far*.31,1.08,z*.91,.070,.170,.012,paint.aluminum);
  }
  box(root,rear,1.56,0,.102,.082,1.27,paint.aluminum);
  const head=group(motion,rear,0,0);
  cabinet(head,0,1.406,0,.138,.109,.70,paint.blueGray,.008);
  for(const z of [-.32,-.19,.19,.32]) {
    cylinder(head,0,1.291,z,.017,.134,paint.aluminum,'y');
    for(let i=0;i<3;i++)cylinder(head,0,1.21+i*.014,z,.021+(3-i)*.002,.010,paint.rubber,'y');
    mesh(head,new T.CylinderGeometry(.020,.032,.028,22),paint.rubber,0,1.181,z);
  }
  // Vacuum hoses run from each sucker to the beam. They are rebuilt every frame so they flex
  // with the head instead of staying frozen in the air.
  const hoses=[-.32,-.19,.19,.32].map(z=>({z,mesh:hose(root,[[rear+.052,1.298,z],[rear+.11,1.36,z],[rear+.10,1.48,z+.04],[rear,1.54,z+.04]],.006)}));
  head.userData.flex=(dx,dy)=>{
    for(const h of hoses){
      const z=h.z,sway=.012*Math.sin(dx*40+z*9);
      const curve=new T.CatmullRomCurve3([[rear+.052+dx,1.298+dy,z],[rear+.12+dx*.8,1.36+dy*.7,z+sway],[rear+.10+dx*.3,1.48+dy*.25,z+.04],[rear,1.54,z+.04]].map(c=>new T.Vector3(...c)));
      h.mesh.geometry.dispose();h.mesh.geometry=new T.TubeGeometry(curve,18,.006,7,false);
    }
  };
  return head;
}

// Instancing uses matrices measured in each group's own coordinates, even when a bay has an offset.
export function pack(root) {
  root.updateWorldMatrix(true,true);
  const inv=new T.Matrix4().copy(root.matrixWorld).invert();
  const groups=new Map();
  root.traverse(object=>{
    if(!object.isMesh || object.isInstancedMesh || object.material.transparent) return;
    const key=object.geometry.uuid+'|'+object.material.uuid;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(object);
  });
  const matrix=new T.Matrix4();
  for(const objects of groups.values()) {
    if(objects.length<3) continue;
    const sample=objects[0];
    const batch=new T.InstancedMesh(sample.geometry,sample.material,objects.length);
    batch.castShadow=sample.castShadow;batch.receiveShadow=sample.receiveShadow;
    objects.forEach((object,index)=>{
      matrix.multiplyMatrices(inv,object.matrixWorld);
      batch.setMatrixAt(index,matrix);
      object.removeFromParent();
    });
    batch.computeBoundingSphere();
    root.add(batch);
  }
}
