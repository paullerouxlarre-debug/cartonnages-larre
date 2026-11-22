import * as T from '../assets/vendor/three.module.min.js';

// All cutting and artwork dimensions are metres. Atlas coordinates follow the press:
// X runs with the sheet, Z across it. The top of the printed word points along +X.
export const stock = Object.freeze({
  front: .140, side: .075, length: .195, tab: .018, thickness: .00048
});
export const pressFormat = Object.freeze({ x: .748, z: 1.020 });
export const imposePositions = Object.freeze(
  [-.1835, .1835].flatMap(x => [-.239, .239].map(z => ({x, z})))
);

const {front, side, length, tab, thickness} = stock;
export const faces = [
  {z: -side, width: side}, {z: 0, width: front},
  {z: front, width: side}, {z: front + side, width: front}
];
export const zCenter = ((2 * front + side) - (side + tab)) / 2;
export const blankSize = { x: .363, z: .448 };
export const lidDepth = .0737;
export const tuckLength = .0103;
export const dustDepth = .053;
const half = length / 2;
// The tuck tongue slides between the front wall and the shoulders of both dust flaps.
const dustClear = .0032;
let library;

function flapType(panel, end) {
  if (panel === 0 || panel === 2) return 'dust';
  return (panel === 3 && end === 1) || (panel === 1 && end === -1) ? 'lid' : null;
}

// Z, outward X. A lid and its separate tuck tongue have a common scored hinge.
export function flapPieces(panel, end) {
  const type = flapType(panel, end);
  const w = faces[panel].width;
  if (!type) return null;
  if (type === 'dust') {
    return {type, outline:[[dustClear,0],[.0036,.006],[.0061,dustDepth-.010],
      [.014,dustDepth-.0024],[.018,dustDepth],[w-.016,dustDepth-.0021],
      [w-.008,dustDepth-.011],[w-.0045,dustDepth*.44],[w-dustClear,0]]};
  }
  const shoulder = .0051;
  const a = [.00085,0], b = [.0011,lidDepth-.0024], c = [shoulder,lidDepth];
  const d = [w-shoulder,lidDepth], e = [w-.0011,lidDepth-.0024], f = [w-.00085,0];
  const tongue = [[shoulder,0],[shoulder+.0008,.0040],[shoulder+.0023,tuckLength-.0023],
    [shoulder+.0048,tuckLength-.0006],[shoulder+.0077,tuckLength],
    [w-shoulder-.0077,tuckLength],[w-shoulder-.0048,tuckLength-.0006],
    [w-shoulder-.0023,tuckLength-.0023],[w-shoulder-.0008,.0040],[w-shoulder,0]];
  return {type, deck:[a,b,c,d,e,f], tongue,
    outline:[a,b,...tongue.map(([z,x])=>[z,x+lidDepth]),e,f]};
}

// This is the shared contour for the physical blank, the stripping grid and the cutting rules.
export function blankOutline() {
  function edge(end) {
    const pts = [[-side-tab, end*(half-.012)],[-side, end*(half-.0035)]];
    faces.forEach(({z,width},i) => {
      const flap=flapPieces(i,end);
      const baseline=half-(flap?.type==='dust'?thickness*1.7:0);
      pts.push([z,end*baseline]);
      if (flap) flap.outline.forEach(([u,v])=>pts.push([z+u,end*(baseline+v)]));
      pts.push([z+width,end*baseline]);
    });
    return pts;
  }
  return [...edge(-1),...edge(1).reverse()].map(([z,x])=>[z-zCenter,x]);
}

const makeCanvas = (w,h) => {
  const c=document.createElement('canvas'); c.width=w; c.height=h; return c;
};

function seeded(seed) {
  return () => {seed = (1664525 * seed + 1013904223) >>> 0; return seed/4294967296;};
}

