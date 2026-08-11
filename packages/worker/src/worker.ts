import { NativeConnection, Worker } from '@temporalio/worker';
import { activities, cleanup } from './activities';
import * as workflows from './workflows';

/**
 * 启动Temporal Worker
 */
async function run() {
  try {
    // 连接到Temporal服务
    const connection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    // 创建Worker实例
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'workflow-engine-task-queue',
      workflowsPath: require.resolve('./workflows'),
      activities,
    });

    console.log('正在启动Worker...');
    
    // 注册关闭处理函数
    const shutdown = async () => {
      console.log('正在关闭Worker...');
      await cleanup();
      await worker.shutdown();
      process.exit(0);
    };

    // 监听进程信号
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // 启动Worker
    await worker.run();
  } catch (error: any) {
    console.error('Worker启动失败:', error);
    process.exit(1);
  }
}

// 运行Worker
run().catch((err) => {
  console.error(err);
  process.exit(1);
});
