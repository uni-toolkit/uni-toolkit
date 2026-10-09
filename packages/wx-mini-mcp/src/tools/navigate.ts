import { z } from 'zod';
import { ensureMiniProgram } from '../session.js';
import { type Server, text } from './utils.js';

export function registerNavigateTool(server: Server): void {
  server.tool(
    'mp_navigate',
    '小程序内页面导航。tabBar 页面必须用 switchTab；普通页面用 navigateTo；url 使用以 / 开头的绝对路径',
    {
      url: z.string().describe('目标页面路径，如 /pages/index/index'),
      method: z.enum(['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navigateBack']).optional(),
    },
    async ({ url, method = 'navigateTo' }) => {
      const mp = await ensureMiniProgram();
      if (method === 'navigateBack') {
        await mp.navigateBack();
      } else {
        await mp[method](url);
      }
      return text(`已执行 ${method} ${url}`);
    },
  );
}
