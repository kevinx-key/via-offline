export type GlobalKeyEvent = {
  type: 'down' | 'up';
  vk: number;
  scan: number;
  extended: boolean;
  time: number;
};

export type NativeBridge = {
  isElectron: boolean;
  platform: string;
  startGlobalCapture: () => Promise<{ok: boolean; active?: boolean; error?: string}>;
  stopGlobalCapture: () => Promise<{ok: boolean; active?: boolean}>;
  setAlwaysOnTop: (value: boolean) => Promise<{ok: boolean; value?: boolean}>;
  setZoom: (value: number) => Promise<{ok: boolean; value?: number}>;
  minimizeWindow: () => Promise<{ok: boolean}>;
  toggleMaximizeWindow: () => Promise<{ok: boolean; maximized?: boolean}>;
  isWindowMaximized: () => Promise<{ok: boolean; maximized: boolean}>;
  closeWindow: () => Promise<{ok: boolean}>;
  onWindowMaximizedChange: (
    callback: (maximized: boolean) => void,
  ) => () => void;
  onHidSelectionChanged: (
    callback: (payload?: {allowUnsupported?: boolean}) => void,
  ) => () => void;
  onGlobalKey: (callback: (event: GlobalKeyEvent) => void) => () => void;
  onGlobalCaptureEnded: (
    callback: (payload: {error?: string | null}) => void,
  ) => () => void;
  onGlobalCaptureReady: (callback: (payload: unknown) => void) => () => void;
};

declare global {
  interface Window {
    viaNative?: NativeBridge;
  }
}

export const nativeBridge: NativeBridge | undefined =
  typeof window !== 'undefined' ? window.viaNative : undefined;

export const isNativeDesktop = !!nativeBridge?.isElectron;

export const canUseGlobalCapture =
  !!nativeBridge && nativeBridge.platform === 'win32';

export const applyUiScale = async (scale: number) => {
  const value = Math.min(1.5, Math.max(0.75, Number(scale) || 1));
  if (nativeBridge) {
    return nativeBridge.setZoom(value);
  }
  // Browser fallback: CSS zoom is supported by Chromium and keeps the layout
  // usable without touching every hard-coded pixel value.
  document.documentElement.style.setProperty('--ui-scale', String(value));
  return {ok: true, value};
};
