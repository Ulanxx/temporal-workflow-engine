# Workflow Workbench Redesign

Status: approved in design review  
Date: 2026-08-11  
Repository: `temporal-workflow-engine`

## 1. Summary

Rebuild the existing single-page workflow demo as a complete technical low-code Workflow Workbench. The product is a general automation orchestrator with first-class AI capabilities and Temporal as its reliable execution plane.

The first release must provide a coherent loop:

1. create or open a workflow;
2. edit and validate a mutable draft;
3. test individual nodes with sample input;
4. publish an immutable version;
5. trigger a run from a version;
6. observe topology, events, logs, input/output, and artifacts;
7. approve, cancel, rerun, or recover from failure without losing audit history.

The visual language follows ZMZ AI: warm paper, warm ink, seal red, serif content typography, monospaced system metadata, hard rules, sharp corners, and restrained motion. The result should feel like an editorial control room built for repeated technical work, not a generic Ant Design dashboard.

## 2. Current-State Diagnosis

The current implementation is structurally a demo:

- the frontend is one page with a header, a small node palette, a canvas, and an Ant Design properties panel;
- the node system has eight loosely typed node types and visually repetitive cards;
- edges do not communicate branch, error, or data semantics;
- workflow definitions and execution records live in process memory;
- saving graph changes increments a semantic-looking patch version even though no immutable version exists;
- runtime status is mostly obtained by polling Temporal workflow status;
- the worker executes a single-path graph, prevents loops with a visited set, and cannot support parallelism, merge, approval, or resumable control flow;
- conditions and scripts use `new Function`, which is not an acceptable trust boundary;
- activity status logging writes to stdout instead of a product read model;
- the UI does not have workflow library, versioning, run center, run detail, or integration management surfaces.

This redesign replaces those assumptions instead of styling around them.

## 3. Product Definition

### 3.1 Primary user

The primary user is a technical operator or developer who can understand HTTP, JSON, variables, and expressions but expects visual structure and guided configuration. The product is technical low-code, not pure no-code and not a raw Temporal developer console.

### 3.2 Product focus

- General automation is the primary product category.
- AI model, MCP, knowledge, and Agent nodes are first-class capabilities.
- Temporal provides retries, timers, signals, cancellation, child workflows, and durable scheduling.
- Temporal-specific concepts remain available in advanced settings but do not dominate the primary UI vocabulary.

### 3.3 Representative workflow

The bundled example is an AI content review workflow:

`Webhook -> Data validation -> LLM analysis -> Risk condition -> Human approval -> HTTP publish -> Notification -> End`

This example must be usable as a real acceptance path, including an approval wait and an intentionally recoverable HTTP failure.

### 3.4 Non-goals for the first release

- team membership, RBAC, billing, or multi-tenant isolation;
- a public integration marketplace;
- production-grade secret management beyond credential references and environment-backed values;
- full multi-tenant sandbox security for arbitrary user scripts;
- mobile graph authoring;
- complete runtime adapters for Agent, knowledge retrieval, generic event subscription, filter, aggregate, child workflow, database, and file nodes.

Those eight nodes are still defined by stable catalog contracts and rendered as normal product nodes. Their Inspector shows adapter availability and required setup rather than a vague disabled placeholder.

## 4. Information Architecture

### 4.1 Product routes

| Route | Surface | Responsibility |
| --- | --- | --- |
| `/workflows` | Workflow library | Search, filter, create, duplicate, archive, and open workflows |
| `/workflows/:workflowId` | Designer | Edit draft, inspect nodes, validate, test, publish, and start a run |
| `/workflows/:workflowId/versions` | Versions | Compare immutable versions and inspect publication metadata |
| `/runs` | Run center | Filter runs by workflow, status, version, trigger, and time |
| `/runs/:runId` | Run detail | Observe topology, timeline, logs, I/O, artifacts, approval, cancel, and recovery |
| `/integrations` | Integration settings | Configure credential references and inspect adapter availability |
| `/templates` | Templates | Open and instantiate bundled workflow templates |
| `/settings` | Local settings | Temporal connection, API status, runtime defaults, and appearance |

