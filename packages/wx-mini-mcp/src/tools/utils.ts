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
