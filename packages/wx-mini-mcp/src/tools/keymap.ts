import { z } from 'zod';
import { loadAnalysis, resolveTargetDir, summarizeAnalysis } from '../keymap.js';
import { defaultProjectRoot, handle, type Server, text } from './utils.js';

export function registerKeymapTool(server: Server): void {
  server.tool(
    'uni_keymap',
    '分析 uni-app / uni-app x 项目的 mp-weixin 编译产物，返回混淆 key 与源码变量名的映射表（uni-app 专用，其余 MCP 不具备的能力）',
    {
      projectRoot: z
        .string()
        .optional()
        .describe('uni-app 项目根目录或 mp-weixin 产物目录。不传则依次尝试已连接项目、WEAPP_PROJECT_PATH、当前目录'),
      refresh: z.boolean().optional().describe('忽略缓存重新分析（代码重新编译后用）'),
    },
    handle(async ({ projectRoot, refresh }) => {
      const targetDir = resolveTargetDir(projectRoot || defaultProjectRoot());
      const analysis = loadAnalysis(targetDir, refresh);
      return text({ targetDir, generatedAt: analysis.generatedAt, pages: summarizeAnalysis(analysis) });
    }),
  );
}
