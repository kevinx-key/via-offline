# VIA 离线版：构建说明

本目录是本次“能不能自己编一个离线 VIA”的验证工程。产物在
`..\VIA-Offline-win64\`。

## 结论（验证结果）

| 问题 | 结论 |
|---|---|
| usevia.app 的前端源码能拿到吗 | 能。`github.com/the-via/app`，GPL-3.0，就是 usevia.app 本身 |
| 键盘定义能拿到吗 | 能。`github.com/the-via/keyboards`，GPL-3.0，构建时打包 |
| 官方“本地安装包”是离线的吗 | **不是**。`the-via/releases` 的 via-3.0.0-win.exe 只是 Electron 壳，指向 `https://usevia.app/` |
| 能编出完全离线版吗 | 能，已编出并验证（启动加载期 0 个外部请求） |

## 目录

```
via-study\
  app\                     # the-via/app 源码 + 离线化改造
    public\definitions\    # 由 the-via/keyboards 生成（~24 MB，3351 个 JSON）
    public\fonts\fira\     # 本地化的 Fira Sans woff2
    public\draco\          # 本地化的 three.js Draco 解码器
    electron\main.js       # Electron 外壳（本地 HTTP + WebHID 授权）
    server.js serve.js     # 极简静态服务，Electron 与浏览器模式共用
    fetch-fonts.py         # 抓 Google Fonts 的 woff2 并改写成本地路径
    patch-offline.py       # 去掉 index.html / CSS 里的 Google Fonts 引用
    postbuild-offline.js   # 把 Draco 的 gstatic CDN 路径改成 /draco/
  downloads\               # electron-v33.4.11-win32-x64.zip（已删除，重编会重下）
  VIA-Offline-win64\       # 最终便携版（双击 VIA-Offline.exe）
```

## 复现步骤

```powershell
cd <本目录>\app

# 1. 依赖（node >= 18；官方脚本用 bun，这里用 npm 等价替换）
npm install

# 2. 生成键盘定义 -> public/definitions
node --import tsx node_modules/via-keyboards/scripts/build-all.ts public/definitions

# 3. 字体本地化（一次性，产物已在仓库里）
python ..\fetch-fonts.py
python ..\patch-offline.py

# 4. 类型检查 + 打包
npx tsc
npx vite build
node postbuild-offline.js      # 必须：把 Draco 的 CDN 路径替换成本地

# 5. 组装便携版
#    下载 electron-v33.4.11-win32-x64.zip 解压到 VIA-Offline-win64\
#    把 app\electron\main.js、app\server.js、app\dist\ 放进 resources\app\
#    resources\app\package.json 的 main 指向 main.js
#    把 electron.exe 重命名为 VIA-Offline.exe
```

## 冒烟测试（无窗口，可随时自检）

```powershell
$env:VIA_SMOKE_TEST="1"
$env:VIA_SMOKE_OUT="$PWD\report.json"
.\VIA-Offline.exe
# 退出码 0 = 通过；report.json 中 externalRequests 必须为空
```

注意：如果当前终端是从某个 Electron 程序（如 VS Code）继承来的，
`ELECTRON_RUN_AS_NODE=1` 会让 exe 以纯 Node 运行、什么都不做。
测试前先 `Remove-Item Env:ELECTRON_RUN_AS_NODE`。

## 改造点（与原版源码的差异）

1. `index.html`：删除 fonts.googleapis.com 的 preconnect + stylesheet。
2. `src/app.global.css`：删除两条 Google Fonts `@import`，改成内联的本地
   `@font-face`（指向 `/fonts/fira/*.woff2`）。
3. `dist` 构建后：`postbuild-offline.js` 把
   `https://www.gstatic.com/draco/versioned/decoders/1.5.5/` 改成 `/draco/`。
4. 新增 `electron/main.js`：本地静态服务 + WebHID 权限处理 + 冒烟测试。
   未改动 VIA 自身的任何业务代码。

保持 VIA 原样能用的前提：所有 `/definitions/...` 请求仍是同源相对路径，
源码 `src/utils/device-store.ts` 里本来就是这么写的，无需改。

---

# 第二轮：绿黑定制版（VIA-Offline-Green）

产物：`..\VIA-Offline-Green\`（便携文件夹）与 `..\VIA-Offline-Green.zip`（122 MB）。

## 改了什么

| 项 | 位置 | 改动 |
|---|---|---|
| 主背景 / 渐变 | `src/app.global.css` | `--color_light-jet #222 → #10171f`，`--color_jet #1d1b1b → #0b1117`，`body #232c39 → #10171f` |
| 顶栏 / 控件底色 | `src/app.global.css` | `--color_dark-grey #414141 → #17202a` |
| 粉色强调色 | `src/utils/themes.ts` | 默认主题 `OLIVIA_DARK`：`#E8C4B8 → #d9fd22`，`#363434 → #10171f` |
| 主题覆盖顺序 | `src/utils/themes.ts` | 原来 `...REMOTETHEMES` 在本地定义之后，会把本地改色覆盖回粉色；改成远程在前、本地在后 |
| logo（界面） | `src/components/icons/via.tsx` | 原 VIA 字形 SVG → `/images/logo.png` |
| logo（图标） | `public/*` + `build-assets/app.ico` | favicon 16/32/ico、apple-touch、android-chrome 192/512、mstile 全尺寸、manifest 图标、safari mask |
| 窗口图标 / 底色 | `app/electron/main.js` | `icon` + `backgroundColor: #10171f` |
| exe 图标与版本信息 | `rcedit` | 见下 |

