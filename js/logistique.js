import * as T from '../assets/vendor/three.module.min.js';
import {box, group, cylinder, ease} from './matiere.js';
import {makePressSheet,makeBlankPile} from './etui.js';

const material=(color,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const zinc=material(0x9aa3a3,.31,.78), steel=material(0x363b3b,.44,.63);
const cardboard=material(0xb09169,.87), liner=material(0xbca07b,.9);
const tape=material(0xc3aa82,.33), tire=material(0x292c2b,.85), white=material(0xc5c8c3,.39,.55);
const one=new T.BoxGeometry(1,1,1);
function texture(canvas) {
  const m=new T.CanvasTexture(canvas);m.colorSpace=T.SRGBColorSpace;m.anisotropy=8;
  return m;
}
function stackEdge() {
  const c=document.createElement('canvas');c.width=256;c.height=1536;
  const ctx=c.getContext('2d');
  let seed=245;
  for(let i=0;i<c.height;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const v=200+(seed%31)-(i%63===0?24:0);
    ctx.fillStyle='rgb('+[v+3,v,v-9].join(',')+')';ctx.fillRect(0,i,256,1);
  }
  return materialWithMap(texture(c),.92);
}
function materialWithMap(map,roughness){return new T.MeshStandardMaterial({map,roughness});}

function caseFinish() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#b79772';ctx.fillRect(0,0,512,512);
  let seed=37;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let n=0;n<52000;n++){
    ctx.fillStyle=rand()>.48?'rgba(62,43,20,.11)':'rgba(255,236,204,.16)';
    ctx.fillRect(rand()*512,rand()*512,.5+rand()*3.5,.45+rand()*1.3);
  }
  for(let x=0;x<512;x+=8){ctx.fillStyle='rgba(75,48,25,.045)';ctx.fillRect(x,0,2,512);}
  const map=texture(canvas);
  cardboard.map=liner.map=map;cardboard.color.set(0xe3d3bd);liner.color.set(0xebddca);
  const tag=document.createElement('canvas');tag.width=480;tag.height=280;
  const tx=tag.getContext('2d');tx.fillStyle='#ede8d9';tx.fillRect(0,0,480,280);
  tx.fillStyle='#2d3531';tx.font='bold 48px sans-serif';tx.fillText('LARRÉ',24,63);
  tx.font='20px sans-serif';tx.fillText('BAYONNE   /   ÉTUIS PLIANTS',25,97);
  for(let x=26;x<435;){const width=2+Math.floor(rand()*6);tx.fillRect(x,144,width,70);x+=width+2+Math.floor(rand()*5);}
  tx.font='17px monospace';tx.fillText('ATELIER   •   MODÈLE D’ÉTUDE',25,245);
  return materialWithMap(texture(tag),.81);
}

