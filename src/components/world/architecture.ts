import * as THREE from "three";
import { SCREEN_UP, screenBox, type ScreenBox } from "./layout";
import { ISO_DIR, Registry, type Palette } from "./theme";

/* The building vocabulary.
 *
 * Monument Valley never builds the same thing twice on one level, and never
 * builds one thing: a level is a handful of separate structures, each its own
 * shape and height, with a crowd of smaller pieces clinging to it — a turret
 * on a corbel, a stack of blocks each set a little off the one below, an open
 * pavilion on four posts, a wing with a stair up its side. Nothing repeats at
 * a regular interval and no silhouette is symmetric.
 *
 * So the architecture is grown rather than tiled. A seeded generator deals
 * each folly its own pieces, and the same seed builds the same site on every
 * visit and every rebuild — irregular, but never random from one look to the
 * next.
 *
 * Grown things can land anywhere, including across a word or a path. The
 * generator is not trusted to stay clear: once the site stands, `clearOf`
 * turns it to every angle that matters and removes, whole, anything that
 * would stand in front of what is meant to be seen there.
 */

/* ---------------- chance, made repeatable ---------------- */

export type Rand = () => number;

/** mulberry32: small, fast, and the same sequence from the same seed. */
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (rand: Rand, low: number, high: number) => low + (high - low) * rand();
export const pick = <T>(rand: Rand, items: readonly T[]) => items[Math.floor(rand() * items.length)];
export function shuffle<T>(rand: Rand, items: T[]) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/* ---------------- the vocabulary ---------------- */

export type Site = {
  registry: Registry;
  palette: Palette;
  rand: Rand;
};

/** The stones one piece is built from: its body, its darker courses, and the
    one contrasting colour its roof takes. */
export type Stones = {
  stone: THREE.Material;
  deep: THREE.Material;
  accent: THREE.Material;
  face?: THREE.Material;
};

export function box(
  parent: THREE.Object3D,
  registry: Registry,
  material: THREE.Material,
  size: [number, number, number],
  at: [number, number, number]
) {
  const mesh = new THREE.Mesh(registry.geometry(new THREE.BoxGeometry(...size)), material);
  mesh.position.set(...at);
  parent.add(mesh);
  return mesh;
}

/** A doorway with a round head, cut into all four sides of a square body of
    half-width `half`. Dark and standing a hair proud, so it reads as a hole. */
function archedOpening(
  parent: THREE.Object3D,
  { registry, palette }: Site,
  spec: { half: number; width: number; height: number; y: number }
) {
  const prototype = registry.model("window", {
    stone: palette.deep, trim: palette.deep, shadow: palette.deep,
    accent: palette.deep, recess: palette.deep,
  });
  if (prototype) {
    for (let k = 0; k < 4; k += 1) {
      const side = new THREE.Group();
      side.rotation.y = k * Math.PI / 2;
      const inset = prototype.clone(true);
      inset.scale.set(spec.width, spec.height / 2, 1);
      inset.position.set(0, spec.y, spec.half);
      side.add(inset);
      parent.add(side);
    }
    return;
  }
  const jamb = Math.max(0.2, spec.height - spec.width / 2);
  const body = registry.geometry(new THREE.BoxGeometry(spec.width, jamb, 0.5));
  // A half cylinder, turned so its axis runs into the wall and its curve is up.
  const head = registry.geometry(
    new THREE.CylinderGeometry(spec.width / 2, spec.width / 2, 0.5, 10, 1, false, -Math.PI / 2, Math.PI)
  );
  for (let k = 0; k < 4; k += 1) {
    const side = new THREE.Group();
    side.rotation.y = (k * Math.PI) / 2;
    parent.add(side);
    const door = new THREE.Mesh(body, palette.deep);
    door.position.set(0, spec.y + jamb / 2, spec.half - 0.2);
    const arch = new THREE.Mesh(head, palette.deep);
    arch.rotation.x = -Math.PI / 2;
    arch.position.set(0, spec.y + jamb, spec.half - 0.2);
    side.add(door, arch);
  }
}

/** Inverted steps under anything that hangs off the keep, so nothing floats. */
function corbel(parent: THREE.Object3D, { registry }: Site, material: THREE.Material, width: number, depth = width) {
  const asset = registry.model("corbel", {
    stone: material, trim: material, shadow: material, accent: material, recess: material,
  });
  if (asset) {
    asset.scale.set(width / 2, 1.1, depth / 2);
    parent.add(asset);
    return;
  }
  [0.82, 0.58, 0.34].forEach((f, k) =>
    box(parent, registry, material, [width * f, 0.55, depth * f], [0, -0.275 - k * 0.55, 0])
  );
}

export type RoofKind = "dome" | "spire" | "merlons" | "stepped" | "beacon";
const ROOFS: readonly RoofKind[] = ["dome", "spire", "merlons", "stepped", "beacon"];

/** A roof for a square top of half-width `half` standing at `y`. Returns the
    height it adds. */
function roofing(parent: THREE.Object3D, site: Site, kind: RoofKind, half: number, y: number, stones: Stones) {
  const { registry, palette } = site;
  switch (kind) {
    case "dome": {
      const r = half * 0.84;
      const drum = new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(r, r, 0.7, 8)), stones.deep);
      drum.rotation.y = Math.PI / 8;
      drum.position.y = y + 0.35;
      const dome = new THREE.Mesh(
        registry.geometry(new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)),
        stones.accent
      );
      dome.rotation.y = Math.PI / 8;
      dome.position.y = y + 0.7;
      box(parent, registry, palette.beacon, [0.34, 0.34, 0.34], [0, y + 0.7 + r + 0.17, 0]);
      parent.add(drum, dome);
      return 0.7 + r + 0.34;
    }
    case "spire": {
      // Four sides turned to the square below, so the pyramid sits on it.
      const height = half * between(site.rand, 2.0, 3.2);
      const spire = new THREE.Mesh(
        registry.geometry(new THREE.ConeGeometry(half * 1.48, height, 4)),
        stones.accent
      );
      spire.rotation.y = Math.PI / 4;
      spire.position.y = y + height / 2;
      parent.add(spire);
      return height;
    }
    case "merlons": {
      const merlon = half * 0.44;
      [-1, 1].forEach((sx) =>
        [-1, 1].forEach((sz) =>
          box(parent, registry, stones.deep, [merlon, 1.4, merlon], [
            sx * (half - merlon / 2),
            y + 0.7,
            sz * (half - merlon / 2),
          ])
        )
      );
      box(parent, registry, stones.accent, [merlon, merlon, merlon], [0, y + merlon / 2, 0]);
      return 1.4;
    }
    case "stepped": {
      let top = y;
      [0.86, 0.6, 0.34].forEach((f, k) => {
        const material = k === 2 ? stones.accent : k === 1 ? palette.shelf : stones.deep;
        box(parent, registry, material, [half * 2 * f, 0.55, half * 2 * f], [0, top + 0.275, 0]);
        top += 0.55;
      });
      return top - y;
    }
    case "beacon": {
      box(parent, registry, palette.shelfDeep, [half * 1.3, 0.5, half * 1.3], [0, y + 0.25, 0]);
      const gem = box(parent, registry, palette.beacon, [0.5, 0.5, 0.5], [0, y + 0.95, 0]);
      gem.rotation.set(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0);
      return 1.4;
    }
  }
}

