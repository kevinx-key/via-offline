# VIA 离线版 · K-STAR 定制

> 非官方构建（unofficial build）。基于 [the-via/app](https://github.com/the-via/app)（GPL-3.0）与
> [the-via/keyboards](https://github.com/the-via/keyboards)（GPL-3.0），与 VIA 项目及其维护者
> 无隶属或背书关系。

一个**完全离线**的 VIA 桌面版（Windows / macOS / Linux）：插上键盘就能改键，不访问任何服务器。

| | |
|---|---|
| 下载 | [最新版 Releases](../../releases/latest) |
| 文档 | <https://app.starthock.com/via/docs> |
| 介绍页 | <https://app.starthock.com/via> |
| Discord | <https://discord.gg/ztQnqW5MTd> |

## 特性

- **真·完全离线**：键盘定义、Fira Sans 字体、three.js 的 Draco 解码器全部打包；Chromium 的拼写检查词典下载、组件更新、DNS 预解析等后台联网全部关闭，并在解析器与请求两层封死。
- **三平台**：Windows 单文件 exe、macOS zip/dmg、Linux AppImage。
- **1898 个厂商产品 ID 随包**：等于 VIA 官方定义库到构建快照为止的全部内容；另有手动选择 / 显示全部 HID / 弹窗内重新扫描。
- **V2/V3 自动识别**：侧载旧 JSON 不再需要手动切 V2 兼容，常见灯光格式问题自动修复。
- **新 UI**：单顶部栏、无原生标题栏、可拖动；白天 Olivia / 黑夜 ERROR 主题，可手动切换；白心黑底 K-STAR 标识。
- **Windows 全局拦截**：测试页可拦截本机所有按键并置顶，Ctrl+Alt+F12 退出；mac/Linux 仅窗口内按键。
- **非官方标识**：顶栏常驻「K-STAR · VIA 离线版（非官方）」，源码公开（GPL-3.0）。

## 仓库结构

```
app/                  # the-via/app 源码 + 本项目的修改（不含 node_modules / dist / 定义）
  electron/main.js    # 桌面外壳：本地静态服务 + WebHID 授权 + 离线加固
  server.js serve.js  # 极简静态服务
  public/fonts/fira/  # 本地化的 Fira Sans
  public/draco/       # 本地化的 Draco 解码器
  public/definitions/ # 构建时生成（未入库，见 docs/build-notes.md）
tools/                # 品牌/字体/图标/配色脚本
packaging/            # electron-builder 打包配置与外壳副本
docs/build-notes.md   # 完整构建与修改记录
NOTICE.md             # GPL-3.0 要求的修改声明
LICENSE               # GPL-3.0
```

## 构建（概要）

```bash
cd app
npm install
node --import tsx node_modules/via-keyboards/scripts/build-all.ts public/definitions
npx tsc && npx vite build && node postbuild-offline.js
```

打包成单文件 exe 的完整步骤见 [docs/build-notes.md](docs/build-notes.md)。

## 许可

GPL-3.0。修改内容与日期见 [NOTICE.md](NOTICE.md)。VIA 的名称与标识归其权利人所有；
K-STAR 为本项目品牌。

