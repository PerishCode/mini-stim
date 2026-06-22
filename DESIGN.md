# mini-stim Design System

This file is the visual source of truth for `mini-stim`.

It exists to turn broad design inspiration into a stable local design system
 that agents can apply repeatedly without re-deciding taste on every task.

`AGENTS.md` defines ownership and engineering boundaries.
`DESIGN.md` defines visual boundaries, component aesthetics, and the rules that
 convert outside inspiration into reusable internal UI language.

## 1. Design intent

`mini-stim` is a focused work surface for a local-first AI chat product.

It should feel:

- calm
- readable
- tool-like
- intentional
- slightly refined, but never ornamental

It should not feel:

- like a marketing page
- like a social chat app
- playful, cute, or overly brand-heavy
- glossy enterprise dashboard noise
- editorial-for-editorial's-sake

The interface is for sustained reading and iterative work. Visual choices must
reduce fatigue before they add personality.

## 2. Long-term system goal

External references are inspiration, not templates.

When a strong design reference is found, we do not copy page structure or
 ad hoc colors into `web`. We extract the durable visual idea and translate it
 into:

- tokens
- atom capabilities
- surface rules
- typography roles
- spacing and border behavior

Only after that translation should the idea appear in product UI.

This is how visual taste becomes a maintainable system instead of a sequence of
 one-off page edits.

## 3. Design pairing workflow

Design work in `mini-stim` should treat the current local product surface as a
real validation field, not as a finished target and not as a detached mock.

The preferred pairing loop is:

1. user-facing observation
2. design translation
3. system rule
4. component landing point
5. live surface validation

The user's primary role in this loop is to describe the experience from the
product and user side:

- what feels unclear
- what feels visually weak or too strong
- what interaction feels blocked, noisy, or promising
- what product direction the surface should support next

The design translation role is to convert those observations into professional
design-system language:

- information hierarchy
- visual weight
- spatial rhythm
- typography role
- surface and boundary behavior
- interaction state grammar
- component ownership

Engineering judgment is part of the loop, but it should support the design
translation rather than replace it. A useful engineering concern usually lands
as one of:

- token scope
- atom capability
- icon policy
- pattern extraction
- product-component assembly
- temporary deferral because the product surface is not mature enough

The expected output of a design discussion is not always code. It may be:

- a rule added to this file
- a new or revised token
- a new atom capability
- a promoted pattern
- a focused product-surface change
- a deliberate decision to wait for more real usage

The default quality bar is:

- do not chase a complete visual redesign in one pass
- do not reduce design feedback to page-local CSS patches
- do not keep feedback as vague taste language when it can become a reusable
  rule
- prefer small rules that can grow across the existing rail, chat, composer,
  and Inspect surfaces

This workflow exists so user intuition, design judgment, and implementation
constraints can converge into a durable design system.

## 4. Templates, creativity, and patterns

Template use and creativity are orthogonal.

Templates are not the opposite of creative work.
They are the normal way to solve a problem once its constraints are clear
enough that the correct structure becomes stable.

In `mini-stim`:

- creativity is used to choose, revise, extend, or delete patterns
- templates are used to solve recurring, high-constraint local UI problems
- patterns are the formal system asset that carries those templates

This means:

- we do not treat every local UI problem as a fresh composition exercise
- we do not reject a near-unique structural solution just to preserve the
  appearance of originality
- we do not confuse repeated, mature layout practice with a lack of design
  judgment

When a local UI problem becomes structurally obvious, the correct action is
usually to recognize the pattern and encode it, not to improvise again.

## 5. Pattern layer

`mini-stim` recognizes a layer between low-level design-system primitives and
product-specific components.

That layer is `patterns`.

Patterns are:

- business-blind
- structurally opinionated
- reusable
- allowed to be hard-coded
- subject to revision, expansion, and deletion

Patterns are not:

- page-local implementation tricks
- product-semantic components
- permanent rules frozen forever
- just documentation with no code representation

The intended hierarchy is:

1. tokens
2. icons
3. atoms
4. patterns
5. product components

Patterns sit above atoms because they express recommended composition logic.
Patterns sit below product components because they must not encode product
meaning.

