import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import vi from './vi.json';
import en from './en.json';

const resources = {
  vi: {translation: vi},
  en: {translation: en},
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'vi',
  fallbackLng: 'en',
  interpolation: {
    // React already escapes values
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
