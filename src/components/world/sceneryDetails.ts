import * as THREE from "three";
import { COLOR, type Registry } from "./theme";

type At = [number, number, number];

/** Shared small props are merged by the existing static scenery batches. */
function createDetailKit(registry: Registry) {
  const paint = {
    cream: registry.lit(COLOR.ivory), red: registry.lit(COLOR.madder),
    teal: registry.lit(COLOR.jadeDeep), gold: registry.lit(COLOR.saffron),
    wood: registry.lit(0xb7814d), dark: registry.lit(COLOR.opening),
    rope: registry.lit(0xd9c394), leaf: registry.lit(0x6caf42),
    pink: registry.lit(0xf1a797), clay: registry.lit(0xc77649),
  };
  const sphere = registry.geometry(new THREE.SphereGeometry(1, 12, 8));
  const cylinder = registry.geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const coilGeometry = registry.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
    Array.from({length:85},(_,i)=>{
      const t=i/84,angle=t*Math.PI*7,radius=.12+t*.37;
      return new THREE.Vector3(Math.cos(angle)*radius,.035+Math.sin(angle*2)*.008,Math.sin(angle)*radius);
    })),100,.035,6,false));
  const box = (parent:THREE.Object3D,material:THREE.Material,size:At,at:At) => {
    const mesh = new THREE.Mesh(registry.roundedBox(size,.025),material);
    mesh.position.set(...at);parent.add(mesh);return mesh;
  };
  const ball = (parent:THREE.Object3D,material:THREE.Material,size:At,at:At) => {
    const mesh = new THREE.Mesh(sphere,material);mesh.scale.set(...size);
    mesh.position.set(...at);parent.add(mesh);return mesh;
  };
  const post = (parent:THREE.Object3D,material:THREE.Material,radius:number,height:number,at:At) => {
    const mesh = new THREE.Mesh(cylinder,material);mesh.scale.set(radius,height,radius);
    mesh.position.set(...at);parent.add(mesh);return mesh;
  };
  const path = (parent:THREE.Object3D,points:At[],radius:number,material=paint.rope) => {
    const curve = new THREE.CatmullRomCurve3(points.map(at=>new THREE.Vector3(...at)));
    const mesh = new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(curve,20,radius,6,false)),material);
    parent.add(mesh);return mesh;
  };
  const coil = (parent:THREE.Object3D,at:At,scale=1) => {
    const mesh=new THREE.Mesh(coilGeometry,paint.rope);mesh.position.set(...at);mesh.scale.setScalar(scale);parent.add(mesh);
  };
  const tray = (parent:THREE.Object3D,at:At,width=1.2) => {
    const group=new THREE.Group();group.position.set(...at);parent.add(group);
    box(group,paint.wood,[width,.08,.7],[0,.04,0]);
    for(const side of [-1,1]){
      for(const y of [.16,.31])box(group,paint.wood,[width,.1,.055],[0,y,side*.35]);
      box(group,paint.wood,[.06,.4,.75],[side*width/2,.2,0]);
    }
    return group;
  };
  const net = (parent:THREE.Object3D,at:At,width:number,length:number) => {
    const points:THREE.Vector3[]=[];
    const vertex=(u:number,v:number)=>new THREE.Vector3(u*width,.07+Math.sin(u*8+v*6)*.035,v*length);
    for(let i=0;i<9;i++)for(let j=0;j<9;j++){
      const u=i/8-.5,v=j/8-.5;
      if(i<8)points.push(vertex(u,v),vertex(u+1/8,v));
      if(j<8)points.push(vertex(u,v),vertex(u,v+1/8));
    }
    const lines=new THREE.LineSegments(registry.geometry(new THREE.BufferGeometry().setFromPoints(points)),
      registry.track(new THREE.LineBasicMaterial({color:0x527f79})));
    lines.position.set(...at);parent.add(lines);
    for(let i=0;i<5;i++)ball(parent,i%2?paint.cream:paint.red,[.09,.08,.14],
      [at[0]-width/2+i*width/4,at[1]+.12,at[2]-length/2]);
  };
  return {paint,box,ball,post,path,coil,tray,net};
}
const kits=new WeakMap<Registry,ReturnType<typeof createDetailKit>>();
function detailKit(registry:Registry){
  let kit=kits.get(registry);if(!kit){kit=createDetailKit(registry);kits.set(registry,kit);}return kit;
}

