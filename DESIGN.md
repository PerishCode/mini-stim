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

## 3. Templates, creativity, and patterns

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

## 4. Pattern layer

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

## 5. Icon layer

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

## 6. Pattern lifecycle

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

## 7. Computed geometry

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

## 8. Current aesthetic direction

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

## 9. Color philosophy

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

## 10. Surface hierarchy

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

## 11. Typography roles

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

## 12. Component translation rules

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

## 13. Pattern index and provisional storage

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

## 14. Message styling rules

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

## 15. Motion and interaction

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

## 16. Background and atmosphere

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

## 17. Borrowing from external references

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

## 18. Review heuristics

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

## 19. Near-term direction for mini-stim

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

## 20. Maintenance rule

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
