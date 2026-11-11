import React, {useEffect, useMemo, useState} from 'react';
import styled from 'styled-components';
import {Link, useLocation} from 'wouter';
import PANES from '../../utils/pane-config';
import {useAppSelector} from 'src/store/hooks';
import {
  getGlobalCaptureEnabled,
  getShowConsoleTab,
  getShowDesignTab,
} from 'src/store/settingsSlice';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
  faCircle,
  faMinus,
  faSquare,
  faClone,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {nativeBridge} from 'src/utils/native';
import {ErrorLink, ErrorsPaneConfig} from '../panes/errors';
import {ExternalLinks} from './external-links';
import {useTranslation} from 'react-i18next';
import {LanguageSelect} from './language-select';
import {BuildBadge} from './build-badge';
import {ThemeToggle} from './theme-toggle';
import {DeviceMenu} from './device-menu';

const Bar = styled.header`
  width: 100%;
  height: 58px;
  flex: none;
  padding: 0 14px;
  border-bottom: 1px solid var(--border_color_cell);
  background: var(--bg_outside-accent);
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  z-index: 30;
  box-sizing: border-box;
  -webkit-app-region: drag;
  user-select: none;
`;

const Left = styled.div`
  display: flex;
  align-items: center;
  flex: none;
  min-width: 0;
  -webkit-app-region: drag;

  @media (max-width: 1200px) {
    .badge-sub {
      display: none;
    }
  }
`;

const Nav = styled.nav`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  overflow: hidden;
  -webkit-app-region: drag;

  > * {
    -webkit-app-region: no-drag;
  }
`;

const NavItem = styled.div<{$selected?: boolean}>`
  height: 38px;
  padding: 0 12px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  color: ${(p) =>
    p.$selected ? 'var(--color_accent)' : 'var(--color_label)'};
  background: ${(p) => (p.$selected ? 'var(--bg_accent-soft)' : 'transparent')};
  border: 1px solid
    ${(p) => (p.$selected ? 'var(--border_accent-soft)' : 'transparent')};
  transition: all 0.16s ease;
  white-space: nowrap;
  flex: none;

  svg {
    font-size: 14px;
    opacity: ${(p) => (p.$selected ? 1 : 0.85)};
  }

  .label {
    font-size: 12.5px;
    font-weight: ${(p) => (p.$selected ? 600 : 500)};
    letter-spacing: 0.01em;
  }

  &:hover {
    color: var(--color_accent);
    background: var(--bg_accent-soft);
  }

  @media (max-width: 1120px) {
    padding: 0 9px;
    .label {
      display: none;
    }
  }
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex: none;
  -webkit-app-region: drag;

  > * {
    -webkit-app-region: no-drag;
  }
`;

const WindowControls = styled.div`
  display: flex;
  align-items: stretch;
  align-self: stretch;
  margin: 0 -14px 0 4px;
  -webkit-app-region: no-drag;
`;

const WindowButton = styled.button<{$close?: boolean}>`
  width: 44px;
  border: none;
  background: transparent;
  color: var(--color_label);
  font-size: 10px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;

  &:hover {
    background: ${(p) =>
      p.$close ? '#e81123' : 'var(--bg_control)'};
    color: ${(p) => (p.$close ? '#fff' : 'var(--color_label-highlighted)')};
  }
`;

const CapturePill = styled.button`
  height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid var(--color_danger);
  background: var(--bg_danger-soft);
  color: var(--color_danger);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  svg {
    font-size: 7px;
    animation: capture-pulse 1.2s ease-in-out infinite;
  }

  @keyframes capture-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.25;
    }
  }
`;

const {DEBUG_PROD, MODE, DEV} = import.meta.env;
const showDebugPane = MODE === 'development' || DEBUG_PROD === 'true' || DEV;

export const UnconnectedGlobalMenu = () => {
  const {t} = useTranslation();
  const showDesignTab = useAppSelector(getShowDesignTab);
  const showConsoleTab = useAppSelector(getShowConsoleTab);
  const captureEnabled = useAppSelector(getGlobalCaptureEnabled);
  const [location, setLocation] = useLocation();
  const [maximized, setMaximized] = useState(false);
  const bridge = nativeBridge;

  useEffect(() => {
    if (!bridge) return;
    bridge.isWindowMaximized().then((result) => {
      setMaximized(!!result.maximized);
    });
    return bridge.onWindowMaximizedChange((value) => {
      setMaximized(!!value);
    });
  }, [bridge]);

  const Panes = useMemo(() => {
    return PANES.filter((pane) => pane.key !== ErrorsPaneConfig.key).map(
      (pane) => {
        if (pane.key === 'design' && !showDesignTab) return null;
        if (pane.key === 'console' && !showConsoleTab) return null;
        if (pane.key === 'debug' && !showDebugPane) return null;
        return (
          <Link key={pane.key} to={pane.path}>
            <NavItem $selected={pane.path === location}>
              <FontAwesomeIcon icon={pane.icon} />
              <span className="label">{t(pane.title)}</span>
            </NavItem>
          </Link>
        );
      },
    );
  }, [location, showConsoleTab, showDesignTab, t]);

  return (
    <Bar
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button, a, input')) return;
        if (bridge) bridge.toggleMaximizeWindow();
      }}
    >
      <Left>
        <BuildBadge />
      </Left>
      <Nav>{Panes}</Nav>
      <Right>
        {captureEnabled && (
          <CapturePill
            onClick={() => setLocation('/test')}
            title={t('Global interception is active')}
          >
            <FontAwesomeIcon icon={faCircle} />
            {t('CAPTURING')}
          </CapturePill>
        )}
        <ErrorLink />
        <ThemeToggle />
        <DeviceMenu />
        <LanguageSelect />
        <ExternalLinks />
        {bridge && (
          <WindowControls>
            <WindowButton
              onClick={() => bridge.minimizeWindow()}
              title={t('Minimize')}
            >
              <FontAwesomeIcon icon={faMinus} />
            </WindowButton>
            <WindowButton
              onClick={() => bridge.toggleMaximizeWindow()}
              title={maximized ? t('Restore') : t('Maximize')}
            >
              <FontAwesomeIcon icon={maximized ? faClone : faSquare} />
            </WindowButton>
            <WindowButton
              $close
              onClick={() => bridge.closeWindow()}
              title={t('Close')}
            >
              <FontAwesomeIcon icon={faXmark} />
            </WindowButton>
          </WindowControls>
        )}
      </Right>
    </Bar>
  );
};
