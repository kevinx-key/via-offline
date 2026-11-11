import getIconColor from '../icons/get-icon-color';
import styled from 'styled-components';

export const Grid = styled.div`
  height: 100%;
  width: 100%;
  display: grid;
  grid-template-columns: min-content min-content minmax(0, 1fr);

  > div {
    pointer-events: all;
  }
`;

export const Cell = styled.div`
  border-right: 1px solid var(--border_color_cell);
`;

export const MenuCell = styled(Cell)`
  background: var(--bg_menu);
  border-top: 1px solid var(--border_color_cell);
  min-height: 0;

  overflow-x: hidden;
  overflow-y: auto;

  direction: rtl;

  width: fit-content;

  padding: 0 6px 0 0;

  > * {
    direction: ltr;
    width: fit-content;
  }
`;

export const OverflowCell = styled(Cell)`
  border-top: 1px solid var(--border_color_cell);
  overflow: auto;
`;

export const SpanOverflowCell = styled(Cell)`
  border-top: 1px solid var(--border_color_cell);
  overflow: auto;
  grid-column: span 2;
`;

export const SubmenuCell = styled(Cell)`
  border-top: 1px solid var(--border_color_cell);
  background: var(--bg_control);
`;

export const SubmenuOverflowCell = styled(SubmenuCell)`
  min-width: 80px;
  overflow: auto;
  overflow-x: hidden; /* Override just the horizontal part */
`;

export const SinglePaneFlexCell = styled(Cell)`
  display: flex;
  overflow: hidden;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
`;

export const ConfigureFlexCell = styled(SinglePaneFlexCell)`
  pointer-events: none;
  height: 500px;
`;

export const CategoryIconContainer = styled.span<{$selected?: boolean}>`
  position: relative;
  color: ${(props) =>
    props.$selected ? 'var(--color_accent)' : 'var(--color_label)'};
  height: 34px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.$selected ? 'var(--bg_accent-soft)' : 'transparent'};
  border: 1px solid
    ${(props) => (props.$selected ? 'var(--border_accent-soft)' : 'transparent')};
  border-radius: 9px;
  width: 34px;
  font-size: 14px;
  transition: all 0.16s ease;

  &:hover {
    color: var(--color_accent);
    background: var(--bg_accent-soft);

    & .tooltip {
      transform: scale(1) translateX(0px);
      opacity: 1;
    }
  }

  .tooltip {
    transform: translateX(-5px) scale(0.6);
    opacity: 0;
  }
`;

export const IconContainer = styled.span`
  display: inline-block;
  text-align: center;
  width: 35px;
  position: relative;

  &:hover > span > div {
    background-color: red;
  }
`;

export const ControlRow = styled.div`
  position: relative;
  width: 100%;
  max-width: 960px;
  border-bottom: 1px solid var(--border_color_cell);
  font-size: 13.5px;
  justify-content: space-between;
  display: flex;
  align-items: center;
  line-height: 1.35;
  min-height: 44px;
  box-sizing: border-box;
  padding: 5px 8px;

  &:last-child {
    border-bottom: none;
  }
`;

export const IndentedControlRow = styled(ControlRow)`
  padding-left: 18px;
`;

export const Label = styled.label`
  color: var(--color_label-highlighted);
  font-weight: 500;
  font-size: 13px;
`;

export const SubLabel = styled(Label)`
  font-size: 12px;
  font-style: italic;
  font-weight: 400;
  color: var(--color_label);
`;

export const Detail = styled.span`
  color: var(--color_accent);
  display: flex;
  align-items: center;
`;

export const Row = styled.div<{$selected: boolean}>`
  cursor: pointer;
  white-space: nowrap;
  margin-bottom: 4px;
  font-size: 12.5px;
  line-height: 34px;
  color: ${(props) => getIconColor(props.$selected).style.color};
  border-left: 2px solid transparent;
  border-radius: 8px;
  padding: 0 6px;
  transition: all 0.16s ease;

  svg {
    height: 17px;
    vertical-align: middle;
  }

  &:hover {
    color: var(--color_label-highlighted);
    background: var(--bg_control);

    & .tooltip {
      transform: scale(1) translateX(0px);
      opacity: 1;
    }
  }

  .tooltip {
    transform: translateX(-5px) scale(0.6);
    opacity: 0;
  }
`;

export const SubmenuRow = styled(Row)`
  background: ${(props) => (props.$selected ? 'var(--bg_icon)' : 'inherit')};
  padding: 4px 8px;
  font-weight: 400;
  min-width: min-content;
  border-color: transparent;
  margin-bottom: 11px;
  color: ${(props) =>
    props.$selected ? 'var(--color_label-highlighted)' : 'var(--color_label)'};
  border-radius: 12px;
`;
