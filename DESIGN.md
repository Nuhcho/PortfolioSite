# The Monument

The page is one object: a stepped Monument Valley keep, drawn entirely by
three.js. There is no page to scroll — there is a tower to go down. Scrolling
turns the keep a quarter and drops you a storey at the same time, and each
storey carries one section of the portfolio on a great facet cut into its
side. The DOM underneath is an accessibility mirror that doubles as the no-JS
/ no-WebGL page, gated on `html[data-world="on"]`.

Five storeys, five sections, a quarter turn each: 300° in all, which lands
Contact on the same face the hero started on. You come all the way down and
arrive back where you began.

## The camera is the whole trick

`ISO_DIR = (1,1,1).normalize()` — true isometric, locked, never moving off
that axis. Three things follow, and the build rests on all three.

**1. One wall orientation is both readable and part of the solid.** Take a
*vertical* wall whose outward normal points horizontally straight at the
camera: travelling along it moves purely across the screen and not one pixel up
or down, so baselines stay level with no shear and no pre-distortion — only a
stretch up the wall's own height, which each face group carries as a scale.
Everything inside is then laid out in plain screen units.

Every other orientation fails, and both failures were built before this one was
found. A plane square to the view axis reads perfectly but is *tilted*, so it
can only ever stand off the tower's corner as a slab in front of it — no amount
of clearance makes that part of the building. A wall at 45° to the eye is part
of the solid but needs its type sheared onto it, and a sheared solid is a cheat
that only holds from one angle, which is fatal on a thing that turns.

**Why the shaft has eight sides.** A square prism turned to put one face flat to
the eye puts its neighbours exactly edge-on: they project to nothing and the
tower reads as a flat rectangle. An octagon's neighbours sit at 45° to the
reading face and recede properly, so the shaft stays a solid you can see around.
The face is only 0.765 of the shaft's flat-to-centre distance while the
silhouette is 2.17 of it, so the shaft is sized from the column it has to
carry — a 59-character measure makes a tower about three times that wide.

**2. Translating along (1,1,1) changes depth without moving a pixel.** Every
storey carries a flight cut in two and pushed apart along that axis. The axis
has to be exactly that one: for three rounds the flight was pushed along the
facet's local Z instead — the wall's own normal, which is the *horizontal
projection* of the view axis. The difference is pure screen Y, so the halves
sat a step apart at every angle, including the quarter where they were meant
to fuse, and the device read as rubble. `VIEW_SPLIT` now derives the offset
from `ISO_DIR` rather than declaring it. At the
storey's own quarter the two halves land on the same pixels and the stair is
whole; at any other angle it is visibly two pieces of stone that do not meet.
They are two solid flights that happen to line up from exactly one direction —
the Monument Valley mechanic itself, free on this camera.

**3. Every horizontal surface sweeps a vertical band.** A horizontal face in an
isometric picture reaches more than half its own width *down* the screen from
its near corner — eight screen units, at this shaft's size. So a cornice, a
setback, or the annulus where one storey steps out past the next hangs straight
across the wall above or below it, whatever its depth. A battered tower cannot
have a readable wall on it. The shaft is therefore one clean prism from crown to
foot, and the storeys are told apart by their stone rather than by stepping; the
only horizontal faces left are the crown's and the foot's, both flush.

One storey's stone also has to end exactly where the next one's begins. A storey
is placed by its content, so sizing its prism from its own content leaves a gap
wherever two neighbours differ in length — and those gaps expose the underside
of the prism above, which is case 3 again.

**Unit ↔ pixel contract, and where it has to stop.** `UNIT_PX = 54`. While a
facet is being read, zoom derives from that and nothing else, so body copy is
the same size on every facet; a facet with more content grows taller and the
camera pans down it rather than zooming out.

Held through the turn as well, that contract is what kept the keep from ever
being seen. The shaft is about three times the reading measure wide, so at 54
px to the unit it is several times wider than the viewport: five storeys of
wall, flanking a column of copy, and no monument anywhere. "Every word in
WebGL at a fixed size" and "it reads as Monument Valley" are in direct
conflict, and for three rounds the contract won by default. The turn now
abandons it deliberately — see Motion.

