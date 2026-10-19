import * as THREE from "three";

/* The world is measured in units, and one unit is always UNIT_PX CSS pixels —
   the camera's zoom is derived from this and nothing else. That is what keeps
   body copy the same readable size on every island and at every viewport: a
   section with more content grows taller in units and the camera pans down it,
   rather than zooming out until the type goes to nothing. */
export const UNIT_PX = 54;

/* Monument Valley's own palette is pastel: dusty rose, pale lilac, soft teal,
   ivory and sand, all high in lightness and low in saturation, with one
   saturated accent reserved for the parts you can operate — the same trick
   Mirror's Edge uses, and ustwo cite it.

   Three tiers, and the tier decides what a value may be used for. SOLIDS build
   the mass of the architecture. PALES are the lighter member of the same
   material and are the only surfaces an inscription is cut into. INKS are
   those hues taken down far enough to read on a pale at AA. */
export const COLOR = {
  sky: 0xf2ebf0,

  // --- solids: the mass of the building ---
  ivory: 0xf4e9df,
  ivoryDeep: 0xe3d4c8,
  ivoryShadow: 0xc8bcbc,
  rose: 0xe3b2ad,
  roseDeep: 0xc99490,
  teal: 0xa8cdc8,
  tealDeep: 0x86aeaa,
  lilac: 0xc6bada,
  lilacDeep: 0xa79ac0,
  sand: 0xe5cfa4,
  sandDeep: 0xcbb384,

  /* The island itself: a lawn ring round a paved field, on lilac rock. Green
     is the one hue the architecture never uses, so the ground reads as ground
     however densely it is built on. */
  lawn: 0xc4ddc4,
  lawnDeep: 0x9ec4a8,
  rock: 0xb3a6c9,
  rockDeep: 0x9a8cb4,

  /** the one saturated note in the world, reserved for what can be operated */
  accent: 0xd9728f,
  sun: 0xf0c674,

  // --- pales: the faces an inscription is cut into ---
  paleIvory: 0xf4e9df,
  paleRose: 0xf5dcd9,
  paleTeal: 0xd8e9e6,
  paleLilac: 0xe6dfef,
  /** the one face cut below its surroundings */
  sunken: 0xe8dcd2,
  paleSun: 0xf6e2b4,

  /** the ink hues as numbers, for the few marks drawn as geometry rather than
      painted — a scroll cue, a rule — so they match inscribed text */
  inkText: 0x55474f,
  inkMuted: 0x6e5e66,
};

/* The ink tier, as CSS strings. An inscription is drawn unlit, so these are
   the exact values the contrast ratios in DESIGN.md were measured at — the
   light never shifts them. Every ratio is against ivory (#f4e9df), the
   lightest face any of them is cut into. */
export const INK = {
  text: "#55474f", // ~7.3:1
  muted: "#6e5e66", // ~5.1:1
  ml: "#9c5048", // ~4.8:1
  systems: "#336660", // ~5.5:1
  beacon: "#75571f", // ~5.6:1
  face: "#f4e9df",
  sky: "#f2ebf0",
  sand: "#e5cfa4",
};

/* Em heights in units. Multiply by UNIT_PX to read them as a px scale: body
   lands at 17px, the hero name at 62px. */
export const TYPE = {
  hero: 1.15,
  role: 0.5,
  section: 0.62,
  projectTitle: 0.45,
  title: 0.35,
  bodyLg: 0.35,
  body: 0.315,
  meta: 0.25,
  label: 0.23,
};

/* True isometric: the view axis is exactly (1, 1, 1), so the world's three
   axes project onto the screen at 120° to each other and all three foreshorten
   equally.

   That exactness is the whole point. Translating anything along (1, 1, 1)
   moves it in depth without moving it one pixel on screen, so two blocks far
   apart in the world can be made to touch in the picture. Every impossible
   figure in this world — the tribar, the stairs that never stop climbing, the
   bridges that land on terraces they never reach — is built from that single
   property, and it only holds because the camera's angle is locked. */
export const ISO_DIR = new THREE.Vector3(1, 1, 1).normalize();

