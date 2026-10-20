export interface ManagedInstance {
  disconnect(): void | Promise<void>;
}

export interface ManagedConnection {
  instance: ManagedInstance;
  endpoint: string;
}

export interface SessionConnector {
  connect(endpoint: string): Promise<ManagedInstance | null>;
  launch(projectPath: string, cliPath: string, startPort: number): Promise<ManagedConnection>;
  onClose?(instance: ManagedInstance, listener: () => void): void;
}

export interface EnsureSessionOptions {
  projectPath: string;
  cliPath: string;
  startPort: number;
  explicitEndpoint?: string;
  force?: boolean;
}

interface ActiveSession {
  instance: ManagedInstance;
  projectPath: string;
}

interface PendingSession {
  projectPath: string;
  promise: Promise<ManagedInstance>;
}

interface ReconnectTarget {
  projectPath: string;
  endpoint: string;
}

export class SessionManager {
  private active: ActiveSession | null = null;
  private pending: PendingSession | null = null;
  private reconnectTarget: ReconnectTarget | null = null;
  private generation = 0;

  constructor(private readonly connector: SessionConnector) {}

  currentSession(): { connected: boolean; projectPath: string } {
    return {
      connected: this.active !== null,
      projectPath: this.active?.projectPath || '',
    };
  }

  reuse(projectPath?: string): Promise<ManagedInstance> | null {
    if (this.active && (!projectPath || this.active.projectPath === projectPath)) {
      return Promise.resolve(this.active.instance);
    }
    if (this.pending && (!projectPath || this.pending.projectPath === projectPath)) {
      return this.pending.promise;
    }
    return null;
  }

  async ensure(options: EnsureSessionOptions): Promise<ManagedInstance> {
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

  private async open(options: EnsureSessionOptions, operationGeneration: number): Promise<ManagedInstance> {
    await this.closeActive();
    this.assertCurrent(operationGeneration);

    let connection: ManagedConnection | null = null;
    let launched = false;

    if (!options.force) {
      if (options.explicitEndpoint) {
        // 显式配置的端点：用户明确指定，连不上就报错而不是悄悄打开别的窗口
        const instance = await this.connector.connect(options.explicitEndpoint);
        await this.discardIfStale(instance, operationGeneration);
        if (!instance) {
          throw new Error(
            `无法连接 WEAPP_WS_ENDPOINT 指定的地址 ${options.explicitEndpoint}（连接失败或 3 秒内无响应）。请确认项目窗口已开启自动化，或移除该环境变量改为自动启动`,
          );
        }
        connection = { instance, endpoint: options.explicitEndpoint };
      } else if (this.reconnectTarget?.projectPath === options.projectPath) {
        // disconnect 只关 ws，窗口和自动化端口还在；只直连本进程 launch 过且同项目的端口
        const instance = await this.connector.connect(this.reconnectTarget.endpoint);
        await this.discardIfStale(instance, operationGeneration);
        if (instance) connection = { instance, endpoint: this.reconnectTarget.endpoint };
      }
    }

    if (!connection) {
      connection = await this.connector.launch(options.projectPath, options.cliPath, options.startPort);
      launched = true;
    }
    const establishedConnection = connection;

    if (operationGeneration !== this.generation) {
      await this.safelyDisconnect(establishedConnection.instance);
      throw new Error('连接过程中已被断开');
    }

    this.active = { instance: establishedConnection.instance, projectPath: options.projectPath };
    // 只记录本进程 launch 的端口用于下次直连复用；显式端点连上的窗口来源不明，不复用
    if (launched) {
      this.reconnectTarget = { projectPath: options.projectPath, endpoint: establishedConnection.endpoint };
    }
    this.connector.onClose?.(establishedConnection.instance, () => this.markClosed(establishedConnection.instance));
    return establishedConnection.instance;
  }

  private async discardIfStale(instance: ManagedInstance | null, operationGeneration: number): Promise<void> {
    if (operationGeneration === this.generation) return;
    // 连接期间有人调用了 disconnect，这个实例直接丢弃，不能装成活会话
    if (instance) await this.safelyDisconnect(instance);
    throw new Error('连接过程中已被断开');
  }

  private async closeActive(): Promise<void> {
    if (!this.active) return;
    const { instance } = this.active;
    this.active = null;
    await this.safelyDisconnect(instance);
  }

  private async safelyDisconnect(instance: ManagedInstance): Promise<void> {
    try {
      await instance.disconnect();
    } catch {
      // 连接可能已经由开发者工具关闭。
    }
  }

  private assertCurrent(operationGeneration: number): void {
    if (operationGeneration !== this.generation) throw new Error('连接过程中已被断开');
  }

  private markClosed(instance: ManagedInstance): void {
    if (this.active?.instance === instance) this.active = null;
  }
}
