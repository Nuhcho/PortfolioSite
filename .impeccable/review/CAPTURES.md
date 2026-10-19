# Capture set — Round 3 ("the world takes the page")

Taken against the round-3 source after the kicker, wrap-clipping and
label-wrap fixes. Dev server at `localhost:3000`.

**Viewports.** Desktop captures are 1512 × 715 CSS px; narrow captures are
606 × 715. Chrome on this machine would not give the automation a window
shorter than ~715px of content area or narrower than ~606px, so a true
390px phone width and a tall desktop viewport are both outside what could
be captured here. The narrow layout branch (`width < 820`) is the one
exercised in the mobile captures.

**Settling.** Under this automation rAF is throttled while JavaScript is
being evaluated, so a capture taken immediately after a scroll catches the
camera mid-travel. Every frame below is the *second* of two consecutive
screenshots at the same scroll position, which is settled.

| File | What it shows |
|---|---|
| `desktop-island1.jpg` | Island 1 at rest: extruded name, intro slab, controls, credentials, spiral tower with the paradox-loop satellite and the gold beacon, HUD bar, scroll cue |
| `desktop-island2.jpg` | Island 2, top of its pan: heading, featured project slabs, metric plate, skyline |
| `desktop-island2-panned.jpg` | Island 2, lower in its pan: the "More Projects" list standing beside the skyline |
| `desktop-island3.jpg` | Island 3 with Lumen open by default — branching pipeline, stage labels, gold throughput fact, detail slab below |
| `desktop-island4.jpg` | Island 4: four capability slabs against four plateaus |
| `desktop-island5.jpg` | Island 5: the gate, its stair, the closing beacon, contact controls, stack line |
| `desktop-focus.jpg` | Keyboard focus synced from the DOM mirror: the control lifted, ring drawn around the face turned toward the camera |
| `desktop-fallback.jpg` | `data-world` absent — exactly the state of a no-JS or no-WebGL visit |
| `mobile-island1.jpg` … `mobile-island5.jpg` | The same five islands in the narrow branch: set-piece stacked under the reading column, HUD marks with no labels, current section named under the bar |
| `mobile-island3-pipeline.jpg` | The narrow pipeline treatment: no floating stage labels, stages named in the detail copy instead |

## Not captured

**`prefers-reduced-motion`.** This harness cannot toggle the OS-level
setting, and the browser automation available here exposes no media
emulation. It is therefore unevidenced, not omitted. What the code does:
`WorldCanvas` reads the media query and keeps it live; under reduce the
camera tracks the scroll with no easing (deliberately *not* snapping to
whole islands, which would strand everything below the fold of a tall one),
every ambient loop and pipeline pulse stops, hover and focus states become
instant, and `scrollIntoView` falls back to the CSS rule, which
`globals.css` sets to `auto` under the same query. A human should confirm
this visually before relying on it.
