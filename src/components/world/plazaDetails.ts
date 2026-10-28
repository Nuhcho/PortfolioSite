import * as THREE from "three";
import { buildLightHalos } from "./lighting";
import type { Registry } from "./theme";

/** Small-scale details share geometry/materials and are batched with the town. */
export function buildPlazaDetails(registry: Registry, town: THREE.Group, floor: number) {
  const cream = registry.lit(0xfff0d2), copper = registry.lit(0xc68158), dark = registry.lit(0x376b76);
  const paper = registry.lit(0xffdb92), coral = registry.lit(0xef8d75);
  const box = (material: THREE.Material, size: number[], at: number[]) => {
    const mesh = new THREE.Mesh(registry.roundedBox(size, .045), material); mesh.position.set(at[0],at[1],at[2]); town.add(mesh);return mesh;
  };
  const cylinder = (material: THREE.Material, radius: number, height: number, at: number[]) => {
    const mesh = new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(radius, radius, height, 20)), material);
    mesh.position.set(at[0],at[1],at[2]);town.add(mesh);return mesh;
  };
  const ring = (material: THREE.Material, radius: number, tube: number, at: number[]) => {
    const mesh = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(radius,tube,8,32)),material);
    mesh.position.set(at[0],at[1],at[2]);town.add(mesh);return mesh;
  };
  // Gallery placards, cafe cups and chair backs.
  for (const x of [-12,-6,0]) {
    box(paper,[1.5,.8,.025],[x,floor+2.2,-8.91]);
    for(let k=0;k<3;k++) box(dark,[.9-k*.18,.055,.03],[x-.15,floor+2.4-k*.18,-8.88]);
  }
  const mug = registry.geometry(new THREE.LatheGeometry([[0,0],[.105,0],[.13,.035],[.13,.22],[.105,.22],[.105,.045],[0,.045]].map(([r,y])=>new THREE.Vector2(r,y)),20));
  const coffee = registry.lit(0x684735);
  for(const [x,z] of [[1,-3],[2,4],[.5,11]]) {
    for(const side of [-1,1]) {
      const chairX=x+side*1.15;
      for(const dx of [-.28,.28])cylinder(dark,.028,.66,[chairX+dx,floor+.81,z-.27]);
      const back=new THREE.CatmullRomCurve3([
        new THREE.Vector3(chairX-.29,floor+.9,z-.27),new THREE.Vector3(chairX-.22,floor+1.18,z-.3),
        new THREE.Vector3(chairX+.22,floor+1.18,z-.3),new THREE.Vector3(chairX+.29,floor+.9,z-.27),
      ]);
      town.add(new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(back,16,.035,8,false)),copper));
      const cupX=x+side*.36;
      cylinder(cream,.22,.025,[cupX,floor+.985,z]);
      const cup=new THREE.Mesh(mug,cream);cup.position.set(cupX,floor+1,z);town.add(cup);
      const handle=ring(cream,.075,.025,[cupX+.14,floor+1.12,z]);handle.rotation.y=Math.PI/2;
      cylinder(coffee,.1,.008,[cupX,floor+1.19,z]);
    }
    cylinder(coral,.095,.2,[x,floor+1.1,z+.3]);
    for(let k=0;k<3;k++) {
      cylinder(dark,.012,.28,[x+(k-1)*.045,floor+1.3,z+.3]);
      const bloom=new THREE.Mesh(registry.geometry(new THREE.SphereGeometry(.06,10,8)),paper);
      bloom.position.set(x+(k-1)*.045,floor+1.45,z+.3);town.add(bloom);
    }
  }
  // Drainpipes and masonry joints connect roofs and quay walls.
  for(const x of [-16.1,4.1]) box(copper,[.11,7.8,.11],[x,floor+3.9,-11.74]);
  for(const [x,z] of [[-13,19],[-8,19],[2,19],[19,19]]) {
    box(dark,[.4,.55,.4],[x,floor+.275,z]);box(copper,[.75,.15,.25],[x,floor+.65,z]);
  }
  for(const [x,z] of [[-16,5],[21,14]]) {
    box(copper,[1,.8,.85],[x,floor+.4,z]);
    for(const dx of [-.4,.4]) box(cream,[.08,.84,.89],[x+dx,floor+.4,z]);
    box(coral,[.6,.45,.6],[x+.7,floor+.225,z+.5]);
  }

  // Turned columns and layered cornices make the arcades feel built by hand.
  const column=(x:number,z:number)=>{
    cylinder(cream,.14,3.25,[x,floor+1.775,z]);
    cylinder(cream,.23,.14,[x,floor+.12,z]);
    cylinder(cream,.2,.18,[x,floor+3.43,z]);
  };
  for(let i=0;i<=8;i++) {column(-16.4+i*2.6,-11.87);column(-16.92,-9.4+i*2.6);}
  box(cream,[21.0,.1,.2],[-6,floor+3.52,-11.86]);

  // Fine sash bars sit in front of the day recesses and illuminated panes.
  const frame=(x:number,y:number,z:number,yaw=0)=>{
    const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=yaw;
    const rail=(size:number[],at:number[])=>{
      const mesh=new THREE.Mesh(registry.roundedBox(size,.018),cream);
      mesh.position.set(at[0],at[1],at[2]);group.add(mesh);
    };
    rail([.035,1.46,.04],[0,.73,0]);rail([.68,.035,.04],[0,1.03,0]);
    const curve=new THREE.EllipseCurve(0,1.5,.4,.52,0,Math.PI,false,0);
    const path=new THREE.CatmullRomCurve3(curve.getPoints(24).map(p=>new THREE.Vector3(p.x,p.y,0)));
    group.add(new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(path,24,.025,6,false)),cream));
    town.add(group);return group;
  };
  for(let i=0;i<11;i++)frame(-15+i*1.8,floor+4.3,-11.78);
  for(const x of [-7.9,-5.7,-3.5]) {
    // The taller hall's upper windows are three quarters of the main window height.
    frame(x,floor+7.05,-11.78).scale.y=.75;
  }
  for(let i=0;i<7;i++)for(const side of [-1,1])frame(19+side*2.85,floor+3.25,-2.2-(-5.4+i*1.8),side*Math.PI/2);

  // Mooring rings, wet stone courses, and joints give the quay a shoreline.
  for(const [width,x] of [[32.25,-7.125],[8.25,19.125]]) {
    for(const y of [-.65,-1.4,-2.2])box(dark,[width-2.7,.028,.035],[x,y,21.265]);
    for(let joint=-width/2+1.6;joint<width/2-1.4;joint+=1.8)box(dark,[.025,.7,.035],[x+joint,-.99,21.265]);
  }
  for(const x of [-18,-12,-6,1,19]) {
    box(copper,[.2,.32,.05],[x,-.52,21.29]);
    ring(copper,.22,.045,[x,-.7,21.35]);
  }
  for(const z of [-15,-2,5,18]) {
    const mooring=ring(copper,.2,.04,[9.045,-.65,z]);mooring.rotation.y=Math.PI/2;
  }
  // Lantern feet and slender frames soften the old square light blocks.
  for(const [x,z] of [[5,18],[-15,17],[7,-7],[20,16]]) {
    cylinder(dark,.24,.16,[x,floor+.08,z]);cylinder(dark,.17,.2,[x,floor+.22,z]);
    for(const dx of [-.24,.24])for(const dz of [-.24,.24])cylinder(dark,.025,.76,[x+dx,floor+4,z+dz]);
    const cap=new THREE.Mesh(registry.geometry(new THREE.ConeGeometry(.43,.2,24)),dark);
    cap.position.set(x,floor+4.55,z);town.add(cap);
  }
  ring(copper,.64,.035,[-18.8,floor+8.1,-13.68]);
  for(let tick=0;tick<12;tick++) {
    const angle=tick*Math.PI/6;
    const mark=box(dark,[.025,.085,.025],[-18.8+Math.sin(angle)*.49,floor+8.1+Math.cos(angle)*.49,-13.67]);
    mark.rotation.z=-angle;
  }
  const nightGroup=new THREE.Group();nightGroup.name="night-lights";nightGroup.visible=false;town.add(nightGroup);
  const glazing=registry.track(new THREE.MeshBasicMaterial({color:0xffce7a}));
  const shape=new THREE.Shape();shape.moveTo(-.23,0);shape.lineTo(.23,0);shape.lineTo(.23,.65);shape.absarc(0,.65,.23,0,Math.PI,false);shape.closePath();
  const windowGeometry=registry.geometry(new THREE.ShapeGeometry(shape));
  const windows: {x:number;y:number;z:number;yaw:number;scale?:number}[]=[];
  for(let i=0;i<11;i++)windows.push({x:-15+i*1.8,y:floor+4.38,z:-11.86,yaw:0});
  for(const x of [-7.9,-5.7,-3.5])windows.push({x,y:floor+7.11,z:-11.86,yaw:0,scale:.75});
  for(let i=0;i<7;i++) for(const side of [-1,1]) windows.push({x:19+side*2.74,y:floor+3.33,z:-2.2-(-5.4+i*1.8),yaw:side*Math.PI/2});
  const litWindows=new THREE.InstancedMesh(windowGeometry,glazing,windows.length);
  const dummy=new THREE.Object3D();windows.forEach((w,i)=>{dummy.position.set(w.x,w.y,w.z);dummy.rotation.set(0,w.yaw,0);dummy.scale.set(1,w.scale??1,1);dummy.updateMatrix();litWindows.setMatrixAt(i,dummy.matrix);});nightGroup.add(litWindows);
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
