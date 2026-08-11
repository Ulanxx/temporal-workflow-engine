import { EdgeKind, NodeType, WorkflowDefinition } from '../types';

export const contentReviewWorkflowDefinition: WorkflowDefinition = {
  schemaVersion: 1,
  nodes: [
    { id: 'webhook', type: NodeType.WEBHOOK, name: '接收投稿', position: { x: 0, y: 160 }, config: { method: 'POST' } },
    { id: 'validate', type: NodeType.SCHEMA_VALIDATE, name: '验证投稿', position: { x: 220, y: 160 }, config: { schema: '{"type":"object"}' } },
    { id: 'analyze', type: NodeType.MODEL, name: '风险与质量分析', position: { x: 440, y: 160 }, config: { model: 'gpt-5-mini', input: '{{ steps.validate.output }}', responseFormat: 'json' } },
    { id: 'route', type: NodeType.CONDITION, name: '风险分流', position: { x: 660, y: 160 }, config: { expression: 'steps.analyze.output.score >= 0.82' } },
    { id: 'approval', type: NodeType.APPROVAL, name: '人工复核', position: { x: 880, y: 280 }, config: { assignee: '内容运营组', timeoutHours: 24 } },
    { id: 'publish', type: NodeType.HTTP, name: '发布内容', position: { x: 880, y: 60 }, config: { method: 'POST', url: 'mock://content/publish', headers: '{}', body: '{{ steps.analyze.output }}' } },
    { id: 'notify', type: NodeType.NOTIFICATION, name: '通知结果', position: { x: 1100, y: 160 }, config: { channel: 'console', target: 'content-review', message: '{{ steps.analyze.output }}' } },
    { id: 'end', type: NodeType.END, name: '完成', position: { x: 1320, y: 160 }, config: { outcome: 'success' } },
  ],
  edges: [
    { id: 'webhook-validate', source: 'webhook', target: 'validate', kind: EdgeKind.CONTROL },
    { id: 'validate-analyze', source: 'validate', target: 'analyze', kind: EdgeKind.CONTROL },
    { id: 'analyze-route', source: 'analyze', target: 'route', kind: EdgeKind.CONTROL },
    { id: 'route-publish', source: 'route', target: 'publish', kind: EdgeKind.CONDITION, label: '通过' },
    { id: 'route-approval', source: 'route', target: 'approval', kind: EdgeKind.CONDITION, label: '复核' },
    { id: 'publish-notify', source: 'publish', target: 'notify', kind: EdgeKind.CONTROL },
    { id: 'approval-notify', source: 'approval', target: 'notify', kind: EdgeKind.CONTROL },
    { id: 'notify-end', source: 'notify', target: 'end', kind: EdgeKind.CONTROL },
  ],
};

export const contentReviewSampleInput = {
  body: {
    title: '一条待审核的投稿',
    content: '这是用于本地演示的内容。',
  },
};
