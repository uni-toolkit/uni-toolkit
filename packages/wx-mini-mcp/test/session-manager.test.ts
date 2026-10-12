import { describe, expect, it, vi } from 'vitest';
import {
  type EnsureSessionOptions,
  type ManagedConnection,
  type ManagedInstance,
  type SessionConnector,
  SessionManager,
} from '../src/session-manager.js';

interface FakeSession extends ManagedInstance {
  id: string;
}

const fakeSession = (id: string): FakeSession => ({ id, disconnect: vi.fn(async () => {}) });

const options = (projectPath: string, overrides: Partial<EnsureSessionOptions> = {}): EnsureSessionOptions => ({
  projectPath,
  cliPath: '/devtools/cli',
  startPort: 9420,
  ...overrides,
});

function createConnector() {
  let launches = 0;
  const closeListeners = new Map<ManagedInstance, () => void>();
  const connector: SessionConnector = {
    connect: vi.fn(async () => null),
    launch: vi.fn(async (projectPath): Promise<ManagedConnection> => {
      launches++;
      return {
        instance: fakeSession(`${projectPath}-${launches}`),
        endpoint: `ws://127.0.0.1:${9420 + launches}`,
      };
    }),
    onClose: vi.fn((instance, listener) => closeListeners.set(instance, listener)),
  };
  return { connector, closeListeners };
}

