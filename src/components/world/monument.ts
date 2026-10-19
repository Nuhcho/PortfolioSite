import * as THREE from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { affiliation, contact, experience, projects, skillGroups, type Entry } from "@/data/content";
import { SCREEN_LIFT, SCREEN_UP } from "./layout";
import { controlBlock, wallInk, type Control, type Hotspot } from "./parts";
import { INK, ISO_DIR, Registry, TYPE, type Palette } from "./theme";
import { measureInline, type Run } from "./text";

/* The page is one monument, and scrolling walks you down it.
 *
 * An octagonal keep. Each storey carries one section of the portfolio,
 * inscribed on whichever of the shaft's eight faces is turned flat to the eye,
 * and each storey's face is a quarter further round than the one above — so
 * descending the monument and turning it are the same gesture.
 *
 * The copy is painted straight onto the stone. There is no panel, no bay and
 * no frame: a transparent plane of glyphs lying on the wall's own surface,
 * which is what lettering on a wall actually is. Earlier passes tried to build
 * "embedded" out of geometry — a recess, a floor, a jamb, a band — and each
 * sheet of pastel a fraction of a unit from the last added haze rather than
 * depth. Six of them stacked read as mush. The flattest answer is the literal
 * one.
 *
 * The camera is locked to true isometric, and two things follow.
 *
 * 1. A *vertical* wall whose outward normal points horizontally at the camera
 *    moves purely across the screen as you travel along it — not one pixel up
 *    or down. Baselines stay level with no shear and no pre-distortion, only a
 *    stretch up the wall's own height, which each face group carries as a
 *    scale. Everything inside is then laid out in plain screen units. A plane
 *    square to the view axis reads too, but it is tilted, so it can only ever
 *    stand off the tower's corner as a slab in front of it.
 *
 * 2. Translating along (1,1,1) changes depth without moving a pixel. Every
 *    storey carries a flight cut in two and pushed apart along that axis: at
 *    that storey's own quarter the halves land on the same pixels and the
 *    stair is whole, and at any other angle it is two pieces of stone that do
 *    not meet.
 */

export type StoreyContext = {
  elapsed: number;
  dt: number;
  reduce: boolean;
};

export type Storey = {
  /** matches the mirror's section id, so `#work` lands on the work storey */
  id: string;
  /** where the camera looks when this storey is square to the eye */
  target: THREE.Vector3;
  fitWidth: number;
  fitHeight: number;
  /** the group carrying this storey's inscription — everything that must be
      off the wall before the keep turns */
  facet: THREE.Group;
  /** fade this storey's inscription, 1 readable to 0 gone */
  setInk: (opacity: number) => void;
};

export type View = { width: number; height: number; narrow: boolean };

export type BuildArgs = {
  registry: Registry;
  palette: Palette;
  font: Font;
  view: View;
  hotspots: Hotspot[];
};

/** Radians of tower turned per storey descended. */
export const QUARTER = Math.PI / 2;

/* An inscription lies flat on its wall, so the instant that wall swings off
 * square the type shears with it — the one thing on this keep that cannot be
 * allowed to stay on screen through a turn. Each facet therefore owns private
 * copies of every material it uses: the registry shares materials across the
 * whole tower by design, and fading a shared one would take four other
 * storeys down with it. Clones are tracked, so teardown still disposes them. */
