import * as T from '../assets/vendor/three.module.min.js';
import * as carton from './etui.js';
import {offsetLayout} from './impression.js';
import {paperLine as line, paint as p, box, cylinder, group, mesh, bar, panel, cabinet, bolt, hose,
  feet, dial, adjustableGuide, footboard, roller, safetyLabel, controlPanel, feeder, pack} from './machines-pieces.js';

const pressCenters=[-1.65,-.65,.35,1.35];

// The pile is lowered into the bay between the guide columns. Its top and the path to the
// registration table stay free for the separately animated sheets.
function registerTable(fixed,from,to,width) {
  const mid=(from+to)/2,len=to-from;
  cabinet(fixed,mid,line-.066,0,len,.093,width+.042,p.graphite,.006);
  for(const z of [-.40,-.20,0,.20,.40]) {
    box(fixed,mid,line-.015,z,len-.012,.015,.049,p.rubber);
    for(let x=from+.04;x<to-.02;x+=.065)
      box(fixed,x,line-.0067,z,.017,.0016,.012,p.seam);
  }
  for(const side of [-1,1]){
    cylinder(fixed,mid,line+.08,width*.5*side,.010,len,p.steel,'x');
    cylinder(fixed,to-.16,line+.092,side*(width*.5-.073),.016,.125,p.steel);
    cylinder(fixed,to-.16,line+.040,side*(width*.5-.132),.038,.028,p.rubber);
    adjustableGuide(fixed,to-.11,line+.018,side*(width*.5+.065),-side);
  }
}

function outerPressTower(fixed,cover,x,index){
  const silhouette=[[-.457,.43],[.458,.43],[.458,2.07],[.362,2.20],[-.408,2.20],[-.457,2.12]];
  panel(fixed,x,0,-.63,silhouette,.105,p.pearl,.009);
  // The far spine and the ink duct remain in the photographed cutaway.
  cabinet(fixed,x,2.12,-.31,.86,.137,.59,p.pearl,.011);
  panel(fixed,x,0,-.11,[[-.32,2.152],[.31,2.152],[.258,2.243],[-.242,2.243]],.32,p.graphite,.005);
  const near=group(cover,x,0,.637);
  panel(near,0,0,0,silhouette,.108,p.graphite,.009);
  panel(near,.052,0,.062,[[-.286,.61],[.290,.61],[.327,.69],[.327,2.125],[-.260,2.125],[-.286,2.085]],.038,p.pearl,.004);
  cabinet(near,-.356,1.49,.078,.105,.52,.014,p.cast,.003);
  cabinet(near,-.353,1.685,.09,.055,.077,.011,p.seam,.0015);
  cylinder(near,-.351,1.607,.098,.012,.015,p.green);
  cylinder(near,-.351,1.56,.098,.012,.015,p.graphite);
  cylinder(near,-.351,1.517,.098,.012,.015,p.amber);
  box(near,.235,1.015,.091,.014,.155,.020,p.aluminum);
  for(let i=0;i<7;i++)box(near,.05,1.968-i*.013,.085,.086,.004,.002,p.blueGray);
  for(const xx of [-.197,.25])for(const yy of [.70,2.06]) bolt(near,xx,yy,.088,.006);
  if(index===0) safetyLabel(near,-.02,.774,.088,.085);
  // The walk-side casting extends only below the nip, so a close-up can read the bearer rings.
  for(const z of [-.575,.576]){
    const casting=z>0?cover:fixed;
    panel(casting,x,0,z,[[-.465,.388],[.466,.388],[.459,1.01],[.276,1.103],[-.311,1.103],[-.465,1.01]],.063,p.cast,.007);
  }
}

