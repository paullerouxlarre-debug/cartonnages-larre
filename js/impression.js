import {makePressSheet,pressFormat,stock} from './etui.js';

const length=pressFormat.x, half=length/2;
const clamp=x=>Math.min(1,Math.max(0,x));
const smooth=(a,b,x)=>{const v=clamp((x-a)/(b-a));return v*v*(3-2*v);};
const mix=(a,b,u)=>a+(b-a)*u;
const line=1.16, r=.25, forward=1.03;
const unitCenters=[-1.65,-.65,.35,1.35];
const feederX=-3.76, frontLay=-2.145, landingX=2.95, deliveryY=1.209;
const infeedStart=feederX+half-frontLay, layTime=3.81, releaseTime=4.29, acceleration=.56;
const pitch=Math.PI*r, cadence=pitch/forward;
const releaseEdge=landingX+half;
export const offsetLayout={feederX,frontLay,unitCenters,impressionR:r,blanketR:r/2,line,deliveryY,landingX,cadence};

// Positive distance follows the leading edge from register. A sheet wraps the crowns of
// the impression cylinders, then the underside of each transfer drum up to the next handoff.
function makePath() {
  const raw=[{x:frontLay,y:line,s:0}];
  function point(x,y) {
    const last=raw[raw.length-1],ds=Math.hypot(x-last.x,y-last.y);
    if(ds>1e-9)raw.push({x,y,s:last.s+ds});
  }
  function curve(p1,p2,p3) {
    const p0=raw[raw.length-1];
    for(let i=1;i<=140;i++){
      const a=i/140,b=1-a;
      point(b*b*b*p0.x+3*b*b*a*p1[0]+3*b*a*a*p2[0]+a*a*a*p3[0],
        b*b*b*p0.y+3*b*b*a*p1[1]+3*b*a*a*p2[1]+a*a*a*p3[1]);
    }
  }
  function arc(cx,from,to) {
    for(let i=1;i<=112;i++){
      const a=mix(from,to,i/112);
      point(cx+r*Math.cos(a),line-r+r*Math.sin(a));
    }
  }
  const entryAngle=2.22,exitAngle=.93;
  const entry=[unitCenters[0]+r*Math.cos(entryAngle),line-r+r*Math.sin(entryAngle)];
  curve([frontLay+.132,line],[entry[0]-.089,entry[1]-.068],entry);
  const nips=[];
  for(const [i,x] of unitCenters.entries()){
    arc(x,i===0?entryAngle:Math.PI,Math.PI/2);
    nips.push(raw[raw.length-1].s);
    if(i===3) {
      arc(x,Math.PI/2,exitAngle);
      const q=raw[raw.length-1];
      curve([q.x+.121,q.y-.088],[1.76,deliveryY],[1.982,deliveryY]);
    } else {
      arc(x,Math.PI/2,0);
      arc(x+.5,Math.PI,Math.PI*2);
    }
  }
  point(releaseEdge,deliveryY);
  const end=raw[raw.length-1].s;
  const cells=Math.ceil(end/.0022),spacing=end/cells;
  const lut=new Float32Array((cells+1)*4);
  let j=1;
  for(let i=0;i<=cells;i++){
    const s=i*spacing;
    while(j<raw.length-1 && raw[j].s<s)j++;
    const a=raw[j-1],b=raw[j],v=clamp((s-a.s)/(b.s-a.s));
    const inv=1/Math.hypot(b.x-a.x,b.y-a.y);
    lut.set([mix(a.x,b.x,v),mix(a.y,b.y,v),(b.x-a.x)*inv,(b.y-a.y)*inv],i*4);
  }
  function sample(s,out) {
    if(s<=0) {out.x=frontLay+s;out.y=line;out.dx=1;out.dy=0;return;}
    if(s>=end) {out.x=releaseEdge;out.y=deliveryY;out.dx=1;out.dy=0;return;}
    const q=s/spacing,i=Math.min(cells-1,Math.floor(q)),u=q-i,k=i*4;
    out.x=mix(lut[k],lut[k+4],u);out.y=mix(lut[k+1],lut[k+5],u);
    out.dx=mix(lut[k+2],lut[k+6],u);out.dy=mix(lut[k+3],lut[k+7],u);
  }
  return {nips,end,sample};
}
const path=makePath();
export const offsetNips=path.nips;
const brakeDistance=.19,brakeTime=releaseTime+acceleration/2+(path.end-brakeDistance)/forward;
const brakeDuration=2*brakeDistance/forward;
const settled=brakeTime+brakeDuration+.48;

