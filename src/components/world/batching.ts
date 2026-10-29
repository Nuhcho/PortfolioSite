import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Registry } from "./theme";

/** Batch rigid scenery by material while retaining animated groups and hitboxes. */
export function batchStatic(root: THREE.Object3D, registry: Registry, excluded: THREE.Object3D[] = []) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const meshes = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; lines: boolean; cast: boolean; receive: boolean }>();
  const remove: THREE.Object3D[] = [];
  root.traverse(object => {
    let ancestor: THREE.Object3D | null = object;
    while (ancestor && ancestor !== root) {
      if (excluded.includes(ancestor)) return;
      ancestor = ancestor.parent;
    }
    if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments) || Array.isArray(object.material)) return;
    if (object.material.opacity === 0 || object.material instanceof THREE.ShaderMaterial) return;
    const lines = object instanceof THREE.LineSegments;
    const key = `${object.material.uuid}-${lines}-${object.castShadow}-${object.receiveShadow}`;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    const vertexColors = !lines && "vertexColors" in object.material && object.material.vertexColors;
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && (lines || name !== "normal") && !(name === "color" && vertexColors)) geometry.deleteAttribute(name);
    }
    geometry.clearGroups();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    const batch = meshes.get(key);
    if (batch) batch.geometries.push(geometry);
    else meshes.set(key, { material: object.material, geometries: [geometry], lines, cast: object.castShadow, receive: object.receiveShadow });
    remove.push(object);
  });
  for (const object of remove) object.removeFromParent();
  for (const batch of meshes.values()) {
    const geometry = mergeGeometries(batch.geometries);
    batch.geometries.forEach(item => item.dispose());
    if (!geometry) throw new Error("Unable to batch static scenery");
    registry.geometry(geometry);
    const mesh = batch.lines ? new THREE.LineSegments(geometry, batch.material) : new THREE.Mesh(geometry, batch.material);
    mesh.castShadow = batch.cast;
    mesh.receiveShadow = batch.receive;
    root.add(mesh);
  }
  root.updateWorldMatrix(true, true);
}