function offset(fixed,cover,motion,moving) {
  feet(fixed,-2.02,1.75,.56);
  cabinet(fixed,-.16,.288,0,4.16,.32,1.27,p.graphite,.017);
  for(const z of [-.66,.66]) {
    box(fixed,-.16,.608,z,4.15,.544,.083,p.graphite);
    for(let i=0;i<4;i++){
      const x=-1.68+i;
      cabinet(fixed,x,.40,z*1.071,.942,.295,.024,p.cast,.003);
      for(let j=0;j<14;j++)box(fixed,x-.356+j*.055,.399,z*1.071+.014*Math.sign(z),.026,.112,.006,p.seam);
    }
  }
  footboard(cover,-2.07,1.91,.895);
  const suction=feeder(fixed,motion,offsetLayout.feederX,true);
  const {frontLay,impressionR:ri}=offsetLayout;
  registerTable(fixed,offsetLayout.feederX+.40,frontLay+.045,1.037);
  // Front lays: four stops rise in front of the leading edge, then drop under the line to release it.
  const lays=group(motion);
  for(const z of [-.40,-.14,.14,.40]){
    box(lays,frontLay+.006,line+.004,z,.010,.026,.034,p.red);
    box(lays,frontLay+.017,line-.012,z,.020,.016,.040,p.cast);
  }
  for(const [index,x] of pressCenters.entries()){
    outerPressTower(fixed,cover,x,index);
    roller(motion,x,line-ri,0,ri,1.062,p.hardened,moving,-1,true);
    roller(motion,x,line+.143,0,.143,1.064,p.pressBlanket,moving,1,true);
    roller(motion,x-.145,line+.387,-.002,.142,1.058,p.steel,moving,-1,true);
    // The form rollers and distributing drums sit above the plate, behind the service opening.
    for(const [dx,dy,r] of [[-.263,.537,.051],[-.140,.577,.057],[-.075,.523,.042],[.007,.575,.063],[.105,.652,.071],[-.050,.699,.084],[-.239,.692,.068]]){
      cylinder(fixed,x+dx,line+dy,-.008,r,1.005,r>.065?p.hardened:p.rubber);
    }
    for(const [ax,ay] of [[x,line-.192],[x,line+.143],[x-.145,line+.387]]){
      cylinder(fixed,ax,ay,-.568,.038,.088,p.steel);
      cylinder(fixed,ax,ay,-.611,.060,.046,p.cast);
    }
    // Delivery transfer below the plane is visible between printing elements.
    if(index<3){
      roller(motion,x+.5,line-ri,0,ri,1.05,p.hardened,moving,1,true);
      bar(fixed,[x+.22,.877,-.564],[x+.66,.888,-.564],.026,p.cast);
    }
    // Real inking stations have opaque trays. A thin margin of ink is visible along the lip.
    const dyes=[0x25586a,0x77384f,0x9a8143,0x282a2c];
    const ink=new T.MeshStandardMaterial({color:dyes[index],roughness:.29,metalness:.03});
    cabinet(fixed,x+.257,1.962,-.041,.227,.077,.999,p.cast,.006);
    box(fixed,x+.257,2.003,-.041,.151,.005,.943,ink);
  }
  // Open pile delivery, gripper-chain rails above the top sheet and four jogger fingers.
  for(const z of [-.613,.613]){
    for(const x of [2.39,3.46]) {
      cabinet(fixed,x,.79,z,.117,1.31,.102,p.pearl,.009);
      box(fixed,x,.682,z*.893,.027,1.001,.021,p.hardened);
    }
    panel(z>0?cover:fixed,2.91,0,z,[
      [-.65,1.35],[.632,1.35],[.632,1.84],[.505,1.94],[-.34,1.94],[-.65,1.74]
    ],.128,p.pearl,.009);
    for(const y of [1.236,1.321])bar(fixed,[1.78,y,z*.853],[3.30,y,z*.853],.012,p.hardened);
    for(const x of [2.63,3.24]) {
      box(fixed,x,1.094,z*.866,.124,.146,.014,p.aluminum);
      cylinder(fixed,x,1.162,z*.947,.013,.122,p.steel);
    }
  }
  cabinet(fixed,2.37,1.715,-.23,.63,.346,.77,p.blueGray,.016);
  cabinet(fixed,2.91,1.854,-.45,1.10,.13,.29,p.pearl,.010);
  for(const z of [-.40,-.20,0,.20,.40]) {
    cylinder(fixed,2.485,1.344,z,.016,.19,p.aluminum,'x');
    box(fixed,2.539,1.324,z,.077,.018,.043,p.graphite);
  }
  safetyLabel(cover,2.61,1.608,.685,.105);
  cabinet(cover,2.27,1.51,.635,.16,.286,.112,p.blueGray,.006);
  controlPanel(cover,2.27,1.56,.725);
  return {suction,lays};
}

