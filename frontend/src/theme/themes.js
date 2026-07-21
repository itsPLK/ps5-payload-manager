/**
 * Payload Manager themes — fully isolated token sets.
 * Every visual token is defined on BOTH themes so switching never leaves
 * leftover values from the previous theme.
 */

export const THEME_STORAGE_KEY = 'pldmgr-theme'
export const DEFAULT_THEME = 'classic'

/** Shared token keys — both themes must define every key. */
export const THEME_VAR_KEYS = [
  '--color-ps-blue',
  '--color-ps-blue-glow',
  '--color-ps-yellow',
  '--color-ps-red',
  '--color-ps-black',
  '--color-ps-surface',
  '--color-ps-card',
  '--color-ps-border',
  '--color-nav-idle',
  '--color-nav-active',
  '--color-nav-active-bg',
  '--color-nav-active-border',
  '--color-nav-hover',
  '--color-nav-hover-bg',
  '--color-title-accent',
  '--color-title-glow',
  '--color-hud',
  '--color-text',
  '--color-muted',
  '--color-scrollbar',
  '--color-card-hover-bg',
  '--color-card-hover-border',
  '--color-card-hover-shadow',
  '--color-brand',
  '--color-brand-glow',
  '--color-brand-icon-bg',
  '--color-brand-icon-fg',
  '--color-brand-icon-border',
  '--color-brand-icon-shadow',
  '--font-ui',
  '--font-display',
  '--radius-ps-xl',
  '--radius-ps-2xl',
  '--radius-ps-3xl',
  '--radius-nav',
  '--letter-spacing-body',
  '--letter-spacing-heading',
  '--text-transform-heading',
  '--theme-atmosphere',
]

