import fs from 'node:fs';
import path from 'node:path';
import { parseJson, parseSubpackagesRootOnce } from '@dcloudio/uni-cli-shared';
import { isMiniProgram } from '@uni_toolkit/shared';
import pc from 'picocolors';
import type { PluginOption } from 'vite';

interface PageEntry {
  path: string;
  packageRoot: string;
  packageName: string;
}

interface OutputJsonRecord {
  jsonRelativePath: string;
  logicalPath: string;
  isComponent: boolean;
  usingComponents: Record<string, string>;
  componentPlaceholder: Record<string, string>;
}

interface ComponentInsightItem {
  component: string;
  componentPackage: string;
  totalUsageCount: number;
  pageUsageCount: number;
  pages: Array<{
    page: string;
    packageName: string;
    usageCount: number;
  }>;
  suggestions: string[];
}

interface ComponentInsightReport {
  summary: {
    pageCount: number;
    componentCount: number;
    reportedComponentCount: number;
  };
  components: ComponentInsightItem[];
}

export interface VitePluginComponentInsightOptions {
  reportMarkdownPath?: string;
  logToConsole?: boolean;
}

const DEFAULT_OPTIONS: Required<VitePluginComponentInsightOptions> = {
  reportMarkdownPath: '',
  logToConsole: true,
};

function normalizeSlashes(value: string) {
  return value.replace(/\\/g, '/');
}

function stripJsonExtension(filePath: string) {
  return filePath.replace(/\.json$/i, '');
}

function resolveOutputPath(outputPath: string) {
  return path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return parseJson(content, true, path.basename(filePath)) as T;
}

function readPages(inputDir: string) {
  const pagesJsonPath = path.join(inputDir, 'pages.json');
  const pagesJson = readJsonFile<{
    pages?: Array<{ path: string }>;
    subPackages?: Array<{ root?: string; pages?: Array<{ path: string }> }>;
    subpackages?: Array<{ root?: string; pages?: Array<{ path: string }> }>;
  }>(pagesJsonPath);
  const platform = process.env.UNI_PLATFORM as Parameters<typeof parseSubpackagesRootOnce>[1];
  const subPackageRoots = parseSubpackagesRootOnce(inputDir, platform).map((root) =>
    normalizeSlashes(root).replace(/^\/+|\/+$/g, ''),
  );

  const pages: PageEntry[] = [];
  for (const page of pagesJson?.pages ?? []) {
    if (!page.path) {
      continue;
    }
    pages.push({
      path: normalizeSlashes(page.path),
      packageRoot: '',
      packageName: 'main',
    });
  }

  const subPackages = [...(pagesJson?.subPackages ?? []), ...(pagesJson?.subpackages ?? [])];
  for (const subPackage of subPackages) {
    const root = normalizeSlashes(subPackage.root ?? '').replace(/^\/+|\/+$/g, '');
    if (!root) {
      continue;
    }

    for (const page of subPackage.pages ?? []) {
      if (!page.path) {
        continue;
      }
      pages.push({
        path: normalizeSlashes(path.posix.join(root, page.path)),
        packageRoot: root,
        packageName: `sub:${root}`,
      });
    }
  }

  return {
    pages,
    subPackageRoots,
  };
}

