import * as T from '../assets/vendor/three.module.min.js';
import {
  stock, pressFormat, imposePositions, blankSize, faces, zCenter, lidDepth,
  flapPieces, blankOutline, blankUV, sheetUV, materials, board, boardGeometry, wallGeometry, sheetMaterial
} from './papier.js';

export {stock, pressFormat, imposePositions, blankSize, blankOutline};
export const units = [-9.6,-7.55,-5.5,-3.45];
const {front,side,length,tab,thickness}=stock;
const half=length/2;
const gutter=.00032;
const saturate=x=>Math.max(0,Math.min(1,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=saturate((x-a)/(b-a));return t*t*(3-2*t);};
const group=parent=>{const g=new T.Group();parent.add(g);return g;};
const rect=(z0,x0,z1,x1)=>[[z0,x0],[z1,x0],[z1,x1],[z0,x1]];
let fullSheet, flatBlank, stripGrid;

export function makePressSheet(parent) {
  const pivot=group(parent),{material,ink}=sheetMaterial();
  fullSheet ||=boardGeometry(rect(-pressFormat.z/2,-pressFormat.x/2,pressFormat.z/2,pressFormat.x/2),sheetUV);
  board(pivot,fullSheet,material);
  return {pivot,setInk(value){ink.value=saturate(value);}};
}

function flatGeometry() {
  flatBlank ||=boardGeometry(blankOutline(),blankUV);
  return flatBlank;
}

// Four cut poses remain supported while the waste frame moves below the sheet.
export function makeStrippedSheet(parent) {
  const pivot=group(parent),m=materials(),shape=blankOutline(),poses=[];
  for(const {x,z} of imposePositions) {
    const blank=board(pivot,flatGeometry(),m.outer);
    blank.position.set(x,0,z);poses.push(blank);
  }
  if(!stripGrid) {
    // Die clearance is finite. There are no coincident scraps covering the printed faces.
    const holes=imposePositions.map(({x,z})=>shape.map(([u,v])=>[z+u*1.00062,x+v*1.00062]));
    stripGrid=boardGeometry(rect(-pressFormat.z/2,-pressFormat.x/2,pressFormat.z/2,pressFormat.x/2),
      sheetUV,thickness,holes);
  }
  const waste=board(pivot,stripGrid,m.plainSheet);
  return {pivot,poses,waste,setSeparation(value){
    const u=saturate(value);waste.position.set(-.014*u,-.185*u,.006*u);
    waste.rotation.z=-.095*u;waste.visible=u<1;
  }};
}

// A pallet may hold hundreds of identical poses. One layered edge per lift suffices.
// The bottom of the pile is y=0. Turning the pile in Z gives the reverse-side feeding orientation.
export function makeBlankPile(parent,{count=48,pitch=thickness,printUp=true}={}) {
  const pivot=group(parent),layers=Math.max(0,Math.floor(count)),height=layers*pitch;
  if(!layers)return {pivot,height:0};
  const m=materials(),outline=blankOutline();
  const surface=printUp?m.outer:m.inside;
  let previous=0;
  const bands=Math.min(3,Math.ceil(layers/28));
  for(let n=1;n<=bands;n++) {
    const top=Math.round(layers*n/bands)*pitch;
    const geometry=boardGeometry(outline,blankUV,top-previous);
    const sheet=board(pivot,geometry,surface,true);
    if(!printUp)sheet.scale.z=-1;
    sheet.position.set((n===bands?0:.00031*Math.sin(3*n)),top,n===bands?0:.00032*Math.cos(n));
    previous=top;
  }
  return {pivot,height};
}

// Capture both skins of each continuous body score. The narrow band bends between
// neighbouring thick panels instead of sending coincident faces through one another.
function scoredHinge(parent, before, after, zOnBefore, zOnAfter, flatZ, radiusX) {
  const steps=8, stride=(steps+1)*2;
  const geo=new T.BufferGeometry(), pos=new Float32Array(stride*2*3);
  const normals=new Float32Array(pos.length), uv=[], indices=[];
  for(let skin=0;skin<2;skin++) {
    const start=indices.length;
    for(let i=0;i<=steps;i++) {
      const u=i/steps;
      for(const x of [-radiusX,radiusX])uv.push(...blankUV(flatZ-zCenter+lerp(-gutter,gutter,u),x));
      if(i===steps)continue;
      const a=skin*stride+2*i,b=a+1,c=a+2,d=a+3;
      if(skin===0)indices.push(a,c,b,b,c,d);
      else indices.push(a,b,c,b,d,c);
    }
    geo.addGroup(start,indices.length-start,skin);
  }
  const pAttr=new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage);
  const nAttr=new T.BufferAttribute(normals,3).setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position',pAttr);geo.setAttribute('normal',nAttr);
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
  const m=materials(),mesh=new T.Mesh(geo,[m.outer,m.inside]);
  mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;parent.add(mesh);
  let oldAngles='';
  return () => {
    const a=before.rotation.x,b=after.rotation.x,ca=Math.cos(a),cb=Math.cos(b),sa=Math.sin(a),sb=Math.sin(b);
    const ay=before.position.y-zOnBefore*sa,az=before.position.z+zOnBefore*ca;
    const by=after.position.y-zOnAfter*sb,bz=after.position.z+zOnAfter*cb;
    const key=[a,b,ay,az,by,bz].join('/');
    if(key===oldAngles)return;
    oldAngles=key;
    const reach=Math.max(gutter*.67,Math.hypot(by-ay,bz-az)*.59);
    const py=ay-reach*sa,pz=az+reach*ca,qy=by+reach*sb,qz=bz-reach*cb;
    for(let i=0;i<=steps;i++) {
      const t=i/steps,s=1-t;
      const y=s*s*s*ay+3*s*s*t*py+3*s*t*t*qy+t*t*t*by;
      const z=s*s*s*az+3*s*s*t*pz+3*s*t*t*qz+t*t*t*bz;
      const dy=s*s*(py-ay)+2*s*t*(qy-py)+t*t*(by-qy);
      const dz=s*s*(pz-az)+2*s*t*(qz-pz)+t*t*(bz-qz);
      const norm=Math.hypot(dy,dz)||1,ny=dz/norm,nz=-dy/norm;
      for(let skin=0;skin<2;skin++)for(let end=0;end<2;end++){
        const idx=skin*stride+i*2+end,sgn=skin===0?1:-1;
        pAttr.setXYZ(idx,end?radiusX:-radiusX,y-skin*thickness*ny,z-skin*thickness*nz);
        nAttr.setXYZ(idx,0,sgn*ny,sgn*nz);
      }
    }
    pAttr.needsUpdate=nAttr.needsUpdate=true;
  };
}