export const THEMES = {
  classic: {
    id: 'classic',
    label: 'Classic',
    description: 'Original PS blue manager look',
    vars: {
      '--color-ps-blue': '#0095ff',
      '--color-ps-blue-glow': 'rgba(0, 149, 255, 0.4)',
      '--color-ps-yellow': '#fcee0a',
      '--color-ps-red': '#ef4444',
      '--color-ps-black': '#08080a',
      '--color-ps-surface': '#101014',
      '--color-ps-card': 'rgba(24, 24, 28, 0.8)',
      '--color-ps-border': 'rgba(255, 255, 255, 0.08)',
      '--color-nav-idle': '#a1a1aa',
      '--color-nav-active': '#ffffff',
      '--color-nav-active-bg': '#0095ff',
      '--color-nav-active-border': 'transparent',
      '--color-nav-hover': '#ffffff',
      '--color-nav-hover-bg': 'rgba(255, 255, 255, 0.05)',
      '--color-title-accent': '#0095ff',
      '--color-title-glow': 'transparent',
      '--color-hud': 'rgba(255, 255, 255, 0.35)',
      '--color-text': '#f4f4f5',
      '--color-muted': '#a1a1aa',
      '--color-scrollbar': 'rgba(255, 255, 255, 0.15)',
      '--color-card-hover-bg': 'rgba(40, 40, 45, 0.95)',
      '--color-card-hover-border': '#0095ff',
      '--color-card-hover-shadow': 'none',
      '--color-brand': '#ffffff',
      '--color-brand-glow': 'transparent',
      '--color-brand-icon-bg': '#0095ff',
      '--color-brand-icon-fg': '#ffffff',
      '--color-brand-icon-border': 'transparent',
      '--color-brand-icon-shadow': 'none',
      '--font-ui': 'system-ui, "Segoe UI", sans-serif',
      '--font-display': 'system-ui, "Segoe UI", sans-serif',
      '--radius-ps-xl': '1rem',
      '--radius-ps-2xl': '1.5rem',
      '--radius-ps-3xl': '2rem',
      '--radius-nav': '1rem',
      '--letter-spacing-body': 'normal',
      '--letter-spacing-heading': '-0.025em',
      '--text-transform-heading': 'none',
      '--theme-atmosphere': '0',
    },
  },
  cyberpunk: {
    id: 'cyberpunk',
    label: 'Cyberpunk 2077',
    description: 'Night City HUD — red chrome, cyan select, code rain',
    vars: {
      '--color-ps-blue': '#00f0ff',
      '--color-ps-blue-glow': 'rgba(0, 240, 255, 0.45)',
      '--color-ps-yellow': '#fcee0a',
      '--color-ps-red': '#ff3c3c',
      '--color-ps-black': '#0a0508',
      '--color-ps-surface': 'rgba(12, 4, 8, 0.92)',
      '--color-ps-card': 'rgba(18, 6, 10, 0.82)',
      '--color-ps-border': 'rgba(255, 60, 60, 0.28)',
      '--color-nav-idle': 'rgba(255, 90, 90, 0.75)',
      '--color-nav-active': '#00f0ff',
      '--color-nav-active-bg': 'rgba(0, 240, 255, 0.04)',
      '--color-nav-active-border': '#00f0ff',
      '--color-nav-hover': '#ff9a9a',
      '--color-nav-hover-bg': 'transparent',
      '--color-title-accent': '#ff3c3c',
      '--color-title-glow': 'rgba(255, 60, 60, 0.45)',
      '--color-hud': 'rgba(255, 80, 80, 0.55)',
      '--color-text': '#e8e4e0',
      '--color-muted': '#7a6a68',
      '--color-scrollbar': 'rgba(255, 60, 60, 0.35)',
      '--color-card-hover-bg': 'rgba(20, 10, 16, 0.95)',
      '--color-card-hover-border': 'rgba(0, 240, 255, 0.45)',
      '--color-card-hover-shadow': '0 0 24px rgba(0, 240, 255, 0.12)',
      '--color-brand': '#ff3c3c',
      '--color-brand-glow': 'rgba(255, 60, 60, 0.55)',
      '--color-brand-icon-bg': 'transparent',
      '--color-brand-icon-fg': '#ff3c3c',
      '--color-brand-icon-border': 'rgba(255, 60, 60, 0.5)',
      '--color-brand-icon-shadow': '0 0 16px rgba(255, 60, 60, 0.25)',
      '--font-ui': '"Share Tech Mono", Consolas, "Courier New", monospace',
      '--font-display': '"Share Tech Mono", Consolas, monospace',
      '--radius-ps-xl': '0.25rem',
      '--radius-ps-2xl': '0.35rem',
      '--radius-ps-3xl': '0.5rem',
      '--radius-nav': '2px',
      '--letter-spacing-body': '0.02em',
      '--letter-spacing-heading': '0.04em',
      '--text-transform-heading': 'uppercase',
      '--theme-atmosphere': '1',
    },
  },
}

export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME]
}

/**
 * Apply a theme with full isolation:
 * - removes every known theme class
 * - rewrites ALL theme CSS variables (complete set)
 * - sets data-theme for CSS selectors
 * - syncs body typography
 */
export function applyThemeVars(themeId) {
  const theme = getTheme(themeId)
  const root = document.documentElement

  // Drop every theme-* class so nothing stacks
  Array.from(root.classList).forEach((c) => {
    if (c.startsWith('theme-')) root.classList.remove(c)
  })
  root.classList.add(`theme-${theme.id}`)
  root.setAttribute('data-theme', theme.id)

  // Write complete token set
  THEME_VAR_KEYS.forEach((key) => {
    const value = theme.vars[key]
    if (value != null) root.style.setProperty(key, value)
    else root.style.removeProperty(key)
  })

  // Body-level sync (avoids cached font / spacing artifacts)
  if (document.body) {
    document.body.style.fontFamily = theme.vars['--font-ui'] || ''
    document.body.style.letterSpacing = theme.vars['--letter-spacing-body'] || 'normal'
    document.body.style.color = theme.vars['--color-text'] || ''
    document.body.style.backgroundColor = theme.vars['--color-ps-black'] || ''
  }
}
