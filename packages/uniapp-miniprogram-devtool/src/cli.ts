import { main as devMain } from './one-click';

function printHelp(): void {
  console.log(`umpd

用法:
  umpd --project <mp-weixin> --wechat-devtools <wechatwebdevtools.app> [--port <port>]

说明:
  默认启动 Web Panel，并通过微信开发者工具 automator 读取当前小程序运行时 page.data。
  --project 和 --wechat-devtools 都是必填。
  --wechat-devtools 直接传微信开发者工具 .app 路径即可，工具会自动解析到 Contents/MacOS/cli。

示例:
  umpd --project ./unpackage/dist/dev/mp-weixin --wechat-devtools /Volumes/Elements/Applications/wechatwebdevtools.app
  umpd --project ./unpackage/dist/dev/mp-weixin --cli-path /Applications/wechatwebdevtools.app/Contents/MacOS/cli
`);
}

export async function main(argv: string[]): Promise<void> {
  if (argv.includes('-h') || argv.includes('--help')) {
    printHelp();
    return;
  }
  await devMain(argv);
}
