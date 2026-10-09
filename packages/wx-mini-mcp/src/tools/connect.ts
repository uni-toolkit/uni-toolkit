import { z } from 'zod';
import { currentSession, disconnect, ensureMiniProgram } from '../session.js';
import { type Server, text } from './utils.js';

export function registerConnectTools(server: Server): void {
  server.tool(
    'mp_connect',
    '启动微信开发者工具并连接小程序项目（惰性连接，后续工具会自动复用）。前置条件：开发者工具 设置 -> 安全设置 -> 服务端口 已开启',
    {
      projectPath: z
        .string()
        .optional()
        .describe('小程序项目目录（含 project.config.json）。也可用环境变量 WEAPP_PROJECT_PATH'),
      cliPath: z.string().optional().describe('微信开发者工具 CLI 路径。不传则按平台探测默认安装路径'),
      force: z.boolean().optional().describe('强制断开重连'),
    },
    async ({ projectPath, cliPath, force }) => {
      await ensureMiniProgram({ projectPath, cliPath, force });
      return text(`已连接：${currentSession().projectPath}`);
    },
  );

  server.tool('mp_disconnect', '断开与微信开发者工具的自动化连接', {}, async () => {
    await disconnect();
    return text('已断开');
  });
}
