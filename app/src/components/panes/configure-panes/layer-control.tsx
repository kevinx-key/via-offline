import {useMemo} from 'react';
import {useDispatch} from 'react-redux';
import {useAppSelector} from 'src/store/hooks';
import {
  getNumberOfLayers,
  getSelectedLayerIndex,
  setLayer,
} from 'src/store/keymapSlice';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const Container = styled.div`
  position: absolute;
  left: 14px;
  font-weight: 400;
  top: 10px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 7px;
  border-radius: 10px;
  border: 1px solid var(--border_color_cell);
  background: var(--bg_menu);
  box-shadow: var(--shadow-1);
  z-index: 4;
`;
const Label = styled.label`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color_label);
  margin-right: 5px;
`;
const LayerButton = styled.button<{$selected?: boolean}>`
  outline: none;
  font-variant-numeric: tabular-nums;
  border: none;
  min-width: 24px;
  height: 24px;
  border-radius: 6px;
  background: ${(props) =>
    props.$selected ? 'var(--color_accent)' : 'transparent'};
  color: ${(props) =>
    props.$selected
      ? 'var(--color_inside-accent)'
      : 'var(--color_label-highlighted)'};
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  &:hover {
    border: none;
    background: ${(props) => (props.$selected ? 'var(--color_accent)' : 'var(--bg_control)')};
    color: ${(props) =>
      props.$selected ? 'var(--color_inside-accent)' : 'var(--color_accent)'};
  }
`;

export const LayerControl = () => {
  const {t} = useTranslation();
  const dispatch = useDispatch();
  const numberOfLayers = useAppSelector(getNumberOfLayers);
  const selectedLayerIndex = useAppSelector(getSelectedLayerIndex);

  const Layers = useMemo(
    () =>
      new Array(numberOfLayers)
        .fill(0)
        .map((_, idx) => idx)
        .map((layerLabel) => (
          <LayerButton
            key={layerLabel}
            $selected={layerLabel === selectedLayerIndex}
            onClick={() => dispatch(setLayer(layerLabel))}
          >
            {layerLabel}
          </LayerButton>
        )),
    [numberOfLayers, selectedLayerIndex],
  );

  return (
    <Container>
      <Label>{t('Layer')}</Label>
      {Layers}
    </Container>
  );
};
