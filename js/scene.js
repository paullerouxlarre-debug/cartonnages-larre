import * as T from '../assets/vendor/three.module.min.js';
import {makeCarton} from './etui.js';
import {buildWorkshop} from './atelier.js';
import {addSurfaceFinish,ease,mix,keys} from './matiere.js';

const path=[
  [0,-13.05],[2,-11.56],[3.7,-9.60],[5.5,-7.55],[7.30,-5.50],[9.10,-3.45],
  [10.50,-1.72],[12.94,2.10],[14.95,2.10],[17.22,4.79],[18.50,5.22],
  [21.40,7.48],[22.40,8.32],[25.10,10.58],[28.12,13.85],[29.50,15.85],
  [32.0,18.90],[44,18.90]
];

// Travel and camera choreography share the same timeline. Positions are offsets from the sheet.
const shots=[
  [0,4.9,4.7,7.6, 2.1,.12,0],
  [2,3.42,4.59,5.84, 1.05,.10,.18],
  [5.5,1.18,5.44,3.86, .32,.10,.39],
  [9.10,1.70,4.26,4.34, -.06,.13,.32],
  [10.50,3.38,3.95,4.78, .34,.24,.13],
  [13.28,-2.31,1.74,5.09, .0,.45,.15],
  [14.95,-2.26,1.38,5.0, .0,.45,.15],
  [17.08,2.98,4.08,4.78, .15,.07,.08],
  [18.50,3.2,3.38,5.27, .72,.19,0],
  [22.4,2.8,3.05,4.40, .0,.19,0],
  [26.47,1.15,3.74,4.78, .08,.13,0],
  [29.50,3.80,4.40,6.12, 1.20,0,0],
  [32.1,2.4,3.91,5.11, .05,-.05,0],
  [33.75,3.32,3.80,6.30, .65,.0,0],
  [35.78,.67,4.56,10.18, 2.30,.29,0],
  [37.48,.52,3.54,9.40, 2.32,.33,0],
  [37.52,2.77,2.66,3.92, .0,.06,0],
  [40,2.14,1.50,3.42, 0,.06,0],
  [44,2.47,1.24,3.70, 0,.07,0]
];
function viewAt(t){
  let j=1;
  while(j<shots.length-1 && t>shots[j][0])j++;
  const a=shots[j-1], b=shots[j], u=ease(a[0],b[0],t);
  return a.slice(1).map((v,i)=>mix(v,b[i+1],u));
}

function reflections(renderer) {
  const room=new T.Scene();
  room.background=new T.Color(.18,.23,.27);
  const card=(x,y,z,w,h,colour)=>{
    const plane=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:colour,side:T.DoubleSide}));
    plane.position.set(x,y,z);plane.lookAt(0,0,0);room.add(plane);
  };
  card(1,6,1,13,4,new T.Color(5,5.1,4.6));
  card(-5,2,1,3,7,new T.Color(1.4,2.5,2.3));
  card(6,0,-3,3,7,new T.Color(2.9,1.43,.76));
  card(0,-5,0,15,15,new T.Color(.10,.14,.16));
  const generator=new T.PMREMGenerator(renderer);
  const env=generator.fromScene(room,.016,.1,30);
  generator.dispose();
  room.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
  return env;
}

export function atelierRenderer(canvas) {
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',
    preserveDrawingBuffer:false});
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.89;
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene();
  scene.background=new T.Color(0x283d43);
  scene.fog=new T.FogExp2(0x31464a,.044);
  const env=reflections(renderer);
  scene.environment=env.texture;
  const sky=new T.HemisphereLight(0xe4f8fa,0x9d8569,.65);
  scene.add(sky);
  const key=new T.DirectionalLight(0xffe9c8,2.42);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.5,far:38});
  key.shadow.normalBias=.015;key.shadow.bias=-.00045;
  scene.add(key,key.target);
  const fill=new T.DirectionalLight(0x9bd5da,.80);
  fill.position.set(-5,4,-7);scene.add(fill);
  const accent=new T.PointLight(0xffcb97,15,12,2);accent.position.set(36.0,5.5,2.4);scene.add(accent);
  const camera=new T.PerspectiveCamera(40,1,.08,100);
  addSurfaceFinish();
  const world=buildWorkshop(scene), carton=makeCarton(scene);
  const aim=new T.Vector3(), eye=new T.Vector3();
  let width=0,height=0,mobile=false;
  function resize() {
    const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
    if(width===w && height===h)return;
    width=w;height=h;mobile=w/h<1.18;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,w<700?1.55:1.65));
    renderer.setSize(w,h,false);camera.aspect=w/h;
    camera.fov=mobile?48:40;camera.updateProjectionMatrix();
  }
  function draw(time,turn=0) {
    resize();
    const t=Math.min(44,Math.max(0,time));
    const arriving=t>=37.50;
    const press=ease(12.94,13.81,t)*(1-ease(14.14,14.95,t));
    const transfer=ease(16.83,19.0,t);
    const lift=ease(37.72,39.65,t);
    const erected=ease(39.18,41.64,t);
    const flap=ease(41.54,43.71,t);
    const departure=ease(33.72,35.48,t), drive=ease(35.64,37.55,t);
    const flatX=keys(path,t);
    const x=arriving?34+2.84*ease(38.1,41.3,t):flatX+departure*4.48+drive*4.6;
    const y=arriving?1.29+1.57*lift-.37*ease(41.95,43.99,t):1.685+press*.94+Math.sin(transfer*Math.PI)*1.20
      -.45*ease(30.12,32.00,t)+departure*1.43;
    const z=arriving?-.30+.36*lift:0;
    const roll=arriving?0:Math.PI*(1-transfer);
    const yaw=arriving?mix(.16,-.47,lift)+turn*erected:0;
    carton.pose({x,y,z,roll,yaw,rise:arriving?lift*Math.PI/2:0,
      foldLeft:ease(20.37,24.66,t),foldBack:ease(23.11,27.95,t),
      open:erected,close:flap,scrap:ease(15.02,17.41,t),cut:ease(13.79,14.28,t),
      glue:ease(21.32,23.45,t),printedAt:flatX});
    carton.pivot.visible=arriving||t<33.57;
    for(const [roll,r,sign] of world.rollers)roll.rotation.z=(flatX+13.05)/r*sign;
    world.platen.position.y=press*.94;
    world.crate.close(ease(32.05,33.37,t));
    world.load.position.set(18.9+departure*4.48+drive*4.6,.02+departure*1.43,0);
    world.van.position.x=25.95+drive*4.6;
    world.liftCart.position.copy(world.load.position);world.liftCart.position.y-=.014;
    world.liftCart.visible=!arriving;
    world.van.visible=world.load.visible=!arriving;
    const shot=viewAt(t), lead=x;
    const cameraBaseY=arriving?y:Math.min(y,2.0);
    const factor=mobile?1.16:1;
    eye.set(lead+shot[0]*factor,cameraBaseY+shot[1]*factor,z+shot[2]*factor);
    aim.set(lead+shot[3],cameraBaseY+shot[4],z+shot[5]);
    camera.position.copy(eye);camera.lookAt(aim);
    if(!mobile)camera.setViewOffset(width,height,-width*.095,-height*.025,width,height);
    else camera.clearViewOffset();
    key.position.set(x-3.5,11.4,6.1);key.target.position.set(x,1.2,0);
    renderer.render(scene,camera);
  }
  return {draw};
}
