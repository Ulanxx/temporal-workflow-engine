import { randomUUID } from 'node:crypto';
import {
  createRunEventIdempotencyKey,
  InvocationTransition,
  JsonObject,
  JsonValue,
  RunEventType,
  RunStatus,
  StepStatus,
  WorkflowNodeExecutionRequest,
  WorkflowNodeExecutionResult,
  NodeType,
} from '@temporal-workflow-engine/shared';
import { createPersistenceDatabase, WorkflowRepository } from '@temporal-workflow-engine/persistence';
import { executeApiCall, executeScript } from './utility-activities';
import { executeBrowserAction } from './browser-activities';

const database = createPersistenceDatabase();
const repository = new WorkflowRepository(database);

const eventByTransition: Record<InvocationTransition['event'], RunEventType> = {
  queued: RunEventType.STEP_QUEUED,
  started: RunEventType.STEP_STARTED,
  waiting: RunEventType.STEP_WAITING,
  completed: RunEventType.STEP_COMPLETED,
  failed: RunEventType.STEP_FAILED,
  skipped: RunEventType.STEP_SKIPPED,
};

function asRecord(value: JsonValue | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseObject(value: unknown, fallback: JsonObject = {}): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonObject;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return asRecord(parsed);
  } catch {
    throw new Error('节点 JSON 配置格式无效。');
  }
}

export async function markRunStarted({ runId }: { runId: string }): Promise<void> {
  repository.updateRun(runId, { status: RunStatus.RUNNING, startedAt: new Date().toISOString() });
  repository.appendRunEvent({
    runId,
    type: RunEventType.RUN_STARTED,
    idempotencyKey: `${runId}:run.started`,
    payload: {},
  });
}

export async function markRunCompleted({ runId, output }: { runId: string; output: JsonValue }): Promise<void> {
  repository.updateRun(runId, { status: RunStatus.COMPLETED, output, endedAt: new Date().toISOString() });
  repository.appendRunEvent({
    runId,
    type: RunEventType.RUN_COMPLETED,
    idempotencyKey: `${runId}:run.completed`,
    payload: { output },
  });
}

export async function markRunFailed({ runId, failureMessage }: { runId: string; failureMessage: string }): Promise<void> {
  repository.updateRun(runId, { status: RunStatus.FAILED, failureMessage, endedAt: new Date().toISOString() });
  repository.appendRunEvent({
    runId,
    type: RunEventType.RUN_FAILED,
    idempotencyKey: `${runId}:run.failed`,
    payload: { message: failureMessage },
  });
}

export async function transitionInvocation({ invocation, status, event, payload = {} }: InvocationTransition): Promise<void> {
  const timestamp = new Date().toISOString();
  const next = {
    ...invocation,
    status,
    input: invocation.input,
    output: invocation.output,
    startedAt: status === StepStatus.RUNNING ? invocation.startedAt ?? timestamp : invocation.startedAt,
    endedAt: [StepStatus.COMPLETED, StepStatus.FAILED, StepStatus.FAILED_HANDLED, StepStatus.SKIPPED, StepStatus.CANCELED].includes(status)
      ? invocation.endedAt ?? timestamp
      : invocation.endedAt,
  };
  repository.upsertStepInvocation(next);
  repository.appendRunEvent({
    runId: invocation.runId,
    type: eventByTransition[event],
    invocationId: invocation.id,
    idempotencyKey: createRunEventIdempotencyKey(invocation, eventByTransition[event]),
    payload: { nodeId: invocation.nodeId, ...payload },
  });
}

export async function createRunWait(params: {
  runId: string;
  invocationId: string;
  nodeId: string;
  type: 'approval' | 'information';
  expiresAt?: string;
}): Promise<void> {
  repository.createRunWait({ ...params, status: 'pending' });
  repository.updateRun(params.runId, { status: RunStatus.WAITING });
  repository.appendRunEvent({
    runId: params.runId,
    type: params.type === 'approval' ? RunEventType.APPROVAL_REQUESTED : RunEventType.STEP_WAITING,
    invocationId: params.invocationId,
    idempotencyKey: `${params.runId}:${params.invocationId}:wait.created`,
    payload: { nodeId: params.nodeId, type: params.type, expiresAt: params.expiresAt ?? null },
  });
}

export async function resolveRunWait(params: { runId: string; invocationId: string; response: JsonValue }): Promise<void> {
  repository.resolveRunWait(params.runId, params.invocationId, params.response);
  repository.appendRunEvent({
    runId: params.runId,
    type: RunEventType.APPROVAL_RESOLVED,
    invocationId: params.invocationId,
    idempotencyKey: `${params.runId}:${params.invocationId}:wait.resolved`,
    payload: { response: params.response },
  });
}

/** Executes side-effecting catalog nodes. Deterministic control nodes remain in the Temporal workflow. */
export async function executeWorkflowNode(request: WorkflowNodeExecutionRequest): Promise<WorkflowNodeExecutionResult> {
  const { config, input, type } = request;

  switch (type) {
    case NodeType.SCHEMA_VALIDATE:
      parseObject(config.schema, {});
      return { output: { valid: true, value: input } };
    case NodeType.MODEL:
      return {
        output: {
          model: String(config.model ?? 'local-model'),
          score: Number(config.mockScore ?? 0.9),
          summary: '本地开发 adapter 返回的结构化分析结果。',
          input,
        },
      };
    case NodeType.HTTP: {
      const result = await executeApiCall({
        url: String(config.url),
        method: String(config.method ?? 'GET'),
        headers: Object.fromEntries(Object.entries(parseObject(config.headers)).map(([key, value]) => [key, String(value)])),
        body: config.body,
      });
      if (!result.success) throw new Error(String(result.error ?? 'HTTP 请求失败。'));
      return { output: result.data ?? result };
    }
    case NodeType.SCRIPT: {
      const result = await executeScript({ code: String(config.code ?? ''), context: { input } });
      if (!result.success) throw new Error(String(result.error ?? '脚本执行失败。'));
      return { output: result.result as JsonValue };
    }
    case NodeType.BROWSER: {
      const result = await executeBrowserAction({
        actionType: String(config.action ?? config.actionType ?? 'navigate'),
        url: typeof config.url === 'string' ? config.url : undefined,
        selector: typeof config.selector === 'string' ? config.selector : undefined,
        text: typeof config.text === 'string' ? config.text : undefined,
      });
      if (!result.success) throw new Error(String(result.error ?? '浏览器操作失败。'));
      return { output: result as JsonValue };
    }
    case NodeType.TRANSFORM:
      return { output: parseObject(config.mapping) };
    case NodeType.NOTIFICATION:
      console.log(`[notification:${String(config.channel ?? 'console')}]`, config.message ?? input);
      return { output: { delivered: true, channel: config.channel ?? 'console', id: randomUUID() } };
    default:
      throw new Error(`节点 ${type} 尚未配置可执行 adapter。`);
  }
}

export function closeRuntimeDatabase(): void {
  database.close();
}
