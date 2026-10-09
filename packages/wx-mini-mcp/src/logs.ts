export interface LogEntry {
  time: string;
  text: string;
}

const MAX_LOG_ENTRIES = 200;
const consoleLogs: LogEntry[] = [];
const exceptions: LogEntry[] = [];

export function pushLog(list: LogEntry[], payload: unknown): void {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  list.push({ time: new Date().toISOString(), text: text.length > 2000 ? `${text.slice(0, 2000)}…` : text });
  if (list.length > MAX_LOG_ENTRIES) list.splice(0, list.length - MAX_LOG_ENTRIES);
}

export function getConsoleLogs(): LogEntry[] {
  return consoleLogs;
}

export function getExceptions(): LogEntry[] {
  return exceptions;
}

export function clearConsoleLogs(): void {
  consoleLogs.length = 0;
}

export function clearExceptions(): void {
  exceptions.length = 0;
}
