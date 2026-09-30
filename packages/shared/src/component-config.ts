const COMPONENT_CONFIG_PATTERN = /<component-config>([\s\S]*?)<\/component-config>/g;
const COMPONENT_CONFIG_TAG_PATTERN = /<component-config>|<\/component-config>/g;

export function matchComponentConfigs(code: string) {
  return code.match(COMPONENT_CONFIG_PATTERN);
}

export function removeComponentConfigTags(match: string) {
  return match.replace(COMPONENT_CONFIG_TAG_PATTERN, '');
}

export function removeComponentConfigs(code: string) {
  return code.replace(COMPONENT_CONFIG_PATTERN, '');
}
