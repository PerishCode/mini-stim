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
cargo run -p santi-api -- serve
curl -fsS "${SANTI_API_URL:-http://127.0.0.1:43307}/api/openapi.json" -o packages/contracts/openapi.json
python3 -m json.tool --indent 2 packages/contracts/openapi.json packages/contracts/openapi.json.tmp
mv packages/contracts/openapi.json.tmp packages/contracts/openapi.json
pnpm exec orval --config orval.config.ts
pnpm exec prettier --write packages/contracts/src/openapi.ts
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
flavor check --root . --config flavor.json
cargo clippy --locked --workspace --all-targets -- -D warnings
cargo test --locked --workspace
pnpm typecheck
pnpm build
```
