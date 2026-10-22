#!/usr/bin/env node
'use strict';
try {
  const { main } = require('../dist/cli.cjs');
  main(process.argv.slice(2)).catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
} catch (error) {
  if (error && error.code === 'MODULE_NOT_FOUND') {
    console.error('umpd 尚未构建，请先在项目内执行 `pnpm run build`。');
    process.exitCode = 1;
  } else {
    throw error;
  }
}
