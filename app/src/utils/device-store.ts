import {current} from '@reduxjs/toolkit';
import {
  DefinitionVersionMap,
  getTheme,
  KeyboardDefinitionIndex,
  KeyboardDictionary,
  ThemeDefinition,
} from '@the-via/reader';
import {TestKeyboardSoundsMode} from 'src/components/void/test-keyboard-sounds';
import {THEMES} from 'src/utils/themes';
import {Store} from '../shims/via-app-store';
import type {
  AuthorizedDevice,
  DefinitionIndex,
  Settings,
  VendorProductIdMap,
} from '../types/types';
import {getVendorProductId} from './hid-keyboards';
let deviceStore: Store;
const defaultStoreData = {
  definitionIndex: {
    generatedAt: -1,
    hash: '',
    version: '2.0.0',
    theme: getTheme(),
    accentColor: '#ad7070',
    supportedVendorProductIdMap: {},
  },
  definitions: {},
  settings: {
    showDesignTab: true,
    showConsoleTab: false,
    disableFastRemap: false,
    ShowSliderValuesMode: 'Slider Only' as const,
    renderMode: '2D' as const,
    themeMode: 'dark' as const,
    uiScale: 1,
    designDefinitionVersion: 'v3' as const,
    themeName: 'ERROR',
    hostKeyboardLayout: 'keymap_us',
    macroEditor: {
      smartOptimizeEnabled: true,
      recordDelaysEnabled: false,
      tapEnterAtEOMEnabled: false,
    },
    testKeyboardSoundsSettings: {
      isEnabled: true,
      volume: 100,
      waveform: 'sine' as const,
      mode: TestKeyboardSoundsMode.WickiHayden,
      transpose: 0,
    },
  },
};

function initDeviceStore() {
  deviceStore = new Store(defaultStoreData);
  // One-time appearance migration from the 1.0.x build: its default keycap
  // palette (OLIVIA_DARK) predates the new light/dark design. Keep explicit
  // non-default choices untouched.
  try {
    const settings = deviceStore.get('settings');
    const migrated = localStorage.getItem('kstar-ui-migrated-v5');
    if (!migrated) {
      const previousDefaults = [
        'OLIVIA_DARK',
        'STARTHOCK_DARK',
        'STARTHOCK_LIGHT',
        'SHANZI_LIGHT',
        'ERROR_DARK',
        'ZIYUN',
      ];
      if (previousDefaults.includes(settings?.themeName)) {
        deviceStore.set('settings', {
          ...settings,
          themeName: settings.themeMode === 'light' ? 'OLIVIA' : 'ERROR',
        });
      }
    }
    localStorage.setItem('kstar-ui-migrated-v5', '1');
  } catch {
    // ignore storage issues
  }
}

initDeviceStore();

// TODO: invalidate cache if we change cache structure

/** Retreives the latest definition index and invalidates the definition cache if a new one is found */
export async function syncStore(): Promise<DefinitionIndex> {
  const currentDefinitionIndex = deviceStore.get('definitionIndex');

  // TODO: fall back to cache if can't hit endpoint, notify user
  try {
    // Get hash file
    //    const hash = await (await fetch('/definitions/hash.json')).json();
    const hash = document.getElementById('definition_hash')?.dataset.hash || '';

    if (hash === currentDefinitionIndex.hash) {
      return currentDefinitionIndex;
    }
    // Get definition index file
    const response = await fetch('/definitions/supported_kbs.json', {
      cache: 'reload',
    });
    const json: KeyboardDefinitionIndex = await response.json();

    // TODO: maybe we should just export this shape from keyboards repo
    // v3 is a superset of v2 - if the def is avail in v2, it is also avail in v3
    const v2vpidMap = json.vendorProductIds.v2.reduce(
      (acc: VendorProductIdMap, id) => {
        acc[id] = acc[id] || {};
        acc[id].v2 = acc[id].v3 = true;
        return acc;
      },
      {},
    );

    const vpidMap = json.vendorProductIds.v3.reduce(
      (acc: VendorProductIdMap, def) => {
        acc[def] = acc[def] || {};
        acc[def].v3 = true;
        return acc;
      },
      v2vpidMap,
    );

    const newIndex = {
      ...json,
      hash,
      supportedVendorProductIdMap: vpidMap,
    };
    deviceStore.set('definitionIndex', newIndex);
    deviceStore.set('definitions', {});

    return newIndex;
  } catch (e) {
    console.warn(e);
  }

  return currentDefinitionIndex;
}

export const getMissingDefinition = async <
  K extends keyof DefinitionVersionMap,
>(
  device: AuthorizedDevice,
  version: K,
): Promise<[DefinitionVersionMap[K], K]> => {
  const vpid = getVendorProductId(device.vendorId, device.productId);
  const url = `/definitions/${version}/${vpid}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const json: DefinitionVersionMap[K] = await response.json();
  let definitions = deviceStore.get('definitions');
  const newDefinitions = {
    ...definitions,
    [vpid]: {
      ...definitions[vpid],
      [version]: json,
    },
  };

  try {
    deviceStore.set('definitions', newDefinitions);
  } catch (err) {
    // This is likely due to running out of space, so we clear it
    localStorage.clear();
    initDeviceStore();
    definitions = deviceStore.get('definitions');
    deviceStore.set('definitions', {
      ...definitions,
      [vpid]: {
        ...definitions[vpid],
        [version]: json,
      },
    });
  }
  return [json, version];
};

/**
 * Fetch the definition a device asks for, then fall back to the other
 * generation. Old firmwares (protocol < 11) ask for v2, but plenty of modern
 * boards only ship a v2 definition, and vice versa. Recognition should not
 * depend on the user manually flipping a compatibility switch.
 */
export const getMissingDefinitionWithFallback = async (
  device: AuthorizedDevice,
  preferred: 'v2' | 'v3',
): Promise<[DefinitionVersionMap['v2'] | DefinitionVersionMap['v3'], 'v2' | 'v3']> => {
  const order: ('v2' | 'v3')[] = preferred === 'v2' ? ['v2', 'v3'] : ['v3', 'v2'];
  const failures: string[] = [];
  for (const version of order) {
    try {
      return await getMissingDefinition(device, version);
    } catch (error) {
      failures.push(`${version}: ${error instanceof Error ? error.message : error}`);
    }
  }
  throw new Error(failures.join('；'));
};

export const getSupportedIdsFromStore = (): VendorProductIdMap =>
  deviceStore.get('definitionIndex')?.supportedVendorProductIdMap;

export const getDefinitionsFromStore = (): KeyboardDictionary =>
  deviceStore.get('definitions');

export const getThemeFromStore = (): ThemeDefinition =>
  THEMES[getThemeNameFromStore() as keyof typeof THEMES] ||
  deviceStore.get('definitionIndex')?.theme;

export const getThemeModeFromStore = (): 'dark' | 'light' => {
  return deviceStore.get('settings')?.themeMode;
};

export const getShowSliderValuesModeFromStore = (): 'Slider & Show Value' | 'Slider & Input Field' | 'Slider Only' => {
  return deviceStore.get('settings')?.ShowSliderValuesMode;
};

export const getRenderModeFromStore = (): '3D' | '2D' => {
  return deviceStore.get('settings')?.renderMode;
};

export const getThemeNameFromStore = () => {
  return deviceStore.get('settings')?.themeName;
};

export const getSettings = (): Settings => deviceStore.get('settings');

export const setSettings = (settings: Settings) => {
  deviceStore.set('settings', current(settings));
};
