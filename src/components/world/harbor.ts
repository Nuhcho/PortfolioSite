import * as THREE from "three";
import { buildLightHalos, buildWaterGlint } from "./lighting";
import { createSail } from "./sail";
import { addBoatShadows } from "./boatShadows";
import { batchStatic } from "./batching";
import { buildShipping } from "./shipping";
import { seeded } from "./architecture";
import { COLOR, type Registry } from "./theme";
import { SCREEN_RIGHT, SCREEN_UP, screenBox } from "./layout";

/** A graphic coastal setting. The sea and wildlife are excluded from framing;
 * the attached pier and boats are measured with the monument in wide views. */
export function buildHarbor(registry: Registry, floor: number, entrance: number) {
  const group = new THREE.Group();
  group.name = "harbor";
  group.rotation.y = Math.PI / 4;
  const seaY = floor - 3.6;
  const sea = registry.track(new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      night: { value: 0 },
      water: { value: new THREE.Color(0x489eaf) },
      deep: { value: new THREE.Color(0x3e91a7) },
      light: { value: new THREE.Color(0x55aaba) },
      foam: { value: new THREE.Color(0xc5eae3) },
    },
    vertexShader: `
      varying vec2 seaPosition;
      void main() {
        seaPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time,night;
      uniform vec3 water, deep, light, foam;
      varying vec2 seaPosition;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 p = seaPosition;
        float swell = sin(p.x * .075 + p.y * .11 + time * .13)
                    + sin(p.y * .065 - time * .09);
        vec3 color = mix(deep, water, smoothstep(-1.3, .45, swell));
        color = mix(color, light, smoothstep(.8, 1.85, swell));
        float smallWaves = sin(p.x*.48+p.y*.31+time*.7)*sin(p.y*.38-time*.45);
        color = mix(color, light, smoothstep(.65, 1., smallWaves)*.12);
        // Advect the entire highlight field with a visible, gently varying current.
        vec2 current = vec2(time*.8 + sin(time*.4 + p.y*.08)*.3, -time*.32);
        vec2 grid = vec2((p.x-current.x)*.12, (p.y-current.y)*.26);
        vec2 cell = floor(grid);
        vec2 uv = fract(grid);
        float seed = hash(cell);
        vec2 aa = max(fwidth(grid), vec2(.0001));
        float ripple = step(.72, seed)
          * (1.-smoothstep(.12 + seed*.08-aa.x, .12 + seed*.08+aa.x, abs(uv.x-.5 + sin(time*1.1+seed*6.28)*.06)))
          * (1.-smoothstep(max(0.,.013-aa.y), .013+aa.y, abs(uv.y-.5+sin(time*1.35+seed*6.28)*.065)));
        color = mix(color, foam, ripple * .8);
        color += light*pow(max(0.,1.-abs(sin(p.x*.025+p.y*.018))),14.)*night*.12;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  const ocean = new THREE.Mesh(registry.geometry(new THREE.PlaneGeometry(700, 700)), sea);
  ocean.name = "cel-shaded-water";
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = seaY;
  ocean.userData.excludeFromFraming = true;
  group.add(ocean);

  // A shadow-only receiver keeps the graphic water shader intact while the
  // quay, pier, hulls and sails all cast onto the same sea level.
  const waterShadow = new THREE.Mesh(
    registry.geometry(new THREE.PlaneGeometry(700, 700)),
    registry.track(new THREE.ShadowMaterial({ color: 0x184c78, opacity: .3, depthWrite: false }))
  );
  waterShadow.name = "water-shadow-receiver";
  waterShadow.rotation.x = -Math.PI / 2;
  waterShadow.position.y = seaY + .012;
  waterShadow.receiveShadow = true;
  waterShadow.userData.excludeFromFraming = true;
  group.add(waterShadow);

  const wood = registry.lit(0xe4ae70);
  const woodLight = registry.lit(0xffdba1);
  const timber = registry.lit(0x6b7876);
  const rope = registry.lit(0xe5d3a6);
  const navy = registry.lit(0x367fa3);
  const ivory = registry.lit(COLOR.ivory, { side: THREE.DoubleSide });
  const coral = registry.lit(COLOR.madder, { side: THREE.DoubleSide });
  const brass = registry.lit(COLOR.saffron);
  const dockLamp = registry.lit(0xffd58e,{emissive:0xffb653,emissiveIntensity:0});
  const cylinder = registry.geometry(new THREE.CylinderGeometry(1, 1, 1, 20));
  const addBox = (parent: THREE.Object3D, material: THREE.Material,
    size: [number, number, number], at: [number, number, number]) => {
    const mesh = new THREE.Mesh(registry.roundedBox(size, .045), material);
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  };
  const post = (x: number, z: number, rail = true) => {
    const mesh = new THREE.Mesh(cylinder, timber);
    mesh.scale.set(.22, 6.0, .22);
    mesh.position.set(x, floor - 1.9, z);
    group.add(mesh);
    if (rail) addBox(group, woodLight, [.58, .18, .58], [x, floor + 1.18, z]);
  };
  const ropeRun = (a: THREE.Vector3, b: THREE.Vector3) => {
    const mid = a.clone().lerp(b, .5).add(new THREE.Vector3(0, -.3, 0));
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    group.add(new THREE.Mesh(registry.geometry(new THREE.TubeGeometry(curve, 10, .045, 4, false)), rope));
  };

  const start = entrance + 2.85;
  const end = start + 17;
  const deckY = floor - .45;
  const crosspieceStart = end - 2.6;
  // The pier grows directly from the entrance apron, down two broad steps.
  addBox(group, woodLight, [5.6, .28, 1.2], [0, floor - .14, start]);
  // End the approach at the crosspiece: overlapping coplanar boards flicker.
  for (let i = 0; ; i++) {
    const edge = start + .6 + i * .77;
    const length = Math.min(.71, crosspieceStart - .04 - edge);
    if (length <= 0) break;
    addBox(group, i % 4 === 0 ? woodLight : wood, [5.2, .28, length], [0, deckY, edge + length / 2]);
  }
  [-1, 1].forEach((side) => {
    const beamStart = start + .3, beamEnd = crosspieceStart + .2;
    addBox(group, timber, [.2, .42, beamEnd - beamStart], [side * 2.05, deckY - .35, (beamStart + beamEnd) / 2]);
    addBox(group, timber, [15.2, .42, .2], [0, deckY - .35, end + side * 2.05]);
    const postSpacing = (crosspieceStart - .3 - (start + 1)) / 4;
    for (let i = 0; i < 5; i++) {
      const z = start + 1 + i * postSpacing;
      post(side * 2.6, z);
      if (i < 4) ropeRun(new THREE.Vector3(side * 2.6, floor + .95, z),
        new THREE.Vector3(side * 2.6, floor + .95, z + postSpacing));
    }
  });
  for (let i = 0; i < 20; i++) {
    addBox(group, i % 4 === 0 ? woodLight : wood, [.72, .28, 5.2], [-7.2 + i * .76, deckY, end]);
  }
  [-7.4, 0, 7.4].forEach((x) => [-2.6, 2.6].forEach((z) => post(x, end + z, false)));
  [-5.4, 5.4].forEach((x) => {
    addBox(group, navy, [.35, .6, .35], [x, deckY + .43, end + 1.4]);
    addBox(group, brass, [.8, .2, .25], [x, deckY + .83, end + 1.4]);
  });
  // A little dock light and two shipping crates give the pier a lived-in scale.
  addBox(group, timber, [.15, 4.3, .15], [-6.4, floor + 1.55, end - 1.1]);
  addBox(group, dockLamp, [.7, .8, .7], [-6.4, floor + 3.8, end - 1.1]);
  addBox(group, navy, [.85, .16, .85], [-6.4, floor + 4.28, end - 1.1]);
  [[1.15, .55, end - 1.2], [2.5, .4, end - .8]].forEach(([x, h, z]) => {
    addBox(group, woodLight, [1.1, h * 2, 1.1], [x, deckY + h + .15, z]);
    addBox(group, timber, [.12, h * 2 + .04, 1.14], [x, deckY + h + .15, z]);
  });
  const bolt = registry.geometry(new THREE.CylinderGeometry(.045,.045,.025,10));
  for(let board=0;board<20;board+=2)for(const side of [-1,1]) {
    const fastener=new THREE.Mesh(bolt,timber);
    fastener.position.set(-7.2+board*.76,deckY+.15,end+side*2.0);group.add(fastener);
  }
  for(let turn=0;turn<3;turn++) {
    const coil=new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.25+turn*.085,.033,6,32)),rope);
    coil.rotation.x=-Math.PI/2;coil.position.set(-4.2,deckY+.18,end+.8);group.add(coil);
  }
  const barrelProfile=[[0,0],[.36,0],[.42,.1],[.48,.55],[.45,1.0],[.37,1.15],[0,1.15]].map(([r,y])=>new THREE.Vector2(r,y));
  const barrel=new THREE.Mesh(registry.geometry(new THREE.LatheGeometry(barrelProfile,24)),wood);
  barrel.position.set(-5.2,deckY+.14,end-.6);group.add(barrel);
  for(const y of [.18,.9]) {
    const hoop=new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(y<.5?.44:.46,.035,8,32)),timber);
    hoop.rotation.x=-Math.PI/2;hoop.position.set(-5.2,deckY+.14+y,end-.6);group.add(hoop);
  }

  const boats: { group: THREE.Group; x: number; z: number; yaw: number; phase: number; updateShadows: () => void; cloth: ReturnType<typeof createSail>[]; nightLights: THREE.Group; reflection: ReturnType<typeof buildWaterGlint> }[] = [];
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 3.0);
  hullShape.quadraticCurveTo(1.2, 2.0, 1.35, 1.1);
  hullShape.quadraticCurveTo(1.4, -.6, 1.15, -2.1);
  hullShape.quadraticCurveTo(1.05, -2.6, .75, -2.6);
  hullShape.lineTo(-.75, -2.6);
  hullShape.quadraticCurveTo(-1.05, -2.6, -1.15, -2.1);
  hullShape.quadraticCurveTo(-1.4, -.6, -1.35, 1.1);
  hullShape.quadraticCurveTo(-1.2, 2.0, 0, 3.0);
  hullShape.closePath();
  const hull = registry.geometry(new THREE.ExtrudeGeometry(hullShape, {
    depth: .8, bevelEnabled: true, bevelThickness: .15, bevelSize: .12, bevelSegments: 3, curveSegments: 12, steps: 1,
  }));
  // Leave clearance for the bow and its rocking motion beside the crosspiece.
  [[6.3, end - 6.4, -.2, 1], [-10, end + 5.7, .45, .78]].forEach(([x, z, yaw, scale], i) => {
    const boat = new THREE.Group();
    boat.name = `sailboat-${i}`;
    boat.scale.setScalar(scale);
    const shell = new THREE.Mesh(hull, [ivory, i === 0 ? coral : navy]);
    shell.rotation.x = Math.PI / 2;
    boat.add(shell);
    addBox(boat, woodLight, [.18, 5.6, .18], [0, 2.8, -.1]);
    addBox(boat, woodLight, [3.5, .12, .12], [-.55, .85, 0]);
    const cloth = [
      createSail(registry, [[0, 1, 0], [0, 5.3, 0], [-2.8, 1, 0]], ivory, i * 1.7, .8),
      createSail(registry, [[.18, 1, .08], [.18, 4.4, .08], [1.7, 1, .08]], i === 0 ? ivory : coral, i * 1.7 + .6, .55),
      createSail(registry, [[.05, 4.85, .1], [.05, 5.25, .1], [.95, 5.05, .1]], coral, i + 2, .18),
    ];
    cloth.forEach(sail => boat.add(sail.mesh));
    // Deck slats, bow cleat and rigging keep the small boats readable up close.
    for (let k = 0; k < 6; k++) addBox(boat, woodLight, [1.65, .07, .12], [0, .04, -1.6 + k * .55]);
    addBox(boat, brass, [.5, .14, .18], [0, .2, 2.0]);
    const fenderGeometry = registry.geometry(new THREE.CapsuleGeometry(.12, .3, 4, 10));
    for (const side of [-1, 1]) for (const z of [-1.4, .6]) {
      const fender = new THREE.Mesh(fenderGeometry, ivory);
      fender.position.set(side * 1.2, -.05, z); boat.add(fender);
      addBox(boat, rope, [.025, .45, .025], [side * 1.2, .22, z]);
    }
    const lifeRing = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.3, .085, 10, 28)), coral);
    lifeRing.rotation.x = -Math.PI / 2; lifeRing.position.set(.4, .18, -1.75); boat.add(lifeRing);
    const rigging = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 5.3, -.08), new THREE.Vector3(0, .15, 2.3),
      new THREE.Vector3(0, 5.3, -.08), new THREE.Vector3(0, .15, -2.3),
    ]);
    boat.add(new THREE.LineSegments(registry.geometry(rigging), registry.track(new THREE.LineBasicMaterial({ color: 0xc7ab82 }))));
    boat.position.set(x, seaY + .7, z);
    boat.rotation.y = yaw;
    group.add(boat);
    const nightLights=new THREE.Group();nightLights.name="moored-ship-night-lights";nightLights.visible=false;
    const lampWhite=registry.facade(0xffd28d),lampRed=registry.facade(0xff6f60),lampGreen=registry.facade(0x8bffd0);
    addBox(nightLights,lampRed,[.15,.15,.15],[-1.05,.15,.4]);addBox(nightLights,lampGreen,[.15,.15,.15],[1.05,.15,.4]);
    addBox(nightLights,lampWhite,[.16,.18,.16],[0,5.55,-.1]);addBox(nightLights,lampWhite,[.22,.25,.22],[0,.55,-1.2]);
    nightLights.add(buildLightHalos(registry,[
      {at:[-1.05,.15,.4],size:1.25,color:0xff6f60},{at:[1.05,.15,.4],size:1.25,color:0x8bffd0},
      {at:[0,5.55,-.1],size:1.35,color:0xffe2a3},{at:[0,.55,-1.2],size:1.8,color:0xffc678},
    ]));boat.add(nightLights);
    const reflection=buildWaterGlint(registry);reflection.mesh.visible=false;group.add(reflection.mesh);
    batchStatic(boat, registry, [nightLights,...cloth.map(sail => sail.mesh)]);
    const updateShadows = addBoatShadows(boat, registry,
      [{ center: [0, 2.8, -.1], size: [.18, 5.6, .18] }],
      cloth.flatMap(sail => sail.triangles));
    boats.push({ group: boat, x, z, yaw, phase: i * 2.1, updateShadows, cloth, nightLights, reflection });
  });
  // Mooring line: its ends move gently with the nearby hull.
  ropeRun(new THREE.Vector3(2.6, floor + .1, end - 6.4), new THREE.Vector3(5.1, seaY + .8, end - 6.4));

  const birds: { group: THREE.Group; wings: THREE.Group[]; phase: number; height: number; reach: number; lift: number; speed: number }[] = [];
  const rand = seeded(0x534541);
  const bodyGeometry = registry.geometry(new THREE.SphereGeometry(.16, 16, 10));
  // A closed, swept wing retains an underside and an edge throughout the flap.
  // A single triangle vanishes edge-on and has no stable feather silhouette.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, .14);
  wingShape.lineTo(.48, .19);
  wingShape.lineTo(1.25, -.2);
  wingShape.lineTo(1.0, -.3);
  wingShape.lineTo(.42, -.13);
  wingShape.lineTo(0, -.14);
  wingShape.closePath();
  const wingGeometry = registry.geometry(new THREE.ExtrudeGeometry(wingShape, {
    depth: .06, bevelEnabled: false, steps: 1,
  }));
  wingGeometry.rotateX(Math.PI / 2);
  wingGeometry.translate(0, .03, 0);
  // Continuous diffuse light avoids sudden toon-band changes during a flap.
  const feathers = registry.track(new THREE.MeshLambertMaterial({ color: COLOR.ivory }));
  const beakGeometry = registry.geometry(new THREE.ConeGeometry(.065, .24, 4));
  for (let i = 0; i < 12; i++) {
    const bird = new THREE.Group();
    bird.name = `seagull-${i}`;
    bird.userData.excludeFromFraming = true;
    const body = new THREE.Mesh(bodyGeometry, feathers);
    body.scale.z = 2.5;
    bird.add(body);
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * .11, .02, -.02);
      const wing = new THREE.Mesh(wingGeometry, feathers);
      wing.name = "seagull-wing";
      wing.userData.noReceiveShadow = true;
      wing.scale.x = side;
      pivot.add(wing);
      bird.add(pivot);
      return pivot;
    });
    const beak = new THREE.Mesh(beakGeometry, brass);
    beak.rotation.x = Math.PI / 2;
    beak.position.z = .45;
    bird.add(beak);
    // Four low sea-skimmers, four rooftop passes, four high gliders.
    // Low paths stay offshore; elevated birds can cross over the plaza safely.
    const band = Math.floor(i / 4);
    const height = band === 0 ? seaY + 1.3 + rand() * 1.3
      : band === 1 ? floor + 11.5 + rand() * 3 : floor + 21 + rand() * 7;
    const reach = band === 0 ? 43 + rand() * 7 : band === 1 ? 27 + rand() * 8 : 17 + rand() * 14;
    const lift = band === 0 ? .35 : band === 1 ? 1.1 : 2.0;
    const speed = band === 0 ? .065 : band === 1 ? .045 : .029;
    const phase = rand() * Math.PI * 2;
    const scale = .55 + rand() * .35;
    bird.scale.setScalar(scale);
    group.add(bird);
    birds.push({ group: bird, wings, phase, height, reach, lift, speed });
  }

  const dockHalos=buildLightHalos(registry,[{at:[-6.4,floor+3.8,end-1.1],size:3.1,color:0xffd28a}]);
  dockHalos.visible=false;group.add(dockHalos);
  const shipping = buildShipping(registry, seaY);
  group.add(shipping.group);

  batchStatic(group, registry, [ocean, waterShadow, shipping.group,
    ...boats.map(boat => boat.group), ...birds.map(bird => bird.group)]);

  const birdWorld = new THREE.Vector3();
  return {
    group,
    setNight: (night: boolean) => {
      sea.uniforms.night.value=Number(night);
      dockLamp.emissiveIntensity=night?2.8:0;shipping.setNight(night);dockHalos.visible=night;
      boats.forEach(boat=>{boat.nightLights.visible=night;boat.reflection.mesh.visible=night;});
      sea.uniforms.water.value.setHex(night?0x173e5b:0x489eaf);
      sea.uniforms.deep.value.setHex(night?0x102840:0x3e91a7);
      sea.uniforms.light.value.setHex(night?0x245c75:0x55aaba);
      sea.uniforms.foam.value.setHex(night?0x709ab2:0xc5eae3);
    },
    update: (elapsed: number, reduce: boolean, readingFace?: THREE.Object3D) => {
      const t = reduce ? 0 : elapsed;
      sea.uniforms.time.value = t;
      shipping.update(elapsed, reduce);
      boats.forEach((boat) => {
        boat.group.position.y = seaY + .7 + Math.sin(t * .8 + boat.phase) * .1;
        boat.group.rotation.z = Math.sin(t * .55 + boat.phase) * .025;
        boat.cloth.forEach(sail => sail.update(elapsed, reduce));
        boat.updateShadows();
        boat.reflection.mesh.position.set(boat.x,seaY+.035,boat.z);
        boat.reflection.mesh.rotation.set(-Math.PI/2,0,boat.yaw);
        boat.reflection.mesh.scale.setScalar(boat.group.scale.x);
        boat.reflection.update(t);
      });
      const reading = readingFace ? screenBox(readingFace) : null;
      birds.forEach((bird, i) => {
        const angle = bird.phase + t * (bird.speed + (i % 4) * .002);
        bird.group.position.set(Math.cos(angle) * bird.reach,
          bird.height + Math.sin(t * .23 + bird.phase) * bird.lift, Math.sin(angle) * bird.reach * 1.08);
        bird.group.rotation.y = -angle;
        bird.group.rotation.z = Math.sin(t * .18 + bird.phase) * .12;
        const wingLift = .1 + Math.sin(t * 3.5 + bird.phase) * .24;
        bird.wings[0].rotation.z = -wingLift;
        bird.wings[1].rotation.z = wingLift;
        // Wildlife belongs to the scenery, never over a paragraph or a link.
        bird.group.getWorldPosition(birdWorld);
        const x = birdWorld.dot(SCREEN_RIGHT), y = birdWorld.dot(SCREEN_UP);
        bird.group.visible = !reading || x < reading.minX - 1.4 || x > reading.maxX + 1.4
          || y < reading.minY - 1.4 || y > reading.maxY + 1.4;
      });
    },
  };
}
