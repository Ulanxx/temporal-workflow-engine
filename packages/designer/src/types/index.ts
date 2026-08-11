import { 
  NodeType, 
  BrowserActionType,
  WorkflowNode as SharedWorkflowNode,
  WorkflowEdge as SharedWorkflowEdge,
  Workflow as SharedWorkflow
} from '@temporal-workflow-engine/shared';

// 导出共享类型
export {
  NodeType,
  BrowserActionType
};

// 扩展节点，添加设计器特定属性
export interface WorkflowNode extends SharedWorkflowNode {
  data?: Record<string, any>;
  selected?: boolean;
  style?: Record<string, any>;
}

// 扩展边，添加设计器特定属性
export interface WorkflowEdge extends SharedWorkflowEdge {
  animated?: boolean;
  style?: Record<string, any>;
  markerEnd?: Record<string, any>;
}

// 扩展工作流，添加设计器特定属性
export interface Workflow extends SharedWorkflow {
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  }
}
