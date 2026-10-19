"""Convert a (variable) TTF into the three.js FontLoader "typeface.json" shape.

Outlines are unioned (overlaps removed) before extraction — see convert().

Emitted path commands follow three/examples/jsm/loaders/FontLoader.js exactly:
  m x y                      moveTo
  l x y                      lineTo
  q endX endY ctrlX ctrlY    quadraticCurveTo (END point first)
  b endX endY c1x c1y c2x c2y  bezierCurveTo (END point first)
Winding is passed through untouched: ShapePath.toShapes() derives holes from
contour direction, and TrueType's own direction is what facetype.js ships.
"""
import json
import sys
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.varLib.instancer import instantiateVariableFont


def r(v):
    # Font units are integral at upem 1000; keep one decimal for instanced
    # interpolation remainders and drop a trailing ".0" so the file stays small.
    v = round(v, 1)
    return int(v) if v == int(v) else v


class TypefacePen(BasePen):
    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.cmds = []

    def _moveTo(self, pt):
        self.cmds += ["m", r(pt[0]), r(pt[1])]

    def _lineTo(self, pt):
        self.cmds += ["l", r(pt[0]), r(pt[1])]

    def _qCurveToOne(self, pt1, pt2):
        self.cmds += ["q", r(pt2[0]), r(pt2[1]), r(pt1[0]), r(pt1[1])]

    def _curveToOne(self, pt1, pt2, pt3):
        self.cmds += [
            "b", r(pt3[0]), r(pt3[1]),
            r(pt1[0]), r(pt1[1]),
            r(pt2[0]), r(pt2[1]),
        ]

    def _closePath(self):
        pass


CHARSET = (
    "".join(chr(c) for c in range(0x20, 0x7F))
    + "·—–‘’“”…×°©"
    + "éáíóúñüö"
)


def convert(src, dst, weight):
    font = TTFont(src)
    if "fvar" in font:
        font = instantiateVariableFont(font, {"wght": weight}, inplace=True)

    # Type designers let strokes overlap and outlines self-intersect, because
    # every rasterizer resolves that with the nonzero winding rule. three.js
    # does not rasterize — it triangulates with Earcut, which needs simple
    # polygons, and silently fills the counters of a glyph like "N" when it
    # doesn't get them. Union the outlines first and that whole class of
    # broken glyph disappears.
    removeOverlaps(font)

    upem = font["head"].unitsPerEm
    cmap = font.getBestCmap()
    glyph_set = font.getGlyphSet()
    hmtx = font["hmtx"]

    glyphs = {}
    missing = []
    for ch in CHARSET:
        name = cmap.get(ord(ch))
        if name is None:
            missing.append(ch)
            continue
        pen = TypefacePen(glyph_set)
        glyph_set[name].draw(pen)
        advance, _ = hmtx[name]
        entry = {"ha": r(advance)}
        # x bounds come from the glyf table, never from scanning the command
        # stream — that stream interleaves x and y.
        glyf = font["glyf"][name] if "glyf" in font else None
        if glyf is not None and glyf.numberOfContours != 0 and hasattr(glyf, "xMin"):
            entry["x_min"] = r(glyf.xMin)
            entry["x_max"] = r(glyf.xMax)
        else:
            entry["x_min"] = 0
            entry["x_max"] = r(advance)
        if pen.cmds:
            entry["o"] = " ".join(str(c) for c in pen.cmds)
        glyphs[ch] = entry

    head = font["head"]
    hhea = font["hhea"]
    post = font["post"]
    data = {
        "glyphs": glyphs,
        "familyName": "Unbounded",
        "ascender": r(hhea.ascent),
        "descender": r(hhea.descent),
        "underlinePosition": r(post.underlinePosition),
        "underlineThickness": r(post.underlineThickness),
        "boundingBox": {
            "yMin": r(head.yMin),
            "xMin": r(head.xMin),
            "yMax": r(head.yMax),
            "xMax": r(head.xMax),
        },
        "resolution": upem,
        "original_font_information": {
            "format": 0,
            "copyright": "Unbounded, SIL Open Font License 1.1 (OFL.txt, google/fonts)",
            "fontFamily": "Unbounded",
            "fontSubfamily": f"wght {weight:g}",
            "licenseURL": "https://scripts.sil.org/OFL",
        },
        "cssFontWeight": str(int(weight)),
        "cssFontStyle": "normal",
    }
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(data, fh, separators=(",", ":"))
    print(f"wrote {dst}: {len(glyphs)} glyphs, missing={missing!r}")


if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2], float(sys.argv[3]))