function paperGrain() {
  const size=256, c=makeCanvas(size,size), ctx=c.getContext('2d');
  const image=ctx.createImageData(size,size), rand=seeded(72419);
  for (let i=0;i<image.data.length;i+=4) {
    const n=171 + 36*(rand()-.5) + 18*(rand()-.5);
    image.data[i]=image.data[i+1]=image.data[i+2]=n;
    image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  ctx.lineWidth=.6;
  for (let k=0;k<850;k++) {
    const x=rand()*size, y=rand()*size, len=1+rand()*4;
    ctx.strokeStyle=rand()>.5?'rgba(235,235,235,.25)':'rgba(62,62,62,.17)';
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+len*.5,y+rand()*.9,x+len,y+rand()*1.55);ctx.stroke();
  }
  return c;
}

function printArtwork(canvas) {
  const ctx=canvas.getContext('2d'), scale=canvas.width/448, height=363;
  ctx.scale(scale,scale);
  const paper='#e8e2cf', ink='#1e3531', terra='#aa4c32', warm='#d2ba95';
  ctx.fillStyle='#f4f1e6';ctx.fillRect(0,0,448,height);
  const bodyTop=(height-length*1000)/2;
  const x0=(z)=>1000*(z-zCenter+blankSize.z/2);
  const label=(str,x,y,font,color=ink) => {ctx.font=font;ctx.fillStyle=color;ctx.fillText(str,x,y);};
  function letterspace(str,x,y,font,tracking,color=ink) {
    ctx.font=font;ctx.fillStyle=color;
    for (const char of str) {ctx.fillText(char,x,y);x+=ctx.measureText(char).width+tracking;}
  }
  function sidePanel(panel) {
    const x=x0(faces[panel].z),w=side*1000;
    ctx.fillStyle=ink;ctx.fillRect(x,bodyTop-.7,w,196.4);
    letterspace('C A R T O N N A G E S',x+5.6,bodyTop+12,'2.6px sans-serif',.11,paper);
    ctx.save();ctx.translate(x+w*.61,bodyTop+170);ctx.rotate(-Math.PI/2);
    label('Larré',0,0,'29px Georgia, serif',paper);
    ctx.restore();
    ctx.fillStyle=terra;ctx.fillRect(x+5.6,bodyTop+178,w-11.2,.65);
    letterspace('BAYONNE',x+5.6,bodyTop+185,'3.4px sans-serif',.55,paper);
  }
  sidePanel(0);sidePanel(2);
  const f=x0(0), b=x0(front+side), width=front*1000;
  // A restrained print in three fields: uncoated ivory, oxide and deep pine.
  // The broad blocked shapes remain legible on both the full imposition and the carton.
  function mainFace(x,back) {
    const top=bodyTop, bottom=top+195;
    ctx.save();ctx.beginPath();ctx.rect(x,top,width,195);ctx.clip();
    ctx.fillStyle=back?'#d5bba0':paper;ctx.fillRect(x,top,width,195);
    const color=back?'#ded6c4':terra;
    ctx.fillStyle=color;ctx.beginPath();
    ctx.moveTo(x-1,top+127);ctx.bezierCurveTo(x+31,top+120,x+53,top+99,x+77,top+96);
    ctx.bezierCurveTo(x+110,top+93,x+126,top+114,x+141,top+110);
    ctx.lineTo(x+141,bottom+1);ctx.lineTo(x-1,bottom+1);ctx.fill();
    ctx.fillStyle=back?terra:'#904631';ctx.beginPath();
    ctx.moveTo(x-1,top+158);ctx.bezierCurveTo(x+28,top+151,x+51,top+127,x+79,top+128);
    ctx.bezierCurveTo(x+104,top+128,x+126,top+143,x+141,top+138);
    ctx.lineTo(x+141,bottom+1);ctx.lineTo(x-1,bottom+1);ctx.fill();
    letterspace(back?'CARTON  /  VOLUME':'CARTONNAGES',x+11,top+15,'4.05px sans-serif',.68);
    ctx.fillStyle=ink;ctx.fillRect(x+11,top+20,width-22,.30);
    label('Larré',x+9,top+69,'47px Georgia, serif');
    if(back) {
      label('Bureau d’études',x+12,top+80,'5.1px Georgia, serif');
    } else {
      letterspace('BAYONNE',x+12,top+80,'4.15px sans-serif',1.1);
    }
    letterspace(back?'CARTONNAGES LARRÉ':'ÉTUDE D’ATELIER',x+11,bottom-13,'3.5px sans-serif',.55,paper);
    ctx.fillStyle=paper;ctx.fillRect(x+11,bottom-9,width-22,.25);
    ctx.restore();
  }
  mainFace(f,false);mainFace(b,true);
  // Lid graphics share the actual UVs of the finished box.
  for (const [panel,end] of [[3,1],[1,-1]]) {
    const x=x0(faces[panel].z);
    const y=end===1 ? bodyTop-lidDepth*1000 : bodyTop+195;
    ctx.fillStyle=end===1 ? '#934d36' : warm;ctx.fillRect(x+.45,y,width-.9,lidDepth*1000);
    ctx.save();ctx.translate(x+width/2,y+lidDepth*500);if(end===1)ctx.rotate(Math.PI);
    ctx.textAlign='center';label('Larré',0,4,'16px Georgia, serif',end===1?paper:ink);
    ctx.textAlign='start';ctx.restore();
  }
}

