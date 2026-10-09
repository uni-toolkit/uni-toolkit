import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { currentSession } from '../session.js';

export type Server = McpServer;

export type ToolText = { content: Array<{ type: 'text'; text: string }> };

export function text(value: unknown): ToolText {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

export function defaultProjectRoot(): string {
  return currentSession().projectPath || process.env.WEAPP_PROJECT_PATH || process.cwd();
}

// automator / 开发者工具抛出的错误形态不一：Error、带 "Uncaught " 前缀的 Error、或普通对象
// （如 { errMsg: 'navigateBack:fail ...' }）。统一转成可读的 Error，避免客户端收到 [object Object]
export function toError(e: unknown): Error {
  if (e instanceof Error) {
    e.message = e.message.replace(/^Uncaught (Error: )?/, '');
    return e;
  }
  if (typeof e === 'object' && e !== null) {
    const errMsg = (e as { errMsg?: unknown }).errMsg;
    if (typeof errMsg === 'string') return new Error(errMsg);
    try {
      return new Error(JSON.stringify(e));
    } catch {
      return new Error(String(e));
    }
  }
  return new Error(String(e));
}

// 包装工具 handler，统一错误形态
export function handle(fn: (...args: any[]) => Promise<any>): (...args: any[]) => Promise<any> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      throw toError(e);
    }
  };
}
