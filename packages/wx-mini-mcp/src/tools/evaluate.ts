import { z } from 'zod';
import { callAppFunction } from '../evaluate.js';
import { ensureMiniProgram } from '../session.js';
import { handle, type Server, text } from './utils.js';

export function registerEvaluateTool(server: Server): void {
  server.tool(
    'mp_evaluate',
    '在小程序逻辑层（App Service）执行任意 JavaScript 并返回结果。可直接访问 getCurrentPages()、getApp()、wx 等全局对象；表达式自动返回值，多行语句用 return',
    {
      code: z
        .string()
        .describe(
          '要执行的 JS 代码，如 "getCurrentPages().length" 或 "const p = getCurrentPages(); return p.length"（结果需可 JSON 序列化）',
        ),
    },
    handle(async ({ code }) => {
      const mp = await ensureMiniProgram();
      // 先在本地做语法检查，选定表达式或语句体形式再发送；
      // 运行时异常直接抛出，不能重试——代码可能已经部分执行过，重试会让副作用执行两次
      const attempts = [`function () { return (${code}\n); }`, `function () { ${code}\n }`];
      let declaration: string | undefined;
      let syntaxError: unknown;
      for (const candidate of attempts) {
        try {
          new Function(`(${candidate})`);
          declaration = candidate;
          break;
        } catch (error) {
          syntaxError = error;
        }
      }
      if (declaration === undefined) throw syntaxError;
      const result = await callAppFunction(mp, declaration);
      return text(result === undefined || result === null ? '已执行（无返回值）' : result);
    }),
  );
}
