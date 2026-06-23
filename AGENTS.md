# AGENTS

Read this file together with `DESIGN.md`.
`AGENTS.md` is the engineering and ownership source of truth.
`DESIGN.md` is the visual and component-aesthetics source of truth.

## Purpose

`mini-stim` is now a small, local-first single-person AI chat prototype.

The durable loop is:

```text
web client -> Rust server -> provider-abstracted model streaming -> SQLite transcript
```

The goal is a rigorous minimal model, not a broad agent-native IM architecture.
Keep directory ownership strict while keeping the product semantics small.

## Product Boundary

`mini-stim` owns:

- single-person conversations with one configured AI assistant
- normalized message and response-run persistence
- provider-abstracted model streaming with OpenAI Responses and DeepSeek Chat
  Completions implementations
- a Rust server with OpenAPI-exported contracts
- a web client generated against those contracts

`mini-stim` does not own:

- multiplayer chat
- participant/member/target-set modeling
- agent registries or agent runtime orchestration
- delivery targets, delivery workers, or retry leases
- product-specific sidecar semantics beyond the local cell/soma dev runtime
- Tauri, native macOS projections, or packaged platform launchers
- legacy OpenAI completions compatibility

## Repository Structure

Use this structure:

```text
mini-stim/
├── proto/
│   └── crates/
│       ├── transport/ # sidecar endpoint/bootstrap/inspect frame facade
│       ├── server/    # server cell typed protocol
│       └── client/    # client cell typed protocol
├── apps/
│   ├── server/
│   │   ├── cell/      # sidecar-managed control boundary
│   │   └── soma/
│   │       └── crates/
│   │           ├── santi-api/   # Axum HTTP API, OpenAPI export, SSE endpoints
│   │           ├── santi-core/  # domain model, SQLite store, provider-agnostic service layer
│   │           └── santi-provider/ # provider traits and concrete implementations
│   └── client/
│       ├── cell/      # sidecar-managed control boundary
│       └── soma/
│           ├── src/   # Rust soma wrapper for dev mode
│           └── web/   # Vite/React web client
├── packages/
│   ├── contracts/           # generated OpenAPI schema/types
│   ├── mqueue/              # browser transport/event projection over contracts + SSE
│   ├── hooks/               # React provider + atomic hooks over mqueue
│   └── components/          # reusable UI atoms/patterns consumed by client
├── docs/
└── .task/                   # local task memory, ignored by git
```

Do not recreate old top-level `crates/`, `projections/`, or `apps/render.*`
surfaces. The root `sidecar.toml` is now the product-neutral local dev control
plane and must stay limited to cell lifecycle facts.

## Cell/Soma Runtime Rules

- `sidecar CLI` is the external product-neutral control plane.
- A `cell` is a project-local managed control boundary launched by sidecar CLI.
- A `soma` is the executable body managed by a cell.
- `store` is the namespace-local persistent storage root derived by proto
  bootstrap. It is the upstream for every mutable runtime path owned by the
  app.
- `proto/crates/*` owns typed cell protocols and bootstrap/invoke/register
  facades. Components must not hand-roll sidecar event strings, endpoint
  parsing, or inspect payload shapes.
- Cell code may understand sidecar stamps, modes, endpoints, namespace, state
  roots, and inspect transport through proto helpers.
- Soma code must remain sidecar-unaware. It consumes argv/env/cwd/files and
  exposes ordinary HTTP or dev-server TCP behavior.
- Current implementation scope is dev mode only. Runtime mode may be modeled but
  must not be half-implemented.
- Cells derive all mutable app runtime paths from `CellContext.store` and pass
  concrete paths to somas. No mutable runtime path may be invented outside
  store.
- Source/resource paths may be repository-relative. Generated, persisted,
  diagnostic, log, database, and temp paths must come from store.
- Inspect socket paths are transport addresses, not persistent app paths. They
  may use OS IPC locations but must not become storage roots.

## Execution Rules

- Keep `.task/` local and ignored by git unless explicitly requested.
- Prefer one working web chat loop over architecture scaffolding.
- Server product truth lives in `santi-core`; web UI consumes API contracts and
  must not define durable product semantics.
- `mini-stim` is self-contained, so frontend package boundaries exist for code
  ownership and clarity, not for independent external release choreography.
