import * as THREE from "three";
import { FACE_CAM, ISO_DIR } from "./theme";

/* The camera's angle is locked, so screen space is a usable coordinate system
   for composing the world. These are the three axes of the image plane,
   expressed in world coordinates. */
export const SCREEN_RIGHT = new THREE.Vector3(1, 0, 0).applyQuaternion(FACE_CAM);
export const SCREEN_UP = new THREE.Vector3(0, 1, 0).applyQuaternion(FACE_CAM);
export const SCREEN_OUT = ISO_DIR.clone();

/* What one world unit is worth up the screen, split by axis. A box of world
   size (sx, h, sz) standing on the ground covers `LIFT·h + SPREAD·(sx + sz)`
   of screen height — its walls plus the two faces of its own footprint. The
   massing solves for h from a height budget with this, so a house never grows
   taller than the room it has in front of whatever stands behind it. */
export const SCREEN_LIFT = SCREEN_UP.y;
export const SCREEN_SPREAD = -SCREEN_UP.x;

/** The exact screen-space extent of a subtree, measured from its vertices.
    Composition and camera framing both work from this rather than from hand
    tuned numbers, so an island frames itself correctly at any viewport. */
export type ScreenBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

const vertex = new THREE.Vector3();

export function screenBox(object: THREE.Object3D): ScreenBox {
  object.updateWorldMatrix(true, true);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.visible) return;
    const position = child.geometry.getAttribute("position");
    if (!position) return;
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position as THREE.BufferAttribute, i);
      vertex.applyMatrix4(child.matrixWorld);
      const x = vertex.dot(SCREEN_RIGHT);
      const y = vertex.dot(SCREEN_UP);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });

  if (minX === Infinity) {
    minX = maxX = minY = maxY = 0;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}