### 4.2 Designer workspace

The selected layout is an editorial workbench with four persistent regions:

1. **Global rail**: workflows, runs, integrations, templates, settings.
2. **Node library**: searchable catalog grouped by domain.
3. **Graph canvas**: the dominant flexible region.
4. **Inspector**: configuration for the current node, edge, or workflow.

A collapsible run drawer spans beneath the node library, canvas, and Inspector. It gives enough live context to monitor a run without leaving the Designer. Full investigation opens the run detail route.

The canvas supports three views over one topology:

- **Design**: structure, typed ports, validation, editing tools;
- **Run**: node status, attempts, duration, active branches, and error paths;
- **Definition**: canonical JSON definition with validation errors and read-only diff against the published version.

### 4.3 Run detail

Run detail keeps topology visible while the detail pane switches between:

- events;
- logs;
- input;
- output;
- artifacts.

Selecting a node scopes all five tabs to that step. Clearing selection returns to run-level data.

## 5. Visual Language

### 5.1 Tokens

Use CSS custom properties as the source of truth:

| Token | Intent | Initial value |
| --- | --- | --- |
| `--color-paper` | app background | `oklch(0.95 0.012 85)` |
| `--color-surface` | working surface | `oklch(0.97 0.008 85)` |
| `--color-surface-strong` | selected/secondary surface | `oklch(0.92 0.014 80)` |
| `--color-ink` | primary text/rules | `oklch(0.18 0.011 40)` |
| `--color-muted` | metadata | `oklch(0.47 0.013 55)` |
| `--color-line` | borders/grid | `oklch(0.86 0.012 80)` |
| `--color-accent` | seal red | `oklch(0.46 0.150 27)` |
| `--color-accent-strong` | hover/active red | `oklch(0.39 0.150 27)` |
| `--color-success` | successful execution | `oklch(0.52 0.090 160)` |
| `--color-warning` | waiting/retry | `oklch(0.58 0.11 65)` |
| `--color-data` | data-reference edge | `oklch(0.45 0.08 235)` |

Typography:

- content and Chinese titles: `Noto Serif SC`, `Source Han Serif SC`, `Songti SC`, serif;
- system labels, status, values, code: `JetBrains Mono`, `SFMono-Regular`, monospace.

UI text uses normal letter spacing. Monospaced uppercase metadata may use modest positive tracking. Corners remain square or at most 2px; repeated item cards never exceed 4px.

### 5.2 Visual rules

- hard black rules establish page and panel hierarchy;
- seal red marks selection, primary commands, AI/human nodes, and failure emphasis;
- green, amber, and blue are semantic accents, not competing themes;
- avoid gradients, decorative blobs, nested cards, large rounded containers, and generic dashboard statistics;
- use Lucide icons for familiar commands; use a compact seal mark for the product identity;
- animation is limited to panel transitions, selection, run progress, and one restrained initial reveal;
- respect `prefers-reduced-motion`;
- all icon buttons have accessible labels and tooltips.

## 6. Frontend Architecture

### 6.1 Dependencies

- keep React 18, Vite, TypeScript, and React Flow 11;
- remove `react-flow-renderer` and Ant Design from the Designer package;
- add React Router for product routes;
- add TanStack Query for server state and invalidation;
- add Zustand for graph draft, selection, history, viewport, and transient editor state;
- add Lucide React for icons;
- add Zod for runtime validation shared with node schemas;
- use CSS modules or focused global component layers rather than inline styling.

### 6.2 Component boundaries

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `WorkbenchShell` | global rail, health, route outlet | router, health query |
| `WorkflowLibrary` | workflow assets and create/duplicate/archive commands | workflow API |
| `DesignerPage` | coordinates draft query, editor store, save/publish/run commands | draft API, graph store |
| `NodeLibrary` | search, groups, adapter status, drag/create | node registry |
| `GraphCanvas` | React Flow integration only | graph store, node/edge renderers |
| `WorkflowNode` | stable node anatomy and design/run overlays | node registry, run state |
| `WorkflowEdge` | control, condition, error, and data-reference visuals | edge data |
| `Inspector` | routes selection to workflow/node/edge inspector | inspector registry |
| `NodeInspector` | schema-driven fields plus input/retry/test tabs | node registry, draft commands |
| `RunDrawer` | latest/current run summary | run event stream |
| `RunCenter` | searchable run list | runs API |
| `RunDetail` | topology and detail tabs | run snapshot, event stream |
| `ApprovalPanel` | approval input and signal command | run command API |

