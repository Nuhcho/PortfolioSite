---
version: 1
slug: "index"
primary_target: "index"
related_targets: []
---

# Surface: / (home — single-page portfolio)

Mode: Persuade. Visitor: recruiter/collaborator sizing up Nicolas Villegas-Kirchman's real AI/ML + software engineering work. Action: contact via email/LinkedIn/GitHub. Content is fixed (see PRODUCT.md Evidence on Hand) — Experience before Projects, no fabricated testimonials/press/metrics. No phone number published.

**REDESIGN, not a maturation.** The user explicitly asked to make the site "more professional looking" and to integrate Three.js for a Monument Valley aesthetic, stating plainly "if it breaks traditional neomorphism that is fine." Per the skill's own rule ("Refinement preserves; redesign replaces"), this supersedes the prior "Neomorphism (Matured)" world outright — the old soft-extrusion material, shadow vocabulary, and Sora/Hanken Grotesk pairing are retired as a world, kept only as evidence of what the subject is (a dual-discipline ML/systems engineer) rather than authority over what it becomes. Product truth, real content, evidence, and ordering (PRODUCT.md) are unchanged.

The visual direction — Monument Valley (impossible isometric architecture, flat-shaded low-poly forms, painterly jewel-tone light) — is **user-pinned**, not rolled from a concept-seed candidate list; it beats the roll per the skill's own rule. Confirmed with the user directly: the 3D treatment is woven through multiple sections (not hero-only), the signature interaction is a slow ambient auto-rotate (no pointer/scroll dependency, calm and painterly rather than fast), and the palette commits fully — a deep twilight ground with saturated jewel-tone accent roles, not a desaturated "corporate" pull.

## What's preserved from the prior round

- The real classification axis (accuracy/placement metric → ML, throughput/scale/improvement metric → systems) and its two-hue-family logic, carried into the new palette's two primary accent roles.
- One reserved accent confined to Lumen's real-time-throughput fact (the One Alert Rule), carried into the new gold/beacon accent.
- The press/disclosure interaction convention for Experience entries, rebuilt in the new material (isometric block press instead of soft-shadow inset).
- No phone number, no fabricated content, no invented metrics — same confirmed evidence, same order (Nav → Hero → Selected Work → Experience → Technical Capabilities → Contact).

## What's replaced

- **Material.** Soft dual-shadow extrusion on one gray plane → flat-shaded isometric geometry (live Three.js scenes plus a matching flat/isometric 2D component language) floating on a deep twilight ground. Borders stay absent, but shape now comes from faceted low-poly form and painterly directional light, not shadow-carving.
- **Color.** `#e0e5ec` neutral plane → a committed dark twilight ground with a full painterly palette (coral/terracotta, teal/jade, warm gold), closer to the game's actual saturated jewel tones than a muted "professional gray" reading. AA contrast is a hard requirement throughout, same as the prior round's standing rule — it is re-verified against the new dark ground, not inherited from the old light-ground numbers.
- **Typography.** Sora + Hanken Grotesk → a geometric/architectural display paired with a clean humanist body face, chosen to read distinctly "built," not a training-data default pairing.
- **Dimensionality.** The prior round's hero carried zero decorative visual elements by deliberate choice. This round reverses that: live Three.js is the headline deliverable, not an optional accent — an isometric structure in the hero, plus at least one further set-piece lower on the page (tying Experience's real pipeline facts — Lumen's branching pipeline, Kodely's RAG pipeline — into the same geometric material rather than flat SVG diagrams), each auto-rotating slowly and continuously as this round's one signature motion, with a static/reduced fallback for `prefers-reduced-motion` and low-power devices.

## Direction contract

**THESIS:** The dual-discipline claim (ships ML into real production systems, not either/or) is made spatially, not stated — and the page itself is a descent through one continuous impossible landscape, not a document with a 3D ornament bolted to its header. Scrolling flies the camera between five floating islands, each encoding one section's real content; the category-default (a hero canvas above a stack of flat cards) is exactly what this refuses.

