import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addEdge, Background, BackgroundVariant, Connection, Edge, Handle, MarkerType, Node, NodeProps, Position, ReactFlow, useEdgesState, useNodesState } from 'reactflow';
import { BellRing, Blocks, Braces, CheckCircle2, ChevronRight, Clock3, Code2, GitBranch, LayoutTemplate, Play, Settings2, Sparkles, Webhook, Workflow } from 'lucide-react';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { EdgeKind, NodeType, Workflow as WorkflowModel, WorkflowDefinition } from '@temporal-workflow-engine/shared';
import 'reactflow/dist/style.css';
import './index.css';

const queryClient = new QueryClient();
const api = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error('无法连接 Workflow API');
  return response.json() as Promise<T>;
};
const request = async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
  const response = await fetch(`/api${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.text()) || '请求失败');
  return response.json() as Promise<T>;
};
const nodeTitles: Partial<Record<NodeType, string>> = {
  [NodeType.MODEL]: '模型调用', [NodeType.AGENT]: 'Agent', [NodeType.MCP_TOOL]: 'MCP 工具', [NodeType.KNOWLEDGE_RETRIEVAL]: '知识检索',
  [NodeType.CONDITION]: '条件分支', [NodeType.PARALLEL]: '并行', [NodeType.LOOP]: '循环', [NodeType.APPROVAL]: '人工审批',
  [NodeType.HTTP]: 'HTTP 请求', [NodeType.BROWSER]: '浏览器', [NodeType.NOTIFICATION]: '通知', [NodeType.SCRIPT]: '脚本',
};
const nodeTitle = (type: NodeType): string => nodeTitles[type] ?? '新节点';
const serializeGraph = (nodes: Node[], edges: Edge[]): WorkflowDefinition => ({
  schemaVersion: 1,
  nodes: nodes.map(({ id, position, data }) => ({ id, type: data.type, name: data.label, description: data.summary, position, config: data.config ?? {} })),
  edges: edges.map(({ id, source, target, label }) => ({ id, source, target, label: typeof label === 'string' ? label : undefined, kind: label ? EdgeKind.CONDITION : EdgeKind.CONTROL })),
});

const iconByType: Record<string, typeof Webhook> = { [NodeType.WEBHOOK]: Webhook, [NodeType.MODEL]: Sparkles, [NodeType.CONDITION]: GitBranch, [NodeType.APPROVAL]: CheckCircle2, [NodeType.HTTP]: Blocks, [NodeType.NOTIFICATION]: BellRing, [NodeType.END]: CheckCircle2, [NodeType.SCHEMA_VALIDATE]: Braces };
function FlowNode({ data, selected }: NodeProps) {
  const Icon = iconByType[data.type] ?? Code2;
  return <div className={`flow-node ${selected ? 'selected' : ''} ${data.type}`}><Handle type="target" position={Position.Left} /><div className="node-kicker"><Icon size={12}/><span>{String(data.type).replaceAll('_', ' ')}</span><b>{data.index}</b></div><strong>{data.label}</strong><small>{data.summary}</small><div className="node-footer">{data.type === NodeType.APPROVAL ? 'SIGNAL · 24H' : 'OUTPUT · JSON'}</div><Handle type="source" position={Position.Right} /></div>;
}
const nodeTypes = { workflow: FlowNode };

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="app-shell"><aside className="rail"><div className="seal">流</div><nav><Link className="rail-link active" to="/workflows" title="流程"><Workflow size={18}/><span>流程</span></Link><Link className="rail-link" to="/runs" title="运行"><Clock3 size={18}/><span>运行</span></Link><Link className="rail-link" to="/integrations" title="集成"><Blocks size={18}/><span>集成</span></Link><Link className="rail-link" to="/templates" title="模板"><LayoutTemplate size={18}/><span>模板</span></Link></nav><Link className="rail-link rail-bottom" to="/settings" title="设置"><Settings2 size={18}/><span>设置</span></Link></aside><section className="content-shell"><header className="topbar"><div><b>WORKFLOW ENGINE</b><span className="status"><i/>CONTROL PLANE</span></div><span>temporal-workflow-engine / local</span></header>{children}</section></main>;
}

function Library() {
  const { data = [], isLoading } = useQuery({ queryKey: ['workflows'], queryFn: () => api<WorkflowModel[]>('/workflows') });
  return <Shell><section className="page-head"><div><p>WORKFLOWS / ASSETS</p><h1>流程工作台</h1><span>设计、发布并观察每一条可靠执行的业务流程。</span></div><button className="primary">＋ 新建流程</button></section><section className="library-grid">{isLoading && <p className="empty">正在读取流程资产...</p>}{data.map((workflow) => <Link className="workflow-row" key={workflow.id} to={`/workflows/${workflow.id}`}><div><span className="asset-id">{workflow.id.slice(0, 8)}</span><h2>{workflow.name}</h2><p>{workflow.description || '尚未填写流程描述。'}</p></div><div className="asset-meta"><span>{workflow.nodes.length} NODES</span><span>V{workflow.version || 'DRAFT'}</span><ChevronRight size={16}/></div></Link>)}</section></Shell>;
}

function Designer() {
  const { workflowId = '' } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['workflow', workflowId], queryFn: () => api<WorkflowModel>(`/workflows/${workflowId}`) });
  const { data: draft } = useQuery({ queryKey: ['draft', workflowId], queryFn: () => api<{ revision: number; definition: WorkflowDefinition }>(`/workflows/${workflowId}/draft`) });
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState('analyze');
  const [notice, setNotice] = useState('');
  const saveMutation = useMutation({ mutationFn: (payload: { revision: number; definition: unknown }) => request(`/workflows/${workflowId}/draft`, 'PUT', payload), onSuccess: () => { setNotice('草稿已保存'); void queryClient.invalidateQueries({ queryKey: ['draft', workflowId] }); } });
  const publishMutation = useMutation({ mutationFn: async () => { const definition = serializeGraph(nodes, edges); const currentRevision = draft?.revision ?? 1; await request(`/workflows/${workflowId}/draft`, 'PUT', { revision: currentRevision, definition }); return request(`/workflows/${workflowId}/publish`, 'POST', { changeSummary: '通过 Workbench 发布' }); }, onSuccess: () => setNotice('版本已发布') });
  useEffect(() => { const source = draft?.definition?.nodes ?? data?.nodes; if (!source) return; setNodes(source.map((node, index) => ({ id: node.id, type: 'workflow', position: node.position, data: { ...node, type: node.type, index: String(index + 1).padStart(2, '0'), label: node.name, summary: node.description || node.type.replaceAll('_', ' ') } }))); setEdges((draft?.definition?.edges ?? data?.edges ?? []).map((edge) => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#27221f', strokeWidth: 1.25 } }))); }, [data, draft, setEdges, setNodes]);
  if (isLoading) return <Shell><p className="empty">正在建立工作台...</p></Shell>;
  if (error || !data) return <Shell><p className="empty">流程不存在或 API 不可用。</p></Shell>;
  const selected = nodes.find((node) => node.id === selectedId);
  const save = () => saveMutation.mutate({ revision: draft?.revision ?? 1, definition: serializeGraph(nodes, edges) });
  const addNode = (type: NodeType) => { const id = `${type}-${Date.now()}`; setNodes((current) => [...current, { id, type: 'workflow', position: { x: 500, y: 400 }, data: { type, index: String(current.length + 1).padStart(2, '0'), label: nodeTitle(type), summary: type.replaceAll('_', ' '), config: {} } }]); setNotice(`${nodeTitle(type)} 已加入画布`); };
  return <Shell><section className="designer-head"><div><Link to="/workflows">流程</Link><span>/</span><b>{data.name}</b><small>{notice || `DRAFT · ${nodes.length} NODES`}</small></div><div><button className="quiet" onClick={save} disabled={saveMutation.isPending}>保存草稿</button><button className="quiet" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>发布</button><button className="primary"><Play size={14}/>运行</button></div></section><section className="designer"><aside className="node-library"><div className="panel-title"><b>节点库</b><span>29 TYPES</span></div><input placeholder="搜索节点或动作..."/><NodeGroup onAdd={addNode} icon={<Sparkles size={14}/>} title="智能 / AI" items={[['模型调用', NodeType.MODEL], ['Agent', NodeType.AGENT], ['MCP 工具', NodeType.MCP_TOOL], ['知识检索', NodeType.KNOWLEDGE_RETRIEVAL]]}/><NodeGroup onAdd={addNode} icon={<GitBranch size={14}/>} title="流程控制" items={[['条件分支', NodeType.CONDITION], ['并行', NodeType.PARALLEL], ['循环', NodeType.LOOP], ['人工审批', NodeType.APPROVAL]]}/><NodeGroup onAdd={addNode} icon={<Blocks size={14}/>} title="集成与动作" items={[['HTTP 请求', NodeType.HTTP], ['浏览器', NodeType.BROWSER], ['通知', NodeType.NOTIFICATION], ['脚本', NodeType.SCRIPT]]}/></aside><div className="canvas"><div className="canvas-title"><b>{data.name}</b><span>生产版本 · 自动布局</span></div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={(connection: Connection) => setEdges((current) => addEdge({ ...connection, id: `edge-${Date.now()}`, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#27221f', strokeWidth: 1.25 } }, current))} onNodeClick={(_, node) => setSelectedId(node.id)} fitView minZoom={0.35} proOptions={{ hideAttribution: true }}><Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#d6d0c5"/></ReactFlow></div><aside className="inspector"><div className="panel-title"><b>配置</b><span>{selected?.data?.index ?? '—'} / {selected?.data?.type ?? 'WORKFLOW'}</span></div><h2>{selected?.data?.label ?? '选择一个节点'}</h2><p>{selected?.data?.summary ?? '从画布选择节点查看配置。'}</p><div className="tabs"><span className="active">配置</span><span>输入</span><span>重试</span></div><label>节点名称<input value={selected?.data?.label ?? ''} readOnly/></label><label>节点类型<code>{selected?.data?.type ?? 'workflow'}</code></label><label>输出结构<input value="JSON / typed output" readOnly/></label><div className="run-strip"><span><i/>RUN #1842</span><b>等待审批</b></div></aside></section></Shell>;
}
function NodeGroup({ icon, title, items, onAdd }: { icon: React.ReactNode; title: string; items: Array<[string, NodeType]>; onAdd: (type: NodeType) => void }) { return <div className="node-group"><p>{icon}{title}</p>{items.map(([item, type]) => <button key={item} onClick={() => onAdd(type)}><span>＋</span>{item}<small>ADD</small></button>)}</div>; }
function Placeholder({ title }: { title: string }) { return <Shell><section className="page-head"><div><p>WORKBENCH</p><h1>{title}</h1><span>该视图正在接入新的运行读模型。</span></div></section><div className="empty ruled">运行、集成与模板将与 Designer 共享同一份流程定义和版本记录。</div></Shell>; }
function AppRoutes() { return <Routes><Route path="/workflows" element={<Library/>}/><Route path="/workflows/:workflowId" element={<Designer/>}/><Route path="/runs" element={<Placeholder title="运行中心"/>}/><Route path="/integrations" element={<Placeholder title="集成设置"/>}/><Route path="/templates" element={<Placeholder title="流程模板"/>}/><Route path="/settings" element={<Placeholder title="本地设置"/>}/><Route path="*" element={<Navigate to="/workflows" replace/>}/></Routes>; }
export function App() { return <QueryClientProvider client={queryClient}><BrowserRouter><AppRoutes/></BrowserRouter></QueryClientProvider>; }