export function addTownLife(registry:Registry,town:THREE.Group,floor:number){
  const {paint,box,ball,post,path,tray}=detailKit(registry);
  const group=new THREE.Group();group.name="plaza-market-and-street-details";town.add(group);
  // A drooping festival string above the gallery canopies, clear of the paths.
  const string=(t:number)=>new THREE.Vector3(-15.8+t*20,floor+5.65-Math.sin(t*Math.PI)*1.05,-7.9);
  path(group,[0,.25,.5,.75,1].map(t=>string(t).toArray() as At),.022,paint.wood);
  const flagGeometry=registry.geometry(new THREE.BufferGeometry());
  flagGeometry.setAttribute("position",new THREE.Float32BufferAttribute([-.25,0,0,.25,0,0,.04,-.57,.09],3));
  flagGeometry.setIndex([0,2,1]);flagGeometry.computeVertexNormals();
  const flagPaint=[COLOR.madder,COLOR.saffron,COLOR.jadeDeep].map(color=>registry.lit(color,{side:THREE.DoubleSide}));
  for(let i=0;i<23;i++){
    const flag=new THREE.Mesh(flagGeometry,flagPaint[i%3]);flag.position.copy(string((i+.5)/23));
    flag.rotation.y=Math.sin(i*1.7)*.25;group.add(flag);
  }
  for(const [index,x] of [-12,-6,0].entries()){
    box(group,paint.wood,[2.25,.12,1],[x,floor+.88,-8.8]);
    for(const side of [-1,1])box(group,paint.teal,[.12,.8,.8],[x+side*.93,floor+.4,-8.8]);
    if(index===0){
      for(let stack=0;stack<3;stack++)for(let book=0;book<3;book++){
        const cover=[paint.red,paint.teal,paint.gold][(stack+book)%3];
        const px=x-.68+stack*.67,py=floor+1+book*.14;
        box(group,cover,[.52,.12,.66],[px,py,-8.7]);
        box(group,paint.cream,[.44,.065,.012],[px,py,-8.36]);
      }
    }else if(index===1){
      for(const side of [-1,1]){
        const basket=tray(group,[x+side*.56,floor+.95,-8.75],.95);
        for(let fruit=0;fruit<7;fruit++){
          const angle=fruit*2.4;
          ball(basket,side<0?paint.gold:paint.red,[.13,.14,.13],
            [Math.cos(angle)*.26,.22+Math.floor(fruit/5)*.15,Math.sin(angle)*.17]);
        }
      }
    }else{
      for(const [i,dx] of [-.65,0,.65].entries()){
        post(group,i%2?paint.teal:paint.clay,.18,.35,[x+dx,floor+1.12,-8.75]);
        for(let bloom=0;bloom<4;bloom++){
          const px=x+dx+Math.cos(bloom*2.4)*.12,pz=-8.75+Math.sin(bloom*2.4)*.12;
          post(group,paint.leaf,.014,.33,[px,floor+1.43,pz]);
          ball(group,i%2?paint.pink:paint.gold,[.11,.055,.11],[px,floor+1.61,pz]);
        }
      }
    }
  }
  // Napkins and pastries sit on the existing cafe tables.
  for(const [x,z] of [[1,-3],[2,4],[.5,11]]){
    box(group,paint.cream,[.3,.014,.24],[x-.18,floor+.977,z-.31]).rotation.y=.25;
    const plate=post(group,paint.cream,.17,.018,[x+.3,floor+.981,z-.31]);
    plate.scale.z*=.85;
    ball(group,paint.clay,[.11,.055,.07],[x+.3,floor+1.025,z-.31]);
  }
  // Inset drainage grilles add small construction details to the paving.
  for(const [x,z] of [[-15,1],[5,9],[21,6]]){
    box(group,paint.dark,[.65,.025,.38],[x,floor+.025,z]);
    for(let i=0;i<6;i++)box(group,paint.wood,[.035,.015,.33],[x-.25+i*.1,floor+.044,z]);
  }
}