export const FACE_CAM = (() => {
  const m = new THREE.Matrix4().lookAt(ISO_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(m);
})();

export type Disposable = { dispose: () => void };

/* One registry per world build. Materials and geometries are shared across
   islands, so they are created once here and disposed together on teardown. */
export class Registry {
  private items: Disposable[] = [];

  track<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  /** Flat-shaded, matte, no gloss — the world's lit stone material. */
  lit(color: number, extra?: THREE.MeshStandardMaterialParameters) {
    return this.track(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        metalness: 0,
        flatShading: true,
        ...extra,
      })
    );
  }

  /** Unlit flat colour for a surface that carries text: the painted facade.
      Lighting can't darken it, so the measured contrast ratio always holds. */
  facade(color: number) {
    return this.track(new THREE.MeshBasicMaterial({ color }));
  }

  geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    return this.track(geometry);
  }

  dispose() {
    this.items.forEach((item) => item.dispose());
    this.items = [];
  }
}

export function createPalette(registry: Registry) {
  return {
    // the building's own masonry
    shelf: registry.lit(COLOR.ivory),
    shelfDeep: registry.lit(COLOR.ivoryDeep),
    shelfShadow: registry.lit(COLOR.ivoryShadow),
    sand: registry.lit(COLOR.sand),
    sandDeep: registry.lit(COLOR.sandDeep),
    sandShadow: registry.lit(COLOR.ivoryShadow),
    deep: registry.lit(COLOR.lilacDeep),
    sea: registry.lit(COLOR.teal),

    // the island: lawn ring, paved field, the rock they sit on
    lawn: registry.lit(COLOR.lawn),
    lawnDeep: registry.lit(COLOR.lawnDeep),
    rock: registry.lit(COLOR.rock),
    rockDeep: registry.lit(COLOR.rockDeep),

    // the two channels, the reserved beacon, and the one operable accent
    ml: registry.lit(COLOR.rose),
    systems: registry.lit(COLOR.teal),
    connector: registry.lit(COLOR.lilac),
    accent: registry.lit(COLOR.accent),
    beacon: registry.lit(COLOR.sun, {
      roughness: 0.6,
      emissive: new THREE.Color(COLOR.sun),
      emissiveIntensity: 0.15,
    }),

    /* Extruded display type is lit, not painted. Cut from the deepest lilac in
       the world, because on a pastel sky a pastel heading has nothing to read
       against. */
    displayLit: registry.lit(0x5f5370, { roughness: 0.86 }),

    blockSide: registry.lit(COLOR.ivoryDeep),
    blockEdge: registry.lit(COLOR.ivoryShadow),

    /* The pales: the only surfaces an inscription is cut into. Each is the
       lighter member of a material already standing in the building, so a
       block of text is masonry rather than paper. */
    face: registry.facade(COLOR.paleIvory),
    faceMl: registry.facade(COLOR.paleRose),
    faceSystems: registry.facade(COLOR.paleTeal),
    faceLeaf: registry.facade(COLOR.paleLilac),
    faceSunken: registry.facade(COLOR.sunken),
    faceControl: registry.facade(COLOR.paleRose),

    /* A piece's sides belong to the same material as the face cut into it, so
       a block of rose is rose all the way through rather than a pale panel
       mounted on something else. */
    sides: {
      sand: [registry.lit(COLOR.ivoryDeep), registry.lit(COLOR.ivoryShadow)] as const,
      coral: [registry.lit(COLOR.rose), registry.lit(COLOR.roseDeep)] as const,
      sea: [registry.lit(COLOR.teal), registry.lit(COLOR.tealDeep)] as const,
      leaf: [registry.lit(COLOR.lilac), registry.lit(COLOR.lilacDeep)] as const,
    },

    /* The town's own masonry. A quarter is not a few panels on an empty
       apron — it is a settlement, and a settlement is built out of a small
       vocabulary of houses repeated at many sizes. Each entry is one such
       house: a pale body under a saturated roof, both from the same
       material, so a street of them reads as one piece of architecture in
       several colours rather than as scattered boxes. */
    town: [
      { body: registry.lit(COLOR.paleRose), roof: registry.lit(COLOR.rose) },
      { body: registry.lit(COLOR.paleTeal), roof: registry.lit(COLOR.teal) },
      { body: registry.lit(COLOR.paleLilac), roof: registry.lit(COLOR.lilac) },
      { body: registry.lit(COLOR.paleIvory), roof: registry.lit(COLOR.ivoryDeep) },
      { body: registry.lit(COLOR.lawn), roof: registry.lit(COLOR.lawnDeep) },
      { body: registry.lit(COLOR.paleSun), roof: registry.lit(COLOR.sand) },
    ] as const,
  };
}

export type Palette = ReturnType<typeof createPalette>;