// Wrap stock over the end score. Its raw cut edge is visible only at the two ends.
// In particular a closed dust flap has a continuous rolled shoulder from the side wall.
function endScore(parent, outer, z0, z1, hingeX, end, uvAt) {
  const steps=6, stride=2*(steps+1), geo=new T.BufferGeometry();
  const pos=new T.BufferAttribute(new Float32Array(6*stride),3).setUsage(T.DynamicDrawUsage);
  const norm=new T.BufferAttribute(new Float32Array(6*stride),3).setUsage(T.DynamicDrawUsage);
  const uv=[],idx=[];
  for(let skin=0;skin<2;skin++){
    const from=idx.length;
    for(let i=0;i<=steps;i++){
      const x=hingeX+end*gutter*(2*i/steps-1);
      for(const z of [z0,z1])uv.push(...uvAt(z,x));
      if(i===steps)continue;
      const a=skin*stride+i*2,b=a+1,c=a+2,d=a+3;
      if((end>0)===(skin===0))idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);
    }
    geo.addGroup(from,idx.length-from,skin);
  }
  geo.setAttribute('position',pos);geo.setAttribute('normal',norm);
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);
  const mesh=new T.Mesh(geo,[outer,materials().inside]);mesh.frustumCulled=false;parent.add(mesh);
  mesh.castShadow=mesh.receiveShadow=true;
  let old;
  return angle=>{
    if(angle===old)return;old=angle;
    const co=Math.cos(angle),si=Math.sin(angle);
    // Quadratic interpolation through the scored vertex is tangent to both rigid boards.
    for(let i=0;i<=steps;i++){
      const t=i/steps,s=1-t;
      const x=hingeX+end*gutter*(-s*s+t*t*co),y=end*gutter*t*t*si;
      const dx=s+t*co,dy=t*si,inv=1/Math.hypot(dx,dy);
      const nx=-dy*inv,ny=dx*inv;
      for(let skin=0;skin<2;skin++)for(let j=0;j<2;j++){
        const k=skin*stride+i*2+j,sign=skin===0?1:-1;
        pos.setXYZ(k,x-skin*thickness*nx,y-skin*thickness*ny,j?z1:z0);
        norm.setXYZ(k,nx*sign,ny*sign,0);
      }
    }
    pos.needsUpdate=norm.needsUpdate=true;
  };
}

function flap(parent,panel,end,outer) {
  const data=flapPieces(panel,end);if(!data)return null;
  const z=faces[panel].z,hinge=group(parent);
  const xH=end*(half-(data.type==='dust'?thickness*1.7:0));
  hinge.position.x=xH;
  const local=p=>[p[0],end*Math.max(gutter,p[1])];
  const uv=(u,v)=>blankUV(z+u-zCenter,xH+v);
  const outline=data.type==='dust'?data.outline:data.deck;
  const bend=endScore(parent,outer,outline[0][0],outline[outline.length-1][0],xH,end,
    (u,v)=>blankUV(z+u-zCenter,v));
  if(data.type==='dust') {
    const shape=data.outline.map(local);
    board(hinge,boardGeometry(shape,uv),outer);
    return {end,hinge,bend};
  }
  const deck=data.deck.map(([u,v])=>[u,end*Math.min(lidDepth-gutter,Math.max(gutter,v))]);
  board(hinge,boardGeometry(deck,uv),outer);
  const tuck=group(hinge);tuck.position.x=end*lidDepth;
  const tongue=data.tongue.map(local);
  board(tuck,boardGeometry(tongue,(u,v)=>uv(u,tuck.position.x+v)),outer);
  const tuckBend=endScore(hinge,outer,data.tongue[0][0],data.tongue[data.tongue.length-1][0],
    tuck.position.x,end,uv);
  return {end,hinge,tuck,bend,tuckBend};
}

