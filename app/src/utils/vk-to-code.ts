/**
 * Map Windows virtual-key + scan code (from the global keyboard hook) to the
 * DOM `KeyboardEvent.code` values the key tester already understands.
 * Scan codes are layout-independent, so they are preferred; VK is a fallback
 * for media keys and unusual drivers.
 */
const SCAN: Record<number, string> = {
  0x01: 'Escape',
  0x02: 'Digit1',
  0x03: 'Digit2',
  0x04: 'Digit3',
  0x05: 'Digit4',
  0x06: 'Digit5',
  0x07: 'Digit6',
  0x08: 'Digit7',
  0x09: 'Digit8',
  0x0a: 'Digit9',
  0x0b: 'Digit0',
  0x0c: 'Minus',
  0x0d: 'Equal',
  0x0e: 'Backspace',
  0x0f: 'Tab',
  0x10: 'KeyQ',
  0x11: 'KeyW',
  0x12: 'KeyE',
  0x13: 'KeyR',
  0x14: 'KeyT',
  0x15: 'KeyY',
  0x16: 'KeyU',
  0x17: 'KeyI',
  0x18: 'KeyO',
  0x19: 'KeyP',
  0x1a: 'BracketLeft',
  0x1b: 'BracketRight',
  0x1c: 'Enter',
  0x1d: 'ControlLeft',
  0x1e: 'KeyA',
  0x1f: 'KeyS',
  0x20: 'KeyD',
  0x21: 'KeyF',
  0x22: 'KeyG',
  0x23: 'KeyH',
  0x24: 'KeyJ',
  0x25: 'KeyK',
  0x26: 'KeyL',
  0x27: 'Semicolon',
  0x28: 'Quote',
  0x29: 'Backquote',
  0x2a: 'ShiftLeft',
  0x2b: 'Backslash',
  0x2c: 'KeyZ',
  0x2d: 'KeyX',
  0x2e: 'KeyC',
  0x2f: 'KeyV',
  0x30: 'KeyB',
  0x31: 'KeyN',
  0x32: 'KeyM',
  0x33: 'Comma',
  0x34: 'Period',
  0x35: 'Slash',
  0x36: 'ShiftRight',
  0x37: 'NumpadMultiply',
  0x38: 'AltLeft',
  0x39: 'Space',
  0x3a: 'CapsLock',
  0x3b: 'F1',
  0x3c: 'F2',
  0x3d: 'F3',
  0x3e: 'F4',
  0x3f: 'F5',
  0x40: 'F6',
  0x41: 'F7',
  0x42: 'F8',
  0x43: 'F9',
  0x44: 'F10',
  0x45: 'NumLock',
  0x46: 'ScrollLock',
  0x47: 'Numpad7',
  0x48: 'Numpad8',
  0x49: 'Numpad9',
  0x4a: 'NumpadSubtract',
  0x4b: 'Numpad4',
  0x4c: 'Numpad5',
  0x4d: 'Numpad6',
  0x4e: 'NumpadAdd',
  0x4f: 'Numpad1',
  0x50: 'Numpad2',
  0x51: 'Numpad3',
  0x52: 'Numpad0',
  0x53: 'NumpadDecimal',
  0x54: 'PrintScreen',
  0x56: 'IntlBackslash',
  0x57: 'F11',
  0x58: 'F12',
  0x59: 'NumpadEqual',
  0x64: 'F13',
  0x65: 'F14',
  0x66: 'F15',
  0x67: 'F16',
  0x68: 'F17',
  0x69: 'F18',
  0x6a: 'F19',
  0x6b: 'F20',
  0x6c: 'F21',
  0x6d: 'F22',
  0x6e: 'F23',
  0x6f: 'F24',
  0x70: 'KanaMode',
  0x73: 'IntlRo',
  0x79: 'Convert',
  0x7b: 'NonConvert',
  0x7d: 'IntlYen',
  0x7e: 'NumpadComma',
};

const EXTENDED_SCAN: Record<number, string> = {
  0x1c: 'NumpadEnter',
  0x1d: 'ControlRight',
  0x35: 'NumpadDivide',
  0x37: 'PrintScreen',
  0x38: 'AltRight',
  0x46: 'Pause',
  0x47: 'Home',
  0x48: 'ArrowUp',
  0x49: 'PageUp',
  0x4b: 'ArrowLeft',
  0x4d: 'ArrowRight',
  0x4f: 'End',
  0x50: 'ArrowDown',
  0x51: 'PageDown',
  0x52: 'Insert',
  0x53: 'Delete',
  0x5b: 'MetaLeft',
  0x5c: 'MetaRight',
  0x5d: 'ContextMenu',
};

const VK: Record<number, string> = {
  0x08: 'Backspace',
  0x09: 'Tab',
  0x0d: 'Enter',
  0x10: 'ShiftLeft',
  0x11: 'ControlLeft',
  0x12: 'AltLeft',
  0x13: 'Pause',
  0x14: 'CapsLock',
  0x1b: 'Escape',
  0x20: 'Space',
  0x21: 'PageUp',
  0x22: 'PageDown',
  0x23: 'End',
  0x24: 'Home',
  0x25: 'ArrowLeft',
  0x26: 'ArrowUp',
  0x27: 'ArrowRight',
  0x28: 'ArrowDown',
  0x2c: 'PrintScreen',
  0x2d: 'Insert',
  0x2e: 'Delete',
  0x5b: 'MetaLeft',
  0x5c: 'MetaRight',
  0x5d: 'ContextMenu',
  0x6a: 'NumpadMultiply',
  0x6b: 'NumpadAdd',
  0x6d: 'NumpadSubtract',
  0x6e: 'NumpadDecimal',
  0x6f: 'NumpadDivide',
  0x90: 'NumLock',
  0x91: 'ScrollLock',
  0xad: 'AudioVolumeMute',
  0xae: 'AudioVolumeDown',
  0xaf: 'AudioVolumeUp',
  0xb0: 'MediaTrackNext',
  0xb1: 'MediaTrackPrevious',
  0xb2: 'MediaStop',
  0xb3: 'MediaPlayPause',
};

for (let index = 0; index < 26; index++) {
  VK[0x41 + index] = `Key${String.fromCharCode(0x41 + index)}`;
}
for (let index = 0; index < 10; index++) {
  VK[0x30 + index] = `Digit${index}`;
}
for (let index = 0; index < 24; index++) {
  VK[0x70 + index] = `F${index + 1}`;
}
for (let index = 0; index < 10; index++) {
  VK[0x60 + index] = `Numpad${index}`;
}
VK[0xba] = 'Semicolon';
VK[0xbb] = 'Equal';
VK[0xbc] = 'Comma';
VK[0xbd] = 'Minus';
VK[0xbe] = 'Period';
VK[0xbf] = 'Slash';
VK[0xc0] = 'Backquote';
VK[0xdb] = 'BracketLeft';
VK[0xdc] = 'Backslash';
VK[0xdd] = 'BracketRight';
VK[0xde] = 'Quote';

export function vkToDomCode(
  vk: number,
  scan: number,
  extended: boolean,
): string {
  // NumLock / Pause share scan code 0x45 with different meanings.
  if (vk === 0x90) return 'NumLock';
  if (vk === 0x13) return 'Pause';
  const byScan = extended ? EXTENDED_SCAN[scan] : undefined;
  if (byScan) return byScan;
  if (!extended && SCAN[scan]) return SCAN[scan];
  if (VK[vk]) return VK[vk];
  return '';
}