/* Every piece is built standing on its own origin, foot at y = 0, so the
   generator can place it anywhere up the keep. */

/** A tower in setbacks: one to three stages, each narrower and a different
    height, every stage with its own cornice. Hung off a corbel when it does not
    start from anything. */
export function steppedTower(site: Site, stones: Stones, spec: { half: number; height: number; hung: boolean }) {
  const { registry, palette, rand } = site;
  const group = new THREE.Group();
  const asset = registry.model(rand() < 0.5 ? "tower_dome" : "tower_steps", {
    stone: stones.stone, trim: palette.shelf, shadow: stones.deep,
    accent: stones.accent, recess: palette.deep,
  });
  if (asset) {
    asset.scale.set(spec.half, spec.height / 6, spec.half);
    group.add(asset);
    if (spec.hung) corbel(group, site, stones.deep, spec.half * 2);
    return { group, height: 7.8 * spec.height / 6 };
  }
  const stages = spec.height > 10 ? 1 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
  const weights = Array.from({ length: stages }, () => between(rand, 0.55, 1.45));
  const total = weights.reduce((sum, w) => sum + w, 0);

  let y = 0;
  let half = spec.half;
  weights.forEach((weight, stage) => {
    const h = (spec.height * weight) / total;
    box(group, registry, stage % 2 === 0 ? stones.stone : stones.deep, [half * 2, h, half * 2], [0, y + h / 2, 0]);
    box(group, registry, palette.shelfDeep, [half * 2 + 0.45, 0.5, half * 2 + 0.45], [0, y + h - 0.25, 0]);
    if (h > 3.4 && rand() < 0.72) {
      archedOpening(group, site, {
        half,
        width: half * between(rand, 0.4, 0.62),
        height: Math.min(h * 0.52, half * 1.7),
        y: y + h * between(rand, 0.14, 0.3),
      });
    }
    y += h;
    if (stage < stages - 1) half *= between(rand, 0.64, 0.84);
  });

  if (spec.hung) corbel(group, site, stones.deep, spec.half * 2);
  y += roofing(group, site, pick(rand, ROOFS), half, y, stones);
  return { group, height: y };
}

/** Blocks stacked smaller and smaller, each set off-centre on the one below. */
export function blockStack(site: Site, stones: Stones, spec: { half: number }) {
  const { registry, palette, rand } = site;
  const group = new THREE.Group();
  const materials = [stones.stone, palette.shelf, stones.deep, stones.accent];
  const offset = Math.floor(rand() * materials.length);
  const count = 3 + Math.floor(rand() * 3);

  let size = spec.half * 2;
  let y = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < count; i += 1) {
    const h = size * between(rand, 0.5, 1.15);
    box(group, registry, materials[(i + offset) % materials.length], [size, h, size], [cx, y + h / 2, cz]);
    y += h;
    const next = size * between(rand, 0.48, 0.8);
    const slack = (size - next) / 2;
    cx += between(rand, -slack, slack);
    cz += between(rand, -slack, slack);
    size = next;
  }
  corbel(group, site, stones.deep, spec.half * 2);
  return { group, height: y };
}

/** Four posts, a roof, and the sky through the middle. */
export function pavilion(site: Site, stones: Stones, spec: { half: number }) {
  const { registry, palette, rand } = site;
  const group = new THREE.Group();
  const { half } = spec;
  const asset = registry.model("pavilion", {
    stone: stones.stone, trim: palette.shelf, shadow: stones.deep,
    accent: stones.accent, recess: palette.deep,
  });
  if (asset) {
    asset.scale.setScalar(half);
    group.add(asset);
    return { group, height: 4.39 * half };
  }
  box(group, registry, stones.stone, [half * 2, 0.6, half * 2], [0, 0.3, 0]);
  const posts = between(rand, 2.6, 4.8);
  [-1, 1].forEach((sx) =>
    [-1, 1].forEach((sz) =>
      box(group, registry, stones.deep, [0.5, posts, 0.5], [sx * (half - 0.35), 0.6 + posts / 2, sz * (half - 0.35)])
    )
  );
  const deck = 0.6 + posts;
  box(group, registry, palette.shelf, [half * 2 + 0.4, 0.5, half * 2 + 0.4], [0, deck + 0.25, 0]);
  const added = roofing(group, site, pick(rand, ["dome", "spire", "stepped"] as const), half, deck + 0.5, stones);
  if (rand() < 0.5) tree(group, site, [0, 0.6, 0], between(rand, 0.9, 1.3));
  corbel(group, site, stones.deep, half * 2);
  return { group, height: deck + 0.5 + added };
}

/** A round green crown on a short trunk. */
export function tree(parent: THREE.Object3D, { registry, palette }: Site, at: [number, number, number], size: number) {
  box(parent, registry, palette.sandDeep, [0.24, size * 0.7, 0.24], [at[0], at[1] + size * 0.35, at[2]]);
  const crown = new THREE.Mesh(
    registry.geometry(new THREE.IcosahedronGeometry(size * 0.55, 0)),
    palette.lawnDeep
  );
  crown.position.set(at[0], at[1] + size * 0.7 + size * 0.42, at[2]);
  parent.add(crown);
}

/* ---------------- blocks the layout may resize ---------------- */

/* The layout searches: it builds a folly or a path, measures it, and throws
   it away if it lands badly. Boxes it builds that way share one unit cube and
   are sized by scale, so a rejected candidate costs meshes, never geometry. */
const unitCubes = new WeakMap<Registry, THREE.BoxGeometry>();

export function block(
  registry: Registry,
  material: THREE.Material | THREE.Material[],
  size: [number, number, number],
  at: [number, number, number]
) {
  let cube = unitCubes.get(registry);
  if (!cube) {
    cube = registry.geometry(new THREE.BoxGeometry(1, 1, 1));
    unitCubes.set(registry, cube);
  }
  const mesh = new THREE.Mesh(cube, material);
  mesh.scale.set(...size);
  mesh.position.set(...at);
  return mesh;
}

/** Face order of a box's materials: +x, -x, +y, -y, +z, -z. */
const faces = (sides: THREE.Material, top: THREE.Material, under: THREE.Material, front = sides, back = sides) => [
  sides,
  sides,
  top,
  under,
  front,
  back,
];

/* ---------------- a folly ---------------- */

/* Each section of the page is its own building. In a folly's own frame the
   reading wall is the +z face, centred on x = 0 and standing at z = 0; the
   body runs back into -z and the roof is the plane y = `roof`. */
