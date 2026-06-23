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

The only product loop is web client -> Rust server -> provider-abstracted model
streaming -> SQLite transcript.

`santi-core` owns the chat domain and persistence boundary. `santi-provider`
owns model-provider traits plus concrete provider implementations used by the
server soma. The root `sidecar.toml` starts project-local cells, and each cell
manages its sidecar-unaware soma.

Terminology:

- `cell`: the sidecar-managed control boundary.
- `soma`: the executable body managed by a cell.
- `store`: the namespace-local persistent storage root. Cells derive mutable
  app paths from store and pass concrete paths to somas.

## Scope

- Single-person conversations.
- Provider-abstracted model streaming.
- Normalized local SQLite persistence.
- Rust server soma with OpenAPI export.
- Generated TypeScript contracts.
- Vite/React web client.
- Product-neutral sidecar CLI dev loop with server/client cells.

Out of scope:

- Multiplayer chat.
- Agent registries, agent runtimes, delivery workers, product-specific sidecar
  semantics, Tauri, and native projections.
- Legacy OpenAI completions compatibility.

Modeled in core but deliberately not yet surfaced in the web UI. Each entry
names its unlock condition so deferral stays distinguishable from neglect:

- Session forking (`parent_session_id`, `fork_point`): modeled and stored,
  not exposed over the API. Unlocks when a turn-level "fork from here"
  action is wanted; the turn-grouped transcript is the natural anchor.
- Image message parts (`MessagePart::Image`): contracts and rendering
  pipeline accept them; the composer is text-only. Unlocks when a concrete
  image-input use case shows up in dogfooding.
- Message editing/deletion (`Message.version`, `deleted_at`,
  `MessageEvent` audit trail): event-sourced lifecycle exists; the UI
  renders latest state only. Unlocks if correction workflows matter more
  than transcript immutability.
- Soul-view timeline (`SoulSessionEntry`, dual seq sequences): the inspect
  panel shows memory and compact summaries, not the full "what the agent
  actually sees" context reconstruction. Unlocks as the inspect panel
  matures past its v1 form.
- Effects detail (`SessionEffect` payload/result refs): the inspect panel
  lists type and status only. Unlocks when hooks start producing effects
  worth debugging in the UI.

## Setup

Create local app config from `santi.example.toml`:

```sh
cp santi.example.toml santi.toml
```

Fill the selected profile in `santi.toml`. The file is ignored by git because
it owns local API keys and model parameters.

The default config path is `<cwd>/santi.toml`. Override it with `--config` or
`SANTI_CONFIG`. Provider selection resolves as
`--provider > config.provider > SANTI_PROVIDER > openai`.

Use `provider = "siliconflow"` or `--provider siliconflow` for GLM-5.2 through
SiliconFlow.

Install dependencies:

```sh
pnpm install
```

Initialize repository-local development hooks:

```sh
runseal :init
```

Generate contracts from the Rust OpenAPI source of truth:

```sh
runseal :codegen
```

## Run

Inspect the dev runtime plan:

```sh
sidecar doctor --config sidecar.toml
sidecar plan --config sidecar.toml
```

Start the server and client cells:

```sh
sidecar start --config sidecar.toml
```

Find the client URL:

```sh
sidecar list --format json
```

The cells allocate dev ports dynamically. `server` reports the API URL and
`client` reports the web URL through sidecar ready state.

Directly running `mini-stim-server-soma` requires `SANTI_DB` to be set. The
sidecar-managed server cell injects a namespace-local database path derived from
store.

## Development

Useful commands:

```sh
runseal :init
runseal :init --check
runseal :browser check
runseal :browser recover
runseal :browser reset
runseal :pr --dry-run
cargo fmt --all --check
flavor check --root . --config flavor.toml
cargo clippy --locked --workspace --all-targets -- -D warnings
cargo test --locked --workspace
runseal :codegen
pnpm typecheck
pnpm build
sidecar status --config sidecar.toml
sidecar stop --config sidecar.toml
```
