# Temporal Workflow Engine

一个基于 Temporal 的 workflow engine，用来可靠执行 browser、script、HTTP、approval 这类步骤。

它不是通用低代码平台，也不是只会点按钮的浏览器自动化 demo。这里的目标很直接：把一条业务流程跑完、跑稳、跑得能查。

## 现在的边界

- Workflow 作为一等对象；
- Run、Step、Activity、Artifact、Timeline 作为核心概念；
- Playwright 只是 browser step 的一个 adapter；
- Temporal 负责重试、取消、恢复和长流程调度；
- Designer 只负责编辑和观察，不定义引擎核心。

## 仓库结构

- `packages/shared`：共享类型、workflow definition、activity contract
- `packages/api`：工作流 CRUD、启动、状态查询、取消
- `packages/worker`：Temporal Worker 与 activity adapters
- `packages/designer`：React Flow 设计器

## 本地启动

```bash
pnpm install
pnpm temporal:dev-server
pnpm start:api
pnpm start:worker
pnpm start:designer
```

## 第一阶段要做什么

1. 固化 workflow definition 和 step schema
2. 让 run 有完整 timeline 和 artifact
3. 把 browser/script/http/approval 统一成 activity adapter
4. 把状态存储从内存换成持久层
5. 让 Designer 可以编辑、启动、查看失败点

## 相关术语

- workflow：流程定义
- run：一次执行
- step：一个步骤
- adapter：一个可插拔执行方式

## 许可

MIT