**Measure, never declare.** `screenBox()` reads real vertices; composition and
camera framing both work from it.

## Light

three's lights are in physical units: a Lambert surface returns
`irradiance / PI`, so an ambient of PI renders a flat colour at exactly the
hex it was authored as. Below that, every pastel comes back a shade of mud.
Solved directly — a sunlit top lands at 1.03× its own colour, the +X face at
0.90, the +Z face at 0.855, and that is the whole of the modelling.

- ambient `2.33`, sun `1.01` from (10,16,7), fill `0.30` from (-9,5,-9)
- **No shadow map, and this was tested rather than assumed.** It went on for
  the keep, on the theory that one solid object would not suffer what a
  landscape of interlocking districts did. It threw banded self-shadowing
  straight across the facets and the copy on them; a keep this full of
  coplanar courses has the same problem at any bias worth having. Depth comes
  from per-face tinting, from the setbacks each course steps through, and from
  overlap.

## Palette — three tiers, and the tier decides the use

### Solid tier — the mass of a piece
Ivory `#f4e9df` / `#e3d4c8` / `#c8bcbc`, Rose `#e3b2ad` / `#c99490`,
Teal `#a8cdc8` / `#86aeaa`, Lilac `#c6bada` / `#a79ac0`, Sand `#e5cfa4` /
`#cbb384`. Rose is the applied-ML channel, teal the systems channel, Sun
`#f0c674` the one reserved beacon. Accent `#d9728f` is the single saturated
note, reserved for what can be operated.

One course of the keep per storey and each a different stone — teal, lilac,
rose, sand, teal. Flat pastel needs the hue change to tell one course from the
next: with no shadow map there is nothing else separating two faces that meet
at a step.

### Pale tier — the only surfaces an inscription is cut into
Ivory `#f4e9df`, Rose `#f5dcd9`, Teal `#d8e9e6`, Lilac `#e6dfef`, Sun
`#f6e2b4`, Sunken `#e8dcd2` for the terrace. Each is the lighter member of a
material already standing in the keep, and a tablet's sides come from that
same material — which keeps a block of text reading as stone, not as a card.

### Ink tier — text only
Inscriptions are drawn **unlit** (`MeshBasicMaterial`), so light can never
shift them and these ratios hold at every point of the descent. Measured
against ivory `#f4e9df`, the lightest face any ink is cut into.

