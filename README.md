# mini-stim

`mini-stim` is a local-first single-person AI chat prototype.

It keeps the architecture deliberately small:

```text
apps/
  server/
    cell/
    soma/
      crates/
        santi-api/
        santi-core/
        santi-provider/
  client/
    cell/
    soma/
      web/
proto/
  crates/
    transport/
    server/
    client/
packages/
  contracts/
  components/
```

The only product loop is web client -> Rust server -> OpenAI Responses API
streaming -> SQLite transcript.

`santi-core` owns the chat domain and persistence boundary. `santi-provider`
owns model-provider traits plus the concrete OpenAI provider implementation used
by the server soma. The root `sidecar.toml` starts project-local cells, and each
cell manages its sidecar-unaware soma.

Terminology:

- `cell`: the sidecar-managed control boundary.
- `soma`: the executable body managed by a cell.
- `store`: the namespace-local persistent storage root. Cells derive mutable
  app paths from store and pass concrete paths to somas.

## Scope

- Single-person conversations.
- OpenAI Responses API native streaming.
- Normalized local SQLite persistence.
- Rust server soma with OpenAPI export.
- Generated TypeScript contracts.
- Vite/React web client.
- Product-neutral sidecar CLI dev loop with server/client cells.

Out of scope:

- Multiplayer chat.
- Agent registries, agent runtimes, delivery workers, product-specific sidecar
  semantics, Tauri, and native projections.
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
SANTI_HOST=127.0.0.1 SANTI_PORT=43307 SANTI_DB=.tmp/manual.sqlite cargo run -p mini-stim-server-soma -- serve
```

Then, in another shell:

```sh
curl -fsS "${SANTI_API_URL:-http://127.0.0.1:43307}/api/openapi.json" -o packages/contracts/openapi.json
python3 -m json.tool --indent 2 packages/contracts/openapi.json packages/contracts/openapi.json.tmp
mv packages/contracts/openapi.json.tmp packages/contracts/openapi.json
pnpm -C packages/contracts codegen
```

## Run

Inspect the dev runtime plan:

```sh
sidecar doctor
sidecar plan
```

Start the server and client cells:

```sh
sidecar start
```

Find the client URL:

```sh
sidecar inspect client client.status
```

The cells allocate dev ports dynamically. `server` reports the API URL and
`client` reports the web URL through their typed cell status entries.

Directly running `mini-stim-server-soma` requires `SANTI_DB` to be set. The
sidecar-managed server cell injects a namespace-local database path derived from
store.

## Development

Useful commands:

```sh
python3 scripts/init.py
cargo fmt --all --check
flavor check --root . --config flavor.toml
cargo clippy --locked --workspace --all-targets -- -D warnings
cargo test --locked --workspace
pnpm typecheck
pnpm build
sidecar status
sidecar stop
```
