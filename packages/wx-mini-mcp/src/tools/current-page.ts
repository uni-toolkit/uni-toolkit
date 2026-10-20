import { z } from 'zod';
import { buildNamedRows, loadAnalysis, normalizeRoute, resolveTargetDir } from '../keymap.js';
import { readCurrentPage } from '../page.js';
import { ensureMiniProgram } from '../session.js';
import { defaultProjectRoot, handle, type Server, text } from './utils.js';

export function registerCurrentPageTool(server: Server): void {
  server.tool(
    'mp_current_page',
    '获取当前页面信息：route、页面栈、page.data。translate 为 true 时（uni-app 项目）把编译后的混淆 key 翻译回源码变量名',
    {
      withData: z.boolean().optional().describe('是否返回完整 page.data，默认 true'),
      translate: z.boolean().optional().describe('uni-app 项目：结合 keymap 把混淆 key 翻译回源码变量名，默认 false'),
    },
    handle(async ({ withData, translate }) => {
      const mp = await ensureMiniProgram();
      const state = await readCurrentPage(mp, withData !== false);
      if (!state) return text('当前没有已加载的页面');
      if (!translate || !state.data) return text(state);

      const targetDir = resolveTargetDir(defaultProjectRoot());
      const analysis = loadAnalysis(targetDir);
      const { found, rows, unmappedKeys } = buildNamedRows(analysis, normalizeRoute(state.route), state.data);
      return text({ route: state.route, stackLength: state.stackLength, keymapFound: found, rows, unmappedKeys });
    }),
  );
}
