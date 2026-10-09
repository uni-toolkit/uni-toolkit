import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureMiniProgram } from '../session.js';
import type { Server } from './utils.js';

export function registerScreenshotTool(server: Server): void {
  server.tool('mp_screenshot', '截取开发者工具模拟器当前画面，返回 PNG 图片', {}, async () => {
    const mp = await ensureMiniProgram();
    const file = path.join(os.tmpdir(), `wx-mini-mcp-${Date.now()}.png`);
    await mp.screenshot({ path: file });
    const base64 = await fs.promises.readFile(file, 'base64');
    await fs.promises.unlink(file).catch(() => {});
    return { content: [{ type: 'image' as const, data: base64, mimeType: 'image/png' as const }] };
  });
}
