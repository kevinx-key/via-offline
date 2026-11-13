/**
 * Definition import with automatic v2/v3 detection.
 *
 * Upstream VIA asks the user to choose "v2 or v3" before importing a JSON file,
 * and the strict reader schema rejects a few real-world definitions (most
 * notably `qmk_lighting` combined with explicit QMK lighting keycode modules,
 * which is what produces the confusing "UG_* / RM_*" message). This module
 * accepts either generation, repairs the common schema drift, and only reports
 * a genuinely unusable file.
 */
import {
  BuiltInKeycodeModule,
  commonMenus,
  getVendorProductId,
  isVIADefinitionV2,
  isVIADefinitionV3,
  keyboardDefinitionV2ToVIADefinitionV2,
  keyboardDefinitionV3ToVIADefinitionV3,
  kleLayoutToVIALayout,
  validateLayouts,
  VIADefinitionV2,
  VIADefinitionV3,
} from '@the-via/reader';
import type {DefinitionVersion} from '@the-via/reader';

export type ParsedDefinition = {
  version: DefinitionVersion;
  definition: VIADefinitionV2 | VIADefinitionV3;
  /** Human-readable repairs that were applied automatically. */
  notes: string[];
};

export class DefinitionImportError extends Error {
  detail: string;
  constructor(detail: string) {
    super('Unable to read this keyboard definition');
    this.name = 'DefinitionImportError';
    this.detail = detail;
  }
}

const LIGHTING_MODULE_VALUES = [
  BuiltInKeycodeModule.QMKBacklightKeycodes,
  BuiltInKeycodeModule.QMKRGBLightKeycodes,
  BuiltInKeycodeModule.QMKRGBMatrixKeycodes,
  BuiltInKeycodeModule.QMKBacklightRGBLightKeycodes,
] as string[];

