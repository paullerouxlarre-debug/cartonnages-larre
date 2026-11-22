import * as T from '../assets/vendor/three.module.min.js';
import {makePressSheet, makeStrippedSheet, stock, imposePositions} from './etui.js';
import {paperLine, paint as p, box, group, mesh, bar, cylinder, cabinet} from './machines-pieces.js';
import {ease, mix} from './matiere.js';

const dieX=-.55, stripperX=.55, deliveryX=1.65;
const liftHeight=.638, palletDeck=.147, pileTop=liftHeight+palletDeck+610*stock.thickness;
const trayFloor=paperLine-.631;

function wasteDrawer(root) {
  const drawer=group(root,stripperX,0,0);
  // The support pillars pass through holes in the drawer floor. Their shoes are
  // inside the footprint of each finished blank, clear of the scrap openings.
  const floor=new T.Shape();
  const halfX=.413,halfZ=.553;
  floor.moveTo(-halfX,-halfZ);floor.lineTo(halfX,-halfZ);
  floor.lineTo(halfX,halfZ);floor.lineTo(-halfX,halfZ);floor.closePath();
  for(const {x,z} of imposePositions) {
    const hole=new T.Path();
    hole.absarc(x,-z,.019,0,Math.PI*2,true);
    floor.holes.push(hole);
  }
  const pan=new T.ExtrudeGeometry(floor,{depth:.007,bevelEnabled:false,curveSegments:14});
  pan.rotateX(-Math.PI/2);
  mesh(drawer,pan,p.cast,0,trayFloor-.007,0);
  for(const side of [-1,1]) {
    box(drawer,side*(halfX+.004),trayFloor+.047,0,.008,.108,2*halfZ+.012,p.aluminum);
    const height=side>0?.066:.184;
    box(drawer,0,trayFloor+height*.5-.004,side*(halfZ+.004),2*halfX,height,.008,p.blueGray);
    cylinder(drawer,0,trayFloor+height-.001,side*(halfZ+.004),.006,2*halfX,p.hardened,'x');
  }
  for(const x of [-.295,.295])box(drawer,x,trayFloor-.037,.001,.043,.059,.985,p.hardened);
}

function liftTable(root) {
  const elevator=group(root,deliveryX,0,0);
  box(elevator,0,liftHeight-.020,0,.93,.040,1.115,p.blueGray);
  box(elevator,0,.094,0,.862,.058,1.046,p.cast);
  for(const side of [-1,1]){
    const z=side*.455;
    bar(elevator,[-.32,.118,z],[.32,liftHeight-.055,z],.025,p.blueGray);
    bar(elevator,[.32,.118,z+side*.054],[-.32,liftHeight-.055,z+side*.054],.025,p.hardened);
    cylinder(elevator,0,(liftHeight+.063)*.5,z+side*.027,.045,.099,p.aluminum);
  }
}

function blankingHead(root) {
  // A four-up upper tool presses the useful area through the lower grid at
  // delivery, leaving the surrounding webs with the sheet's gripper margin.
  const head=group(root,deliveryX,0,0);
  for(const x of [-.1835,.1835]) {
    box(head,x,1.426,0,.025,.036,.669,p.aluminum);
    cylinder(head,x,1.532,-.314,.015,.193,p.steel,'y');
    cylinder(root,deliveryX+x,1.645,-.314,.031,.142,p.cast,'y');
    for(const z of [-.239,.239]) {
      cylinder(head,x,1.326,z,.010,.170,p.steel,'y');
      cabinet(head,x,1.234,z,.089,.018,.103,p.ply,.001);
      box(head,x,1.222,z,.085,.006,.100,p.pad);
    }
  }
  // Thin supporting rules are directly under the retained gripper web.
  for(const z of [-.468,0,.468])box(root,deliveryX,paperLine-.007,z,.746,.012,.003,p.hardened);
  for(const x of [-.370,.370])box(root,deliveryX+x,paperLine-.007,0,.003,.012,.942,p.hardened);
  return head;
}

function gripper(root) {
  const unit=group(root);
  // A chain runs on each side; only the narrow leading margin is clamped.
  box(unit,0,.019,0,.013,.016,1.047,p.cast);
  for(const z of [-.426,-.21,0,.21,.426]) {
    box(unit,-.007,.0052,z,.021,.005,.021,p.hardened);
    cylinder(unit,0,.016,z,.003,.026,p.aluminum);
  }
  return unit;
}

export function cuttingPass(root,props,machine) {
  const feedY=1.156;
  props.sheetLoad(root,-2.05,true,feedY);
  const delivery=props.batches(root,deliveryX,0,palletDeck);
  delivery.position.y=liftHeight;
  liftTable(root);
  wasteDrawer(root);
  const head=blankingHead(root),bar=gripper(root);
  const sheet=makePressSheet(root),cut=makeStrippedSheet(root);
  sheet.setInk(1);
  // Two earlier sets of loose clippings in the drawer. All their printed
  // faces remain on the original imposition and the support posts stay clear.
  const prior=group(root,stripperX,trayFloor+.00053,0);
  for(const [index,part] of cut.waste.children.entries()){
    const remnant=part.clone(false);
    remnant.position.x+=index%2?.003:-.003;
    remnant.position.z+=index%3?.004:-.003;
    remnant.rotation.y=(index%2?.015:-.022);
    prior.add(remnant);
  }

  return function update(time) {
    // The camera shows one complete production stroke in slow motion. All
    // coordinates depend only on time so reversing the film restores the same sheet.
    const lift=ease(18.53,19.28,time)*(1-ease(19.50,20.11,time));
    const approach=ease(15.35,18.38,time),release=ease(20.12,21.13,time);
    const transfer=ease(22.67,24.32,time);
    const sheetX=mix(-2.05,dieX,approach)+(stripperX-dieX)*release+(deliveryX-stripperX)*transfer;
    const height=mix(feedY+.00132,paperLine,approach)+Math.sin(Math.PI*approach)*.016+.044*lift;
    const isCut=time>=19.42;
    sheet.pivot.visible=!isCut;sheet.pivot.position.set(sheetX,height,0);
    cut.pivot.visible=isCut;cut.pivot.position.set(sheetX,height,0);

    const down=ease(20.96,21.85,time),back=ease(22.01,22.47,time);
    const travel=down*(1-back);
    const engaged=Math.max(0,Math.min(1,(down*.121-.090)/.031));
    const free=ease(21.91,22.94,time);
    cut.setSeparation(.22*engaged+.78*free);
    // Offcuts stay in their own drawer as the gripper advances to the next station.
    cut.waste.position.x=-(deliveryX-stripperX)*transfer;
    const push=ease(24.39,25.15,time),returnStroke=ease(25.23,25.57,time);
    const drop=paperLine-(pileTop+stock.thickness+.00005);
    const stroke=.059+drop;
    head.position.y=-stroke*push*(1-returnStroke);
    const descent=Math.max(0,stroke*push-.059);
    cut.poses.forEach(blank=>{blank.position.y=-descent;});
    // The gripper retains the light frame after the four poses have landed.
    cut.carrier.position.x=.67*ease(25.60,26.25,time);
    bar.position.set(sheetX+.370+cut.carrier.position.x,height,0);
    bar.visible=time>=16.11;
    machine.animate(time-14,{
      press:lift, travel:sheetX+2.05, stripping:travel,
      cutaway:time>=17.78?1:0, feeder:ease(15.24,15.56,time)*(1-ease(15.69,16.19,time))
    });
  };
}