function texture(canvas,color=false) {
  const t=new T.CanvasTexture(canvas);
  if(color)t.colorSpace=T.SRGBColorSpace;
  t.anisotropy=8;return t;
}

// The coated stock keeps some fibre formation under the ink. The same print is
// photographed on the sheet and on the folded carton, including these small variations.
function inkFinish(art) {
  const ctx=art.getContext('2d'), image=ctx.getImageData(0,0,art.width,art.height);
  const rough=makeCanvas(art.width,art.height), rc=rough.getContext('2d');
  const sheen=rc.createImageData(art.width,art.height), rand=seeded(4527);
  const spacing=36, cols=Math.ceil(art.width/spacing)+1, rows=Math.ceil(art.height/spacing)+1;
  const field=Float32Array.from({length:cols*rows},()=>rand()-.5);
  for(let y=0,k=0;y<art.height;y++) {
    const row=Math.floor(y/spacing)*cols, ty=(y%spacing)/spacing;
    for(let x=0;x<art.width;x++,k+=4){
      const i=row+Math.floor(x/spacing),tx=(x%spacing)/spacing;
      const a=field[i]*(1-tx)+field[i+1]*tx,b=field[i+cols]*(1-tx)+field[i+cols+1]*tx;
      const cast=(a*(1-ty)+b*ty)*12.4, fine=(rand()-.5)*10.8;
      const density=(image.data[k]*.23+image.data[k+1]*.68+image.data[k+2]*.09)/255;
      const reflection=(cast+fine)*(.29+.71*density);
      image.data[k]+=reflection*.94;image.data[k+1]+=reflection;image.data[k+2]+=reflection*1.11;
      const r=143+68*density+cast*1.4+fine*.70;
      sheen.data[k]=sheen.data[k+1]=sheen.data[k+2]=r;sheen.data[k+3]=255;
    }
  }
  ctx.putImageData(image,0,0);rc.putImageData(sheen,0,0);
  return texture(rough);
}