function endRail(fixed,x,span,z) {
  box(fixed,x,1.111,z,span,.059,.042,p.cast);
  cylinder(fixed,x,1.164,z,.012,span,p.steel,'x');
}
function splitDepth(fixed,cover,x,y,length,height,depth,material) {
  for(const [owner,sign] of [[fixed,-1],[cover,1]]) {
    box(owner,x,y,sign*(depth/4+.00015),length,height,depth/2-.00030,material);
  }
}
function tooling(fixed,cover,x){
  // A real chase carries an inserted routed plywood board, knives and compressible ejector strips.
  const boardWidth=1.075, boardLength=.805;
  splitDepth(fixed,cover,x,1.262,boardLength,.057,boardWidth,p.ply);
  for(const z of [-.551,.551]){
    const root=z<0?fixed:cover;
    box(root,x,1.257,z,.87,.077,.024,p.aluminum);
    for(let i=0;i<5;i++)bolt(root,x-.33+i*.165,1.257,z+.013,.006);
  }
  for(const end of [-1,1])splitDepth(fixed,cover,x+end*.423,1.257,.028,.077,1.122,p.hardened);
  const outline=carton.blankOutline();
  const {front,side,tab,length}=carton.stock;
  const center=(2*front-tab)/2;
  function knife(x1,z1,x2,z2,material,height,width) {
    const length=Math.hypot(x2-x1,z2-z1);
    if(length<.0001)return;
    const owner=z1+z2<0?fixed:cover;
    const rail=box(owner,x+(x1+x2)/2,1.234-height/2,(z1+z2)/2,length,height,width,material);
    rail.rotation.y=-Math.atan2(z2-z1,x2-x1);
  }
  for(const cell of carton.imposePositions){
    const {x:dx,z:dz}=cell;
    for(let i=0;i<outline.length;i++) {
      const a=outline[i], b=outline[(i+1)%outline.length];
      knife(dx+a[1],dz+a[0],dx+b[1],dz+b[0],p.hardened,.029,.0018);
    }
    for(const wall of [-side,0,front,front+side]) {
      const zLine=dz+wall-center;
      knife(dx-length*.5,zLine,dx+length*.5,zLine,p.brass,.0274,.0020);
    }
    for(const end of [-1,1]) {
      knife(dx+end*length*.5,dz-.201,dx+end*length*.5,dz+.211,p.hardened,.0274,.0019);
      knife(dx+end*.106,dz-.167,dx+end*.106,dz-.071,p.pad,.024,.008);
    }
    for(const zLine of [-.211,.211])knife(dx-.061,dz+zLine,dx+.062,dz+zLine,p.pad,.023,.008);
  }
}

