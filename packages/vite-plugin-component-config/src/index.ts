import { getOutputJsonPath, isMiniProgram } from "@uni_toolkit/shared";
import { type PluginOption } from "vite";
import { createFilter, type FilterPattern } from "@rollup/pluginutils";
import path from "path";
import fs from "fs";
import { parseJson } from "@dcloudio/uni-cli-shared";

export interface ComponentConfigPluginOptions {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

export default function vitePluginComponentConfig(
  options: ComponentConfigPluginOptions = {
    include: ["**/*.{vue,nvue,uvue}"],
    exclude: [],
  }
): PluginOption {
  const map: Map<string, Record<string, any>> = new Map();
  return {
    name: "vite-plugin-component-config",
    enforce: "pre",
    transform(code, id) {
      if (!isMiniProgram()) {
        return;
      }
      if (!createFilter(options.include, options.exclude)(id)) {
        return;
      }
      const matches = code.match(
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
        const componentConfig = parseJson(
          content.toString(),
          true,
          path.basename(id)
        );
        map.set(getOutputJsonPath(id), componentConfig);
      });

      return code.replace(
        /<component-config>[\s\S]*?<\/component-config>/g,
        ""
      );
    },
    closeBundle() {
      if (map.size === 0) {
        return;
      }
      for (const [outputPath, config] of map) {
        if (!fs.existsSync(outputPath)) {
          continue;
        }
        const content = fs.readFileSync(outputPath, "utf-8");
        const json = JSON.parse(content);
        fs.writeFileSync(
          outputPath,
          JSON.stringify(Object.assign({}, json, config), null, 2)
        );
      }
    },
  };
}