function textureLibrary() {
  if(library)return library;
  const art=makeCanvas(1792,1452);printArtwork(art);
  const varnish=inkFinish(art);
  const sheet=makeCanvas(2448,1795),ctx=sheet.getContext('2d');
  const px=sheet.width/pressFormat.z,py=sheet.height/pressFormat.x;
  ctx.fillStyle='#f4f1e6';ctx.fillRect(0,0,sheet.width,sheet.height);
  for(const {x,z} of imposePositions) {
    ctx.drawImage(art,(pressFormat.z/2+z-blankSize.z/2)*px,
      (pressFormat.x/2-x-blankSize.x/2)*py,blankSize.z*px,blankSize.x*py);
  }
  // A colour-control strip and registration targets remain outside the cut forms.
  ctx.save();ctx.scale(px,py);
  const inks=['#198ca2','#ba4777','#d2b449','#34372f','#b77760','#789081','#b5a482'];
  for(const side of [-1,1]) {
    const bx=side<0?.016:pressFormat.z-.03;
    for(let i=0;i<42;i++) {
      ctx.fillStyle=inks[i%inks.length];ctx.fillRect(bx,.025+i*.010,.009,.0093);
    }
    for(const by of [.024,.372,.722]) {
      const x=bx+(side<0?.017:-.010);
      ctx.strokeStyle='#333d39';ctx.lineWidth=.00037;
      ctx.beginPath();ctx.arc(x,by,.0034,0,Math.PI*2);ctx.moveTo(x-.0058,by);ctx.lineTo(x+.0058,by);
      ctx.moveTo(x,by-.0058);ctx.lineTo(x,by+.0058);ctx.stroke();
    }
  }
  ctx.restore();
  const grain=paperGrain(), rough=texture(grain);
  const edging=makeCanvas(96,96), e=edging.getContext('2d'), rand=seeded(2912);
  e.fillStyle='#dbcfac';e.fillRect(0,0,96,96);
  for(let i=0;i<700;i++){
    const c=Math.floor(103+100*rand());
    e.strokeStyle='rgba('+c+','+(c-4)+','+(c-16)+',.25)';
    let x=rand()*96,y=rand()*96;
    e.beginPath();e.moveTo(x,y);e.lineTo(x+1+rand()*6,y+rand()*1.3);e.stroke();
  }
  const edgeTex=texture(edging,true);edgeTex.wrapS=edgeTex.wrapT=T.RepeatWrapping;
  const inside=new T.MeshStandardMaterial({color:0xddd4bb,roughness:.92,metalness:0});
  const edge=new T.MeshStandardMaterial({map:edgeTex,color:0xf1e9cf,roughness:.96,metalness:0});
  const edgeLayers=makeCanvas(96,64), lc=edgeLayers.getContext('2d');
  lc.drawImage(edging,0,0,96,64);
  lc.fillStyle='rgba(82,72,52,.26)';lc.fillRect(0,0,96,9);
  lc.fillStyle='rgba(255,251,228,.48)';lc.fillRect(0,9,96,4);
  const layeredMap=texture(edgeLayers,true);layeredMap.wrapS=layeredMap.wrapT=T.RepeatWrapping;
  const pileEdge=new T.MeshStandardMaterial({map:layeredMap,color:0xffffff,roughness:.94});
  const relief=makeCanvas(1792,1452), rc=relief.getContext('2d');
  const pattern=rc.createPattern(grain,'repeat');rc.fillStyle=pattern;rc.fillRect(0,0,relief.width,relief.height);
  rc.scale(relief.width/blankSize.z,relief.height/blankSize.x);
  function rule(z0,x0,z1,x1) {
    const x=zCenter-blankSize.z/2,y=blankSize.x/2;
    rc.lineCap='round';rc.beginPath();rc.moveTo(z0-x,y-x0);rc.lineTo(z1-x,y-x1);
    rc.lineWidth=.00085;rc.strokeStyle='rgb(83,83,83)';rc.stroke();
    rc.lineWidth=.00033;rc.strokeStyle='rgb(59,59,59)';rc.stroke();
  }
  [-side,0,front,front+side].forEach(z=>rule(z,-half+.0005,z,half-.0005));
  faces.forEach(({z,width},i)=>{for(const end of [-1,1]){
    if(!flapType(i,end))continue;
    rule(z+.001,end*half,z+width-.001,end*half);
    if(flapType(i,end)==='lid')rule(z+.005,end*(half+lidDepth),z+width-.005,end*(half+lidDepth));
  }});
  const blankMap=texture(art,true),sheetMap=texture(sheet,true),bump=texture(relief);
  const outer=new T.MeshPhysicalMaterial({map:blankMap,roughness:.92,roughnessMap:varnish,metalness:0,
    clearcoat:.26,clearcoatRoughness:.45,clearcoatRoughnessMap:varnish,bumpMap:bump,bumpScale:.00013});
  const plainSheet=new T.MeshPhysicalMaterial({map:sheetMap,roughness:.71,metalness:0,
    clearcoat:.12,clearcoatRoughness:.5,roughnessMap:rough});
  library={outer,plainSheet,inside,edge,pileEdge};
  return library;
}

