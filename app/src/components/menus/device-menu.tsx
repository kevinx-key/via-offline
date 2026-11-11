import {useEffect, useMemo, useState} from 'react';
import styled from 'styled-components';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {
  faAngleDown,
  faKeyboard,
  faMagnifyingGlass,
  faPlug,
  faRotate,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getConnectedDevices,
  getInvalidProtocolDevices,
  getIsSelectedDeviceReady,
  getSelectedConnectedDevice,
  getSelectedDevicePath,
  getUnresolvedDefinitionDevices,
} from 'src/store/devicesSlice';
import {getDefinitions} from 'src/store/definitionsSlice';
import {
  requestDeviceFromUser,
  reloadConnectedDevices,
  selectConnectedDeviceByPath,
} from 'src/store/devicesThunks';
import {formatNumberAsHex} from 'src/utils/format';
import {resolveDefinitionName} from 'src/utils/definition-name';
import {isNativeDesktop, nativeBridge} from 'src/utils/native';
import {useTranslation} from 'react-i18next';

const Wrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const Trigger = styled.button<{$connected: boolean}>`
  height: 34px;
  max-width: 260px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 9px;
  border: 1px solid var(--border_color_cell);
  background: var(--bg_menu);
  color: var(--color_label-highlighted);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    border-color: var(--color_accent);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
    background: ${(p) => (p.$connected ? 'var(--color_success)' : 'var(--color_label)')};
    box-shadow: ${(p) =>
      p.$connected ? '0 0 0 3px var(--bg_success-soft)' : 'none'};
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Cover = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
`;

const Popover = styled.div`
  position: absolute;
  z-index: 41;
  top: 42px;
  right: 0;
  width: 340px;
  max-height: min(560px, calc(100vh - 90px));
  overflow: auto;
  border-radius: 12px;
  border: 1px solid var(--border_color_cell);
  background: var(--bg_menu);
  box-shadow: var(--shadow-3);
  padding: 6px;
`;

const Section = styled.div`
  padding: 8px 9px 5px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color_label);
`;

const Item = styled.button<{$selected?: boolean}>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid transparent;
  border-radius: 9px;
  padding: 9px 9px;
  background: ${(p) => (p.$selected ? 'var(--bg_accent-soft)' : 'transparent')};
  color: var(--color_label-highlighted);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--bg_control);
  }
  ${(p) => p.$selected && 'border-color: var(--color_accent);'}
`;

const ItemIcon = styled.span`
  width: 30px;
  height: 30px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--bg_control);
  color: var(--color_label);
`;

const ItemBody = styled.span`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  .title {
    font-size: 12.5px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--color_label);
  }
`;

const Action = styled.button`
  width: 100%;
  height: 34px;
  margin-top: 4px;
  border-radius: 8px;
  border: 1px solid var(--border_color_cell);
  background: var(--bg_control);
  color: var(--color_label-highlighted);
  font: inherit;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  cursor: pointer;

  &:hover {
    border-color: var(--color_accent);
    color: var(--color_accent);
  }
  &.primary {
    background: var(--color_accent);
    color: var(--color_inside-accent);
    border-color: var(--color_accent);
    font-weight: 600;
  }
  &.primary:hover {
    filter: brightness(0.94);
    color: var(--color_inside-accent);
  }
`;

const Note = styled.div`
  color: var(--color_label);
  font-size: 10.5px;
  line-height: 1.5;
  padding: 7px 9px 4px;
`;

const Empty = styled.div`
  color: var(--color_label);
  font-size: 12px;
  line-height: 1.6;
  padding: 10px 9px;
