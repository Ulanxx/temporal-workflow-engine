import { randomUUID } from 'node:crypto';
import {
  AdapterStatus,
  checksumDefinition,
  contentReviewWorkflowDefinition,
  JsonObject,
  JsonValue,
  NodeType,
  Run,
  RunEvent,
  RunEventType,
  RunStatus,
  StepInvocation,
  StepStatus,
  RunWait,
  ValidationResult,
  WorkflowAsset,
  WorkflowDefinition,
  WorkflowDraft,
  WorkflowVersion,
  validateWorkflowDefinition,
} from '@temporal-workflow-engine/shared';
import { PersistenceDatabase } from './database';

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  status: WorkflowAsset['status'];
  current_draft_id: string;
  published_version_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DraftRow {
  id: string;
  workflow_id: string;
  revision: number;
  definition_json: string;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  workflow_id: string;
  version: number;
  checksum: string;
  definition_json: string;
  change_summary: string | null;
  published_at: string;
}

interface RunRow {
  id: string;
  workflow_id: string;
  version_id: string;
  definition_checksum: string;
  status: RunStatus;
  trigger_type: NodeType;
  input_json: string;
  output_json: string | null;
  temporal_workflow_id: string | null;
  temporal_run_id: string | null;
  resumed_from_run_id: string | null;
  resumed_from_invocation_id: string | null;
  failure_code: string | null;
  failure_message: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface EventRow {
  id: string;
  run_id: string;
  sequence: number;
  type: RunEventType;
  invocation_id: string | null;
  idempotency_key: string;
  payload_json: string;
  created_at: string;
}

interface StepRow {
  id: string;
  run_id: string;
  node_id: string;
  branch_path_json: string;
  iteration_path_json: string;
  status: StepStatus;
  attempt: number;
  input_json: string | null;
  output_json: string | null;
  failure_code: string | null;
  failure_message: string | null;
  started_at: string | null;
  ended_at: string | null;
}

interface WaitRow {
  id: string;
  run_id: string;
  invocation_id: string;
  node_id: string;
  type: RunWait['type'];
  status: RunWait['status'];
  response_schema_json: string | null;
  response_json: string | null;
  expires_at: string | null;
  created_at: string;
  resolved_at: string | null;
}

export class DraftConflictError extends Error {
  constructor(public readonly actualRevision: number) {
    super('草稿已被其他编辑器更新。');
  }
}

export class ValidationFailedError extends Error {
  constructor(public readonly result: ValidationResult) {
    super('工作流校验未通过。');
  }
}

function now(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function toAsset(row: WorkflowRow): WorkflowAsset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    currentDraftId: row.current_draft_id,
    publishedVersionId: row.published_version_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDraft(row: DraftRow): WorkflowDraft {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    revision: row.revision,
    definition: parseJson<WorkflowDefinition>(row.definition_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toVersion(row: VersionRow): WorkflowVersion {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    version: row.version,
    checksum: row.checksum,
    definition: parseJson<WorkflowDefinition>(row.definition_json),
    changeSummary: row.change_summary ?? undefined,
    publishedAt: row.published_at,
  };
}

function toRun(row: RunRow): Run {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    versionId: row.version_id,
    definitionChecksum: row.definition_checksum,
    status: row.status,
    triggerType: row.trigger_type,
    input: parseJson<JsonObject>(row.input_json),
    output: row.output_json ? parseJson(row.output_json) : undefined,
    temporalWorkflowId: row.temporal_workflow_id ?? undefined,
    temporalRunId: row.temporal_run_id ?? undefined,
    resumedFromRunId: row.resumed_from_run_id ?? undefined,
    resumedFromInvocationId: row.resumed_from_invocation_id ?? undefined,
    failureCode: row.failure_code ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    createdAt: row.created_at,
  };
}

function toEvent(row: EventRow): RunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    sequence: row.sequence,
    type: row.type,
    invocationId: row.invocation_id ?? undefined,
    idempotencyKey: row.idempotency_key,
    payload: parseJson<JsonObject>(row.payload_json),
    createdAt: row.created_at,
  };
}

function toStep(row: StepRow): StepInvocation {
  return {
    id: row.id,
    runId: row.run_id,
    nodeId: row.node_id,
    branchPath: parseJson<string[]>(row.branch_path_json),
    iterationPath: parseJson<number[]>(row.iteration_path_json),
    status: row.status,
    attempt: row.attempt,
    input: row.input_json ? parseJson(row.input_json) : undefined,
    output: row.output_json ? parseJson(row.output_json) : undefined,
    failureCode: row.failure_code ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
  };
}

