"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import styles from "./WorldCanvas.module.css";
import { buildHud } from "./hud";
import { QUARTER, buildMonument, type Storey } from "./monument";
import { SCREEN_UP, screenBox } from "./layout";
import type { Hotspot } from "./parts";
import { ISO_DIR, Registry, UNIT_PX, createPalette } from "./theme";
import { configureText, ensureFonts, loadDisplayFont } from "./text";
import { getActiveEntry, setActiveEntry } from "./worldState";

/* The whole page lives in here. The DOM underneath is the accessibility
   mirror: it ships the real content and the real links, it defines how far
   the document scrolls, and it stays the visible page whenever this canvas
   cannot run (no JavaScript, no WebGL). Nothing below is decoration. */

const CAM_DISTANCE = 140;
const SUN_OFFSET = new THREE.Vector3(10, 16, 7);
const FILL_OFFSET = new THREE.Vector3(-9, 5, -9);
/** Below this the facets narrow their reading column. */
const NARROW_PX = 820;
/** Breathing room under the navigation bar, in CSS px. */
const BAR_CLEARANCE = 20;
/** How far the viewport may drift before the world is laid out again. */
const RELAYOUT_DRIFT = 0.12;

/* A band is read, and then the keep is turned in the open.
 *
 * Up to READ_END the facet is square to the eye and the camera pans down it.
 * After it, the camera pulls back until the whole keep stands in the frame
 * against open sky, turns a quarter there, and dollies back in on the next
 * storey. The turn is the part this build used to do at reading distance,
 * which is why the type sheared across it: an inscription lying on a wall has
 * no readable angle but square-on, and at reading distance a sheared block of
 * copy is the only thing on screen. Pulled back, the same quarter-turn is the
 * one moment the thing actually reads as architecture. */
const READ_END = 0.52;
/** Fraction of the keep's own width the silhouette holds at the wide end.
    Monument Valley is mostly sky; the structure is small and complete in it. */
const WIDE_FILL = 0.42;
/* Ink is gone this far into the pull-back. It wants to be early and quick:
   a half-faded inscription is a translucent slab of text with its controls
   hanging in the air behind it, which looks like a rendering fault rather
   than like a transition. Out before the wall has visibly moved. */
const INK_OUT = 0.16;
/* A flight is whole at exactly one angle and in pieces at every other, so a
 * keep carrying five of them shows one stair and four heaps of rubble unless
 * each is told when its own moment is. These two bound that moment: the
 * flight stands through the first FLIGHT_HOLD of the turn — long enough to be
 * seen whole, and to be seen begin to come apart — and is gone FLIGHT_TEAR
 * later, well before the halves have drifted far enough to stop reading as
 * two halves of something. The storey being turned to brings its own flight
 * in on the mirror of the same curve, closing as its quarter arrives. */
const FLIGHT_HOLD = 0.16;
const FLIGHT_TEAR = 0.42;
const TAP_SLOP = 12;
const TAP_TIME = 700;

