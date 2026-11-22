import * as T from '../assets/vendor/three.module.min.js';
import {RGBELoader} from '../assets/vendor/RGBELoader.js';
import {makePressSheet,makeStrippedSheet,makeBlankPile,makeCarton} from './etui.js';
import {buildStation} from './atelier.js';
import {box,group,ease,mix} from './matiere.js';
import {loadingProps} from './logistique.js';
import {applicator,depositAt,glueValve} from './colle.js';

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
function folded(carton,x,y,z,extra={}) {
  carton.pose({x,y,z,roll:Math.PI,foldLeft:1,foldBack:1,glue:1,...extra});
}
function packingTable(g,props,x=0) {
  box(g,x,benchHeight-.022,0,1.7,.044,.89,props.wood);
  for(const dx of [-.74,.74])for(const dz of [-.34,.34])box(g,x+dx,.439,dz,.043,.878,.043,metal);
}
function stockAtDelivery(props,g,x) {return props.sheetLoad(g,x,true,1.093);}

function unpackingPosition(s){
  const shift=ease(1.14,2.56,s);
  const y=benchHeight+.216+.340*ease(0,1.14,s)-.4558*ease(3.90,5.06,s);
  return {x:mix(.48,-.09,shift),y,z:mix(-.29,.08,shift)};
}

function stationSet(scene,id,props) {
  const root=group(scene);
  root.rotation.y=[.35,-1.05,1.52,-.52,2.63][id];
  floor(root);
  const kind=['offset','decoupe','collage'][id];
  const machine=kind?buildStation(root,kind):null;
  let update;
  if(id===0){
    props.sheetLoad(root,-3.15,false,1.157);
    stockAtDelivery(props,root,2.95);
    const sheet=makePressSheet(root);
    update=t=>{
      let x,y,ink;
      if(t<4.8){
        const feed=ease(1.7,4.8,t);
        x=-3.15+feed*1.16;y=1.161+Math.sin(feed*Math.PI)*.042;ink=0;
      }else if(t<9.1){
        x=mix(-2.10,1.88,(t-4.8)/4.3);y=paperY;ink=ease(-1.75,1.54,x);
      }else{
        const phase=((t-9.1)/1.48)%1;
        x=mix(2.06,2.95,ease(0,.7,phase));y=mix(1.178,1.095,ease(.50,.93,phase));ink=1;
      }
      sheet.pivot.position.set(x,y,0);sheet.setInk(ink);
      machine.animate(t,{press:0,travel:t*1.2,cutaway:t>=5.85&&t<9.1?1:0,feeder:ease(1.50,2.1,t)*(1-ease(2.5,3.4,t))});
    };
  }else if(id===1){
    props.sheetLoad(root,-2.05,true,1.156);
    props.batches(root,1.65,0,.147);
    const sheet=makePressSheet(root),strip=makeStrippedSheet(root);
    sheet.setInk(1);
    update=t=>{
      const s=t-14,press=ease(4.7,5.36,s)*(1-ease(5.67,6.32,s));
      sheet.pivot.visible=s<7;strip.pivot.visible=s>=7;
      sheet.pivot.position.set(mix(-2.05,-.55,ease(1.35,4.55,s)),paperY+.044*press,0);
      strip.pivot.position.set(mix(.55,1.65,ease(8.5,10.8,s)),mix(paperY,.147+.2935,ease(10.4,11.8,s)),0);
      strip.setSeparation(ease(7.2,8.73,s));
      machine.animate(s,{press,travel:s,cutaway:s>=3.9?1:0,stripping:ease(7,7.7,s)*(1-ease(8.2,8.8,s)),feeder:ease(1.2,1.7,s)*(1-ease(2.1,3.15,s))});
    };
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
      carton.pose({x,y:surface(angle),z:0,roll:Math.PI,rise:angle,foldLeft:ease(-.73,.30,x),foldBack:ease(.29,1.43,x),open:0,close:0,glue:depositAt(x)});
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
    const pack=props.crate(table,0,benchHeight,0), carton=makeCarton(table);
    for(let i=0;i<16;i++) {
      const sample=makeCarton(table);
      folded(sample,0,benchHeight+.007+i*.0034,0);
    }
    const dock=group(root);
    const van=props.vehicle(dock);van.position.z=-4;
    box(dock,-2.86,1.073,-4,1.50,.065,2.23,metal);
    for(const z of [-4.72,-3.28])box(dock,-2.86,.79,z,1.38,.35,.085,metal);
    const load=props.pallet(dock,-3.2,-4);
    for(let j=0;j<2;j++)for(const x of [-.25,.25])for(const z of [-.25,.25])props.crate(load,x,.147+j*.27,z,false);
    update=t=>{
      const s=t-38,placing=ease(0,1.38,s),loading=ease(4.3,6.95,s);
      table.visible=t<42;dock.visible=!table.visible;
      folded(carton,0,mix(benchHeight+.40,benchHeight+.0614,placing),mix(.012,0,placing));
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
  [2.45,0,[-3.09,1.166,.11],[-.61,.27,.62],1.11,.94],
  [4.8,0,[-.56,1.22,.03],[-.40,.29,1.10],1.04,.88],
  [7,0,[.85,1.18,.03],[.34,.52,.87],1.20,1.06],
  [9.1,0,[2.91,1.095,0],[1.28,.77,.08],1.61,1.51],
  [11.7,0,[2.95,.75,.04],[1.29,.73,.18],2.11,2.42],
  [14,1,[-1.87,.91,.02],[-.98,.63,1.32],2.12,1.75],
  [17.9,1,[-.55,1.17,-.05],[-.21,.31,1],.96,.84],
  [21,1,[.56,1.115,.02],[.12,.69,.81],1.13,1.08],
  [23.6,1,[1.65,.41,0],[1,.72,.32],1.43,1.36],
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
  scene.environment=scene.background=env;scene.backgroundBlurriness=.075;scene.backgroundIntensity=.43;
  concrete.colorSpace=T.SRGBColorSpace;concrete.wrapS=concrete.wrapT=T.RepeatWrapping;concrete.repeat.set(9,7);concrete.anisotropy=8;
  floorMat.map=concrete;floorMat.color.set(0xb6b8b0);
  wood.colorSpace=T.SRGBColorSpace;wood.anisotropy=8;
  const props=loadingProps(wood),sets=new Map();
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
    if(k===2)aim.x=mix(-1.51,-.38,v);
    if(k===3)aim.x=mix(.46,1.45,v);
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
    if((t>=4 && t<5.85)||(t>=14 && t<15.65)||(t>=26 && t<27.55)){
      const midpoint=id===0?-.08:id===1?-.10:.02;
      aim.set(midpoint,1.11,0);
      direction.set(id===1?-1.1:-1.48,.65,2.1).normalize();
      distance=(id===0?7.9:id===1?5.7:6.75)*(vertical?1.23:1);
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
