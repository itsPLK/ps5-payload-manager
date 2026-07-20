import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './i18n'
import { ThemeProvider } from './theme/ThemeContext.jsx'
import { applyThemeVars, DEFAULT_THEME, THEME_STORAGE_KEY, THEMES } from './theme/themes.js'

// Apply theme before first paint to avoid flash
try {
  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  applyThemeVars(saved && THEMES[saved] ? saved : DEFAULT_THEME)
} catch (_) {
  applyThemeVars(DEFAULT_THEME)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

if (window.applicationCache) {
  window.applicationCache.addEventListener('updateready', () => {
    if (window.applicationCache.status === window.applicationCache.UPDATEREADY) {
      window.applicationCache.swapCache();
      window.location.reload();
    }
  }, false);
}
