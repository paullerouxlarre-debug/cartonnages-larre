import * as T from '../assets/vendor/three.module.min.js';
import {RGBELoader} from '../assets/vendor/RGBELoader.js';
import {makeBlankPile,makeCarton} from './etui.js';
import {buildStation} from './atelier.js';
import {box,group,ease,mix} from './matiere.js';
import {loadingProps} from './logistique.js';
import {applicator,depositAt,glueValve} from './colle.js';
import {offsetPass} from './impression.js';
import {cuttingPass} from './decoupe.js';

const duration=52, paperY=1.16;
const vector=(x,y,z)=>new T.Vector3(x,y,z);
const stockPath='assets/matieres/';
const coating=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
const floorMat=coating(0x858783,.79,.04), metal=coating(0x444b4a,.42,.65);
const benchHeight=.91;

function floor(parent) {
  box(parent,0,-.056,0,24,.11,18,floorMat);
  for(const x of [-8,-4,0,4,8])box(parent,x,.0002,0,.007,.001,18,metal);
}
// Board edges seen on a packed row: a fine stripe for every carton.
let edgeCache;
function edgeMaterial(){
  if(edgeCache)return edgeCache;
  const c=document.createElement('canvas');c.width=16;c.height=64;
  const x=c.getContext('2d');x.fillStyle='#efe9dc';x.fillRect(0,0,16,64);
  for(let i=0;i<8;i++){x.fillStyle=i%2?'#c9bfaa':'#b3a891';x.fillRect(0,i*8,16,1.4);}
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;
  map.repeat.set(1,58/8);
  edgeCache={side:new T.MeshStandardMaterial({map,roughness:.85}),plain:new T.MeshStandardMaterial({color:0xe9e3d6,roughness:.85})};
  return edgeCache;
}

