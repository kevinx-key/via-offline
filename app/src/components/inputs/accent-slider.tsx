import React, {useRef} from 'react';
import styled from 'styled-components';

export const HiddenInput = styled.input`
  opacity: 0;
  width: 0;
  height: 0;
`;

const Switch = styled.label`
  position: relative;
  display: inline-block;
  width: 42px;
  height: 24px;
  flex: none;
`;
const Slider = styled.span<{$ischecked?: boolean}>`
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${(props) =>
    props.$ischecked ? 'var(--color_accent)' : 'var(--bg_control-highlighted)'};
  -webkit-transition: 0.18s ease;
  transition: 0.18s ease;
  border-radius: 999px;
  border: 1px solid
    ${(props) =>
      props.$ischecked ? 'var(--color_accent)' : 'var(--border_color_cell)'};
  &:before {
    position: absolute;
    content: '';
    height: 18px;
    width: 18px;
    left: 2px;
    top: 2px;
    border-radius: 50%;
    background-color: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    -webkit-transition: 0.18s ease;
    transition: 0.18s ease;
    ${(props) => (props.$ischecked ? 'transform: translateX(18px)' : '')};
  }
  &:hover {
    filter: brightness(0.96);
  }
`;

type Props = {
  isChecked: boolean;
  onChange: (val: boolean) => void;
};

export function AccentSlider(props: Props) {
  const {isChecked, onChange} = props;

  const [isHiddenChecked, setIsHiddenChecked] = React.useState(isChecked);
  const ref = useRef<HTMLInputElement>(null);

  // If the parent isChecked changes, update our local checked state
  React.useEffect(() => {
    setIsHiddenChecked(isChecked);
  }, [isChecked]);

  const hiddenOnChange = () => {
    const newIsChecked = !isChecked;
    setIsHiddenChecked(newIsChecked);
    onChange(newIsChecked);
    if (ref.current) {
      ref.current.blur();
    }
  };

  return (
    <Switch>
      <HiddenInput
        ref={ref}
        type="checkbox"
        checked={isHiddenChecked}
        onChange={hiddenOnChange}
      />
      <Slider $ischecked={isHiddenChecked} />
    </Switch>
  );
}
