import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { 
  Workflow, 
  WorkflowExecution,
  WorkflowExecutionStatus
} from '@temporal-workflow-engine/shared';
import { TemporalService } from './temporal.service';

// 简单内存存储，实际项目应使用数据库
const workflows = new Map<string, Workflow>();
const executions = new Map<string, WorkflowExecution>();

@Injectable()
export class WorkflowService {
  constructor(private readonly temporalService: TemporalService) {}

  /**
   * 获取所有工作流
   */
  async findAll(): Promise<Workflow[]> {
    return Array.from(workflows.values());
  }

  /**
   * 根据ID获取工作流
   */
  async findById(id: string): Promise<Workflow | null> {
    return workflows.get(id) || null;
  }

  /**
   * 创建工作流
   */
  async create(workflow: Partial<Workflow>): Promise<Workflow> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const newWorkflow: Workflow = {
      id,
      name: workflow.name || `工作流 ${id.substring(0, 8)}`,
      description: workflow.description || '',
      version: '1.0.0',
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
      createdAt: now,
      updatedAt: now
    };
    
    workflows.set(id, newWorkflow);
    return newWorkflow;
  }

  /**
   * 更新工作流
   */
  async update(id: string, workflow: Partial<Workflow>): Promise<Workflow | null> {
    const existingWorkflow = workflows.get(id);
    
    if (!existingWorkflow) {
      return null;
    }
    
    // 创建更新后的工作流副本
    const updatedWorkflow: Workflow = {
      ...existingWorkflow,
      ...workflow,
      updatedAt: new Date().toISOString()
    };
    
    // 如果更新了节点或边，自动更新版本号
    if (workflow.nodes || workflow.edges) {
      const [major, minor, patch] = existingWorkflow.version.split('.').map(Number);
      updatedWorkflow.version = `${major}.${minor}.${patch + 1}`;
    }
    
    workflows.set(id, updatedWorkflow);
    return updatedWorkflow;
  }

  /**
   * 删除工作流
   */
  async remove(id: string): Promise<boolean> {
    return workflows.delete(id);
  }

  /**
   * 执行工作流
   */
  async executeWorkflow(
    workflowId: string, 
    input?: Record<string, any>
  ): Promise<WorkflowExecution> {
    const workflow = workflows.get(workflowId);
    
    if (!workflow) {
      throw new Error(`工作流不存在: ${workflowId}`);
    }
    
    const execution = await this.temporalService.executeWorkflow(
      workflowId,
      workflow,
      input
    );
    
    // 保存执行记录
    executions.set(execution.id, execution);
    
    return execution;
  }

  /**
   * 获取所有工作流执行记录
   */
  async getAllExecutions(): Promise<WorkflowExecution[]> {
    return Array.from(executions.values());
  }

  /**
   * 获取特定工作流的所有执行记录
   */
  async getWorkflowExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    return Array.from(executions.values())
      .filter(execution => execution.workflowId === workflowId);
  }

  /**
   * 获取执行记录
   */
  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return executions.get(executionId) || null;
  }

  /**
   * 获取工作流执行状态
   */
  async getWorkflowStatus(executionId: string): Promise<any> {
    const execution = await this.getExecution(executionId);
    
    if (!execution) {
      throw new Error(`执行记录不存在: ${executionId}`);
    }
    
    const status = await this.temporalService.getWorkflowStatus(executionId);
    
    // 更新执行记录状态
    const updatedExecution: WorkflowExecution = {
      ...execution,
      status: status.status,
      endTime: status.status !== WorkflowExecutionStatus.RUNNING ? new Date().toISOString() : undefined,
      result: status.result,
      error: status.error
    };
    
    executions.set(executionId, updatedExecution);
    
    return status;
  }

  /**
   * 取消工作流执行
   */
  async cancelWorkflow(executionId: string): Promise<boolean> {
    const execution = await this.getExecution(executionId);
    
    if (!execution) {
      throw new Error(`执行记录不存在: ${executionId}`);
    }
    
    const result = await this.temporalService.cancelWorkflow(executionId);
    
    if (result) {
      // 更新执行记录状态
      execution.status = WorkflowExecutionStatus.CANCELED;
      execution.endTime = new Date().toISOString();
      executions.set(executionId, execution);
    }
    
    return result;
  }
}