**OWN-WORLD:** Deep twilight ground (`#171029`-family) carrying every surface; two committed jewel accents for the systems/ML axis (coral-terracotta for ML, teal-jade for systems — a deliberate swap of which hue leads is fine as long as it stays consistent with PRODUCT.md's metric-type rule) plus one reserved warm gold "beacon" accent for the single Lumen throughput fact; flat-shaded low-poly Three.js geometry (MeshStandardMaterial, one soft directional "sun" + ambient fill, no PBR gloss) for every 3D set-piece; a matching flat-color isometric 2D component language (beveled flat blocks, no blur/glass, no soft shadow) for cards, pills, and the nav. Display face: Unbounded (geometric, blocky, architectural weight). Body face: Manrope (clean geometric humanist sans).

**STORY:** A visitor lands beside a floating impossible structure. Scrolling descends the camera through one continuous archipelago — a skyline of shipped work, a terrace of real production pipelines, four plateaus of capability, and a closing gate — so the world is traveled, not sampled. Expanding an Experience entry lights its pipeline in that world and labels its stages. The visitor leaves believing this is someone who ships precise, considered systems, and takes the contact CTA.

**FIRST VIEWPORT:** Two rails. Left: the reading column (name, role line, summary, CTAs, credentials), capped for measure. Right: a fixed, full-height world viewport holding one shared Three.js canvas, parked at Island 1 — the spiral staircase tower with its paradox loop satellite and floating gold beacon, flat-shaded, lit by one warm sun plus cool fill, turning slowly. The rail's inner edge fades into the page ground so it reads as a window into the world, not a pasted panel. The primary CTA stays in the reading column.

**SIGNATURE INTERACTION:** Scroll drives the camera. Section positions are measured from the DOM, so arriving at a section arrives at its island; the camera's isometric angle is locked (position is always target + a fixed iso offset) so the projection never breaks mid-travel, and neighbouring islands pass through frame during the descent to prove it is one world. Slow per-island rotation survives from the previous round as the idle layer underneath. Under `prefers-reduced-motion` the camera snaps to the current section's island with no scrub, rotation, or pulse.

**FORM:** Monument Valley (impossible isometric architecture, flat-shaded painterly light) — user-pinned direction, confirmed directly rather than drawn from a rolled candidate list.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints / open decisions

Performance/accessibility: Three.js scenes must degrade gracefully — pause or drop to a static frame under `prefers-reduced-motion`, and the hero scene must not block first paint of the reading column's text/CTAs. No per-project GitHub/demo links or per-project tech-stack chips were added for projects lacking that specific evidence (unchanged from the prior round — PRODUCT.md confirms an overall stack, not per-project attribution). This is a code-led build (no image-generation tool available in this harness/session) — ambition is carried by this contract's FIRST VIEWPORT block and the named signature interaction, audited in behavior at finish rather than against a rendered comp.

## Round 3 — the world takes the page (2026-10-07)

The user asked to "make the site actually integrate monument valley style art
into the whole site not just on the side" and said "Text should be written into
three js," citing the Monument Valley 1 site as the art reference. Asked which
reading of that to build, they chose the two most ambitious options directly:

- **Text scope: everything in WebGL.** Not display type only — body copy too.
  The DOM is kept as a visually-hidden accessibility mirror.
- **World layout: full-bleed, content rides the islands.** The 43vw rail is
  dropped; the world fills the viewport at every width and each section's
  content stands on its own island as slabs in the geometry.

What that changed, beyond the two answers:

- The previous round's desktop rail and its DOM card stack are gone. Every
  `*.module.css` component (Nav, FeaturedProject, ProjectRow, ExperienceTimeline,
  SkillGroups) was deleted; their content is now world geometry.
- Display type is extruded from the real Unbounded outlines, which required
  building a `typeface.json` generator (`scripts/build-typeface.py`) and
  discovering that font outlines must be unioned before three.js can
  triangulate them — see DESIGN.md.
- Navigation became a WebGL heads-up bar. The mobile hamburger the previous
  round shipped is retired: five marks fit at any width, and a hamburger would
  have been a second pattern for the same five links.
- Scroll-driven camera travel gained **panning within an island**, because a
  section with more content can no longer be handled by zooming out — the
  unit↔pixel contract fixes the zoom so body copy stays 17px everywhere.
- The mirror is the no-JS and no-WebGL page, visible by default and clipped only
  once a live context exists. That is a new, deliberate requirement of putting
  every word in the canvas.

**Verified in-browser this round:** desktop (1470–1500px) and narrow (606px)
across all five islands; pointer picking and activation (CTA, nav mark,
disclosure knob) end to end, including the mirror's `aria-expanded` tracking the
world; keyboard focus sync and the projected focus ring; the fallback document
with `data-world` off. **Not verified in-browser:** `prefers-reduced-motion`,
which this session's tooling cannot toggle at the OS level — the paths were
reviewed in code (camera tracks scroll with no easing, every ambient loop and
pulse stops, hover/focus states become instant) and a human should confirm it
visually.

## Finish review (fix round — round 2, superseded)

The shipped finish reviewer returned `fix` on the first pass. Material fixes applied in one batch: (1) mobile FIRST VIEWPORT — the hero scene's grid position was moved ahead of the credentials card (via `grid-template-areas`, independent of DOM order) so it's visible near the fold on narrow viewports instead of being pushed entirely off-screen; (2) the Experience timeline's Lumen entry now opens by default so a scroll-only visitor reaches the second Three.js set-piece without needing to click; (3) a ceiling gap — the FORM's signature paradox device (an impossible/ever-climbing staircase loop) was absent — was addressed by adding a genuine closed-loop satellite structure to the hero scene (four ascending legs that return to a lower height than they left, marked by an openly-placed gold "keystone" rather than hidden), spinning independently of the main structure for a second layer of ambient motion. A true single-camera-angle Penrose illusion was explicitly scoped out: the hero's confirmed signature interaction is continuous auto-rotation, which would only let a strict angle-dependent illusion read correctly for an instant per revolution: the closed-loop motif is the honest, rotation-safe expression of the same paradox impulse. `prefers-reduced-motion` fallback logic was verified by code review (not by devtools emulation — this session's browser-automation tooling could not toggle the OS-level reduced-motion setting); a human should confirm the static-frame fallback visually before relying on this.