describe('SessionManager', () => {
  it('reuses an active session only for the same project', async () => {
    const { connector } = createConnector();
    const manager = new SessionManager(connector);

    const first = (await manager.ensure(options('/project/a'))) as FakeSession;
    const reused = await manager.ensure(options('/project/a'));
    const switched = await manager.ensure(options('/project/b'));

    expect(reused).toBe(first);
    expect(switched).not.toBe(first);
    expect(connector.launch).toHaveBeenCalledTimes(2);
    expect(first.disconnect).toHaveBeenCalled();
    expect(manager.currentSession()).toEqual({ connected: true, projectPath: '/project/b' });
  });

  it('reuses an active or pending session without requiring connection options again', async () => {
    const { connector } = createConnector();
    let resolveLaunch!: (connection: ManagedConnection) => void;
    vi.mocked(connector.launch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLaunch = resolve;
        }),
    );
    const manager = new SessionManager(connector);
    const opening = manager.ensure(options('/project/a'));
    await vi.waitFor(() => expect(connector.launch).toHaveBeenCalled());

    const reusedWhilePending = manager.reuse();
    expect(reusedWhilePending).not.toBeNull();
    const instance = fakeSession('a');
    resolveLaunch({ instance, endpoint: 'ws://127.0.0.1:9420' });
    await expect(Promise.all([opening, reusedWhilePending])).resolves.toEqual([instance, instance]);
    await expect(manager.reuse()).resolves.toBe(instance);
    expect(manager.reuse('/project/b')).toBeNull();
  });

  it('does not reuse a remembered endpoint for another project', async () => {
    const { connector } = createConnector();
    const manager = new SessionManager(connector);

    await manager.ensure(options('/project/a'));
    await manager.disconnect();
    await manager.ensure(options('/project/b'));

    expect(connector.connect).not.toHaveBeenCalled();
    expect(connector.launch).toHaveBeenNthCalledWith(2, '/project/b', '/devtools/cli', 9420);
  });

  it('reconnects the same project through its remembered endpoint', async () => {
    const { connector } = createConnector();
    const reconnected = fakeSession('reconnected-a');
    vi.mocked(connector.connect).mockResolvedValue(reconnected);
    const manager = new SessionManager(connector);

    await manager.ensure(options('/project/a'));
    await manager.disconnect();
    const result = await manager.ensure(options('/project/a'));

    expect(result).toBe(reconnected);
    expect(connector.connect).toHaveBeenCalledWith('ws://127.0.0.1:9421');
    expect(connector.launch).toHaveBeenCalledTimes(1);
  });

  it('uses an explicit endpoint as a trusted target', async () => {
    const { connector } = createConnector();
    const direct = fakeSession('direct');
    vi.mocked(connector.connect).mockResolvedValue(direct);
    const manager = new SessionManager(connector);

    const result = await manager.ensure(options('/project/a', { explicitEndpoint: 'ws://127.0.0.1:9000' }));

    expect(result).toBe(direct);
    expect(connector.connect).toHaveBeenCalledWith('ws://127.0.0.1:9000');
    expect(connector.launch).not.toHaveBeenCalled();
  });

  it('fails fast when the explicit endpoint is unreachable instead of falling back to launch', async () => {
    const { connector } = createConnector();
    const manager = new SessionManager(connector);

    await expect(manager.ensure(options('/project/a', { explicitEndpoint: 'ws://127.0.0.1:9000' }))).rejects.toThrow(
      /WEAPP_WS_ENDPOINT/,
    );
    expect(connector.connect).toHaveBeenCalledWith('ws://127.0.0.1:9000');
    expect(connector.launch).not.toHaveBeenCalled();
  });

  it('does not remember an explicit endpoint for reconnection', async () => {
    const { connector } = createConnector();
    const direct = fakeSession('direct');
    vi.mocked(connector.connect).mockResolvedValue(direct);
    const manager = new SessionManager(connector);

    await manager.ensure(options('/project/a', { explicitEndpoint: 'ws://127.0.0.1:9000' }));
    await manager.disconnect();
    await manager.ensure(options('/project/a'));

    // 显式端点连上的窗口来源不明，disconnect 后只能重新 launch，不能直连旧 explicit 地址
    expect(connector.connect).toHaveBeenCalledTimes(1);
    expect(connector.launch).toHaveBeenCalledTimes(1);
  });

  it('invalidates a launch that completes after disconnect', async () => {
    const { connector } = createConnector();
    let resolveLaunch!: (connection: ManagedConnection) => void;
    vi.mocked(connector.launch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLaunch = resolve;
        }),
    );
    const manager = new SessionManager(connector);
    const pending = manager.ensure(options('/project/a'));
    await vi.waitFor(() => expect(connector.launch).toHaveBeenCalled());

    await manager.disconnect();
    const lateInstance = fakeSession('late');
    resolveLaunch({ instance: lateInstance, endpoint: 'ws://127.0.0.1:9420' });

    await expect(pending).rejects.toThrow('连接过程中已被断开');
    expect(lateInstance.disconnect).toHaveBeenCalled();
    expect(manager.currentSession()).toEqual({ connected: false, projectPath: '' });
  });

  it('does not launch after disconnect interrupts a failed reconnect', async () => {
    const { connector } = createConnector();
    const manager = new SessionManager(connector);
    await manager.ensure(options('/project/a'));
    await manager.disconnect();

    let finishReconnect!: (instance: ManagedInstance | null) => void;
    vi.mocked(connector.connect).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishReconnect = resolve;
        }),
    );
    const pending = manager.ensure(options('/project/a'));
    await vi.waitFor(() => expect(connector.connect).toHaveBeenCalled());
    await manager.disconnect();
    finishReconnect(null);

    await expect(pending).rejects.toThrow('连接过程中已被断开');
    expect(connector.launch).toHaveBeenCalledTimes(1);
  });

  it('drops the active session when the underlying transport closes', async () => {
    const { connector, closeListeners } = createConnector();
    const manager = new SessionManager(connector);
    const instance = await manager.ensure(options('/project/a'));

    closeListeners.get(instance)?.();

    expect(manager.currentSession()).toEqual({ connected: false, projectPath: '' });
    const reconnected = fakeSession('reconnected');
    vi.mocked(connector.connect).mockResolvedValue(reconnected);
    expect(await manager.ensure(options('/project/a'))).toBe(reconnected);
  });
});