function diecutter(fixed,cover,motion) {
  const suction=feeder(fixed,motion,-2.05,true);
  registerTable(fixed,-1.665,-1.016,1.037);
  feet(fixed,-1.06,1.14,.592);
  cabinet(fixed,-.062,.284,0,2.58,.312,1.24,p.blueGray,.017);
  for(const z of [-.617,.617]) {
    cabinet(fixed,-.53,.614,z,1.38,.46,.103,p.blueGray,.009);
    for(const xx of [-1.117,.039]) {
      const owner=z<0?fixed:cover;
      panel(owner,xx,0,z,[[-.082,.68],[.087,.68],[.09,1.42],[-.072,1.42]],.072,p.cast,.004);
      cylinder(owner,xx,1.081,z-.008,.028,.452,p.hardened,'y');
    }
    endRail(z<0?fixed:cover,.051,2.55,z*.875);
  }
  const platen=group(motion,-.55,0,0);
  cabinet(platen,0,1.106,0,.865,.105,1.096,p.hardened,.0009);
  cabinet(platen,0,1.015,0,.840,.070,1.074,p.cast,.004);
  for(const a of [-.24,.24]) for(const z of [-.431,.431]) {
    cylinder(platen,a,.912,z,.053,.145,p.hardened,'y');
    cylinder(fixed,-.55+a,.834,z,.079,.148,p.cast,'y');
  }
  // The two toggle knuckles stay below the platen. Their visible portion shortens at impression.
  for(const a of [-.27,.27]) {
    cylinder(fixed,-.55+a,.768,0,.061,1.12,p.hardened);
    cylinder(platen,a,.951,.511,.044,.060,p.aluminum);
  }
  tooling(fixed,cover,-.55);
  splitDepth(fixed,cover,-.55,1.347,.944,.105,1.19,p.cast);
  const hood=[[-.61,1.405],[.601,1.405],[.602,2.02],[.508,2.17],[-.453,2.17],[-.61,2.081]];
  panel(fixed,-.55,0,-.327,hood,.632,p.gray,.009);
  panel(cover,-.55,0,.327,hood,.632,p.gray,.009);
  panel(cover,-.55,0,.677,[[-.592,1.31],[.582,1.31],[.582,1.72],[-.592,1.72]],.017,p.blueGray,.004);
  cabinet(cover,-.55,.937,.668,1.102,.272,.050,p.blueGray,.006);
  for(const x of [-1.065,-.034])for(const yy of [.84,1.055,1.377,1.676])bolt(cover,x,yy,.703,.007);
  for(const xx of [-.84,-.27]) {
    box(cover,xx,1.332,.694,.142,.018,.018,p.hardened);
    safetyLabel(cover,xx,1.554,.699,.077);
  }
  for(const z of [-.59,.59]){
    const upper=z<0?fixed:cover;
    box(upper,.557,.675,z,.93,.64,.080,p.gray);
    cabinet(upper,.528,1.91,z,.944,.247,.104,p.pearl,.014);
    for(const xx of [.140,1.0]) {
      cabinet(upper,xx,1.54,z,.074,.59,.080,p.blueGray,.003);
      bolt(upper,xx,1.81,z+.044,.009);
    }
  }
  // A sectional view removes the near cover but retains the narrow steel comb.
  // Every visible pin is attached to this carriage, including its walk-side row.
  const pins=group(motion,.55,0,0),nearPins=group(pins);
  splitDepth(pins,nearPins,0,1.471,.786,.030,1.060,p.ply);
  for(const dx of [-.238,.238]) {
    cylinder(pins,dx,1.501,-.327,.036,.032,p.aluminum,'y');
    cylinder(pins,dx,1.600,-.327,.019,.175,p.steel,'y');
    cylinder(fixed,.55+dx,1.742,-.327,.036,.199,p.cast,'y');
    cabinet(fixed,.55+dx,1.828,-.444,.095,.046,.273,p.blueGray,.003);
  }
  const rows=new Map();
  function punch(x,z) {
    if(!rows.has(x)) {
      rows.set(x,true);
      box(pins,x,1.444,0,.028,.023,1.028,p.hardened);
    }
    cylinder(pins,x,1.425,z,.009,.017,p.aluminum,'y');
    // At maximum travel the tip is 31 mm below the sheet. The cylinder's
    // upper end meets the same sleeve throughout the complete 121 mm stroke.
    cylinder(pins,x,1.3565,z,.0055,.121,p.steel,'y');
    cylinder(pins,x,1.275,z,.0038,.050,p.hardened,'y');
  }
  for(const {x,z} of carton.imposePositions) {
    punch(x-.147,z+.147);
    punch(x+.147,z-.063);
    // These shoes sit entirely under the material left in a finished pose.
    cabinet(fixed,.55+x,1.149,z,.109,.020,.124,p.hardened,.0008);
    cylinder(fixed,.55+x,.784,z,.014,.708,p.steel,'y');
    cylinder(fixed,.55+x,1.126,z,.031,.027,p.aluminum,'y');
  }
  for(const z of [-.489,.489])for(const x of [-.207,.207])punch(x,z);
  for(const xx of [.13,1.01])for(const z of [-.54,.54])
    cylinder(z<0?fixed:cover,xx,1.379,z,.020,.456,p.steel,'y');
  cabinet(fixed,.55,1.065,-.538,.80,.044,.036,p.hardened,.002);
  for(const z of [-.547,.547]) {
    box(fixed,1.657,.673,z,.054,1.075,.046,p.aluminum);
    box(fixed,1.668,1.28,z,1.041,.075,.064,p.blueGray);
  }
  for(const xx of [1.19,2.16]){
    for(const z of [-.622,.622]){
      cabinet(fixed,xx,.864,z,.103,1.45,.088,p.gray,.008);
      cylinder(fixed,xx,1.13,z*.903,.013,.645,p.hardened,'y');
    }
  }
  cabinet(fixed,1.675,1.737,-.44,1.09,.198,.332,p.pearl,.012);
  for(const z of [-.38,0,.38])
    cylinder(fixed,1.599,1.61,z,.014,.186,p.hardened,'y');
  controlPanel(cover,.769,1.629,.694);
  return {suction,platen,pins,nearPins};
}

