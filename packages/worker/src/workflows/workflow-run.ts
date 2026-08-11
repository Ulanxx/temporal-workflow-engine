import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
} from '@temporalio/workflow';
import {
  createInvocationId,
  EdgeKind,
  JsonObject,
  JsonValue,
  NodeType,
  RunStatus,
  StepInvocation,
  StepStatus,
  WorkflowActivities,
  WorkflowEdge,
  WorkflowNode,
  GraphRunParams,
  GraphRunResult,
  WorkflowNodeExecutionResult,
} from '@temporal-workflow-engine/shared';

const activities = proxyActivities<WorkflowActivities>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 3 },
});

const resolveApproval = defineSignal<[{
  invocationId: string;
  response: JsonValue;
}]>('resolveApproval');

interface RuntimeContext {
  input: JsonObject;
  steps: Record<string, { output: JsonValue }>;
  variables: JsonObject;
  branchPath: string[];
  iterationPath: number[];
}

interface PathOptions {
  stopAtNode?: string;
  stopAtMerge?: boolean;
}

interface PathResult {
  output: JsonValue;
  reachedMerge?: string;
  reachedStop?: string;
}

function nodeEdges(definition: GraphRunParams['definition'], nodeId: string): WorkflowEdge[] {
  return definition.edges.filter((edge) => edge.source === nodeId && (edge.kind ?? EdgeKind.CONTROL) !== EdgeKind.DATA);
}

function evaluate(expression: string, context: RuntimeContext): JsonValue {
  const source = expression.trim().replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '');
  if (!source) return null;

  // Published workflow expressions are author-controlled. Keeping this evaluator
  // inside the deterministic workflow makes branch selection replayable.
  try {
    const fn = new Function('input', 'steps', 'variables', `return (${source});`);
    return fn(context.input, context.steps, context.variables) as JsonValue;
  } catch {
    return source;
  }
}

function resolveValue(value: JsonValue, context: RuntimeContext): JsonValue {
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, context));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, resolveValue(nested, context)]));
  }
  if (typeof value !== 'string') return value;
  const exact = value.match(/^\s*\{\{([\s\S]+)\}\}\s*$/);
  if (exact) return evaluate(exact[1], context);
  return value.replace(/\{\{([\s\S]+?)\}\}/g, (_match, expression: string) => String(evaluate(expression, context)));
}

function resolvedConfig(node: WorkflowNode, context: RuntimeContext): JsonObject {
  return resolveValue(node.config, context) as JsonObject;
}

function asObject(value: JsonValue): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : { value };
}

function invocationFor(runId: string, node: WorkflowNode, context: RuntimeContext, input: JsonObject): StepInvocation {
  return {
    id: createInvocationId(runId, node.id, context.branchPath, context.iterationPath),
    runId,
    nodeId: node.id,
    branchPath: context.branchPath,
    iterationPath: context.iterationPath,
    status: StepStatus.QUEUED,
    attempt: 1,
    input,
  };
}

function selectConditionEdge(edges: WorkflowEdge[], matched: boolean): WorkflowEdge | undefined {
  const port = matched ? 'true' : 'false';
  return edges.find((edge) => edge.sourcePort === port)
    ?? edges.find((edge) => edge.label?.toLowerCase() === port)
    ?? edges[matched ? 0 : 1]
    ?? edges[0];
}

function selectSwitchEdge(edges: WorkflowEdge[], value: JsonValue): WorkflowEdge | undefined {
  const selected = String(value);
  return edges.find((edge) => edge.sourcePort === selected || edge.label === selected)
    ?? edges.find((edge) => edge.sourcePort === 'default' || edge.label === 'default')
    ?? edges[0];
}

