import * as THREE from "three";
import type { Registry } from "./theme";
type At = [number, number, number];
type Piece = { at: At; scale: At; color: number; tilt?: number };

/** Shared instanced foliage moves on the GPU, including its shadow pass. */
export function buildGarden(registry: Registry, trees: At[], pots: At[], boxes: At[]) {
  const group = new THREE.Group();
  group.name = "wind-garden";
  const time = { value: 0 };
  const stem: Piece[] = [], crowns: Piece[] = [], blades: Piece[] = [], flowers: Piece[] = [], petals: Piece[] = [];
  const greens = [0x4aab36, 0x8dcc3f, 0x278c46, 0xb2d94d];
  trees.forEach(([x, y, z], i) => {
    stem.push({ at: [x, y + 1, z], scale: [.15, 2, .15], color: 0xb57f55 });
    crowns.push({ at: [x, y + 2.3, z], scale: [i % 2 ? 1.3 : 1.05, i % 2 ? 1.25 : 1.5, 1.0],
      color: greens[i % greens.length], tilt: Math.sin(i * 2.4) * .12 });
    for (let k = 0; k < 3; k++) {
      const a = k * 2.4 + i;
      stem.push({ at: [x + Math.cos(a) * .22, y + 1.65, z + Math.sin(a) * .22], scale: [.08, 1.1, .08], color: 0xb57f55, tilt: Math.cos(a) * .45 });
    }
  });
  const planting = (at: At, radius: number, count: number, index: number) => {
    for (let i = 0; i < count; i++) {
      const a = i * 2.4 + index;
      const x = at[0] + Math.cos(a) * radius, z = at[2] + Math.sin(a) * radius;
      blades.push({ at: [x, at[1] + .2, z], scale: [.18, .4 + (i % 3) * .08, .12], color: greens[i % 4], tilt: Math.sin(a) * .45 });
      if (i % 2 === 0) {
        flowers.push({ at: [x, at[1] + .62, z], scale: [.07, .055, .07], color: 0xffcf69 });
        for (let petal = 0; petal < 5; petal++) {
          const angle = petal * Math.PI * 2 / 5;
          petals.push({ at: [x + Math.cos(angle) * .105, at[1] + .59, z + Math.sin(angle) * .105],
            scale: [.09, .045, .09], color: i % 4 ? 0xffe5aa : 0xf99fba });
        }
      }
    }
  };
  pots.forEach((at, i) => planting(at, .4, 10, i));
  boxes.forEach((at, i) => {
    for (let k = -1; k <= 1; k++) planting([at[0] + k * .4, at[1], at[2]], .14, 4, i + k);
  });
  const deform = `
    uniform float gardenTime;
    void bendGarden(inout vec3 p) {
      float phase = instanceMatrix[3].x*.19 + instanceMatrix[3].z*.23;
      float gust = sin(gardenTime*1.25+phase)*.7 + sin(gardenTime*2.3+phase*.7)*.3;
      float weight = smoothstep(-1.,.7,p.y);
      p.x += gust * weight * .18;
      p.z += sin(gardenTime*.95+phase)*weight*.09;
    }
  `;
  const make = (pieces: Piece[], geometry: THREE.BufferGeometry, moving: boolean) => {
    const material = registry.lit(0xffffff);
    if (moving) {
      const toon = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        toon(shader, renderer);
        shader.uniforms.gardenTime = time;
        shader.vertexShader = deform + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nbendGarden(transformed);");
      };
      material.customProgramCacheKey = () => "coastal-painted-garden-v3";
    }
    const mesh = new THREE.InstancedMesh(registry.geometry(geometry), material, pieces.length);
    const dummy = new THREE.Object3D();
    pieces.forEach((piece, i) => {
      dummy.position.set(...piece.at); dummy.scale.set(...piece.scale); dummy.rotation.z = piece.tilt ?? 0;
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, new THREE.Color(piece.color));
    });
    mesh.castShadow = mesh.receiveShadow = true;
    if (moving) {
      const depth = registry.track(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
      depth.onBeforeCompile = shader => {
        shader.uniforms.gardenTime = time;
        shader.vertexShader = deform + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nbendGarden(transformed);");
      };
      depth.customProgramCacheKey = () => "garden-depth-v1";
      mesh.customDepthMaterial = depth;
    }
    mesh.computeBoundingSphere();
    if (mesh.boundingSphere) mesh.boundingSphere.radius += .5;
    group.add(mesh);
  };
  make(stem, new THREE.CylinderGeometry(1, 1.15, 1, 12), false);
  // Continuous, asymmetric crowns replace the repeated spherical clumps.
  const canopy = new THREE.SphereGeometry(1, 24, 18);
  const vertices = canopy.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const swell = 1 + .11 * Math.sin(x * 4.2 + y * 2.1) * Math.sin(z * 3.7 - y * 1.6)
      + .055 * Math.sin(z * 7 + x * 3);
    vertices.setXYZ(i, x * swell + y * y * .11, y * swell, z * swell);
  }
  canopy.computeVertexNormals();
  make(crowns, canopy, true);
  make(blades, new THREE.SphereGeometry(1, 10, 8), true);
  make(flowers, new THREE.SphereGeometry(1, 10, 6), true);
  make(petals, new THREE.SphereGeometry(1, 8, 6), true);
  return { group, update: (elapsed: number, reduce: boolean) => { time.value = reduce ? 0 : elapsed; } };
}
