import { t } from 'i18next';

// This file exists solely to allow i18next-parser to extract category names 
// from the default payloads.json repository into the Crowdin translation files.
// We don't expect these to change often, but if they do, add them here.
export const extractCategories = () => {
  t('category.Utilities & Tools', 'Utilities & Tools');
  t('category.Loaders', 'Loaders');
  t('category.System & Jailbreak', 'System & Jailbreak');
  t('category.Networking & Servers', 'Networking & Servers');
};