颜色取自源图三色：`#10171f`（深黑，54.9%）、`#d9fd22`（荧光绿，28.9%）、白（透明外圈）。

## 生成图标的脚本

```powershell
cd <本目录>
python apply-branding.py     # 从 g&bT.png 生成全部尺寸 + build-assets/app.ico
```

## 给 exe 换图标

```powershell
build-assets\rcedit-x64.exe VIA-Offline.exe --set-icon build-assets\app.ico `
  --set-version-string "ProductName" "VIA Offline (K-STAR)" `
  --set-version-string "FileDescription" "VIA Offline - K-STAR" `
  --set-version-string "CompanyName" "K Star Studio"
```

## 顺带修的两个小问题

1. `server.js` 增加 SPA 回退：`/settings` 之类的前端路由直接访问时回落到 index.html（否则 404 白屏）。
2. 完全删除测试用的 `%APPDATA%\VIA Offline` 配置目录，交付时是全新首启状态。

## 验证

无窗口冒烟 + 离屏截图（`VIA_SMOKE_TEST=1`、`VIA_SMOKE_ROUTE=/settings`、`VIA_SMOKE_SHOT=out.png`）：

- `mounted: 3`、定义索引 200、`hidApi: object`、`externalRequests: []`（退出码 0）
- 截图见 `VIA-Offline-Green\验证-界面预览.png` 与 `验证-设置页预览.png`

---

# 第三轮：恢复配色 + 非官方标识

配色已整轮回滚（`app.global.css`、`src/utils/themes.ts` 均恢复上游原值，
`...REMOTETHEMES` 展开顺序也复原），只保留 logo 替换，并新增常驻身份标识。

| 项 | 位置 | 说明 |
|---|---|---|
| 配色 | `src/app.global.css`、`src/utils/themes.ts` | 全部恢复上游默认（深灰底 + OLIVIA DARK 粉色） |
| 窗口底色 | `electron/main.js` | `#10171f → #dadada`（恢复） |
| 顶栏标识 | `src/components/menus/build-badge.tsx` | 常驻「K-STAR · VIA 离线版（非官方）」，hover 显示完整声明 |
| 顶栏容器 | `src/components/menus/global.tsx` | 加 `position: relative` 并渲染 `<BuildBadge />`（居中图标不受影响） |
| 标题 | `index.html` / `electron/main.js` | `VIA 离线版 · K-STAR` |
| 修改声明 | `resources/app/NOTICE.txt` | GPL-3.0 要求的修改清单 + 免责说明 |

标识位置固定在顶栏左上角，切换任何页签都在，不依赖“关于”对话框才看得到。

验证：`mounted 3`、定义 200、`externalRequests: []`、`title = VIA 离线版 · K-STAR`；
截图 `VIA-Offline-Green\验证-界面预览.png`、`验证-设置页预览.png`。

---

# 第四轮：默认显示「设计」标签

改一行：`src/utils/device-store.ts` 的默认设置 `showDesignTab: false → true`。
等价于设置页里“显示‘设计’标签”默认打开（用户仍可在设置中关掉，属于普通
设置项，不写死）。控制台标签（`showConsoleTab`）保持默认关闭，未动。

验证：`VIA_SMOKE_ROUTE=/design` 截图显示该页正常渲染（首次进入会有官方的
“侧载定义”提示框），顶栏出现 4 个标签（键盘/灯光/设计/设置）。
截图：`VIA-Offline-Green\验证-界面预览.png`、`验证-设计页预览.png`。

---

# 第五轮：logo 改粉黑配色

界面配色早已回滚成上游默认（深灰 + `#E8C4B8` 粉），绿 logo 就显突兀了，所以把
logo 也换成同一套粉色。

做法（不重绘，只做精确换色，形状/描边/抗锯齿全部保留）：

1. `recolor-logo.py`：沿「源背景 → 源星形」这条色轴对每个像素求投影系数 t，
   再用 `t` 在「新背景 → 新星形」之间插值。
   - 源：`#10171f`（深蓝黑底）+ `#d9fd22`（荧光绿星）
   - 新：`#1d1b1b`（VIA `--color_jet`）+ `#e8c4b8`（OLIVIA DARK 强调色）
   - 输出 `build-assets/logo-pink.png`