export type FollyShape = { width: number; depth: number; roof: number; bottom: number; archHeight?: number; sharedBase?: boolean };

const CAP = 0.55;
const PLINTH = 0.7;
const LIP = 0.3;

/** Body, cap and plinth. The front is cream — the stone every inscription is
    measured against — and the cap and plinth stand proud on three sides and
    flush on the fourth, because a lip on the front would hang across the
    first line. */
export function follyMassing({ registry, palette }: Site, stones: Stones, shape: FollyShape) {
  const { width, depth, roof, bottom } = shape;
  const massing = new THREE.Group();
  const top = roof - CAP;
  const foot = bottom + (shape.sharedBase ? 0 : PLINTH);
  const archHeight = shape.archHeight ?? 0;
  const bodyFoot = foot + archHeight;
  massing.add(block(registry, faces(stones.stone, palette.shelf, stones.deep, stones.face ?? palette.face, stones.deep),
    [width, top - bodyFoot, depth], [0, (top + bodyFoot) / 2, -depth / 2]));
  if (archHeight > 0) {
    const gateway = registry.model("vault", {
      stone: stones.stone, trim: palette.shelf, shadow: stones.deep,
      accent: stones.accent, recess: palette.deep,
    });
    if (gateway) {
      gateway.name = "shared-vault";
      gateway.scale.set(width / 2.6, archHeight / 2.5, depth / 2.2);
      gateway.position.set(0, foot, -depth / 2);
      massing.add(gateway);
    }
  }
  massing.add(
    block(registry, faces(palette.shelfDeep, palette.shelf, stones.deep), [width + 2 * LIP, CAP, depth + LIP], [
      0,
      roof - CAP / 2,
      -(depth + LIP) / 2,
    ]),
  );
  if (!shape.sharedBase) massing.add(block(registry, faces(stones.deep, palette.shelf, stones.deep),
    [width + 2 * LIP, PLINTH, depth + LIP], [0, bottom + PLINTH / 2, -(depth + LIP) / 2]));
  massing.children.forEach((child) => {
    if (child instanceof THREE.Mesh) registry.outline(child);
  });
  return massing;
}

/* ---------------- articulation ---------------- */

/* A plain box reads as a primitive; the same box with its structure drawn on
   it reads as a building. Cream pilasters mark where the walls are carried,
   cream courses mark the floors, and dark windows sit in the bays between —
   every line of it a hard edge between two values, which is where the eye
   finds sharpness. All of it lies within a hand's breadth of the wall, so it
   never changes what the layout measured. */

/** A face of a box, by the way it looks out. */
export type Face = "+x" | "-x" | "-z" | "+z";
const FACE_YAW: Record<Face, number> = { "+z": 0, "+x": Math.PI / 2, "-z": Math.PI, "-x": -Math.PI / 2 };

const PILASTER = { width: 0.5, proud: 0.22 };
const COURSE = { height: 0.24, proud: 0.16 };

/** Pilasters, string courses and windows on the named faces of the box
    centred on (`cx`, `cz`), `w` wide in x and `d` deep in z, standing from
    `foot` to `top`. */
export function articulate(
  parent: THREE.Object3D,
  site: Site,
  spec: { cx: number; cz: number; w: number; d: number; foot: number; top: number; faces: Face[]; windows?: number }
) {
  const { registry, palette, rand } = site;
  const height = spec.top - spec.foot;
  if (height < 2.4) return;

  // One set of floor lines for the whole box, so the courses run on round
  // the corners rather than stepping at each one.
  const floors = [spec.foot];
  for (let y = spec.foot + between(rand, 4.5, 7); y < spec.top - 3; y += between(rand, 6, 9.5)) floors.push(y);
  floors.push(spec.top);

  spec.faces.forEach((face) => {
    const side = new THREE.Group();
    side.position.set(spec.cx, 0, spec.cz);
    side.rotation.y = FACE_YAW[face];
    parent.add(side);
    // End the trim inside the wall edges: an end cap at z=0 would
    // otherwise compete with the reading facade in the depth buffer.
    const across = (face === "+z" || face === "-z" ? spec.w : spec.d) - 0.08;
    const out = (face === "+z" || face === "-z" ? spec.d : spec.w) / 2;

    /* Pilasters always turn the corners; between them only on some faces,
       so not every wall is the same grid. */
    const bays = Math.max(1, Math.round(across / between(rand, 4.2, 6.5)));
    const bay = across / bays;
    const ribbed = rand() < 0.45;
    for (let k = 0; k <= bays; k += 1) {
      if (!ribbed && k > 0 && k < bays) continue;
      const x = THREE.MathUtils.clamp(
        -across / 2 + k * bay,
        -across / 2 + PILASTER.width / 2,
        across / 2 - PILASTER.width / 2
      );
      side.add(block(registry, palette.shelf, [PILASTER.width, height, PILASTER.proud * 2], [x, spec.foot + height / 2, out]));
    }
    floors.slice(1, -1).forEach((y) =>
      side.add(
        block(registry, palette.shelf, [across, COURSE.height, (COURSE.proud + PILASTER.proud) * 2], [0, y, out])
      )
    );

    const chance = spec.windows ?? 0.5;
    // Now and then a wall stands on an arcade: tall arches along its foot.
    const arcade = floors[1] - floors[0] > 4 && rand() < 0.3;
    for (let f = 0; f < floors.length - 1; f += 1) {
      const storey = floors[f + 1] - floors[f];
      if (storey < 2.6) continue;
      if (f === 0 && arcade) {
        const arches = Math.max(2, Math.round(across / 2.4));
        for (let k = 0; k < arches; k += 1) {
          doorway(side, site, {
            at: [-across / 2 + (k + 0.5) * (across / arches), floors[0], out],
            yaw: 0,
            width: Math.min(1.3, (across / arches) * 0.5),
            height: Math.min(storey * 0.7, 3.4),
          });
        }
        continue;
      }
      for (let k = 0; k < bays; k += 1) {
        if (rand() > chance) continue;
        const centre = -across / 2 + (k + 0.5) * bay;
        const pair = bay > 3 && rand() < 0.45;
        const wide = Math.min(pair ? 0.6 : 0.85, bay * 0.26);
        const tall = Math.min(storey * 0.52, wide * 2.6);
        (pair ? [-0.22, 0.22] : [0]).forEach((dx) =>
          doorway(side, site, {
            at: [centre + dx * bay, floors[f] + (storey - tall) * 0.45, out],
            yaw: 0,
            width: wide,
            height: tall,
          })
        );
      }
    }
  });
}

/** What a folly wears over its massing: its flanks and back articulated, a
    frieze in its deep stone under the cap, a stepped foot, and a pilaster in
    its colour at each edge of the front, so the page stands framed. */
