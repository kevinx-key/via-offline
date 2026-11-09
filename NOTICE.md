# 修改声明 / Modification notice

本仓库是 **VIA 的非官方修改版**（unofficial modified build of VIA），品牌为 **K-STAR**。

- 上游：<https://github.com/the-via/app>（GPL-3.0）
- 键盘定义上游：<https://github.com/the-via/keyboards>（GPL-3.0）
- 运行时外壳：Electron（MIT），内含 Chromium，许可见发行包
- 修改方：K Star Studio，2026-11

## 修改清单

1. **离线化**
   - `public/fonts/fira/`：Fira Sans webfont 本地化，`src/app.global.css` 删除 Google Fonts `@import`，改为内联 `@font-face`
   - `public/draco/`：three.js Draco 解码器本地化；`postbuild-offline.js` 把构建产物中的
     `https://www.gstatic.com/draco/versioned/decoders/1.5.5/` 重写为 `/draco/`
   - `index.html`：删除 fonts.googleapis.com 的 preconnect / stylesheet
   - 新增 `server.js` / `serve.js`：本地只读静态服务
   - 新增 `electron/main.js`：桌面外壳；关闭拼写检查与 Chromium 后台联网，
     `host-resolver-rules` 只放行回环地址，`webRequest` 取消一切非本机请求；
     `setDevicePermissionHandler` 预授权随包定义覆盖的设备
   - 未启用任何统计/遥测

2. **品牌标识（K-STAR）**
   - 图标资源：`public/favicon*`、`apple-touch-icon.png`、`android-chrome-*.png`、`mstile-*.png`、
     `safari-pinned-tab.svg`、`favicon.ico`，以及打包用 `icon.ico` / `icon.png`
   - 界面 logo：`src/components/icons/via.tsx`（原 VIA 字形 SVG → K-STAR 星标）
   - 新增 `src/components/menus/build-badge.tsx`：顶栏常驻「K-STAR · VIA 离线版（非官方）」
   - 标题：`index.html` 与 `electron/main.js` 的窗口标题为「VIA 离线版 · K-STAR」

3. **字体替换（法律风险整改）**
   - 移除上游随包的 **Gotham Rounded**（商业字体，13 个 otf/ttf 文件）及其 `@font-face`
   - `src/components/panes/configure-panes/custom/satisfaction75/menu.tsx` 改用随包的 Fira Sans
   - 移除随包的 `Symbola.ttf`（George Douros，授权不明），改用 **Noto Sans Symbols / Noto Sans Symbols 2**（SIL OFL 1.1），并作为 UI 字体栈的兜底

4. **移除 Gist 分享（法律风险整改）**
   - 删除 `src/utils/github.ts`（其中硬编码了上游 OAuth `client_id`）
   - 删除 `public/github_oauth.html`
   - 该功能在离线环境下本就不可用；删除后不再借用他人 OAuth 应用

5. **默认设置**
   - `src/utils/device-store.ts`：`showDesignTab: false → true`

6. **外链**
   - `src/components/menus/external-links.tsx`：Discord → K-STAR 频道；
     GitHub → 本仓库；星标 → 本项目文档页

7. **未修改**
   - VIA 的业务逻辑、键盘定义内容、语言包、快捷键、主题配色（仍为上游 OLIVIA DARK）

## 版本

| 版本 | 变更 |
|---|---|
| v1.0.0 | 首个公开版本（单文件绿色版） |
| v1.0.1 | 移除 Gotham Rounded（改用 Fira Sans）、移除 Gist 分享、品牌改为 K-STAR、重绘 logo |
| v1.0.2 | 移除 Symbola.ttf（授权不明），改用 Noto Sans Symbols / 2（OFL） |

## 说明

依 GPL-3.0 第 5 条，本仓库随发行版提供完整对应源码；修改点即上述清单，修改过的上游文件
均已加 `Modified by K Star Studio (2026-11)` 文件头注释。

若再分发本构建，请保留顶栏「非官方」标识与本声明。