`GraphCanvas` must not own API calls, node schemas, or product navigation. Node forms must not mutate React Flow nodes directly; they submit typed patches to the graph store.

### 6.3 Editor behavior

- opening a workflow loads its current draft and base revision;
- local mutations update the graph store and add undo/redo history;
- draft saving is debounced and uses optimistic concurrency with `revision`;
- a revision conflict pauses autosave and offers reload or explicit overwrite after showing a definition diff;
- dragging from the library and clicking an edge insertion control both create nodes;
- the command palette supports node creation and navigation;
- delete, duplicate, undo, redo, fit view, zoom, auto-layout, and selection shortcuts are implemented;
- edge creation validates port compatibility before commit;
- validation issues are shown in a dedicated panel and attached to relevant nodes/edges;
- selecting a node never resizes it; all dynamic status content uses reserved regions.

## 7. Node System

### 7.1 Catalog contract

Every node definition is registered once and shared by the editor, validator, and runtime:

```ts
interface NodeDefinition<TConfig, TInput, TOutput> {
  type: NodeType;
  category: NodeCategory;
  title: string;
  description: string;
  icon: IconName;
  adapter: AdapterDescriptor;
  configSchema: ZodType<TConfig>;
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  defaultConfig: TConfig;
  ports: PortDefinition[];
  execution: 'deterministic' | 'activity' | 'signal' | 'extension';
}
```

An unavailable extension remains selectable and configurable. Its Inspector names the missing adapter and setup requirements, and workflow validation prevents publication until the adapter is available.

### 7.2 First-release catalog

| Category | Nodes | Runtime in first release |
| --- | --- | --- |
| Trigger | Manual, Webhook, Schedule, Event Subscription | first three |
| AI | Model Call, Agent, MCP Tool, Knowledge Retrieval | Model Call, MCP Tool |
| Flow Control | Condition, Switch, Parallel, Merge, Loop, Wait, Child Workflow, End | all except Child Workflow |
| Data | Set Variable, Transform, Filter, Aggregate, Schema Validate | Set Variable, Transform, Schema Validate |
| Action | HTTP Request, Script, Browser, Database, Notification, File | HTTP, Script, Browser, Notification |
| Human | Approval, Information Request | both |

This yields 29 stable node definitions and 21 executable nodes. `End` is an explicit deterministic terminal node whose outcome is `success` or `failure`.

### 7.3 Node anatomy

Each node reserves fixed areas for:

- category and sequence;
- title and short configuration summary;
- retry/timeout or wait policy;
- output type;
- design validation or run status.

Category distinctions are structural, not arbitrary colors:

- trigger nodes use an ink header;
- AI and human nodes use a seal-red left rule;
- action nodes use a data-blue left rule;
- control nodes use a double rule;
- run status adds a semantic overlay without changing node size.

### 7.4 Edge semantics

- `control`: normal execution order;
- `condition`: labeled business branch with expression summary;
- `error`: explicit failure/timeout/retry-exhausted route;
- `data`: a derived dashed visualization of an expression reference, not an independently editable execution edge.

Branch edges must have unique labels. A condition/switch node must have a default path unless validation proves exhaustiveness. Normal action nodes allow one control successor; fan-out requires a Parallel node.

Control-node semantics are fixed for the first release:

- **Parallel** opens named branch scopes. Every branch must terminate at the matching Merge node. No control edge may enter a branch from outside its scope.
- **Merge all** waits for every branch. An unhandled branch failure cancels outstanding branch Activity scopes and fails the Run. Outputs are namespaced by branch ID.
- **Merge any** completes on the first successful branch, cancels outstanding branch Activity scopes, and exposes `{ winner, branches }`. If every branch fails, the Merge fails. Temporal History ordering decides simultaneous completion; branch names provide stable output identity.
- **Loop** is collection iteration in the first release. It has `body` and `done` ports, requires a finite input collection and `maximumIterations`, and records outputs as an array ordered by zero-based iteration index. The body returns only to its owning Loop node. General while loops are deferred.
- **Error edge** runs only after the source node exhausts its retry policy. It receives a bounded structured error output. A node with a taken error edge is recorded as `failed_handled`; the Run may complete with warnings. Without an error edge, the failure propagates to the enclosing Parallel scope or Run.
- **End** is the only legal control-path terminal. An End configured as `failure` terminates the Run with its supplied code and message.

Data-reference edges are generated from configuration expressions such as `steps.analyze.output.score`; users do not draw them directly. Control edges alone determine scheduling. A referenced output is ready only after its producing invocation completes. Validation requires the producer to dominate the consumer on every possible control path, or to be exposed by the consumer's matching Merge. Loop-body references are scoped to the current iteration unless they explicitly target the Loop aggregate output.

### 7.5 Graph validation

Publication fails when any of these are true:

- trigger count is not exactly one for a published workflow;
- an executable node is unreachable;
- a control path can terminate without an explicit End node;
- a typed port connection is incompatible;
- a required node configuration is invalid;
- branch labels conflict or no fallback exists;
- a cycle does not pass through a Loop node;
- Parallel branches do not have a valid Merge boundary;
- a data reference does not dominate its consumer or crosses an invalid branch/iteration scope;
- an adapter is unavailable;
- a credential reference is missing;
- an expression references an unavailable output path.

## 8. Definition, Version, and Run Lifecycle

### 8.1 Draft

A workflow has one mutable draft. The draft contains the canonical definition, viewport, revision, and update metadata. Autosave does not create a version.

### 8.2 Node test

Node test uses sample input and a sandbox execution endpoint. It does not create a production Run and does not write production artifacts. Tests for deterministic nodes execute in the API; Activity-backed nodes use a short-lived Temporal test workflow or adapter invocation with explicit sandbox metadata.

### 8.3 Publish

Publishing:

1. validates the draft against the catalog and graph rules;
2. canonicalizes the definition;
3. computes a checksum;
4. creates an immutable monotonically numbered version;
5. records a change summary against the previously published version;
6. marks that version as the workflow's current published version.

Identical checksums do not create duplicate versions.

### 8.4 Run

Every Run records:

- workflow and immutable version IDs;
- Temporal workflow ID and run ID;
- trigger type and trigger metadata;
- input snapshot;
- lifecycle status;
- start/end timestamps;
- optional source run for recovery;
- final output or failure summary.

Every dynamic node execution is a **step invocation** with a stable `invocationId`. The ID is derived from the Run, node ID, named branch path, and loop iteration path. Activity attempts belong to an invocation and do not change its ID. Parallel branches and loop iterations may therefore create multiple invocations for one catalog node without making approvals, events, or recovery ambiguous.

### 8.5 Recovery

- **Activity retry** remains inside the current Temporal Run and follows node policy.
- **Resume from failed node** targets a specific failed `invocationId` and creates a derived Run with `resumedFromRunId` and `resumedFromInvocationId`. It reuses persisted outputs only from invocations proven successful in the same immutable definition checksum. The default target is the first unhandled failed leaf in event-sequence order.
- **Rerun** creates a fresh Run with the same version and input.
- **Clone and fix** creates a draft from the run's version; publishing it creates a new version before execution.

The original Run is never mutated from failed to successful.

## 9. Runtime Architecture

### 9.1 Source-of-truth boundaries

- Temporal History is authoritative for active runtime state.
- The database is authoritative for workflow assets, drafts, versions, adapter metadata, and the product-facing read model.
- Run events project Temporal execution into a stable UI protocol.
- The frontend never consumes raw Temporal SDK event structures.

### 9.2 Generic graph workflow

The Temporal workflow receives an immutable definition snapshot, run identity, and input. It implements deterministic control nodes and delegates side effects to Activity adapters.

