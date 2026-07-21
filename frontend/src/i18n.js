import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all locales dynamically so they are bundled by Vite
const resources = {};
const modules = import.meta.glob('./locales/*.json', { eager: true });
// Get en-US translation to use as the baseline for completion percentage
const enUSModule = modules['./locales/en-US.json'];
const enUSTranslation = enUSModule ? (enUSModule.default || enUSModule) : {};
const totalKeys = Object.keys(enUSTranslation).length || 1;

for (const path in modules) {
  // Extract filename without extension, e.g., 'en-US', 'pl-PL'
  const language = path.match(/\/([^/]+)\.json$/)[1];
  const translation = modules[path].default || modules[path];
  
  if (language === 'en-US') {
    resources[language] = { translation };
    continue;
  }

  // Calculate how many keys are actually translated (different from English)
  let translatedCount = 0;
  for (const key in translation) {
    // If the key exists in English and the value is different, it's translated
    if (key in enUSTranslation && translation[key] !== enUSTranslation[key]) {
      translatedCount++;
    }
  }

  const completionRate = translatedCount / totalKeys;
  
  // Only register the language if it's at least 70% translated
  if (completionRate >= 0.70) {
    resources[language] = { translation };
  } else {
    console.log(`[i18n] Hiding ${language} (only ${Math.round(completionRate * 100)}% translated)`);
  }
}

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    resources,
    fallbackLng: 'en-US',
    
    // Default to detected browser language on first load, and load from localStorage if previously selected
    detection: {
      order: ['localStorage', 'navigator'],
      // Only explicit selections are persisted by changeLanguagePreference.
      caches: []
    },
    
    // We use the 'natural' naming strategy: keys are strings in English
    // So if the key is missing in translation file, it will just use the key itself.
    keySeparator: false, 

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

export default i18n;