- Provider integration truth lives behind `santi-provider::ProviderClient`;
  `santi-core` must stay provider-agnostic.
- The server soma owns HTTP routing, SSE framing, and OpenAPI export through the
  `mini-stim-server-soma` bin.
- `packages/contracts` must be generated from the Rust OpenAPI source of truth.
- Do not hand-maintain divergent client/server DTOs.
- Use the provider boundary even when only one concrete provider is configured.
  Do not add legacy OpenAI completions paths.
- If the expected local environment or command is unavailable, report the
  missing prerequisite directly and stop that path. Do not spend time inventing
  fallbacks or exploring unrelated environment workarounds unless the user asks.
- Keep hard cuts acceptable. Add compatibility only for a real external surface.
- Cargo and Node external dependencies must use exact stable versions only:
  full version numbers such as `1.2.3`, no caret, tilde, range, wildcard, or
  partial-version requirements. Workspace/local references remain workspace
  indices or path/workspace entries (`workspace:*`, `workspace = true`, or
  `path = ...`). Except for specifically documented defective releases, keep
  dependencies on the latest stable version and update the lockfile in the same
  change.

## Browser Automation Rules

Treat browser automation as a persistent working surface, not a disposable
subprocess.

- Browser automation policy follows the current official `@playwright/cli`
  documentation surface, not ad hoc local muscle memory from older installs.
- A working browser surface assumes a modern `@playwright/cli` with named
  sessions via `-s=<name>` and session management via `list`, `close`,
  `close-all`, `kill-all`, and `delete-data`.
- Start browser work by checking `playwright-cli --version` when session
  behavior looks unfamiliar. If the installed CLI does not match the current
  documented command surface, treat that as environment drift and report it
  directly instead of burning time on exploratory command permutations.
- Prefer reusing the current `playwright-cli` session and tab instead of
  stopping/restarting or closing/reopening the browser.
- If the target page needs to refresh, prefer `playwright-cli reload`.
- If the task needs a different page in the same working surface, prefer
  `playwright-cli -s=<name> open <url>` or `playwright-cli goto <url>` on the
  active session/tab instead of tearing the session down first.
- Only stop, restart, or delete a browser session when the current session is
  unusable, isolated state is explicitly required, or the user asks for a fresh
  browser context.
- Avoid unnecessary browser restarts because they destroy the current window
  shape, tab arrangement, and other user-adjusted visual context.

For routine local iteration, the primary `playwright-cli` session name is
`mini-stim`. Do not fall back to the default session for ordinary work unless
the named session is unusable.

`playwright-cli` cold start is `mini-stim-session-first`, not help-first,
restart-first, or new-session-first.

`working-surface check` is the standard phrase for cold-starting or revalidating
the local runtime/browser surface before discussing concrete edits.

Use the runseal browser wrappers for low-confidence browser-surface operations:

- `runseal :browser check`
  - inspect sidecar/web/session truth and recommend `none` or `recover`
- `runseal :browser reset`
  - converge Playwright session/browser state back to empty
- `runseal :browser recover`
  - recover the routine browser session after runtime drift or restart
  - defaults to `--browser chromium`, which resolves to
    `chrome-for-testing` and is the preferred routine automation channel

Use raw `playwright-cli` for stable page-level operations such as `open`,
`goto`, `reload`, `snapshot`, `click`, `fill`, and `eval`.

Routine browser recovery should prefer `runseal :browser recover` over ad hoc
cleanup/reopen command sequences when the surface is stale but not fundamentally
broken, because the wrapper already bakes in the currently validated ordering:

- wait for sidecar/web readiness before `reload`
- fall back from `reload` to `goto` to `open`
- treat `close-all` / `kill-all` cleanup as a convergence process rather than
  as an instant state transition

For the current validated `mini-stim` hot path, a sidecar-only restart is not
automatically a browser-recovery event.

- If `sidecar` has just been restarted but the routine session still exists and
  `runseal :browser check` reports `playwright.state=usable`, prefer a direct
  `playwright-cli -s=mini-stim reload`.
- Use `runseal :browser recover` only when the routine session is missing,
  stale, or the page can no longer be refreshed back to the target surface.

`working-surface check` maps to the `runseal :browser` layer. It means:

- verify the installed `playwright-cli` command surface before using browser
  session commands when there is any sign of version drift
- verify `sidecar` health first
- recover the runtime only if cells are unhealthy
- read the current `web.port` from the active namespace store
- reuse the routine `playwright-cli` session `mini-stim`
- open the current local web URL and take a fresh snapshot so everyone is
  looking at the same live surface

Normal local web startup path:

```bash
runseal :browser check
runseal :browser recover
playwright-cli -s=mini-stim snapshot
```

Only deviate from that path when the current session is unusable or the task
explicitly requires isolated browser state. If the installed CLI does not
support this command surface, stop and report the version drift instead of
guessing alternate syntax.

Normal `playwright-cli` shutdown path:

```bash
playwright-cli -s=mini-stim close        # stop the routine session cleanly
runseal :browser reset                   # converge session/process state when cleanup matters
playwright-cli -s=<name> delete-data     # only after close, and only if session data should be removed
```

Do not kill the underlying browser process directly unless there is no cleaner
recovery path left.

For `playwright-cli`, treat the following as the normal hot path:

- start with the routine `mini-stim` session for ordinary local iteration
- use additional named sessions only when the task truly needs separate
  cookies/storage or parallel browser contexts
- prefer semantic session names when extra named sessions are required
- use `-s=<name>` with `open`, `snapshot`, `click`, `fill`, `press`, `reload`,
  `tab-list`, and `tab-select` as the default interactive workflow
- resnapshot after significant page changes instead of guessing stale refs
- use `tab-new` only when the task benefits from a second live tab; otherwise
  keep work in the current tab
- use `list` to inspect existing sessions before creating extra ones if
  session state is unclear
- if the current page is simply stale, prefer `reload` over re-`open`ing unless
  the URL itself must change
- clean up sessions only when the task is complete or stale state is clearly
  harmful; do not treat cleanup as the default first move

## Frontend Package Boundary

The frontend design-system asset model is explicit:

- `packages/components/src/atoms`
  owns business-blind primitives, low-level layout/control capabilities, token
  consumption, and SCSS for those primitives.
- `packages/components/src/icons`
  owns the business-blind symbol system. Icons are a first-class asset layer,
  not a sub-type of atoms. This layer owns the controlled icon set, the shared
  icon wrapper, and any cold-start third-party icon integration behind local
  exports.
- `packages/components/src/patterns`
  owns business-blind but higher-level hard-coded composition templates. A
  pattern is not a page component and not a product concept; it is a reusable
  structural solution for a recurring, high-constraint UI problem.
- `apps/client/soma/web/src/components`
  owns product-semantic assembly such as session rails, transcript item views,
  composer instances, and other `mini-stim`-specific compositions built from
  hooks plus component-system assets.

Treat `patterns` as a first-class asset layer, not as a documentation-only
idea and not as an accidental pile of "slightly larger atoms".

Treat `icons` the same way.

- Icons are symbol assets, not layout primitives and not product components.
- Cold-starting from a mature external icon set is acceptable, but the codebase
  should consume icons through the local `icons` layer rather than importing the
  third-party package directly throughout atoms or `web`.
- Icon names should stay controlled by the local export surface, even when the
  underlying glyphs come from a third-party set.

- A pattern must stay business-blind.
  It may encode structural relationships, surface layering, spacing rhythm,
  fixed-vs-fluid layout logic, label/status clustering, and similar reusable
  composition rules.
  It must not encode product concepts such as `session`, `conversation`,
  `assistant`, `tool result`, or `mini-stim`.
- A mature pattern should be hard-coded in `packages/components`, with code as
  the primary truth.
- `DESIGN.md` may temporarily carry provisional patterns that are not yet ready
  to hard-code, but that is a staging area, not the long-term home of mature
  pattern behavior.
- If a local UI problem is sufficiently constrained that the correct atom
  combination is effectively unique, treat that as a pattern-discovery signal.
  Do not keep re-solving that problem in `web`.

- Keep the frontend split strict even though everything ships from one repo.
- `packages/contracts` owns generated OpenAPI clients and DTOs only.
- `packages/mqueue` owns browser-facing HTTP calls, SSE wiring, stream merge,
  event projection, and any direct use of `@mini-stim/contracts`.