// The workshop around the machines: a high steel hall with a concrete floor, painted walkways,
// skylights, racking, pallets of board and other lines in the distance. It replaces the blurred
// photograph, so every shot has a coherent, steady background.
function hall(scene,props) {
  const g=group(scene);
  const wall=coating(0xd9d8d1,.9), plinth=coating(0x5d6d68,.8), steel=coating(0x56646a,.5,.5);
  const roof=coating(0xbfc1bd,.9), glow=new T.MeshBasicMaterial({color:0xfdf8ea});
  const sky=new T.MeshBasicMaterial({color:0xeef1f0}), line=coating(0xe2b934,.6);
  const orange=coating(0xd8662c,.55,.2), blue=coating(0x2f5a85,.55,.3);
  const pearl=coating(0xdedfd9,.4,.3), graphite=coating(0x3a4042,.5,.4);
  const board=coating(0xe6dfcd,.9), kraft=coating(0xb48a5a,.85);
  const W=15,Dz=12,H=8.5;
  box(g,0,-.056,0,2*W,.11,2*Dz,floorMat);
  // Walkways painted on the floor, kept outside the machine footprints.
  for(const z of [-7.2,-5.8,5.8,7.2])box(g,0,.001,z,2*W-2,.002,.08,line);
  for(const x of [-10.5,-9.1,9.1,10.5])box(g,x,.001,0,.08,.002,2*Dz-2,line);
  // Walls: a dark plinth, light cladding with ribs, a band of windows.
  for(const s of [-1,1]){
    box(g,0,1.2,s*Dz,2*W,2.4,.2,plinth);
    box(g,0,5.4,s*Dz,2*W,6,.2,wall);
    box(g,0,4.3,s*(Dz-.11),2*W-1,1.1,.02,sky);
    box(g,s*W,1.2,0,.2,2.4,2*Dz,plinth);
    box(g,s*W,5.4,0,.2,6,2*Dz,wall);
    box(g,s*(W-.11),4.3,0,.02,1.1,2*Dz-1,sky);
    for(let x=-W+1;x<W;x+=1.2)box(g,x,5.4,s*(Dz-.12),.04,6,.04,roof);
  }
  // Portal frames every five metres, with lamps hanging from them, and skylights between.
  for(let x=-12.5;x<=12.5;x+=5){
    for(const z of [-Dz+.3,Dz-.3])box(g,x,H/2,z,.3,H,.22,steel);
    box(g,x,H-.15,0,.22,.4,2*Dz,steel);
    for(let z=-8;z<=8;z+=4){
      box(g,x,H-1.3,z,.02,2.2,.02,graphite);
      const lamp=new T.Mesh(new T.CylinderGeometry(.28,.36,.22,20),graphite);lamp.position.set(x,H-2.5,z);g.add(lamp);
      const bulb=new T.Mesh(new T.CircleGeometry(.3,20),glow);bulb.rotation.x=Math.PI/2;bulb.position.set(x,H-2.615,z);g.add(bulb);
    }
  }
  box(g,0,H+.1,0,2*W,.2,2*Dz,roof);
  for(let x=-10;x<=10;x+=5)box(g,x,H-.01,0,1.6,.02,2*Dz-2,sky);
  // Pallet racking along the back wall: blue uprights, orange beams, loads of board and cases.
  for(const [z,s] of [[-Dz+.8,1],[Dz-.8,-1]])for(let x=-12;x<=12;x+=2.8){
    for(const dx of [-1.35,1.35])for(const dz of [-.5,.5])box(g,x+dx,2.6,z+dz,.08,5.2,.08,blue);
    for(const y of [.15,1.8,3.45])for(const dz of [-.5,.5]){
      box(g,x,y,z+dz,2.7,.12,.06,orange);
    }
    for(const y of [.21,1.86,3.51])for(const dx of [-.66,.66]){
      const kind=(Math.round(x*3+y*5+dx*7)%3+3)%3;
      if(kind===0){box(g,x+dx,y+.06,z,1.2,.12,1.0,coating(0xa77b4f,.85));box(g,x+dx,y+.5,z,1.0,.75,.95,board);}
      else if(kind===1){box(g,x+dx,y+.06,z,1.2,.12,1.0,coating(0xa77b4f,.85));box(g,x+dx,y+.6,z,1.1,.95,.95,kraft);}
    }
  }
  // Other lines in the distance: a second press, a folder-gluer and a cutting table.
  function machine(x,z,len,h,ry){
    const m=group(g,x,0,z);m.rotation.y=ry;
    box(m,0,.3,0,len,.6,1.4,graphite);
    for(let i=0;i<Math.floor(len/1.1);i++)box(m,-len/2+.55+i*1.1,h/2+.3,0,.95,h,1.5,pearl);
    box(m,0,h+.4,0,len,.12,1.0,coating(0x8f989e,.4,.4));
    box(m,len/2+.4,.7,0,.6,1.4,1.2,pearl);
  }
  machine(-6,-9.2,7.5,1.7,0);
  machine(7,-9.2,5,1.1,0);
  machine(-7,9.2,6,1.3,0);
  machine(6,9.2,4,1.0,0);
  // Pallets waiting on the floor along the walls.
  for(const [x,z] of [[-13.4,-6],[-13.4,-3.6],[-13.4,3.6],[13.4,-4.8],[13.4,2.4],[13.4,4.8],[-13.4,6]]){
    const p=props.pallet(g,x,z);
    box(p,0,.6,0,1.0,.95,1.05,(x+z)%2?board:kraft);
  }
  g.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});
  return g;
}

function folded(carton,x,y,z,extra={}) {
  carton.pose({x,y,z,roll:Math.PI,foldLeft:1,foldBack:1,glue:1,...extra});
}
function packingTable(g,props,x=0) {
  box(g,x,benchHeight-.022,0,1.7,.044,.89,props.wood);
  for(const dx of [-.74,.74])for(const dz of [-.34,.34])box(g,x+dx,.439,dz,.043,.878,.043,metal);
}

function unpackingPosition(s){
  const shift=ease(1.14,2.56,s);
  const y=benchHeight+.216+.340*ease(0,1.14,s)-.4558*ease(3.90,5.06,s);
  return {x:mix(.48,-.09,shift),y,z:mix(-.29,.08,shift)};
}

