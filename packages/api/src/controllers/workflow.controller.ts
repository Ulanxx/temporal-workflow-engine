import { 
  Controller, 
  Get, 
  Post, 
  Put,
  Delete, 
  Body, 
  Param, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { WorkflowService } from '../services/workflow.service';
import { 
  CreateWorkflowDto, 
  UpdateWorkflowDto, 
  ExecuteWorkflowDto,
  GetWorkflowStatusDto
} from '../dto/workflow.dto';

@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get()
  async findAll() {
    try {
      return await this.workflowService.findAll();
    } catch (error: any) {
      throw new HttpException(
        `获取工作流列表失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const workflow = await this.workflowService.findById(id);
      
      if (!workflow) {
        throw new HttpException(
          `工作流不存在: ${id}`, 
          HttpStatus.NOT_FOUND
        );
      }
      
      return workflow;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `获取工作流失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/draft')
  getDraft(@Param('id') id: string) {
    const draft = this.workflowService.getDraft(id);
    if (!draft) throw new HttpException('工作流草稿不存在', HttpStatus.NOT_FOUND);
    return draft;
  }

  @Put(':id/draft')
  saveDraft(@Param('id') id: string, @Body() body: { revision: number; definition: unknown }) {
    try {
      return this.workflowService.saveDraft(id, body.revision, body.definition as any);
    } catch (error: any) {
      throw new HttpException(error.message, error.actualRevision ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST);
    }
  }

  @Post(':id/validate')
  validateDraft(@Param('id') id: string) {
    return this.workflowService.validateDraft(id);
  }

  @Post(':id/publish')
  publishDraft(@Param('id') id: string, @Body() body: { changeSummary?: string }) {
    try {
      return this.workflowService.publishDraft(id, body.changeSummary);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.workflowService.listVersions(id);
  }

  @Get('/catalog/nodes')
  getNodeCatalog() {
    return this.workflowService.getNodeCatalog();
  }

  @Post()
  async create(@Body() createWorkflowDto: CreateWorkflowDto) {
    try {
      return await this.workflowService.create(createWorkflowDto);
    } catch (error: any) {
      throw new HttpException(
        `创建工作流失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto
  ) {
    try {
      const workflow = await this.workflowService.update(id, updateWorkflowDto);
      
      if (!workflow) {
        throw new HttpException(
          `工作流不存在: ${id}`, 
          HttpStatus.NOT_FOUND
        );
      }
      
      return workflow;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `更新工作流失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      const result = await this.workflowService.remove(id);
      
      if (!result) {
        throw new HttpException(
          `工作流不存在: ${id}`, 
          HttpStatus.NOT_FOUND
        );
      }
      
      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `删除工作流失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post(':id/execute')
  async execute(
    @Param('id') id: string,
    @Body() executeWorkflowDto: ExecuteWorkflowDto
  ) {
    try {
      const execution = await this.workflowService.executeWorkflow(
        id,
        executeWorkflowDto.input
      );
      
      return execution;
    } catch (error: any) {
      throw new HttpException(
        `执行工作流失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get(':id/executions')
  async getWorkflowExecutions(@Param('id') id: string) {
    try {
      return await this.workflowService.getWorkflowExecutions(id);
    } catch (error: any) {
      throw new HttpException(
        `获取工作流执行记录失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('executions/:executionId')
  async getExecution(@Param('executionId') executionId: string) {
    try {
      const execution = await this.workflowService.getExecution(executionId);
      
      if (!execution) {
        throw new HttpException(
          `执行记录不存在: ${executionId}`, 
          HttpStatus.NOT_FOUND
        );
      }
      
      return execution;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        `获取执行记录失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('executions/:executionId/status')
  async getWorkflowStatus(@Param('executionId') executionId: string) {
    try {
      return await this.workflowService.getWorkflowStatus(executionId);
    } catch (error: any) {
      throw new HttpException(
        `获取工作流状态失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('executions/:executionId/cancel')
  async cancelWorkflow(@Param('executionId') executionId: string) {
    try {
      const result = await this.workflowService.cancelWorkflow(executionId);
      
      return { success: result };
    } catch (error: any) {
      throw new HttpException(
        `取消工作流失败: ${error.message}`, 
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
