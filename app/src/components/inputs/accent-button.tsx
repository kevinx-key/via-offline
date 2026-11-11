import styled from 'styled-components';

type AccentButtonProps = {
  disabled?: boolean;
  onClick?: (...a: any[]) => void;
};

const AccentButtonBase = styled.button<AccentButtonProps>`
  height: 34px;
  padding: 0 14px;
  line-height: 32px;
  min-width: 84px;
  text-align: center;
  outline: none;
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 8px;
  color: var(--color_accent);
  border: 1px solid var(--color_accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  pointer-events: ${(props) => (props.disabled ? 'none' : 'auto')};
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  transition: all 0.16s ease;

  &:hover {
    border: 1px solid var(--color_accent);
    filter: brightness(0.95);
  }
`;
export const AccentButton = styled(AccentButtonBase)`
  background-color: ${(props) =>
    props.disabled ? 'var(--bg_control-disabled)' : 'var(--bg_outside-accent)'};
  color: ${(props) =>
    props.disabled ? 'var(--color_control-disabled)' : 'var(--color_accent)'};
  border-color: ${(props) =>
    props.disabled ? 'var(--border_color_cell)' : 'var(--color_accent)'};
`;
export const AccentButtonLarge = styled(AccentButton)`
  font-size: 13px;
  font-weight: 600;
  line-height: 40px;
  height: 40px;
  min-width: 120px;
  padding: 0 18px;
  border-radius: 10px;
`;

export const PrimaryAccentButton = styled(AccentButtonBase)`
  color: ${(props) =>
    props.disabled ? 'var(--color_control-disabled)' : 'var(--color_inside-accent)'};
  border-color: ${(props) =>
    props.disabled ? 'var(--border_color_cell)' : 'var(--color_accent)'};
  background-color: ${(props) =>
    props.disabled ? 'transparent' : 'var(--color_accent)'};
  &:hover {
    filter: brightness(0.94);
  }
`;