2. `apply-branding.py` 的 `SRC` 指向该文件，重新生成全部尺寸 + `app.ico`
3. `rcedit --set-icon` 重刷 exe 图标；`resources/app/icon.png`（窗口图标）同步
4. `make-mark.py`：从粉版 logo 提取实心星形轮廓（边界向内传播填掉字和眼睛），
   生成 `public/images/logo-mark.png`，专供顶栏 15px 标识使用——
   完整 logo 缩到 15px 字会糊成一坨，简化标在同样尺寸下才认得出

未改动：界面配色、布局、功能。

验证：冒烟 `externalRequests: []`、退出码 0；`build-assets/exe-icon-check.png`
为从 exe 里反抽出来的图标，`验证-界面预览.png` 为运行时截图。

---

# 第六轮：断网根治 + 键盘识别自检

## 为什么会联网

用 `--log-net-log` 抓启动全过程，唯一的外部主机是：

```
https://redirector.gvt1.com/edgedl/chrome/dict/en-us-10-1.bdic
```

这是 **Chromium 的拼写检查词典**（Electron `spellcheck` 默认开），不是 VIA 的请求。
之前的 `externalRequests` 只统计页面发起的请求，抓不到 Chromium 内部行为，
所以显示成 `[]` 也漏了它。

## 改了什么（`electron/main.js`）

1. `webPreferences.spellcheck = false` + `ses.setSpellCheckerEnabled(false)` +
   `ses.setSpellCheckerLanguages([])`
2. 启动开关：`disable-background-networking`、`disable-component-update`、
   `disable-domain-reliability`、`disable-sync`、`no-pings`、`dns-prefetch-disable`
3. **DNS 硬封**：`host-resolver-rules = "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost"`
4. **请求兜底**：`webRequest.onBeforeRequest` 对非本机 URL 直接 `cancel`
5. 自检新增两个探针：外网 fetch 必须被 blocked；`navigator.hid.requestDevice`
   必须能返回（验证 chooser 已接好，否则会永远挂住）

改后 netlog 只出现 `127.0.0.1`；冒烟报告 `blockedRequests: []`、
`probeBlocked: true`。

## 键盘识别

- 预授权逻辑不变：随包定义里的 VID/PID 在 `setDevicePermissionHandler`
  里直接放行 → `getDevices()` 立刻可见 → VIA 轮询到就自动选中，无需手势/弹窗
- `select-hid-device` 增加兜底：优先选有定义的键盘，否则选列表第一个并授权，
  让 VIA 至少能提示“缺少定义”，而不是死在“正在搜索设备”
- 新增 `诊断-键盘.cmd` + `diag-keyboard.ps1`：导出 Windows HID 设备清单 +
  应用侧 WebHID 可见列表，标记 `qmkRawHid` / `definitionBundled`，
  用于确认“在不在随包定义里、是不是 QMK raw-HID”

已知限制：`navigator.hid.requestDevice()` 在没有用户手势时会被 Chromium 拒绝
（自检里能看到这条 message），这属于浏览器安全策略；正常路径走的是
`getDevices()` 预授权，不受影响。

---

# 第七轮：单文件绿色版 + 恢复顶栏标识细节

## 单文件版

用 `electron-builder` 的 `portable` 目标打包，产物：
`VIA-Offline-KS-单文件\VIA-Offline-KS-1.0.0.exe`（76.6 MB，单文件）。

工程在 `portable-build\`：

```
package.json      # build.win.target = portable, electronVersion 33.4.11, icon=icon.ico
main.js           # 同 app/electron/main.js，另加 PORTABLE_EXECUTABLE_DIR 处理
server.js  icon.png  icon.ico  NOTICE.txt  LICENSE  dist\
```

打包命令：

```powershell
cd portable-build
npm install
npx electron-builder --win portable
# 产物 out\VIA-Offline-KS-1.0.0.exe
```

说明：
- Electron 无法真正做成单二进制，portable 目标是把整个运行时 + asar 压进一个
  NSIS 自解压 exe，运行时解到 %TEMP% 并启动，退出后清理 —— 这是 Windows 上
  单文件 Electron 应用的通行做法
- 首次启动 3–6 秒（解压），之后走系统缓存更快
- `PORTABLE_EXECUTABLE_DIR` 由外壳注入：main.js 把 userData/sessionData 指到
  exe 同目录的 `VIA-Offline-Data`，这样设置可以随 exe 搬走；目录不可写时回落
  到默认 %APPDATA%
- 打包后用 `Start-Process`（无窗口、带 VIA_SMOKE_TEST）实测：退出码 0，
  `blockedRequests: []`、`probeBlocked: true`、mounted 3，8.3s 完成（含解压）

## 顶栏标识恢复细节

`build-badge.tsx` 的 `<Mark>` 从 `/images/logo-mark.png`（简化星形轮廓）改回
`/images/logo.png`（完整 logo），尺寸 15px → 17px，字与描边重新可见。
`logo-mark.png` 仍保留在资源里，不再被引用。

## 交付

`VIA-Offline-KS-单文件\`：exe + 使用说明 + 诊断脚本 + NOTICE/LICENSE（GPL 要求
随附）+ 验证截图与冒烟报告。exe 单独拷走也能跑。