Workflow Queries expose a compact current-state snapshot. Signals handle approval, information requests, and cancellation intent. Child workflows are reserved for the Child Workflow extension node.

Large payloads are not retained in Workflow History. Activities write screenshots, files, large model responses, and browser traces to artifact storage and return bounded metadata plus a URI.

Approval and information nodes create a persisted wait request with a unique `waitId`, `invocationId`, expected response schema, status, and expiration. The corresponding Temporal Signal includes both IDs. Approve/respond commands target the wait request rather than a node ID, so concurrent branches and loop iterations remain unambiguous.

### 9.3 Expressions and scripts

- conditions, mappings, and variable references use a constrained expression parser with an allowlisted grammar;
- the parser has no global object access, function construction, imports, mutation, or I/O;
- script execution never occurs inside API code or Temporal workflow code;
- the first release marks Script as local-runtime only and requires an explicit unsafe-script setting until a production sandbox adapter is configured;
- script timeout, output size, and process resources are bounded;
- secrets are redacted from logs and projected events.

## 10. Persistence Model

Use Drizzle with SQLite for local development. Define only narrow repository interfaces around the listed entities; do not build a generic persistence framework. The boundary should permit a later Postgres implementation without adding first-release abstractions for unused databases.

Core entities:

- `workflows`;
- `workflow_drafts`;
- `workflow_versions`;
- `runs`;
- `run_steps`;
- `run_events`;
- `run_waits`;
- `artifacts`;
- `workflow_triggers`;
- `credential_references`;
- `adapter_status`.

`run_steps` stores one row per invocation, including `invocation_id`, node ID, branch path, iteration path, status, attempt count, and bounded input/output summaries. `run_waits` links approval or information requests to a specific invocation.

`workflow_triggers` stores trigger ID, workflow ID, trigger type, enabled state, configuration, credential/secret reference, version policy (`latest` or `pinned`), pinned version when applicable, and external registration ID such as a Temporal Schedule ID.

`runs` stores `next_event_sequence`. A Worker event-writer Activity allocates a sequence and inserts the event in one SQLite `BEGIN IMMEDIATE` transaction. Each event also carries a deterministic idempotency key based on Run, invocation, event type, attempt, and occurrence; duplicate writes return the existing event. Sequence order is commit/observation order for concurrent branches, not a claim about logical branch precedence.

`run_events` has unique `(run_id, sequence)` and `(run_id, idempotency_key)` keys. SQLite runs in WAL mode because API reads and Worker event writes occur from separate processes. For the first release, API SSE handlers replay persisted events and poll for newer committed sequences at a bounded interval; they do not rely on in-process notifications from the Worker. This makes cross-process delivery correct before a later Postgres notification implementation exists.

Artifact metadata is stored in the database. Local development stores artifact files under a configured repository-local runtime directory ignored by Git. The storage interface supports an object-store implementation later.

## 11. API Contract

The exact DTO shapes are defined during implementation, but route ownership is fixed:

### Workflow and draft

- `GET /api/workflows`
- `POST /api/workflows`
- `GET /api/workflows/:workflowId`
- `POST /api/workflows/:workflowId/duplicate`
- `POST /api/workflows/:workflowId/archive`
- `GET /api/workflows/:workflowId/draft`
- `PUT /api/workflows/:workflowId/draft` with base revision
- `POST /api/workflows/:workflowId/validate`
- `POST /api/workflows/:workflowId/publish`
- `GET /api/workflows/:workflowId/versions`
- `GET /api/workflows/:workflowId/versions/:versionId`

### Node and integration

- `GET /api/node-catalog`
- `POST /api/nodes/test`
- `GET /api/integrations`
- `PUT /api/integrations/:adapterId`

### Trigger lifecycle

- `GET /api/workflows/:workflowId/triggers`
- `POST /api/workflows/:workflowId/triggers`
- `PUT /api/workflows/:workflowId/triggers/:triggerId`
- `POST /api/workflows/:workflowId/triggers/:triggerId/enable`
- `POST /api/workflows/:workflowId/triggers/:triggerId/disable`
- `DELETE /api/workflows/:workflowId/triggers/:triggerId`
- `POST /api/hooks/:triggerId/:token`

