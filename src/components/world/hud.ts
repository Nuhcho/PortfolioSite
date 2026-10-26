import * as THREE from "three";
import { COLOR, INK, Registry, TRACK, TYPE } from "./theme";
import { measureInline, paintText } from "./text";
import type { Hotspot } from "./parts";

/* The navigation is drawn by three.js too, in a second scene pinned to the
   viewport in CSS-pixel units. It is the one part of the world that does not
   travel.

   It is Monument Valley's own: a slim paper bar with a soft shadow under it,
   the section names in tracked capitals at 45% until they are the one you
   are on, and beside each a hexagon that turns a quarter and fills — the
   mark their side rail uses for the same job.

   Below the narrow breakpoint the labels drop away and only the hexagons
   remain, with the current section named on a second row of the bar — a
   hamburger would be a second navigation pattern for the same five links. */

const SCALE = 54; // CSS px per HUD unit, matching the world's desktop framing

export type HudSection = { id: string; label: string };

export const HUD_SECTIONS: HudSection[] = [
  { id: "top", label: "Home" },
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "skills", label: "Capabilities" },
  { id: "contact", label: "Contact" },
];

type Mark = {
  group: THREE.Group;
  hex: THREE.Group;
  fill: THREE.MeshBasicMaterial;
  outline: THREE.MeshBasicMaterial;
  label?: THREE.Mesh;
  labelWidth: number;
  width: number;
  hover: number;
  active: number;
};

function paintedPlane(registry: Registry, spec: Parameters<typeof paintText>[0]) {
  const painted = paintText(spec);
  registry.track(painted.texture);
  const mesh = new THREE.Mesh(
    registry.geometry(new THREE.PlaneGeometry(painted.width, painted.height)),
    registry.track(
      new THREE.MeshBasicMaterial({ map: painted.texture, transparent: true, depthWrite: false })
    )
  );
  return { mesh, width: painted.width, height: painted.height };
}

/** One line of tracked capitals, cut to its own width. */
function capsPlane(registry: Registry, text: string, color: string, size = TYPE.label) {
  const upper = text.toUpperCase();
  return paintedPlane(registry, {
    // Measure the cased string that is actually painted, not the source
    // label — uppercasing is what decides the width.
    width: measureInline({ text: upper, size, weight: 700, tracking: TRACK.label }) + 0.12,
    runs: [
      {
        text: upper,
        size,
        weight: 700,
        tracking: TRACK.label,
        color,
        align: "center",
        nowrap: true,
      },
    ],
  });
}

/* The bar's soft shadow, painted once: their bar casts 15px of charcoal at
   20%, fading to nothing. */
function shadowTexture(registry: Registry) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, "rgba(58, 50, 64, 0.08)");
    gradient.addColorStop(1, "rgba(34, 31, 32, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return registry.track(texture);
}

/* The bar's own depth order, in HUD units: the slab behind, the marks on it,
   and the hit planes a hair in front of those. All of it in front of the
   camera, which is the part that was wrong. */
const HUD_EYE = 10;
const HEX_RADIUS = 0.13;
/** A hexagon's turn when its section is current: a quarter, as on their rail. */
const HEX_TURN = Math.PI / 2;

