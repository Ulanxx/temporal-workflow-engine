import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('active'),
  currentDraftId: text('current_draft_id').notNull(),
  publishedVersionId: text('published_version_id'),
  ...timestamps,
});

export const workflowDrafts = sqliteTable('workflow_drafts', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  revision: integer('revision').notNull(),
  definitionJson: text('definition_json').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('workflow_drafts_workflow_id_unique').on(table.workflowId)]);

export const workflowVersions = sqliteTable('workflow_versions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  definitionJson: text('definition_json').notNull(),
  changeSummary: text('change_summary'),
  publishedAt: text('published_at').notNull(),
}, (table) => [
  uniqueIndex('workflow_versions_version_unique').on(table.workflowId, table.version),
  uniqueIndex('workflow_versions_checksum_unique').on(table.workflowId, table.checksum),
]);

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  versionId: text('version_id').notNull(),
  definitionChecksum: text('definition_checksum').notNull(),
  status: text('status').notNull(),
  triggerType: text('trigger_type').notNull(),
  inputJson: text('input_json').notNull(),
  outputJson: text('output_json'),
  temporalWorkflowId: text('temporal_workflow_id'),
  temporalRunId: text('temporal_run_id'),
  resumedFromRunId: text('resumed_from_run_id'),
  resumedFromInvocationId: text('resumed_from_invocation_id'),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  nextEventSequence: integer('next_event_sequence').notNull().default(0),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
  createdAt: text('created_at').notNull(),
});

export const runSteps = sqliteTable('run_steps', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  nodeId: text('node_id').notNull(),
  branchPathJson: text('branch_path_json').notNull(),
  iterationPathJson: text('iteration_path_json').notNull(),
  status: text('status').notNull(),
  attempt: integer('attempt').notNull().default(0),
  inputJson: text('input_json'),
  outputJson: text('output_json'),
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
}, (table) => [uniqueIndex('run_steps_invocation_unique').on(table.runId, table.id)]);

export const runEvents = sqliteTable('run_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  sequence: integer('sequence').notNull(),
  type: text('type').notNull(),
  invocationId: text('invocation_id'),
  idempotencyKey: text('idempotency_key').notNull(),
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('run_events_sequence_unique').on(table.runId, table.sequence),
  uniqueIndex('run_events_idempotency_unique').on(table.runId, table.idempotencyKey),
]);

export const runWaits = sqliteTable('run_waits', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  invocationId: text('invocation_id').notNull(),
  nodeId: text('node_id').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  responseSchemaJson: text('response_schema_json'),
  responseJson: text('response_json'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').notNull(),
  resolvedAt: text('resolved_at'),
}, (table) => [uniqueIndex('run_waits_invocation_unique').on(table.runId, table.invocationId)]);

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  invocationId: text('invocation_id'),
  nodeId: text('node_id'),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  uri: text('uri').notNull(),
  contentType: text('content_type'),
  size: integer('size'),
  metadataJson: text('metadata_json').notNull(),
  createdAt: text('created_at').notNull(),
});

export const workflowTriggers = sqliteTable('workflow_triggers', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').notNull(),
  type: text('type').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  configJson: text('config_json').notNull(),
  secretReference: text('secret_reference'),
  versionPolicy: text('version_policy').notNull().default('latest'),
  pinnedVersionId: text('pinned_version_id'),
  externalRegistrationId: text('external_registration_id'),
  ...timestamps,
});

export const adapterStatuses = sqliteTable('adapter_statuses', {
  adapterId: text('adapter_id').primaryKey(),
  available: integer('available', { mode: 'boolean' }).notNull(),
  setupHint: text('setup_hint'),
  updatedAt: text('updated_at').notNull(),
});

export const workerHeartbeats = sqliteTable('worker_heartbeats', {
  workerId: text('worker_id').primaryKey(),
  taskQueue: text('task_queue').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  metadataJson: text('metadata_json').notNull(),
});

export const runtimeSettings = sqliteTable('runtime_settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});