export function materials() { return textureLibrary(); }

export function sheetMaterial() {
  const material=textureLibrary().plainSheet.clone(),ink={value:1};
  const leadingEdges={value:new T.Vector4()},atContact={value:0};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{inkCoverage:ink,inkFronts:leadingEdges,inkAtContact:atContact});
    shader.fragmentShader='uniform float inkCoverage,inkAtContact; uniform vec4 inkFronts;\n'+shader.fragmentShader.replace(
      '#include <map_fragment>',[
        'vec3 substrate=vec3(0.90466,0.87962,0.79130);',
        'vec3 whole=texture2D(map, vMapUv).rgb;',
        'vec3 reflectance=clamp(whole/substrate,vec3(.001),vec3(1.0));',
        'float black=1.0-max(max(reflectance.r,reflectance.g),reflectance.b);',
        'vec3 cmys=1.0-reflectance/max(.001,1.0-black);',
        'vec4 flatInk=clamp(inkCoverage*4.0-vec4(0.,1.,2.,3.),0.,1.);',
        'float width=max(.00042,fwidth(vMapUv.y)*.58);',
        'vec4 passes=smoothstep(inkFronts-vec4(width),inkFronts+vec4(width),vec4(vMapUv.y));',
        'vec4 transfer=mix(flatInk,passes,inkAtContact);',
        'diffuseColor.rgb *= substrate*(1.0-transfer.rgb*cmys)*(1.0-transfer.a*black);'
      ].join('\n'));
  };
  material.customProgramCacheKey=()=>'larre-offset-nip-cmyk';
  return {material,ink,leadingEdges,atContact};
}

export const blankUV = (z,x) => [.5+z/blankSize.z,.5+x/blankSize.x];
export const sheetUV = (z,x) => [.5+z/pressFormat.z,.5+x/pressFormat.x];

function ring(points, clockwise) {
  const result=[];
  for(const [z,x] of points) {
    const last=result[result.length-1];
    if(!last||Math.abs(last.x-z)+Math.abs(last.y-x)>1e-8)result.push(new T.Vector2(z,x));
  }
  if(result[0].distanceToSquared(result[result.length-1])<1e-16)result.pop();
  if(T.ShapeUtils.isClockWise(result)!==clockwise)result.reverse();
  return result;
}

