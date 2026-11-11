import {createSelector, createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {
  MacroEditorSettings,
  Settings,
  TestKeyboardSoundsSettings,
} from '../types/types';
import type {PropertiesOfType} from '../types/generic-types';
import {getSettings, setSettings} from '../utils/device-store';
import type {RootState} from '.';
import {THEMES} from 'src/utils/themes';
import {makeSRGBTheme} from 'src/utils/keyboard-rendering';
import {updateCSSVariables} from 'src/utils/color-math';
import {webGLIsAvailable} from 'src/utils/test-webgl';
import {DefinitionVersion} from '@the-via/reader';
import {applyUiScale, canUseGlobalCapture} from 'src/utils/native';

// TODO: why are these settings mixed? Is it because we only want some of them cached? SHould we rename to "CachedSettings"?
type SettingsState = Settings & {
  isTestMatrixEnabled: boolean;
  restartRequired: boolean;
  allowGlobalHotKeys: boolean;
  showDesignTabConfirmationNotice: boolean;
  globalCaptureEnabled: boolean;
  globalCaptureSupported: boolean;
  globalCaptureError: string | null;
};

const initialState: SettingsState = {
  ...getSettings(),
  isTestMatrixEnabled: false,
  restartRequired: false,
  allowGlobalHotKeys: false,
  showDesignTabConfirmationNotice: false,
  globalCaptureEnabled: false,
  globalCaptureSupported: canUseGlobalCapture,
  globalCaptureError: null,
};

const toggleBool = (
  state: SettingsState,
  key: keyof PropertiesOfType<SettingsState, boolean>,
) => {
  state[key] = !state[key];
  setSettings(state);
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    toggleFastRemap: (state) => {
      toggleBool(state, 'disableFastRemap');
    },
    updateShowSliderValuesMode: (
      state,
      action: PayloadAction<
        'Slider Only' | 'Slider & Show Value' | 'Slider & Input Field'
      >,
    ) => {
      state.ShowSliderValuesMode = action.payload;
      setSettings(state);
    },
    toggleCreatorMode: (state) => {
      toggleBool(state, 'showDesignTab');
    },
    toggleConsoleTab: (state) => {
      toggleBool(state, 'showConsoleTab');
    },
    setShowDesignTab: (state, action: PayloadAction<boolean>) => {
      state.showDesignTab = action.payload;
      setSettings(state);
    },
    setShowDesignTabConfirmationNotice: (state, action: PayloadAction<boolean>) => {
      state.showDesignTabConfirmationNotice = action.payload;
    },
    toggleThemeMode: (state) => {
      const newThemeMode = state.themeMode === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.themeMode = newThemeMode;
      state.themeMode = newThemeMode;
      setSettings(state);
    },
    updateRenderMode: (state, action: PayloadAction<'3D' | '2D'>) => {
      state.renderMode = action.payload;
      setSettings(state);
    },
    updateDesignDefinitionVersion: (
      state,
      action: PayloadAction<DefinitionVersion>,
    ) => {
      state.designDefinitionVersion = action.payload;
      setSettings(state);
    },
    updateThemeName: (state, action: PayloadAction<string>) => {
      state.themeName = action.payload;
      updateCSSVariables(state.themeName as keyof typeof THEMES);
      setSettings(state);
    },
    setThemeMode: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.themeMode = action.payload;
      document.documentElement.dataset.themeMode = action.payload;
      // Tie the keycap palette to the day/night reference photos: 山紫云白
      // for light, ERROR! for dark. The user can still pick another keycap
      // theme afterwards in Settings.
      state.themeName = action.payload === 'light' ? 'OLIVIA' : 'ERROR';
      updateCSSVariables(state.themeName as keyof typeof THEMES);
      setSettings(state);
    },
    setUiScale: (state, action: PayloadAction<number>) => {
      state.uiScale = Math.min(1.5, Math.max(0.75, action.payload));
      applyUiScale(state.uiScale);
      setSettings(state);
    },
    setGlobalCaptureEnabled: (state, action: PayloadAction<boolean>) => {
      state.globalCaptureEnabled = action.payload;
    },
    setGlobalCaptureError: (state, action: PayloadAction<string | null>) => {
      state.globalCaptureError = action.payload;
    },
    setTestMatrixEnabled: (state, action: PayloadAction<boolean>) => {
      state.isTestMatrixEnabled = action.payload;
    },
    setMacroEditorSettings: (
      state,
      action: PayloadAction<Partial<MacroEditorSettings>>,
    ) => {
      const macroEditor = {
        ...state.macroEditor,
        ...action.payload,
      };
      state.macroEditor = macroEditor;
      setSettings(state);
    },
    setTestKeyboardSoundsSettings: (
      state,
      action: PayloadAction<Partial<TestKeyboardSoundsSettings>>,
    ) => {
      const testKeyboardSoundsSettings = {
        ...state.testKeyboardSoundsSettings,
        ...action.payload,
      };
      state.testKeyboardSoundsSettings = testKeyboardSoundsSettings;
      setSettings(state);
    },
    disableGlobalHotKeys: (state) => {
      state.allowGlobalHotKeys = false;
    },
    enableGlobalHotKeys: (state) => {
      state.allowGlobalHotKeys = true;
    },
    updateHostKeyboardLayout: (state, action: PayloadAction<string>) => {
      state.hostKeyboardLayout = action.payload;
      setSettings(state);
    },
  },
});