export function loadingProps(woodMap) {
  const label=caseFinish();
  const wood=materialWithMap(woodMap,.86), rims=stackEdge(), paper=material(0xe2dfd3,.84);
  function pallet(parent,x,z) {
    const p=group(parent,x,0,z);
    for(const a of [-.41,0,.41]) {
      box(p,a,.011,0,.14,.022,1.16,wood);
      for(const b of [-.487,0,.487])box(p,a,.063,b,.14,.082,.14,wood);
    }
    for(const b of [-.48,0,.48])box(p,0,.112,b,.97,.021,.14,wood);
    for(let i=0;i<7;i++) {
      const x=(i-3)*.14;
      box(p,x,.135,0,.122,.024,1.16,wood);
      for(const z of [-.48,.48])cylinder(p,x,.148,z,.003,.001,zinc,'y');
    }
    return p;
  }
  function sheetLoad(parent,x,printed,top=1.15,z=0){
    const p=pallet(parent,x,z);
    const height=top-.147;
    const body=new T.Mesh(one,[rims,rims,paper,paper,rims,rims]);
    body.castShadow=body.receiveShadow=true;
    body.scale.set(.748,height,1.02);body.position.y=.147+height/2;p.add(body);
    const face=makePressSheet(p);face.setInk(printed?1:0);face.pivot.position.y=top+.00075;
    return p;
  }
  function batches(parent,x,z,under=.147) {
    const p=pallet(parent,x,z);
    for(const dx of [-.1835,.1835]) for(const dz of [-.239,.239]) {
      const batch=makeBlankPile(p,{count:610});
      batch.pivot.position.set(dx,under,dz);
    }
    return p;
  }
  function crate(parent,x,y,z,open=true) {
    const p=group(parent,x,y,z), a=.245,b=.237,h=.25,wall=.004;
    box(p,0,.002,0,2*a,wall,2*b,cardboard);
    for(const s of [-1,1]){
      box(p,s*a,h/2,0,wall,h,2*b-wall,cardboard);
      box(p,0,h/2,s*b,2*a+wall,h,wall,liner);
    }
    const sticker=new T.Mesh(new T.PlaneGeometry(.118,.069),label);
    sticker.position.set(-.090,.13,b+.0023);p.add(sticker);
    const sideTag=sticker.clone();sideTag.rotation.y=-Math.PI/2;sideTag.position.set(-a-.0023,.13,.024);p.add(sideTag);
    // The inner pair seats below the outer pair, with clearance for board thickness.
    const flaps=[];
    for(const sign of [-1,1]) {
      const inner=group(p,sign*a,h+.001,0);
      const outer=group(p,0,h+wall+.0025,sign*b);
      box(inner,-sign*.092,0,0,.184,wall,2*b-.012,cardboard);
      box(outer,0,0,-sign*(b-.0012)/2,2*a-.006,wall,b-.0012,liner);
      flaps.push({inner,outer,sign});
    }
    const seam=box(p,0,h+wall+.0025+wall/2+.00055,0,1,.001,.036,tape);
    const close=u=>{
      for(const {inner,outer,sign} of flaps){
        const lag=sign>0?.045:0;
        inner.rotation.z=-sign*2.42*(1-ease(lag,.40+lag,u));
        outer.rotation.x=sign*2.42*(1-ease(.46+lag,.80+lag,u));
      }
      const seal=ease(.855,1,u);
      const length=(2*a-.006)*seal;
      seam.visible=length>.0001;
      seam.scale.x=Math.max(.0001,length);
      seam.position.x=-a+.003+length/2;
    };
    close(open?0:1);return {pivot:p,close};
  }
  function vehicle(parent) {
    const g=group(parent);
    // The open tail faces -X. A cut from the packing table establishes the loading dock.
    box(g,.35,1.04,0,4.95,.13,2.44,zinc);
    for(const s of [-1,1]){
      box(g,.35,2.32,s*1.22,4.95,2.45,.045,white);
      box(g,.35,1.27,s*1.25,4.95,.085,.012,zinc);
      for(let i=0;i<12;i++)box(g,-1.82+i*.40,2.33,s*1.247,.012,2.23,.011,zinc);
      const door=group(g,-2.12,2.32,s*1.22);
      box(door,-.60,0,0,1.20,2.44,.045,white);
      box(door,-.65,0,s*.035,.024,2.15,.02,zinc);
      door.rotation.y=-s*.48;
      for(const x of [-.99,2.99]){
        cylinder(g,x,.44,s*1.1,.44,.22,tire);
        cylinder(g,x,.44,s*1.224,.232,.038,zinc);
      }
    }
    box(g,.35,3.56,0,5,.055,2.48,white);
    box(g,2.82,2.3,0,.06,2.45,2.4,white);
    box(g,3.49,1.52,0,1.25,1.5,2.25,white);
    box(g,3.55,2.34,0,1.12,.65,2.18,steel);
    for(let j=0;j<3;j++)for(let i=0;i<3;i++)box(g,.30+i*.66,1.29+j*.38,-.53,.65,.375,.65,cardboard);
    return g;
  }
  return {pallet,sheetLoad,batches,crate,vehicle,wood};
}
