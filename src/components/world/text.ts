import * as THREE from "three";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { INK, TYPE } from "./theme";

/* ------------------------------------------------------------------ *
 * Every word on this page is drawn by three.js. Two renderers do it:
 *
 *   1. Display type can be real extruded geometry, built from typeface
 *      outlines (see scripts/build-typeface.py). It is lit, it casts
 *      shadow, and it is architecture — not a texture of a heading.
 *   2. Running copy is painted into a canvas with the live webfont and
 *      mapped onto the facade of a slab standing in the world. The
 *      camera's isometric angle is locked, so a facade whose normal is
 *      ISO_DIR sits exactly parallel to the image plane: the glyphs stay
 *      pixel-crisp instead of being smeared across a receding surface.
 * ------------------------------------------------------------------ */

/* Canvas pixels per world unit, and the reason the type was soft.
 *
 * The desktop framing puts 54 CSS px in a unit, which on a 2× display is 108
 * device pixels — so painting at 110 put every glyph on screen at almost
 * exactly 1:1 and then ran it through a mip chain and a bilinear filter.
 * That is a guaranteed blur however good the glyph is. This oversamples by
 * better than two, which is what makes an edge land on a pixel. */
const PAINT_DPU = 248;
const MAX_CANVAS = 4096;
/** A hair of slack past the measured ink, for the antialiasing the rasterizer
    puts outside the outline itself. Not a fudge for the measure: `inkedWidth`
    below reads the real inked extent, so this covers only the filter. */
const WRAP_SLACK = 1.5;

let families = { display: "sans-serif", body: "sans-serif" };
let anisotropy = 1;

export function configureText(renderer: THREE.WebGLRenderer) {
  anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const root = getComputedStyle(document.documentElement);
  const display = root.getPropertyValue("--font-display").trim();
  const body = root.getPropertyValue("--font-body").trim();
  families = {
    display: display ? `${display}, sans-serif` : "sans-serif",
    body: body ? `${body}, sans-serif` : "sans-serif",
  };
}

/** next/font only fetches a face once something on the page asks for it, and
    the DOM mirror is clipped out of view — so ask explicitly, then wait, or
    the first painted panel bakes in the fallback metrics permanently. */
export async function ensureFonts() {
  const wanted = [
    `600 32px ${families.display}`,
    `400 16px ${families.body}`,
    `500 16px ${families.body}`,
    `700 16px ${families.body}`,
    `800 16px ${families.body}`,
  ];
  await Promise.all(
    wanted.map((font) => document.fonts.load(font).catch(() => undefined))
  );
  await document.fonts.ready;
}

/* ---------------- painted running copy ---------------- */

export type Run = {
  text: string;
  face?: "display" | "body";
  /** em height in world units; defaults to the body size */
  size?: number;
  weight?: number;
  color?: string;
  /** multiple of `size` */
  lineHeight?: number;
  /** letter-spacing in em */
  tracking?: number;
  upper?: boolean;
  /** a label, not a paragraph: keep it on one line whatever it measures */
  nowrap?: boolean;
  /** vertical space in world units before this run */
  gapBefore?: number;
  align?: "left" | "center";
  /** draw a rule above the run, inset to the text column */
  ruleBefore?: boolean;
  /** underline the run's last line with a 2px rule its own width — Monument
      Valley's mark for the line that introduces a title */
  underline?: boolean;
};

export type PaintedText = {
  texture: THREE.Texture;
  /** the text column, in world units */
  width: number;
  /** the stacked height of the runs, in world units */
  height: number;
  /** the texture's own extent, which a skewed inscription makes larger than
      the column it holds — this is what a plane showing it must be sized to */
  planeWidth: number;
  planeHeight: number;
};

type Placed = {
  lines: string[];
  run: Required<Pick<Run, "face" | "size" | "weight" | "color" | "lineHeight" | "tracking" | "align">>;
  top: number;
  rule: boolean;
  underline: boolean;
};

function fontString(run: Placed["run"], dpu: number) {
  const family = run.face === "display" ? families.display : families.body;
  return `${run.weight} ${(run.size * dpu).toFixed(2)}px ${family}`;
}

/* What `measureText().width` returns is the advance width — where the next
   glyph would start, which for the last glyph on a line is not where its ink
   stops. An italic-ish or overhanging terminal rides
   past its own advance, so a line measured as an exact fit loses the tail of
   its final glyph to the canvas edge. `actualBoundingBoxRight` is the inked
   extent, which is the thing that actually has to fit. */
