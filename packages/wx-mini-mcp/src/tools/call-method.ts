import { z } from 'zod';
import { evaluateOnPage } from '../evaluate.js';
import { loadAnalysis, normalizeRoute, resolveTargetDir } from '../keymap.js';
import { waitForPage } from '../page.js';
import { withMiniProgram } from '../session.js';
import { defaultProjectRoot, handle, type Server, text } from './utils.js';

export function registerCallMethodTool(server: Server): void {
  server.tool(
    'mp_call_method',
    '调用当前页面实例上的方法，等价于触发一次用户交互（本 MCP 无模拟点击能力，这是触发页面事件的正确方式）。uni-app 项目直接传源码方法名（如 changeTitle），会自动经 keymap 翻译成编译后的事件 id；原生小程序传 methods 里的方法名即可',
    {
      method: z.string().describe('方法名：uni-app 源码方法名（自动翻译），或实例上的函数名/事件 id（如 e0）'),
      args: z.array(z.unknown()).optional().describe('传给方法的参数数组。不传时事件处理器自动收到 { type: "tap" }'),
    },
    handle(async ({ method, args }) => {
      return withMiniProgram(async (mp) => {
        const state = await waitForPage(mp);
        if (!state) return text('当前没有已加载的页面');

        let resolved = method;
        let isEventHandler = /^e\d+$/.test(method);
        // uni-app：把源码方法名翻译成编译后的事件 id（如 changeTitle -> e0）
        if (!isEventHandler) {
          try {
            const analysis = loadAnalysis(resolveTargetDir(defaultProjectRoot()));
            const page = analysis.pages[normalizeRoute(state.route)];
            const hit = page?.keys.find(
              (k) => (k.sourceName === method || k.generatedName === method) && k.kind === 'event-handler',
            );
            if (hit) {
              resolved = hit.key;
              isEventHandler = true;
            }
          } catch {
            // 非 uni-app 项目（无产物目录），按原名调用
          }
        }

        // 区分「未传」与「显式传空数组」：只有未传时才给事件处理器补合成 tap 事件
        const callArgs = args !== undefined ? args : isEventHandler ? [{ type: 'tap' }] : [];
        const called = await evaluateOnPage(
          mp,
          (top: any, fn: string, a: unknown[]) => {
            let target = fn;
            if (typeof top[target] !== 'function') {
              // uni-app：keymap 里的 key 是 data 键，data 里的值才是实例上的事件 id（data.c === 'e0'）
              const viaData = top.data && typeof top.data[target] === 'string' ? top.data[target] : null;
              if (viaData && typeof top[viaData] === 'function') target = viaData;
            }
            if (typeof top[target] !== 'function') {
              const available = Object.keys(top).filter((k) => typeof top[k] === 'function');
              throw new Error(`页面实例上不存在方法 ${fn}，可用：${available.join(', ')}`);
            }
            return { target, result: top[target](...a) ?? null };
          },
          resolved,
          callArgs,
        );
        return text({ called: method, resolvedAs: called.target, result: called.result ?? '已调用' });
      });
    }),
  );
}
