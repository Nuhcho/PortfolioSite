import * as THREE from "three";
import { PLAZA_STOPS } from "./plazaStops";
import { buildHarbor } from "./harbor";
import { buildResidents } from "./residents";
import { buildPlazaDetails } from "./plazaDetails";
import { buildGarden } from "./garden";
import { buildFountainWater } from "./fountain";
import { type Site, seeded, stairRun } from "./architecture";
import { SCREEN_RIGHT, SCREEN_UP, screenBox } from "./layout";
import { type Registry, type Palette } from "./theme";

/** A walkable piazza on two quays. All levels are independent of copy length. */
export function buildPlaza(registry: Registry, palette: Palette) {
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
  const limestone = registry.lit(0xfff1d5);
  const paving = registry.lit(0xf1d4ac);
  const terracotta = registry.lit(0xf07561);
  const peach = registry.lit(0xffb29a);
  const teal = registry.lit(0x69d9c7);
  const wood = registry.lit(0xc68e57);
  const shutter = registry.lit(0x218e98);
  const roofSeam = registry.lit(0xc95a52);
  const lampGlass = registry.lit(0xffd47e,{emissive:0xffac45,emissiveIntensity:0});
  const materials = (stone: THREE.Material) => ({ stone, trim: limestone,
    shadow: palette.rockDeep, accent: terracotta, recess: palette.deep });

  // Disjoint quays leave a real six-unit canal. No coplanar overlapping slabs.
  [[32.25, -7.125], [8.25, 19.125]].forEach(([width, x]) => {
    box(town, palette.rockDeep, [width, 2.8, 40.5], [x, -1.4, 1]);
    box(town, limestone, [width, .35, 40.5], [x, .175, 1], true);
    for (let k = 0; k < 12; k++) {
      box(town, palette.rock, [width - .12, .16, .12], [x, -1.1, -18.9 + k * 3.55]);
    }
  });
  // An understated paving grid is geometry slightly above the quay, never
  // two surfaces competing at the same depth.
  for (let x = -15; x <= 4; x += 2.2) {
    for (let z = -8; z <= 16; z += 2.2) {
      if (Math.hypot(x + 6, z - 3) < 3.9) continue;
      box(town, (Math.round((x + 15) / 2.2) + Math.round((z + 8) / 2.2)) % 5 === 0 ? limestone : paving, [2.1, .025, 2.1], [x, floor + .018, z]);
    }
  }

  const window = (parent: THREE.Object3D, x: number, y: number, z: number, yaw = 0) => {
    const model = registry.model("window", materials(palette.deep));
    if (!model) return;
    model.scale.set(.72, 1.0, 1);
    model.rotation.y = yaw;
    model.position.set(x, y, z);
    parent.add(model);
    const trim = new THREE.Group();
    trim.position.set(x, y, z);
    trim.rotation.y = yaw;
    for (const side of [-1, 1]) {
      box(trim, shutter, [.3, 1.3, .12], [side * .58, .65, .07]);
      for (let i = 0; i < 4; i++) box(trim, teal, [.24, .045, .14], [side * .58, .22 + i * .26, .09]);
    }
    box(trim, limestone, [1.55, .13, .45], [0, -.05, .12]);
    parent.add(trim);
  };
  const roof = (parent: THREE.Object3D, width: number, depth: number, rise: number,
    at: [number, number, number], yaw = 0) => {
    const w = width / 2, d = depth / 2;
    const positions = [-w,0,-d, w,0,-d, -w,0,d, w,0,d, -w,rise,0, w,rise,0];
    const geometry = registry.geometry(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([0,4,5,0,5,1, 2,3,5,2,5,4, 0,2,4,1,5,3, 0,1,3,0,3,2]);
    geometry.computeVertexNormals();
    const model = new THREE.Mesh(geometry.toNonIndexed(), terracotta);
    model.geometry.computeVertexNormals();
    registry.geometry(model.geometry);
    model.position.set(...at);
    model.rotation.y = yaw;
    registry.outline(model);
    parent.add(model);
    const tilework = new THREE.Group();
    tilework.position.set(...at);
    tilework.rotation.y = yaw;
    const roll = registry.geometry(new THREE.CylinderGeometry(.075, .075, Math.hypot(d, rise), 10));
    const up = new THREE.Vector3(0, 1, 0);
    for (let x = -w + .25; x < w; x += .55) {
      for (const side of [-1, 1]) {
        const tile = new THREE.Mesh(roll, roofSeam);
        tile.position.set(x, rise / 2 + .065, side * d / 2);
        tile.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, -rise, side * d).normalize());
        tilework.add(tile);
      }
    }
    for (let course = 1; course <= 3; course++) for (const side of [-1, 1]) {
      const along = course / 4;
      box(tilework, terracotta, [width, .045, .055], [0, rise * (1 - along) + .055, side * d * along]);
    }
    box(tilework, terracotta, [width + .1, .16, .22], [0, rise + .06, 0]);
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
  box(palazzo, peach, [20.8, 4.2, 6], [-6, floor + 5.6, -15], true);
  box(palazzo, limestone, [21.3, .24, 6.45], [-6, floor + 7.82, -15]);
  roof(palazzo, 21.8, 7, 1.35, [-6, floor + 7.95, -15]);
  for (let i = 0; i < 11; i++) window(palazzo, -15 + i * 1.8, floor + 4.3, -11.99);
  [-16.1, 4.1].forEach((x) => box(palazzo, limestone, [.22, 4.2, .22], [x, floor + 5.6, -11.88]));

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
  const bell = registry.model("tower_dome", materials(peach));
  if (bell) {
    bell.name = "campanile";
    bell.scale.set(1.45, 1.6, 1.45);
    bell.position.set(-18.8, floor, -15.2);
    town.add(bell);
  }

  // A lower canal-side wing on the opposite bank shares the same vocabulary.
  const canalHouse = new THREE.Group();
  canalHouse.position.set(19, floor, -2.2);
  canalHouse.rotation.y = Math.PI / 2;
  town.add(canalHouse);
  arcade(canalHouse, 5, 5.4, 2.8, [0, 0, 0], 0, teal);
  box(canalHouse, teal, [13, 3.1, 5.4], [0, 4.35, 0], true);
  box(canalHouse, limestone, [13.4, .22, 5.8], [0, 6.01, 0]);
  roof(canalHouse, 13.9, 6.3, 1.2, [0, 6.12, 0]);
  for (let i = 0; i < 7; i++) {
    window(canalHouse, -5.4 + i * 1.8, 3.25, 2.71);
    window(canalHouse, -5.4 + i * 1.8, 3.25, -2.71, Math.PI);
  }

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
  for (const x of [-13, -6, 1]) {
    box(palazzo, terracotta, [.7, 1.7, .7], [x, floor + 9.1, -16]);
    box(palazzo, limestone, [1.0, .18, 1.0], [x, floor + 10, -16]);
  }
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
  return {
    root, town, dynamic: [garden.group, fountainWater.group, details.group, residents.group], poses, centres, hotspots, width: width + 5, height: height + 5,
    setNight: (night: boolean) => {
      harbor.setNight(night);fountainWater.setNight(night);details.setNight(night);
      lampGlass.emissiveIntensity=night?2.8:0;
      registry.lanternNight.value=Number(night);
      town.updateWorldMatrix(true,false);
      [[5,floor+4,18],[-15,floor+4,17],[7,floor+4,-7],[20,floor+4,16],[-6.4,floor+3.8,37.75]].forEach((p,i)=>{
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


