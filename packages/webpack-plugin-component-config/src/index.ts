import { getOutputJsonPath, isMiniProgram } from "@uni_toolkit/shared";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import { parseJson, parseVueRequest } from "@dcloudio/uni-cli-shared";
import path from "path";
import fs from "fs";
import { Compiler, Module } from "webpack";
import { merge } from "lodash-es";

export interface ComponentConfigPluginOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export class WebpackComponentConfigPlugin {
  private map: Map<string, Record<string, unknown>> = new Map();
  private filter: (id: string) => boolean;
  private set: Set<string> = new Set();

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

    compiler.hooks.compilation.tap(
      "WebpackComponentConfigPlugin",
      (compilation) => {
        // 在模块构建完成后处理
        compilation.hooks.succeedModule.tap(
          "WebpackComponentConfigPlugin",
          (module) => {
            this.processModule(module);
          }
        );
      }
    );

    // 在输出完成后处理 JSON 文件
    compiler.hooks.afterEmit.tap("WebpackComponentConfigPlugin", () => {
      this.closeBundle();
    });
  }

  private processModule(module: Module) {
    const resource = (module as Module & { resource?: string }).resource;
    if (!resource) {
      return;
    }
    const { filename } = parseVueRequest(resource);
    if (this.set.has(filename)) {
      return;
    }
    this.set.add(filename);
    if (!this.filter(filename)) {
      return;
    }

    try {
      const content = fs.readFileSync(filename, "utf-8");
      const matches = content.match(
        /<component-config>([\s\S]*?)<\/component-config>/g
      );
      if (!matches) {
        return;
      }

      matches.forEach((match) => {
        const configContent = match.replace(
          /<component-config>|<\/component-config>/g,
          ""
        );
        try {
          const componentConfig = parseJson(
            configContent.toString(),
            true,
            path.basename(resource)
          );

          const outputPath = getOutputJsonPath(resource);
          this.map.set(outputPath, componentConfig);
        } catch (error) {
          console.warn(
            `Failed to parse component-config in ${resource}:`,
            error
          );
        }
      });
    } catch (error) {
      console.warn(`Failed to read file ${resource}:`, error);
    }
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
          JSON.stringify(merge(json, config), null, 2)
        );
      } catch (error) {
        console.warn(`Failed to process ${outputPath}:`, error);
      }
    }
  }
}

export default WebpackComponentConfigPlugin;
