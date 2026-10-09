export interface ManagedConnection<T> {
  instance: T;
  endpoint: string;
}

export interface SessionConnector<T> {
  connect(endpoint: string): Promise<T | null>;
  launch(projectPath: string, cliPath: string, startPort: number): Promise<ManagedConnection<T>>;
  disconnect(instance: T): Promise<void>;
  onClose?(instance: T, listener: () => void): void;
}

export interface EnsureSessionOptions {
  projectPath: string;
  cliPath: string;
  startPort: number;
  explicitEndpoint?: string;
  force?: boolean;
}

interface ActiveSession<T> {
  instance: T;
  projectPath: string;
}

interface PendingSession<T> {
  projectPath: string;
  promise: Promise<T>;
}

interface ReconnectTarget {
  projectPath: string;
  endpoint: string;
}

export class SessionManager<T> {
  private active: ActiveSession<T> | null = null;
  private pending: PendingSession<T> | null = null;
  private reconnectTarget: ReconnectTarget | null = null;
  private generation = 0;

  constructor(private readonly connector: SessionConnector<T>) {}

  currentSession(): { connected: boolean; projectPath: string } {
    return {
      connected: this.active !== null,
      projectPath: this.active?.projectPath || '',
    };
  }

  reuse(projectPath?: string): Promise<T> | null {
    if (this.active && (!projectPath || this.active.projectPath === projectPath)) {
      return Promise.resolve(this.active.instance);
    }
    if (this.pending && (!projectPath || this.pending.projectPath === projectPath)) {
      return this.pending.promise;
    }
    return null;
  }

  async ensure(options: EnsureSessionOptions): Promise<T> {
    if (!options.force && this.active?.projectPath === options.projectPath) {
      return this.active.instance;
    }
    if (!options.force && this.pending?.projectPath === options.projectPath) {
      return this.pending.promise;
    }

    const operationGeneration = ++this.generation;
    const promise = this.open(options, operationGeneration);
    this.pending = { projectPath: options.projectPath, promise };

    try {
      return await promise;
    } finally {
      if (this.pending?.promise === promise) this.pending = null;
    }
  }

  async disconnect(): Promise<void> {
    this.generation++;
    this.pending = null;
    await this.closeActive();
  }

  invalidate(instance: T): void {
    if (this.active?.instance !== instance) return;
    this.active = null;
    void this.connector.disconnect(instance).catch(() => {});
  }

  private async open(options: EnsureSessionOptions, operationGeneration: number): Promise<T> {
    await this.closeActive();
    this.assertCurrent(operationGeneration);

    const reconnectTarget = options.explicitEndpoint
      ? { projectPath: options.projectPath, endpoint: options.explicitEndpoint }
      : this.reconnectTarget?.projectPath === options.projectPath
        ? this.reconnectTarget
        : null;

    let connection: ManagedConnection<T> | null = null;
    if (!options.force && reconnectTarget) {
      const instance = await this.connector.connect(reconnectTarget.endpoint);
      if (instance) connection = { instance, endpoint: reconnectTarget.endpoint };
    }
    this.assertCurrent(operationGeneration);
    if (!connection) {
      connection = await this.connector.launch(options.projectPath, options.cliPath, options.startPort);
    }
    const establishedConnection = connection;

    if (operationGeneration !== this.generation) {
      await this.connector.disconnect(establishedConnection.instance);
      throw new Error('连接过程中已被断开');
    }

    this.active = { instance: establishedConnection.instance, projectPath: options.projectPath };
    this.reconnectTarget = { projectPath: options.projectPath, endpoint: establishedConnection.endpoint };
    this.connector.onClose?.(establishedConnection.instance, () => this.markClosed(establishedConnection.instance));
    return establishedConnection.instance;
  }

  private async closeActive(): Promise<void> {
    if (!this.active) return;
    const { instance } = this.active;
    this.active = null;
    try {
      await this.connector.disconnect(instance);
    } catch {
      // 连接可能已经由开发者工具关闭。
    }
  }

  private assertCurrent(operationGeneration: number): void {
    if (operationGeneration !== this.generation) throw new Error('连接过程中已被断开');
  }

  private markClosed(instance: T): void {
    if (this.active?.instance === instance) this.active = null;
  }
}
