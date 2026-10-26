import * as THREE from "three";
import { buildLightHalos, buildWaterGlint } from "./lighting";
import { createSail } from "./sail";
import { addBoatShadows, type ShadowBox } from "./boatShadows";
import { batchStatic } from "./batching";
import type { Registry } from "./theme";

/** Traffic routes extend well beyond the viewport; wrapping happens offshore. */
export function buildShipping(registry: Registry, seaY: number) {
  const group = new THREE.Group();
  group.name = "passing-shipping";
  group.userData.excludeFromFraming = true;
  const cream = registry.lit(0xfff5dc);
  const navy = registry.lit(0x347eae);
  const coral = registry.lit(0xff8a75);
  const jade = registry.lit(0x53d3b7);
  const gold = registry.lit(0xffd264);
  const wood = registry.lit(0xe1ae71);
  const glass = registry.lit(0x3d92b2);
  const deckShadow = registry.lit(0x856c65);
  const nightWindow = registry.facade(0xffd18a), port = registry.facade(0xff786b), starboard = registry.facade(0x83e7ae);
  const cube = registry.geometry(new THREE.BoxGeometry(1, 1, 1));
  const box = (parent: THREE.Object3D, material: THREE.Material, size: number[], at: number[]) => {
    const mesh = new THREE.Mesh(cube, material);
    mesh.scale.set(size[0], size[1], size[2]);
    mesh.position.set(at[0], at[1], at[2]);
    parent.add(mesh);
    return mesh;
  };
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 3.7); hullShape.lineTo(1.3, 1.8);
  hullShape.lineTo(1.2, -2.8); hullShape.lineTo(.8, -3.4);
  hullShape.lineTo(-.8, -3.4); hullShape.lineTo(-1.2, -2.8);
  hullShape.lineTo(-1.3, 1.8); hullShape.closePath();
  const hull = registry.geometry(new THREE.ExtrudeGeometry(hullShape, {
    depth: .75, bevelEnabled: true, bevelSize: .1, bevelThickness: .1, bevelSegments: 1, steps: 1,
  }));
  const wakeMaterial = registry.track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(0xd3f5ed) } },
    vertexShader: `varying vec2 waterUV; void main(){ waterUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float time; uniform vec3 tint; varying vec2 waterUV;
      void main(){
        vec2 p=vec2((waterUV.x-.5)*12.,(1.-waterUV.y)*24.-17.);
        // The wave follows the actual pointed bow and long hull sides.
        // Its width uses the same profile as hullShape above, not a circle.
        float hullWidth=mix(1.2,1.3,clamp((p.y+2.8)/4.6,0.,1.));
        if(p.y>1.8) hullWidth=1.3*clamp((3.7-p.y)/1.9,0.,1.);
        if(p.y< -2.8) hullWidth=mix(.8,1.2,clamp((p.y+3.4)/.6,0.,1.));
        float outside=abs(p.x)-hullWidth;
        float alongHull=smoothstep(-3.7,-3.1,p.y)*(1.-smoothstep(3.7,3.95,p.y));
        float flow=sin(p.y*2.2+time*3.8)*.025;
        float contact=(1.-smoothstep(.035,.15,abs(outside-.14-flow)))*alongHull;
        // Low crests peel outward from the hull as they flow toward the stern.
        float phase=fract(time*.35-p.y*.065);
        float offset=.32+phase*.65;
        float sideWave=(1.-smoothstep(.025,.11,abs(outside-offset)))
          *sin(phase*3.14159)*alongHull;
        float bowTip=1.-smoothstep(.05,.18,length(vec2(p.x,p.y-3.7)));
        float behind=max(0.,-p.y-3.4);
        float wakeEdge=.9+behind*.22;
        float aft=(1.-smoothstep(-4.2,-3.2,p.y))*(1.-smoothstep(8.,13.5,behind));
        float trailing=(1.-smoothstep(.035,.17,abs(abs(p.x)-wakeEdge)))*aft;
        float foamPulse=.8+.2*sin(p.y*2.8+time*4.);
        float churn=(1.-smoothstep(.2,.7+behind*.05,abs(p.x)))*aft
          *(1.-smoothstep(0.,7.,behind))*.17;
        float alpha=clamp(contact*.7+sideWave*.3+bowTip*.6+trailing*foamPulse*.45+churn,0.,.8);
        if(alpha<.02)discard;
        gl_FragColor=vec4(tint,alpha);
        #include <colorspace_fragment>
      }`,
  }));
  const wakeGeometry = registry.geometry(new THREE.PlaneGeometry(12, 24));
  const traffic = [
    { kind: "cargo", axis: "x", lane: -39, speed: 2.1, offset: 135, scale: 1.15, direction: 1 },
    { kind: "ferry", axis: "x", lane: 56, speed: 2.8, offset: 174, scale: .9, direction: -1 },
    { kind: "sail", axis: "z", lane: -40, speed: 1.6, offset: 112, scale: .85, direction: 1 },
    { kind: "cargo", axis: "z", lane: 48, speed: 1.8, offset: 150, scale: .85, direction: -1 },
    { kind: "gondola", axis: "z", lane: 12.1, speed: 1.3, offset: 148, scale: .48, direction: 1 },
  ].map((route, index) => {
    const nightDetails = new THREE.Group();nightDetails.name="ship-night-lights";nightDetails.visible=false;
    const cloth: ReturnType<typeof createSail>[] = [];
    const boat = new THREE.Group();
    boat.name = `passing-${route.kind}-${index}`;
    boat.scale.setScalar(route.scale);
    const shell = new THREE.Mesh(hull, route.kind === "gondola" ? navy : [navy, coral, jade][index % 3]);
    shell.rotation.x = Math.PI / 2;
    shell.position.y = .75;
    registry.outline(shell);
    boat.add(shell);
    box(boat, wood, [1.9, .12, 5.5], [0, .85, -.25]);
    // Contact shade at the cabin/cargo footprint stays legible at distant views.
    if (route.kind === "cargo" || route.kind === "ferry") {
      box(boat, deckShadow, [1.85, .025, route.kind === "cargo" ? 1.8 : 4.8],
        [0, .925, route.kind === "cargo" ? -1.7 : -.25]);
    }
    if (route.kind === "cargo") {
      for (let i = 0; i < 3; i++) {
        box(boat, [coral, gold, jade][i], [1.8, .9, 1.15], [0, 1.35, -.3 + i * 1.3]);
        for (const x of [-.6, -.2, .2, .6]) box(boat, cream, [.035, .8, .03], [x, 1.35, .29 + i * 1.3]);
      }
      box(boat, cream, [1.8, 1.5, 1.4], [0, 1.65, -2]);
      for (const side of [-1, 1]) box(boat, glass, [.025, .4, .95], [side * .915, 1.95, -1.95]);
      box(boat, glass, [1.3, .4, .025], [0, 1.95, -1.285]);
      box(boat, cream, [2, .15, 1.65], [0, 2.5, -2]);
      box(boat, coral, [.4, 1.1, .4], [.45, 2.9, -2.2]);
    } else if (route.kind === "ferry") {
      box(boat, cream, [2, 1.3, 4.6], [0, 1.5, -.4]);
      for (const side of [-1, 1]) box(boat, glass, [.025, .5, 3.9], [side * 1.015, 1.7, -.3]);
      box(boat, glass, [1.5, .5, .025], [0, 1.7, 1.915]);
      for (let i = 0; i < 6; i++) box(boat, cream, [2.06, .6, .1], [0, 1.7, -2 + i * .65]);
      box(boat, gold, [2.2, .2, 4.8], [0, 2.25, -.4]);
      box(boat, navy, [.45, .8, .45], [0, 2.75, -1.5]);
    } else if (route.kind === "sail") {
      box(boat, wood, [.13, 6, .13], [0, 3.7, 0]);
      cloth.push(
        createSail(registry, [[0, 1.1, 0], [0, 6.5, 0], [-2.7, 1.1, 0]], registry.lit(0xffedab, { side: THREE.DoubleSide }), 1.2, .8),
        createSail(registry, [[.15, 1.1, .08], [.15, 5.7, .08], [1.8, 1.1, .08]], registry.lit(0xff9d86, { side: THREE.DoubleSide }), 2.1, .55),
      );
      box(boat, wood, [4.7, .1, .1], [-.45, 1.07, 0]);
      const rigging = registry.geometry(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 6.5, -.12), new THREE.Vector3(0, 1, 3),
        new THREE.Vector3(0, 6.5, -.12), new THREE.Vector3(0, 1, -2.9),
      ]));
      boat.add(new THREE.LineSegments(rigging, registry.track(new THREE.LineBasicMaterial({ color: 0xe4d1a3 }))));
    } else {
      for (const z of [-1.6, .5, 2]) box(boat, cream, [2, .18, .45], [0, 1.0, z]);
      box(boat, wood, [.12, .12, 5], [1.55, 1.1, -1]);
    }
    // Rigid details are merged with the ship; only cloth stays independently animated.
    for (let plank = 0; plank < 7; plank++) box(boat, cream, [1.7, .015, .035], [0, .921, -2.35 + plank * .74]);
    if (route.kind === "cargo" || route.kind === "ferry") {
      for (const side of [-1, 1]) {
        box(boat, cream, [.045, .045, 4.6], [side * 1.13, 1.13, -.65]);
        for (const z of [-2.6, -1.8, .5, 1.5]) box(boat, cream, [.045, .35, .045], [side * 1.13, .98, z]);
        const ring = new THREE.Mesh(registry.geometry(new THREE.TorusGeometry(.22, .07, 5, 12)), coral);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(side * (route.kind === "cargo" ? .935 : 1.035), 1.3, -1.95);
        boat.add(ring);
      }
      box(boat, navy, [.07, 1.0, .07], [-.4, 2.95, -2]);
      box(boat, cream, [.6, .05, .05], [-.4, 3.25, -2]);
    }
    if (route.kind === "ferry") {
      for (let i = 0; i < 4; i++) {
        const port = new THREE.Mesh(registry.geometry(new THREE.CircleGeometry(.13, 10)), glass);
        port.rotation.y = Math.PI / 2;
        port.position.set(1.32, .45, -1.7 + i * 1.05);
        boat.add(port);
      }
    }
    for(const side of [-1,1]) box(nightDetails,side<0?port:starboard,[.18,.18,.18],[side*1.05,1.18,1.4]);
    const mastHeight=route.kind==="sail"?6.6:route.kind==="cargo"?3.6:route.kind==="ferry"?3.2:1.4;
    const mastZ=route.kind==="sail"?0:route.kind==="cargo"?-2.2:route.kind==="ferry"?-1.5:-2.7;
    box(nightDetails,nightWindow,[.16,.2,.16],[0,mastHeight,mastZ]);
    box(nightDetails,nightWindow,[.17,.15,.12],[0,1.1,-3.2]);
    nightDetails.add(buildLightHalos(registry,[
      {at:[-1.05,1.18,1.4],size:1.15,color:0xff675a}, {at:[1.05,1.18,1.4],size:1.15,color:0x79ffd0},
      {at:[0,mastHeight,mastZ],size:1.35,color:0xffe8b0},{at:[0,1.1,-3.2],size:1.0,color:0xffe8b0},
    ]));
    if(route.kind==="cargo" || route.kind==="ferry") {
      const x=route.kind==="cargo"?.94:1.04;
      for(const side of [-1,1]) box(nightDetails,nightWindow,[.01,.28,route.kind==="cargo"?.65:3.2],[side*x,1.9,route.kind==="cargo"?-1.95:-.3]);
    }
    boat.add(nightDetails);
    cloth.forEach(sail => boat.add(sail.mesh));
    boat.traverse(object => {
      if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    batchStatic(boat, registry, [nightDetails,...cloth.map(sail => sail.mesh)]);
    const occluders: ShadowBox[] = route.kind === "cargo" ? [
      ...[0, 1, 2].map(i => ({ center: [0, 1.35, -.3 + i * 1.3] as [number, number, number], size: [1.8, .9, 1.15] as [number, number, number] })),
      { center: [0, 1.65, -2], size: [1.8, 1.5, 1.4] },
      { center: [0, 2.5, -2], size: [2, .15, 1.65] },
      { center: [.45, 2.9, -2.2], size: [.4, 1.1, .4] },
    ] : route.kind === "ferry" ? [
      { center: [0, 1.5, -.4], size: [2, 1.3, 4.6] },
      { center: [0, 2.25, -.4], size: [2.2, .2, 4.8] },
      { center: [0, 2.75, -1.5], size: [.45, .8, .45] },
    ] : route.kind === "sail" ? [{ center: [0, 3.7, 0], size: [.13, 6, .13] }]
      : [-1.6, .5, 2].map(z => ({ center: [0, 1, z], size: [2, .18, .45] }));
    const sails = cloth.flatMap(sail => sail.triangles);
    const updateShadows = addBoatShadows(boat, registry, occluders, sails);
    const wake = new THREE.Mesh(wakeGeometry, wakeMaterial);
    wake.rotation.x = -Math.PI / 2;
    wake.position.z = -5;
    // Wakes live on the sea rather than inheriting the hull's rocking motion.
    const reflection=buildWaterGlint(registry);reflection.mesh.visible=false;
    group.add(boat,wake,reflection.mesh);
    return { ...route, boat, wake, updateShadows, cloth, nightDetails, reflection };
  });
  return { group, setNight:(night:boolean)=>{traffic.forEach(ship=>{ship.nightDetails.visible=night;ship.reflection.mesh.visible=night;});}, update: (elapsed: number, reduce: boolean) => {
    const t = reduce ? 0 : elapsed;
    wakeMaterial.uniforms.time.value = t;
    traffic.forEach((ship, index) => {
      const distance = ((t * ship.speed + ship.offset) % 300 - 150) * ship.direction;
      ship.boat.position.set(ship.axis === "x" ? distance : ship.lane,
        seaY + .3 + (reduce ? 0 : Math.sin(t * 1.4 + index) * .07),
        ship.axis === "z" ? distance : ship.lane);
      ship.boat.rotation.y = ship.axis === "x" ? ship.direction * Math.PI / 2 : ship.direction === 1 ? 0 : Math.PI;
      ship.boat.rotation.z = reduce ? 0 : Math.sin(t * .8 + index) * .018;
      ship.cloth.forEach(sail => sail.update(elapsed, reduce));
      ship.updateShadows();
      const yaw = ship.boat.rotation.y;
      ship.reflection.mesh.position.set(ship.boat.position.x,seaY+.035,ship.boat.position.z);
      ship.reflection.mesh.rotation.set(-Math.PI/2,0,yaw);
      ship.reflection.mesh.scale.setScalar(ship.scale);
      ship.reflection.update(t);
      ship.wake.scale.setScalar(ship.scale);
      ship.wake.position.set(ship.boat.position.x - Math.sin(yaw) * 5 * ship.scale,
        seaY + .045, ship.boat.position.z - Math.cos(yaw) * 5 * ship.scale);
      ship.wake.rotation.set(-Math.PI / 2, 0, yaw);

    });
  }};
}
