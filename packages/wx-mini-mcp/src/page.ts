import type { MiniProgramApi } from './session.js';

export interface RuntimePageState {
  route: string;
  stackLength: number;
  data?: Record<string, unknown>;
}

// Page.getData 在当前开发者工具版本会挂起，改为在逻辑层 evaluate 直接读 getCurrentPages()
export async function readCurrentPage(mp: MiniProgramApi, withData = true): Promise<RuntimePageState | null> {
  return mp.evaluate((full: boolean) => {
    const pages = getCurrentPages();
    const top = pages[pages.length - 1] as any;
    if (!top) return null;
    return {
      route: top.route || '',
      stackLength: pages.length,
      data: full ? top.data || {} : undefined,
    };
  }, withData);
}

// 刚连接上时模拟器可能还在加载，等页面就绪后再操作
export async function waitForPage(mp: MiniProgramApi, attempts = 20): Promise<RuntimePageState | null> {
  for (let i = 0; i < attempts; i++) {
    const state = await readCurrentPage(mp, false);
    if (state) return state;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
