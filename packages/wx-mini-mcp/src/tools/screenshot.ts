import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withMiniProgram } from '../session.js';
import { handle, type Server } from './utils.js';

export function registerScreenshotTool(server: Server): void {
  server.tool(
    'mp_screenshot',
    '截取开发者工具模拟器当前画面，返回 PNG 图片',
    {},
    handle(async () => {
      const file = path.join(os.tmpdir(), `wx-mini-mcp-${Date.now()}.png`);
      try {
        await withMiniProgram((mp) => mp.screenshot({ path: file }));
        const base64 = await fs.promises.readFile(file, 'base64');
        return { content: [{ type: 'image' as const, data: base64, mimeType: 'image/png' as const }] };
      } finally {
        await fs.promises.unlink(file).catch(() => {});
      }
    }),
  );
}
