import '@webscopeio/react-textarea-autocomplete/style.css';
import {createRoot} from 'react-dom/client';
import './app.global.css';
import Root from './containers/Root';
import {updateCSSVariables} from './utils/color-math';
import {
  getSettings,
  getThemeModeFromStore,
  getThemeNameFromStore,
} from './utils/device-store';
import {THEMES} from './utils/themes';
import {applyUiScale} from './utils/native';

import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((lng: string) => import(`./locales/${lng}.json`)))
  .init({
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
  });

const {MODE} = import.meta.env;

const elem = document.getElementById('root');
if (elem) {
  const root = createRoot(elem);
  const settings = getSettings();
  // Apply the persisted appearance before the first paint so there is no
  // dark/light flash on startup.
  document.documentElement.dataset['themeMode'] = settings?.themeMode || 'dark';
  document.documentElement.dataset['uiScale'] = String(settings?.uiScale || 1);
  applyUiScale(settings?.uiScale || 1);
  root.render(<Root />);
  updateCSSVariables(getThemeNameFromStore() as keyof typeof THEMES);
}
