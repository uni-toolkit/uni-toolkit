import { main as devMain } from './one-click';

function printHelp(): void {
  console.log(`umpd

用法:
  umpd <mp-weixin> -w <wechatwebdevtools.app> [--port <port>]
  umpd -p <mp-weixin> -w <wechatwebdevtools.app> [--port <port>]
  umpd --project <mp-weixin> --wechat-devtools <wechatwebdevtools.app> [--port <port>]

说明:
  默认启动 Web Panel，并通过微信开发者工具 automator 读取当前小程序运行时 page.data。
  mp-weixin 产物目录可直接作为第一个参数，也可用 -p / --proj / --project 指定。
  -w / --wd / --wechat-devtools 都可以传微信开发者工具 .app 路径，工具会自动解析到 Contents/MacOS/cli。

示例:
  umpd ./unpackage/dist/dev/mp-weixin -w /Volumes/Elements/Applications/wechatwebdevtools.app
  umpd -p ./unpackage/dist/dev/mp-weixin -w /Volumes/Elements/Applications/wechatwebdevtools.app
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
