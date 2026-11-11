import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const Container = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding-right: 14px;
  margin-right: 2px;
  border-right: 1px solid var(--border_color_cell);
  white-space: nowrap;
  color: var(--color_label);
  font-size: 11px;
  letter-spacing: 0.02em;
  line-height: 1;
  user-select: none;
  pointer-events: none;
`;

const Mark = styled.img`
  height: 24px;
  width: 24px;
  display: block;
  flex: none;
  border-radius: 6px;
  opacity: 0.95;
`;

const Text = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const Strong = styled.span`
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--color_label-highlighted);
`;

/**
 * Always-visible marker: this binary is a K-STAR build of the offline VIA
 * app, not an official VIA release. Kept deliberately visible (not hidden in an
 * "about" dialog) so the modified build can never be mistaken for upstream VIA.
 */
export const BuildBadge = () => {
  const {t} = useTranslation();
  return (
    <Container
      title={
        `K-STAR · ${t('VIA offline (unofficial)')}\n` +
        'Unofficial offline build of VIA · not affiliated with the VIA project.\n' +
        'Based on github.com/the-via/app (GPL-3.0)'
      }
    >
      <Mark src="/images/logo.png" alt="" />
      <Text>
        <Strong>K-STAR</Strong>
        <span className="badge-sub">{t('VIA offline (unofficial)')}</span>
      </Text>
    </Container>
  );
};
