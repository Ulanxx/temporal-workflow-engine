import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import WorkflowDesigner from './pages/WorkflowDesigner';
import './App.css';

export function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <WorkflowDesigner />
    </ConfigProvider>
  );
}
