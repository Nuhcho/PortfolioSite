import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Box3, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const bytes = await readFile(new URL("../public/models/monument-kit.glb", import.meta.url));
const { scene } = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "",
);
const expected = ["tower_dome", "tower_steps", "pavilion", "arcade", "staircase", "corbel", "window", "vault"];
const roles = new Set(["stone", "trim", "shadow", "accent", "recess"]);
let triangles = 0;
for (const name of expected) {
  const model = scene.getObjectByName(name);
  assert(model, `Missing module: ${name}`);
  const bounds = new Box3().setFromObject(model);
  assert(!bounds.isEmpty(), `Empty module: ${name}`);
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) assert(roles.has(material.name), `Unknown material: ${material.name}`);
    const position = child.geometry.getAttribute("position");
    const normal = child.geometry.getAttribute("normal");
    assert.equal(position.count % 3, 0, `${name}: triangle list`);
    assert.equal(normal.count, position.count);
    for (const value of position.array) assert(Number.isFinite(value), `${name}: invalid vertex`);
    for (let i = 0; i < normal.count; i++) {
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert(Math.abs(length - 1) < 0.001, `${name}: invalid normal`);
    }
    triangles += position.count / 3;
  });
}
const stairs = new Box3().setFromObject(scene.getObjectByName("staircase"));
assert(Math.abs(stairs.min.x) < 0.001 && Math.abs(stairs.max.x - 6) < 0.001, "Stair length contract");
assert(Math.abs(stairs.max.y - 3) < 0.001, "Stair rise contract");
console.log(`Validated ${expected.length} Blender modules, ${triangles} triangles, ${(bytes.length / 1024).toFixed(1)} KiB.`);
