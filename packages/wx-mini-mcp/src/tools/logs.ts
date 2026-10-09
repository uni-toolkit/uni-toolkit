import { z } from 'zod';
import { clearConsoleLogs, clearExceptions, getConsoleLogs, getExceptions, type LogEntry } from '../logs.js';
import { ensureMiniProgram } from '../session.js';
import { type Server, text } from './utils.js';

// 日志类工具的公共骨架：读缓冲区（可选清空）
function registerLogTool(
  server: Server,
  name: string,
  description: string,
  emptyHint: string,
  get: () => LogEntry[],
  clearBuffer: () => void,
): void {
  server.tool(
    name,
    description,
    { clear: z.boolean().optional().describe('读取后清空缓冲，默认 false') },
    async ({ clear }) => {
      await ensureMiniProgram();
      const logs = get().slice();
      if (clear) clearBuffer();
      return text(logs.length > 0 ? logs : emptyHint);
    },
  );
}

export function registerLogTools(server: Server): void {
  registerLogTool(
    server,
    'mp_get_logs',
    '获取小程序控制台日志（连接期间持续收集，最多保留最近 200 条；重新连接会清空）',
    '暂无日志',
    getConsoleLogs,
    clearConsoleLogs,
  );

  registerLogTool(
    server,
    'mp_get_exceptions',
    '获取小程序运行时异常（连接期间持续收集，最多保留最近 200 条；重新连接会清空）',
    '暂无异常',
    getExceptions,
    clearExceptions,
  );
}
