# Vial 自动识别（固件自描述）

> 2026-11-15 新增。目标：让 VIA 离线版像 Vial 官方客户端一样，**不需要任何外部定义文件**就能认出键盘并改键。

## 为什么需要

VIA 与 Vial 的识别模型不同：

| | 定义从哪来 | 后果 |
|---|---|---|
| **VIA** | 外部 `via.json`，按 `vendorId/productId` 查表（本仓随包 1898 个） | 新键盘没登记 → 认不出，必须等社区补 |
| **Vial** | 烧在固件里，用 `0xFE` 命令现场读回 | 不需要任何文件，插上即识别 |

本仓此前只有 VIA 那一半：没登记的键盘只能手动侧载 JSON。本次补上 Vial 自描述通道后，
**同一个键盘两种固件都能开箱识别**，且 Vial 键盘的定义会缓存到本地，下次启动直接命中。

## 协议（vial-qmk `quantum/vial.c`）

HID usagePage `0xFF60` / usage `0x61`，报文体 32 字节：

```
[0xFE, 0x00]                    GET_KEYBOARD_ID  → 回 [0xFE, 0x00, id(8B LE)]
[0xFE, 0x01]                    GET_SIZE         → 回 [0xFE, 0x01, len(4B LE)]
[0xFE, 0x02, page_lo, page_hi]  GET_DEFINITION   → 回 [0xFE, 0x02, page_lo, page_hi, size, ...chunk]
```

要点：

- **WebHID 的 `inputreport` 不含 reportId**，所以回包首字节就是 `0xFE`；发送侧则由 shim 补 `reportId=0`。
- 每页有效数据 = `32 - 5 = 27` 字节；末页 `size` 会小于 27，接收侧按 `size` 截断，
  因此固件用 32 或 64 字节 EPSIZE 都能兼容（以实际收到的字节为准，最后按 `GET_SIZE` 的总长裁剪）。
- 读回的 `vial.json` 与 VIA v3 定义同形（`matrix` / `layouts.keymap` / `lighting`），
  直接交给现有 `definition-import.ts` 的修复管线，不需要另写一套解析。

## 改动

| 文件 | 作用 |
|---|---|
| `src/utils/vial.ts` | 纯协议层：`probeVial(transport)` + `vialToVIARaw()`；不碰 store，传输对象由调用方注入（便于测试） |
| `src/utils/vial-keyboards.ts` | 设备 → VIA 定义 → `KeyboardDictionary` 条目；含 `localStorage` 缓存（`vial-definitions-v1`） |
| `src/store/devicesThunks.ts` | ① `requestDeviceFromUser`：VIA 协议不通时先试 Vial，命中就注册定义并重扫；② `loadSupportedIds`：启动时把缓存的 Vial 定义合进 definitions |
| `scripts/selftest-vial.ts` | 无真机的协议自测（假 transport 回放固件应答） |

用户可见行为：手动选一台 Vial 键盘 → 不再弹「不支持的设备」，而是直接进入改键界面；
第二次插拔/重启后，因为定义已在缓存里，扫描阶段就会把它当内置键盘识别。

## 自测

```bash
cd app
node --import tsx scripts/selftest-vial.ts
```

覆盖：帧格式、keyboardId/size 解析、分包重组（8 页）、末页短包截断、
非 Vial 设备不应答时返回 `null`、超时受控、`vendorId/productId` 补齐。

## 已知限制

1. **没有真机验证**：协议层是按 vial-qmk 源码与 EPSIZE=32 推导并用假设备回放验证的；
   接真机时若固件 EPSIZE 是 64，`resp.slice(5)` 仍然正确（按总长截断），但页数计算会多算，属于可接受开销。
2. **只覆盖 USB/有线通道**：2.4G 接收器若把 raw HID 收在子集合里，走的是 `shims/node-hid.ts` 的
   嵌套 collection 查找（已有能力），但未实测。
3. **缓存不随固件升级失效**：换了键位定义但 VID/PID 不变时会命中旧缓存；目前靠手动「恢复全部默认」
   清空 localStorage 解决，后续可加固件版本号比对。
