import {faDiscord, faGithub} from '@fortawesome/free-brands-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import styled from 'styled-components';
import {VIALogo} from '../icons/via';
import {CategoryMenuTooltip} from '../inputs/tooltip';
import {CategoryIconContainer} from '../panes/grid';

const ExternalLinkContainer = styled.span`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 4px;
  padding-left: 8px;
  border-left: 1px solid var(--border_color_cell);
`;

export const ExternalLinks = () => (
  <ExternalLinkContainer>
    <a href="https://app.starthock.com/via/docs" target="_blank">
      <CategoryIconContainer>
        <VIALogo height="17px" fill="currentColor" />
        <CategoryMenuTooltip>K-STAR · Docs</CategoryMenuTooltip>
      </CategoryIconContainer>
    </a>
    <a href="https://discord.gg/ztQnqW5MTd" target="_blank">
      <CategoryIconContainer>
        <FontAwesomeIcon icon={faDiscord} />
        <CategoryMenuTooltip>K-STAR Discord</CategoryMenuTooltip>
      </CategoryIconContainer>
    </a>
    <a href="https://github.com/kevinx-key/via-offline" target="_blank">
      <CategoryIconContainer>
        <FontAwesomeIcon icon={faGithub} />
        <CategoryMenuTooltip>Source · GitHub</CategoryMenuTooltip>
      </CategoryIconContainer>
    </a>
  </ExternalLinkContainer>
);
