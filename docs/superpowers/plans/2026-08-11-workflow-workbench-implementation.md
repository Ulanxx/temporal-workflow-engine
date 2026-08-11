# Workflow Workbench Implementation Plan

Source specification: `docs/superpowers/specs/2026-08-11-workflow-workbench-redesign.md`

## Delivery order

### 1. Foundation and shared contracts

Files:

- `packages/shared/src/types.ts`
- `packages/shared/src/catalog.ts`
- `packages/shared/src/definition.ts`
- `packages/shared/src/validation.ts`
- `packages/shared/src/events.ts`
- `packages/shared/src/fixtures/content-review.ts`

Work:

1. Replace `StepType` with a discriminated `NodeType` catalog covering all 29 nodes.
2. Define canonical `WorkflowDefinition`, `WorkflowDraft`, `WorkflowVersion`, `Run`, `StepInvocation`, `RunEvent`, `RunWait`, `Artifact`, and trigger contracts.
3. Register Zod-backed node schemas, defaults, ports, adapter states, and Chinese labels in one catalog.
4. Build canonicalization, checksum, graph validation, expression-reference extraction, dominance checks, and stable validation codes.
5. Add the AI content review template and deterministic sample input/output fixtures.

Verification:

- node defaults validate;
- the fixture publishes cleanly;
- invalid terminal, branch, loop, reference, and adapter configurations return stable codes.

### 2. Local persistence and artifacts

Files:

- `packages/persistence/src/schema.ts`
- `packages/persistence/src/database.ts`
- `packages/persistence/src/repositories/*.ts`
- `packages/persistence/src/artifacts.ts`
- `packages/persistence/src/seed.ts`
- `packages/api/src/app.module.ts`
- workspace manifests and migration scripts

Work:

1. Add Drizzle and SQLite with WAL mode and a repository-local ignored runtime directory.
2. Create migrations for workflows, drafts, versions, triggers, runs, step invocations, waits, events, artifacts, adapter status, and worker heartbeats.
3. Implement narrow repositories and atomic event sequence allocation with idempotency keys.
4. Implement local artifact writes and safe read/download resolution.
5. Seed the content-review template and local adapter state on first start.

Verification:

- migrations and seed are idempotent;
- state persists across process restarts;
- concurrent event inserts preserve unique sequence and idempotency constraints.

### 3. Temporal graph runtime

Files:

- `packages/worker/src/workflows/graph-workflow.ts`
- `packages/worker/src/workflows/signals.ts`
- `packages/worker/src/activities/event-activities.ts`
- `packages/worker/src/activities/adapters/*.ts`
- `packages/worker/src/activities/index.ts`
- `packages/worker/src/worker.ts`

Work:

1. Replace the single-path executor with a deterministic graph interpreter.
2. Implement End, condition, switch, parallel/merge, collection loop, wait, approval, and information-request behavior.
3. Add activity adapters for HTTP, local-script, browser, model call, MCP tool, notification, data transforms, and schema validation.
4. Emit durable Run and StepInvocation events through the event-writer activity.
5. Add queries for current state and signals for approval, response, and cancellation.
6. Implement rerun and resume parameters, honoring immutable definition checksums and successful invocation reuse.

Verification:

- deterministic workflow tests cover branches, merged branches, loop order, handled errors, approval, cancellation, and recovery;
- fixture reaches approval, then completion;
- forced HTTP failure produces an inspectable failed invocation and a derived recovery Run.

### 4. Control-plane API

Files:

- `packages/api/src/controllers/*.controller.ts`
- `packages/api/src/services/*.service.ts`
- `packages/api/src/dto/*.ts`
- `packages/api/src/sse/run-stream.service.ts`
- `packages/api/src/main.ts`

Work:

1. Replace in-memory workflow service with persistence-backed workflow, draft, version, trigger, run, catalog, integration, artifact, health, and settings services.
2. Implement all documented REST commands, optimistic draft revisions, publish checksums, and idempotency keys.
3. Register webhook routes and Temporal Schedule lifecycle management.
4. Implement Run SSE replay plus bounded database polling.
5. Expose Worker/Temporal/database health distinctly.

Verification:

- API integration tests cover draft conflict, immutable publish, trigger invocation, event replay, approval target identity, cancel, rerun, resume, and artifact access restrictions.

### 5. Designer workbench shell

Files:

- `packages/designer/src/main.tsx`
- `packages/designer/src/App.tsx`
- `packages/designer/src/styles/*.css`
- `packages/designer/src/components/shell/*`
- `packages/designer/src/pages/*`
- `packages/designer/package.json`

Work:

1. Remove Ant Design and legacy React Flow package dependencies.
2. Add React Router, TanStack Query, Zustand, Lucide, and the ZMZ AI-derived CSS token layer.
3. Implement responsive global rail, health status, command primitives, dialog, drawer, empty/error/loading states, and product routes.
4. Build workflow library, templates, integrations, settings, versions, and run-center pages.

Verification:

- responsive route navigation works at desktop, tablet, and mobile widths;
- no Ant Design style leakage remains;
- focus order, labels, and keyboard navigation pass component tests.

### 6. Graph editor and Inspector

Files:

- `packages/designer/src/editor/store.ts`
- `packages/designer/src/editor/node-registry.ts`
- `packages/designer/src/editor/GraphCanvas.tsx`
- `packages/designer/src/editor/nodes/*`
- `packages/designer/src/editor/edges/*`
- `packages/designer/src/editor/inspector/*`
- `packages/designer/src/editor/NodeLibrary.tsx`
- `packages/designer/src/editor/RunDrawer.tsx`

Work:

1. Implement typed node renderers, edge renderers, catalog search, drag/add, edge insertion, and auto-layout.
2. Implement Zustand history, selection, viewport, autosave revision handling, and validation navigation.
3. Implement schema-driven configuration fields, expressions, retry policy, node tests, and adapter availability.
4. Implement design/run/definition views and the Run Drawer.

Verification:

- create, connect, configure, delete, duplicate, undo, redo, and validate graph actions work;
- invalid port connections cannot be committed;
- canvas remains populated and readable at 1440x900 and mobile read-only mode.

### 7. Run observer and acceptance hardening

Files:

- `packages/designer/src/runs/*`
- `packages/designer/src/services/api.ts`
- `packages/designer/src/services/run-stream.ts`
- `packages/designer/e2e/*`
- root README files and Makefile scripts

Work:

1. Implement live SSE event reducer, topology status overlays, event/log/I/O/artifact tabs, approval, cancel, rerun, and resume controls.
2. Handle duplicate, out-of-order, stale, reconnect, and terminal event states.
3. Add unit, API integration, and Playwright test suites with deterministic adapter mode.
4. Update README with architecture, node support table, startup, fixture, and extension boundaries.
5. Run screenshots at 1440x900, 1280x800, and 390x844; inspect canvas pixels and accessibility states.

Verification:

1. Start services with `make start-all`.
2. Open the seeded template.
3. Change the existing notification target.
4. Validate and publish a new version.
5. Run with sample input and resolve approval.
6. Inspect a forced HTTP failure.
7. Resume its failed invocation into a derived Run.
8. Refresh and reconnect to prove the original Run and event stream are intact.

## Implementation discipline

- Each stage must build and test before the next stage begins.
- Keep external adapter support explicit; do not expose nonfunctional commands as finished features.
- Preserve local `make start-all` and `make stop-all` behavior throughout.
- Commit coherent, reviewable stage boundaries and push only verified work.
