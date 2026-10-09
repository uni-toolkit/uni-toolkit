import type { MiniProgramApi } from './session.js';

// automator 的 d.ts 把 send 标成了 private，实际运行时是公开的（callWxMethod 等内部都走它）
interface Sendable {
  send(method: string, params?: Record<string, unknown>): Promise<{ result: unknown }>;
}

// 在逻辑层执行函数声明字符串（小程序运行时禁用 new Function/eval，只能在 Node 侧拼好源码下发）
export async function callAppFunction(
  mp: MiniProgramApi,
  functionDeclaration: string,
  args: unknown[] = [],
): Promise<unknown> {
  const { result } = await (mp as unknown as Sendable).send('App.callFunction', { functionDeclaration, args });
  return result;
}

// 取栈顶页面实例并执行回调。fn 会被内联进函数声明，不能引用 Node 侧闭包变量，参数走 args 传入
export async function evaluateOnPage<Args extends unknown[], R>(
  mp: MiniProgramApi,
  fn: (top: any, ...args: Args) => R,
  ...args: Args
): Promise<R> {
  const declaration = `function () {
    var pages = getCurrentPages();
    var top = pages[pages.length - 1];
    if (!top) throw new Error('当前没有已加载的页面');
    var fn = ${fn.toString()};
    return fn.apply(null, [top].concat(Array.prototype.slice.call(arguments)));
  }`;
  return (await callAppFunction(mp, declaration, args)) as R;
}
