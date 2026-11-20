import * as T from '../assets/vendor/three.module.min.js';
import {group,mesh,box,casing,cylinder,bar,plate,softShadow,finish as f,batch} from './matiere.js';
import {units, stock} from './etui.js';

const level=1.68;

function bench(root,x,len,width) {
  box(root,x,1.39,0,len,.19,width,f.satin);
  for(const z of [-width/2,width/2]){
    casing(root,x,1.19,z,len,.32,.09,f.frame,.08);
    for(const dx of [-len*.41,len*.41]){
      casing(root,x+dx,.65,z*.88,.20,1.12,.23,f.porcelain,.03);
      cylinder(root,x+dx,.09,z*.88,.23,.12,f.rubber,'y');
    }
  }
  softShadow(root,x,0,len*1.5,width*1.7);
}

function vent(root,x,y,z,count=6) {
  for(let k=0;k<count;k++)box(root,x+(k-count/2)*.105,y,z,.055,.28,.018,f.iron);
}

function buttonPanel(root,x,y,z) {
  casing(root,x,y,z,.59,.68,.08,f.iron,.06);
  box(root,x,y+.10,z+.05,.41,.24,.015,f.coolGlow);
  for(let i=0;i<3;i++)cylinder(root,x-.15+i*.14,y-.17,z+.065,.045,.04,i===2?f.orange:f.satin);
}

function roller(root,motion,x,y,z,r,len,material,marks=false) {
  const holder=group(motion,x,y,z);
  cylinder(holder,0,0,0,r,len,material);
  if(marks){
    // The gripper gap and polished bearer rings make the rotation visible.
    box(holder,0,r*.994,0,.045,.015,len*.97,f.iron);
    for(const s of [-1,1]){
      cylinder(holder,0,0,s*len*.489,r*1.012,.055,f.steel);
      cylinder(holder,0,0,s*(len*.5+.015),r*.63,.044,f.satin);
      box(holder,0,r*.29,s*(len*.5+.044),.032,r*.42,.012,f.iron);
    }
  }
  return holder;
}

function offset(root,motion) {
  const rollers=[];
  const inks=[0x079cbe,0xd54978,0xf1be30,0x273338];
  // Feeding table and the line of towers seen in the company's side view.
  bench(root,-12.84,3.05,4.55);
  box(root,-13.07,1.49,0,2.50,.30,4.02,f.paper);
  for(let i=0;i<9;i++)box(root,-13.07,1.35+i*.032,2.016,2.50,.007,.01,f.edge);
  for(const z of [-1.85,1.85])bar(root,[-13.65,2.05,z],[-11.57,1.84,z],.038,f.steel);
  bench(root,-6.48,9.68,4.92);
  for(const [n,x] of units.entries()){
    const ink=new T.MeshStandardMaterial({color:inks[n],metalness:.23,roughness:.37});
    casing(root,x,2.71,-2.03,1.80,2.70,1.0,f.chalk,.23);
    casing(root,x,3.88,-1.56,1.63,.34,1.85,f.porcelain,.13);
    for(const dx of [-.64,.64])for(const yy of [1.25,1.52]){
      cylinder(root,x+dx,yy,2.455,.043,.037,f.steel);
      box(root,x+dx,yy,2.477,.042,.007,.005,f.iron);
    }
    for(let j=0;j<5;j++)box(root,x-.53+j*.23,3.97,-1.30,.135,.028,.60,f.frame);
    casing(root,x,1.41,2.28,1.77,.39,.32,f.porcelain,.12);
    casing(root,x,1.03,2.45,1.87,.64,.06,f.frame,.08);
    vent(root,x-.36,1.05,2.491);
    box(root,x,1.54,2.458,1.44,.034,.024,ink);
    const blanket=roller(root,motion,x,2.111,-.82,.43,2.76,f.rubber,true);
    const printing=roller(root,motion,x-.49,2.86,-.84,.46,2.70,f.steel,true);
    const inking=roller(root,motion,x-.20,3.46,-.91,.245,2.48,ink,true);
    const counter=roller(root,motion,x,1.34,0,.32,4.46,f.satin,true);
    rollers.push([blanket,.43,1],[printing,.46,-1],[inking,.245,1],[counter,.32,-1]);
    for(const [dx,yy,rr] of [[0,2.111,.43],[-.49,2.86,.46],[-.20,3.46,.245]]){
      cylinder(root,x+dx,yy,.59,.082,.36,f.steel);
      bar(root,[x+dx,yy,.76],[x+.61,3.02,.76],.046,f.satin);
    }
    for(const side of [-1,1]){
      const z=side<0?-2.26:.72;
      bar(root,[x+.63,1.59,z],[x+.62,3.02,z],.066,f.satin);
      bar(root,[x+.62,3.02,z],[x-.29,3.69,z],.065,f.satin);
      cylinder(root,x+.61,3.02,z,.107,.09,f.copper);
    }
    box(root,x-.18,3.6,-1.4,.52,.07,1.4,f.frame);
  }
  casing(root,-1.67,1.8,-1.72,1.10,2.6,1.42,f.porcelain,.15);
  plate(root,-6.45,.83,2.50,2.02,.258,'OFFSET   /   CMJN');
  buttonPanel(root,-1.70,2.27,-.95);
  return rollers;
}

