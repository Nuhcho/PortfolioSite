# scripts

## `build-typeface.py`

Regenerates `public/fonts/unbounded-600.typeface.json`, the outline data the
world's display type is extruded from. The site's 3D headings are real
Unbounded glyphs, so the geometry has to come from the same font file
`next/font` serves for the DOM mirror — not a lookalike.

```sh
python3 -m venv .venv && ./.venv/bin/pip install fonttools brotli
curl -sSLo Unbounded.ttf \
  'https://raw.githubusercontent.com/google/fonts/main/ofl/unbounded/Unbounded%5Bwght%5D.ttf'
./.venv/bin/python scripts/build-typeface.py Unbounded.ttf \
  public/fonts/unbounded-600.typeface.json 600
```

**Provenance.** Source: `google/fonts@main:ofl/unbounded/Unbounded[wght].ttf`,
the upstream variable font, instanced at `wght=600` (the display weight
`DESIGN.md` commits to). Licensed under the SIL Open Font License 1.1; the
license text ships beside the JSON at `public/fonts/OFL.txt`. Output carries
114 glyphs — ASCII plus the punctuation and accents the real content uses.

The emitted path commands follow `three/examples/jsm/loaders/FontLoader.js`
exactly, including its `q`/`b` ordering, which puts the **end point first**.
