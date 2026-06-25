import type { Plugin, UserConfig } from 'vite';

type HookName = 'load' | 'transform' | 'renderChunk';
type HookFn = (this: unknown, ...args: unknown[]) => unknown;
type HookObject = {
  handler: HookFn;
};

const PLUGIN_NAME = 'kill-plugin-sourcemaps';
const HOOK_NAMES: HookName[] = ['load', 'transform', 'renderChunk'];

export function killPluginSourcemaps(): Plugin {
  forceDisableSourcemap();

  return {
    name: PLUGIN_NAME,
    enforce: 'pre',
    config() {
      forceDisableSourcemap();

      return {
        build: {
          sourcemap: false,
          rollupOptions: {
            output: {
              sourcemap: false,
              sourcemapExcludeSources: true,
            },
          },
        },
        css: {
          devSourcemap: false,
        },
        esbuild: {
          sourcemap: false,
        },
      };
    },
    configResolved(config: UserConfig) {
      forceDisableSourcemap();

      for (const plugin of config.plugins!) {
        if (plugin!.name === PLUGIN_NAME) {
          continue;
        }

        const mutablePlugin = plugin as unknown as Record<HookName, unknown>;

        for (const hookName of HOOK_NAMES) {
          const wrappedHook = wrapHook(mutablePlugin[hookName]);

          if (wrappedHook) {
            mutablePlugin[hookName] = wrappedHook;
          }
        }
      }
    },
    outputOptions(options) {
      forceDisableSourcemap();

      return {
        ...options,
        sourcemap: false,
        sourcemapExcludeSources: true,
      };
    },
  };
}

export default killPluginSourcemaps;

function forceDisableSourcemap(): void {
  process.env.UNI_APP_SOURCEMAP = 'false';
  process.env.GENERATE_SOURCEMAP = 'false';
}

function wrapHook(hook: unknown): unknown {
  if (typeof hook === 'function') {
    return function wrappedHook(this: unknown, ...args: unknown[]) {
      return runWithoutSourcemap(hook as HookFn, this, args);
    };
  }

  if (isHookObject(hook)) {
    const original = hook.handler;

    hook.handler = function wrappedHook(this: unknown, ...args: unknown[]) {
      return runWithoutSourcemap(original, this, args);
    };

    return hook;
  }
}

function isHookObject(hook: unknown): hook is HookObject {
  if (typeof hook !== 'object' || hook === null || !('handler' in hook)) {
    return false;
  }

  return typeof (hook as { handler?: unknown }).handler === 'function';
}

function runWithoutSourcemap(fn: HookFn, ctx: unknown, args: unknown[]): unknown {
  const noMapCtx = createNoMapContext(ctx);
  const result = fn.apply(noMapCtx, args);

  if (isPromiseLike(result)) {
    return result.then(stripMap);
  }

  return stripMap(result);
}

function createNoMapContext<T>(ctx: T): T {
  if (typeof ctx !== 'object' || ctx === null) {
    return ctx;
  }

  return new Proxy(ctx, {
    get(target, key, receiver) {
      if (key === 'getCombinedSourcemap') {
        return () => null;
      }

      const value = Reflect.get(target, key, receiver);

      if (typeof value === 'function') {
        return value.bind(target);
      }

      return value;
    },
  });
}

function stripMap(result: unknown): unknown {
  if (!result) {
    return result;
  }

  if (typeof result === 'object' && 'map' in result) {
    return {
      ...result,
      map: null,
    };
  }

  return result;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}