For example, a pattern may express:

- fluid primary region + fixed action region
- label stack + trailing status cluster
- header + scroll body + pinned footer
- primary content + secondary meta line

It should not express:

- session rail item
- assistant transcript card
- mini-stim composer

Those are product-semantic usages of more general patterns.

## 6. Icon layer

`mini-stim` also recognizes `icons` as a first-class design-system asset layer.

Icons are:

- business-blind
- controlled through a local export surface
- allowed to cold-start from a mature external set
- responsible for symbol consistency rather than layout or product semantics

Icons are not:

- atoms
- patterns
- page-local SVG fragments
- direct product semantics

The default rule is:

- consume icons through `packages/components/src/icons`
- do not scatter direct third-party icon imports through atoms or `web`
- keep icon naming and replacement under local control even when the glyph
  source is external

Cold-starting from a mature icon set is acceptable.
Long-term icon language may still evolve through replacement, curation, or
custom additions.

## 7. Component responsibility boundaries

Design-system quality depends on clear property ownership, not only on good
values.

When a component looks wrong, first identify which layer is allowed to own the
wrong property. Do not patch the nearest visible file just because it can
technically express the CSS.

The current responsibility matrix is:

- tokens:
  own raw and semantic values such as color, spacing, radius, typography,
  border color, shadow values, and motion timing
- icons:
  own glyph choice, stroke/fill language, icon naming, and size-scale policy
- atoms:
  own intrinsic element behavior and styling such as frame, radius, internal
  padding, tone variants, focus/hover/disabled state, scroll mechanics, and ref
  attachment capability
- compound atoms:
  own slot anatomy and internal chrome for a reusable object family, such as
  `Panel.Root/Header/Body/Footer`
- patterns:
  own business-blind relationships between multiple children, such as
  fluid-vs-fixed regions, pinned actions, repeated row anatomy, and stable
  spacing rhythm
- product components:
  own product meaning, content, data binding, event wiring, inspection metadata,
  and the choice of which atom or pattern to use
- app root:
  owns cross-cutting application capabilities such as providers, inspection
  registries, shadow-root overlays, and global context hooks
- layout grid:
  owns page-level placement, column/row sizing, gaps between major regions, and
  resize boundaries

This matrix is allowed to evolve, but it should converge toward fewer
surprises, not toward local exceptions.

Use these tests when deciding where a property belongs:

- if the same visual defect appears in multiple product components, move the
  fix down into an atom, compound atom, pattern, or token
- if a fix depends on product meaning or copy, keep it in product assembly
- if a property changes the outside relationship between siblings, consider a
  pattern or layout owner
- if a property changes the inside anatomy of one reusable object family, change
  the compound atom
- if a cross-cutting capability needs global coordination, route it through
  `AppRoot` or a context hook instead of explicit wrapper components
- if a component needs exactly one child to smuggle behavior into the tree,
  treat that as an ownership smell and audit it against the single-child rule

The `Panel` frame-line correction is the current concrete example:
the visual defect appeared across primary panels, but depended on parent
overflow clipping. The fix therefore belonged in `Panel.Root` as an internal
frame boundary, not in the session rail, chat shell, Inspect panel, or grid.

## 8. Pattern lifecycle

Patterns are design assets, not sacred artifacts.

They may be:

- added
- modified
- expanded
- simplified
- deprecated
- deleted

The design question is not whether a pattern should stay untouched forever.
The design question is whether the current recurring problem is better served by
reusing an existing pattern, revising one, or creating a new one.

The default storage rule is:

- mature patterns belong in code
- `DESIGN.md` explains pattern philosophy and indexes pattern assets
- `DESIGN.md` may temporarily hold provisional patterns that are not yet ready
  to hard-code

`DESIGN.md` is not the permanent home of mature pattern behavior.
If a pattern is stable enough to trust, the preferred outcome is to encode it
in `packages/components`.

## 9. Computed geometry

Not every useful design token should be authored as an isolated final value.

When a visual layer starts showing proportional tension, the preferred fix is
often to introduce a small set of base values plus explicit derivation rules,
instead of hand-tuning multiple final tokens independently.

