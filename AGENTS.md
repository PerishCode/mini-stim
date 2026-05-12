# AGENTS

## Purpose

`mini-stim` is the local-first, small-surface prototype for the Agent-Native IM shape behind `stim.io`.

It should grow the single-human-with-many-agents loop first: local agent identity, session shape, message routing, group conversation behavior, runtime visibility, and operator ergonomics. Once that shape is stable, promote the proven model into the larger `stim.io` production workspace.

## Product Boundary

`mini-stim` owns:

- the local single-user multi-agent IM experiment
- minimal agent/session/message/event semantics needed to dogfood the loop
- a self-contained `crates/`, `packages/`, and `apps/` layout
- local lifecycle through the external `sidecar` CLI
- code-shape checks through the external `flavor` CLI

`mini-stim` does not own:

- production `stim.io` module boundaries
- distributed human-to-human messaging
- account/auth infrastructure
- registry services or package/crate publishing infrastructure
- long-term replacement implementations for `stim`, `stim-server`, `stim-agents`, `stim-crates`, or `stim-packages`

## Repository Structure

```text
mini-stim/
├── apps/
│   ├── sidecar/     # future local runtime/orchestration app
│   └── renderer/    # future local IM workbench
├── crates/
│   ├── core/        # future local domain primitives
│   └── runtime/     # future runtime/service composition
├── packages/
│   ├── client/      # future browser/runtime client package
│   └── components/  # future minimal UI primitives
├── docs/            # durable design notes
└── .task/           # local task memory, ignored by git
```

Create these concrete subdirectories only when implementation starts. Until then, keep the top-level buckets simple.

## Relationship To `stim.io`

The local production workspace reference is `~/Projects/stim.io`.

Use it as a source of lessons, vocabulary, and eventual promotion targets. Do not make this repository depend on `stim.io` paths, submodules, unpublished packages, or workspace-local scripts.

Promotion targets should stay explicit:

- Rust primitives that survive the experiment can move to `modules/stim-crates/`.
- UI/package primitives that survive can move to `modules/stim-packages/`.
- Local agent orchestration semantics can move to `modules/stim-agents/`.
- Production IM product and server behavior can move to `modules/stim/` and `modules/stim-server/`.

## Execution Rules

- Keep `.task/` local and ignored by git unless explicitly requested.
- Prefer one real dogfoodable loop over broad architecture scaffolding.
- Keep runtime lifecycle manifest-closed through `sidecar`; do not grow a local replacement launcher.
- Use `flavor` as the code-shape check once code exists; do not vendor flavor rules into this repo.
- Keep hard cuts acceptable during the prototype. Add compatibility only when a real external surface exists.
- Keep the repo self-contained. If a concept requires `stim.io` to run, it is not yet mini enough.

## Common Commands

There are no implementation commands yet.

Expected future gates:

- `flavor check`
- `sidecar plan --config sidecar.toml --format json`
- app/package/crate-local guard commands once the directories contain code

## First Implementation Direction

Build the smallest local single-user multi-agent IM loop:

1. Define agent participants and local sessions.
2. Represent one-to-one and group conversations.
3. Route messages to selected agents.
4. Expose observable runtime state through `sidecar inspect`.
5. Keep enough UI to dogfood the loop honestly.
