# Temporal Workflow Engine

A Temporal-based workflow engine for reliable execution of browser, script, HTTP, and approval steps.

This is not a generic low-code platform and not a toy browser automation demo. The point is to run business workflows end to end, with replayable state and a clear execution timeline.

## Current boundary

- Workflow is the primary object
- Run, step, activity, artifact, and timeline are the core concepts
- Playwright is only one browser-step adapter
- Temporal owns retries, cancellation, recovery, and long-running orchestration
- The designer is for editing and inspection, not the engine core

## Repo layout

- `packages/shared`: shared types, workflow definition, activity contract
- `packages/api`: workflow CRUD, launch, status, cancellation
- `packages/worker`: Temporal worker and activity adapters
- `packages/designer`: React Flow editor

## Local start

```bash
pnpm install
pnpm temporal:dev-server
pnpm start:api
pnpm start:worker
pnpm start:designer
```

`pnpm temporal:dev-server` requires the Temporal CLI. On macOS:

```bash
brew install temporal
```

## Phase 1

1. Lock the workflow definition and step schema
2. Persist run timeline and artifacts
3. Unify browser/script/http/approval as activity adapters
4. Move state out of memory
5. Let the designer edit, launch, and inspect failures

## Terms

- workflow: the definition
- run: one execution
- step: one step in the definition
- adapter: a pluggable execution path

## License

MIT