function toWait(row: WaitRow): RunWait {
  return {
    id: row.id,
    runId: row.run_id,
    invocationId: row.invocation_id,
    nodeId: row.node_id,
    type: row.type,
    status: row.status,
    responseSchema: row.response_schema_json ? parseJson<JsonObject>(row.response_schema_json) : undefined,
    response: row.response_json ? parseJson(row.response_json) : undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

export class WorkflowRepository {
  constructor(private readonly database: PersistenceDatabase) {}

  listWorkflows(): WorkflowAsset[] {
    const rows = this.database.client.prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all() as WorkflowRow[];
    return rows.map(toAsset);
  }

  getWorkflow(workflowId: string): WorkflowAsset | undefined {
    const row = this.database.client.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId) as WorkflowRow | undefined;
    return row ? toAsset(row) : undefined;
  }

  getDraft(workflowId: string): WorkflowDraft | undefined {
    const row = this.database.client.prepare('SELECT d.* FROM workflow_drafts d WHERE d.workflow_id = ?').get(workflowId) as DraftRow | undefined;
    return row ? toDraft(row) : undefined;
  }

  createWorkflow(name: string, description: string, definition: WorkflowDefinition, workflowId: string = randomUUID()): WorkflowAsset {
    const draftId = randomUUID();
    const timestamp = now();
    this.database.client.transaction(() => {
      this.database.client.prepare(`
        INSERT INTO workflows (id, name, description, status, current_draft_id, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?, ?)
      `).run(workflowId, name, description, draftId, timestamp, timestamp);
      this.database.client.prepare(`
        INSERT INTO workflow_drafts (id, workflow_id, revision, definition_json, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?, ?)
      `).run(draftId, workflowId, JSON.stringify(definition), timestamp, timestamp);
    })();
    return this.getWorkflow(workflowId)!;
  }

  saveDraft(workflowId: string, baseRevision: number, definition: WorkflowDefinition): WorkflowDraft {
    const execute = this.database.client.transaction(() => {
      const existing = this.getDraft(workflowId);
      if (!existing) throw new Error('工作流草稿不存在。');
      if (existing.revision !== baseRevision) throw new DraftConflictError(existing.revision);
      const timestamp = now();
      const nextRevision = existing.revision + 1;
      this.database.client.prepare(`
        UPDATE workflow_drafts SET revision = ?, definition_json = ?, updated_at = ? WHERE workflow_id = ?
      `).run(nextRevision, JSON.stringify(definition), timestamp, workflowId);
      this.database.client.prepare('UPDATE workflows SET updated_at = ? WHERE id = ?').run(timestamp, workflowId);
      return this.getDraft(workflowId)!;
    });
    return execute();
  }

  listAdapterStatuses(): AdapterStatus[] {
    return (this.database.client.prepare('SELECT * FROM adapter_statuses ORDER BY adapter_id').all() as Array<{ adapter_id: string; available: number; setup_hint: string | null; updated_at: string }>).map((row) => ({
      adapterId: row.adapter_id,
      available: row.available === 1,
      setupHint: row.setup_hint ?? undefined,
      updatedAt: row.updated_at,
    }));
  }

  setAdapterStatus(status: AdapterStatus): void {
    this.database.client.prepare(`
      INSERT INTO adapter_statuses (adapter_id, available, setup_hint, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(adapter_id) DO UPDATE SET available = excluded.available, setup_hint = excluded.setup_hint, updated_at = excluded.updated_at
    `).run(status.adapterId, status.available ? 1 : 0, status.setupHint ?? null, status.updatedAt);
  }

  validateDraft(workflowId: string): ValidationResult {
    const draft = this.getDraft(workflowId);
    if (!draft) throw new Error('工作流草稿不存在。');
    return validateWorkflowDefinition(draft.definition, this.listAdapterStatuses());
  }

  publishDraft(workflowId: string, changeSummary?: string): WorkflowVersion {
    const execute = this.database.client.transaction(() => {
      const draft = this.getDraft(workflowId);
      if (!draft) throw new Error('工作流草稿不存在。');
      const result = validateWorkflowDefinition(draft.definition, this.listAdapterStatuses());
      if (!result.valid) throw new ValidationFailedError(result);

      const checksum = checksumDefinition(draft.definition);
      const existing = this.database.client.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? AND checksum = ?').get(workflowId, checksum) as VersionRow | undefined;
      if (existing) return toVersion(existing);

      const latest = this.database.client.prepare('SELECT MAX(version) AS version FROM workflow_versions WHERE workflow_id = ?').get(workflowId) as { version: number | null };
      const version = (latest.version ?? 0) + 1;
      const versionId = randomUUID();
      const timestamp = now();
      this.database.client.prepare(`
        INSERT INTO workflow_versions (id, workflow_id, version, checksum, definition_json, change_summary, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(versionId, workflowId, version, checksum, JSON.stringify(draft.definition), changeSummary ?? null, timestamp);
      this.database.client.prepare('UPDATE workflows SET published_version_id = ?, updated_at = ? WHERE id = ?').run(versionId, timestamp, workflowId);
      return this.getVersion(versionId)!;
    });
    return execute();
  }

  getVersion(versionId: string): WorkflowVersion | undefined {
    const row = this.database.client.prepare('SELECT * FROM workflow_versions WHERE id = ?').get(versionId) as VersionRow | undefined;
    return row ? toVersion(row) : undefined;
  }

  listVersions(workflowId: string): WorkflowVersion[] {
    const rows = this.database.client.prepare('SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC').all(workflowId) as VersionRow[];
    return rows.map(toVersion);
  }

  createRun(input: Omit<Run, 'createdAt'> & { createdAt?: string }): Run {
    const timestamp = input.createdAt ?? now();
    this.database.client.prepare(`
      INSERT INTO runs (id, workflow_id, version_id, definition_checksum, status, trigger_type, input_json, output_json,
        temporal_workflow_id, temporal_run_id, resumed_from_run_id, resumed_from_invocation_id, failure_code, failure_message,
        started_at, ended_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.workflowId, input.versionId, input.definitionChecksum, input.status, input.triggerType,
      JSON.stringify(input.input), input.output === undefined ? null : JSON.stringify(input.output),
      input.temporalWorkflowId ?? null, input.temporalRunId ?? null, input.resumedFromRunId ?? null,
      input.resumedFromInvocationId ?? null, input.failureCode ?? null, input.failureMessage ?? null,
      input.startedAt ?? null, input.endedAt ?? null, timestamp,
    );
    return this.getRun(input.id)!;
  }

  getRun(runId: string): Run | undefined {
    const row = this.database.client.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as RunRow | undefined;
    return row ? toRun(row) : undefined;
  }

  updateRun(runId: string, patch: Partial<Pick<Run, 'status' | 'output' | 'failureCode' | 'failureMessage' | 'startedAt' | 'endedAt'>>): Run {
    const current = this.getRun(runId);
    if (!current) throw new Error('运行记录不存在。');
    const next = { ...current, ...patch };
    this.database.client.prepare(`
      UPDATE runs SET status = ?, output_json = ?, failure_code = ?, failure_message = ?, started_at = ?, ended_at = ? WHERE id = ?
    `).run(
      next.status,
      next.output === undefined ? null : JSON.stringify(next.output),
      next.failureCode ?? null,
      next.failureMessage ?? null,
      next.startedAt ?? null,
      next.endedAt ?? null,
      runId,
    );
    return this.getRun(runId)!;
  }

  upsertStepInvocation(invocation: StepInvocation): StepInvocation {
    this.database.client.prepare(`
      INSERT INTO run_steps (id, run_id, node_id, branch_path_json, iteration_path_json, status, attempt, input_json, output_json,
        failure_code, failure_message, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, id) DO UPDATE SET
        status = excluded.status,
        attempt = excluded.attempt,
        input_json = excluded.input_json,
        output_json = excluded.output_json,
        failure_code = excluded.failure_code,
        failure_message = excluded.failure_message,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at
    `).run(
      invocation.id, invocation.runId, invocation.nodeId, JSON.stringify(invocation.branchPath), JSON.stringify(invocation.iterationPath),
      invocation.status, invocation.attempt, invocation.input === undefined ? null : JSON.stringify(invocation.input),
      invocation.output === undefined ? null : JSON.stringify(invocation.output), invocation.failureCode ?? null,
      invocation.failureMessage ?? null, invocation.startedAt ?? null, invocation.endedAt ?? null,
    );
    const row = this.database.client.prepare('SELECT * FROM run_steps WHERE run_id = ? AND id = ?').get(invocation.runId, invocation.id) as StepRow;
    return toStep(row);
  }

  listStepInvocations(runId: string): StepInvocation[] {
    const rows = this.database.client.prepare('SELECT * FROM run_steps WHERE run_id = ? ORDER BY started_at, id').all(runId) as StepRow[];
    return rows.map(toStep);
  }

  createRunWait(input: Omit<RunWait, 'id' | 'createdAt'> & Partial<Pick<RunWait, 'id' | 'createdAt'>>): RunWait {
    const id = input.id ?? randomUUID();
    const createdAt = input.createdAt ?? now();
    this.database.client.prepare(`
      INSERT INTO run_waits (id, run_id, invocation_id, node_id, type, status, response_schema_json, response_json, expires_at, created_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, invocation_id) DO NOTHING
    `).run(id, input.runId, input.invocationId, input.nodeId, input.type, input.status,
      input.responseSchema === undefined ? null : JSON.stringify(input.responseSchema),
      input.response === undefined ? null : JSON.stringify(input.response), input.expiresAt ?? null, createdAt, input.resolvedAt ?? null);
    return this.getRunWait(input.runId, input.invocationId)!;
  }

  getRunWait(runId: string, invocationId: string): RunWait | undefined {
    const row = this.database.client.prepare('SELECT * FROM run_waits WHERE run_id = ? AND invocation_id = ?').get(runId, invocationId) as WaitRow | undefined;
    return row ? toWait(row) : undefined;
  }

  listRunWaits(runId: string): RunWait[] {
    const rows = this.database.client.prepare('SELECT * FROM run_waits WHERE run_id = ? ORDER BY created_at').all(runId) as WaitRow[];
    return rows.map(toWait);
  }

  resolveRunWait(runId: string, invocationId: string, response: JsonValue): RunWait {
    const result = this.database.client.prepare(`
      UPDATE run_waits SET status = 'resolved', response_json = ?, resolved_at = ?
      WHERE run_id = ? AND invocation_id = ? AND status = 'pending'
    `).run(JSON.stringify(response), now(), runId, invocationId);
    if (result.changes === 0) throw new Error('等待项不存在或已经处理。');
    return this.getRunWait(runId, invocationId)!;
  }

  listRunEvents(runId: string, afterSequence = 0): RunEvent[] {
    const rows = this.database.client.prepare('SELECT * FROM run_events WHERE run_id = ? AND sequence > ? ORDER BY sequence').all(runId, afterSequence) as EventRow[];
    return rows.map(toEvent);
  }

  appendRunEvent(event: Omit<RunEvent, 'id' | 'sequence' | 'createdAt'> & Partial<Pick<RunEvent, 'id' | 'createdAt'>>): RunEvent {
    this.database.client.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.database.client.prepare('SELECT * FROM run_events WHERE run_id = ? AND idempotency_key = ?').get(event.runId, event.idempotencyKey) as EventRow | undefined;
      if (existing) {
        this.database.client.exec('COMMIT');
        return toEvent(existing);
      }
      const run = this.database.client.prepare('SELECT next_event_sequence FROM runs WHERE id = ?').get(event.runId) as { next_event_sequence: number } | undefined;
      if (!run) throw new Error('运行记录不存在。');
      const sequence = run.next_event_sequence + 1;
      const timestamp = event.createdAt ?? now();
      const id = event.id ?? randomUUID();
      this.database.client.prepare('UPDATE runs SET next_event_sequence = ? WHERE id = ?').run(sequence, event.runId);
      this.database.client.prepare(`
        INSERT INTO run_events (id, run_id, sequence, type, invocation_id, idempotency_key, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, event.runId, sequence, event.type, event.invocationId ?? null, event.idempotencyKey, JSON.stringify(event.payload), timestamp);
      this.database.client.exec('COMMIT');
      return { id, runId: event.runId, sequence, type: event.type, invocationId: event.invocationId, idempotencyKey: event.idempotencyKey, payload: event.payload, createdAt: timestamp };
    } catch (error) {
      this.database.client.exec('ROLLBACK');
      throw error;
    }
  }

  seedContentReviewWorkflow(): WorkflowAsset {
    const existing = this.database.client.prepare('SELECT * FROM workflows WHERE id = ?').get('content-review') as WorkflowRow | undefined;
    if (existing) return toAsset(existing);

    const asset = this.createWorkflow('AI 内容审核', '内置示例：Webhook、模型分析、分支、人工审批、发布与通知。', contentReviewWorkflowDefinition, 'content-review');
    const draft = this.getDraft(asset.id)!;
    const checksum = checksumDefinition(draft.definition);
    const versionId = 'content-review-v1';
    const timestamp = now();
    this.database.client.prepare(`
      INSERT INTO workflow_versions (id, workflow_id, version, checksum, definition_json, change_summary, published_at)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `).run(versionId, asset.id, checksum, JSON.stringify(draft.definition), '内置内容审核模板', timestamp);
    this.database.client.prepare('UPDATE workflows SET published_version_id = ? WHERE id = ?').run(versionId, asset.id);
    return this.getWorkflow(asset.id)!;
  }

  seedDefaults(): void {
    this.setAdapterStatus({ adapterId: 'model', available: true, updatedAt: now() });
    this.setAdapterStatus({ adapterId: 'mcp', available: true, updatedAt: now() });
    this.setAdapterStatus({ adapterId: 'http', available: true, updatedAt: now() });
    this.setAdapterStatus({ adapterId: 'script', available: true, setupHint: '本地开发环境允许脚本 adapter。', updatedAt: now() });
    this.setAdapterStatus({ adapterId: 'browser', available: true, updatedAt: now() });
    this.setAdapterStatus({ adapterId: 'notification', available: true, updatedAt: now() });
    this.setAdapterStatus({ adapterId: 'transform', available: true, updatedAt: now() });
    this.setAdapterStatus({ adapterId: 'schema', available: true, updatedAt: now() });
    this.seedContentReviewWorkflow();
  }
}