export function follyTrim(site: Site, stones: Stones, shape: FollyShape) {
  const { registry } = site;
  const { width, depth, roof, bottom } = shape;
  const trim = new THREE.Group();
  const foot = bottom + (shape.sharedBase ? 0 : PLINTH) + (shape.archHeight ?? 0);
  const top = roof - CAP - 0.34;

  articulate(trim, site, { cx: 0, cz: -depth / 2, w: width, d: depth, foot, top, faces: ["+x", "-x", "-z"], windows: 0.4 });
  // The frieze stops a hair behind the front, which stays one clean plane.
  trim.add(block(registry, stones.deep, [width + 0.36, 0.34, depth + 0.16], [0, top + 0.17, -0.02 - (depth + 0.16) / 2]));
  if (!shape.sharedBase) trim.add(block(registry, stones.deep, [width + 2 * LIP + 0.7, 0.5, depth + LIP + 0.7], [0, bottom - 0.25, -(depth + LIP) / 2]));
  [-1, 1].forEach((sx) =>
    trim.add(
      block(registry, stones.stone, [0.44, top - foot + 0.34, 0.16], [sx * (width / 2 - 0.22), (foot + top + 0.34) / 2, 0.06])
    )
  );
  return trim;
}

/** The front becomes architecture in the wide view. Reading hides this
    assembly, so openings never sit behind a paragraph or an interactive link. */
export function follyFront(site: Site, stones: Stones, shape: FollyShape) {
  const { registry, palette } = site;
  const { width, depth, roof, bottom } = shape;
  const front = new THREE.Group();
  front.name = "architectural-front";
  articulate(front, site, { cx: 0, cz: -depth / 2, w: width, d: depth,
    foot: bottom + (shape.sharedBase ? 0 : PLINTH) + (shape.archHeight ?? 0), top: roof - CAP - 0.34, faces: ["+z"], windows: 1 });
  const x = width * 0.23;
  const y = bottom + (roof - bottom) * 0.48;
  box(front, registry, palette.shelf, [2.6, 0.3, 1.9], [x, y, 0.85]);
  const support = new THREE.Group();
  support.position.set(x, y - 0.15, 0.5);
  corbel(support, site, stones.deep, 1.8, 1.4);
  front.add(support);
  box(front, registry, palette.shelf, [2.6, 0.5, 0.18], [x, y + 0.4, 1.71]);
  [-1, 1].forEach((side) => box(front, registry, palette.shelf,
    [0.18, 0.5, 1.9], [x + side * 1.21, y + 0.4, 0.85]));
  box(front, registry, stones.accent, [0.75, 0.5, 0.75], [x - 0.65, y + 0.4, 0.8]);
  tree(front, site, [x - 0.65, y + 0.65, 0.8], 1.2);
  doorway(front, site, { at: [x + 0.45, y + 0.15, 0], yaw: 0, width: 0.9, height: 2.4 });
  return front;
}

/* ---------------- ways between follies ---------------- */

/* The impossible paths are one way across; these are the other. A covered
   way on an arcade, carried level from a wall of one folly to a wall of the
   next, with a small tower wherever it turns — the plumbing of a Monument
   Valley level, the part that makes separate buildings one place. */
export const WAY = { width: 2.2, deck: 0.6, arcade: 1.9 };

/** A way along `points`, the centreline of its deck's top in one folly's
    frame. Every run must be square to that frame's axes; a run whose ends
    stand at different heights is built as a stair. */
export function coveredWay(site: Site, stones: Stones, accents: readonly THREE.Material[], points: THREE.Vector3[]) {
  const { registry, palette, rand } = site;
  const group = new THREE.Group();
  const last = points.length - 2;

  for (let k = 0; k <= last; k += 1) {
    const a = points[k].clone();
    const b = points[k + 1].clone();
    const dir = b.clone().sub(a).setY(0).normalize();
    // Interior corners are filled by running each leg on under the tower.
    if (k > 0) a.addScaledVector(dir, -WAY.width / 2);
    if (k < last) b.addScaledVector(dir, WAY.width / 2);
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const run = new THREE.Group();
    run.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    run.rotation.y = Math.atan2(dir.x, dir.z) - Math.PI / 2;
    group.add(run);

    // In the run's own frame the way goes along x.
    const rise = b.y - a.y;
    if (Math.abs(rise) > 0.05) {
      const stair = registry.model("staircase", {
        stone: stones.stone, trim: palette.shelf, shadow: stones.deep,
        accent: stones.accent, recess: palette.deep,
      });
      if (stair) {
        stair.scale.set(length / 6, Math.abs(rise) / 3, WAY.width / 1.9);
        stair.rotation.y = rise > 0 ? 0 : Math.PI;
        stair.position.set(rise > 0 ? -length / 2 : length / 2, Math.min(a.y, b.y), 0);
        run.add(stair);
        continue;
      }
      /* A stair: each tread a block reaching as far down as the arcade
         would, so the underside steps with the top. */
      const steps = Math.ceil(Math.abs(rise) / 0.45);
      const tread = length / steps;
      const deep = WAY.deck + WAY.arcade * 0.7;
      for (let n = 0; n < steps; n += 1) {
        const y = a.y + rise * ((n + 0.5) / steps);
        run.add(
          block(registry, faces(stones.stone, palette.shelf, stones.deep), [tread + 0.02, deep, WAY.width], [
            -length / 2 + (n + 0.5) * tread,
            y - deep / 2,
            0,
          ])
        );
      }
      continue;
    }
    const bayCount = Math.max(1, Math.round(length / 2.6));
    let modelled = true;
    for (let n = 0; n < bayCount; n += 1) {
      const bay = registry.model("arcade", {
        stone: stones.stone, trim: palette.shelf, shadow: stones.deep,
        accent: stones.accent, recess: palette.deep,
      });
      if (!bay) { modelled = false; break; }
      bay.scale.x = length / (2.6 * bayCount);
      bay.position.set(-length / 2 + (n + 0.5) * length / bayCount, a.y - 2.5, 0);
      run.add(bay);
    }
    if (modelled) continue;
    const top = a.y;
    run.add(block(registry, faces(stones.stone, palette.shelf, stones.deep), [length, WAY.deck, WAY.width], [0, top - WAY.deck / 2, 0]));
    run.add(block(registry, palette.shelf, [length, 0.18, WAY.width + 0.16], [0, top - WAY.deck - 0.09, 0]));
    const under = top - WAY.deck - 0.18;
    run.add(block(registry, stones.deep, [length, WAY.arcade, WAY.width - 0.3], [0, under - WAY.arcade / 2, 0]));
    const arches = Math.floor(length / 2.6);
    for (let n = 0; n < arches; n += 1) {
      const x = -length / 2 + (n + 0.5) * (length / arches);
      [1, -1].forEach((sz) =>
        doorway(run, site, {
          at: [x, under - WAY.arcade, sz * (WAY.width / 2 - 0.15)],
          yaw: sz > 0 ? 0 : Math.PI,
          width: 1.1,
          height: WAY.arcade - 0.35,
        })
      );
    }
    // Rails along both edges, open at the ends.
    [1, -1].forEach((sz) =>
      run.add(
        block(registry, palette.shelf, [Math.max(0.1, length - 1.6), 0.42, 0.22], [0, top + 0.21, sz * (WAY.width / 2 - 0.11)])
      )
    );
    // A long run is held up from below by a hanging pier.
    if (length > 9) {
      const pier = new THREE.Group();
      pier.position.set(between(rand, -length / 4, length / 4), under - WAY.arcade, 0);
      run.add(pier);
      corbel(pier, site, stones.stone, WAY.width - 0.3);
    }
  }

  points.slice(1, -1).forEach((corner) => {
    const built = steppedTower(site, { ...stones, accent: pick(rand, accents) }, {
      half: 1.45,
      height: between(rand, 4.5, 7.5),
      hung: true,
    });
    built.group.position.set(corner.x, corner.y - WAY.deck - WAY.arcade - 0.4, corner.z);
    group.add(built.group);
  });
  return group;
}

