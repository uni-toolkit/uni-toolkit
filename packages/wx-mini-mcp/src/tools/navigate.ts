import { z } from 'zod';
import { ensureMiniProgram } from '../session.js';
import { handle, type Server, text } from './utils.js';

type NavigateMethod = 'navigateTo' | 'redirectTo' | 'reLaunch' | 'switchTab' | 'navigateBack';

export function registerNavigateTool(server: Server): void {
  server.tool(
    'mp_navigate',
    '小程序内页面导航。tabBar 页面必须用 switchTab；普通页面用 navigateTo；url 使用以 / 开头的绝对路径；navigateBack 返回上一页，不需要 url',
    {
      url: z.string().optional().describe('目标页面路径，如 /pages/index/index。navigateBack 以外的 method 必填'),
      method: z.enum(['navigateTo', 'redirectTo', 'reLaunch', 'switchTab', 'navigateBack']).optional(),
    },
    handle(async ({ url, method = 'navigateTo' }: { url?: string; method?: NavigateMethod }) => {
      if (method === 'navigateBack') {
        const mp = await ensureMiniProgram();
        await mp.navigateBack();
        return text('已执行 navigateBack');
      }
      if (!url) {
        throw new Error(`method 为 ${method} 时 url 必填（仅 navigateBack 不需要 url）`);
      }
      const mp = await ensureMiniProgram();
      await mp[method](url);
      return text(`已执行 ${method} ${url}`);
    }),
  );
}
