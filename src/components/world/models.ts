import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type ModelName = "tower_dome" | "tower_steps" | "pavilion" | "arcade" | "staircase" | "corbel" | "window" | "vault";
export type ModelMaterials = Record<"stone" | "trim" | "shadow" | "accent" | "recess", THREE.Material>;
export type DownloadProgress = { loaded: number; total: number | null };

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

export async function loadArchitecture(onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal, onDownloaded?: () => Promise<void>) {
  const response = await fetch("/models/monument-kit.glb", { signal });
  if (!response.ok) throw new Error(`Architecture download failed: ${response.status}`);
  const reader = response.body?.getReader();
  let data: ArrayBuffer;
  if (reader) {
    const chunks: Uint8Array[] = [];
    const header = new Uint8Array(12);
    let headerBytes = 0, loaded = 0, total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        if (headerBytes < header.length) {
          const part = value.subarray(0, header.length - headerBytes);
          header.set(part, headerBytes);
          headerBytes += part.length;
          if (headerBytes === header.length) {
            const view = new DataView(header.buffer);
            if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Invalid architecture GLB header");
            // GLB stores its decoded byte length here. HTTP Content-Length is
            // often absent or describes compressed bytes instead.
            total = view.getUint32(8, true);
            if (total < header.length) throw new Error("Invalid architecture GLB length");
          }
        }
        onProgress({ loaded, total: total || null });
      }
      if (!total || loaded !== total) throw new Error("Incomplete architecture download");
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    const buffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
    data = buffer.buffer;
  } else {
    data = await response.arrayBuffer();
  }
  onProgress({ loaded: data.byteLength, total: data.byteLength });
  await onDownloaded?.();
  signal?.throwIfAborted();
  const gltf = await new GLTFLoader().parseAsync(data, "/models/");
  return new ArchitectureAssets(gltf.scene);
}
