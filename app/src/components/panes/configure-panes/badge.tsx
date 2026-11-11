import React, {useMemo, useState} from 'react';
import styled from 'styled-components';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faAngleDown, faPlus} from '@fortawesome/free-solid-svg-icons';
import type {VIADefinitionV2, VIADefinitionV3} from '@the-via/reader';
import type {ConnectedDevice} from '../../../types/types';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getDefinitions,
  getSelectedDefinition,
} from 'src/store/definitionsSlice';
import {
  getConnectedDevices,
  getSelectedDevicePath,
} from 'src/store/devicesSlice';
import {
  requestDeviceFromUser,
  selectConnectedDeviceByPath,
} from 'src/store/devicesThunks';
import {useTranslation} from 'react-i18next';
import {
  getConnectedDefinitionNames,
  getSelectedDefinitionName,
} from 'src/store/definitionNameSlice';

const Container = styled.div`
  position: relative;
  font-size: 12px;
  pointer-events: none;
  font-weight: 500;
  flex: 0 0 auto;
`;

const KeyboardTitle = styled.label`
  pointer-events: all;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--bg_menu);
  border-radius: 9px;
  font-size: 12px;
  color: var(--color_label-highlighted);
  padding: 6px 10px;
  border: 1px solid var(--border_color_cell);
  cursor: pointer;
  transition: all 0.16s ease;
  white-space: nowrap;
  box-shadow: var(--shadow-1);

  &:hover {
    border-color: var(--color_accent);
    color: var(--color_accent);
  }
`;

const KeyboardList = styled.ul<{$show: boolean}>`
  padding: 5px;
  border: 1px solid var(--border_color_cell);
  width: 190px;
  border-radius: 10px;
  background-color: var(--bg_menu);
  box-shadow: var(--shadow-2);
  margin: 0;
  margin-top: 6px;
  right: 0;
  position: absolute;
  pointer-events: ${(props) => (props.$show ? 'all' : 'none')};
  transition: all 0.2s ease-out;
  z-index: 41;
  opacity: ${(props) => (props.$show ? 1 : 0)};
  overflow: hidden;
  transform: ${(props) => (props.$show ? 'translateY(0)' : `translateY(-5px)`)};
`;

const KeyboardButton = styled.button<{$selected?: boolean}>`
  display: block;
  outline: none;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  border: none;
  border-radius: 7px;
  background: ${(props) =>
    props.$selected ? 'var(--bg_accent-soft)' : 'transparent'};
  color: ${(props) =>
    props.$selected
      ? 'var(--color_accent)'
      : 'var(--color_label-highlighted)'};
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  padding: 7px 8px;

  &:hover {
    border: none;
    background: ${(props) =>
      props.$selected ? 'var(--bg_icon-highlighted)' : 'var(--bg_control)'};
    color: ${(props) =>
      props.$selected
        ? 'var(--color_control-highlighted)'
        : 'var(--color_label-highlighted)'};
  }
`;

const ClickCover = styled.div`
  position: fixed;
  z-index: 10;
  pointer-events: all;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.4;
  background: rgba(0, 0, 0, 0.75);
`;

type ConnectedKeyboardDefinition = [
  string,
  VIADefinitionV2 | VIADefinitionV3,
  string,
];

const KeyboardSelectors: React.FC<{
  show: boolean;
  keyboards: ConnectedKeyboardDefinition[];
  selectedPath: string;
  onClickOut: () => void;
  selectKeyboard: (kb: string) => void;
}> = (props) => {
  const {t} = useTranslation();

  const dispatch = useAppDispatch();

  const requestAndChangeDevice = async () => {
    props.onClickOut();
    await dispatch(requestDeviceFromUser());
  };

  return (
    <>
      {props.show && <ClickCover onClick={props.onClickOut} />}

      <KeyboardList $show={props.show}>
        {props.keyboards.map(([path, , name]) => {
          return (
            <KeyboardButton
              $selected={path === props.selectedPath}
              key={path}
              onClick={() => props.selectKeyboard(path as string)}
            >
              {name}
            </KeyboardButton>
          );
        })}

        <KeyboardButton onClick={requestAndChangeDevice}>
          {t('Choose keyboard')}
          <FontAwesomeIcon icon={faPlus} style={{marginLeft: '8px'}} />
        </KeyboardButton>
      </KeyboardList>
    </>
  );
};

export const Badge = () => {
  const dispatch = useAppDispatch();
  const definitions = useAppSelector(getDefinitions);
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const selectedDefinitionName = useAppSelector(getSelectedDefinitionName);
  const getConnectedDefinitionName = useAppSelector(
    getConnectedDefinitionNames,
  );
  const connectedDevices = useAppSelector(getConnectedDevices);
  const selectedPath = useAppSelector(getSelectedDevicePath);
  const [showList, setShowList] = useState(false);

  const connectedKeyboardDefinitions: ConnectedKeyboardDefinition[] = useMemo(
    () =>
      Object.entries(connectedDevices)
        .map<ConnectedKeyboardDefinition>(([path, device]) => {
          const connectedDevice = device as ConnectedDevice;

          return [
            path,
            definitions[connectedDevice.vendorProductId] &&
              definitions[connectedDevice.vendorProductId][
                connectedDevice.requiredDefinitionVersion
              ],
            getConnectedDefinitionName(connectedDevice),
          ];
        })
        .filter((i) => i[1]),
    [connectedDevices, definitions, getConnectedDefinitionName],
  );

  if (!selectedDefinition || !selectedPath) {
    return null;
  }

  return (
    <Container>
      <KeyboardTitle onClick={() => setShowList(!showList)}>
        {selectedDefinitionName}

        <FontAwesomeIcon
          icon={faAngleDown}
          style={{
            transform: showList ? 'rotate(180deg)' : '',
            transition: 'transform 0.2s ease-out',
            marginLeft: '5px',
          }}
        />
      </KeyboardTitle>

      <KeyboardSelectors
        show={showList}
        selectedPath={selectedPath}
        keyboards={connectedKeyboardDefinitions}
        onClickOut={() => setShowList(false)}
        selectKeyboard={(path) => {
          dispatch(selectConnectedDeviceByPath(path));
          setShowList(false);
        }}
      />
    </Container>
  );
};