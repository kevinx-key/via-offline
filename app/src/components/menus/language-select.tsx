import {FC, useMemo, useState} from 'react';
import {faLanguage} from '@fortawesome/free-solid-svg-icons';
import {CategoryIconContainer} from '../panes/grid';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import styled from 'styled-components';
import {useTranslation} from 'react-i18next';

const Container = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const LanguageList = styled.ul<{$show: boolean}>`
  padding: 6px;
  border: 1px solid var(--border_color_cell);
  width: 160px;
  border-radius: 10px;
  background-color: var(--bg_menu);
  box-shadow: var(--shadow-2);
  margin: 0;
  margin-top: 5px;
  top: 40px;
  right: 0px;
  position: absolute;
  pointer-events: ${(props) => (props.$show ? 'all' : 'none')};
  transition: all 0.2s ease-out;
  z-index: 41;
  opacity: ${(props) => (props.$show ? 1 : 0)};
  overflow: hidden;
  transform: ${(props) => (props.$show ? 'translateY(0)' : `translateY(-5px)`)};
`;

const LanugaeButton = styled.button<{$selected?: boolean}>`
  display: block;
  text-align: center;
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
  font-size: 12.5px;
  padding: 7px 9px;
  &:hover {
    border: none;
    background: ${(props) =>
      props.$selected ? 'var(--bg_accent-soft)' : 'var(--bg_control)'};
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
  background: rgba(0, 0, 0, 0.12);
`;

const LanguageSelectors: React.FC<{
  show: boolean;
  onClickOut: () => void;
}> = (props) => {
  const langs = [
    {code: 'en', lang: 'English'},
    {code: 'zh', lang: '中文'},
    {code: 'ko', lang: '한국어'},
    {code: 'ja', lang: '日本語'},
    {code: 'es', lang: 'Español'},
    {code: 'de', lang: 'Deutsch'},
  ];
  const {i18n} = useTranslation();
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    props.onClickOut();
  };

  const selectLang = useMemo(() => {
    return i18n.resolvedLanguage
      ? i18n.resolvedLanguage
      : i18n.languages[i18n.languages.length - 1];
  }, [i18n.resolvedLanguage, i18n.languages]);

  return (
    <>
      {props.show && <ClickCover onClick={props.onClickOut} />}
      <LanguageList $show={props.show}>
        {langs.map(({lang, code}) => {
          return (
            <LanugaeButton
              $selected={code === selectLang}
              key={code}
              onClick={() => changeLanguage(code)}
            >
              {lang}
            </LanugaeButton>
          );
        })}
      </LanguageList>
    </>
  );
};

export const LanguageSelect: FC = () => {
  const [showList, setShowList] = useState(false);
  return (
    <Container>
      <CategoryIconContainer>
        <FontAwesomeIcon
          size={'xl'}
          icon={faLanguage}
          onClick={() => setShowList(true)}
        />
      </CategoryIconContainer>
      <LanguageSelectors
        show={showList}
        onClickOut={() => setShowList(false)}
      />
    </Container>
  );
};