export async function executeWorkflowRun(params: GraphRunParams): Promise<GraphRunResult> {
  const { runId, workflowId, versionId, definition, input } = params;
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
  const trigger = definition.nodes.find((node) => [NodeType.MANUAL_TRIGGER, NodeType.WEBHOOK, NodeType.SCHEDULE, NodeType.EVENT_SUBSCRIPTION].includes(node.type));
  if (!trigger) throw new Error('工作流缺少触发器。');

  const approvalResponses = new Map<string, JsonValue>();
  setHandler(resolveApproval, ({ invocationId, response }) => {
    approvalResponses.set(invocationId, response);
  });

  const context: RuntimeContext = { input, steps: {}, variables: {}, branchPath: [], iterationPath: [] };

  const invoke = async (node: WorkflowNode, current: RuntimeContext): Promise<JsonValue> => {
    const nodeInput = { ...current.input, steps: current.steps, variables: current.variables } as JsonObject;
    const invocation = invocationFor(runId, node, current, nodeInput);
    await activities.transitionInvocation({ invocation, status: StepStatus.QUEUED, event: 'queued' });
    await activities.transitionInvocation({ invocation, status: StepStatus.RUNNING, event: 'started' });

    try {
      const config = resolvedConfig(node, current);
      let result: JsonValue;

      switch (node.type) {
        case NodeType.MANUAL_TRIGGER:
        case NodeType.WEBHOOK:
        case NodeType.SCHEDULE:
        case NodeType.EVENT_SUBSCRIPTION:
          result = current.input;
          break;
        case NodeType.SET_VARIABLE: {
          const name = String(config.name ?? '');
          current.variables[name] = config.value ?? null;
          result = { name, value: current.variables[name] };
          break;
        }
        case NodeType.CONDITION:
          result = { matched: Boolean(evaluate(String(config.expression ?? 'false'), current)) };
          break;
        case NodeType.SWITCH:
          result = { value: evaluate(String(config.expression ?? ''), current) };
          break;
        case NodeType.WAIT:
          await sleep(Math.min(Number(config.durationMs ?? 1_000), 86_400_000));
          result = { waitedMs: Number(config.durationMs ?? 1_000) };
          break;
        case NodeType.APPROVAL:
        case NodeType.INFORMATION_REQUEST: {
          const waitType = node.type === NodeType.APPROVAL ? 'approval' : 'information';
          const timeoutHours = Number(config.timeoutHours ?? 24);
          const expiresAt = new Date(Date.now() + timeoutHours * 3_600_000).toISOString();
          await activities.createRunWait({ runId, invocationId: invocation.id, nodeId: node.id, type: waitType, expiresAt });
          await activities.transitionInvocation({ invocation, status: StepStatus.WAITING, event: 'waiting', payload: { type: waitType } });
          const resolved = await condition(() => approvalResponses.has(invocation.id), timeoutHours * 3_600_000);
          if (!resolved) throw new Error(`${node.name} 等待超时。`);
          result = approvalResponses.get(invocation.id) ?? { approved: true };
          await activities.resolveRunWait({ runId, invocationId: invocation.id, response: result });
          break;
        }
        case NodeType.END:
          if (config.outcome === 'failure') throw new Error(String(config.message ?? '流程以失败结束。'));
          result = current.input;
          break;
        default: {
          const execution: WorkflowNodeExecutionResult = await activities.executeWorkflowNode({ nodeId: node.id, type: node.type, name: node.name, config, input: nodeInput });
          result = execution.output;
        }
      }

      current.steps[node.id] = { output: result };
      await activities.transitionInvocation({ invocation: { ...invocation, output: result }, status: StepStatus.COMPLETED, event: 'completed' });
      return result;
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : String(error);
      await activities.transitionInvocation({
        invocation: { ...invocation, failureMessage },
        status: StepStatus.FAILED,
        event: 'failed',
        payload: { message: failureMessage },
      });
      throw error;
    }
  };

  const runPath = async (nodeId: string, current: RuntimeContext, options: PathOptions = {}): Promise<PathResult> => {
    if (options.stopAtNode === nodeId) return { output: current.steps[nodeId]?.output ?? current.input, reachedStop: nodeId };
    const node = nodes.get(nodeId);
    if (!node) throw new Error(`找不到节点 ${nodeId}。`);
    if (options.stopAtMerge && node.type === NodeType.MERGE) {
      return { output: current.steps[nodeId]?.output ?? current.input, reachedMerge: nodeId };
    }

    let result: JsonValue;
    try {
      result = await invoke(node, current);
    } catch (error) {
      const errorEdge = nodeEdges(definition, node.id).find((edge) => (edge.kind ?? EdgeKind.CONTROL) === EdgeKind.ERROR);
      if (!errorEdge) throw error;
      current.variables.error = error instanceof Error ? error.message : String(error);
      return runPath(errorEdge.target, current, options);
    }

    if (node.type === NodeType.END) return { output: result };
    const edges = nodeEdges(definition, node.id).filter((edge) => (edge.kind ?? EdgeKind.CONTROL) !== EdgeKind.ERROR);
    if (edges.length === 0) throw new Error(`节点 ${node.name} 没有下一步节点。`);

    if (node.type === NodeType.PARALLEL) {
      const branches = await Promise.all(edges.map((edge) => runPath(edge.target, { ...current, branchPath: [...current.branchPath, edge.sourcePort ?? edge.label ?? edge.id] }, { stopAtMerge: true })));
      const mergeId = branches[0]?.reachedMerge;
      if (mergeId && branches.every((branch) => branch.reachedMerge === mergeId)) {
        const mergeContext: RuntimeContext = {
          ...current,
          branchPath: [...current.branchPath, 'merge'],
          input: { ...current.input, branches: branches.map((branch) => asObject(branch.output)) },
        };
        return runPath(mergeId, mergeContext, options);
      }
      return { output: branches.map((branch) => branch.output) };
    }

    if (node.type === NodeType.LOOP) {
      const collection = evaluate(String((resolvedConfig(node, current).collection ?? '[]')), current);
      if (!Array.isArray(collection)) throw new Error(`循环节点 ${node.name} 的集合表达式必须返回数组。`);
      const config = resolvedConfig(node, current);
      const body = edges.find((edge) => edge.sourcePort === 'body' || edge.label === '循环体') ?? edges[0];
      const done = edges.find((edge) => edge.sourcePort === 'done' || edge.label === '完成') ?? edges[1];
      if (!body || !done) throw new Error(`循环节点 ${node.name} 需要循环体和完成出口。`);
      const outputs: JsonValue[] = [];
      const maximumIterations = Number(config.maximumIterations ?? 100);
      for (let index = 0; index < Math.min(collection.length, maximumIterations); index += 1) {
        const itemContext: RuntimeContext = {
          ...current,
          input: { ...current.input, item: collection[index] as JsonValue, index },
          iterationPath: [...current.iterationPath, index],
        };
        const item = await runPath(body.target, itemContext, { stopAtNode: node.id });
        outputs.push(item.output);
      }
      current.steps[node.id] = { output: outputs };
      return runPath(done.target, current, options);
    }

    if (node.type === NodeType.CONDITION) {
      const matched = Boolean(asObject(result).matched);
      const edge = selectConditionEdge(edges, matched);
      if (!edge) throw new Error(`条件节点 ${node.name} 没有匹配出口。`);
      return runPath(edge.target, current, options);
    }

    if (node.type === NodeType.SWITCH) {
      const edge = selectSwitchEdge(edges, asObject(result).value ?? null);
      if (!edge) throw new Error(`分支节点 ${node.name} 没有匹配出口。`);
      return runPath(edge.target, current, options);
    }

    return runPath(edges[0].target, current, options);
  };

  try {
    await activities.markRunStarted({ runId });
    const result = await runPath(trigger.id, context);
    await activities.markRunCompleted({ runId, output: result.output });
    return { runId, workflowId, versionId, status: RunStatus.COMPLETED, output: result.output };
  } catch (error) {
    const failureMessage = error instanceof Error ? error.message : String(error);
    await activities.markRunFailed({ runId, failureMessage });
    throw error;
  }
}