The intended progression is:

1. base atomic values
2. computed relationships
3. semantic layer tokens
4. component consumption

This matters most when values are visually interdependent, such as:

- shell gap
- shell radius
- shell shadow
- shell padding

These values should read as one geometric language, not as unrelated numbers
that happened to be chosen near each other.

Current shell-level rule:

- shell layout is the first formal landing point for computed geometry tokens
- shell gap, shell radius, shell padding, and shell shadow may be derived from
  lower-level atomic tokens
- when shell density changes, adjust the computed relationship first before
  introducing page-local overrides
- expand this approach to other layers only when repeated proportional issues
  show that the relationship is stable enough to formalize

## 10. Current aesthetic direction

The current direction is:

- cool neutral workspace base
- low-noise panels and surfaces
- one restrained accent color
- strong readability over dramatic contrast
- subtle depth through value separation, not heavy shadowing

The closest useful inspiration pattern is:

- disciplined neutral surfaces
- clear typographic hierarchy
- sparse accent usage
- light borders and soft separation

The wrong takeaway from editorial references is warm paper nostalgia.
The right takeaway is restraint, hierarchy, and accent discipline.

## 11. Color philosophy

### Base rule

Use mostly neutral colors.

The UI should be built from:

- canvas
- panel
- subtle panel
- surface
- muted text
- light border
- one accent
- success / warning / danger support tones

### Accent rule

Use one primary accent family at a time.

Accent exists to mark:

- primary action
- selection
- authored/account-side emphasis
- focus states where appropriate

Accent must not be sprayed across the interface. If everything is emphasized,
 nothing is emphasized.

### Contrast rule

Prefer:

- light or mid-light surfaces with dark text

Avoid:

- large deep-color surfaces with white text for reading-heavy content

Dark-on-light is the default reading mode.
Inverse surfaces should be rare and must justify themselves.

### Temperature rule

Default product temperature is slightly cool-neutral.

Do not drift into:

- yellowed paper
- sepia
- muddy beige
- green-gray murk

Warm accents may exist, but the workspace itself should remain clear and clean.

## 12. Surface hierarchy

The product should read as a stack of clear working layers:

1. canvas
2. panel
3. surface
4. emphasized surface
5. feedback surface

Those layers should differ primarily by:

- lightness
- border strength
- occasional tint

Not by:

- large shadow jumps
- excessive gradients
- arbitrary color shifts

Shadows should be minimal. Borders and tonal separation do most of the work.

### Surface skeleton rule

The interface must not feel like a blank white sheet.

Restraint means quiet hierarchy, not missing hierarchy. A user should be able
to identify the following layers at a glance without needing saturated color:

- workspace canvas
- chrome panel
- panel interior / inset work area
- raised or selectable item
- focused or selected state
- docked input/control area

Each layer should have a small but detectable material difference through some
combination of:

- lightness shift
- border weight
- internal highlight
- contact shadow
- selected indicator

Do not solve this by adding decorative color. Solve it by making existing
surfaces carry their intended hierarchy.

The first cold-start surface pass should prioritize:

- distinguishing the app canvas from panel chrome
- keeping panels low-noise but not flat
- giving inset transcript/Inspect empty regions a deliberate tone
- making selected rail/message surfaces feel intentionally held
- keeping the composer dock visibly interactive without becoming a second
  command bar

### Material and shape grammar

Once the basic surface skeleton is visible, the next step is not more generic
contrast. The next step is product material grammar.

Each recurring surface role should have a recognizable shape idiom:

- app canvas:
  broad warm-neutral workspace field, never pure white, with quiet ambient
  material variation
- chrome panel:
  quiet contained shell with a soft contact edge and slight internal highlight
- inset work area:
  cooler recessed field for transcript, Inspect, and other scrollable work
- selectable item:
  raised light object with clear perimeter and subtle contact shadow
- selected item:
  held object with stronger tint, firmer border, and one directional indicator
- assistant content:
  readable content block with a soft neutral/material tint
- account content:
  authored bubble with restrained accent tint, not saturated social-chat color