function straightBelt(root,x1,x2,top,z,width,radius,material=p.belt) {
  // A continuous belt has a separate return run under the load-carrying run. The pulleys
  // fit inside that loop. The splice is painted on the belt material, not a second plane.
  const length=x2-x1, cy=top-radius;
  const outer=new T.Shape();
  function perimeter(shape,r,outerRing){
    if(outerRing) {
      shape.moveTo(0,r);
      shape.lineTo(length,r);
      shape.absarc(length,0,r,Math.PI*.5,-Math.PI*.5,true);
      shape.lineTo(0,-r);
      shape.absarc(0,0,r,-Math.PI*.5,Math.PI*.5,true);
    } else {
      shape.moveTo(0,r);
      shape.absarc(0,0,r,Math.PI*.5,Math.PI*1.5,false);
      shape.lineTo(length,-r);
      shape.absarc(length,0,r,-Math.PI*.5,Math.PI*.5,false);
      shape.closePath();
    }
  }
  perimeter(outer,radius,true);
  const hole=new T.Path();
  perimeter(hole,radius-.0032,false);
  outer.holes.push(hole);
  const band=new T.ExtrudeGeometry(outer,{depth:width,bevelEnabled:false,curveSegments:9});
  band.translate(0,0,-width/2);
  mesh(root,band,material,x1,cy,z);
  for(const x of [x1,x2]){
    cylinder(root,x,cy,z,radius-.0037,width+.003,p.hardened);
    cylinder(root,x,cy,z,radius*.38,width+.016,p.aluminum);
  }
}