export const {
  toggleFastRemap,
  updateShowSliderValuesMode,
  toggleCreatorMode,
  toggleConsoleTab,
  setShowDesignTab,
  setTestMatrixEnabled,
  setShowDesignTabConfirmationNotice,
  setTestKeyboardSoundsSettings,
  setMacroEditorSettings,
  toggleThemeMode,
  setThemeMode,
  setUiScale,
  setGlobalCaptureEnabled,
  setGlobalCaptureError,
  disableGlobalHotKeys,
  enableGlobalHotKeys,
  updateRenderMode,
  updateThemeName,
  updateDesignDefinitionVersion,
  updateHostKeyboardLayout,
} = settingsSlice.actions;

export default settingsSlice.reducer;

export const getDesignDefinitionVersion = (state: RootState) =>
  state.settings.designDefinitionVersion;
export const getAllowGlobalHotKeys = (state: RootState) =>
  state.settings.allowGlobalHotKeys;
export const getDisableFastRemap = (state: RootState) =>
  state.settings.disableFastRemap;
export const getShowSliderValuesMode = (state: RootState) =>
  webGLIsAvailable ? state.settings.ShowSliderValuesMode : 'Slider Only';
export const getShowDesignTab = (state: RootState) =>
  state.settings.showDesignTab;
export const getShowConsoleTab = (state: RootState) =>
  state.settings.showConsoleTab;
export const getShowDesignTabConfirmationNotice = (state: RootState) =>
  state.settings.showDesignTabConfirmationNotice;
export const getRestartRequired = (state: RootState) =>
  state.settings.restartRequired;
export const getIsTestMatrixEnabled = (state: RootState) =>
  state.settings.isTestMatrixEnabled;
export const getMacroEditorSettings = (state: RootState) =>
  state.settings.macroEditor;
export const getTestKeyboardSoundsSettings = (state: RootState) =>
  state.settings.testKeyboardSoundsSettings;
export const getRenderMode = (state: RootState) =>
  webGLIsAvailable ? state.settings.renderMode : '2D';
export const getThemeMode = (state: RootState) => state.settings.themeMode;
export const getThemeName = (state: RootState) => state.settings.themeName;
export const getUiScale = (state: RootState) => state.settings.uiScale;
export const getGlobalCaptureEnabled = (state: RootState) =>
  state.settings.globalCaptureEnabled;
export const getGlobalCaptureSupported = (state: RootState) =>
  state.settings.globalCaptureSupported;
export const getGlobalCaptureError = (state: RootState) =>
  state.settings.globalCaptureError;
export const getSelectedTheme = createSelector(getThemeName, (themeName) => {
  return THEMES[themeName as keyof typeof THEMES];
});

export const getSelectedSRGBTheme = createSelector(
  getSelectedTheme,
  (selectedTheme) => {
    return makeSRGBTheme(selectedTheme);
  },
);

export const getHostKeyboardLayout = (state: RootState) =>
  state.settings.hostKeyboardLayout;