- tool whisper:
  compact utility trace that feels secondary and inspectable
- composer dock:
  active input surface with stronger affordance than passive panels

The design should avoid a single repeated "white box with 1px border" solution.
If two elements have different interaction or information roles, they should
not rely on identical surface treatment unless the sameness is intentional.

The palette should remain disciplined, but not monochrome. It may use restrained
temperature differences:

- cooler canvas and inset work fields
- clean warm-neutral raised panels and inputs
- controlled blue accent for action and selection
- faint green/teal cast only where it supports assistant or utility material

Do not let temperature variety become decoration. Its job is to make surface
roles legible.

### Canvas material rule

The app canvas is a material field, not a flat painted backdrop.

It may use low-contrast linear gradients, subtle line-grain texture, and ambient
flow to keep the workspace from feeling dead. This motion must stay below the
user's conscious task focus when they are reading or acting in the product, but
it must still be legible when the user deliberately watches the canvas:

- use broad linear material fields rather than discrete decorative shapes
- avoid orbs, blobs, bokeh, or illustrative background objects
- animate with a detectable direction and rhythm, not an almost-static drift
- keep the movement slow and broad enough that it feels ambient, not like
  interface feedback or a loading state
- when warm translucent panels need clearer motion visibility, the canvas may
  use a muted mineral/lichen neutral family; this should read as low-chroma
  material separation, not a green theme, success signal, nature motif, or
  saturated decorative background
- keep panel separation readable; canvas material must sit behind the panels
- respect `prefers-reduced-motion: reduce` by stopping infinite motion

The current implementation lives in `AppRoot`, because canvas material is an
application shell capability, not a product component concern.

### Interaction entry rule

The first readable screen must feel operable before it feels explainable.

Avoid static presentation surfaces that make the product look like a slide.
The main chat area does not need starter buttons just to prove that chat is
available. When the composer is visible, the chat affordance is already direct.
Avoid repeating that entry point with a card of prompt choices in the
transcript.

Do not use raw runtime ids as the main product title for ordinary empty
conversations. Runtime ids may appear in Inspect or diagnostics, but the chat
surface should use human-facing names such as an explicit title, a preview, or
`Untitled chat`.

Transcript empty states should be background material, not cards. Use a quiet
centered embossed text treatment for the empty work field; keep the actual
action in the composer or the rail.

### Rail identity entry rule

The session rail header is an identity entry surface, not a brand billboard.

For the current product direction, persistent rail-top copy should favor the
active Soul identity over the product name. `mini-stim` may remain the document
title or system-level identity, but it should not dominate the working rail
chrome when a more useful interaction anchor exists.

Current shell structure:

- `AppRoot` owns the animated canvas but not the shell padding
- a fixed-width DockShell is the leftmost full-height app shell region
- DockShell contains:
  - a full-height Dock lane
  - an inner GridShell that owns the main workspace padding
- Dock lane width is a DockShell/component-token decision, not product App
  assembly state. The current reviewed width is `48px`.
- Dock lane padding should be tighter than workspace padding because it is a
  narrow persistent control strip
- Dock lane padding may be asymmetric: the current direction is tighter inline
  padding than the workspace, with a slightly larger top inset so the first
  dock action does not feel pinned to the viewport edge
- DockShell owns the narrow Dock lane's material and horizontal control
  centering; product dock components should not use a generic Pane wrapper to
  simulate the lane surface
- GridShell must keep left padding between the Dock lane and the first primary
  panel; do not remove left padding just because the Dock lane already occupies
  the left edge
- Navigation Dock switches first-level rail modes such as Sessions and Souls
- the dock is not an overlay and not a child of Session Rail
- the inner Grid owns rail/main/inspect placement
- the resizable rail column remains separate from the fixed Dock lane
- Session Rail header remains a stable Soul nickname anchor
- Soul nickname is an identity label/select shortcut, similar to the Chat Header
  title label/input rhythm; it should not be the rail-mode trigger
- Rail Body renders the active dock mode:
  - Sessions mode: session list plus New Session action
  - Souls mode: Soul list plus New Soul management affordance
