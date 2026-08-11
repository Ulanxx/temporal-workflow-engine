export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export enum NodeCategory {
  TRIGGER = 'trigger',
  AI = 'ai',
  CONTROL = 'control',
  DATA = 'data',
  ACTION = 'action',
  HUMAN = 'human',
}

/**
 * Canonical workflow node types. Legacy aliases remain here until the old
 * worker and API have been migrated to the graph runtime.
 */
export enum NodeType {
  MANUAL_TRIGGER = 'manual_trigger',
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  EVENT_SUBSCRIPTION = 'event_subscription',
  MODEL = 'model',
  AGENT = 'agent',
  MCP_TOOL = 'mcp_tool',
  KNOWLEDGE_RETRIEVAL = 'knowledge_retrieval',
  CONDITION = 'condition',
  SWITCH = 'switch',
  PARALLEL = 'parallel',
  MERGE = 'merge',
  LOOP = 'loop',
  WAIT = 'wait',
  CHILD_WORKFLOW = 'child_workflow',
  END = 'end',
  SET_VARIABLE = 'set_variable',
  TRANSFORM = 'transform',
  FILTER = 'filter',
  AGGREGATE = 'aggregate',
  SCHEMA_VALIDATE = 'schema_validate',
  HTTP = 'http',
  SCRIPT = 'script',
  BROWSER = 'browser',
  DATABASE = 'database',
  NOTIFICATION = 'notification',
  FILE = 'file',
  APPROVAL = 'approval',
  INFORMATION_REQUEST = 'information_request',

  // Legacy aliases used by the current worker and designer.
  START = 'manual_trigger',
  TASK = 'task',
  DECISION = 'condition',
  BROWSER_ACTION = 'browser',
  DELAY = 'wait',
  API_CALL = 'http',
}

export const StepType = NodeType;
export type StepType = NodeType;

export enum BrowserActionType {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  TYPE = 'type',
  SELECT = 'select',
  WAIT_FOR_SELECTOR = 'wait_for_selector',
  WAIT_FOR_NAVIGATION = 'wait_for_navigation',
  SCREENSHOT = 'screenshot',
  EXTRACT_DATA = 'extract_data',
}

export enum EdgeKind {
  CONTROL = 'control',
  CONDITION = 'condition',
  ERROR = 'error',
  DATA = 'data',
}

export enum PortDataType {
  ANY = 'any',
  JSON = 'json',
  BOOLEAN = 'boolean',
  COLLECTION = 'collection',
  ERROR = 'error',
  SIGNAL = 'signal',
}

export interface NodePort {
  id: string;
  label: string;
  direction: 'input' | 'output';
  dataType: PortDataType;
  required?: boolean;
}

export interface RetryPolicy {
  maximumAttempts: number;
  initialIntervalMs: number;
  maximumIntervalMs?: number;
  backoffCoefficient?: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  position: { x: number; y: number };
  config: JsonObject;
  retry?: RetryPolicy;
  timeoutMs?: number;
  disabled?: boolean;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  kind?: EdgeKind;
  label?: string;
  condition?: string;
  dataReference?: string;
}

export interface WorkflowDefinition {
  schemaVersion: 1;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface WorkflowAsset {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived';
  currentDraftId: string;
  publishedVersionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowDraft {
  id: string;
  workflowId: string;
  revision: number;
  definition: WorkflowDefinition;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  checksum: string;
  definition: WorkflowDefinition;
  changeSummary?: string;
  publishedAt: string;
}

export enum RunStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum StepStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  FAILED_HANDLED = 'failed_handled',
  SKIPPED = 'skipped',
  CANCELED = 'canceled',
}

export interface Run {
  id: string;
  workflowId: string;
  versionId: string;
  definitionChecksum: string;
  status: RunStatus;
  triggerType: NodeType;
  input: JsonObject;
  temporalWorkflowId?: string;
  temporalRunId?: string;
  resumedFromRunId?: string;
  resumedFromInvocationId?: string;
  output?: JsonValue;
  failureCode?: string;
  failureMessage?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface StepInvocation {
  id: string;
  runId: string;
  nodeId: string;
  branchPath: string[];
  iterationPath: number[];
  status: StepStatus;
  attempt: number;
  input?: JsonValue;
  output?: JsonValue;
  failureCode?: string;
  failureMessage?: string;
  startedAt?: string;
  endedAt?: string;
}

export enum RunEventType {
  RUN_CREATED = 'run.created',
  RUN_STARTED = 'run.started',
  RUN_COMPLETED = 'run.completed',
  RUN_FAILED = 'run.failed',
  RUN_CANCELED = 'run.canceled',
  STEP_QUEUED = 'step.queued',
  STEP_STARTED = 'step.started',
  STEP_RETRYING = 'step.retrying',
  STEP_WAITING = 'step.waiting',
  STEP_COMPLETED = 'step.completed',
  STEP_FAILED = 'step.failed',
  STEP_SKIPPED = 'step.skipped',
  APPROVAL_REQUESTED = 'approval.requested',
  APPROVAL_RESOLVED = 'approval.resolved',
  ARTIFACT_CREATED = 'artifact.created',
  LOG_APPENDED = 'log.appended',
}

export interface RunEvent {
  id: string;
  runId: string;
  sequence: number;
  type: RunEventType;
  invocationId?: string;
  idempotencyKey: string;
  payload: JsonObject;
  createdAt: string;
}

export interface RunWait {
  id: string;
  runId: string;
  invocationId: string;
  nodeId: string;
  type: 'approval' | 'information';
  status: 'pending' | 'resolved' | 'expired' | 'canceled';
  responseSchema?: JsonObject;
  response?: JsonValue;
  expiresAt?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface Artifact {
  id: string;
  runId: string;
  invocationId?: string;
  nodeId?: string;
  kind: 'file' | 'screenshot' | 'trace' | 'model_response' | 'log';
  name: string;
  uri: string;
  contentType?: string;
  size?: number;
  metadata: JsonObject;
  createdAt: string;
}

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  type: NodeType.WEBHOOK | NodeType.SCHEDULE | NodeType.MANUAL_TRIGGER;
  enabled: boolean;
  config: JsonObject;
  secretReference?: string;
  versionPolicy: 'latest' | 'pinned';
  pinnedVersionId?: string;
  externalRegistrationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdapterStatus {
  adapterId: string;
  available: boolean;
  setupHint?: string;
  updatedAt: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
  nodeId?: string;
  edgeId?: string;
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// Compatibility contracts for the existing API and Worker. They are removed
// only after those packages move to WorkflowAsset/Version/Run.
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export enum WorkflowExecutionStatus {
  PENDING = RunStatus.PENDING,
  RUNNING = RunStatus.RUNNING,
  COMPLETED = RunStatus.COMPLETED,
  FAILED = RunStatus.FAILED,
  CANCELED = RunStatus.CANCELED,
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startTime: string;
  endTime?: string;
  result?: JsonValue;
  error?: string;
}

export type WorkflowStep = WorkflowNode;
export type WorkflowNodeLegacy = WorkflowNode;
export type BrowserActionStep = WorkflowNode & {
  type: NodeType.BROWSER | NodeType.BROWSER_ACTION;
  actionType?: BrowserActionType;
  selector?: string;
  url?: string;
  text?: string;
  timeout?: number;
  options?: JsonObject;
};
export type BrowserActionNode = BrowserActionStep;