export function addPortLife(registry:Registry,port:THREE.Group,floor:number,seaY:number){
  const {paint,box,ball,post,path,coil,tray,net}=detailKit(registry);
  const group=new THREE.Group();group.name="port-fishing-and-mooring-details";port.add(group);
  // Fishing equipment stays beside the warehouses, leaving the cargo apron open.
  net(group,[25.25,floor+.12,6.8],1.8,2.7);
  coil(group,[24.7,floor+.04,9.2],1.15);coil(group,[37.9,floor+.04,8.4],.8);
  for(const [x,z] of [[24.7,4.3],[36.8,7.1]]){
    const basket=tray(group,[x,floor+.04,z]);
    for(let i=0;i<4;i++){
      const fish=ball(basket,paint.cream,[.075,.06,.25],[-.36+i*.23,.22,Math.sin(i)*.08]);fish.rotation.y=.2*i;
      ball(basket,paint.teal,[.045,.025,.06],[-.36+i*.23,.28,.15+Math.sin(i)*.08]);
    }
  }
  for(const [x,z] of [[24.6,16.5],[37.8,11.1]]){
    for(const side of [-1,1])post(group,paint.wood,.045,1.4,[x+side*.55,floor+.7,z]);
    path(group,[[x-.58,floor+1.3,z],[x,floor+1.4,z],[x+.58,floor+1.3,z]],.04,paint.wood);
    for(let i=0;i<4;i++){
      const px=x-.39+i*.26;
      path(group,[[px,floor+1.36,z],[px,floor+.95,z+.05]],.014);
      ball(group,i%2?paint.cream:paint.red,[.105,.18,.105],[px,floor+.79,z+.05]);
    }
  }
  // Bollards, rope coils, ladders and fenders connect the walls to the water.
  for(const x of [24.5,31.5,38.4]){
    post(group,paint.dark,.14,.45,[x,floor+.225,20.35]);
    box(group,paint.dark,[.65,.12,.2],[x,floor+.48,20.35]);
    coil(group,[x-.5,floor+.04,19.9],.65);
  }
  for(const x of [25,33]){
    for(const side of [-1,1])path(group,[[x+side*.32,floor+.16,20.7],[x+side*.32,floor+.4,21.4],
      [x+side*.32,seaY+.25,21.5]],.035,paint.dark);
    for(let y=seaY+.5;y<floor;y+=.45)box(group,paint.dark,[.64,.045,.07],[x,y,21.5]);
  }
  for(const [x,z] of [[26.5,28.4],[28.5,35],[34.8,28.4],[36.8,34.6]]){
    const fender=new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.24,.075,8,20)),paint.dark);
    fender.position.set(x,seaY+.65,z);fender.rotation.y=Math.PI/2;group.add(fender);
    path(group,[[x,seaY+1.5,z],[x,seaY+.85,z]],.022);
  }
  // Alternating stone joints and corner blocks make the storehouses less plain.
  for(const x of [28.2,35.2]){
    for(const side of [-1,1])for(let y=.5;y<4;y+=.48){
      box(group,paint.cream,[.36,.17,.16],[x+side*3.07,floor+y,-1.86]);
    }
    for(let y=1;y<4;y+=1.1)for(let z=-11;z< -2.5;z+=1.4){
      box(group,paint.wood,[.016,.025,.42],[x+3.215,floor+y,z+(y%2)*.18]);
    }
  }
  // A framed timetable gives the port office an entrance.
  box(group,paint.wood,[1.05,.85,.08],[37.85,floor+1.7,16.66]);
  box(group,paint.cream,[.86,.66,.03],[37.85,floor+1.7,16.715]);
  for(let row=0;row<4;row++)box(group,paint.teal,[.56-row*.065,.035,.025],[37.8,floor+1.91-row*.14,16.745]);
}

export function addFishingBoatLife(registry:Registry,boat:THREE.Group,index:number){
  const {paint,box,ball,post,path,coil}=detailKit(registry);
  const group=new THREE.Group();group.name="fishing-boat-deck-details";boat.add(group);
  coil(group,[-.55,.1,.6],.5);
  box(group,paint.dark,[.055,.45,.055],[0,1.85,-.9]);
  box(group,paint.cream,[.78,.035,.04],[0,1.05,-.102]);
  box(group,paint.cream,[.035,.55,.04],[0,1.05,-.102]);
  post(group,paint.dark,.075,.65,[.5,1.85,-1.2]);
  post(group,paint.cream,.1,.075,[.5,2.21,-1.2]);
  for(const side of [-1,1]){
    for(const z of [-1.7,.1]){
      ball(group,paint.cream,[.12,.27,.12],[side*1.02,-.02,z]);
      path(group,[[side*1.0,.28,z],[side*1.02,.08,z]],.018);
    }
  }
  for(let i=0;i<3;i++)ball(group,i%2?paint.cream:paint.red,[.13,.19,.13],[-.64+i*.23,.45,-1.8]);
  // A small signal pennant makes each boat identifiable from the quay.
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.64,-.07);shape.lineTo(0,-.29);shape.closePath();
  const flagPaint=registry.lit(index%2?COLOR.saffron:COLOR.madder,{side:THREE.DoubleSide});
  const flag=new THREE.Mesh(registry.geometry(new THREE.ShapeGeometry(shape)),flagPaint);
  flag.position.set(0,3.3,.5);group.add(flag);
}
