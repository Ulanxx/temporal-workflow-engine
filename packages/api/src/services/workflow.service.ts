import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  JsonObject,
  nodeCatalog,
  NodeType,
  RunStatus,
  Workflow,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowNode,
} from '@temporal-workflow-engine/shared';
import {
  createPersistenceDatabase,
  PersistenceDatabase,
  WorkflowRepository,
} from '@temporal-workflow-engine/persistence';
import { TemporalService } from './temporal.service';

function toDefinition(nodes: WorkflowNode[] = [], edges: Workflow['edges'] = []): WorkflowDefinition {
  return {
    schemaVersion: 1,
    nodes: nodes.map((node) => ({
      ...node,
      type: node.type ?? NodeType.TASK,
      config: node.config ?? {},
      position: node.position ?? { x: 0, y: 0 },
    })),
    edges,
  };
}

@Injectable()
export class WorkflowService implements OnModuleDestroy {
  private readonly database: PersistenceDatabase = createPersistenceDatabase();
  private readonly repository = new WorkflowRepository(this.database);

  constructor(private readonly temporalService: TemporalService) {
    this.repository.seedDefaults();
  }

  onModuleDestroy(): void {
    this.database.close();
  }

  private toLegacyWorkflow(workflowId: string): Workflow | null {
    const asset = this.repository.getWorkflow(workflowId);
    const draft = this.repository.getDraft(workflowId);
    if (!asset || !draft) return null;
    const version = asset.publishedVersionId ? this.repository.getVersion(asset.publishedVersionId) : undefined;
    return {
      id: asset.id,
      name: asset.name,
      description: asset.description,
      version: String(version?.version ?? 0),
      nodes: draft.definition.nodes,
      edges: draft.definition.edges,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  async findAll(): Promise<Workflow[]> {
    return this.repository.listWorkflows().map((workflow) => this.toLegacyWorkflow(workflow.id)!).filter(Boolean);
  }

  async findById(id: string): Promise<Workflow | null> {
    return this.toLegacyWorkflow(id);
  }

  getDraft(workflowId: string) {
    return this.repository.getDraft(workflowId);
  }

  saveDraft(workflowId: string, revision: number, definition: WorkflowDefinition) {
    return this.repository.saveDraft(workflowId, revision, definition);
  }

  validateDraft(workflowId: string) {
    return this.repository.validateDraft(workflowId);
  }

  publishDraft(workflowId: string, changeSummary?: string) {
    return this.repository.publishDraft(workflowId, changeSummary);
  }

  listVersions(workflowId: string) {
    return this.repository.listVersions(workflowId);
  }

  getNodeCatalog() {
    return nodeCatalog.map(({ configSchema: _configSchema, ...definition }) => definition);
  }

  async create(workflow: Partial<Workflow>): Promise<Workflow> {
    const asset = this.repository.createWorkflow(
      workflow.name || '未命名工作流',
      workflow.description || '',
      toDefinition(workflow.nodes, workflow.edges),
    );
    return this.toLegacyWorkflow(asset.id)!;
  }

  async update(id: string, workflow: Partial<Workflow>): Promise<Workflow | null> {
    const current = this.repository.getDraft(id);
    const asset = this.repository.getWorkflow(id);
    if (!current || !asset) return null;
    const definition = workflow.nodes || workflow.edges
      ? toDefinition(workflow.nodes ?? current.definition.nodes, workflow.edges ?? current.definition.edges)
      : current.definition;
    this.repository.saveDraft(id, current.revision, definition);
    if (workflow.name || workflow.description !== undefined) {
      this.database.client.prepare('UPDATE workflows SET name = ?, description = ?, updated_at = ? WHERE id = ?')
        .run(workflow.name ?? asset.name, workflow.description ?? asset.description, new Date().toISOString(), id);
    }
    return this.toLegacyWorkflow(id);
  }

  async remove(id: string): Promise<boolean> {
    const result = this.database.client.prepare("UPDATE workflows SET status = 'archived', updated_at = ? WHERE id = ? AND status = 'active'")
      .run(new Date().toISOString(), id);
    return result.changes > 0;
  }

  async executeWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowExecution> {
    const workflow = this.toLegacyWorkflow(workflowId);
    if (!workflow) throw new Error('工作流不存在。');
    const execution = await this.temporalService.executeWorkflow(workflowId, workflow, input);
    const asset = this.repository.getWorkflow(workflowId)!;
    let version = asset.publishedVersionId ? this.repository.getVersion(asset.publishedVersionId) : undefined;
    if (!version) version = this.repository.publishDraft(workflowId);
    this.repository.createRun({
      id: execution.id,
      workflowId,
      versionId: version.id,
      definitionChecksum: version.checksum,
      status: RunStatus.PENDING,
      triggerType: NodeType.MANUAL_TRIGGER,
      input: (input ?? {}) as JsonObject,
      temporalWorkflowId: `workflow-run-${execution.id}`,
    });
    return execution;
  }

  async getWorkflowExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    const rows = this.database.client.prepare('SELECT * FROM runs WHERE workflow_id = ? ORDER BY created_at DESC').all(workflowId) as Array<{ id: string; status: WorkflowExecutionStatus; created_at: string; ended_at: string | null; output_json: string | null; failure_message: string | null }>;
    return rows.map((row) => ({ id: row.id, workflowId, status: row.status, startTime: row.created_at, endTime: row.ended_at ?? undefined, result: row.output_json ? JSON.parse(row.output_json) : undefined, error: row.failure_message ?? undefined }));
  }

  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    const run = this.repository.getRun(executionId);
    if (!run) return null;
    return { id: run.id, workflowId: run.workflowId, status: run.status as unknown as WorkflowExecutionStatus, startTime: run.createdAt, endTime: run.endedAt, result: run.output, error: run.failureMessage };
  }

  async getWorkflowStatus(executionId: string): Promise<WorkflowExecution> {
    const execution = await this.getExecution(executionId);
    if (!execution) throw new Error('执行记录不存在。');
    const status = await this.temporalService.getWorkflowStatus(executionId);
    return { ...execution, status: status.status, endTime: status.status === WorkflowExecutionStatus.RUNNING ? undefined : new Date().toISOString(), result: status.result ?? undefined, error: status.error ?? undefined };
  }

  async cancelWorkflow(executionId: string): Promise<boolean> {
    await this.temporalService.cancelWorkflow(executionId);
    this.database.client.prepare("UPDATE runs SET status = ?, ended_at = ? WHERE id = ?").run(RunStatus.CANCELED, new Date().toISOString(), executionId);
    return true;
  }
}
