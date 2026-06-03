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
- sidecar lifecycle or inspect surfaces
- Tauri, native macOS projections, or packaged platform launchers
- legacy OpenAI completions or chat completions compatibility

## Repository Structure

Use this structure:

```text
mini-stim/
├── apps/
│   ├── server/
│   │   └── crates/
│   │       ├── santi-api/   # Axum HTTP API, OpenAPI export, SSE endpoints
│   │       ├── santi-core/  # domain model, SQLite store, provider-agnostic service layer
│   │       └── santi-provider/ # provider traits and concrete provider implementations
│   └── client/              # Vite/React web client
├── packages/
│   ├── contracts/           # generated OpenAPI schema/types
│   └── components/          # reusable UI primitives used by client
├── docs/
└── .task/                   # local task memory, ignored by git
```

Do not recreate old top-level `crates/`, `projections/`, `sidecar.toml`, or
`apps/render.*` surfaces.

## Execution Rules

- Keep `.task/` local and ignored by git unless explicitly requested.
- Prefer one working web chat loop over architecture scaffolding.
- Server truth lives in `santi-core`; web UI consumes API contracts and must not
  define durable product semantics.
- Provider integration truth lives behind `santi-provider::ProviderClient`;
  `santi-core` must stay provider-agnostic.
- `santi-api` owns HTTP routing, SSE framing, and OpenAPI export.
- `packages/contracts` must be generated from the Rust OpenAPI source of truth.
- Do not hand-maintain divergent client/server DTOs.
- Use the provider boundary even when only OpenAI is configured. Do not add
  legacy completions paths.
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
- `cargo fmt --all --check`
- `flavor check --root .`
- `cargo test --workspace`
- `pnpm -r --if-present typecheck`
- `pnpm -r --if-present build`
- `cargo run -p santi-api -- serve`
- `pnpm -C apps/client dev`

## Environment

`.env` is local and ignored by git. Required OpenAI settings:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_RESPONSES_BASE_URL=https://api.openai.com/v1
```

Optional server settings:

```text
SANTI_DB=.tmp/santi.sqlite
SANTI_PORT=43307
```
