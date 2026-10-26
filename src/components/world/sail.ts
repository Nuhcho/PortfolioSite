import * as THREE from "three";
import type { Registry } from "./theme";
import type { ShadowSail } from "./boatShadows";

/** Small cloth mesh: mast and boom edges stay pinned while the belly and leech flex.
 * Updating the existing buffers keeps visible geometry and shadow geometry equal. */
export function createSail(registry: Registry, corners: ShadowSail, material: THREE.MeshToonMaterial, phase = 0, amplitude = .3) {
  const divisions = 12;
  const weights: [number, number, number][] = [];
  const lookup: number[][] = [];
  const indices: number[] = [];
  for (let i = 0; i <= divisions; i++) {
    lookup[i] = [];
    for (let j = 0; j <= divisions - i; j++) {
      lookup[i][j] = weights.length;
      weights.push([1 - (i + j) / divisions, i / divisions, j / divisions]);
    }
  }
  for (let i = 0; i < divisions; i++) for (let j = 0; j < divisions - i; j++) {
    indices.push(lookup[i][j], lookup[i + 1][j], lookup[i][j + 1]);
    if (j < divisions - i - 1) indices.push(lookup[i + 1][j], lookup[i + 1][j + 1], lookup[i][j + 1]);
  }
  const geometry = registry.geometry(new THREE.BufferGeometry());
  const positions = new THREE.BufferAttribute(new Float32Array(weights.length * 3), 3);
  positions.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positions);
  geometry.setIndex(indices);
  // Hard toon thresholds pop between light bands as cloth normals move.
  // Smooth diffuse lighting keeps both faces of the curved fabric continuous.
  const cloth = registry.track(new THREE.MeshLambertMaterial({ color: material.color, side: THREE.DoubleSide }));
  const mesh = new THREE.Mesh(geometry, cloth);
  mesh.name = "animated-sail";
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  const center: [number, number, number] = [0, 0, 0];
  const triangles: ShadowSail[] = [[corners[0], corners[1], center], [corners[1], corners[2], center], [corners[2], corners[0], center]];
  const deform = (a: number, b: number, c: number, t: number, out: number[]) => {
    for (let axis = 0; axis < 3; axis++) out[axis] = corners[0][axis] * a + corners[1][axis] * b + corners[2][axis] * c;
    const pinned = Math.sin(Math.PI * b);
    const belly = Math.sin(Math.PI * c) * pinned * 1.5;
    const gust = .75 + .30 * Math.sin(t * .9 + phase) + .12 * Math.sin(t * 1.7 + phase * .7);
    const flutter = Math.sin(t * 3.3 + b * 8 + phase) * c * (1 - c) * pinned * .25;
    out[2] += amplitude * (belly * gust + flutter);
  };
  const point = [0, 0, 0];
  let lastTime = NaN;
  const update = (elapsed: number, reduce: boolean) => {
    const time = reduce ? 0 : elapsed;
    if (time === lastTime) return;
    lastTime = time;
    weights.forEach(([a, b, c], index) => {
      deform(a, b, c, time, point);
      positions.setXYZ(index, point[0], point[1], point[2]);
    });
    deform(1 / 3, 1 / 3, 1 / 3, time, center);
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  update(0, true);
  (geometry.getAttribute("normal") as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
  geometry.computeBoundingSphere();
  // Conservative bound includes the full gust, so cloth never pops at frame edges.
  geometry.boundingSphere!.radius += amplitude;
  return { mesh, triangles, update };
}
