import React, { useState } from "react";
import {
  Layout,
  Typography,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Divider,
  Tooltip,
  Card,
  Badge,
  theme
} from "antd";
import {
  SaveOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SettingOutlined,
  HistoryOutlined,
  QuestionCircleOutlined,
  ExportOutlined,
  ImportOutlined,
} from "@ant-design/icons";
import { Node, Edge } from "reactflow";

import FlowEditor from "../components/FlowEditor";
import NodePropertiesForm from "../components/forms/NodePropertiesForm";
import { workflowApi } from "../services/api";
import { Workflow } from "../types";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const WorkflowDesigner: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [createForm] = Form.useForm();

  // 创建新工作流
  const handleCreateWorkflow = async (values: any) => {
    try {
      setIsLoading(true);
      const workflow = await workflowApi.createWorkflow({
        name: values.name,
        description: values.description,
        nodes: [],
        edges: [],
      });

      setCurrentWorkflow(workflow);
      setNodes([]);
      setEdges([]);
      setIsCreateModalVisible(false);
      createForm.resetFields();
      message.success("工作流创建成功");
    } catch (error: any) {
      console.error("创建工作流失败:", error);
      message.error("创建工作流失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 保存工作流
  const handleSaveWorkflow = async () => {
    if (!currentWorkflow) {
      message.warning("请先创建工作流");
      return;
    }

    try {
      setIsLoading(true);

      // 转换节点和边数据
      const workflowNodes = nodes.map((node) => ({
        id: node.id,
        type: node.data.type,
        name: node.data.label,
        description: node.data?.description || "",
        position: {
          x: node.position.x,
          y: node.position.y,
        },
        ...node.data,
      }));

      const workflowEdges = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.data?.label || "",
        condition: edge.data?.condition || "",
      }));

      const updatedWorkflow = await workflowApi.updateWorkflow(
        currentWorkflow.id,
        {
          nodes: workflowNodes,
          edges: workflowEdges,
        }
      );

      setCurrentWorkflow(updatedWorkflow);
      message.success("工作流保存成功");
    } catch (error: any) {
      console.error("保存工作流失败:", error);
      message.error("保存工作流失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 执行工作流
  const handleExecuteWorkflow = async () => {
    if (!currentWorkflow) {
      message.warning("请先创建工作流");
      return;
    }

    try {
      setIsLoading(true);

      // 保存当前工作流，然后执行
      await handleSaveWorkflow();

      const result = await workflowApi.executeWorkflow(currentWorkflow.id);
      message.success(`工作流执行已启动，执行ID: ${result.id}`);
      Modal.info({
        title: "工作流执行",
        content: (
          <div>
            <p>工作流执行已启动</p>
            <p>执行ID: {result.id}</p>
            <p>状态: {result.status}</p>
          </div>
        ),
      });
    } catch (error: any) {
      console.error("执行工作流失败:", error);
      message.error("执行工作流失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 处理节点选择
  const handleNodeSelect = (_event: any, node: Node) => {
    setSelectedNode(node);
  };

  // 处理节点属性保存
  const handleNodePropertySave = (nodeId: string, data: any) => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => (node.id === nodeId ? { ...node, data } : node))
    );
    message.success("节点属性已更新");
  };

  // 使用 antd 的主题 token
  const { token } = theme.useToken();
  
  return (
    <Layout style={{ height: "100vh", background: token.colorBgContainer }}>
      <Header
        style={{
          background: token.colorBgElevated,
          padding: "0 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          height: "64px",
          lineHeight: "64px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Title level={3} style={{ margin: 0, color: token.colorPrimary }}>
              {currentWorkflow?.name || "Workflow 设计器"}
            </Title>
            {currentWorkflow && (
              <Badge 
                status="processing" 
                text="已加载" 
                style={{ marginLeft: 16 }} 
              />
            )}
          </div>
          
          <Space size="middle">
            <Tooltip title="创建新工作流">
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setIsCreateModalVisible(true)}
                size="middle"
              >
                新建工作流
              </Button>
            </Tooltip>
            
            <Divider type="vertical" style={{ height: 24 }} />
            
            <Space>
              <Tooltip title="导入工作流定义">
                <Button icon={<ImportOutlined />} />
              </Tooltip>
              
              <Tooltip title="导出当前工作流">
                <Button 
                  icon={<ExportOutlined />} 
                  disabled={!currentWorkflow}
                />
              </Tooltip>
            </Space>
            
            <Divider type="vertical" style={{ height: 24 }} />
            
            <Space>
              <Tooltip title="保存当前工作流">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveWorkflow}
                  loading={isLoading}
                  disabled={!currentWorkflow}
                >
                  保存
                </Button>
              </Tooltip>
              
              <Tooltip title="执行当前工作流">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleExecuteWorkflow}
                  loading={isLoading}
                  disabled={!currentWorkflow}
                  style={{ background: token.colorSuccess }}
                >
                  执行
                </Button>
              </Tooltip>
            </Space>
          </Space>
        </div>
      </Header>

      <Layout>
        <Content 
          style={{ 
            padding: "16px", 
            height: "calc(100vh - 64px)",
            background: token.colorBgLayout,
            position: "relative" 
          }}
        >
          <Card 
            bordered={false} 
            style={{ 
              height: "100%", 
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)" 
            }}
            bodyStyle={{ padding: 0, height: "100%" }}
          >
            <FlowEditor
              initialNodes={nodes}
              initialEdges={edges}
              onNodesChange={setNodes}
              onEdgesChange={setEdges}
              onNodeSelect={handleNodeSelect}
              hasWorkflow={!!currentWorkflow}
            />
          </Card>
        </Content>

        <Sider
          width={320}
          theme="light"
          style={{ 
            padding: "16px 0 16px 16px", 
            overflowY: "auto",
            background: token.colorBgLayout,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Card 
            bordered={false} 
            title="节点属性" 
            extra={<Tooltip title="帮助"><QuestionCircleOutlined /></Tooltip>}
            style={{ 
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              height: "100%",
              display: "flex",
              flexDirection: "column" 
            }}
            bodyStyle={{ 
              padding: "16px", 
              overflow: "auto", 
              flex: 1 
            }}
          >
            {selectedNode ? (
              <NodePropertiesForm
                node={selectedNode}
                onSave={handleNodePropertySave}
              />
            ) : (
              <div style={{ 
                color: token.colorTextSecondary, 
                textAlign: "center", 
                marginTop: "40px" 
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>
                  <SettingOutlined style={{ opacity: 0.3 }} />
                </div>
                <p>请选择一个节点进行配置</p>
              </div>
            )}
          </Card>
        </Sider>
      </Layout>

      <Modal
        title="创建新工作流"
        open={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        footer={null}
        centered
        width={500}
        style={{ top: 20 }}
        maskStyle={{ backdropFilter: "blur(2px)" }}
        bodyStyle={{ padding: "24px 24px 16px" }}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateWorkflow}
          initialValues={{ name: "新工作流" + new Date().toISOString().substring(0, 10) }}
        >
          <Form.Item
            name="name"
            label="工作流名称"
            rules={[{ required: true, message: "请输入工作流名称" }]}
          >
            <Input 
              placeholder="输入工作流名称" 
              autoFocus 
              prefix={<HistoryOutlined style={{ color: token.colorTextSecondary }} />}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea 
              rows={4} 
              placeholder="输入工作流描述（可选）" 
              showCount 
              maxLength={200} 
            />
          </Form.Item>
          <Form.Item>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button onClick={() => setIsCreateModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={isLoading}>
                创建
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default WorkflowDesigner;
