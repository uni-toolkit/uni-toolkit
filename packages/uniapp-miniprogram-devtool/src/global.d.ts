// Global API types for the WeChat miniprogram logic layer.
// The automator's evaluate callback runs inside the miniprogram logic layer, not in Node.js,
// so these globals must be declared manually.

interface MiniProgramPageInstance {
  route?: string;
  __route__?: string;
  data: Record<string, unknown> & { __webviewId__?: number | string };
}

declare function getCurrentPages(): MiniProgramPageInstance[];
