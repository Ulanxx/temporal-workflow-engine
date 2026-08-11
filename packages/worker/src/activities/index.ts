import { WorkflowActivities } from '@temporal-workflow-engine/shared';
import { executeBrowserAction, closeBrowser } from './browser-activities';
import { 
  executeScript, 
  executeApiCall, 
  delay, 
  logWorkflowStatus 
} from './utility-activities';
import {
  createRunWait,
  closeRuntimeDatabase,
  executeWorkflowNode,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  resolveRunWait,
  transitionInvocation,
} from './runtime-activities';

// 导出活动
export const activities: WorkflowActivities = {
  executeBrowserAction,
  executeScript,
  executeApiCall,
  delay,
  logWorkflowStatus,
  executeWorkflowNode,
  markRunStarted,
  markRunCompleted,
  markRunFailed,
  transitionInvocation,
  createRunWait,
  resolveRunWait,
};

// 导出活动清理函数
export const cleanup = async () => {
  await closeBrowser();
  closeRuntimeDatabase();
};
