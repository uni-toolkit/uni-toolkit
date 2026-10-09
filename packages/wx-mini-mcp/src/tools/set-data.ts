import { z } from 'zod';
import { evaluateOnPage } from '../evaluate.js';
import { waitForPage } from '../page.js';
import { withMiniProgram } from '../session.js';
import { handle, type Server, text } from './utils.js';

export function registerSetDataTool(server: Server): void {
  server.tool(
    'mp_set_data',
    '直接修改当前页面的 data（等价于页面内 this.setData），用于数据驱动测试。注意：uni-app 项目要用编译后的 key（如 b 而不是 title，可用 mp_current_page 或 uni_keymap 查映射），且绕过 Vue 状态，页面重渲染后可能被覆盖',
    {
      data: z.record(z.unknown()).describe('要设置的数据对象，如 { "b": "abc" }'),
    },
    handle(async ({ data }) => {
      return withMiniProgram(async (mp) => {
        const state = await waitForPage(mp);
        if (!state) return text('当前没有已加载的页面');
        await evaluateOnPage(
          mp,
          (top: any, d: Record<string, unknown>) => {
            top.setData(d);
          },
          data,
        );
        return text('已设置');
      });
    }),
  );
}
