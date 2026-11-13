# 单文件启动器（Windows）

Windows 包是一个**单文件 exe**，但和原来的 portable 包有本质区别：

| | 原 portable（1.1.x） | 现在（1.2.0+） |
|---|---|---|
| 启动方式 | 每次启动都解压 301 MB 到 `%TEMP%` | **只解压一次**到 `runtime\<payload key>\` |
| 冷启动 | 5–5.7 s | 首次 5.9 s，之后 **0.8 s** |
| 磁盘残留 | `%TEMP%` 里一堆临时目录 | exe 旁边一个 `runtime\`（换版本自动清理旧的） |
| 用户数据 | exe 旁 `VIA-Offline-Data\` | 不变（升级后设置/键位保留） |

## 文件格式

```text
[ launcher.exe ][ xz payload ][ trailer 36 字节 ]
                               └ magic "VIAPAYL2" | format(4) | offset(8) | len(8) | unpacked(8)
```

payload 是 xz（LZMA2）流，内部按 `[u16 路径长度][路径][u64 文件大小][内容]` 排列。
解压前会校验 trailer 与文件长度是否吻合，所以**下载不完整会直接报错，而不是解压出一半**。

## 两个二进制

| 产物 | 用途 |
|---|---|
| `via-launcher.exe` | 最终用户运行的引导器（无控制台窗口，带图标/版本信息） |
| `via-pack.exe` | 构建期工具：`via-pack --dir <win-unpacked> --out <单文件.exe>` |

`via-pack` 会把 **`via-launcher.exe`** 贴在输出文件前面（不是它自己）。同目录下找不到时用
`--stub` 指定。

## 运行逻辑

1. 读自身 trailer → 校验 → 用 payload 长度 + 首尾采样算出缓存键。
2. 缓存根目录：**exe 所在目录**（可写时）；不可写则 `%LOCALAPPDATA%\VIA-Offline-KS`。
3. 缓存命中（`runtime\<key>\.ok` + 主程序存在）→ 直接启动。
4. 未命中 → 显示 splash → 解压到 `runtime\.staging-<pid>` → 原子 rename → 写标记 → 启动。
5. 启动时注入 `PORTABLE_EXECUTABLE_DIR=<缓存根>`，让应用把 `VIA-Offline-Data` 放在**exe 旁边**，
   这样换版本不会丢设置。
6. 启动后清理其它 `runtime\<key>`（避免每个版本留一份 262 MB）。

## 语义保证

- **只读介质**（只读 U 盘/网络盘）：缓存与数据都退到 `%LOCALAPPDATA%\VIA-Offline-KS`，仍可运行。
- **缓存损坏**：主程序缺失或标记缺失会重新解压。
- **篡改/截断**：trailer 校验失败 → 弹窗提示重新下载。
- **路径穿越**：payload 内的绝对路径、`..`、盘符、`:` 一律拒绝。
- **诊断**：`VIA_LAUNCH_TIMING=<file>` 输出耗时 JSON；`VIA_NO_SPLASH=1` 关掉首次启动的 splash。

## 本地验证

```powershell
cd launcher
cargo build --release

# 用真实构建产物打一个单文件（win-unpacked 来自 electron-builder --win --x64 --dir）
.\target\release\via-pack.exe --dir ..\build\app\out\win-unpacked --out test.exe

# 计时（隐藏窗口）
$env:VIA_NO_SPLASH='1'; $env:VIA_HIDE_WINDOW='1'
$env:VIA_LAUNCH_TIMING="$PWD\timing.json"
.\test.exe
```

## 已知限制

- 首次解压 3–4 s，期间只有 splash，没有细粒度进度条。
- 首次执行新写出的 180 MB exe 可能被 Defender 扫描，冷启动会被拖到 6–11 s。
- 未签名时 SmartScreen 会拦（“更多信息 → 仍要运行”）。