function diecutter(root,motion) {
  const x=2.10;
  bench(root,x,4.90,4.95);
  // The front is cut away to reveal the moving platen and the fixed cutting forme.
  for(const side of [-1,1]) {
    casing(root,x+side*1.63,2.48,-1.92,.61,2.75,1.35,f.porcelain,.15);
    cylinder(root,x+side*1.55,2.17,2.01,.102,1.69,f.steel,'y');
    cylinder(root,x+side*1.55,1.49,2.01,.17,.25,f.frame,'y');
  }
  casing(root,x,3.55,-1.07,3.94,.88,2.65,f.chalk,.19);
  casing(root,x,3.04,-.04,3.58,.18,4.06,f.iron,.035);
  box(root,x,2.90,-.02,3.26,.18,3.96,f.wood);
  for(const side of [-1,1])for(const z of [-1.64,1.64]){
    cylinder(root,x+side*1.44,2.77,z,.053,.10,f.satin,'y');
  }
  // Rules running along and across the grain are visible below the wooden chase.
  for(const z of [-1.7,-1.46,-.82,.37,.99,1.60])box(root,x,2.735,z,2.55,.16,.027,f.copper);
  for(const dx of [-1.20,-.83,.83,1.20])box(root,x+dx,2.735,0,.027,.16,3.43,f.copper);
  const platen=group(motion,x,0,0);
  casing(platen,0,level-.16,0,3.40,.25,4.19,f.satin,.05);
  casing(platen,0,level-.39,0,3.0,.18,3.81,f.frame,.045);
  for(const z of [-1.51,1.51])
    for(const a of [-1.12,1.12])cylinder(platen,a,level-.63,z,.18,.57,f.steel,'y');
  plate(root,x,3.60,.289,2.33,.33,'AUTOPLATINE');
  box(root,x,3.25,.283,3.50,.06,.025,f.sea);
  buttonPanel(root,x+1.47,3.59,.31);
  return platen;
}

function gluer(root,motion) {
  const centre=10.48, rollers=[];
  bench(root,centre,11.12,4.65);
  for(const z of [-1.46,-.89,-.35,.35,.89,1.46]){
    box(root,centre,level-.075,z,10.88,.12,.17,f.belt);
    cylinder(root,5.02,level-.13,z,.15,.22,f.frame);
    cylinder(root,15.86,level-.13,z,.15,.22,f.frame);
  }
  for(let i=0;i<10;i++){
    const x=5.77+i*1.05;
    for(const side of [-1,1]){
      const z=side*2.17;
      cylinder(root,x,1.86,z,.060,.92,f.steel,'y');
      box(root,x,2.24,z,.19,.19,.19,f.frame);
      cylinder(root,x,2.26,side*1.83,.052,.73,f.steel);
      cylinder(root,x,2.27,z+side*.13,.088,.12,f.iron);
      cylinder(root,x,1.85,side*1.5,.143,.10,f.satin);
    }
  }
  const paths=[
    [[6.15,1.74,-1.75],[7.6,1.84,-1.65],[8.3,2.15,-1.36],[9.1,2.27,-.94],[10.28,1.89,-.65],[11.32,1.76,-.37]],
    [[9.2,1.76,1.82],[9.9,2.05,1.70],[10.6,2.46,1.49],[11.5,2.72,.97],[12.32,2.31,.48],[13.06,1.78,.10]],
  ];
  for(const points of paths) {
    const curve=new T.CatmullRomCurve3(points.map(a=>new T.Vector3(...a)));
    mesh(root,new T.TubeGeometry(curve,36,.054,8,false),f.steel);
  }
  // Glue head approaching the edge of the passing blank.
  bar(root,[8.32,2.72,-2.12],[8.32,2.72,-1.36],.080,f.satin);
  casing(root,8.32,2.49,-1.36,.43,.47,.35,f.iron,.06);
  cylinder(root,8.32,2.13,-1.36,.057,.27,f.copper,'y');
  for(const x of [13.2,13.78,14.36,14.94,15.52]){
    rollers.push([roller(root,motion,x,level+.207,0,.20,3.09,f.belt,true),.20,1]);
    for(const side of [-1,1])
      box(root,x,1.93,side*1.85,.16,.54,.27,f.porcelain);
  }
  casing(root,14.37,2.35,-1.25,3.13,.18,1.57,f.porcelain,.08);
  plate(root,10.61,1.16,2.383,2.34,.28,'PLIAGE   /   COLLAGE');
  return rollers;
}

