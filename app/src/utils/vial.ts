/**
 * Vial 自描述协议（HID usagePage 0xFF60 / usage 0x61）
 *
 * 与 VIA 的关键区别：
 *  - VIA 需要外部 definition JSON（按 VID/PID 查表），所以官方 VIA 必须等社区登记；
 *  - Vial 把定义烧进固件，通过 0xFE 命令现场读回来（keyboard id / 长度 / 分块内容），
 *    客户端不需要任何外部文件 → 真正的「免配置自动识别」。
 *
 * 协议（vial-qmk `quantum/vial.c`）：
 *   [0xFE, 0x00]                    GET_KEYBOARD_ID → 回 8 字节 id（小端）
 *   [0xFE, 0x01]                    GET_SIZE        → 回 4 字节定义长度（小端）
 *   [0xFE, 0x02, page_lo, page_hi]  GET_DEFINITION  → 回本页长度 + 28 字节内容
 *
 * 报文体固定 32 字节；本 shim 的 `write()` 第一项是 reportId（内部会剥掉），
 * 所以统一发 0x00，紧随其后的 32 字节才是 payload。
 *
 * 本模块刻意不 import shims：调用方传一个 `{write, readP}` 的传输对象进来
 * （`new HID.HID(path)` 正好满足），避免循环依赖。
 */
const VIAL_PREFIX = 0xfe;
const CMD_GET_KEYBOARD_ID = 0x00;
const CMD_GET_SIZE = 0x01;
const CMD_GET_DEFINITION = 0x02;

const REPORT_SIZE = 32;
// 回包头 [0xFE, sub, page_lo, page_hi, size] 占 5 字节
const DEFINITION_CHUNK = REPORT_SIZE - 5;
const DEFAULT_TIMEOUT_MS = 500;
const MAX_DEFINITION_BYTES = 64 * 1024;

export type VialDefinition = Record<string, unknown>;

export type VialProbeResult = {
  keyboardId: number;
  /** 固件里那份 vial.json，原样返回 */
  definition: VialDefinition;
};

/** `new HID.HID(path)` 的最小可测子集 */
export type VialTransport = {
  write: (arr: number[]) => Promise<void>;
  readP: () => Promise<ArrayBuffer>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const buildFrame = (sub: number, ...args: number[]): number[] => {
  const payload = new Array<number>(REPORT_SIZE).fill(0);
  payload[0] = VIAL_PREFIX;
  payload[1] = sub;
  args.forEach((value, index) => {
    if (2 + index < REPORT_SIZE) {
      payload[2 + index] = value & 0xff;
    }
  });
  return [0x00, ...payload]; // 首字节是 reportId
};

/**
 * 发一帧并等回包。应答首字节是 reportId(0)，接着 0xFE + sub，
 * 按此校验避免把 LED/其它回包当成应答。
 */
const transact = async (
  device: VialTransport,
  sub: number,
  args: number[] = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Uint8Array | null> => {
  await device.write(buildFrame(sub, ...args));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const raw = await withTimeout(
      device.readP(),
      Math.max(50, deadline - Date.now()),
    );
    if (!raw) break;
    const data = new Uint8Array(raw);
    // 固件回包 = [0xFE, sub, ...]（WebHID 的 inputreport 不含 reportId）
    if (data.length >= 2 && data[0] === VIAL_PREFIX && data[1] === sub) {
      return data;
    }
    await sleep(5);
  }
  return null;
};

const readU32 = (data: Uint8Array, offset: number): number =>
  ((data[offset] ?? 0) |
    ((data[offset + 1] ?? 0) << 8) |
    ((data[offset + 2] ?? 0) << 16) |
    ((data[offset + 3] ?? 0) << 24)) >>>
  0;

const readU64 = (data: Uint8Array, offset: number): number => {
  const low = readU32(data, offset);
  const high = readU32(data, offset + 4);
  return high * 2 ** 32 + low;
};

/**
 * 探测一个设备是否讲 Vial 协议。返回 null 表示不是 Vial 或没响应。
 * `device` 必须是已经 open 的 0xFF60/0x61 接口。
 */
export const probeVial = async (
  device: VialTransport,
  options?: {timeoutMs?: number},
): Promise<VialProbeResult | null> => {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const idResp = await transact(device, CMD_GET_KEYBOARD_ID, [], timeoutMs);
    if (!idResp) return null;
    // [0xFE, sub, id(8 bytes LE)]
    const keyboardId = readU64(idResp, 2);

    const sizeResp = await transact(device, CMD_GET_SIZE, [], timeoutMs);
    if (!sizeResp) return null;
    const total = readU32(sizeResp, 2);
    if (!total || total > MAX_DEFINITION_BYTES) return null;

    const pages = Math.ceil(total / DEFINITION_CHUNK);
    const chunks: Uint8Array[] = [];
    for (let page = 0; page < pages; page++) {
      const resp = await transact(
        device,
        CMD_GET_DEFINITION,
        [page & 0xff, (page >> 8) & 0xff],
        timeoutMs,
      );
      if (!resp) return null;
      // 回包：[0xFE, 0x02, page_lo, page_hi, size, ...chunk]
      // 以实际收到的字节为准（不同固件的 EPSIZE 可能是 32/64），最后按 total 截断
      const chunkLength = resp[4] ?? 0;
      if (!chunkLength) break;
      chunks.push(resp.slice(5));
    }

    const joined = new Uint8Array(
      chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      joined.set(chunk, offset);
      offset += chunk.length;
    }
    const merged = joined.slice(0, total);

    const text = new TextDecoder()
      .decode(merged)
      .replace(/\u0000+$/g, '')
      .trim();
    if (!text.startsWith('{')) return null;
    let definition: VialDefinition;
    try {
      definition = JSON.parse(text) as VialDefinition;
    } catch (error) {
      console.debug(
        '[vial] definition JSON invalid',
        `len=${text.length}`,
        text.slice(0, 60),
        '...',
        text.slice(-40),
        error,
      );
      return null;
    }
    if (!definition || typeof definition !== 'object') return null;

    return {keyboardId, definition};
  } catch (error) {
    // 探测失败不应打断扫描流程，但要留痕便于排查（固件缺陷/非 Vial 设备）
    console.debug('[vial] probe failed', error);
    return null;
  }
};

/**
 * 把固件里的 vial.json 补成 VIA 定义的最小形态：
 * Vial 允许省略 vendorId/productId（设备就在旁边），VIA 的 schema 要求它们。
 * 其余结构（matrix / layouts.keymap / lighting）与 VIA 同形，交给
 * `definition-import.ts` 的修复管线处理，这里不做二次改写。
 */
export const vialToVIARaw = (
  definition: VialDefinition,
  ids: {vendorId: number; productId: number},
): Record<string, unknown> => {
  const hex = (value: number) => `0x${value.toString(16).padStart(4, '0')}`;
  const raw: Record<string, unknown> = {...definition};
  raw.vendorId = definition.vendorId ?? hex(ids.vendorId);
  raw.productId = definition.productId ?? hex(ids.productId);
  if (!raw.name) {
    raw.name = `Vial ${hex(ids.vendorId)}:${hex(ids.productId)}`;
  }
  return raw;
};
