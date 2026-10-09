import { describe, expect, it, vi } from 'vitest';
import {
  type EnsureSessionOptions,
  type ManagedConnection,
  type SessionConnector,
  SessionManager,
} from '../src/session-manager.js';

interface FakeSession {
  id: string;
}

const options = (projectPath: string, overrides: Partial<EnsureSessionOptions> = {}): EnsureSessionOptions => ({
  projectPath,
  cliPath: '/devtools/cli',
  startPort: 9420,
  ...overrides,
});

function createConnector() {
  let launches = 0;
  const closeListeners = new Map<FakeSession, () => void>();
  const connector: SessionConnector<FakeSession> = {
    connect: vi.fn(async () => null),
    launch: vi.fn(async (projectPath): Promise<ManagedConnection<FakeSession>> => {
      launches++;
      return {
        instance: { id: `${projectPath}-${launches}` },
        endpoint: `ws://127.0.0.1:${9420 + launches}`,
      };
    }),
    disconnect: vi.fn(async () => {}),
    onClose: vi.fn((instance, listener) => closeListeners.set(instance, listener)),
  };
  return { connector, closeListeners };
}

describe('SessionManager', () => {
  it('reuses an active session only for the same project', async () => {
    const { connector } = createConnector();
    const manager = new SessionManager(connector);

    const first = await manager.ensure(options('/project/a'));
    const reused = await manager.ensure(options('/project/a'));
    const switched = await manager.ensure(options('/project/b'));

    expect(reused).toBe(first);
    expect(switched).not.toBe(first);
    expect(connector.launch).toHaveBeenCalledTimes(2);
    expect(connector.disconnect).toHaveBeenCalledWith(first);
    expect(manager.currentSession()).toEqual({ connected: true, projectPath: '/project/b' });
  });

  it('reuses an active or pending session without requiring connection options again', async () => {
    const { connector } = createConnector();
    let resolveLaunch!: (connection: ManagedConnection<FakeSession>) => void;
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
    const instance = { id: 'a' };
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
    const reconnected = { id: 'reconnected-a' };
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
    const direct = { id: 'direct' };
    vi.mocked(connector.connect).mockResolvedValue(direct);
    const manager = new SessionManager(connector);

    const result = await manager.ensure(options('/project/a', { explicitEndpoint: 'ws://127.0.0.1:9000' }));

    expect(result).toBe(direct);
    expect(connector.connect).toHaveBeenCalledWith('ws://127.0.0.1:9000');
    expect(connector.launch).not.toHaveBeenCalled();
  });

  it('invalidates a launch that completes after disconnect', async () => {
    const { connector } = createConnector();
    let resolveLaunch!: (connection: ManagedConnection<FakeSession>) => void;
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
    const lateInstance = { id: 'late' };
    resolveLaunch({ instance: lateInstance, endpoint: 'ws://127.0.0.1:9420' });

    await expect(pending).rejects.toThrow('连接过程中已被断开');
    expect(connector.disconnect).toHaveBeenCalledWith(lateInstance);
    expect(manager.currentSession()).toEqual({ connected: false, projectPath: '' });
  });

  it('does not launch after disconnect interrupts a failed reconnect', async () => {
    const { connector } = createConnector();
    const manager = new SessionManager(connector);
    await manager.ensure(options('/project/a'));
    await manager.disconnect();

    let finishReconnect!: (instance: FakeSession | null) => void;
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

  it('clears a failed active instance without affecting a replacement', async () => {
    const { connector } = createConnector();
    const manager = new SessionManager(connector);
    const failed = await manager.ensure(options('/project/a'));

    manager.invalidate(failed);

    expect(manager.currentSession()).toEqual({ connected: false, projectPath: '' });
    expect(connector.disconnect).toHaveBeenCalledWith(failed);
  });

  it('drops the active session when the underlying transport closes', async () => {
    const { connector, closeListeners } = createConnector();
    const manager = new SessionManager(connector);
    const instance = await manager.ensure(options('/project/a'));

    closeListeners.get(instance)?.();

    expect(manager.currentSession()).toEqual({ connected: false, projectPath: '' });
    const reconnected = { id: 'reconnected' };
    vi.mocked(connector.connect).mockResolvedValue(reconnected);
    expect(await manager.ensure(options('/project/a'))).toBe(reconnected);
  });
});