/* ---------------- paths ---------------- */

/** A path's cross-section. Its top sits a hair over whatever roof it crosses,
    so it reads as the roof carrying on rather than as a plank laid on it. */
export const PATH = { width: 1.9, thick: 0.6, rise: 0.08 };

/** One straight run of path at a constant height, laid in tiles. Tiles rather
    than one long slab so that keeping things off it can be judged tile by
    tile: a long diagonal slab's screen box is mostly sky. */
export function pathRun(
  parent: THREE.Object3D,
  { registry, palette }: Site,
  stones: Stones,
  from: THREE.Vector3,
  to: THREE.Vector3
) {
  const run = to.clone().sub(from);
  const length = run.length();
  if (length < 0.01) return;
  const yaw = Math.atan2(run.x, run.z);
  const count = Math.max(1, Math.round(length / 2.2));
  const materials = faces(stones.stone, palette.shelf, stones.deep);
  for (let k = 0; k < count; k += 1) {
    const centre = from.clone().addScaledVector(run, (k + 0.5) / count);
    const tile = block(registry, materials, [PATH.width, PATH.thick, length / count], [
      centre.x,
      centre.y - PATH.thick / 2,
      centre.z,
    ]);
    tile.rotation.y = yaw;
    parent.add(tile);
  }
}

/** A continuous descending stair between roofs, including real risers.
    Horizontal footprints overlap slightly so no sky leaks between treads. */
export function stairRun(parent: THREE.Object3D, { registry, palette }: Site, stones: Stones,
  from: THREE.Vector3, to: THREE.Vector3) {
  const delta = to.clone().sub(from);
  const length = Math.hypot(delta.x, delta.z);
  if (length < 0.01) return;
  const stair = registry.model("staircase", {
    stone: stones.stone, trim: palette.shelf, shadow: stones.deep,
    accent: stones.accent, recess: palette.deep,
  });
  if (stair && Math.abs(delta.y) > 0.01) {
    const low = from.y < to.y ? from : to;
    const high = from.y < to.y ? to : from;
    const direction = high.clone().sub(low);
    stair.scale.set(length / 6, Math.abs(delta.y) / 3, 1);
    stair.rotation.y = -Math.atan2(direction.z, direction.x);
    stair.position.copy(low);
    parent.add(stair);
    return;
  }
  const count = Math.max(1, Math.ceil(Math.abs(delta.y) / 0.4));
  const yaw = Math.atan2(delta.x, delta.z);
  const materials = faces(stones.stone, palette.shelf, stones.deep);
  for (let k = 0; k < count; k += 1) {
    const centre = from.clone().lerp(to, (k + 0.5) / count);
    const step = block(registry, materials, [PATH.width, 0.85, length / count + 0.025],
      [centre.x, centre.y - 0.425, centre.z]);
    step.rotation.y = yaw;
    parent.add(step);
  }
}

/** The one who walks the paths: a white cone, a round head, a tall hat. */
export function traveler({ registry }: Site) {
  const white = registry.lit(0xfffdf9);
  const group = new THREE.Group();
  const figure = new THREE.Group();
  group.add(figure);
  const body = new THREE.Mesh(registry.geometry(new THREE.ConeGeometry(0.44, 1.1, 8)), white);
  body.position.y = 0.55;
  const head = new THREE.Mesh(registry.geometry(new THREE.IcosahedronGeometry(0.28, 1)), white);
  head.position.y = 1.32;
  const hat = new THREE.Mesh(registry.geometry(new THREE.ConeGeometry(0.27, 0.9, 8)), white);
  hat.position.y = 1.32 + 0.16 + 0.45;
  figure.add(body, head, hat);
  return { group, figure };
}

/* ---------------- dressing a folly ---------------- */

/** A strip of roof that must stay open: where a path lands or leaves, and the
    line the traveler walks between them. Folly-local x and z. */
export type KeepOut = { from: [number, number]; to: [number, number]; radius: number };
export type Under = "pillars" | "hanging" | "arcade" | "island" | "shared";

function distanceToSegment(x: number, z: number, { from, to }: KeepOut) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const span = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - from[0]) * dx + (z - from[1]) * dz) / span));
  return Math.hypot(x - (from[0] + t * dx), z - (from[1] + t * dz));
}

/** A round-headed doorway, dark and a hair proud, on a face turned by `yaw`
    from +z. `at` is the middle of its sill, on the face. */
function doorway(
  parent: THREE.Object3D,
  { registry, palette }: Site,
  spec: { at: [number, number, number]; yaw: number; width: number; height: number }
) {
  const group = new THREE.Group();
  group.position.set(...spec.at);
  group.rotation.y = spec.yaw;
  const inset = registry.model("window", {
    stone: palette.deep, trim: palette.deep, shadow: palette.deep,
    accent: palette.deep, recess: palette.deep,
  });
  if (inset) {
    inset.scale.set(spec.width, spec.height / 2, 1);
    group.add(inset);
    parent.add(group);
    return;
  }
  const jamb = Math.max(0.2, spec.height - spec.width / 2);
  group.add(block(registry, palette.deep, [spec.width, jamb, 0.14], [0, jamb / 2, 0.05]));
  const head = new THREE.Mesh(
    registry.geometry(new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI)),
    palette.deep
  );
  head.scale.set(spec.width / 2, 0.14, spec.width / 2);
  head.rotation.x = -Math.PI / 2;
  head.position.set(0, jamb, 0.05);
  group.add(head);
  parent.add(group);
}

const ROOF_PIECES = ["tower", "pavilion", "stack", "grove"] as const;

/** Grow the original layered skyline: roof crowns, side wings, planted
    terraces, parapets, and distinct foundations for each chapter. */