Webhook creation returns the public path once and persists only a token hash. An enabled webhook resolves its `latest` or `pinned` version policy at request time, creates a Run, and returns `202` with the Run ID. Schedule trigger enable/update creates or updates a Temporal Schedule using the external registration ID; disable pauses it, and delete removes it. Publishing a workflow updates `latest` trigger metadata without rewriting historical Runs.

### Run commands and queries

- `GET /api/runs`
- `POST /api/workflows/:workflowId/runs`
- `GET /api/runs/:runId`
- `GET /api/runs/:runId/events`
- `GET /api/runs/:runId/stream`
- `POST /api/runs/:runId/cancel`
- `POST /api/runs/:runId/waits/:waitId/approve`
- `POST /api/runs/:runId/waits/:waitId/respond`
- `POST /api/runs/:runId/rerun`
- `POST /api/runs/:runId/resume` with `invocationId`

### Health, settings, and artifacts

- `GET /api/health`
- `GET /api/settings/runtime`
- `PUT /api/settings/runtime`
- `GET /api/artifacts/:artifactId`
- `GET /api/artifacts/:artifactId/content`

Health reports database, Temporal, and Worker states separately. Worker health comes from a bounded heartbeat record plus Temporal task-queue poller inspection. Runtime settings only manage non-secret local configuration; environment values remain read-only and are identified as such. Artifact content verifies the database record, resolves only storage-managed paths/URIs, uses safe content headers, and supports download without exposing arbitrary filesystem paths.

All commands accept an idempotency key. Error responses use stable machine-readable codes and human-readable Chinese messages.

## 12. Real-Time Events

The first release uses Server-Sent Events.

- events have monotonic per-run sequence numbers allocated transactionally at persistence commit;
- the SSE event ID equals the run event sequence;
- clients reconnect with `Last-Event-ID`;
- the server replays persisted events after that sequence before entering bounded database polling for live delivery;
- duplicate events are ignored by `(runId, sequence)`;
- the frontend falls back to snapshot refetch when the requested sequence has expired or continuity cannot be proven;
- terminal states close the live stream after a final snapshot event.

Representative event types:

- `run.created`, `run.started`, `run.completed`, `run.failed`, `run.canceled`;
- `step.queued`, `step.started`, `step.retrying`, `step.waiting`, `step.completed`, `step.failed`, `step.skipped`;
- `approval.requested`, `approval.resolved`;
- `artifact.created`;
- `log.appended`.

## 13. Error Handling

### 13.1 Editor errors

- field issues appear next to the field and in the validation panel;
- graph issues focus the relevant node or edge;
- autosave failures preserve local changes and show retry state;
- revision conflicts stop autosave and require an explicit resolution;
- unavailable adapters name the exact missing capability.

### 13.2 Runtime errors

- node status reserves display space for attempt, duration, and failure code;
- run detail selects the first failed step by default;
- errors show stable code, concise message, attempt history, relevant input/output summary, and trace/request ID;
- raw stack traces stay in expandable logs;
- credentials and configured secret fields are redacted before persistence;
- cancel, approve, resume, and rerun commands are idempotent.

### 13.3 Temporal and database degradation

- API health reports database, Temporal, and Worker availability separately;
- editing and draft saving remain available when Temporal is offline;
- publishing remains available if catalog validation and database are healthy;
- run commands are disabled with a precise runtime-unavailable reason;
- stale run projections are marked with the last synchronized timestamp;
- projection reconciliation can rebuild a Run from Temporal state and persisted events.

## 14. Responsive and Accessibility Behavior

- full graph editing targets desktop widths of 1024px and above;
- at tablet widths, the node library and Inspector become mutually exclusive drawers;
- on mobile, workflow library, run list, run detail, logs, artifacts, and approval remain usable;
- mobile graph view is read-only with pan/zoom and node detail sheets;
- all text fits at 390x844 without horizontal page scrolling;
- keyboard navigation covers global routes, node library, Inspector fields, tabs, and commands;
- graph nodes expose meaningful accessible labels and status text;
- color is never the only status indicator;
- focus rings use the accent token and remain visible on paper and ink surfaces.