// Watertight stock. The two faces and the cut edge have distinct normals and materials.
// Neighbouring lid panels meet at scored hinges with a relief equal to the board caliper.
export function boardGeometry(points, uvAt, depth=thickness, holes=[]) {
  const contour=ring(points,false), voids=holes.map(p=>ring(p,true));
  const tris=T.ShapeUtils.triangulateShape(contour,voids), rings=[contour,...voids], flat=rings.flat();
  const positions=[],normals=[],uvs=[],indices=[];
  const geometry=new T.BufferGeometry();
  function vertex(p,y,n,uv) {
    positions.push(p.y,y,p.x);normals.push(...n);uvs.push(...uv);
    return positions.length/3-1;
  }
  for(const p of flat)vertex(p,0,[0,1,0],uvAt(p.x,p.y));
  for(const tri of tris)indices.push(...tri);
  geometry.addGroup(0,indices.length,0);
  const bottom=indices.length, n=flat.length;
  for(const p of flat)vertex(p,-depth,[0,-1,0],uvAt(p.x,p.y));
  for(const [a,b,c] of tris)indices.push(c+n,b+n,a+n);
  geometry.addGroup(bottom,indices.length-bottom,1);
  const sides=indices.length;
  for(const path of rings) {
    let arc=0;
    for(let i=0;i<path.length;i++) {
      const a=path[i],b=path[(i+1)%path.length],len=a.distanceTo(b);
      const normal=[-(b.x-a.x)/len,0,(b.y-a.y)/len];
      const start=arc/.016,end=(arc+len)/.016;
      const first=vertex(a,0,normal,[start,0]);
      vertex(b,0,normal,[end,0]);vertex(b,-depth,normal,[end,depth/thickness]);
      vertex(a,-depth,normal,[start,depth/thickness]);
      indices.push(first,first+2,first+1,first,first+3,first+2);arc+=len;
    }
  }
  geometry.addGroup(sides,indices.length-sides,2);
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeBoundingSphere();
  return geometry;
}

export function board(parent,geo,surface,layered=false) {
  const m=textureLibrary(), mesh=new T.Mesh(geo,[surface,m.inside,layered?m.pileEdge:m.edge]);
  mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

// The erected sleeve carries a fraction of a millimetre of spring in its long walls.
// Both skins bow together. The perimeter stays on its cut line and the flat pose stays planar.
export function wallGeometry(z0,z1,x0,x1,uvAt,amplitude) {
  const geo=boardGeometry([[z0,x0],[z1,x0],[z1,x1],[z0,x1]],uvAt);
  const pos=Array.from(geo.attributes.position.array),norm=Array.from(geo.attributes.normal.array);
  const uv=Array.from(geo.attributes.uv.array);
  const bend=new Array(pos.length).fill(0), tilt=new Array(pos.length).fill(0);
  const {start,count}=geo.groups[2], edge=Array.from(geo.index.array.slice(start,start+count));
  const indices=[],nZ=12,nX=12,w=z1-z0,h=x1-x0;
  geo.clearGroups();
  for(let skin=0;skin<2;skin++){
    const base=pos.length/3,from=indices.length,sign=skin===0?1:-1;
    for(let j=0;j<=nX;j++)for(let i=0;i<=nZ;i++){
      const u=i/nZ,v=j/nX,x=x0+h*v,z=z0+w*u;
      const su=Math.sin(Math.PI*u),sv=Math.sin(Math.PI*v);
      const slopeX=amplitude*su*Math.cos(Math.PI*v)*Math.PI/h;
      const slopeZ=amplitude*sv*Math.cos(Math.PI*u)*Math.PI/w;
      const inv=1/Math.hypot(1,slopeX,slopeZ);
      pos.push(x,-skin*thickness,z);norm.push(0,sign,0);uv.push(...uvAt(z,x));
      bend.push(0,amplitude*su*sv,0);
      tilt.push(-slopeX*inv*sign,(inv-1)*sign,-slopeZ*inv*sign);
      if(i===nZ||j===nX)continue;
      const a=base+j*(nZ+1)+i,b=a+1,c=a+nZ+1,d=c+1;
      if(skin===0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);
    }
    geo.addGroup(from,indices.length-from,skin);
  }
  geo.addGroup(indices.length,edge.length,2);indices.push(...edge);
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.morphTargetsRelative=true;
  geo.morphAttributes.position=[new T.Float32BufferAttribute(bend,3)];
  geo.morphAttributes.normal=[new T.Float32BufferAttribute(tilt,3)];
  geo.setIndex(indices);geo.computeBoundingSphere();
  return geo;
}
