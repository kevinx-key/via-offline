import styled from 'styled-components';

export const ModalBackground = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(2px);
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
`;

export const ModalContainer = styled.div`
  border: 1px solid var(--border_color_cell);
  min-width: 440px;
  width: max-content;
  max-width: calc(100vw - 40px);
  min-height: 150px;
  gap: 16px;
  background-color: var(--bg_menu);
  border-radius: 14px;
  box-shadow: var(--shadow-3);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 22px;
  box-sizing: border-box;
`;

export const PromptText = styled.div`
  font-weight: 400;
  user-select: text;
  -webkit-user-select: text;
  color: var(--color_label-highlighted);
  font-size: 13px;
  line-height: 1.6;
  max-width: calc(100vw - 80px);
  white-space: pre-line;
  text-align: center;
`;

export const RowDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 220px;
  gap: 20px;
`;
