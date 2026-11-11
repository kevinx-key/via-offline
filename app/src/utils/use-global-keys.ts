import {useEffect, useState} from 'react';
import {TestKeyState} from 'src/types/types';
import {getIndexByEvent} from './key-event';
import {nativeBridge} from './native';
import {vkToDomCode} from './vk-to-code';

type TestKeys = {[code: number]: TestKeyState};

export const useGlobalKeys = (
  enableGlobalKeys: boolean,
  nativeCaptureEnabled = false,
) => {
  const startMatrixTest = !enableGlobalKeys;
  const selectedKeysState = useState<TestKeys>({});
  const [, setSelectedKeys] = selectedKeysState;

  const applyKey = (code: string, state: TestKeyState) => {
    if (!code) return;
    const index = getIndexByEvent({code} as KeyboardEvent);
    if (index < 0) return;
    setSelectedKeys((previous) => {
      if (previous[index] === state) return previous;
      return {...previous, [index]: state};
    });
  };

  useEffect(() => {
    if (enableGlobalKeys && nativeCaptureEnabled && nativeBridge) {
      return nativeBridge.onGlobalKey((event) => {
        const code = vkToDomCode(event.vk, event.scan, event.extended);
        applyKey(
          code,
          event.type === 'down' ? TestKeyState.KeyDown : TestKeyState.KeyUp,
        );
      });
    }

    if (!enableGlobalKeys) {
      return;
    }
    // If pressed key is our target key then set to true
    const downHandler = (evt: KeyboardEvent) => {
      evt.preventDefault();
      if (!startMatrixTest && !evt.repeat) {
        applyKey(evt.code, TestKeyState.KeyDown);
      }
    };

    // If released key is our target key then set to false
    const upHandler = (evt: KeyboardEvent) => {
      evt.preventDefault();
      if (!startMatrixTest) {
        applyKey(evt.code, TestKeyState.KeyUp);
      }
    };

    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [enableGlobalKeys, nativeCaptureEnabled]);

  // Keep the state in sync when the caller clears it (Reset button).
  useEffect(() => {
    if (!enableGlobalKeys) {
      setSelectedKeys({});
    }
  }, [enableGlobalKeys]);

  return selectedKeysState;
};