- mode-local create actions share the same rail grammar: a compact top row with
  the mode label/count on the left and the create button on the right. New Soul
  may be disabled, but it should keep the same shape and placement as New
  Session.
- New Soul may remain disabled until the data/model action exists, but the
  management affordance should live in Souls mode, not in the normal Sessions
  face

Session Rail and Chat Shell headers should share the same header height rhythm.
If one header needs additional semantics, compress the local structure before
changing the shared `Panel.Header` padding or letting one primary panel drift.

The panel shell and Soul header should remain stable during mode changes.
Dock-driven mode changes replace the Rail Body content directly; they should
not use a two-faced flip surface, rotate the `Panel.Root`, restyle DockShell, or
move the identity anchor.

New Session is not a rail-brand action. It belongs to the sessions region, near
the list it creates and the session count it changes.

Rail refs and accessibility state should come from the rendered active body
content. Hidden inactive rail faces should not remain mounted only to support a
mode animation.

### Semantic label overlay

During product-surface design, business components may expose a consistent
floating semantic label in their top-right corner through AppRoot inspection.

This is not decorative UI and not end-user product chrome. It is a shared
semantic-space tool for aligning product, design, and engineering judgment
around component boundaries.

Rules:

- the overlay is controlled centrally by `AppRoot`
- all labels use one visual treatment and one top-right placement rule
- business components register structured metadata through `useAppComponentRef`
- registration attaches to the smallest real root DOM node the component owns
- atoms and low-level patterns do not invent product labels
- labels should stay inside the viewport and may collision-shift when narrow or
  edge-adjacent components would otherwise clip the label
- labels should expose boundary problems rather than hiding them
- overlay rendering is internal to `AppRoot`; callers do not mount an explicit
  overlay layer

If a label feels misplaced, too noisy, or attached to the wrong region, treat
that as evidence that the component boundary or visual hierarchy needs review.

### Primary container rule

Primary workspace panels use the `Panel.*` compound atom family.

`Panel.Root`, `Panel.Header`, `Panel.Body`, and `Panel.Footer` are the first
container truth source for the session rail, chat shell, and Inspect panel.
Product components may decide their content, but they should not re-decide the
first-level panel chrome, radius, shadow, boundary, or header/body/footer
geometry.

This is intentionally an atom-level compound component rather than a product
pattern. It keeps the visual shell business-blind while allowing product
assemblies to register their own inspection metadata on the actual
`Panel.Root`.

Rules:

- do not wrap a primary panel in another visual container to repair shape drift
- if the shared panel shape is wrong, change `Panel.*`
- if a use case needs a genuinely different container language, introduce a
  sibling family such as `Card.*` or `Cell.*` instead of weakening `Panel.*`
- internal product content may differentiate through surface tone and layout,
  but the first-level shell remains shared
- primary panel edges should not rely on a hard outer border. The current
  direction is borderless material separation: warm shell color, soft contact
  shadow, subtle internal highlight, and broad edge shading
- borderless does not mean low contrast. The canvas must sit visibly behind the
  panel shell through a clear warm-neutral value step plus enough contact shadow
  for the panel to read as a separate working surface
- inset body material must not paint into the outer shell radius; it may create
  an internal work field, but the rounded primary chrome belongs to `Panel.Root`
- tight spacing between primary panels is intentional; discomfort should be
  solved with better material transition, frame softness, and shadow behavior,
  not by reflexively increasing the gap
- current panel material direction is warm neutral: a calm warm-gray shell,
  subtle internal highlight, grounded but short shadow, and a softer inset field
  that feathers into the shell instead of reading as a hard pasted rectangle
- panels may use translucent material backgrounds so the AppRoot canvas remains
  perceptible behind the primary work surface; do not use element `opacity` for
  this because it weakens text, controls, and semantic content
- if the canvas motion cannot be perceived through panels, prefer lowering the
  panel material stop opacity and increasing material blur before changing text
  opacity or adding hard frame effects
- the panel shell background may carry a very small diagonal material gradient:
  roughly 20 degrees counterclockwise from the vertical axis, with a restrained
  value range from full warm shell to about 80% shell weight