export function dress(
  site: Site,
  stones: Stones,
  accents: readonly THREE.Material[],
  shape: FollyShape & { tallSide: -1 | 0 | 1; keepOut: KeepOut[]; under: Under }
) {
  const { registry, palette, rand } = site;
  const { width, depth, roof, bottom, keepOut } = shape;
  const pieces: THREE.Object3D[] = [];
  const height = roof - bottom;
  const open = (x: number, z: number, reach: number, behind = 0) =>
    Math.abs(x) + reach <= width / 2 && z + reach <= behind - 0.3 && z - reach >= -depth &&
    keepOut.every((zone) => distanceToSegment(x, z, zone) >= reach + zone.radius);
  let rear = 0;
  const edges: KeepOut[] = [];
  const backmost = Math.min(-2.2, ...keepOut.flatMap((zone) => [zone.from[1], zone.to[1]].map((z) => z - zone.radius - 0.4)));
  if (rand() < 0.62 && backmost + depth >= 2.4) {
    const mass = new THREE.Group();
    const w = width * between(rand, 0.32, 0.66);
    const d = Math.min(backmost + depth, between(rand, 2.6, 6));
    const cx = between(rand, -(width - w) / 2, (width - w) / 2);
    const cz = -depth + d / 2;
    const h = between(rand, 3, 9.5);
    mass.add(block(registry, faces(stones.deep, palette.shelf, stones.deep, stones.stone), [w, h, d], [cx, roof + h / 2, cz]));
    box(mass, registry, palette.shelfDeep, [w + 0.4, 0.45, d + 0.4], [cx, roof + h - 0.22, cz]);
    articulate(mass, site, { cx, cz, w, d, foot: roof, top: roof + h - 0.45, faces: ["+z", "+x", "-x", "-z"], windows: 0.6 });
    const crown = new THREE.Group();
    crown.position.set(cx, 0, cz);
    mass.add(crown);
    roofing(crown, site, pick(rand, ROOFS), Math.min(w, d) / 2, roof + h, { ...stones, accent: pick(rand, accents) });
    pieces.push(mass);
    rear = cz + d / 2;
    edges.push({ from: [cx - w / 2 - 0.6, -depth], to: [cx + w / 2 + 0.6, -depth], radius: d });
  }
  const wanted = rear < 0 ? Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2);
  for (let n = 0; n < wanted; n += 1) {
    const kind = pick(rand, ROOF_PIECES);
    const half = kind === "grove" ? 0.9 : between(rand, 1.2, 2.1);
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const x = between(rand, -width / 2, width / 2);
      const z = between(rand, -depth, rear < 0 ? rear : 0);
      if (!open(x, z, half * 1.25, rear < 0 ? rear : 0)) continue;
      const accent = pick(rand, accents);
      let piece: THREE.Group;
      if (kind === "grove") {
        piece = new THREE.Group();
        tree(piece, site, [0, roof, 0], between(rand, 1.1, 1.7));
        if (rand() < 0.6) tree(piece, site, [between(rand, -0.8, 0.8), roof, between(rand, -0.8, 0.8)], between(rand, 0.7, 1.1));
      } else {
        const built = kind === "tower"
          ? steppedTower(site, { ...stones, accent }, { half, height: between(rand, 3, 8), hung: false })
          : kind === "pavilion" ? pavilion(site, { ...stones, accent }, { half })
          : blockStack(site, { ...stones, accent }, { half });
        piece = built.group;
        piece.position.y = roof;
      }
      piece.position.x = x;
      piece.position.z = z;
      pieces.push(piece);
      break;
    }
  }
  if (rand() < 0.7) {
    const tall = shape.tallSide !== 0 && rand() < 0.55;
    const side = tall ? shape.tallSide : rand() < 0.5 ? -1 : 1;
    const wing = new THREE.Group();
    const w = between(rand, 2.8, 5.4);
    const d = between(rand, 3, Math.min(depth + 2.5, 9));
    const front = between(rand, -0.8, 1.4);
    // A small overlap joins the wing to the wall without a hairline gap.
    const x = side * (width / 2 + w / 2 - 0.08);
    const z = front - d / 2;
    const top = tall ? roof + between(rand, 2.5, 8)
      : roof - between(rand, 2.2, Math.max(2.4, Math.min(9, height * 0.45)));
    const naturalFoot = Math.min(top - 3, bottom + between(rand, -7, height * 0.35));
    const foot = shape.under === "shared" ? Math.max(bottom, naturalFoot) : naturalFoot;
    const h = top - foot;
    wing.add(block(registry, faces(stones.deep, palette.shelf, stones.deep, stones.stone), [w, h, d], [x, foot + h / 2, z]));
    box(wing, registry, palette.shelfDeep, [w + 0.4, 0.45, d + 0.4], [x, top - 0.22, z]);
    articulate(wing, site, { cx: x, cz: z, w, d, foot: foot + 0.6, top: top - 0.45,
      faces: ["+z", side > 0 ? "+x" : "-x", "-z"], windows: 0.45 });
    const corbelled = new THREE.Group();
    corbelled.position.set(x, foot, z);
    wing.add(corbelled);
    corbel(corbelled, site, stones.stone, w, d);
    if (h > 4.5) doorway(wing, site, { at: [x, foot + 0.6, front], yaw: 0, width: Math.min(1.4, w * 0.36), height: Math.min(3, h * 0.4) });
    if (tall) {
      const crown = new THREE.Group();
      crown.position.set(x, 0, z);
      wing.add(crown);
      roofing(crown, site, pick(rand, ROOFS), Math.min(w, d) / 2, top, { ...stones, accent: pick(rand, accents) });
    } else {
      const rise = roof - top;
      const stairZ = z + between(rand, -d / 4, d / 4);
      const steps = Math.ceil(rise / 0.55);
      const tread = (w - 0.7) / steps;
      if (tread >= 0.38 && open(side * (width / 2 - 0.9), stairZ, 0.8)) {
        edges.push({ from: [side * (width / 2), stairZ], to: [side * (width / 2), stairZ], radius: 1.4 });
        for (let k = 0; k < steps; k += 1) {
          const stepTop = top + ((k + 1) * rise) / steps;
          const sx = side * (width / 2 + w - 0.35 - (k + 0.5) * tread);
          wing.add(block(registry, faces(stones.stone, palette.shelf, stones.deep),
            [tread + 0.015, stepTop - top, 1.5], [sx, (top + stepTop) / 2, stairZ]));
        }
      } else tree(wing, site, [x, top, z], between(rand, 1, 1.5));
    }
    pieces.push(wing);
  }
  const rim = width / 2 + LIP - 0.2;
  const back = -depth - LIP + 0.2;
  const sides: [number, number][][] = [
    [[-rim, -1], [-rim, back]], [[-rim, back], [rim, back]], [[rim, back], [rim, -1]],
  ];
  const clear = (x: number, z: number) =>
    [...keepOut, ...edges].every((zone) => distanceToSegment(x, z, zone) >= zone.radius + 0.5);
  sides.forEach(([from, to]) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(1, Math.round(length / 0.7));
    let begun: number | null = null;
    for (let k = 0; k <= steps + 1; k += 1) {
      const t = k / steps;
      const ok = k <= steps && clear(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
      if (ok && begun === null) begun = t;
      if (!ok && begun !== null) {
        const end = (k - 1) / steps;
        if ((end - begun) * length >= 1.6) {
          const a: [number, number] = [from[0] + (to[0] - from[0]) * begun, from[1] + (to[1] - from[1]) * begun];
          const b: [number, number] = [from[0] + (to[0] - from[0]) * end, from[1] + (to[1] - from[1]) * end];
          const along = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
          const span = Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.4;
          const wall = new THREE.Group();
          wall.add(block(registry, faces(stones.stone, palette.shelf, stones.deep),
            along ? [span, 0.5, 0.4] : [0.4, 0.5, span], [(a[0] + b[0]) / 2, roof + 0.25, (a[1] + b[1]) / 2]));
          [a, b].forEach(([px, pz]) => wall.add(block(registry, stones.deep, [0.6, 0.9, 0.6], [px, roof + 0.45, pz])));
          pieces.push(wall);
        }
        begun = null;
      }
    }
  });
  [-1, 1].forEach((side) => {
    if (rand() < 0.45) return;
    const zz = between(rand, -depth + 1.4, -1.4);
    const piece = new THREE.Group();
    if (rand() < 0.5) doorway(piece, site, { at: [side * (width / 2), bottom + PLINTH, zz], yaw: side * (Math.PI / 2), width: 1.3, height: 2.6 });
    else {
      const count = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < count; k += 1)
        box(piece, registry, palette.deep, [0.1, 1.3, 0.5], [side * (width / 2 + 0.04), roof - 2.6 - k * 2.4, zz]);
    }
    pieces.push(piece);
  });
  // Small inhabited terraces break the tall facades into human-scale places.
  // The deck, brackets, planters and tree are one assembly for collision checks.
  if (height > 12) {
    [-1, 1].forEach((side, index) => {
      const balcony = new THREE.Group();
      const level = roof - height * (index === 0 ? 0.38 : 0.68);
      const z = -depth * 0.58;
      const x = side * (width / 2 + 0.85);
      box(balcony, registry, palette.shelf, [2.1, 0.3, 3.0], [x, level, z]);
      const brackets = new THREE.Group();
      brackets.position.set(x - side * 0.35, level - 0.15, z);
      corbel(brackets, site, stones.deep, 1.4, 2.2);
      balcony.add(brackets);
      box(balcony, registry, stones.accent, [0.72, 0.45, 0.72], [x, level + 0.375, z - 0.8]);
      tree(balcony, site, [x, level + 0.6, z - 0.8], 1.25);
      box(balcony, registry, palette.shelf, [0.16, 0.55, 3.0], [x + side * 0.97, level + 0.425, z]);
      [-1, 1].forEach((end) => box(balcony, registry, palette.shelf,
        [2.1, 0.55, 0.16], [x, level + 0.425, z + end * 1.42]));
      doorway(balcony, site, { at: [side * (width / 2), level + 0.15, z + 0.4],
        yaw: side * Math.PI / 2, width: 0.85, height: 2.1 });
      pieces.push(balcony);
    });
  }

  const under = new THREE.Group();
  switch (shape.under) {
    case "pillars": {
      const count = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < count; k += 1) {
        const size = between(rand, 0.9, 1.7);
        const x = between(rand, -width / 2 + size, width / 2 - size);
        const z = between(rand, -depth + size, -size);
        const length = between(rand, 4, 13);
        under.add(block(registry, stones.deep, [size, length, size], [x, bottom - length / 2, z]));
        under.add(block(registry, stones.stone, [size * 1.4, 0.6, size * 1.4], [x, bottom - length - 0.3, z]));
      }
      break;
    }
    case "hanging": {
      let sx = width * 0.92, sz = depth * 0.92, y = bottom;
      for (let k = 0; k < 4; k += 1) {
        const h = between(rand, 0.9, 1.9);
        under.add(block(registry, k % 2 === 0 ? stones.deep : stones.stone, [sx, h, sz], [0, y - h / 2, -depth / 2]));
        y -= h;
        const shrink = between(rand, 0.58, 0.78);
        sx *= shrink; sz *= shrink;
      }
      const length = between(rand, 2, 4.5);
      const spike = new THREE.Mesh(registry.geometry(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4)), stones.deep);
      spike.scale.set(sx, length, sz);
      spike.rotation.set(Math.PI, Math.PI / 4, 0);
      spike.position.set(0, y - length / 2, -depth / 2);
      under.add(spike);
      break;
    }
    case "arcade": {
      const h = between(rand, 3.5, 6), w = width * 0.86, d = depth * 0.8, front = -0.7;
      under.add(block(registry, faces(stones.stone, palette.shelf, stones.deep), [w, h, d], [0, bottom - h / 2, front - d / 2]));
      under.add(block(registry, stones.deep, [w + 0.5, 0.6, d + 0.5], [0, bottom - h - 0.3, front - d / 2]));
      const arches = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < arches; k += 1) doorway(under, site, {
        at: [(k - (arches - 1) / 2) * (w / arches), bottom - h, front], yaw: 0,
        width: Math.min(1.6, (w / arches) * 0.5), height: h * 0.72,
      });
      doorway(under, site, { at: [w / 2, bottom - h, front - d / 2], yaw: Math.PI / 2, width: 1.4, height: h * 0.7 });
      break;
    }
    case "island": {
      const rock = new THREE.Group();
      rock.add(block(registry, palette.rockDeep, [width + 5, 6, depth + 5], [0, bottom - 3.02, -depth / 2]));
      rock.add(block(registry, palette.lawn, [width + 5.1, 0.4, depth + 5.1], [0, bottom - 0.2, -depth / 2]));
      pieces.push(rock);
      for (let n = 0; n < 11; n += 1) {
        const stone = new THREE.Group();
        const bearing = (n / 11) * Math.PI * 2 + between(rand, -0.2, 0.2);
        const reach = Math.max(width, depth) / 2 + between(rand, 2.5, 7);
        const w = between(rand, 2.2, 5), d = between(rand, 2.2, 5), h = between(rand, 2.5, 7);
        const crest = bottom - between(rand, 0, 2.6) + (n % 4 === 0 ? between(rand, 1, 3.5) : 0);
        stone.position.set(Math.sin(bearing) * reach, crest, -depth / 2 + Math.cos(bearing) * reach);
        box(stone, registry, rand() < 0.5 ? palette.rock : palette.rockDeep, [w, h, d], [0, -h / 2, 0]);
        if (rand() < 0.6) {
          box(stone, registry, palette.lawn, [w + 0.1, 0.4, d + 0.1], [0, 0.2, 0]);
          if (rand() < 0.5) tree(stone, site, [0, 0.4, 0], between(rand, 1.1, 1.9));
        }
        pieces.push(stone);
      }
      break;
    }
  }
  if (under.children.length) pieces.push(under);
  return pieces;
}