function fadeable(facet: THREE.Group, registry: Registry) {
  const clones = new Map<THREE.Material, THREE.Material>();
  const owned: THREE.Material[] = [];

  const swap = (source: THREE.Material) => {
    let clone = clones.get(source);
    if (!clone) {
      clone = registry.track(source.clone());
      clone.transparent = true;
      clones.set(source, clone);
      owned.push(clone);
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
    for (let i = 0; i < owned.length; i += 1) owned[i].opacity = opacity;
  };
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/* Eight sides, not four. A square prism turned to put one face flat to the eye
   puts its neighbours exactly edge-on: they project to nothing and the tower
   reads as a flat rectangle. An octagon's neighbours sit at 45° and recede, so
   the shaft stays a solid you can see around. */
const OCT = {
  circum: (apothem: number) => apothem / Math.cos(Math.PI / 8),
  side: (apothem: number) => 2 * (apothem / Math.cos(Math.PI / 8)) * Math.sin(Math.PI / 8),
  /** bearing of face `k`'s outward normal, with face 0 flat to the eye */
  bearing: (k: number) => (Math.PI * (k + 1)) / 4,
};

/* Five storeys over four quarters means the last comes back round to the
   first one's face, so the index wraps. */
const faceIndexOf = (storey: number) => (2 * storey) % 8;
const bearingOf = (storey: number) => OCT.bearing(faceIndexOf(storey));
const normalAt = (bearing: number) =>
  new THREE.Vector3(Math.sin(bearing), 0, Math.cos(bearing));

/* The shaft's flat-to-centre distance, sized from the column it has to carry.
   An octagon's face is only 0.765 of that distance while its silhouette is
   2.17 of it, so a face wide enough for a reading measure makes a tower about
   three times as wide — which bleeds a little past the frame, and should: the
   flanking faces still fill the picture either side of the reading one.

   It does not batter. Every horizontal surface in an isometric picture sweeps
   a vertical band more than half its own width tall, so a cornice or a setback
   hangs straight across the wall above or below it whatever its depth. A
   battered tower cannot have a readable wall on it. */
const SHAFT_APOTHEM = 14.4;
/** stone left either side of the reading column */
const MARGIN = 0.8;

/* Warm gold is reserved sitewide for exactly one fact: Lumen's real-time
   throughput. Every other metric takes its own channel colour. */
const ALERT_FACT = "Lumen Technologies";
const toneFor = (entry: Entry): "ml" | "systems" | "alert" =>
  entry.name === ALERT_FACT ? "alert" : entry.category;
const inkFor = (tone: "ml" | "systems" | "alert") =>
  tone === "ml" ? INK.ml : tone === "alert" ? INK.beacon : INK.systems;

/** One course of the keep per storey, each a different stone. */
const COURSE = ["sea", "leaf", "coral", "sand", "sea"] as const;
const storeyTone = (storey: number) => COURSE[storey % COURSE.length];

/* Display type is set by what fits, not by what it was asked for. A name is
   one unbreakable word, so a column too narrow for it clips rather than wraps
   — and the wall's width is fixed by the shaft. Measure the longest line and
   take the size down until it fits. */
function fitDisplayTo(lines: string[], size: number, width: number) {
  const widest = Math.max(
    ...lines.map((line) => measureInline({ text: line, face: "display", size, weight: 600 }))
  );
  return widest <= width ? size : size * (width / widest);
}

/** The width of a face's reading column, in screen units. */
function contentWidth(view: View) {
  const face = OCT.side(SHAFT_APOTHEM) - MARGIN * 2;
  return view.narrow ? Math.max(4.6, Math.min(view.width - 2.4, face)) : face;
}

/* A face's own frame.
 *
 * Local X runs across the wall, local Y up it, local Z straight out of it. One
 * unit of local X is already one unit of screen width; one unit of local Y is
 * 0.8165 of one, so the group carries that as a scale and every child is laid
 * out in plain screen units. */
function faceFrame(storey: number, worldY: number) {
  const bearing = bearingOf(storey);
  const group = new THREE.Group();
  group.quaternion.setFromAxisAngle(Y_AXIS, bearing);
  group.scale.set(1, 1 / SCREEN_LIFT, 1);
  group.position.copy(normalAt(bearing).multiplyScalar(SHAFT_APOTHEM)).setY(worldY);
  return group;
}

/* The split that makes a cut stair whole again, in a facet's own coordinates.
 *
 * Translating along ISO_DIR is the one move that changes depth without moving
 * a pixel, so it is the only axis a flight can be cut along and still read as
 * one run. A facet is not in world axes, though: it stands at its own bearing
 * and carries a 1/SCREEN_LIFT scale on Y so its children can be laid out in
 * plain screen units. Both have to be undone for the offset to come out along
 * the view axis once the frame has had its way with it.
 *
 * The bearing term is constant across storeys and that is not a coincidence:
 * a storey's facet bearing is `OCT.bearing(0) + i·QUARTER` and the keep is
 * turned by `-i·QUARTER` when that storey is square, so the two cancel and
 * every reading facet stands in the same place. Derived here rather than
 * written down, so it survives a change to the camera.
 *
 * This was the bug that kept the paradox from ever reading: the flight was
 * pushed along the facet's local Z — the wall's own normal — which is the
 * horizontal projection of the view axis, not the view axis. The difference
 * is pure screen Y, so the two halves sat a visible step apart at every
 * angle, including the one where they were supposed to fuse, and the device
 * read as rubble rather than as a stair. */
const VIEW_SPLIT = ISO_DIR.clone()
  .applyAxisAngle(Y_AXIS, -OCT.bearing(0))
  .multiply(new THREE.Vector3(1, SCREEN_LIFT, 1))
  .normalize();

/* A flight cut in two and pushed apart along the view axis. On screen the two
   halves meet tread to tread and the stair is one unbroken run; in the world
   they are metres apart, and the moment the tower turns off this storey's
   quarter the join tears open. It comes toward the eye rather than away: the
   shaft fills the space behind, and a flight pushed back into it is simply
   swallowed. */
function brokenFlight(
  registry: Registry,
  materials: [THREE.Material, THREE.Material],
  spec: { steps: number; run: number; rise: number; tread: number; split: number }
) {
  const group = new THREE.Group();
  const geometry = registry.geometry(
    new THREE.BoxGeometry(spec.tread, spec.rise * 2.4, spec.tread)
  );
  for (let i = 0; i < spec.steps; i += 1) {
    const mesh = new THREE.Mesh(geometry, materials[i % 2]);
    mesh.position.set(i * spec.run, i * spec.rise, 0);
    // The far half is carried toward the eye along the view axis, so it lands
    // back on the pixels the near half left off at.
    if (i >= spec.steps / 2) mesh.position.addScaledVector(VIEW_SPLIT, spec.split);
    group.add(mesh);
  }
  return group;
}

/* ---------------- the architecture ---------------- */

/* Monument Valley's vocabulary, placed where it cannot cover a word.
 *
 * A tower standing on one of the shaft's four axis bearings spans screen x
 * from 5.94 units out to 14.42, and the reading wall spans only ±5.96 — so
 * four of them frame the copy edge to edge and never cross it at any height,
 * whatever they are built of. Two of the four are also far behind the wall in
 * depth. That geometry is the whole licence for building anything here at all;
 * every earlier attempt to put architecture near the copy ended up on top of
 * it.
 *
 * They splay as they descend rather than batter in place: a wider tower has to
 * stand further out to keep its inner edge off the wall, and `2w + 8.6` is
 * exactly that distance. */
const CORNER_BEARINGS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const cornerRadius = (half: number) => 2 * half + 8.6;

function box(
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

/* A corner tower, tiled in short courses rather than run as one prism.
 *
 * The scale this has to work at is the viewport's, not the storey's. A storey
 * is twenty-five world units of content and the frame holds about fifteen
 * screen units, so a tower built as one box per storey is never seen whole —
 * it reads as a flat band of colour, which is exactly what the first attempt
 * did. Tiled at eight units a course, two and a half courses stand in frame at
 * once, with their cornices, their openings and their shadow lines, and the
 * thing reads as masonry.
 */
const COURSE_HEIGHT = 8;

function cornerTower(
  registry: Registry,
  palette: Palette,
  spec: {
    bearing: number;
    top: number;
    bottom: number;
    half: number;
    stone: THREE.Material;
    deep: THREE.Material;
    crown: boolean;
  }
) {
  const group = new THREE.Group();
  const { half, top, bottom } = spec;

  group.quaternion.setFromAxisAngle(Y_AXIS, spec.bearing);
  group.position.copy(normalAt(spec.bearing).multiplyScalar(cornerRadius(half)));

  const courses = Math.max(1, Math.round((top - bottom) / COURSE_HEIGHT));
  const run = (top - bottom) / courses;

  for (let c = 0; c < courses; c += 1) {
    const head = top - c * run;
    const foot = head - run;

    box(group, registry, spec.stone, [half * 2, run, half * 2], [0, (head + foot) / 2, 0]);
    // The cornice that lands on every course, and the shadow line under it.
    box(group, registry, spec.deep, [half * 2 + 0.55, 0.9, half * 2 + 0.55], [0, foot + 0.45, 0]);
    box(group, registry, palette.shelfDeep, [half * 2 + 0.2, 0.3, half * 2 + 0.2], [0, foot + 1.1, 0]);

    /* An opening in every other course, cut on the two sides that face the
       eye. Recessed, so it is a hole in the stone rather than a sticker. */
    if (c % 2 === 1) {
      const w = half * 0.5;
      const h = run * 0.34;
      const y = (head + foot) / 2 + run * 0.08;
      box(group, registry, palette.deep, [w, h, 0.5], [0, y, half - 0.24]);
      box(group, registry, palette.deep, [0.5, h, w], [half - 0.24, y, 0]);
    }
  }

  if (spec.crown) {
    // Merlons, in the one place on the monument where a silhouette can bite
    // into the sky without crossing anything.
    const merlon = half * 0.44;
    [-1, 1].forEach((sx) =>
      [-1, 1].forEach((sz) =>
        box(
          group,
          registry,
          spec.deep,
          [merlon, 2.1, merlon],
          [sx * (half - merlon / 2), top + 1.05, sz * (half - merlon / 2)]
        )
      )
    );
    box(group, registry, palette.shelf, [half * 1.3, 1.1, half * 1.3], [0, top + 0.55, 0]);
    box(group, registry, palette.beacon, [merlon, merlon, merlon], [0, top + 2.6, 0]);
  }

  return group;
}

/** A beam running from a corner tower in to the shaft. */
function buttress(
  registry: Registry,
  material: THREE.Material,
  spec: { bearing: number; y: number; half: number }
) {
  const group = new THREE.Group();
  group.quaternion.setFromAxisAngle(Y_AXIS, spec.bearing);
  const reach = cornerRadius(spec.half) - spec.half;
  box(group, registry, material, [1.5, 1.1, reach], [0, spec.y, reach / 2]);
  box(group, registry, material, [2.3, 1.6, 1.4], [0, spec.y - 1.0, reach - 0.7]);
  return group;
}

/** A portal cut between two posts: the simplest real architecture there is. */
function archway(
  registry: Registry,
  palette: Palette,
  spec: { bearing: number; y: number; span: number; height: number; posts: [THREE.Material, THREE.Material] }
) {
  const group = new THREE.Group();
  group.quaternion.setFromAxisAngle(Y_AXIS, spec.bearing);
  group.position.copy(normalAt(spec.bearing).multiplyScalar(spec.span * 1.45));
  const half = spec.span / 2;
  box(group, registry, spec.posts[0], [0.9, spec.height, 0.9], [-half, spec.y + spec.height / 2, 0]);
  box(group, registry, spec.posts[1], [0.9, spec.height, 0.9], [half, spec.y + spec.height / 2, 0]);
  box(
    group,
    registry,
    palette.shelfDeep,
    [spec.span + 1.9, 0.9, 1.3],
    [0, spec.y + spec.height + 0.45, 0]
  );
  return group;
}

type Composed = { height: number };

type FacetSpec = {
  id: string;
  compose: (facet: THREE.Group, column: number, args: BuildArgs) => Composed;
};

type Built = {
  storey: Storey;
  worldY: number;
  contentHeight: number;
};

/* ---------------- the monument ---------------- */

export function buildMonument(args: Omit<BuildArgs, "hotspots">) {
  const hotspots: Hotspot[] = [];
  const full: BuildArgs = { ...args, hotspots };
  const { registry, palette, view } = full;

  const root = new THREE.Group();
  const column = contentWidth(view);

  const specs: FacetSpec[] = [
    { id: "top", compose: composeHero },
    { id: "work", compose: composeWork },
    { id: "experience", compose: composeExperience },
    { id: "skills", compose: composeSkills },
    { id: "contact", compose: composeContact },
  ];

  /* Screen units of plain shaft between one reading and the next — the run of
     stone that tells you it is a tower you are going down. */
  const STOREY_GAP = 8;
  const built: Built[] = [];
  let screenDrop = 0;

  specs.forEach((spec, i) => {
    const probe = new THREE.Group();
    const composed = spec.compose(probe, column, full);

    if (i > 0) screenDrop += STOREY_GAP + composed.height / 2;
    const worldY = -screenDrop / SCREEN_LIFT;

    const facet = faceFrame(i, worldY);
    while (probe.children.length) facet.add(probe.children[0]);
    root.add(facet);

    /* What the camera holds: the wall's own centre, half the content's height
       below its head. The wall stands clear of the axis, and that does move it
       on screen — out of a wall is 0.577 down the picture — so unlike a
       view-axis offset it has to be counted. */
    const target = normalAt(bearingOf(0))
      .multiplyScalar(SHAFT_APOTHEM)
      .setY(worldY)
      .addScaledVector(SCREEN_UP, -composed.height / 2);

    built.push({
      worldY,
      contentHeight: composed.height,
      storey: {
        id: spec.id,
        target,
        fitWidth: column + (view.narrow ? 1.6 : 2.6),
        fitHeight: composed.height + 1.4,
        facet,
        setInk: fadeable(facet, registry),
      },
    });

    screenDrop += composed.height / 2;
  });

  /* ---------------- the shaft ---------------- */

  /* One storey's stone ends exactly where the next one's begins, computed from
     the storeys' real positions rather than from their own heights: a storey is
     placed by its content, so sizing its prism from that content leaves gaps
     wherever two neighbours differ in length — and a gap exposes the underside
     of the prism above, which sweeps eight screen units down across the wall
     below it. */
  const spans = built.map((entry, i) => ({
    top: entry.worldY + 2.2 / SCREEN_LIFT,
    bottom:
      i + 1 < built.length
        ? built[i + 1].worldY + 2.2 / SCREEN_LIFT
        : entry.worldY - (entry.contentHeight + STOREY_GAP) / SCREEN_LIFT,
  }));

  built.forEach((entry, i) => {
    const { top, bottom } = spans[i];
    const height = top - bottom;
    const midY = (top + bottom) / 2;
    const [stone, deep] = palette.sides[storeyTone(i)];

    /* The shaft is cut from the one pale stone every inscription is measured
       against, so the reading face needs nothing laid over it. The other seven
       faces are faced in this storey's own colour, standing a little proud —
       which leaves the reading face the shallowest recess in the tower without
       a single extra sheet in front of the words. */
    const core = new THREE.Mesh(
      registry.geometry(
        new THREE.CylinderGeometry(
          OCT.circum(SHAFT_APOTHEM),
          OCT.circum(SHAFT_APOTHEM),
          height,
          8
        )
      ),
      palette.shelf
    );
    core.rotation.y = Math.PI / 8;
    core.position.y = midY;
    root.add(core);

    const faceWidth = OCT.side(SHAFT_APOTHEM) + 0.2;
    for (let k = 0; k < 8; k += 1) {
      if (k === faceIndexOf(i)) continue;
      const bearing = OCT.bearing(k);
      const panel = new THREE.Mesh(
        registry.geometry(new THREE.BoxGeometry(faceWidth, height, 0.7)),
        k % 2 === 0 ? deep : stone
      );
      panel.quaternion.setFromAxisAngle(Y_AXIS, bearing);
      panel.position.copy(normalAt(bearing).multiplyScalar(SHAFT_APOTHEM + 0.2));
      panel.position.y = midY;
      root.add(panel);
    }

    /* The joint between one storey's stone and the next, cut as a groove. A
       recessed ring can never overhang the wall below it; a proud one always
       does. */
    const joint = new THREE.Mesh(
      registry.geometry(
        new THREE.CylinderGeometry(OCT.circum(SHAFT_APOTHEM - 0.5), OCT.circum(SHAFT_APOTHEM - 0.5), 0.9, 8)
      ),
      deep
    );
    joint.rotation.y = Math.PI / 8;
    joint.position.y = bottom + 0.45;
    root.add(joint);

    /* The four corner towers, splaying a little further out at every storey
       they fall, each tied back to the keep by a buttress at the storey line. */
    const half = 2.9 + i * 0.16;
    CORNER_BEARINGS.forEach((bearing, corner) => {
      root.add(
        cornerTower(registry, palette, {
          bearing,
          top,
          bottom,
          half,
          stone: corner % 2 === 0 ? stone : deep,
          deep: palette.shelfDeep,
          crown: i === 0,
        })
      );
      // A buttress at every course, not only at the storey line, so the keep
      // and its towers read as one piece of building at any height.
      const courses = Math.max(1, Math.round((top - bottom) / COURSE_HEIGHT));
      for (let c = 1; c <= courses; c += 1) {
        root.add(
          buttress(registry, corner % 2 === 0 ? deep : stone, {
            bearing,
            y: top - (c * (top - bottom)) / courses + 1.5,
            half,
          })
        );
      }
      if (i === built.length - 1) {
        root.add(
          archway(registry, palette, {
            bearing,
            y: bottom - 3.4,
            span: half * 1.5,
            height: 5.4,
            posts: [stone, deep],
          })
        );
      }
    });
  });

  /* The crown above everything, and the foot it all stands on — both flush
     with the shaft, because a wider one would hang across the wall below. */
  const crown = new THREE.Group();
  crown.position.y = built[0].worldY + 2.2 / SCREEN_LIFT;
  root.add(crown);
  const lantern = new THREE.Mesh(
    registry.geometry(
      new THREE.CylinderGeometry(
        OCT.circum(SHAFT_APOTHEM * 0.46),
        OCT.circum(SHAFT_APOTHEM),
        4.2,
        8
      )
    ),
    palette.shelfDeep
  );
  lantern.rotation.y = Math.PI / 8;
  lantern.position.y = 2.1;
  crown.add(lantern);
  const beacon = new THREE.Mesh(
    registry.geometry(new THREE.IcosahedronGeometry(1.0, 0)),
    palette.beacon
  );
  beacon.position.set(0, 5.1, 0);
  crown.add(beacon);

  const last = built[built.length - 1];
  const foot = new THREE.Mesh(
    registry.geometry(
      new THREE.CylinderGeometry(OCT.circum(SHAFT_APOTHEM), OCT.circum(SHAFT_APOTHEM), 6, 8)
    ),
    palette.deep
  );
  foot.rotation.y = Math.PI / 8;
  foot.position.y =
    last.worldY - (last.contentHeight + STOREY_GAP) / SCREEN_LIFT - 3;
  root.add(foot);

  /* The flight that only exists at each quarter, climbing the wall out of the
     storey below. */
  built.forEach((entry, i) => {
    /* Big enough to be architecture. The flight was sized when it lived at
       reading distance, where seven small treads below the copy were all
       there was room for; the turn now happens pulled back, and at that
       distance the old flight was gravel. It starts outboard of the reading
       face and climbs in toward it, so its lower half is clear of the shaft
       and tears open against open sky — the one moment the trick is on
       show. */
    const flight = brokenFlight(
      registry,
      [palette.ml, palette.systems],
      { steps: 11, run: 1.34, rise: 0.74, tread: 1.5, split: 9.5 }
    );
    const frame = faceFrame(i, entry.worldY);
    frame.add(flight);
    flight.position.set(
      -OCT.side(SHAFT_APOTHEM) / 2 - 4.4,
      -entry.contentHeight - 2.6,
      0.6
    );
    root.add(frame);
  });

  root.updateMatrixWorld(true);
  return {
    root,
    storeys: built.map((entry) => entry.storey),
    hotspots,
    update: ({ elapsed, reduce }: StoreyContext) => {
      if (reduce) return;
      beacon.position.y = 5.1 + Math.sin(elapsed * 0.6) * 0.24;
      beacon.rotation.y = elapsed * 0.2;
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

  const nameLines = view.narrow
    ? ["Nicolas", "Villegas-", "Kirchman"]
    : ["Nicolas", "Villegas-Kirchman"];
  wall.text([
    {
      text: nameLines.join("\n"),
      face: "display",
      size: fitDisplayTo(nameLines, TYPE.hero, column * 0.97),
      weight: 600,
      lineHeight: 1.08,
    },
  ]);

  wall.text(
    [
      {
        text: "Software engineer building the ML systems — and the infrastructure that runs them in production.",
        face: "display",
        size: TYPE.role,
        weight: 600,
        lineHeight: 1.26,
      },
      {
        text: "Two disciplines, one practice: real-time data pipelines, diagnostic imaging systems, and the distributed infrastructure underneath both.",
        size: TYPE.bodyLg,
        color: INK.muted,
        lineHeight: 1.48,
        gapBefore: 0.34,
      },
    ],
    0.9
  );

  wall.text(
    [
      { text: affiliation.school, face: "display", size: TYPE.title, weight: 600 },
      {
        text: `${affiliation.degree} · ${affiliation.expected} · ${affiliation.gpa}`,
        size: TYPE.meta,
        weight: 700,
        color: INK.muted,
        gapBefore: 0.16,
      },
      {
        text: `Coursework in ${affiliation.coursework}.`,
        size: TYPE.meta,
        color: INK.muted,
        gapBefore: 0.28,
        ruleBefore: true,
      },
      {
        text: affiliation.recognition,
        size: TYPE.meta,
        weight: 700,
        color: INK.systems,
        gapBefore: 0.28,
        ruleBefore: true,
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

  wall.text([
    {
      text: "Selected Work",
      face: "display",
      size: fitDisplayTo(["Selected Work"], TYPE.section, column * 0.97),
      weight: 600,
    },
  ]);

  featured.forEach((project, index) => {
    wall.text(
      [
        { text: project.name, face: "display", size: TYPE.projectTitle, weight: 600 },
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
      { text: "More Projects", face: "display", size: TYPE.title, weight: 600, color: INK.muted },
      ...secondary.flatMap((project, index) => [
        {
          text: project.name,
          face: "display" as const,
          size: TYPE.title,
          weight: 600,
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

  wall.text([
    {
      text: "Experience",
      face: "display",
      size: fitDisplayTo(["Experience"], TYPE.section, column * 0.97),
      weight: 600,
    },
  ]);

  experience.forEach((entry, index) => {
    wall.text(
      [
        { text: entry.name, face: "display", size: TYPE.title, weight: 600 },
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
  wall.text([
    {
      text: capLines.join("\n"),
      face: "display",
      size: fitDisplayTo(capLines, TYPE.section, column * 0.97),
      weight: 600,
      lineHeight: 1.1,
    },
  ]);

  wall.text(
    skillGroups.flatMap((group, index) => [
      {
        text: group.label,
        face: "display" as const,
        size: TYPE.title,
        weight: 600,
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

  wall.text([
    {
      text: "Get in touch",
      face: "display",
      size: fitDisplayTo(["Get in touch"], TYPE.section, column * 0.97),
      weight: 600,
    },
  ]);

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
