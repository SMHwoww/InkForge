/**
 * local server entry file, for local development & Tauri Sidecar
 *
 * 支持动态端口分配：
 * - 命令行参数：--port=3001
 * - 环境变量：PORT=3001
 * - 自动分配：从 3001 开始寻找可用端口
 * - 作为 Sidecar 运行时，将端口号输出到 stdout，供 Tauri 前端解析
 */
import app from './app.js';
import net from 'net';

/**
 * 检查端口是否可用
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * 寻找可用端口（从 startPort 开始）
 */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
  }
  return port;
}

/**
 * 解析命令行参数中的端口号
 */
function parsePortArg(): number | null {
  const portArg = process.argv.find(arg => arg.startsWith('--port='));
  if (portArg) {
    const parsed = parseInt(portArg.split('=')[1], 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

/**
 * 启动服务器
 */
async function start() {
  const portArg = parsePortArg();
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
  const startPort = portArg || envPort || 3001;
  const port = await findAvailablePort(startPort);

  const server = app.listen(port, '127.0.0.1', () => {
    const message = `INKFORGE_SERVER_PORT=${port}`;
    console.log(message);
    console.log(`Server ready on port ${port}`);
  });

  /**
   * close server
   */
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

start();

export default app;