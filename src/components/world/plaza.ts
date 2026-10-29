import * as THREE from "three";
import { PLAZA_STOPS } from "./plazaStops";
import { buildHarbor } from "./harbor";
import { buildResidents } from "./residents";
import { buildPlazaDetails } from "./plazaDetails";
import { buildGarden } from "./garden";
import { buildFountainWater } from "./fountain";
import { buildBuildingDetails } from "./buildingDesign";
import { type Site, seeded, stairRun } from "./architecture";
import { SCREEN_RIGHT, SCREEN_UP, screenBox } from "./layout";
import { COLOR, type Registry, type Palette } from "./theme";
import { SHORE_QUAYS } from "./harborLayout";

/** A walkable piazza on two quays. All levels are independent of copy length. */
export async function buildPlaza(registry: Registry, palette: Palette,
  checkpoint: () => Promise<void>) {
  const root = new THREE.Group();
  root.name = "venetian-plaza";
  const town = new THREE.Group();
  town.rotation.y = Math.PI / 4;
  root.add(town);
  const floor = .35;
  const site: Site = { registry, palette, rand: seeded(42) };
  const cube = registry.geometry(new THREE.BoxGeometry(1, 1, 1));
  const box = (parent: THREE.Object3D, material: THREE.Material,
    size: [number, number, number], at: [number, number, number], outline = false) => {
    const mesh = new THREE.Mesh(registry.roundedBox(size), material);
    mesh.position.set(...at);
    parent.add(mesh);
    if (outline) registry.outline(mesh);
    return mesh;
  };
  const baluster = registry.geometry(new THREE.LatheGeometry(
    [[.085,0],[.085,.08],[.055,.12],[.08,.28],[.095,.36],[.065,.48],[.045,.62],[.075,.68],[.075,.75]].map(([r,y])=>new THREE.Vector2(r,y)),16));
  const limestone = registry.lit(COLOR.ivory);
  const terracotta = registry.lit(COLOR.madder);
  const pink = registry.lit(COLOR.rose);
  const yellow = registry.lit(COLOR.sand);
  const azure = registry.lit(COLOR.iris);
  const violet = registry.lit(COLOR.lawn);
  const jade = registry.lit(COLOR.paleTeal);
  const blueRoof = registry.lit(0x248679);
  const violetRoof = registry.lit(COLOR.madderDeep);
  const goldRoof = registry.lit(COLOR.saffronDeep);
  const teal = registry.lit(COLOR.tealDeep);
  const wood = registry.lit(0xb77c40);
  const shutter = registry.lit(COLOR.jadeDeep);
  const roofSeam = registry.lit(0x983b2b);
  const lampGlass = registry.lit(0xffd47e,{emissive:0xffac45,emissiveIntensity:0});
  const materials = (stone: THREE.Material) => ({ stone, trim: limestone,
    shadow: palette.rockDeep, accent: terracotta, recess: palette.deep });

  // Rounded waterfront outlines descend below the water instead of floating
  // above it like a display plinth. The six-unit canal remains open.
  SHORE_QUAYS.slice(0,2).forEach(({center:[x],halfSize:[halfWidth]}) => {
    const width=halfWidth*2;
    const w = width / 2, d = 20.25, r = 1.3;
    const shore = new THREE.Shape();
    shore.moveTo(-w+r,-d);shore.lineTo(w-r,-d);
    shore.quadraticCurveTo(w,-d,w,-d+r);shore.lineTo(w,d-r);
    shore.quadraticCurveTo(w,d,w-r,d);shore.lineTo(-w+r,d);
    shore.quadraticCurveTo(-w,d,-w,d-r);shore.lineTo(-w,-d+r);
    shore.quadraticCurveTo(-w,-d,-w+r,-d);shore.closePath();
    for(const [depth,top,material] of [[3.65,0,palette.rockDeep],[.35,.35,limestone]] as const) {
      const quay = new THREE.Mesh(registry.geometry(new THREE.ExtrudeGeometry(shore,{depth,bevelEnabled:false,curveSegments:16})),material);
      quay.rotation.x=Math.PI/2;quay.position.set(x,top,1);town.add(quay);
    }
  });
  const paving = [0xe8d8a4,0xf1e3b7,0xdfcc96].map(color=>registry.lit(color));
  const pavingCorner=(column:number,row:number)=>new THREE.Vector3(-16.05+column*2.2+Math.sin(column*19.7+row*8.3)*.12,
    floor+.025,-9.05+row*2.2+Math.sin(column*7.3-row*21.1)*.12);
  // Flat, irregular stone joints replace the raised checkerboard of blocks.
  for(let column=0;column<9;column++)for(let row=0;row<11;row++) {
      const corners=[pavingCorner(column,row),pavingCorner(column,row+1),pavingCorner(column+1,row+1),pavingCorner(column+1,row)];
      const center=corners.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(.25);
      if(Math.hypot(center.x+6,center.z-3)<3.9)continue;
      const geometry=registry.geometry(new THREE.BufferGeometry());
      geometry.setFromPoints(corners.map(p=>p.lerp(center,.012)));
      geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
      const tint=Math.floor(Math.abs(Math.sin(column*12.9+row*8.7))*paving.length);
      town.add(new THREE.Mesh(geometry,paving[tint]));
  }

  await checkpoint();
  const window = (parent: THREE.Object3D, x: number, y: number, z: number, yaw = 0,
    accent: THREE.Material = shutter, heightScale = 1) => {
    const model = registry.model("window", materials(palette.deep));
    if (!model) return;
    model.scale.set(.72, heightScale, 1);
    model.rotation.y = yaw;
    model.position.set(x, y, z);
    parent.add(model);
    const trim = new THREE.Group();
    trim.position.set(x, y, z);
    trim.rotation.y = yaw;
    trim.scale.y = heightScale;
    for (const side of [-1, 1]) {
      box(trim, accent, [.3, 1.3, .12], [side * .58, .65, .07]);
      for (let i = 0; i < 4; i++) box(trim, teal, [.24, .045, .14], [side * .58, .22 + i * .26, .09]);
    }
    box(trim, limestone, [1.55, .13, .45], [0, -.05, .12]);
    parent.add(trim);
  };
  const roof = (parent: THREE.Object3D, width: number, depth: number, rise: number,
    at: [number, number, number], yaw = 0, paint: THREE.MeshToonMaterial = terracotta) => {
    const w = width / 2, d = depth / 2;
    const positions = [-w,0,-d, w,0,-d, -w,0,d, w,0,d, -w,rise,0, w,rise,0];
    const geometry = registry.geometry(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([0,4,5,0,5,1, 2,3,5,2,5,4, 0,2,4,1,5,3, 0,1,3,0,3,2]);
    geometry.computeVertexNormals();
    const model = new THREE.Mesh(geometry.toNonIndexed(), paint);
    model.geometry.computeVertexNormals();
    registry.geometry(model.geometry);
    model.position.set(...at);
    model.rotation.y = yaw;
    registry.outline(model);
    parent.add(model);
    const tilework = new THREE.Group();
    tilework.position.set(...at);
    tilework.rotation.y = yaw;
    const tileInk=paint===terracotta?roofSeam:registry.lit(paint.color.clone().multiplyScalar(.55).getHex());
    const roll = registry.geometry(new THREE.CylinderGeometry(.035, .035, Math.hypot(d, rise), 10));
    const up = new THREE.Vector3(0, 1, 0);
    for (let x = -w + .25; x < w; x += .55) {
      for (const side of [-1, 1]) {
        const tile = new THREE.Mesh(roll, tileInk);
        tile.position.set(x, rise / 2 + .03, side * d / 2);
        tile.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, -rise, side * d).normalize());
        tilework.add(tile);
      }
    }
    for (let course = 1; course <= 3; course++) for (const side of [-1, 1]) {
      const along = course / 4;
      box(tilework, tileInk, [width, .022, .03], [0, rise * (1 - along) + .025, side * d * along]);
    }
    const ridge=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-w,rise+.04,0),new THREE.Vector3(0,rise+.08,0),new THREE.Vector3(w,rise+.04,0)]);
    tilework.add(new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(ridge,24,.065,8,false)),paint));
    parent.add(tilework);
  };
  const arcade = (parent: THREE.Object3D, count: number, depth: number, height: number,
    at: [number, number, number], yaw = 0, stone: THREE.Material = limestone) => {
    const row = new THREE.Group();
    row.position.set(...at);
    row.rotation.y = yaw;
    for (let i = 0; i < count; i++) {
      const bay = registry.model("vault", materials(stone));
      if (!bay) continue;
      bay.scale.set(1, height / 2.5, depth / 2.2);
      bay.position.x = (i - (count - 1) / 2) * 2.6;
      row.add(bay);
    }
    parent.add(row);
    return row;
  };

  // A two-storey palazzo and a connected open loggia enclose the piazza.
  const palazzo = new THREE.Group();
  palazzo.name = "courtyard-palazzo";
  town.add(palazzo);
  arcade(palazzo, 8, 6, 3.5, [-6, floor, -15]);
  const wings = [
    {x:-12.8,width:7.2,top:8.05,paint:pink,roof:violetRoof},
    {x:-5.7,width:7,top:9,paint:yellow,roof:terracotta},
    {x:1.1,width:6.6,top:7.8,paint:azure,roof:blueRoof},
  ];
  for(const wing of wings) {
    box(palazzo,wing.paint,[wing.width,wing.top-3.5,6],[wing.x,floor+(wing.top+3.5)/2,-15],true);
    box(palazzo,limestone,[wing.width+.16,.22,6.35],[wing.x,floor+wing.top+.05,-15]);
    roof(palazzo,wing.width+.5,7,1.3,[wing.x,floor+wing.top+.17,-15],0,wing.roof);
  }
  for (let i = 0; i < 11; i++) {
    const x=-15+i*1.8;
    window(palazzo,x,floor+4.3,-11.99,0,x < -9.2 ? jade : x < -2.2 ? blueRoof : yellow);
  }
  for(const x of [-7.9,-5.7,-3.5])window(palazzo,x,floor+7.05,-11.99,0,blueRoof,.75);

  arcade(town, 8, 4.4, 3.5, [-19.2, floor, 1], Math.PI / 2);
  box(town, teal, [4.4, .3, 20.8], [-19.2, floor + 3.65, 1]);
  for (let z = -8.6; z <= 10.6; z += 2.4) {
    const spindle=new THREE.Mesh(baluster,limestone);spindle.position.set(-17.12,floor+3.8,z);town.add(spindle);
  }
  box(town, limestone, [.22, .2, 20.8], [-17.12, floor + 4.6, 1]);
  const pavilion = registry.model("pavilion", materials(teal));
  if (pavilion) {
    pavilion.scale.setScalar(1.15);
    pavilion.position.set(-19.2, floor + 3.8, -7.2);
    town.add(pavilion);
  }
  // The only tower is a modest campanile, lower than the old single storey.
  const bell = registry.model("tower_dome", materials(azure));
  if (bell) {
    bell.name = "campanile";
    bell.scale.set(1.45, 1.6, 1.45);
    bell.position.set(-18.8, floor, -15.2);
    town.add(bell);
  }

  await checkpoint();
  // A lower canal-side wing on the opposite bank shares the same vocabulary.
  const canalHouse = new THREE.Group();
  canalHouse.position.set(19, floor, -2.2);
  canalHouse.rotation.y = Math.PI / 2;
  town.add(canalHouse);
  arcade(canalHouse, 5, 5.4, 2.8, [0, 0, 0], 0, teal);
  for(const wing of [{x:-3.25,top:6.6,paint:jade,roof:goldRoof},{x:3.25,top:6.15,paint:violet,roof:blueRoof}]) {
    box(canalHouse,wing.paint,[6.5,wing.top-2.8,5.4],[wing.x,(wing.top+2.8)/2,0],true);
    box(canalHouse,limestone,[6.65,.2,5.7],[wing.x,wing.top+.05,0]);
    roof(canalHouse,6.95,6.3,1.25,[wing.x,wing.top+.17,0],0,wing.roof);
  }
  for (let i = 0; i < 7; i++) {
    window(canalHouse, -5.4 + i * 1.8, 3.25, 2.71,0,i<3?pink:yellow);
    window(canalHouse, -5.4 + i * 1.8, 3.25, -2.71, Math.PI,i<3?pink:yellow);
  }
  buildBuildingDetails(registry,palazzo,canalHouse,floor);
  await checkpoint();

  // Every stair has explicit endpoints: quay -> bridge deck -> opposite quay.
  const stone = { stone: palette.shelfDeep, deep: palette.rock, accent: palette.sand };
  for (const z of [-10, 12]) {
    const bridge = registry.model("vault", materials(limestone));
    if (bridge) {
      bridge.name = "canal-bridge";
      bridge.scale.set(6.2 / 2.6, 5.15 / 2.5, 3.0 / 2.2);
      bridge.position.set(12.1, -3.45, z);
      town.add(bridge);
    }
    stairRun(town, site, stone, new THREE.Vector3(6.6, floor, z), new THREE.Vector3(9.0, 1.7, z));
    stairRun(town, site, stone, new THREE.Vector3(15.2, 1.7, z), new THREE.Vector3(17.6, floor, z));
    [-1, 1].forEach((side) => {
      box(town, limestone, [6.2, .16, .16], [12.1, 2.45, z + side * 1.4]);
      for (const x of [9.1, 10.6, 12.1, 13.6, 15.1]) {
        const spindle=new THREE.Mesh(baluster,limestone);spindle.position.set(x,1.7,z+side*1.4);town.add(spindle);
      }
    });
  }
  // Meet the loggia's front edge; embedding the final tread in its roof
  // creates two coplanar surfaces that flicker as the camera moves.
  stairRun(town, site, stone, new THREE.Vector3(-19.2, floor, 17.2),
    new THREE.Vector3(-19.2, floor + 3.8, 1 + 20.8 / 2));

  await checkpoint();
  // The centre of the square is a fountain, not a building or a staircase.
  const fountain = new THREE.Group();
  fountain.position.set(-6, floor, 3);
  town.add(fountain);
  const cylinder = (parent: THREE.Object3D, material: THREE.Material, top: number,
    bottom: number, height: number, at: [number, number, number], segments = 32) => {
    const model = new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(top, bottom, height, segments)), material);
    model.position.set(...at);
    parent.add(model);
    return model;
  };
  const turnedStone = (profile: [number, number][]) => {
    const mesh = new THREE.Mesh(registry.geometry(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 48)), limestone);
    fountain.add(mesh);
  };
  turnedStone([[0,0],[3.3,0],[3.58,.08],[3.65,.2],[3.52,.4],[3.25,.55],[3.0,.56],[2.92,.52],[0,.52]]);
  const rim = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(3.13, .18, 12, 64)), limestone);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .58;
  fountain.add(rim);
  turnedStone([[0,.55],[.58,.55],[.62,.67],[.45,.78],[.32,.95],[.25,1.4],[.32,1.9],[.5,2.22],[.42,2.32],[0,2.32]]);
  turnedStone([[0,2.3],[.48,2.3],[.65,2.36],[1.05,2.48],[1.3,2.65],[1.35,2.76],[1.25,2.82],[1.17,2.78],[0,2.78]]);
  const bowlLip = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(1.27, .075, 10, 48)), limestone);
  bowlLip.rotation.x = -Math.PI / 2; bowlLip.position.y = 2.8; fountain.add(bowlLip);
  cylinder(fountain, palette.sand, .16, .24, .7, [0, 3.1, 0]);
  const fountainWater = buildFountainWater(registry);
  fountain.add(fountainWater.group);
  fountainWater.update(0, true);
  await checkpoint();

  // Cafe tables, parasols, benches and planted edges make the square inhabited.
  [[1, -3], [2, 4], [.5, 11]].forEach(([x, z], i) => {
    cylinder(town, wood, .07, .07, 2.9, [x, floor + 1.45, z], 6);
    const canopy = new THREE.Group();
    canopy.position.set(x, floor + 3.15, z);
    const profile = [[0,.375],[.28,.33],[.9,.12],[1.65,-.32],[1.66,-.4],[.9,.04],[.28,.25],[0,.3]].map(([r,y]) => new THREE.Vector2(r,y));
    const panel = registry.geometry(new THREE.LatheGeometry(profile, 2, 0, Math.PI / 10));
    for (let segment = 0; segment < 20; segment++) {
      const fabric = new THREE.Mesh(panel, segment % 4 < 2 ? limestone : i % 2 ? palette.ml : palette.sand);
      fabric.rotation.y = segment * Math.PI / 10; canopy.add(fabric);
    }
    town.add(canopy);
    cylinder(town, wood, .08, .08, .85, [x, floor + .425, z], 6);
    cylinder(town, limestone, .75, .75, .13, [x, floor + .9, z]);
    [-1, 1].forEach((side) => {
      cylinder(town, wood, .37, .37, .12, [x + side * 1.15, floor + .5, z], 24);
      for (const dx of [-.22,.22]) for (const dz of [-.2,.2])
        cylinder(town, shutter, .035, .045, .48, [x + side * 1.15 + dx, floor + .24, z + dz], 12);
    });
  });
  [[-13, -3], [-13, 10], [20, 17]].forEach(([x, z]) => {
    for (let slat = 0; slat < 4; slat++) box(town, wood, [3, .12, .18], [x, floor + .7, z - .33 + slat * .22]);
    [-1, 1].forEach((side) => box(town, palette.rockDeep, [.25, .6, .8], [x + side, floor + .3, z]));
    for (let slat = 0; slat < 3; slat++) box(town, wood, [3, .12, .12], [x, floor + .94 + slat * .16, z - .4 - slat * .035]);
  });
  [[-21, 18], [-12, 18], [3.5, 16], [20, 10], [20, -15]].forEach(([x, z]) => {
    box(town, limestone, [1.65, .7, 1.65], [x, floor + .35, z]);
  });
  // Mooring posts line the canal; they never obstruct the bridge landings.
  for (const z of [-16, -4, 3, 18]) {
    for (const x of [8.5, 15.7]) {
      cylinder(town, palette.systems, .16, .16, 3.7, [x, -.6, z], 8);
      cylinder(town, limestone, .19, .19, .3, [x, 1.4, z], 8);
    }
  }

  const harbor = buildHarbor(registry, floor, 19);
  root.add(harbor.group);
  harbor.update(0, true);
  const residents=buildResidents(registry,floor);
  town.add(residents.group);
  await checkpoint();

  // Dedicated hit volumes make the full landmark clickable, including its arches.
  const hitMaterial = registry.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const hotspots = PLAZA_STOPS.map((stop) => {
    const hit = new THREE.Mesh(cube, hitMaterial);
    hit.name = stop.id;
    hit.scale.set(stop.size[0], stop.size[1], stop.size[2]);
    hit.position.set(stop.position[0], stop.size[1] / 2 + floor, stop.position[2]);
    hit.userData.excludeFromFraming = true;
    town.add(hit);
    const anchor = new THREE.Object3D();
    anchor.position.set(stop.position[0], stop.position[1], stop.position[2]);
    town.add(anchor);
    return { id: stop.id, hit, anchor };
  });

  // Gallery display cases and a workshop bench give the destinations purpose.
  for (const x of [-12, -6, 0]) {
    box(town, limestone, [2.8, .4, 1.3], [x, floor + .2, -9]);
    box(town, wood, [.14, 2.3, .14], [x, floor + 1.45, -9]);
    box(town, teal, [2.1, 1.5, .15], [x, floor + 2.2, -9], true);
    box(town, limestone, [1.5, .08, .18], [x, floor + 2.2, -8.9]);
  }
  box(town, wood, [2, 1.0, 3.3], [19, floor + .5, 7]);
  for (let i = 0; i < 3; i++) {
    box(town, i === 1 ? terracotta : teal, [.7, .55, .7], [19, floor + 1.3, 6 + i]);
  }
  // Lanterns and flower boxes animate the edges without blocking circulation.
  for (const x of [-14, -8, -2, 4]) {
    box(town, terracotta, [1.4, .4, .6], [x, floor + 4.1, -11.55]);

  }
  for (const [x, z] of [[5, 18], [-15, 17], [7, -7], [20, 16]]) {
    cylinder(town, palette.deep, .09, .13, 3.8, [x, floor + 1.9, z], 6);
    box(town, lampGlass, [.5, .7, .5], [x, floor + 4, z], true);
    box(town, palette.deep, [.7, .12, .7], [x, floor + 4.42, z]);
  }

  // Small Venetian details are attached to architecture, clear of the walkways.
  for (const x of [-12, -6, 0]) {
    box(town, limestone, [2.4, .2, 1.0], [x, floor + 4.05, -11.4]);
    for (const dx of [-1, -.5, 0, .5, 1]) box(town, shutter, [.07, .75, .07], [x + dx, floor + 4.5, -10.98]);
    box(town, shutter, [2.4, .1, .1], [x, floor + 4.9, -10.98]);
    // Striped fabric canopy over each gallery display.
    for (let stripe = 0; stripe < 8; stripe++) {
      const awning = box(town, stripe % 2 ? limestone : terracotta,
        [.38, .055, 2.1], [x - 1.33 + stripe * .38, floor + 3.1, -9.3]);
      awning.rotation.x = .17;
      box(town, stripe % 2 ? limestone : terracotta, [.38, .3, .07],
        [x - 1.33 + stripe * .38, floor + 2.8, -8.27]);
    }
    for (const side of [-1, 1]) box(town, wood, [.09, 2.8, .09], [x + side * 1.46, floor + 1.4, -8.3]);
  }
  // A three-colour mosaic borders the fountain, offset above the paving.
  for (let i = 0; i < 24; i++) {
    const tile = new THREE.Mesh(registry.geometry(new THREE.RingGeometry(3.75, 4.15, 1, 1,
      i * Math.PI / 12, Math.PI / 12 - .025)), [teal, terracotta, limestone][i % 3]);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(-6, floor + .045, 3);
    town.add(tile);
  }
  for (const [x, z] of [[-15, 7], [-15, 14], [5.7, 5], [20, 13]]) {
    cylinder(town, terracotta, .6, .4, .85, [x, floor + .425, z], 32);
    const lip = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.58, .055, 8, 32)), terracotta);
    lip.rotation.x = -Math.PI / 2; lip.position.set(x, floor + .83, z); town.add(lip);

  }
  const garden = buildGarden(registry,
    [[-21, floor + .7, 18], [-12, floor + .7, 18], [3.5, floor + .7, 16], [20, floor + .7, 10], [20, floor + .7, -15]],
    [[-15, floor + .85, 7], [-15, floor + .85, 14], [5.7, floor + .85, 5], [20, floor + .85, 13]],
    [[-14, floor + 4.3, -11.55], [-8, floor + 4.3, -11.55], [-2, floor + 4.3, -11.55], [4, floor + 4.3, -11.55]]);
  town.add(garden.group);
  await checkpoint();

  // Clock face inset on the campanile, with contrasting hands.
  const clock = new THREE.Mesh(registry.geometry(new THREE.CircleGeometry(.6, 24)), limestone);
  clock.position.set(-18.8, floor + 8.1, -13.73);
  town.add(clock);
  box(town, shutter, [.065, .43, .035], [-18.8, floor + 8.25, -13.7]);
  box(town, shutter, [.34, .065, .035], [-18.66, floor + 8.1, -13.68]);

  const details=buildPlazaDetails(registry,town,floor);

  // Frame finite scenery once; the camera is controlled by the visitor.
  const poses = [-.48];
  const centres: THREE.Vector3[] = [];
  let width = 0, height = 0;
  for (const yaw of poses) {
    root.rotation.y = yaw;
    const bounds = screenBox(root);
    width = Math.max(width, bounds.width);
    height = Math.max(height, bounds.height);
    centres.push(SCREEN_RIGHT.clone().multiplyScalar(bounds.centerX)
      .addScaledVector(SCREEN_UP, bounds.centerY).applyAxisAngle(new THREE.Vector3(0,1,0), -yaw));
  }
  root.rotation.y = 0;
  await checkpoint();
  return {
    root, town, portFocus:harbor.portFocus, dynamic: [garden.group, fountainWater.group, details.group, residents.group], poses, centres, hotspots, width: width + 5, height: height + 5,
    setNight: (night: boolean) => {
      harbor.setNight(night);fountainWater.setNight(night);details.setNight(night);
      lampGlass.emissiveIntensity=night?2.8:0;
      registry.lanternNight.value=Number(night);
      town.updateWorldMatrix(true,false);
      [[5,floor+4,18],[-15,floor+4,17],[7,floor+4,-7],[20,floor+4,16],[-6.4,floor+3.8,37.75],
        [25,floor+3.55,18.7],[38.7,floor+3.55,18.7],[24.5,floor+3.55,-11.8],[39,floor+3.55,-11.8]].forEach((p,i)=>{
        registry.lanternPositions.value[i].set(p[0],p[1],p[2]).applyMatrix4(town.matrixWorld);
      });
    },
    update: (elapsed: number, reduce: boolean) => {
      harbor.update(elapsed, reduce);
      garden.update(elapsed, reduce);
      fountainWater.update(elapsed, reduce);
      residents.update(elapsed, reduce);
    },
  };
}