- `Panel.Body tone="inset"` owns the internal work field through Panel-level
  material tokens; product components should not create local inset patches to
  repair panel comfort

### Single-child topology rule

Avoid introducing a component whose only job is to wrap exactly one child.

Single-child wrappers hide ownership, create false visual boundaries, and make
semantic inspection drift away from the real component root. The preferred
solutions are:

- enhance the existing component so the required behavior lands on the real
  element
- split or promote a reusable atom family when the behavior is genuinely
  reusable

Exceptions require an explicit reason, such as provider context, error
boundary, portal/shadow-root ownership, measurement, animation, accessibility
adapter, foreign library adapter, or another documented strict ownership
boundary.

## 13. Typography roles

Typography has distinct jobs.

### Heading

Use for:

- page titles
- section titles
- key chat context labels

It should feel compact, confident, and quiet. Not theatrical.

### Body

Use for:

- messages
- descriptive copy
- empty states
- system notes

Body text is the product's main workload. Readability wins over personality.

### Meta

Use for:

- timestamps
- connection state
- small labels
- supporting status copy

Meta text should step back without becoming low-contrast mush.

### Mono

Use for:

- structured payloads
- tool arguments/results
- machine-readable fragments

Mono is not a theme. It is a utility lane.

## 14. Component translation rules

Visual language must land in the component system, not in page-local styling.

### Atoms

Atoms are business-blind.

They own:

- visual primitives
- layout primitives
- form controls
- surface treatments
- token consumption
- their own SCSS

They do not own product concepts like:

- session
- message
- tool call
- assistant
- transcript

Atoms should answer questions like:

- what surface tones exist
- what padding/radius/typography roles exist
- how low-level layout primitives behave
- how controls expose state and affordance

They should not answer recurring high-level composition questions that already
have a stable structural solution.

### Icons

Icons own:

- sanctioned glyphs
- their shared rendering wrapper
- size/stroke defaults
- controlled naming

They do not own:

- page-level layout
- button/input interaction
- product semantics
- arbitrary unreviewed symbol drift

### Patterns

Patterns are business-blind hard-coded composition templates.

They own:

- recurring high-constraint layout solutions
- recommended structural combinations of atoms
- reusable information hierarchy templates
- stable local surface/lane relationships

They do not own:

- transport logic
- page routing
- product semantics
- one-off page composition

If a UI problem repeatedly causes `web` to compose the same atoms in nearly the
same way, stop and consider whether that structure is actually a missing
pattern.

### Web business components

Business components may compose atoms and patterns into:

- session rail rows
- transcript items
- composer blocks
- tool result views

They may express product meaning, but they must not invent local visual rules
when those rules already belong in atoms or patterns.

### Web CSS rule

`apps/client/soma/web` should not become a styling escape hatch.

If `web` appears to need CSS, assume atom expressiveness is missing.
Add or refine atom/pattern capability instead of patching page-local styles.

## 15. Pattern index and provisional storage

This file also acts as the pattern index.

Use the following interpretation:

- hard-coded pattern
  the pattern is implemented in `packages/components` and code is the primary
  truth
- provisional pattern
  the pattern has been identified and should be remembered, but is not yet
  stable enough or enabled enough to hard-code
- deprecated pattern
  the pattern should no longer guide new work and should be removed or replaced

When a provisional pattern is recorded here, include:

- status
- constraints
- intended structural shape
- why it is not yet hard-coded
- what would trigger promotion into code

Current index:

### Hard-coded patterns

#### FieldActionLayout

- status: hard-coded
- intent:
  - one fluid primary region
  - one fixed-width secondary action region
  - one shared control body without page-local layout improvisation
- code location:
  - `packages/components/src/patterns/FieldActionLayout/FieldActionLayout.tsx`
  - `packages/components/src/patterns/FieldActionLayout/FieldActionLayout.scss`
- current product usage:
  - the `mini-stim` chat composer is the first pilot consumer
- notes:
  - this pattern is intentionally business-blind
  - it captures a recurring layout solution, not a chat-specific component

### Provisional patterns

#### Icon system usage constraints

