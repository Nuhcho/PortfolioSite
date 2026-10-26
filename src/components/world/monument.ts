import * as THREE from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { affiliation, contact, experience, projects, skillGroups, type Entry } from "@/data/content";
import { SCREEN_LIFT, SCREEN_RIGHT, SCREEN_UP, screenBox } from "./layout";
import {
  PATH,
  block as stoneBlock,
  clearOf,
  HANDLE_RADIUS,
  crankHandle,
  destinationRing,
  dress,
  follyMassing,
  follyTrim,
  follyFront,
  pathRun,
  stairRun,
  seeded,
  traveler,
  type FollyShape,
  type KeepOut,
  type Site,
  type Stones,
  type Watch,
} from "./architecture";
import { controlBlock, wallInk, type Control, type Hotspot } from "./parts";
import { INK, ISO_DIR, Registry, TRACK, TYPE, type Palette } from "./theme";
import { measureInline, type Run } from "./text";
import { buildHarbor } from "./harbor";

/* Five readable faces belong to one stepped monument. A central spine,
   shared foundation and wrapping stairs make a continuous volume. Scrolling
   turns around that volume; it never jumps between independent buildings. */

export type StoreyContext = {
  elapsed: number;
  dt: number;
  reduce: boolean;
  /** the path the traveler is stood at the end of, waiting to be sent
      across, or null */
  waiting: number | null;
};

export type Storey = {
  /** matches the mirror's section id, so `#work` lands on the work folly */
  id: string;
  /** where the camera looks when this folly is square to the eye, in the
      root's own frame: turn it with the root to find it in the world */
  target: THREE.Vector3;
  fitWidth: number;
  fitHeight: number;
  /** the group carrying this folly's inscription — everything that must be
      off the wall before the site turns */
  facet: THREE.Group;
  /** fade this folly's inscription, 1 readable to 0 gone */
  setInk: (opacity: number) => void;
  /** Overview of the complete monument halfway through a turn, in the
      root's own frame. Absent on the final reading face. */
  onward?: { centre: THREE.Vector3; halfWidth: number; halfHeight: number };
};

export type View = { width: number; height: number; narrow: boolean };

export type BuildArgs = {
  registry: Registry;
  palette: Palette;
  font: Font;
  view: View;
  hotspots: Hotspot[];
};

/** Radians of site turned per folly travelled. */
export const QUARTER = Math.PI / 2;
/** How far through a turn the path onward joins. The turn holds there. */
export const JOIN = 0.5;
/** How the turn is spent: `swing` of it rotating to the join, `hold` of it
    standing still there while the traveler crosses, `swing` rotating on, and
    whatever is left settled square on the next folly before its ink comes
    back. */
export const TURN = { swing: 0.34, hold: 0.24 };

/* An inscription lies flat on its wall, so the instant that wall swings off
 * square the type shears with it — the one thing on the site that cannot be
 * allowed to stay on screen through a turn. Each facet therefore owns private
 * copies of every material it uses: the registry shares materials across the
 * whole site by design, and fading a shared one would take four other
 * follies down with it. Clones are tracked, so teardown still disposes them. */
