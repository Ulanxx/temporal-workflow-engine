import { WorkflowActivities } from '@temporal-workflow-engine/shared';
import { executeBrowserAction, closeBrowser } from './browser-activities';
import { 
  executeScript, 
  executeApiCall, 
  delay, 
  logWorkflowStatus 
} from './utility-activities';

// 导出活动
export const activities: WorkflowActivities = {
  executeBrowserAction,
  executeScript,
  executeApiCall,
  delay,
  logWorkflowStatus
};

// 导出活动清理函数
export const cleanup = async () => {
  await closeBrowser();
};
