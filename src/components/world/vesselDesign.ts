import * as THREE from "three";
import type { Registry } from "./theme";

type HullSpec = { stern: number; bow: number; beam: number; deck: number; depth: number;
  paint: THREE.Material; trim: THREE.Material; timber: THREE.Material; rail: THREE.Material };

/** Lofted sections produce a curved bilge, tapered bow, transom and swept sheer. */
export function buildVesselHull(registry: Registry, spec: HullSpec) {
  const group=new THREE.Group();group.name="shaped-vessel-hull";
  const sections=28, ribs=16;
  const positions:number[]=[], indices:number[]=[], deck:number[]=[];
  const shape=[[0,.66],[.12,.88],[.3,1],[.58,1],[.74,.91],[.88,.62],[.97,.25],[1,.018]];
  const halfBeam=(t:number)=>{
    for(let i=1;i<shape.length;i++)if(t<=shape[i][0]) {
      const f=THREE.MathUtils.smoothstep(t,shape[i-1][0],shape[i][0]);
      return spec.beam*.5*THREE.MathUtils.lerp(shape[i-1][1],shape[i][1],f);
    }
    return spec.beam*.009;
  };
  const sheer=(t:number)=>spec.deck+.05*(1-t)+.22*THREE.MathUtils.smoothstep(t,.68,1);
  const point=(t:number,theta:number)=>{
    const belly=Math.sin(theta);
    return new THREE.Vector3(-halfBeam(t)*Math.cos(theta)*(1-belly*.24),
      sheer(t)-spec.depth*belly,THREE.MathUtils.lerp(spec.stern,spec.bow,t));
  };
  for(let i=0;i<=sections;i++)for(let j=0;j<=ribs;j++)positions.push(...point(i/sections,j/ribs*Math.PI).toArray());
  for(let i=0;i<sections;i++)for(let j=0;j<ribs;j++) {
    const a=i*(ribs+1)+j,b=(i+1)*(ribs+1)+j;
    indices.push(a,a+1,b,a+1,b+1,b);
  }
  for(const end of [0,1]) {
    const center=positions.length/3;
    const z=end?spec.bow:spec.stern;
    positions.push(0,sheer(end)-spec.depth*.4,z);
    const start=positions.length/3;
    for(let j=0;j<=ribs;j++)positions.push(...point(end,j/ribs*Math.PI).toArray());
    for(let j=0;j<=ribs;j++) {
      const a=start+j,b=start+(j+1)%(ribs+1);
      if(end)indices.push(center,a,b);else indices.push(center,b,a);
    }
  }
  const shell=registry.geometry(new THREE.BufferGeometry());
  shell.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  shell.setIndex(indices);shell.computeVertexNormals();
  const planking=new THREE.Mesh(shell,spec.paint);planking.name="vessel-planking";group.add(planking);
  for(let i=0;i<sections;i++) {
    const a=point(i/sections,0),b=point((i+1)/sections,0);
    const c=point((i+1)/sections,Math.PI),d=point(i/sections,Math.PI);
    deck.push(...a.toArray(),...b.toArray(),...c.toArray(),...a.toArray(),...c.toArray(),...d.toArray());
  }
  const deckGeometry=registry.geometry(new THREE.BufferGeometry());
  deckGeometry.setAttribute("position",new THREE.Float32BufferAttribute(deck,3));deckGeometry.computeVertexNormals();
  const decking=new THREE.Mesh(deckGeometry,spec.timber);decking.name="vessel-deck";group.add(decking);
  const pipe=(points:THREE.Vector3[],radius:number,material:THREE.Material)=>{
    group.add(new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,radius,8,false)),material));
  };
  for(const side of [0,1]) {
    const edge=Array.from({length:29},(_,i)=>point(i/28,side*Math.PI).add(new THREE.Vector3(0,.025,0)));
    pipe(edge,.055,spec.trim);
    for(const band of [.09,.28])pipe(Array.from({length:29},(_,i)=>point(i/28,side?Math.PI-band*Math.PI:band*Math.PI)),.035,spec.trim);
    for(const t of [.06,.18,.7,.84,.95]) {
      const p=point(t,side*Math.PI);
      const post=new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(.022,.022,.3,8)),spec.rail);
      post.position.copy(p).add(new THREE.Vector3(0,.17,0));group.add(post);
    }
    for(const range of [[.03,.2],[.68,.99]])pipe(Array.from({length:12},(_,i)=>point(THREE.MathUtils.lerp(range[0],range[1],i/11),side*Math.PI).add(new THREE.Vector3(0,.32,0))),.022,spec.rail);
  }
  const seams:THREE.Vector3[]=[];
  for(let i=1;i<28;i++) {
    const t=i/28;
    seams.push(new THREE.Vector3(-halfBeam(t)*.94,sheer(t)+.008,THREE.MathUtils.lerp(spec.stern,spec.bow,t)),
      new THREE.Vector3(halfBeam(t)*.94,sheer(t)+.008,THREE.MathUtils.lerp(spec.stern,spec.bow,t)));
  }
  group.add(new THREE.LineSegments(registry.geometry(new THREE.BufferGeometry().setFromPoints(seams)),
    registry.track(new THREE.LineBasicMaterial({color:0x8d563b,transparent:true,opacity:.42}))));
  return group;
}

/** Cockpit coamings, a glazed companionway, winches and a proper steering wheel. */
export function addSailingFittings(registry:Registry,boat:THREE.Group,deck:number,paint:THREE.Material) {
  const cream=registry.lit(0xffedbc), wood=registry.lit(0xb67635), navy=registry.lit(0x224c79), glass=registry.lit(0x12bad0);
  const box=(material:THREE.Material,size:number[],at:number[])=>{
    const mesh=new THREE.Mesh(registry.roundedBox(size,.05),material);
    mesh.position.set(at[0],at[1],at[2]);boat.add(mesh);return mesh;
  };
  box(navy,[1.15,.045,1.15],[0,deck+.025,-1.35]);
  for(const side of [-1,1])box(paint,[.18,.28,1.4],[side*.67,deck+.14,-1.3]);
  box(cream,[1.25,.25,.18],[0,deck+.14,-2.0]);
  box(paint,[1.1,.45,.75],[0,deck+.24,-.35]);
  box(cream,[1.2,.12,.87],[0,deck+.51,-.35]);
  box(glass,[.72,.21,.025],[0,deck+.32,.038]);
  for(const side of [-1,1]) {
    box(glass,[.025,.2,.42],[side*.558,deck+.32,-.35]);
    const winch=new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(.08,.1,.14,12)),cream);
    winch.position.set(side*.77,deck+.15,-.9);boat.add(winch);
  }
  box(wood,[.06,.42,.06],[0,deck+.23,-1.8]);
  const wheel=new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.19,.025,8,24)),wood);
  wheel.position.set(0,deck+.44,-1.8);boat.add(wheel);
  for(let i=0;i<3;i++) {
    const spoke=box(cream,[.022,.35,.025],[0,deck+.44,-1.8]);spoke.rotation.z=i*Math.PI/3;
  }
}