function stationSet(scene,id,props) {
  const root=group(scene);
  root.rotation.y=[.35,-1.05,1.52,-.52,2.63][id];
  const kind=['offset','decoupe','collage'][id];
  const machine=kind?buildStation(root,kind):null;
  let update;
  if(id===0){
    update=offsetPass(root,props,machine);
  }else if(id===1){
    update=cuttingPass(root,props,machine);
  }else if(id===2){
    const pile=makeBlankPile(root,{count:160});
    pile.pivot.rotation.x=Math.PI;pile.pivot.position.set(-2.65,paperY+pile.height+.001,0);
    const carton=makeCarton(root);
    const shingle=Array.from({length:15},()=>makeCarton(root));
    const valve=glueValve(root,paperY+.0012+.00048+.00065);
    update=t=>{
      const s=t-26;
      let x;
      if(s<3) x=mix(-2.65,-1.060,ease(.8,3,s));
      else if(s<5.52) x=mix(-1.060,-.831,(s-3)/2.52);
      else if(s<6.1) x=mix(-.831,-.55,(s-5.52)/.58);
      else if(s<10) x=mix(-.55,1.85,(s-6.1)/3.9);
      else x=mix(1.85,2.80,(s-10)/2);
      const incline=along=>.046*ease(1.82,2.07,along);
      const surface=angle=>paperY+.0012+.183*Math.sin(angle);
      const angle=incline(x);
      // The flap takes the fold of the belt at its leading end, so the belt never runs through it.
      const lead=x+.0975;
      carton.pose({x,y:surface(angle),z:0,roll:Math.PI,rise:angle,foldLeft:ease(-.73,.30,lead),foldBack:ease(.29,1.43,lead),open:0,close:0,glue:depositAt(x)});
      valve(x);
      shingle.forEach((next,i)=>{
        const lead=x+(i+1)*.091;
        next.pivot.visible=lead>1.92 && lead<3.80 && s>8;
        if(next.pivot.visible) folded(next,lead,surface(incline(lead)),0,{rise:incline(lead)});
      });
      machine.animate(s,{press:0,travel:x+2.65,cutaway:s>2.5?1:0,feeder:0});
    };
  }else if(id===3){
    const table=group(root);
    packingTable(table,props);
    const pack=props.crate(table,0,benchHeight,0);
    // Packed by hand: two piles of flat cartons laid lengthwise in the case, side by side.
    // The first pile is already in; the last one is lowered into its place.
    const edges=edgeMaterial(), floorY=benchHeight+.006, count=58, pileH=count*.0034;
    function pile(parent,z){
      const g=group(parent,0,0,z);
      const b=box(g,0,pileH/2,0,.36,pileH,.212,[edges.side,edges.side,edges.plain,edges.plain,edges.side,edges.side]);
      b.castShadow=b.receiveShadow=true;
      folded(makeCarton(g),0,pileH+.0012,0);
      return g;
    }
    pile(table,-.113).position.y=floorY;
    const last=pile(table,.113);    const carton={pose(){}};
    const dock=group(root);
    const van=props.vehicle(dock);van.position.z=-4;
    box(dock,-2.86,1.073,-4,1.50,.065,2.23,metal);
    for(const z of [-4.72,-3.28])box(dock,-2.86,.79,z,1.38,.35,.085,metal);
    const load=props.pallet(dock,-3.2,-4);
    for(let j=0;j<2;j++)for(const x of [-.25,.25])for(const z of [-.25,.25])props.crate(load,x,.147+j*.27,z,false);
    update=t=>{
      const s=t-38,placing=ease(0,1.38,s),loading=ease(4.3,6.95,s);
      table.visible=t<42;dock.visible=!table.visible;
      last.position.set(mix(.03,0,placing),floorY+mix(.34,0,placing),.113+mix(.06,0,placing));
      last.rotation.x=mix(.16,0,ease(.15,1,placing));
      pack.close(ease(1.42,3.91,s));
      load.position.set(mix(-3.20,-1.05,loading),1.106,-4);
      van.position.x=ease(6.2,7,s)*.21;
    };
  }else{
    packingTable(root,props);
    // The unpacked carton stands on a charcoal cutting mat at the receiving bench.
    box(root,-.24,benchHeight+.001,0,.64,.002,.65,coating(0x3c514e,.85));
    props.crate(root,.48,benchHeight,-.29);
    const carton=makeCarton(root);
    update=(t,turn)=>{
      const s=t-45, position=unpackingPosition(s);
      carton.pose({...position,rise:ease(1.63,2.72,s)*Math.PI/2,yaw:-.24+turn,
        foldLeft:1,foldBack:1,glue:1,open:ease(2.25,3.68,s),
        closeBottom:ease(3.65,4.65,s),closeTop:ease(5.07,6.62,s)});
    };
  }
  return {root,update};
}

