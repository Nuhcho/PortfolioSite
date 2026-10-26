import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type ModelName = "tower_dome" | "tower_steps" | "pavilion" | "arcade" | "staircase" | "corbel" | "window" | "vault";
export type ModelMaterials = Record<"stone" | "trim" | "shadow" | "accent" | "recess", THREE.Material>;

/** One loaded kit per mounted world. Rebuilds clone its objects and share
 * geometry; only the asset owner releases that geometry at final teardown. */
export class ArchitectureAssets {
  constructor(private readonly source: THREE.Group) {}

  instantiate(name: ModelName, materials: ModelMaterials): THREE.Group {
    const source = this.source.getObjectByName(name);
    if (!source) throw new Error(`Missing architectural model: ${name}`);
    const result = new THREE.Group();
    result.name = `blender-${name}`;
    result.userData.architectureAsset = name;
    const model = source.clone(true);
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const replace = (material: THREE.Material) => materials[material.name as keyof ModelMaterials] ?? materials.stone;
      child.material = Array.isArray(child.material) ? child.material.map(replace) : replace(child.material);
      child.castShadow = false;
      child.receiveShadow = false;
    });
    result.add(model);
    return result;
  }

  dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.source.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      geometries.add(child.geometry);
      (Array.isArray(child.material) ? child.material : [child.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}

export async function loadArchitecture() {
  const gltf = await new GLTFLoader().loadAsync("/models/monument-kit.glb");
  return new ArchitectureAssets(gltf.scene);
}
