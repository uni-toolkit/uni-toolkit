import type { FilterPattern } from '@rollup/pluginutils';

export interface Options {
  includes?: FilterPattern;
  excludes?: FilterPattern;
}
