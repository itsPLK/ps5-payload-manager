import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEMES,
  applyThemeVars,
  getTheme,
  listThemes,
  themeHasFeature,
} from './themes'

const ThemeContext = createContext({
  themeId: DEFAULT_THEME,
  theme: getTheme(DEFAULT_THEME),
  features: getTheme(DEFAULT_THEME).features,
  setThemeId: () => {},
  themes: THEMES,
  hasFeature: () => false,
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

  const theme = useMemo(() => getTheme(themeId), [themeId])

  const hasFeature = useCallback(
    (feature) => themeHasFeature(themeId, feature),
    [themeId]
  )

  const value = useMemo(
    () => ({
      themeId,
      theme,
      features: theme.features,
      setThemeId: setThemeIdState,
      themes: THEMES,
      listThemes,
      hasFeature,
    }),
    [themeId, theme, hasFeature]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

/** Convenience: feature flag for the active theme */
export function useThemeFeature(feature) {
  const { hasFeature } = useTheme()
  return hasFeature(feature)
}