// Each shot has a cut, an optical axis and its own subject distance, in metres.
const shots=[
  [0,0,[-2.97,.79,.02],[-1.28,.66,1.20],2.98,2.49],
  [2.45,0,[-2.55,1.17,.02],[.95,.2,.42],.9,.78],
  [4.7,0,[-.15,1.10,0],[.04,.42,1],2.35,2.15],
  [7,0,[.85,1.20,0],[.22,.85,1],2.45,2.25],
  [9.1,0,[5.85,1.12,0],[.85,.85,1],1.85,1.70],
  [11.7,0,[5.95,.95,0],[1.05,.50,1],2.45,2.65],
  [14,1,[-1.87,.91,.02],[-.98,.63,1.32],2.12,1.75],
  [17.9,1,[-.55,1.14,-.05],[-.25,.17,1],1.25,1.10],
  [20.75,1,[.55,.90,.05],[.30,.30,1],1.62,1.50],
  [23.6,1,[1.65,1.10,0],[.62,.62,.62],1.45,1.30],
  [26,2,[-2.60,1.20,0],[-.51,.38,.70],1.12,.87],
  [29,2,[applicator.x,1.168,applicator.z],[.29,.70,.60],.158,.138],
  [32,2,[.36,1.19,.05],[.24,.58,.74],.87,.94],
  [36,2,[2.31,1.16,.01],[.41,.41,.74],1.05,.91],
  [38,3,[0,1.105,0],[-.37,.86,.58],1.42,1.27],
  [42,3,[-2.12,1.6,-4],[-2.25,.6,.36],4.36,4.74],
  [45,4,[.17,1.15,-.04],[-.35,.26,.43],.85,.68],
  [47.6,4,[-.09,1.017,.08],[-.34,.16,.29],.53,.445]
];
function lens(scene,renderer) {
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true});
  target.samples=renderer.capabilities.isWebGL2?2:0;
  target.depthTexture=new T.DepthTexture(1,1);
  const uniforms={colour:{value:target.texture},depthMap:{value:target.depthTexture},pixel:{value:new T.Vector2()},focus:{value:1},near:{value:.012},far:{value:90}};
  const shader=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,vertexShader:'varying vec2 coord; void main(){coord=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 coord;uniform sampler2D colour,depthMap;uniform vec2 pixel;uniform float focus,near,far;
    void main(){float d=texture2D(depthMap,coord).r;float z=near*far/(far-d*(far-near));float blur=min(5.,abs(1.-focus/z)*4.2);
    vec3 c=texture2D(colour,coord).rgb*2.;for(int i=0;i<12;i++){float a=float(i)*2.39996;vec2 p=vec2(cos(a),sin(a))*sqrt((float(i)+.5)/12.);c+=texture2D(colour,coord+pixel*blur*p).rgb;}
    c/=14.; c*=1.-.115*dot(coord-.5,coord-.5);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const pass=new T.Scene();pass.add(new T.Mesh(new T.PlaneGeometry(2,2),shader));
  const flat=new T.Camera();
  return {resize(w,h){target.setSize(w,h);uniforms.pixel.value.set(1/w,1/h);},draw(camera,distance){uniforms.focus.value=distance;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(pass,flat);}};
}

