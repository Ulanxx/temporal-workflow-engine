import { 
  Workflow, 
  WorkflowNode, 
  WorkflowEdge,
  WorkflowExecution,
  WorkflowExecutionStatus 
} from '@temporal-workflow-engine/shared';

/**
 * 创建工作流DTO
 */
export class CreateWorkflowDto implements Partial<Workflow> {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/**
 * 更新工作流DTO
 */
export class UpdateWorkflowDto implements Partial<Workflow> {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  version?: string;
}

/**
 * 工作流执行DTO
 */
export class ExecuteWorkflowDto {
  workflowId: string;
  input?: Record<string, any>;
}

/**
 * 工作流执行响应DTO
 */
export class WorkflowExecutionResponseDto {
  executionId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  startTime: string;
  result?: any;
  error?: string;
}

/**
 * 获取工作流执行状态DTO
 */
export class GetWorkflowStatusDto {
  executionId: string;
}
