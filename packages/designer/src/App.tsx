import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Handle, Position, ReactFlow, Background, BackgroundVariant, MarkerType, NodeProps } from 'reactflow';
import { BellRing, Blocks, Braces, CheckCircle2, ChevronRight, Clock3, Code2, GitBranch, LayoutTemplate, Play, Settings2, Sparkles, Webhook, Workflow } from 'lucide-react';
import { BrowserRouter, Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { NodeType, Workflow as WorkflowModel } from '@temporal-workflow-engine/shared';
import 'reactflow/dist/style.css';
import './index.css';

const queryClient = new QueryClient();
const api = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`/api${path}`);
  if (!response.ok) throw new Error('无法连接 Workflow API');
  return response.json() as Promise<T>;
};

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
  if (isLoading) return <Shell><p className="empty">正在建立工作台...</p></Shell>;
  if (error || !data) return <Shell><p className="empty">流程不存在或 API 不可用。</p></Shell>;
  const nodes = data.nodes.map((node, index) => ({ id: node.id, type: 'workflow', position: node.position, data: { type: node.type, index: String(index + 1).padStart(2, '0'), label: node.name, summary: node.description || node.type.replaceAll('_', ' ') } }));
  const edges = data.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#27221f', strokeWidth: 1.25 }, labelStyle: { fill: '#8f2f25', fontFamily: 'JetBrains Mono', fontSize: 10 } }));
  return <Shell><section className="designer-head"><div><Link to="/workflows">流程</Link><span>/</span><b>{data.name}</b><small>DRAFT · {data.nodes.length} NODES · VALID</small></div><div><button className="quiet">发布</button><button className="primary"><Play size={14}/>运行</button></div></section><section className="designer"><aside className="node-library"><div className="panel-title"><b>节点库</b><span>29 TYPES</span></div><input placeholder="搜索节点或动作..."/><NodeGroup icon={<Sparkles size={14}/>} title="智能 / AI" items={['模型调用', 'Agent', 'MCP 工具', '知识检索']}/><NodeGroup icon={<GitBranch size={14}/>} title="流程控制" items={['条件分支', '并行', '循环', '人工审批']}/><NodeGroup icon={<Blocks size={14}/>} title="集成与动作" items={['HTTP 请求', '浏览器', '通知', '脚本']}/></aside><div className="canvas"><div className="canvas-title"><b>{data.name}</b><span>生产版本 · 自动布局</span></div><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.35} proOptions={{ hideAttribution: true }}><Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#d6d0c5"/></ReactFlow></div><aside className="inspector"><div className="panel-title"><b>配置</b><span>02 / AI</span></div><h2>风险与质量分析</h2><p>结构化判断内容风险与质量。</p><div className="tabs"><span className="active">配置</span><span>输入</span><span>重试</span></div><label>模型<input value="gpt-5-mini" readOnly/></label><label>输入<code>{'{{ steps.validate.output }}'}</code></label><label>输出结构<input value="ReviewResult" readOnly/></label><div className="run-strip"><span><i/>RUN #1842</span><b>等待审批</b></div></aside></section></Shell>;
}
function NodeGroup({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) { return <div className="node-group"><p>{icon}{title}</p>{items.map((item) => <button key={item}><span>＋</span>{item}<small>DRAG</small></button>)}</div>; }
function Placeholder({ title }: { title: string }) { return <Shell><section className="page-head"><div><p>WORKBENCH</p><h1>{title}</h1><span>该视图正在接入新的运行读模型。</span></div></section><div className="empty ruled">运行、集成与模板将与 Designer 共享同一份流程定义和版本记录。</div></Shell>; }
function AppRoutes() { return <Routes><Route path="/workflows" element={<Library/>}/><Route path="/workflows/:workflowId" element={<Designer/>}/><Route path="/runs" element={<Placeholder title="运行中心"/>}/><Route path="/integrations" element={<Placeholder title="集成设置"/>}/><Route path="/templates" element={<Placeholder title="流程模板"/>}/><Route path="/settings" element={<Placeholder title="本地设置"/>}/><Route path="*" element={<Navigate to="/workflows" replace/>}/></Routes>; }
export function App() { return <QueryClientProvider client={queryClient}><BrowserRouter><AppRoutes/></BrowserRouter></QueryClientProvider>; }