/* ---------------- keeping the words clear ---------------- */

const point = new THREE.Vector3();

/** Depth toward the eye: larger is nearer the camera. */
const depthOf = (v: THREE.Vector3) => v.dot(ISO_DIR);

const overlaps = (a: ScreenBox, b: ScreenBox) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

/* Something is in the way if any of its meshes covers a protected area on
   screen *and* stands nearer the eye than what it covers.

   Two kinds of thing are protected, each only at the angle it is seen at. An
   inscription lies on its wall, which is vertical and square to the eye, so
   its depth is an affine function of screen height, read off two of the
   facet's own points. A path is protected tile by tile, each at the depth of
   its own far side — at the one angle where it joins up, since a bridge
   with a tower standing across it does not read as a bridge. */
type Zone = { area: ScreenBox; depthAt: (screenY: number) => number };

/** Turn the root to `turn` and list what may not be covered there. Leaves the
    root turned, so whatever is tested next is tested at that angle. */
export type Watch = { turn: number; walls: THREE.Object3D[]; paths: THREE.Object3D[] };

const grow = (area: ScreenBox, margin: number): ScreenBox => ({
  ...area,
  minX: area.minX - margin,
  maxX: area.maxX + margin,
  minY: area.minY - margin,
  maxY: area.maxY + margin,
});

