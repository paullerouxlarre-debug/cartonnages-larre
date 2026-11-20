import * as T from '../assets/vendor/three.module.min.js';

const block = new T.BoxGeometry(1, 1, 1);
const round = new T.CylinderGeometry(1, 1, 1, 36);
const profiles = new Map();
const labels = new Map();

function enamel(color, metalness = .28, roughness = .39) {
  return new T.MeshStandardMaterial({color, metalness, roughness});
}

export const finish = {
  chalk: enamel(0xe2e2d4), porcelain: enamel(0xb8c7c2), sea: enamel(0x346562),
  frame: enamel(0x263d42, .63), iron: enamel(0x18292e, .58, .41),
  steel: enamel(0xb7c7c7, .85, .23), satin: enamel(0x879a9b, .76, .38),
  copper: enamel(0xe6a45d, .7, .29), rubber: enamel(0x182528, .05, .77),
  belt: enamel(0x397d69, .1, .58), orange: enamel(0xff643d, .14),
  paper: enamel(0xf2e6ce, 0, .83), edge: enamel(0xc7b69b, .04, .83),
  kraft: enamel(0xa77e50, .02, .88), kraftLight: enamel(0xc99d68, .02, .8),
  wood: enamel(0x9b7350, .1, .79), tape: enamel(0xd8ad76, .2, .38),
  glow: new T.MeshBasicMaterial({color:0xffc992}),
  coolGlow: new T.MeshBasicMaterial({color:0xa7d3c8}),
};

export function addSurfaceFinish() {
  let seed=149;
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#aeaead';ctx.fillRect(0,0,256,256);
  for(let i=0;i<3400;i++){
    const n=Math.floor(96+rand()*100);
    ctx.fillStyle='rgba('+[n,n,n,.48].join(',')+')';
    ctx.fillRect(rand()*256,rand()*256,3+rand()*41,.8);
  }
  const grain=new T.CanvasTexture(c);grain.wrapS=grain.wrapT=T.RepeatWrapping;
  grain.repeat.set(3,5);
  for (const metal of [finish.steel, finish.satin, finish.iron, finish.copper]) {
    metal.roughnessMap = grain;
    metal.needsUpdate = true;
  }
}

export function group(parent, x=0, y=0, z=0) {
  const child = new T.Group();
  child.position.set(x,y,z);
  parent.add(child);
  return child;
}

export function mesh(parent, geometry, material, x=0, y=0, z=0) {
  const child = new T.Mesh(geometry, material);
  child.position.set(x,y,z);
  child.castShadow = child.receiveShadow = true;
  parent.add(child);
  return child;
}

export function box(parent, x,y,z, width,height,depth, material) {
  const child = mesh(parent, block, material, x,y,z);
  child.scale.set(width,height,depth);
  return child;
}

// A rounded sheet-metal profile, extruded along the roller axis.
export function casing(parent, x,y,z, w,h,d, mat, radius=.1) {
  const key = [w,h,d,radius].join('/');
  if (!profiles.has(key)) {
    const a=w/2, b=h/2, r=Math.min(radius,a*.8,b*.8);
    const s=new T.Shape();
    s.moveTo(-a+r,-b); s.lineTo(a-r,-b); s.quadraticCurveTo(a,-b,a,-b+r);
    s.lineTo(a,b-r); s.quadraticCurveTo(a,b,a-r,b);
    s.lineTo(-a+r,b); s.quadraticCurveTo(-a,b,-a,b-r);
    s.lineTo(-a,-b+r); s.quadraticCurveTo(-a,-b,-a+r,-b);
    const geo=new T.ExtrudeGeometry(s,{depth:d, bevelEnabled:true, bevelSegments:2,
      bevelSize:.022, bevelThickness:.018, curveSegments:4});
    geo.translate(0,0,-d/2);
    profiles.set(key,geo);
  }
  return mesh(parent,profiles.get(key),mat,x,y,z);
}

export function cylinder(parent, x,y,z, r,len, mat, axis='z') {
  const c=mesh(parent,round,mat,x,y,z);
  c.scale.set(r,len,r);
  if (axis==='z') c.rotation.x=Math.PI/2;
  if (axis==='x') c.rotation.z=Math.PI/2;
  return c;
}

export function bar(parent, a,b,r, mat) {
  const start=new T.Vector3(...a), end=new T.Vector3(...b);
  const delta=end.clone().sub(start);
  const c=cylinder(parent,0,0,0,r,delta.length(),mat,'y');
  c.position.copy(start.add(end).multiplyScalar(.5));
  c.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  return c;
}

export function plate(parent, x,y,z, w,h, text, options={}) {
  const key=[text,options.bg,options.ink].join('|');
  if (!labels.has(key)) {
    const canvas=document.createElement('canvas');
    canvas.width=768; canvas.height=128;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=options.bg||'#233a3b'; ctx.fillRect(0,0,768,128);
    ctx.fillStyle=options.ink||'#e5eada';
    ctx.font='600 57px sans-serif'; ctx.textBaseline='middle';
    ctx.fillText(text,30,66,710);
    const tex=new T.CanvasTexture(canvas); tex.colorSpace=T.SRGBColorSpace;
    const mat=new T.MeshStandardMaterial({map:tex,roughness:.52});
    labels.set(key,mat);
  }
  const p=mesh(parent,new T.PlaneGeometry(w,h),labels.get(key),x,y,z);
  p.castShadow=false;
  return p;
}

export function softShadow(parent, x,z, width,depth, opacity=.48) {
  if (!softShadow.map) {
    const c=document.createElement('canvas'); c.width=c.height=96;
    const ctx=c.getContext('2d'), g=ctx.createRadialGradient(48,48,1,48,48,48);
    g.addColorStop(0,'rgba(1,6,8,.97)'); g.addColorStop(.48,'rgba(1,6,8,.72)'); g.addColorStop(1,'rgba(1,6,8,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,96,96); softShadow.map=new T.CanvasTexture(c);
  }
  const m=new T.MeshBasicMaterial({map:softShadow.map,transparent:true,opacity,depthWrite:false});
  const p=mesh(parent,new T.PlaneGeometry(width,depth),m,x,.018,z);
  p.rotation.x=-Math.PI/2; p.castShadow=p.receiveShadow=false;
}

// Shared geometry keeps the fasteners, rollers and roof structure inexpensive on a phone.
export function batch(root) {
  const byType=new Map();
  root.updateMatrixWorld(true);
  root.traverse(item=>{
    if (!item.isMesh || item.material.transparent) return;
    const key=item.geometry.uuid+item.material.uuid;
    if (!byType.has(key)) byType.set(key,[]);
    byType.get(key).push(item);
  });
  for (const items of byType.values()) {
    if (items.length<3) continue;
    const first=items[0], result=new T.InstancedMesh(first.geometry,first.material,items.length);
    result.castShadow=first.castShadow; result.receiveShadow=first.receiveShadow;
    items.forEach((item,i)=>{ result.setMatrixAt(i,item.matrixWorld); item.removeFromParent(); });
    result.computeBoundingSphere(); root.add(result);
  }
}

export const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
export const mix=(a,b,x)=>a+(b-a)*x;
export function keys(frames,t) {
  for (let i=1;i<frames.length;i++) {
    if(t<=frames[i][0]) {
      const a=frames[i-1], b=frames[i], u=clamp((t-a[0])/(b[0]-a[0]));
      return mix(a[1],b[1],u);
    }
  }
  return frames[frames.length-1][1];
}