function shippingCase(parent,x,y,z,{opened=true,filled=false}={}) {
  const g=group(parent,x,y,z), a=1.04,b=1.13,h=.81;
  box(g,0,.035,0,2*a,.07,2*b,f.kraft);
  for(const s of [-1,1]){
    box(g,s*a,h/2,0,.045,h,2*b,f.kraft);
    box(g,0,h/2,s*b,2*a,h,.045,f.kraftLight);
  }
  const flaps=[];
  for(const side of [-1,1]){
    const hingeX=group(g,side*a,h,0), hingeZ=group(g,0,h+.022,side*b);
    box(hingeX,-side*a*.38,0,0,a*.76,.042,2*b-.04,f.kraft);
    box(hingeZ,0,0,-side*b*.50,2*a+.02,.04,b-.015,f.kraftLight);
    flaps.push([hingeX,'z',side],[hingeZ,'x',-side]);
  }
  const tape=box(g,0,h+.055,0,2*a+.02,.017,.16,f.tape);
  function close(progress){
    for(const [hinge,axis,s] of flaps)hinge.rotation[axis]=-s*2.57*(1-progress);
    tape.visible=progress>.94;
  }
  close(opened?0:1);
  plate(g,-.41,.43,b+.024,.87,.32,'LARRÉ',{bg:'#eee5ce',ink:'#203c3e'});
  if(filled){
    const printed=new T.MeshStandardMaterial({color:0xe17b49,roughness:.72});
    for(let j=0;j<13;j++)box(g,0,.095+j*.049,0,1.81,.043,1.96,j%4===0?printed:f.paper);
  }
  return {g,close};
}

function pallet(g,x,y,z) {
  for(const a of [-.92,0,.92]){
    box(g,x+a,y+.19,z,.24,.30,2.40,f.wood);
    box(g,x+a,y+.038,z,.27,.065,2.48,f.wood);
  }
  for(let i=0;i<7;i++)box(g,x,y+.38,z-1.08+i*.36,2.49,.10,.29,f.kraft);
}