function hermite(a,b,h,va,vb,u) {
  const u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*a+(u3-2*u2+u)*h*va+(-2*u3+3*u2)*b+(u3-u2)*h*vb;
}
function leadingDistance(t) {
  if(t<=.31) return infeedStart;
  if(t<1.06) return hermite(infeedStart,infeedStart+.095,.75,0,.29,(t-.31)/.75);
  if(t<3.55) return hermite(infeedStart+.095,-.043,2.49,.29,.265,(t-1.06)/2.49);
  if(t<layTime) return hermite(-.043,0,layTime-3.55,.265,0,(t-3.55)/(layTime-3.55));
  if(t<releaseTime)return 0;
  const dt=t-releaseTime;
  if(dt<acceleration) return forward*.5*dt*dt/acceleration;
  if(t<brakeTime) return forward*(dt-acceleration*.5);
  const b=clamp((t-brakeTime)/brakeDuration);
  return path.end-brakeDistance*(1-b)*(1-b);
}

export const offsetSequence={
  nips:path.nips.map(s=>releaseTime+acceleration/2+s/forward),
  reception:brakeTime,settled,register:layTime,release:releaseTime
};

// The feeder, first gripper and delivery are on the same shaft clock. Extra sheets make the
// overlapping stream, then split into registered pitches. Every landed sheet keeps its place.
export function offsetPass(root,props,machine) {
  const stockTop=1.155,outputTop=1.088;
  props.sheetLoad(root,feederX,false,stockTop);
  props.sheetLoad(root,landingX,true,outputTop);
  const sheets=[];
  const first=-4, final=Math.ceil(14/cadence);
  for(let index=first;index<=final;index++) {
    const sheet=makePressSheet(root,{flexible:true});
    // Neighbouring sheets catch the light a little differently, so each one reads in the stream.
    sheet.pivot.traverse(o=>{if(o.isMesh&&Array.isArray(o.material))o.material[0].color.setHex(index%2?0xe4dfd2:0xffffff);});
    sheets.push({sheet,index,landing:outputTop+.00145+(index-first)*stock.thickness*1.12});
  }
  return function update(t) {
    const phase=((t%cadence)+cadence)%cadence;
    const pick=smooth(.10,.29,phase)*(1-smooth(.43,.67,phase));
    const transfer=smooth(.19,.46,phase)*(1-smooth(.63,cadence,phase));
    const layPhase=((t-layTime)%cadence+cadence)%cadence;
    const layOpen=smooth(.425,.499,layPhase)*(1-smooth(.56,.73,layPhase));
    const pull=smooth(.015,.16,layPhase)*(1-smooth(.36,.57,layPhase));
    const clock=forward*(t-releaseTime-acceleration*.5);
    machine.animate(t,{travel:clock,cutaway:t>=4.29 && t<10.79?1:0,feeder:pick,
      forwarding:transfer,lay:layOpen,sidePull:pull,offsetClock:clock});
    for(const item of sheets) {
      const {sheet,index,landing}=item,age=t-index*cadence;
      sheet.pivot.visible=age>=0;
      if(age<0)continue;
      const lead=leadingDistance(age);
      const pickBend=smooth(.08,.34,age)*(1-smooth(.64,1.22,age));
      const register=smooth(3.8,4.11,age);
      const side=(.010+.004*Math.sin(index*1.7))*(1-register);
      const skew=(.005*Math.cos(index*1.57))*(1-register);
      const pos={x:0,y:0,dx:1,dy:0,z:0,skew:0};
      sheet.setContact(lead,path.nips);
      sheet.conform((u,out)=>{
        const s=lead-length*(1-u);
        path.sample(s,pos);
        let y=pos.y,dy=pos.dy,dx=pos.dx;
        if(s<0){
          const onTable=smooth(feederX+half-frontLay-.01,-.64,s);
          const initialLift=stockTop+.00215-line;
          const edgeArch=.042*pickBend*(1-u)*(1-u);
          const nappe=.0009+.0075*(1-u);
          y+=mix(initialLift,nappe,onTable)+edgeArch;
          // Leading sheets ride over the next ones. This bow tapers into the front lays.
          y-=smooth(-.18,0,s)*nappe;
          dy+=-.084*pickBend*(1-u)/length;
        }
        if(age>brakeTime){
          const slip=age-brakeTime;
          const fall=smooth(.015+.078*u,brakeDuration+.37+.078*u,slip);
          const arc=.018*Math.sin(Math.PI*fall)*Math.sin(Math.PI*u);
          y=mix(y,landing,fall)+arc;
          dy+=(.018*Math.sin(Math.PI*fall)*Math.PI*Math.cos(Math.PI*u))/length;
        }
        out.x=pos.x;out.y=y;out.dx=dx;out.dy=dy;
        out.z=side+skew*length*(u-.5);out.skew=skew;
      });
    }
  };
}
