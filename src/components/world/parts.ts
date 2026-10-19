import * as THREE from "three";
import { INK, Registry, TYPE, type Palette } from "./theme";
import { measureInline, paintText, type Run } from "./text";

/* Shared constructors for the things the world is assembled from: lit stone
   blocks, and the camera-facing slabs that carry painted copy.

   Material rule for every slab: the facade is unlit flat colour and the sides
   are lit flat-shaded stone. The facade is where text lives, so it must never
   be dimmed by a light — that is what keeps the measured AA ratios in
   DESIGN.md true at any point in the camera's travel. The lit sides are what
   make the slab read as a block in the world rather than a pasted card. */

export type HotspotKind = "scroll" | "link" | "toggle" | "focus" | "reveal";

export type Hotspot = {
  id: string;
  kind: HotspotKind;
  label: string;
  object: THREE.Object3D;
  href?: string;
  section?: string;
  entry?: string;
  /** half-height the camera should frame this at, in world units, when it is
      pressed. Without it the camera would frame the object's raw bounding box,
      which for a raked block is far wider than what it shows on screen. */
  focusSize?: number;
  /** hover and focus both run 0 → 1; the part decides how it reacts */
  setState: (hover: number, focus: number) => void;
  /** `reveal` only: the part owns its own disclosure, the world just asks */
  setOpen?: (open: boolean) => void;
};

export function block(
  parent: THREE.Object3D,
  material: THREE.Material | THREE.Material[],
  size: [number, number, number],
  position: [number, number, number],
  rotationY = 0
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const SLAB_DEPTH = 0.3;

/** Six-face material list for a slab: lit sides, unlit painted facade.
    The sides come from the same material the facade is the pale member of, so
    a block of rose is rose all the way through rather than a pale panel
    mounted on something else. */
function slabMaterials(
  palette: Palette,
  facade: THREE.Material,
  sides?: readonly [THREE.Material, THREE.Material]
) {
  const [side, edge] = sides ?? [palette.blockSide, palette.blockEdge];
  return [side, side, side, edge, facade, edge];
}

export type Slab = {
  group: THREE.Group;
  width: number;
  height: number;
  /** front surface of the facade, in the slab's local z */
  face: number;
  body: THREE.Mesh;
};

export function slab(
  registry: Registry,
  palette: Palette,
  width: number,
  height: number,
  facade: THREE.Material = palette.face,
  depth = SLAB_DEPTH,
  sides?: readonly [THREE.Material, THREE.Material]
): Slab {
  const group = new THREE.Group();
  const geometry = registry.geometry(new THREE.BoxGeometry(width, height, depth));
  const body = new THREE.Mesh(geometry, slabMaterials(palette, facade, sides));
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  return { group, width, height, face: depth / 2, body };
}

function ink(
  registry: Registry,
  texture: THREE.Texture,
  width: number,
  height: number,
  z: number
) {
  registry.track(texture);
  const material = registry.track(
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })
  );
  const mesh = new THREE.Mesh(registry.geometry(new THREE.PlaneGeometry(width, height)), material);
  mesh.position.z = z;
  return mesh;
}

/* ---------------- interactive parts ---------------- */

type ControlSpec = {
  id: string;
  label: string;
  kind: HotspotKind;
  href?: string;
  section?: string;
  tone: "primary" | "ghost" | "pill";
};

export type Control = {
  /** positioned by the island; the inner group is what reacts to a pointer */
  group: THREE.Group;
  width: number;
  height: number;
};

/** A control is a real block in the world: it lifts toward the light on hover
    or focus, and sits back down when released. */
export function controlBlock(
  registry: Registry,
  palette: Palette,
  spec: ControlSpec,
  hotspots: Hotspot[]
): Control {
  const isPrimary = spec.tone === "primary";
  const isPill = spec.tone === "pill";
  const size = isPill ? TYPE.meta : TYPE.body;
  const color = isPill ? INK.systems : INK.text;
  const labelWidth = measureInline({ text: spec.label, size, weight: 700 });
  const padX = isPill ? 0.36 : 0.52;
  const padY = isPill ? 0.22 : 0.28;

  const painted = paintText({
    // The canvas is cut to the label, so the label must not be wrapped to it.
    width: labelWidth * 1.02 + 0.04,
    runs: [{ text: spec.label, size, weight: 700, color, nowrap: true }],
  });

  const group = new THREE.Group();
  const lift = new THREE.Group();
  group.add(lift);

  const width = labelWidth + padX * 2;
  const height = painted.height + padY * 2;
  const facade = isPrimary ? palette.faceControl : palette.face;
  const button = slab(registry, palette, width, height, facade, 0.26);
  button.group.add(
    ink(registry, painted.texture, painted.width, painted.height, button.face + 0.004)
  );
  lift.add(button.group);

  hotspots.push({
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    href: spec.href,
    section: spec.section,
    object: button.body,
    setState: (hover, focus) => {
      const t = Math.max(hover, focus);
      lift.position.set(-t * 0.05, t * 0.05, t * 0.16);
    },
  });

  return { group, width, height };
}

/* ---------------- the faces of the monument ---------------- */

export type Tone = "sand" | "coral" | "sea" | "leaf" | "sunken";

export type WallText = {
  mesh: THREE.Mesh;
  width: number;
  height: number;
};

/* Words on stone, and nothing between them and it.
 *
 * This is the whole of it now. No slab, no bay, no floor, no jamb, no frame —
 * one transparent plane of inked glyphs lying on the wall's own surface, the
 * way lettering sits on a wall. Every attempt to express "embedded" as
 * geometry added another sheet of pastel a fraction of a unit from the last,
 * and six of those stacked up read as mush however carefully each one was
 * placed. The flattest possible answer is also the literal one.
 */
export function wallInk(
  registry: Registry,
  spec: { width: number; runs: Run[]; padding?: number }
): WallText {
  const painted = paintText({
    width: spec.width,
    runs: spec.runs,
    padding: spec.padding ?? 0,
  });
  const mesh = ink(registry, painted.texture, painted.width, painted.height, 0);
  return { mesh, width: painted.width, height: painted.height };
}
