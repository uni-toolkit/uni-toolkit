import type { ProjectAnalysis } from './core';

interface RuntimeKeyInfo {
  key: string;
  label: string;
  kind: string;
  confidence: string;
}

type RuntimeMap = Record<string, RuntimeKeyInfo[]>;

function toRuntimeMap(result: ProjectAnalysis): RuntimeMap {
  const runtimeMap: RuntimeMap = {};
  for (const page of Object.values(result.pages)) {
    runtimeMap[page.page] = page.keys.map((item) => ({
      key: item.key,
      label: item.sourceName || item.generatedName || item.expressionSummary || 'unknown',
      kind: item.kind,
      confidence: item.confidence,
    }));
  }
  return runtimeMap;
}

export function renderRuntimeSnippet(result: ProjectAnalysis): string {
  const json = JSON.stringify(toRuntimeMap(result), null, 2);
  return `(function () {
  var KEYMAP = ${json};
  var globalObject = typeof globalThis !== "undefined" ? globalThis : typeof wx !== "undefined" ? wx : this;
  var watchTimer = null;
  var lastSnapshotText = "";

  function getPagesSafe() {
    try {
      return typeof getCurrentPages === "function" ? getCurrentPages() : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeRoute(route) {
    return route && route.charAt(0) === "/" ? route.slice(1) : route;
  }

  function findPage(route) {
    var pages = getPagesSafe();
    if (!route) return pages[pages.length - 1] || null;
    var normalized = normalizeRoute(route);
    for (var index = pages.length - 1; index >= 0; index -= 1) {
      var page = pages[index];
      if (normalizeRoute(page.route || page.__route__) === normalized) return page;
    }
    return null;
  }

  function routeOf(page) {
    return normalizeRoute(page && (page.route || page.__route__)) || "";
  }

  function snapshot(route) {
    var page = findPage(route);
    if (!page) return { route: route || "current", error: "No active page found." };

    var routeName = routeOf(page);
    var entries = KEYMAP[routeName] || [];
    var data = page.data || {};
    return {
      route: routeName,
      values: entries.map(function (item) {
        return {
          key: item.key,
          label: item.label,
          value: data[item.key],
          kind: item.kind,
          confidence: item.confidence
        };
      })
    };
  }

  function table(route) {
    var snap = snapshot(route);
    if (snap.error) {
      console.warn("[uniappx-keymap] " + snap.error);
      return snap;
    }
    if (typeof console.table === "function") console.table(snap.values);
    else console.log("[uniappx-keymap]", snap.values);
    return snap;
  }

  function watch(route, interval) {
    unwatch();
    var delay = typeof interval === "number" && interval > 0 ? interval : 500;
    lastSnapshotText = "";
    watchTimer = setInterval(function () {
      var snap = snapshot(route);
      var text = JSON.stringify(snap);
      if (text !== lastSnapshotText) {
        lastSnapshotText = text;
        console.log("[uniappx-keymap] runtime values changed:", snap.route);
        if (!snap.error) table(route);
        else console.warn("[uniappx-keymap] " + snap.error);
      }
    }, delay);
    console.log("[uniappx-keymap] watching runtime values every " + delay + "ms. Call __UNIAPPX_KEYMAP__.unwatch() to stop.");
  }

  function unwatch() {
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = null;
  }

  globalObject.__UNIAPPX_KEYMAP__ = {
    keymap: KEYMAP,
    snapshot: snapshot,
    table: table,
    watch: watch,
    unwatch: unwatch
  };

  console.log("[uniappx-keymap] console snippet ready. Try __UNIAPPX_KEYMAP__.table() or __UNIAPPX_KEYMAP__.watch().");
})();
`;
}