export function zonesAt(root: THREE.Object3D, watch: Watch, margin = 0.5): Zone[] {
  root.rotation.y = watch.turn;
  root.updateMatrixWorld(true);
  const probe = new THREE.Vector3();
  const zones: Zone[] = [];

  watch.walls.forEach((wall) => {
    // Two points on the wall: where the facet starts, and a unit down it.
    probe.set(0, 0, 0).applyMatrix4(wall.matrixWorld);
    const y0 = probe.dot(SCREEN_UP);
    const d0 = depthOf(probe);
    probe.set(0, -1, 0).applyMatrix4(wall.matrixWorld);
    const slope = (depthOf(probe) - d0) / (probe.dot(SCREEN_UP) - y0 || 1);
    zones.push({ area: grow(screenBox(wall), margin), depthAt: (y) => d0 + (y - y0) * slope });
  });

  watch.paths.forEach((path) =>
    path.traverse((tile) => {
      if (!(tile instanceof THREE.Mesh)) return;
      const far = farthest(tile);
      zones.push({ area: grow(screenBox(tile), margin * 0.5), depthAt: () => far });
    })
  );
  return zones;
}

/** Whether any mesh of `piece` covers any zone, at the root's current angle. */
export function inTheWay(piece: THREE.Object3D, zones: Zone[]) {
  let blocked = false;
  piece.traverse((child) => {
    if (blocked || !(child instanceof THREE.Mesh)) return;
    const area = screenBox(child);
    for (const zone of zones) {
      if (!overlaps(area, zone.area)) continue;
      const low = Math.max(area.minY, zone.area.minY);
      const high = Math.min(area.maxY, zone.area.maxY);
      if (nearest(child) > Math.min(zone.depthAt(low), zone.depthAt(high)) - 0.1) {
        blocked = true;
        return;
      }
    }
  });
  return blocked;
}

/** Remove, whole, every piece that is in the way at any watched angle. */
export function clearOf(root: THREE.Object3D, pieces: THREE.Object3D[], watches: Watch[]) {
  watches.forEach((watch) => {
    const zones = zonesAt(root, watch);
    pieces.forEach((piece) => {
      if (piece.parent && inTheWay(piece, zones)) piece.removeFromParent();
    });
  });
  root.rotation.y = 0;
  root.updateMatrixWorld(true);
}

/** How near any vertex of a mesh comes to the eye, at its nearest or farthest. */
function depthExtreme(mesh: THREE.Mesh, pickNear: boolean) {
  const position = mesh.geometry.getAttribute("position");
  let best = pickNear ? -Infinity : Infinity;
  for (let i = 0; i < position.count; i += 1) {
    point.fromBufferAttribute(position as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
    const depth = depthOf(point);
    best = pickNear ? Math.max(best, depth) : Math.min(best, depth);
  }
  return best;
}
const nearest = (mesh: THREE.Mesh) => depthExtreme(mesh, true);
const farthest = (mesh: THREE.Mesh) => depthExtreme(mesh, false);

/* ---------------- the handle ---------------- */

/* The games' one control: a round boss on a wall with a crank on it, and
   turning the crank turns the world. Built in screen units on the wall's
   own plane — the caller hangs it in a group carrying the wall's vertical
   stretch, the same as an inscription — so it is a true circle on screen
   and a drag round it is a drag round a circle. The crank spins about +z,
   out of the wall toward the eye. */
export const HANDLE_RADIUS = 1.25;

export function crankHandle({ registry, palette }: Site, stones: Stones, knob: THREE.Material) {
  const group = new THREE.Group();
  const disc = (radius: number, depth: number, material: THREE.Material, z: number) => {
    const mesh = new THREE.Mesh(registry.geometry(new THREE.CylinderGeometry(radius, radius, depth, 40)), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z + depth / 2;
    return mesh;
  };
  group.add(disc(HANDLE_RADIUS, 0.3, stones.deep, 0), disc(HANDLE_RADIUS - 0.22, 0.36, stones.stone, 0));
  // Four notches, a quarter apart: one for every face the world can show.
  for (let k = 0; k < 4; k += 1) {
    const notch = block(registry, palette.shelf, [0.16, 0.34, 0.12], [0, HANDLE_RADIUS - 0.11, 0.36]);
    const turn = new THREE.Group();
    turn.rotation.z = (k * Math.PI) / 2;
    turn.add(notch);
    group.add(turn);
  }

  const crank = new THREE.Group();
  crank.position.z = 0.36;
  group.add(crank);
  crank.add(disc(0.34, 0.3, palette.shelf, 0));
  crank.add(block(registry, palette.shelf, [0.3, 0.92, 0.2], [0, 0.46, 0.12]));
  const grip = disc(0.22, 0.62, knob, 0.12);
  grip.position.y = 0.88;
  crank.add(grip);

  // What a press lands on: the whole boss and a margin, so it is easy to grab.
  const hit = new THREE.Mesh(
    registry.geometry(new THREE.CircleGeometry(HANDLE_RADIUS + 0.45, 24)),
    registry.track(new THREE.MeshBasicMaterial({ visible: false }))
  );
  hit.position.z = 0.7;
  group.add(hit);
  return { group, crank, hit };
}

/** The ring the games draw where a tap will send the traveler. In the
    shadowed lavender of the openings rather than their white: it lies on a
    cream roof, and white on cream is not there. */
export function destinationRing({ registry }: Site) {
  const material = registry.track(new THREE.MeshBasicMaterial({ color: 0x8a7bd0, transparent: true, depthWrite: false }));
  const ring = new THREE.Mesh(registry.geometry(new THREE.RingGeometry(0.85, 1.2, 48)), material);
  ring.rotation.x = -Math.PI / 2;
  return { ring, material };
}
