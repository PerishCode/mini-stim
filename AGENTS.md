# AGENTS

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
- provider-abstracted model streaming with an OpenAI Responses implementation
- a Rust server with OpenAPI-exported contracts
- a web client generated against those contracts

`mini-stim` does not own:

- multiplayer chat
- participant/member/target-set modeling
- agent registries or agent runtime orchestration
- delivery targets, delivery workers, or retry leases
- product-specific sidecar semantics beyond the local cell/soma dev runtime
- Tauri, native macOS projections, or packaged platform launchers
- legacy OpenAI completions or chat completions compatibility

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
│   └── components/          # reusable UI primitives used by client
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
- Provider integration truth lives behind `santi-provider::ProviderClient`;
  `santi-core` must stay provider-agnostic.
- The server soma owns HTTP routing, SSE framing, and OpenAPI export through the
  `mini-stim-server-soma` bin.
- `packages/contracts` must be generated from the Rust OpenAPI source of truth.
- Do not hand-maintain divergent client/server DTOs.
- Use the provider boundary even when only OpenAI is configured. Do not add
  legacy completions paths.
- If the expected local environment or command is unavailable, report the
  missing prerequisite directly and stop that path. Do not spend time inventing
  fallbacks or exploring unrelated environment workarounds unless the user asks.
- Keep hard cuts acceptable. Add compatibility only for a real external surface.

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
- `pnpm codegen`
- `sidecar doctor`
- `sidecar plan`
- `sidecar start`
- `sidecar status`
- `sidecar stop`
- `cargo fmt --all --check`
- `flavor check --root . --config flavor.toml`
- `cargo test --workspace`
- `pnpm -r --if-present typecheck`
- `pnpm -r --if-present build`
- `SANTI_DB=.tmp/manual.sqlite cargo run -p mini-stim-server-soma -- serve`
- `cargo run -p mini-stim-client-soma -- dev`

## Environment

`.env` is local and ignored by git. Required OpenAI settings:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_RESPONSES_BASE_URL=https://api.openai.com/v1
OPENAI_REASONING_EFFORT=
OPENAI_MAX_OUTPUT_TOKENS=
```

Server soma settings:

```text
SANTI_HOST=127.0.0.1
SANTI_DB=.tmp/manual.sqlite
SANTI_PORT=43307
```
