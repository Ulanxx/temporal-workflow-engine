import { z } from 'zod';
import {
  AdapterStatus,
  BrowserActionType,
  NodeCategory,
  NodePort,
  NodeType,
  PortDataType,
  RetryPolicy,
} from './types';

export type NodeExecutionMode = 'deterministic' | 'activity' | 'signal' | 'extension';

export interface NodeDefinition {
  type: NodeType;
  category: NodeCategory;
  title: string;
  description: string;
  icon: string;
  execution: NodeExecutionMode;
  adapterId?: string;
  configSchema: z.ZodType<unknown>;
  defaultConfig: Record<string, unknown>;
  ports: NodePort[];
}

const anyInput: NodePort = { id: 'in', label: '输入', direction: 'input', dataType: PortDataType.ANY };
const anyOutput: NodePort = { id: 'out', label: '输出', direction: 'output', dataType: PortDataType.ANY };
const structuredOutput: NodePort = { id: 'out', label: '结构化输出', direction: 'output', dataType: PortDataType.JSON };
const basicSchema = z.object({}).passthrough();
const expressionSchema = z.string().min(1).max(10_000);

function definition(input: Omit<NodeDefinition, 'configSchema'> & { configSchema?: z.ZodType<unknown> }): NodeDefinition {
  return { ...input, configSchema: input.configSchema ?? basicSchema };
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maximumAttempts: 3,
  initialIntervalMs: 1_000,
  maximumIntervalMs: 30_000,
  backoffCoefficient: 2,
};

