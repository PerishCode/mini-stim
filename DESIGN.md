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

## 3. Current aesthetic direction

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

## 4. Color philosophy

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

## 5. Surface hierarchy

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

## 6. Typography roles

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

## 7. Component translation rules

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

### Web business components

Business components may compose atoms into:

- session rail rows
- transcript items
- composer blocks
- tool result views

They may express product meaning, but they must not invent local visual rules.

### Web CSS rule

`apps/client/soma/web` should not become a styling escape hatch.

If `web` appears to need CSS, assume atom expressiveness is missing.
Add or refine atom capability instead of patching page-local styles.

## 8. Message styling rules

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

## 9. Motion and interaction

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

## 10. Background and atmosphere

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

## 11. Borrowing from external references

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

"What visual rule from that project is durable enough to become a token or atom
 capability here?"

## 12. Review heuristics

A visual change is likely correct when:

- readability improves
- hierarchy gets clearer
- fewer colors carry more meaning
- the change can be explained through tokens or atoms
- another screen could reuse the same rule

A visual change is likely wrong when:

- it only works in one page context
- it introduces a new special-case color without a system reason
- it depends on `web`-local CSS
- it makes reading harder to gain personality
- it copies a reference surface without translating its logic

## 13. Near-term direction for mini-stim

Near-term refinement should focus on:

- better neutral layering
- more stable accent usage
- clearer meta typography
- improved transcript readability
- stronger atom capabilities for shell/layout/surfaces

Not on:

- decorative flourishes
- multi-accent exploration
- dark mode expansion before the light mode language is stable
- high-brand marketing aesthetics inside the working chat surface

## 14. Maintenance rule

When `mini-stim` gains new visual capabilities, update this file if the change
alters:

- the aesthetic direction
- the interpretation of accent usage
- the allowed surface hierarchy
- the boundary between inspiration and system
- the default readability rules

This file should stay opinionated, compact, and durable.
It is not a changelog and not a moodboard.