function inkedWidth(ctx: CanvasRenderingContext2D, text: string) {
  const m = ctx.measureText(text);
  const right = m.actualBoundingBoxRight;
  const left = m.actualBoundingBoxLeft;
  // Safari reported these as undefined for years, and a headless 2D context
  // can still return NaN for an empty string.
  if (!Number.isFinite(right)) return m.width;
  // `left` is positive when ink starts left of the origin. Spanning both
  // sidebearings is what makes this comparable to a column width.
  return Math.max(m.width, right + (Number.isFinite(left) ? Math.max(0, left) : 0));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxPx: number) {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      return;
    }
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${line} ${words[i]}`;
      if (inkedWidth(ctx, candidate) <= maxPx) {
        line = candidate;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
  });
  return lines;
}

/* An inscription painted onto an isometric wall projects sheared: a run along
   the wall drifts up or down the screen as it goes, and glyphs compress
   horizontally more than vertically. `skew` pre-distorts the canvas by exactly
   the inverse, so type cut into a slanted face still reads level — the surface
   stays isometric, the words stay readable. Derived from the locked camera, so
   it is exact rather than eyeballed. */
export type Skew = { shear: number; stretchX: number };

export function paintText(spec: {
  width: number;
  runs: Run[];
  padding?: number;
  skew?: Skew;
}): PaintedText {
  const padding = spec.padding ?? 0;
  const column = spec.width - padding * 2;
  const dpu = Math.min(PAINT_DPU, MAX_CANVAS / Math.max(spec.width, 0.001));

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("2D canvas unavailable");

  const placed: Placed[] = [];
  let cursor = padding;

  spec.runs.forEach((raw) => {
    const run = {
      face: raw.face ?? "body",
      size: raw.size ?? TYPE.body,
      weight: raw.weight ?? (raw.face === "display" ? 600 : 400),
      color: raw.color ?? INK.text,
      lineHeight: raw.lineHeight ?? (raw.face === "display" ? 1.2 : 1.55),
      tracking: raw.tracking ?? 0,
      align: raw.align ?? "left",
    } as Placed["run"];

    measure.font = fontString(run, dpu);
    setTracking(measure, run.tracking * run.size * dpu);
    const text = raw.upper ? raw.text.toUpperCase() : raw.text;
    const lines = raw.nowrap
      ? text.split("\n")
      : wrap(measure, text, column * dpu - WRAP_SLACK);

    cursor += raw.gapBefore ?? 0;
    placed.push({
      lines,
      run,
      top: cursor,
      rule: raw.ruleBefore ?? false,
      underline: raw.underline ?? false,
    });
    cursor += lines.length * run.size * run.lineHeight;
  });

  const height = cursor + padding;
  const skew = spec.skew;
  const stretchX = skew?.stretchX ?? 1;
  // A sheared inscription needs headroom: the drift across the face's width
  // has to land inside the texture.
  const bleed = skew ? Math.abs(skew.shear) * spec.width * stretchX : 0;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(spec.width * stretchX * dpu));
  canvas.height = Math.max(2, Math.round((height + bleed) * dpu));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  if (skew) {
    // (x, y) → (sx·x, y + shear·sx·x), in device pixels.
    const sx = stretchX;
    ctx.setTransform(sx, skew.shear * sx, 0, 1, 0, skew.shear < 0 ? bleed * dpu : 0);
  }
  // Painting happens in device pixels, with the same font string the measure
  // pass used. Scaling the context into world units instead would mean asking
  // for a sub-pixel font size, and the precision lost rounding that is enough
  // to push a measured-to-fit line past the edge of its own canvas.
  ctx.textBaseline = "alphabetic";

  placed.forEach(({ lines, run, top, rule, underline }) => {
    if (rule) {
      ctx.fillStyle = "rgba(34, 31, 32, 0.14)";
      ctx.fillRect(padding * dpu, (top - run.size * 0.62) * dpu, column * dpu, 1);
    }
    ctx.font = fontString(run, dpu);
    setTracking(ctx, run.tracking * run.size * dpu);
    ctx.fillStyle = run.color;
    ctx.textAlign = run.align === "center" ? "center" : "left";
    const x = (run.align === "center" ? spec.width / 2 : padding) * dpu;
    lines.forEach((line, i) => {

      // `top` is the run's box top; drop to the first baseline, which sits
      // roughly 0.78em down for Cabin at the line heights used here.
      const baseline = (top + run.size * run.lineHeight * i + run.size * 0.78) * dpu;
      ctx.fillText(line, x, baseline);

      if (underline && i === lines.length - 1) {
        // Tracking adds a trailing space after the last letter; the rule
        // should end on the ink, not on the gap after it.
        const trailing = run.tracking * run.size * dpu;
        const span = ctx.measureText(line).width - trailing;
        const left = run.align === "center" ? x - span / 2 : x;
        const weight = Math.max(2, run.size * dpu * 0.08);
        ctx.fillRect(left, baseline + run.size * 0.42 * dpu, span, weight);
      }
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  return {
    texture,
    width: spec.width,
    height,
    planeWidth: spec.width * stretchX,
    planeHeight: height + bleed,
  };
}

/** Width of one short, unwrapped string in world units. */
export function measureInline(spec: {
  text: string;
  face?: "display" | "body";
  size: number;
  weight?: number;
  tracking?: number;
}) {
  inlineCtx ??= document.createElement("canvas").getContext("2d");
  if (!inlineCtx) return spec.text.length * spec.size * 0.6;
  const dpu = 100;
  const run = {
    face: spec.face ?? "body",
    size: spec.size,
    weight: spec.weight ?? 400,
    color: "",
    lineHeight: 1,
    tracking: spec.tracking ?? 0,
    align: "left",
  } as Placed["run"];
  inlineCtx.font = fontString(run, dpu);
  setTracking(inlineCtx, run.tracking * run.size * dpu);
  return inlineCtx.measureText(spec.text).width / dpu;
}

let inlineCtx: CanvasRenderingContext2D | null = null;

function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing is still missing from the DOM lib in some TS versions, and
  // from Firefox before 127 — tracking is a refinement, never load-bearing.
  const target = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in target) target.letterSpacing = `${px.toFixed(2)}px`;
}

/* ---------------- extruded display type ---------------- */

let fontPromise: Promise<Font> | null = null;

export function loadDisplayFont() {
  fontPromise ??= new FontLoader().loadAsync("/fonts/unbounded-600.typeface.json");
  return fontPromise;
}

type FontData = {
  resolution: number;
  glyphs: Record<string, { ha: number }>;
};

/** Advance width of a single line, in world units, without building geometry. */
export function measureDisplay(font: Font, text: string, size: number) {
  const data = font.data as unknown as FontData;
  const scale = size / data.resolution;
  return Array.from(text).reduce((total, char) => {
    const glyph = data.glyphs[char] ?? data.glyphs["?"];
    return total + (glyph ? glyph.ha * scale : 0);
  }, 0);
}

/** The largest size at or below `size` that keeps every line inside `maxWidth`. */
export function fitDisplay(font: Font, lines: string[], size: number, maxWidth: number) {
  const widest = Math.max(...lines.map((line) => measureDisplay(font, line, size)));
  return widest <= maxWidth ? size : size * (maxWidth / widest);
}

export type DisplayLine = {
  geometry: THREE.ExtrudeGeometry;
  width: number;
};

/* A line facing the camera dead-on would hide its own extrusion — the depth
   runs straight down the view axis and not one side face is visible. These
   two small turns are what let the sun rake a letter's right and top faces,
   so the heading reads as carved blocks standing in the world rather than as
   a flat picture of a heading. Legibility is barely touched: a 12° yaw costs
   2% of letter width. */
const DISPLAY_YAW = -0.21;
const DISPLAY_PITCH = -0.1;

/** One line of extruded letterforms, origin at the left edge of the baseline. */
export function displayLine(font: Font, text: string, size: number, depth = size * 0.3): DisplayLine {
  const shapes = font.generateShapes(text, size);
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: size * 0.014,
    bevelSize: size * 0.014,
    bevelOffset: 0,
    bevelSegments: 1,
    curveSegments: 4,
  });
  const width = measureDisplay(font, text, size);
  // Pivot at the line's own centre so the turn doesn't swing a long line's
  // far end out of the column.
  geometry.translate(-width / 2, 0, -depth / 2);
  geometry.computeBoundingBox();
  return { geometry, width };
}

/** Wraps a line so its origin is the left edge of the baseline, with the
    turned, centre-pivoted letterforms inside. */
export function displayHolder(line: DisplayLine, material: THREE.Material) {
  const holder = new THREE.Group();
  const mesh = new THREE.Mesh(line.geometry, material);
  mesh.rotation.set(DISPLAY_PITCH, DISPLAY_YAW, 0);
  mesh.position.x = line.width / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  holder.add(mesh);
  return holder;
}
