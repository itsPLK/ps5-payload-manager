import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEMES,
  applyThemeVars,
  getTheme,
} from './themes'

const ThemeContext = createContext({
  themeId: DEFAULT_THEME,
  theme: getTheme(DEFAULT_THEME),
  setThemeId: () => {},
  themes: THEMES,
})

export function ThemeProvider({ children }) {
  const [themeId, setThemeIdState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved && THEMES[saved]) return saved
    } catch (_) { /* ignore */ }
    return DEFAULT_THEME
  })

  useEffect(() => {
    applyThemeVars(themeId)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId)
    } catch (_) { /* ignore */ }
  }, [themeId])

  const value = useMemo(
    () => ({
      themeId,
      theme: getTheme(themeId),
      setThemeId: setThemeIdState,
      themes: THEMES,
    }),
    [themeId]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
