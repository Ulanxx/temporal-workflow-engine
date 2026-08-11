import { getNodeDefinition } from './catalog';
import {
  AdapterStatus,
  EdgeKind,
  NodeCategory,
  NodeType,
  ValidationIssue,
  ValidationResult,
  WorkflowDefinition,
  WorkflowEdge,
} from './types';

const expressionReference = /steps\.([A-Za-z0-9_-]+)\.output/g;

function issue(code: string, message: string, details: Omit<ValidationIssue, 'code' | 'message' | 'severity'> = {}): ValidationIssue {
  return { code, message, severity: 'error', ...details };
}

function controlEdges(edges: WorkflowEdge[]): WorkflowEdge[] {
  return edges.filter((edge) => (edge.kind ?? EdgeKind.CONTROL) !== EdgeKind.DATA);
}

function collectExpressions(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectExpressions);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectExpressions);
  return [];
}

function reachableFrom(startId: string, edges: WorkflowEdge[]): Set<string> {
  const reachable = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of edges.filter((candidate) => candidate.source === current)) {
      if (!reachable.has(edge.target)) {
        reachable.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return reachable;
}

function hasPath(source: string, target: string, edges: WorkflowEdge[]): boolean {
  return reachableFrom(source, edges).has(target);
}

function hasInvalidCycle(definition: WorkflowDefinition, edges: WorkflowEdge[]): boolean {
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string, path: string[]): boolean => {
    if (visiting.has(nodeId)) {
      const cycle = path.slice(path.indexOf(nodeId));
      return !cycle.some((id) => nodesById.get(id)?.type === NodeType.LOOP);
    }
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const edge of edges.filter((candidate) => candidate.source === nodeId)) {
      if (visit(edge.target, [...path, nodeId])) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  return definition.nodes.some((node) => visit(node.id, []));
}

export function extractExpressionReferences(value: unknown): string[] {
  const references = new Set<string>();
  for (const expression of collectExpressions(value)) {
    for (const match of expression.matchAll(expressionReference)) references.add(match[1]);
  }
  return [...references];
}

export function validateWorkflowDefinition(
  definition: WorkflowDefinition,
  adapterStatuses: AdapterStatus[] = [],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const edges = controlEdges(definition.edges);

  for (const node of definition.nodes) {
    if (nodeIds.has(node.id)) issues.push(issue('node.duplicate_id', '节点 ID 重复。', { nodeId: node.id }));
    nodeIds.add(node.id);
    const catalogEntry = getNodeDefinition(node.type);
    if (!catalogEntry) {
      issues.push(issue('node.unknown_type', '节点类型未注册。', { nodeId: node.id }));
      continue;
    }
    if (!catalogEntry.configSchema.safeParse(node.config).success) {
      issues.push(issue('node.invalid_config', '节点配置不符合当前节点 Schema。', { nodeId: node.id }));
    }
    if (catalogEntry.execution === 'extension') {
      const status = adapterStatuses.find((entry) => entry.adapterId === catalogEntry.adapterId);
      if (!status?.available) {
        issues.push(issue('adapter.unavailable', status?.setupHint ?? '节点依赖的 adapter 未配置。', { nodeId: node.id }));
      }
    }
  }

  const triggers = definition.nodes.filter((node) => getNodeDefinition(node.type)?.category === NodeCategory.TRIGGER);
  if (triggers.length !== 1) issues.push(issue('graph.trigger_count', '已发布流程必须恰好包含一个触发器。'));

  for (const edge of definition.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      issues.push(issue('edge.missing_node', '连线引用了不存在的节点。', { edgeId: edge.id }));
    }
    if (edge.kind === EdgeKind.DATA) continue;
    if (edge.source === edge.target && nodesById.get(edge.source)?.type !== NodeType.LOOP) {
      issues.push(issue('edge.self_cycle', '只有循环节点可以连接到自身。', { edgeId: edge.id }));
    }
  }

  if (triggers.length === 1) {
    const reachable = reachableFrom(triggers[0].id, edges);
    for (const node of definition.nodes) {
      if (!reachable.has(node.id)) issues.push(issue('graph.unreachable', '节点无法从触发器到达。', { nodeId: node.id }));
    }
  }

  for (const node of definition.nodes) {
    const outgoing = edges.filter((edge) => edge.source === node.id);
    if (node.type === NodeType.END && outgoing.length > 0) {
      issues.push(issue('graph.end_has_successor', '结束节点不能有后续连线。', { nodeId: node.id }));
    }
    if (node.type !== NodeType.END && outgoing.length === 0) {
      issues.push(issue('graph.missing_end', '每条控制路径必须显式连接到结束节点。', { nodeId: node.id }));
    }
    if (node.type === NodeType.CONDITION || node.type === NodeType.SWITCH) {
      const labels = new Set<string>();
      for (const edge of outgoing) {
        const label = edge.label?.trim();
        if (!label) issues.push(issue('branch.missing_label', '分支连线必须有标签。', { edgeId: edge.id }));
        else if (labels.has(label)) issues.push(issue('branch.duplicate_label', '同一分支节点不能有重复标签。', { edgeId: edge.id }));
        else labels.add(label);
      }
    }
  }

  if (hasInvalidCycle(definition, edges)) issues.push(issue('graph.invalid_cycle', '循环必须通过一个循环节点。'));

  for (const node of definition.nodes) {
    for (const reference of extractExpressionReferences(node.config)) {
      const producer = nodesById.get(reference);
      if (!producer) {
        issues.push(issue('expression.unknown_reference', '表达式引用了不存在的节点输出。', { nodeId: node.id }));
      } else if (!hasPath(producer.id, node.id, edges)) {
        issues.push(issue('expression.invalid_dependency', '表达式引用的节点不在当前控制路径上。', { nodeId: node.id }));
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