export async function atelierRenderer(canvas) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.81;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  const loader=new T.TextureLoader();
  const [env,wood,concrete]=await Promise.all([new RGBELoader().loadAsync(stockPath+'atelier.hdr'),loader.loadAsync(stockPath+'bois.webp'),loader.loadAsync(stockPath+'sol.webp')]);
  env.mapping=T.EquirectangularReflectionMapping;
  // The photographed workshop only lights and reflects; the hall itself is modelled.
  scene.environment=env;scene.environmentIntensity=.9;
  scene.background=new T.Color(0xcfcdc5);scene.fog=new T.Fog(0xcfcdc5,11,34);
  concrete.colorSpace=T.SRGBColorSpace;concrete.wrapS=concrete.wrapT=T.RepeatWrapping;concrete.repeat.set(11,9);concrete.anisotropy=8;
  floorMat.map=concrete;floorMat.color.set(0xb6b8b0);
  wood.colorSpace=T.SRGBColorSpace;wood.anisotropy=8;
  const props=loadingProps(wood),sets=new Map();
  hall(scene,props);
  const sun=new T.DirectionalLight(0xfff2e1,.98);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{near:.05,far:25,left:-2,right:2,top:2,bottom:-2});
  sun.shadow.normalBias=.00022;sun.shadow.bias=-.00009;scene.add(sun,sun.target);
  scene.add(new T.HemisphereLight(0xeaf0ff,0x857a6e,.12));
  const camera=new T.PerspectiveCamera(38,1,.012,90),grading=lens(scene,renderer);
  let width=0,height=0,previous=-1;
  function draw(time,turn=0){
    const t=Math.min(duration,Math.max(0,time));
    let k=shots.length-1;while(k>0&&shots[k][0]>t)k--;
    const [start,id,p,axis,from,to]=shots[k],end=shots[k+1]?.[0]||duration;
    if(previous!==id){
      if(sets.has(previous))sets.get(previous).root.visible=false;
      if(!sets.has(id))sets.set(id,stationSet(scene,id,props));
      sets.get(id).root.visible=true;previous=id;
    }
    const set=sets.get(id);set.update(t,turn);
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    if(width!==w||height!==h){
      width=w;height=h;
      const ratio=Math.min(window.devicePixelRatio||1,1.5);
      renderer.setPixelRatio(ratio);renderer.setSize(w,h,false);grading.resize(Math.round(w*ratio),Math.round(h*ratio));
      camera.aspect=w/h;camera.updateProjectionMatrix();
    }
    const v=ease(start,end,t),vertical=w/h<1.22;
    const aim=vector(...p), direction=vector(...axis).normalize();
    // Follow one sheet through the first units, then sweep along the six colours and the varnish.
    if(k===2)aim.x=mix(-1.9,.45,v);
    if(k===3)aim.x=mix(.7,4.5,v);
    // Track the stock from the feeder until the next tool takes over.
    if(start===14){
      const advance=ease(15.35,18.55,t);
      aim.set(mix(-2.05,-.55,advance),paperY,.03);
    }
    if(start===26){
      const advance=ease(26.8,29,t);
      aim.set(mix(-2.65,-1.42,advance),paperY+.025,.07);
    }
    if(k===8)aim.x+=ease(22.3,23.6,t)*.48;
    if(k===12)aim.x=mix(-.20,1.28,v);
    if(k===13)aim.x=mix(1.92,2.69,v);
    if(id===4){
      const {x,y,z}=unpackingPosition(t-45);
      aim.set(x,y+.012,z);
    }
    let distance=mix(from,to,v)*(vertical?1.20:1);
    // Establish each freestanding machine before cutting in to its tool path.
    if((t>=4 && t<4.7)||(t>=14 && t<15.65)||(t>=26 && t<27.55)){
      const midpoint=id===0?1.35:id===1?-.10:.02;
      aim.set(midpoint,1.11,0);
      direction.set(id===1?-1.1:-1.48,.65,2.1).normalize();
      distance=(id===0?10.6:id===1?5.7:6.75)*(vertical?1.23:1);
    }
    aim.applyAxisAngle(vector(0,1,0),set.root.rotation.y);
    direction.applyAxisAngle(vector(0,1,0),set.root.rotation.y);
    camera.position.copy(aim).addScaledVector(direction,distance);camera.lookAt(aim);
    if(!vertical)camera.setViewOffset(w,h,-w*.065,-h*.025,w,h);else camera.clearViewOffset();
    sun.position.copy(aim).add(vector(-3.0,6.5,2.6));sun.target.position.copy(aim);
    const radius=distance<.8?.60:distance<1.6?1.45:3.8;
    Object.assign(sun.shadow.camera,{left:-radius,right:radius,top:radius,bottom:-radius});sun.shadow.camera.updateProjectionMatrix();
    grading.draw(camera,distance);
  }
  return {draw};
}
