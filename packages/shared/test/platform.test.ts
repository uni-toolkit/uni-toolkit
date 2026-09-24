import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePlatformConfig } from '../src/platform';

describe('resolvePlatformConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const componentConfig = JSON.parse(`{
    "x": 1,
    "mp-weixin": { "y": 2 },
    "mp-alipay": { "z": 3 }
  }`);

  it.each([
    ['mp-weixin', { x: 1, y: 2 }],
    ['mp-alipay', { x: 1, z: 3 }],
    ['mp-toutiao', { x: 1 }],
  ])('keeps common config and selects %s config', (platform, expected) => {
    expect(resolvePlatformConfig(componentConfig, platform)).toEqual(expected);
  });

  it('uses UNI_PLATFORM by default', () => {
    vi.stubEnv('UNI_PLATFORM', 'mp-weixin');

    expect(resolvePlatformConfig(componentConfig)).toEqual({ x: 1, y: 2 });
  });

  it('deeply merges platform config and lets it override common values', () => {
    const config = JSON.parse(`{
      "usingComponents": {
        "common": "/components/common",
        "shared": "/components/shared"
      },
      "mp-weixin": {
        "usingComponents": {
          "shared": "/components/weixin-shared",
          "weixin": "/components/weixin"
        }
      }
    }`);

    expect(resolvePlatformConfig(config, 'mp-weixin')).toEqual({
      usingComponents: {
        common: '/components/common',
        shared: '/components/weixin-shared',
        weixin: '/components/weixin',
      },
    });
  });

  it.each([null, 'invalid', ['invalid']])('ignores a non-object platform config: %j', (platformConfig) => {
    const config = JSON.parse(`{"x":1,"mp-weixin":${JSON.stringify(platformConfig)}}`);
    expect(resolvePlatformConfig(config, 'mp-weixin')).toEqual({ x: 1 });
  });
});
