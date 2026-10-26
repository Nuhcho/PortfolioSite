import * as THREE from "three";
import type { ArchitectureAssets, ModelMaterials, ModelName } from "./models";

/* The world is measured in units, and one unit is always UNIT_PX CSS pixels —
   the camera's zoom is derived from this and nothing else. That is what keeps
   body copy the same readable size on every island and at every viewport: a
   section with more content grows taller in units and the camera pans down it,
   rather than zooming out until the type goes to nothing. */
export const UNIT_PX = 54;

/* Sunlit limestone, jewel-coloured masonry and deep violet recesses.
   Reading faces use pale versions of the same stone, so the architecture
   stays colourful without reducing the contrast of the portfolio text. */
export const COLOR = {
  // --- solids: the mass of the building ---
  ivory: 0xfff2d5,
  ivoryDeep: 0xe4cd9f,
  ivoryShadow: 0xac9979,
  rose: 0xec8a7f,
  roseDeep: 0xd0645f,
  teal: 0x9bceb8,
  tealDeep: 0x67a597,
  lilac: 0xb7a6d9,
  lilacDeep: 0x8a78bd,
  sand: 0xecc374,
  sandDeep: 0xd9a441,

  /* The architecture's own stones: the games' pastels. Each comes as a pair
     a clear step apart in value — the stone and its shadowed course — so a
     flank still parts cleanly from the cream top beside it and the edge
     between two faces stays sharp however soft the colours are. One muted
     plum serves every opening, the darkest value on the site, so a window
     is a hole rather than a smudge without punching a black spot in a
     pastel world. */
  jade: 0x63bbb2,
  jadeDeep: 0x2a8188,
  iris: 0x8eafbf,
  irisDeep: 0x547f99,
  saffron: 0xecc374,
  saffronDeep: 0xc1934b,
  madder: 0xe58c79,
  madderDeep: 0xba675c,
  opening: 0x284c61,

  /* The island itself: a lawn ring round a paved field, on lilac rock. Green
     is the one hue the architecture never uses, so the ground reads as ground
     however densely it is built on. */
  lawn: 0x9acb9b,
  lawnDeep: 0x509d84,
  rock: 0x658b9b,
  rockDeep: 0x3c657c,

  /** the one saturated note in the world, reserved for what can be operated */
  accent: 0xdf836d,
  sun: 0xecc374,

  // --- pales: the faces an inscription is cut into ---
  paleIvory: 0xfff4dc,
  paleRose: 0xf9e1d5,
  paleTeal: 0xe2eee3,
  paleLilac: 0xe0eaf1,
  /** the one face cut below its surroundings */
  sunken: 0xefe3c0,
  paleSun: 0xffe7ac,

  /** the ink hues as numbers, for the few marks drawn as geometry rather than
      painted — a scroll cue, a rule — so they match inscribed text */
  inkText: 0x221f20,
  inkMuted: 0x5c5354,
  paper: 0xfefefe,
};

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

/* The skies the journey passes through, one pair per folly, top of the
   frame to the bottom. All pastel, the way the games' skies are: peach into
   rose at the start, through periwinkle and lavender, to sea-glass at the
   end. Light enough that charcoal ink and the cream stone both hold against
   every one of them. The camera blends between neighbours as it turns, so
   the sky changes with the site rather than cutting. */
export const SKIES: readonly (readonly [string, string])[] = [
  ["#c6e6e6", "#77b7c7"],
  ["#c2e2e5", "#70adc1"],
  ["#c5e1e4", "#7fb4c3"],
  ["#c6e5df", "#7ebcbf"],
  ["#d4e7db", "#80bfbf"],
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
  readonly lanternPositions={value:Array.from({length:5},()=>new THREE.Vector3())};
  private edgeMaterial?: THREE.LineBasicMaterial;
  private edges = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();

  constructor(private readonly assets?: ArchitectureAssets) {}

  model(name: ModelName, materials: ModelMaterials) {
    return this.assets?.instantiate(name, materials);
  }

  track<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  /** Three explicit light bands are shared by every solid in the world. */
  lit(color: number, extra?: THREE.MeshStandardMaterialParameters) {
    const parameters = { ...extra };
    delete parameters.roughness;
    delete parameters.metalness;
    const material = this.track(new THREE.MeshToonMaterial({ ...parameters, color }));
    // Explicit band thresholds preserve a bright sunlit face, a readable side
    // face and a cool shadow face. Cast shadows still use Three's light pass.
    material.onBeforeCompile = (shader) => {
      shader.uniforms.lanternNight=this.lanternNight;
      shader.uniforms.lanternPositions=this.lanternPositions;
      shader.vertexShader=`uniform float lanternNight;uniform vec3 lanternPositions[5];varying float lanternFill;
${shader.vertexShader}`
        .replace("#include <project_vertex>", `#include <project_vertex>
          vec4 lanternVertex=vec4(transformed,1.);
          #ifdef USE_INSTANCING
            lanternVertex=instanceMatrix*lanternVertex;
          #endif
          vec3 lanternWorld=(modelMatrix*lanternVertex).xyz;
          lanternFill=0.;
          if(lanternNight>.5){
            for(int i=0;i<5;i++){
              vec3 delta=lanternPositions[i]-lanternWorld;
              float falloff=pow(max(0.,1.-length(delta)/8.),2.);
              vec3 toward=normalize(mat3(viewMatrix)*delta);
              lanternFill+=falloff*max(.15,dot(normalize(transformedNormal),toward));
            }
          }
        `);
      shader.fragmentShader=`varying float lanternFill;
${shader.fragmentShader}`
        .replace("#include <opaque_fragment>",`outgoingLight += diffuseColor.rgb * vec3(1.,.54,.22) * min(lanternFill,.8) * .95;
#include <opaque_fragment>`);
      shader.fragmentShader = shader.fragmentShader.replace("#include <gradientmap_pars_fragment>", `
        vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
          float facing = dot(normal, lightDirection);
          if (facing > .65) return vec3(1.0);
          if (facing > -.1) return vec3(.40, .50, .64);
          return vec3(.28, .36, .48);
        }
      `);
    };
    material.customProgramCacheKey = () => "coastal-cel-three-bands-lanterns-v3";
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
      color: 0x31566a, transparent: true, opacity: 0.36, depthWrite: false,
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
