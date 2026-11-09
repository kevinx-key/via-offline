import styled from 'styled-components';

const Container = styled.div`
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 22vw;
  white-space: nowrap;
  color: var(--color_label);
  font-size: 12px;
  letter-spacing: 0.04em;
  line-height: 1;
  user-select: none;
  pointer-events: none;
`;

const Mark = styled.img`
  height: 17px;
  width: 17px;
  display: block;
  flex: none;
  opacity: 0.9;
`;

const Strong = styled.span`
  font-weight: 500;
  color: var(--color_label-highlighted);
`;

const Divider = styled.span`
  opacity: 0.45;
`;

/**
 * Always-visible marker: this binary is a K-STAR build of the offline VIA
 * app, not an official VIA release. Kept deliberately visible (not hidden in an
 * "about" dialog) so the modified build can never be mistaken for upstream VIA.
 */
export const BuildBadge = () => (
  <Container
    title={
      'K-STAR 定制版 · VIA 离线版（非官方构建）\n' +
      'Unofficial offline build of VIA · not affiliated with the VIA project.\n' +
      'Based on github.com/the-via/app (GPL-3.0)'
    }
  >
    <Mark src="/images/logo.png" alt="" />
    <Strong>K-STAR</Strong>
    <Divider>·</Divider>
    <span>VIA 离线版（非官方）</span>
  </Container>
);



