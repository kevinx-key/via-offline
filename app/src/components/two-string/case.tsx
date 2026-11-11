import React from 'react';
import {useMemo} from 'react';
import {shallowEqual} from 'react-redux';
import {useAppSelector} from 'src/store/hooks';
import {getThemeMode} from 'src/store/settingsSlice';
import {CSSVarObject} from 'src/utils/keyboard-rendering';
import styled from 'styled-components';

const CaseGroup = styled.div<{}>``;
const OuterCase = styled.div<{
  background: string;
  height: number;
  width: number;
}>`
  background: ${(props) => props.background};
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
`;
const InnerCase = styled.div<{
  background: string;
  height: number;
  width: number;
}>`
  background: ${(props) => props.background};
  top: 0;
  left: 0;
  position: absolute;
  width: ${(props) => props.width}px;
  height: ${(props) => props.height}px;
`;

export const CaseInsideBorder = 10;

export const Case = React.memo((props: {width: number; height: number}) => {
  const themeMode = useAppSelector(getThemeMode);
  const light = themeMode === 'light';
  const properWidth =
    props.width * CSSVarObject.keyXPos - CSSVarObject.keyXSpacing;
  const properHeight =
    CSSVarObject.keyYPos * props.height - CSSVarObject.keyYSpacing;
  const insideBorder = CSSVarObject.insideBorder;
  const insideWidth = properWidth + insideBorder * 1;
  const outsideWidth = properWidth + insideBorder * 3;
  const [insideHeight, outsideHeight] = [
    properHeight + insideBorder,
    properHeight + insideBorder * 3,
  ];

  const palette = useMemo(
    () =>
      light
        ? {
            outside: '#f4f7fb',
            edge: '#d4dce7',
            top: '#ffffff',
            mid: '#f8fafd',
            bottom: '#e6edf6',
            shadow: '0 10px 28px rgba(28, 38, 56, 0.16)',
          }
        : {
            outside: '#17181d',
            edge: '#2f3038',
            top: '#2b2c33',
            mid: '#1c1d22',
            bottom: '#111216',
            shadow: '0 14px 34px rgba(0, 0, 0, 0.55)',
          },
    [light],
  );

  return (
    <CaseGroup>
      <OuterCase
        background={palette.outside}
        width={outsideWidth}
        height={outsideHeight}
        style={{
          borderRadius: 10,
          border: `1px solid ${palette.edge}`,
          boxShadow: palette.shadow,
        }}
      />
      <InnerCase
        background={`linear-gradient(200deg, ${palette.top} 38%, ${palette.mid}, ${palette.bottom} 82%)`}
        width={insideWidth}
        height={insideHeight}
        style={{
          transform: `translate( ${insideWidth - properWidth}px,
           ${insideHeight - properHeight}px)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
          borderRadius: 9,
        }}
      />
    </CaseGroup>
  );
}, shallowEqual);
