import { isPlainObject, merge, omitBy } from 'rattail';

export function resolvePlatformConfig(componentConfig: Record<string, unknown>, platform = process.env.UNI_PLATFORM) {
  const platformConfig = platform ? componentConfig[platform] : undefined;
  return merge(
    omitBy(componentConfig, (_, key) => key.startsWith('mp-')),
    isPlainObject(platformConfig) ? platformConfig : {},
  );
}
