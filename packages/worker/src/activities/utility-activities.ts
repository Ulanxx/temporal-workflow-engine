import { WorkflowExecutionStatus } from '@temporal-workflow-engine/shared';

/**
 * 执行脚本活动
 */
export async function executeScript(params: {
  code: string;
  context?: Record<string, any>;
}): Promise<any> {
  const { code, context = {} } = params;
  
  try {
    // 创建一个安全的执行环境
    const contextKeys = Object.keys(context);
    const contextValues = Object.values(context);
    
    // 使用 Function 构造器创建可执行函数
    // 注意：这在生产环境中可能存在安全风险，应当限制脚本能力
    const fn = new Function(...contextKeys, `
      try {
        return (async () => { ${code} })();
      } catch (error: any) {
        return { error: error.message };
      }
    `);
    
    // 执行脚本
    const result = await fn(...contextValues);
    return { success: true, result };
  } catch (error: any) {
    console.error(`执行脚本失败: ${error}`);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * 执行API调用活动
 */
export async function executeApiCall(params: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<any> {
  const { url, method, headers = {}, body } = params;
  
  try {
    if (url.startsWith('mock://')) {
      return {
        success: true,
        status: 200,
        data: { mocked: true, url, method, body },
      };
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    const data = await response.json();
    
    return {
      success: true,
      status: response.status,
      data
    };
  } catch (error: any) {
    console.error(`执行API调用失败: ${error}`);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

/**
 * 延迟执行活动
 */
export async function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * 记录工作流状态活动
 */
export async function logWorkflowStatus(params: {
  executionId: string;
  status: string;
  result?: any;
  error?: string;
}): Promise<void> {
  const { executionId, status, result, error } = params;
  
  // 这里实际项目中可能会将状态保存到数据库
  console.log(`工作流执行状态更新: ${executionId}`);
  console.log(`状态: ${status}`);
  
  if (result) {
    console.log(`结果: ${JSON.stringify(result)}`);
  }
  
  if (error) {
    console.error(`错误: ${error}`);
  }
  
  // 返回空结果
  return;
}
