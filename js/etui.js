import * as T from '../assets/vendor/three.module.min.js';
import {group, mesh, box, finish, ease, mix} from './matiere.js';

export const units = [-9.6,-7.55,-5.5,-3.45];
export const stock = {front:1.22, side:.62, length:1.65, tab:.19};
const {front:w, side:d, length:h, tab} = stock;
const stages=['gauche','face','droite','dos'];
const widths=[d,w,d,w];
const starts=[-d,0,w,w+d];

function artwork(id) {
  const c=document.createElement('canvas'); c.width=640; c.height=864;
  const g=c.getContext('2d');
  const dark='#103b40', orange='#fa6237', ivory='#fff0cf', mint='#74c5af';
  const primary=id==='face', back=id==='dos';
  const bg=primary?orange:back?ivory:dark;
  g.fillStyle=bg; g.fillRect(0,0,640,864);
  g.fillStyle=primary||back?dark:mint;
  g.font='bold 31px sans-serif'; g.fillText('B A Y O N N E',42,65);
  g.save(); g.beginPath(); g.rect(0,135,640,526);g.clip();
  g.strokeStyle=primary?ivory:back?orange:mint;
  g.lineWidth=9;
  for(let k=-9;k<25;k++){
    g.beginPath();g.moveTo(-90,80+k*22);
    g.bezierCurveTo(60,540+k*23,210,-12+k*19,370,310+k*18);
    g.bezierCurveTo(498,575+k*19,477,166+k*21,740,330+k*19);g.stroke();
  }
  g.restore();
  g.fillStyle=primary||back?dark:ivory;
  g.font='900 126px sans-serif'; g.fillText(primary||back?'LARRÉ':'PLI',33,758,574);
  g.fillRect(40,780,556,3);
  g.font='bold 21px sans-serif';g.fillText('ÉTUDE DE CARTON PLIANT',41,819,499);
  const map=new T.CanvasTexture(c);
  map.colorSpace=T.SRGBColorSpace; map.anisotropy=4;
  return map;
}

// Plate colours arrive on the leading edge of the moving sheet one unit at a time.
function printMaterial(id, travel) {
  const material=new T.MeshStandardMaterial({map:artwork(id),side:T.DoubleSide,roughness:.68,metalness:0});
  material.onBeforeCompile=shader=>{
    shader.uniforms.feed=travel;
    shader.vertexShader='varying float axial;\n'+shader.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\n axial=position.x;');
    shader.fragmentShader='uniform float feed; varying float axial;\n'+shader.fragmentShader
      .replace('#include <map_fragment>',[
        'vec3 ink = texture2D(map, vec2(1.0-vMapUv.x,vMapUv.y)).rgb;',
        'float k = 1.0 - max(max(ink.r,ink.g),ink.b);',
        'vec3 cmy = 1.0-ink/max(1.0-k,0.001);',
        'float place=feed+axial;',
        'vec3 amount=smoothstep(vec3(-9.64,-7.59,-5.54),vec3(-9.56,-7.51,-5.46),vec3(place));',
        'vec3 colour=(1.0-amount*cmy)*(1.0-k*smoothstep(-3.49,-3.41,place));',
        'vec3 fibre=vec3(0.94,0.88,0.75);',
        'diffuseColor.rgb*=gl_FrontFacing ? fibre : fibre*colour;'
      ].join('\n'));
  };
  return material;
}

