import { Injectable } from '@nestjs/common';
import { Connection, Client } from '@temporalio/client';
import { 
  WorkflowExecutionStatus, 
  Workflow,
  WorkflowExecution 
} from '@temporal-workflow-engine/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TemporalService {
  private client?: Client;
  private readonly taskQueue = 'workflow-engine-task-queue';

  constructor() {
    this.init();
  }

  /**
   * 初始化Temporal客户端连接
   */
  private async init() {
    try {
      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      });

      this.client = new Client({
        connection,
        namespace: 'default',
      });

      console.log('已连接到Temporal服务');
    } catch (error: any) {
      console.warn('Temporal 服务暂不可用；流程编辑与本地持久化仍可正常使用。', error instanceof Error ? error.message : error);
    }
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflowId: string, 
    workflow: Workflow, 
    input?: Record<string, any>
  ): Promise<WorkflowExecution> {
    try {
      // 确保客户端已初始化
      const client = await this.requireClient();

      // 生成执行ID
      const executionId = uuidv4();
      
      // 启动工作流执行
      const handle = await client.workflow.start('executeWorkflowRun', {
        taskQueue: this.taskQueue,
        workflowId: `workflow-run-${executionId}`,
        args: [{
          workflowId,
          executionId,
          nodes: workflow.nodes,
          edges: workflow.edges,
          input
        }],
      });

      console.log(`工作流已启动: ${handle.workflowId}`);

      // 创建执行记录
      const execution: WorkflowExecution = {
        id: executionId,
        workflowId,
        status: WorkflowExecutionStatus.PENDING,
        startTime: new Date().toISOString(),
      };

      return execution;
    } catch (error: any) {
      console.error('启动工作流失败:', error);
      throw error;
    }
  }

  /**
   * 获取工作流执行状态
   */
  async getWorkflowStatus(executionId: string): Promise<any> {
    try {
      // 确保客户端已初始化
      const client = await this.requireClient();

      const handle = await client.workflow.getHandle(`workflow-run-${executionId}`);
      const description = await handle.describe();

      // 检查工作流状态
      let status = WorkflowExecutionStatus.RUNNING;
      let result = null;
      let error = null;

      if (description.status.name === 'COMPLETED') {
        status = WorkflowExecutionStatus.COMPLETED;
        result = await handle.result();
      } else if (description.status.name === 'FAILED') {
        status = WorkflowExecutionStatus.FAILED;
        try {
          await handle.result();
        } catch (e: any) {
          error = e.message;
        }
      } else if (description.status.name === 'CANCELLED') {
        status = WorkflowExecutionStatus.CANCELED;
      }

      return {
        executionId,
        status,
        result,
        error
      };
    } catch (error: any) {
      console.error('获取工作流状态失败:', error);
      throw error;
    }
  }

  /**
   * 取消工作流执行
   */
  async cancelWorkflow(executionId: string): Promise<boolean> {
    try {
      // 确保客户端已初始化
      const client = await this.requireClient();

      const handle = await client.workflow.getHandle(`workflow-run-${executionId}`);
      await handle.cancel();
      
      return true;
    } catch (error: any) {
      console.error('取消工作流失败:', error);
      throw error;
    }
  }

  private async requireClient(): Promise<Client> {
    if (!this.client) await this.init();
    if (!this.client) throw new Error('Temporal 服务不可用。请先启动 temporal:dev-server。');
    return this.client;
  }
}
