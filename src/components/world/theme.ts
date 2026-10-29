import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ArchitectureAssets, ModelMaterials, ModelName } from "./models";

/* The world is measured in units, and one unit is always UNIT_PX CSS pixels —
   the camera's zoom is derived from this and nothing else. That is what keeps
   body copy the same readable size on every island and at every viewport: a
   section with more content grows taller in units and the camera pans down it,
   rather than zooming out until the type goes to nothing. */
export const UNIT_PX = 54;

/* Wind Waker-inspired coastal paint: cream stone, coral tiles, leaf greens,
   and cool blue shadows. Reading surfaces retain dark ink on pale stone. */
export const COLOR = {
  // --- solids: the mass of the building ---
  ivory: 0xfff1c9,
  ivoryDeep: 0xd8bc83,
  ivoryShadow: 0x9d9c75,
  rose: 0xf1b17d,
  roseDeep: 0xc88254,
  teal: 0x8fcfae,
  tealDeep: 0x38946b,
  lilac: 0x8bbcb2,
  lilacDeep: 0x447f81,
  sand: 0xf5d58b,
  sandDeep: 0xc89d52,

  // Paired pigments keep lit and shaded faces distinct; openings use navy.
  jade: 0x66b84d,
  jadeDeep: 0x29824b,
  iris: 0x55a9c6,
  irisDeep: 0x26728e,
  saffron: 0xffcf54,
  saffronDeep: 0xd49135,
  madder: 0xe75a3b,
  madderDeep: 0xb63f2e,
  opening: 0x173c60,

  // Lime foliage and weathered, moss-tinted quay stone.
  lawn: 0x92cb46,
  lawnDeep: 0x3d9248,
  rock: 0xaa9a71,
  rockDeep: 0x667d73,

  // Coral accents and sunny gold highlights.
  accent: 0xe75a3b,
  sun: 0xffcf54,

  // --- pales: the faces an inscription is cut into ---
  paleIvory: 0xfff4dc,
  paleRose: 0xf9e1d5,
  paleTeal: 0xcce5a4,
  paleLilac: 0xd8eae0,
  /** the one face cut below its surroundings */
  sunken: 0xefe3c0,
  paleSun: 0xffe7ac,

  /** the ink hues as numbers, for the few marks drawn as geometry rather than
      painted — a scroll cue, a rule — so they match inscribed text */
  inkText: 0x221f20,
  inkMuted: 0x5c5354,
  paper: 0xfefefe,
};

/** The ocean and its adjoining CSS background use the same day/night paints. */
export const SEA_COLOR = {
  day: { water: 0x166bc4, deep: 0x1050a4, light: 0x278bdb, shallow: 0x20bfb6, foam: 0xf2fff1 },
  night: { water: 0x102d60, deep: 0x091d42, light: 0x205085, shallow: 0x1b667d, foam: 0x91bad4 },
} as const;

/* The ink tier, as CSS strings. An inscription is drawn unlit, so these are
   the exact values the contrast ratios were measured at — the light never
   shifts them. Every ratio is against cream (#fcf2d2), the face all of them
   are cut into. */
export const INK = {
  text: "#221f20", // ~14.6:1
  muted: "#5c5354", // ~6.7:1
  ml: "#a63d36", // ~5.6:1
  systems: "#2c6a61", // ~5.6:1
  beacon: "#7a5710", // ~5.9:1
  face: "#f7f1e5",
  paper: "#fefefe",
};

/* Sky gradients for views that expose the horizon above the ocean. */
export const SKIES: readonly (readonly [string, string])[] = [
  ["#319be2", "#b4e9e7"],
  ["#379edb", "#c8efdd"],
  ["#398ed2", "#bfe3e8"],
  ["#38a7df", "#c4ecde"],
  ["#429dd9", "#d4efdd"],
];

/* Tracking, in em, for the two places type is set in capitals — the same
   two values Monument Valley's site uses for its titles and its nav. */