function listJsonFiles(dirPath: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      listJsonFiles(absolutePath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function resolveUsingComponentPath(currentJsonRelativePath: string, componentRef: string, outputDir: string) {
  if (!componentRef || /^(plugin|ext):\/\//.test(componentRef)) {
    return null;
  }

  const cleanRef = componentRef.replace(/\.(json|vue|nvue|uvue)$/i, '');
  const resolvedAbsolutePath = cleanRef.startsWith('/')
    ? path.join(outputDir, cleanRef.slice(1))
    : path.resolve(path.dirname(path.join(outputDir, currentJsonRelativePath)), cleanRef);

  return normalizeSlashes(path.relative(outputDir, `${resolvedAbsolutePath}.json`));
}

function detectPackageName(filePath: string, subPackageRoots: string[]) {
  const normalized = normalizeSlashes(filePath);
  let matchedRoot = '';
  let matchedPackageName = 'main';

  for (const root of subPackageRoots) {
    if (!root) {
      continue;
    }
    const rootWithSlash = `${root}/`;
    if (normalized.startsWith(rootWithSlash) && root.length > matchedRoot.length) {
      matchedRoot = root;
      matchedPackageName = `sub:${root}`;
    }
  }

  return matchedPackageName;
}

function buildMarkdown(report: ComponentInsightReport) {
  const hasSuggestions = report.components.some((item) => item.suggestions.length > 0);
  const lines: string[] = [
    '# 组件分析报告',
    '',
    `- 页面数量：${report.summary.pageCount}`,
    `- 组件数量：${report.summary.componentCount}`,
    `- 已分析组件数：${report.summary.reportedComponentCount}`,
    '',
  ];

  if (!hasSuggestions) {
    lines.push('## 总体评价');
    lines.push('');
    lines.push('- 当前项目组件配置良好，暂未发现需要关注的优化建议 🎉');
    lines.push('');
  }

  for (const item of report.components) {
    lines.push(`## ${item.component}`);
    lines.push('');
    lines.push(`- 所属包：${item.componentPackage}`);
    lines.push(`- 总使用次数：${item.totalUsageCount}`);
    lines.push(`- 使用页面数：${item.pageUsageCount}`);
    lines.push('');
    lines.push('| 页面 | 包 | 使用次数 |');
    lines.push('| --- | --- | --- |');
    for (const page of item.pages) {
      lines.push(`| ${page.page} | ${page.packageName} | ${page.usageCount} |`);
    }
    lines.push('');
    if (item.suggestions.length > 0) {
      lines.push('### 提示');
      lines.push('');
      for (const suggestion of item.suggestions) {
        lines.push(`- ${suggestion}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function logSummary(report: ComponentInsightReport) {
  const summaryLines = [
    pc.bold(pc.green('[vite-plugin-component-insight] 分析完成')),
    `页面数: ${pc.cyan(String(report.summary.pageCount))}`,
    `组件数: ${pc.cyan(String(report.summary.componentCount))}`,
    `已分析: ${pc.cyan(String(report.summary.reportedComponentCount))}`,
  ];
  console.info(summaryLines.join(' | '));

  const suggestionItems = report.components.filter((item) => item.suggestions.length > 0);
  if (suggestionItems.length === 0) {
    console.info(pc.green('当前项目组件配置良好，未发现需要关注的优化建议 🎉'));
    return;
  }

  for (const item of suggestionItems) {
    const packageNames = Array.from(new Set(item.pages.map((page) => page.packageName))).join(', ');
    console.info('');
    console.info(pc.bold(pc.blue(`组件：${item.component}`)));
    console.info(
      `${pc.dim('所属包：')}${item.componentPackage}  ${pc.dim('使用次数：')}${item.totalUsageCount}  ${pc.dim('涉及包：')}${packageNames}`,
    );
    for (const suggestion of item.suggestions) {
      console.info(`${pc.yellow('建议：')}${suggestion}`);
    }
  }
}

export default function vitePluginComponentInsight(options: VitePluginComponentInsightOptions = {}): PluginOption {
  const resolvedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const reportMarkdownPath = resolvedOptions.reportMarkdownPath
    ? resolveOutputPath(resolvedOptions.reportMarkdownPath)
    : '';

  return {
    name: 'vite-plugin-component-insight',
    apply: 'build',
    closeBundle() {
      if (!isMiniProgram()) {
        return;
      }

      const inputDir = process.env.UNI_INPUT_DIR;
      const outputDir = process.env.UNI_OUTPUT_DIR;
      if (!inputDir || !outputDir || !fs.existsSync(outputDir)) {
        return;
      }

      const { pages, subPackageRoots } = readPages(inputDir);
      const pagePathMap = new Map(pages.map((page) => [page.path, page]));
      const jsonFiles = listJsonFiles(outputDir);
      const outputJsonMap = new Map<string, OutputJsonRecord>();

      for (const jsonFile of jsonFiles) {
        const jsonRelativePath = normalizeSlashes(path.relative(outputDir, jsonFile));
        const jsonContent = readJsonFile<{
          component?: boolean;
          usingComponents?: Record<string, string>;
          componentPlaceholder?: Record<string, string>;
        }>(jsonFile);

        if (!jsonContent) {
          continue;
        }

        outputJsonMap.set(jsonRelativePath, {
          jsonRelativePath,
          logicalPath: stripJsonExtension(jsonRelativePath),
          isComponent: jsonContent.component === true,
          usingComponents: jsonContent.usingComponents ?? {},
          componentPlaceholder: jsonContent.componentPlaceholder ?? {},
        });
      }

      const directUsageGraph = new Map<string, Map<string, number>>();
      const asyncPlaceholderPackagesMap = new Map<string, Set<string>>();
      for (const record of outputJsonMap.values()) {
        const directUsage = new Map<string, number>();
        const ownerPackage = detectPackageName(record.logicalPath, subPackageRoots);

        for (const [componentName, componentRef] of Object.entries(record.usingComponents)) {
          const childJsonRelativePath = resolveUsingComponentPath(record.jsonRelativePath, componentRef, outputDir);
          if (!childJsonRelativePath) {
            continue;
          }
          const childRecord = outputJsonMap.get(childJsonRelativePath);
          if (!childRecord?.isComponent) {
            continue;
          }
          directUsage.set(childRecord.logicalPath, (directUsage.get(childRecord.logicalPath) ?? 0) + 1);

          if (record.componentPlaceholder[componentName]) {
            const packages = asyncPlaceholderPackagesMap.get(childRecord.logicalPath) ?? new Set<string>();
            packages.add(ownerPackage);
            asyncPlaceholderPackagesMap.set(childRecord.logicalPath, packages);
          }
        }

        directUsageGraph.set(record.logicalPath, directUsage);
      }

      const aggregateCache = new Map<string, Map<string, number>>();
      const visiting = new Set<string>();

      const resolveAggregateUsage = (logicalPath: string): Map<string, number> => {
        const cached = aggregateCache.get(logicalPath);
        if (cached) {
          return cached;
        }
        if (visiting.has(logicalPath)) {
          return new Map();
        }

        visiting.add(logicalPath);
        const aggregate = new Map<string, number>();
        const directUsage = directUsageGraph.get(logicalPath) ?? new Map<string, number>();

        for (const [childPath, directCount] of directUsage) {
          aggregate.set(childPath, (aggregate.get(childPath) ?? 0) + directCount);
          const childAggregate = resolveAggregateUsage(childPath);
          for (const [descendantPath, descendantCount] of childAggregate) {
            aggregate.set(descendantPath, (aggregate.get(descendantPath) ?? 0) + directCount * descendantCount);
          }
        }

        visiting.delete(logicalPath);
        aggregateCache.set(logicalPath, aggregate);
        return aggregate;
      };

      const pageUsageMap = new Map<string, Map<string, number>>();
      for (const page of pages) {
        const pageRecord = outputJsonMap.get(`${page.path}.json`);
        if (!pageRecord) {
          continue;
        }
        pageUsageMap.set(page.path, resolveAggregateUsage(pageRecord.logicalPath));
      }

      const componentUsageMap = new Map<string, Map<string, number>>();
      for (const [pagePath, componentUsage] of pageUsageMap) {
        for (const [componentPath, count] of componentUsage) {
          let pageUsage = componentUsageMap.get(componentPath);
          if (!pageUsage) {
            pageUsage = new Map();
            componentUsageMap.set(componentPath, pageUsage);
          }
          pageUsage.set(pagePath, (pageUsage.get(pagePath) ?? 0) + count);
        }
      }

      const componentItems: ComponentInsightItem[] = [];
      for (const [componentPath, pageUsage] of componentUsageMap) {
        const pagesForComponent = Array.from(pageUsage.entries())
          .map(([pagePath, usageCount]) => ({
            page: pagePath,
            packageName: pagePathMap.get(pagePath)?.packageName ?? 'main',
            usageCount,
          }))
          .sort((left, right) => right.usageCount - left.usageCount || left.page.localeCompare(right.page));

        const totalUsageCount = pagesForComponent.reduce((sum, page) => sum + page.usageCount, 0);
        const involvedPackages = Array.from(new Set(pagesForComponent.map((page) => page.packageName)));
        const componentPackage = detectPackageName(componentPath, subPackageRoots);
        const suggestions: string[] = [];
        const onlyUsedInOnePackage = involvedPackages.length === 1;
        const singlePackageName = involvedPackages[0];
        const usedByMainAndSubPackages = involvedPackages.includes('main') && involvedPackages.length > 1;
        const usedByMultipleSubPackages = !involvedPackages.includes('main') && involvedPackages.length > 1;
        const asyncPlaceholderPackages = asyncPlaceholderPackagesMap.get(componentPath) ?? new Set<string>();
        // Cross-package usage is already valid when every external package reaches the component through placeholders.
        const crossPackageUsageCoveredByAsyncPlaceholder =
          componentPackage !== 'main' &&
          involvedPackages.length > 0 &&
          involvedPackages
            .filter((packageName) => packageName !== componentPackage)
            .every((packageName) => asyncPlaceholderPackages.has(packageName));
        const coveredBySingleAsyncPlaceholder =
          onlyUsedInOnePackage &&
          componentPackage !== singlePackageName &&
          asyncPlaceholderPackages.has(singlePackageName);
        const coveredByAsyncPlaceholder =
          usedByMultipleSubPackages &&
          involvedPackages.every((packageName) => asyncPlaceholderPackages.has(packageName));
        const noNeedSuggestion =
          (onlyUsedInOnePackage && componentPackage === singlePackageName) ||
          (usedByMainAndSubPackages && componentPackage !== 'main') ||
          crossPackageUsageCoveredByAsyncPlaceholder ||
          coveredBySingleAsyncPlaceholder ||
          coveredByAsyncPlaceholder;

        if (noNeedSuggestion) {
          componentItems.push({
            component: componentPath,
            componentPackage,
            totalUsageCount,
            pageUsageCount: pagesForComponent.length,
            pages: pagesForComponent,
            suggestions,
          });
          continue;
        }

        if (onlyUsedInOnePackage && singlePackageName?.startsWith('sub:') && componentPackage === 'main') {
          suggestions.push(`该组件仅在 ${singlePackageName} 使用，建议考虑移动到对应分包。`);
        }

        if (usedByMultipleSubPackages && componentPackage === 'main') {
          suggestions.push('该组件被多个分包使用，建议移动到分包并配置 componentPlaceholder 异步化。');
        }

        if (usedByMainAndSubPackages && componentPackage === 'main') {
          suggestions.push('该组件同时被主包和分包使用，可考虑通过配置 componentPlaceholder 异步化的方式移动到分包。');
        }

        componentItems.push({
          component: componentPath,
          componentPackage,
          totalUsageCount,
          pageUsageCount: pagesForComponent.length,
          pages: pagesForComponent,
          suggestions,
        });
      }

      componentItems.sort(
        (left, right) =>
          right.totalUsageCount - left.totalUsageCount ||
          right.pageUsageCount - left.pageUsageCount ||
          left.component.localeCompare(right.component),
      );

      const report: ComponentInsightReport = {
        summary: {
          pageCount: pageUsageMap.size,
          componentCount: Array.from(outputJsonMap.values()).filter((item) => item.isComponent).length,
          reportedComponentCount: componentItems.length,
        },
        components: componentItems,
      };

      if (reportMarkdownPath) {
        ensureParentDir(reportMarkdownPath);
        fs.writeFileSync(reportMarkdownPath, `${buildMarkdown(report)}\n`, 'utf-8');
      }

      if (resolvedOptions.logToConsole) {
        logSummary(report);
      }
    },
  };
}