function fadeable(facet: THREE.Group, registry: Registry) {
  const clones = new Map<THREE.Material, THREE.Material>();
  const owned: { material: THREE.Material; transparent: boolean }[] = [];

  const swap = (source: THREE.Material) => {
    let clone = clones.get(source);
    if (!clone) {
      clone = registry.track(source.clone());
      clone.transparent = source.transparent;
      clones.set(source, clone);
      owned.push({ material: clone, transparent: source.transparent });
    }
    return clone;
  };

  facet.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.material = Array.isArray(child.material)
      ? child.material.map(swap)
      : swap(child.material);
  });

  return (opacity: number) => {
    // Fully faded means fully out of the frame: a transparent facet still
    // costs a draw call and still writes nothing useful.
    facet.visible = opacity > 0.004;
    if (!facet.visible) return;
    for (const { material, transparent } of owned) {
      const fading = transparent || opacity < 0.999;
      if (material.transparent !== fading) {
        material.transparent = fading;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
    }
  };
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** A folly's front at full measure, and the stone left either side of the
    reading column on it. */
const FACE = 11.93;
const MARGIN = 0.8;
/** Screen units of wall over the first line and under the last. */
const TOP_PAD = 2.2;
const FOOT_PAD = 2.8;
/** Screen units of wall under that again for the handle, on every folly
    that has somewhere to turn on to. */
const HANDLE_ROOM = 3.4;
/** How far a path runs on across the roof it arrives at. */
const LANDING = 3.2;
/** The cap's overhang on the flanks, which a path meets rather than the wall. */
const LIP = 0.3;

/** The root's turn when folly `i` is square to the eye. */
const readingTurn = (i: number) => -i * QUARTER;
/** The root's turn where the path from folly `i` to the next one joins. */
const joinTurn = (i: number) => -(i + JOIN) * QUARTER;
/** At this turn every block on the site is square to the world axes, so an
    axis-aligned box is an exact measure of any of them. */
const SQUARE_TURN = -Math.PI / 4;

/* Warm gold is reserved sitewide for exactly one fact: Lumen's real-time
   throughput. Every other metric takes its own channel colour. */
const ALERT_FACT = "Lumen Technologies";
const toneFor = (entry: Entry): "ml" | "systems" | "alert" =>
  entry.name === ALERT_FACT ? "alert" : entry.category;
const inkFor = (tone: "ml" | "systems" | "alert") =>
  tone === "ml" ? INK.ml : tone === "alert" ? INK.beacon : INK.systems;

/* Display type is set by what fits, not by what it was asked for. A name is
   one unbreakable word, so a column too narrow for it clips rather than wraps
   — and the wall's width is fixed. Measure the longest line as it will
   actually be painted, capitals and tracking included, and take the size down
   until it fits. */
function fitDisplayTo(lines: string[], size: number, width: number) {
  const widest = Math.max(
    ...lines.map((line) =>
      measureInline({
        text: line.toUpperCase(),
        face: "display",
        size,
        weight: 600,
        tracking: TRACK.title,
      })
    )
  );
  return widest <= width ? size : size * (width / widest);
}

/* A title in the house style: capitals, tracked wide, centred over its wall.
   Every folly opens with one, the way every section of the games' own site
   does. */
function title(lines: string[], size: number, column: number): Run {
  return {
    text: lines.join("\n"),
    face: "display",
    size: fitDisplayTo(lines, size, column * 0.97),
    weight: 600,
    tracking: TRACK.title,
    upper: true,
    align: "center",
    lineHeight: 1.12,
  };
}

/** The width of a front's reading column, in screen units. */
function contentWidth(view: View) {
  const face = FACE - MARGIN * 2;
  return view.narrow ? Math.max(4.6, Math.min(view.width - 2.4, face)) : face;
}

type Composed = { height: number };

type FacetSpec = {
  id: string;
  compose: (facet: THREE.Group, column: number, args: BuildArgs) => Composed;
};

type Folly = {
  group: THREE.Group;
  /** body, cap and plinth: what the layout measures and keeps apart */
  massing: THREE.Group;
  shape: FollyShape;
  /** folly-local z where the path from the folly above lands, on the -x flank */
  arriveZ?: number;
  arriveSide?: -1 | 1;
  /** the flank the path onward leaves from, and the folly-local z it leaves at */
  leave?: { side: -1 | 1; z: number };
};

type Bridge = {
  group: THREE.Group;
  /** the two runs that leave the roof and stop in the air */
  legs: THREE.Group;
  /** the stretch across the next roof that the legs appear to run on into */
  landing: THREE.Group;
  /** the traveler's way across, in the root's own frame */
  route: { from: THREE.Vector3; corner: THREE.Vector3; end: THREE.Vector3; landing: THREE.Vector3; landed: THREE.Vector3 };
};

/* ---------------- the site ---------------- */

export function buildMonument(args: Omit<BuildArgs, "hotspots">) {
  const hotspots: Hotspot[] = [];
  const full: BuildArgs = { ...args, hotspots };
  const { registry, palette, view } = full;

  const root = new THREE.Group();
  const column = contentWidth(view);
  const width = column + MARGIN * 2;
  const half = width / 2;

  const specs: FacetSpec[] = [
    { id: "top", compose: composeHero },
    { id: "work", compose: composeWork },
    { id: "experience", compose: composeExperience },
    { id: "skills", compose: composeSkills },
    { id: "contact", compose: composeContact },
  ];
  const last = specs.length - 1;

  /* Every inscription is composed first, against nothing, so its height is
     known before anything is built round it. The facet carries the wall's
     vertical stretch, so its children are laid out in plain screen units. */
  const facets = specs.map((spec) => {
    const facet = new THREE.Group();
    facet.scale.set(1, 1 / SCREEN_LIFT, 1);
    return { facet, height: spec.compose(facet, column, full).height };
  });

  const base: Site = { registry, palette, rand: seeded(1) };
  /** the colours a roof may take: one of the channels, lavender, or gold */
  const accents = [palette.ml, palette.systems, palette.connector, palette.sand];
  const stonesFor = (i: number): Stones => {
    const [stone, deep] = palette.sides.sea;
    const crowns = [palette.sand, palette.ml, palette.systems, palette.connector, palette.sand];
    return { stone, deep, accent: crowns[i % crowns.length], face: palette.faceSystems };
  };
  /** Paths are cream on top with sand sides, whichever follies they join. */
  const paving: Stones = { stone: palette.shelfDeep, deep: palette.shelfShadow, accent: palette.sand };

  // One authored footprint. Every chapter is a face of the same stepped keep.
  const radius = half + 3.6;
  const coreHalf = width * 0.31;
  const readingHeight = (i: number) =>
    (TOP_PAD + facets[i].height + FOOT_PAD + (i < last ? HANDLE_ROOM : 0)) / SCREEN_LIFT;
  const roofs = [0, -8, -17, -26, Math.min(-36, -readingHeight(0) - 4)];
  const radii = [radius, radius, radius - 0.8, radius + 0.6, radius + 3.6];
  const floor = Math.min(...roofs.map((roof, i) => roof - readingHeight(i))) - 2;

  /** Build folly `i`'s body with its roof at `roof`, turned so its front is
      square to the eye at its own reading angle, and hang its inscription. */
  const raise = (i: number, roof: number, depth: number): Folly => {
    // The entrance terrace carries the upper front wing. Their side walls
    // meet at one level instead of occupying the same plane below it.
    const bottom = i === 0 ? roofs[4] : floor;
    const shape: FollyShape = {
      width,
      depth,
      roof,
      bottom,
      sharedBase: true,
      archHeight: Math.max(0, Math.min(10, roof - readingHeight(i) - bottom - 2)) > 3.5
        ? Math.min(10, roof - readingHeight(i) - bottom - 2) : 0,
    };
    const group = new THREE.Group();
    group.rotation.y = Math.PI / 4 + i * QUARTER;
    const massing = follyMassing(base, stonesFor(i), shape);
    group.add(massing);
    hang(group, i, roof);
    root.add(group);
    return { group, massing, shape };
  };
  const hang = (group: THREE.Group, i: number, roof: number) => {
    const { facet } = facets[i];
    facet.position.set(0, roof - TOP_PAD / SCREEN_LIFT, 0);
    group.add(facet);
  };

  /** A point in a folly's own frame, in the root's frame. */
  const onFolly = (folly: Folly, x: number, y: number, z: number) => {
    root.rotation.y = 0;
    root.updateMatrixWorld(true);
    return folly.group.localToWorld(new THREE.Vector3(x, y, z));
  };

  /* One continuous stepped volume, with each wing overlapping the core.
     A common foot replaces the separate islands and hanging foundations. */
  const follies: Folly[] = roofs.map((roof, i) => {
    const folly = raise(i, roof, radii[i] - coreHalf + 0.25);
    const outward = new THREE.Vector3(0, 0, radii[i]).applyAxisAngle(Y_AXIS, folly.group.rotation.y);
    folly.group.position.copy(outward);
    return folly;
  });
  const structure = new THREE.Group();
  structure.name = "shared-monument-spine";
  structure.rotation.y = Math.PI / 4;
  root.add(structure);
  const coreTop = 4;
  structure.add(stoneBlock(registry, palette.systems,
    [coreHalf * 2, coreTop - floor, coreHalf * 2], [0, (coreTop + floor) / 2, 0]));
  structure.add(stoneBlock(registry, palette.shelf,
    [coreHalf * 2 + 0.6, 0.5, coreHalf * 2 + 0.6], [0, coreTop + 0.25, 0]));
  const crown = registry.model("pavilion", {
    stone: palette.sand, trim: palette.shelf, shadow: palette.sandDeep,
    accent: palette.ml, recess: palette.deep,
  });
  if (crown) {
    crown.scale.setScalar(1.7);
    crown.position.y = coreTop + 0.5;
    structure.add(crown);
  }

  // A single terraced limestone foundation, with an offset entrance apron.
  const baseHalf = radius + 2.3;
  structure.add(stoneBlock(registry, palette.rockDeep,
    [baseHalf * 2, 2.4, baseHalf * 2], [0, floor - 1.2, 0]));
  structure.add(stoneBlock(registry, palette.shelf,
    [baseHalf * 2 + 0.8, 0.5, baseHalf * 2 + 0.8], [0, floor - 0.25, 0]));
  structure.add(stoneBlock(registry, palette.rock,
    [baseHalf * 2 - 1.5, 1.4, baseHalf * 2 - 1.5], [0, floor - 3.1, 0]));
  const apronStart = baseHalf + 0.4;
  const apronEnd = radii[4] + 2.25;
  const apronLength = apronEnd - apronStart;
  structure.add(stoneBlock(registry, palette.shelfDeep,
    [width + 1.6, 2.4, apronLength], [0, floor - 1.2, (apronStart + apronEnd) / 2]));
  structure.add(stoneBlock(registry, palette.shelf,
    [width + 2.1, 0.5, apronLength], [0, floor - 0.25, (apronStart + apronEnd) / 2]));

  const bridges: Bridge[] = [];
  for (let i = 0; i < last; i += 1) {
    const from = follies[i];
    const next = follies[i + 1];
    const top = from.shape.roof + PATH.rise;
    const lower = next.shape.roof + PATH.rise;
    const leaveZ = -2;
    const nextZ = -2;
    from.leave = { side: 1, z: leaveZ };
    next.arriveZ = nextZ;
    next.arriveSide = 1;
    const start = onFolly(from, half - 1.3, top, leaveZ);
    const corner = onFolly(from, half + 0.5, top, leaveZ);
    const exterior = Math.max(radii[i], radii[i + 1]) + 2.2;
    const end = onFolly(from, exterior, top, leaveZ);
    const landing = onFolly(next, half - 1.3, lower, exterior - radii[i + 1]);
    const landed = onFolly(next, half - 1.3, lower, nextZ);
    const group = new THREE.Group();
    group.name = `terrace-stair-${i}`;
    const legs = new THREE.Group();
    const onto = new THREE.Group();
    group.add(legs, onto);
    pathRun(legs, base, paving, start, end);
    stairRun(group, base, paving, end, landing);
    pathRun(onto, base, paving, landing, landed);
    root.add(group);
    bridges.push({ group, legs, landing: onto, route: { from: start, corner, end, landing, landed } });
  }

  /* ---- dressing ----

     Only once every folly stands is anything grown on them, and each roof
     keeps open the strips its paths and its traveler need. */
  const pieces: THREE.Object3D[] = [];
  const owner = new Map<THREE.Object3D, number>();


  const starts: [number, number][] = [];
  const architecturalFronts: THREE.Group[] = [];

  follies.forEach((folly, i) => {
    folly.group.add(follyTrim({ registry, palette, rand: seeded(0x7472 + i * 6007) }, stonesFor(i), folly.shape));
    const front = follyFront({ registry, palette, rand: seeded(0x6672 + i * 6007) }, stonesFor(i), folly.shape);
    folly.group.add(front);
    architecturalFronts.push(front);
    const keepOut: KeepOut[] = [];
    const start: [number, number] =
      folly.arriveZ !== undefined
        ? [(folly.arriveSide ?? -1) * (half - LANDING), folly.arriveZ]
        : [-(folly.leave?.side ?? 1) * (half - 2.2), folly.leave?.z ?? -folly.shape.depth / 2];
    starts.push(start);
    if (folly.arriveZ !== undefined) {
      const side = folly.arriveSide ?? -1;
      keepOut.push({ from: [side * (half + LIP), folly.arriveZ], to: [side * (half - LANDING), folly.arriveZ], radius: 1.3 });
    }
    if (folly.leave) {
      const { side, z } = folly.leave;
      keepOut.push({ from: [side * (half - 1.4), z], to: [side * (half + LIP), z], radius: 1.3 });
      keepOut.push({ from: start, to: [side * (half - 1.4), z], radius: 1 });
    }
    const grown = dress(
      { registry, palette, rand: seeded(0x6472 + i * 104729) },
      stonesFor(i),
      accents,
      {
        ...folly.shape,
        tallSide: 0,
        keepOut,
        under: "shared",
      }
    );
    grown.forEach((piece) => {
      folly.group.add(piece);
      pieces.push(piece);
      owner.set(piece, i);
    });
  });

  /* Grown pieces may not stand in a path or in another folly. */
  root.rotation.y = SQUARE_TURN;
  root.updateMatrixWorld(true);
  const tiles = bridges.flatMap((bridge) =>
    [...bridge.legs.children, ...bridge.landing.children].map((tile) => new THREE.Box3().setFromObject(tile).expandByScalar(0.15))
  );

  const bodies = follies.map((folly) => new THREE.Box3().setFromObject(folly.massing).expandByScalar(0.5));
  pieces.forEach((piece) => {
    const area = new THREE.Box3().setFromObject(piece);
    if (tiles.some((tile) => tile.intersectsBox(area)) || bodies.some((body, k) => k !== owner.get(piece) && body.intersectsBox(area))) {
      piece.removeFromParent();
    }
  });

  const watches: Watch[] = [
    ...facets.map(({ facet }, i) => ({ turn: readingTurn(i), walls: [facet], paths: [] })),
    ...bridges.map((bridge, i) => ({ turn: joinTurn(i), walls: [], paths: [bridge.group] })),
  ];
  clearOf(root, pieces, watches);

  /* ---- the handles ----

     One on the front of every folly with a path onward, under its
     inscription: the crank that turns the site. It hangs in the wall's
     vertical stretch like the inscription does, so it is round on screen. */
  const handles = follies.slice(0, last).map((folly, i) => {
    const handle = crankHandle(base, stonesFor(i), accents[(i + 2) % accents.length]);
    const mount = new THREE.Group();
    mount.scale.set(1, 1 / SCREEN_LIFT, 1);
    const below = TOP_PAD + facets[i].height + (FOOT_PAD + HANDLE_ROOM) / 2 - 0.2;
    mount.position.set(0, folly.shape.roof - below / SCREEN_LIFT, 0.02);
    mount.add(handle.group);
    folly.group.add(mount);
    /* The first one says what it is for, once. Painted on the inscription,
       so it leaves the wall with the words. */
    if (i === 0) {
      const hint = wallInk(registry, {
        width: column,
        runs: [{ text: "Turn the handle to travel", size: TYPE.meta, color: INK.muted, align: "center", nowrap: true }],
      });
      hint.mesh.position.set(0, -(below - TOP_PAD + HANDLE_RADIUS + 0.55), 0.02);
      facets[0].facet.add(hint.mesh);
    }
    return handle;
  });

  /* Where a tap will send the traveler, ringed on the far roof while it
     waits at the end of a joined path. */
  const rings = bridges.map((bridge) => {
    const ring = destinationRing(base);
    ring.ring.position.copy(bridge.route.landed).add(new THREE.Vector3(0, 0.06, 0));
    ring.ring.visible = false;
    root.add(ring.ring);
    return ring;
  });

  /* ---- the traveler ----

     Stands on the roof of whichever folly is being read. Through a turn it
     walks to where the path leaves, waits for the path to join, crosses —
     stepping off the end of the run and onto the far roof, which at that
     angle is the same pixel — and walks on to stand on the next folly. */
  const walker = traveler(base);
  root.add(walker.group);
  const standing = follies.map((folly, i) =>
    i === 0 ? onFolly(folly, starts[0][0], folly.shape.roof + PATH.rise, starts[0][1]) : bridges[i - 1].route.landed
  );

  const spot = new THREE.Vector3();
  const heading = new THREE.Vector3();
  /** Walk `u` of the way along a polyline, leaving the place in `spot` and
      the direction of travel in `heading`. */
  const along = (points: THREE.Vector3[], u: number) => {
    const lengths = points.slice(1).map((p, k) => p.distanceTo(points[k]));
    let left = lengths.reduce((sum, l) => sum + l, 0) * THREE.MathUtils.clamp(u, 0, 1);
    for (let k = 0; k < lengths.length; k += 1) {
      if (left <= lengths[k] || k === lengths.length - 1) {
        const t = lengths[k] > 0 ? Math.min(1, left / lengths[k]) : 1;
        spot.lerpVectors(points[k], points[k + 1], t);
        heading.subVectors(points[k + 1], points[k]);
        return;
      }
      left -= lengths[k];
    }
  };

  let moving = false;
  const walk = (i: number, t: number) => {
    moving = false;
    if (i >= bridges.length) {
      const final = bridges[bridges.length - 1].route;
      spot.copy(final.landed);
      heading.subVectors(final.landed, final.landing);
    } else {
      const { route } = bridges[i];
      const crossing = route.from.distanceTo(route.corner) + route.corner.distanceTo(route.end) + route.end.distanceTo(route.landing);
      const stepping = route.landing.distanceTo(route.landed);
      const set = TURN.swing - 0.02;
      const off = TURN.swing + 0.02;
      const over = TURN.swing + TURN.hold - 0.02;
      if (t < set) {
        along([standing[i], route.from], (t - 0.04) / (set - 0.04));
        moving = t > 0.04;
      } else if (t < off) {
        along([route.from, route.corner], 0);
      } else if (t < over) {
        const s = ((t - off) / (over - off)) * (crossing + stepping);
        if (s < crossing) along([route.from, route.corner, route.end, route.landing], s / crossing);
        else along([route.landing, route.landed], (s - crossing) / stepping);
        moving = true;
      } else {
        along([route.landing, route.landed], 1);
      }
    }
    walker.group.position.copy(spot);
    if (heading.lengthSq() > 1e-6) walker.group.rotation.y = Math.atan2(heading.x, heading.z);
  };
  walk(0, 0);

  /* ---- what the camera needs ---- */

  root.rotation.y = 0;
  root.updateMatrixWorld(true);
  /** how much of the wall under the inscription the reader must see: the
      handle and a margin under it, where there is one */
  const room = (i: number) => (i < last ? FOOT_PAD + HANDLE_ROOM - 1.2 : 0);
  const inks = facets.map(({ facet }) => fadeable(facet, registry));
  const storeys: Storey[] = follies.map((folly, i) => ({
    id: specs[i].id,
    target: folly.group.localToWorld(
      new THREE.Vector3(0, folly.shape.roof - (TOP_PAD + (facets[i].height + room(i)) / 2) / SCREEN_LIFT, 0)
    ),
    fitWidth: column + (view.narrow ? 1.6 : 2.6),
    fitHeight: facets[i].height + room(i) + 1.4,
    facet: facets[i].facet,
    setInk: (opacity: number) => {
      inks[i](opacity);
      architecturalFronts[i].visible = opacity < 0.01;
    },
  }));

  const harbor = buildHarbor(registry, floor, radii[4]);
  root.add(harbor.group);
  harbor.update(0, true);

  /* Each turn reveals the complete monument and its shared foundation.
     Measure at the held angle, leaving the traveler out of the bounds. */
  walker.group.visible = false;
  bridges.forEach((_, i) => {
    root.rotation.y = joinTurn(i);
    root.updateMatrixWorld(true);
    const boxes = [root].map(screenBox);
    const minX = Math.min(...boxes.map((b) => b.minX));
    const maxX = Math.max(...boxes.map((b) => b.maxX));
    const minY = Math.min(...boxes.map((b) => b.minY));
    const maxY = Math.max(...boxes.map((b) => b.maxY));
    const depth =
      (follies[i].group.getWorldPosition(new THREE.Vector3()).dot(ISO_DIR) +
        follies[i + 1].group.getWorldPosition(new THREE.Vector3()).dot(ISO_DIR)) /
      2;
    const centre = SCREEN_RIGHT.clone()
      .multiplyScalar((minX + maxX) / 2)
      .addScaledVector(SCREEN_UP, (minY + maxY) / 2)
      .addScaledVector(ISO_DIR, depth)
      .applyAxisAngle(Y_AXIS, -joinTurn(i));
    storeys[i].onward = { centre, halfWidth: (maxX - minX) / 2, halfHeight: (maxY - minY) / 2 };
  });
  walker.group.visible = true;

  root.rotation.y = 0;
  root.updateMatrixWorld(true);
  return {
    root,
    storeys,
    hotspots,
    walk,
    /** the handle on each folly with a path onward: its crank, to turn, and
        what a press on it lands on */
    handles: handles.map(({ crank, hit }) => ({ crank, hit })),
    update: ({ elapsed, reduce, waiting }: StoreyContext) => {
      harbor.update(elapsed, reduce, facets.find(({ facet }) => facet.visible)?.facet);
      walker.figure.position.y = moving && !reduce ? Math.abs(Math.sin(elapsed * 9)) * 0.08 : 0;
      rings.forEach(({ ring, material }, i) => {
        ring.visible = i === waiting;
        if (!ring.visible) return;
        // A slow breath, the way the games mark a place you can go.
        const breath = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(elapsed * 3.2);
        ring.scale.setScalar(1 + breath * 0.22);
        material.opacity = 0.55 + 0.4 * (1 - breath);
      });
    },
  };
}

/* ---------------- the five faces ---------------- */

/* A face composes top-down from its own origin in plain screen units. Each
   piece is a plane of ink lying on the stone; the only solids are the
   controls, which have to be pressable. */
class Wall {
  private y = 0;

  constructor(
    private facet: THREE.Group,
    private width: number,
    private args: BuildArgs
  ) {}

  get height() {
    return -this.y;
  }

  /** A block of inscription, laid on the wall. */
  text(runs: Run[], gap = 0) {
    this.y -= gap;
    const block = wallInk(this.args.registry, { width: this.width, runs });
    block.mesh.position.set(0, this.y - block.height / 2, 0.02);
    this.facet.add(block.mesh);
    this.y -= block.height;
    return block;
  }

  /** A row of controls, standing a little proud of the stone. */
  row(controls: Control[], gap = 0) {
    this.y -= gap;
    const height = Math.max(...controls.map((c) => c.height));
    const span = controls.reduce((sum, c) => sum + c.width, 0) + 0.4 * (controls.length - 1);
    let x = Math.max(-this.width / 2, -span / 2);
    controls.forEach((control) => {
      control.group.position.set(x + control.width / 2, this.y - height / 2, 0.16);
      this.facet.add(control.group);
      x += control.width + 0.4;
    });
    this.y -= height;
  }
}

function composeHero(facet: THREE.Group, column: number, args: BuildArgs) {
  const { registry, palette, view } = args;
  const wall = new Wall(facet, column, args);

  /* The title screen, set the way the games set theirs: a short line of
     capitals underlined, then the name, everything centred. The line is one
     unbroken rule's worth, so on a narrow wall it is tightened and then
     scaled to fit rather than wrapped. */
  const kicker = "Applied ML × Software Engineering".toUpperCase();
  const kickerTracking = view.narrow ? 0.14 : 0.2;
  const kickerSize = TYPE.label * 1.1;
  const kickerWidth = measureInline({
    text: kicker,
    size: kickerSize,
    weight: 600,
    tracking: kickerTracking,
  });
  wall.text([
    {
      text: kicker,
      size: kickerSize * Math.min(1, (column * 0.97) / kickerWidth),
      weight: 600,
      tracking: kickerTracking,
      align: "center",
      underline: true,
      nowrap: true,
    },
  ]);

  const nameLines = view.narrow
    ? ["Nicolas", "Villegas-", "Kirchman"]
    : ["Nicolas", "Villegas-Kirchman"];
  wall.text([title(nameLines, TYPE.hero, column)], 1.0);

  wall.text(
    [
      {
        text: "Software engineer building the ML systems — and the infrastructure that runs them in production.",
        face: "display",
        size: TYPE.role,
        weight: 500,
        lineHeight: 1.3,
        align: "center",
      },
      {
        text: "Two disciplines, one practice: real-time data pipelines, diagnostic imaging systems, and the distributed infrastructure underneath both.",
        size: TYPE.bodyLg,
        color: INK.muted,
        lineHeight: 1.5,
        gapBefore: 0.34,
        align: "center",
      },
    ],
    0.8
  );

  wall.text(
    [
      { text: affiliation.school, face: "display", size: TYPE.title, weight: 700, align: "center" },
      {
        text: `${affiliation.degree} · ${affiliation.expected} · ${affiliation.gpa}`,
        size: TYPE.meta,
        weight: 600,
        color: INK.muted,
        gapBefore: 0.16,
        align: "center",
      },
      {
        text: `Coursework in ${affiliation.coursework}.`,
        size: TYPE.meta,
        color: INK.muted,
        gapBefore: 0.28,
        ruleBefore: true,
        align: "center",
      },
      {
        text: affiliation.recognition,
        size: TYPE.meta,
        weight: 700,
        color: INK.systems,
        gapBefore: 0.28,
        ruleBefore: true,
        align: "center",
      },
    ],
    1.1
  );

  wall.row(
    [
      controlBlock(
        registry,
        palette,
        { id: "cta-work", label: "View Selected Work", kind: "scroll", section: "work", tone: "primary" },
        args.hotspots
      ),
      controlBlock(
        registry,
        palette,
        { id: "cta-contact", label: "Get in Touch", kind: "scroll", section: "contact", tone: "ghost" },
        args.hotspots
      ),
    ],
    1.1
  );

  return { height: wall.height };
}

function composeWork(facet: THREE.Group, column: number, args: BuildArgs) {
  const wall = new Wall(facet, column, args);
  const featured = projects.filter((project) => project.featured);
  const secondary = projects.filter((project) => !project.featured);

  wall.text([title(["Selected Work"], TYPE.section, column)]);

  featured.forEach((project, index) => {
    wall.text(
      [
        { text: project.name, face: "display", size: TYPE.projectTitle, weight: 700 },
        {
          text: project.metric,
          size: TYPE.meta,
          weight: 700,
          color: inkFor(toneFor(project)),
          gapBefore: 0.16,
        },
        { text: project.summary, size: TYPE.body, gapBefore: 0.24 },
        { text: project.detail, size: TYPE.body, color: INK.muted, lineHeight: 1.5, gapBefore: 0.22 },
      ],
      index === 0 ? 1.0 : 1.3
    );
  });

  wall.text(
    [
      { text: "More Projects", face: "display", size: TYPE.projectTitle, weight: 700 },
      ...secondary.flatMap((project, index) => [
        {
          text: project.name,
          face: "display" as const,
          size: TYPE.title,
          weight: 700,
          gapBefore: 0.42,
          ruleBefore: index > 0,
        },
        {
          text: project.metric,
          size: TYPE.meta,
          weight: 700,
          color: inkFor(toneFor(project)),
          gapBefore: 0.14,
        },
        { text: project.summary, size: TYPE.meta, color: INK.muted, gapBefore: 0.12 },
      ]),
    ],
    1.4
  );

  return { height: wall.height };
}

function composeExperience(facet: THREE.Group, column: number, args: BuildArgs) {
  const wall = new Wall(facet, column, args);

  wall.text([title(["Experience"], TYPE.section, column)]);

  experience.forEach((entry, index) => {
    wall.text(
      [
        { text: entry.name, face: "display", size: TYPE.projectTitle, weight: 700 },
        {
          text: entry.metric,
          size: TYPE.meta,
          weight: 700,
          color: inkFor(toneFor(entry)),
          gapBefore: 0.16,
        },
        { text: entry.summary, size: TYPE.body, gapBefore: 0.22 },
        { text: entry.detail, size: TYPE.body, color: INK.muted, lineHeight: 1.5, gapBefore: 0.22 },
      ],
      index === 0 ? 1.0 : 1.3
    );
  });

  return { height: wall.height };
}

function composeSkills(facet: THREE.Group, column: number, args: BuildArgs) {
  const wall = new Wall(facet, column, args);
  const { view } = args;

  const capLines = view.narrow ? ["Technical", "Capabilities"] : ["Technical Capabilities"];
  wall.text([title(capLines, TYPE.section, column)]);

  wall.text(
    skillGroups.flatMap((group, index) => [
      {
        text: group.label,
        face: "display" as const,
        size: TYPE.title,
        weight: 700,
        gapBefore: index === 0 ? 0 : 0.46,
        ruleBefore: index > 0,
      },
      {
        text: group.items.join(" · "),
        size: TYPE.body,
        color: INK.muted,
        lineHeight: 1.5,
        gapBefore: 0.16,
      },
    ]),
    1.1
  );

  return { height: wall.height };
}

function composeContact(facet: THREE.Group, column: number, args: BuildArgs) {
  const { registry, palette } = args;
  const wall = new Wall(facet, column, args);

  wall.text([title(["Get in touch"], TYPE.section, column)]);

  wall.text(
    [
      {
        text: "Open to conversations about applied ML, systems engineering, or roles where both meet.",
        size: TYPE.bodyLg,
        color: INK.muted,
        lineHeight: 1.45,
      },
    ],
    1.0
  );

  const links: Control[] = [
    { id: "contact-email", label: contact.email, href: `mailto:${contact.email}` },
    { id: "contact-linkedin", label: contact.linkedinLabel, href: contact.linkedin },
    { id: "contact-github", label: contact.githubLabel, href: contact.github },
  ].map((link) =>
    controlBlock(
      registry,
      palette,
      { id: link.id, label: link.label, kind: "link", href: link.href, tone: "pill" },
      args.hotspots
    )
  );

  // Three pills rarely fit one line of a face; stack them in rows it can hold.
  let line: Control[] = [];
  let width = 0;
  links.forEach((control) => {
    if (line.length && width + control.width + 0.4 > column) {
      wall.row(line, 0.8);
      line = [];
      width = 0;
    }
    line.push(control);
    width += control.width + 0.4;
  });
  if (line.length) wall.row(line, 0.8);

  wall.text(
    [
      {
        text: "Stack — Python · JavaScript · TypeScript · React · Next.js · Django · FastAPI · PyTorch · TensorFlow · PostgreSQL · Docker · Terraform · AWS · Kafka",
        size: TYPE.meta,
        color: INK.muted,
        lineHeight: 1.6,
      },
    ],
    1.2
  );

  return { height: wall.height };
}
