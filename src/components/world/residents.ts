import * as THREE from "three";
import type { Registry } from "./theme";

type Stop = { x: number; z: number; wait: number; face?: [number, number] };
const route: Stop[] = [
  {x:-10.5,z:12,wait:0},{x:-10.5,z:-6.5,wait:0},
  {x:-6,z:-6.5,wait:5,face:[-6,-9]}, {x:4.2,z:-6.5,wait:0},
  {x:4.2,z:8,wait:3,face:[-6,3]}, {x:4.2,z:12.5,wait:0}, {x:-6,z:12.5,wait:2,face:[-6,3]},
];
const travel = route.map((stop,i) => {
  const next=route[(i+1)%route.length];return Math.hypot(next.x-stop.x,next.z-stop.z)/.85;
});
const period=travel.reduce((sum,t,i)=>sum+t+route[i].wait,0);

/** Shared instanced figures: all residents together use a handful of draws. */
export function buildResidents(registry: Registry, floor: number) {
  const group=new THREE.Group();group.name="plaza-residents";
  const residents=[
    {kind:"walk",x:0,z:0,yaw:0,offset:0,color:0xdb8b6a,skin:0xe7b88b},
    {kind:"walk",x:0,z:0,yaw:0,offset:period*.25,color:0x78b8cb,skin:0xb67d59},
    {kind:"walk",x:0,z:0,yaw:0,offset:period*.5,color:0x8f9cbf,skin:0xf0c9a1},
    {kind:"walk",x:0,z:0,yaw:0,offset:period*.75,color:0xcbb373,skin:0x9b664b},
    {kind:"cafe",x:-.15,z:-3,yaw:Math.PI/2,offset:1,color:0x90b293,skin:0xe2ac7e},
    {kind:"cafe",x:2.15,z:-3,yaw:-Math.PI/2,offset:2,color:0xd79797,skin:0xaa7350},
    {kind:"gallery",x:-6,z:-7.45,yaw:Math.PI,offset:3,color:0x7da8ab,skin:0xe9bb93},
    {kind:"fountain",x:-1.4,z:4.7,yaw:Math.atan2(-4.6,-1.7),offset:4,color:0xe0c27c,skin:0xc18c66},
    {kind:"bench",x:-13,z:10,yaw:0,offset:5,color:0xa69fc7,skin:0xefc9a4},
    {kind:"garden",x:-13.8,z:7,yaw:-Math.PI/2,offset:6,color:0x78a58b,skin:0xc49370},
  ];
  const material=registry.lit(0xffffff);
  const instance=(geometry:THREE.BufferGeometry,count:number,name:string)=>{
    const mesh=new THREE.InstancedMesh(registry.geometry(geometry),material,count);
    mesh.name=name;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=mesh.receiveShadow=true;
    // Routes stay inside the quay; skipping per-frame bound rebuilds saves CPU.
    mesh.frustumCulled=false;group.add(mesh);return mesh;
  };
  const torsos=instance(new THREE.CapsuleGeometry(.17,.29,6,12),residents.length,"resident-coats");
  const heads=instance(new THREE.SphereGeometry(.145,16,12),residents.length,"resident-heads");
  const hair=instance(new THREE.SphereGeometry(.15,16,8,0,Math.PI*2,0,Math.PI/2),residents.length,"resident-hair");
  const limbs=instance(new THREE.CylinderGeometry(1,1,1,12),residents.length*8,"resident-limbs");
  const shoes=instance(new THREE.SphereGeometry(1,12,8),residents.length*2,"resident-shoes");
  const props=instance(registry.roundedBox([1,1,1],.12),6,"resident-interaction-props");
  const hands=instance(new THREE.SphereGeometry(.055,10,8),residents.length*2,"resident-hands");
  const bags=instance(registry.roundedBox([.22,.26,.11],.035),4,"resident-satchels");
  const spout=instance(new THREE.CylinderGeometry(1,1,1,5),1,"watering-can-spout");
  const trickle=instance(new THREE.CylinderGeometry(1,1,1,4),1,"watering-trickle");
  spout.setColorAt(0,new THREE.Color(0x82a7a0));trickle.setColorAt(0,new THREE.Color(0xa2e7dd));
  trickle.userData.noCastShadow=true;
  const color=new THREE.Color();
  residents.forEach((r,i)=>{
    torsos.setColorAt(i,color.setHex(r.color));heads.setColorAt(i,color.setHex(r.skin));hair.setColorAt(i,color.setHex([0x54463c,0x6a5140,0x9b7952,0x3f4149][i%4]));
    for(let k=0;k<2;k++)hands.setColorAt(i*2+k,color.setHex(r.skin));
    if(i<4)bags.setColorAt(i,color.setHex(0xa57857));
    for(let k=0;k<8;k++)limbs.setColorAt(i*8+k,color.setHex(k<4?0x4b6474:r.color));
    for(let k=0;k<2;k++)shoes.setColorAt(i*2+k,color.setHex(0x47535b));
  });
  [0xffedcc,0xffedcc,0xf4d28c,0x82a7a0,0x405968,0xe7d6b7].forEach((c,i)=>props.setColorAt(i,color.setHex(c)));
  const root=new THREE.Object3D(),part=new THREE.Object3D(),matrix=new THREE.Matrix4();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),delta=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const put=(mesh:THREE.InstancedMesh,index:number,at:number[],scale:number[],tilt=0)=>{
    part.position.set(at[0],at[1],at[2]);part.rotation.set(tilt,0,0);part.scale.set(scale[0],scale[1],scale[2]);part.updateMatrix();
    matrix.multiplyMatrices(root.matrix,part.matrix);mesh.setMatrixAt(index,matrix);
  };
  const bone=(index:number,from:number[],to:number[],radius:number)=>{
    a.set(from[0],from[1],from[2]);b.set(to[0],to[1],to[2]);delta.subVectors(b,a);
    part.position.copy(a).add(b).multiplyScalar(.5);part.quaternion.setFromUnitVectors(up,direction.copy(delta).normalize());
    part.scale.set(radius,delta.length(),radius);part.updateMatrix();matrix.multiplyMatrices(root.matrix,part.matrix);limbs.setMatrixAt(index,matrix);
  };
  const pose={x:0,z:0,yaw:0,walking:false};
  const path=(time:number)=>{
    let t=((time%period)+period)%period;
    for(let i=0;i<route.length;i++){
      const stop=route[i],next=route[(i+1)%route.length];
      if(t<stop.wait){pose.x=stop.x;pose.z=stop.z;pose.yaw=stop.face?Math.atan2(stop.face[0]-stop.x,stop.face[1]-stop.z):Math.atan2(next.x-stop.x,next.z-stop.z);pose.walking=false;return;}
      t-=stop.wait;
      if(t<travel[i]){const f=t/travel[i];pose.x=THREE.MathUtils.lerp(stop.x,next.x,f);pose.z=THREE.MathUtils.lerp(stop.z,next.z,f);pose.yaw=Math.atan2(next.x-stop.x,next.z-stop.z);pose.walking=true;return;}
      t-=travel[i];
    }
  };
  const update=(elapsed:number,reduce:boolean)=>{
    const t=reduce?0:elapsed;
    residents.forEach((r,i)=>{
      const clock=t+r.offset;
      if(r.kind==="walk")path(clock);else {pose.x=r.x;pose.z=r.z;pose.yaw=r.yaw;pose.walking=false;}
      const walking=pose.walking&&!reduce;
      const stride=walking?Math.sin(clock*5.3):0;
      const seated=r.kind==="cafe"||r.kind==="bench";
      const hip=seated?(r.kind==="bench"?.89:.67):.59;
      const sip=r.kind==="cafe"&&!reduce?Math.pow(Math.max(0,Math.sin(clock*.55)),6):0;
      const bob=walking?Math.abs(Math.sin(clock*5.3))*.025:0;
      root.position.set(pose.x,floor+bob,pose.z);root.rotation.set(0,pose.yaw,0);root.scale.setScalar(1);root.updateMatrix();
      const lean=r.kind==="garden"?.18:0;
      put(torsos,i,[0,hip+.22,seated?.025:0],[1,1,1],lean);
      put(heads,i,[0,hip+.66,.015],[1,1,1]);put(hair,i,[0,hip+.67,.015],[1,1,1]);
      if(i<4)put(bags,i,[.24,hip+.03,.02],[1,1,1],stride*.08);
      for(let side=0;side<2;side++){
        const x=side? .095:-.095,step=stride*(side?1:-1);
        const knee=[x,seated?hip-.15:.32,seated?.27:step*.13];
        const foot=[x,seated?.065:.065+Math.max(0,step)*.1,seated?.36:step*.24];
        bone(i*8+side*2,[x,hip,0],knee,.06);bone(i*8+side*2+1,knee,foot,.055);
        put(shoes,i*2+side,[foot[0],foot[1]-.015,foot[2]+.055],[.075,.055,.13]);
        const armX=side?.22:-.22;
        const gesture=reduce?0:Math.sin(clock*1.25)*.045;
        const interacting=seated||r.kind==="gallery"||r.kind==="garden"||r.kind==="fountain";
        const elbow=[armX,hip+.18+(r.kind==="cafe"&&side===1?sip*.2:0),interacting?.2:-step*.12];
        let handY=interacting?.3+gesture:.02,handZ=interacting?.36:-step*.2;
        if(r.kind==="cafe"&&side===1){handY+=sip*.25;handZ-=sip*.24;}
        if(r.kind==="garden"){handY=.5+gesture;handZ=.55;}
        if(r.kind==="fountain"){handY=.46+gesture*.3;handZ=.35;}
        const hand=[armX*(r.kind==="fountain"?.5:.8),hip+handY,handZ];
        put(hands,i*2+side,hand,[1,1,1]);
        bone(i*8+4+side*2,[armX,hip+.43,0],elbow,.047);bone(i*8+5+side*2,elbow,hand,.043);
      }
      if(r.kind==="cafe")put(props,i-4,[.17,hip+.36+sip*.25,.36-sip*.24],[.11,.14,.11]);
      if(r.kind==="gallery")put(props,2,[0,hip+.31,.38],[.32,.035,.22],-.25);
      if(r.kind==="garden"){
        const tilt=.15+(reduce?0:Math.sin(clock)*.08);
        put(props,3,[0,hip+.5,.55],[.25,.22,.2],tilt);
        put(spout,0,[0,hip+.47,.72],[.035,.3,.035],.9);
        put(trickle,0,[0,hip+.25,.85],[.012,.3,.012]);
      }
      if(r.kind==="fountain")put(props,4,[0,hip+.46,.38],[.19,.12,.06]);
      if(r.kind==="bench")put(props,5,[0,hip+.31,.37],[.35,.025,.25],-.2);
    });
    for(const mesh of [torsos,heads,hair,limbs,shoes,props,spout,trickle,hands,bags])mesh.instanceMatrix.needsUpdate=true;
  };
  update(0,true);
  return {group,update};
}
