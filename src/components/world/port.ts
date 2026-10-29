import * as THREE from "three";
import { COLOR, type Registry } from "./theme";
import { batchStatic } from "./batching";
import { buildVesselHull } from "./vesselDesign";
import { buildLightHalos, type GlowLight } from "./lighting";
import { BREAKWATER_OUTLINE, SHORE_QUAYS } from "./harborLayout";

/** A connected working quay, protected fishing basin and lighthouse. */
export function buildPort(registry: Registry, floor: number, seaY: number) {
  const group = new THREE.Group();
  group.name = "working-port";
  const cream = registry.lit(COLOR.ivory), stone = registry.lit(COLOR.rockDeep);
  const red = registry.lit(COLOR.madder), green = registry.lit(COLOR.jadeDeep);
  const wood = registry.lit(0xc88b4c), timber = registry.lit(0x765536), gold = registry.lit(COLOR.saffron);
  const navy = registry.lit(COLOR.opening), glass = registry.lit(0x57b9ce);
  const lamp = registry.lit(0xffd783, { emissive: 0xffbb52, emissiveIntensity: 0 });
  const cylinder = registry.geometry(new THREE.CylinderGeometry(1, 1, 1, 20));
  const rope = registry.lit(0xe9d8a9);
  const lights: GlowLight[] = [];
  const box = (parent: THREE.Object3D, material: THREE.Material, size: number[], at: number[]) => {
    const mesh = new THREE.Mesh(registry.roundedBox(size, .04), material);
    mesh.position.set(at[0], at[1], at[2]); parent.add(mesh); return mesh;
  };
  const column = (parent: THREE.Object3D, material: THREE.Material, radius: number, height: number, at: number[]) => {
    const mesh = new THREE.Mesh(cylinder, material);
    mesh.scale.set(radius, height, radius); mesh.position.set(at[0], at[1], at[2]); parent.add(mesh); return mesh;
  };
  const beam = (parent: THREE.Object3D, material: THREE.Material, a: number[], b: number[], radius: number) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(cylinder, material);
    mesh.scale.set(radius, start.distanceTo(end), radius);
    mesh.position.copy(start).lerp(end, .5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
    parent.add(mesh); return mesh;
  };
  const slab = (outline: readonly (readonly number[])[], top: number, depth: number, material: THREE.Material) => {
    const shape = new THREE.Shape();
    outline.forEach(([x, z], i) => { if (i) shape.lineTo(x, z); else shape.moveTo(x, z); });
    shape.closePath();
    const mesh = new THREE.Mesh(registry.geometry(new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelSize: .10, bevelThickness: .08, bevelSegments: 2, curveSegments: 12,
    })), material);
    mesh.rotation.x = Math.PI / 2; mesh.position.y = top; group.add(mesh); return mesh;
  };
  const quay = SHORE_QUAYS[2];
  const [cx, cz] = quay.center, [hx, hz] = quay.halfSize;
  const outline = [[cx-hx,cz-hz],[cx+hx-.6,cz-hz],[cx+hx,cz-hz+.6],
    [cx+hx,cz+hz-.6],[cx+hx-.6,cz+hz],[cx-hx,cz+hz]];
  slab(outline, 0, floor - seaY + 1, stone);
  slab(outline, floor, .32, cream);
  const paving = registry.lit(0xe9d8a5);
  const tileGeometry = registry.geometry(new THREE.PlaneGeometry(1.7,1.55));
  for(let x=24.5;x<39;x+=1.85)for(let z=1.1;z<20;z+=1.7) {
    if(x>32.7&&z>10.9&&z<18.9)continue;
    const tile=new THREE.Mesh(tileGeometry,paving);
    tile.rotation.x=-Math.PI/2;tile.position.set(x,floor+.09,z);group.add(tile);
  }
  // Narrow courses and edge stones make this an extension of the existing quay.
  for (let z = -13; z < 20; z += 2.1) box(group, stone, [.10,.025,1.65], [39.2,floor+.025,z]);
  for (let x = 24; x < 39; x += 2) box(group, stone, [1.6,.025,.10], [x,floor+.025,20.6]);

  const roof = (parent: THREE.Object3D, width: number, depth: number, top: number, rise: number, material: THREE.Material) => {
    const profile = new THREE.Shape();
    profile.moveTo(-width/2, 0); profile.lineTo(0, rise); profile.lineTo(width/2, 0); profile.closePath();
    const geometry = registry.geometry(new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: false }));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, top, -depth/2); parent.add(mesh);
    for (let x = -width/2+.25; x < width/2; x += .55) {
      const height = rise * (1-Math.abs(x)/(width/2));
      box(parent, material === red ? timber : navy, [.028,.035,depth+.035], [x,top+height+.025,0]);
    }
    beam(parent, cream, [-width/2,top+.025,depth/2+.03], [0,top+rise+.025,depth/2+.03], .055);
    beam(parent, cream, [0,top+rise+.025,depth/2+.03], [width/2,top+.025,depth/2+.03], .055);
  };
  // Twin gabled storehouses leave the entire forward apron open for cargo.
  for (const [x, paint] of [[28.2, red], [35.2, green]] as const) {
    const warehouse = new THREE.Group(); warehouse.position.set(x, floor, -7); group.add(warehouse);
    box(warehouse, cream, [6.4,4.2,10], [0,2.1,0]);
    box(warehouse, paint, [6.6,.22,10.2], [0,.25,0]);
    roof(warehouse, 7.0, 10.8, 4.2, 1.7, paint);
    for(const z of [-2.7,2.7]) {
      column(warehouse,navy,.16,.6,[0,6.15,z]);
      const vent=new THREE.Mesh(registry.geometry(new THREE.ConeGeometry(.3,.22,16)),paint);
      vent.position.set(0,6.55,z);warehouse.add(vent);
    }
    for (const side of [-1,1]) {
      box(warehouse, timber, [.16,4.0,.14], [side*3.05,2.2,5.06]);
      box(warehouse, paint, [1.9,2.9,.12], [side*1.1,1.65,5.075]);
      for (let slat = 0; slat < 5; slat++) box(warehouse, timber, [.025,2.7,.03], [side*1.1-.75+slat*.375,1.65,5.16]);
      beam(warehouse, cream, [side*.25,.4,5.19], [side*1.95,2.9,5.19], .055);
    }
    box(warehouse, timber, [4.6,.18,.22], [0,3.18,5.15]);
    const window = new THREE.Mesh(registry.geometry(new THREE.CircleGeometry(.52, 32)), glass);
    window.position.set(0,4.6,5.43); warehouse.add(window);
    const rim = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.57,.06,8,32)), cream);
    rim.position.copy(window.position).add(new THREE.Vector3(0,0,.035)); warehouse.add(rim);
    for (const side of [-1,1]) for (const z of [-3,0,3]) {
      box(warehouse, navy, [.04,1.0,1.0], [side*3.225,2.7,z]);
      box(warehouse, lamp, [.045,.75,.75], [side*3.25,2.7,z]);
    }
  }

  // Port office: shaded veranda, round window and a small lookout balcony.
  const office = new THREE.Group(); office.position.set(35.7, floor, 14.1); group.add(office);
  box(office, registry.lit(COLOR.rose), [5.3,3.6,5], [0,1.8,0]);
  roof(office, 6.1, 6, 3.6, 1.2, green);
  for (const x of [-1.45,1.45]) {
    box(office, navy, [1.0,1.1,.10], [x,2.0,2.54]);
    box(office, lamp, [.75,.85,.12], [x,2.0,2.56]);
    box(office, green, [.22,1.2,.15], [x-.65,2.0,2.57]);
    box(office, green, [.22,1.2,.15], [x+.65,2.0,2.57]);
  }
  box(office, timber, [.9,2.2,.12], [0,1.1,2.56]);
  box(office, wood, [5.9,.22,1.8], [0,.15,3.2]);
  box(office, red, [6.0,.14,1.9], [0,2.7,3.2]).rotation.x = .08;
  for (const x of [-2.7,2.7]) column(office, cream, .07, 2.6, [x,1.4,3.9]);

  // Timber cargo crane with a suspended hook, wheel and rigging.
  const crane = new THREE.Group(); crane.position.set(26.0,floor,12.5); group.add(crane);
  box(crane, stone, [2.0,.45,2.0], [0,.225,0]);
  beam(crane,timber,[0,.45,0],[0,7.1,0],.19);
  beam(crane,wood,[0,6.7,0],[3.8,7.3,2.2],.17);
  beam(crane,timber,[0,3.5,0],[3.0,7.05,1.75],.10);
  beam(crane,rope,[0,7.0,0],[3.8,7.3,2.2],.035);
  beam(crane,navy,[3.8,7.3,2.2],[3.8,3.6,2.2],.028);
  const hook = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.22,.055,8,20,Math.PI*1.55)),navy);
  hook.position.set(3.8,3.4,2.2); hook.rotation.z = -.3; crane.add(hook);
  const wheel = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.55,.07,8,24)),navy);
  wheel.position.set(.3,1.8,.6); crane.add(wheel);

  const crate = (x: number, z: number, y: number, size: number) => {
    box(group, wood, [size,size,size], [x,y+size/2,z]);
    for (const side of [-1,1]) {
      box(group, timber, [size*.1,size+.035,size+.035], [x+side*size*.34,y+size/2,z]);
      beam(group,cream,[x-size*.36,y+.12,z+side*(size/2+.03)],
        [x+size*.36,y+size-.12,z+side*(size/2+.03)],.035);
    }
  };
  [[25.7,1.1],[27.3,1.0],[25.7,2.7],[30.8,5.8],[32.5,5.8],[30.8,7.4]].forEach(([x,z],i)=>{
    crate(x,z,floor+.03,1.25); if(i===0||i===3)crate(x,z,floor+1.32,1.05);
  });
  const barrelGeometry = registry.geometry(new THREE.LatheGeometry(
    [[0,0],[.42,0],[.5,.2],[.55,.65],[.48,1.2],[.4,1.3],[0,1.3]].map(([r,y])=>new THREE.Vector2(r,y)),20));
  for (const [x,z] of [[37,3],[38.2,3],[37.5,4.3]]) {
    const barrel = new THREE.Mesh(barrelGeometry,wood); barrel.position.set(x,floor,z); group.add(barrel);
    for (const y of [.2,1.05]) {
      const hoop = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.5,.04,8,24)),navy);
      hoop.rotation.x=-Math.PI/2; hoop.position.set(x,floor+y,z); group.add(hoop);
    }
  }

  // Floating fingers are reached by real descending steps from the high quay.
  const deck = seaY + .95;
  const docks = [{x:27.5,end:40.2},{x:35.8,end:36.6}];
  for (const dock of docks) {
    const start = 25.78;
    for (let i=0;i<8;i++) {
      const top = floor-(floor-deck)*i/7;
      box(group,wood,[1.9,.17,.63],[dock.x,top-.085,21.1+i*.62]);
      if(i%2===0) for(const side of [-1,1]) column(group,timber,.075,1.1,[dock.x+side*.94,top+.45,21.1+i*.62]);
    }
    for(const side of [-1,1])beam(group,rope,[dock.x+side*.94,floor+.95,21.1],
      [dock.x+side*.94,deck+.95,25.44],.04);
    for (let z=start;z<dock.end;z+=.48) {
      const length=Math.min(.43,dock.end-z);
      box(group,wood,[1.85,.22,length],[dock.x,deck-.11,z+length/2]);
    }
    for(const side of [-1,1])box(group,timber,[.16,.25,dock.end-start],[dock.x+side*.7,deck-.3,(start+dock.end)/2]);
    for(let z=start+.6;z<dock.end;z+=3.2)for(const side of [-1,1]) {
      column(group,timber,.13,2.4,[dock.x+side*.94,deck-.75,z]);
      box(group,cream,[.32,.12,.32],[dock.x+side*.94,deck+.5,z]);
      box(group,navy,[.12,.14,.45],[dock.x+side*.7,deck+.1,z+.5]);
    }
  }

  const boats: { group: THREE.Group; phase: number }[] = [];
  const paints = [red,green,navy,red];
  for(const [i,at] of [[25.0,29,0],[30.1,34.7,Math.PI],[33.3,29.8,0],[38.3,32.7,Math.PI]].entries()) {
    const boat = new THREE.Group(); boat.name=`port-fishing-boat-${i}`;
    boat.position.set(at[0],seaY+.65,at[1]); boat.rotation.y=at[2]; group.add(boat);
    boat.add(buildVesselHull(registry,{stern:-2.7,bow:3.2,beam:2.2,deck:0,depth:.95,
      paint:paints[i],trim:cream,timber:wood,rail:gold}));
    box(boat,cream,[1.5,1.4,1.45],[0,.8,-.9]);
    box(boat,paints[i],[1.75,.14,1.65],[0,1.57,-.9]);
    box(boat,glass,[1.15,.55,.06],[0,1.05,-.145]);
    for(const side of [-1,1])box(boat,glass,[.06,.55,.8],[side*.77,1.05,-.85]);
    column(boat,timber,.045,3.5,[0,1.8,.5]);
    beam(boat,rope,[-.8,.25,2.1],[0,3.4,.5],.018);
    beam(boat,rope,[.8,.25,2.1],[0,3.4,.5],.018);
    box(boat,wood,[1.3,.5,.85],[0,.35,1.3]);
    for(let slat=0;slat<4;slat++)box(boat,cream,[1.2,.035,.025],[0,.62,1.0+slat*.18]);
    const ring=new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.26,.07,8,24)),gold);
    ring.position.set(.82,.7,-1.1); ring.rotation.y=Math.PI/2; boat.add(ring);
    batchStatic(boat,registry); boats.push({group:boat,phase:i*1.9});
  }

  const crest=seaY+.95;
  slab(BREAKWATER_OUTLINE,crest,2.6,stone);
  // A narrow coping runs along the same non-overlapping L outline.
  slab(BREAKWATER_OUTLINE,crest+.18,.16,cream);
  const tower = new THREE.Group(); tower.name="harbor-lighthouse";
  tower.position.set(43,crest+.28,40.7); group.add(tower);
  column(tower,stone,1.6,.35,[0,.175,0]);
  for(let i=0;i<4;i++) {
    const bottom=1.13-i*.105, top=bottom-.105;
    const section = new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(top,bottom,1.4,40)),i%2?red:cream);
    section.position.y=.35+(i+.5)*1.4; tower.add(section);
  }
  column(tower,cream,1.25,.24,[0,6.05,0]);
  const lanternGlass = registry.lit(0x80c9dc,{transparent:true,opacity:.55,depthWrite:false});
  column(tower,lanternGlass,.83,1.4,[0,6.9,0]);
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4;
    column(tower,navy,.035,1.5,[Math.cos(angle)*.86,6.9,Math.sin(angle)*.86]);
    column(tower,navy,.025,.65,[Math.cos(angle)*1.18,6.5,Math.sin(angle)*1.18]);
  }
  const railing = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(1.18,.035,8,40)),navy);
  railing.rotation.x=-Math.PI/2; railing.position.y=6.83; tower.add(railing);
  const cap = new THREE.Mesh(registry.geometry(new THREE.ConeGeometry(1.15,.9,40)),red);
  cap.position.y=8.05; tower.add(cap);
  column(tower,gold,.065,.5,[0,8.6,0]);
  column(tower,lamp,.26,.8,[0,6.9,0]);
  lights.push({at:[43,crest+7.2,40.7],size:5,color:0xffda83});
  // Small steps connect the breakwater to the outer edge of the working quay.
  for(let i=0;i<8;i++) {
    const top=floor-.12-(floor-.12-crest-.18)*i/7;
    box(group,cream,[.44,.18,1.6],[39.88+i*.44,top-.09,14.5]);
  }
  for(const [x,z] of [[25,18.7],[38.7,18.7],[24.5,-11.8],[39,-11.8]]) {
    column(group,navy,.065,3.5,[x,floor+1.75,z]);
    box(group,lamp,[.38,.55,.38],[x,floor+3.55,z]);
    box(group,green,[.65,.14,.65],[x,floor+3.9,z]);
    lights.push({at:[x,floor+3.55,z],size:2.2,color:0xffd783});
  }
  const halos=buildLightHalos(registry,lights); halos.visible=false; group.add(halos);
  batchStatic(group,registry,[halos,...boats.map(boat=>boat.group)]);
  return {
    group,
    setNight:(night:boolean)=>{lamp.emissiveIntensity=night?2.6:0;halos.visible=night;},
    update:(elapsed:number,reduce:boolean)=>{
      const time=reduce?0:elapsed;
      boats.forEach(boat=>{
        boat.group.position.y=seaY+.65+Math.sin(time*.85+boat.phase)*.065;
        boat.group.rotation.z=Math.sin(time*.6+boat.phase)*.015;
      });
    },
  };
}