`;

export const DeviceMenu = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const connected = useAppSelector(getConnectedDevices);
  const selected = useAppSelector(getSelectedConnectedDevice);
  const selectedPath = useAppSelector(getSelectedDevicePath);
  const ready = useAppSelector(getIsSelectedDeviceReady);
  const definitions = useAppSelector(getDefinitions);
  const unresolved = useAppSelector(getUnresolvedDefinitionDevices);
  const invalid = useAppSelector(getInvalidProtocolDevices);

  const devices = useMemo(
    () => Object.entries(connected).map(([path, device]) => ({path, device})),
    [connected],
  );
  const unresolvedList = useMemo(() => Object.values(unresolved), [unresolved]);
  const invalidList = useMemo(() => Object.values(invalid), [invalid]);

  useEffect(() => {
    if (!nativeBridge) return;
    return nativeBridge.onHidSelectionChanged((payload) => {
      dispatch(
        reloadConnectedDevices({
          allowUnsupported: !!payload?.allowUnsupported,
        }),
      );
    });
  }, [dispatch]);

  const selectedDefinition = selected
    ? definitions[selected.vendorProductId]?.[
        selected.requiredDefinitionVersion
      ]
    : undefined;
  const label = selectedDefinition
    ? resolveDefinitionName(selectedDefinition.name)
    : selected?.productName || t('Select keyboard');

  const request = async (showAll = false) => {
    setOpen(false);
    await dispatch(requestDeviceFromUser({showAll}));
  };

  return (
    <Wrapper>
      <Trigger
        $connected={!!selected && ready}
        onClick={() => setOpen((value) => !value)}
        title={t('Device manager')}
      >
        <span className="dot" />
        <span className="name">{label}</span>
        <FontAwesomeIcon icon={faAngleDown} style={{opacity: 0.65}} />
      </Trigger>

      {open && (
        <>
          <Cover onClick={() => setOpen(false)} />
          <Popover>
            <Section>{t('Connected keyboards')}</Section>
            {devices.length ? (
              devices.map(({path, device}) => {
                const definition =
                  definitions[device.vendorProductId]?.[
                    device.requiredDefinitionVersion
                  ];
                return (
                  <Item
                    key={path}
                    $selected={path === selectedPath}
                    onClick={() => {
                      dispatch(selectConnectedDeviceByPath(path));
                      setOpen(false);
                    }}
                  >
                    <ItemIcon>
                      <FontAwesomeIcon icon={faKeyboard} />
                    </ItemIcon>
                    <ItemBody>
                      <span className="title">
                        {definition
                          ? resolveDefinitionName(definition.name)
                          : device.productName || path}
                      </span>
                      <span className="meta">
                        {formatNumberAsHex(device.vendorId, 4)}:
                        {formatNumberAsHex(device.productId, 4)} ·{' '}
                        {device.requiredDefinitionVersion.toUpperCase()} ·{' '}
                        {t('Protocol')} {device.protocol}
                      </span>
                    </ItemBody>
                    {path === selectedPath && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 99,
                          background: 'var(--color_success)',
                          flex: 'none',
                        }}
                      />
                    )}
                  </Item>
                );
              })
            ) : (
              <Empty>
                {t(
                  'No authorised keyboard yet. Click “Choose keyboard” to pick one.',
                )}
              </Empty>
            )}

            {(unresolvedList.length > 0 || invalidList.length > 0) && (
              <>
                <Section>{t('Needs attention')}</Section>
                {unresolvedList.map((device) => (
                  <Item key={device.path} onClick={() => setOpen(false)}>
                    <ItemIcon>
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        style={{color: 'var(--color_warning)'}}
                      />
                    </ItemIcon>
                    <ItemBody>
                      <span className="title">
                        {device.productName || t('this keyboard')}
                      </span>
                      <span className="meta">
                        {formatNumberAsHex(device.vendorId, 4)}:
                        {formatNumberAsHex(device.productId, 4)} ·{' '}
                        {t('No matching definition')}
                      </span>
                    </ItemBody>
                  </Item>
                ))}
                {invalidList.map((device) => (
                  <Item key={device.path} onClick={() => setOpen(false)}>
                    <ItemIcon>
                      <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        style={{color: 'var(--color_warning)'}}
                      />
                    </ItemIcon>
                    <ItemBody>
                      <span className="title">
                        {device.productName || t('this device')}
                      </span>
                      <span className="meta">
                        {formatNumberAsHex(device.vendorId, 4)}:
                        {formatNumberAsHex(device.productId, 4)} ·{' '}
                        {t('Not a VIA keyboard')}
                      </span>
                    </ItemBody>
                  </Item>
                ))}
              </>
            )}

            <Section>{t('Actions')}</Section>
            <Action onClick={() => request(true)} className="primary">
              <FontAwesomeIcon icon={faPlug} />
              {t('Choose keyboard')}
            </Action>
            <Action onClick={() => request(false)}>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              {t('Show VIA devices only')}
            </Action>
            <Action
              onClick={() => {
                setOpen(false);
                dispatch(reloadConnectedDevices());
              }}
            >
              <FontAwesomeIcon icon={faRotate} />
              {t('Rescan authorised devices')}
            </Action>
            <Note>
              {t(
                '“Choose keyboard” opens the system HID picker. Use “Show all HID devices” if your board does not appear in the filtered list.',
              )}
              {!isNativeDesktop &&
                ` ${t('In a browser, only devices allowed by the browser picker are visible.')}`}
            </Note>
          </Popover>
        </>
      )}
    </Wrapper>
  );
};
