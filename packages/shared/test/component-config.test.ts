import { describe, expect, it } from 'vitest';
import { matchComponentConfigs, removeComponentConfigs, removeComponentConfigTags } from '../src/component-config';

describe('matchComponentConfigs', () => {
  it.each([
    ['<component-config>{"x":1}</component-config>', ['<component-config>{"x":1}</component-config>']],
    [
      '<component-config>\n  {"usingComponents":{"button":"/components/button"}}\n</component-config>',
      ['<component-config>\n  {"usingComponents":{"button":"/components/button"}}\n</component-config>'],
    ],
    ['<component-config></component-config>', ['<component-config></component-config>']],
  ])('matches a complete component-config block: %s', (code, expected) => {
    expect(matchComponentConfigs(code)).toEqual(expected);
  });

  it('returns null when there is no complete component-config block', () => {
    expect(matchComponentConfigs('<template />')).toBeNull();
  });

  it.each([
    '<component-config>{"x":1}',
    '{"x":1}</component-config>',
    '<Component-config>{"x":1}</component-config>',
    '<component-config data-test>{"x":1}</component-config>',
  ])('ignores an invalid component-config block: %s', (code) => {
    expect(matchComponentConfigs(code)).toBeNull();
  });

  it('does not consume content after the first closing tag', () => {
    const code = '<component-config>{"x":1}</component-config><template />';

    expect(matchComponentConfigs(code)).toEqual(['<component-config>{"x":1}</component-config>']);
  });
});

describe('removeComponentConfigTags', () => {
  it.each([
    ['<component-config>{"x":1}</component-config>', '{"x":1}'],
    ['<component-config>\n  {"x":1}\n</component-config>', '\n  {"x":1}\n'],
  ])('removes tags from a complete match: %s', (match, expected) => {
    expect(removeComponentConfigTags(match)).toBe(expected);
  });

  it('keeps the legacy replacement behavior for tag text in the match', () => {
    const match = '<component-config>{"text":"<component-config>"}</component-config>';

    expect(removeComponentConfigTags(match)).toBe('{"text":""}');
  });
});

describe('removeComponentConfigs', () => {
  it.each([
    [
      '<template>before</template><component-config>{"x":1}</component-config>after',
      '<template>before</template>after',
    ],
    ['before\n<component-config>\n  {"x":1}\n</component-config>\nafter', 'before\n\nafter'],
  ])('removes the component-config block and keeps surrounding code: %s', (code, expected) => {
    expect(removeComponentConfigs(code)).toBe(expected);
  });

  it.each([
    '<template />',
    '<component-config>{"x":1}',
    '{"x":1}</component-config>',
    '<Component-config>{"x":1}</component-config>',
    '<component-config data-test>{"x":1}</component-config>',
  ])('leaves an invalid or absent component-config block unchanged: %s', (code) => {
    expect(removeComponentConfigs(code)).toBe(code);
  });

  it('removes only the complete block when similar text follows it', () => {
    const code = '<component-config>{"x":1}</component-config><component-config';

    expect(removeComponentConfigs(code)).toBe('<component-config');
  });
});
