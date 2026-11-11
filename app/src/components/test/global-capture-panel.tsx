import {useEffect, useRef} from 'react';
import styled from 'styled-components';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
  faCircleExclamation,
  faLock,
  faLockOpen,
} from '@fortawesome/free-solid-svg-icons';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getGlobalCaptureEnabled,
  getGlobalCaptureError,
  getGlobalCaptureSupported,
  setGlobalCaptureEnabled,
  setGlobalCaptureError,
} from 'src/store/settingsSlice';
import {canUseGlobalCapture, nativeBridge} from 'src/utils/native';
import {useTranslation} from 'react-i18next';

const Panel = styled.div<{$active: boolean}>`
  margin: 10px 0 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid
    ${(p) => (p.$active ? 'var(--color_accent)' : 'var(--border_color_cell)')};
  background: ${(p) =>
    p.$active ? 'var(--bg_accent-soft)' : 'var(--bg_control)'};
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 960px;
  width: 100%;
`;

const IconBox = styled.div<{$active: boolean}>`
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: ${(p) => (p.$active ? 'var(--color_inside-accent)' : 'var(--color_label)')};
  background: ${(p) => (p.$active ? 'var(--color_accent)' : 'var(--bg_menu)')};
  border: 1px solid var(--border_color_cell);
`;

const Text = styled.div`
  flex: 1;
  min-width: 0;
  line-height: 1.45;
`;

const Title = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color_label-highlighted);
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Hint = styled.div`
  font-size: 11.5px;
  color: var(--color_label);
  margin-top: 2px;
`;

const ErrorText = styled.div`
  font-size: 11.5px;
  color: var(--color_error);
  margin-top: 3px;
`;

const Action = styled.button<{$active: boolean}>`
  flex: none;
  height: 34px;
  min-width: 108px;
  padding: 0 14px;
  border-radius: 8px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  color: ${(p) => (p.$active ? 'var(--color_inside-accent)' : 'var(--color_accent)')};
  background: ${(p) => (p.$active ? 'var(--color_accent)' : 'transparent')};
  border: 1px solid var(--color_accent);
  transition: all 0.16s ease;

  &:hover {
    filter: brightness(0.92);
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--color_success);
  color: #fff;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
`;

export const GlobalCapturePanel = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const enabled = useAppSelector(getGlobalCaptureEnabled);
  const supported = useAppSelector(getGlobalCaptureSupported);
  const error = useAppSelector(getGlobalCaptureError);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stop = async () => {
    try {
      await nativeBridge?.stopGlobalCapture();
    } catch {
      // ignore
    }
    dispatch(setGlobalCaptureEnabled(false));
  };

  useEffect(() => {
    const bridge = nativeBridge;
    if (!bridge) return;
    const offEnded = bridge.onGlobalCaptureEnded((payload) => {
      dispatch(setGlobalCaptureEnabled(false));
      if (payload?.error) {
        dispatch(setGlobalCaptureError(payload.error));
      }
    });
    const onBeforeUnload = () => {
      if (enabledRef.current) bridge.stopGlobalCapture();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      offEnded();
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (enabledRef.current) {
        bridge.stopGlobalCapture();
        dispatch(setGlobalCaptureEnabled(false));
      }
    };
  }, [dispatch]);

  // Hard safety limit: never leave the keyboard swallowed indefinitely.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      stop();
      dispatch(
        setGlobalCaptureError(
          t(
            'Global capture ran for 5 minutes and was stopped automatically to release the keyboard.',
          ),
        ),
      );
    }, 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const toggle = async () => {
    dispatch(setGlobalCaptureError(null));
    if (!nativeBridge || !canUseGlobalCapture) {
      dispatch(
        setGlobalCaptureError(
          t(
            'Global capture is currently Windows-only. Browser and macOS/Linux builds use in-window keys.',
          ),
        ),
      );
      return;
    }
    if (enabled) {
      await stop();
      return;
    }
    const result = await nativeBridge.startGlobalCapture();
    if (result.ok) {
      dispatch(setGlobalCaptureEnabled(true));
      dispatch(setGlobalCaptureError(null));
    } else {
      dispatch(
        setGlobalCaptureError(result.error || t('Could not start global capture')),
      );
    }
  };

  return (
    <Panel $active={enabled}>
      <IconBox $active={enabled}>
        <FontAwesomeIcon icon={enabled ? faLock : faLockOpen} />
      </IconBox>
      <Text>
        <Title>
          {t('Global key interception')}
          {enabled && <Pill>● {t('CAPTURING')}</Pill>}
        </Title>
        <Hint>
          {supported
            ? t(
                'Captures every key on this PC and keeps this window on top. Press Ctrl+Alt+F12 to release immediately.',
              )
            : t('Windows desktop only. The browser and macOS/Linux builds keep using in-window keys.')}
        </Hint>
        {error && <ErrorText>{error}</ErrorText>}
      </Text>
      <Action
        $active={enabled}
        onClick={toggle}
        disabled={!supported && !nativeBridge}
        title={!supported ? t('Windows desktop only') : undefined}
      >
        {enabled ? t('Stop interception') : t('Enable global interception')}
      </Action>
    </Panel>
  );
};