export function makeCarton(parent) {
  const pivot=group(parent), spun=group(pivot), centre=group(spun);
  const m=materials(),panels=[],flaps=[],walls=[];
  for(const [i,{z,width}] of faces.entries()) {
    const holder=group(centre);
    const low=gutter,high=width-(i===3?0:gutter);
    const base=half-(i===0||i===2?1.7*thickness:0);
    const bottom = -base + (flapPieces(i,-1) ? gutter : 0);
    const top = base - (flapPieces(i,1) ? gutter : 0);
    const amplitude=width===front ? .00088 : .00032;
    walls.push(board(holder,wallGeometry(low,high,bottom,top,(u,v)=>blankUV(z+u-zCenter,v),amplitude),m.outer));
    for(const end of [-1,1]) {
      const lid=flap(holder,i,end,m.outer);
      if(lid)flaps.push(lid);
    }
    panels.push(holder);
  }
  const adhesive=group(centre),tabShape=[[-tab,-half+.011],[-gutter,-half],
    [-gutter,half],[-tab,half-.011]];
  board(adhesive,boardGeometry(tabShape,(u,v)=>blankUV(u-side-zCenter,v)),m.outer);

  const glueMaterial=new T.MeshPhysicalMaterial({color:0xe3d9ae,roughness:.2,metalness:0,
    clearcoat:.55,clearcoatRoughness:.21});
  const bead=new T.Mesh(new T.SphereGeometry(1,12,6),glueMaterial);adhesive.add(bead);
  bead.castShadow=true;
  const hinges=[
    scoredHinge(centre,adhesive,panels[0],-gutter,gutter,-side,half-.0006),
    scoredHinge(centre,panels[0],panels[1],side-gutter,gutter,0,half-.00015),
    scoredHinge(centre,panels[1],panels[2],front-gutter,gutter,front,half-.00015),
    scoredHinge(centre,panels[2],panels[3],side-gutter,gutter,front+side,half-.00015)
  ];
  function place(node,z,y,angle){node.position.set(0,y,z);node.rotation.x=angle;}
  function pose({x=0,y=0,z=0,roll=0,yaw=0,rise=0,foldLeft=0,foldBack=0,open=0,close=0,glue=0}={}) {
    const left=saturate(foldLeft),back=saturate(foldBack),widthOpen=saturate(open),shut=saturate(close);
    const la=-Math.PI*left+Math.PI*.5*widthOpen,ra=Math.PI*.5*widthOpen;
    const base=-2.18*thickness*left*(1-widthOpen);
    const ry=-side*Math.sin(ra)-4.36*thickness*back*(1-widthOpen);
    const rz=front+side*Math.cos(ra);
    const lz=-side*Math.cos(la),ly=base+side*Math.sin(la);
    pivot.position.set(x,y,z);pivot.rotation.set(0,yaw,rise,'YXZ');
    spun.rotation.x=roll;
    const middle=lerp(lerp(zCenter,(front+side)/2,Math.max(left,back)),front/2,widthOpen);
    centre.position.set(0,side*widthOpen/2,-middle);
    // Each node's local +Z runs left→right on the unfolded graphic.
    place(panels[0],lz,ly,la);
    place(panels[1],0,0,0);
    place(panels[2],front,0,ra);
    place(panels[3],rz,ry,Math.PI*back);
    place(adhesive,lz,ly+widthOpen*thickness*1.14,la-Math.PI*.5*widthOpen);
    walls.forEach(wall=>{wall.morphTargetInfluences[0]=widthOpen;});
    const amount=saturate(glue),span=length*.87*.5;
    bead.visible=amount>.002 && back<.91;
    bead.position.set(-span+span*amount,-thickness-.00010,-tab*.52);
    bead.scale.set(Math.max(.00003,span*amount),.00020,.00125);
    for(const {end,hinge,tuck,bend,tuckBend} of flaps) {
      if(!tuck) {
        hinge.rotation.z=-end*Math.PI*.5*smooth(0,.63,shut);
      } else {
        hinge.rotation.z=-end*Math.PI*.5*smooth(.23,1,shut);
        tuck.rotation.z=-end*(Math.PI*.5)*smooth(.12,.87,shut);
        tuckBend(tuck.rotation.z);
      }
      bend(hinge.rotation.z);
    }
    hinges.forEach(update=>update());
  }
  pose();
  return {pivot,centre,pose};
}
