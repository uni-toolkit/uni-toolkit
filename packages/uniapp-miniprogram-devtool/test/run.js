'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { analyzeProject } = require('../dist/core.cjs');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'uniappx-keymap-'));
const pageDir = path.join(temp, 'pages/index');
const mapDir = path.join(temp, '.sourcemap/mp-weixin/pages/index');
const legacyPageDir = path.join(temp, 'pages/legacy');
const legacyMapDir = path.join(temp, '.sourcemap/mp-weixin/pages/legacy');
const directPageDir = path.join(temp, 'pages/direct');
const directMapDir = path.join(temp, '.sourcemap/mp-weixin/pages/direct');
fs.mkdirSync(pageDir, { recursive: true });
fs.mkdirSync(mapDir, { recursive: true });
fs.mkdirSync(legacyPageDir, { recursive: true });
fs.mkdirSync(legacyMapDir, { recursive: true });
fs.mkdirSync(directPageDir, { recursive: true });
fs.mkdirSync(directMapDir, { recursive: true });

fs.writeFileSync(path.join(pageDir, 'box.js'), `"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = common_vendor.defineComponent({
  setup(__props) {
    const message = common_vendor.ref("测试");
    function handleClick() {}
    return (_ctx, _cache) => {
      const __returned__ = {
        a: common_vendor.t(common_vendor.unref(message)),
        b: common_vendor.sei(common_vendor.gei(_ctx, ""), "view"),
        c: \`${'${_ctx.u_s_b_h}'}px\`,
        d: \`${'${_ctx.u_s_a_i_b}'}px\`,
        e: common_vendor.pvhc(_ctx.$scope.data.virtualHostClass),
        f: common_vendor.o(handleClick, "7c")
      };
      return __returned__;
    };
  }
});
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/box.js.map
`);
fs.writeFileSync(path.join(pageDir, 'box.wxml'), `<view style="{{'--status-bar-height:' + c}}">{{a}}</view>`);
fs.writeFileSync(path.join(mapDir, 'box.js.map'), JSON.stringify({
  version: 3,
  file: 'box.js',
  sources: ['pages/index/box.uvue'],
  sourcesContent: ['<template><view>{{ message }}</view></template>'],
  names: [],
  mappings: ''
}));

fs.writeFileSync(path.join(legacyPageDir, 'index.js'), `"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      title: "Hello"
    };
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_assets._imports_0,
    b: common_vendor.t($data.title)
  };
}
const MiniProgramPage = common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
my.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/legacy/index.js.map
`);
fs.writeFileSync(path.join(legacyPageDir, 'index.wxml'), `<view><image src="{{a}}"></image><text>{{b}}</text></view>`);
fs.writeFileSync(path.join(legacyMapDir, 'index.js.map'), JSON.stringify({
  version: 3,
  file: 'index.js',
  sources: ['pages/legacy/index.vue'],
  sourcesContent: ['<template><text>{{ title }}</text></template>'],
  names: [],
  mappings: ''
}));

fs.writeFileSync(path.join(directPageDir, 'index.js'), `"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  __name: "index",
  setup(__props) {
    const message = common_vendor.ref("测试");
    const count = common_vendor.ref(1);
    const key = common_vendor.ref("abc");
    function handleClick() {
      count.value += 1;
    }
    function goDetail() {
      common_vendor.index.navigateTo({
        url: "/pages/detail/detail"
      });
    }
    return (_ctx, _cache) => {
      return {
        a: common_vendor.t(message.value),
        b: common_vendor.t(count.value),
        c: common_vendor.t(key.value),
        d: common_vendor.o(handleClick, "14"),
        e: common_vendor.o(goDetail, "37")
      };
    };
  }
};
wx.createPage(_sfc_main);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/direct/index.js.map
`);
fs.writeFileSync(path.join(directPageDir, 'index.wxml'), `<view>{{a}} {{b}} {{c}}</view>`);
fs.writeFileSync(path.join(directMapDir, 'index.js.map'), JSON.stringify({
  version: 3,
  file: 'index.js',
  sources: ['pages/direct/index.vue'],
  sourcesContent: ['<template><view>{{ message }} {{ count }} {{ key }}</view></template>'],
  names: [],
  mappings: ''
}));

const result = analyzeProject(temp);
const page = result.pages['pages/index/box'];
const legacyPage = result.pages['pages/legacy/index'];
const directPage = result.pages['pages/direct/index'];
assert(page, 'page should be detected');
assert(legacyPage, 'legacy render page should be detected');
assert(directPage, 'direct setup render page should be detected');
assert.strictEqual(page.keys.find((item) => item.key === 'a').sourceName, 'message');
assert.strictEqual(page.keys.find((item) => item.key === 'a').confidence, 'high');
assert.strictEqual(page.keys.find((item) => item.key === 'b').kind, 'element-id');
assert.strictEqual(page.keys.find((item) => item.key === 'c').kind, 'css-var');
assert.strictEqual(page.keys.find((item) => item.key === 'f').sourceName, 'handleClick');
assert.strictEqual(page.keys.find((item) => item.key === 'f').kind, 'event-handler');
assert(page.keys.find((item) => item.key === 'a').wxmlUsages.length > 0, 'wxml usage should be detected');
assert(page.templateTree, 'template tree should be generated');
assert.strictEqual(page.templateTree.children[0].tag, 'view');
assert(page.templateTree.children[0].children.some((node) => node.tag === '#text' && node.keyRefs.includes('a')), 'text binding should appear in template tree');
assert.strictEqual(legacyPage.wxmlFile, 'pages/legacy/index.wxml');
assert.strictEqual(legacyPage.keys.find((item) => item.key === 'a').kind, 'static-asset');
assert.strictEqual(legacyPage.keys.find((item) => item.key === 'b').sourceName, 'title');
assert.strictEqual(legacyPage.keys.find((item) => item.key === 'b').confidence, 'high');
assert(legacyPage.keys.find((item) => item.key === 'b').wxmlUsages.length > 0, 'legacy wxml usage should be detected');
assert(legacyPage.templateTree.children[0].children.some((node) => node.tag === 'image' && node.keyRefs.includes('a')), 'attribute binding should appear in template tree');
assert.strictEqual(directPage.keys.find((item) => item.key === 'a').sourceName, 'message');
assert.strictEqual(directPage.keys.find((item) => item.key === 'a').confidence, 'high');
assert.strictEqual(directPage.keys.find((item) => item.key === 'b').sourceName, 'count');
assert.strictEqual(directPage.keys.find((item) => item.key === 'c').sourceName, 'key');
assert.strictEqual(directPage.keys.find((item) => item.key === 'd').sourceName, 'handleClick');
assert.strictEqual(directPage.keys.find((item) => item.key === 'e').sourceName, 'goDetail');
console.log('All tests passed.');
