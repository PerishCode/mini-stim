# Docs

Use this directory only for durable design notes that are too detailed for `AGENTS.md`.

Use `.task/MAIN.md` for active planning and keep docs focused on settled boundary decisions.

## Index

- Current durable boundary is documented in `AGENTS.md`: single-person web chat,
  Rust server, provider-abstracted model streaming with concrete OpenAI and
  DeepSeek implementations, generated OpenAPI contracts, and normalized local
  persistence.
- The local dev runtime uses sidecar CLI with project-local cells and somas:
  `cell` is the managed control boundary, `soma` is the sidecar-unaware
  executable body, `store` is the namespace-local persistent storage root, and
  `proto/crates/*` locks typed cell protocols.
