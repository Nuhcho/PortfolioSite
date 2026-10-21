import * as THREE from "three";
import { COLOR, INK, Registry, TYPE, type Palette } from "./theme";
import { measureInline, paintText } from "./text";
import type { Hotspot } from "./parts";

/* The navigation is drawn by three.js too, in a second scene pinned to the
   viewport in CSS-pixel units. It is the one part of the world that does not
   travel: a slim bar of lit stone with the section marks cut into it.

   Below the narrow breakpoint the labels drop away and only the marks remain,
   with the current section named underneath — a hamburger would be a second
   navigation pattern for the same five links. */

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
  cube: THREE.Mesh;
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

/* The bar's own depth order, in HUD units: the slab behind, the marks on it,
   and the hit planes a hair in front of those. All of it in front of the
   camera, which is the part that was wrong. */
const HUD_EYE = 10;

export function buildHud(registry: Registry, palette: Palette) {
  const scene = new THREE.Scene();
  /* The camera stands back from the bar rather than inside it, and this is
     what makes the navigation clickable at all.

     `Raycaster.setFromCamera` starts an orthographic ray not at the camera
     but at the plane the projection matrix calls the middle of its depth
     range — `projectionMatrix.elements[14]`, which for a frustum of
     (-50, 50) about the origin is exactly z = 0 — and then fires it along
     -Z. Every piece of this bar sits at z +0.4 or +0.5, which is *behind*
     that origin, so every intersection came out at a negative distance and
     was discarded. The five section marks and the wordmark have been drawn,
     lit, hover-scaled and hit-tested against the pointer this whole time,
     and not one of them could ever be pressed; the DOM mirror's real links
     are the only reason the navigation worked at all.

     Pushing the eye to +10 with a near plane in front of it puts the ray
     origin at z 9.9 and the whole bar in front of it. Nothing else about the
     bar moves: the frustum is still the viewport in CSS pixels, and the
     z-order of slab, mark and hit plane is unchanged. */
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, HUD_EYE + 50);
  camera.position.z = HUD_EYE;
  const hotspots: Hotspot[] = [];

  scene.add(new THREE.AmbientLight(0xfff1e0, 0.78));
  const key = new THREE.DirectionalLight(0xffd9a0, 1.1);
  key.position.set(-2, 3, 4);
  scene.add(key);

  /* ---- bar ---- */
  const bar = new THREE.Mesh(
    registry.geometry(new THREE.PlaneGeometry(1, 1)),
    registry.facade(COLOR.paleIvory)
  );
  const barEdge = new THREE.Mesh(
    registry.geometry(new THREE.PlaneGeometry(1, 1)),
    registry.facade(COLOR.ivoryShadow)
  );
  scene.add(bar, barEdge);

  /* ---- wordmark ---- */
  const cubeGeometry = registry.geometry(new THREE.BoxGeometry(1, 1, 1));
  const isoCube = (material: THREE.Material, size: number) => {
    const mesh = new THREE.Mesh(cubeGeometry, material);
    mesh.scale.setScalar(size);
    // The canonical isometric presentation of a cube: a half-turn of 45°,
    // then the arctan(1/√2) tilt that puts all three faces in view equally.
    mesh.rotation.set(Math.atan(1 / Math.SQRT2), Math.PI / 4, 0);
    return mesh;
  };

  const markGroup = new THREE.Group();
  const markCube = isoCube(palette.beacon, 0.3);
  const markText = paintedPlane(registry, {
    width: measureInline({ text: "Villegas-Kirchman", face: "display", size: 0.31, weight: 600 }) + 0.02,
    runs: [{ text: "Villegas-Kirchman", face: "display", size: 0.31, weight: 600, color: INK.text }],
  });
  const markShort = paintedPlane(registry, {
    width: measureInline({ text: "NVK", face: "display", size: 0.31, weight: 600 }) + 0.02,
    runs: [{ text: "NVK", face: "display", size: 0.31, weight: 600, color: INK.text }],
  });
  markGroup.add(markCube, markText.mesh, markShort.mesh);
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
  const dimMark = registry.lit(COLOR.sandDeep, { roughness: 0.9 });
  const activeMark = registry.lit(COLOR.teal);
  const marks: Mark[] = HUD_SECTIONS.map((section) => {
    const group = new THREE.Group();
    const cube = isoCube(dimMark, 0.2);
    group.add(cube);
    const painted = paintedPlane(registry, {
      // Measure the cased string that is actually painted, not the source
      // label — uppercasing is what decides the width.
      width:
        measureInline({
          text: section.label.toUpperCase(),
          size: TYPE.label,
          weight: 700,
          tracking: 0.05,
        }) + 0.12,
      runs: [
        {
          text: section.label,
          size: TYPE.label,
          weight: 700,
          tracking: 0.05,
          upper: true,
          color: INK.text,
          nowrap: true,
        },
      ],
    });
    group.add(painted.mesh);
    const hit = new THREE.Mesh(
      registry.geometry(new THREE.PlaneGeometry(1, 1)),
      registry.track(new THREE.MeshBasicMaterial({ visible: false }))
    );
    group.add(hit);
    scene.add(group);

    const mark: Mark = {
      group,
      cube,
      label: painted.mesh,
      labelWidth: painted.width,
      width: painted.width + 0.74,
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

  /* ---- current section name, narrow layout only ---- */
  const currentLabels = HUD_SECTIONS.map((section) =>
    paintedPlane(registry, {
      width:
        measureInline({
          text: section.label.toUpperCase(),
          size: TYPE.label,
          weight: 700,
          tracking: 0.08,
        }) + 0.12,
      runs: [
        {
          text: section.label,
          size: TYPE.label,
          weight: 700,
          tracking: 0.08,
          upper: true,
          color: INK.systems,
          align: "center",
          nowrap: true,
        },
      ],
    })
  );
  currentLabels.forEach(({ mesh }) => {
    mesh.visible = false;
    scene.add(mesh);
  });

  /* ---- scroll cue ---- */
  const cue = new THREE.Group();
  const cueBarGeometry = registry.geometry(new THREE.PlaneGeometry(0.62, 0.055));
  const cueMaterials = [0.9, 0.55, 0.26].map((opacity) =>
    registry.track(
      new THREE.MeshBasicMaterial({
        color: COLOR.inkMuted,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    )
  );
  const cueBars = cueMaterials.map((material, i) => {
    const mesh = new THREE.Mesh(cueBarGeometry, material);
    mesh.position.y = -i * 0.19;
    mesh.scale.x = 1 - i * 0.26;
    cue.add(mesh);
    return mesh;
  });
  const cueLabel = paintedPlane(registry, {
    width:
      measureInline({
        text: "SCROLL TO DESCEND",
        size: TYPE.label,
        weight: 700,
        tracking: 0.08,
      }) + 0.12,
    runs: [
      {
        text: "Scroll to descend",
        size: TYPE.label,
        weight: 700,
        tracking: 0.08,
        upper: true,
        color: INK.muted,
        align: "center",
        nowrap: true,
      },
    ],
  });
  cueLabel.mesh.position.y = 0.46;
  cue.add(cueLabel.mesh);
  scene.add(cue);

  let width = 1;
  let height = 1;
  let narrow = false;
  let barHeight = 2;

  const resize = (clientWidth: number, clientHeight: number, isNarrow: boolean) => {
    width = clientWidth / SCALE;
    height = clientHeight / SCALE;
    narrow = isNarrow;
    camera.left = 0;
    camera.right = width;
    camera.top = 0;
    camera.bottom = -height;
    camera.updateProjectionMatrix();

    barHeight = narrow ? 1.62 : 1.95;
    const pad = narrow ? 0.52 : 0.92;

    bar.scale.set(width, barHeight, 1);
    bar.position.set(width / 2, -barHeight / 2, -1);
    barEdge.scale.set(width, 0.055, 1);
    barEdge.position.set(width / 2, -barHeight - 0.027, -1);

    markCube.position.set(pad + 0.21, -barHeight / 2, 0.4);
    markText.mesh.visible = !narrow;
    markShort.mesh.visible = narrow;
    const activeMarkText = narrow ? markShort : markText;
    activeMarkText.mesh.position.set(pad + 0.62 + activeMarkText.width / 2, -barHeight / 2, 0.4);
    markHit.scale.set(activeMarkText.width + 0.9, barHeight, 1);
    markHit.position.set(pad + (activeMarkText.width + 0.9) / 2 - 0.08, -barHeight / 2, 0.5);

    if (narrow) {
      // Marks only, evenly spread across the bar's right half.
      const step = 0.72;
      const total = step * (marks.length - 1);
      const startX = width - pad - total;
      marks.forEach((mark, i) => {
        mark.group.position.set(startX + i * step, -barHeight / 2, 0.4);
        mark.cube.position.set(0, 0, 0);
        if (mark.label) mark.label.visible = false;
        const hit = mark.group.children[2] as THREE.Mesh;
        hit.scale.set(step, barHeight, 1);
        hit.position.set(0, 0, 0.5);
      });
      currentLabels.forEach(({ mesh }) => mesh.position.set(width / 2, -barHeight - 0.42, 0.4));
    } else {
      const total = marks.reduce((sum, mark) => sum + mark.width, 0);
      let x = width - pad - total;
      marks.forEach((mark) => {
        mark.group.position.set(x, -barHeight / 2, 0.4);
        mark.cube.position.set(0.16, 0, 0);
        if (mark.label) {
          mark.label.visible = true;
          mark.label.position.set(0.44 + mark.labelWidth / 2, 0, 0);
        }
        const hit = mark.group.children[2] as THREE.Mesh;
        hit.scale.set(mark.width, barHeight, 1);
        hit.position.set(mark.width / 2 - 0.1, 0, 0.5);
        x += mark.width;
      });
      currentLabels.forEach(({ mesh }) => (mesh.visible = false));
    }

    // Tucked into the corner, and dropped entirely on a narrow screen: an
    // island fills a phone edge to edge, leaving nowhere for the cue to sit
    // that isn't on top of something — and scrolling needs no hint on touch.
    cue.position.set(width - 1.9, -height + 1.1, 0.4);
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
      mark.cube.material = mark.active > 0.5 ? activeMark : dimMark;
      mark.cube.scale.setScalar(0.2 * (1 + emphasis * 0.42));
      if (!ctx.reduce) mark.cube.rotation.y = Math.PI / 4 + mark.active * 0.6;
      if (mark.label) {
        const material = mark.label.material as THREE.MeshBasicMaterial;
        material.transparent = true;
        material.opacity = 0.52 + emphasis * 0.48;
      }
    });

    if (narrow) {
      currentLabels.forEach(({ mesh }, i) => (mesh.visible = i === current));
    }

    markCube.scale.setScalar(0.3 * (1 + markHover * 0.18));
    if (!ctx.reduce) markCube.rotation.y = Math.PI / 4 + ctx.elapsed * 0.22;

    // The cue has one job and retires once it is done.
    const visible = narrow ? 0 : Math.max(0, 1 - ctx.progress * 7);
    cue.visible = visible > 0.01;
    cueBars.forEach((mesh, i) => {
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = [0.9, 0.55, 0.26][i] * visible;
      mesh.position.y = -i * 0.19 - (ctx.reduce ? 0 : Math.sin(ctx.elapsed * 1.6 - i * 0.5) * 0.045);
    });
    const cueLabelMaterial = cueLabel.mesh.material as THREE.MeshBasicMaterial;
    cueLabelMaterial.transparent = true;
    cueLabelMaterial.opacity = visible;
  };

  return {
    scene,
    camera,
    hotspots,
    resize,
    update,
    /** How much of the top of the frame the navigation covers, in HUD units.
        On narrow layouts that includes the current-section label printed
        under the bar, which would otherwise land on the island's heading. */
    get occludedHeight() {
      return barHeight + (narrow ? 0.92 : 0);
    },
  };
}

export type Hud = ReturnType<typeof buildHud>;
