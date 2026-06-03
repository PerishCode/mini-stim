# mini-stim

`mini-stim` is a local-first single-person AI chat prototype.

It keeps the architecture deliberately small:

```text
apps/
  server/
    crates/
      santi-api/
      santi-core/
      santi-provider/
  client/
packages/
  contracts/
  components/
```

The only product loop is web client -> Rust server -> OpenAI Responses API
streaming -> SQLite transcript.

`santi-core` owns the chat domain and persistence boundary. `santi-provider`
owns model-provider traits plus the concrete OpenAI provider implementation used
by `santi-api`.

## Scope

- Single-person conversations.
- OpenAI Responses API native streaming.
- Normalized local SQLite persistence.
- Rust API server with OpenAPI export.
- Generated TypeScript contracts.
- Vite/React web client.

Out of scope:

- Multiplayer chat.
- Agent registries, agent runtimes, delivery workers, sidecar inspect, Tauri,
  and native projections.
- Legacy completions or chat completions compatibility.

## Setup

Create `.env` from `.env.example` and fill:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_RESPONSES_BASE_URL=https://api.openai.com/v1
OPENAI_REASONING_EFFORT=
OPENAI_MAX_OUTPUT_TOKENS=
```

Install dependencies:

```sh
pnpm install
```

Generate contracts from the Rust OpenAPI source of truth:

```sh
pnpm codegen
```

## Run

Start the server:

```sh
cargo run -p santi-api -- serve
```

Start the client:

```sh
pnpm -C apps/client dev
```

Open:

```text
http://127.0.0.1:41420/
```

The API listens on `http://127.0.0.1:43307` by default.

## Development

Useful commands:

```sh
python3 scripts/init.py
cargo fmt --all --check
flavor check --root .
cargo test --workspace
pnpm codegen
pnpm -r --if-present typecheck
pnpm -r --if-present build
```

Full local guard:

```sh
pnpm guard
```