export function buildHud(registry: Registry) {
  const scene = new THREE.Scene();
  /* The camera stands back from the bar rather than inside it, and this is
     what makes the navigation clickable at all.

     `Raycaster.setFromCamera` starts an orthographic ray not at the camera
     but at the plane the projection matrix calls the middle of its depth
     range — `projectionMatrix.elements[14]`, which for a frustum of
     (-50, 50) about the origin is exactly z = 0 — and then fires it along
     -Z. Every piece of this bar sits at z +0.4 or +0.5, which is *behind*
     that origin, so every intersection came out at a negative distance and
     was discarded.

     Pushing the eye to +10 with a near plane in front of it puts the ray
     origin at z 9.9 and the whole bar in front of it. Nothing else about the
     bar moves: the frustum is still the viewport in CSS pixels, and the
     z-order of slab, mark and hit plane is unchanged. */
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, HUD_EYE + 50);
  camera.position.z = HUD_EYE;
  const hotspots: Hotspot[] = [];

  /* ---- bar ---- */
  const bar = new THREE.Mesh(
    registry.geometry(new THREE.PlaneGeometry(1, 1)),
    registry.facade(0xfffaf0)
  );
  const barShadow = new THREE.Mesh(
    registry.geometry(new THREE.PlaneGeometry(1, 1)),
    registry.track(
      new THREE.MeshBasicMaterial({
        map: shadowTexture(registry),
        transparent: true,
        depthWrite: false,
      })
    )
  );
  scene.add(bar, barShadow);

  /* ---- wordmark ---- */
  const markGroup = new THREE.Group();
  const markText = capsPlane(registry, "Villegas-Kirchman", INK.text, TYPE.label * 1.08);
  const markShort = capsPlane(registry, "NVK", INK.text, TYPE.label * 1.08);
  markGroup.add(markText.mesh, markShort.mesh);
  scene.add(markGroup);

  const markHit = new THREE.Mesh(
    registry.geometry(new THREE.PlaneGeometry(1, 1)),
    registry.track(new THREE.MeshBasicMaterial({ visible: false }))
  );
  markGroup.add(markHit);
  let markHover = 0;
  hotspots.push({
    id: "nav-home",
    kind: "scroll",
    label: "Nicolas Villegas-Kirchman — home",
    section: "top",
    object: markHit,
    setState: (hover, focus) => {
      markHover = Math.max(hover, focus);
    },
  });

  /* ---- section marks ---- */
  const outlineGeometry = registry.geometry(
    new THREE.RingGeometry(HEX_RADIUS * 0.74, HEX_RADIUS, 6)
  );
  const fillGeometry = registry.geometry(new THREE.CircleGeometry(HEX_RADIUS * 0.75, 6));

  const marks: Mark[] = HUD_SECTIONS.map((section) => {
    const group = new THREE.Group();
    const hex = new THREE.Group();
    const outline = registry.track(
      new THREE.MeshBasicMaterial({ color: COLOR.inkText, transparent: true, depthWrite: false })
    );
    const fill = registry.track(
      new THREE.MeshBasicMaterial({ color: COLOR.inkText, transparent: true, depthWrite: false })
    );
    hex.add(new THREE.Mesh(outlineGeometry, outline), new THREE.Mesh(fillGeometry, fill));
    group.add(hex);

    const painted = capsPlane(registry, section.label, INK.text);
    group.add(painted.mesh);
    const hit = new THREE.Mesh(
      registry.geometry(new THREE.PlaneGeometry(1, 1)),
      registry.track(new THREE.MeshBasicMaterial({ visible: false }))
    );
    group.add(hit);
    scene.add(group);

    const mark: Mark = {
      group,
      hex,
      fill,
      outline,
      label: painted.mesh,
      labelWidth: painted.width,
      width: painted.width + 0.78,
      hover: 0,
      active: 0,
    };
    hotspots.push({
      id: `nav-${section.id}`,
      kind: "scroll",
      label: section.label,
      section: section.id,
      object: hit,
      setState: (hover, focus) => {
        mark.hover = Math.max(hover, focus);
      },
    });
    return mark;
  });

  /* ---- current section name, narrow layout only ----
     On the bar's own paper rather than hung under it: the skies run from
     dawn peach to night sea, and no one ink reads over all of them. */
  const currentLabels = HUD_SECTIONS.map((section) =>
    capsPlane(registry, section.label, INK.text)
  );
  currentLabels.forEach(({ mesh }) => {
    mesh.visible = false;
    scene.add(mesh);
  });

  /* ---- scroll cue: their chevron, drawn in two strokes ----
     Charcoal rather than their white: it only shows on the first storey,
     whose dawn sky is too pale to carry white. */
  const cue = new THREE.Group();
  const cueMaterial = registry.track(
    new THREE.MeshBasicMaterial({ color: COLOR.inkText, transparent: true, depthWrite: false })
  );
  const strokeGeometry = registry.geometry(new THREE.PlaneGeometry(0.5, 0.07));
  const chevron = new THREE.Group();
  [-1, 1].forEach((side) => {
    const stroke = new THREE.Mesh(strokeGeometry, cueMaterial);
    stroke.rotation.z = (side * Math.PI) / 4;
    stroke.position.set(side * 0.165, 0, 0);
    chevron.add(stroke);
  });
  cue.add(chevron);
  const cueLabel = capsPlane(registry, "Scroll or turn the handle", INK.text);
  cueLabel.mesh.position.y = 0.52;
  cue.add(cueLabel.mesh);
  scene.add(cue);

  let width = 1;
  let height = 1;
  let narrow = false;
  let barHeight = 1.2;

  const resize = (clientWidth: number, clientHeight: number, isNarrow: boolean) => {
    width = clientWidth / SCALE;
    height = clientHeight / SCALE;
    narrow = isNarrow;
    camera.left = 0;
    camera.right = width;
    camera.top = 0;
    camera.bottom = -height;
    camera.updateProjectionMatrix();

    // The narrow bar carries a second row for the current section's name.
    const row = narrow ? 1.1 : 1.2;
    barHeight = narrow ? row + 0.62 : row;
    const pad = narrow ? 0.52 : 0.92;

    bar.scale.set(width, barHeight, 1);
    bar.position.set(width / 2, -barHeight / 2, -1);
    barShadow.scale.set(width, 0.3, 1);
    barShadow.position.set(width / 2, -barHeight - 0.15, -1);

    markText.mesh.visible = !narrow;
    markShort.mesh.visible = narrow;
    const activeMarkText = narrow ? markShort : markText;
    activeMarkText.mesh.position.set(pad + activeMarkText.width / 2, -row / 2, 0.4);
    markHit.scale.set(activeMarkText.width + 0.4, row, 1);
    markHit.position.set(pad + activeMarkText.width / 2, -row / 2, 0.5);

    if (narrow) {
      // Marks only, evenly spread across the bar's right half.
      const step = 0.72;
      const total = step * (marks.length - 1);
      const startX = width - pad - total;
      marks.forEach((mark, i) => {
        mark.group.position.set(startX + i * step, -row / 2, 0.4);
        mark.hex.position.set(0, 0, 0);
        if (mark.label) mark.label.visible = false;
        const hit = mark.group.children[2] as THREE.Mesh;
        hit.scale.set(step, row, 1);
        hit.position.set(0, 0, 0.5);
      });
      currentLabels.forEach(({ mesh }) => mesh.position.set(width / 2, -row - 0.24, 0.4));
    } else {
      const total = marks.reduce((sum, mark) => sum + mark.width, 0);
      let x = width - pad - total;
      marks.forEach((mark) => {
        mark.group.position.set(x, -row / 2, 0.4);
        mark.hex.position.set(0.16, 0, 0);
        if (mark.label) {
          mark.label.visible = true;
          mark.label.position.set(0.42 + mark.labelWidth / 2, 0, 0);
        }
        const hit = mark.group.children[2] as THREE.Mesh;
        hit.scale.set(mark.width, row, 1);
        hit.position.set(mark.width / 2 - 0.1, 0, 0.5);
        x += mark.width;
      });
      currentLabels.forEach(({ mesh }) => (mesh.visible = false));
    }

    // Tucked into the corner, clear of the reading wall and its controls.
    // Dropped entirely on a narrow screen: scrolling needs no hint on touch.
    cue.position.set(width - 1.9, -height + 0.9, 0.4);
  };

  const update = (ctx: {
    index: number;
    elapsed: number;
    dt: number;
    reduce: boolean;
    progress: number;
  }) => {
    const current = Math.round(ctx.index);
    marks.forEach((mark, i) => {
      const wanted = i === current ? 1 : 0;
      mark.active = ctx.reduce
        ? wanted
        : mark.active + (wanted - mark.active) * Math.min(1, ctx.dt * 7);
      const emphasis = Math.max(mark.active, mark.hover);
      // Their rail: outline at half strength, turned and filled when current
      // or under the pointer.
      mark.hex.rotation.z = emphasis * HEX_TURN;
      mark.outline.opacity = 0.45 + emphasis * 0.55;
      mark.fill.opacity = emphasis;
      if (mark.label) {
        const material = mark.label.material as THREE.MeshBasicMaterial;
        material.opacity = 0.45 + emphasis * 0.55;
      }
    });

    if (narrow) {
      currentLabels.forEach(({ mesh }, i) => (mesh.visible = i === current));
    }

    const markMaterial = (narrow ? markShort : markText).mesh.material as THREE.MeshBasicMaterial;
    markMaterial.opacity = 0.85 + markHover * 0.15;

    // The cue has one job and retires once it is done.
    const visible = narrow ? 0 : Math.max(0, 1 - ctx.progress * 7);
    cue.visible = visible > 0.01;
    cueMaterial.opacity = 0.95 * visible;
    chevron.position.y = ctx.reduce ? 0 : -Math.abs(Math.sin(ctx.elapsed * 1.6)) * 0.12;
    const cueLabelMaterial = cueLabel.mesh.material as THREE.MeshBasicMaterial;
    cueLabelMaterial.opacity = visible;
  };

  return {
    scene,
    camera,
    hotspots,
    resize,
    update,
    /** How much of the top of the frame the navigation covers, in HUD units,
        shadow included. */
    get occludedHeight() {
      return barHeight + 0.2;
    },
  };
}

export type Hud = ReturnType<typeof buildHud>;