export const nodeCatalog: readonly NodeDefinition[] = [
  definition({ type: NodeType.MANUAL_TRIGGER, category: NodeCategory.TRIGGER, title: '手动触发', description: '从 Workbench 手动启动流程。', icon: 'MousePointer2', execution: 'deterministic', defaultConfig: {}, ports: [anyOutput] }),
  definition({ type: NodeType.WEBHOOK, category: NodeCategory.TRIGGER, title: 'Webhook', description: '接收外部 HTTP 请求并创建运行。', icon: 'Webhook', execution: 'deterministic', defaultConfig: { method: 'POST' }, configSchema: z.object({ method: z.enum(['POST', 'PUT', 'PATCH']).default('POST') }), ports: [structuredOutput] }),
  definition({ type: NodeType.SCHEDULE, category: NodeCategory.TRIGGER, title: '定时任务', description: '按 Temporal Schedule 触发流程。', icon: 'CalendarClock', execution: 'deterministic', defaultConfig: { cron: '0 * * * *' }, configSchema: z.object({ cron: z.string().min(1) }), ports: [structuredOutput] }),
  definition({ type: NodeType.EVENT_SUBSCRIPTION, category: NodeCategory.TRIGGER, title: '事件订阅', description: '订阅外部事件源。', icon: 'Radio', execution: 'extension', adapterId: 'event-subscription', defaultConfig: { topic: '' }, configSchema: z.object({ topic: z.string().min(1) }), ports: [structuredOutput] }),

  definition({ type: NodeType.MODEL, category: NodeCategory.AI, title: '模型调用', description: '调用 OpenAI 兼容模型并返回结构化输出。', icon: 'Sparkles', execution: 'activity', adapterId: 'model', defaultConfig: { model: 'gpt-5-mini', input: '{{ trigger.body }}', responseFormat: 'json' }, configSchema: z.object({ model: z.string().min(1), input: expressionSchema, responseFormat: z.enum(['text', 'json']).default('json') }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.AGENT, category: NodeCategory.AI, title: 'Agent', description: '带工具调用循环的智能代理。', icon: 'Bot', execution: 'extension', adapterId: 'agent', defaultConfig: { instructions: '' }, configSchema: z.object({ instructions: z.string().min(1) }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.MCP_TOOL, category: NodeCategory.AI, title: 'MCP 工具', description: '通过 MCP 调用远程工具。', icon: 'Wrench', execution: 'activity', adapterId: 'mcp', defaultConfig: { server: '', tool: '', arguments: '{}' }, configSchema: z.object({ server: z.string().min(1), tool: z.string().min(1), arguments: z.string().default('{}') }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.KNOWLEDGE_RETRIEVAL, category: NodeCategory.AI, title: '知识检索', description: '从已配置知识库检索上下文。', icon: 'BookOpen', execution: 'extension', adapterId: 'knowledge', defaultConfig: { query: '' }, configSchema: z.object({ query: expressionSchema }), ports: [anyInput, structuredOutput] }),

  definition({ type: NodeType.CONDITION, category: NodeCategory.CONTROL, title: '条件分支', description: '根据表达式选择 true 或 false 路径。', icon: 'GitBranch', execution: 'deterministic', defaultConfig: { expression: 'true' }, configSchema: z.object({ expression: expressionSchema }), ports: [anyInput, { id: 'true', label: '成立', direction: 'output', dataType: PortDataType.BOOLEAN }, { id: 'false', label: '不成立', direction: 'output', dataType: PortDataType.BOOLEAN }] }),
  definition({ type: NodeType.SWITCH, category: NodeCategory.CONTROL, title: '多路分支', description: '根据命名规则选择一条路径。', icon: 'Split', execution: 'deterministic', defaultConfig: { expression: '', cases: [] }, configSchema: z.object({ expression: expressionSchema, cases: z.array(z.object({ label: z.string().min(1), expression: expressionSchema })).default([]) }), ports: [anyInput, anyOutput] }),
  definition({ type: NodeType.PARALLEL, category: NodeCategory.CONTROL, title: '并行', description: '同时开启命名分支。', icon: 'GitFork', execution: 'deterministic', defaultConfig: { branches: ['branch-a', 'branch-b'] }, configSchema: z.object({ branches: z.array(z.string().min(1)).min(2) }), ports: [anyInput, anyOutput] }),
  definition({ type: NodeType.MERGE, category: NodeCategory.CONTROL, title: '汇合', description: '等待全部或首个成功分支。', icon: 'GitMerge', execution: 'deterministic', defaultConfig: { mode: 'all' }, configSchema: z.object({ mode: z.enum(['all', 'any']).default('all') }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.LOOP, category: NodeCategory.CONTROL, title: '批量循环', description: '按集合顺序执行循环体。', icon: 'Repeat2', execution: 'deterministic', defaultConfig: { collection: '{{ input.items }}', maximumIterations: 100 }, configSchema: z.object({ collection: expressionSchema, maximumIterations: z.number().int().min(1).max(10_000).default(100) }), ports: [anyInput, { id: 'body', label: '循环体', direction: 'output', dataType: PortDataType.ANY }, { id: 'done', label: '完成', direction: 'output', dataType: PortDataType.COLLECTION }] }),
  definition({ type: NodeType.WAIT, category: NodeCategory.CONTROL, title: '等待', description: '延迟后继续执行。', icon: 'Clock3', execution: 'deterministic', defaultConfig: { durationMs: 1_000 }, configSchema: z.object({ durationMs: z.number().int().min(1).max(86_400_000) }), ports: [anyInput, anyOutput] }),
  definition({ type: NodeType.CHILD_WORKFLOW, category: NodeCategory.CONTROL, title: '子流程', description: '调用另一个已发布流程。', icon: 'Workflow', execution: 'extension', adapterId: 'child-workflow', defaultConfig: { workflowId: '' }, configSchema: z.object({ workflowId: z.string().min(1) }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.END, category: NodeCategory.CONTROL, title: '结束', description: '明确终止当前执行路径。', icon: 'CircleStop', execution: 'deterministic', defaultConfig: { outcome: 'success' }, configSchema: z.object({ outcome: z.enum(['success', 'failure']).default('success'), code: z.string().optional(), message: z.string().optional() }), ports: [anyInput] }),

  definition({ type: NodeType.SET_VARIABLE, category: NodeCategory.DATA, title: '设置变量', description: '向当前上下文写入命名变量。', icon: 'Variable', execution: 'deterministic', defaultConfig: { name: '', value: '' }, configSchema: z.object({ name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), value: expressionSchema }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.TRANSFORM, category: NodeCategory.DATA, title: '数据转换', description: '将输入映射为新的 JSON 输出。', icon: 'Shuffle', execution: 'activity', adapterId: 'transform', defaultConfig: { mapping: '{}' }, configSchema: z.object({ mapping: z.string().min(2) }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.FILTER, category: NodeCategory.DATA, title: '过滤', description: '按规则过滤集合。', icon: 'Filter', execution: 'extension', adapterId: 'filter', defaultConfig: { expression: '' }, configSchema: z.object({ expression: expressionSchema }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.AGGREGATE, category: NodeCategory.DATA, title: '聚合', description: '汇总集合中的数据。', icon: 'Sigma', execution: 'extension', adapterId: 'aggregate', defaultConfig: { operation: 'count' }, configSchema: z.object({ operation: z.enum(['count', 'sum', 'group']).default('count') }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.SCHEMA_VALIDATE, category: NodeCategory.DATA, title: 'Schema 校验', description: '根据 JSON Schema 校验输入。', icon: 'BadgeCheck', execution: 'activity', adapterId: 'schema', defaultConfig: { schema: '{}' }, configSchema: z.object({ schema: z.string().min(2) }), ports: [anyInput, structuredOutput] }),

  definition({ type: NodeType.HTTP, category: NodeCategory.ACTION, title: 'HTTP 请求', description: '调用任意 HTTP API。', icon: 'Globe2', execution: 'activity', adapterId: 'http', defaultConfig: { method: 'POST', url: '', headers: '{}', body: '{}' }, configSchema: z.object({ method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'), url: z.string().url(), headers: z.string().default('{}'), body: z.string().default('{}') }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.SCRIPT, category: NodeCategory.ACTION, title: '脚本', description: '在本地隔离 adapter 中运行脚本。', icon: 'Code2', execution: 'activity', adapterId: 'script', defaultConfig: { code: 'return input;' }, configSchema: z.object({ code: z.string().min(1).max(20_000) }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.BROWSER, category: NodeCategory.ACTION, title: '浏览器', description: '用 Playwright 执行浏览器动作。', icon: 'MonitorPlay', execution: 'activity', adapterId: 'browser', defaultConfig: { action: BrowserActionType.NAVIGATE, url: '' }, configSchema: z.object({ action: z.nativeEnum(BrowserActionType), url: z.string().optional(), selector: z.string().optional(), text: z.string().optional() }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.DATABASE, category: NodeCategory.ACTION, title: '数据库', description: '通过配置 adapter 查询数据库。', icon: 'Database', execution: 'extension', adapterId: 'database', defaultConfig: { query: '' }, configSchema: z.object({ query: z.string().min(1) }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.NOTIFICATION, category: NodeCategory.ACTION, title: '通知', description: '发送 Webhook 或已配置渠道通知。', icon: 'BellRing', execution: 'activity', adapterId: 'notification', defaultConfig: { channel: 'webhook', target: '', message: '' }, configSchema: z.object({ channel: z.enum(['webhook', 'console']).default('webhook'), target: z.string().min(1), message: z.string().min(1) }), ports: [anyInput, structuredOutput] }),
  definition({ type: NodeType.FILE, category: NodeCategory.ACTION, title: '文件', description: '读取或写入配置的文件存储。', icon: 'FileText', execution: 'extension', adapterId: 'file', defaultConfig: { operation: 'write', path: '' }, configSchema: z.object({ operation: z.enum(['read', 'write']).default('write'), path: z.string().min(1) }), ports: [anyInput, structuredOutput] }),

  definition({ type: NodeType.APPROVAL, category: NodeCategory.HUMAN, title: '人工审批', description: '等待指定人员给出批准或拒绝。', icon: 'BadgeCheck', execution: 'signal', defaultConfig: { assignee: '', timeoutHours: 24 }, configSchema: z.object({ assignee: z.string().min(1), timeoutHours: z.number().int().min(1).max(720).default(24) }), ports: [anyInput, { id: 'approved', label: '批准', direction: 'output', dataType: PortDataType.SIGNAL }, { id: 'rejected', label: '拒绝', direction: 'output', dataType: PortDataType.SIGNAL }] }),
  definition({ type: NodeType.INFORMATION_REQUEST, category: NodeCategory.HUMAN, title: '信息收集', description: '等待人工填写结构化信息。', icon: 'MessageSquareMore', execution: 'signal', defaultConfig: { assignee: '', schema: '{}' }, configSchema: z.object({ assignee: z.string().min(1), schema: z.string().min(2) }), ports: [anyInput, structuredOutput] }),
];

const byType = new Map(nodeCatalog.map((entry) => [entry.type, entry]));

export function getNodeDefinition(type: NodeType): NodeDefinition | undefined {
  return byType.get(type);
}

export function getCategoryNodes(category: NodeCategory): NodeDefinition[] {
  return nodeCatalog.filter((entry) => entry.category === category);
}

export function isNodeExecutable(definition: NodeDefinition, adapterStatuses: AdapterStatus[] = []): boolean {
  if (definition.execution !== 'extension') return true;
  const status = adapterStatuses.find((entry) => entry.adapterId === definition.adapterId);
  return status?.available === true;
}