- **Ink** `#55474f` ~7.3:1 · **Ink Muted** `#6e5e66` ~5.1:1
- **Ink ML** `#9c5048` ~4.8:1 · **Ink Systems** `#336660` ~5.5:1
- **Ink Alert** `#75571f` ~5.6:1 — the one reserved fact (Lumen's throughput)

## Type

Two renderers, and the job decides which:

1. **Display type is real extruded geometry**, built from the same Unbounded
   outlines next/font serves the mirror (`scripts/build-typeface.py`). three
   triangulates with Earcut, not a rasterizer, and font outlines
   self-intersect — so the generator runs `fontTools.ttLib.removeOverlaps`
   before conversion, or counters fill in solid.
2. **Running copy is painted into a canvas** and mapped onto a tablet's face.

A heading is turned a few degrees off its facet, because type extruded down
the view axis shows no depth at all — the back face lands exactly behind the
front. The turn is what puts an edge on every letter, and the lift is what the
turn costs: yawing a wide line swings one end back by half its width times the
sine of the angle, and at a smaller lift the first letters of the name were
swallowed by the stone.

## The storeys

Each is a mass of three setback courses with a string course on every setback,
and a facet projecting from its near corner carrying the section. The keep
batters outward as it falls — narrow at the crown, broad at the foot.

**There are no terraces, and that is a decision rather than an omission.** A
terrace is the widest course a storey has and it sits at the storey's foot,
which is exactly the height of the next facet's head; its near corner reached
past that facet and hung an inverted V across the heading on it. The setbacks
and their string courses carry the stepped silhouette on their own, and they
are narrow enough never to reach anything.

## The copy is painted onto the stone

There is no panel, no bay, no floor, no jamb and no frame. Each block of copy is
a transparent plane of inked glyphs lying on the wall's own surface — which is
what lettering on a wall actually is.

Three earlier passes tried to express "embedded" as geometry: a slab standing
proud, then a recessed bay with a floor and jambs cut through a dressed skin,
then that same bay on an octagonal shaft. Each one added another sheet of pastel
a fraction of a unit from the last, and six of those stacked read as haze rather
than as depth. The flattest possible answer turned out to be the literal one.

The shaft is cut from the one pale stone every ink ratio is measured against, so
the reading face needs nothing laid over it at all. The other seven faces are
faced in that storey's own colour, standing a little proud — which leaves the
reading face the shallowest recess in the tower without putting a single extra
surface in front of the words.

## Why the type was soft

Textures were painted at 110 canvas pixels per world unit. One world unit is 54
CSS pixels, which on a 2× display is 108 device pixels — so every glyph was
being rendered at almost exactly 1:1 and then put through a mip chain and a
bilinear filter. That is a guaranteed blur however good the glyph is. Painting
at 248 oversamples by better than two, which is what makes an edge land on a
pixel.

## Motion

The document still scrolls — this is the part worth being precise about.
Scroll position drives rotation and descent. **Nothing is scroll-jacked:** the
scrollbar, trackpad momentum, space/PgDn, keyboard, deep links and
screen-reader order all survive, because the mirror remains the scroll track.
The site stops *looking* scrollable; mechanically it stays scrollable, which is
what keeps it usable.

A band is read, and then the keep is turned in the open. Up to `READ_END`
(0.52) the facet is square to the eye and the camera pans down it on the
unit↔pixel contract. After it the camera pulls back until the keep stands in
frame against sky, turns its quarter there, and dollies back in on the next
storey. Both phases run on one number, so arriving at a storey and its facet
coming square to the eye are one event rather than two kept in step.

**The turn is where the type used to break.** An inscription lies flat on its
wall, so it has no readable angle but square-on; doing the quarter-turn at
reading distance meant a sheared, slanting block of copy was the only thing on
screen for a third of every band. Inscriptions now fade out before the wall
has visibly moved (`INK_OUT`), so a facet is either readable or gone — never a
translucent slab with its controls hanging in the air behind it. Each facet
owns private copies of its materials to do that: the registry shares materials
across the whole keep by design, and fading a shared one would take four other
storeys with it.

The wide framing is measured rather than tuned — the keep's silhouette is read
from its own vertices once per build, with the facets hidden so an inscription
wider than its stone cannot inflate it. Pulling back is also what finally put
the split flights on screen: they had been built, and invisible, since the
round that introduced them.

Under `prefers-reduced-motion` the monument tracks scroll exactly, with the
easing removed — only the part that reads as animation goes. Snapping to whole
storeys instead would make everything below the fold of a tall facet
unreachable, which is worse than the motion.

## Known gaps

- Narrow / mobile layout is only partly verified. The harness now resizes far
  enough to render at 606px, where the wordmark abbreviates to NVK, the nav
  reduces to five hex marks and the hero sets correctly — but it will not hold
  a true phone viewport, so the narrow descent and its turns are unconfirmed
  below that width.
- `prefers-reduced-motion` cannot be toggled in this harness.
- ~~On the longest wrapped line of a few tablets the final glyph or two is not
  painted.~~ **Fixed.** It was the wrap measure, as suspected: `measureText().width`
  is the advance width — where the next glyph would start — which for the last
  glyph on a line is not where its ink stops. Overhanging terminals ride past
  their own advance, so a line measured as an exact fit lost its tail to the
  canvas edge. The measure now reads `actualBoundingBoxRight`, the real inked
  extent, and `WRAP_BLEED`'s 6% fudge is gone.
