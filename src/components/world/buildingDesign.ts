import * as THREE from "three";
import { COLOR, type Registry } from "./theme";

/** Architectural silhouettes and relief, built in each building's local space. */
export function buildBuildingDetails(registry: Registry, palazzo: THREE.Group, canal: THREE.Group, floor: number) {
  const cream=registry.lit(COLOR.ivory), gold=registry.lit(COLOR.saffron), ink=registry.lit(COLOR.opening);
  const coral=registry.lit(COLOR.madder), blue=registry.lit(0x248679), pink=registry.lit(COLOR.rose);
  const glass=registry.lit(0x329bb6), violet=registry.lit(COLOR.madderDeep);
  const box=(parent:THREE.Object3D,material:THREE.Material,size:number[],at:number[])=>{
    const mesh=new THREE.Mesh(registry.roundedBox(size,.035),material);
    mesh.position.set(at[0],at[1],at[2]);parent.add(mesh);return mesh;
  };
  const tube=(parent:THREE.Object3D,points:THREE.Vector3[],radius:number,material:THREE.Material)=>{
    const curve=new THREE.CatmullRomCurve3(points);
    const mesh=new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(curve,24,radius,8,false)),material);
    parent.add(mesh);return mesh;
  };
  const oculus=(parent:THREE.Object3D,x:number,y:number,z:number,radius:number)=>{
    const pane=new THREE.Mesh(registry.geometry(new THREE.CircleGeometry(radius,32)),glass);
    pane.position.set(x,y,z);parent.add(pane);
    const rim=new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(radius+.04,.045,8,32)),gold);
    rim.position.set(x,y,z+.015);parent.add(rim);
    box(parent,cream,[radius*1.65,.035,.035],[x,y,z+.04]);
    box(parent,cream,[.035,radius*1.65,.035],[x,y,z+.04]);
  };
  const balcony=(parent:THREE.Object3D,x:number,y:number,z:number,width:number)=>{
    box(parent,cream,[width+.25,.18,1.35],[x,y,z]);
    box(parent,gold,[width+.35,.075,1.45],[x,y-.11,z]);
    box(parent,ink,[width,.055,.055],[x,y+.84,z+.56]);
    for(let k=0;k<=Math.round(width/.38);k++) {
      const px=x-width/2+k*width/Math.round(width/.38);
      box(parent,ink,[.025,.78,.035],[px,y+.42,z+.56]);
      const scroll=new THREE.EllipseCurve(px,y+.4,.105,.23,0,Math.PI*2,false,0);
      tube(parent,scroll.getPoints(24).map(p=>new THREE.Vector3(p.x,p.y,z+.56)),.014,ink);
    }
    for(const side of [-1,1]) {
      box(parent,cream,[.18,.58,.24],[x+side*width*.36,y-.4,z-.6]);
      box(parent,ink,[.035,.055,1.1],[x+side*width/2,y+.84,z]);
      const support=new THREE.CatmullRomCurve3([
        new THREE.Vector3(x+side*width*.36,y-.18,z+.38),new THREE.Vector3(x+side*width*.36,y-.38,z-.08),
        new THREE.Vector3(x+side*width*.36,y-.68,z-.5)]);
      parent.add(new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(support,12,.055,8,false)),cream));
    }
  };
  const dormer=(parent:THREE.Object3D,x:number,y:number,z:number,paint:THREE.Material)=>{
    const house=new THREE.Group();house.position.set(x,y,z);parent.add(house);
    box(house,cream,[1.2,.92,.9],[0,.46,0]);
    const profile=new THREE.Shape();profile.moveTo(-.75,0);profile.lineTo(0,.6);profile.lineTo(.75,0);profile.closePath();
    const cap=new THREE.Mesh(registry.geometry(new THREE.ExtrudeGeometry(profile,{depth:1.15,bevelEnabled:false})),paint);
    cap.position.set(0,.92,-.6);house.add(cap);
    const arch=new THREE.Shape();arch.moveTo(-.32,.12);arch.lineTo(.32,.12);arch.lineTo(.32,.55);
    arch.absarc(0,.55,.32,0,Math.PI,false);arch.closePath();
    const pane=new THREE.Mesh(registry.geometry(new THREE.ShapeGeometry(arch)),glass);
    pane.position.z=.46;house.add(pane);
    box(house,gold,[.86,.09,.15],[0,.08,.48]);
    box(house,cream,[.035,.66,.035],[0,.45,.49]);
  };

  // A taller central hall with a sculpted Venetian crown and an upper loggia.
  balcony(palazzo,-5.7,floor+6.86,-11.35,6.2);
  const crown=new THREE.Shape();
  crown.moveTo(-2.9,0);crown.lineTo(-2.9,.22);crown.lineTo(-2.5,.22);
  crown.quadraticCurveTo(-2.25,.76,-1.35,.8);crown.quadraticCurveTo(-.85,1.5,0,1.6);
  crown.quadraticCurveTo(.85,1.5,1.35,.8);crown.quadraticCurveTo(2.25,.76,2.5,.22);
  crown.lineTo(2.9,.22);crown.lineTo(2.9,0);crown.closePath();
  const pediment=new THREE.Mesh(registry.geometry(new THREE.ExtrudeGeometry(crown,{depth:.25,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2})),cream);
  pediment.position.set(-5.7,floor+8.92,-12.02);palazzo.add(pediment);
  box(palazzo,gold,[6.0,.11,.36],[-5.7,floor+8.96,-11.87]);
  oculus(palazzo,-5.7,floor+9.64,-11.72,.34);
  for(const side of [-1,1]) {
    const urn=new THREE.Mesh(registry.geometry(new THREE.LatheGeometry(
      [[0,0],[.16,0],[.13,.12],[.23,.25],[.16,.42],[.09,.46],[0,.46]].map(([r,y])=>new THREE.Vector2(r,y)),20)),gold);
    urn.position.set(-5.7+side*2.65,floor+9.2,-11.89);palazzo.add(urn);
  }
  dormer(palazzo,-13.0,floor+8.30,-12.25,violet);
  dormer(palazzo,1.2,floor+8.05,-12.25,blue);
  for(const x of [-15.0,-10.9,0,2.9])oculus(palazzo,x,floor+(x< -9?7.25:7.0),-11.94,.22);

  // Quoins and friezes give each differently colored wing its own construction.
  for(const [x,top] of [[-16.3,8.05],[-9.22,9],[-2.22,9],[4.3,7.8]]) {
    for(let y=3.7;y<top-.1;y+=.42)box(palazzo,cream,[.28,.19,.18],[x,floor+y,-11.87]);
  }
  for(const wing of [{x:-12.8,w:7.2,y:8.05},{x:-5.7,w:7,y:9},{x:1.1,w:6.6,y:7.8}]) {
    box(palazzo,gold,[wing.w,.08,.13],[wing.x,floor+wing.y-.27,-11.9]);
    for(let x=wing.x-wing.w/2+.3;x<wing.x+wing.w/2;x+=.42)
      box(palazzo,cream,[.13,.14,.19],[x,floor+wing.y-.12,-11.86]);
    const chimneyY=floor+wing.y+1.22;
    box(palazzo,coral,[.65,1.25,.65],[wing.x+.6,chimneyY,-16.1]);
    box(palazzo,cream,[.85,.12,.85],[wing.x+.6,chimneyY+.67,-16.1]);
    box(palazzo,ink,[.42,.025,.42],[wing.x+.6,chimneyY+.74,-16.1]);
  }

  // The canal has two distinct houses, with little roof rooms and iron balconies.
  dormer(canal,-3.25,6.84,2.45,coral);
  dormer(canal,3.25,6.39,2.45,blue);
  balcony(canal,-3.25,3.05,3.24,3.8);
  balcony(canal,3.25,3.05,3.24,3.8);
  for(const x of [-5.2,-1.4,1.4,5.2]) {
    oculus(canal,x,x<0?5.85:5.55,2.73,.22);
  }
  for(const side of [-1,1])for(let k=0;k<2;k++) {
    if(k===0)box(canal,ink,[.025,1.1,.025],[side*6.3,7.1,side*2.5]);
    const pennant=new THREE.Shape();pennant.moveTo(0,0);pennant.lineTo(.5,-.08);pennant.lineTo(0,-.25);pennant.closePath();
    const flag=new THREE.Mesh(registry.geometry(new THREE.ShapeGeometry(pennant)),pink);
    flag.material.side=THREE.DoubleSide;flag.position.set(side*6.3,6.9+k*.3,side*2.5);canal.add(flag);
  }
}
