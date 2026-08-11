/**
 * 工作流步骤类型。
 *
 * Browser 只是一个 adapter，不再定义整个项目的边界。
 */
export enum StepType {
  START = 'start',
  END = 'end',
  TASK = 'task',
  DECISION = 'decision',
  BROWSER_ACTION = 'browser_action',
  DELAY = 'delay',
  API_CALL = 'api_call',
  SCRIPT = 'script',
}

/**
 * 浏览器动作类型
 */
export enum BrowserActionType {
  NAVIGATE = 'navigate',
  CLICK = 'click',
  TYPE = 'type',
  SELECT = 'select',
  WAIT_FOR_SELECTOR = 'waitForSelector',
  WAIT_FOR_NAVIGATION = 'waitForNavigation',
  SCREENSHOT = 'screenshot',
  EXTRACT_DATA = 'extractData',
}

/**
 * 工作流步骤基本接口
 */
export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  description?: string;
  position: {
    x: number;
    y: number;
  };
  timeoutMs?: number;
  retry?: {
    maximumAttempts?: number;
    backoffMs?: number;
  };
}

/**
 * 工作流连接线
 */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

/**
 * 浏览器动作节点
 */
export interface BrowserActionStep extends WorkflowStep {
  type: StepType.BROWSER_ACTION;
  actionType: BrowserActionType;
  selector?: string;
  url?: string;
  text?: string;
  timeout?: number;
  options?: Record<string, any>;
}

/**
 * 完整工作流定义
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: WorkflowStep[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 工作流执行状态
 */
export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

/**
 * 工作流执行记录
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startTime: string;
  endTime?: string;
  result?: any;
  error?: string;
}

// Backward-compatible aliases while the designer is still node-based.
export { StepType as NodeType };
export type WorkflowNode = WorkflowStep;
export type BrowserActionNode = BrowserActionStep;