function paperGeometry(points, holes=[], uvWidth=1, span=h) {
  const shape=new T.Shape(points.map(([u,v])=>new T.Vector2(u,v)));
  for(const hole of holes) shape.holes.push(new T.Path(hole.map(([u,v])=>new T.Vector2(u,v))));
  const geometry=new T.ShapeGeometry(shape);
  const p=geometry.attributes.position, uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    const u=p.getX(i), v=p.getY(i);
    p.setXYZ(i,v,0,u);
    uv.setXY(i,u/uvWidth,.5+v/span);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function flapPath(panel, end) {
  const wide=widths[panel], dust=panel===0||panel===2;
  const long=panel===3 && end===1 || panel===1 && end===-1;
  if(!dust&&!long)return [];
  const len=dust?d*.72:d*.99, inset=long?.025:.035;
  const shape=long?[[inset,0],[inset,len*.92],[.10,len+.115],[wide-.10,len+.115],[wide-inset,len*.92],[wide-inset,0]]
    :[[inset,0],[.085,len*.74],[wide*.29,len],[wide-.12,len*.94],[wide-inset,len*.4],[wide-inset,0]];
  return shape.map(([u,v])=>[u,end*v]);
}

function outline() {
  const edge=end=>{
    const points=[[-d-tab+.045,end*(h/2-.12)],[-d,end*h/2]];
    stages.forEach((_,i)=>{
      const z=starts[i];
      points.push(...flapPath(i,end).map(([u,v])=>[z+u,end*h/2+v]),[z+widths[i],end*h/2]);
    });
    return points;
  };
  return [...edge(-1),...edge(1).reverse()];
}

function crease(parent,points,material) {
  for(const face of [-.005,.005]){
    const g=new T.BufferGeometry().setFromPoints(points.map(([u,v])=>new T.Vector3(v,face,u)));
    parent.add(new T.Line(g,material));
  }
}

export function makeCarton(parent) {
  const pivot=group(parent), centre=group(pivot);
  const travel={value:-14};
  const ruling=new T.LineBasicMaterial({color:0x735d45,transparent:true,opacity:0});
  const panels=[], flaps=[];
  stages.forEach((id,i)=>{
    const holder=group(centre), width=widths[i];
    const body=group(holder,0,0,i===0?-d:0);
    const boundary=[[0,-h/2],[width,-h/2],[width,h/2],[0,h/2]];
    mesh(body,paperGeometry(boundary,[],width),printMaterial(id,travel));
    crease(body,[...boundary,boundary[0]],ruling);
    for(const end of [-1,1]){
      const points=flapPath(i,end);
      if(!points.length)continue;
      const hinge=group(body,end*h/2,0,0);
      const surface=finish.paper.clone();surface.side=T.DoubleSide;
      mesh(hinge,paperGeometry(points),surface);
      crease(hinge,[...points,points[0]],ruling);
      flaps.push({i,end,hinge});
    }
    panels.push(holder);
  });
  const tabGroup=group(centre);
  const gluePoints=[[-tab+.045,-h/2+.12],[0,-h/2],[0,h/2],[-tab+.045,h/2-.12]];
  const plain=finish.edge.clone();plain.side=T.DoubleSide;
  mesh(tabGroup,paperGeometry(gluePoints),plain);
  const bead=box(tabGroup,0,.012,-.082,h*.84,.018,.027,finish.copper);
  const waste=group(centre);
  const z0=-d-tab-.145,z1=2*w+d+.145,xh=h/2+d+.27;
  const scrapMat=finish.paper.clone();scrapMat.side=T.DoubleSide;
  mesh(waste,paperGeometry([[z0,-xh],[z1,-xh],[z1,xh],[z0,xh]],[outline()]),scrapMat);
  const strip=group(waste);
  [0x00a7b6,0xda3768,0xf0bc33,0x293638].forEach((color,i)=>{
    const m=new T.MeshStandardMaterial({color,roughness:.74});
    box(strip,-.88+i*.15,-.006,z0+.07,.13,.007,.07,m);
  });
  return {
    pivot, centre,
    pose({x,y,z,roll=0,yaw=0,rise=0,foldLeft=0,foldBack=0,open=0,close=0,scrap=0,cut=0,glue=0,printedAt=x}) {
      pivot.position.set(x,y,z);
      pivot.rotation.set(0,yaw,rise,'YXZ');
      centre.rotation.x=roll;
      const left=Math.PI*foldLeft-open*Math.PI/2;
      const right=open*Math.PI/2;
      const rear=Math.PI*foldBack;
      const off=mix(mix(w*.98,(w+d)/2,foldBack),w/2,open);
      const baseY=mix(0,-d/2,open);
      const place=(p,py,pz,angle)=>{
        p.position.set(0,py+baseY,pz-off);p.rotation.x=angle;
      };
      place(panels[0],.01*foldLeft,0,left);
      place(panels[1],0,0,0);
      place(panels[2],.001,w,-right);
      place(panels[3],d*Math.sin(right)+.024*foldBack,w+d*Math.cos(right),-rear);
      place(tabGroup,d*Math.sin(left)+.012*foldLeft,-d*Math.cos(left),mix(left,Math.PI,open));
      bead.visible=glue>.001;bead.scale.x=Math.max(.001,h*.84*glue);bead.position.x=(glue-1)*h*.42;
      flaps.forEach(({i,end,hinge})=>{
        const dust=i===0||i===2;
        hinge.rotation.z=end*Math.PI/2*(dust?ease(0,.69,close):ease(.31,1,close));
      });
      ruling.opacity=cut*.61;travel.value=printedAt;
      waste.visible=scrap<.997;
      waste.position.set(-scrap*.72,scrap*1.32,-off+scrap*.18);
      waste.rotation.z=-scrap*.21;
      strip.visible=printedAt>units[0];
    }
  };
}
