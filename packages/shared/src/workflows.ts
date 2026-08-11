import {
  JsonObject,
  JsonValue,
  NodeType,
  RunStatus,
  StepInvocation,
  StepStatus,
  Workflow,
  WorkflowDefinition,
  WorkflowExecution,
} from './types';

/**
 * 工作流启动参数
 */
export interface WorkflowRunParams {
  workflowId: string;
  input?: Record<string, any>;
}

/**
 * 工作流状态查询参数
 */
export interface WorkflowRunStatusParams {
  executionId: string;
}

/**
 * 工作流执行结果
 */
export interface WorkflowRunResult {
  executionId: string;
  status: string;
  output?: Record<string, any>;
  error?: string;
}

/** Immutable execution payload passed from the API to Temporal. */
export interface GraphRunParams {
  runId: string;
  workflowId: string;
  versionId: string;
  definition: WorkflowDefinition;
  input: JsonObject;
}

export interface GraphRunResult {
  runId: string;
  workflowId: string;
  versionId: string;
  status: RunStatus;
  output?: JsonValue;
  failureMessage?: string;
}

export interface WorkflowNodeExecutionRequest {
  nodeId: string;
  type: NodeType;
  name: string;
  config: JsonObject;
  input: JsonObject;
}

export interface WorkflowNodeExecutionResult {
  output: JsonValue;
}

export interface InvocationTransition {
  invocation: StepInvocation;
  status: StepStatus;
  event: 'queued' | 'started' | 'waiting' | 'completed' | 'failed' | 'skipped';
  payload?: JsonObject;
}

/**
 * 工作流相关活动接口
 */
export interface WorkflowActivities {
  /**
   * 执行浏览器动作
   */
  executeBrowserAction(params: {
    actionType: string;
    url?: string;
    selector?: string;
    text?: string;
    timeout?: number;
    options?: Record<string, any>;
  }): Promise<any>;
  
  /**
   * 执行脚本
   */
  executeScript(params: {
    code: string;
    context?: Record<string, any>;
  }): Promise<any>;
  
  /**
   * 执行API调用
   */
  executeApiCall(params: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  }): Promise<any>;
  
  /**
   * 延迟执行
   */
  delay(milliseconds: number): Promise<void>;
  
  /**
   * 记录工作流执行状态
   */
  logWorkflowStatus(params: {
    executionId: string;
    status: string;
    result?: any;
    error?: string;
  }): Promise<void>;

  executeWorkflowNode(params: WorkflowNodeExecutionRequest): Promise<WorkflowNodeExecutionResult>;

  markRunStarted(params: { runId: string }): Promise<void>;

  markRunCompleted(params: { runId: string; output: JsonValue }): Promise<void>;

  markRunFailed(params: { runId: string; failureMessage: string }): Promise<void>;

  transitionInvocation(params: InvocationTransition): Promise<void>;

  createRunWait(params: {
    runId: string;
    invocationId: string;
    nodeId: string;
    type: 'approval' | 'information';
    expiresAt?: string;
  }): Promise<void>;

  resolveRunWait(params: {
    runId: string;
    invocationId: string;
    response: JsonValue;
  }): Promise<void>;
}