const STANDARD_LIGHTING_MENUS = [
  'qmk_rgblight',
  'qmk_backlight_rgblight',
  'qmk_rgb_matrix',
  'qmk_backlight',
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const asObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? (value as Record<string, any>) : {};

const errorText = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const looksLikeV2 = (raw: Record<string, any>): boolean =>
  'lighting' in raw ||
  'customFeatures' in raw ||
  'customMenus' in raw ||
  (!('menus' in raw) && !('keycodes' in raw) && !('firmwareVersion' in raw));

export const looksLikeV3 = (raw: Record<string, any>): boolean =>
  'menus' in raw || 'keycodes' in raw || 'firmwareVersion' in raw;

/** Guess the lighting keycode module from the standard VIA lighting menu. */
const inferLightingModule = (
  menus: unknown,
): BuiltInKeycodeModule | undefined => {
  const ids = Array.isArray(menus)
    ? menus.filter((menu): menu is string => typeof menu === 'string')
    : [];
  if (ids.includes('qmk_rgb_matrix')) {
    return BuiltInKeycodeModule.QMKRGBMatrixKeycodes;
  }
  if (ids.includes('qmk_rgblight')) {
    return BuiltInKeycodeModule.QMKRGBLightKeycodes;
  }
  if (ids.includes('qmk_backlight_rgblight')) {
    return BuiltInKeycodeModule.QMKBacklightRGBLightKeycodes;
  }
  if (ids.includes('qmk_backlight')) {
    return BuiltInKeycodeModule.QMKBacklightKeycodes;
  }
  return undefined;
};

/**
 * VIA's reader currently rejects mixing `qmk_lighting` (show every UG/RM
 * keycode) with an explicit lighting module. Definitions written before that
 * rule existed are still perfectly usable, so pick the unambiguous module
 * instead of failing the import.
 */
const normalizeV3Keycodes = (
  raw: Record<string, any>,
  notes: string[],
): void => {
  if (!Array.isArray(raw.keycodes)) {
    return;
  }
  const keycodes: string[] = raw.keycodes.filter(
    (code: unknown): code is string => typeof code === 'string',
  );
  const hasGenericLighting = keycodes.includes(
    BuiltInKeycodeModule.QMKLighting,
  );
  if (!hasGenericLighting) {
    return;
  }
  const explicit = keycodes.filter((code) =>
    LIGHTING_MODULE_VALUES.includes(code),
  );
  if (explicit.length) {
    let chosen = explicit;
    if (explicit.length > 1) {
      // Two explicit modules are contradictory (e.g. RGBLight + RGB Matrix).
      // Prefer the one the lighting menu actually uses.
      const inferred = inferLightingModule(raw.menus);
      chosen = inferred ? [inferred] : [explicit[0]];
      notes.push('Selected the lighting module from the lighting menu');
    } else {
      notes.push('Ignored qmk_lighting; using the explicit lighting module');
    }
    raw.keycodes = keycodes
      .filter((code) => code !== BuiltInKeycodeModule.QMKLighting)
      .filter(
        (code) =>
          !LIGHTING_MODULE_VALUES.includes(code) || chosen.includes(code as any),
      );
    return;
  }
  const inferred = inferLightingModule(raw.menus);
  if (inferred) {
    raw.keycodes = keycodes.map((code) =>
      code === BuiltInKeycodeModule.QMKLighting ? inferred : code,
    );
    notes.push(`Detected lighting module: ${inferred}`);
    return;
  }
  // No way to tell RGBLight from RGB Matrix: dropping the generic module is
  // safer than showing both UG_* and RM_* keycodes on protocol 13.
  raw.keycodes = keycodes.filter(
    (code) => code !== BuiltInKeycodeModule.QMKLighting,
  );
  notes.push('Could not determine RGBLight vs RGB Matrix; ignored ambiguous qmk_lighting keycodes');
};

const normalizeMenus = (raw: Record<string, any>, notes: string[]): void => {
  if (!Array.isArray(raw.menus)) {
    raw.menus = [];
    return;
  }
  const known = Object.keys(commonMenus);
  const kept: any[] = [];
  for (const menu of raw.menus) {
    if (typeof menu === 'string' && !known.includes(menu)) {
      notes.push(`Ignored unknown menu: ${menu}`);
      continue;
    }
    kept.push(menu);
  }
  raw.menus = kept;
};

const filterOutOfBoundsKeys = (
  layouts: any,
  matrix: {rows?: number; cols?: number},
  notes: string[],
) => {
  const rows = Number(matrix?.rows) || 0;
  const cols = Number(matrix?.cols) || 0;
  if (!rows || !cols || !Array.isArray(layouts?.keys)) {
    return layouts;
  }
  const inBounds = (key: any) =>
    Number(key?.row) < rows && Number(key?.col) < cols;
  const dropped = layouts.keys.filter((key: any) => !inBounds(key)).length;
  if (!dropped) {
    return layouts;
  }
  notes.push(`Skipped ${dropped} key(s) outside the matrix`);
  const next = {...layouts};
  next.keys = layouts.keys.filter(inBounds);
  if (layouts.optionKeys) {
    next.optionKeys = Object.fromEntries(
      Object.entries(layouts.optionKeys).map(([group, options]: [string, any]) => [
        group,
        Object.fromEntries(
          Object.entries(options).map(([option, keys]: [string, any]) => [
            option,
            Array.isArray(keys) ? keys.filter(inBounds) : keys,
          ]),
        ),
      ]),
    );
  }
  return next;
};

/**
 * `validateLayouts()` / `kleLayoutToVIALayout()` only return geometry
 * (width/height/optionKeys/keys). The author's own layout metadata has to be
 * carried over: without `labels` every layout option key (split backspace,
 * right shift, bottom row, ...) silently disappears from the keyboard, the
 * layout options menu renders empty and the whole matrix looks misaligned.
 */
const withLayoutMetadata = (
  raw: Record<string, any>,
  parsedLayouts: any,
): any => {
  if (!raw.layouts || typeof raw.layouts !== 'object') {
    return parsedLayouts;
  }
  const {keymap: _keymap, ...metadata} = raw.layouts;
  return {...metadata, ...parsedLayouts};
};

/**
 * Two keys pointing at the same matrix cell cannot be addressed independently:
 * VIA renders both, paints the same keycode on each and writes to one cell.
 * Keep the first occurrence and record the duplicate so it shows up in the
 * import notes instead of quietly breaking the layout.
 */
const dropDuplicateMatrixKeys = (layouts: any, notes: string[]): any => {
  if (!layouts || !Array.isArray(layouts.keys)) {
    return layouts;
  }
  const seen = new Set<string>();
  const duplicates: string[] = [];
  const keys = layouts.keys.filter((key: any) => {
    const id = `${key?.row},${key?.col}`;
    if (seen.has(id)) {
      duplicates.push(id);
      return false;
    }
    seen.add(id);
    return true;
  });
  if (!duplicates.length) {
    return layouts;
  }
  notes.push(`Ignored duplicate matrix position(s): ${duplicates.join(' ')}`);
  return {...layouts, keys};
};

const safeLayouts = (
  raw: Record<string, any>,
  notes: string[],
): any => {
  try {
    return filterOutOfBoundsKeys(
      withLayoutMetadata(raw, validateLayouts(raw.layouts)),
      raw.matrix,
      notes,
    );
  } catch (error) {
    // Missing layout labels are common in older drafts. The KLE parser can
    // still produce a usable layout; the option groups are simply empty.
    notes.push('Incomplete layout labels; restored layout from raw KLE data');
  }
  const fallback = kleLayoutToVIALayout(raw.layouts.keymap);
  return filterOutOfBoundsKeys(
    withLayoutMetadata(raw, fallback),
    raw.matrix,
    notes,
  );
};

const normalizeLighting = (raw: Record<string, any>, notes: string[]): void => {
  const lighting = raw.lighting;
  const known = [
    'none',
    'qmk_backlight',
    'qmk_rgblight',
    'qmk_backlight_rgblight',
    'wt_rgb_backlight',
    'wt_mono_backlight',
  ];
  // Upstream VIA requires `lighting`, but vendor definitions frequently omit
  // it. Treat a missing value as "no lighting" so the strict reader accepts the
  // file instead of dropping into compatibility mode.
  if (lighting === undefined || lighting === null || lighting === '') {
    raw.lighting = 'none';
    notes.push('No lighting declared; treated as no lighting');
    return;
  }
  if (typeof lighting === 'string' && !known.includes(lighting)) {
    raw.lighting = 'none';
    notes.push(`Unknown lighting type ${lighting}; treated as no lighting`);
  } else if (lighting && typeof lighting === 'object') {
    if (typeof lighting.extends !== 'string' || !known.includes(lighting.extends)) {
      raw.lighting = 'none';
      notes.push('Invalid lighting inheritance; treated as no lighting');
    }
  }
};

const convertV3 = (
  source: Record<string, any>,
  notes: string[],
): VIADefinitionV3 => {
  const raw = clone(source);
  normalizeV3Keycodes(raw, notes);
  normalizeMenus(raw, notes);
  let definition: VIADefinitionV3;
  try {
    definition = keyboardDefinitionV3ToVIADefinitionV3(raw as any);
  } catch {
    notes.push('Definition schema repaired automatically (compatibility mode)');
    definition = {
      name: raw.name ?? 'Unknown keyboard',
      vendorProductId: getVendorProductId(raw as any),
      firmwareVersion: Number(raw.firmwareVersion) || 0,
      menus: Array.isArray(raw.menus) ? raw.menus : [],
      keycodes: Array.isArray(raw.keycodes) ? raw.keycodes : [],
      customKeycodes: raw.customKeycodes,
      matrix: raw.matrix,
      layouts: safeLayouts(raw, notes),
    } as VIADefinitionV3;
  }
  return {
    ...definition,
    layouts: dropDuplicateMatrixKeys(definition.layouts, notes),
  };
};

const convertV2 = (
  source: Record<string, any>,
  notes: string[],
): VIADefinitionV2 => {
  const raw = clone(source);
  normalizeLighting(raw, notes);
  let definition: VIADefinitionV2;
  try {
    definition = keyboardDefinitionV2ToVIADefinitionV2(raw as any);
  } catch {
    notes.push('Definition schema repaired automatically (compatibility mode)');
    definition = {
      name: raw.name ?? 'Unknown keyboard',
      vendorProductId: getVendorProductId(raw as any),
      lighting: raw.lighting ?? 'none',
      matrix: raw.matrix,
      customFeatures: raw.customFeatures,
      customKeycodes: raw.customKeycodes,
      customMenus: raw.customMenus,
      layouts: safeLayouts(raw, notes),
    } as VIADefinitionV2;
  }
  return {
    ...definition,
    layouts: dropDuplicateMatrixKeys(definition.layouts, notes),
  };
};

/** Parse a single JSON value that already came from JSON.parse. */
export const parseDefinition = (input: unknown): ParsedDefinition => {
  const raw = asObject(input);

  // Already in VIA's internal shape (bundled definitions and some files in the
  // wild use `vendorProductId` instead of vendorId/productId).
  if (isVIADefinitionV2(raw)) {
    return {version: 'v2', definition: raw, notes: []};
  }
  if (isVIADefinitionV3(raw)) {
    return {version: 'v3', definition: raw, notes: []};
  }

  // Internal VIA definition with a repairable schema drift (e.g. a stale
  // qmk_lighting module). Layouts are already expanded, so rebuild in place
  // instead of running the KLE converter.
  if (
    typeof raw.vendorProductId === 'number' &&
    raw.matrix &&
    raw.layouts?.keys
  ) {
    const notes: string[] = [];
    const repaired = clone(raw);
    const isV3Shape = 'menus' in repaired || 'keycodes' in repaired;
    if (isV3Shape) {
      normalizeV3Keycodes(repaired, notes);
      normalizeMenus(repaired, notes);
      return {
        version: 'v3',
        definition: {
          ...repaired,
          layouts: dropDuplicateMatrixKeys(repaired.layouts, notes),
        } as VIADefinitionV3,
        notes,
      };
    }
    normalizeLighting(repaired, notes);
    return {
      version: 'v2',
      definition: {
        ...repaired,
        layouts: dropDuplicateMatrixKeys(repaired.layouts, notes),
      } as VIADefinitionV2,
      notes,
    };
  }

  if (!raw.name || !raw.vendorId || !raw.productId || !raw.matrix) {
    throw new DefinitionImportError(
      'Missing required fields: name / vendorId / productId / matrix',
    );
  }

  const notes: string[] = [];
  const preferV2 = looksLikeV2(raw) && !looksLikeV3(raw);
  const order: DefinitionVersion[] = preferV2 ? ['v2', 'v3'] : ['v3', 'v2'];
  const failures: string[] = [];

  for (const version of order) {
    try {
      return version === 'v2'
        ? {version, definition: convertV2(raw, notes), notes}
        : {version, definition: convertV3(raw, notes), notes};
    } catch (error) {
      failures.push(`${version}: ${errorText(error)}`);
      notes.length = 0;
    }
  }
  throw new DefinitionImportError(failures.join('；'));
};

/** Parse the text of a `.json` definition file (object or array). */
export const parseDefinitionText = (text: string): ParsedDefinition[] => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new DefinitionImportError(`JSON syntax error: ${errorText(error)}`);
  }
  const list = Array.isArray(value) ? value : [value];
  if (!list.length) {
    throw new DefinitionImportError('The file contains no keyboard definition');
  }
  return list.map(parseDefinition);
};