export const TRACK = {
  title: 0.14,
  label: 0.125,
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
  readonly lanternNight={value:0};
  readonly lanternPositions={value:Array.from({length:9},()=>new THREE.Vector3())};
  private edgeMaterial?: THREE.LineBasicMaterial;
  private edges = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
  private roundedBoxes = new Map<string, THREE.BufferGeometry>();

  constructor(private readonly assets?: ArchitectureAssets) {}

  model(name: ModelName, materials: ModelMaterials) {
    return this.assets?.instantiate(name, materials);
  }

  /** Actual dimensions keep the bevel small and consistent on long beams. */
  roundedBox(size: readonly number[], radius = .025) {
    const bevel = Math.min(radius, Math.min(...size) * .12);
    const key = `${size.join(",")}:${bevel}`;
    let geometry = this.roundedBoxes.get(key);
    if (!geometry) {
      geometry = this.geometry(new RoundedBoxGeometry(size[0], size[1], size[2], 2, bevel));
      this.roundedBoxes.set(key, geometry);
    }
    return geometry;
  }

  track<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  /** Three distinct ink-and-paint tones, with pixel-width antialiasing. */
  lit(color: number, extra?: THREE.MeshStandardMaterialParameters) {
    const parameters = { ...extra };
    delete parameters.roughness;
    delete parameters.metalness;
    const material = this.track(new THREE.MeshToonMaterial({ ...parameters, color }));
    // Colored shadow bands define forms without a plastic specular gradient.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.lanternNight=this.lanternNight;
      shader.uniforms.lanternPositions=this.lanternPositions;
      shader.vertexShader=`uniform float lanternNight;uniform vec3 lanternPositions[9];varying float lanternFill;
${shader.vertexShader}`
        .replace("#include <project_vertex>", `#include <project_vertex>
          vec4 lanternVertex=vec4(transformed,1.);
          #ifdef USE_INSTANCING
            lanternVertex=instanceMatrix*lanternVertex;
          #endif
          vec3 lanternWorld=(modelMatrix*lanternVertex).xyz;
          lanternFill=0.;
          if(lanternNight>.5){
            for(int i=0;i<9;i++){
              vec3 delta=lanternPositions[i]-lanternWorld;
              float falloff=pow(max(0.,1.-length(delta)/8.),2.);
              vec3 toward=normalize(mat3(viewMatrix)*delta);
              lanternFill+=falloff*max(.15,dot(normalize(transformedNormal),toward));
            }
          }
        `);
      shader.fragmentShader=`varying float lanternFill;
${shader.fragmentShader}`
        .replace("#include <opaque_fragment>",`float paintedLuma = dot(outgoingLight, vec3(.2126,.7152,.0722));
outgoingLight = max(vec3(0.), mix(vec3(paintedLuma), outgoingLight, 1.06));
float inkFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
float inkWidth = max(fwidth(inkFacing) * 1.25, .012);
float inkEdge = 1. - smoothstep(inkWidth, inkWidth * 2., inkFacing);
outgoingLight = mix(outgoingLight, diffuseColor.rgb * vec3(.10,.14,.25), inkEdge * .7);
outgoingLight += diffuseColor.rgb * vec3(1.,.54,.22) * min(lanternFill,.8) * .95;
#include <opaque_fragment>`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <gradientmap_pars_fragment>", `
        vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
          float facing = dot(normal, lightDirection);
          float aa = max(fwidth(facing) * .75, .006);
          vec3 shade = mix(vec3(.25,.39,.50), vec3(.61,.74,.76), smoothstep(.15-aa,.15+aa,facing));
          return mix(shade, vec3(1.,.98,.90), smoothstep(.65-aa,.65+aa,facing));
        }
      `);
    };
    material.customProgramCacheKey = () => "coastal-painted-cel-ink-lanterns-v8";
    return material;
  }

  /** Restrained ink edges on the large architectural volumes. */
  outline(mesh: THREE.Mesh) {
    let geometry = this.edges.get(mesh.geometry);
    if (!geometry) {
      geometry = this.geometry(new THREE.EdgesGeometry(mesh.geometry, 40));
      this.edges.set(mesh.geometry, geometry);
    }
    this.edgeMaterial ??= this.track(new THREE.LineBasicMaterial({
      color: 0x283b59, transparent: true, opacity: 0.4, depthWrite: false,
    }));
    mesh.add(new THREE.LineSegments(geometry, this.edgeMaterial));
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
    sand: registry.lit(COLOR.saffron),
    sandDeep: registry.lit(COLOR.saffronDeep),
    sandShadow: registry.lit(COLOR.ivoryShadow),
    deep: registry.lit(COLOR.opening),
    sea: registry.lit(COLOR.teal),

    // the island: lawn ring, paved field, the rock they sit on
    lawn: registry.lit(COLOR.lawn),
    lawnDeep: registry.lit(COLOR.lawnDeep),
    rock: registry.lit(COLOR.rock),
    rockDeep: registry.lit(COLOR.rockDeep),

    // the two channels, the reserved beacon, and the one operable accent
    ml: registry.lit(COLOR.madder),
    systems: registry.lit(COLOR.jade),
    connector: registry.lit(COLOR.iris),
    accent: registry.lit(COLOR.accent),
    beacon: registry.lit(COLOR.sun, {
      roughness: 0.6,
      emissive: new THREE.Color(COLOR.sun),
      emissiveIntensity: 0.15,
    }),

    /* Extruded display type is lit, not painted, and cut from charcoal: the
       one value that reads against every sky the descent passes through. */
    displayLit: registry.lit(COLOR.inkText, { roughness: 0.86 }),

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
    faceControl: registry.facade(COLOR.sand),
    faceSun: registry.facade(COLOR.paleSun),

    /* A piece's sides belong to the same material as the face cut into it, so
       a block of rose is rose all the way through rather than a pale panel
       mounted on something else. */
    sides: {
      sand: [registry.lit(COLOR.ivoryDeep), registry.lit(COLOR.ivoryShadow)] as const,
      coral: [registry.lit(COLOR.madder), registry.lit(COLOR.madderDeep)] as const,
      sea: [registry.lit(COLOR.jade), registry.lit(COLOR.jadeDeep)] as const,
      leaf: [registry.lit(COLOR.iris), registry.lit(COLOR.irisDeep)] as const,
      gold: [registry.lit(COLOR.saffron), registry.lit(COLOR.saffronDeep)] as const,
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
