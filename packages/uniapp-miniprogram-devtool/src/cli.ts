import { main as devMain } from './one-click';

function printHelp(): void {
  console.log(`umpd

用法:
  umpd [--port <port>] [--automator-port <port>]
  umpd <mp-weixin> -w <wechatwebdevtools.app> [--port <port>] [--automator-port <port>]
  umpd -p <mp-weixin> -w <wechatwebdevtools.app> [--port <port>] [--automator-port <port>]
  umpd --project <mp-weixin> --wechat-devtools <wechatwebdevtools.app> [--port <port>] [--automator-port <port>]

说明:
  默认启动 Web Panel，并通过微信开发者工具 automator 读取当前小程序运行时 page.data。
  不传参数时，会自动探测当前目录下的 ./unpackage/dist/dev/mp-weixin 和 ./dist/dev/mp-weixin，
  并按平台查找微信开发者工具默认安装路径（macOS: /Applications/wechatwebdevtools.app，
  Windows: C:/Program Files (x86)/Tencent/微信web开发者工具）。
  mp-weixin 产物目录可直接作为第一个参数，也可用 -p / --proj / --project 指定。
  -w / --wd / --wechat-devtools 都可以传微信开发者工具路径，工具会自动解析：
    macOS 传 .app 路径时解析到 Contents/MacOS/cli；Windows 传安装目录时解析到目录下的 cli.bat。
  非默认安装位置时才需要显式传 -w。

示例:
  umpd
  umpd ./unpackage/dist/dev/mp-weixin -w /Volumes/Elements/Applications/wechatwebdevtools.app
  umpd -p ./unpackage/dist/dev/mp-weixin -w /Volumes/Elements/Applications/wechatwebdevtools.app --automator-port 9421
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