- status: provisional
- scope:
  - icon stroke weight policy
  - icon size-scale policy
  - outline-only vs filled/outline mixed usage
  - icon-only vs icon+label usage boundaries
- current judgment:
  - the icon layer now exists and is cold-started from `lucide-react`
  - real usage coverage is still too small to justify hard global rules for
    these questions
  - premature certainty here would likely create decorative or arbitrary system
    constraints rather than durable guidance
- why not yet hard-coded:
  - the current product surface does not yet exercise enough icon cases across
    atoms, patterns, and product components
  - the repository needs more real icon usage before narrowing the long-term
    style and interaction policy
- promotion trigger:
  - revisit once icons appear across a broader set of controls, status lanes,
    and reusable patterns
  - only hard-code rules that continue to hold across multiple validated usage
    contexts

### Hard-coded icons

Current cold-start icon surface:

- `Icon`
- `PlusIcon`
- `SendIcon`

Current policy:

- glyphs are sourced from `lucide-react`
- the local `icons` layer is the only sanctioned integration point
- future icon review may rename, replace, or expand this set without exposing
  raw third-party imports as the system contract

## 16. Message styling rules

Messages should be visually distinct by role, but still belong to one family.

### Account-side messages

- may use the accent family
- should remain highly readable
- should prefer tinted light surfaces with dark text over saturated dark blocks

### Assistant-side messages

- should be the quiet default reading surface
- should not compete with account messages

### System messages

- may use a soft warning/editorial tint
- should feel special but not alarming

### Tool blocks

- may use a soft success/utility tint
- should feel structured and inspectable
- code/payload areas should remain mono and neutral enough for scanning

## 17. Motion and interaction

Motion should be sparse and useful.

Use motion for:

- hover clarity
- focus reinforcement
- state transition smoothness

Do not use motion for:

- ornament
- bounce
- personality signaling

The interface should feel responsive, not animated.

## 18. Background and atmosphere

The product may have a small amount of atmosphere, but it must stay behind the
 work.

Allowed:

- faint tonal variation
- extremely subtle cool ambient gradients
- almost invisible texture

Not allowed:

- obvious paper texture
- strong noise overlays
- decorative illustration language in the work surface

If a background effect is noticeable before the content is noticeable, it is
too strong.

## 19. Borrowing from external references

When studying another project, extract only stable principles such as:

- accent discipline
- hierarchy
- spacing rhythm
- border weight
- typography role separation
- panel layering

Do not directly copy:

- brand palettes
- hero-page treatments
- editorial gimmicks
- warm/cold bias without product fit

The question is never "How do we make mini-stim look like that project?"

The question is:

"What visual rule from that project is durable enough to become a token, atom,
 or pattern capability here?"

## 20. Review heuristics

A visual change is likely correct when:

- readability improves
- hierarchy gets clearer
- fewer colors carry more meaning
- the change can be explained through tokens, icons, atoms, or patterns
- another screen could reuse the same rule

A visual change is likely wrong when:

- it only works in one page context
- it introduces a new special-case color without a system reason
- it depends on `web`-local CSS
- it makes reading harder to gain personality
- it copies a reference surface without translating its logic
- it leaves a recurring high-constraint local structure trapped in page-level
  JSX instead of promoting it to a reusable pattern

## 21. Near-term direction for mini-stim

Near-term refinement should focus on:

- better neutral layering
- more stable accent usage
- clearer meta typography
- improved transcript readability
- stronger atom capabilities for shell/layout/surfaces
- a better controlled icon surface now that the cold-start icon layer exists
- extracting the first true business-blind hard-coded patterns from recurring
  chat/workspace structures

Not on:

- decorative flourishes
- multi-accent exploration
- dark mode expansion before the light mode language is stable
- high-brand marketing aesthetics inside the working chat surface

## 22. Maintenance rule

When `mini-stim` gains new visual capabilities, update this file if the change
alters:

- the aesthetic direction
- the icon-layer policy
- the pattern philosophy or layer boundary
- the interpretation of accent usage
- the allowed surface hierarchy
- the boundary between inspiration and system
- the default readability rules

This file should stay opinionated, compact, and durable.
It is not a changelog and not a moodboard.
