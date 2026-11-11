import styled from 'styled-components';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faMoon, faSun} from '@fortawesome/free-solid-svg-icons';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {getThemeMode, setThemeMode} from 'src/store/settingsSlice';
import {useTranslation} from 'react-i18next';

const Button = styled.button`
  width: 34px;
  height: 34px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 9px;
  border: 1px solid var(--border_color_cell);
  background: var(--bg_menu);
  color: var(--color_label-highlighted);
  cursor: pointer;
  transition: all 0.16s ease;

  &:hover {
    color: var(--color_accent);
    border-color: var(--color_accent);
  }
`;

export const ThemeToggle = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const mode = useAppSelector(getThemeMode);

  return (
    <Button
      onClick={() => {
        // Keep the explicit action, but route through setThemeMode so the
        // chosen value is always persisted (toggleThemeMode only flips).
        dispatch(setThemeMode(mode === 'light' ? 'dark' : 'light'));
      }}
      title={mode === 'light' ? t('Switch to dark mode') : t('Switch to light mode')}
      aria-label={mode === 'light' ? t('Switch to dark mode') : t('Switch to light mode')}
    >
      <FontAwesomeIcon icon={mode === 'light' ? faMoon : faSun} />
    </Button>
  );
};