// The guide belt twists with the flap. Its working side changes continuously from
// horizontal to vertical and back, rather than intersecting the steel plough at the fold.
function foldBelt(root,nodes,twists) {
  const curve=new T.CatmullRomCurve3(nodes.map(point=>new T.Vector3(...point)));
  const vertices=[],indices=[],uv=[];
  const segments=44;
  for(let i=0;i<=segments;i++){
    const u=i/segments, center=curve.getPoint(u);
    const seg=Math.min(twists.length-2,Math.floor(u*(twists.length-1)));
    const local=u*(twists.length-1)-seg;
    const angle=T.MathUtils.lerp(twists[seg],twists[seg+1],local);
    const side=new T.Vector3(0,Math.sin(angle),Math.cos(angle));
    const tangent=curve.getTangent(u);
    const normal=new T.Vector3().crossVectors(side,tangent).normalize();
    side.crossVectors(tangent,normal).normalize();
    for(const [edge,face] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      const v=center.clone().addScaledVector(side,edge*.010).addScaledVector(normal,face*.0014);
      vertices.push(v.x,v.y,v.z);uv.push(u*7,(edge+1)/2);
    }
    if(i>0)for(let f=0;f<4;f++){
      const a=(i-1)*4+f,b=(i-1)*4+(f+1)%4,c=a+4,d=b+4;
      indices.push(a,b,c,b,d,c);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  const mat=p.belt.clone();mat.side=T.DoubleSide;
  mesh(root,geo,mat);
}
const idlerShape=new T.LatheGeometry([
  [.010,-.006],[.029,-.006],[.040,-.005],[.043,-.003],[.043,.003],
  [.040,.005],[.029,.005],[.028,.0038],[.015,.0038],[.014,.006],[.010,.006],[.010,-.006]
].map(([r,y])=>new T.Vector2(r,y)),40);

function jockey(fixed,motion,moving,x,z,hand) {
  const radius=.043,axisY=line+.0451;
  const axleZ=z+hand*.046;
  const wheel=group(motion,x,axisY,z);
  const face=mesh(wheel,idlerShape,p.steel);
  face.rotation.x=Math.PI/2;
  for(const outer of [-1,1]) {
    cylinder(wheel,0,0,outer*.0068,.012,.0033,p.hardened);
    box(wheel,.023,0,outer*.0061,.002,.005,.0018,p.cast);
  }
  moving.push({carrier:wheel,radius,sign:1});
  cylinder(fixed,x,axisY,axleZ,.008,.112,p.hardened);
  // Each wheel is cantilevered from the clamp on an adjustment crossbar.
  bar(fixed,[x,axisY,axleZ],[x-.028,line+.129,axleZ],.009,p.aluminum);
  cabinet(fixed,x-.030,line+.134,axleZ,.043,.037,.046,p.cast,.002);
  cylinder(fixed,x-.030,line+.137,z+hand*.116,.008,.153,p.steel);
  cylinder(fixed,x-.030,line+.109,z+hand*.180,.010,.151,p.steel,'y');
  cylinder(fixed,x-.030,line+.187,z+hand*.180,.014,.013,p.graphite,'y');
  bar(fixed,[x-.061,line+.199,z+hand*.18],[x+.009,line+.199,z+hand*.18],.005,p.graphite);
}
function gluer(fixed,cover,motion,moving) {
  const housings=[[-2.41,1.18],[-1.16,1.29],[.16,1.29],[1.49,1.30],[2.51,.68]];
  for(const [x,length] of housings) {
    feet(fixed,x-length*.348,x+length*.348,.415);
    for(const z of [-.444,.444]) {
      panel(fixed,x,0,z,[
        [-length/2,.19],[length/2,.19],[length/2,.916],[length/2-.051,.982],
        [-length/2+.059,.982],[-length/2,.901]
      ],.067,p.blueGray,.007);
      cabinet(fixed,x,.77,z*1.084,length-.12,.312,.027,p.gray,.004);
      for(const xx of [x-length*.36,x+length*.36]) {
        bolt(fixed,xx,.684,z*1.084+.016,.007);
        bolt(fixed,xx,.866,z*1.084+.016,.007);
      }
      for(let j=0;j<6;j++)
        box(fixed,x-length*.28+j*.037,.432,z*1.083,.016,.094,.007,p.cast);
    }
    for(const dx of [-length*.33,length*.33]) {
      cylinder(fixed,x+dx,.972,0,.023,.919,p.steel);
      box(fixed,x+dx,.576,0,.068,.106,.808,p.graphite);
    }
  }
  // Thin but rigid carrier plates support the lower transport belts. Central gaps
  // let the operator reach the glue heads, carriers and guides from either side.
  for(const z of [-.157,-.051,.071,.161]){
    cabinet(fixed,-.363,1.047,z,5.07,.128,.052,p.aluminum,.003);
    straightBelt(fixed,-2.866,1.402,line-.0008,z,.033,.041);
  }
  for(const z of [-.256,.256]){
    box(fixed,-2.65,line+.173,z,.305,.075,.014,p.aluminum);
    for(const x of [-2.78,-2.52]){
      cabinet(fixed,x,1.235,z,.032,.269,.026,p.hardened,.0025);
      cylinder(fixed,x,1.318,z*.904,.009,.104,p.steel);
    }
  }
  // The feeder knives register the leading edge, letting the bottom blank through.
  for(const z of [-.159,.152]) {
    box(fixed,-2.456,line+.117,z,.018,.229,.059,p.aluminum);
    cabinet(fixed,-2.452,1.438,z,.077,.074,.092,p.cast,.0025);
    dial(fixed,-2.456,1.505,z+.062);
  }
  cylinder(fixed,-2.461,1.444,0,.016,.764,p.steel);
  for (const side of [-1,1]){
    cabinet(fixed,-2.462,1.276,side*.39,.065,.366,.054,p.gray,.004);
    box(fixed,-2.65,.976,side*.515,.47,.102,.048,p.graphite);
  }
  // Three vertical return belts, photographed on the real folder-gluer, lead into
  // the pre-fold carriers. Their rollers and upper beam leave access to the feeder.
  for(const z of [-.17,-.048,.1]){
    const upright=group(fixed,-1.92,line+.065,z);
    upright.rotation.z=Math.PI/2;
    straightBelt(upright,0,.35,.042,0,.027,.042);
  }
  for(const x of [-2.05,-1.78]){
    cylinder(fixed,x,1.39,-.292,.021,.466,p.aluminum,'y');
    cylinder(fixed,x,1.618,-.044,.014,.555,p.steel);
  }
  // Support and hose approach from the outside so the nozzle aligns with the glue flap.
  hose(fixed,[[-1.37,.88,.336],[-1.35,1.28,.408],[-1.25,1.508,.421],
    [-1.045,1.547,.343],[-.946,1.446,.267],[-.946,1.389,.241]],.009,p.cable,24);
  cabinet(fixed,-.947,1.351,.238,.071,.079,.055,p.cast,.005);
  cylinder(fixed,-.947,1.289,.234,.016,.058,p.aluminum,'y');
  bar(fixed,[-.947,1.268,.234],[-.947,1.193,.215],.007,p.steel);
  cylinder(fixed,-.947,1.184,.215,.005,.018,p.brass,'y');
  const nozzle=mesh(fixed,new T.CylinderGeometry(.005,.0018,.012,14),p.steel,-.947,1.172,.21536);
  nozzle.castShadow=true;
  cylinder(fixed,-.947,1.347,.327,.011,.188,p.steel);
  box(fixed,-.947,1.329,.414,.051,.050,.039,p.aluminum);
  cylinder(fixed,-.947,1.233,.414,.013,.220,p.steel,'y');
  const guideA=[[-.72,1.164,.207],[-.43,1.183,.207],[-.12,1.224,.172],[.13,1.241,.124],[.32,1.215,.080],[.49,1.167,.061]];
  const guideB=[[.298,1.164,-.194],[.54,1.188,-.203],[.77,1.259,-.175],[.98,1.295,-.086],[1.18,1.252,.001],[1.395,1.168,.049]];
  foldBelt(fixed,guideA,[0,.22,.86,1.70,2.53,3.11]);
  foldBelt(fixed,guideB,[0,-.21,-.79,-1.57,-2.32,-3.12]);
  for(const [path,side] of [[guideA,1],[guideB,-1]]){
    const coords=path.map(([x,y,z])=>[x,y+.010,z+side*.015]);
    hose(fixed,coords,.005,p.steel,30);
  }
  for(const x of [-1.59,-1.36,-.69,-.37,.05,.396,.702,.998,1.257]) {
    jockey(fixed,motion,moving,x,-.050,-1);
    // The near row ends before the side-flap guide begins to turn inward.
    if(x<-.40)jockey(fixed,motion,moving,x,.071,1);
  }
  // A broad pair of pressure tapes keeps the overlapped seam closed at the delivery.
  for(const z of [-.073,.085]){
    cabinet(fixed,2.105,1.056,z,1.48,.124,.110,p.aluminum,.004);
    straightBelt(fixed,1.395,2.791,line-.0009,z,.102,.046,p.belt);
    straightBelt(fixed,1.438,2.625,line+.110,z,.100,.054,p.belt);
    for(let i=0;i<6;i++) {
      cylinder(fixed,1.516+i*.20,1.217,z,.041,.107,p.hardened);
      cylinder(fixed,1.516+i*.20,1.217,z+.059,.014,.018,p.steel);
    }
  }
  for(const x of [1.49,2.56]) {
    cabinet(fixed,x,1.171,-.276,.070,.340,.056,p.blueGray,.005);
    cylinder(fixed,x,1.324,-.076,.015,.427,p.steel);
  }
  cabinet(fixed,2.08,1.365,-.161,1.25,.104,.241,p.gray,.009);
  for(const x of [1.552,2.511])bolt(fixed,x,1.373,-.031,.009);
  safetyLabel(fixed,2.17,.80,.501,.080);
  controlPanel(fixed,-2.007,1.047,.492);
  return {};
}

/**
 * A station is built in local metres. X is the sheet feed direction, and the operator
 * stands on the +Z side. Pass travel in metres for deterministic cylinder positions.
 */
export function buildStation(parent,kind) {
  const root=group(parent),fixed=group(root),cover=group(root),motion=group(root),moving=[];
  const builders={offset,decoupe:diecutter,collage:gluer};
  const build=builders[kind];
  if(!build)throw new RangeError('Poste de fabrication inconnu : '+kind);
  const parts=build(fixed,cover,motion,moving);
  pack(fixed);
  pack(cover);
  for(const part of moving)pack(part.carrier);
  if(parts.suction)pack(parts.suction);
  if(parts.platen)pack(parts.platen);
  if(parts.pins) {
    // Keep the half removed in the editorial section independent of the retained pin row.
    parts.nearPins.removeFromParent();
    pack(parts.pins);pack(parts.nearPins);
    parts.pins.add(parts.nearPins);
  }
  if(parts.lays)pack(parts.lays);
  function animate(tLocal,{press=0,travel=tLocal*.28,cutaway=0,feeder:pick=0,stripping=0,lay=0}={}) {
    if(parts.lays)parts.lays.position.y=-.03*lay;
    cover.visible=cutaway<.5;
    for(const {carrier,radius,sign} of moving)carrier.rotation.z=sign*travel/radius;
    if(parts.suction) {
      parts.suction.position.y=pick*.032;
      parts.suction.position.x=(kind==='offset'?offsetLayout.feederX-.22:-2.27)+pick*.046;
    }
    if(parts.platen)parts.platen.position.y=press*.044;
    if(parts.pins) {
      parts.pins.position.y=-.121*stripping;
      parts.nearPins.visible=cover.visible;
    }
  }
  animate(0);
  return {root,animate};
}