- `packages/hooks` owns React context/providers and atomic hooks over
  `mqueue`. It is the only stateful integration layer the web app should
  consume.
- `packages/components` owns reusable presentational UI primitives and
  hard-coded business-blind patterns. It should stay transport-agnostic and
  product-light.
- `apps/client/soma/web` owns route/page assembly, product-specific layout,
  and composer/transcript/session UX built from hooks and components.
- Web app code must not call raw `fetch`, construct `EventSource`, import
  `@mini-stim/contracts`, or reach into sidecar/browser globals directly.
- If a UI pattern is reusable across multiple client surfaces or would
  otherwise cause repeated atom soup or page-level CSS/control duplication,
  move it into `packages/components`, usually as a `pattern`, instead of
  re-implementing it in `web`.
- When deciding where a UI change belongs, use this ladder:
  - token issue -> theme/tokens
  - symbol issue -> `icons`
  - primitive capability issue -> `atoms`
  - recurring high-constraint composition issue -> `patterns`
  - product semantics / content assembly issue -> `web`
- Do not skip the `patterns` layer merely because a layout can technically be
  assembled from atoms. The question is not "can atoms express this?" but
  "should `web` have to re-decide this structure?"
- If logic is about transport, replay, stream state, or event normalization, it
  belongs below `web`, usually in `mqueue` or `hooks`, not inside React pages.
- Do not create a fake package/release process inside the repo. Keep the
  boundary architectural and local-first: workspace packages, direct
  consumption, and simple builds are enough.

## Data Modeling Rules

Keep the simplified model normalized:

- `conversations` owns conversation identity and lifecycle.
- `messages` owns message envelope, role, lifecycle, ordering, and provider/run
  references.
- `message_text_contents` owns text content.
- `response_runs` owns provider request lifecycle and provider metadata.
- `response_stream_deltas` records streaming text deltas in `(run_id, position)`
  order.

Do not use DB-level foreign keys. Store reference ids deliberately, enforce
relationship integrity in store transactions, and cover important invariants
with tests.

Current conventions:

- Use plural noun tables.
- Use `<entity>_id` identity columns.
- Use `created_at`, `updated_at`, `completed_at`, `state`, and `error` where
  lifecycle matters.
- Use explicit ordered columns such as `conversation_position` and `position`
  instead of relying on timestamps or UUID sort order.
- Provider raw payloads should not become the product truth. Persist only the
  metadata needed for replay, diagnosis, or future API requests.

## Common Commands

- `pnpm install`
- `runseal :init`
- `runseal :init --check`
- `runseal :pr --dry-run`
- `pnpm codegen`
- `sidecar doctor --config sidecar.toml`
- `sidecar plan --config sidecar.toml`
- `sidecar start --config sidecar.toml`
- `sidecar status --config sidecar.toml`
- `sidecar stop --config sidecar.toml`
- `cargo fmt --all --check`
- `flavor check --root . --config flavor.toml`
- `cargo test --workspace`
- `pnpm -r --if-present build`
- `SANTI_DB=.tmp/manual.sqlite cargo run -p mini-stim-server-soma -- serve`
- `cargo run -p mini-stim-client-soma -- dev`

Routine browser flows use `playwright-cli` as the default browser tool for this
repository. Prefer the named `mini-stim` session and the existing working
surface before considering any alternate browser layer.

- `runseal :browser check`
- `runseal :browser recover`
- `playwright-cli -s=mini-stim snapshot`
- `playwright-cli -s=mini-stim reload`
- `playwright-cli -s=mini-stim open http://127.0.0.1:<web-port> --headed`
- `playwright-cli -s=mini-stim close`

## Environment

`.env` is local and ignored by git. Select the model provider with:

```text
SANTI_PROVIDER=openai
```

OpenAI settings:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_RESPONSES_BASE_URL=https://api.openai.com/v1
OPENAI_REASONING_EFFORT=
OPENAI_REASONING_SUMMARY=
OPENAI_MAX_OUTPUT_TOKENS=
```

DeepSeek settings:

```text
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_THINKING=
DEEPSEEK_REASONING_EFFORT=
DEEPSEEK_MAX_TOKENS=
```

Server soma settings:

```text
SANTI_HOST=127.0.0.1
SANTI_DB=.tmp/manual.sqlite
SANTI_PORT=43307
```
