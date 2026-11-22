import * as T from '../assets/vendor/three.module.min.js';

// In metres. The fixed valve opens when the leading end of the glue track passes its tip.
export const applicator={x:-.947,y:1.166,z:.21536};
export const glueRun=.170;
const radius=.00165;
const wet=new T.MeshPhysicalMaterial({color:0xf0e9cd,roughness:.18,metalness:0,
  clearcoat:.8,clearcoatRoughness:.15});
export const depositAt=x=>Math.max(0,Math.min(1,(x+glueRun/2-applicator.x)/glueRun));

export function glueTrack(tab,stock) {
  const geometry=new T.CapsuleGeometry(1,2,6,16);
  geometry.rotateZ(Math.PI/2);
  const pos=geometry.attributes.position,reference=pos.array.slice();
  const strip=new T.Mesh(geometry,wet);
  strip.scale.set(1,.40,1);
  strip.position.set(0,-stock.thickness-.00012,-stock.tab*.52);
  strip.frustumCulled=false;tab.add(strip);
  let previous=-1;
  return (amount,covered)=>{
    strip.visible=amount>.001 && !covered;
    if(!strip.visible||previous===amount)return;
    previous=amount;
    const length=glueRun*amount,r=Math.min(radius,length/2);
    for(let i=0;i<pos.count;i++){
      const x=reference[3*i],sign=x<0?-1:1;
      const cap=(x-sign)*r;
      pos.setXYZ(i,glueRun/2-length/2+sign*(length/2-r)+cap,reference[3*i+1]*r,reference[3*i+2]*r);
    }
    pos.needsUpdate=true;
  };
}

export function glueValve(parent,surfaceY){
  const geometry=new T.CylinderGeometry(.00075,.00112,1,14);
  const thread=new T.Mesh(geometry,wet);parent.add(thread);
  return x=>{
    const distance=x+glueRun/2-applicator.x;
    const start=Math.max(0,Math.min(1,distance/.0015));
    const stop=Math.max(0,Math.min(1,(distance-glueRun)/.0018));
    const height=(applicator.y-surfaceY)*(start-stop);
    thread.visible=height>.00002;
    thread.scale.set(1-stop*.7,Math.max(.00001,height),1-stop*.7);
    thread.position.set(applicator.x,applicator.y-height/2,applicator.z);
  };
}
