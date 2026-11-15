/**
 * Vial 键盘的注册层：把「固件自描述」变成 VIA 可以直接渲染的定义。
 *
 * 分工：
 *  - `vial.ts`      —— 只讲协议（0xFE 三个命令），不碰 store
 *  - 本文件         —— 设备 → definition → KeyboardDictionary 条目，含 localStorage 缓存
 *  - `devicesThunks.ts` —— 在“连接/重扫”流程里调用本文件
 *
 * 缓存的意义：Vial 键盘每次插拔都读一遍固件（几十毫秒 + 若干次 HID 往返），
 * 缓存到 localStorage 后，下次启动直接把定义装进 store，扫描时就能命中 VID/PID，
 * 体验与内置定义完全一致。
 */
import type {
  DefinitionVersionMap,
  KeyboardDictionary,
  VIADefinitionV2,
  VIADefinitionV3,
} from '@the-via/reader';
import {HID} from '../shims/node-hid';
import {parseDefinition} from './definition-import';
import {getVendorProductId} from './hid-keyboards';
import {probeVial, vialToVIARaw} from './vial';

export const VIAL_STORAGE_KEY = 'vial-definitions-v1';

type StoredVial = {
  keyboardId: number;
  raw: Record<string, unknown>;
  /** 便于界面上显示“来自固件自描述” */
  source: 'vial';
  updatedAt: number;
};

type StoredVialMap = Record<string, StoredVial>;

export type VialRegistration = {
  /** vid*65536+pid，与 VIA 的 KeyboardDictionary key 同构 */
  key: number;
  name: string;
  keyboardId: number;
  raw: Record<string, unknown>;
  definition: VIADefinitionV2 | VIADefinitionV3;
  /** 解析出来的定义代数，写入 store 时按它填 v2/v3 槽位 */
  version: 'v2' | 'v3';
};

const safeParse = (text: string | null): StoredVialMap => {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as StoredVialMap) : {};
  } catch {
    return {};
  }
};

export const loadStoredVial = (): StoredVialMap => {
  try {
    return safeParse(window.localStorage.getItem(VIAL_STORAGE_KEY));
  } catch {
    return {};
  }
};

const saveStoredVial = (map: StoredVialMap) => {
  try {
    window.localStorage.setItem(VIAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* 隐私模式/配额满：缓存不上不影响本次连接 */
  }
};

/** 把缓存里的 raw 定义转成 VIA 定义（缓存损坏或版本升级后 schema 变化都能兜住）。 */
export const vialCacheToDictionary = (
  stored: StoredVialMap = loadStoredVial(),
): {dictionary: KeyboardDictionary; failed: string[]} => {
  const dictionary: KeyboardDictionary = {};
  const failed: string[] = [];
  for (const [key, entry] of Object.entries(stored)) {
    try {
      const parsed = parseDefinition(entry.raw);
      // VIA 的 Dictionary 值是 {v2?, v3?}，只填解析出来的那一代即可
      dictionary[Number(key)] = {
        [parsed.version]: parsed.definition,
      } as unknown as DefinitionVersionMap;
    } catch {
      failed.push(key);
    }
  }
  return {dictionary, failed};
};

/**
 * 现场读一台设备的 Vial 定义并落缓存。
 * 返回 null = 这台设备不是 Vial（或读失败），调用方按原逻辑处理即可。
 */
export const readVialForDevice = async (device: {
  path: string;
  vendorId: number;
  productId: number;
  productName?: string;
}): Promise<VialRegistration | null> => {
  const hid = new HID.HID(device.path) as unknown as {
    write: (arr: number[]) => Promise<void>;
    readP: () => Promise<ArrayBuffer>;
  };
  if (!hid) return null;

  const probed = await probeVial(hid, {timeoutMs: 600});
  if (!probed) return null;

  const raw = vialToVIARaw(probed.definition, {
    vendorId: device.vendorId,
    productId: device.productId,
  });

  let parsed;
  try {
    parsed = parseDefinition(raw);
  } catch {
    // 固件里的定义可能是极简 schema，交给上层的导入错误提示，不在这里吞掉
    return null;
  }

  const key = getVendorProductId(device.vendorId, device.productId);
  const name =
    typeof raw.name === 'string' && raw.name
      ? (raw.name as string)
      : device.productName || `Vial ${key}`;

  const map = loadStoredVial();
  map[String(key)] = {
    keyboardId: probed.keyboardId,
    raw,
    source: 'vial',
    updatedAt: Date.now(),
  };
  saveStoredVial(map);

  return {
    key,
    name,
    keyboardId: probed.keyboardId,
    raw,
    definition: parsed.definition,
    version: parsed.version,
  };
};
