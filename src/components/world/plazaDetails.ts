import * as THREE from "three";
import { buildLightHalos } from "./lighting";
import type { Registry } from "./theme";

/** Small-scale details share geometry/materials and are batched with the town. */
export function buildPlazaDetails(registry: Registry, town: THREE.Group, floor: number) {
  const cube = registry.geometry(new THREE.BoxGeometry(1, 1, 1));
  const cream = registry.lit(0xfff0d2), copper = registry.lit(0xc68158), dark = registry.lit(0x376b76);
  const paper = registry.lit(0xffdb92), coral = registry.lit(0xef8d75);
  const box = (material: THREE.Material, size: number[], at: number[]) => {
    const mesh = new THREE.Mesh(cube, material); mesh.scale.set(size[0],size[1],size[2]); mesh.position.set(at[0],at[1],at[2]); town.add(mesh);return mesh;
  };
  // Gallery placards, cafe cups and chair backs.
  for (const x of [-12,-6,0]) {
    box(paper,[1.5,.8,.025],[x,floor+2.2,-8.91]);
    for(let k=0;k<3;k++) box(dark,[.9-k*.18,.055,.03],[x-.15,floor+2.4-k*.18,-8.88]);
  }
  const mug = registry.geometry(new THREE.CylinderGeometry(.13,.11,.22,8));
  for(const [x,z] of [[1,-3],[2,4],[.5,11]]) {
    for(const side of [-1,1]) {
      box(copper,[.65,.65,.1],[x+side*1.15,floor+.8,z-.3]);
      const cup=new THREE.Mesh(mug,cream);cup.position.set(x+side*.36,floor+1.07,z);town.add(cup);
    }
  }
  // Drainpipes and masonry joints connect roofs and quay walls.
  for(const x of [-16.1,4.1]) box(copper,[.11,7.8,.11],[x,floor+3.9,-11.74]);
  for(const x of [-13,-6,1]) for(let k=0;k<3;k++) box(cream,[.72,.055,.72],[x,floor+8.65+k*.35,-16]);
  for(const [x,z] of [[-13,19],[-8,19],[2,19],[19,19]]) {
    box(dark,[.4,.55,.4],[x,floor+.275,z]);box(copper,[.75,.15,.25],[x,floor+.65,z]);
  }
  for(const [x,z] of [[-16,5],[21,14]]) {
    box(copper,[1,.8,.85],[x,floor+.4,z]);
    for(const dx of [-.4,.4]) box(cream,[.08,.84,.89],[x+dx,floor+.4,z]);
    box(coral,[.6,.45,.6],[x+.7,floor+.225,z+.5]);
  }
  const nightGroup=new THREE.Group();nightGroup.name="night-lights";nightGroup.visible=false;town.add(nightGroup);
  const glazing=registry.track(new THREE.MeshBasicMaterial({color:0xffce7a}));
  const shape=new THREE.Shape();shape.moveTo(-.23,0);shape.lineTo(.23,0);shape.lineTo(.23,.65);shape.absarc(0,.65,.23,0,Math.PI,false);shape.closePath();
  const windowGeometry=registry.geometry(new THREE.ShapeGeometry(shape));
  const windows: {x:number;y:number;z:number;yaw:number}[]=[];
  for(let i=0;i<11;i++)windows.push({x:-15+i*1.8,y:floor+4.38,z:-11.86,yaw:0});
  for(let i=0;i<7;i++) for(const side of [-1,1]) windows.push({x:19+side*2.74,y:floor+3.33,z:-2.2-(-5.4+i*1.8),yaw:side*Math.PI/2});
  const litWindows=new THREE.InstancedMesh(windowGeometry,glazing,windows.length);
  const dummy=new THREE.Object3D();windows.forEach((w,i)=>{dummy.position.set(w.x,w.y,w.z);dummy.rotation.set(0,w.yaw,0);dummy.scale.setScalar(1);dummy.updateMatrix();litWindows.setMatrixAt(i,dummy.matrix);});nightGroup.add(litWindows);
  const poolMaterial=registry.track(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`varying vec2 glowUV;void main(){glowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 glowUV;void main(){float d=length(glowUV-.5)*2.;float a=min(.9,pow(max(0.,1.-d),1.6)*.82);gl_FragColor=vec4(.98,.59,.20,a);\n#include <colorspace_fragment>\n}`
  }));
  const lamps=[[5,18],[-15,17],[7,-7],[20,16]];
  const pools=new THREE.InstancedMesh(registry.geometry(new THREE.PlaneGeometry(9,9)),poolMaterial,lamps.length);
  lamps.forEach(([x,z],i)=>{dummy.position.set(x,floor+.06,z);dummy.rotation.set(-Math.PI/2,0,0);dummy.updateMatrix();pools.setMatrixAt(i,dummy.matrix);});nightGroup.add(pools);
  nightGroup.add(buildLightHalos(registry,lamps.map(([x,z])=>({at:[x,floor+4,z],size:2.3,color:0xffd38b}))));
  return {group:nightGroup,setNight:(night:boolean)=>{nightGroup.visible=night;}};
}
