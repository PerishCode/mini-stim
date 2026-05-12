# mini-stim

`mini-stim` is the small, local-first prototype loop for the Agent-Native IM shape behind `stim.io`.

It explores one human working with a local group of agents before the model is promoted into the production `stim.io` workspace. The point is to validate the product/runtime shape with fewer moving parts, not to create a second long-term production system.

## Scope

- Single-user, local-first multi-agent IM.
- Local agent sessions, agent identities, message routing, and runtime visibility.
- A self-contained `crates/`, `packages/`, and `apps/` layout.
- External dependencies limited to the already-proven `flavor` and `sidecar` tools.

Out of scope for the first loop:

- Distributed human-to-human messaging.
- Production account/auth systems.
- Durable multi-tenant server infrastructure.
- Registry publishing as a prerequisite for local iteration.

## Relationship To `stim.io`

The local reference workspace is:

```text
~/Projects/stim.io
```

`mini-stim` should learn from `stim.io`, but it is not a submodule and should not depend on that workspace at runtime. Treat `stim.io` as the production architecture target and source of boundary lessons.

When the local experiment shape stabilizes, promote the proven semantics back into `stim.io` deliberately:

- shared primitives into `stim-crates` / `stim-packages`
- agent orchestration into `stim-agents`
- production IM surfaces into `stim` / `stim-server`

## Repository Shape

```text
mini-stim/
├── apps/       # local sidecar and renderer apps
├── crates/     # Rust primitives and runtime services
├── packages/   # TypeScript packages and UI primitives
├── docs/       # durable design notes when AGENTS.md is too small
├── .task/      # local task memory; ignored by git
└── AGENTS.md   # repository boundary and execution rules
```

## Current Status

This repository is scaffolded only. The next session should start from `.task/MAIN.md`.
