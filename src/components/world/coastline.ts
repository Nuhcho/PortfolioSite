import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { seeded } from "./architecture";
import { batchStatic } from "./batching";
import { SEA_COLOR, type Registry } from "./theme";
import { buildShoreTerrain } from "./shoreTerrain";

/** Physical shoals below the water and weathered boulders above its surface. */
export function buildCoastline(registry: Registry, seaY: number, floor: number) {
  const group = new THREE.Group();
  group.name = "rocky-coast-and-seabed";
  group.userData.excludeFromFraming = true;
  const random = seeded(0xc0a57);
  const rock = registry.lit(0xaca783);
  const algae = new THREE.Color(0x557d4e);
  const shade = rock.onBeforeCompile.bind(rock);
  rock.onBeforeCompile = (shader, renderer) => {
    shade(shader, renderer);
    shader.uniforms.shoreSeaY = { value: seaY };
    shader.uniforms.shoreAlgae = { value: algae };
    shader.vertexShader = `varying float shoreHeight;\n${shader.vertexShader}`.replace(
      "#include <project_vertex>", `#include <project_vertex>
      shoreHeight = (modelMatrix * vec4(transformed, 1.)).y;`);
    shader.fragmentShader = `varying float shoreHeight;uniform float shoreSeaY;uniform vec3 shoreAlgae;\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>", `#include <color_fragment>
      float wetStone = 1.-smoothstep(shoreSeaY+.05,shoreSeaY+.65,shoreHeight);
      diffuseColor.rgb = mix(diffuseColor.rgb,shoreAlgae,wetStone*.7);`);
  };
  rock.customProgramCacheKey = () => "coastal-wet-rock-v1";
  const submerged = registry.lit(0x668a71);
  const shapes = Array.from({ length: 5 }, (_, index) => {
    const source = new THREE.IcosahedronGeometry(1, 2);
    const geometry = mergeVertices(source);
    source.dispose();
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const warp = 1 + Math.sin(x * 5.1 + z * 3.7 + index) * .10
        + Math.cos(y * 4.3 - x * 2.9 + index * 2) * .07;
      positions.setXYZ(i, x * warp, y * warp, z * warp);
    }
    geometry.computeVertexNormals();
    return registry.geometry(geometry);
  });
  const terrain=buildShoreTerrain(registry,seaY,floor);
  group.add(terrain.group);
  const foamLocations: { x: number; z: number; rx: number; rz: number; yaw: number }[] = [];

  const cluster = (x: number, z: number, scale: number, exposed = true) => {
    const count=2+Math.floor(random()*4);
    for (let i = 0; i < count; i++) {
      const emerges = exposed && (i===0||random()>.68);
      const radius = scale * (i === 0 ? 1 : .22 + random() * .55);
      const height = emerges ? radius * (.4 + random() * .85) : radius * .35;
      const mesh = new THREE.Mesh(shapes[Math.floor(random() * shapes.length)], emerges ? rock : submerged);
      const rawX = x + (i === 0 ? 0 : (random() - .5) * scale * 2.8);
      // The cargo lane at x=48 needs clearance for its full hull, not just
      // its centerline. Even the underwater satellites stay out of that lane.
      const px = x > 40 ? Math.min(rawX, 46.3-radius*1.2) : rawX;
      const pz = z + (i === 0 ? 0 : (random() - .5) * scale * 2.4);
      if(px-radius*1.3<13.6&&px+radius*1.3>10.6)continue;
      const yaw = random() * Math.PI;
      mesh.position.set(px, emerges ? seaY - height * (.1+random()*.4) : seaY-height-radius*.25-.3, pz);
      mesh.scale.set(radius, height, radius * (.65 + random() * .4));
      mesh.rotation.set((random()-.5)*.25,yaw,(random()-.5)*.25);
      mesh.userData.noCastShadow = !emerges;
      mesh.name = emerges ? "shore-boulder" : "submerged-rock";
      group.add(mesh);
      if (emerges) foamLocations.push({ x: px, z: pz, rx: radius * 1.06, rz: mesh.scale.z * 1.06, yaw });
    }
  };

  // Stones emerge from the same continuous waterline, with open sand pockets.
  for(const coast of terrain.shores) {
    for(let distance=1+random()*2;distance<coast.length;distance+=2+random()*4.5) {
      const sample=coast.sample(distance/coast.length);
      if(sample.width<1.5||random()<.22)continue;
      const outward=sample.water.clone().sub(sample.inner).normalize();
      const spread=.1+random()*.85;
      cluster(sample.water.x+outward.x*spread,sample.water.z+outward.z*spread,.5+random()*1.15,random()>.3);
    }
  }
  // Loose armour piles protect the built breakwater, with gaps and mixed sizes.
  for(let z=14.5;z<44;z+=1.5+random()*3.8) {
    if(z>24&&z<29)continue;
    cluster(44.7+random()*.7,z,.6+random()*.9,random()>.15);
  }
  for(let x=21;x<42;x+=1.8+random()*3.6)cluster(x,46+(random()-.5)*1.7,.55+random()*1.1,random()>.2);

  const foam = registry.track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(SEA_COLOR.day.foam) } },
    vertexShader: `varying vec2 foamUV;void main(){foamUV=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float time;uniform vec3 tint;varying vec2 foamUV;
      void main(){vec2 p=foamUV-.5;float angle=atan(p.y,p.x);
        float broken=smoothstep(.05,.7,sin(angle*5.+sin(angle*3.)+time*.65));
        float pulse=.35+.12*sin(time*1.3+angle*2.);
        gl_FragColor=vec4(tint,broken*pulse);
        #include <colorspace_fragment>
      }`,
  }));
  const ringGeometry=registry.geometry(new THREE.RingGeometry(.97,1.09,48));
  const ringPositions=ringGeometry.getAttribute("position");
  for(let i=0;i<ringPositions.count;i++) {
    const x=ringPositions.getX(i),y=ringPositions.getY(i),angle=Math.atan2(y,x);
    const warp=1+Math.sin(angle*5.)*.065+Math.sin(angle*11.)*.025;
    ringPositions.setXY(i,x*warp,y*warp);
  }
  const rings = new THREE.InstancedMesh(ringGeometry, foam, foamLocations.length);
  rings.name = "rock-contact-foam";
  const dummy = new THREE.Object3D();
  foamLocations.forEach((at, index) => {
    dummy.position.set(at.x, seaY + .045, at.z);
    dummy.rotation.set(-Math.PI / 2, 0, at.yaw);
    dummy.scale.set(at.rx, at.rz, 1);
    dummy.updateMatrix();
    rings.setMatrixAt(index, dummy.matrix);
  });
  rings.computeBoundingSphere();
  group.add(rings);
  const washMaterial=registry.track(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},tint:{value:new THREE.Color(SEA_COLOR.day.foam)}},
    vertexShader:`varying vec2 shoreUV;void main(){shoreUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;uniform vec3 tint;varying vec2 shoreUV;void main(){
      float center=.5+sin(shoreUV.x*.7-time*.8)*.17;
      float edge=1.-smoothstep(.04,.42,abs(shoreUV.y-center));
      float gaps=smoothstep(-.1,.65,sin(shoreUV.x*1.1)+sin(shoreUV.x*2.7+1.)*.5);
      gl_FragColor=vec4(tint,edge*gaps*(.15+.055*sin(time+shoreUV.x)));
      #include <colorspace_fragment>
    }`,
  }));
  const wash=new THREE.Mesh(terrain.washGeometry,washMaterial);wash.name="broken-tidal-wash";group.add(wash);
  batchStatic(group, registry, [rings,wash]);
  return {
    group,
    waterDepth:terrain.waterDepth,
    depthBounds:terrain.depthBounds,
    setNight: (night: boolean) => {
      const color=(night ? SEA_COLOR.night : SEA_COLOR.day).foam;
      foam.uniforms.tint.value.setHex(color);washMaterial.uniforms.tint.value.setHex(color);
    },
    update: (elapsed: number, reduce: boolean) => {
      foam.uniforms.time.value=washMaterial.uniforms.time.value=reduce?0:elapsed;
    },
  };
}
