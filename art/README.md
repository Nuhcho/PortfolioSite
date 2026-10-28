# Monument architectural kit

`monument-kit.blend` is the editable Blender source. The eight modules are laid
out next to each other on a modelling bench. Their runtime origins are at the
foot of the building; the stair origin is the low end and corbels extend down.

`../public/models/monument-kit.glb` is the web asset loaded by `GLTFLoader` in
`src/components/world/models.ts`. No external textures or decoder are required.
The world shares geometry between instances and applies its palette by material
role: stone, trim, shadow, accent, recess. Responsive walls and portfolio text
remain in Three.js; towers, pavilions, arcade bays, windows, corbels and connecting
stair flights come from the Blender kit.

## Rebuild

From the repository root, with Blender on PATH:

```sh
blender --background --factory-startup --python scripts/build-monument.py
```

The script rebuilds the source, GLB, and `monument-kit.json` dimensions report.
It supports Blender 2.78 (installed on the development machine) and newer
versions. A small embedded GLB exporter allows 2.78 to produce glTF 2.0 without
installing an exporter add-on. Modelling uses real extruded arch profiles,
recalculated outward normals, beveled masonry, smoothly shaded domes, and a
continuous stair profile with gently rounded nosings.
Export rejects non-manifold mesh edges and zero-area triangles.

Changing the Python source and rebuilding regenerates the .blend. To preserve
manual edits to the .blend, export those edits separately rather than rebuilding.

## Validate the exported asset

```sh
node scripts/validate-monument.mjs
```

This loads the actual binary through Three.js, checks all eight named modules,
finite vertices, unit normals, material roles and the stair fitting dimensions.

## Waterfront rendering

The runtime uses three colored cel-shading bands with pixel-width antialiasing
and contour accents for the kit and procedural solids. Small bevels share
cached geometry by dimensions and radius; irregular tree crowns, petals, and
residents use instanced meshes. The quays extend below the sea, with rounded
shorelines and flat, irregular courtyard paving. `harbor.ts` adds a timber pier joined to the entrance apron,
boats, pilings, ropes, seagulls, foam rings, and a quantized water shader.
The ocean and wildlife are excluded from framing calculations, while the pier
and boats are included. Reduced-motion preference freezes the scenery.

`buildingDesign.ts` adds the gallery's sculpted crown, roof dormers, oculi,
iron balconies and friezes. The connected facades and roof heights are defined
in `plaza.ts`, with distinct pink, yellow, blue, jade and violet paint schemes.
`vesselDesign.ts` lofts closed hull sections into curved bilges, tapered bows,
transoms and timber decks, then adds sheer rails and cockpit fittings. Sail
stripes and sun motifs use undeformed cloth coordinates so the paint follows
the existing wind animation without detached overlay geometry.
