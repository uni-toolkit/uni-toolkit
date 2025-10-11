import {
  getOutputJsonPath,
  isMiniProgram,
  isString,
} from "@uni_toolkit/shared";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import { parseJson } from "@dcloudio/uni-cli-shared";
import path from "path";
import fs from "fs";
import { Compiler, sources, Compilation, Module } from "webpack";

export interface ComponentConfigPluginOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export class WebpackComponentConfigPlugin {
  private map: Map<string, Record<string, unknown>> = new Map();
  private filter: (id: string) => boolean;

  constructor(options: ComponentConfigPluginOptions = {}) {
    this.filter = createFilter(
      options.include || ["**/*.{vue,nvue,uvue}"],
      options.exclude
    );
  }

  apply(compiler: Compiler) {
    if (!isMiniProgram()) {
      return;
    }

    // 处理模块转换
    compiler.hooks.compilation.tap(
      "WebpackComponentConfigPlugin",
      (compilation) => {
        compilation.hooks.succeedModule.tap(
          "WebpackComponentConfigPlugin",
          (module) => {
            this.transformModule(module, compilation);
          }
        );
      }
    );

    // 在输出完成后处理 JSON 文件
    compiler.hooks.afterEmit.tap("WebpackComponentConfigPlugin", () => {
      this.closeBundle();
    });
  }

  private transformModule(module: Module, compilation: Compilation) {
    const resource = (module as Module & { resource?: string }).resource;
    if (!resource || !this.filter(resource)) {
      return;
    }

    const originalSource = (
      module as Module & { originalSource?: { source(): string } }
    ).originalSource;
    const source = originalSource?.source();
    if (!source || !isString(source)) {
      return;
    }

    const matches = source.match(
      /<component-config>([\s\S]*?)<\/component-config>/g
    );

    if (!matches) {
      return;
    }

    matches.forEach((match) => {
      const content = match.replace(
        /<component-config>|<\/component-config>/g,
        ""
      );

      try {
        const componentConfig = parseJson(
          content.toString(),
          true,
          path.basename(resource)
        );
        this.map.set(getOutputJsonPath(resource), componentConfig);
      } catch (error) {
        compilation.warnings.push(
          new Error(`Parse component-config failed in ${resource}: ${error}`)
        );
      }
    });

    // 移除 component-config 标签
    const newSource = source.replace(
      /<component-config>[\s\S]*?<\/component-config>/g,
      ""
    );

    // 更新模块源码
    const moduleWithSource = module as Module & {
      originalSource?: { source(): string };
      _source?: sources.Source;
    };
    moduleWithSource._source = new sources.RawSource(newSource);
  }

  private closeBundle() {
    if (this.map.size === 0) {
      return;
    }

    for (const [outputPath, config] of this.map) {
      if (!fs.existsSync(outputPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(outputPath, "utf-8");
        const json = JSON.parse(content);
        fs.writeFileSync(
          outputPath,
          JSON.stringify(Object.assign({}, json, config), null, 2)
        );
      } catch (error) {
        console.warn(`Failed to process ${outputPath}:`, error);
      }
    }
  }
}

export default WebpackComponentConfigPlugin;