export default function WorldCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const ring = ringRef.current;
    if (!host || !ring) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      if (!renderer.getContext()) throw new Error("no context");
    } catch {
      // The mirror is already the visible page; leave it that way.
      return;
    }

    let disposed = false;
    let teardown: (() => void) | undefined;

    const start = async () => {
      configureText(renderer);
      let font;
      try {
        [font] = await Promise.all([loadDisplayFont(), ensureFonts()]);
      } catch {
        renderer.dispose();
        return;
      }
      if (disposed) {
        renderer.dispose();
        return;
      }

      /* ---- persistent stage ---- */

      const scene = new THREE.Scene();
      /* No fog, and for a reason particular to this camera rather than to
         taste. Depth fog measures distance along the view axis, and under a
         locked isometric the view axis is (1,1,1): going *down* the keep is
         going away from the eye. The keep is about ninety units deep from
         crown to foot, the range this was set to was CAM_DISTANCE + 6 to
         + 96, and the two numbers are the same size — so framing the top
         storey put the bottom three at the far plane and dissolved them. A
         monument that fades out below its own waist reads as a draw failure,
         not as air.

         Matching the fog to the backdrop would not have rescued it either:
         the sky behind the canvas is a gradient running #fbf3ec to #ded2e4
         down the viewport, and the fog had one colour, COLOR.sky, which is
         neither of the ends. Where it bit hardest — the bottom of the frame —
         it was fading stone to a lilac-pink the sky there is not. */
      const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, CAM_DISTANCE * 2.4);

      /* No shadow map, and this was tested rather than assumed: it went on
         for the keep, on the theory that one solid object would not suffer
         the acne a landscape of interlocking districts did, and it threw
         banded self-shadowing straight across the facets and the copy on
         them. A keep this full of coplanar courses has the same problem at
         any bias worth having. Depth comes from per-face tinting, from the
         setbacks each course steps through, and from overlap. */
      renderer.shadowMap.enabled = false;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.autoClear = false;
      host.appendChild(renderer.domElement);

      /* Flat, not modelled: almost all the illumination is ambient, so a piece
         stays the pastel it was authored at and only tips a little warmer on
         top and a little cooler on the side.

         The numbers look large because three's lights are in physical units:
         a Lambert surface returns `irradiance / PI`, so an ambient of PI is
         what renders a flat colour at exactly the hex it was authored as.
         Anything less and every pastel in the world comes back a shade of
         mud — which is what was happening at 1.06. Solved for directly:
         a sunlit top lands at 1.03x its own colour, the +X face at 0.90 and
         the +Z face at 0.855, which is the whole of the modelling. */
      scene.add(new THREE.AmbientLight(0xfffdf8, 2.33));
      const sun = new THREE.DirectionalLight(0xfff6ec, 1.01);
      scene.add(sun, sun.target);
      const fill = new THREE.DirectionalLight(0xc9bfe0, 0.3);
      scene.add(fill, fill.target);

      /* ---- the world, rebuilt when the layout breakpoint flips ---- */

      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      let reduce = motionQuery.matches;

      type Built = {
        registry: Registry;
        root: THREE.Group;
        storeys: Storey[];
        update: (ctx: { elapsed: number; dt: number; reduce: boolean }) => void;
        hud: ReturnType<typeof buildHud>;
        hotspots: Hotspot[];
        worldTargets: THREE.Object3D[];
        hudTargets: THREE.Object3D[];
        hover: Float32Array;
        focus: Float32Array;
        /** the keep's own stone silhouette, inscriptions excluded — what the
            wide framing has to fit */
        stoneWidth: number;
        forWidth: number;
        forHeight: number;
      };

      let built: Built;
      let currentIndex = 0;

      const build = (): Built => {
        const registry = new Registry();
        const palette = createPalette(registry);
        const width = host.clientWidth || window.innerWidth;
        const height = host.clientHeight || window.innerHeight;
        // Islands lay themselves out against the real viewport, measured in
        // units rather than pixels.
        const view = {
          width: width / UNIT_PX,
          height: height / UNIT_PX,
          narrow: width < NARROW_PX,
        };
        const world = buildMonument({ registry, palette, font, view });
        const hud = buildHud(registry, palette);
        scene.add(world.root);
        const hotspots = [...hud.hotspots, ...world.hotspots];

        /* Measure, never declare — the wide framing is sized from the keep's
           real vertices. Facets are hidden for the measurement because an
           inscription is wider than the stone it lies on and is not part of
           the silhouette the camera is framing. Once per build, not per
           frame. */
        world.storeys.forEach((storey) => {
          storey.facet.visible = false;
        });
        const stoneWidth = screenBox(world.root).width;
        world.storeys.forEach((storey) => {
          storey.facet.visible = true;
        });
        return {
          registry,
          root: world.root,
          storeys: world.storeys,
          update: world.update,
          hud,
          hotspots,
          worldTargets: world.hotspots.map((hotspot) => hotspot.object),
          hudTargets: hud.hotspots.map((hotspot) => hotspot.object),
          hover: new Float32Array(hotspots.length),
          focus: new Float32Array(hotspots.length),
          stoneWidth,
          forWidth: width,
          forHeight: height,
        };
      };

      // Every geometry, material and texture in a build is tracked by its
      // own registry, so detaching the root and disposing the registry is the
      // whole teardown.
      const release = (previous: Built) => {
        scene.remove(previous.root);
        previous.registry.dispose();
      };

      built = build();

      /* ---- scroll → fractional island index ---- */

      /* A band's height is how much scrolling that island is worth. An island
         that fits one screen only needs enough to dwell on and travel from;
         one the camera has to pan down earns that pan's own distance, a
         little slower than one-to-one so it never feels wrenched. */
      const sizeBands = () => {
        const visible = Math.max(2, viewHeight - built.hud.occludedHeight * UNIT_PX - BAR_CLEARANCE);
        built.storeys.forEach((storey, i) => {
          const element = document.getElementById(storey.id);
          if (!element) return;
          const overflow = Math.max(0, storey.fitHeight * UNIT_PX - visible);
          const base = viewHeight * (i === built.storeys.length - 1 ? 1.05 : 1.2);
          element.style.minHeight = `${Math.round(base + overflow * 1.35)}px`;
        });
      };

      /* One band of the document is one storey of the descent, and a band's
         top is where that storey has come square to the eye — so a link to
         #work lands on the work facet rather than mid-turn between two. */
      let anchors: number[] = [];
      const REFERENCE = 0.45;
      const measureAnchors = () => {
        anchors = built.storeys.map((storey) => {
          const element = document.getElementById(storey.id);
          if (!element) return 0;
          const rect = element.getBoundingClientRect();
          return rect.top + window.scrollY + window.innerHeight * REFERENCE;
        });
      };

      /* The descent runs 0 → N-1. Its whole part names the storey, and its
         fraction is spent first panning down that storey's own facet and then
         turning and falling to the next. The last storey gets a half-step
         tail of its own so it can pan too. */
      const scrollJourney = () => {
        if (anchors.length === 0) return 0;
        const last = anchors.length - 1;
        const reference = window.scrollY + window.innerHeight * REFERENCE;
        if (reference <= anchors[0]) return 0;
        for (let i = 0; i < last; i += 1) {
          if (reference < anchors[i + 1]) {
            const span = anchors[i + 1] - anchors[i] || 1;
            return i + (reference - anchors[i]) / span;
          }
        }
        const end =
          document.documentElement.scrollHeight -
          window.innerHeight +
          window.innerHeight * REFERENCE;
        const span = Math.max(1, end - anchors[last]);
        return last + 0.5 * THREE.MathUtils.clamp((reference - anchors[last]) / span, 0, 1);
      };

      const target = new THREE.Vector3();
      let aspect = 1;
      let viewHeight = 1;

      /* Pressing a tablet slides its terrace out of the monument, and it
         stays out until the visitor scrolls, presses Escape, or presses it
         again. The camera never leaves the descent: the reveal is a moving
         part of the building, not a trip to it.

         One at a time. Two terraces out at once would cross each other on a
         facet this narrow, and the second would read as a bug. */
      const opened = new Set<string>();

      const closeReveals = () => {
        if (opened.size === 0) return;
        built.hotspots.forEach((hotspot) => {
          if (opened.has(hotspot.id)) hotspot.setOpen?.(false);
        });
        opened.clear();
        setActiveEntry(null);
      };

      const reveal = (hotspot: Hotspot) => {
        const next = !opened.has(hotspot.id);
        closeReveals();
        if (!next) return;
        opened.add(hotspot.id);
        hotspot.setOpen?.(true);
        if (hotspot.entry) setActiveEntry(hotspot.entry);
      };

      const smoothstep = (t: number) => {
        const x = THREE.MathUtils.clamp(t, 0, 1);
        return x * x * (3 - 2 * x);
      };

      const anchorA = new THREE.Vector3();
      const anchorB = new THREE.Vector3();

      /** Where the camera looks at storey `i`, with `pan` running 0 (its top
          in frame) to 1 (its bottom). Short facets ignore it entirely. */
      const lookAtStorey = (i: number, pan: number, visible: number, out: THREE.Vector3) => {
        const storey = built.storeys[i];
        const overflow = Math.max(0, storey.fitHeight - visible);
        out.copy(storey.target).addScaledVector(SCREEN_UP, overflow * (0.5 - pan));
      };

      const applyCamera = (index: number) => {
        const storeys = built.storeys;
        const low = THREE.MathUtils.clamp(Math.floor(index), 0, storeys.length - 1);
        const high = Math.min(storeys.length - 1, low + 1);
        const fraction = index - low;
        // The last storey has nothing to turn to; its tail is pan alone.
        const terminal = low === high;

        /* The band in three parts. Reading holds the unit↔pixel contract so
           body copy is 17px on every facet; the turn abandons it deliberately,
           because the contract is exactly what makes the keep too big to see.
           `arch` is a trapezoid: out, hold wide through the quarter-turn,
           back in. */
        let pan: number;
        let turn: number;
        let wide: number;
        if (terminal || fraction < READ_END) {
          pan = smoothstep(fraction / READ_END);
          turn = 0;
          wide = 0;
        } else {
          const t = (fraction - READ_END) / (1 - READ_END);
          pan = 1;
          turn = smoothstep(t);
          wide = Math.min(smoothstep(t / 0.34), 1 - smoothstep((t - 0.66) / 0.34));
        }

        // Zoom at the reading end comes from the unit↔pixel contract and
        // nothing else. The only override is a facet too wide for the
        // viewport, which would otherwise crop.
        const widest = Math.max(storeys[low].fitWidth, storeys[high].fitWidth);
        const readSize = Math.max(viewHeight / (2 * UNIT_PX), widest / (2 * aspect));

        /* At the wide end the keep holds WIDE_FILL of the frame's width and
           the camera carries enough height to show both storeys of the turn
           with sky over them. Both terms are measured, so this frames itself
           at any viewport instead of being tuned to one. */
        const spanY = Math.abs(
          storeys[high].target.dot(SCREEN_UP) - storeys[low].target.dot(SCREEN_UP)
        );
        const wideSize = Math.max(
          readSize,
          built.stoneWidth / (2 * WIDE_FILL * aspect),
          (spanY + storeys[low].fitHeight * 0.5) * 0.72
        );
        const viewSize = THREE.MathUtils.lerp(readSize, wideSize, wide);

        // The navigation bar covers the top of the frame, so the facet is
        // pushed down by exactly the height the bar occupies in world units.
        const pad =
          ((built.hud.occludedHeight * UNIT_PX + BAR_CLEARANCE) * 2 * viewSize) /
          Math.max(viewHeight, 1);
        const visible = Math.max(2, 2 * readSize - pad);

        lookAtStorey(low, pan, visible, anchorA);
        lookAtStorey(high, 0, visible, anchorB);
        target.lerpVectors(anchorA, anchorB, turn);
        target.addScaledVector(SCREEN_UP, pad / 2);

        /* A quarter of tower per storey descended. This is the whole of the
           interaction: the monument turns, the camera falls, and the facet
           that was edge-on a moment ago is now the page you are reading. */
        built.root.rotation.y = -(low + turn) * QUARTER;

        /* Ink is off the wall before the wall moves far enough to shear it,
           and the storey being handed to is the one it comes back on. */
        const legible = 1 - smoothstep(wide / INK_OUT);
        for (let i = 0; i < storeys.length; i += 1) {
          storeys[i].setInk(0);
          storeys[i].setFlight(0);
        }
        storeys[turn < 0.5 ? low : high].setInk(legible);

        // The flight of the storey being left, coming apart; and, over the
        // back half of the same turn, the flight of the one being arrived at,
        // closing. Every other flight on the keep is off the board.
        storeys[low].setFlight(1 - smoothstep((turn - FLIGHT_HOLD) / FLIGHT_TEAR));
        if (!terminal) {
          storeys[high].setFlight(
            smoothstep((turn - (1 - FLIGHT_HOLD - FLIGHT_TEAR)) / FLIGHT_TEAR)
          );
        }

        camera.left = -viewSize * aspect;
        camera.right = viewSize * aspect;
        camera.top = viewSize;
        camera.bottom = -viewSize;
        camera.position.copy(target).addScaledVector(ISO_DIR, CAM_DISTANCE);
        camera.lookAt(target);
        camera.updateProjectionMatrix();

        sun.position.copy(target).add(SUN_OFFSET);
        sun.target.position.copy(target);
        sun.target.updateMatrixWorld();
        fill.position.copy(target).add(FILL_OFFSET);
        fill.target.position.copy(target);
        fill.target.updateMatrixWorld();
      };

      const resize = () => {
        const { clientWidth, clientHeight } = host;
        if (clientWidth === 0 || clientHeight === 0) return;
        aspect = clientWidth / clientHeight;
        viewHeight = clientHeight;
        renderer.setSize(clientWidth, clientHeight);
        built.hud.resize(clientWidth, clientHeight, clientWidth < NARROW_PX);
        sizeBands();
        measureAnchors();
        applyCamera(currentIndex);

        // An island is laid out for one viewport. Small changes ride on the
        // camera; a real one (a rotated phone, a resized window) earns a
        // rebuild, debounced so a drag doesn't rebuild on every frame.
        const drifted =
          Math.abs(clientWidth - built.forWidth) / built.forWidth > RELAYOUT_DRIFT ||
          Math.abs(clientHeight - built.forHeight) / built.forHeight > RELAYOUT_DRIFT ||
          clientWidth < NARROW_PX !== built.forWidth < NARROW_PX;
        if (drifted) {
          window.clearTimeout(relayoutTimer);
          relayoutTimer = window.setTimeout(relayout, 240);
        }
      };

      let revealScrollY = 0;
      let relayoutTimer = 0;
      const relayout = () => {
        const previous = built;
        built = build();
        release(previous);
        resize();
      };

      currentIndex = scrollJourney();
      resize();

      const hostObserver = new ResizeObserver(resize);
      hostObserver.observe(host);
      const remeasure = () => measureAnchors();
      window.addEventListener("resize", remeasure);
      window.addEventListener("load", remeasure);
      // The canvas never changes size on its own, so the host observer can't
      // see the document reflowing underneath it.
      const bodyObserver = new ResizeObserver(remeasure);
      bodyObserver.observe(document.body);

      /* ---- pointer ---- */

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let pointerInside = false;
      let hovered: Hotspot | null = null;
      let focused: Hotspot | null = null;
      let down: { x: number; y: number; at: number } | null = null;

      const hotspotFor = (object: THREE.Object3D) =>
        built.hotspots.find((hotspot) => hotspot.object === object) ?? null;

      /* `refresh` brings every matrix the ray depends on up to date. The
         renderer does that as part of drawing, so a pick taken straight after
         a frame can skip it — but a pick triggered by a pointer event happens
         outside the loop, where `lookAt` has left the camera's matrixWorld
         holding its previous rotation and nothing in the world would be hit. */
      const pick = (refresh = true) => {
        if (!pointerInside) return null;
        if (refresh) {
          camera.updateMatrixWorld();
          scene.updateMatrixWorld();
          built.hud.camera.updateMatrixWorld();
          built.hud.scene.updateMatrixWorld();
        }
        raycaster.setFromCamera(pointer, built.hud.camera);
        const onHud = raycaster.intersectObjects(built.hudTargets, false);
        if (onHud.length > 0) return hotspotFor(onHud[0].object);
        raycaster.setFromCamera(pointer, camera);
        const inWorld = raycaster.intersectObjects(built.worldTargets, false);
        return inWorld.length > 0 ? hotspotFor(inWorld[0].object) : null;
      };

      const setPointer = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        pointerInside = true;
      };

      const onPointerMove = (event: PointerEvent) => setPointer(event);
      const onPointerLeave = () => {
        pointerInside = false;
        hovered = null;
        host.style.cursor = "";
      };
      const onPointerDown = (event: PointerEvent) => {
        setPointer(event);
        down = { x: event.clientX, y: event.clientY, at: performance.now() };
      };

      const activate = (hotspot: Hotspot) => {
        if (hotspot.kind === "scroll" && hotspot.section) {
          document.getElementById(hotspot.section)?.scrollIntoView({
            behavior: reduce ? "auto" : "smooth",
            block: "start",
          });
        } else if (hotspot.kind === "link" && hotspot.href) {
          if (hotspot.href.startsWith("mailto:")) {
            window.location.href = hotspot.href;
          } else {
            window.open(hotspot.href, "_blank", "noopener,noreferrer");
          }
        } else if (hotspot.kind === "toggle" && hotspot.entry) {
          setActiveEntry(getActiveEntry() === hotspot.entry ? null : hotspot.entry);
        } else if (hotspot.kind === "reveal") {
          reveal(hotspot);
        }
      };

      const onPointerUp = (event: PointerEvent) => {
        const press = down;
        down = null;
        if (!press) return;
        // A drag is a scroll gesture, not a tap.
        if (
          Math.abs(event.clientX - press.x) > TAP_SLOP ||
          Math.abs(event.clientY - press.y) > TAP_SLOP ||
          performance.now() - press.at > TAP_TIME
        ) {
          return;
        }
        setPointer(event);
        const hit = pick();
        if (hit) {
          revealScrollY = window.scrollY;
          activate(hit);
        }
      };

      host.addEventListener("pointermove", onPointerMove);
      host.addEventListener("pointerleave", onPointerLeave);
      host.addEventListener("pointerdown", onPointerDown);
      host.addEventListener("pointerup", onPointerUp);

      /* ---- keyboard focus, mirrored from the DOM ---- */

      const onFocusIn = (event: FocusEvent) => {
        const element = (event.target as HTMLElement | null)?.closest?.("[data-world]");
        const id = element instanceof HTMLElement ? element.dataset.world : undefined;
        focused = id ? built.hotspots.find((hotspot) => hotspot.id === id) ?? null : null;
        if (!focused) ring.style.opacity = "0";
      };
      const onFocusOut = () => {
        focused = null;
        ring.style.opacity = "0";
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") closeReveals();
      };
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("focusin", onFocusIn);
      document.addEventListener("focusout", onFocusOut);

      /* The focus ring is the one piece of DOM painted over the world: a
         keyboard visitor has to be able to see where they are, and a ring
         drawn in WebGL would still need to be measured in screen pixels. */
      const corner = new THREE.Vector3();
      const drawFocusRing = () => {
        if (!focused) return;
        const mesh = focused.object as THREE.Mesh;
        const geometry = mesh.geometry;
        if (!geometry) {
          ring.style.opacity = "0";
          return;
        }
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        if (!bounds) {
          ring.style.opacity = "0";
          return;
        }
        const isHud = built.hudTargets.includes(mesh);
        const activeCamera = isHud ? built.hud.camera : camera;
        mesh.updateWorldMatrix(true, false);

        // Only the face turned toward the camera. Projecting the whole box
        // would ring the control's extrusion as well, which reads as a
        // misaligned outline floating around it.
        const { clientWidth, clientHeight } = host;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < 4; i += 1) {
          corner.set(
            i & 1 ? bounds.max.x : bounds.min.x,
            i & 2 ? bounds.max.y : bounds.min.y,
            bounds.max.z
          );
          corner.applyMatrix4(mesh.matrixWorld).project(activeCamera);
          const x = (corner.x * 0.5 + 0.5) * clientWidth;
          const y = (-corner.y * 0.5 + 0.5) * clientHeight;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        ring.style.opacity = "1";
        ring.style.transform = `translate(${minX - 5}px, ${minY - 5}px)`;
        ring.style.width = `${maxX - minX + 10}px`;
        ring.style.height = `${maxY - minY + 10}px`;
      };

      /* ---- loop ---- */

      let frameId = 0;
      const timer = new THREE.Timer();

      const renderFrame = () => {
        frameId = requestAnimationFrame(renderFrame);
        timer.update();
        // A generous clamp, not a tight one: after a long stall (a throttled
        // background tab, a slow first paint) the camera should land near its
        // stop on the next frame instead of crawling there.
        const dt = Math.min(timer.getDelta(), 0.25);
        const elapsed = timer.getElapsed();

        // Any real scrolling slides an open terrace back into the stone: the
        // descent resumes with the monument whole.
        if (opened.size > 0 && Math.abs(window.scrollY - revealScrollY) > 36) closeReveals();

        const wanted = scrollJourney();
        // Under reduced motion the monument tracks the scroll exactly — direct
        // manipulation, the same as dragging a page. Only the easing goes,
        // because that is the part that reads as animation. Snapping to whole
        // storeys instead would make everything below the fold of a tall facet
        // unreachable, which is a worse outcome than the motion.
        currentIndex = reduce
          ? wanted
          : currentIndex + (wanted - currentIndex) * (1 - Math.exp(-dt * 5.5));
        applyCamera(currentIndex);

        built.update({ elapsed, dt, reduce });

        built.hotspots.forEach((hotspot, i) => {
          const wantHover = hotspot === hovered ? 1 : 0;
          const wantFocus = hotspot === focused ? 1 : 0;
          const rate = Math.min(1, dt * 14);
          built.hover[i] += (wantHover - built.hover[i]) * (reduce ? 1 : rate);
          built.focus[i] += (wantFocus - built.focus[i]) * (reduce ? 1 : rate);
          hotspot.setState(built.hover[i], built.focus[i]);
        });

        built.hud.update({ index: currentIndex, elapsed, dt, reduce, progress: currentIndex });

        renderer.clear();
        renderer.render(scene, camera);
        renderer.clearDepth();
        renderer.render(built.hud.scene, built.hud.camera);

        // Drawing has just refreshed every matrix, so this pick is free; the
        // hover it finds is applied at the top of the next frame.
        hovered = pick(false);
        host.style.cursor = hovered ? "pointer" : "";
        drawFocusRing();
      };

      const onVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(frameId);
          frameId = 0;
        } else if (frameId === 0) {
          frameId = requestAnimationFrame(renderFrame);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      const onMotionChange = (event: MediaQueryListEvent) => {
        reduce = event.matches;
      };
      motionQuery.addEventListener("change", onMotionChange);

      document.documentElement.dataset.world = "on";
      frameId = requestAnimationFrame(renderFrame);

      teardown = () => {
        delete document.documentElement.dataset.world;
        cancelAnimationFrame(frameId);
        window.clearTimeout(relayoutTimer);
        hostObserver.disconnect();
        bodyObserver.disconnect();
        window.removeEventListener("resize", remeasure);
        window.removeEventListener("load", remeasure);
        motionQuery.removeEventListener("change", onMotionChange);
        document.removeEventListener("visibilitychange", onVisibility);
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("focusin", onFocusIn);
        document.removeEventListener("focusout", onFocusOut);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("pointerup", onPointerUp);
        release(built);
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    void start();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  return (
    <div className={styles.world}>
      <div ref={hostRef} className={styles.canvasHost} />
      <div ref={ringRef} className={styles.focusRing} aria-hidden="true" />
    </div>
  );
}
