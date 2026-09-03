import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';
import rw from './locales/rw.json';
import policyEn from '../lib/policyContent.en.json';
import policyFr from '../lib/policyContent.fr.json';
import policyRw from '../lib/policyContent.rw.json';

function mergePolicy(base, policyBundle) {
  return { ...base, ...policyBundle };
}

// Version the first-run choice so existing installs receive the updated
// language welcome screen once, then keep the user's new selection.
export const LANGUAGE_STORAGE_KEY = 'safariscon_language_v4';

export const languages = [
  { code: 'en', labelKey: 'languages.en', nativeName: 'English', shortLabel: 'EN' },
  { code: 'rw', labelKey: 'languages.rw', nativeName: 'Kinyarwanda', shortLabel: 'RW' },
  { code: 'fr', labelKey: 'languages.fr', nativeName: 'Français', shortLabel: 'FR' },
];

const supportedLanguages = languages.map((language) => language.code);

function getDeviceLanguage() {
  const locale = Localization.getLocales()?.[0]?.languageCode;
  return supportedLanguages.includes(locale) ? locale : 'en';
}

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: {
    en: { translation: mergePolicy(en, policyEn) },
    rw: { translation: mergePolicy(rw, policyRw) },
    fr: { translation: mergePolicy(fr, policyFr) },
  },
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export async function getSavedLanguage() {
  try {
    const savedLanguage = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
    return supportedLanguages.includes(savedLanguage) ? savedLanguage : null;
  } catch {
    return null;
  }
}

export async function loadSavedLanguage() {
  try {
    const savedLanguage = await getSavedLanguage();
    if (savedLanguage) {
      await i18n.changeLanguage(savedLanguage);
    }
    return savedLanguage;
  } catch {
    // Keep the detected language when storage is not available.
    return null;
  }
}

export async function setAppLanguage(language) {
  if (!supportedLanguages.includes(language)) return;
  await i18n.changeLanguage(language);
  await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, language).catch(() => {});
}

export default i18n;
