import { z } from 'zod';
import { withMiniProgram } from '../session.js';
import { handle, type Server, text } from './utils.js';

export function registerWxApiTools(server: Server): void {
  server.tool(
    'mp_call_wx',
    '在小程序逻辑层调用 wx API，例如 wx.showToast。method 为 wx 上的方法名，args 为参数数组',
    {
      method: z.string().describe('wx 方法名，如 showToast'),
      args: z.array(z.unknown()).optional().describe('参数数组，如 [{ "title": "hi" }]'),
    },
    handle(async ({ method, args }) => {
      const result = await withMiniProgram((mp) => mp.callWxMethod(method, ...(args || [])));
      return text(result ?? '已调用');
    }),
  );

  server.tool(
    'mp_mock_wx',
    'Mock wx.* API 的返回值（如模拟 wx.login 成功、wx.request 返回测试数据）。restore: true 时恢复原始实现',
    {
      method: z.string().describe('wx 方法名，如 login、request、getSystemInfoSync'),
      result: z.unknown().optional().describe('Mock 的返回对象；不传则返回空对象'),
      restore: z.boolean().optional().describe('true = 恢复原始实现（忽略 result）'),
    },
    handle(async ({ method, result, restore }) => {
      if (restore) {
        await withMiniProgram((mp) => mp.restoreWxMethod(method));
        return text(`已恢复 wx.${method}`);
      }
      await withMiniProgram((mp) => mp.mockWxMethod(method, result ?? {}));
      return text(`已 mock wx.${method}`);
    }),
  );
}
