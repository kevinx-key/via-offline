/**
 * Vial 协议自测（不需要真机）：用假 transport 回放固件应答，验证
 *  1) 三个 0xFE 命令的帧格式
 *  2) 分块重组（>28 字节的定义）
 *  3) 非 Vial 设备（不应答）返回 null
 *  4) vialToVIARaw 的字段补齐
 *
 * 用法：node --import tsx scripts/selftest-vial.ts
 */
import {probeVial, vialToVIARaw, type VialTransport} from '../src/utils/vial';

const REPORT = 32;
// 回包头 [0xFE, sub, page_lo, page_hi, size]
const CHUNK = REPORT - 5;

const frame = (sub: number, ...rest: number[]) => {
  const out = new Uint8Array(REPORT);
  out[0] = 0xfe;
  out[1] = sub;
  rest.forEach((v, i) => {
    if (2 + i < REPORT) out[2 + i] = v & 0xff;
  });
  return out.buffer;
};

const definitionJson = JSON.stringify({
  name: 'Selftest 65',
  matrix: {rows: 5, cols: 17},
  layouts: {
    keymap: [
      [
        '0,0',
        '0,1',
        {x: 0.25},
        '0,2',
        '0,3',
        '0,4',
        '0,5',
        '0,6',
        '0,7',
        '0,8',
        '0,9',
        '0,10',
        '0,11',
        '0,12',
        '0,13',
        '0,14',
      ],
    ],
  },
  lighting: 'none',
});

const makeVialDevice = (json: string): VialTransport & {frames: number[][]} => {
  const bytes = new TextEncoder().encode(json);
  const pages = Math.ceil(bytes.length / CHUNK);
  const frames: number[][] = [];
  let queued: ArrayBuffer[] = [];

  return {
    frames,
    async write(arr: number[]) {
      frames.push(arr.slice());
      const sub = arr[2];
      const payload = arr.slice(1);
      if (sub === 0x00) {
        queued.push(frame(0x00, 0x34, 0x12, 0, 0, 0, 0, 0, 0)); // keyboardId = 0x1234
      } else if (sub === 0x01) {
        const size = bytes.length;
        queued.push(frame(0x01, size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff));
      } else if (sub === 0x02) {
        const page = payload[2] | (payload[3] << 8);
        const start = page * CHUNK;
        const chunk = bytes.slice(start, start + CHUNK);
        const resp = frame(0x02, page & 0xff, (page >> 8) & 0xff, chunk.length, ...Array.from(chunk));
        queued.push(resp);
      }
    },
    async readP() {
      const next = queued.shift();
      if (!next) {
        // 永不回包 → 触发超时分支
        return new Promise<ArrayBuffer>((resolve) => setTimeout(() => resolve(new ArrayBuffer(0)), 5000));
      }
      return next;
    },
  };
};

const silentDevice: VialTransport = {
  async write() {},
  async readP() {
    return new Promise<ArrayBuffer>((resolve) => setTimeout(() => resolve(new ArrayBuffer(0)), 5000));
  },
};

const assert = (cond: unknown, msg: string) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('ok  -', msg);
  }
};

const main = async () => {
  // 1) 正常路径 + 分包
  const device = makeVialDevice(definitionJson);
  const result = await probeVial(device, {timeoutMs: 300});
  assert(result !== null, 'Vial 设备能被识别');
  assert(result?.keyboardId === 0x1234, `keyboardId 解析正确（得到 ${result?.keyboardId}）`);
  assert(
    (result?.definition as any)?.name === 'Selftest 65',
    '定义 JSON 完整重组（含 name）',
  );
  const pages = Math.ceil(new TextEncoder().encode(definitionJson).length / CHUNK);
  assert(
    device.frames.filter((f) => f[2] === 0x02).length === pages,
    `分块读取页数正确（${pages} 页）`,
  );
  assert(
    device.frames[0][1] === 0xfe && device.frames[0][2] === 0x00,
    '帧格式：[reportId=0, 0xFE, sub, ...]',
  );
  assert(device.frames[0].length === 33, '帧长度 = reportId + 32 字节 payload');

  // 2) 非 Vial 设备（完全不应答）
  const started = Date.now();
  const silent = await probeVial(silentDevice, {timeoutMs: 200});
  assert(silent === null, '不应答的设备返回 null（不会误判）');
  assert(Date.now() - started < 3000, `超时受控（耗时 ${Date.now() - started}ms）`);

  // 3) vialToVIARaw 补齐 vendorId/productId
  const raw = vialToVIARaw({name: 'X', matrix: {rows: 1, cols: 1}}, {
    vendorId: 0x1234,
    productId: 0x5678,
  });
  assert(raw.vendorId === '0x1234' && raw.productId === '0x5678', '缺失 VID/PID 时按设备补齐');
  assert(raw.name === 'X', '已有 name 不被覆盖');

  console.log(process.exitCode ? '\n有失败项' : '\n全部通过');
};

void main();