## 15. Testing Strategy

### 15.1 Shared and runtime unit tests

- every node default config passes its schema;
- invalid graph invariants produce stable validation codes;
- expression parser rejects global access, functions, and mutation;
- control nodes cover condition, switch, parallel/merge, loop limit, wait, and cancellation;
- recovery only reuses successful outputs from the same version checksum;
- event sequencing is monotonic and deduplicated.

### 15.2 API integration tests

- create -> autosave revision -> conflict -> validate -> publish;
- identical publish checksum does not create another version;
- run binds immutable version and input;
- SSE replay resumes from `Last-Event-ID`;
- approval by `waitId` and cancel commands are idempotent;
- database state survives API restart;
- Temporal-offline health and command behavior are explicit.

### 15.3 Frontend component tests

- catalog search and adapter status;
- node creation, connection validation, insertion, deletion, undo, and redo;
- Inspector schema rendering and expression references;
- validation issue navigation;
- run event reducer with duplicate and out-of-order input;
- responsive drawers and mobile read-only graph.

### 15.4 Browser acceptance

Use Playwright at 1440x900, 1280x800, and 390x844.

The primary scenario must:

1. open the bundled AI content review workflow;
2. change the target of the existing, connected notification node;
3. pass graph and configuration validation;
4. publish a new immutable version;
5. run with sample input;
6. observe live node status;
7. resolve an approval wait;
8. inspect a forced HTTP failure;
9. create a recovery Run;
10. verify the original failed Run remains unchanged.

Screenshots verify no overlap, clipping, blank canvas, missing icons, or layout shifts. A canvas pixel check verifies graph content is nonblank at desktop and mobile viewports.

## 16. Delivery Scope

The first implementation delivers:

- all product routes and responsive surfaces listed in this document;
- the ZMZ AI-derived design system without Ant Design;
- 29 catalog definitions, 21 executable nodes, and explicit extension status for eight nodes;
- draft autosave, validation, immutable publishing, version list, and version detail;
- run start, live events, run detail, approval, cancellation, rerun, and recovery;
- SQLite persistence and local artifact storage;
- bundled AI content review template and deterministic demo adapter mode;
- unit, integration, and Playwright acceptance coverage.

Implementation may be staged internally, but the repository should not present partial navigation, fake buttons, or unlabelled unavailable features as completed behavior.

### 16.1 Implementation stages

Planning must preserve this dependency order:

1. **Shared contracts**: node registry, canonical definition, schemas, graph validator, invocation identity, and event types.
2. **Persistence and seed**: SQLite schema, narrow repositories, migration runner, artifact storage, and the bundled acceptance fixture.
3. **Execution and projection**: deterministic graph workflow, Activity adapters, wait Signals, event writer, trigger registration, recovery, and reconciliation.
4. **Control-plane API**: workflow/draft/version, catalog/integration, trigger, run command/query, SSE, health/settings, and artifact routes.
5. **Workbench shell**: design tokens, routes, workflow library, integration/settings surfaces, and responsive navigation.
6. **Designer and observer**: graph store, node/edge rendering, Inspector registry, validation, versions, Run Drawer, Run Center, and Run Detail.
7. **Acceptance hardening**: unit/integration/browser tests, deterministic demo mode, screenshots, README, and startup verification.

A stage may expose internal routes or test harnesses needed by the next stage. User-facing navigation remains hidden until its commands and error states are functional.

## 17. Acceptance Criteria

The redesign is complete when:

- a fresh install starts with the documented `make start-all` command;
- the bundled workflow is present and survives restarts;
- a user can edit, validate, publish, execute, approve, inspect failure, and recover without using Temporal UI;
- every visible command either works or clearly reports the missing external adapter/configuration;
- all 29 nodes render consistently and expose schema-backed configuration;
- run topology and detail agree after refresh and SSE reconnect;
- the original failed Run remains immutable after recovery;
- desktop and mobile browser acceptance passes;
- `pnpm build`, unit tests, API integration tests, and browser tests pass;
- the README documents architecture, supported nodes, local startup, demo flow, and current extension boundaries.
