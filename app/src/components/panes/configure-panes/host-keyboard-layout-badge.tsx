import {useState} from 'react';
import {faAngleDown} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import styled from 'styled-components';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getHostKeyboardLayout,
  updateHostKeyboardLayout,
} from 'src/store/settingsSlice';
import {keymapExtras} from 'src/utils/keymap-extras';

const Container = styled.div`
  position: relative;
  font-size: 12px;
  pointer-events: none;
  font-weight: 500;
  flex: 0 0 auto;
`;

const LayoutTitle = styled.label`
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

const LayoutList = styled.ul<{$show: boolean}>`
  padding: 5px;
  border: 1px solid var(--border_color_cell);
  width: 220px;
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
  overflow-y: auto;
  max-height: 400px;
  transform: ${(props) => (props.$show ? 'translateY(0)' : `translateY(-5px)`)};
`;

const LayoutButton = styled.button<{$selected?: boolean}>`
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

const layoutOptions = Object.entries(keymapExtras).map(([key, value]) => ({
  key,
  label: value.label,
}));

export const HostKeyboardLayoutBadge = () => {
  const dispatch = useAppDispatch();
  const hostKeyboardLayout = useAppSelector(getHostKeyboardLayout);
  const [showList, setShowList] = useState(false);

  const currentLabel =
    keymapExtras[hostKeyboardLayout]?.label ?? hostKeyboardLayout;

  return (
    <Container>
      <LayoutTitle onClick={() => setShowList(!showList)}>
        {currentLabel}

        <FontAwesomeIcon
          icon={faAngleDown}
          style={{
            transform: showList ? 'rotate(180deg)' : '',
            transition: 'transform 0.2s ease-out',
            marginLeft: '5px',
          }}
        />
      </LayoutTitle>

      {showList && <ClickCover onClick={() => setShowList(false)} />}

      <LayoutList $show={showList}>
        {layoutOptions.map(({key, label}) => (
          <LayoutButton
            key={key}
            $selected={key === hostKeyboardLayout}
            onClick={() => {
              dispatch(updateHostKeyboardLayout(key));
              setShowList(false);
            }}
          >
            {label}
          </LayoutButton>
        ))}
      </LayoutList>
    </Container>
  );
};