function truck(motion) {
  const g=group(motion,25.95,0,0);
  // Open rear at the dock, with the driver's cab pointing down the outbound lane.
  box(g,0,.98,0,6.55,.25,3.05,f.frame);
  box(g,-.50,1.31,0,5.28,.32,3.22,f.satin);
  box(g,-.50,2.92,-1.59,5.28,3.05,.11,f.chalk);
  box(g,-.50,4.44,0,5.33,.11,3.27,f.porcelain);
  box(g,2.10,2.93,0,.11,3.06,3.24,f.chalk);
  // Visible near side of the cargo body is open at the rear cutaway.
  box(g,.56,2.90,1.59,3.08,3.05,.11,f.porcelain);
  box(g,.56,1.88,1.66,3.08,.12,.04,f.sea);
  for(let i=0;i<16;i++)box(g,-.87+i*.19,3.17,1.653,.026,2.12,.020,f.satin);
  casing(g,2.94,2.11,0,1.46,2.17,3.03,f.sea,.23);
  casing(g,3.12,2.67,1.52,.87,.64,.035,f.iron,.07);
  box(g,3.66,2.72,0,.07,.62,2.65,f.iron);
  box(g,3.70,1.91,0,.025,.24,1.66,f.iron);
  for(const s of [-1,1]){
    box(g,3.66,1.51,s*1.12,.10,.15,.45,f.glow);
    box(g,2.88,2.17,s*1.53,.26,.06,.06,f.frame);
    bar(g,[3.32,2.59,s*1.51],[3.39,2.76,s*1.94],.032,f.frame);
    casing(g,3.39,2.70,s*1.97,.18,.38,.12,f.iron,.05);
    for(const x of [-2.02,2.74]){
      cylinder(g,x,.63,s*1.43,.63,.38,f.rubber);
      cylinder(g,x,.63,s*1.64,.36,.068,f.satin);
      cylinder(g,x,.63,s*1.69,.14,.045,f.frame);
      for(let j=0;j<6;j++)cylinder(g,x+.235*Math.cos(j*Math.PI/3),.63+.235*Math.sin(j*Math.PI/3),s*1.68,.029,.045,f.frame);
    }
  }
  return g;
}

function hall(root) {
  const floor=new T.MeshStandardMaterial({color:0x293a40,roughness:.62,metalness:.17});
  box(root,7,-.105,-1,110,.20,44,floor);
  for(let x=-24;x<55;x+=5.4){
    box(root,x,4.7,-6.3,.29,9.4,.37,f.satin);
    box(root,x,8.88,-1,.25,.24,13.5,f.iron);
    bar(root,[x,6.8,-6.3],[x,8.77,-3.72],.077,f.satin);
    box(root,x+1.95,7.77,-4.52,2.76,.08,.18,f.coolGlow);
    // Score joints in concrete and a marked walkway along the line.
    box(root,x,.003,1,.016,.009,15,f.frame);
    box(root,x+1.4,.008,3.87,2.48,.009,.056,f.edge);
  }
  box(root,8,4.75,-7.75,92,9.50,.25,f.frame);
  for(let x=-24;x<51;x+=2.0){
    box(root,x,5.74,-7.59,1.89,1.61,.04,f.sea);
    box(root,x,6.56,-7.55,1.98,.056,.06,f.satin);
  }
  for(const y of [3.72,3.99,7.05])cylinder(root,7,y,-6.72,y>6?.20:.11,82,f.satin,'x');
  for(let i=0;i<3;i++){
    const x=33.6+i*2.8;
    box(root,x,2.1,-4.76,.12,4.2,2.4,f.sea);
    for(const y of [.47,2.44,4.14])box(root,x+1.37,y,-4.73,2.75,.12,2.40,f.copper);
    for(const y of [1.16,3.12])for(const dx of [.60,1.67])
      box(root,x+dx,y,-4.72,.97,1.19,1.57,f.kraftLight);
  }
}

export function buildWorkshop(scene) {
  const fixed=group(scene), motion=group(scene);
  hall(fixed);
  const rollers=offset(fixed,motion);
  const platen=diecutter(fixed,motion);
  rollers.push(...gluer(fixed,motion));
  bench(fixed,17.26,2.29,2.94);
  const load=group(motion,18.90,.02,0);
  pallet(load,0,0,0);
  const crate=shippingCase(load,0,.44,0,{filled:true});
  const van=truck(motion);
  const receiving=shippingCase(fixed,34,.49,-.30,{filled:true});
  pallet(fixed,34,.04,-.30);
  bench(fixed,36.93,2.92,2.58);
  box(fixed,36.93,1.56,0,2.92,.15,2.58,f.wood);
  box(fixed,36.93,1.647,.04,2.48,.033,2.14,f.sea);
  const liftCart=group(motion);
  casing(liftCart,0,0,0,2.63,.095,2.56,f.frame,.05);
  for(const z of [-.88,.88])bar(liftCart,[-1.03,-.06,z],[1.12,-.21,z],.075,f.satin);
  softShadow(fixed,18.9,0,5.5,5);
  softShadow(fixed,34,-.3,5.5,5);
  batch(fixed);
  return {rollers,platen,load,crate,van,receiving,liftCart};
}
